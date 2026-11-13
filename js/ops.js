/* ======================= 操作 ======================= */
function select(sel){
  if (ui.awaitMerge && sel?.kind === 'room' && sel.id !== ui.awaitMerge){
    const from = ui.awaitMerge;
    ui.awaitMerge = null;
    mergeRooms(from, sel.id);
    return;
  }
  if (sel?.kind !== 'room') ui.awaitMerge = null;
  ui.sel = sel; renderSel(); renderPanel();
}
function rotateSel(d){ if (ui.sel?.kind==='furn') mutate(() => { const f = getF(ui.sel.id); f.rot = norm(f.rot + d); }); }
function deleteSel(){
  if (ui.sel?.kind === 'furn'){ const id = ui.sel.id; ui.sel = null; mutate(() => state.furniture = state.furniture.filter(f => f.id !== id)); }
  else if (ui.sel?.kind === 'wall'){ const id = ui.sel.id; ui.sel = null; eraseWall(id); }
  else if (ui.sel?.kind === 'win'){
    const i = ui.sel.id; ui.sel = null;
    mutate(() => { WINS.splice(i, 1); persistCustomPlan(); });
    renderOpenings();
  } else if (ui.sel?.kind === 'door'){
    const i = ui.sel.id; ui.sel = null;
    mutate(() => { DOORS.splice(i, 1); persistCustomPlan(); });
    renderOpenings();
  } else if (ui.sel?.kind === 'slide'){
    const i = ui.sel.id; ui.sel = null;
    mutate(() => { SLIDES.splice(i, 1); persistCustomPlan(); });
    renderOpenings();
  }
}
function duplicateSel(){
  if (ui.sel?.kind !== 'furn') return;
  const f = getF(ui.sel.id), n = {...f, id:uid(), cx:f.cx+200, cy:f.cy+200};
  ui.sel = {kind:'furn', id:n.id}; mutate(() => state.furniture.push(n));
}
// 新放下的家具若压在墙 / 窗上，沿穿透较浅的方向推出来，刚好贴墙
function pushOut(f){
  for (let n = 0; n < 4; n++){
    let moved = false;
    for (const r of snapRects()){
      const {hw, hh} = aabb(f), ox = Math.min(f.cx+hw, r[2]) - Math.max(f.cx-hw, r[0]), oy = Math.min(f.cy+hh, r[3]) - Math.max(f.cy-hh, r[1]);
      if (ox <= 0 || oy <= 0) continue;
      if (ox < oy) f.cx = f.cx < (r[0]+r[2])/2 ? r[0]-hw : r[2]+hw;
      else f.cy = f.cy < (r[1]+r[3])/2 ? r[1]-hh : r[3]+hh;
      moved = true;
    }
    if (!moved) return;
  }
}
/** 挂墙装饰（WALL_DECOR）：吸附到最近墙体「房间一侧」的表面，并让正面朝房间。
    水平墙沿 X：房间在 y>cross 一侧 → rot 0；另一侧 → rot 180。
    垂直墙沿 Z：房间在 x>cross 一侧 → rot 270；另一侧 → rot 90。
    3D 里 g.rotation.y = -rot° 后，画框法线（局部 +Z）正好指向房间内侧。
    只写 f 的 cx/cy/rot，3D 建模阶段无需读墙体，多层切换也不会错位。 */
function snapWallDecor(f, x, y){
  const hit = nearestWallHit(x, y, 1600);
  if (!hit) return false;
  const off = f.d / 2 + 8;                 // 贴墙面外，留 8mm 防止与墙体闪面
  if (hit.horiz){
    const s = y >= hit.cross ? 1 : -1;
    f.cx = Math.round(hit.along / 10) * 10;
    f.cy = (s > 0 ? hit.w[3] : hit.w[1]) + s * off;
    f.rot = s > 0 ? 0 : 180;
  } else {
    const s = x >= hit.cross ? 1 : -1;
    f.cx = (s > 0 ? hit.w[2] : hit.w[0]) + s * off;
    f.cy = Math.round(hit.along / 10) * 10;
    f.rot = s > 0 ? 270 : 90;
  }
  return true;
}
/** 点到墙 AABB 的距离（在墙内为 0） */
function distToWallAABB(x, y, w){
  const cx = Math.min(Math.max(x, w[0]), w[2]);
  const cy = Math.min(Math.max(y, w[1]), w[3]);
  return Math.hypot(x - cx, y - cy);
}
/** 找最近墙段，把门吸附到墙上；花园门可吸附矮围墙 */
function nearestWallHit(x, y, maxDist, opts){
  maxDist = maxDist == null ? 1200 : maxDist;
  const allowLow = !!(opts && opts.allowLow);
  const preferLow = !!(opts && opts.preferLow);
  let best = null, bestD = maxDist;
  let bestLow = null, bestLowD = maxDist;
  for (let i = 0; i < WALLS.length; i++){
    const w = WALLS[i];
    const isLow = (w[4] || 'n') === 'low';
    if (isLow && !allowLow) continue;
    if (wallLenOf(w) < 500) continue;
    const d = distToWallAABB(x, y, w);
    if (d > maxDist) continue;
    const horiz = wallIsHoriz(w);
    const along = horiz
      ? Math.min(w[2], Math.max(w[0], x))
      : Math.min(w[3], Math.max(w[1], y));
    const cross = horiz ? (w[1] + w[3]) / 2 : (w[0] + w[2]) / 2;
    const hit = {i, w, horiz, along, cross, low: isLow, d};
    if (isLow && d < bestLowD){ bestLowD = d; bestLow = hit; }
    if (d < bestD){ bestD = d; best = hit; }
  }
  // 花园门：落点靠近矮围墙时优先矮围墙，避免被旁边房屋外墙抢走
  if (preferLow && bestLow && bestLowD <= 900) return bestLow;
  if (preferLow && bestLow && (!best || bestLowD <= bestD + 400)) return bestLow;
  return best;
}

/** 旧版「花园围墙」家具 → 轴对齐矮围墙矩形（兼容旧方案） */
function gardenFenceToWallRect(f){
  if (!f || f.type !== 'gardenfence') return null;
  const rot = ((Number(f.rot) || 0) % 360 + 360) % 360;
  const snap = Math.round(rot / 90) * 90 % 360;
  let diff = Math.abs(rot - snap); if (diff > 180) diff = 360 - diff;
  if (diff > 20) return null;
  const thick = Math.max(80, Math.min(280, Math.round((Math.min(f.w, f.d) || 200) / 10) * 10));
  const len = Math.max(500, Math.round((Math.max(f.w, f.d) || 1800) / 10) * 10);
  const wall = (snap === 0 || snap === 180)
    ? [f.cx - len / 2, f.cy - thick / 2, f.cx + len / 2, f.cy + thick / 2, 'low']
    : [f.cx - thick / 2, f.cy - len / 2, f.cx + thick / 2, f.cy + len / 2, 'low'];
  return attachLowWallHeight(wall);
}

function distToGardenFence(x, y, f){
  const rad = (Number(f.rot) || 0) * Math.PI / 180;
  const dx = x - f.cx, dy = y - f.cy;
  const lx = dx * Math.cos(rad) + dy * Math.sin(rad);
  const ly = -dx * Math.sin(rad) + dy * Math.cos(rad);
  const cx = Math.min(Math.max(lx, -f.w / 2), f.w / 2);
  const cy = Math.min(Math.max(ly, -f.d / 2), f.d / 2);
  return Math.hypot(lx - cx, ly - cy);
}

function nearestGardenFenceHit(x, y, maxDist){
  maxDist = maxDist == null ? 900 : maxDist;
  let best = null, bestD = maxDist;
  (state.furniture || []).forEach(f => {
    if (!f || f.type !== 'gardenfence') return;
    if (Math.max(f.w, f.d) < 500) return;
    const d = distToGardenFence(x, y, f);
    if (d > bestD) return;
    bestD = d;
    best = {f, d};
  });
  return best;
}

/** 从家具库放置门：生成真实门洞（平开 / 推拉 / 花园门），贴墙开洞 */
function addDoorOpening(it, x, y){
  const [type, name, width] = it;
  const gate = type === 'gardengate' || /花园门|garden\s*gate/i.test(name || '');
  let hit = nearestWallHit(x, y, gate ? 2000 : 1200, {allowLow: gate, preferLow: gate});
  // 花园门：优先矮围墙；旧方案里残留的花园围墙家具可就地转为矮围墙
  if (gate){
    const fh = nearestGardenFenceHit(x, y, 800);
    const lowHit = nearestWallHit(x, y, 1000, {allowLow: true, preferLow: true});
    const lowOk = lowHit && lowHit.low && lowHit.d <= 800;
    const fenceOk = fh && fh.d <= 800;
    if (fenceOk && (!lowOk || fh.d <= lowHit.d + 80) && (!hit || hit.low || fh.d + 120 < hit.d)){
      const rectW = gardenFenceToWallRect(fh.f);
      if (!rectW) return toast(tr('请先把旧围墙家具旋转到水平/竖直，或改用画墙「矮围墙」', 'Rotate legacy fence furniture, or draw a low wall'));
      mutate(() => {
        state.furniture = state.furniture.filter(f => f.id !== fh.f.id);
        WALLS.push(typeof polishWall === 'function' ? polishWall(rectW, WALLS.length) : rectW);
        persistCustomPlan();
      });
      hit = nearestWallHit(x, y, 2000, {allowLow: true, preferLow: true});
      renderFurn(); renderWalls();
    } else if (lowOk) hit = lowHit;
  }
  if (!hit) return toast(gate
    ? tr('请把花园门拖到矮围墙或墙体上', 'Drop the garden gate onto a low wall or wall')
    : tr('请把门拖到墙体上或墙边', 'Drop the door onto or beside a wall'));
  let L = Math.max(500, Math.round((width || 900) / 10) * 10);
  const wallL = wallLenOf(hit.w);
  if (L > wallL - 40) L = Math.max(500, Math.floor((wallL - 40) / 10) * 10);
  if (L < 500) return toast(tr('该墙段太短，放不下这扇门', 'This wall is too short for the door'));
  const entry = /入户/.test(name);
  const slide = type === 'slidedoor';
  let rect, hinge, closed, opened, leafLen, slideV = false;
  if (hit.horiz){
    let x0 = Math.round((hit.along - L / 2) / 10) * 10;
    let x1 = x0 + L;
    if (x0 < hit.w[0]){ x1 += hit.w[0] - x0; x0 = hit.w[0]; }
    if (x1 > hit.w[2]){ x0 -= x1 - hit.w[2]; x1 = hit.w[2]; }
    if (x1 - x0 < 500) return toast(tr('该墙段太短，放不下这扇门', 'This wall is too short for the door'));
    rect = [x0, hit.w[1], x1, hit.w[3]];
    // 朝放置侧开启；铰链在门洞一端，落在开启侧墙面
    const openSign = y >= hit.cross ? 1 : -1;
    const faceY = openSign > 0 ? hit.w[3] : hit.w[1];
    hinge = [x0, faceY];
    closed = [1, 0]; opened = [0, openSign];
    leafLen = Math.round(x1 - x0);
  } else {
    let y0 = Math.round((hit.along - L / 2) / 10) * 10;
    let y1 = y0 + L;
    if (y0 < hit.w[1]){ y1 += hit.w[1] - y0; y0 = hit.w[1]; }
    if (y1 > hit.w[3]){ y0 -= y1 - hit.w[3]; y1 = hit.w[3]; }
    if (y1 - y0 < 500) return toast(tr('该墙段太短，放不下这扇门', 'This wall is too short for the door'));
    rect = [hit.w[0], y0, hit.w[2], y1];
    const openSign = x >= hit.cross ? 1 : -1;
    const faceX = openSign > 0 ? hit.w[2] : hit.w[0];
    hinge = [faceX, y0];
    closed = [0, 1]; opened = [openSign, 0];
    leafLen = Math.round(y1 - y0);
    slideV = true;
  }
  let newId = -1;
  mutate(() => {
    if (slide){
      SLIDES.push({rect: rect.slice(), v: slideV, height: slideV ? 2400 : 2100, leaves: 2, slideTo: 'start'});
      newId = SLIDES.length - 1;
    } else {
      DOORS.push({
        name, rect: rect.slice(),
        h: hinge.slice(), c: closed.slice(), o: opened.slice(),
        len: leafLen, height: gate ? 2000 : 2100, entry: !!entry, gate: !!gate,
        ...(gate ? {leaves: 2} : {}),
      });
      newId = DOORS.length - 1;
    }
    persistCustomPlan();
  });
  renderOpenings(); renderWalls();
  if (newId >= 0) select(slide ? {kind:'slide', id:newId} : {kind:'door', id:newId});
  toast(slide
    ? tr(`已添加「${name}」推拉门 · 可在右侧编辑`, `Added sliding door "${nm(name)}" · edit in panel`)
    : gate
      ? tr(`已添加「${name}」· 已开在矮围墙/墙段上`, `Added "${nm(name)}" · opened on low wall`)
      : tr(`已添加「${name}」· 朝放置侧开启，可在右侧改方向/铰链`, `Added "${nm(name)}" · opens toward drop side; edit swing/hinge in panel`));
}

function pointInPoly(x, y, poly){
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi) inside = !inside;
  }
  return inside;
}
function roomAt(x, y){
  let best = null, bestA = Infinity;
  for (const r of ROOMS){
    if (!r.poly || !pointInPoly(x, y, r.poly)) continue;
    const a = area(r.poly);
    if (a < bestA){ bestA = a; best = r; }
  }
  return best;
}
/** 从家具库拖地板到房间：更换该房间地面材料 */
function applyFloorMat(it, x, y){
  const [, name, , , , matKey] = it;
  if (!matKey || !MATS[matKey]) return toast(tr('未知地面材料', 'Unknown flooring'));
  const r = roomAt(x, y);
  if (!r) return toast(tr('请把地板拖到房间内', 'Drop flooring inside a room'));
  mutate(() => {
    if (!state.rooms[r.id]) state.rooms[r.id] = {name: r.name, mat: matKey, wallpaper:null};
    else state.rooms[r.id].mat = matKey;
    r.mat = matKey;
  });
  select({kind:'room', id: r.id});
  toast(tr(`「${state.rooms[r.id].name}」已铺 ${nm(name)}`, `"${nm(state.rooms[r.id].name)}" → ${nm(name)}`));
}

function addItem(it, x, y){
  if (it[0] === 'door' || it[0] === 'slidedoor' || it[0] === 'gardengate'){
    addDoorOpening(it, x, y);
    return;
  }
  if (it[0] === 'floor'){
    applyFloorMat(it, x, y);
    return;
  }
  const [type,name,w,d,color,extra] = it;
  const f = F(type,name,Math.round(x/10)*10,Math.round(y/10)*10,w,d,0,color, type==='stairs' ? extra : undefined);
  let wallHint = '';
  if (WALL_DECOR.has(type)){
    // 挂画 / 挂镜 / 挂毯等：自动贴到墙面并转向房间，不做 pushOut（pushOut 会把它推离墙）
    if (!snapWallDecor(f, x, y)) wallHint = tr('（拖到墙边可自动挂墙）', ' (drop near a wall to hang it)');
  } else pushOut(f);
  ui.sel = {kind:'furn', id:f.id};
  mutate(() => type==='rug' ? state.furniture.unshift(f) : state.furniture.push(f));
  toast(tr(`已添加「${name}」${w}×${d}`, `Added "${nm(name)}" ${w}×${d}`) + wallHint);
}
function toggleWall(id){
  const w = WALLS[+id.slice(1)];
  if (w[4]==='b') return toast(tr('承重墙（黑色）不可拆除', 'Load-bearing walls (black) cannot be removed'));
  if (w[4]==='e') return toast(tr('外墙属于建筑外围护结构，不建议拆除', 'Exterior walls are part of the building envelope and should not be removed'));
  const on = state.demolished.includes(id);
  mutate(() => state.demolished = on ? state.demolished.filter(x => x!==id) : [...state.demolished, id]);
  toast(on ? tr('已恢复墙体', 'Wall restored') : tr(`已标记拆除 ${Math.max(w[2]-w[0], w[3]-w[1])} mm 墙体`, `Marked ${Math.max(w[2]-w[0], w[3]-w[1])} mm of wall for removal`));
}

function persistCustomPlan(){
  planFlags.hasDefaultDims = false;
  planFlags.hasBayLintels = false;
  planFlags.hasEntryMark = false;
  planFlags.cadMode = false;
  state.plan = snapshotPlan();
  expandBoundsToWalls();
}

function expandBoundsToWalls(){
  if (!WALLS.length) return;
  const xs = WALLS.flatMap(w => [w[0], w[2]]), ys = WALLS.flatMap(w => [w[1], w[3]]);
  const pad = 1200;
  let x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  let x1 = Math.max(...xs) + pad, y1 = Math.max(...ys) + pad;
  // Keep underlay / sheet canvas stable: only expand, never shrink
  if (BOUNDS && Number.isFinite(BOUNDS.w) && BOUNDS.w > 0){
    x0 = Math.min(x0, BOUNDS.x);
    y0 = Math.min(y0, BOUNDS.y);
    x1 = Math.max(x1, BOUNDS.x + BOUNDS.w);
    y1 = Math.max(y1, BOUNDS.y + BOUNDS.h);
  }
  BOUNDS = {x:x0, y:y0, w:x1-x0, h:y1-y0};
  if (state.plan) state.plan.bounds = {...BOUNDS};
}

function wallFromPoints(a, b, thick, kind){
  thick = thick || ui.wallThick;
  kind = kind || ui.wallKind || 'n';
  const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
  if (dx < 80 && dy < 80) return null;
  let wall;
  if (dx >= dy){
    const y = Math.round(((a.y + b.y) / 2) / 10) * 10;
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    if (x1 - x0 < 100) return null;
    wall = [Math.round(x0), y - thick/2, Math.round(x1), y + thick/2, kind];
  } else {
    const x = Math.round(((a.x + b.x) / 2) / 10) * 10;
    const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    if (y1 - y0 < 100) return null;
    wall = [x - thick/2, Math.round(y0), x + thick/2, Math.round(y1), kind];
  }
  return attachBeamDrop(attachLowWallHeight(wall));
}

const WALL_ALIGN_TOL = 55;  // 中心线错开容差 mm
const WALL_GAP_TOL = 150;   // 端头间隙/轻微重叠容差 mm
const WALL_THICK_TOL = 50;
const WALL_CORNER_TOL = 60; // 转角顶点/端面细微错开容差 mm

function wallIsHoriz(w){ return (w[2] - w[0]) >= (w[3] - w[1]); }
function wallThickOf(w){ return Math.min(w[2] - w[0], w[3] - w[1]); }
function wallSnapKind(k){ k = k || 'n'; return k === 'win' ? 'n' : k; }
const LOW_WALL_H_DEFAULT = 1050;
const BEAM_DROP_DEFAULT = 400;
/** 矮围墙高度 mm（3D 立面） */
function clampLowWallHeight(h){
  return Math.max(600, Math.min(2200, Math.round((+h || LOW_WALL_H_DEFAULT) / 10) * 10));
}
function wallHeightMm(w){
  if (!w || (w[4] || 'n') !== 'low') return 2800;
  return clampLowWallHeight(w[5] != null ? w[5] : LOW_WALL_H_DEFAULT);
}
function attachLowWallHeight(wall, hmm){
  if (!wall || (wall[4] || 'n') !== 'low') return wall;
  wall[5] = clampLowWallHeight(hmm != null ? hmm : (wall[5] != null ? wall[5] : (ui.lowWallH || LOW_WALL_H_DEFAULT)));
  return wall;
}
/** 横梁下垂高度 mm（自天花向下） */
function clampBeamDrop(h){
  return Math.max(150, Math.min(1800, Math.round((+h || BEAM_DROP_DEFAULT) / 10) * 10));
}
function beamDropMm(w){
  if (!w || (w[4] || 'n') !== 'beam') return BEAM_DROP_DEFAULT;
  return clampBeamDrop(w[5] != null ? w[5] : BEAM_DROP_DEFAULT);
}
function attachBeamDrop(wall, hmm){
  if (!wall || (wall[4] || 'n') !== 'beam') return wall;
  wall[5] = clampBeamDrop(hmm != null ? hmm : (wall[5] != null ? wall[5] : (ui.beamDropH || BEAM_DROP_DEFAULT)));
  return wall;
}
function winIsHoriz(w){ return (w[2] - w[0]) >= (w[3] - w[1]); }
function winWidthOf(w){ return Math.max(w[2] - w[0], w[3] - w[1]); }
/** 窗台高度 mm；无自定义时沿用默认户型规则 */
function winSillMm(w, i){
  if (Number.isFinite(w[4])) return +w[4];
  if (i === 0) return 1400;
  if (i >= 6) return 450;
  return 900;
}
function winHeadMm(w){
  if (Number.isFinite(w[5])) return +w[5];
  return 2400;
}
/** 在墙段上生成窗户 AABB；width=0 表示自适应墙长（两侧留边） */
function makeWinOnWall(wall, opts){
  opts = opts || {};
  const horiz = wallIsHoriz(wall);
  const len = wallLenOf(wall);
  const jambMin = 80;
  let W = opts.width > 0 ? opts.width : Math.max(400, len - 2 * 150);
  W = Math.min(Math.max(300, Math.round(W / 10) * 10), Math.max(300, len - 2 * jambMin));
  const sill = Math.max(0, Math.round((opts.sill != null ? opts.sill : ui.winSill) / 10) * 10);
  const height = Math.max(400, Math.round((opts.height != null ? opts.height : ui.winH) / 10) * 10);
  const head = Math.min(2800, sill + height);
  let win;
  if (horiz){
    const cx = (wall[0] + wall[2]) / 2;
    win = [cx - W / 2, wall[1], cx + W / 2, wall[3], sill, head];
  } else {
    const cy = (wall[1] + wall[3]) / 2;
    win = [wall[0], cy - W / 2, wall[2], cy + W / 2, sill, head];
  }
  if (opts.wallIndex != null && Number.isFinite(opts.wallIndex)) win[6] = opts.wallIndex;
  return win;
}
function syncWinsForWall(wallIndex){
  const wall = WALLS[wallIndex];
  if (!wall) return;
  for (let i = 0; i < WINS.length; i++){
    if (WINS[i][6] !== wallIndex) continue;
    const sill = winSillMm(WINS[i], i);
    const head = winHeadMm(WINS[i]);
    WINS[i] = makeWinOnWall(wall, {
      width: winWidthOf(WINS[i]),
      height: Math.max(400, head - sill),
      sill,
      wallIndex,
    });
  }
}
function reindexWinsAfterWallRemoves(removedSortedDesc){
  const gone = new Set(removedSortedDesc);
  WINS = WINS.filter(w => !Number.isFinite(w[6]) || !gone.has(w[6]));
  for (const i of removedSortedDesc){
    for (const w of WINS){
      if (Number.isFinite(w[6]) && w[6] > i) w[6] -= 1;
    }
  }
}
function setWinSize(i, {width, height, sill}){
  const w = WINS[i]; if (!w) return;
  const host = Number.isFinite(w[6]) ? WALLS[w[6]] : null;
  const curSill = sill != null ? sill : winSillMm(w, i);
  const curHead = winHeadMm(w);
  const curH = height != null ? height : Math.max(400, curHead - winSillMm(w, i));
  const curW = width != null ? width : winWidthOf(w);
  if (host){
    WINS[i] = makeWinOnWall(host, {width: curW, height: curH, sill: curSill, wallIndex: w[6]});
  } else {
    const horiz = winIsHoriz(w);
    const thick = Math.min(w[2] - w[0], w[3] - w[1]);
    const cx = (w[0] + w[2]) / 2, cy = (w[1] + w[3]) / 2;
    const WW = Math.max(300, Math.round(curW / 10) * 10);
    const S = Math.max(0, Math.round(curSill / 10) * 10);
    const H = Math.max(400, Math.round(curH / 10) * 10);
    const head = Math.min(2800, S + H);
    if (horiz) WINS[i] = [cx - WW / 2, cy - thick / 2, cx + WW / 2, cy + thick / 2, S, head];
    else WINS[i] = [cx - thick / 2, cy - WW / 2, cx + thick / 2, cy + WW / 2, S, head];
  }
}
function rangesOverlap(a0, a1, b0, b1, pad){
  pad = pad || 0;
  return Math.min(a1, b1) - Math.max(a0, b0) >= -pad;
}

/** 同向墙体是否在同一位置重叠（垂直墙相交的 T/+ 节点不算重叠） */
function wallsOverlapConflict(a, b){
  // 横梁贴天花，可与地面墙体重叠共线，不视为冲突
  const ka = a[4] || 'n', kb = b[4] || 'n';
  if ((ka === 'beam') !== (kb === 'beam')) return false;
  if (wallIsHoriz(a) !== wallIsHoriz(b)) return false;
  const halfSum = (wallThickOf(a) + wallThickOf(b)) / 2;
  if (wallIsHoriz(a)){
    const cyA = (a[1] + a[3]) / 2, cyB = (b[1] + b[3]) / 2;
    if (Math.abs(cyA - cyB) >= halfSum - 2) return false;
    return Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 40;
  }
  const cxA = (a[0] + a[2]) / 2, cxB = (b[0] + b[2]) / 2;
  if (Math.abs(cxA - cxB) >= halfSum - 2) return false;
  return Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 40;
}
function wallConflictsAny(w, skipIndex){
  for (let i = 0; i < WALLS.length; i++){
    if (i === skipIndex) continue;
    if (wallsOverlapConflict(w, WALLS[i])) return i;
  }
  return -1;
}

/** 两段同向墙是否可吸附合并（共线、近端头） */
function wallsCanMerge(a, b){
  if (wallIsHoriz(a) !== wallIsHoriz(b)) return false;
  if (wallSnapKind(a[4]) !== wallSnapKind(b[4])) return false;
  if ((a[4] || 'n') === 'win' || (b[4] || 'n') === 'win') return false;
  if (Math.abs(wallThickOf(a) - wallThickOf(b)) > WALL_THICK_TOL) return false;
  if (wallIsHoriz(a)){
    const cyA = (a[1] + a[3]) / 2, cyB = (b[1] + b[3]) / 2;
    if (Math.abs(cyA - cyB) > WALL_ALIGN_TOL) return false;
    const gap = Math.max(a[0] - b[2], b[0] - a[2]); // >0 间隙，<0 重叠
    return gap <= WALL_GAP_TOL;
  }
  const cxA = (a[0] + a[2]) / 2, cxB = (b[0] + b[2]) / 2;
  if (Math.abs(cxA - cxB) > WALL_ALIGN_TOL) return false;
  const gap = Math.max(a[1] - b[3], b[1] - a[3]);
  return gap <= WALL_GAP_TOL;
}

/** 合并两段共线墙：对齐到 a 的中心线与厚度 */
function mergeWallPair(a, b){
  const kind = a[4] || b[4] || 'n';
  const thick = wallThickOf(a);
  let out;
  if (wallIsHoriz(a)){
    const y = (a[1] + a[3]) / 2;
    out = [Math.min(a[0], b[0]), y - thick / 2, Math.max(a[2], b[2]), y + thick / 2, kind];
  } else {
    const x = (a[0] + a[2]) / 2;
    out = [x - thick / 2, Math.min(a[1], b[1]), x + thick / 2, Math.max(a[3], b[3]), kind];
  }
  if (kind === 'low'){
    const ha = Number.isFinite(+a[5]) ? +a[5] : null;
    const hb = Number.isFinite(+b[5]) ? +b[5] : null;
    attachLowWallHeight(out, ha != null ? ha : hb);
  }
  if (kind === 'beam'){
    const ha = Number.isFinite(+a[5]) ? +a[5] : null;
    const hb = Number.isFinite(+b[5]) ? +b[5] : null;
    attachBeamDrop(out, ha != null ? ha : hb);
  }
  return out;
}

/** 新墙中心线吸附到附近共线墙 */
function snapWallAlignment(nw){
  const nh = wallIsHoriz(nw);
  const thick = wallThickOf(nw);
  const kind = nw[4] || 'n';
  let best = null, bestD = WALL_ALIGN_TOL;
  for (const ow of WALLS){
    if (wallIsHoriz(ow) !== nh) continue;
    if (wallSnapKind(ow[4]) !== wallSnapKind(kind)) continue;
    if (Math.abs(wallThickOf(ow) - thick) > WALL_THICK_TOL) continue;
    if (nh){
      const d = Math.abs((nw[1] + nw[3]) / 2 - (ow[1] + ow[3]) / 2);
      // 水平向需有 x 投影重叠或接近，避免吸到远处平行墙
      const gap = Math.max(ow[0] - nw[2], nw[0] - ow[2]);
      if (gap > WALL_GAP_TOL + 800) continue;
      if (d < bestD){ bestD = d; best = (ow[1] + ow[3]) / 2; }
    } else {
      const d = Math.abs((nw[0] + nw[2]) / 2 - (ow[0] + ow[2]) / 2);
      const gap = Math.max(ow[1] - nw[3], nw[1] - ow[3]);
      if (gap > WALL_GAP_TOL + 800) continue;
      if (d < bestD){ bestD = d; best = (ow[0] + ow[2]) / 2; }
    }
  }
  if (best == null) return nw;
  const out = nh
    ? [nw[0], best - thick / 2, nw[2], best + thick / 2, kind]
    : [best - thick / 2, nw[1], best + thick / 2, nw[3], kind];
  if (kind === 'low') attachLowWallHeight(out, nw[5]);
  if (kind === 'beam') attachBeamDrop(out, nw[5]);
  return out;
}

/**
 * 垂直墙转角细微错开对齐：
 * 1) 角点靠近 → 平移使角点重合（修 L 形台阶）
 * 2) 端头靠近垂直墙的面 → 端面贴齐
 */
function snapWallCorner(nw, skipIndex){
  const TOL = WALL_CORNER_TOL;
  const nh = wallIsHoriz(nw);
  let [x0, y0, x1, y1, kind] = nw;
  const thick = wallThickOf(nw);

  let bestCorner = null, bestD = TOL + 1;
  for (let i = 0; i < WALLS.length; i++){
    if (i === skipIndex) continue;
    const ow = WALLS[i];
    if (wallIsHoriz(ow) === nh) continue;
    const nCs = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
    const oCs = [[ow[0], ow[1]], [ow[2], ow[1]], [ow[0], ow[3]], [ow[2], ow[3]]];
    for (const [nx, ny] of nCs){
      for (const [ox, oy] of oCs){
        const d = Math.hypot(nx - ox, ny - oy);
        if (d <= TOL && d < bestD){
          bestD = d;
          bestCorner = {dx: ox - nx, dy: oy - ny};
        }
      }
    }
  }
  if (bestCorner){
    return [x0 + bestCorner.dx, y0 + bestCorner.dy, x1 + bestCorner.dx, y1 + bestCorner.dy, kind || 'n'];
  }

  // 端面 / 侧面贴齐（T 接或角点未对齐但边已贴近）
  for (let i = 0; i < WALLS.length; i++){
    if (i === skipIndex) continue;
    const ow = WALLS[i];
    if (wallIsHoriz(ow) === nh) continue;
    if (nh){
      if (!rangesOverlap(y0, y1, ow[1], ow[3], TOL)) continue;
      for (const face of [ow[0], ow[2]]){
        if (Math.abs(x0 - face) <= TOL){ const d = face - x0; return [x0 + d, y0, x1 + d, y1, kind || 'n']; }
        if (Math.abs(x1 - face) <= TOL){ const d = face - x1; return [x0 + d, y0, x1 + d, y1, kind || 'n']; }
      }
      if (!rangesOverlap(x0, x1, ow[0], ow[2], TOL)) continue;
      for (const end of [ow[1], ow[3]]){
        if (Math.abs(y0 - end) <= TOL) return [x0, end, x1, end + thick, kind || 'n'];
        if (Math.abs(y1 - end) <= TOL) return [x0, end - thick, x1, end, kind || 'n'];
      }
    } else {
      if (!rangesOverlap(x0, x1, ow[0], ow[2], TOL)) continue;
      for (const face of [ow[1], ow[3]]){
        if (Math.abs(y0 - face) <= TOL){ const d = face - y0; return [x0, y0 + d, x1, y1 + d, kind || 'n']; }
        if (Math.abs(y1 - face) <= TOL){ const d = face - y1; return [x0, y0 + d, x1, y1 + d, kind || 'n']; }
      }
      if (!rangesOverlap(y0, y1, ow[1], ow[3], TOL)) continue;
      for (const end of [ow[0], ow[2]]){
        if (Math.abs(x0 - end) <= TOL) return [end, y0, end + thick, y1, kind || 'n'];
        if (Math.abs(x1 - end) <= TOL) return [end - thick, y0, end, y1, kind || 'n'];
      }
    }
  }
  return nw;
}

function polishWall(nw, skipIndex){
  // 编辑已有墙时临时移开自身，避免吸附到自己
  let saved = null;
  if (skipIndex != null && WALLS[skipIndex]){
    saved = WALLS[skipIndex];
    WALLS[skipIndex] = [1e15, 1e15, 1e15 + 1, 1e15 + 1, 'n'];
  }
  let w = snapWallAlignment(nw);
  w = snapWallCorner(w, skipIndex);
  if (saved) WALLS[skipIndex] = saved;
  // 吸附可能丢掉 w[5] 高度，从源墙补回
  if ((nw[4] || 'n') === 'low' || (w[4] || 'n') === 'low'){
    w[4] = 'low';
    attachLowWallHeight(w, nw[5] != null ? nw[5] : (saved && saved[5]));
  }
  if ((nw[4] || 'n') === 'beam' || (w[4] || 'n') === 'beam'){
    w[4] = 'beam';
    attachBeamDrop(w, nw[5] != null ? nw[5] : (saved && saved[5]));
  }
  return w;
}

function reindexDemolishedAfterRemoves(removedSortedDesc){
  state.demolished = state.demolished.map(d => {
    let j = +d.slice(1);
    for (const i of removedSortedDesc){
      if (j === i) return null;
      if (j > i) j -= 1;
    }
    return 'w' + j;
  }).filter(Boolean);
}

function addDrawnWall(a, b){
  let w = wallFromPoints(a, b, ui.wallThick, ui.wallKind);
  if (!w) return toast(tr('墙段太短，请拖长一些', 'Wall too short — drag further'));
  w = polishWall(w);
  const isWinWall = (w[4] || 'n') === 'win';
  const mergeIdx = [];
  if (!isWinWall){
    for (let i = 0; i < WALLS.length; i++){
      if (wallsCanMerge(WALLS[i], w)) mergeIdx.push(i);
    }
  }
  let trial = w;
  for (const i of mergeIdx) trial = mergeWallPair(WALLS[i], trial);
  for (let i = 0; i < WALLS.length; i++){
    if (mergeIdx.includes(i)) continue;
    if (wallsOverlapConflict(trial, WALLS[i])){
      return toast(tr('此处已有墙体，不能重叠绘制', 'A wall already exists here — overlapping walls are not allowed'));
    }
  }
  let merged = false;
  mutate(() => {
    w = trial;
    if (mergeIdx.length){
      merged = true;
      const desc = mergeIdx.slice().sort((x, y) => y - x);
      for (const i of desc) WALLS.splice(i, 1);
      reindexDemolishedAfterRemoves(desc);
      reindexWinsAfterWallRemoves(desc);
    }
    WALLS.push(w);
    if (isWinWall){
      const wi = WALLS.length - 1;
      WINS.push(makeWinOnWall(w, {width: ui.winW, height: ui.winH, sill: ui.winSill, wallIndex: wi}));
    }
    persistCustomPlan();
  });
  renderWalls(); renderOpenings();
  const kindName = (WALL_KIND_LABEL[w[4]] || WALL_KIND_LABEL.n)();
  const L = Math.max(w[2] - w[0], w[3] - w[1]);
  const T = wallThickOf(w);
  toast(merged
    ? tr(`已吸附合并${kindName} ${L}×${T} mm`, `Snapped & merged ${kindName} ${L}×${T} mm`)
    : (w[4] === 'win'
      ? tr(`已添加带窗墙 ${L}×${T} mm（可点窗户调尺寸）`, `Added windowed wall ${L}×${T} mm (click window to resize)`)
      : tr(`已添加${kindName} ${L}×${T} mm`, `Added ${kindName} ${L}×${T} mm`)));
}

function eraseWall(id){
  const i = +id.slice(1);
  if (!WALLS[i]) return;
  mutate(() => {
    WALLS.splice(i, 1);
    state.demolished = state.demolished.map(d => {
      const j = +d.slice(1);
      if (j === i) return null;
      return j > i ? 'w' + (j - 1) : d;
    }).filter(Boolean);
    reindexWinsAfterWallRemoves([i]);
    persistCustomPlan();
  });
  renderWalls(); renderOpenings();
  toast(tr('已删除墙体', 'Wall deleted'));
}

function renderWallDraft(){
  const g = $('#gDraw');
  if (!g) return;
  if (ui.tool !== 'draw' || !ui.drawA || !ui.drawCur){ g.innerHTML = ''; return; }
  let w = wallFromPoints(ui.drawA, ui.drawCur, ui.wallThick, ui.wallKind);
  if (!w){ g.innerHTML = ''; return; }
  w = polishWall(w);
  const isWinWall = (w[4] || 'n') === 'win';
  const mergeIdx = [];
  if (!isWinWall){
    for (let i = 0; i < WALLS.length; i++){
      if (wallsCanMerge(WALLS[i], w)) mergeIdx.push(i);
    }
  }
  let trial = w;
  for (const i of mergeIdx) trial = mergeWallPair(WALLS[i], trial);
  let conflict = false;
  for (let i = 0; i < WALLS.length; i++){
    if (mergeIdx.includes(i)) continue;
    if (wallsOverlapConflict(trial, WALLS[i])){ conflict = true; break; }
  }
  w = trial;
  const [x0,y0,x1,y1,k] = w;
  const L = Math.max(x1-x0, y1-y0);
  const style = conflict
    ? {fill:'rgba(184,65,44,.35)', stroke:'#b8412c'}
    : k === 'b'
      ? {fill:'rgba(184,65,44,.45)', stroke:'#b8412c'}
      : k === 'win'
        ? {fill:'rgba(90,109,122,.5)', stroke:'#3d5a6c'}
        : k === 'low'
          ? {fill:'rgba(143,137,125,.4)', stroke:'#8f897d'}
          : k === 'beam'
            ? {fill:'rgba(166,120,72,.5)', stroke:'#8a6238'}
            : {fill:'rgba(181,101,58,.45)', stroke:'#b5653a'};
  let extra = '';
  if (k === 'win' && !conflict){
    const win = makeWinOnWall(w, {width: ui.winW, height: ui.winH, sill: ui.winSill});
    const [wx0,wy0,wx1,wy1] = win;
    extra = `<rect x="${wx0}" y="${wy0}" width="${wx1-wx0}" height="${wy1-wy0}" fill="rgba(247,251,253,.85)" stroke="#4f7394" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  }
  const label = conflict ? tr('重叠', 'Overlap') : String(Math.round(L));
  g.innerHTML = `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="2" vector-effect="non-scaling-stroke"/>
    ${extra}
    <text x="${(x0+x1)/2}" y="${(y0+y1)/2}" text-anchor="middle" dominant-baseline="central" font-size="${Math.max(140, 12/view.s)}" fill="${style.stroke}">${label}</text>`;
}
