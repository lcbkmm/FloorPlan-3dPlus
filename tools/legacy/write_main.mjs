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
  'OX','OY','H','DEFAULT_H','FOV',
];

function inString(str, offset){
  const before = str.slice(0, offset);
  const odd = (re) => ((before.match(re) || []).length % 2) === 1;
  return odd(/'/g) || odd(/"/g) || odd(/`/g);
}
function prefix(code){
  let out = code;
  for (const name of [...BASE].sort((a, b) => b.length - a.length)){
    out = out.replace(new RegExp(String.raw`(?<![\w.$])${name}\b`, 'g'), (m, offset, str) =>
      inString(str, offset) ? m : 'V.' + name);
  }
  return out;
}
function exportNames(code, names){
  let out = code;
  for (const n of names){
    out = out.replace(new RegExp(String.raw`(?<!export\s)function ${n}\b`, 'g'), `export function ${n}`);
    out = out.replace(new RegExp(String.raw`(?<!export\s)const ${n}\b`, 'g'), `export const ${n}`);
  }
  return out;
}

let initBody = slice(30, 131);
initBody = prefix(initBody);
initBody = initBody
  .replace(/\bhost\b/g, (m, o, s) => inString(s, o) ? m : 'hostEl')
  .replace(/\bstage\b/g, (m, o, s) => {
    if (inString(s, o)) return m;
    // ResizeObserver observe(stage) / stage.clientWidth already SW/SH
    return 'stageEl';
  });
// host was $('#view3d') / stage was $('#stage') — restore properly
initBody = initBody
  .replace(/hostEl\.prepend/g, 'hostEl.prepend')
  .replace(/hostEl\.addEventListener/g, 'hostEl.addEventListener')
  .replace(/hostEl\.appendChild/g, 'hostEl.appendChild')
  .replace(/\.observe\(stageEl\)/g, '.observe(stageEl)');

// Manual cleaner init rewrite — rewrite init from scratch to avoid host/stage mess
const initFn = `export function init(){
  if (V.inited) return; V.inited = true;
  const stageEl = window.$('#stage'), hostEl = window.$('#view3d');
  V.renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
  V.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  V.renderer.setSize(SW(), SH());
  V.renderer.shadowMap.enabled = true; V.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  V.renderer.toneMapping = THREE.ACESFilmicToneMapping; V.renderer.toneMappingExposure = 1.05;
  hostEl.prepend(V.renderer.domElement);
  V.labelRenderer = new CSS2DRenderer();
  V.labelRenderer.setSize(SW(), SH());
  Object.assign(V.labelRenderer.domElement.style, {position:'absolute', inset:'0', pointerEvents:'none'});
  hostEl.appendChild(V.labelRenderer.domElement);

  V.scene = new THREE.Scene();
  V.camera = new THREE.PerspectiveCamera(V.FOV, SW()/SH(), .05, 300);
  V.orbit = new OrbitControls(V.camera, V.renderer.domElement);
  V.orbit.enableDamping = true; V.orbit.screenSpacePanning = true;
  V.orbit.maxPolarAngle = Math.PI * .495; V.orbit.minDistance = .25; V.orbit.maxDistance = 45;
  V.walkCtl = new PointerLockControls(V.camera, document.body);
  V.walkCtl.pointerSpeed = 0;
  V.walkCtl.addEventListener('lock', () => {
    V.lookIgnoreUntil = performance.now() + 140;
    $('#walkOverlay').style.display = 'none'; $('#cross').style.display = 'block';
  });
  V.walkCtl.addEventListener('unlock', () => {
    if (V.opt.mode === 'walk'){ $('#walkOverlay').style.display = 'flex'; $('#cross').style.display = 'none'; }
  });
  document.addEventListener('mousemove', onWalkLook);

  V.hemi = new THREE.HemisphereLight(0xfff8ee, 0xb9a88f, 1.1);
  V.sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
  V.sun.castShadow = true; V.sun.shadow.mapSize.setScalar(COARSE ? 2048 : 4096);
  Object.assign(V.sun.shadow.camera, {left:-11, right:11, top:11, bottom:-11, near:1, far:60});
  V.sun.shadow.bias = -0.0004; V.sun.shadow.normalBias = 0.02;
  V.ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({color:0xf2eee7, roughness:1}));
  V.ground.rotation.x = -Math.PI/2; V.ground.position.y = -0.015; V.ground.receiveShadow = true;
  V.scene.add(V.hemi, V.sun, V.sun.target, V.ground);

  const pm = new THREE.PMREMGenerator(V.renderer);
  V.envTex = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  V.glassMat = new THREE.MeshPhysicalMaterial({color:0xcfe6ef, roughness:.05, transparent:true, opacity:.28, depthWrite:false, side:THREE.DoubleSide});
  V.wallMat = wallpaperMat('plain'); V.capMat = mat('#34312d', {roughness:.9}); V.frameMat = mat('#5d6166', {roughness:.5, metalness:.4});

  V.archFloor = new THREE.Group(); V.archUp = new THREE.Group(); V.furnG = new THREE.Group(); V.labelG = new THREE.Group(); V.lampG = new THREE.Group();
  V.scene.add(V.archFloor, V.archUp, V.furnG, V.labelG, V.lampG);

  const cv = V.renderer.domElement; let downAt = null, look = null;
  cv.addEventListener('pointerdown', e => {
    downAt = [e.clientX, e.clientY]; window.closeDrawers();
    if (V.touchWalk && !look){ look = {id:e.pointerId, x:e.clientX, y:e.clientY}; cv.setPointerCapture(e.pointerId); }
  });
  cv.addEventListener('pointermove', e => {
    if (!look || e.pointerId !== look.id) return;
    lookBy(e.clientX - look.x, e.clientY - look.y); look.x = e.clientX; look.y = e.clientY;
  });
  cv.addEventListener('pointercancel', e => { if (look?.id === e.pointerId) look = null; });

  let fdrag = null;
  hostEl.addEventListener('pointerdown', e => {
    if (e.target !== cv || !e.isPrimary || V.anim || V.opt.mode !== 'orbit' || ui.sel?.kind !== 'furn') return;
    const h = pick(e), f = h?.fid === ui.sel.id && getF(h.fid), g = f && groundAt(e.clientX, e.clientY);
    if (!g) return;
    fdrag = {id:f.id, pid:e.pointerId, sx:e.clientX, sy:e.clientY, ox:g.x - f.cx, oy:g.y - f.cy, before:snap(), moved:false};
    V.orbit.enabled = false; V.fly = null; cv.setPointerCapture(e.pointerId);
  }, true);
  cv.addEventListener('pointermove', e => {
    if (!fdrag || e.pointerId !== fdrag.pid) return;
    if (!fdrag.moved && Math.hypot(e.clientX - fdrag.sx, e.clientY - fdrag.sy) < TAP) return;
    const f = getF(fdrag.id), g = groundAt(e.clientX, e.clientY); if (!f || !g) return;
    fdrag.moved = true; cv.style.cursor = 'grabbing';
    [f.cx, f.cy] = snapMove(f, g.x - fdrag.ox, g.y - fdrag.oy);
    let fo = null; V.furnG.traverse(o => { if (!fo && o.userData?.fid === f.id) fo = o; });
    fo?.position.set(wx(f.cx), 0, wz(f.cy));
  });
  const endF = e => {
    if (!fdrag || e.pointerId !== fdrag.pid) return;
    const d = fdrag; fdrag = null; V.orbit.enabled = true; cv.style.cursor = '';
    if (d.moved){ commit(d.before); renderAll(); }
  };
  cv.addEventListener('pointerup', endF); cv.addEventListener('pointercancel', endF);

  cv.addEventListener('pointerup', e => {
    const tap = downAt && Math.hypot(e.clientX-downAt[0], e.clientY-downAt[1]) <= TAP;
    if (look?.id === e.pointerId){
      look = null;
      if (tap){ const h = pick(e); if (h?.door && h.dist < 3.5) h.door.open = !h.door.open; }
      return;
    }
    if (V.anim || V.opt.mode !== 'orbit' || !tap) return;
    const h = pick(e);
    if (h?.door) h.door.open = !h.door.open;
    else if (h?.fid) window.select({kind:'furn', id:h.fid});
    else if (h?.room){ window.select({kind:'room', id:h.room}); flyToRoom(h.room); }
    else window.select(null);
  });
  new ResizeObserver(() => {
    V.renderer.setSize(SW(), SH()); V.labelRenderer.setSize(SW(), SH());
    V.camera.aspect = SW()/SH(); V.camera.updateProjectionMatrix();
  }).observe(stageEl);
  bindUI();
}
`;

let toolbar = slice(5617, 5648);
toolbar = prefix(toolbar);
toolbar = exportNames(toolbar, ['syncModeBtns','syncCutBtns','syncWalkTexts','bindUI']);

let loopBody = slice(5650, 5713);
loopBody = prefix(loopBody);
loopBody = loopBody.replace(/^const clock = new THREE\.Clock\(\);\s*\n/m, 'V.clock = new THREE.Clock();\n');
loopBody = exportNames(loopBody, ['startLoop','loop','tickFountainFx','shot','relang']);
// fix furnG.children — fountain fx: originally traversed furnG.children but with floor groups need traverse
loopBody = loopBody.replace(
  /V\.furnG\.children\.forEach\(g => \{/,
  `V.furnG.traverse(g => { if (!g.isGroup || !g.userData) return; // floor subgroups
    const _g = g; void _g;
  }); /* patched below */ V.furnG.traverse(g => {`
);
// That made a mess — rewrite tickFountainFx simply
loopBody = loopBody.replace(/export function tickFountainFx\(t\)\{[\s\S]*?\n\}/, `export function tickFountainFx(t){
  if (!V.furnG) return;
  V.furnG.traverse(g => {
    if (g.userData.fx !== 'fountain' || !g.userData.fxParts) return;
    const {jet, crown, drops, streams, poolLo, poolMid, r, jetY0 = 1.24} = g.userData.fxParts;
    const pulse = .5 + .5 * Math.sin(t * 2.8);
    if (jet?.material) jet.material.opacity = .35 + pulse * .3;
    if (crown){
      crown.position.y = jetY0 + .32 + pulse * .05;
      if (crown.material) crown.material.opacity = .3 + pulse * .28;
    }
    drops.forEach(drop => {
      const u = (t * .7 + drop.userData.phase) % 1;
      const a = drop.userData.phase * Math.PI * 2;
      const fall = u * u;
      drop.position.set(
        Math.cos(a + t * .5) * fall * r * .35,
        jetY0 + .3 - fall * .95,
        Math.sin(a + t * .5) * fall * r * .35
      );
      if (drop.material) drop.material.opacity = Math.max(0, .5 * (1 - u));
    });
    streams.forEach(s => {
      if (s.material) s.material.opacity = .25 + .2 * Math.sin(t * 3.5 + s.userData.phase * 7);
    });
    if (poolLo?.material) poolLo.material.opacity = .4 + .07 * Math.sin(t * 1.8);
    if (poolMid?.material) poolMid.material.opacity = .42 + .08 * Math.sin(t * 2.2 + 1);
  });
}`);

const main = `import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {CSS2DRenderer} from 'three/addons/renderers/CSS2DRenderer.js';
import {V, hooks, wx, wz, SW, SH, syncOrigin} from './shared.js';
import {mat, wallpaperMat} from './materials.js';
import {sync, buildArch, buildFurn, buildLabels, showLabels, applyGrow} from './arch.js';
import {applyLight} from './lighting.js';
import {
  ease, clamp01, enter, exit, pick, groundAt, updateSel, flyTo, flyToRoom,
  isoWhole, topWhole, camTween, totalBuildingH
} from './camera.js';
import {
  onWalkLook, lookBy, setMode, stepWalk, bindJoystick, startTouchWalk, stopTouchWalk,
  syncHint3d, syncRoofOpacity
} from './walk.js';

syncOrigin();

${initFn}

${toolbar}

${loopBody}

/** Wire late-bound hooks (breaks circular imports) */
Object.assign(hooks, {
  sync, applyLight, applyGrow, showLabels,
  flyTo, flyToRoom, isoWhole, topWhole, totalBuildingH,
  setMode,
  syncModeBtns, syncCutBtns, syncWalkTexts, stopTouchWalk,
  startLoop, pick,
});

window.View3D = {
  enter, exit, relang,
  sync: () => sync(),
  shot,
  groundAt,
  flyToRoom: id => V.active && !V.anim && flyToRoom(id),
  walking: () => V.active && V.opt.mode === 'walk',
};
`;

fs.writeFileSync('js/view3d/main.js', main);
console.log('main.js written', main.length);

// thin entry
fs.writeFileSync('js/view3d.js', `/* 3D entry — implementation in js/view3d/ */
import './view3d/main.js';
`);
console.log('entry js/view3d.js → ./view3d/main.js');
