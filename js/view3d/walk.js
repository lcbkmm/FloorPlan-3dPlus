import * as THREE from 'three';
import {V, hooks, wx, wz, withAlignOrigin} from './shared.js';
import {clamp01} from './camera.js';

/* ======================= 漫游 ======================= */
// 触屏漫游：左下虚拟摇杆移动，在画面上拖动转向（iPad 不支持鼠标指针锁定）
export const HINT_ORBIT = () => COARSE ? tr('单指旋转 · 双指缩放 / 平移 · 点选家具后可拖动摆放 · 点门开关', '1 finger orbits · 2 fingers zoom / pan · select furniture to drag it · tap doors to open')
  : tr('左键旋转 · 右键平移 · 滚轮缩放 · 选中家具后拖动可摆放 · 点击门开关', 'Left-drag orbits · right-drag pans · scroll zooms · select furniture to drag it · click doors to open');
export const HINT_TOUCHWALK = () => tr('左下摇杆移动 · 拖动画面转向 · 点门开关', 'Joystick moves · drag to look · tap doors to open');
export const HINT_WALK = () => tr('WASD 移动 · 鼠标转向 · Shift 快走 · E 开关门 · 走楼梯可上下层 · Esc 暂停', 'WASD moves · mouse looks · Shift runs · E opens doors · use stairs between floors · Esc pauses');
export function syncHint3d(){ $('#hint3d').textContent = V.opt.mode === 'orbit' ? HINT_ORBIT() : V.touchWalk ? HINT_TOUCHWALK() : HINT_WALK(); }
/** 限幅转向：丢弃异常尖峰，单帧位移夹紧，并清零 roll 防累积抖动 */
export function applyLook(dx, dy, sens){
  if (!(Math.abs(dx) > 0 || Math.abs(dy) > 0)) return;
  // 切屏 / 锁定瞬间浏览器偶发上报极大值，整帧丢弃
  if (Math.abs(dx) > 120 || Math.abs(dy) > 120) return;
  dx = THREE.MathUtils.clamp(dx, -48, 48);
  dy = THREE.MathUtils.clamp(dy, -48, 48);
  V.eul.setFromQuaternion(V.camera.quaternion);
  V.eul.z = 0;
  V.eul.y -= dx * sens;
  V.eul.x = THREE.MathUtils.clamp(V.eul.x - dy * sens, -1.35, 1.35);
  V.camera.quaternion.setFromEuler(V.eul);
}
export function onWalkLook(e){
  if (!V.active || V.opt.mode !== 'walk' || !V.walkCtl?.isLocked) return;
  if (performance.now() < V.lookIgnoreUntil) return;
  applyLook(e.movementX || 0, e.movementY || 0, .002);
}
export function lookBy(dx, dy){
  // 触屏拖拽：符号与鼠标相反（手指右滑=画面右转），用负号对齐
  applyLook(-dx, -dy, .005);
}
export function startTouchWalk(){
  V.touchWalk = true;
  $('#walkOverlay').style.display = 'none'; $('#joy').style.display = 'block'; $('#walkExit').style.display = 'block';
  syncHint3d();
}
export function stopTouchWalk(){
  V.touchWalk = false; V.joy.x = V.joy.y = 0; V.joy.id = null; $('#joy i').style.transform = '';
  $('#joy').style.display = 'none'; $('#walkExit').style.display = 'none';
}
export function bindJoystick(){
  const el = $('#joy'), knob = $('#joy i'), R = 50;
  const upd = e => {
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width/2), dy = e.clientY - (r.top + r.height/2);
    const L = Math.hypot(dx, dy); if (L > R){ dx *= R/L; dy *= R/L; }
    V.joy.x = dx/R; V.joy.y = dy/R; knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  el.addEventListener('pointerdown', e => { e.preventDefault(); V.joy.id = e.pointerId; el.setPointerCapture(e.pointerId); upd(e); });
  el.addEventListener('pointermove', e => { if (e.pointerId === V.joy.id) upd(e); });
  const end = e => { if (e.pointerId !== V.joy.id) return; V.joy.id = null; V.joy.x = V.joy.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}
/** 漫游起点：从「入户门所在楼层」进屋，门内侧朝屋内。
 *  入户门可能在 2F（错层 / 台地户型），旧版固定 floors[0] 会一律从 1F 起步。 */
export function walkSpawnPose(){
  const rank = d => d.entry ? 2
    : /入户|正门|大门|entry|front\s*door|main\s*door/i.test(d.name || '') ? 1 : 0;
  const floors = (typeof floorsFor3D === 'function') ? floorsFor3D() : null;
  // 逐层装载平面数据，找 entry 门所在的楼层；都没有则退回第 1 层的外轮廓门兜底。
  let best = null;
  if (floors && floors.length && typeof withFloorData === 'function'){
    const active = state.activeFloor | 0;
    floors.forEach((fl, i) => {
      const top = withFloorData(fl, () => {
        let t = 0;
        (typeof DOORS !== 'undefined' ? DOORS : []).forEach(d => { t = Math.max(t, rank(d)); });
        return t;
      });
      if (top <= 0) return;
      // 多层都有 entry（复制楼层常见）时优先用户正在编辑的那一层
      if (!best || top > best.rank || (top === best.rank && i === active))
        best = {idx: i, rank: top};
    });
  }
  const fi = best ? best.idx : 0;
  const baseY = (V.floorYs && V.floorYs.length > fi) ? V.floorYs[fi] : 0;
  const go = () => {
    // 入户门优先：显式 entry 标记 → 名称关键词 → 兜底取最贴近户型外轮廓的门。
    // CAD 导入 / 手绘方案常没有 entry 标记，兜底保证仍从「大门」进屋，
    // 而不是直接落到最大的房间中央。
    const outerDoor = () => {
      if (typeof BOUNDS === 'undefined') return null;
      let bestD = null, bd = Infinity;
      DOORS.forEach(d => {
        if (d.gate || /花园|阳台|露台|balcony|garden|patio|terrace/i.test(d.name || '')) return;
        const [x0, y0, x1, y1] = d.rect;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const dist = Math.min(cx - BOUNDS.x, BOUNDS.x + BOUNDS.w - cx,
                              cy - BOUNDS.y, BOUNDS.y + BOUNDS.h - cy);
        if (dist < bd){ bd = dist; bestD = d; }
      });
      return bestD;
    };
    const entry = DOORS.find(d => d.entry)
      || DOORS.find(d => /入户|正门|大门|entry|front\s*door|main\s*door/i.test(d.name || ''))
      || outerDoor();
    const inRoom = (x, y) => ROOMS.some(r => r.counted !== false && r.poly && typeof pointInPoly === 'function' && pointInPoly(x, y, r.poly));
    if (!entry){
      let bestR = null, bestA = 0;
      ROOMS.forEach(r => {
        if (r.counted === false || !r.poly) return;
        const a = typeof area === 'function' ? area(r.poly) : 0;
        if (a > bestA){ bestA = a; bestR = r; }
      });
      if (bestR){
        const xs = bestR.poly.map(p => p[0]), ys = bestR.poly.map(p => p[1]);
        const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
        return {x: wx(x), y: baseY + 1.6, z: wz(y), lx: wx(x + 800), ly: baseY + 1.5, lz: wz(y)};
      }
      const x = BOUNDS.x + BOUNDS.w / 2, y = BOUNDS.y + BOUNDS.h / 2;
      return {x: wx(x), y: baseY + 1.6, z: wz(y), lx: 0, ly: baseY + 1.5, lz: 0};
    }
    const [x0, y0, x1, y1] = entry.rect;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let nx = 0, ny = 0;
    if (entry.o && (entry.o[0] || entry.o[1])){ nx = -entry.o[0]; ny = -entry.o[1]; }
    else if ((x1 - x0) >= (y1 - y0)) ny = -1;
    else nx = -1;
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen; ny /= nlen;
    if (inRoom(cx + nx * 900, cy + ny * 900) && !inRoom(cx - nx * 900, cy - ny * 900)){
      nx = -nx; ny = -ny;
    }
    const inDist = 900;
    let ix = cx - nx * inDist, iy = cy - ny * inDist;
    if (!inRoom(ix, iy)){
      ix = cx + nx * inDist; iy = cy + ny * inDist;
      if (inRoom(ix, iy)){ nx = -nx; ny = -ny; }
      else { ix = cx - nx * inDist; iy = cy - ny * inDist; }
    }
    const lx = ix - nx * 1800, ly = iy - ny * 1800;
    let px = wx(ix), pz = wz(iy);
    // 起点按入户门所在层判碰撞，不能沿用切换前鸟瞰相机的高度
    if (blocked(px, pz, .2, fi)){
      px = wx(cx - nx * 450);
      pz = wz(cy - ny * 450);
      if (blocked(px, pz, .2, fi)){ px = wx(ix); pz = wz(iy); }
    }
    return {x: px, y: baseY + 1.6, z: pz, lx: wx(lx), ly: baseY + 1.5, lz: wz(ly)};
  };
  const fl = floors && floors[fi];
  if (fl && typeof withFloorData === 'function')
    return withFloorData(fl, () => withAlignOrigin(fi, go));
  return withAlignOrigin(0, go);
}
export function setMode(m){
  if (V.anim) return;
  V.opt.mode = m; hooks.syncModeBtns?.();
  if (m === 'walk'){
    window.select(null);
    // 漫游强制全高墙，退出后恢复原剖切
    V.cutBeforeWalk = {cut: V.opt.cut, cutFull: !!V.opt.cutFull};
    if (!V.opt.cutFull){ V.opt.cutFull = true; hooks.syncCutBtns?.(); }
    // 显示范围：鸟瞰当前层 → 漫游整栋，必须重建架构 / 家具 / 标签与层高表
    hooks.sync?.(true);
    V.orbit.enabled = false; V.fly = null;
    const sp = walkSpawnPose();
    V.camera.position.set(sp.x, sp.y, sp.z);
    V.camera.lookAt(sp.lx, sp.ly, sp.lz);
    $('#walkOverlay').style.display = 'flex';
    syncHint3d();
  } else {
    V.walkCtl.unlock(); stopTouchWalk(); V.orbit.enabled = true;
    $('#walkOverlay').style.display = 'none'; $('#cross').style.display = 'none';
    if (V.cutBeforeWalk){
      V.opt.cut = V.cutBeforeWalk.cut;
      V.opt.cutFull = V.cutBeforeWalk.cutFull;
      V.cutBeforeWalk = null;
      hooks.syncCutBtns?.();
    }
    // 回到鸟瞰：重新只建当前选中层，避免整栋模型继续占用渲染与阴影开销
    hooks.sync?.(true);
    syncHint3d();
    V.orbit.target.set(0, 0, 0); hooks.flyTo(hooks.isoWhole());
  }
  hooks.showLabels?.(V.opt.labels && m === 'orbit');
  V.archUp.traverse(o => { if (o.userData.walkOnly) o.visible = m === 'walk'; });
  // 漫游仰视时天花板上的吸顶灯白盘像一块大白斑：漫游模式隐藏，退出漫游恢复构建时的剖切显隐
  V.lampG.traverse(o => { if (o.userData.hideInWalk) o.visible = m !== 'walk' && o.userData.baseVisible !== false; });
  syncRoofOpacity();
}
/** 环视俯视：屋顶完全隐藏（之前留 .12 的半透明膜，俯视会像一层雾屏障）；
 *  漫游：屋顶不透明，作为顶层的天花板 */
export function syncRoofOpacity(){
  const walk = V.opt.mode === 'walk';
  if (V.roofMat){
    V.roofMat.transparent = !walk;
    V.roofMat.opacity = walk ? 1 : 0;
    V.roofMat.depthWrite = walk;
    V.roofMat.needsUpdate = true;
  }
  // 鸟瞰直接不渲染屋顶 mesh（比 opacity:0 更省一次透明排序）；剖切视图重建后
  // visible 会按 top>=V.H 重设，再由这里按模式统一收口。
  if (V.archUp) V.archUp.traverse(o => { if (o.userData && o.userData.roof) o.visible = walk; });
  V.dirty = true;
}
/** 当前眼睛所在的楼层序号：按各层人眼高度就近判定，供碰撞只取本层几何 */
export function eyeFloorIndex(){
  const ey = V.camera?.position?.y ?? 1.6;
  const ys = (V.floorYs && V.floorYs.length) ? V.floorYs : [0];
  let best = 0, bd = Infinity;
  for (let i = 0; i < ys.length; i++){
    const d = Math.abs(ey - (ys[i] + 1.55));
    if (d < bd){ bd = d; best = i; }
  }
  return best;
}
/** 人是否处在楼梯井的层间行程上（含上下两端平台）。
 *  楼梯是立体坡道，二维墙 AABB 表达不了「从墙上方跨过 / 贯通两层」；若照常判墙，
 *  上/下楼的人会在楼梯口或中段被本层、另一层的墙卡死。豁免严格限制在楼梯包围盒
 *  平面内、且眼高处于该段坡道行程（两端各留 5cm 容差，覆盖刚上到顶层 / 刚起步）；
 *  离开楼梯井立即恢复普通碰撞，因此只影响楼梯口那一小块，不会让整层平地穿墙。 */
function onStairRamp(x, z, ey){
  const EYE = 1.55;
  for (const s of V.stairZones){
    if (Math.abs(x - s.cx) > s.hw || Math.abs(z - s.cz) > s.hd) continue;
    if (ey >= s.y0 + EYE - .05 && ey <= s.y1 + EYE + .05) return true;
  }
  return false;
}
export function blocked(x, z, r = .18, fiOverride = null){
  // 旧逻辑用「门根节点的世界 y」比对眼睛带，实际拿到的是层底标高：
  // 1F 门（y=0）被判太远而跳过，2F 门（y=2.8）却落进眼睛带 → 人在 1F 操作
  // 的是 1F 的门，挡路的却是楼上那扇的碰撞体，这就是「门开了仍进不去」的空气墙。
  const fi = fiOverride == null ? eyeFloorIndex() : fiOverride;
  // 起点定位（fiOverride=0，固定 1F）不豁免；仅漫游移动时按楼梯坡道放行墙体
  const ramp = fiOverride == null && onStairRamp(x, z, V.camera?.position?.y ?? 1.6);
  if (!ramp) for (const c of V.colliders){
    if ((c.fi ?? 0) !== fi) continue;          // 只判本层墙，避免上层墙体挡住下层的人
    const x0 = c.x0 ?? c[0], z0 = c.z0 ?? c[1], x1 = c.x1 ?? c[2], z1 = c.z1 ?? c[3];
    if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
  }
  for (const d of V.doors){
    if ((d.fi ?? 0) !== fi) continue;
    if (d.slide){
      const closed = d.cur < .55;
      // 打开后只挡叠扇一侧，且绝不按角色半径向洞内膨胀：窄洞净宽常小于 2r，
      // 一膨胀整洞被封死。净宽过小时直接放行，宁可穿过薄玻璃也不做空气墙。
      if (!closed && (d.clearW ?? 1) < .34) continue;
      const box = closed ? d.hitBoxClosed : d.hitBoxOpen;
      if (box){
        const pad = closed ? r : Math.min(r, .03);
        const [x0, z0, x1, z1] = box;
        if (x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) return true;
      }
      continue;
    }
    // 平开门接近全开时不再挡路，避免门洞「空气墙」
    const openSpan = Math.abs((d.a1 ?? 0) - (d.a0 ?? 0)) || 1;
    const openAmt = Math.abs((d.cur ?? d.a0 ?? 0) - (d.a0 ?? 0)) / openSpan;
    if (openAmt > .72) continue;
    if (!d.pivot) continue;
    const len = Math.max(.35, d.len || .9);
    const a = d.pivot.rotation.y, px = d.pivot.position.x, pz = d.pivot.position.z;
    const ex = px + Math.cos(a) * len, ez = pz - Math.sin(a) * len;
    const denom = (ex - px) ** 2 + (ez - pz) ** 2 || 1e-6;
    const t = clamp01(((x - px) * (ex - px) + (z - pz) * (ez - pz)) / denom);
    if (Math.hypot(x - (px + t * (ex - px)), z - (pz + t * (ez - pz))) < r * .75) return true;
  }
  return false;
}
export function stairEyeY(x, z, curY){
  const EYE = 1.55, foot = curY - EYE;
  // 只在「抬脚一步之内（约 1.5 个踏步高）」认作踩在这段楼梯上：走过楼梯口、
  // 站在上层楼板上时，脚下即便压着楼梯也不会被硬拽下去或被顶上来。
  const STEP = .42;
  const list = V.stairSurfs || [];
  // 脚下 / 略低于脚底的面（站立、下楼）与略高的面（上楼）要分开比：
  // 若一律比「谁离脚底近」，上下两层都放了楼梯时（2F 楼梯的第一级正好落在
  // 2F 地面高度），下楼的人会被那一级「上层楼梯」托住，像踩到一块看不见的地板。
  let lower = null, ld = Infinity, upper = null, ud = Infinity;
  for (let q = 0; q < list.length; q++){
    const s = list[q];
    // 优先取「脚下那一格」：踏步是平面，脚下这格就是真实站立面。
    // 只在这一格没有采样（两跑之间 5~6cm 的缝、踏步圆角漏采）时，才退到 3×3 邻域找。
    const ci = Math.round((x - s.x0) / s.sx), cj = Math.round((z - s.z0) / s.sz);
    let hit = false;
    for (let ring = 0; ring < 2 && !hit; ring++){
      for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++){
        if (ring === 1 && Math.abs(di) !== 1 && Math.abs(dj) !== 1) continue;   // 第二圈只看外环
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= s.nx || j >= s.nz) continue;
        const base = (j * s.nx + i) * s.layers;
        for (let k = 0; k < s.layers; k++){
          const y = s.h[base + k];
          if (Number.isNaN(y)) continue;
          const d = y - foot;
          if (d < -STEP || d > STEP) continue;
          hit = true;
          const pen = ring * .06;
          if (d <= .06){                       // 站在这一级上，或这一级略低于脚底
            if (Math.abs(d) + pen < ld){ ld = Math.abs(d) + pen; lower = y; }
          } else if (d + pen < ud){             // 上一级台阶（上楼）
            ud = d + pen; upper = y;
          }
        }
      }
    }
  }
  if (lower != null) return lower + EYE;
  if (upper != null) return upper + EYE;
  // 人在楼梯井范围内，但这一格没有采到台阶面（踏步缝、旋转楼梯空档、或某段楼梯
  // 没能成功取样）：按该段楼梯的坡道给一个连续高度。这里绝不能吸附到楼层 ——
  // 那会在楼梯半空造出一块「看不见的地板」，把下楼的人顶回去、再也下不来。
  const zonesOk = [];
  for (let q = 0; q < V.stairZones.length; q++){
    const s = V.stairZones[q];
    // 只有按真实几何量出来的楼梯区（kind==='stair'）才参与兜底，按 w/d 估的范围
    // 在旋转摆放时会明显偏大，拿它做兜底会把人往错的角度上带。
    // 方案里完全没有楼梯模型（只画了连通区）时，退回老版本所有区都能兜底。
    if (s.kind !== 'stair' && list.length) continue;
    if (s.kind === 'stair' && (foot < s.y0 - .3 || foot > s.y1 + .2)) continue;
    if (Math.abs(x - s.cx) > s.hw || Math.abs(z - s.cz) > s.hd) continue;
    zonesOk.push(s);
    const tx = clamp01((x - (s.cx - s.hw)) / Math.max(1e-3, s.hw * 2));
    const tz = clamp01((z - (s.cz - s.hd)) / Math.max(1e-3, s.hd * 2));
    const t = s.hw >= s.hd ? tx : tz;
    const rise = Math.max(.1, s.y1 - s.y0);
    const ey = s.y0 + EYE + rise * (s.up ? t : (1 - t));
    if (Math.abs(ey - curY) <= .9) return ey;
  }
  // 平地：吸附到脚下最近的一层。两条硬约束：
  // ① 站在楼梯井 / 楼板洞口上方时，这块楼板不算支撑（否则会悬在半空，
  //    像踩着一块「空气地板」，人再也下不了楼）；
  // ② 只允许抬高一级台阶的高度（跨上上层楼板），其余一律不往上拽。
  const ys = (V.floorYs && V.floorYs.length) ? V.floorYs : [0];
  const holed = (fi, px, pz) => {
    for (let h = 0; h < V.floorHoles.length; h++){
      const H = V.floorHoles[h];
      if (H.fi !== fi) continue;
      for (let r = 0; r < H.rects.length; r++){
        const q = H.rects[r];
        if (px > q.x0 && px < q.x1 && pz > q.z0 && pz < q.z1) return true;
      }
    }
    return false;
  };
  let wellBase = null;
  for (let q = 0; q < zonesOk.length; q++){
    const s = zonesOk[q];
    if (s.kind !== 'stair') continue;
    if (wellBase == null || s.y0 > wellBase) wellBase = s.y0;
  }
  let bestY = curY, bestD = 1e9;
  ys.forEach((y0, i) => {
    const ey = y0 + EYE;
    if (ey > curY + .35) return;
    if (wellBase != null && y0 > wellBase + .05) return;
    if (holed(i, x, z)) return;
    const d = Math.abs(curY - ey);
    if (d < bestD){ bestD = d; bestY = ey; }
  });
  return bestY;
}
export function stepWalk(dt){
  if (!V.walkCtl.isLocked && !V.touchWalk) return;
  const sp = (V.keys.ShiftLeft || V.keys.ShiftRight ? 2.6 : 1.4) * dt, fwd = new THREE.Vector3();
  V.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x), mv = new THREE.Vector3();
  if (V.keys.KeyW || V.keys.ArrowUp) mv.add(fwd); if (V.keys.KeyS || V.keys.ArrowDown) mv.sub(fwd);
  if (V.keys.KeyD || V.keys.ArrowRight) mv.add(right); if (V.keys.KeyA || V.keys.ArrowLeft) mv.sub(right);
  if (V.touchWalk){ mv.addScaledVector(fwd, -V.joy.y).addScaledVector(right, V.joy.x); }
  const mag = Math.min(1, mv.length());        // 摇杆推得越远走得越快
  if (mag >= .05){
    mv.normalize().multiplyScalar(sp * mag);
    const p = V.camera.position;
    if (!blocked(p.x + mv.x, p.z)) p.x += mv.x;
    if (!blocked(p.x, p.z + mv.z)) p.z += mv.z;
  }
  // 双层：楼梯按真实踏步高程平滑升降，平地吸附所在层人视高度
  {
    const p = V.camera.position;
    const targetY = stairEyeY(p.x, p.z, p.y);
    const dy = (targetY - p.y) * Math.min(1, dt * 9);
    // 竖向限速 3.2 m/s：即使高程数据出现异常点也不会把人瞬移一层，
    // 只会表现为「扶着扶手快走」，不会再出现刚上楼梯猛跳一段
    const cap = 3.2 * dt;
    p.y += Math.max(-cap, Math.min(cap, dy));
  }
}
addEventListener('keydown', e => {
  if (!V.active || e.target.matches('input,select,textarea')) return;
  V.keys[e.code] = true;
  if (V.opt.mode === 'walk' && e.code === 'KeyE'){ const h = hooks.pick(); if (h?.door && h.dist < 2.5) h.door.open = !h.door.open; }
});
addEventListener('keyup', e => V.keys[e.code] = false);
