/**
 * Split js/view3d.js → js/view3d/*.js
 * Uses V bag + hooks to avoid circular imports.
 * Run: node tools/split_view3d.mjs
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(root, 'js', 'view3d.js');
const outDir = path.join(root, 'js', 'view3d');
const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

const BASE = [
  'labelRenderer','walkCtl','selHelper','selKey','stairZones','floorYs','colY0','colY1',
  'sigArch','sigFurn','sigLabels','furnGrow','fixtureLights','haloTex','haloMat',
  'lookIgnoreUntil','touchWalk','archFloor','archUp','furnG','labelG','lampG',
  'glassMat','wallMat','capMat','frameMat','roofMat','colliders','renderer','scene',
  'camera','orbit','hemi','sun','ground','matCache','floorMats','wallMats','envTex','envK',
  'inited','active','doors','keys','grow','anim','fly','raf','joy','eul','clock','opt',
  'OX','OY',
];
const WITH_H = [...BASE, 'H', 'DEFAULT_H', 'FOV'];

function inString(str, offset){
  const before = str.slice(0, offset);
  const odd = (re) => ((before.match(re) || []).length % 2) === 1;
  return odd(/'/g) || odd(/"/g) || odd(/`/g);
}

function prefix(code, names = WITH_H){
  let out = code;
  for (const name of [...names].sort((a, b) => b.length - a.length)){
    out = out.replace(new RegExp(String.raw`(?<![\w.$])${name}\b`, 'g'), (m, offset, str) =>
      inString(str, offset) ? m : 'V.' + name);
  }
  return out;
}

function exportNames(code, names){
  let out = code;
  for (const n of names){
    out = out.replace(new RegExp(String.raw`(?<!export\s)async function ${n}\b`, 'g'), `export async function ${n}`);
    out = out.replace(new RegExp(String.raw`(?<!export\s)function ${n}\b`, 'g'), `export function ${n}`);
    out = out.replace(new RegExp(String.raw`(?<!export\s)const ${n}\b`, 'g'), `export const ${n}`);
  }
  return out;
}

function write(name, body){
  fs.writeFileSync(path.join(outDir, name), body.replace(/\n{3,}/g, '\n\n'));
  console.log('wrote', name, body.length);
}

fs.mkdirSync(outDir, {recursive: true});

// —— shared ——
write('shared.js', `import * as THREE from 'three';

/** Mutable 3D runtime bag */
export const V = {
  OX: 6000, OY: 5300, H: 2.8, DEFAULT_H: 2.8, FOV: 45,
  opt: {cut: 2.8, furn: true, labels: true, night: false, hour: 10, mode: 'orbit'},
  inited: false, active: false, raf: 0, anim: null, fly: null,
  renderer: null, labelRenderer: null, scene: null, camera: null, orbit: null, walkCtl: null,
  hemi: null, sun: null, ground: null,
  glassMat: null, wallMat: null, capMat: null, frameMat: null, roofMat: null,
  archFloor: null, archUp: null, furnG: null, labelG: null, lampG: null,
  colliders: [], selKey: null, selHelper: null,
  stairZones: [], floorYs: [0], colY0: 0, colY1: 2.8,
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
};

export {THREE};
export const MAX_FIXTURE_LIGHTS = 28;
export function syncOrigin(){
  V.OX = BOUNDS.x + BOUNDS.w / 2;
  V.OY = BOUNDS.y + BOUNDS.h / 2;
}
export const wx = x => (x - V.OX) / 1000;
export const wz = y => (y - V.OY) / 1000;
export const M = v => v / 1000;
export const SW = () => window.$('#stage').clientWidth;
export const SH = () => window.$('#stage').clientHeight;
`);

// —— materials (no H — local forEach(H=>) in painters) ——
let mats = slice(134, 835)
  .replace(/^const matCache = new Map\(\);\s*\n?/m, '')
  .replace(/^let envTex = null, envK = 1;\s*\n?/m, '')
  .replace(/^const floorMats = \{\};\s*\n?/m, '')
  .replace(/^const wallMats = \{\};\s*\n?/m, '');
mats = prefix(mats, BASE);
mats = exportNames(mats, ['mat', 'rng', 'floorMat', 'wallpaperMat']);
mats = mats.replace(/^const TEX = /m, 'export const TEX = ');
mats = mats.replace(/^const rgbK = /m, 'export const rgbK = ');
write('materials.js', `import * as THREE from 'three';
import {V} from './shared.js';

${mats}
`);

// —— geo ——
let geo = slice(838, 933) + '\n' + slice(1030, 1068);
geo = prefix(geo, BASE);
geo = exportNames(geo, [
  'box','rbox','cyl','lathe','rod','blob','ring','rrect','shell','pull','knob','fronts','vase','tableLamp','cabHm'
]);
for (const n of ['asMat','sh','mesh','rot','tube','darker','lighter','legs','metal','chrome','hwMat','blackMetal','mirror','ceramic','fabric','woodM','furnCabMat','screenMat','glowMat','plate','vasePts']){
  geo = geo.replace(new RegExp(String.raw`(?<!export\s)const ${n}\\b`), `export const ${n}`);
}
write('geo.js', `import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {V} from './shared.js';
import {mat} from './materials.js';

${geo}
`);

// —— lamps ——
let lamps = slice(941, 1028);
lamps = prefix(lamps, BASE);
lamps = exportNames(lamps, ['haloTexture','sharedHaloMat','glowBulb','crystalDrop','glassGlobe','lampLight','spotBeam']);
write('lamps.js', `import * as THREE from 'three';
import {V} from './shared.js';
import {mat} from './materials.js';
import {blob, lathe, glowMat} from './geo.js';

${lamps}
`);

// —— furniture ——
let furn = slice(1071, 4347);
furn = furn.replace(
  /\s*\/\/ 楼梯升高跟随当前层高（合层时对接上层楼板）\s*\n\s*const stairH = Math\.max\(2\.2, Math\.min\(4\.0, H \|\| DEFAULT_H\)\);\s*\n/,
  '\n'
);
furn = prefix(furn, WITH_H);
furn = exportNames(furn, ['buildFurniture']);
write('furniture.js', `import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {V, wx, wz, M} from './shared.js';
import {mat, rng} from './materials.js';
import {
  asMat, mesh, rot, box, rbox, cyl, lathe, rod, tube, blob, ring, shell,
  darker, lighter, legs, metal, chrome, hwMat, blackMetal, mirror, ceramic,
  fabric, woodM, furnCabMat, cabHm, screenMat, glowMat, pull, knob, fronts,
  vase, tableLamp, plate
} from './geo.js';
import {glowBulb, crystalDrop, glassGlobe, lampLight, spotBeam} from './lamps.js';

${furn}
`);

// —— lighting ——
let light = slice(5178, 5215);
light = prefix(light, WITH_H);
light = exportNames(light, ['applyLight']);
write('lighting.js', `import * as THREE from 'three';
import {V, MAX_FIXTURE_LIGHTS} from './shared.js';

${light}
`);

// —— arch: replace flyTo/flyToRoom/setMode/applyLight with hooks ——
let arch = slice(4350, 5175);
arch = prefix(arch, WITH_H);
// room list click handlers use flyTo / setMode / isoWhole — rewrite to hooks
arch = arch.replace(
  /if \(opt\.mode === 'walk'\) setMode\('orbit'\);\s*\n\s*if \(b\.dataset\.room === '__all'\) flyTo\(isoWhole\(\)\);\s*\n\s*else flyToRoom\(b\.dataset\.room\.split\('@'\)\[0\], \+b\.dataset\.floor \|\| 0\);/g,
  `if (V.opt.mode === 'walk') hooks.setMode('orbit');
    if (b.dataset.room === '__all') hooks.flyTo(hooks.isoWhole());
    else hooks.flyToRoom(b.dataset.room.split('@')[0], +b.dataset.floor || 0);`
);
// also older pattern without V.opt already prefixed
arch = arch.replace(/\bsetMode\(/g, 'hooks.setMode(');
arch = arch.replace(/\bflyToRoom\(/g, 'hooks.flyToRoom(');
arch = arch.replace(/\bflyTo\(/g, 'hooks.flyTo(');
arch = arch.replace(/\bisoWhole\(/g, 'hooks.isoWhole(');
arch = arch.replace(/\bapplyLight\(/g, 'hooks.applyLight(');
// fix double hooks.hooks
arch = arch.replace(/hooks\.hooks\./g, 'hooks.');
arch = exportNames(arch, [
  'clearGroup','wallPointInPoly','wallDistToPoly','wallRoomAt','scaleWallUV','wallFaceInfo',
  'addWallSkirting','wallBox','shapeOf','rectAlongWall','openingBelongsToWall','winOpeningsOnWall',
  'fenceMats','addFencePillar','resetFencePosts','claimFencePost','flushFencePosts','buildFenceBox',
  'wallSegmentsExcludingOpens','addCollider','pushWallSegmentColliders','buildWallWithOpenings',
  'buildArch','buildArchContent','buildFurn','buildLabels','showLabels','applyGrow','sync'
]);
// sync may be after applyGrow in original - check if sync is in this slice
if (!/\bfunction sync\b|\bexport function sync\b/.test(arch)){
  // sync is at 5154 area - include it
}
write('arch.js', `import * as THREE from 'three';
import {CSS2DObject} from 'three/addons/renderers/CSS2DRenderer.js';
import {V, hooks, syncOrigin, wx, wz, M} from './shared.js';
import {mat, floorMat, wallpaperMat} from './materials.js';
import {box, rbox, mesh} from './geo.js';
import {buildFurniture} from './furniture.js';

${arch}
`);

// —— camera (pose through updateSel); use hooks for sync/setMode/startLoop ——
let cam = slice(5217, 5386);
cam = prefix(cam, WITH_H);
cam = cam.replace(/\bsync\(/g, 'hooks.sync(');
cam = cam.replace(/\bapplyGrow\(/g, 'hooks.applyGrow(');
cam = cam.replace(/\bshowLabels\(/g, 'hooks.showLabels(');
cam = cam.replace(/\bsetMode\(/g, 'hooks.setMode(');
cam = cam.replace(/\bsyncModeBtns\(/g, 'hooks.syncModeBtns(');
cam = cam.replace(/\bstopTouchWalk\(/g, 'hooks.stopTouchWalk(');
cam = cam.replace(/\bstartLoop\(/g, 'hooks.startLoop(');
cam = cam.replace(/hooks\.hooks\./g, 'hooks.');
cam = exportNames(cam, [
  'ease','clamp01','pose','planPose','isoFrom','totalBuildingH','isoWhole','topWhole','curPose',
  'camTween','setPose','animate','wait','flyTo','flyToRoom','enter','exit','pick','groundAt','updateSel'
]);
write('camera.js', `import * as THREE from 'three';
import {V, hooks, wx, wz, M, SW, SH} from './shared.js';

${cam}
`);

// —— walk ——
let walk = slice(5388, 5615);
walk = prefix(walk, WITH_H);
walk = walk.replace(/\bsync\(/g, 'hooks.sync(');
walk = walk.replace(/\bsyncCutBtns\(/g, 'hooks.syncCutBtns(');
walk = walk.replace(/\bflyTo\(/g, 'hooks.flyTo(');
walk = walk.replace(/\bisoWhole\(/g, 'hooks.isoWhole(');
walk = walk.replace(/\btotalBuildingH\(/g, 'hooks.totalBuildingH(');
walk = walk.replace(/\bpick\(/g, 'hooks.pick(');
walk = walk.replace(/hooks\.hooks\./g, 'hooks.');
walk = exportNames(walk, [
  'HINT_ORBIT','HINT_TOUCHWALK','HINT_WALK','syncHint3d','applyLook','onWalkLook','lookBy',
  'startTouchWalk','stopTouchWalk','bindJoystick','walkSpawnPose','setMode',
  'syncRoofOpacity','eyeFloorBand','blocked','stairEyeY','stepWalk'
]);
write('walk.js', `import * as THREE from 'three';
import {V, hooks, wx, wz, M} from './shared.js';

${walk}
`);

// Check sync location
const syncLine = lines.findIndex(l => /^function sync\(/.test(l)) + 1;
console.log('sync at line', syncLine);
const applyGrowLine = lines.findIndex(l => /^function applyGrow\(/.test(l)) + 1;
console.log('applyGrow at', applyGrowLine, 'showLabels', lines.findIndex(l => /^function showLabels\(/.test(l)) + 1);

console.log('Done core modules. Next: main.js from remaining parts.');
