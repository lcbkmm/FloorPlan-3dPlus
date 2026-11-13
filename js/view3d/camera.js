import * as THREE from 'three';
import {V, hooks, wx, wz, M, SW, SH, withAlignOrigin} from './shared.js';

/* ======================= 相机位姿 / 动画 ======================= */
export const ease = t => t < .5 ? 4*t*t*t : 1 - (-2*t + 2)**3/2;
export const clamp01 = t => Math.max(0, Math.min(1, t));
export const pose = (t, p) => ({t, p});
// 与当前 2D 视口完全重合的正俯视位姿：透视相机在该高度下，地面可视高度 = 2D 视口高度
export function planPose(){
  const cx = view.x0 + SW()/2/view.s, cy = view.y0 + SH()/2/view.s, visH = SH()/view.s/1000;
  const dist = visH / 2 / Math.tan(V.FOV/2*Math.PI/180), t = new THREE.Vector3(wx(cx), 0, wz(cy));
  return pose(t, new THREE.Vector3(t.x, dist, t.z + 1e-4));
}
export function isoFrom(P){
  const d = THREE.MathUtils.clamp(P.p.y, 5, 30), dir = new THREE.Vector3(.3, .82, .49).normalize();
  return pose(P.t.clone(), P.t.clone().addScaledVector(dir, d));
}
export const totalBuildingH = () => {
  if (typeof floorsFor3D === 'function'){
    const fs = floorsFor3D();
    if (fs?.length) return fs.reduce((a, fl) => a + ((typeof floorHeightM === 'function') ? floorHeightM(fl) : V.DEFAULT_H), 0);
  }
  return V.DEFAULT_H;
};
export const isoWhole = () => {
  const th = totalBuildingH(), lift = Math.max(0, th - V.DEFAULT_H) * .55;
  return pose(new THREE.Vector3(0, th * .35, 0), new THREE.Vector3(5.5, 15.5 + lift, 10));
};
export const topWhole = () => {
  const th = totalBuildingH();
  return pose(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, Math.max(19, th * 4.5 + 8), 1e-4));
};
export const curPose = () => pose(V.orbit.target.clone(), V.camera.position.clone());
// 以目标点为中心做球坐标插值：镜头沿弧线倾斜环绕，而不是直线穿越
export function camTween(A, B, e){
  const t = A.t.clone().lerp(B.t, e);
  const sa = new THREE.Spherical().setFromVector3(A.p.clone().sub(A.t)), sb = new THREE.Spherical().setFromVector3(B.p.clone().sub(B.t));
  let dth = sb.theta - sa.theta; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
  const s = new THREE.Spherical(sa.radius + (sb.radius - sa.radius)*e, sa.phi + (sb.phi - sa.phi)*e, sa.theta + dth*e);
  V.camera.position.copy(t).add(new THREE.Vector3().setFromSpherical(s)); V.camera.lookAt(t); V.orbit.target.copy(t);
}
export function setPose(P){ V.camera.position.copy(P.p); V.orbit.target.copy(P.t); V.camera.lookAt(P.t); }
export function animate(dur, fn){ return new Promise(res => { V.anim = {t0:performance.now(), dur, fn, res}; }); }
export const wait = ms => new Promise(r => setTimeout(r, ms));
export function flyTo(B, dur = 900){ V.fly = {t0:performance.now(), dur, A:curPose(), B}; }
export function flyToRoom(id, floorIdx){
  const floors = (typeof floorsFor3D === 'function') ? floorsFor3D() : null;
  let baseY = 0, fl = null, fi = 0;
  if (floors && floors.length){
    fi = Math.max(0, Math.min(floors.length - 1, Number.isFinite(+floorIdx) ? +floorIdx : (state.activeFloor|0)));
    for (let i = 0; i < fi; i++) baseY += (typeof floorHeightM === 'function') ? floorHeightM(floors[i]) : V.DEFAULT_H;
    fl = floors[fi];
  } else if (V.floorYs?.length && Number.isFinite(+floorIdx)){
    baseY = V.floorYs[+floorIdx] || 0;
    fi = +floorIdx | 0;
  }
  const go = () => {
    const r = ROOMS.find(r => r.id === id);
    if (!r?.poly?.length) return;
    const xs = r.poly.map(p => p[0]), ys = r.poly.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const rw = x1 - x0, rh = y1 - y0;
    const eye = baseY + 1.55;
    const alongX = rw >= rh;
    const backMm = Math.min(Math.min(rw, rh) * .32, 1400);
    const lookMm = Math.min(Math.max(rw, rh) * .38, 2200);
    let px = cx, py = cy, lx = cx, ly = cy;
    if (alongX){ px = cx - backMm; lx = cx + lookMm; }
    else { py = cy - backMm; ly = cy + lookMm; }
    const inside = (x, y) => typeof pointInPoly === 'function' && pointInPoly(x, y, r.poly);
    if (!inside(px, py)){ px = cx; py = cy; }
    if (!inside(lx, ly)){ lx = cx; ly = cy; }
    if (Math.hypot(lx - px, ly - py) < 400){
      if (alongX) lx = px + Math.min(rw * .4, 1600);
      else ly = py + Math.min(rh * .4, 1600);
    }
    const t = new THREE.Vector3(wx(lx), baseY + 1.42, wz(ly));
    const p = new THREE.Vector3(wx(px), eye, wz(py));
    flyTo(pose(t, p), 1000);
  };
  if (fl && typeof withFloorData === 'function') withFloorData(fl, () => withAlignOrigin(fi, go));
  else withAlignOrigin(fi, go);
  if (typeof applyFloorToState === 'function' && state.floors?.[state.activeFloor|0])
    applyFloorToState(state.floors[state.activeFloor|0]);
}

/* ======================= 进入 / 退出 3D ======================= */
export async function enter(){
  hooks.init(); V.active = true;
  // 先确定模式再构建：进入 3D 一律是鸟瞰「当前层」，整栋只在漫游时构建
  V.opt.mode = 'orbit';
  const stageEl = window.$('#stage');
  V.renderer.setSize(SW(), SH()); V.labelRenderer.setSize(SW(), SH()); V.camera.aspect = SW()/SH(); V.camera.updateProjectionMatrix();
  hooks.sync(true);
  V.orbit.enabled = false; hooks.showLabels(false);
  const A = planPose(), B = isoFrom(A);
  V.grow = 0; V.furnGrow = 0; hooks.applyGrow(); setPose(A);
  stageEl.classList.add('animating');
  hooks.startLoop(); V.renderer.render(V.scene, V.camera);
  stageEl.classList.add('is3d');                       // 交叉淡入：此刻 3D 画面与 2D 平面完全重合
  await wait(420);
  await animate(1700, t => {
    camTween(A, B, ease(clamp01(t/.85)));
    V.grow = ease(clamp01((t - .1)/.55));
    V.furnGrow = ease(clamp01((t - .45)/.5));
    hooks.applyGrow();
  });
  V.orbit.enabled = true; hooks.showLabels(V.opt.labels);
  stageEl.classList.remove('animating');
}
export async function exit(){
  const stageEl = window.$('#stage');
  if (V.opt.mode === 'walk'){
    V.walkCtl.unlock(); hooks.stopTouchWalk(); hooks.syncWalkTexts?.();
    $('#walkOverlay').style.display = 'none'; $('#cross').style.display = 'none';
    const dir = new THREE.Vector3(); V.camera.getWorldDirection(dir);
    V.orbit.target.copy(V.camera.position).addScaledVector(dir, 3).setY(0);
    V.opt.mode = 'orbit'; hooks.syncModeBtns?.();
    if (V.cutBeforeWalk){
      V.opt.cut = V.cutBeforeWalk.cut;
      V.opt.cutFull = V.cutBeforeWalk.cutFull;
      V.cutBeforeWalk = null;
      hooks.syncCutBtns?.();
    }
  }
  V.fly = null; V.orbit.enabled = false; hooks.showLabels(false); stageEl.classList.add('animating');
  const A = curPose(), B = planPose();
  await animate(1300, t => {
    camTween(A, B, ease(clamp01((t - .1)/.9)));
    V.furnGrow = 1 - ease(clamp01(t/.45));
    V.grow = 1 - ease(clamp01((t - .2)/.6));
    hooks.applyGrow();
  });
  stageEl.classList.remove('is3d');                    // 此刻 3D 已压平为正俯视，与 2D 重合后淡出
  await wait(450);
  V.active = false; cancelAnimationFrame(V.raf); V.raf = 0;
  stageEl.classList.remove('animating');
  V.grow = V.furnGrow = 1; hooks.applyGrow();
}

/* ======================= 选择 / 拾取 ======================= */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
function floorIdxOf(obj){
  let cur = obj;
  while (cur && cur !== V.scene){
    if (Number.isFinite(cur.userData?.floorIdx)) return cur.userData.floorIdx;
    cur = cur.parent;
  }
  return undefined;
}
export function pick(e){
  if (!e) ptr.set(0, 0);
  else { const r = V.renderer.domElement.getBoundingClientRect(); ptr.set((e.clientX - r.left)/r.width*2 - 1, -(e.clientY - r.top)/r.height*2 + 1); }
  ray.setFromCamera(ptr, V.camera);
  const hits = ray.intersectObjects([...(V.opt.furn ? [V.furnG] : []), V.archUp, V.archFloor], true);
  for (const h of hits){
    let o = h.object;
    if (o.material === V.glassMat) continue;
    // 沿父级查找门（推拉门玻璃/铝框都可点）
    let cur = o;
    while (cur && cur !== V.scene){
      if (cur.userData.door) return {door: cur.userData.door, dist: h.distance};
      if (cur.userData.room) return {room: cur.userData.room, floor: floorIdxOf(cur)};
      if (cur.userData.fid) return {fid: cur.userData.fid, floor: floorIdxOf(cur)};
      cur = cur.parent;
    }
    return null;                                     // 被墙体挡住
  }
  return null;
}
// 屏幕点 → 地面（y = 0）上的户型坐标 mm；s = 该处每 mm 对应的屏幕像素，用于拖放时的幽灵图大小
const ground0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
export function groundAt(x, y){
  if (!V.active || V.anim) return null;
  const r = V.renderer.domElement.getBoundingClientRect(), hit = new THREE.Vector3();
  ptr.set((x - r.left)/r.width*2 - 1, -(y - r.top)/r.height*2 + 1);
  ray.setFromCamera(ptr, V.camera);
  if (!ray.ray.intersectPlane(ground0, hit) || hit.distanceTo(V.camera.position) > 60) return null;
  // 视线先碰到墙体（或飘窗台）时，落点取碰到的位置，而不是穿过墙落到看不见的墙后
  const wall = ray.intersectObjects([V.archUp, V.archFloor], true).find(h => h.object.material !== V.glassMat && h.object.visible);
  if (wall && wall.distance < hit.distanceTo(V.camera.position) - .01) hit.set(wall.point.x, 0, wall.point.z);
  const px = v => new THREE.Vector2(v.x*r.width/2, v.y*r.height/2), a = px(hit.clone().project(V.camera));
  const s = Math.max(a.distanceTo(px(hit.clone().add(new THREE.Vector3(1, 0, 0)).project(V.camera))),
                     a.distanceTo(px(hit.clone().add(new THREE.Vector3(0, 0, 1)).project(V.camera)))) / 1000;
  return {x:hit.x*1000 + V.OX, y:hit.z*1000 + V.OY, s};
}
export function updateSel(){
  const key = ui.sel?.kind === 'furn' ? ui.sel.id : '';
  if (key !== V.selKey){
    V.selKey = key;
    V.dirty = true;   // 选中框变化需要立刻重绘（按需渲染下静止帧不再每帧绘制）
    if (V.selHelper){ V.scene.remove(V.selHelper); V.selHelper.geometry.dispose(); V.selHelper = null; }
    let g = null; if (key) V.furnG.traverse(o => { if (!g && o.userData?.fid === key) g = o; });
    if (g){ V.selHelper = new THREE.BoxHelper(g, 0xb5653a); V.scene.add(V.selHelper); }
  }
  if (V.selHelper) V.selHelper.update();
}
