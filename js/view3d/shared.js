import * as THREE from 'three';

/** Mutable 3D runtime bag */
export const V = {
  OX: 6000, OY: 5300, H: 2.8, DEFAULT_H: 2.8, FOV: 45,
  opt: {cut: 1.2, cutFull: true, furn: true, labels: true, night: false, hour: 10, mode: 'orbit'},
  cutBeforeWalk: null,
  inited: false, active: false, raf: 0, anim: null, fly: null,
  dirty: true, fountainOn: false,
  renderer: null, labelRenderer: null, scene: null, camera: null, orbit: null, walkCtl: null,
  hemi: null, sun: null, ground: null,
  glassMat: null, wallMat: null, capMat: null, frameMat: null, roofMat: null, ceilMat: null, ceilEdgeMat: null,
  archFloor: null, archUp: null, furnG: null, labelG: null, lampG: null,
  colliders: [], selKey: null, selHelper: null,
  stairZones: [], stairSurfs: [], floorHoles: [], floorYs: [0], colY0: 0, colY1: 2.8,
  sigArch: '', sigFurn: '', sigLabels: '', grow: 1, furnGrow: 1,
  doors: [], keys: {},
  matCache: new Map(), floorMats: {}, wallMats: {},
  envTex: null, envK: 1,
  fixtureLights: [], haloTex: null, haloMat: null,
  touchWalk: false, lookIgnoreUntil: 0,
  joy: {x: 0, y: 0, id: null},
  eul: new THREE.Euler(0, 0, 0, 'YXZ'),
  clock: null,
};

/** Late-bound cross-module calls (filled by main.js) */
export const hooks = {
  sync: null,
  applyLight: null,
  applyGrow: null,
  showLabels: null,
  flyTo: null,
  flyToRoom: null,
  isoWhole: null,
  topWhole: null,
  setMode: null,
  syncModeBtns: null,
  syncCutBtns: null,
  syncWalkTexts: null,
  stopTouchWalk: null,
  startLoop: null,
  pick: null,
  totalBuildingH: null,
  init: null,
  syncRoofOpacity: null,
};

export {THREE};
export const MAX_FIXTURE_LIGHTS = 28;
/** 低端设备启发式：核数 ≤ 4 或内存 ≤ 4GB 时降采样 / 降阴影，保证流畅 */
export const lowEndDevice = () =>
  (navigator.deviceMemory != null && navigator.deviceMemory <= 4) ||
  (navigator.hardwareConcurrency != null && navigator.hardwareConcurrency <= 4);
export function syncOrigin(){
  V.OX = BOUNDS.x + BOUNDS.w / 2;
  V.OY = BOUNDS.y + BOUNDS.h / 2;
}
/** 在「指定楼层已配准」的坐标系里执行 fn：临时把原点切到该层建筑对齐后的位置，
 *  结束后还原。供漫游起点 / 房间飞入等把平面 mm 换算成 3D 世界坐标的场合使用。 */
export function withAlignOrigin(floorIdx, fn){
  const ox = V.OX, oy = V.OY;
  syncOrigin();
  const off = (V.alignOffs && V.alignOffs[floorIdx | 0]) || {x:0, z:0};
  V.OX -= off.x * 1000; V.OY -= off.z * 1000;
  try { return fn(); } finally { V.OX = ox; V.OY = oy; }
}
export const wx = x => (x - V.OX) / 1000;
export const wz = y => (y - V.OY) / 1000;
export const M = v => v / 1000;
export const SW = () => window.$('#stage').clientWidth;
export const SH = () => window.$('#stage').clientHeight;
