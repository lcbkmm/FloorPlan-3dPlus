import fs from 'fs';

const lines = fs.readFileSync('js/view3d.js', 'utf8').split(/\r?\n/);
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

function inString(str, offset){
  const before = str.slice(0, offset);
  const odd = (re) => ((before.match(re) || []).length % 2) === 1;
  return odd(/'/g) || odd(/"/g) || odd(/`/g);
}
function prefix(code, names){
  let out = code;
  for (const name of [...names].sort((a, b) => b.length - a.length)){
    out = out.replace(new RegExp(String.raw`(?<![\w.$])${name}\b`, 'g'), (m, offset, str) =>
      inString(str, offset) ? m : 'V.' + name);
  }
  return out;
}

// —— furniture without H prefix ——
let furn = slice(1071, 4347);
furn = furn.replace(
  /\s*\/\/ 楼梯升高跟随当前层高（合层时对接上层楼板）\s*\n\s*const stairH = Math\.max\(2\.2, Math\.min\(4\.0, H \|\| DEFAULT_H\)\);\s*\n/,
  '\n'
);
furn = prefix(furn, BASE);
furn = furn.replace(
  /(case 'stairs': \{[\s\S]*?const treadM = woodL, riserM = wood, beamM = woodD, railM = woodD, newelM = wood;)/,
  `$1\n      const H = Math.max(2.2, Math.min(4.0, V.H || 2.8));`
);
furn = furn.replace(/^function buildFurniture\b/m, 'export function buildFurniture');

const furnHeader = `import * as THREE from 'three';
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

`;
fs.writeFileSync('js/view3d/furniture.js', furnHeader + furn);
console.log('furniture OK', !/const V\.H/.test(furn), /case 'stairs':[\s\S]{0,500}const H = Math.max/.test(furn));

// —— fix arch scaleWallUV ——
let arch = fs.readFileSync('js/view3d/arch.js', 'utf8');
arch = arch.replace(
  /export function scaleWallUV\(geo, W, V\.H, D\)\{[\s\S]*?uv\.needsUpdate = true;\n\}/,
  `export function scaleWallUV(geo, W, H, D){
  const uv = geo.attributes && geo.attributes.uv;
  if (!uv || uv.count !== 24) return;
  const faces = [[D,H],[D,H],[W,D],[W,D],[W,H],[W,H]];
  for (let f = 0; f < 6; f++){
    const [uw, vh] = faces[f];
    for (let k = 0; k < 4; k++){
      const i = f*4 + k;
      uv.setXY(i, uv.getX(i) * uw, uv.getY(i) * vh);
    }
  }
  uv.needsUpdate = true;
}`
);
fs.writeFileSync('js/view3d/arch.js', arch);
console.log('arch scaleWallUV', arch.match(/function scaleWallUV\([^)]+\)/)?.[0]);

// —— ensure geo exports ——
let geo = fs.readFileSync('js/view3d/geo.js', 'utf8');
for (const n of ['asMat','sh','mesh','rot','tube','darker','lighter','legs','metal','chrome','hwMat','blackMetal','mirror','ceramic','fabric','woodM','furnCabMat','screenMat','glowMat','plate','vasePts']){
  geo = geo.replace(new RegExp(`(?<!export )const ${n} =`), `export const ${n} =`);
}
fs.writeFileSync('js/view3d/geo.js', geo);
console.log('geo asMat', /export const asMat/.test(geo), 'tube', /export const tube/.test(geo));
