import * as THREE from 'three';
import {V} from './shared.js';
import {mat} from './materials.js';
import {blob, lathe, glowMat} from './geo.js';

export function haloTexture(){
  if (V.haloTex) return V.haloTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(.18, 'rgba(255,244,214,.85)');
  gr.addColorStop(.42, 'rgba(255,215,150,.32)');
  gr.addColorStop(.72, 'rgba(255,196,120,.07)');
  gr.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
  V.haloTex = new THREE.CanvasTexture(cv);
  return V.haloTex;
}
// 所有光晕共用一个材质，切换夜景时只改一次 opacity
export function sharedHaloMat(){
  if (!V.haloMat) V.haloMat = new THREE.SpriteMaterial({map:haloTexture(), transparent:true, opacity:0,
    blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false});
  return V.haloMat;
}
/** 灯泡 / 发光核 + 柔和光晕。o: {cool, halo, tall} */
export function glowBulb(g, x, y, z, r = .025, o = {}){
  const m = glowMat(o.cool ? '#f2f7ff' : '#fff7e6', o.cool ? '#c9dcff' : '#ffdca0', 1.1);
  const b = blob(r, r * (o.tall || 1.2), r, m, x, y, z, 14); b.castShadow = false; g.add(b);
  const s = new THREE.Sprite(sharedHaloMat());
  const hs = o.halo || .34;
  s.position.set(x, y, z); s.scale.set(hs, hs, 1); g.add(s);
  return m;
}
/** 水晶 / 玻璃垂饰 */
export function crystalDrop(g, x, y, z, h = .1, r = .013){
  const cm = mat('#eaf3f8', {roughness:.06, metalness:.12, transparent:true, opacity:.7, side:THREE.DoubleSide});
  g.add(lathe([[r*.25, 0], [r, h*.32], [r*.7, h*.72], [r*.18, h]], cm, x, y, z, 10));
  const b = blob(r*.5, r*.5, r*.5, glowMat('#ffffff', '#ffe9c4', .5), x, y + h*.5, z, 8);
  b.castShadow = false; g.add(b);
}
/** 球形玻璃灯罩：透明外壳 + 磨砂发光内层 + 灯泡光晕 */
export function glassGlobe(g, x, y, z, r, o = {}){
  const gm = mat(o.cool ? '#dfeaf2' : '#fff6e2', {transparent:true, opacity:.3, roughness:.06, metalness:.08, side:THREE.DoubleSide});
  const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), gm);
  shell.position.set(x, y, z); g.add(shell);
  const inner = blob(r*.93, r*.93, r*.93, glowMat(o.cool ? '#eef5ff' : '#fff3dc', o.cool ? '#9fc4ff' : '#ffd9a0', .55), x, y, z, 20);
  inner.castShadow = false; g.add(inner);
  glowBulb(g, x, y, z, Math.max(.02, r*.22), {cool:o.cool, halo:r*2.4});
}
/** 给灯具挂一盏真实光源：白天关闭、夜晚开启（见 applyLight）
 *  spec: {color, intensity, distance, decay, kind:'point'|'spot',
 *         angle, penumbra, targetX, targetY, targetZ, priority} */
export function lampLight(g, x, y, z, spec){
  const s = Object.assign({color:0xffd9a8, intensity:2, distance:6, decay:1.8, priority:1}, spec || {});
  let l;
  if (s.kind === 'spot'){
    l = new THREE.SpotLight(s.color, 0, s.distance, s.angle ?? .55, s.penumbra ?? .55, s.decay);
    const t = new THREE.Object3D();
    t.position.set(s.targetX != null ? s.targetX : x, s.targetY != null ? s.targetY : 0, s.targetZ != null ? s.targetZ : z);
    g.add(t);
    l.target = t;
  } else {
    l = new THREE.PointLight(s.color, 0, s.distance, s.decay);
  }
  l.position.set(x, y, z);
  l.visible = false;
  l.userData.fixtureSpec = s;
  g.add(l);
  return l;
}
/** 射灯光束体：夜景半透明光锥，沿照射方向指向对面落点 */
export function spotBeam(g, x, y, z, tx, ty, tz, len, radius, glow){
  const dx = tx - x, dy = ty - y, dz = tz - z;
  const dist = Math.hypot(dx, dy, dz) || 1;
  const L = Math.min(len || dist, dist);
  const geo = new THREE.ConeGeometry(radius || .32, L, 20, 1, true);
  geo.translate(0, -L / 2, 0);
  const col = glow || '#fff4dc';
  const m = new THREE.MeshStandardMaterial({
    color: col, emissive: col, emissiveIntensity: .12, roughness: 1,
    transparent: true, opacity: .04, depthWrite: false, side: THREE.DoubleSide,
  });
  m.userData.spotBeam = true;
  const cone = new THREE.Mesh(geo, m);
  cone.position.set(x, y, z);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx, dy, dz).normalize());
  cone.castShadow = false; cone.receiveShadow = false;
  cone.userData.spotBeam = true;
  cone.visible = false;
  g.add(cone);
  return cone;
}
