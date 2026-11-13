import * as THREE from 'three';
import {V, MAX_FIXTURE_LIGHTS} from './shared.js';

export function applyLight(){
  const t = (V.opt.hour - 6) / 12, az = Math.PI * (.15 + t*.7), el = Math.sin(Math.PI*t) * 1.05 + .15, warm = 1 - Math.sin(Math.PI*t);
  V.sun.position.set(Math.cos(az)*18, Math.sin(el)*20 + 3, -Math.sin(az)*10 + 8); V.sun.target.position.set(0, 0, 0);
  V.sun.color.setHSL(.09, .5 + warm*.4, .92 - warm*.12);
  V.sun.intensity = V.opt.night ? .05 : 1.4 + Math.sin(Math.PI*t)*1.6;
  V.hemi.intensity = V.opt.night ? .12 : 1.1;
  // 漫游时抬头能直接看到天空：淡蓝背景让「露天花园 / 挑空中庭」一眼可辨，
  // 也与室内乳白天花板明确区分；鸟瞰 / 环视沿用原来的米白画布底色。
  const sky = V.opt.night ? 0x1c2130 : (V.opt.mode === 'walk' ? 0xd8e7f3 : 0xf7f4ee);
  V.scene.background = new THREE.Color(sky);
  V.ground.material.color.set(V.opt.night ? 0x2a2e38 : 0xf2eee7);
  // 房间基础吸顶灯：夜景时只留柔和底光，把主要照明交给家具灯具
  V.lampG.children.forEach(o => {
    if (o.isPointLight){ o.intensity = V.opt.night ? 1.5 : 0; return; }
    const em = V.opt.night ? 1.6 : .3;
    const m = o.material;
    if (Array.isArray(m)) m.forEach(x => { if (x) x.emissiveIntensity = em; });
    else if (m) m.emissiveIntensity = em;
    // 灯具容器（Group）没有 material，跳过即可
  });
  // 灯具自发光：灯罩 / 灯泡 / 灯带在夜景整体提亮
  V.matCache.forEach(m => { if (m.userData.glowBase != null) m.emissiveIntensity = V.opt.night ? m.userData.glowBase * 3.4 : m.userData.glowBase; });
  // 用户单独调过亮度 / 色温的灯具发光材质（每盏独立克隆，不在 matCache）
  if (V.lampGlowMats) V.lampGlowMats.forEach(m => {
    if (m.userData.glowBase != null)
      m.emissiveIntensity = (V.opt.night ? m.userData.glowBase * 3.4 : m.userData.glowBase) * (m.userData.lampBright != null ? m.userData.lampBright : 1);
  });
  if (V.haloMat) V.haloMat.opacity = V.opt.night ? .42 : .04;
  // 灯具真实光源：按主次优先级取前 N 盏，避免 WebGL 光源数量过多拖慢渲染
  const ranked = V.fixtureLights.slice().sort((a, b) => (b.userData.fixtureSpec.priority || 0) - (a.userData.fixtureSpec.priority || 0));
  ranked.forEach((l, i) => {
    const on = V.opt.night && V.opt.furn && i < MAX_FIXTURE_LIGHTS;
    l.visible = on;
    l.intensity = on ? l.userData.fixtureSpec.intensity : 0;
    if (on && l.isSpotLight && l.target) l.target.updateMatrixWorld();
  });
  // 射灯光锥：仅夜景显示
  if (V.furnG) V.furnG.traverse(o => {
    if (!o.userData || !o.userData.spotBeam) return;
    const on = !!(V.opt.night && V.opt.furn);
    o.visible = on;
    if (o.material){
      o.material.opacity = on ? .14 : .03;
      o.material.emissiveIntensity = on ? .7 : .08;
    }
  });
  V.renderer.toneMappingExposure = V.opt.night ? 1.12 : 1.05;
  // 乳白天花：底面没有直射光，白天适度补光保持柔和乳白；夜景压低，避免白得刺眼
  if (V.ceilMat) V.ceilMat.emissiveIntensity = V.opt.night ? .22 : .5;
  if (V.ceilEdgeMat) V.ceilEdgeMat.emissiveIntensity = V.opt.night ? .18 : .42;
  V.envK = V.opt.night ? .15 : 1;
  V.matCache.forEach(m => { if (m.envMap) m.envMapIntensity = m.userData.env * V.envK; });
  Object.values(V.floorMats).forEach(m => { if (m.envMap) m.envMapIntensity = (m.userData.env || .4) * V.envK; });
  const h = Math.floor(V.opt.hour), m = Math.round((V.opt.hour - h)*60);
  $('#sunT').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  V.dirty = true;   // 光照 / 昼夜变化需要重绘
}
