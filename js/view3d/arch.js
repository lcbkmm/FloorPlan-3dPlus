import * as THREE from 'three';
import {CSS2DObject} from 'three/addons/renderers/CSS2DRenderer.js';
import {V, hooks, syncOrigin, wx, wz, M, lowEndDevice} from './shared.js';
import {mat, floorMat, wallpaperMat, TEX} from './materials.js';
import {box, rbox, mesh, cyl, blob, metal} from './geo.js';
import {buildFurniture} from './furniture.js';

export function clearGroup(g){ g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); g.clear(); }

/* ============================================================
 *  楼板挖空：房间多边形 − 若干个轴对齐矩形（层间连通区）
 *  用「半平面裁剪 + 网格分块」得到若干互不重叠的简单多边形，
 *  再一次性交给 ShapeGeometry(shapes[]) 合成单个 mesh，避免逐片建模拖慢渲染。
 * ============================================================ */
export function clipPolyHalf(poly, axis, val, keepLE){
  const out = [], coord = p => p[axis];
  const inside = p => keepLE ? coord(p) <= val + 1e-6 : coord(p) >= val - 1e-6;
  for (let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push([a[0], a[1]]);
    if (ia !== ib){
      const t = (val - coord(a)) / (coord(b) - coord(a));
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
export function clipPolyRect(poly, r){
  let p = clipPolyHalf(poly, 0, r[0], false); if (p.length < 3) return [];
  p = clipPolyHalf(p, 0, r[2], true);        if (p.length < 3) return [];
  p = clipPolyHalf(p, 1, r[1], false);       if (p.length < 3) return [];
  return clipPolyHalf(p, 1, r[3], true);
}
export function polyArea2(poly){
  let a = 0;
  for (let i = 0; i < poly.length; i++){
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}
export function subtractRectsFromPoly(poly, rects){
  if (!rects || !rects.length || poly.length < 3) return [poly];
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  poly.forEach(p => { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); });
  const xs = [], ys = [];
  rects.forEach(r => { if (r[2] > bx0 && r[0] < bx1 && r[3] > by0 && r[1] < by1){ xs.push(r[0], r[2]); ys.push(r[1], r[3]); } });
  if (!xs.length) return [poly];
  const grid = (vals, lo, hi) => {
    const s = new Set([lo - 1, hi + 1]);
    vals.forEach(v => { if (v > lo && v < hi) s.add(v); });
    return [...s].sort((a, b) => a - b);
  };
  const gx = grid(xs, bx0, bx1), gy = grid(ys, by0, by1);
  const out = [];
  for (let i = 0; i < gx.length - 1; i++) for (let j = 0; j < gy.length - 1; j++){
    const cell = [gx[i], gy[j], gx[i + 1], gy[j + 1]];
    if (cell[2] - cell[0] < 1 || cell[3] - cell[1] < 1) continue;
    const cx = (cell[0] + cell[2]) / 2, cy = (cell[1] + cell[3]) / 2;
    if (rects.some(r => cx > r[0] && cx < r[2] && cy > r[1] && cy < r[3])) continue;
    const part = clipPolyRect(poly, cell);
    if (part.length >= 3 && polyArea2(part) > 100) out.push(part);
  }
  return out.length ? out : [poly];
}
/** 当前正在构建的楼层需要挖空的矩形（本层连通区，由 buildArch 逐层设置） */
let activeVoidRects = [];
/** 露天房间名（花园 / 庭院 / 露台 / 天井 …）：上下层共用同一判据 */
const OPEN_AIR_RE = /花园|庭院|露台|天井|outdoor|garden|patio|courtyard|terrace/i;
/** 本层因「下层露天房间」而需要挑空的矩形，按房间隔离：
 *  每项 {roomId, rect:[x0,y0,x1,y1]}（本层局部 mm），只作用于 roomId 那一个房间。
 *  早期版本把下层花园 bbox 无差别塞进整层 void，结果 2F 客厅被擦到一条边的那部分
 *  楼板也被挖掉，1F 仰视看穿到 2F 悬空家具。现在只挖「几乎完全被下层露天区覆盖」
 *  的上层房间，且挑空矩形不参与其它房间的裁剪，从根上避免误伤。 */
let activeOpenAirVoids = [];
/** 房间多边形包围盒（局部 mm） */
function polyBBox(poly){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly){
    x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
  }
  return (x1 - x0 > 1 && y1 - y0 > 1) ? [x0, y0, x1, y1] : null;
}
/** 房间是否露天：优先 state.rooms（用户改名写在这里，见 panel.js），
 *  回退 plan.rooms 的导入名。withFloorData 内 state.rooms 已切成本层数据。 */
function roomIsOpenAir(r){
  if (!r) return false;
  const cur = state.rooms && state.rooms[r.id] && state.rooms[r.id].name;
  return OPEN_AIR_RE.test(cur || r.name || '');
}
/** 墙面点归属：射线法判断点是否落在房间内 */
export function wallPointInPoly(x, y, poly){
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function wallDistToPoly(x, y, poly){
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const [x1, y1] = poly[j], [x2, y2] = poly[i];
    const dx = x2 - x1, dy = y2 - y1, L = dx*dx + dy*dy;
    const t = L ? Math.max(0, Math.min(1, ((x-x1)*dx + (y-y1)*dy) / L)) : 0;
    best = Math.min(best, Math.hypot(x - (x1 + t*dx), y - (y1 + t*dy)));
  }
  return best;
}
/** 墙的某一侧属于哪个房间；外墙外侧 / 室外返回 null */
export function wallRoomAt(x, y){
  if (typeof ROOMS === 'undefined' || !ROOMS.length) return null;
  for (const r of ROOMS){
    if (r.counted === false || !r.poly || r.poly.length < 3) continue;
    if (wallPointInPoly(x, y, r.poly)) return r.id;
  }
  let best = null, bd = 220;
  for (const r of ROOMS){
    if (r.counted === false || !r.poly || r.poly.length < 3) continue;
    const d = wallDistToPoly(x, y, r.poly);
    if (d < bd){ bd = d; best = r.id; }
  }
  return best;
}
/** BoxGeometry 六面 UV 按真实米数缩放：贴图 1m×1m，长短墙图案密度一致 */
export function scaleWallUV(geo, W, H, D){
  const uv = geo.attributes && geo.attributes.uv;
  if (!uv || uv.count !== 24) return;
  const faces = [[D,V.H],[D,V.H],[W,D],[W,D],[W,V.H],[W,V.H]];
  for (let f = 0; f < 6; f++){
    const [uw, vh] = faces[f];
    for (let k = 0; k < 4; k++){
      const i = f*4 + k;
      uv.setXY(i, uv.getX(i) * uw, uv.getY(i) * vh);
    }
  }
  uv.needsUpdate = true;
}
/** 墙盒六面材质：四个立面按所属房间贴墙纸；横梁底面也跟房间壁纸，普通墙顶/底保持剖切深色 */
export function wallFaceInfo(rect, opts){
  const [x0,y0,x1,y1] = rect, cx = (x0+x1)/2, cy = (y0+y1)/2;
  const pad = Math.max(60, Math.min(x1-x0, y1-y0) / 2 + 35);
  const ids = [wallRoomAt(x1+pad, cy), wallRoomAt(x0-pad, cy), null, null, wallRoomAt(cx, y1+pad), wallRoomAt(cx, y0-pad)];
  const wm = id => wallpaperMat((id && typeof roomWallKey === 'function' && roomWallKey(id)) || 'plain');
  // 横梁悬空：取任一邻接房间壁纸贴底/顶，避免木色梁身与房间墙面脱节
  const roomId = ids[0] || ids[1] || ids[4] || ids[5];
  const tb = (opts && opts.beam) ? wm(roomId) : V.capMat;
  // 墙盒底面朝下：合层时房间天花板只铺到墙内边线，墙带那条缝从下层斜仰视会透过
  // 来看到墙底。若沿用深色剖切材质，天花板上就会出现一条贯穿的黑带（像穿模）。
  // 底面被楼板夹住、本就不该是剖切面，改成与天花板同色同亮度的乳白。
  return { ids, mats: [wm(ids[0]), wm(ids[1]), tb, slabFaceMat, wm(ids[4]), wm(ids[5])] };
}
const wallSkirtMat = new THREE.MeshStandardMaterial({color:'#b7ac9a', roughness:.74});
/** 室内侧踢脚线：只在朝向房间且贴地的墙面生成 */
export function addWallSkirting(rect, yb, ids){
  const [x0,y0,x1,y1] = rect, t = .016, h = .085;
  const Wd = M(x1-x0), Dp = M(y1-y0);
  const cx = wx((x0+x1)/2), cz = wz((y0+y1)/2), y = yb + h/2;
  const put = (w, d, x, z) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallSkirtMat);
    o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; V.archUp.add(o);
  };
  if (ids[0]) put(t, Dp, wx(x1) + t/2, cz);
  if (ids[1]) put(t, Dp, wx(x0) - t/2, cz);
  if (ids[4]) put(Wd, t, cx, wz(y1) + t/2);
  if (ids[5]) put(Wd, t, cx, wz(y0) - t/2);
}
export function wallBox([x0, y0, x1, y1], yb, yt, m, opts){
  if (yt - yb <= .001) return;
  if (x1 - x0 < 1 || y1 - y0 < 1) return;
  const Wd = M(x1-x0), Hh = yt-yb, Dp = M(y1-y0);
  const geo = new THREE.BoxGeometry(Wd, Hh, Dp);
  scaleWallUV(geo, Wd, Hh, Dp);
  const info = m ? null : wallFaceInfo([x0,y0,x1,y1], opts);
  // 合层全高墙的墙顶被上层楼板夹住，不该露出深色剖切面；剖切视图(top<V.H)保留剖面。
  if (info && !(opts && opts.beam) && yt >= V.H - .05) info.mats[2] = slabFaceMat;
  const o = new THREE.Mesh(geo, m || info.mats);
  o.position.set(wx((x0+x1)/2), (yb+yt)/2, wz((y0+y1)/2)); o.castShadow = o.receiveShadow = true; V.archUp.add(o);
  // 漫游辅助竖棱线不在这里画：旧版按每个墙盒画完整边框（或按段端点排除），
  // 会在共线拼接处、门窗洞两侧留下贯穿整面墙的深色竖线，看起来像墙裂了一道缝。
  // 现改为整层只按「真墙角 / 拐角」一次性生成，见 buildArchContent 里的 addCornerLines。
  if (info && yb <= .001) addWallSkirting([x0,y0,x1,y1], yb, info.ids);
}
const edgeMat = new THREE.LineBasicMaterial({color:0x6f675b}), skirtMat = new THREE.MeshStandardMaterial({color:'#8b7f6e', roughness:.6});
// 与天花板(V.ceilMat)同色同亮度的实体面：用于被楼板夹住的墙顶 / 墙底，
// 避免下层仰视时把深色剖切面(capMat)看穿成天花板上的黑色斜带。
const slabFaceMat = new THREE.MeshStandardMaterial({
  color: '#efe6d4', roughness: .96, emissive: '#e9dcc2', emissiveIntensity: .5,
});

/** 漫游辅助竖棱线：只在墙体「真墙角 / 拐角」出现。
 *
 *  旧实现按每个墙盒生成一圈完整 EdgesGeometry，或按「同走向段端点接续」排除，
 *  都无法正确区分短墙段、近方形墙垛和门窗洞口，于是窗两侧、共线拼接处仍留下
 *  贯穿整面墙的深色竖线（视觉上像墙裂了一道缝）。
 *
 *  本实现不再逐盒判断，而是整层一次性算角点：
 *   1. 把本层所有原始墙段 + 窗 / 门 / 推拉门洞口矩形都记为「墙体占位」；
 *   2. 候选点只取原始墙段的四个角（洞口矩形不产生角点）；
 *   3. 墙角 = 该点同时挂着一条水平走向和一条竖直走向、且长度足够的墙段相交；
 *      共线拼接（只有同向墙）、自由端（只有自身）、洞口切口都不算墙角；
 *   4. 落在任何门窗洞口边界上的角点一律排除 —— 这正是「带窗的墙两侧」的竖线。
 *  逐层计算（withFloorData 已切好本层数据），结果与墙盒 / 洞口切分完全解耦。 */
let activeCorners = [];
function wallCorners(){
  const bodies = [];
  // 走向：只有长边明显更长才算方向。近方形墙垛（如 240×190 的窗边小墙垛）
  // 记为 '?' 不参与判定，否则会被误判成「横墙」，与上方竖墙拼出一个假拐角。
  const orient = (x0,y0,x1,y1) => {
    const dx = x1-x0, dy = y1-y0;
    if (dx >= dy + 80) return 'h';
    if (dy >= dx + 80) return 'v';
    return '?';
  };
  const push = (r, wall, opening) => {
    if (!r) return;
    const [x0,y0,x1,y1] = r;
    bodies.push({x0,y0,x1,y1,o:orient(x0,y0,x1,y1),wall,opening,
      len:Math.max(x1-x0,y1-y0)});
  };
  for (let i = 0; i < WALLS.length; i++){
    if (state.demolished.includes('w'+i)) continue;
    push(WALLS[i].slice(0,4), true, false);
  }
  const add = list => (list || []).forEach(d => {
    const r = Array.isArray(d) ? d : (d && d.rect);
    if (r) push(r.slice(0,4), false, true);
  });
  add(WINS); add(DOORS); add(SLIDES);

  const T = 40;                                   // 端点重合 / 洞口边界容差 mm
  const near = (a, b) => Math.abs(a - b) <= T;
  // 点是否落在矩形任意一条边上（含延长容差）：用于排除门窗洞两侧的墙垛端面
  const onRectEdge = (x, y, r) => {
    const inx = x >= r.x0-T && x <= r.x1+T, iny = y >= r.y0-T && y <= r.y1+T;
    return (inx && (near(y,r.y0) || near(y,r.y1))) ||
           (iny && (near(x,r.x0) || near(x,r.x1)));
  };
  // 点是否恰为某个矩形的角：只有角对角相交才算拐角，墙侧边中段不算
  const atRectCorner = (x, y, r) =>
    (near(x,r.x0) || near(x,r.x1)) && (near(y,r.y0) || near(y,r.y1));
  // 拐角 = 该点恰好挂着一条横墙 + 一条竖墙（各 1 条）。
  // 同方向出现 2 条 = 共线拼接 / T 接主干；只有 1 条 = 自由端；都不画。
  // 洞口矩形不计入方向统计，只用于上面的边界排除。
  const isTurn = (x, y) => {
    let h = 0, v = 0;
    for (const q of bodies){
      if (q.opening || q.o === '?' || q.len < 200) continue;
      if (!atRectCorner(x, y, q)) continue;
      if (q.o === 'h') h++; else v++;
    }
    return h === 1 && v === 1;
  };
  const out = [], seen = new Set();
  for (const s of bodies){
    if (!s.wall) continue;                        // 洞口不产生角点
    for (const [x,y] of [[s.x0,s.y0],[s.x1,s.y0],[s.x0,s.y1],[s.x1,s.y1]]){
      // 窗 / 门 / 推拉门两侧的墙垛端面：一律不画
      if (bodies.some(q => q.opening && onRectEdge(x, y, q))) continue;
      if (!isTurn(x, y)) continue;                // 共线拼接 / T 接 / 自由端也不画
      const k = Math.round(x) + ',' + Math.round(y);
      if (seen.has(k)) continue;
      seen.add(k); out.push({x, y});
    }
  }
  return out;
}
/** 整层一次性生成真墙角竖棱线：层局部坐标直接写入顶点，独立于任何墙盒。 */
function addCornerLines(yb, yt){
  if (!activeCorners.length || yt - yb <= .001) return;
  const pts = [];
  for (const c of activeCorners){
    const X = wx(c.x), Z = wz(c.y);
    pts.push(X, yb, Z, X, yt, Z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const ln = new THREE.LineSegments(g, edgeMat);
  ln.userData.walkOnly = true;
  ln.visible = V.opt.mode === 'walk';
  V.archUp.add(ln);
}
export function shapeOf(poly, flip){ const s = new THREE.Shape(); poly.forEach(([x, y], i) => s[i ? 'lineTo' : 'moveTo'](wx(x), flip ? wz(y) : -wz(y))); return s; }

/** 洞口矩形是否贴在该墙的走向（避免 T 接处门洞误切穿邻墙） */
export function rectAlongWall(w, rect){
  const wh = wallIsHoriz(w);
  const rh = (rect[2] - rect[0]) >= (rect[3] - rect[1]);
  return wh === rh;
}

/** 洞口归属判定：只让「厚度方向最贴合」的墙开洞，避免同一洞口把紧贴的平行邻墙一并挖空。
 *  仅比较厚度贴合度，共线分段墙（贴合度相同）仍可共同承载一个洞口，保持原有行为；
 *  25mm 容差吸收描摹/导入误差。 */
export function openingBelongsToWall(wallIndex, rect){
  const w = WALLS[wallIndex];
  if (!w || !rectAlongWall(w, rect)) return false;
  const horiz = wallIsHoriz(w);
  const ra = horiz ? rect[1] : rect[0], rb = horiz ? rect[3] : rect[2];
  const oa = horiz ? rect[0] : rect[1], ob = horiz ? rect[2] : rect[3];
  const crossOf = wall => Math.min(horiz ? wall[3] : wall[2], rb) - Math.max(horiz ? wall[1] : wall[0], ra);
  const alongOf = wall => Math.min(horiz ? wall[2] : wall[3], ob) - Math.max(horiz ? wall[0] : wall[1], oa);
  const cross = crossOf(w);
  if (alongOf(w) <= 0) return false;
  for (let i = 0; i < WALLS.length; i++){
    if (i === wallIndex) continue;
    const other = WALLS[i];
    if (!rectAlongWall(other, rect) || alongOf(other) <= 0) continue;
    if (crossOf(other) > cross + 25) return false;   // 存在明显更贴合的宿主墙，当前墙不该被挖
  }
  return true;
}

/** 墙上需开洞的区间（窗 / 门 / 推拉，沿墙长 mm） */
export function winOpeningsOnWall(w, wallIndex){
  const horiz = wallIsHoriz(w);
  const thick = wallThickOf(w);
  const raw = [];
  const pushRect = (rect, loose, force) => {
    // 门窗洞先做「唯一宿主墙」判定：明确标注宿主墙的窗直接采信，其余按贴合度竞争
    if (!force && !openingBelongsToWall(wallIndex, rect)) return;
    if (!rectAlongWall(w, rect)) return;
    if (horiz){
      if (!rangesOverlap(w[1], w[3], rect[1], rect[3], loose ? 100 : 25)) return;
      const a = Math.max(w[0], rect[0]), b = Math.min(w[2], rect[2]);
      // 沿墙长度须明显大于墙厚，否则是垂直墙在 T 接处的厚度投影
      if (b - a < Math.max(loose ? 40 : 100, thick * 1.25)) return;
      raw.push({a, b});
    } else {
      if (!rangesOverlap(w[0], w[2], rect[0], rect[2], loose ? 100 : 25)) return;
      const a = Math.max(w[1], rect[1]), b = Math.min(w[3], rect[3]);
      if (b - a < Math.max(loose ? 40 : 100, thick * 1.25)) return;
      raw.push({a, b});
    }
  };
  WINS.forEach((win) => {
    const hosted = Number.isFinite(win[6]) && win[6] === wallIndex;
    pushRect(win, hosted, hosted);
  });
  DOORS.forEach(d => pushRect(d.rect, true, false));
  SLIDES.forEach(s => pushRect(s.rect, true, false));
  raw.sort((u, v) => u.a - v.a);
  const merged = [];
  for (const o of raw){
    if (!merged.length || o.a > merged[merged.length - 1].b + 10) merged.push({a: o.a, b: o.b});
    else merged[merged.length - 1].b = Math.max(merged[merged.length - 1].b, o.b);
  }
  return merged;
}

/** 矮围墙材质（与图一实景：浅米色抹灰统一色） */
export function fenceMats(){
  return {
    face: mat('#f0ebe3', {roughness:.9}),
    soft: mat('#f7f3ec', {roughness:.86}),
    deep: mat('#e2dbd0', {roughness:.92}),
    gravel: mat('#dcd6cc', {roughness:.96}),
    plant: mat('#4a2c38', {roughness:.78}),
    plantLite: mat('#6b3d4a', {roughness:.8}),
  };
}
/** 图一风格立柱：与透空屏齐平的方柱，平顶无压檐（门柱/围栏柱共用） */
export function addFencePillar(g, x, z, pw, pd, h, m){
  g.add(box(pw, h, pd, m.face, x, 0, z));
  g.add(box(pw * 1.02, .018, pd * 1.02, m.soft, x, h - .01, z));
}
/** 拐角端柱去重：相邻矮围墙端点合并为一根柱 */
let fencePostRegistry = [];
export function resetFencePosts(){ fencePostRegistry = []; }
export function claimFencePost(x, z, pw, pd, h){
  const mergeR = Math.max(pw, pd, .22) * 1.35;
  for (const p of fencePostRegistry){
    if (Math.hypot(p.x - x, p.z - z) > mergeR) continue;
    const n = p.n + 1;
    p.x = (p.x * p.n + x) / n;
    p.z = (p.z * p.n + z) / n;
    p.n = n;
    p.pw = Math.max(p.pw, pw);
    p.pd = Math.max(p.pd, pd);
    p.h = Math.max(p.h, h);
    return p;
  }
  const p = {x, z, n: 1, pw, pd, h};
  fencePostRegistry.push(p);
  return p;
}
export function flushFencePosts(){
  if (!fencePostRegistry.length) return;
  const g = new THREE.Group(), m = fenceMats();
  fencePostRegistry.forEach(p => addFencePillar(g, p.x, p.z, p.pw, p.pd, p.h, m));
  V.archUp.add(g);
  fencePostRegistry = [];
}
/** 矮围墙段（参照图一）：连续内收基座 + 齐平方柱 + 错缝胶囊砖透空屏 + 前侧砾石花池
 *  opts.openStart / openEnd：贴花园门洞端不立围栏柱（门柱占位） */
export function buildFenceBox([x0, y0, x1, y1], h, opts){
  if (x1 - x0 < 1 || y1 - y0 < 1 || h <= .001) return;
  opts = opts || {};
  const openStart = !!opts.openStart, openEnd = !!opts.openEnd;
  const horiz = (x1 - x0) >= (y1 - y0);
  const len = M(horiz ? x1 - x0 : y1 - y0), thick = Math.max(M(horiz ? y1 - y0 : x1 - x0), .12);
  const cx = wx((x0 + x1) / 2), cz = wz((y0 + y1) / 2);
  const m = fenceMats();
  const baseH = Math.min(.26, Math.max(.16, h * .22));
  const wallH = Math.max(baseH + .28, h);
  const screenH = wallH - baseH;
  const post = Math.min(.32, Math.max(.22, thick * 1.35)); // 柱略宽于墙面
  const panelT = thick * .92; // 透空屏略薄，柱更突出
  const planterD = Math.max(.34, thick * 1.85);
  const g = new THREE.Group();
  const at = (t, out = 0) => horiz ? [cx + t * len, cz + out] : [cx + out, cz + t * len];

  // 扁椭圆镂空砖（圆角胶囊，略扁更接近实景陶砖）
  const addOvalBrick = (lenB, rY, rZ, matte, x, y, z) => {
    const cap = mesh(new THREE.CapsuleGeometry(rY, Math.max(.01, lenB - rY * 2), 6, 12), matte);
    if (horiz){ cap.rotation.z = Math.PI / 2; }
    else { cap.rotation.x = Math.PI / 2; }
    cap.scale.z = Math.max(.45, rZ / rY); // 沿墙厚方向压扁
    if (!horiz) cap.scale.x = Math.max(.45, rZ / rY);
    cap.position.set(x, y + rY, z);
    g.add(cap);
  };

  // —— 连续内收基座（柱与屏都坐在上面）——
  const baseW = thick * .88;
  if (horiz){
    g.add(box(len, baseH, baseW, m.deep, cx, 0, cz));
    g.add(box(len + .01, .02, baseW + .03, m.face, cx, baseH - .01, cz));
    const pz = cz + thick / 2 + planterD / 2 - .01;
    g.add(box(len, baseH * .75, planterD, m.soft, cx, 0, pz));
    g.add(box(len - .05, .03, planterD - .08, m.gravel, cx, baseH * .75, pz));
  } else {
    g.add(box(baseW, baseH, len, m.deep, cx, 0, cz));
    g.add(box(baseW + .03, .02, len + .01, m.face, cx, baseH - .01, cz));
    const px = cx + thick / 2 + planterD / 2 - .01;
    g.add(box(planterD, baseH * .75, len, m.soft, px, 0, cz));
    g.add(box(planterD - .08, .03, len - .05, m.gravel, px, baseH * .75, cz));
  }

  // —— 立柱分跨：柱距约 1.2m，避免过密 ——
  const bayTarget = 1.2;
  const nBay = Math.max(1, Math.round((len - post) / bayTarget));
  const postsT = [];
  for (let i = 0; i <= nBay; i++) postsT.push(-.5 + i / nBay);

  postsT.forEach((t, i) => {
    if (i === 0 && openStart) return;
    if (i === nBay && openEnd) return;
    const [x, z] = at(t * (1 - post / Math.max(len, .01)), 0);
    const isEnd = i === 0 || i === nBay;
    if (isEnd) claimFencePost(x, z, post, post, wallH);
    else addFencePillar(g, x, z, post, post, wallH, m);
    if (i % 2 === 0){
      const [px, pz] = at(t * .85, thick / 2 + planterD * .4);
      g.add(blob(.04, .14, .04, m.plant, px, baseH * .75, pz, 8));
      g.add(blob(.03, .1, .03, m.plantLite, px + .05, baseH * .75, pz + .02, 8));
    }
  });

  // —— 柱间镂空屏：上下压条 + 竖向细骨 + 错缝椭圆砖 ——
  const brickL = .28, rY = .03, rZ = .022, rowPitch = .09, gap = .048;
  const railH = .028, pinR = .007;
  for (let i = 0; i < nBay; i++){
    const t0 = postsT[i], t1 = postsT[i + 1];
    const inset0 = (i === 0 && openStart) ? post * .12 : post * .55;
    const inset1 = (i === nBay - 1 && openEnd) ? post * .12 : post * .55;
    const span = (t1 - t0) * len - inset0 - inset1;
    if (span < .28) continue;
    const midT = (t0 + t1) / 2 + (inset0 - inset1) / (2 * len);
    const faceOut = (panelT - baseW) * .2;
    const [fx0, fz0] = at(midT, faceOut);
    // 上下横压条（框住镂空区）
    const railY0 = baseH + .01, railY1 = wallH - railH - .01;
    if (horiz){
      g.add(box(span, railH, panelT * .7, m.face, fx0, railY0, fz0));
      g.add(box(span, railH, panelT * .7, m.soft, fx0, railY1, fz0));
    } else {
      g.add(box(panelT * .7, railH, span, m.face, fx0, railY0, fz0));
      g.add(box(panelT * .7, railH, span, m.soft, fx0, railY1, fz0));
    }
    // 竖向细骨（结构感）
    const pins = Math.max(2, Math.round(span / .4));
    const pinH = Math.max(.1, railY1 - railY0 - railH);
    for (let p = 0; p < pins; p++){
      const along = -span / 2 + span * (p + .5) / pins;
      const [px, pz] = at(midT + along / len, faceOut * .55);
      g.add(cyl(pinR, pinR, pinH, m.deep, px, railY0 + railH, pz, 8));
    }
    // 错缝椭圆砖（上下压条之间）
    const rows = Math.max(4, Math.floor((railY1 - railY0 - railH * 2 - .02) / rowPitch));
    for (let r = 0; r < rows; r++){
      const yb = railY0 + railH + .015 + r * rowPitch;
      if (yb + rY * 2 > railY1 - .01) break;
      const stagger = (r % 2) * (brickL + gap) * .5;
      const usable = span - .06;
      const n = Math.max(1, Math.floor((usable - stagger) / (brickL + gap)));
      // 居中排布，余量均分
      const used = n * brickL + (n - 1) * gap + stagger;
      const pad = Math.max(0, (usable - used) / 2);
      const start = -usable / 2 + pad + stagger + brickL / 2;
      for (let k = 0; k < n; k++){
        const along = start + k * (brickL + gap);
        const [bx, bz] = at(midT + along / len, faceOut);
        addOvalBrick(brickL, rY, rZ, r % 2 ? m.soft : m.face, bx, yb, bz);
      }
    }
  }
  V.archUp.add(g);
}

/** 沿墙切开门窗洞后的各段矩形（mm） */
export function wallSegmentsExcludingOpens(w, wallIndex){
  const opens = winOpeningsOnWall(w, wallIndex);
  const horiz = wallIsHoriz(w);
  if (!opens.length) return [[w[0], w[1], w[2], w[3]]];
  const segs = [];
  let cursor = horiz ? w[0] : w[1];
  const end = horiz ? w[2] : w[3];
  for (const o of opens){
    if (o.a - cursor >= 30){
      if (horiz) segs.push([cursor, w[1], o.a, w[3]]);
      else segs.push([w[0], cursor, w[2], o.a]);
    }
    cursor = Math.max(cursor, o.b);
  }
  if (end - cursor >= 30){
    if (horiz) segs.push([cursor, w[1], end, w[3]]);
    else segs.push([w[0], cursor, w[2], end]);
  }
  return segs;
}
export function addCollider(x0, z0, x1, z1){
  V.colliders.push({x0, z0, x1, z1, y0: V.colY0, y1: V.colY1});
}
export function pushWallSegmentColliders(w, wallIndex){
  // 横梁贴天花，不参与漫游碰撞
  if ((w[4] || 'n') === 'beam') return;
  for (const rect of wallSegmentsExcludingOpens(w, wallIndex)){
    addCollider(wx(rect[0]), wz(rect[1]), wx(rect[2]), wz(rect[3]));
  }
}

/** 实心墙遇门窗洞时只砌两侧墙垛；窗台/过梁/门扇另绘 */
export function buildWallWithOpenings(w, wallIndex, top){
  // 横梁：自天花向下；不挖门窗洞；材质随邻接房间壁纸（默认与墙面同色）
  if ((w[4] || 'n') === 'beam'){
    const drop = (typeof beamDropMm === 'function' ? beamDropMm(w) : (Number.isFinite(+w[5]) ? +w[5] : 400)) / 1000;
    const yb = Math.max(0, V.H - drop), yt = Math.min(V.H, top);
    if (yt > yb + .02) wallBox([w[0], w[1], w[2], w[3]], yb, yt, null, {beam: true});
    return;
  }
  const low = w[4] === 'low';
  const lowH = (typeof wallHeightMm === 'function' ? wallHeightMm(w) : (Number.isFinite(+w[5]) ? +w[5] : 1050)) / 1000;
  const h = low ? Math.min(lowH, top) : top;
  const put = (rect, openStart, openEnd) => {
    if (low) buildFenceBox(rect, h, {openStart: !!openStart, openEnd: !!openEnd});
    else wallBox(rect, 0, h);
  };
  const opens = winOpeningsOnWall(w, wallIndex);
  if (!opens.length){ put([w[0], w[1], w[2], w[3]], false, false); return; }
  const horiz = wallIsHoriz(w);
  let cursor = horiz ? w[0] : w[1];
  const end = horiz ? w[2] : w[3];
  let afterOpen = false;
  for (const o of opens){
    if (o.a - cursor >= 30){
      // 贴门洞的一端不立围栏柱，避免与花园门柱重叠
      if (horiz) put([cursor, w[1], o.a, w[3]], afterOpen, true);
      else put([w[0], cursor, w[2], o.a], afterOpen, true);
    }
    cursor = Math.max(cursor, o.b);
    afterOpen = true;
  }
  if (end - cursor >= 30){
    if (horiz) put([cursor, w[1], end, w[3]], afterOpen, false);
    else put([w[0], cursor, w[2], end], afterOpen, false);
  }
}

/** 多层合楼时所有楼层共用同一张太阳阴影贴图：上层墙 / 窗框 / 家具的影子会穿过
 *  楼板印在下层地板与墙面上，表现为「1F 木地板上出现 2F 家具的斜向暗条」。
 *  Three.js 单个 DirectionalLight 只有一张 shadow map，无法按「接收者」过滤，
 *  因此多层模式下让非顶层的建筑面 / 家具不接收太阳阴影（半球光、环境光、
 *  房间灯具照明与家具自身明暗都保留），顶层仍保持完整的同层阴影。
 *  单层显示 n=1 完全不改动，避免影响默认方案与鸟瞰单层观感。 */
export function isolateFloorShadows(n){
  if (n < 2) return;
  [V.archFloor, V.archUp, V.furnG].forEach(root => {
    if (!root) return;
    root.children.forEach(gl => {
      const fi = gl.userData && gl.userData.floorIdx;
      if (fi == null || fi >= n - 1) return;   // 顶层保留完整阴影
      gl.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
    });
  });
}

/** 多层堆叠时降低阴影贴图分辨率，避免逐层模型把 4096² shadow pass 拖垮 */
function tuneShadowForFloors(n){
  if (!V.sun?.shadow) return;
  // 整栋堆叠 / 漫游近距离 / 低端设备时用 2048，其余用 4096，阴影清晰度基本不变但填充开销成倍下降
  let want = (COARSE || lowEndDevice()) ? 2048 : 4096;
  if (n > 1 || V.opt.mode === 'walk') want = 2048;
  if (V.sun.shadow.mapSize.x === want) return;
  V.sun.shadow.mapSize.setScalar(want);
  if (V.sun.shadow.map){ V.sun.shadow.map.dispose(); V.sun.shadow.map = null; }
  V.sun.shadow.needsUpdate = true;
}

/* 层间配准（米）：两层建筑各自独立，各带各的连通区。
 * 3D 堆叠时只平移「建筑」：把每层建筑分别挪动，使各层连通区中心都落到
 * 同一个世界锚点 (0,0)，于是上下两层连通区自然重合。
 * 关键：第 k 层的偏移只由「本层连通区中心 + 本层建筑中心」决定，
 *      与其它层无关 —— 编辑某层连通区只会移动该层建筑，另一层的建筑
 *      及其连通区完全不动。单层显示（鸟瞰只看当前层）无需配准，偏移全 0。 */
function linkCenter(fl){
  const l = fl && Array.isArray(fl.links) && fl.links[0];
  return (l && Array.isArray(l.rect)) ? {x:(l.rect[0]+l.rect[2])/2, y:(l.rect[1]+l.rect[3])/2} : null;
}
function boundsCenter(fl){
  const b = fl && fl.plan && fl.plan.bounds;
  return b ? {x: b.x + b.w/2, y: b.y + b.h/2} : null;
}
function alignOffsets(floors){
  const list = floors || [];
  const out = list.length < 2
    ? list.map(() => ({x:0, z:0}))
    : list.map(fl => {
        const c = linkCenter(fl), o = boundsCenter(fl);
        if (!c || !o) return {x:0, z:0};   // 没画连通区的层不参与配准，保持原位
        return {x: -(c.x - o.x) / 1000, z: -(c.y - o.y) / 1000};
      });
  V.alignOffs = out;   // 供漫游起点 / 房间飞入等坐标反算使用
  return out;
}

export function buildArch(){
  syncOrigin();
  clearGroup(V.archFloor); clearGroup(V.archUp); V.lampG.clear(); V.doors.length = 0; V.colliders = []; V.stairZones = []; V.floorHoles = [];
  V.floorYs = [];
  // 露天房间登记（世界米）：openAirRects = 各层露天房间包围盒；
  // openAirVoids = 各层实际被挑空的区域，供 buildFurn 跳过该处的上层家具，避免悬空。
  V.openAirRects = []; V.openAirVoids = []; activeOpenAirVoids = [];
  // 每个碰撞体 / 门都记下所属楼层：漫游碰撞只判当前层，避免楼上门窗挡住楼下的人
  const tagFloor = (d0, c0, fi) => {
    for (let k = d0; k < V.doors.length; k++) V.doors[k].fi = fi;
    for (let k = c0; k < V.colliders.length; k++) V.colliders[k].fi = fi;
  };
  const floors = (typeof floorsFor3D === 'function') ? floorsFor3D() : null;
  if (floors && floors.length){
    let y = 0;
    const offsets = alignOffsets(floors);
    floors.forEach((fl, i) => {
      V.floorYs.push(y);
      const y0 = y, isTop = i === floors.length - 1;
      const run = () => {
        V.H = (typeof floorHeightM === 'function') ? floorHeightM(fl) : V.DEFAULT_H;
        const off = offsets[i] || {x:0, z:0};
        syncOrigin(); V.OX -= off.x * 1000; V.OY -= off.z * 1000;   // 该层按连通区对齐到下层
        const gf = new THREE.Group(), gu = new THREE.Group(), gl = new THREE.Group();
        gf.position.y = gu.position.y = gl.position.y = y0;
        gf.userData.floorIdx = gu.userData.floorIdx = gl.userData.floorIdx = i;
        V.archFloor.add(gf); V.archUp.add(gu); V.lampG.add(gl);
        const pF = V.archFloor, pU = V.archUp, pL = V.lampG;
        V.archFloor = gf; V.archUp = gu; V.lampG = gl;
        V.colY0 = y0; V.colY1 = y0 + V.H;
        activeVoidRects = (typeof voidRectsForFloor === 'function') ? voidRectsForFloor(fl) : [];
        activeOpenAirVoids = [];
        // ① 登记本层露天房间的世界包围盒，供「上一层」判断哪里该挑空。
        ROOMS.forEach(r => {
          if (!roomIsOpenAir(r) || !r.poly || r.poly.length < 3) return;
          const bb = polyBBox(r.poly);
          if (bb) V.openAirRects.push({fi: i, rect: [wx(bb[0]), wz(bb[1]), wx(bb[2]), wz(bb[3])]});
        });
        // ② 下层露天房间正上方若压着本层房间，就把那块楼板连同天花板 / 洞壁 /
        //    屋顶一起挑空，让下层花园真正露天看到天空。
        //    只挑空「几乎完全被下层露天区覆盖」的房间（覆盖 >= 50%），并且挑空矩形
        //    按房间单独存放、只参与该房间的裁剪 —— 绝不塞进整层 void，否则会像
        //    早期版本那样误挖 2F 客厅，从 1F 仰视看穿到 2F 悬空家具。
        if (i > 0){
          const below = V.openAirRects.filter(o => o.fi === i - 1);
          ROOMS.forEach(r => {
            if (!r.poly || r.poly.length < 3) return;
            const bb = polyBBox(r.poly); if (!bb) return;
            const area = (bb[2] - bb[0]) * (bb[3] - bb[1]);
            below.forEach(o => {
              // 世界米 → 本层局部 mm：wx(x)=(x-V.OX)/1000 的逆运算
              const q = [o.rect[0] * 1000 + V.OX, o.rect[1] * 1000 + V.OY,
                         o.rect[2] * 1000 + V.OX, o.rect[3] * 1000 + V.OY];
              const ix0 = Math.max(bb[0], q[0]), iy0 = Math.max(bb[1], q[1]);
              const ix1 = Math.min(bb[2], q[2]), iy1 = Math.min(bb[3], q[3]);
              if (ix1 - ix0 < 200 || iy1 - iy0 < 200) return;
              if ((ix1 - ix0) * (iy1 - iy0) / area < .5) return;
              const rect = [ix0, iy0, ix1, iy1];
              activeOpenAirVoids.push({roomId: r.id, rect});
              V.openAirVoids.push({fi: i, rect: [wx(ix0), wz(iy0), wx(ix1), wz(iy1)]});
            });
          });
        }
        // ③ 本层所有洞口（连通区 + 挑空）登记给漫游：这些位置没有楼板支撑，
        //    人应能往下走 / 掉到下一层，而不是踩着一块「空气地板」。
        const allVoids = activeVoidRects.concat(activeOpenAirVoids.map(v => v.rect));
        if (i > 0 && allVoids.length)
          V.floorHoles.push({fi: i, rects: allVoids.map(r => ({
            x0: wx(r[0]), z0: wz(r[1]), x1: wx(r[2]), z1: wz(r[3]),
          }))});
        const d0 = V.doors.length, c0 = V.colliders.length;
        try { buildArchContent(isTop); }
        finally {
          tagFloor(d0, c0, i);
          V.archFloor = pF; V.archUp = pU; V.lampG = pL;
          activeVoidRects = []; activeOpenAirVoids = [];
        }
        const stairs = (state.furniture || []).filter(f => f && f.type === 'stairs');
        // 这里只登记「粗略范围」，用于下面连通区兜底段去重；真正驱动人眼高度的是
        // buildFurn() 里按真实踏步生成的高程网格（见 buildStairSurfs），构建完会被替换。
        // 顶层不再生成上行段：通往不存在的上一层会让人走到楼梯口仍被往上拉。
        if (!isTop) stairs.forEach(f => {
          V.stairZones.push({
            cx: wx(f.cx), cz: wz(f.cy),
            hw: M(f.w) / 2 + .14, hd: M(f.d) / 2 + .14,
            y0, y1: y0 + V.H, up: (f.dir || 'up') !== 'down', kind: 'arch',
          });
        });
        // 连通区兜底通道：洞开在本层楼板（i>0），坡道从下一层地面升到本层地面；1F 的连通区仅作对齐锚点
        if (i > 0){
          const prevH = (typeof floorHeightM === 'function') ? floorHeightM(floors[i - 1]) : V.DEFAULT_H;
          ((typeof linkRectsForFloor === 'function') ? linkRectsForFloor(fl) : []).forEach(r => {
            const cx = wx((r[0] + r[2]) / 2), cz = wz((r[1] + r[3]) / 2);
            const hw = Math.max(.35, M(r[2] - r[0]) / 2), hd = Math.max(.35, M(r[3] - r[1]) / 2);
            // 若「下一层 → 本层」的坡道已由楼梯家具生成，就不重复造兜底段。
            // 用已生成的 stairZones 判断，而不是本层楼梯：顶层楼梯现已不再生成 zone，
            // 若仍拿它做 covered，会把本该由兜底段提供的层间通道一并跳过。
            const covered = V.stairZones.some(s =>
              Math.abs(s.y0 - (y0 - prevH)) < .01 && Math.abs(s.y1 - y0) < .01 &&
              Math.abs(s.cx - cx) < hw + s.hw && Math.abs(s.cz - cz) < hd + s.hd);
            if (!covered) V.stairZones.push({cx, cz, hw, hd, y0: y0 - prevH, y1: y0, up: true});
          });
        }
      };
      if (typeof withFloorData === 'function') withFloorData(fl, run); else run();
      y += V.H;
    });
    V.H = V.DEFAULT_H;
    if (typeof applyFloorToState === 'function' && state.floors?.[state.activeFloor|0])
      applyFloorToState(state.floors[state.activeFloor|0]);
    syncOrigin();   // 还原原点供坐标反算（groundAt 等）
    tuneShadowForFloors(floors.length);
    isolateFloorShadows(floors.length);
    hooks.applyLight(); applyGrow(); hooks.syncRoofOpacity?.();
    return;
  }
  V.floorYs = [0]; V.colY0 = 0; V.colY1 = V.H;
  activeVoidRects = []; activeOpenAirVoids = [];
  buildArchContent(true);
  tagFloor(0, 0, 0);
  tuneShadowForFloors(1);
  hooks.applyLight(); applyGrow(); hooks.syncRoofOpacity?.();
}

export function buildArchContent(isTop){
  activeCorners = wallCorners();   // 本层真墙角，供 wallBox 的漫游棱线使用
  const top = V.opt.cutFull ? V.H : Math.min(V.opt.cut, V.H);
  // 合层时上层楼板与下层墙顶共面 → 微抬 8mm，消除 z-fighting 闪烁（穿模）
  const deckLift = V.colY0 > .001 ? .008 : 0;
  // 楼板有真实厚度：顶面 deck 在本层地面，底面（= 下一层天花板）下沉 SLAB_T。
  // 上层家具都贴本层地面 y0 起建；旧版把天花板放在 deckLift-2mm（≈y0），
  // 上层家具底面反而比天花板还低约 6mm，从下层仰视就穿透成一块块深色矩形补丁。
  const SLAB_T = .03;
  // 非顶层全高墙若顶到 V.H(2.8)，会高于下沉到 2.778 的楼板底面 22mm，
  // 沿墙线露出深色剖切顶面(V.capMat)与漫游棱线，在天花板上表现为黑色条带。
  // 把墙顶收进楼板夹层内，由天花板实体遮住墙顶；剖切视图(top<V.H)保持原高度。
  const wallTop = (!isTop && top >= V.H - .01) ? V.H - SLAB_T + .012 : top;
  // 漫游辅助：整层只在本层真墙角 / 拐角生成竖棱线（与墙盒、洞口切分解耦）
  addCornerLines(0, wallTop);
  ROOMS.forEach(r => {
    const mk = state.rooms[r.id] && state.rooms[r.id].mat;
    // 花园 / 庭院等户外空间：自身不封屋顶。当它是多层里的下层时，压在它正上方的
    // 上层楼板由 buildArch 按「下层露天房间」挑空（见 activeOpenAirVoids），
    // 于是从花园仰视直接看到天空，而不是一块室内天花板。
    const openAir = roomIsOpenAir(r);
    const m = (mk && TEX[mk]) ? floorMat(mk) : mat('#f3eee6', {roughness:.92});
    // 露天房间不做厚实体楼板：bay 楼板是 45cm 厚实体（带底盖），从下一层仰视会看到
    // 它的底面，看起来就像露天花园上方凭空多了一块「天花板」。露天一律用普通楼板。
    const bay = r.counted === false && !openAir;
    // 地面 / 天花板 / 洞壁 / 屋顶共用同一份已挖洞几何，保证洞口四壁封实，
    // 且上层家具始终有楼板支撑（不会悬空穿模）。挑空矩形按房间隔离，
    // 不会像早期版本那样把相邻室内房间的楼板一并挖掉。
    const roomVoids = activeVoidRects.concat(
      activeOpenAirVoids.filter(v => v.roomId === r.id).map(v => v.rect));
    const parts = subtractRectsFromPoly(r.poly, roomVoids);
    const shapes = parts.map(p => shapeOf(p));
    const geo = bay ? new THREE.ExtrudeGeometry(shapes, {depth:.45, bevelEnabled:false}) : new THREE.ShapeGeometry(shapes);
    geo.rotateX(-Math.PI/2);
    const deck = new THREE.Mesh(geo, bay ? [m, mat('#e9e4da')] : m);
    deck.position.y = deckLift;
    deck.receiveShadow = true; deck.userData.room = r.id;
    if (bay){ deck.castShadow = true; V.archUp.add(deck); } else V.archFloor.add(deck);
    // 天花板 / 洞壁 / 屋顶与地面共用同一份已挖洞几何
    const ceilShapes = shapes;
    // 楼板底面即下一层的天花板。ShapeGeometry 单面朝上 + FrontSide，从下层仰视会被
    // 背面剔除而「看穿到楼上」；共用同一份已挖洞的几何加一个朝下的 BackSide 副本，
    // 纯色天花不露地面贴图，与地面按正反面天然互斥、不 z-fight。
    // 楼板底面即下一层的天花板，所有房间都要生成（露天房间只是没有屋顶，不是没有楼板）。
    if (!bay){
      if (!V.ceilMat) V.ceilMat = new THREE.MeshStandardMaterial({
        color: '#efe6d4', roughness: .96, side: THREE.BackSide,
        // 乳白（偏暖）而非纯白；自发光只做适度补光，避免背面朝下收不到顶光时发灰
        emissive: '#e9dcc2', emissiveIntensity: .5,
      });
      if (!V.ceilEdgeMat) V.ceilEdgeMat = new THREE.MeshStandardMaterial({
        color: '#e8ddc8', roughness: .95, side: THREE.DoubleSide,
        emissive: '#e4d8c0', emissiveIntensity: .42,
      });
      const ceilGeo = new THREE.ShapeGeometry(ceilShapes);
      ceilGeo.rotateX(-Math.PI / 2);
      const ceil = new THREE.Mesh(ceilGeo, V.ceilMat);
      // 下沉到楼板底面：低于上层家具底面（层底 y0），从下层仰视时由天花板实体
      // 遮住上层家具的底座，消除穿透出来的深色矩形；同时仍嵌在墙顶内侧，不留缝。
      ceil.position.y = deckLift - SLAB_T;
      // 纯色天花不接收阴影：避免上层家具 / 墙投下的暗斑被当成「穿模黑块」。
      ceil.receiveShadow = false;
      ceil.userData.room = r.id;
      ceil.userData.ceiling = true;
      V.archFloor.add(ceil);
      // 楼板 30mm 厚度的四周侧面（含连通区 / 楼梯井洞壁）：把夹层封实。
      // 旧版只有 deck / ceil 两个平行平面，边缘没有侧壁，从下层斜仰视会看穿成
      // 一条黑色空心条带。ExtrudeGeometry 的 material 0 是上下盖（沿用 BackSide
      // 天花板材质，正反两面都被剔除），material 1 是侧壁，用乳白材质封口。
      const edgeGeo = new THREE.ExtrudeGeometry(ceilShapes, {depth: SLAB_T, bevelEnabled: false});
      edgeGeo.rotateX(-Math.PI/2);
      const edge = new THREE.Mesh(edgeGeo, [V.ceilMat, V.ceilEdgeMat]);
      edge.position.y = deckLift - SLAB_T;
      edge.receiveShadow = false;
      edge.userData.room = r.id;
      edge.userData.ceilingEdge = true;
      V.archFloor.add(edge);
    }
    // 屋顶：仅最顶层加；下层由上层楼板充当天花，避免合层穿插。顶层按连通区挖空，露天房间不封顶
    if (!openAir && isTop){
      const slab = new THREE.ExtrudeGeometry(ceilShapes, {depth: .05, bevelEnabled: false});
      slab.rotateX(-Math.PI / 2);
      if (!V.roofMat){
        V.roofMat = new THREE.MeshStandardMaterial({
          color: '#f4efe6', roughness: .95, transparent: true, opacity: .14,
          depthWrite: false, side: THREE.DoubleSide,
        });
      }
      const ceil = new THREE.Mesh(slab, V.roofMat);
      ceil.position.y = V.H;
      ceil.visible = top >= V.H;
      ceil.castShadow = false;
      ceil.receiveShadow = false;
      ceil.userData.roof = true;
      V.archUp.add(ceil);
    }
    if (r.at && !openAir){
      // 吸顶灯跟着楼板底面下移，始终贴在天花板下方；否则天花板下沉后灯会被挡在板内。
      // 白色圆盘在漫游仰视时像一块大白斑：标记 hideInWalk，漫游模式隐藏（见 walk.js setMode），
      // 鸟瞰 / 环视仍按剖切状态显示；PointLight 保留，夜景开灯不受影响。
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .02, 32), new THREE.MeshStandardMaterial({color:'#fff', emissive:'#fff2d6', emissiveIntensity:.3}));
      lamp.position.set(wx(r.at[0]), V.H - SLAB_T - .012, wz(r.at[1]));
      lamp.userData.hideInWalk = true;
      lamp.userData.baseVisible = top >= V.H;
      lamp.visible = top >= V.H; V.lampG.add(lamp);
      const pl = new THREE.PointLight(0xffd9a8, 0, 7, 1.6); pl.position.set(wx(r.at[0]), V.H - SLAB_T - .25, wz(r.at[1])); V.lampG.add(pl);
    }
  });
  // 天花板墙带补片：房间天花板只铺到墙内边线，墙体那一圈没有楼板底面。从下层
  // 斜仰视会透过这圈缝看到上层墙底 / 墙侧，表现为贯穿天花板的深色带或木色带。
  // 沿本层每道墙补一条与天花板同色的实体带，把楼板底面连成整片；连通区照常挖空。
  if (V.colY0 > .001 && WALLS.length){
    if (!V.ceilMat) V.ceilMat = new THREE.MeshStandardMaterial({
      color: '#efe6d4', roughness: .96, side: THREE.BackSide,
      emissive: '#e9dcc2', emissiveIntensity: .5,
    });
    const pad = 24, patchShapes = [];
    // 挑空区没有楼板，那一圈墙带自然也不该有天花板补片，否则花园仰视会看到
    // 一条悬空的米色带。
    const allVoids = activeVoidRects.concat(activeOpenAirVoids.map(v => v.rect));
    WALLS.forEach((w, i) => {
      if (state.demolished.includes('w' + i)) return;
      const [x0, y0, x1, y1] = w;
      const poly = [[x0-pad, y0-pad], [x1+pad, y0-pad], [x1+pad, y1+pad], [x0-pad, y1+pad]];
      subtractRectsFromPoly(poly, allVoids).forEach(p => patchShapes.push(shapeOf(p)));
    });
    if (patchShapes.length){
      const pg = new THREE.ShapeGeometry(patchShapes);
      pg.rotateX(-Math.PI / 2);
      const patch = new THREE.Mesh(pg, V.ceilMat);
      // 比房间天花板低 1mm：从下方仰视优先命中，重叠处同色不产生 z-fight 闪烁。
      patch.position.y = deckLift - SLAB_T - .001;
      patch.receiveShadow = false;
      patch.userData.ceiling = true;
      V.archFloor.add(patch);
    }
  }
  [...DOORS, ...SLIDES].forEach(d => { const [x0, y0, x1, y1] = d.rect; const s = box(M(x1-x0), .012, M(y1-y0), mat('#d8d0c0', {roughness:.3}), wx((x0+x1)/2), 0, wz((y0+y1)/2)); s.castShadow = false; V.archFloor.add(s); });
  resetFencePosts();
  WALLS.forEach((w, i) => {
    if (state.demolished.includes('w'+i)) return;
    buildWallWithOpenings(w, i, wallTop);
    // 碰撞只取门窗洞两侧墙垛；整段墙入库会在开启的门洞处形成「空气墙」
    pushWallSegmentColliders(w, i);
  });
  flushFencePosts(); // 拐角端柱合并后再统一生成
  // 门洞、飘窗洞口上方过梁（花园门不加过梁，避免户外门洞顶出一段墙）
  const bayLintels = planFlags.hasBayLintels
    ? [[[10270,800,10510,2600], 2.4], [[10270,4260,10510,5740], 2.4]] : [];
  const isGateDoor = d => !!(d && (d.gate || /花园门|garden\s*gate/i.test(d.name || '')));
  [...DOORS.filter(d => !isGateDoor(d)).map(d => [d.rect, doorHeightMm(d) / 1000]), ...SLIDES.map(s => [s.rect, slideHeightMm(s) / 1000]), ...bayLintels]
    .forEach(([r, h]) => { if (wallTop > h) wallBox(r, h, wallTop); });
  WINS.forEach((r, i) => {
    const sill = winSillMm(r, i) / 1000, head = winHeadMm(r) / 1000;
    wallBox(r, 0, Math.min(sill, top)); if (wallTop > head) wallBox(r, head, wallTop);
    addCollider(wx(r[0]), wz(r[1]), wx(r[2]), wz(r[3]));
    const gTop = Math.min(head, top); if (gTop <= sill) return;
    const [x0, y0, x1, y1] = r, hz = (x1-x0) >= (y1-y0), L = M(hz ? x1-x0 : y1-y0), gh = gTop - sill, cx = wx((x0+x1)/2), cz = wz((y0+y1)/2);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(hz ? L : .01, gh, hz ? .01 : L), V.glassMat); pane.position.set(cx, sill + gh/2, cz); V.archUp.add(pane);
    const n = Math.max(1, Math.round(L/.9));
    for (let k = 0; k <= n; k++){ const t = -L/2 + k*L/n, mu = new THREE.Mesh(new THREE.BoxGeometry(hz ? .04 : .06, gh, hz ? .06 : .04), V.frameMat);
      mu.position.set(cx + (hz ? t : 0), sill + gh/2, cz + (hz ? 0 : t)); mu.castShadow = true; V.archUp.add(mu); }
    [sill + .02, gTop - .02].forEach(y => { const tr = new THREE.Mesh(new THREE.BoxGeometry(hz ? L : .06, .04, hz ? .06 : L), V.frameMat); tr.position.set(cx, y, cz); V.archUp.add(tr); });
  });
  DOORS.forEach(d => {
    const L = M(d.len), dh = Math.min(doorHeightMm(d) / 1000, top);
    const ang = v => Math.atan2(-v[1], v[0]);
    const makeDoor = (pivot, hitMeshes, leafLen = L) => {
      const door = {pivot, a0: ang(d.c), a1: ang(d.o), open: true, len: leafLen};
      if (door.a1 - door.a0 > Math.PI) door.a1 -= Math.PI * 2;
      if (door.a0 - door.a1 > Math.PI) door.a1 += Math.PI * 2;
      door.cur = door.a1; pivot.rotation.y = door.cur;
      hitMeshes.forEach(m => { m.userData.door = door; });
      V.doors.push(door); V.archUp.add(pivot);
    };
    if (isGateDoor(d)){
      // 精致现代花园门：竖栅 + 中腰梁 + 实心锁板 + 铰链；可单开 / 双开
      const leaves = (typeof gateLeaves === 'function' ? gateLeaves(d) : (+d.leaves === 1 ? 1 : 2));
      const metalDark = mat('#2c2c2e', {metalness:.38, roughness:.46});
      const metalDeep = mat('#1a1a1c', {metalness:.45, roughness:.38});
      const metalSoft = mat('#3e3e42', {metalness:.32, roughness:.5});
      const metalAccent = mat('#8a8478', {metalness:.55, roughness:.32});
      const lockM = mat('#0e0e10', {metalness:.6, roughness:.25});
      const th = .048, frame = .042;
      const buildGateLeaf = (wLeaf, withHardware) => {
        const g = new THREE.Group();
        const panelW = Math.min(.15, wLeaf * (leaves === 1 ? .16 : .22));
        const slatZone = Math.max(.1, wLeaf - panelW - frame * 1.35);
        // 外框
        g.add(box(wLeaf, frame, th, metalDeep, wLeaf / 2, dh - frame, 0));
        g.add(box(wLeaf, frame * 1.1, th * 1.05, metalDeep, wLeaf / 2, 0, 0));
        g.add(box(frame, dh - frame * 2, th, metalDeep, frame / 2, frame, 0));
        g.add(box(frame, dh - frame * 2, th, metalDeep, wLeaf - frame / 2, frame, 0));
        // 中腰横梁
        const midY = dh * .48;
        g.add(box(wLeaf - frame * 2, frame * .85, th * .95, metalSoft, wLeaf / 2, midY, 0));
        g.add(box(wLeaf - frame * 2, .008, th * 1.08, metalAccent, wLeaf / 2, midY + frame * .4, 0));
        // 竖向格栅（铰链侧 → 实心板）
        const n = Math.max(5, Math.round(slatZone / .042));
        const pitch = slatZone / n, slatW = Math.min(.026, pitch * .52);
        for (let i = 0; i < n; i++){
          const x = frame + pitch * (i + .5);
          const zOff = (i % 2 ? .007 : -.007);
          const m = i % 2 ? metalDark : metalSoft;
          g.add(box(slatW, midY - frame * 2.2, th * .5, m, x, frame + .01, zOff));
          g.add(box(slatW, dh - midY - frame * 2.4, th * .5, m, x, midY + frame * .9, zOff));
        }
        // 启闭侧实心板（远离铰链，对开时靠中缝）
        const px = wLeaf - panelW / 2 - frame * .2;
        g.add(box(panelW, dh - frame * 2, th * 1.08, metalDark, px, frame, 0));
        // 铰链侧合页
        [dh * .18, dh * .5, dh * .82].forEach(hy => {
          g.add(box(.018, .055, .02, metalAccent, frame * .35, hy, -th * .55));
          g.add(cyl(.008, .008, .05, metalDeep, frame * .35, hy - .025, -th * .7, 8));
        });
        if (withHardware){
          const hx = px - panelW * .08, hy0 = dh * .3, hh = Math.min(.52, dh * .3);
          g.add(cyl(.011, .011, hh, metalDeep, hx, hy0, th * .58 + .01, 12));
          g.add(box(.016, .016, .028, metalAccent, hx, hy0 + hh * .1, th * .38));
          g.add(box(.016, .016, .028, metalAccent, hx, hy0 + hh * .88, th * .38));
          const lx = px + panelW * .12, ly = dh * .44;
          g.add(box(.038, .13, .018, lockM, lx, ly, th * .58));
          g.add(box(.026, .045, .006, mat('#121218', {metalness:.25, roughness:.35, emissive:'#2a2a35', emissiveIntensity:.2}), lx, ly + .04, th * .58 + .01));
          for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++){
            g.add(box(.005, .005, .003, metalSoft, lx + (c - 1) * .009, ly + .015 + r * .011, th * .58 + .012));
          }
        }
        g.add(box(frame * 1.6, frame * 1.2, th * 1.1, metalAccent, frame * .9, dh - frame * 1.1, 0));
        g.add(box(frame * 1.6, frame * 1.2, th * 1.1, metalAccent, wLeaf - frame * .9, dh - frame * 1.1, 0));
        const hit = box(wLeaf, dh, th, metalDark, wLeaf / 2, 0, 0);
        hit.visible = false; g.add(hit);
        return {g, hit};
      };
      // 门柱几何：铰链落在柱体内侧（朝向门洞），门扇宽度按净开洞
      const [rx0, ry0, rx1, ry1] = d.rect;
      const hz = (rx1 - rx0) >= (ry1 - ry0);
      const thick = Math.max(hz ? M(ry1 - ry0) : M(rx1 - rx0), .18);
      const postW = Math.min(.32, Math.max(.24, thick * 1.35));
      const postD = Math.max(thick, postW);
      let nearLowH = dh;
      WALLS.forEach(w => {
        if ((w[4] || 'n') !== 'low') return;
        if (typeof rectAlongWall === 'function' && !rectAlongWall(w, d.rect)) return;
        nearLowH = Math.max(nearLowH, (typeof wallHeightMm === 'function' ? wallHeightMm(w) : 1050) / 1000);
      });
      const postH = Math.min(Math.max(dh + .02, nearLowH), top);
      const fm = fenceMats();
      const midX = wx((rx0 + rx1) / 2), midZ = wz((ry0 + ry1) / 2);
      // 左右/上下门柱中心（柱身伸入洞口）
      const postA = hz
        ? {x: wx(rx0) + postW / 2, z: midZ}
        : {x: midX, z: wz(ry0) + postW / 2};
      const postB = hz
        ? {x: wx(rx1) - postW / 2, z: midZ}
        : {x: midX, z: wz(ry1) - postW / 2};
      const pg = new THREE.Group();
      if (hz){
        addFencePillar(pg, postA.x, postA.z, postW, postD, postH, fm);
        addFencePillar(pg, postB.x, postB.z, postW, postD, postH, fm);
      } else {
        addFencePillar(pg, postA.x, postA.z, postD, postW, postH, fm);
        addFencePillar(pg, postB.x, postB.z, postD, postW, postH, fm);
      }
      V.archUp.add(pg);
      // 铰链：柱体内侧面向门洞，并贴墙厚中线（不在柱体外侧）
      const hingeInset = 0.012; // 略嵌入柱内
      const hingeA = hz
        ? {x: postA.x + postW / 2 - hingeInset, z: midZ}
        : {x: midX, z: postA.z + postW / 2 - hingeInset};
      const hingeB = hz
        ? {x: postB.x - postW / 2 + hingeInset, z: midZ}
        : {x: midX, z: postB.z - postW / 2 + hingeInset};
      const clearL = Math.max(0.35, L - postW * 2 + hingeInset * 2);
      const leafSpan = leaves === 1 ? clearL : clearL * .5;
      // 门槛条（净开洞宽度）
      if (hz) V.archUp.add(box(clearL, .025, .06, metalDeep, midX, 0, midZ));
      else V.archUp.add(box(.06, .025, clearL, metalDeep, midX, 0, midZ));
      // 铰链侧：取门数据中靠门洞起点的一端 → hingeA，另一端 → hingeB
      const hingeAtStart = (() => {
        if (hz) return Math.abs(d.h[0] - rx0) <= Math.abs(d.h[0] - rx1);
        return Math.abs(d.h[1] - ry0) <= Math.abs(d.h[1] - ry1);
      })();
      const startH = hingeAtStart ? hingeA : hingeB;
      const endH = hingeAtStart ? hingeB : hingeA;
      if (leaves === 1){
        const p1 = new THREE.Group();
        p1.position.set(startH.x, 0, startH.z);
        const leaf1 = buildGateLeaf(leafSpan, true);
        p1.add(leaf1.g);
        makeDoor(p1, [leaf1.hit], leafSpan);
      } else {
        const p1 = new THREE.Group();
        p1.position.set(startH.x, 0, startH.z);
        const leaf1 = buildGateLeaf(leafSpan, false);
        p1.add(leaf1.g);
        makeDoor(p1, [leaf1.hit], leafSpan);
        const p2 = new THREE.Group();
        p2.position.set(endH.x, 0, endH.z);
        const leaf2 = buildGateLeaf(leafSpan, true);
        p2.add(leaf2.g);
        const door2 = {pivot: p2, a0: ang([-d.c[0], -d.c[1]]), a1: ang(d.o), open: true, len: leafSpan};
        if (door2.a1 - door2.a0 > Math.PI) door2.a1 -= Math.PI * 2;
        if (door2.a0 - door2.a1 > Math.PI) door2.a1 += Math.PI * 2;
        door2.cur = door2.a1; p2.rotation.y = door2.cur;
        leaf2.hit.userData.door = door2;
        V.doors.push(door2); V.archUp.add(p2);
      }
    } else {
      const pivot = new THREE.Group();
      pivot.position.set(wx(d.h[0]), 0, wz(d.h[1]));
      // 门扇材质：面板可选（doorFinishOf 来自经典脚本 bridge）；玻璃门 = 玻璃板 + 四边框
      const fin = doorFinishOf(d);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 8), metal());
      knob.position.set(L - .07, Math.min(1, dh - .05), 0); knob.scale.z = 2.2;
      let hits;
      if (fin && fin.glass){
        const t = .05, fr = V.frameMat;
        const glass = box(L - t * 2, dh - t * 2 - .06, .018, V.glassMat, L / 2, t + .05, 0);
        const top = box(L, t, .045, fr, L / 2, dh - t, 0);
        const bot = box(L, t + .05, .045, fr, L / 2, 0, 0);
        const lf = box(t, dh, .045, fr, t / 2, 0, 0);
        const rt = box(t, dh, .045, fr, L - t / 2, 0, 0);
        pivot.add(glass, top, bot, lf, rt, knob);
        hits = [glass, top, bot, lf, rt, knob];
      } else {
        const leafMat = fin
          ? mat(fin.col, {roughness:fin.rough})
          : mat(d.entry ? '#6b4f3a' : '#efe6d8', {roughness:.5});
        const leaf = box(L, dh, .04, leafMat, L / 2);
        pivot.add(leaf, knob);
        hits = [leaf, knob];
      }
      makeDoor(pivot, hits);
    }
  });
  SLIDES.forEach(sl => {
    const {rect:[x0, y0, x1, y1], v} = sl;
    const L = M(v ? y1 - y0 : x1 - x0);
    const ph = Math.min(slideHeightMm(sl) / 1000, top);
    const n = typeof slideLeaves === 'function' ? slideLeaves(sl) : Math.max(1, Math.min(4, +sl.leaves || 2));
    const toEnd = (typeof slideToSide === 'function' ? slideToSide(sl) : sl.slideTo) === 'end';
    // 扇宽略大于 L/n，关闭时交叠盖满洞口；打开叠到指定一侧且不滑出洞口
    const pl = n === 1 ? L * .72 : Math.min(L * .92, L / n + .06);
    const midX = wx((x0 + x1) / 2), midZ = wz((y0 + y1) / 2);
    const span = Math.max(0, L - pl);
    const closedOf = i => (n === 1 ? 0 : (-L / 2 + pl / 2 + (span * i) / (n - 1)));
    const stack0 = toEnd ? (L / 2 - pl / 2) : (-L / 2 + pl / 2);
    const stackStep = toEnd ? -.035 : .035;
    const openOf = i => stack0 + i * stackStep;
    const root = new THREE.Group();
    root.position.set(midX, 0, midZ);
    const hits = [];
    const makeLeaf = (along0, trackOff) => {
      const g = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(v ? .02 : pl, ph, v ? pl : .02), V.glassMat);
      glass.position.set(0, ph / 2, 0);
      glass.castShadow = false;
      g.add(glass);
      [ph - .03, .03].forEach(y => {
        const fr = new THREE.Mesh(new THREE.BoxGeometry(v ? .04 : pl, .05, v ? pl : .04), V.frameMat);
        fr.position.set(0, y, 0);
        g.add(fr);
      });
      [-1, 1].forEach(e => {
        const fr = new THREE.Mesh(new THREE.BoxGeometry(.04, ph, .04), V.frameMat);
        fr.position.set(v ? 0 : e * pl / 2, ph / 2, v ? e * pl / 2 : 0);
        g.add(fr);
      });
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(v ? .06 : pl, ph, v ? pl : .06),
        new THREE.MeshBasicMaterial({visible: false})
      );
      hit.position.set(0, ph / 2, 0);
      g.add(hit);
      hits.push(hit);
      if (v) g.position.set(trackOff, 0, along0);
      else g.position.set(along0, 0, trackOff);
      root.add(g);
      return g;
    };
    const panels = [];
    for (let i = 0; i < n; i++){
      const trackOff = ((i % 2) ? 1 : -1) * (.015 + Math.floor(i / 2) * .012);
      const g = makeLeaf(closedOf(i), trackOff);
      panels.push({g, closed: closedOf(i), openPos: openOf(i)});
    }
    const stackW = pl + (n - 1) * .035;
    const door = {
      slide: true, open: true, cur: 1, v: !!v, panels,
      clearW: Math.max(0, L - stackW),   // 打开后通行净宽；过窄时碰撞直接放行，避免空气墙
      hitBoxClosed: (() => {
        const pad = .06;
        if (v) return [midX - pad, midZ - L / 2, midX + pad, midZ + L / 2];
        return [midX - L / 2, midZ - pad, midX + L / 2, midZ + pad];
      })(),
      hitBoxOpen: (() => {
        const pad = .06;
        if (v){
          return toEnd
            ? [midX - pad, midZ + L / 2 - stackW, midX + pad, midZ + L / 2]
            : [midX - pad, midZ - L / 2, midX + pad, midZ - L / 2 + stackW];
        }
        return toEnd
          ? [midX + L / 2 - stackW, midZ - pad, midX + L / 2, midZ + pad]
          : [midX - L / 2, midZ - pad, midX - L / 2 + stackW, midZ + pad];
      })(),
    };
    door.panels.forEach(p => {
      const along = p.openPos;
      if (v) p.g.position.z = along; else p.g.position.x = along;
      p.g.traverse(o => { o.userData.door = door; });
    });
    hits.forEach(m => { m.userData.door = door; });
    door.pivot = root; // 合层碰撞按世界高度过滤
    V.doors.push(door);
    V.archUp.add(root);
  });
}

/* ===== 楼梯「可站立面」高程网格 =====
 * 旧实现把楼梯当成「平面包盒 + 单轴线性坡道」估人眼高度：轴取 w/d 里较大的一边、
 * 升降看 dir 猜。楼梯一旦旋转摆放，或用的是 L / U / 三跑 / 旋转楼梯，猜出来的坡道
 * 方向、分段与真实踏步就对不上 —— 表现就是刚踏上楼梯眼高猛跳一段、下到一半又被顶
 * 回去、怎么走都下不来。
 * 现在直接对踏步 / 休息平台的真实网格打竖直射线，生成多层高程网格，漫游时取脚下最近的一层。
 * 样式、旋转、翻转（dir / flip）都不再需要猜：人踩到哪一级，眼高就是哪一级。 */
const LAYERS = 3;
function buildStairSurfs(){
  V.stairSurfs = [];
  if (!V.furnG) return;
  // 入场生长动画会把 furnG.scale.y 从 0 拉到 1，量高程必须用真实比例，否则取样全落在层底
  const keepSY = V.furnG.scale.y;
  V.furnG.scale.y = 1;
  try { stairSurfsFromGeom(); } finally { V.furnG.scale.y = keepSY; V.furnG.updateMatrixWorld(true); }
}
function stairSurfsFromGeom(){
  V.furnG.updateMatrixWorld(true);
  const ys = (V.floorYs && V.floorYs.length) ? V.floorYs : [0];
  const rc = new THREE.Raycaster(), org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  // 家具根节点带 fid；多层时外面还套一层「楼层组」（带 floorIdx / position.y）
  const items = [];
  V.furnG.children.forEach(ch => {
    if (ch.userData && ch.userData.fid) items.push({item: ch, fi: ch.userData.floorIdx | 0, baseY: 0});
    else (ch.children || []).forEach(it => {
      if (it.userData && it.userData.fid)
        items.push({item: it, fi: ch.userData.floorIdx | 0, baseY: ch.position.y || 0});
    });
  });
  const zones = [];
  items.forEach(({item, fi, baseY}) => {
    const surf = [];
    item.traverse(o => { if (o.isMesh && o.userData.walk) surf.push(o); });
    if (surf.length < 2) return;
    const bb = new THREE.Box3();
    surf.forEach(o => bb.expandByObject(o));
    const sizeX = bb.max.x - bb.min.x, sizeZ = bb.max.z - bb.min.z;
    if (!(sizeX > .15 && sizeZ > .15)) return;
    const nx = Math.max(5, Math.min(64, Math.round(sizeX / .08) + 1));
    const nz = Math.max(5, Math.min(64, Math.round(sizeZ / .08) + 1));
    const sx = sizeX / (nx - 1), sz = sizeZ / (nz - 1);
    // 每格保存多层可站立面：旋转楼梯一圈压一圈、上下两跑在平面上重叠时，
    // 同一列会有若干个台阶面，只留最高那个会让人一进门就被吸到顶上去。
    const hh = new Float32Array(nx * nz * LAYERS).fill(NaN);
    const topY = bb.max.y + .3;
    rc.far = (bb.max.y - bb.min.y) + .8;
    for (let j = 0; j < nz; j++){
      for (let i = 0; i < nx; i++){
        org.set(bb.min.x + sx * i, topY, bb.min.z + sz * j);
        rc.set(org, down);
        const hit = rc.intersectObjects(surf, false);
        if (!hit.length) continue;
        const vals = [];
        for (let k = 0; k < hit.length && vals.length < LAYERS; k++){
          const y = hit[k].point.y;
          if (vals.some(v => Math.abs(v - y) < .02)) continue;   // 圆角 / 出边造成的重复面
          vals.push(y);
        }
        vals.sort((a, b) => a - b);
        for (let k = 0; k < vals.length; k++) hh[(j * nx + i) * LAYERS + k] = vals[k];
      }
    }
    // 不做邻格补洞：两跑之间 5~6cm 的缝、楼梯井里的空档如果被均值填平，会造出
    // 一层根本不存在的「空中台阶」，人走到缝上就被吸到那一层去。漏采交给运行时
    // 的 3×3 邻域搜索处理（只认真的量到过的面），缝仍是缝。
    let valid = 0;
    for (let k = 0; k < hh.length; k++) if (!Number.isNaN(hh[k])) valid++;
    if (valid < 4) return;
    V.stairSurfs.push({x0: bb.min.x, z0: bb.min.z, sx, sz, nx, nz, layers: LAYERS, h: hh, floorIdx: fi});
    // 碰撞豁免范围也改用真实包围盒：旋转摆放时按 w/d 估的矩形会错位，
    // 人走到坡道中段还可能被判成撞墙（“下不来”的另一种表现）
    const zb = new THREE.Box3().setFromObject(item);
    const fh = Math.max(.5, (ys[fi + 1] != null ? ys[fi + 1] : baseY + (V.H || 2.8)) - baseY);
    zones.push({
      cx: (zb.min.x + zb.max.x) / 2, cz: (zb.min.z + zb.max.z) / 2,
      hw: (zb.max.x - zb.min.x) / 2 + .12, hd: (zb.max.z - zb.min.z) / 2 + .12,
      y0: baseY, y1: baseY + fh, up: true, kind: 'stair',
    });
  });
  // 保留 buildArch 按 w/d 估的粗略楼梯区，只替换按几何量出来的：前者是「某段楼梯
  // 没能成功取样」时的兜底坡道与撞墙豁免范围，删掉会让人卡在楼梯口下不来。
  V.stairZones = V.stairZones.filter(z => z.kind !== 'stair').concat(zones);
}

export function buildFurn(){
  clearGroup(V.furnG);
  V.lampGlowMats = [];      // 家具重建后，用户调过亮度/色温的发光材质引用全部失效，重新收集
  const floors = (typeof floorsFor3D === 'function') ? floorsFor3D() : null;
  if (floors && floors.length){
    let y = 0;
    const offsets = alignOffsets(floors);
    floors.forEach((fl, i) => {
      const y0 = y;
      const run = () => {
        V.H = (typeof floorHeightM === 'function') ? floorHeightM(fl) : V.DEFAULT_H;
        const off = offsets[i] || {x:0, z:0};
        syncOrigin(); V.OX -= off.x * 1000; V.OY -= off.z * 1000;
        const g = new THREE.Group(); g.position.y = y0; g.userData.floorIdx = i; V.furnG.add(g);
        // 下层花园挑空后，压在它上方的那块楼板已经不存在：该区域的上层家具
        // 不能继续摆着，否则从下层仰视会看到一排悬空家具（穿模）。
        const voids = (V.openAirVoids || []).filter(v => v.fi === i);
        (state.furniture || []).forEach(f => {
          if (voids.length){
            const X = wx(f.cx), Z = wz(f.cy);
            if (voids.some(v => X >= v.rect[0] && X <= v.rect[2] && Z >= v.rect[1] && Z <= v.rect[3])) return;
          }
          try { g.add(buildFurniture(f)); }
          catch (e){ console.error('buildFurniture failed', f?.type, f?.name, e); }
        });
      };
      if (typeof withFloorData === 'function') withFloorData(fl, run); else run();
      y += (typeof floorHeightM === 'function') ? floorHeightM(fl) : V.DEFAULT_H;
    });
    V.H = V.DEFAULT_H;
    if (typeof applyFloorToState === 'function' && state.floors?.[state.activeFloor|0])
      applyFloorToState(state.floors[state.activeFloor|0]);
    syncOrigin();
  } else {
    state.furniture.forEach(f => {
      try { V.furnG.add(buildFurniture(f)); }
      catch (e){ console.error('buildFurniture failed', f?.type, f?.name, e); }
    });
  }
  V.fixtureLights = [];
  V.fountainOn = false;
  const _sz = new THREE.Vector3();
  V.furnG.traverse(o => {
    if (o.userData.fixtureSpec) V.fixtureLights.push(o);
    if (o.userData.fx === 'fountain') V.fountainOn = true;
    // 阴影按需投射：拉手、抽屉、细腿等小部件(<28cm)不投阴影、只接收，
    // 阴影清晰度几乎不变，但阴影 pass 需要绘制的几何量大幅下降。
    if (o.isMesh && o.castShadow){
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      o.geometry.boundingBox.getSize(_sz);
      if (Math.max(_sz.x, _sz.y, _sz.z) < .28) o.castShadow = false;
    }
  });
  // 家具是每次 sync 重建的，跨层阴影隔离要在重建后再应用一次
  isolateFloorShadows(floors ? floors.length : 1);
  V.furnG.visible = V.opt.furn; V.selKey = null; applyGrow(); hooks.applyLight();
  // 家具建好后才知道踏步的真实位置与朝向，在这里生成漫游用的楼梯高程网格
  buildStairSurfs();
}

export function buildLabels(){
  V.labelG.children.slice().forEach(o => { o.element.remove(); V.labelG.remove(o); });
  const floors = (typeof floorsFor3D === 'function') ? floorsFor3D() : null;
  const entries = [];
  if (floors && floors.length){
    let y = 0;
    const offsets = alignOffsets(floors);
    floors.forEach((fl, fi) => {
      const y0 = y, tag = fl.name || ((fi + 1) + 'F');
      const run = () => {
        const off = offsets[fi] || {x:0, z:0};
        syncOrigin(); V.OX -= off.x * 1000; V.OY -= off.z * 1000;
        ROOMS.filter(r => r.at).forEach(r => {
          const nm0 = (state.rooms[r.id] && state.rooms[r.id].name) || r.name;
          const el = document.createElement('div'); el.className = 'rlabel';
          el.innerHTML = `${esc(nm(nm0))}<small>${tag} · ${area(r.poly).toFixed(1)}m²</small>`;
          const o = new CSS2DObject(el);
          o.position.set(wx(r.at[0]), y0 + (V.opt.cutFull ? V.H : Math.min(V.opt.cut, V.H)) + .15, wz(r.at[1]));
          o.visible = V.labelG.visible; V.labelG.add(o);
          if (r.counted !== false) entries.push({id: r.id + '@' + fi, name: nm0, tag, area: area(r.poly), floor: fi});
        });
      };
      if (typeof withFloorData === 'function') withFloorData(fl, run); else run();
      y += (typeof floorHeightM === 'function') ? floorHeightM(fl) : V.DEFAULT_H;
    });
    V.H = V.DEFAULT_H;
    if (typeof applyFloorToState === 'function' && state.floors?.[state.activeFloor|0])
      applyFloorToState(state.floors[state.activeFloor|0]);
    syncOrigin();
  } else {
    ROOMS.filter(r => r.at).forEach(r => {
      const el = document.createElement('div'); el.className = 'rlabel';
      el.innerHTML = `${esc(nm(state.rooms[r.id].name))}<small>${area(r.poly).toFixed(1)}m²</small>`;
      const o = new CSS2DObject(el); o.position.set(wx(r.at[0]), (V.opt.cutFull ? V.H : Math.min(V.opt.cut, V.H)) + .15, wz(r.at[1])); o.visible = V.labelG.visible; V.labelG.add(o);
      if (r.counted !== false) entries.push({id: r.id, name: state.rooms[r.id].name, tag: '', area: area(r.poly), floor: 0});
    });
  }
  const total = entries.reduce((a, e) => a + e.area, 0);
  $('#roomList').innerHTML = entries.map(e =>
    `<button data-room="${e.id}" data-floor="${e.floor}"><span>${esc(nm(e.name))}${e.tag ? ' · ' + e.tag : ''}</span><small>${e.area.toFixed(2)} m²</small></button>`
  ).join('') + `<button data-room="__all"><span>${tr('全屋', 'Whole home')}</span><small>${total.toFixed(2)} m²</small></button>`;
  document.querySelectorAll('#roomList button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#roomList button').forEach(x => x.classList.toggle('on', x === b));
    if (V.opt.mode === 'walk') hooks.setMode('orbit');
    if (b.dataset.room === '__all') hooks.flyTo(hooks.isoWhole());
    else hooks.flyToRoom(b.dataset.room.split('@')[0], +b.dataset.floor || 0);
  });
  V.dirty = true;   // 标签（CSS2D）重建需要重绘
}

// 只重建变化的部分
export function sync(force){
  if (!V.inited || (!V.active && !force)) return;
  if (typeof packActiveFloor === 'function') packActiveFloor();
  // 显示范围也进签名：切换楼层 / 整栋预览 / 漫游时会自动重建，而不是沿用旧的一组模型
  const scope = (typeof threeDShowWhole === 'function' && threeDShowWhole()) ? 'all' : `f${state.activeFloor|0}`;
  const a = JSON.stringify([scope, state.floors, state.activeFloor, state.wholeBuilding3d, state.rooms, state.demolished, V.opt.cut, V.opt.cutFull, WALLS, WINS, DOORS, SLIDES, ROOMS, BOUNDS]);
  const f = JSON.stringify([scope, state.floors, state.activeFloor, state.wholeBuilding3d, state.furniture]);
  const l = JSON.stringify([scope, state.floors, state.activeFloor, state.wholeBuilding3d, state.rooms, V.opt.cut, V.opt.cutFull, ROOMS]);
  if (force || a !== V.sigArch){ V.sigArch = a; buildArch(); V.dirty = true; }
  if (force || f !== V.sigFurn){ V.sigFurn = f; buildFurn(); V.dirty = true; }
  if (force || l !== V.sigLabels){ V.sigLabels = l; buildLabels(); V.dirty = true; }
}

// CSS2DRenderer 只看标签自身的 visible，不继承父级，所以逐个设置
export function showLabels(v){ V.labelG.visible = v; V.labelG.children.forEach(o => o.visible = v); V.dirty = true; }
export function applyGrow(){
  if (!V.inited) return;
  V.archUp.scale.y = Math.max(V.grow, .001);
  V.furnG.scale.y = Math.max(V.furnGrow, .001);
  V.lampG.visible = V.grow > .99;
}
