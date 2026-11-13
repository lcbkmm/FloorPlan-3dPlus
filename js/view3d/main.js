import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {CSS2DRenderer} from 'three/addons/renderers/CSS2DRenderer.js';
import {V, hooks, wx, wz, SW, SH, syncOrigin, lowEndDevice} from './shared.js';
import {mat, wallpaperMat} from './materials.js';
import {sync, buildArch, buildFurn, buildLabels, showLabels, applyGrow} from './arch.js';
import {applyLight} from './lighting.js';
import {applyLampSettings} from './furniture.js';
import {
  ease, clamp01, enter, exit, pick, groundAt, updateSel, flyTo, flyToRoom,
  isoWhole, topWhole, camTween, totalBuildingH
} from './camera.js';
import {
  onWalkLook, lookBy, setMode, stepWalk, bindJoystick, startTouchWalk, stopTouchWalk,
  syncHint3d, syncRoofOpacity
} from './walk.js';
// syncRoofOpacity wired via hooks for arch.js

syncOrigin();

export function init(){
  if (V.inited) return; V.inited = true;
  const stageEl = window.$('#stage'), hostEl = window.$('#view3d');
  V.renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
  V.renderer.setPixelRatio(Math.min(devicePixelRatio, lowEndDevice() ? 1.5 : 2));
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
  // 相机任何变化都要求重绘；静止（阻尼归零）时按需渲染会自动停帧，大幅降低 GPU 占用
  V.orbit.addEventListener('change', () => { V.dirty = true; });
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
    V.dirty = true;   // 按需渲染下，拖动家具需要立即重绘
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
    else if (h?.fid){
      if (Number.isFinite(h.floor) && h.floor !== (state.activeFloor|0) && typeof switchFloor === 'function')
        switchFloor(h.floor, {silent:true});
      window.select({kind:'furn', id:h.fid});
    }
    else if (h?.room){ window.select({kind:'room', id:h.room}); flyToRoom(h.room, h.floor); }
    else window.select(null);
  });
  new ResizeObserver(() => {
    V.renderer.setSize(SW(), SH()); V.labelRenderer.setSize(SW(), SH());
    V.camera.aspect = SW()/SH(); V.camera.updateProjectionMatrix();
    V.dirty = true;   // 画布尺寸变化需要重绘
  }).observe(stageEl);
  bindUI();
}


/* ======================= 工具栏 ======================= */
export function syncModeBtns(){ document.querySelectorAll('#modes3d .btn').forEach(b => b.classList.toggle('on', b.dataset.mode === V.opt.mode)); }
export function syncCutBtns(){
  document.querySelectorAll('[data-cut]').forEach(b => {
    const full = b.dataset.cut === 'full';
    b.classList.toggle('on', full ? !!V.opt.cutFull : (!V.opt.cutFull && +b.dataset.cut === V.opt.cut));
  });
}
export function syncWalkTexts(){
  const t = COARSE
    ? [tr('点击开始，从入户门进入', 'Tap to start at the front door'), tr('左下摇杆移动 · 在画面上拖动转向', 'Joystick moves · drag on screen to look'),
       tr('点门开关 · 点「退出漫游」回到鸟瞰', 'Tap doors to open · "Exit walk" returns to orbit')]
    : [tr('点击开始，从入户门进入', 'Click to start at the front door'),
       tr('<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> 移动 · 鼠标转向 · <kbd>Shift</kbd> 快走', '<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move · mouse looks · <kbd>Shift</kbd> runs'),
       tr('<kbd>E</kbd> 开关正前方的门 · <kbd>Esc</kbd> 暂停', '<kbd>E</kbd> opens the door ahead · <kbd>Esc</kbd> pauses')];
  t.forEach((h, i) => $('#wo' + (i + 1)).innerHTML = h);
  syncHint3d();
}
export function bindUI(){
  document.querySelectorAll('#modes3d .btn').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  // 触屏设备用摇杆漫游；桌面端锁定鼠标，锁定失败时也退回到摇杆
  $('#walkOverlay').onclick = () => COARSE ? startTouchWalk() : V.walkCtl.lock();
  document.addEventListener('pointerlockerror', () => { if (V.active && V.opt.mode === 'walk') startTouchWalk(); });
  $('#walkExit').onclick = () => setMode('orbit');
  bindJoystick();
  syncWalkTexts();
  $('#vIso').onclick = () => { if (V.opt.mode === 'walk') setMode('orbit'); else flyTo(isoWhole()); };
  $('#vTop').onclick = () => { if (V.opt.mode === 'walk') setMode('orbit'); flyTo(topWhole()); };
  document.querySelectorAll('[data-cut]').forEach(b => b.onclick = () => {
    if (V.opt.mode === 'walk') return;
    if (b.dataset.cut === 'full') V.opt.cutFull = true;
    else { V.opt.cutFull = false; V.opt.cut = +b.dataset.cut; }
    syncCutBtns(); sync(true);
  });
  document.querySelectorAll('#toggles3d .btn').forEach(b => b.onclick = () => {
    const k = b.dataset.t; V.opt[k] = !V.opt[k]; b.classList.toggle('on', V.opt[k]);
    if (k === 'furn'){ V.furnG.visible = V.opt.furn; if (!V.opt.furn && ui.sel?.kind === 'furn') window.select(null); V.dirty = true; }
    if (k === 'labels') showLabels(V.opt.labels && V.opt.mode === 'orbit' && !V.anim);
    if (k === 'night') applyLight();
  });
  $('#sun').oninput = e => { V.opt.hour = +e.target.value; applyLight(); };
}

/* ======================= 主循环 ======================= */
V.clock = new THREE.Clock();
export function startLoop(){ if (!V.raf){ V.clock.getDelta(); V.raf = requestAnimationFrame(loop); } }
export function loop(){
  V.raf = requestAnimationFrame(loop);
  const dt = Math.min(V.clock.getDelta(), .05), now = performance.now();
  const wasAnimating = !!(V.anim || V.fly);   // 动画结束的那一帧也要渲染，保证停在精确最终姿态
  if (V.anim){ const t = clamp01((now - V.anim.t0)/V.anim.dur); V.anim.fn(t); if (t >= 1){ const r = V.anim.res; V.anim = null; r(); } }
  else if (V.fly){ const t = clamp01((now - V.fly.t0)/V.fly.dur); camTween(V.fly.A, V.fly.B, ease(t)); if (t >= 1) V.fly = null; }
  else if (V.opt.mode === 'orbit') V.orbit.update();
  else stepWalk(dt);

  // 门开合动画：有位移才需要重绘
  let doorsMoving = false;
  V.doors.forEach(d => {
    if (d.slide){
      const tg = d.open ? 1 : 0;
      if (Math.abs(tg - d.cur) > .001) doorsMoving = true;
      d.cur += (tg - d.cur) * Math.min(1, dt * 5);
      d.panels.forEach(p => {
        const along = p.closed + (p.openPos - p.closed) * d.cur;
        if (d.v) p.g.position.z = along; else p.g.position.x = along;
      });
    } else {
      const tg = d.open ? d.a1 : d.a0;
      if (Math.abs(tg - d.cur) > .001) doorsMoving = true;
      d.cur += (tg - d.cur) * Math.min(1, dt * 6);
      d.pivot.rotation.y = d.cur;
    }
  });
  if (V.fountainOn) tickFountainFx(now * .001);
  updateSel();

  // 按需渲染：漫游 / 相机动画 / 拖拽 / 门开合 / 喷泉 / 选中变化时才真正渲染，
  // 画面静止时跳过 GPU 绘制，大幅降低空转功耗与掉帧。
  if (wasAnimating || V.anim || V.fly || V.opt.mode === 'walk' || doorsMoving || V.fountainOn || V.dirty){
    V.dirty = false;
    V.renderer.render(V.scene, V.camera);
    V.labelRenderer.render(V.scene, V.camera);
  }
}

export function tickFountainFx(t){
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
}

export function shot(){ const a = document.createElement('a'); a.download = tr('户型装修方案', 'floor-plan-design') + '-3D.png'; a.href = V.renderer.domElement.toDataURL('image/png'); a.click(); }

export function relang(){ syncWalkTexts(); if (V.inited) buildLabels(); }

/** Wire late-bound hooks (breaks circular imports) */
Object.assign(hooks, {
  sync, applyLight, applyGrow, showLabels,
  flyTo, flyToRoom, isoWhole, topWhole, totalBuildingH,
  setMode,
  syncModeBtns, syncCutBtns, syncWalkTexts, stopTouchWalk,
  startLoop, pick, init, syncRoofOpacity,
});

window.View3D = {
  enter, exit, relang,
  sync: (force) => sync(force),
  shot,
  groundAt,
  flyToRoom: (id, floor) => V.active && !V.anim && flyToRoom(id, floor),
  walking: () => V.active && V.opt.mode === 'walk',
  // 面板调节灯具亮度 / 色温后实时刷新该灯具的光源与发光材质（无需整体重建）
  applyLamp: id => {
    if (!V.furnG) return;
    const f = getF(id);
    if (!f) return;
    V.furnG.traverse(o => { if (o.userData.fid === id) applyLampSettings(f, o); });
    applyLight();
    V.dirty = true;
  },
};
