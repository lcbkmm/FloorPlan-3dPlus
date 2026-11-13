import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {V, wx, wz, M} from './shared.js';
import {mat, rng} from './materials.js';
import {
  asMat, mesh, rot, box, rbox, cyl, lathe, rod, tube, blob, ring, shell, rrect, sh,
  darker, lighter, legs, metal, chrome, hwMat, blackMetal, mirror, ceramic,
  fabric, woodM, furnCabMat, cabHm, screenMat, glowMat, pull, knob, fronts,
  vase, tableLamp, plate
} from './geo.js';
import {glowBulb, crystalDrop, glassGlobe, lampLight, spotBeam} from './lamps.js';

/* ================= 装饰画 / 挂墙饰品的程序化画面 ================= */
/* 用 CanvasTexture 现画抽象画作，按 kind+seed 缓存，避免每帧 / 每件家具重复生成。
   不走 mat() 缓存：贴图对象无法 JSON.stringify，材质单独挂在 V 上复用。 */
function decorArtTex(kind, seed){
  const key = '_decorTex_' + kind + '_' + seed;
  if (V[key]) return V[key];
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x2 = cv.getContext('2d');
  let sd = (((seed | 0) * 2654435761) + 1013904223) >>> 0;
  const rr = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const P = ({
    abstract:  {bg:['#efe6d6','#d8c7a8'], ink:['#b9684c','#4f6a63','#d9a95e','#33403e'], shape:'blob'},
    botanical: {bg:['#e9efe3','#cbdcc2'], ink:['#5d7a55','#8aa87a','#c2b184','#3f5943'], shape:'leaf'},
    mono:      {bg:['#f3f1eb','#dcd8ce'], ink:['#2b2b2b','#7a7a76','#b2ada3','#4a4a48'], shape:'geo'},
    landscape: {bg:['#dfe8eb','#b7cbd3'], ink:['#7b96a1','#4d6b74','#a2b39e','#e0c9a6'], shape:'hill'},
  })[kind] || {bg:['#efe6d6','#d8c7a8'], ink:['#b9684c','#4f6a63','#d9a95e','#33403e'], shape:'blob'};
  const gr = x2.createLinearGradient(0, 0, S, S);
  gr.addColorStop(0, P.bg[0]); gr.addColorStop(1, P.bg[1]);
  x2.fillStyle = gr; x2.fillRect(0, 0, S, S);
  const ink = P.ink;
  if (P.shape === 'blob'){
    for (let k = 0; k < 4; k++){
      x2.fillStyle = ink[k % ink.length]; x2.globalAlpha = .48 + rr() * .36;
      const cx = S * (.18 + rr() * .64), cy = S * (.2 + rr() * .6), R = S * (.14 + rr() * .2);
      x2.beginPath();
      const n = 7;
      for (let i = 0; i <= n; i++){
        const a = i * Math.PI * 2 / n, rx = R * (.75 + rr() * .5);
        const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * rx * .82;
        if (!i) x2.moveTo(px, py);
        else x2.quadraticCurveTo(cx + Math.cos(a - Math.PI / n) * R * 1.16, cy + Math.sin(a - Math.PI / n) * R * .96, px, py);
      }
      x2.closePath(); x2.fill();
    }
  } else if (P.shape === 'hill'){
    for (let k = 0; k < 3; k++){
      x2.fillStyle = ink[k % ink.length]; x2.globalAlpha = .5 + k * .14;
      const base = S * (.5 + k * .15);
      x2.beginPath(); x2.moveTo(0, S); x2.lineTo(0, base);
      for (let i = 0; i <= 4; i++){
        const px = S * i / 4;
        x2.lineTo(px, base - S * (.08 + rr() * .18));
        x2.lineTo(Math.min(S, px + S * .08), base - S * (.02 + rr() * .06));
      }
      x2.lineTo(S, S); x2.closePath(); x2.fill();
    }
    x2.globalAlpha = .9; x2.fillStyle = '#f6e2b4';
    x2.beginPath(); x2.arc(S * .73, S * .26, S * .085, 0, Math.PI * 2); x2.fill();
  } else if (P.shape === 'leaf'){
    for (let k = 0; k < 6; k++){
      const cx = S * (.14 + rr() * .72), cy = S * (.18 + rr() * .66), L = S * (.15 + rr() * .17);
      x2.save(); x2.translate(cx, cy); x2.rotate(rr() * Math.PI);
      x2.fillStyle = ink[k % ink.length]; x2.globalAlpha = .55 + rr() * .35;
      x2.beginPath(); x2.moveTo(0, -L);
      x2.quadraticCurveTo(L * .68, 0, 0, L); x2.quadraticCurveTo(-L * .68, 0, 0, -L); x2.fill();
      x2.strokeStyle = 'rgba(255,255,255,.45)'; x2.lineWidth = 2;
      x2.beginPath(); x2.moveTo(0, -L); x2.lineTo(0, L); x2.stroke();
      x2.restore();
    }
  } else {
    for (let k = 0; k < 5; k++){
      x2.fillStyle = ink[k % ink.length]; x2.globalAlpha = .5 + rr() * .38;
      const cx = S * (.14 + rr() * .7), cy = S * (.16 + rr() * .68), q = S * (.12 + rr() * .2);
      if (k % 3 === 0) x2.fillRect(cx - q / 2, cy - q / 2, q, q * (.6 + rr() * .8));
      else if (k % 3 === 1){ x2.beginPath(); x2.arc(cx, cy, q * .55, 0, Math.PI * 2); x2.fill(); }
      else { x2.beginPath(); x2.moveTo(cx, cy - q * .6); x2.lineTo(cx + q * .6, cy + q * .5); x2.lineTo(cx - q * .6, cy + q * .5); x2.closePath(); x2.fill(); }
    }
  }
  // 笔触噪点 + 画布内缘高光，避免看起来像纯色块
  x2.globalAlpha = .11;
  for (let i = 0; i < 90; i++){
    x2.strokeStyle = i % 2 ? '#ffffff' : '#000000'; x2.lineWidth = .6 + rr() * 1.4;
    const px = rr() * S, py = rr() * S, len = 4 + rr() * 22;
    x2.beginPath(); x2.moveTo(px, py); x2.lineTo(px + len, py + (rr() - .5) * 6); x2.stroke();
  }
  x2.globalAlpha = 1;
  x2.strokeStyle = 'rgba(255,255,255,.22)'; x2.lineWidth = 6; x2.strokeRect(3, 3, S - 6, S - 6);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  V[key] = tx;
  return tx;
}
function decorArtMat(kind, seed){
  const key = '_decorArt_' + kind + '_' + seed;
  if (!V[key]) V[key] = new THREE.MeshStandardMaterial({map:decorArtTex(kind, seed), roughness:.9, metalness:0});
  return V[key];
}
/** 竖立装饰画框：W×H、厚 T、边框宽 fw，底边 y0，正面朝局部 +Z（朝向由 f.rot 决定） */
function decorFrame(W, H, T, fw, y0, frameCol, artMat){
  const grp = new THREE.Group(), fm = woodM(frameCol);
  grp.add(box(W, H, T, fm, 0, y0, 0));                                            // 框体
  const t = Math.min(.022, fw * .5), fz = T / 2 + t / 2 - .002;
  grp.add(rbox(W, fw, t, fm, 0, y0 + H - fw, fz, .004));                          // 上压条
  grp.add(rbox(W, fw, t, fm, 0, y0, fz, .004));                                   // 下压条
  grp.add(rbox(fw, H - 2 * fw, t, fm, -W / 2 + fw / 2, y0 + fw, fz, .004));      // 左压条
  grp.add(rbox(fw, H - 2 * fw, t, fm,  W / 2 - fw / 2, y0 + fw, fz, .004));      // 右压条
  grp.add(box(W - 2 * fw, H - 2 * fw, .003, mat('#f7f2e8', {roughness:.95}), 0, y0 + fw, T / 2 + .002)); // 卡纸
  const iw = W - 2 * fw - .03, ih = H - 2 * fw - .03;
  if (artMat && iw > .01 && ih > .01) grp.add(box(iw, ih, .002, artMat, 0, y0 + fw + .015, T / 2 + .004));
  grp.add(box(W - .01, H - .01, .006, mat('#8a7d6d', {roughness:.9}), 0, y0 + .005, -T / 2 - .003));      // 背板
  return grp;
}

/** 灯具亮度 / 色温 / 安装高度（f.bright 0~200，100=标准亮度、f.tone 色温 key、f.height mm）：
 *  点光/射灯 → 缩放 fixtureSpec.intensity 并改光源颜色；
 *  发光灯罩 → 克隆共享 glow 材质后按色温改 emissive、按亮度缩放（收录到 V.lampGlowMats，
 *  由 applyLight 统一随昼夜重算）；光晕在亮度为 0 时熄灭；射灯光锥颜色同步。
 *  安装高度：不整体平移 group（楼层 group 已带层高），而是按 lift 平移「直接子对象」——
 *  悬挂类天花罩固定贴顶、原吊线自动伸缩、灯体/光源/光晕随之升降；非灯具完全跳过。 */
export function applyLampSettings(f, g){
  if (!V.lampGlowMats) V.lampGlowMats = [];
  const tone = (window.LAMP_TONES || []).find(t => t.key === (f.tone || 'warm')) || {col:'#ffd9a8'};
  const bright = Math.max(0, Math.min(2, (f.bright == null ? 100 : f.bright) / 100));
  const c = new THREE.Color(tone.col);
  const white = new THREE.Color('#ffffff');
  // —— 安装高度 ——：只对灯具生效，避免非灯具（自带 f.height 字段时）被误升降
  const isLamp = !!(window.LAMP_TYPES && window.LAMP_TYPES.has(f.type));
  if (isLamp){
    const lift = (typeof window.lampLiftOf === 'function') ? window.lampLiftOf(f) : 0;
    g.children.forEach(o => {
      if (o.userData.baseY == null) o.userData.baseY = o.position.y;   // 建模原始 y，与 lift 解耦、幂等
      if (!(o.isMesh || o.isLight || o.isSprite)) return;               // 跳过射灯 target 等纯 Object3D
      const b = o.userData.baseY;
      if (o.userData.lampAnchor){                                       // 天花罩：固定贴顶，不随灯体升降
        o.position.y = b;
      } else if (o.userData.lampCord){                                   // 吊线：顶端贴顶、底端连灯体，按 lift 伸缩
        const L0 = o.userData.lampCordLen || .8;
        const L = Math.max(.02, L0 - lift);
        o.scale.y = L / L0;
        o.position.y = b + lift / 2;
      } else {                                                          // 灯体 / 光源 / 光晕：随安装高度升降
        o.position.y = b + lift;
      }
    });
  }
  // —— 亮度 / 色温 ——：遍历所有后代（含嵌套 group 内的发光材质与光源）
  g.traverse(o => {
    if (o.userData && o.userData.fixtureSpec){
      const s = o.userData.fixtureSpec;
      if (s.baseIntensity == null) s.baseIntensity = s.intensity != null ? s.intensity : 2;
      s.intensity = s.baseIntensity * bright;
      if (o.isLight) o.color.copy(c);
    }
    if (o.userData && o.userData.spotBeam && o.material){
      o.material.color.copy(c); o.material.emissive.copy(c);
    }
    if (o.isSprite) o.visible = bright > 0;                    // 光晕：灯关即灭
    if (o.isMesh && o.material && o.material.userData && o.material.userData.glowBase != null){
      if (!o.userData._ownGlow){
        o.material = o.material.clone();                       // 共享 glow 材质 → 每盏灯独立
        o.material.userData = Object.assign({}, o.material.userData);
        o.userData._ownGlow = true;
      }
      const gm = o.material;
      gm.emissive.copy(c);
      gm.color.copy(c).lerp(white, .5);
      gm.userData.lampBright = bright;
      gm.emissiveIntensity = gm.userData.glowBase * (V.opt.night ? 3.4 : 1) * bright;
      if (!V.lampGlowMats.includes(gm)) V.lampGlowMats.push(gm);
    }
  });
}

export function buildFurniture(f){
  const g = new THREE.Group(), w = M(f.w), d = M(f.d), c = f.color || '#ddd', bz = -d/2, R = rng(Math.round(f.w*7 + f.d*13 + f.cx + f.cy));
  switch (f.type){
    case 'bed': {
      const fr = woodM('#8d7258'), fab = fabric(c), fh = .3, mt = .22, top = fh + mt, n = Math.max(3, Math.round(w/.28)), sw = (w - .04)/n;
      g.add(box(w - .12, .06, d - .14, '#4a3e33', 0, 0, .03), rbox(w, fh - .06, d - .08, fr, 0, .06, .04, .015));        // 内缩踢脚 + 床箱
      g.add(rbox(w, 1.08, .06, fr, 0, 0, bz + .03, .012));                                                                 // 床头板
      for (let i = 0; i < n; i++) g.add(rbox(sw - .006, .62, .06, fabric(darker(c, .8)), -w/2 + .02 + sw*(i + .5), .42, bz + .08, .025));   // 竖向软包
      const md = d - .13, dd = md*.66, dz = d/2 - .015 - dd/2;
      g.add(rbox(w - .06, mt, md, '#f6f3ee', 0, fh, bz + .11 + md/2, .07));                                              // 床垫
      g.add(rbox(w + .02, .27, dd, fab, 0, top - .2, dz, .04), rbox(w + .024, .06, .22, fabric('#fbfaf7'), 0, top + .025, dz - dd/2 + .11, .025));   // 被子 + 翻边
      g.add(rbox(w + .05, .285, .42, fabric(darker(c, .62)), 0, top - .205, d/2 - .35, .03));                               // 床尾巾
      const np = w >= 1.3 ? 2 : 1, pw = (w - .16 - (np-1)*.06)/np;
      for (let i = 0; i < np; i++){
        const x = -w/2 + .08 + pw/2 + i*(pw + .06);
        g.add(rot(rbox(pw, .15, .42, fabric('#ffffff'), x, top - .01, bz + .34, .07), -.28), rot(rbox(pw*.62, .3, .1, fabric(i ? '#efe7da' : darker(c, .7)), x, top, bz + .54, .045), -.3));
      }
      break;
    }
    case 'leatherbed': {
      /* 真皮大床（意式全皮拉扣软包 · 依据多角度实拍重制 v3）
       * 荔枝纹哑光黑皮 / 连续饱满方格软包（床头 4×2、床箱四周 2 行）
       * / 左右宽厚前包卷侧翼 / 厚实蓬松白被三面垂坠
       * / 深灰人字纹针织毯（斜搭 + 流苏）/ 豆沙棕扁方枕 + 米白抱枕
       * / 四只深色矮金属脚、几乎贴地 */
      const col = (c && c !== '#ddd') ? c : '#1b1b20';

      // —— 1. 荔枝纹皮革：细胞状颗粒明暗 map + bumpMap 凹凸 ——
      if (!V._lbGrain3){
        const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
        const x2 = cv.getContext('2d');
        const im = x2.createImageData(S, S), D = im.data;
        let sd = 771103;
        const rr = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
        const G = 26, cell = S / G, pts = [];
        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++)
          pts.push({x: (i + .16 + rr() * .68) * cell, y: (j + .16 + rr() * .68) * cell});
        const at = (i, j) => pts[((j % G + G) % G) * G + ((i % G + G) % G)];
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){
          const gi = Math.floor(x / cell), gj = Math.floor(y / cell);
          let d1 = 1e9, d2 = 1e9;
          for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++){
            const p = at(gi + a, gj + b), dx = x - p.x, dy = y - p.y, dd = dx * dx + dy * dy;
            if (dd < d1){ d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
          }
          const edge = Math.sqrt(d2) - Math.sqrt(d1);
          const q = Math.max(0, Math.min(255, Math.round(214 + Math.min(1, edge / 5.0) * 32 + (rr() - .5) * 10)));
          const i4 = (y * S + x) * 4;
          D[i4] = D[i4 + 1] = D[i4 + 2] = q; D[i4 + 3] = 255;
        }
        x2.putImageData(im, 0, 0);
        const tx = new THREE.CanvasTexture(cv);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 3);
        tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
        V._lbGrain3 = tx;
      }
      const grain = V._lbGrain3;

      // —— 2. 深灰人字纹针织毯：V 形斜纹 + 深浅纱线 + 细噪点 ——
      if (!V._lbThrow3){
        const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
        const x2 = cv.getContext('2d');
        x2.fillStyle = '#45454b'; x2.fillRect(0, 0, S, S);
        x2.lineWidth = 2.6; x2.lineCap = 'round';
        for (let row = -1; row < 10; row++){
          for (let k = -1; k < 10; k++){
            const cx = k * 32 + (row % 2 ? 16 : 0), cy = row * 32;
            x2.strokeStyle = '#727279';
            x2.beginPath(); x2.moveTo(cx - 14, cy - 10); x2.lineTo(cx, cy + 3); x2.lineTo(cx + 14, cy - 10); x2.stroke();
            x2.strokeStyle = '#2c2c31';
            x2.beginPath(); x2.moveTo(cx - 14, cy - 5); x2.lineTo(cx, cy + 8); x2.lineTo(cx + 14, cy - 5); x2.stroke();
          }
        }
        let sd = 45071;
        const rr = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
        for (let n = 0; n < 2600; n++){
          x2.fillStyle = rr() > .5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.14)';
          x2.fillRect(rr() * S, rr() * S, 1.5, 1.5);
        }
        const tx = new THREE.CanvasTexture(cv);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2.4, 1.5);
        tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
        V._lbThrow3 = tx;
      }

      // —— 3. 材质缓存（clearGroup 只释放 geometry，clone 材质必须复用） ——
      if (!V._lbMats3) V._lbMats3 = new Map();
      const LM = (base, rough = .55, bump = .007) => {
        const key = 'L|' + base + '|' + rough + '|' + bump;
        let m = V._lbMats3.get(key);
        if (!m){
          m = mat(base, {roughness: rough, metalness: .06}).clone();
          m.map = grain; m.bumpMap = grain; m.bumpScale = bump;
          m.needsUpdate = true; V._lbMats3.set(key, m);
        }
        return m;
      };
      const CL = (base, tex, tag, rough = .96) => {
        const key = 'C|' + base + '|' + rough + '|' + tag;
        let m = V._lbMats3.get(key);
        if (!m){
          m = mat(base, {roughness: rough}).clone();
          m.map = tex; m.needsUpdate = true; V._lbMats3.set(key, m);
        }
        return m;
      };

      const leather    = LM(col, .56, .007),
            leatherHi  = LM(lighter(col, .10), .50, .006),
            leatherMid = LM(lighter(col, .035), .58, .007),
            leatherDk  = LM(darker(col, .52), .72, .009);
      const seamM   = mat(darker(col, .40), {roughness: .9});
      const footM   = mat('#25252a', {metalness: .72, roughness: .36});
      // 白色织物自提亮：抵消暖色环境光让垂直面（被侧 / 床垫侧 / 下摆）发米灰
      const WHT = (o = {}) => mat('#fdfcf9', {roughness: .97, emissive: '#ffffff', emissiveIntensity: .28, ...o});
      const sheetW  = WHT();
      const duvetW  = WHT();
      const duvetHi = WHT({color: '#ffffff'});
      const drapeW  = WHT({color: '#fbfaf6', roughness: .98, side: THREE.DoubleSide});
      const throwM  = CL('#ffffff', V._lbThrow3, 'th', .96);
      const fringeM = mat('#48484e', {roughness: .98});
      const pillowB = mat('#8b6a5d', {roughness: .95});
      const pillowC = mat('#ece6d8', {roughness: .95});

      /* 连续拉扣软包面板：一整块细分板，方格中心饱满鼓起、格界自然收成深谷，
         交叉点压一颗深色凹扣；边界处 p=0 自动与侧板齐平，不产生硬瓷砖缝。
         局部法线朝 +Z，中心在原点，W×H 为外观尺寸。
         注意：box()/rbox() 的 y 参数是「底面」，本函数内一律用 mesh() 直接定中心。 */
      const tuft = (W, H, cols, rows, bulge, m) => {
        const grp = new THREE.Group();
        // 深色皮革包边底板（软包四周自然收口，不再另加硬滚边）
        const back = mesh(new RoundedBoxGeometry(W + .018, H + .018, .05, 3, .024), leatherDk);
        back.position.z = -.038; grp.add(back);
        const sx = cols * 10, sy = rows * 10;
        const geo = new THREE.BoxGeometry(W, H, .060, sx, sy, 1);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          if (pa.getZ(i) <= 0) continue;                 // 只鼓正面，背面/侧板保持平板
          const x = pa.getX(i), y = pa.getY(i);
          const u = (x / W + .5) * cols, v = (y / H + .5) * rows;
          const fu = Math.abs(Math.sin(Math.PI * u)), fv = Math.abs(Math.sin(Math.PI * v));
          const p = Math.pow(fu, .44) * Math.pow(fv, .44);  // 平台状饱满鼓包
          const micro = .0018 * Math.sin(x * 37 + y * 19) * Math.sin(y * 31 - x * 11);
          pa.setZ(i, .030 + bulge * p + micro * p);
        }
        geo.computeVertexNormals();
        grp.add(mesh(geo, m));
        for (let r = 1; r < rows; r++) for (let i2 = 1; i2 < cols; i2++){
          const px = -W / 2 + W * i2 / cols, py = -H / 2 + H * r / rows;
          grp.add(blob(.016, .016, .007, seamM, px, py, .032, 12));   // 拉扣
        }
        return grp;
      };

      /* 薄布片：贯通竖向褶皱 + 下缘不规则波浪，用于被子、毯子的自然垂坠 */
      const drape = (W, H, D, x, y, z, seed, m) => {
        const geo = new THREE.BoxGeometry(W, H, D, W > D ? 40 : 1, 8, D > W ? 40 : 1);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const xx = pa.getX(i), yy = pa.getY(i), zz = pa.getZ(i);
          const t = (W > D) ? xx : zz;
          // 贯通竖向褶皱：越往下摆动越大，形成柔软布感而非硬板
          const fold = .020 * Math.sin(t * 8.2 + seed) + .009 * Math.sin(t * 17.3 + seed * 1.7);
          const amp = .55 + .45 * Math.max(0, -yy / (H / 2));
          if (yy < 0) pa.setY(i, yy - .020 * Math.sin(t * 6.4 + seed) - .010 * Math.sin(t * 13.1 + seed));
          if (W < .02) pa.setX(i, xx + fold * amp + .008 * Math.sin(yy * 4.1 + seed));
          else if (D < .02) pa.setZ(i, zz + fold * amp + .008 * Math.sin(yy * 4.1 + seed));
        }
        geo.computeVertexNormals();
        const o = mesh(geo, m); o.position.set(x, y, z); return o;
      };

      /* 扁平方枕：圆角方轮廓 + 顶面微鼓 + 四角轻收，不做成香肠状 */
      const pillow = (pw, pd, th, bulge) => {
        const geo = new RoundedBoxGeometry(pw, th, pd, 5, Math.min(th, pd) * .20);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
          const u = Math.max(0, 1 - (x / (pw / 2)) ** 2), v = Math.max(0, 1 - (z / (pd / 2)) ** 2);
          const bl = Math.pow(u, .9) * Math.pow(v, .9);
          pa.setY(i, y + (y > 0 ? 1 : -1) * bulge * bl
                     + .004 * Math.sin(x * 4.1 + z * 3.2) * bl);
          pa.setX(i, x * (1 - .035 * (1 - bl)));
          pa.setZ(i, z * (1 - .035 * (1 - bl)));
        }
        geo.computeVertexNormals();
        return geo;
      };

      const frameD = d - .02, PZ = -frameD / 2, ZF = frameD / 2;
      const boxH = .34, mattressT = .145, topY = boxH + mattressT - .012;

      // —— 4. 深色矮金属脚 + 内缩踢脚 + 床箱内芯 ——
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
        g.add(cyl(.019, .024, .030, footM, a * (w / 2 - .12), 0, b * (frameD / 2 - .12), 16)));
      g.add(rbox(w - .16, .046, frameD - .16, leatherDk, 0, .020, 0, .018));
      g.add(rbox(w - .05, boxH - .03, frameD - .05, leatherDk, 0, .028, 0, .05));
      const sideH = boxH - .045, cy = .028 + (boxH - .03) / 2;

      // —— 5. 床箱四周统一 2 行方格软包（短边 3 列 / 长边 4 列） ——
      const ft = tuft(w - .01, sideH, 3, 2, .052, leather);
      ft.position.set(0, cy, ZF + .006); g.add(ft);                     // 床尾（+Z）
      const hdLow = tuft(w - .01, sideH, 3, 2, .048, leatherMid);
      hdLow.position.set(0, cy, PZ - .006); hdLow.rotation.y = Math.PI; g.add(hdLow);  // 床头下沿
      [-1, 1].forEach(s => {
        const p = tuft(frameD - .02, sideH, 4, 2, .050, leather);
        p.position.set(s * (w / 2 + .004), cy, 0);
        p.rotation.y = s * Math.PI / 2;                                  // 法线朝 ±X
        g.add(p);
      });

      // —— 6. 床头板：4 列 × 2 行方格 + 圆润皮革顶盖 + 左右宽厚前包卷侧翼 ——
      const hbW = w + .10, hbH = .78, hbZ = PZ - .055;
      const hbG = new THREE.Group();
      hbG.position.set(0, boxH - .02, hbZ);
      hbG.rotation.x = -.045;                                            // 整体微后倾
      const hb = tuft(hbW, hbH, 4, 2, .074, leather);
      hb.position.set(0, hbH / 2, 0);
      hbG.add(hb);
      // 顶部不另加横杆：tuft 自带的深色皮革底板已在四周自然收口
      [-1, 1].forEach(s => {
        const wing = tuft(.40, hbH * .92, 1, 2, .10, leather);
        wing.position.set(s * (hbW / 2 - .10), hbH * .46, .15);
        wing.rotation.y = s * .72;                                      // 与床头连成一体的前包卷侧翼
        hbG.add(wing);
      });
      g.add(hbG);

      // —— 7. 白色床垫 + 床单 ——
      g.add(rbox(w - .07, mattressT, frameD - .10, sheetW, 0, boxH - .02, .008, .050));
      g.add(rbox(w - .05, .012, frameD - .08, duvetHi, 0, topY - .012, .008, .040));

      // —— 8. 厚实蓬松白被：面包卷形态，四周圆润下卷包住床垫，前缘饱满卷边 ——
      const z0 = PZ + d * .24, z1 = ZF + .012, duvL = z1 - z0, zc = (z0 + z1) / 2;
      const bw = w + .03, duvT = .165, duvY = topY + .006;
      {
        // RoundedBoxGeometry 自带真实圆角 + 平滑法线，前缘与四周自然成为饱满卷边
        const geo = new RoundedBoxGeometry(bw, duvT, duvL, 6, .065);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
          const ex = Math.abs(x) / (bw / 2), ez = Math.abs(z) / (duvL / 2);
          const edge = Math.max(ex, ez);
          const s = Math.max(0, (edge - .62) / .38);
          const wave = .009 * Math.sin(x * 2.4 + z * 1.6)
                     + .006 * Math.sin(z * 3.6 - x * 2.0)
                     + .0025 * Math.sin(x * 7.8 + z * 2.3);
          // 顶面蓬松微隆、外缘顺滑下卷，形成面包卷轮廓
          pa.setY(i, y + wave * (.35 + .65 * Math.max(0, y / (duvT / 2)))
                      + .012 * (1 - edge * edge) - s * s * .052);
          pa.setX(i, x * (1 - s * s * .012));
          pa.setZ(i, z * (1 - s * s * .010));
        }
        geo.computeVertexNormals();
        const o = mesh(geo, duvetW); o.position.set(0, duvY, zc); g.add(o);
      }
      { // 被头翻边（略亮、带细褶）
        const geo = new THREE.BoxGeometry(bw - .10, .026, .16, 28, 2, 6);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const x = pa.getX(i), y = pa.getY(i);
          if (y > 0) pa.setY(i, y + .006 * Math.sin(x * 5.2) + .002 * Math.sin(x * 11));
        }
        geo.computeVertexNormals();
        const o = mesh(geo, duvetHi);
        o.position.set(0, duvY + duvT / 2 + .012, z0 + .09); g.add(o);
      }

      // —— 9. 深灰人字纹针织毯：斜搭被面中后段 + 两端薄垂 + 前缘流苏 ——
      {
        const kw = w + .03, kl = d * .34;
        const grp = new THREE.Group();
        const geo = new THREE.BoxGeometry(kw, .014, kl, 26, 1, 16);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
          const ex = Math.abs(x) / (kw / 2), ez = Math.abs(z) / (kl / 2);
          if (y > 0) pa.setY(i, y + .006 * Math.sin(x * 3.3 + z * 2.4)
                            + .003 * Math.sin(z * 6.1 - x * 1.4) - .005 * Math.pow(ex, 6));
          pa.setZ(i, z * (1 - .018 * Math.pow(ez, 8)));
        }
        geo.computeVertexNormals();
        grp.add(mesh(geo, throwM));
        [-1, 1].forEach(s => grp.add(drape(.012, s < 0 ? .15 : .095, kl * .92,
          s * (kw / 2 - .005), s < 0 ? -.075 : -.046, 0, s + .7, throwM)));
        for (let i = 0; i < 18; i++){
          const fx = -kw / 2 + kw * (i + .5) / 18;
          const ln = .020 + .012 * Math.abs(Math.sin(i * 2.7));
          const fr = box(.0045, ln, .0045, fringeM, fx, -ln - .002, kl / 2 - .002);
          fr.rotation.z = .12 * Math.sin(i * 1.9);
          grp.add(fr);
        }
        grp.position.set(-.012, duvY + duvT / 2 + .010, PZ + d * .52);
        grp.rotation.y = .12;                                            // 明显斜搭
        g.add(grp);
      }

      // —— 10. 两枚豆沙棕扁方枕（平放、明显高出被面）+ 一枚米白抱枕 ——
      const bedTop = duvY + duvT / 2;
      [-1, 1].forEach(s => {
        const p = mesh(pillow(w * .40, .44, .135, .026), pillowB);
        p.position.set(s * w * .225, bedTop + .095, PZ + .38);
        p.rotation.x = -.15; p.rotation.y = s * .045;
        g.add(p);
      });
      {
        const q = Math.min(w * .28, .50);
        const p = mesh(pillow(q, q * .82, .105, .020), pillowC);
        p.position.set(w * .02, bedTop + .070, PZ + .60);
        p.rotation.y = -.16; p.rotation.z = .07;
        g.add(p);
      }
      break;
    }

    case 'premiumbed': {
      /* 高端木床（黑胡桃 · 参照实拍重制）
       * 落地高箱整板床体 / 自然边山纹实木大板床头 / 山棕床垫 + 白床单
       * / 中灰棉麻被（起伏被面 · 被头翻边 · 床尾与两侧柔软垂坠）
       * / 白色大枕 + 绿白人字纹抱枕 / 床尾书册摆件 */
      const col = (c && c !== '#ddd') ? c : '#4a382b';

      // —— 1. 程序化黑胡桃大板山纹：横向水波 + 宽窄相间的深浅条带 ——
      if (!V._bedGrain){
        const CW = 512, CH = 256;
        const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
        const x2 = cv.getContext('2d');
        const img = x2.createImageData(CW, CH), D = img.data;
        let seed = 19870612;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const p0 = rnd()*6.283, p1 = rnd()*6.283, p2 = rnd()*6.283, p3 = rnd()*6.283;
        for (let py = 0; py < CH; py++){
          for (let px = 0; px < CW; px++){
            const warp = 34*Math.sin(px/150+p0) + 13*Math.sin(px/58+p1) + 4*Math.sin(px/21+p2);
            const yy = py + warp;
            let t = Math.sin(yy*.046 + 1.5*Math.sin(px/230+p3) + .55*Math.sin(px/80+p2));
            t += .30*Math.sin(yy*.145 + px*.003);
            t += .11*Math.sin(yy*.43 + p1);
            t += .30*Math.sin(px/185+p1)*Math.cos(py/110+p2);
            let k = 1 - Math.max(0, Math.min(1, t*.5+.5)) * .38;
            k += (rnd()-.5)*.022;
            const q = Math.max(0, Math.min(255, Math.round(k*255)));
            const i4 = (py*CW+px)*4;
            D[i4] = D[i4+1] = D[i4+2] = q; D[i4+3] = 255;
          }
        }
        x2.putImageData(img, 0, 0);
        const tx = new THREE.CanvasTexture(cv);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
        V._bedGrain = tx;
      }
      const grain = V._bedGrain;

      // —— 2. 棉麻被面织纹：经纬交织颗粒 + 轻微斜纹，让中灰布面有织物感 ——
      if (!V._bedLinen){
        const LS = 256;
        const cv = document.createElement('canvas'); cv.width = cv.height = LS;
        const x2 = cv.getContext('2d');
        const im = x2.createImageData(LS, LS), D = im.data;
        let sd = 20241106;
        const rr = () => { sd = (sd*1664525 + 1013904223) >>> 0; return sd/4294967296; };
        for (let y = 0; y < LS; y++) for (let x = 0; x < LS; x++){
          const weave = Math.sin(x*1.9)*Math.sin(y*1.9)*11
                      + Math.sin((x+y)*.52)*6 + Math.sin(x*.19)*4;
          const q = Math.max(0, Math.min(255, Math.round(246 + weave + (rr()-.5)*15)));
          const i4 = (y*LS+x)*4;
          D[i4] = D[i4+1] = D[i4+2] = q; D[i4+3] = 255;
        }
        x2.putImageData(im, 0, 0);
        const tx = new THREE.CanvasTexture(cv);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(3, 3);
        tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
        V._bedLinen = tx;
      }
      const linen = V._bedLinen;

      // —— 3. 绿白人字纹（Chevron）抱枕布纹：饱和黄绿宽带 + 白色亮边 ——
      if (!V._bedChevron){
        const CS = 256;
        const cv = document.createElement('canvas'); cv.width = cv.height = CS;
        const x2 = cv.getContext('2d');
        x2.fillStyle = '#fbfaf4'; x2.fillRect(0, 0, CS, CS);
        const step = 40, amp = 15, lw = 13;
        x2.lineCap = 'round'; x2.lineJoin = 'round';
        for (let base = -amp; base < CS + step; base += step){
          x2.strokeStyle = '#9aa85c'; x2.lineWidth = lw;
          x2.beginPath();
          for (let px2 = 0; px2 <= CS; px2 += 2){
            const ph = (px2/(step/2)) % 2, tri = ph < 1 ? ph : 2 - ph;
            const yy2 = base + tri*amp;
            px2 ? x2.lineTo(px2, yy2) : x2.moveTo(px2, yy2);
          }
          x2.stroke();
          x2.strokeStyle = 'rgba(255,255,255,.42)'; x2.lineWidth = 2.5;
          x2.beginPath();
          for (let px2 = 0; px2 <= CS; px2 += 2){
            const ph = (px2/(step/2)) % 2, tri = ph < 1 ? ph : 2 - ph;
            const yy2 = base + tri*amp + 6.5;
            px2 ? x2.lineTo(px2, yy2) : x2.moveTo(px2, yy2);
          }
          x2.stroke();
        }
        const tx = new THREE.CanvasTexture(cv);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
        V._bedChevron = tx;
      }
      const chevron = V._bedChevron;

      // 材质缓存：clearGroup 只释放 geometry，clone 出来的材质必须复用，避免 3D 重建时泄漏
      if (!V._bedMats) V._bedMats = new Map();
      const WM = (base, rough = .58) => {
        const key = 'w|' + base + '|' + rough;
        let m = V._bedMats.get(key);
        if (!m){ m = mat(base, {roughness: rough}).clone(); m.map = grain; m.needsUpdate = true; V._bedMats.set(key, m); }
        return m;
      };
      const LINEN = (base) => {
        const key = 'l|' + base;
        let m = V._bedMats.get(key);
        if (!m){ m = mat(base, {roughness:.98}).clone(); m.map = linen; m.needsUpdate = true; V._bedMats.set(key, m); }
        return m;
      };
      const CHEV = () => {
        let m = V._bedMats.get('chev');
        if (!m){ m = mat('#ffffff', {roughness:.95}).clone(); m.map = chevron; m.needsUpdate = true; V._bedMats.set('chev', m); }
        return m;
      };
      const wood  = WM(col, .55),
            woodD = WM(darker(col, .66), .68),
            woodL = WM(lighter(col, .12), .50);
      const seam = mat('#221910', {roughness:1});
      const duvet = LINEN('#7d807b'), duvetHi = LINEN('#8e908b'), duvetLo = LINEN('#6d706c');
      const sheetW = LINEN('#f6f5f0');

      const frameD = d - .02, boxH = .44, kick = .035, rail = .055;
      const footZ = frameD/2 - rail/2;

      // —— 4. 落地高箱：内缩踢脚 + 四面整板 + 拼板缝 + 顶沿收边 ——
      g.add(box(w - .14, kick, frameD - .14, woodD, 0, 0, 0));
      [-1, 1].forEach(s => g.add(box(rail, boxH - kick, frameD, wood, s*(w/2 - rail/2), kick, 0)));
      g.add(box(w, boxH - kick, rail, wood, 0, kick, footZ));
      g.add(box(w, boxH - kick, rail*.7, woodD, 0, kick, -frameD/2 + rail*.35));
      [1, 2].forEach(i =>
        g.add(box(.0022, boxH - kick - .05, .0012, seam, -w/2 + w*i/3, kick + .025, frameD/2 + .001)));
      [-1, 1].forEach(s =>
        g.add(box(.0012, .004, frameD - .10, seam, s*(w/2 + .0006), boxH*.55, 0)));
      g.add(box(w - rail*2, .020, .026, woodL, 0, boxH - .020, footZ - .012));
      [-1, 1].forEach(s => g.add(box(.026, .020, frameD - rail - .04, woodL, s*(w/2 - rail/2), boxH - .020, -.02)));

      // —— 5. 自然边（live edge）山纹实木大板床头：整板 + 起伏上沿 + 淡拼缝 ——
      const hbW = w + .10, hbH = 1.05, hbT = .072, hbZ = -frameD/2 - hbT/2 + .012;
      {
        const shp = new THREE.Shape();
        const seg = 56;
        shp.moveTo(-hbW/2, 0);
        shp.lineTo( hbW/2, 0);
        for (let i = seg; i >= 0; i--){
          const t = i/seg, xx = -hbW/2 + hbW*t;
          const yy = hbH - .028
            + .017*Math.sin(xx*3.1 + .7)
            + .009*Math.sin(xx*7.3 + 2.1)
            + .005*Math.sin(xx*13.7);
          shp.lineTo(xx, yy);
        }
        shp.closePath();
        const eg = new THREE.ExtrudeGeometry(shp, {depth: hbT - .008, bevelEnabled:true,
          bevelThickness:.004, bevelSize:.004, bevelSegments:2, curveSegments:8});
        // 按整板包围盒重算 UV，让山纹在正面完整平铺
        const pa = eg.attributes.position, uv = eg.attributes.uv;
        for (let i = 0; i < pa.count; i++)
          uv.setXY(i, (pa.getX(i) + hbW/2)/hbW, pa.getY(i)/hbH);
        uv.needsUpdate = true;
        const hb = mesh(eg, wood);
        hb.position.set(0, 0, hbZ - (hbT - .008)/2);
        g.add(hb);
      }
      const hbFace = hbZ + hbT/2 + .002;
      [1, 2].forEach(i =>
        g.add(box(.0016, hbH - .09, .001, woodD, -hbW/2 + hbW*i/3, .025, hbFace)));
      g.add(box(hbW - .05, .006, .003, woodD, 0, .010, hbFace));
      g.add(box(hbW - .06, .008, .004, seam, 0, boxH - .012, hbFace));

      // —— 6. 山棕床垫 + 白色床单（侧边可见层次） ——
      const matY = boxH, matH = .21, matD = frameD - .14;
      g.add(rbox(w - .10, matH, matD, mat('#e9e3d5', {roughness:.96}), 0, matY, .012, .055));
      g.add(rbox(w - .098, .016, matD - .002, mat('#f8f6f0', {roughness:.96}), 0, matY + matH - .016, .012, .05));
      g.add(box(w - .10, .004, .003, mat('#d8cfbc', {roughness:.95}), 0, matY + matH*.55, matD/2 + .013));
      const topY = matY + matH;
      g.add(rbox(w - .08, .010, matD - .02, sheetW, 0, topY - .016, .012, .035));

      // —— 7. 中灰棉麻被：起伏被面 + 软翻边 + 床尾/两侧薄而柔软的垂坠 ——
      const z0 = -frameD/2 + .54, z1 = frameD/2 - .015, duvL = z1 - z0, zc = (z0 + z1)/2;
      const bw = w + .03, bt = .050;
      {
        const geo = new THREE.BoxGeometry(bw, bt, duvL, 28, 1, 44);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const xx = pa.getX(i), yy = pa.getY(i), zz = pa.getZ(i);
          if (yy > 0) pa.setY(i, yy
            + .030*Math.sin(xx*2.3 + zz*1.3)
            + .015*Math.sin(zz*3.6 - xx*1.9)
            + .006*Math.sin(xx*8.1 + zz*6.3));
        }
        geo.computeVertexNormals();
        const duv = mesh(geo, duvet); duv.position.set(0, topY + bt/2 + .002, zc); g.add(duv);
      }
      // 被头翻边：柔软折返，不再用生硬横条
      {
        const fh = .032, fd = .14;
        const geo = new THREE.BoxGeometry(bw, fh, fd, 24, 2, 5);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const xx = pa.getX(i), zz = pa.getZ(i), yy = pa.getY(i);
          if (yy > 0) pa.setY(i, yy + .006*Math.sin(xx*5.1 + zz*3.2));
        }
        geo.computeVertexNormals();
        const fl = mesh(geo, duvetHi); fl.position.set(0, topY + bt - .014, z0 + fd/2); g.add(fl);
      }
      // 床尾垂片：竖向褶皱沟壑 + 明显不规则下摆，只垂到床垫上沿，露出高箱木体
      {
        const drH = .205, drTop = topY + bt - .010;
        const geo = new THREE.BoxGeometry(bw, drH, .020, 60, 16, 1);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const xx = pa.getX(i), yy = pa.getY(i);
          const t = (drH/2 - yy)/drH;
          const fold = .014*Math.sin(xx*7.3) + .009*Math.sin(xx*14.1 + 1.1) + .005*Math.sin(xx*23.7);
          pa.setZ(i, pa.getZ(i) + (.25 + .75*t)*fold);
          if (t > .18){
            const q2 = (t - .18)/.82, wob = q2*q2;
            pa.setY(i, yy - wob*(.026 + .022*Math.sin(xx*4.2) + .012*Math.sin(xx*9.6 + 2.0)));
          }
        }
        geo.computeVertexNormals();
        const dr = mesh(geo, duvetLo); dr.position.set(0, drTop - drH/2, z1 + .008); g.add(dr);
      }
      // 两侧垂片：更短、下摆更松，避免把整床包成硬布盒
      [-1, 1].forEach(s => {
        const sh2 = .105, sdTop = topY + bt - .010;
        const geo = new THREE.BoxGeometry(.016, sh2, duvL*.93, 1, 12, 44);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const zz = pa.getZ(i), yy = pa.getY(i);
          const t = (sh2/2 - yy)/sh2;
          if (t > .2){
            const q2 = (t - .2)/.8, wob = q2*q2;
            pa.setY(i, yy - wob*(.016 + .013*Math.sin(zz*4.6 + s)));
            pa.setX(i, pa.getX(i) - s*q2*(.010*Math.sin(zz*5.6) + .005));
          }
        }
        geo.computeVertexNormals();
        const sd = mesh(geo, duvetLo); sd.position.set(s*(w/2 + .006), sdTop - sh2/2, zc); g.add(sd);
      });

      // —— 8. 枕头：后排白色大枕（明显露出）+ 前排绿白人字纹鼓包抱枕 ——
      const np = w >= 1.4 ? 2 : 1, pw = (w - .30 - (np-1)*.06)/np;
      for (let i = 0; i < np; i++){
        const px = -w/2 + .15 + pw/2 + i*(pw + .06);
        const pz = z0 - .26;
        const big = rbox(pw, .17, .43, sheetW, px, topY + .012, pz, .065);
        big.rotation.x = -.22; g.add(big);
        const pip = rbox(pw*.94, .014, .38, LINEN('#ecebe5'), px, topY + .172, pz - .004, .035);
        pip.rotation.x = -.22; g.add(pip);
        if (w >= 1.3){
          const q = .44;
          // 白色枕套滚边（略大一圈，衬在后面）
          const edge = mesh(new RoundedBoxGeometry(q + .018, q + .018, .118, 4, .078),
                            LINEN('#f7f6f0'));
          edge.position.set(px + (i ? -.05 : .05), topY + .215, z0 + .035);
          edge.rotation.x = -.50; edge.rotation.z = (i ? 1 : -1)*.045;
          g.add(edge);
          const pg = new RoundedBoxGeometry(q, q, .128, 5, .072);
          const pa = pg.attributes.position;
          for (let k = 0; k < pa.count; k++){
            const xx = pa.getX(k), yy = pa.getY(k);
            const bl = Math.max(0, 1 - (xx/(q/2))**2) * Math.max(0, 1 - (yy/(q/2))**2);
            pa.setZ(k, pa.getZ(k) + (pa.getZ(k) >= 0 ? 1 : -1)*bl*.055);
          }
          pg.computeVertexNormals();
          const pil = mesh(pg, CHEV());
          pil.position.set(px + (i ? -.05 : .05), topY + .215, z0 + .047);
          pil.rotation.x = -.50; pil.rotation.z = (i ? 1 : -1)*.045;
          g.add(pil);
        }
      }

      // —— 9. 床尾书册摆件：有厚度的精装书 / 摊开的书 / 中缝与页层 ——
      {
        const bkY = topY + bt + .012;
        const paper = LINEN('#f5f2e8'), kraft = LINEN('#dccdb0'), cream = LINEN('#efe9da'),
              lineM = LINEN('#c6bba4');
        const leaf = (bw2, bd2, cover, bx, bz3, ry, tilt, th = .040) => {
          const grp = new THREE.Group();
          grp.add(rbox(bw2, th, bd2, paper, 0, 0, 0, .003));
          grp.add(box(bw2 + .010, .004, bd2 + .010, cover, 0, th, 0));
          grp.add(box(bw2 + .010, .004, bd2 + .010, cover, 0, -.004, 0));
          grp.add(box(.011, th + .008, bd2 + .010, cover, -bw2/2 - .005, -.004, 0));
          for (let k2 = 1; k2 <= 3; k2++)          // 页层
            grp.add(box(bw2 - .004, .0007, bd2 + .011, lineM, 0, th*k2/4, 0));
          for (let k2 = 0; k2 < 4; k2++)           // 封面上细字行
            grp.add(box(bw2*.52, .0008, .0016, lineM, -bw2*.04, th + .0048, -bd2*.17 + k2*.030));
          grp.position.set(bx, bkY, bz3);
          grp.rotation.y = ry; grp.rotation.z = tilt || 0;
          g.add(grp);
        };
        // 摊开的书：左右两页 + 中间书脊缝
        leaf(.30, .22, kraft, -w*.28, z1 - .56, -.18, -.045, .034);
        leaf(.30, .22, kraft, -w*.28 + .305, z1 - .56, -.18, .045, .034);
        g.add(box(.014, .038, .224, kraft, -w*.28 + .152, bkY + .017, z1 - .56));
        leaf(.42, .30, cream, w*.015, z1 - .47, .10, 0, .052);   // 白色大书
        leaf(.28, .20, kraft, w*.17, z1 - .27, -.24, 0, .040);   // 米色小书
      }
      break;
    }
    case 'premiumdresser': {
      /* 高端梳妆台（黑胡桃 · 参照实拍重制）
       * 通长圆角厚台面 / 抽拉搭板 / 马蹄形镂空整板侧腿 / 3+2 斗柜 + 回纹雕刻腰线
       * / 超椭圆台式翻转镜 / 曲面座拱形镂空凳 / 粗陶瓶柿子枝摆件 */
      const col = (c && c !== '#ddd') ? c : '#3d2c22';
      // 程序化黑胡桃木纹：低频弯曲年轮 + 心材色差 + 细微噪点。
      // 灰度图乘以家具颜色，保留改色能力，又呈现自然实木山纹（避免等距细横条的贴皮感）
      if (!V._dresserGrain){
        const CW = 512, CH = 256;
        const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
        const x2 = cv.getContext('2d');
        const img = x2.createImageData(CW, CH), D = img.data;
        let seed = 20240617;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const p0 = rnd() * 6.283, p1 = rnd() * 6.283, p2 = rnd() * 6.283, p3 = rnd() * 6.283;
        for (let py = 0; py < CH; py++){
          for (let px = 0; px < CW; px++){
            // 年轮整体水平走向，被多频低频正弦弯成山纹 / 水波纹
            const warp = 23 * Math.sin(px / 112 + p0) + 9 * Math.sin(px / 43 + p1)
                       + 3.2 * Math.sin(px / 17 + p2);
            const yy = py + warp;
            let t = Math.sin(yy * .068 + 1.15 * Math.sin(px / 190 + p3)
                           + .55 * Math.sin(px / 67 + p2));  // 相位扰动：年轮间距不等
            t += .26 * Math.sin(yy * .21 + px * .0055);
            t += .10 * Math.sin(yy * .55 + p1);
            t += .30 * Math.sin(px / 165 + p1) * Math.cos(py / 110 + p2); // 心材深浅
            let k = 1 - (t * .5 + .5) * .17;      // 0.83 ~ 1.00，纹理更柔和
            k += (rnd() - .5) * .022;              // 细噪点
            const g = Math.max(0, Math.min(255, Math.round(k * 255)));
            const i4 = (py * CW + px) * 4;
            D[i4] = D[i4 + 1] = D[i4 + 2] = g; D[i4 + 3] = 255;
          }
        }
        x2.putImageData(img, 0, 0);
        const t = new THREE.CanvasTexture(cv);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
        V._dresserGrain = t;
      }
      const grain = V._dresserGrain;
      // 材质也走缓存：clearGroup 只释放 geometry，若每次重建都 clone 新材质会累积泄漏
      if (!V._dresserMats) V._dresserMats = new Map();
      const W = (base, rough = .58) => {
        const key = base + '|' + rough;
        let m = V._dresserMats.get(key);
        if (!m){
          m = mat(base, {roughness: rough}).clone();
          m.map = grain; m.needsUpdate = true;
          V._dresserMats.set(key, m);
        }
        return m;
      };
      const wood = W(col), woodD = W(darker(col, .70), .66), woodL = W(lighter(col, .09), .5);
      const carveHi = W(lighter(col, .14), .62), darkLine = W(darker(col, .55), .7);
      const gapMat = mat('#150e09', {roughness: 1});

      const topY = .75, topT = .044;
      const dressW = w * .57, openW = w - dressW;
      const dressX = -w / 2 + openW + dressW / 2;
      const dressH = topY - topT - .052, cabY = .046;
      const faceZ = d / 2 - .006, bz2 = -d / 2;

      // —— 1. 通长台面：圆角厚板 + 前缘亮边 + 实木拼板缝 + 下沿暗影 ——
      g.add(rbox(w, topT, d, wood, 0, topY - topT, 0, .018));
      g.add(box(w - .07, .0025, .003, woodL, 0, topY - .006, d / 2 - .002));
      for (let i = 1; i < 4; i++)
        g.add(box(.0014, .0012, d - .07, darkLine, -w / 2 + w * i / 4, topY, 0));
      g.add(box(w - .04, .004, d - .04, woodD, 0, topY - topT - .004, 0));

      // —— 2. 抽拉搭板：台面中部向前探出的薄板（实拍里斜搭的那一块） ——
      {
        const e = new THREE.Group();
        e.add(rbox(.60, .015, d * .60, wood, 0, 0, 0, .008));
        e.add(box(.58, .002, .003, woodL, 0, .013, d * .30 - .012));
        e.add(box(.58, .002, .003, darkLine, 0, .013, -d * .30 + .012));
        e.position.set(-w / 2 + openW * .86, topY + .012, d * .14);
        e.rotation.y = -.10; e.rotation.x = -.012;
        g.add(e);
      }

      // —— 3. 左侧马蹄形镂空整板侧腿（一整块厚板挖水滴形孔，带倒角） ——
      {
        const lH = topY - topT, lD = d * .92, hw = lD / 2, thk = .052;
        const s = new THREE.Shape();
        s.moveTo(-hw, 0); s.lineTo(hw, 0);
        s.lineTo(hw, lH * .86); s.quadraticCurveTo(hw, lH, hw - .026, lH);
        s.lineTo(-hw + .026, lH); s.quadraticCurveTo(-hw, lH, -hw, lH * .86);
        s.closePath();
        const hole = new THREE.Path();
        const cy = lH * .45, rx = lD * .27, ry = lH * .32;
        for (let i = 0; i <= 64; i++){
          const a = i / 64 * Math.PI * 2, sn = Math.sin(a);
          const px = Math.cos(a) * rx * (1 + .22 * Math.max(0, -sn));
          const py = cy + sn * ry * (sn < 0 ? 1.06 : 1);
          i ? hole.lineTo(px, py) : hole.moveTo(px, py);
        }
        hole.closePath(); s.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(s, {depth: thk, bevelEnabled: true,
          bevelThickness: .004, bevelSize: .004, bevelSegments: 2, curveSegments: 20});
        const leg = mesh(geo, wood);
        leg.rotation.y = Math.PI / 2;
        leg.position.set(-w / 2 + .014, 0, 0);
        g.add(leg);
      }
      // 开放区与斗柜之间的竖板 + 后侧加固横撑
      g.add(box(.028, dressH - .01, d - .06, wood, -w / 2 + openW + .014, cabY, -.012));
      g.add(box(openW - .06, .026, .022, woodD, -w / 2 + openW / 2, topY - topT - .05, bz2 + .03));

      // —— 4. 右侧斗柜：内缩踢脚 + 柜体 + 正面外框 + 3 小抽 / 2 大抽 + 回纹雕刻腰线 ——
      g.add(box(dressW - .10, cabY, d - .13, woodD, dressX, 0, -.02));
      g.add(box(dressW - .024, dressH, d - .055, wood, dressX, cabY, -.012));
      const fw = .020;
      const fx0 = dressX - dressW / 2 + .024, fx1 = dressX + dressW / 2 - .024;
      const fy0 = cabY + .020, fy1 = cabY + dressH - .020;
      [-1, 1].forEach(s => g.add(box(fw, fy1 - fy0, .014, woodL, dressX + s * (dressW / 2 - .012), fy0, faceZ - .002)));
      g.add(box(dressW - .024, fw, .014, woodL, dressX, fy0, faceZ - .002));
      g.add(box(dressW - .024, fw, .014, woodL, dressX, fy1 - fw, faceZ - .002));

      const inW = fx1 - fx0 - fw * 2, inX = (fx0 + fx1) / 2;
      const iy0 = fy0 + fw, iy1 = fy1 - fw, inH = iy1 - iy0;
      const hTop = inH * .31, hBand = inH * .095, hBot = inH - hTop - hBand;
      const yBand = iy0 + hBot, yTop = yBand + hBand;
      const drawer = (cx, yb, dw, dh) => {
        g.add(box(dw, dh, .004, gapMat, cx, yb, faceZ + .001));                    // 缝隙透出的暗色
        g.add(rbox(dw - .007, dh - .007, .018, wood, cx, yb + .0035, faceZ + .007, .005));
        const pw = dw - .007;
        g.add(box(pw * .80, .004, .003, woodD, cx, yb + dh - .026, faceZ + .017)); // 上沿隐形拉槽
        g.add(box(pw * .80, .0016, .002, woodL, cx, yb + dh - .022, faceZ + .018));
        g.add(box(.0013, dh - .04, .001, darkLine, cx - pw * .22, yb + .022, faceZ + .017));
        g.add(box(.0013, dh - .04, .001, darkLine, cx + pw * .22, yb + .022, faceZ + .017));
      };
      const tw = inW / 3;
      for (let i = 0; i < 3; i++) drawer(inX - inW / 2 + tw * (i + .5), yTop, tw, hTop);
      const bw = inW / 2;
      for (let i = 0; i < 2; i++) drawer(inX - inW / 2 + bw * (i + .5), iy0, bw, hBot);
      // 腰线：深色底带 + 上下亮边 + 疏朗的手作「回」字浮雕（单元更少更大，避免齿轮带感）
      g.add(box(inW, hBand, .006, woodD, inX, yBand, faceZ + .005));
      g.add(box(inW, .003, .008, woodL, inX, yBand, faceZ + .010));
      g.add(box(inW, .003, .008, woodL, inX, yBand + hBand - .003, faceZ + .010));
      const nn = Math.max(9, Math.round(inW / .092)), st = inW / nn;
      const q = Math.min(st * .30, .026), hh = hBand * .30, yc = yBand + hBand * .44;
      for (let i = 0; i < nn; i++){
        const cx = inX - inW / 2 + st * (i + .5);
        g.add(box(q * 2, .005, .005, carveHi, cx, yc + hh / 2, faceZ + .012)); // 上横
        g.add(box(q * 2, .005, .005, carveHi, cx, yc - hh / 2, faceZ + .012)); // 下横
        g.add(box(.005, hh, .005, carveHi, cx - q, yc - hh / 2, faceZ + .012)); // 左竖
        g.add(box(.005, hh, .005, carveHi, cx + q, yc - hh / 2, faceZ + .012)); // 右竖
        g.add(box(q * .9, .005, .005, woodL, cx, yc, faceZ + .013));             // 内芯短横
        g.add(box(.008, .008, .006, gapMat, cx, yc, faceZ + .014));              // 凿点
      }

      // —— 5. 曲面座 · 拱形镂空梳妆凳 ——
      {
        const sw = Math.min(.46, openW * .46), sd = Math.min(.36, d * .68);
        const seatY = .435, sx = -w / 2 + openW * .50, sz = d * .12;
        const sg = new THREE.BoxGeometry(sw, .034, sd, 1, 1, 18);
        const pa = sg.attributes.position;
        for (let i = 0; i < pa.count; i++){
          const zz = pa.getZ(i) / (sd / 2);
          pa.setY(i, pa.getY(i) + .013 * zz * zz);         // 两端微翘的马鞍曲面
        }
        sg.computeVertexNormals();
        const seat = mesh(sg, wood); seat.position.set(sx, seatY, sz); g.add(seat);
        g.add(box(sw - .02, .002, .002, woodL, sx, seatY + .032, sz + sd / 2 - .006));
        [-1, 1].forEach(s => {
          const lx = sx + s * (sw / 2 - .024), hw2 = sd * .46;
          const sh = new THREE.Shape();
          sh.moveTo(-hw2, 0); sh.lineTo(hw2, 0);
          sh.lineTo(hw2 * .96, seatY - .012); sh.lineTo(-hw2 * .96, seatY - .012); sh.closePath();
          const hh = new THREE.Path();
          const yb = seatY * .17, yt = seatY * .76, rx = sd * .30;
          hh.moveTo(-rx, yb); hh.lineTo(rx, yb);
          for (let i = 1; i <= 28; i++){
            const a = i / 28 * Math.PI;
            hh.lineTo(rx * Math.cos(a), yb + (yt - yb) * Math.sin(a));
          }
          hh.closePath(); sh.holes.push(hh);
          const eg = new THREE.ExtrudeGeometry(sh, {depth: .030, bevelEnabled: true,
            bevelThickness: .003, bevelSize: .003, bevelSegments: 2, curveSegments: 16});
          const pan = mesh(eg, wood);
          pan.rotation.y = Math.PI / 2;
          pan.position.set(lx - .015, 0, sz);
          g.add(pan);
        });
        [-1, 1].forEach(s => g.add(box(sw - .06, .020, .018, woodD, sx, seatY * .30, sz + s * (sd * .40))));
      }

      // —— 6. 超椭圆台式翻转化妆镜：托盘底座 → 双柱铰轴 → 中空木框 + 嵌镜 ——
      {
        const mx = -w / 2 + openW * .40, mz = bz2 + .14;
        const mw = .34, mh = .39, mt = .024, pivotY = .112;
        const superPts = (rw, rh, n, seg) => {
          const out = [];
          for (let i = 0; i <= seg; i++){
            const a = i / seg * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
            out.push([Math.sign(cs) * Math.pow(Math.abs(cs), 2 / n) * rw,
                      Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * rh]);
          }
          return out;
        };
        g.add(rbox(.30, .016, .11, wood, mx, topY, mz, .007));
        g.add(box(.30, .004, .004, woodL, mx, topY + .014, mz + .052));
        [-1, 1].forEach(s => {
          g.add(rbox(.024, pivotY - .016, .024, wood, mx + s * .118, topY + .016, mz, .006));
          const pin = cyl(.011, .011, .020, woodD, mx + s * .118, topY + pivotY - .010, mz, 16);
          pin.rotation.x = Math.PI / 2; g.add(pin);
        });
        const outer = new THREE.Shape();
        superPts(mw / 2, mh / 2, 3.2, 64).forEach((p, i) => i ? outer.lineTo(p[0], p[1]) : outer.moveTo(p[0], p[1]));
        const innerPts = superPts(mw / 2 - .026, mh / 2 - .026, 3.2, 64);
        const inner = new THREE.Path();
        innerPts.forEach((p, i) => i ? inner.lineTo(p[0], p[1]) : inner.moveTo(p[0], p[1]));
        outer.holes.push(inner);
        const frameGeo = new THREE.ExtrudeGeometry(outer, {depth: mt, bevelEnabled: true,
          bevelThickness: .003, bevelSize: .003, bevelSegments: 2, curveSegments: 16});
        const frame = mesh(frameGeo, wood); frame.position.set(0, mh / 2, 0);
        const glassShape = new THREE.Shape();
        superPts(mw / 2 - .024, mh / 2 - .024, 3.2, 64)
          .forEach((p, i) => i ? glassShape.lineTo(p[0], p[1]) : glassShape.moveTo(p[0], p[1]));
        const glass = mesh(new THREE.ShapeGeometry(glassShape, 16), mirror());
        glass.position.set(0, mh / 2, mt * .55);
        // 木背板：从背面看镜框里不是空洞
        const back = mesh(new THREE.ShapeGeometry(glassShape, 16), woodD);
        back.position.set(0, mh / 2, mt * .12); back.rotation.y = Math.PI;
        const mg = new THREE.Group(); mg.add(frame, glass, back);
        mg.position.set(mx, topY + pivotY, mz + .006);
        mg.rotation.x = -.12;
        g.add(mg);
      }

      // —— 7. 台面摆件：小木托盘 / 相框 / 粗陶瓶 + 柿子枝 ——
      {
        const tx = -w / 2 + openW * .74, tz = bz2 + .12;
        g.add(cyl(.046, .043, .009, woodL, tx, topY, tz, 24));
        for (let i = 0; i < 3; i++){
          const a = i / 3 * Math.PI * 2;
          g.add(cyl(.005, .005, .012, woodD, tx + Math.cos(a) * .028, topY - .012, tz + Math.sin(a) * .028, 8));
        }
        const phx = tx + .13, phz = tz - .01;
        g.add(rbox(.075, .10, .008, woodD, phx, topY, phz, .004));
        g.add(box(.058, .082, .002, mat('#e8e2d6', {roughness: .9}), phx, topY + .009, phz + .005));
        g.add(box(.075, .010, .010, wood, phx, topY, phz + .012));
      }
      {
        const vx = dressX + dressW * .28, vz = -.045;
        g.add(lathe([[0, 0], [.050, 0], [.064, .018], [.071, .10], [.062, .21], [.041, .275], [.044, .302]],
          ceramic({roughness: .93}), vx, topY, vz, 36));
        g.add(cyl(.032, .032, .004, mat('#8d857a', {roughness: 1}), vx, topY + .298, vz, 24));
        const bm = woodM('#4c3a29'), pm = mat('#c9661f', {roughness: .74}),
              pl = mat('#d98b3a', {roughness: .82});
        const fruit = (x, y, z, r) => {
          g.add(blob(r, r * .86, r, pm, x, y, z, 16));                       // 柿果
          g.add(blob(r * .52, .0022, r * .52, pl, x, y + r * .82, z, 10));   // 果蒂
          g.add(cyl(r * .34, r * .34, .004, woodD, x, y + r * .81, z, 10));  // 萼片
          g.add(cyl(.0016, .0016, .014, bm, x, y + r * .84, z, 6));          // 果柄
        };
        for (let k = 0; k < 9; k++){
          const a = -1.62 + k * .405 + (k % 2) * .07;
          const L = .20 + (k % 3) * .075;
          const ex = vx + Math.cos(a) * L * .92,
                ey = topY + .30 + L * (.62 + (k % 3) * .12),
                ez = vz + Math.sin(a) * L * .56;
          const mx2 = vx + Math.cos(a) * L * .40,
                my2 = topY + .32 + L * .34,
                mz2 = vz + Math.sin(a) * L * .26;
          g.add(tube([[vx, topY + .29, vz], [mx2, my2, mz2], [ex, ey, ez]], .0019, bm, 14));
          fruit(ex, ey, ez, .015 + (k % 3) * .003);
          if (k % 3 === 1){ // 侧枝分叉，再挂一枚小果
            const bx = mx2 + Math.cos(a + .55) * .075, by = my2 + .062,
                  bz = mz2 + .032;
            g.add(tube([[mx2, my2, mz2],
                        [mx2 + Math.cos(a + .55) * .05, my2 + .035, mz2 + .02],
                        [bx, by, bz]], .0014, bm, 8));
            fruit(bx, by, bz, .010);
          }
        }
      }
      break;
    }
    case 'sofa': case 'armchair': case 'loveseat': {
      const fab = fabric(c), dk = fabric(darker(c, .86)), piping = fabric(lighter(c, .3));
      const a = Math.min(.18, w*.14), n = f.type === 'armchair' ? 1 : (w > 2.2 ? 3 : 2);
      const cw = (w - 2*a)/n, bd = Math.min(.2, d*.24), lh = .12, sd = d - bd - .02;
      legs(g, w, d, lh, woodM('#3a3027'), .07, .018);
      g.add(rbox(w, .16, d, dk, 0, lh, 0, .03), rbox(w, .73, bd, dk, 0, lh, bz + bd/2, .06));
      // 靠背分段软包：竖向绗缝 + 拉扣
      for (let i = 0; i < n; i++){
        const x = -w/2 + a + cw*(i + .5);
        g.add(rbox(cw - .02, .6, .055, fab, x, lh + .18, bz + bd*.62, .05));
        for (let k = 0; k < 2; k++) g.add(blob(.013, .013, .006, dk, x + cw*(k - .5)*.28, lh + .46, bz + bd*.62 + .052, 10));
      }
      for (let i = 1; i < n; i++) g.add(box(.008, .58, .008, dk, -w/2 + a + cw*i, lh + .18, bz + bd*.62 + .05));
      // 扶手 + 滚边
      [-1, 1].forEach(sg => {
        g.add(rbox(a, .5, d, dk, sg*(w/2 - a/2), lh, 0, .07));
        g.add(rbox(.014, .014, d - .06, piping, sg*(w/2 - a/2), lh + .5, .01, .005));
      });
      // 坐垫：前缘滚边 + 中缝
      for (let i = 0; i < n; i++){
        const x = -w/2 + a + cw/2 + i*cw;
        g.add(rbox(cw - .012, .15, sd, fab, x, lh + .16, bz + bd + sd/2, .055), rot(rbox(cw - .03, .44, .16, fab, x, lh + .3, bz + bd + .08, .07), -.16));
        g.add(rbox(cw - .04, .012, .012, piping, x, lh + .16, d/2 - .024, .005));
        g.add(box(.006, .006, sd - .07, dk, x, lh + .315, bz + bd + sd/2));
      }
      // 抱枕：缝边 + 四角皱褶
      const cush = (x, pc, tilt) => {
        const o = rbox(.42, .42, .12, fabric(pc), x, lh + .32, bz + bd + .22, .06);
        g.add(rot(o, -.28, tilt, 0));
        g.add(rot(rbox(.43, .43, .008, dk, x, lh + .32, bz + bd + .22 - .055, .06), -.28, tilt, 0));
        g.add(blob(.024, .024, .024, fabric(pc), x - .17, lh + .33, bz + bd + .3, 10));
      };
      if (n > 1){ cush(-(w/2 - a - .28), lighter(c, .32), -.22); cush(w/2 - a - .28, darker(c, .68), .22); }
      else cush(0, lighter(c, .3), 0);
      // 搭毯：一侧垂下的布
      const throwX = -w/2 + a + cw*.3;
      g.add(rot(rbox(cw*.62, .02, sd*.82, fabric(darker(c, .74)), throwX, lh + .31, bz + bd + sd*.55, .01), 0, 0, .02));
      g.add(rot(rbox(.02, .28, sd*.82, fabric(darker(c, .74)), throwX - cw*.31, lh + .04, bz + bd + sd*.55, .008), 0, 0, -.06));
      break;
    }
    case 'cornersofa': {
      const k = Math.min(.95, d*.56, w*.4), b = .2, fab = fabric(c), dk = fabric(darker(c, .86)), piping = fabric(lighter(c, .3)), lh = .1, sw = (w - b - .2)/2;
      [[-w/2+.07, bz+.07], [w/2-.07, bz+.07], [w/2-.07, bz+k-.07], [-w/2+.07, d/2-.07], [-w/2+k-.07, d/2-.07], [-w/2+k-.07, bz+k-.07]]
        .forEach(([x, z]) => g.add(rod([x, 0, z], [x, lh, z], .012, woodM('#3a3027'), .018)));
      g.add(rbox(w, .18, k, dk, 0, lh, bz + k/2, .03), rbox(k, .18, d - k + .02, dk, -w/2 + k/2, lh, bz + k + (d - k)/2 - .01, .03));
      g.add(rbox(w, .72, b, dk, 0, lh, bz + b/2, .06), rbox(b, .72, d, dk, -w/2 + b/2, lh, 0, .06), rbox(.2, .5, k, dk, w/2 - .1, lh, bz + k/2, .07), rbox(k, .5, .2, dk, -w/2 + k/2, lh, d/2 - .1, .07));
      // 横向两段坐垫 + 拉扣
      for (let i = 0; i < 2; i++){
        const x = -w/2 + b + sw/2 + i*sw;
        g.add(rbox(sw - .012, .15, k - b - .02, fab, x, lh + .18, bz + b + (k - b)/2, .055), rot(rbox(sw - .04, .42, .16, fab, x, lh + .3, bz + b + .07, .07), -.16));
        g.add(rbox(sw - .05, .012, .012, piping, x, lh + .18, bz + k - .03, .005));
        for (let q = 0; q < 2; q++) g.add(blob(.012, .012, .006, dk, x + sw*(q - .5)*.26, lh + .46, bz + b*.55, 10));
      }
      // 竖向贵妃段坐垫 + 分缝
      g.add(rbox(k - b - .02, .15, d - k - .22, fab, -w/2 + b + (k - b)/2, lh + .18, bz + k + (d - k - .2)/2, .055));
      const L = d - .2 - b - .18, nl = Math.max(1, Math.round(L/.75));
      for (let i = 0; i < nl; i++) g.add(rot(rbox(.16, .42, L/nl - .03, fab, -w/2 + b + .07, lh + .3, bz + b + .18 + L/nl*(i + .5), .07), 0, 0, .16));
      // 靠背滚边
      g.add(rbox(w - .06, .012, .012, piping, 0, lh + .72, bz + b*.6, .005));
      // 抱枕
      [[-w/2 + b + .3, lighter(c, .32), .6], [w/2 - .5, darker(c, .68), -.25]].forEach(([x, pc, tilt]) => {
        g.add(rot(rbox(.42, .42, .12, fabric(pc), x, lh + .34, bz + b + .24, .06), -.35, tilt, 0));
        g.add(blob(.024, .024, .024, fabric(pc), x - .15, lh + .35, bz + b + .32, 10));
      });
      break;
    }
    case 'nightstand': {
      const wm = furnCabMat(f, c), h = cabHm(f), body = Math.max(.28, h - .1);
      legs(g, w, d, .1, woodM('#5a4a3b'), .04, .014);
      g.add(rbox(w, body, d - .02, wm, 0, .1, -.01, .012));
      fronts(g, -w/2 + .02, .12, w - .04, body - .04, d/2 - .02, 1, 2, wm, 'bar');
      tableLamp(g, -w*.12, h, -d*.12);
      g.add(box(.16, .025, .22, '#2f5d62', w*.24, h, .04), box(.14, .02, .2, '#e6dccd', w*.24, h + .025, .04));
      break;
    }
    case 'premiumshoecab': {
      /* 高端定制鞋柜（参照实拍）：深胡桃木柜体 · 三扇胶囊形藤编门 · 暖光开放格 ·
         格栅翻斗抽屉 · 下部对开门 · 底部悬空鞋区 · 通高对开门 · 黄铜小圆点拉手
         按默认 2.4 m 建模，再按可编辑高度纵向缩放 */
      const H0 = 2.4, H = cabHm(f), sy = H / H0;
      const fz = d / 2, back = -d / 2 + .012, pz = fz - .01;
      const wood = furnCabMat(f, c), edge = woodM(darker(c, .72));
      const grain = woodM(lighter(c, .06)), grainD = woodM(darker(c, .88));
      const fluteGap = mat('#2a1c14', {roughness:.85}), fluteBar = woodM('#6d4a32');
      const warm = woodM('#8a5330');
      const brass = mat('#c9a45d', {metalness:.85, roughness:.28});
      const cane = mat('#d9cbb0', {roughness:.92, side:THREE.DoubleSide});
      const caneLine = mat('#ad9878', {roughness:.95, side:THREE.DoubleSide});
      const lit = glowMat('#ffb45c', '#ff8a30', .9);
      const halo = mat('#df8c3c', {emissive:'#d97b32', emissiveIntensity:.42, roughness:1,
        transparent:true, opacity:.58, side:THREE.DoubleSide, depthWrite:false});
      const WL = w * .60, WR = w - WL, x0 = -w / 2, xd = x0 + WL;
      const xL = x0 + WL / 2, xR = xd + WR / 2, topIn = H0 - .028;
      const cab = new THREE.Group();
      const add = (...os) => { os.forEach(o => cab.add(o)); };

      /* —— 柜体骨架：背板 / 左右侧板 / 分区立板 / 顶板 / 左区分层板 / 右区踢脚 —— */
      add(box(w, H0 - .02, .018, edge, 0, .02, back));
      add(box(.022, H0, d, wood, x0 + .011, 0, 0), box(.022, H0, d, wood, -x0 - .011, 0, 0));
      add(box(.022, H0, d, wood, xd, 0, 0));
      add(box(w, .028, d, wood, 0, topIn, 0));
      add(box(WR - .02, .055, d - .02, edge, xR, 0, 0));
      [.13, .81, 1.03, 1.46].forEach(y => add(box(WL - .03, .016, d - .03, wood, xL, y, 0)));

      /* 门板正面直木纹：深浅细线，模拟黑胡桃竖纹 */
      const grainOn = (cx, pw, y0, ph, n) => {
        for (let k = 0; k < n; k++){
          const gx = cx - pw / 2 + pw * (k + .3 + R() * .5) / n;
          add(box(.0013, ph, .0008, k % 3 === 0 ? grain : grainD, gx, y0, fz + .0005));
        }
      };
      const knobAt = (x, y) => add(blob(.011, .011, .007, brass, x, y, fz + .007, 14));

      /* —— 上部：三扇胶囊形藤编门（1.46 → 顶板下沿） —— */
      const doorW = WL / 3, doorY0 = 1.474, doorH = topIn - doorY0;
      const cyR = doorY0 + doorH / 2, cw = doorW * .70, ch = doorH * .86;
      const R2 = cw / 2, halfR = (ch - cw) / 2, step = .020;
      for (let i = 0; i < 3; i++){
        const cx = x0 + doorW * (i + .5);
        add(box(doorW - .008, doorH, .02, wood, cx, doorY0, pz));
        grainOn(cx, doorW - .02, doorY0 + .02, doorH - .04, 3);
        const rim = mesh(new THREE.ShapeGeometry(rrect(cw + .018, ch + .018, R2 + .009)), edge);
        rim.position.set(cx, cyR, fz + .002); add(rim);
        const face = mesh(new THREE.ShapeGeometry(rrect(cw, ch, R2)), cane);
        face.position.set(cx, cyR, fz + .003); add(face);
        /* 藤编交叉网格：横竖细条，按胶囊轮廓逐条裁剪 */
        for (let xx = -R2 + step * .5; xx < R2; xx += step){
          const yy = halfR + Math.sqrt(Math.max(0, R2 * R2 - xx * xx));
          if (yy < .03) continue;
          add(box(.0024, yy * 2, .0012, caneLine, cx + xx, cyR - yy, fz + .005));
        }
        for (let yy = -ch / 2 + step * .5; yy < ch / 2; yy += step){
          const a = Math.abs(yy);
          let hw = R2;
          if (a > halfR){ const dy = a - halfR; hw = Math.sqrt(Math.max(0, R2 * R2 - dy * dy)); }
          if (hw < .012) continue;
          add(box(hw * 2, .0024, .0012, caneLine, cx, cyR + yy, fz + .005));
        }
        knobAt(cx + doorW * .28, doorY0 + .026);
        knobAt(cx + doorW * .28 - .05, doorY0 + .026);
      }

      /* —— 中部：暖光开放格 —— 暖木背板 + 光晕 + 顶部灯带 + 花瓶 / 书 / 小摆件 —— */
      const nH = 1.46 - 1.03;
      add(box(WL - .05, nH - .02, .012, warm, xL, 1.04, back + .014));
      add(box(WL - .08, nH - .04, .003, halo, xL, 1.05, back + .023));
      add(box(WL - .06, .018, .022, lit, xL, 1.46 - .030, fz - .045));
      /* 分区横框：实拍里藤编门底 / 开放格下沿的深木横带 */
      add(box(WL - .02, .038, .006, edge, xL, 1.422, fz + .002));
      add(box(WL - .02, .026, .006, edge, xL, 1.004, fz + .002));
      vase(cab, x0 + WL * .17, 1.046, back + .07, .045, .17, '#c9bda8', R);
      add(box(.20, .022, .14, mat('#e9e2d4'), xL - .01, 1.046, back + .085),
            box(.18, .018, .13, mat('#c5b69f'), xL - .01, 1.068, back + .085),
            box(.16, .016, .12, mat('#f2eee4'), xL - .01, 1.086, back + .085));
      const bx = x0 + WL * .80, by = 1.046, bz2 = back + .085;
      add(blob(.032, .042, .028, ceramic(), bx, by + .042, bz2, 14),
            blob(.024, .026, .022, ceramic(), bx, by + .094, bz2, 12));
      add(rot(box(.009, .058, .009, ceramic(), bx - .013, by + .112, bz2), 0, 0, .17),
            rot(box(.009, .058, .009, ceramic(), bx + .013, by + .112, bz2), 0, 0, -.17));

      /* —— 格栅翻斗抽屉（0.81 → 1.03）：细密竖条 + 三颗黄铜圆点 —— */
      const dY0 = .81, dH = .22, dw = (WL - .03) / 3, step2 = Math.max(.010, dw / 22);
      for (let i = 0; i < 3; i++){
        const cx = x0 + .015 + dw * (i + .5);
        add(box(dw - .006, dH - .01, .02, fluteGap, cx, dY0 + .005, pz));
        for (let k = 1; k * step2 < dw - .012; k++){
          const gx = cx - dw / 2 + k * step2;
          add(box(.0055, dH - .03, .0022, fluteBar, gx, dY0 + .02, fz + .002));
          add(box(.0012, dH - .03, .001, grainD, gx - .0034, dY0 + .02, fz + .003));
        }
        knobAt(cx, dY0 + dH / 2);
      }

      /* —— 下部：两扇平板对开门（0.13 → 0.81） —— */
      const lY0 = .13, lH = .68, lpw = (WL - .03) / 2;
      for (let i = 0; i < 2; i++){
        const cx = x0 + .015 + lpw * (i + .5);
        add(box(lpw - .008, lH - .01, .02, wood, cx, lY0 + .005, pz));
        grainOn(cx, lpw - .02, lY0 + .02, lH - .04, 3);
        knobAt(i === 0 ? cx + lpw / 2 - .045 : cx - lpw / 2 + .045, lY0 + lH - .08);
      }

      /* —— 右区：通高双开门，中缝 + 一对黄铜圆点 —— */
      const rY0 = .055, rH = topIn - rY0, rpw = WR / 2 - .006;
      for (let i = 0; i < 2; i++){
        const cx = xd + WR / 2 + (i ? 1 : -1) * WR / 4;
        add(box(rpw - .006, rH, .02, wood, cx, rY0, pz));
        grainOn(cx, rpw - .02, rY0 + .03, rH - .06, 5);
        knobAt(i === 0 ? cx + rpw / 2 - .042 : cx - rpw / 2 + .042, 1.30);
      }

      add(box(.007, rH, .004, edge, xd + WR / 2, rY0, fz + .002));   // 通高门中缝

      /* —— 底部悬空鞋区（0 → 0.13）：四双便鞋 —— */
      const shoes = [['#5b6f8c', '#ebe7df'], ['#c98f83', '#f2ebe3'], ['#dcd7cd', '#8d8a82'], ['#96a89a', '#f0ede6']];
      shoes.forEach((pair, si) => {
        const sx = x0 + .10 + si * (WL - .20) / 4;
        for (let k = 0; k < 2; k++){
          const px = sx + k * .085, pz2 = fz - .13 + (si % 2 ? .012 : 0);
          add(box(.13, .010, .062, mat('#efe9df'), px, .002, pz2));
          add(box(.13, .005, .063, mat('#463a31'), px, .012, pz2));
          add(blob(.068, .027, .030, mat(pair[0]), px, .032, pz2, 14));
          add(blob(.040, .012, .026, mat(pair[1]), px - .022, .051, pz2, 10));
        }
      });
      cab.scale.y = sy;
      g.add(cab);
      break;
    }
    case 'wardrobe': case 'cabinet': case 'shoecab': {
      const cm = furnCabMat(f, c), fz = d/2 - .02;
      if (f.type === 'wardrobe'){
        const h = cabHm(f), n = Math.max(1, Math.round(w/.5));
        g.add(box(w - .02, .08, d - .06, '#4a4641', 0, 0, -.03), box(w, h - .08, d - .02, cm, 0, .08, -.01));
        fronts(g, -w/2, .08, w, h - .1, fz, n, 1, cm, 'bar', Math.min(1.05, h * .48));
        g.add(box(w, .02, d - .02, darker(c, .9), 0, h - .02, -.01));
      } else if (f.type === 'shoecab'){
        const h = cabHm(f), y0 = Math.min(.16, h * .16), n = Math.max(1, Math.round(w/.45));
        g.add(box(w, h - y0, d - .02, cm, 0, y0, -.01), box(w - .04, .01, .03, glowMat('#fff7e6', '#ffe9c4', .8), 0, y0 - .01, fz - .06));   // 悬空 + 底部灯带
        fronts(g, -w/2, y0, w, h - y0, fz, n, 1, cm, 'edge');
        g.add(rbox(w + .01, .025, d, woodM(darker(c, .8)), 0, h, 0, .006));
        g.add(rbox(.22, .015, .14, woodM('#6b543f'), -w*.25, h + .025, 0, .006));
        vase(g, w*.28, h + .025, -.03, .05, .2, '#d8cfc2', R);
      } else {
        const h = cabHm(f), n = Math.max(1, Math.round(w/.5));
        const y0 = .1, body = Math.max(.4, h - .13), drawerH = Math.min(.22, body * .28), doorH = body - drawerH;
        legs(g, w, d, y0, woodM('#3a3027'), .05, .016);
        g.add(box(w, body, d - .02, cm, 0, y0, -.01));
        fronts(g, -w/2, y0 + doorH, w, drawerH, fz, n, 1, cm, 'bar');
        fronts(g, -w/2, y0, w, doorH, fz, n, 1, cm, 'bar', y0 + doorH * .75);
        g.add(rbox(w + .02, .03, d + .01, woodM(darker(c, .78)), 0, h - .03, 0, .008));
        vase(g, w*.3, h, 0, .07, .24, '#e9e2d6', R);
        g.add(rot(box(.3, .38, .02, woodM('#3a3027'), -w*.25, h, bz + .06), -.12), rot(box(.25, .33, .005, '#d9cfbf', -w*.25, h + .03, bz + .075), -.12));   // 靠墙画框
        g.add(lathe([[0, 0], [.05, 0], [.12, .06], [.13, .07]], mat('#b8a58c', {roughness:.5, side:THREE.DoubleSide}), 0, h, .02, 32));
        for (let k = 0; k < 3; k++) g.add(blob(.035, .035, .035, ['#d98c4a', '#c9ad4f', '#b5463a'][k], Math.cos(k*2.1)*.04, h + .045, .02 + Math.sin(k*2.1)*.04, 14));
      }
      break;
    }
    case 'dresser': {
      const wm = furnCabMat(f, c), h = cabHm(f), r = Math.min(.34, w*.3);
      const topY = h, drawerY = Math.max(.35, h - .17), legTop = drawerY;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a, b]) => g.add(rod([a*(w/2 - .04), 0, b*(d/2 - .04)], [a*(w/2 - .05), legTop, b*(d/2 - .05)], .012, wm, .02)));
      g.add(box(w - .04, .14, d - .04, wm, 0, drawerY), rbox(w, .03, d, wm, 0, topY - .03, 0, .008));
      fronts(g, -w/2 + .03, drawerY + .005, w - .06, .13, d/2 - .02, 2, 1, wm, 'knob');
      const mr = new THREE.Mesh(new THREE.TorusGeometry(r, .018, 12, 64), woodM(darker(c, .7))); mr.position.set(0, topY + .02 + r, bz + .04); sh(mr);
      const mg = new THREE.Mesh(new THREE.CircleGeometry(r, 64), mirror()); mg.position.set(0, topY + .02 + r, bz + .035);
      g.add(mr, mg, box(.08, .03, .06, woodM(darker(c, .7)), 0, topY, bz + .04));
      [['#e7c9b5', .03, .09], ['#b9d0d8', .025, .12], ['#f0e3cf', .02, .07]].forEach(([cc, rr, hh], i) => g.add(cyl(rr, rr, hh, mat(cc, {roughness:.15, transparent:true, opacity:.8}), w*.25 + i*.06, topY, .02)));
      g.add(rbox(.16, .06, .1, woodM('#6b543f'), -w*.28, topY, .03, .01));
      const sz = d/2 + .25;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a, b]) => g.add(rod([a*.13, 0, sz + b*.13], [a*.12, .4, sz + b*.12], .01, wm, .014)));
      g.add(rbox(.34, .08, .34, fabric('#e8ddd0'), 0, .4, sz, .035));
      break;
    }
    case 'desk': {
      const tm = woodM(c), bm = blackMetal();
      g.add(rbox(w, .025, d, tm, 0, .72, 0, .006));
      [-1, 1].forEach(s => {
        const x = s*(w/2 - .06);
        g.add(box(.03, .72, .03, bm, x, 0, d/2 - .06), box(.03, .72, .03, bm, x, 0, bz + .06), box(.03, .03, d - .1, bm, x, 0, 0), box(.03, .03, d - .1, bm, x, .69, 0));
      });
      g.add(box(w - .12, .04, .015, bm, 0, .66, bz + .06), box(.4, .09, d - .12, tm, w/2 - .32, .63, 0));
      pull(g, .16, false, w/2 - .32, .675, d/2 - .06);
      const my = .745, mz = bz + .15;
      g.add(rbox(.22, .012, .16, bm, 0, my, mz, .004), rod([0, my, mz - .02], [0, my + .2, mz - .03], .012, bm));
      g.add(rbox(.62, .37, .02, '#1d1d1f', 0, my + .12, mz - .04, .006), box(.6, .33, .002, screenMat('#27405c'), 0, my + .15, mz - .029));
      g.add(rbox(.42, .015, .13, '#e8e8ea', 0, my, .06, .004), rbox(.4, .004, .11, '#d2d2d6', 0, my + .014, .06, .002), blob(.03, .015, .05, '#e8e8ea', .3, my + .012, .07, 16));
      const lx = -w/2 + .15, lz = bz + .12;
      g.add(cyl(.07, .075, .02, bm, lx, my, lz, 28), tube([[lx, my + .02, lz], [lx, my + .3, lz + .03], [lx + .12, my + .42, lz + .1]], .008, bm));
      const hd = cyl(.02, .06, .1, bm, lx + .14, my + .34, lz + .12, 24); hd.rotation.x = .5; g.add(hd);
      g.add(cyl(.04, .038, .09, ceramic({roughness:.3}), w/2 - .15, my, .05, 20), rbox(.2, .015, .28, '#3b5566', -w/2 + .3, my, .1, .004));
      break;
    }
    case 'chair': {
      if (/户外|花园|庭院|outdoor|patio/i.test(f.name || '')){
        const wm = woodM(c), iron = mat('#5a534c', {metalness:.35, roughness:.45}), sy = .42;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
          g.add(rod([sx * (w / 2 - .04), 0, sz * (d / 2 - .04)], [sx * (w / 2 - .05), sy, sz * (d / 2 - .05)], .012, iron, .016)));
        for (let i = 0; i < 4; i++) g.add(rbox(w - .1, .028, .05, wm, 0, sy, -d / 2 + .08 + i * ((d - .16) / 3), .006));
        [-1, 1].forEach(sx => g.add(box(.04, .48, .04, wm, sx * (w / 2 - .05), sy, bz + .04)));
        for (let i = 0; i < 4; i++) g.add(rbox(w - .14, .05, .025, wm, 0, sy + .12 + i * .09, bz + .06, .005));
        g.add(box(w - .16, .03, .03, iron, 0, sy + .02, 0));
        break;
      }
      const lw = woodM('#6b543f'), fab = fabric(c), sy = .44;
      [[-1, 1], [1, 1]].forEach(([s]) => g.add(rod([s*(w/2 - .04), 0, d/2 - .05], [s*(w/2 - .05), sy, d/2 - .07], .012, lw, .018)));
      [-1, 1].forEach(s => g.add(rod([s*(w/2 - .04), 0, bz + .03], [s*(w/2 - .05), .86, bz + .07], .012, lw, .018)));
      g.add(box(w - .08, .025, .02, lw, 0, .15, d/2 - .06), box(w - .08, .025, .02, lw, 0, .15, bz + .05));
      [-1, 1].forEach(s => g.add(box(.02, .025, d - .12, lw, s*(w/2 - .045), .18, 0)));
      g.add(box(w - .06, .04, d - .1, lw, 0, sy - .03, 0), rbox(w - .04, .05, d - .08, fab, 0, sy, .005, .022));
      g.add(rot(rbox(w - .08, .15, .025, lw, 0, .66, bz + .065, .012), -.12), rot(box(w - .08, .025, .02, lw, 0, .52, bz + .055), -.12));
      break;
    }
    case 'bookshelf': {
      const h = cabHm(f), t = .022, ns = Math.max(3, Math.round((h - .06) / .35)), wm = furnCabMat(f, c), sh0 = (h - .06 - t)/ns, cols = ['#b88a6a','#6f8f8a','#d9c08c','#9aa58c','#a8675e','#e6dccd','#7d8ea3','#c9bfae'];
      g.add(box(w, h, .012, woodM(darker(c, .85)), 0, 0, bz + .006), box(t, h, d, wm, -w/2 + t/2), box(t, h, d, wm, w/2 - t/2), box(w - 2*t, .06, d - .03, wm, 0, 0, .0));
      for (let s = 0; s <= ns; s++){
        const y = s < ns ? .06 + s*sh0 : h - t; g.add(box(w - 2*t, t, d - .012, wm, 0, y, .006));
        if (s === ns) break;
        const yb = y + t, end = w/2 - t - .01; let x = -w/2 + t + .01, deco = R() < .55 ? x + R()*(w - .45) : 99;
        while (x < end - .03){
          if (x >= deco){
            deco = 99;
            if (R() < .5) vase(g, x + .07, yb, 0, .045, .16, cols[Math.floor(R()*8)], R, false);
            else for (let k = 0; k < 3; k++) g.add(box(.2 - k*.02, .028, d*.7, mat(cols[Math.floor(R()*8)], {roughness:.8}), x + .1, yb + k*.028, .01));
            x += .2; continue;
          }
          if (R() < .07){ x += .03 + R()*.05; continue; }
          const bw = .018 + R()*.03, bh = Math.min(sh0 - t - .03, .17 + R()*.13), bd = d*(.62 + R()*.22);
          if (x + bw > end) break;
          g.add(box(bw, bh, bd, mat(cols[Math.floor(R()*8)], {roughness:.75}), x + bw/2, yb, d/2 - .015 - bd/2));
          x += bw + .002;
        }
      }
      break;
    }
    case 'baycushion':
      g.add(rbox(w, .08, d, fabric(c), 0, .45, 0, .03));
      g.add(rot(rbox(w - .1, .34, .14, fabric('#ffffff'), 0, .52, bz + .14, .06), .25), rot(rbox(w - .1, .34, .14, fabric('#f0e6d6'), 0, .52, d/2 - .14, .06), -.25));
      g.add(rbox(w*.8, .04, .3, fabric(darker(c, .7)), 0, .53, d*.12, .02), rbox(.28, .015, .2, woodM('#8d7258'), 0, .53, -d*.15, .006), cyl(.035, .03, .06, ceramic(), 0, .545, -d*.15, 20));
      break;
    case 'coffeetable': {
      const tm = mat(c, {roughness:.32}), lw = blackMetal(), edge = woodM(darker(c, .8));
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a, b]) => g.add(rod([a*(w/2 - .05), 0, b*(d/2 - .05)], [a*(w/2 - .07), .365, b*(d/2 - .07)], .012, lw, .02)));
      g.add(rbox(w, .035, d, tm, 0, .365, 0, .015), rbox(w - .12, .02, d - .12, edge, 0, .12, 0, .006));
      // 台面：石材脉络 + 倒角亮边 + 玻璃反光层
      for (let i = 0; i < 3; i++){
        const zz = -d*.3 + i*d*.3;
        g.add(tube([[-w*.44, .402, zz - .04], [-w*.16, .402, zz + .05], [w*.12, .402, zz - .03], [w*.44, .402, zz + .02]], .0022, mat(darker(c, .8), {roughness:.5}), 24));
      }
      g.add(rbox(w - .03, .004, .01, mat('#ffffff', {roughness:.2, metalness:.1}), 0, .4, -d/2 + .018, .002));
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w*.5, d*.5), mat('#cfe0e6', {roughness:.06, metalness:.2, transparent:true, opacity:.12}));
      glass.rotation.x = -Math.PI/2; glass.position.set(w*.1, .404, 0); g.add(glass);
      // 托盘 + 书 + 杯 + 花瓶
      g.add(rbox(.38, .015, .26, woodM('#6b543f'), -w*.2, .4, 0, .006), box(.22, .025, .16, '#e6dccd', -w*.22, .415, 0));
      g.add(box(.28, .035, .2, '#2f5d62', w*.2, .14, 0), box(.26, .025, .19, '#d9b36c', w*.2, .17, .01));
      g.add(lathe([[0, 0], [.025, 0], [.035, .07], [.034, .08]], ceramic({side:THREE.DoubleSide}), -w*.12, .415, .06, 20));
      vase(g, w*.24, .4, -.05, .055, .18, '#e9e2d6', R);
      // 台面边一圈滚边
      g.add(rbox(w, .008, .01, metal(), 0, .368, d/2 - .005, .003));
      break;
    }
    case 'tvstand': {
      const sm = furnCabMat(f, c), h = cabHm(f), n = Math.max(2, Math.round(w/.6)), fz = d/2 - .02;
      const y0 = .1, body = Math.max(.28, h - .12), topY = y0 + body;
      legs(g, w, d, y0, blackMetal(), .08, .012);
      g.add(rbox(w, body, d - .02, sm, 0, y0, -.01, .01));
      fronts(g, -w/2 + .005, y0 + .005, w - .01, body - .01, fz, n, 1, sm, 'edge');
      // 台面石纹条 + 开放格（中间留一格）
      g.add(rbox(w + .02, .022, d + .02, mat(lighter(c, .12), {roughness:.35}), 0, topY, 0, .005));
      const openX = w/2 - w/n*.5;
      g.add(box(w/n - .06, Math.max(.16, body * .65), .012, mat('#2a2724', {roughness:.8}), openX - w/n*.5, y0 + .04, fz + .006));
      // 电视：窄边框 + 屏幕反光 + 底座
      const tvY = topY + .45;
      g.add(rbox(1.45, .84, .025, mat('#18181a', {roughness:.4, metalness:.3}), 0, tvY, bz + .03, .004), box(1.43, .81, .002, screenMat(), 0, tvY + .012, bz + .0435));
      const glare = new THREE.Mesh(new THREE.PlaneGeometry(.5, .78), mat('#8fb4d6', {transparent:true, opacity:.07, roughness:.1}));
      glare.position.set(-.38, tvY + .012, bz + .0455); glare.rotation.y = .12; g.add(glare);
      g.add(rbox(.9, .06, .09, '#2a2a2c', 0, topY, -.02, .02), box(.86, .045, .002, fabric('#3a3a3c'), 0, topY + .007, .026));
      // 音响条 + 两侧小音箱
      g.add(rbox(w*.45, .075, .08, mat('#222426', {roughness:.5}), 0, topY + .03, fz - .06, .02));
      for (let k = 0; k < 9; k++) g.add(box(.006, .045, .002, mat('#4a4c50'), -w*.2 + k*w*.05, topY + .035, fz - .02));
      vase(g, w/2 - .25, topY + .02, 0, .06, .26, '#d8cfc2', R);
      g.add(box(.25, .035, .18, '#a9433b', -w/2 + .3, topY + .02, 0), box(.22, .03, .16, '#e6dccd', -w/2 + .3, topY + .055, 0));
      break;
    }
    case 'rug': {
      const pile = mat(c, {roughness:1}), mid = mat(darker(c, .84), {roughness:1}), border = mat(lighter(c, .16), {roughness:1});
      const layers = [[w, d, .012, pile, .001], [w - .14, d - .14, .002, mid, .013], [w - .26, d - .26, .002, border, .015]];
      layers.forEach(([a, b, h, cc, y]) => { const r = box(a, h, b, cc, 0, y); r.castShadow = false; g.add(r); });
      // 绒面：沿长边的一圈短绒条 + 表面织纹块
      const nx = Math.min(16, Math.max(6, Math.round(w/.22))), nz = Math.min(12, Math.max(5, Math.round(d/.22)));
      for (let i = 0; i < nx; i++){
        const x = -w/2 + w*(i + .5)/nx;
        g.add(box(w/nx - .02, .003, .012, mid, x, .017, -d/2 + .13));
        g.add(box(w/nx - .02, .003, .012, mid, x, .017, d/2 - .13));
      }
      for (let j = 0; j < nz; j++){
        const z = -d/2 + d*(j + .5)/nz;
        g.add(box(.012, .003, d/nz - .02, border, -w/2 + .13, .017, z));
        g.add(box(.012, .003, d/nz - .02, border, w/2 - .13, .017, z));
      }
      // 中央菱形织纹
      for (let k = 0; k < 3; k++){
        const rw = w*.22 - k*w*.06, rd = d*.3 - k*d*.08;
        const o = box(rw, .002, .014, border, 0, .018, 0); o.rotation.y = Math.PI/4; g.add(o);
        const o2 = box(rw, .002, .014, border, 0, .018, 0); o2.rotation.y = -Math.PI/4; g.add(o2);
      }
      // 四边流苏
      const tassel = mat(lighter(c, .2), {roughness:1});
      for (let i = 0; i < nx; i++){
        const x = -w/2 + w*(i + .5)/nx;
        g.add(rod([x, .006, -d/2], [x, .006, -d/2 - .055], .004, tassel, .002, 6));
        g.add(rod([x, .006, d/2], [x, .006, d/2 + .055], .004, tassel, .002, 6));
      }
      break;
    }
    case 'plant': {
      const r = Math.min(w, d)/2, flower = /花|盆栽花|花箱/i.test(f.name || ''), garden = /花园|灌木|绿植/i.test(f.name || '') && r >= .28;
      const pot = mat(flower ? '#c9a27a' : '#d9d2c5', {roughness:.65}), soil = mat('#3d2f22', {roughness:.95});
      const lm = [mat('#5f8f4e', {roughness:.6, side:THREE.DoubleSide}), mat('#79a862', {roughness:.6, side:THREE.DoubleSide}), mat('#4e7a40', {roughness:.65, side:THREE.DoubleSide})];
      const flowerCols = ['#f3e6d8', '#e8a090', '#f6d27a', '#ffffff', '#d4a5c8', '#f0b070'];
      if (flower){
        const ph = .38 + r * .2;
        g.add(lathe([[0, 0], [r*.55, 0], [r*.62, .03], [r*.78, ph*.55], [r*.72, ph*.9], [r*.8, ph]], pot, 0, 0, 0, 40));
        g.add(ring(r * .78, .012, woodM(darker(c, .85)), 0, ph - .01, 0));
        g.add(cyl(r * .68, r * .68, .02, soil, 0, ph - .015, 0, 28));
        const n = 8 + Math.round(r * 18);
        for (let k = 0; k < n; k++){
          const a = k * 2.4 + R() * .4, rr = r * (.12 + R() * .45), px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
          const hh = .22 + R() * .38;
          g.add(rod([px, ph, pz], [px + (R() - .5) * .05, ph + hh, pz + (R() - .5) * .05], .005, '#5a4a30', .004, 6));
          for (let L = 0; L < 4; L++){
            const ang = a + L * 1.4, len = .06 + R() * .07;
            const lf = blob(len / 2, .004, len * .28, lm[L % 3], px + Math.cos(ang) * .025, ph + hh * (.4 + L * .12), pz + Math.sin(ang) * .025, 12);
            lf.rotation.z = -.4; g.add(lf);
          }
          if (R() > .25){
            const fy = ph + hh + .02;
            g.add(blob(.025, .02, .025, flowerCols[k % flowerCols.length], px, fy, pz, 12));
            for (let p = 0; p < 5; p++){
              const pa = p * 1.26;
              g.add(blob(.012, .006, .018, flowerCols[(k + p) % flowerCols.length], px + Math.cos(pa) * .03, fy + .005, pz + Math.sin(pa) * .03, 8));
            }
          }
        }
        break;
      }
      const H = garden ? 1.1 + r * 1.8 : .9 + r * 1.6;
      g.add(lathe([[0, 0], [r*.4, 0], [r*.44, .02], [r*.54, .36], [r*.57, .4], [r*.52, .4], [r*.5, .37], [0, .37]], pot, 0, 0, 0, 36), cyl(r*.49, r*.49, .005, '#4a3a2c', 0, .368, 0, 28));
      // 陶盆环纹与釉面高光
      g.add(ring(r*.53, .007, woodM(darker(c,.8)), 0, .13, 0), ring(r*.55, .006, woodM(darker(c,.84)), 0, .31, 0));
      g.add(cyl(r*.545, r*.545, .002, mat('#ffffff',{roughness:.2,transparent:true,opacity:.12}), 0, .2, 0, 30));
      g.add(rod([0, .37, 0], [.02, H*.62, -.01], .016, '#6b5540', .009));
      if (garden){
        for (let b = 0; b < 3; b++){
          const ba = b * 2.1, br = r * (.08 + b * .04);
          g.add(rod([0, .4, 0], [Math.cos(ba) * br, H * (.5 + b * .12), Math.sin(ba) * br], .012 - b * .002, '#5a4838', .008, 8));
        }
      }
      const N = 20 + Math.round(r*36), sc = Math.sqrt(r/.25);
      for (let k = 0; k < N; k++){
        const t = k/N, a = k*2.399 + R()*.3, len = (.14 + R()*.08)*(1.1 - t*.4)*sc, s0 = .03 + R()*.08*sc, p = new THREE.Group();
        p.position.set(0, H*(.42 + .58*t), 0); p.rotation.set(0, -a, .1 + t*.5 + R()*.3, 'YXZ');
        const lf = blob(len/2, .005, len*.27, lm[k % 3], s0 + len/2, 0, 0, 16); lf.rotation.z = -.3;
        p.add(box(s0, .005, .005, '#6f8f4a', s0/2, 0, 0), lf); g.add(p);
      }
      break;
    }
    /* ===== 3 款配套桌椅（3D 模型）===== */
    case 'chinesetable': {
      // 新中式长餐桌：冰盘沿 + 两端翘头 + 方腿铜足 + 罗锅枨 + 桌上茶具
      const wm = woodM(c), dk = woodM(darker(c, .68)), brass = mat('#b08d57', {metalness:.75, roughness:.35}), top = .75;
      g.add(rbox(w, .045, d, wm, 0, top - .045, 0, .012));
      g.add(rbox(w - .08, .012, d - .08, dk, 0, top - .058, 0, .006));
      [-1, 1].forEach(s => g.add(rbox(.028, .068, d * .88, wm, s * (w / 2 - .014), top - .045, 0, .008)));
      for (let i = 1; i < 4; i++) g.add(box(.002, .002, d - .1, darker(c, .7), -w / 2 + i * w / 4, top, 0));
      const lx = w / 2 - .1, lz = d / 2 - .09;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
        g.add(box(.055, top - .05, .055, dk, a * lx, 0, b * lz));
        g.add(box(.062, .035, .062, brass, a * lx, 0, b * lz));
      });
      [-1, 1].forEach(b => g.add(box(w - .16, .07, .022, dk, 0, top - .12, b * lz)));
      [-1, 1].forEach(a => g.add(box(.022, .07, d - .14, dk, a * lx, top - .12, 0)));
      [-1, 1].forEach(b => g.add(tube([
        [-lx + .05, .28, b * lz], [-w * .2, .33, b * lz], [0, .36, b * lz],
        [w * .2, .33, b * lz], [lx - .05, .28, b * lz]], .014, dk)));
      // 桌上茶盘 + 茶壶 + 双杯
      g.add(rbox(.34, .012, .22, woodM('#8a6a48'), -w * .18, top, 0, .01));
      g.add(lathe([[.05, 0], [.07, .02], [.075, .06], [.05, .09], [.03, .10], [.035, .115]],
        ceramic({roughness:.35}), -w * .18, top + .012, 0, 24));
      [-1, 1].forEach(k => g.add(cyl(.025, .022, .04, ceramic({roughness:.35}), -w * .18 + k * .12, top + .012, .065, 16)));
      break;
    }
    case 'mingchair': {
      // 明式圈椅：C 形扶手圈 + 中央靠背板 + 鹅脖 + 圆材腿 + 踏脚枨 + 座面软垫
      const wm = woodM(c), dk = woodM(darker(c, .7)), sy = .44;
      const hx = w / 2 - .07, hz = d / 2 - .07;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
        g.add(rod([a * (hx + .01), 0, b * (hz + .01)], [a * (hx - .01), sy + .02, b * (hz - .01)], .018, wm, .016)));
      g.add(box(w - .06, .045, d - .06, dk, 0, sy - .03, 0));
      g.add(rbox(w - .11, .035, d - .11, fabric('#d9c7a8'), 0, sy, 0, .018));
      g.add(rod([-hx + .02, .13, hz - .03], [hx - .02, .13, hz - .03], .014, dk));
      g.add(rod([-hx + .02, .17, -hz + .03], [hx - .02, .17, -hz + .03], .012, dk));
      [-1, 1].forEach(s => {
        g.add(rod([s * hx, sy, -hz + .02], [s * (hx - .02), .775, -hz + .04], .016, wm, .014));
        // 鹅脖：座面前缘斜向上，顶端正好接到椅圈前端点
        g.add(rod([s * (hx - .04), sy, hz - .06], [s * (w / 2 - .055), .775, d * .12], .012, wm, .010));
      });
      const arc = [];
      for (let i = 0; i <= 28; i++){
        const th = Math.PI * i / 28;
        arc.push([Math.cos(th) * (w / 2 - .055), .78 + Math.sin(th) * .12,
                  -Math.sin(th) * (d / 2 - .12) + d * .12]);
      }
      g.add(tube(arc, .022, wm, 56));
      const bp = rbox(w * .42, .34, .022, wm, 0, .57, bz + .16, .01);
      bp.rotation.x = -.12; g.add(bp);
      const jade = cyl(.045, .045, .006, mat('#9fb3a0', {roughness:.3}), 0, .72, bz + .185, 24);
      jade.rotation.x = Math.PI / 2; g.add(jade);
      break;
    }
    case 'tuliptable': {
      // 中古郁金香圆桌：岩板圆面 + 白色单柱喇叭底座
      const r = w / 2, top = .74;
      const stone = mat(c, {roughness:.18}), white = mat('#f4f1ea', {roughness:.35});
      g.add(lathe([[r * .30, 0], [r * .34, .015], [r * .30, .045], [r * .14, .10],
                   [r * .095, .30], [r * .09, .55], [r * .13, .68], [r * .22, .705]], white, 0, 0, 0, 48));
      g.add(cyl(r, r, .035, stone, 0, top - .035, 0, 64));
      // 岩板浅纹：三条平缓波浪曲线，避免放射直线看起来像轮辐
      for (let k = 0; k < 3; k++){
        const off = (k - 1) * r * .3, pts = [];
        for (let i = 0; i <= 10; i++){
          const x = -r * .78 + i * (r * 1.56 / 10);
          pts.push([x, top + .002, off + Math.sin(i * .7 + k * 1.4) * r * .055]);
        }
        g.add(tube(pts, .0016, mat(darker(c, .82), {roughness:.6}), 24));
      }
      g.add(lathe([[.04, 0], [.055, .02], [.05, .12], [.035, .18], [.045, .20]],
        ceramic({roughness:.3}), r * .22, top + .002, -r * .16, 24));
      for (let k = 0; k < 5; k++){
        const a = k * 1.3;
        g.add(blob(.026, .02, .026, mat('#7c9a63', {roughness:.8}),
          r * .22 + Math.cos(a) * .05, top + .2, -r * .16 + Math.sin(a) * .05, 10));
      }
      plate(g, .1, -r * .28, top + .002, r * .10);
      break;
    }
    case 'shellchair': {
      // 中古贝壳餐椅：后倾壳背 + 放射褶皱 + 锥形金属腿 + 软座垫
      const fab = fabric(c), dk = fabric(darker(c, .8)), brass = metal(), sy = .45;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
        g.add(rod([a * (w / 2 - .075), 0, b * (d / 2 - .075)],
                  [a * (w / 2 - .15), sy, b * (d / 2 - .13)], .009, brass, .014)));
      g.add(rod([-w * .28, .16, 0], [w * .28, .16, 0], .007, brass));
      g.add(rbox(w * .66, .012, d * .42, dk, 0, sy - .015, d * .06, .05));
      g.add(blob(w * .42, .045, d * .34, fab, 0, sy + .02, d * .06, 28));
      const back = blob(w * .44, .32, .07, fab, 0, sy + .32, bz + .10, 28);
      back.rotation.x = -.16; g.add(back);
      for (let i = -3; i <= 3; i++){
        const t = i / 3;
        // 终点落在壳背轮廓内，避免细杆顶端探出成「小天线」
        const topY = sy + .32 + .30 * Math.sqrt(Math.max(0, 1 - t * t * .72)) - .03;
        g.add(rod([t * w * .28, sy + .06, bz + .175],
                  [t * w * .31, topY, bz + .155], .0035, dk, .0035, 8));
      }
      g.add(blob(w * .34, .028, d * .24, fabric(lighter(c, .12)), 0, sy + .055, d * .08, 24));
      break;
    }
    case 'ovaltable': {
      // 北欧椭圆餐桌：整块椭圆实木台面 + 锥形外撇腿 + 横枨 + 桌面摆件
      const wm = woodM(c), dk = woodM(darker(c, .7)), top = .75;
      const ell = cyl(w / 2, w / 2, .04, wm, 0, top - .04, 0, 64); ell.scale.z = d / w; g.add(ell);
      // 倒角亮边：沿椭圆轮廓采样一圈细管（不能用 ring 缩放，那会压扁管厚而非长轴）
      const edge = [];
      for (let i = 0; i <= 64; i++){
        const a = Math.PI * 2 * i / 64;
        edge.push([Math.cos(a) * (w / 2 - .008), top - .004, Math.sin(a) * (d / 2 - .008)]);
      }
      g.add(tube(edge, .004, woodM(lighter(c, .1)), 64));
      for (let i = -2; i <= 2; i++){
        const z0 = i * d * .13;
        const hw = (w / 2) * Math.sqrt(Math.max(.08, 1 - Math.pow(z0 / (d / 2), 2))) - .05;
        g.add(box(hw * 2, .0015, .003, dk, 0, top + .002, z0));
      }
      const lx = w * .30, lz = d * .27;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
        g.add(rod([a * (lx + .03), 0, b * (lz + .025)], [a * lx, top - .05, b * lz], .026, wm, .018)));
      [-1, 1].forEach(b => g.add(rod([-w * .26, .22, b * d * .13], [w * .26, .22, b * d * .13], .014, dk)));
      [-1, 1].forEach(s => {
        g.add(rbox(.3, .004, .22, fabric('#e7dfd1'), s * w * .2, top + .002, 0, .01));
        plate(g, .09, s * w * .2, top + .006, 0);
      });
      vase(g, 0, top + .002, 0, .05, .18, '#e9e2d6', R);
      break;
    }
    case 'windsorchair': {
      // 北欧温莎椅：弓形靠背 + 七根放射辐条 + 鞍形座面 + 外撇锥腿 + H 横枨
      const wm = woodM(c), dk = woodM(darker(c, .7)), sy = .45;
      const hx = w / 2 - .07, hz = d / 2 - .07;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
        g.add(rod([a * (hx + .035), 0, b * (hz + .03)], [a * hx, sy, b * hz], .012, wm, .018)));
      g.add(rod([-hx * .9, .16, 0], [hx * .9, .16, 0], .011, wm));
      [-1, 1].forEach(s => g.add(rod([s * hx * .9, .16, -hz * .9], [s * hx * .9, .16, hz * .9], .010, wm)));
      g.add(rbox(w - .06, .045, d - .08, wm, 0, sy - .03, 0, .03));
      g.add(blob(w * .36, .012, d * .28, woodM(lighter(c, .08)), 0, sy + .015, 0, 20));
      const arc = [], spokes = [], bx = w / 2 - .05;
      for (let i = 0; i <= 20; i++){
        const th = Math.PI * i / 20;
        arc.push([Math.cos(th) * bx, .78 + Math.sin(th) * .12, -Math.sin(th) * (hx * .55) - hz * .15]);
      }
      for (let i = 0; i <= 6; i++){
        const th = Math.PI * i / 6;
        spokes.push([Math.cos(th) * bx, .78 + Math.sin(th) * .12, -Math.sin(th) * (hx * .55) - hz * .15]);
      }
      g.add(tube(arc, .016, wm, 40));
      spokes.forEach(([px, py, pz]) =>
        g.add(rod([(px / bx) * w * .26, sy + .01, -hz * .55], [px, py, pz], .005, wm, .004, 8)));
      [-1, 1].forEach(s => g.add(rod([s * hx * .92, sy, -hz * .8], [s * bx, .78, -hz * .15], .012, wm, .010)));
      break;
    }
    case 'table': {
      const outdoor = /户外|花园|庭院|outdoor|patio/i.test(f.name || '');
      if (outdoor){
        const wm = woodM(c), dark = woodM(darker(c, .72)), iron = mat('#5a534c', {metalness:.4, roughness:.45}), top = .74;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
          g.add(rod([a * (w / 2 - .07), 0, b * (d / 2 - .07)], [a * (w / 2 - .09), top - .02, b * (d / 2 - .09)], .014, iron, .02));
          g.add(box(.06, .03, .06, iron, a * (w / 2 - .07), 0, b * (d / 2 - .07)));
        });
        g.add(box(w - .2, .04, d - .2, dark, 0, top - .08, 0));
        g.add(rbox(w, .04, d, wm, 0, top - .02, 0, .01));
        // plank seams
        for (let i = 1; i < 4; i++) g.add(box(.004, .002, d - .08, darker(c, .65), -w / 2 + i * (w / 4), top + .02, 0));
        g.add(cyl(.05, .05, .01, mat('#6a8a5c', {roughness:.8}), 0, top + .02, 0, 16));
        // 户外餐桌：餐垫、玻璃杯与小花瓶
        [-1, 1].forEach(sx => {
          g.add(rbox(.26,.004,.2,fabric('#e7dfd1'), sx*w*.24, top+.02, 0, .01));
          g.add(cyl(.032,.028,.09,mat('#dfeef3',{transparent:true,opacity:.38,roughness:.05}), sx*w*.24+.09, top+.025, -.06, 16));
        });
        g.add(lathe([[.035,0],[.045,.02],[.03,.1],[.022,.14],[.03,.16]], ceramic(), 0, top+.02, .08, 20));
        for (let k = 0; k < 5; k++){
          const a = k * 1.3;
          g.add(blob(.03, .025, .03, mat(['#6f9f5e', '#8fad6a', '#5a8a4a'][k % 3], {roughness:.7}), Math.cos(a) * .06, top + .05, Math.sin(a) * .06, 10));
        }
        break;
      }
      const tm = mat(c, {roughness:.4}), lw = woodM(darker(c, .55)), ns = Math.max(1, Math.round(w/.62)), top = .75;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a, b]) => g.add(rod([a*(w/2 - .08), 0, b*(d/2 - .08)], [a*(w/2 - .1), .715, b*(d/2 - .1)], .016, lw, .026)));
      g.add(rbox(w, .035, d, tm, 0, .715, 0, .012), box(w - .22, .07, d - .22, lw, 0, .645));
      g.add(box(w*.7, .003, .32, fabric('#b9a58c'), 0, top, 0));
      for (let i = 0; i < ns; i++) [-1, 1].forEach(s => {
        const x = -w/2 + w/ns*(i + .5), z = s*(d/2 - .17);
        g.add(box(.38, .003, .28, fabric('#e7dfd1'), x, top, z)); plate(g, .12, x, top + .003, z);
        g.add(cyl(.03, .026, .1, mat('#dfeef3', {transparent:true, opacity:.35, roughness:.05}), x + .15, top + .003, z - s*.1, 16));
      });
      vase(g, 0, top + .003, 0, .06, .2, '#e9e2d6', R);
      break;
    }
    case 'roundtable': {
      const outdoor = /户外|花园|庭院|茶几|outdoor|patio/i.test(f.name || '');
      if (outdoor){
        const wm = woodM(c), dark = woodM(darker(c, .75)), iron = mat('#4e4842', {metalness:.45, roughness:.4});
        const r = w / 2, top = .74;
        // 铸铁立柱底座
        g.add(lathe([[r * .32, 0], [r * .36, .02], [r * .28, .05], [r * .12, .12], [r * .1, .35], [r * .11, .55], [r * .16, .62], [r * .22, .66]], iron, 0, 0, 0, 40));
        for (let k = 0; k < 4; k++){
          const a = k * Math.PI / 2;
          g.add(rod([0, .08, 0], [Math.cos(a) * r * .3, .04, Math.sin(a) * r * .3], .012, iron, .014));
          g.add(box(.05, .02, .08, iron, Math.cos(a) * r * .28, 0, Math.sin(a) * r * .28));
        }
        g.add(cyl(r * .2, r * .24, .03, iron, 0, top - .05, 0, 28));
        // 整圆桌面（不再用方条拼出锯齿边）
        g.add(cyl(r, r, .04, wm, 0, top - .02, 0, 64));
        g.add(cyl(r * .98, r * .98, .004, dark, 0, top + .02, 0, 64));
        // 浅接缝暗示木纹分区
        for (let i = 0; i < 8; i++){
          const seam = box(r * 1.92, .0015, .003, darker(c, .7), 0, top + .021, 0);
          seam.rotation.y = i * Math.PI / 8; g.add(seam);
        }
        g.add(cyl(r * .07, r * .07, .02, iron, 0, top + .02, 0, 20));
        g.add(ring(r * .05, .008, iron, 0, top + .03, 0));
        break;
      }
      const b = Math.min(.25, w*.3), lw = woodM('#4a3e33'), top = .75;
      g.add(lathe([[b, 0], [b, .015], [b*.8, .035], [.06, .12], [.045, .35], [.05, .6], [.12, .69], [.18, .715]], lw, 0, 0, 0, 40), cyl(w/2, w/2, .035, mat(c, {roughness:.4}), 0, .715, 0, 64));
      for (let k = 0; k < 4; k++){ const a = k*Math.PI/2 + .4, rr = w/2 - .17; plate(g, .11, Math.cos(a)*rr, top, Math.sin(a)*rr); }
      vase(g, 0, top, 0, .05, .18, '#e9e2d6', R);
      break;
    }
    case 'counter': {
      const cm = furnCabMat(f, c), h = cabHm(f), stone = mat('#dcd7cf', {roughness:.22}), n = Math.max(1, Math.round(w/.6)), fz = d/2 - .04;
      const y0 = .1, body = Math.max(.5, h - .14), drawerH = Math.min(.2, body * .25), doorH = body - drawerH;
      const topY = y0 + body, stoneY = topY, workY = stoneY + .04;
      g.add(box(w - .01, .1, d - .1, '#4a4641', 0, 0, -.05), box(w, body, d - .04, cm, 0, y0, -.02));
      fronts(g, -w/2, y0 + doorH, w, drawerH, fz, n, 1, cm, 'bar'); fronts(g, -w/2, y0, w, doorH, fz, n, 1, cm, 'bar', y0 + doorH * .75);
      g.add(rbox(w + .01, .04, d, stone, 0, stoneY, 0, .004), box(w, .62, .01, mat('#efece6', {roughness:.3}), 0, workY, bz + .005));
      const upY = workY + .62;
      g.add(box(w, .7, .33, cm, 0, upY, bz + .165)); fronts(g, -w/2, upY, w, .7, bz + .33, n, 1, cm, 'bar', upY + .08);
      g.add(box(w - .04, .01, .02, glowMat('#fff7e6', '#ffe9c4', .8), 0, upY - .01, bz + .29));
      if (w >= .8){
        g.add(rbox(.36, .018, .25, woodM('#c9a27a'), -w/2 + .3, workY, .0, .005));
        [.07, .06, .05].forEach((r, i) => g.add(cyl(r, r, .16 - i*.03, mat(['#e9e2d6', '#d6cfc3', '#bfb6a8'][i], {roughness:.4}), w/2 - .15 - i*.15, workY, bz + .1, 24)));
        g.add(cyl(.05, .045, .14, ceramic({roughness:.3}), w/2 - .6, workY, bz + .1, 20));
        for (let k = 0; k < 4; k++) g.add(rod([w/2 - .6, workY + .04, bz + .1], [w/2 - .6 + (k - 1.5)*.018, workY + .24, bz + .1 + (k % 2 - .5)*.02], .005, woodM('#8d7258'), .006, 6));
      }
      break;
    }
    case 'kitchencab': {
      // 半截矮橱柜（厨房分类新增）：只有下柜——踢脚 + 柜体 + 石材台面，
      // 上抽屉下开门，不带吊柜 / 挡水板，可独立当备餐台 / 中岛柜摆放。
      const cm = furnCabMat(f, c), h = cabHm(f), stone = mat('#dcd7cf', {roughness:.22});
      const y0 = .1, body = Math.max(.5, h - .14), drawerH = Math.min(.2, body * .3), doorH = body - drawerH;
      const fz = d/2 - .04, n = Math.max(2, Math.round(w / .6));
      g.add(box(w - .01, .1, d - .1, '#4a4641', 0, 0, -.05), box(w, body, d - .04, cm, 0, y0, -.02));
      fronts(g, -w/2, y0 + doorH, w, drawerH, fz, n, 1, cm, 'bar');
      fronts(g, -w/2, y0, w, doorH, fz, n, 1, cm, 'bar', y0 + doorH * .75);
      g.add(rbox(w + .01, .04, d, stone, 0, y0 + body, 0, .004));
      // 台面小道具：切菜板 + 储物罐，示意备餐台
      if (w >= .8){
        g.add(rbox(.34, .016, .24, woodM('#c9a27a'), -w/2 + .28, y0 + body + .058, 0, .005));
        g.add(cyl(.055, .062, .16, mat('#e9e2d6', {roughness:.4}), w/2 - .15, y0 + body + .12, 0, 24));
      }
      break;
    }
    case 'stove': {
      const sm = mat('#b9bec3', {metalness:.8, roughness:.3});
      g.add(rbox(w, .012, d, mat('#0d0d0e', {roughness:.06, metalness:.3}), 0, .862, 0, .004));
      (w/d > 1.4 ? [[-w/4, 0], [w/4, 0]] : [[-w/4,-d/4],[w/4,-d/4],[-w/4,d/4],[w/4,d/4]]).forEach(([x, z]) => {
        g.add(cyl(.085, .09, .008, '#2b2b2b', x, .874, z, 32), cyl(.045, .05, .014, mat('#6b5a45', {metalness:.7, roughness:.35}), x, .874, z, 28), cyl(.028, .028, .022, '#1a1a1a', x, .874, z, 20));
        for (let k = 0; k < 5; k++){ const a = k*Math.PI*2/5; g.add(rot(box(.07, .014, .012, '#1c1c1c', x + Math.cos(a)*.1, .874, z + Math.sin(a)*.1), 0, -a)); }
        g.add(cyl(.02, .022, .018, '#222', x, .874, d/2 - .04, 20));
      });
      g.add(rbox(w, .06, .5, sm, 0, 1.55, bz + .25, .01), box(.3, .72, .26, sm, 0, 1.61, bz + .13));
      g.add(rot(box(w - .02, .3, .008, mat('#15181b', {roughness:.05, metalness:.5}), 0, 1.58, bz + .38), -.9), box(.16, .012, .003, mat('#101214', {emissive:'#6fd0ff', emissiveIntensity:.6}), 0, 1.575, bz + .502));
      break;
    }
    case 'ksink': {
      const st = mat('#c7ccd1', {metalness:.85, roughness:.28}), inner = mat('#9aa1a8', {metalness:.8, roughness:.35}), two = w >= .75, bw = two ? w*.42 : w*.7, bd = d*.66;
      g.add(box(w, .008, d, st, 0, .862, 0));
      (two ? [-w*.23, w*.23] : [0]).forEach(x => g.add(shell(bw, bd, .02, .015, .04, st, x, .862, .03), box(bw - .03, .002, bd - .03, inner, x, .87, .03), cyl(.03, .03, .003, chrome(), x, .872, .03, 20)));
      const fx = two ? 0 : w*.3, cm = chrome();
      g.add(cyl(.025, .028, .03, cm, fx, .87, bz + .06, 20), tube([[fx, .9, bz + .06], [fx, 1.12, bz + .06], [fx, 1.17, bz + .1], [fx, 1.14, bz + .18], [fx, 1.08, bz + .2]], .012, cm));
      g.add(rot(box(.012, .012, .09, cm, fx + .035, .98, bz + .09), -.3));
      break;
    }
    case 'fridge': {
      const fm = mat(c, {metalness:.45, roughness:.28}), h = 1.8, fz = d/2 - .05;
      g.add(box(w - .02, .06, d - .06, '#2a2c2e', 0, 0, -.03), rbox(w, h - .06, d - .05, fm, 0, .06, -.025, .02), box(w - .01, h - .07, .003, '#2a2c2e', 0, .065, fz + .0015));
      if (w > .85){
        [-1, 1].forEach(s => { g.add(rbox(w/2 - .004, h - .08, .04, fm, s*w/4, .07, fz + .023, .012)); pull(g, .8, true, s*.035, 1.05, fz + .043); });
        g.add(box(.1, .14, .003, screenMat('#2a6f8f'), -w/4, 1.25, fz + .044));
      } else {
        g.add(rbox(w - .006, 1.06, .04, fm, 0, .72, fz + .023, .012), rbox(w - .006, .64, .04, fm, 0, .07, fz + .023, .012));
        pull(g, .5, true, -w/2 + .06, 1.05, fz + .043); pull(g, w*.5, false, 0, .64, fz + .043);
        g.add(box(.08, .1, .003, screenMat('#2a6f8f'), w*.22, 1.4, fz + .044));
      }
      break;
    }
    case 'toilet': {
      const cer = ceramic(), Rb = w*.45, zc = bz + d*.62, kz = (d*.37)/Rb, cm = chrome();
      g.add(rbox(w*.88, .4, d*.24, cer, 0, .36, bz + d*.12, .04), rbox(w*.92, .03, d*.27, cer, 0, .76, bz + d*.135, .012), cyl(.022, .022, .006, cm, 0, .79, bz + d*.135, 20));
      const ped = lathe([[0, 0], [Rb*.62, 0], [Rb*.66, .02], [Rb*.56, .12], [Rb*.62, .22], [Rb*.92, .33], [Rb, .37]], cer, 0, 0, zc, 40);
      const seat = cyl(Rb*1.01, Rb*1.01, .022, mat('#f4f4f2', {roughness:.2}), 0, .37, zc, 40), lid = cyl(Rb*.97, Rb*.99, .02, mat('#f4f4f2', {roughness:.2}), 0, .392, zc, 40);
      ped.scale.z = seat.scale.z = lid.scale.z = kz; g.add(ped, seat, lid);
      [-1, 1].forEach(s => g.add(box(.03, .02, .03, cm, s*w*.18, .39, zc - Rb*kz - .005)));
      break;
    }
    case 'vanity': {
      const vm = furnCabMat(f, c), h = cabHm(f), stone = mat('#fafafa', {roughness:.18}), nb = w >= 1.1 ? 2 : 1, cd = d - .04, cm = chrome();
      const body = Math.max(.35, h - .36), y0 = Math.max(.2, h - body - .03), topY = y0 + body;
      g.add(rbox(w, body, cd, vm, 0, y0, bz + cd/2, .008));
      fronts(g, -w/2 + .005, y0 + .005, w - .01, body - .01, d/2 - .04, nb, 2, vm, 'edge');
      g.add(rbox(w, .03, d, stone, 0, topY, 0, .006));
      const sinkY = topY + .03, rb = Math.min(.19, w/nb*.36);
      for (let i = 0; i < nb; i++){
        const x = nb === 1 ? 0 : (i ? w/4 : -w/4);
        g.add(lathe([[0, 0], [rb*.55, 0], [rb*.85, .03], [rb, .1], [rb*.97, .12]], ceramic({side:THREE.DoubleSide}), x, sinkY, .03, 40), cyl(.018, .018, .003, cm, x, sinkY + .002, .03, 16));
        g.add(cyl(.02, .022, .02, cm, x, sinkY, bz + .06, 16), tube([[x, sinkY + .02, bz + .06], [x, sinkY + .22, bz + .06], [x, sinkY + .26, bz + .11], [x, sinkY + .22, bz + .15]], .01, cm), rot(box(.01, .01, .06, cm, x, sinkY + .24, bz + .04), .4));
      }
      const mw = Math.min(w*.9, nb*.7), mirY = sinkY + .33;
      g.add(rbox(mw + .02, .82, .02, glowMat('#fff7e6', '#ffe9c4', .9), 0, mirY, bz + .01, .01), box(mw, .8, .01, mirror(), 0, mirY + .01, bz + .025));
      g.add(cyl(.028, .028, .12, mat('#c8b8a6', {roughness:.3}), w/2 - .08, sinkY, bz + .1, 16), rbox(.18, .03, .12, fabric('#e9e2d6'), -w/2 + .12, sinkY, .05, .012));
      break;
    }
    case 'shower': {
      const cm = chrome(), x = -w/4;
      g.add(rbox(w, .05, d, mat('#f4f4f2', {roughness:.3}), 0, 0, 0, .01), box(w*.6, .003, .05, mat('#9aa1a8', {metalness:.8, roughness:.3}), 0, .05, bz + .08));
      [[w, .01, 0, d/2 - .005], [.01, d, w/2 - .005, 0]].forEach(([gw, gd, px, pz]) => { const p = box(gw, 1.95, gd, V.glassMat, px, .05, pz); p.castShadow = false; g.add(p); });
      g.add(box(.02, 1.95, .02, V.frameMat, w/2 - .01, .05, d/2 - .01), box(.02, 1.95, .03, V.frameMat, -w/2 + .01, .05, d/2 - .005), box(.03, 1.95, .02, V.frameMat, w/2 - .005, .05, bz + .01));
      g.add(box(w, .015, .02, V.frameMat, 0, 1.985, d/2 - .005), box(.02, .015, d, V.frameMat, w/2 - .005, 1.985, 0));
      g.add(rbox(.14, .1, .04, cm, x, 1.0, bz + .02, .01), rod([x, 1.1, bz + .03], [x, 1.95, bz + .03], .012, cm));
      g.add(tube([[x, 1.95, bz + .03], [x, 2.02, bz + .06], [x, 2.03, bz + .22]], .01, cm), rbox(.24, .012, .24, cm, x, 2.02, bz + .25, .004));
      g.add(rot(cyl(.015, .02, .2, cm, x + .1, 1.25, bz + .05, 16), .25), blob(.03, .012, .03, cm, x + .1, 1.47, bz + .08, 16));
      g.add(box(.26, .012, .1, ceramic(), w/2 - .2, 1.2, bz + .05));
      [['#e6dccd', .03, .18], ['#2f5d62', .025, .15], ['#f4f4f2', .028, .12]].forEach(([cc, r, hh], i) => g.add(cyl(r, r, hh, mat(cc, {roughness:.3}), w/2 - .28 + i*.07, 1.212, bz + .05, 16)));
      break;
    }
    case 'bathtub': {
      const cer = ceramic(), h = .56, t = .07, cm = chrome();
      g.add(shell(w, d, h, t, .14, cer), box(w - .1, .12, d - .1, cer, 0, 0, 0), box(w - 2*t + .004, .004, d - 2*t + .004, mat('#bfe0ea', {roughness:.03, transparent:true, opacity:.6}), 0, .4, 0));
      const fx = w/2 - t/2;
      g.add(tube([[fx, h - .02, 0], [fx, h + .1, 0], [fx - .06, h + .13, 0], [fx - .13, h + .09, 0]], .014, cm));
      [-1, 1].forEach(s => g.add(cyl(.02, .02, .04, cm, fx, h, s*.1, 16)));
      g.add(rot(rbox(.08, .16, .3, cer, -w/2 + t + .06, h - .12, 0, .04), 0, 0, -.5), rbox(.22, .05, .16, fabric('#e9e2d6'), fx - .05, h, d/2 - .1, .02));
      break;
    }
    case 'washer': case 'dryer': {
      const bm = mat(c, {roughness:.35}), R0 = Math.min(w, d)*.25, fz = d/2 - .02;
      g.add(box(w - .02, .04, d - .04, '#8f969b', 0, 0, -.02), rbox(w, .81, d - .02, bm, 0, .04, -.01, .025));
      g.add(box(w - .04, .1, .006, lighter(c, .3), 0, .72, fz + .003), rbox(.18, .07, .01, bm, -w/2 + .12, .735, fz + .006, .004));
      g.add(box(.12, .035, .003, screenMat('#1f6f6a'), w*.14, .745, fz + .007));
      const kn = cyl(.03, .03, .02, chrome(), -w*.02, .75, fz + .016, 28); kn.rotation.x = Math.PI/2; g.add(kn);
      const dr = new THREE.Mesh(new THREE.CircleGeometry(R0, 40), mat('#1b1f22', {roughness:.6})); dr.position.set(0, .4, fz + .004); g.add(dr);
      const rg = new THREE.Mesh(new THREE.TorusGeometry(R0 + .02, .022, 14, 48), mat('#c7cfd5', {metalness:.7, roughness:.25})); rg.position.set(0, .4, fz + .016); sh(rg); g.add(rg);
      const Rs = R0*1.42, cap = new THREE.Mesh(new THREE.SphereGeometry(Rs, 32, 12, 0, Math.PI*2, 0, .78), mat(f.type === 'dryer' ? '#4a4038' : '#26343d', {roughness:.04, metalness:.2, transparent:true, opacity:.8}));
      cap.rotation.x = Math.PI/2; cap.position.set(0, .4, fz + .012 - Rs*Math.cos(.78)); g.add(cap);
      g.add(box(w - .06, .004, .003, '#b9c3ca', 0, .08, fz + .002));
      break;
    }
    case 'crib': {
      const wm = woodM(c);
      g.add(rbox(w - .09, .12, d - .09, fabric('#ffffff'), 0, .3, 0, .04), box(w - .06, .025, d - .06, wm, 0, .28));
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a, b]) => g.add(rbox(.045, .95, .045, wm, a*(w/2 - .022), 0, b*(d/2 - .022), .008), blob(.028, .028, .028, wm, a*(w/2 - .022), .97, b*(d/2 - .022), 14)));
      [-1, 1].forEach(s => {
        const z = s*(d/2 - .022), x = s*(w/2 - .022);
        g.add(rbox(w - .05, .035, .03, wm, 0, .88, z, .008), rbox(w - .05, .035, .03, wm, 0, .25, z, .008), rbox(.03, .035, d - .05, wm, x, .88, 0, .008), rbox(.03, .035, d - .05, wm, x, .25, 0, .008));
        for (let p = -w/2 + .09; p < w/2 - .05; p += .075) g.add(rod([p, .28, z], [p, .88, z], .009, wm, .009, 8));
        for (let p = -d/2 + .09; p < d/2 - .05; p += .075) g.add(rod([x, .28, p], [x, .88, p], .009, wm, .009, 8));
      });
      g.add(rbox(w*.5, .03, d - .14, fabric('#f3d9c9'), w*.12, .42, 0, .015), rbox(.3, .06, .2, fabric('#fbfaf7'), -w/2 + .22, .42, 0, .03));
      const bx = -w*.3 + .1, bear = '#c9a27a';
      g.add(blob(.05, .06, .045, bear, bx, .5, .12), blob(.045, .042, .04, bear, bx, .59, .12), blob(.016, .016, .01, bear, bx - .032, .625, .12), blob(.016, .016, .01, bear, bx + .032, .625, .12));
      break;
    }
    case 'beanbag': {
      const fab = mat(c, {roughness:.95}), seam = mat(darker(c, .72), {roughness:.95});
      g.add(blob(w*.5, .3, d*.5, fab, 0, .3, 0, 40), blob(w*.42, .22, d*.22, fab, 0, .5, bz + d*.26, 32));
      // 放射缝线（沿表面弧线）
      for (let k = 0; k < 6; k++){
        const a = k*Math.PI/3;
        const pts = [];
        for (let i = 0; i <= 6; i++){
          const t = i/6, rr = w*.1 + t*w*.36, yy = .3 + Math.cos(t*Math.PI*.5)*.28;
          pts.push([Math.cos(a)*rr, yy, Math.sin(a)*rr*.9]);
        }
        g.add(tube(pts, .0028, seam, 24));
      }
      break;
    }
    case 'sidetable': {
      const r = Math.min(w, d)/2, bm = blackMetal(), tm = mat(c, {roughness:.3});
      g.add(lathe([[r*.55, 0], [r*.55, .012], [.03, .035], [.018, .3], [.025, .5], [.08, .52]], bm, 0, 0, 0, 40), cyl(r, r*.98, .025, tm, 0, .52, 0, 48));
      // 台面：石纹脉络 + 亮边 + 玻璃反光
      for (let i = 0; i < 2; i++) g.add(tube([[-r*.8, .547, -r*.3 + i*r*.5], [-r*.2, .547, -r*.1 + i*r*.5], [r*.3, .547, -r*.36 + i*r*.5], [r*.8, .547, -r*.08 + i*r*.5]], .0018, mat(darker(c, .78)), 20));
      g.add(ring(r*.97, .003, metal(), 0, .545, 0));
      g.add(box(.16, .02, .12, '#4f6b8a', -r*.25, .545, 0), box(.14, .018, .1, '#e6dccd', -r*.25, .565, 0));
      vase(g, r*.35, .545, -r*.1, .035, .12, '#e9e2d6', R, false);
      g.add(cyl(.035, .03, .07, ceramic(), -r*.1, .545, r*.25, 20));
      break;
    }
    case 'floorlamp': {
      const r = Math.min(w, d) / 2, lm = mat(c, {roughness:.3, metalness:.6});
      const brass = mat('#c9a86a', {metalness:.8, roughness:.28});
      const shadeOuter = mat('#f3ead9', {roughness:.93, side:THREE.DoubleSide});
      const shadeInner = glowMat('#fff2d8', '#ffd9a0', .55);
      const arc = /弧|arc/i.test(f.name || '');
      // 底座：防滑垫 + 多层拉丝金属台阶 + 黄铜饰圈
      g.add(cyl(r * .62, r * .66, .018, blackMetal(), 0, 0, 0, 40));
      g.add(lathe([[r*.58, 0], [r*.6, .012], [r*.52, .028], [r*.1, .042], [.03, .05]], lm, 0, .018, 0, 40));
      g.add(ring(r * .5, .004, brass, 0, .052, 0));
      if (arc){
        // 弓形支臂：顺滑曲线管 + 配重立杆
        const arm = [];
        for (let i = 0; i <= 16; i++){
          const t = i / 16, a = t * Math.PI * .56;
          arm.push([Math.sin(a) * r * 1.7, .06 + Math.sin(a) * 1.6, -Math.cos(a) * r * .22 + r * .22]);
        }
        g.add(rod([0, .05, 0], [0, .34, 0], .016, lm));
        g.add(tube(arm, .013, lm, 48));
        const tip = arm[arm.length - 1];
        g.add(rod([tip[0], tip[1], tip[2]], [tip[0], tip[1] - .22, tip[2]], .004, brass));
        g.add(lathe([[.02, 0], [.1, .03], [.17, .14], [.19, .24], [.07, .29]], shadeOuter, tip[0], tip[1] - .5, tip[2], 40));
        g.add(lathe([[.155, 0], [.165, .14], [.065, .28]], shadeInner, tip[0], tip[1] - .495, tip[2], 36));
        g.add(ring(.19, .005, brass, tip[0], tip[1] - .26, tip[2]));
        glowBulb(g, tip[0], tip[1] - .3, tip[2], .035, {halo:.6});
        lampLight(g, tip[0], tip[1] - .36, tip[2], {intensity:2.2, distance:5.5, priority:4});
      } else {
        g.add(cyl(.02, .022, 1.2, lm, 0, .05, 0, 16));
        g.add(cyl(.028, .028, .06, brass, 0, .6, 0, 16));           // 调光器饰环
        g.add(cyl(.016, .016, .62, lm, 0, .64, 0, 16));
        // 锥形布罩：外壳 + 发光内衬 + 上下包边 + 竖向骨线
        g.add(lathe([[r*.9, 0], [r*.94, .02], [r*.62, .34], [r*.5, .36]], shadeOuter, 0, 1.2, 0, 48));
        g.add(lathe([[r*.86, 0], [r*.58, .32], [r*.47, .34]], shadeInner, 0, 1.205, 0, 44));
        g.add(ring(r*.9, .005, brass, 0, 1.2, 0), ring(r*.5, .005, brass, 0, 1.56, 0));
        for (let k = 0; k < 12; k++){
          const a = k * Math.PI / 6;
          g.add(rod([Math.cos(a)*r*.9, 1.21, Math.sin(a)*r*.9], [Math.cos(a)*r*.5, 1.55, Math.sin(a)*r*.5], .0015, brass, .0015, 6));
        }
        glowBulb(g, 0, 1.38, 0, .04, {halo:.55});
        lampLight(g, 0, 1.35, 0, {intensity:2, distance:5, priority:4});
      }
      break;
    }
    case 'tablelamp': {
      const r = Math.min(w, d) / 2, lm = mat(c, {roughness:.35, metalness:.35});
      const brass = mat('#c9a86a', {metalness:.8, roughness:.28});
      const shell = mat('#f4ead7', {roughness:.93, side:THREE.DoubleSide});
      const shade = glowMat('#f8ecd6', '#ffd9a0', .5);
      g.add(lathe([[0, 0], [r*.62, 0], [r*.66, .012], [r*.58, .032], [r*.14, .05], [.024, .062]], lm, 0, 0, 0, 40));
      g.add(ring(r*.6, .004, brass, 0, .032, 0));
      g.add(lathe([[.026, 0], [.02, .16], [.016, .26], [.03, .28]], brass, 0, .06, 0, 24));
      g.add(cyl(.035, .03, .02, lm, 0, .3, 0, 20));
      g.add(lathe([[r*.92, 0], [r*.98, .015], [r*.68, .26], [r*.42, .31]], shell, 0, .31, 0, 44));
      g.add(lathe([[r*.9, 0], [r*.65, .25], [r*.4, .3]], shade, 0, .315, 0, 40));
      g.add(ring(r*.92, .004, brass, 0, .31, 0), ring(r*.42, .004, brass, 0, .62, 0));
      g.add(rod([r*.5, .55, 0], [r*.5, .44, 0], .002, brass));        // 拉链开关
      g.add(blob(.008, .012, .008, brass, r*.5, .43, 0, 8));
      glowBulb(g, 0, .46, 0, .026, {halo:.3});
      lampLight(g, 0, .46, 0, {intensity:1.4, distance:3.6, priority:3});
      break;
    }
    case 'pendant': {
      const r = Math.min(w, d) / 2, single = /单头|single/i.test(f.name || '');
      const chrome = mat(c, {metalness:.6, roughness:.24});
      const brass = mat('#c8a86e', {metalness:.8, roughness:.26});
      const shell = mat('#f2e7d3', {roughness:.9, side:THREE.DoubleSide});
      const shade = glowMat('#f8ecd8', '#ffd9a0', .55);
      const drop = single ? 1.5 : 1.32;
      // 天花罩 + 双股编织吊线
      g.add(lathe([[.035, 0], [.055, .012], [.055, .03], [.02, .038]], chrome, 0, V.H - .04, 0, 24));
      g.add(rod([0, V.H - .05, 0], [0, drop + .32, 0], .0035, chrome));
      g.add(rod([.006, V.H - .05, 0], [.006, drop + .32, 0], .0015, mat('#8a7a63', {roughness:.9})));
      if (single){
        g.add(lathe([[r*.86, 0], [r*.92, .02], [r*.6, .3], [.1, .42]], shell, 0, drop, 0, 44));
        g.add(lathe([[r*.82, 0], [r*.56, .28], [.09, .4]], shade, 0, drop + .005, 0, 40));
        g.add(ring(r*.86, .005, brass, 0, drop, 0), ring(.1, .004, brass, 0, drop + .42, 0));
        glowBulb(g, 0, drop + .22, 0, .045, {halo:.6});
        lampLight(g, 0, drop + .18, 0, {intensity:2.4, distance:6, priority:5});
      } else {
        // 三头圆环吊灯：金属环 + 三只小灯罩 + 一圈水晶坠
        [-1, 0, 1].forEach(s => { const x = s * r * .42; g.add(rod([x, V.H - .05, 0], [x, drop + .22, 0], .0025, chrome)); });
        g.add(ring(r*.88, .028, chrome, 0, drop + .2, 0), ring(r*.88, .012, shade, 0, drop + .19, 0));
        [-1, 0, 1].forEach((s, i) => {
          const x = s * r * .42, y = drop + .16;
          g.add(lathe([[.075, 0], [.082, .015], [.05, .14], [.02, .18]], shell, x, y, 0, 28));
          g.add(lathe([[.072, 0], [.048, .13], [.02, .17]], shade, x, y + .005, 0, 24));
          g.add(ring(.075, .003, brass, x, y, 0));
          glowBulb(g, x, y + .1, 0, .022, {halo:.3});
          if (i === 0) lampLight(g, x, y + .06, 0, {intensity:2.2, distance:5.5, priority:5});
        });
        for (let k = 0; k < 12; k++){
          const a = k * Math.PI / 6;
          crystalDrop(g, Math.cos(a) * r * .88, drop + .02, Math.sin(a) * r * .88, .07, .008);
        }
      }
      break;
    }
    case 'chandelier': {
      const r = Math.min(w, d) / 2, gold = mat(c, {metalness:.72, roughness:.22});
      const chrome = mat('#d8d2c8', {metalness:.7, roughness:.2});
      const glow = glowMat('#fff4dc', '#ffdca0', .65);
      const y0 = 1.5;
      g.add(lathe([[.04, 0], [.07, .015], [.07, .035], [.025, .045]], chrome, 0, V.H - .05, 0, 24));
      g.add(rod([0, V.H - .06, 0], [0, y0 + .55, 0], .006, chrome));
      g.add(lathe([[.02, 0], [.035, .1], [.02, .5], [.05, .56], [.03, .62]], gold, 0, y0, 0, 28));
      g.add(ring(r*.3, .012, gold, 0, y0 + .5, 0), ring(r*.22, .01, gold, 0, y0 + .08, 0));
      const arms = 6;
      for (let k = 0; k < arms; k++){
        const a = k * Math.PI * 2 / arms;
        const x1 = Math.cos(a) * r * .16, z1 = Math.sin(a) * r * .16;
        const x2 = Math.cos(a) * r * .82, z2 = Math.sin(a) * r * .82;
        g.add(tube([[x1, y0 + .5, z1], [Math.cos(a) * r * .45, y0 + .34, Math.sin(a) * r * .45], [x2, y0 + .2, z2]], .009, gold, 24));
        g.add(cyl(.045, .04, .018, gold, x2, y0 + .18, z2, 16));       // 烛台托盘
        g.add(cyl(.022, .024, .11, mat('#f6f1e4', {roughness:.85}), x2, y0 + .2, z2, 14));
        g.add(lathe([[.055, 0], [.06, .012], [.045, .1], [.022, .14]], glow, x2, y0 + .3, z2, 20));
        glowBulb(g, x2, y0 + .4, z2, .016, {halo:.26});
        for (let j = 0; j < 3; j++){
          const aa = a + (j - 1) * .32;
          crystalDrop(g, Math.cos(aa) * r * .82, y0, Math.sin(aa) * r * .82, .13 - j * .02, .01);
        }
      }
      g.add(ring(r*.82, .008, gold, 0, y0 - .02, 0));
      for (let k = 0; k < 12; k++){
        const a = k * Math.PI / 6;
        crystalDrop(g, Math.cos(a) * r * .82, y0 - .02, Math.sin(a) * r * .82, .16, .009);
      }
      crystalDrop(g, 0, y0 - .18, 0, .3, .02);                          // 中心大吊坠
      lampLight(g, 0, y0 + .3, 0, {intensity:3.2, distance:8, priority:6});
      break;
    }
    case 'ceilinglamp': {
      const r = Math.min(w, d) / 2, frame = mat(c, {roughness:.3, metalness:.3});
      const brass = mat('#c9a86a', {metalness:.8, roughness:.28});
      const glow = glowMat('#f9f1de', '#ffe6b0', .5);
      g.add(lathe([[r*.3, 0], [r*.98, .01], [r, .04], [r*.96, .06]], frame, 0, V.H - .075, 0, 48));
      g.add(lathe([[r*.88, 0], [r*.9, .025], [r*.55, .05]], glow, 0, V.H - .085, 0, 44));
      g.add(ring(r*.98, .006, brass, 0, V.H - .035, 0), ring(r*.55, .008, brass, 0, V.H - .09, 0));
      g.add(cyl(r*.16, r*.18, .022, frame, 0, V.H - .055, 0, 24));
      for (let i = 1; i <= 3; i++) g.add(ring(r * (.2 + i * .2), .0025, mat('#ffffff', {emissive:'#ffe9c4', emissiveIntensity:.2, roughness:.9}), 0, V.H - .09 + i * .004, 0));
      glowBulb(g, 0, V.H - .14, 0, .05, {halo:.8});
      lampLight(g, 0, V.H - .2, 0, {intensity:2.8, distance:7, priority:6});
      break;
    }
    case 'walllamp': {
      const vanity = /镜|vanity|mirror/i.test(f.name || '');
      const brass = mat('#c9a86a', {metalness:.78, roughness:.26});
      const chrome = mat(c, {metalness:.5, roughness:.28});
      const glow = glowMat('#f8ecd8', '#ffdca0', .6);
      const shell = mat('#f3e8d4', {roughness:.9, side:THREE.DoubleSide});
      const fz = d / 2;
      if (vanity){
        g.add(rbox(w, .07, .035, chrome, 0, 1.85, fz - .02, .012));
        g.add(rbox(w - .06, .048, .03, glow, 0, 1.85, fz + .002, .008));
        g.add(rbox(w - .02, .008, .008, brass, 0, 1.815, fz + .02, .003));
        [-1, 1].forEach(s => g.add(box(.024, .09, .028, brass, s * (w / 2 - .015), 1.805, fz - .02)));
        const n = Math.max(3, Math.round(w / .14));
        for (let i = 0; i < n; i++) glowBulb(g, -w / 2 + .05 + (w - .1) * i / (n - 1), 1.855, fz + .022, .012, {halo:.16});
        lampLight(g, 0, 1.8, fz + .1, {intensity:1.5, distance:4, priority:3});
      } else {
        g.add(rbox(.1, .16, .025, brass, 0, 1.52, fz - .03, .012));
        g.add(rod([0, 1.58, fz - .02], [0, 1.58, fz + .06], .012, brass));
        g.add(lathe([[.085, 0], [.095, .015], [.075, .16], [.035, .21]], shell, 0, 1.42, fz + .06, 32));
        g.add(lathe([[.08, 0], [.07, .15], [.032, .2]], glow, 0, 1.425, fz + .06, 28));
        g.add(ring(.085, .004, brass, 0, 1.42, fz + .06));
        glowBulb(g, 0, 1.55, fz + .06, .022, {halo:.3});
        lampLight(g, 0, 1.5, fz + .14, {intensity:1.3, distance:3.8, priority:3});
      }
      break;
    }
    case 'tracklight': {
      const track = mat(c, {metalness:.55, roughness:.3}), black = mat('#1c1c1e', {metalness:.45, roughness:.38});
      const glow = glowMat('#fff6e0', '#ffdca0', .9), y = V.H - .1;
      const brass = mat('#d8d2c8', {metalness:.7, roughness:.25});
      const tilt = .55; // 灯头前倾，光束打向正前方地面 / 对面
      g.add(box(w, .03, .045, track, 0, y, 0));
      g.add(box(w, .008, .02, mat('#111', {metalness:.6, roughness:.3}), 0, y + .024, 0));
      const n = Math.max(2, Math.round(w / .45));
      for (let i = 0; i < n; i++){
        const x = -w / 2 + w * (i + .5) / n;
        g.add(box(.06, .028, .06, track, x, y - .02, 0));
        g.add(rod([x, y - .03, 0], [x, y - .13, .045], .009, black));
        const head = new THREE.Group();
        head.add(lathe([[.038, 0], [.042, .02], [.038, .09], [.03, .1]], black, 0, 0, 0, 20));
        head.add(cyl(.03, .03, .012, glow, 0, -.004, 0, 20));           // 透镜
        head.add(ring(.038, .004, brass, 0, .002, 0));
        head.position.set(x, y - .17, .06); head.rotation.x = tilt;
        g.add(head);
        glowBulb(head, 0, -.012, 0, .018, {halo:.28});
        // 沿灯头朝向投射：本地 -Y 经 rotation.x 后指向前下方
        const lx = x, ly = y - .2, lz = .08;
        const aim = 2.6;
        const tx = lx, ty = Math.max(.02, ly - Math.cos(tilt) * aim), tz = lz + Math.sin(tilt) * aim;
        lampLight(g, lx, ly, lz, {kind:'spot', intensity:3.2, distance:7, angle:.42, penumbra:.45, targetX:tx, targetY:ty, targetZ:tz, priority:5});
        spotBeam(g, lx, ly, lz, tx, ty, tz, 2.2, .28, '#ffe9c4');
      }
      break;
    }
    case 'downlight': {
      const r = Math.min(w, d) / 2, rim = mat(c, {roughness:.28, metalness:.35});
      const glow = glowMat('#fff8ea', '#ffe2b0', .95);
      g.add(cyl(r*.95, r*.9, .018, rim, 0, V.H - .025, 0, 32));
      g.add(cyl(r*.78, r*.8, .05, mat('#2b2b2e', {roughness:.45}), 0, V.H - .07, 0, 28));
      g.add(cyl(r*.62, r*.58, .012, glow, 0, V.H - .082, 0, 28));
      g.add(ring(r*.9, .004, mat('#d9d4cc', {metalness:.7, roughness:.25}), 0, V.H - .02, 0));
      g.add(cyl(r*.62, r*.62, .006, mat('#ffffff', {transparent:true, opacity:.35, roughness:.1}), 0, V.H - .095, 0, 28));
      glowBulb(g, 0, V.H - .1, 0, .022, {halo:.38});
      lampLight(g, 0, V.H - .13, 0, {kind:'spot', intensity:3.4, distance:6.5, angle:.5, penumbra:.55, targetX:0, targetY:0, targetZ:0, priority:5});
      spotBeam(g, 0, V.H - .13, 0, 0, .02, 0, 2.4, .4, '#fff1d4');
      break;
    }
    case 'ledstrip': {
      // 铝槽 + 朝下漫射罩；近似正方形 footprint 时做成 L 形拐角
      const alum = mat('#c8cdd2', {metalness:.55, roughness:.32}), dark = mat('#3a3e42', {metalness:.35, roughness:.4});
      const glow = glowMat('#fff8ea', '#ffe6b0', 1.05);
      const corner = Math.min(w, d) > Math.max(w, d) * .45;
      const chW = Math.min(.042, Math.min(w, d) * .35), chH = .018;
      const y = 2.35;
      const lightPts = [];
      const addRun = (len, cx, cz, alongX) => {
        if (alongX){
          g.add(box(len, chH, chW, alum, cx, y, cz));
          g.add(box(len - .01, chH * .55, chW * .7, glow, cx, y - chH * .28, cz)); // 发光面朝下
          g.add(box(len, .003, chW * .9, dark, cx, y + chH * .45, cz));
        } else {
          g.add(box(chW, chH, len, alum, cx, y, cz));
          g.add(box(chW * .7, chH * .55, len - .01, glow, cx, y - chH * .28, cz));
          g.add(box(chW * .9, .003, len, dark, cx, y + chH * .45, cz));
        }
        const nL = Math.max(1, Math.round(len / .7));
        for (let i = 0; i < nL; i++){
          const t = (i + .5) / nL;
          lightPts.push(alongX
            ? [cx - len / 2 + len * t, y - .08, cz]
            : [cx, y - .08, cz - len / 2 + len * t]);
        }
      };
      if (corner){
        addRun(w, 0, -d / 2 + chW / 2, true);
        addRun(d - chW, -w / 2 + chW / 2, chW / 2, false);
        g.add(box(chW * 1.1, chH * 1.05, chW * 1.1, alum, -w / 2 + chW / 2, y, -d / 2 + chW / 2));
      } else if (w >= d){
        addRun(w, 0, 0, true);
        [-1, 1].forEach(s => g.add(box(.012, chH * 1.1, chW * 1.05, alum, s * (w / 2 - .006), y, 0)));
      } else {
        addRun(d, 0, 0, false);
        [-1, 1].forEach(s => g.add(box(chW * 1.05, chH * 1.1, .012, alum, 0, y, s * (d / 2 - .006))));
      }
      lightPts.forEach(([lx, ly, lz], i) => {
        lampLight(g, lx, ly, lz, {intensity: i === 0 ? 2.4 : 1.8, distance:4.2, priority:4});
      });
      break;
    }
    /* ---------- 新增灯具类型 ---------- */
    case 'crystalpendant': {
      // 现代水晶吊灯：双层环形 + 水晶帘 + 中心烛台组
      const r = Math.min(w, d) / 2, chrome = mat(c, {metalness:.75, roughness:.18});
      const glow = glowMat('#fff4dc', '#ffdca0', .6), y0 = 1.62;
      g.add(lathe([[.035, 0], [.06, .012], [.06, .032], [.02, .04]], chrome, 0, V.H - .045, 0, 24));
      [-1, 1].forEach(s => g.add(rod([s * r * .5, V.H - .05, 0], [s * r * .5, y0 + .35, 0], .0025, chrome)));
      g.add(ring(r * .92, .022, chrome, 0, y0 + .35, 0), ring(r * .92, .012, glow, 0, y0 + .34, 0));
      for (let k = 0; k < 20; k++){
        const a = k * Math.PI * 2 / 20, x = Math.cos(a) * r * .92, z = Math.sin(a) * r * .92;
        crystalDrop(g, x, y0 - .02, z, .34 + (k % 3) * .06, .011);
        g.add(rod([x, y0 + .34, z], [x, y0 - .02, z], .0012, chrome));
      }
      for (let k = 0; k < 12; k++){
        const a = k * Math.PI * 2 / 12;
        crystalDrop(g, Math.cos(a) * r * .6, y0 - .1, Math.sin(a) * r * .6, .22, .009);
      }
      for (let k = 0; k < 5; k++){
        const a = k * Math.PI * 2 / 5, x = Math.cos(a) * r * .42, z = Math.sin(a) * r * .42;
        g.add(cyl(.018, .02, .1, mat('#f6f1e4', {roughness:.85}), x, y0 + .1, z, 12));
        g.add(lathe([[.04, 0], [.045, .08], [.02, .12]], glow, x, y0 + .2, z, 16));
        glowBulb(g, x, y0 + .29, z, .014, {halo:.22});
      }
      crystalDrop(g, 0, y0 - .42, 0, .26, .018);
      lampLight(g, 0, y0 + .2, 0, {intensity:3.4, distance:8, priority:6});
      break;
    }
    case 'globependant': {
      // 玻璃球吊灯：磨砂玻璃球 + 黄铜吊杆 + 爱迪生灯泡
      const r = Math.min(w, d) / 2, brass = mat('#c8a86e', {metalness:.8, roughness:.25});
      const drop = 1.62, gr = Math.min(r * .72, .32);
      g.add(lathe([[.035, 0], [.055, .012], [.055, .03], [.02, .038]], brass, 0, V.H - .04, 0, 24));
      g.add(rod([0, V.H - .05, 0], [0, drop + gr, 0], .004, brass));
      g.add(cyl(.03, .028, .03, brass, 0, drop + gr - .02, 0, 16));
      glassGlobe(g, 0, drop, 0, gr);
      g.add(ring(gr * .9, .006, brass, 0, drop, 0));
      lampLight(g, 0, drop, 0, {intensity:2.6, distance:6.5, priority:5});
      break;
    }
    case 'cagependant': {
      // 工业笼式吊灯：金属笼骨架 + 裸露爱迪生灯泡
      const r = Math.min(w, d) / 2, iron = mat(c, {metalness:.65, roughness:.34});
      const drop = 1.55;
      g.add(lathe([[.035, 0], [.05, .012], [.05, .03], [.02, .038]], iron, 0, V.H - .04, 0, 20));
      g.add(rod([0, V.H - .05, 0], [0, drop + .45, 0], .004, iron));
      g.add(ring(r * .8, .012, iron, 0, drop + .45, 0), ring(r * .8, .012, iron, 0, drop, 0));
      for (let k = 0; k < 8; k++){
        const a = k * Math.PI / 4;
        g.add(rod([Math.cos(a) * r * .8, drop + .45, Math.sin(a) * r * .8], [Math.cos(a) * r * .8, drop, Math.sin(a) * r * .8], .006, iron));
      }
      g.add(cyl(.045, .04, .04, iron, 0, drop + .45, 0, 16));
      g.add(lathe([[.02, 0], [.045, .03], [.05, .09], [.03, .15], [.012, .18]], mat('#fff3d8', {transparent:true, opacity:.45, roughness:.08, side:THREE.DoubleSide}), 0, drop + .08, 0, 20));
      g.add(lathe([[.012, 0], [.016, .03], [.012, .06]], mat('#3a2a18', {roughness:.6}), 0, drop + .1, 0, 10));
      glowBulb(g, 0, drop + .19, 0, .03, {halo:.45});
      lampLight(g, 0, drop + .18, 0, {intensity:2.1, distance:5.5, priority:4});
      break;
    }
    case 'torchere': {
      // 向上洗墙落地灯：碗形灯罩 + 铝柱
      const r = Math.min(w, d) / 2, alu = mat(c, {metalness:.7, roughness:.28});
      const brass = mat('#c8a86e', {metalness:.8, roughness:.25});
      const shade = glowMat('#fff2d8', '#ffd9a0', .6);
      g.add(lathe([[0, 0], [r*.62, 0], [r*.64, .015], [r*.5, .035], [.03, .05]], alu, 0, 0, 0, 40));
      g.add(ring(r * .6, .004, brass, 0, .05, 0));
      g.add(lathe([[.022, 0], [.018, 1.4], [.024, 1.45]], alu, 0, .05, 0, 24));
      g.add(cyl(.03, .03, .04, alu, 0, 1.5, 0, 20));
      g.add(lathe([[.07, 0], [.16, .06], [.22, .2], [.235, .24]], mat('#f6ecd8', {roughness:.9, side:THREE.DoubleSide}), 0, 1.54, 0, 44));
      g.add(lathe([[.065, 0], [.15, .06], [.21, .19]], shade, 0, 1.545, 0, 40));
      g.add(ring(.235, .006, alu, 0, 1.78, 0));
      glowBulb(g, 0, 1.72, 0, .04, {halo:.6});
      lampLight(g, 0, 1.9, 0, {kind:'spot', intensity:2.4, distance:6, angle:1, penumbra:.8, targetY:V.H, priority:4});
      break;
    }
    case 'tripodlamp': {
      // 三脚架落地灯：木质三脚 + 大布罩
      const r = Math.min(w, d) / 2, wood = woodM('#8a6b4c');
      const brass = mat('#c8a86e', {metalness:.8, roughness:.26});
      const shell = mat('#efe6d4', {roughness:.95, side:THREE.DoubleSide});
      const shade = glowMat('#f8ecd6', '#ffd9a0', .5);
      for (let k = 0; k < 3; k++){
        const a = k * Math.PI * 2 / 3;
        g.add(rod([Math.cos(a) * r * .75, 0, Math.sin(a) * r * .75], [Math.cos(a) * r * .12, 1.32, Math.sin(a) * r * .12], .014, wood, .01));
        g.add(blob(.018, .012, .018, brass, Math.cos(a) * r * .75, 0, Math.sin(a) * r * .75, 10));
      }
      g.add(ring(r * .16, .01, brass, 0, 1.18, 0));
      g.add(cyl(.016, .016, .25, brass, 0, 1.3, 0, 14));
      g.add(lathe([[r*.9, 0], [r*.94, .02], [r*.6, .4], [r*.46, .42]], shell, 0, 1.5, 0, 44));
      g.add(lathe([[r*.88, 0], [r*.58, .38], [r*.44, .4]], shade, 0, 1.505, 0, 40));
      g.add(ring(r*.9, .005, brass, 0, 1.5, 0), ring(r*.46, .005, brass, 0, 1.92, 0));
      glowBulb(g, 0, 1.72, 0, .04, {halo:.5});
      lampLight(g, 0, 1.68, 0, {intensity:2, distance:5, priority:4});
      break;
    }
    case 'bankerslamp': {
      // 银行台灯：黄铜底座 + 绿玻璃罩 + 拉杆开关（冷白光）
      const r = Math.min(w, d) / 2, brass = mat('#c8a86e', {metalness:.85, roughness:.22});
      const green = mat('#2f6b4f', {roughness:.18, metalness:.15, transparent:true, opacity:.88, side:THREE.DoubleSide});
      const glow = glowMat('#eaf6d9', '#cfe8a0', .55);
      g.add(lathe([[0, 0], [r*.8, 0], [r*.82, .015], [r*.7, .04], [.04, .055]], brass, 0, 0, 0, 40));
      g.add(ring(r * .78, .005, mat('#8a6a3a', {metalness:.8, roughness:.3}), 0, .04, 0));
      g.add(cyl(.018, .018, .2, brass, 0, .05, 0, 16));
      g.add(lathe([[.02, 0], [.11, .02], [.13, .1], [.1, .17], [.02, .19]], green, 0, .28, 0, 32));
      g.add(lathe([[.02, 0], [.1, .02], [.12, .09], [.09, .16], [.02, .18]], glow, 0, .285, 0, 28));
      g.add(ring(.13, .005, brass, 0, .45, 0));
      g.add(rod([r * .4, .42, 0], [r * .4, .3, 0], .0025, brass));
      g.add(blob(.01, .016, .01, brass, r * .4, .29, 0, 8));
      glowBulb(g, 0, .36, 0, .028, {halo:.32, cool:true});
      lampLight(g, 0, .36, 0, {color:0xdcecff, intensity:1.4, distance:3.6, priority:3});
      break;
    }
    case 'globetablelamp': {
      // 云石球台灯：石材底座 + 磨砂玻璃球
      const r = Math.min(w, d) / 2, brass = mat('#c8a86e', {metalness:.82, roughness:.24});
      const stone = mat('#f2eee6', {roughness:.28, metalness:.05});
      g.add(lathe([[0, 0], [r*.66, 0], [r*.68, .015], [r*.5, .04], [.05, .06]], brass, 0, 0, 0, 40));
      g.add(lathe([[.05, 0], [.045, .12], [.055, .16], [.035, .2]], stone, 0, .06, 0, 28));
      g.add(ring(.05, .004, brass, 0, .26, 0));
      glassGlobe(g, 0, .42, 0, Math.min(r * .72, .2));
      lampLight(g, 0, .42, 0, {intensity:1.5, distance:4, priority:3});
      break;
    }
    case 'sconce': {
      // 双臂壁灯：曲线灯臂 + 双灯罩 + 水晶坠
      const brass = mat(c, {metalness:.8, roughness:.24});
      const glow = glowMat('#f8ecd8', '#ffdca0', .6);
      const shell = mat('#f3e8d4', {roughness:.9, side:THREE.DoubleSide});
      const fz = d / 2, span = Math.min(w * .28, .24);
      g.add(rbox(.1, .18, .03, brass, 0, 1.62, fz - .03, .012));
      [-1, 1].forEach(s => {
        const x = s * span;
        g.add(tube([[0, 1.68, fz], [x * .5, 1.74, fz + .06], [x, 1.68, fz + .12]], .008, brass, 20));
        g.add(cyl(.032, .028, .018, brass, x, 1.66, fz + .12, 14));
        g.add(lathe([[.06, 0], [.07, .015], [.05, .13], [.022, .17]], shell, x, 1.68, fz + .12, 24));
        g.add(lathe([[.057, 0], [.048, .12], [.02, .16]], glow, x, 1.685, fz + .12, 20));
        g.add(ring(.07, .003, brass, x, 1.68, fz + .12));
        glowBulb(g, x, 1.8, fz + .12, .018, {halo:.26});
        crystalDrop(g, x, 1.6, fz + .12, .07, .007);
      });
      lampLight(g, 0, 1.74, fz + .18, {intensity:1.7, distance:4, priority:3});
      break;
    }
    case 'bollardlight': {
      // 草坪灯：矮柱 + 环形发光体 + 遮光帽，向下洗地
      const r = Math.min(w, d) / 2, metal = mat(c, {metalness:.55, roughness:.35});
      const glow = glowMat('#fff4dc', '#ffdca0', .7);
      g.add(cyl(r * .6, r * .66, .04, metal, 0, 0, 0, 28));
      g.add(cyl(r * .24, r * .28, .62, metal, 0, .04, 0, 24));
      g.add(ring(r * .26, .006, mat('#c8a86e', {metalness:.8, roughness:.25}), 0, .6, 0));
      g.add(cyl(r * .34, r * .34, .16, glow, 0, .66, 0, 28));
      g.add(cyl(r * .4, r * .36, .035, metal, 0, .82, 0, 28));
      g.add(lathe([[r*.4, 0], [r*.34, .03], [.02, .07]], metal, 0, .85, 0, 28));
      glowBulb(g, 0, .73, 0, .03, {halo:.34});
      lampLight(g, 0, .68, 0, {kind:'spot', intensity:1.8, distance:4, angle:.9, penumbra:.7, targetY:0, priority:2});
      break;
    }
    case 'lantern': {
      // 庭院灯笼：六角玻璃灯箱 + 铸铁顶盖 + 提环
      const r = Math.min(w, d) / 2, iron = mat(c, {metalness:.6, roughness:.4});
      const glow = glowMat('#fff0cf', '#ffc880', .75);
      g.add(cyl(r * .5, r * .55, .04, iron, 0, 0, 0, 24));
      g.add(cyl(r * .16, r * .18, 1.5, iron, 0, .04, 0, 20));
      g.add(ring(r * .18, .008, iron, 0, .9, 0), ring(r * .18, .008, iron, 0, 1.42, 0));
      g.add(cyl(r * .62, r * .62, .42, glow, 0, 1.54, 0, 24));
      for (let k = 0; k < 6; k++){
        const a = k * Math.PI / 3;
        g.add(rod([Math.cos(a) * r * .6, 1.52, Math.sin(a) * r * .6], [Math.cos(a) * r * .6, 1.98, Math.sin(a) * r * .6], .008, iron));
      }
      g.add(lathe([[r*.7, 0], [r*.66, .04], [.04, .16]], iron, 0, 1.96, 0, 28));
      g.add(ring(r * .7, .006, iron, 0, 1.96, 0));
      g.add(blob(.03, .03, .03, iron, 0, 2.13, 0, 12));
      g.add(ring(.05, .006, iron, 0, 2.17, 0));
      glowBulb(g, 0, 1.76, 0, .045, {halo:.5});
      lampLight(g, 0, 1.72, 0, {intensity:2, distance:5, priority:3});
      break;
    }
    case 'island': {
      const cm = mat(c, {roughness:.45}), stone = mat('#dcd7cf', {roughness:.2}), cd = d - .3, n = Math.max(1, Math.round((w - .1)/.6)), cab = new THREE.Group(), fz = cd/2 - .03;
      cab.add(box(w - .12, .1, cd - .08, '#4a4641', 0, 0, -.04), box(w - .1, .74, cd - .03, cm, 0, .1, -.015));
      fronts(cab, -w/2 + .05, .64, w - .1, .2, fz, n, 1, cm, 'bar'); fronts(cab, -w/2 + .05, .1, w - .1, .54, fz, n, 1, cm, 'bar', .56);
      cab.rotation.y = Math.PI; cab.position.z = bz + cd/2; g.add(cab);                    // 柜门朝 -z，+z 侧留出吧台挑空
      g.add(rbox(w, .05, d, stone, 0, .84, 0, .006));
      [-1, 1].forEach(s => g.add(box(.04, .84, d, stone, s*(w/2 - .02), 0, 0)));             // 瀑布式侧板
      g.add(lathe([[0, 0], [.06, 0], [.14, .06], [.15, .07]], mat('#6b543f', {roughness:.5, side:THREE.DoubleSide}), w*.22, .89, 0, 32));
      for (let k = 0; k < 4; k++) g.add(blob(.04, .04, .04, ['#d98c4a', '#9fbf5a', '#b5463a', '#e6c14f'][k], w*.22 + Math.cos(k*1.6)*.05, .935 + (k === 3 ? .04 : 0), Math.sin(k*1.6)*.05, 14));
      vase(g, -w*.25, .89, -.05, .05, .22, '#e9e2d6', R);
      break;
    }
    case 'barstool': {
      const r = Math.min(w, d)/2, bm = blackMetal(), sy = .7;
      [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([a, b]) => g.add(rod([a*r*.72, 0, b*r*.72], [a*r*.4, sy, b*r*.4], .011, bm)));
      g.add(ring(Math.SQRT2*r*(.72 - .32*.4), .008, bm, 0, .28, 0), cyl(r*.55, r*.55, .02, bm, 0, sy - .01, 0, 32));
      g.add(lathe([[0, 0], [r*.85, 0], [r*.95, .02], [r*.97, .045], [r*.9, .07], [0, .075]], mat(c, {roughness:.6}), 0, sy, 0, 40));
      break;
    }
    case 'waterheater': {
      const r = Math.min(d/2, .23), L = w - .06, yc = 1.95, zc = bz + r + .02, tm = mat(c, {roughness:.35}), cp = mat('#cfd4d8', {roughness:.4});
      const tank = mesh(new THREE.CylinderGeometry(r, r, L, 40), tm); tank.rotation.z = Math.PI/2; tank.position.set(0, yc, zc); g.add(tank);
      [-1, 1].forEach(s => g.add(blob(.035, r*.99, r*.99, cp, s*L/2, yc, zc, 32), box(.05, r*1.1, .02, '#9a9ea3', s*L*.3, yc - r*.55, bz + .01)));
      g.add(rbox(.2, .09, .02, '#e7eaec', L*.18, yc - .05, zc + r*.93, .008), box(.07, .03, .002, screenMat('#2f8f7a'), L*.18 - .04, yc - .02, zc + r*.93 + .011));
      [[-L*.3, '#3b7bbf'], [-L*.18, '#c0463a']].forEach(([x, cc]) => g.add(rod([x, yc - r*.8, zc], [x, 1.3, zc], .012, metal()), cyl(.02, .02, .03, cc, x, 1.5, zc, 12)));
      break;
    }
    case 'tv': {
      const th = w*.5625, yb = 1.2 - th/2, z = bz + .03;
      g.add(rbox(w*.6, th*.6, .03, '#222', 0, yb + th*.2, bz + .015, .01));
      g.add(rbox(w, th, .025, mat('#18181a', {roughness:.4, metalness:.3}), 0, yb, z + .01, .004), box(w - .016, th - .022, .002, screenMat('#1f2b3a'), 0, yb + .014, z + .0235), box(.04, .006, .002, '#8a8a8e', 0, yb + .004, z + .0235));
      break;
    }
    case 'aircon': {
      const am = mat(c, {roughness:.3}), h = 1.8, fz = d/2 - .005;
      g.add(rbox(w, .06, d, '#cfd3d6', 0, 0, 0, .015), rbox(w - .01, h - .06, d - .01, am, 0, .06, 0, .06));
      g.add(rbox(w - .06, 1.0, .01, mat(lighter(c, .4), {roughness:.12}), 0, .22, fz, .005), box(w - .1, .42, .01, '#3d4145', 0, 1.28, fz));
      for (let i = 0; i < 8; i++) g.add(rot(box(w - .11, .012, .03, '#e4e7ea', 0, 1.3 + i*.05, fz + .008), -.35));
      g.add(box(.1, .035, .003, mat('#101214', {emissive:'#4fb3a5', emissiveIntensity:.7}), 0, 1.12, fz + .006));
      for (let i = 0; i < 8; i++) g.add(box(w - .12, .005, .004, '#b9bfc4', 0, .09 + i*.015, fz + .002));
      break;
    }
    case 'acwall': {
      const h = .3, am = mat(c, {roughness:.3}), s = new THREE.Shape();
      s.moveTo(0, .02); s.lineTo(0, h); s.lineTo(d*.75, h); s.quadraticCurveTo(d, h, d, h*.55); s.quadraticCurveTo(d, 0, d*.55, 0); s.lineTo(.02, 0); s.lineTo(0, .02);
      const geo = new THREE.ExtrudeGeometry(s, {depth:w - .02, bevelEnabled:true, bevelThickness:.01, bevelSize:.006, bevelSegments:3, curveSegments:16});
      geo.rotateY(-Math.PI/2); geo.translate((w - .02)/2, 2.2, bz); g.add(mesh(geo, am));
      g.add(box(w - .12, .004, .07, '#3a3d40', 0, 2.19, bz + d*.55), rot(box(w - .12, .008, .06, am, 0, 2.18, bz + d*.72), .35));
      g.add(box(.06, .018, .002, mat('#101214', {emissive:'#4fb3a5', emissiveIntensity:.7}), w*.3, 2.2 + h*.5, bz + d + .007));
      for (let i = 0; i < 6; i++) g.add(box(w - .12, .003, .008, '#d5d9dc', 0, 2.2 + h + .006, bz + .03 + i*.022));
      break;
    }
    case 'dishwasher': {
      const dm = mat(c, {metalness:.55, roughness:.28}), fz = d/2 - .02;
      g.add(box(w - .01, .08, d - .07, '#3a3834', 0, 0, -.035), box(w - .005, .76, d - .03, '#8b9095', 0, .08, -.015));
      g.add(rbox(w - .006, .7, .02, dm, 0, .085, fz, .004), box(w - .006, .055, .02, '#26282a', 0, .785, fz));
      for (let i = 0; i < 4; i++) g.add(box(.012, .006, .002, mat('#101214', {emissive:i ? '#6fd0ff' : '#7fe08a', emissiveIntensity:.8}), w*.1 + i*.03, .81, fz + .011));
      pull(g, w*.6, false, 0, .74, fz + .01);
      break;
    }
    case 'ovencol': {
      const cm = furnCabMat(f, c), h = cabHm(f), fz = d/2 - .02, frm = mat('#1c1d1f', {roughness:.3, metalness:.5}), gl = mat('#0b0c0d', {roughness:.03, metalness:.6});
      const sy = h / 2.1;
      g.add(box(w - .02, .08, d - .06, '#4a4641', 0, 0, -.03), box(w, h - .08, d - .02, cm, 0, .08, -.01));
      fronts(g, -w/2, .08, w, .6 * sy, fz, 1, 2, cm, 'bar');
      fronts(g, -w/2, 1.78 * sy, w, Math.max(.2, h - 1.8 * sy), fz, 1, 1, cm, 'bar', 1.84 * sy);
      [[.7, .58], [1.3, .46]].forEach(([y0, ah0]) => {
        const y = y0 * sy, ah = ah0 * sy;
        g.add(box(w - .02, ah - .01, .02, frm, 0, y, fz + .01), box(w - .1, ah*.52, .003, gl, 0, y + ah*.1, fz + .021), box(w - .04, .06, .003, '#2a2c2e', 0, y + ah - .075, fz + .021));
        g.add(box(.08, .022, .002, mat('#101214', {emissive:'#ff9a3c', emissiveIntensity:.7}), 0, y + ah - .056, fz + .023));
        pull(g, w*.7, false, 0, y + ah*.72, fz + .02);
      });
      break;
    }
    case 'purifier': {
      const pm = mat(c, {roughness:.45}), h = .72;
      g.add(rbox(w, h, d, pm, 0, 0, 0, Math.min(w, d)*.2), rbox(w - .05, .006, d - .05, '#8d959b', 0, h - .002, 0, .02));
      for (let i = 0; i < 7; i++) g.add(box(w - .07, .004, .006, '#6f777d', 0, h + .002, -d/2 + .05 + i*(d - .1)/6));
      g.add(rbox(w - .06, .42, .006, fabric('#c8ccd0'), 0, .06, d/2 - .001, .01));
      const rg = new THREE.Mesh(new THREE.TorusGeometry(.03, .004, 8, 32), mat('#101214', {emissive:'#4fb3a5', emissiveIntensity:.8})); rg.position.set(0, .6, d/2 + .002); g.add(rg);
      break;
    }
    case 'officechair': {
      const r = Math.min(w, d)*.46, dk = darker(c, .75), bm = mat('#2b2b2d', {roughness:.45}), cm = chrome();
      for (let k = 0; k < 5; k++){
        const a = k*Math.PI*2/5, tx = Math.sin(a)*r*.95, tz = Math.cos(a)*r*.95;
        g.add(rod([0, .1, 0], [tx, .07, tz], .022, bm, .014, 10), cyl(.008, .008, .03, bm, tx, .04, tz, 8), rot(cyl(.026, .026, .03, '#111', tx, .026 - .015, tz, 16), 0, a, Math.PI/2));
      }
      g.add(cyl(.05, .06, .05, bm, 0, .08, 0, 20), cyl(.025, .025, .22, cm, 0, .12, 0, 16), cyl(.036, .036, .12, bm, 0, .12, 0, 16), rbox(.22, .05, .22, bm, 0, .34, .02, .01));
      g.add(rbox(w*.78, .03, d*.72, bm, 0, .38, .04, .01), rbox(w*.8, .08, d*.74, fabric(c), 0, .4, .05, .035));
      g.add(tube([[0, .36, 0], [0, .38, bz + .12], [0, .6, bz + .07]], .02, bm));
      const bf = shell(w*.72, .6, .03, .025, .08, bm); bf.rotation.x = Math.PI/2 - .12; bf.position.set(0, .88, bz + .06); g.add(bf);
      g.add(rot(box(w*.68, .56, .006, mat(dk, {roughness:.85, transparent:true, opacity:.88, side:THREE.DoubleSide}), 0, .6, bz + .085), -.12), rot(rbox(w*.5, .08, .03, fabric(c), 0, .66, bz + .11, .015), -.12));
      g.add(rod([-.05, 1.14, bz + .025], [-.05, 1.22, bz + .015], .008, bm), rod([.05, 1.14, bz + .025], [.05, 1.22, bz + .015], .008, bm), rbox(w*.45, .12, .05, fabric(dk), 0, 1.2, bz + .02, .025));
      [-1, 1].forEach(s => g.add(box(.035, .22, .035, bm, s*w*.4, .42, .04), rbox(.07, .03, d*.4, bm, s*w*.4, .63, .04, .012)));
      break;
    }
    case 'piano': {
      const pk = mat(c, {roughness:.12, metalness:.1}), bd = d*.5, kz = bz + bd, h = 1.25, kd = d*.22 - .03, iv = mat('#faf8f3', {roughness:.3}), eb = mat('#111', {roughness:.25}), kw = (w - .12)/52;
      g.add(box(w, h, bd, pk, 0, 0, bz + bd/2), rbox(w + .02, .03, bd + .03, pk, 0, h, bz + bd/2 + .01, .008));
      [-1, 1].forEach(s => g.add(rbox(.06, .13, kd + .06, pk, s*(w/2 - .03), .6, kz + (kd + .06)/2, .01), box(.05, .6, .05, pk, s*(w/2 - .08), 0, kz + kd + .01), box(.06, .04, d - bd, pk, s*(w/2 - .08), 0, kz + (d - bd)/2)));
      g.add(box(w - .12, .08, kd + .05, pk, 0, .6, kz + (kd + .05)/2), box(w - .12, .1, .03, pk, 0, .68, kz + .015));
      for (let i = 0; i < 52; i++){
        const x = -w/2 + .06 + kw*(i + .5); g.add(box(kw - .0015, .022, kd, iv, x, .68, kz + .03 + kd/2));
        if (i < 51 && 'ACDFG'.includes('ABCDEFG'[i % 7])) g.add(box(kw*.58, .02, kd*.62, eb, x + kw/2, .7, kz + .03 + kd*.31));
      }
      g.add(rot(box(w*.42, .18, .012, pk, 0, .84, kz + .012), -.25));
      [-.06, 0, .06].forEach(x => g.add(box(.025, .012, .07, mat('#c9a35a', {metalness:.9, roughness:.3}), x, .05, kz + .03)));
      const mt = cyl(.0, .05, .2, woodM('#5a3e2b'), w*.3, h + .03, bz + bd/2, 4); mt.rotation.y = Math.PI/4; g.add(mt);
      g.add(rot(box(.14, .18, .015, woodM('#c9a27a'), -w*.3, h + .03, bz + .06), -.15), rot(box(.11, .14, .002, '#9fb3c2', -w*.3, h + .05, bz + .07), -.15));
      break;
    }
    case 'treadmill': {
      const tm = mat(c, {roughness:.55}), bm = mat('#2a2a2c', {roughness:.5}), al = mat('#9a9ea3', {metalness:.6, roughness:.4});
      g.add(rbox(w, .14, d - .25, tm, 0, .03, .125, .03), box(w - .16, .006, d - .5, '#141414', 0, .17, .15));
      [-1, 1].forEach(s => g.add(box(.07, .008, d - .45, al, s*(w/2 - .05), .17, .15)));
      [bz + .06, d/2 - .06].forEach(z => [-1, 1].forEach(s => g.add(box(.06, .03, .06, bm, s*(w/2 - .06), 0, z))));
      g.add(rbox(w, .22, .32, tm, 0, 0, bz + .16, .05));
      [-1, 1].forEach(s => g.add(rod([s*(w/2 - .06), .15, bz + .2], [s*(w/2 - .06), 1.15, bz + .3], .025, bm, .022), tube([[s*(w/2 - .06), 1.0, bz + .28], [s*(w/2 - .06), 1.0, bz + .5], [s*(w/2 - .07), .97, bz + .62]], .018, bm)));
      const cg = new THREE.Group(); cg.position.set(0, 1.2, bz + .31); cg.rotation.x = -.5;
      cg.add(rbox(w*.8, .2, .08, bm, 0, -.1, 0, .02), box(w*.4, .11, .004, screenMat('#2a5d8f'), 0, -.055, .041)); g.add(cg);
      break;
    }
    case 'ottoman': case 'bench': {
      const outdoor = /户外|花园|庭院|outdoor|patio/i.test(f.name || '');
      if (outdoor || f.type === 'bench' && /长凳/.test(f.name || '')){
        const wm = woodM(c), dark = woodM(darker(c, .78)), iron = mat('#4a4540', {metalness:.45, roughness:.4}), h = .46;
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
          g.add(rod([sx * (w / 2 - .07), 0, sz * (d / 2 - .07)], [sx * (w / 2 - .07), h, sz * (d / 2 - .07)], .018, iron, .022));
          g.add(box(.07, .04, .07, iron, sx * (w / 2 - .07), 0, sz * (d / 2 - .07)));
        });
        [-1, 1].forEach(sx => {
          g.add(box(.05, .48, .05, wm, sx * (w / 2 - .07), h, bz + .05));
          g.add(box(.05, .05, d - .14, wm, sx * (w / 2 - .07), h + .44, 0));
          g.add(box(.04, .04, .28, dark, sx * (w / 2 - .07), h + .22, bz + .12));
        });
        for (let i = 0; i < 6; i++){
          const z = -d / 2 + .09 + i * ((d - .18) / 5);
          g.add(rbox(w - .1, .032, .065, wm, 0, h, z, .006));
        }
        for (let i = 0; i < 5; i++) g.add(rbox(w - .14, .07, .028, dark, 0, h + .1 + i * .08, bz + .06, .005));
        g.add(box(w - .18, .035, .04, iron, 0, h + .02, 0));
        break;
      }
      const fm = fabric(c), dkm = fabric(darker(c, .8)), wm = woodM('#6b5a48'), h = f.type === 'bench' ? .45 : .4;
      g.add(rbox(w, h * .55, d, fm, 0, h * .45, 0, .04));
      // 顶面拉扣绗缝 + 十字缝线
      g.add(rbox(w - .04, .012, d - .04, fabric(lighter(c, .12)), 0, h, 0, .03));
      const btn = fabric(darker(c, .7));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
        g.add(blob(.014, .006, .014, btn, -w/2 + w*(i+1)/4, h + .014, -d/2 + d*(j+1)/4, 10));
      for (let i = 1; i < 4; i++) g.add(box(.004, .003, d - .08, dkm, -w/2 + w*i/4, h + .012, 0));
      for (let j = 1; j < 4; j++) g.add(box(w - .08, .003, .004, dkm, 0, h + .012, -d/2 + d*j/4));
      // 滚边
      g.add(rbox(w, .01, .01, fabric(lighter(c, .3)), 0, h - .01, d/2 - .005, .004));
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) =>
        g.add(box(.05, h * .45, .05, wm, sx * (w / 2 - .06), 0, sz * (d / 2 - .06))));
      break;
    }
    case 'mirror': {
      const h = Math.min(2.0, Math.max(1.2, w * 2.2));
      g.add(box(w, h, .02, mat('#8a939c', {metalness:.4, roughness:.35}), 0, 0, bz + .01));
      g.add(box(w - .04, h - .04, .008, mat('#c5d4e0', {roughness:.05, metalness:.3}), 0, .02, bz + .025));
      break;
    }
    case 'console': {
      const cm = furnCabMat(f, c), h = cabHm(f), fz = d/2 - .02;
      g.add(box(w, .04, d, cm, 0, h - .04, 0));
      g.add(rbox(w + .02, .012, d + .02, woodM(lighter(c, .12)), 0, h, 0, .004));
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) =>
        g.add(rod([sx*(w/2 - .05), 0, sz*(d/2 - .04)], [sx*(w/2 - .05), h - .04, sz*(d/2 - .04)], .014, cm, .02)));
      g.add(box(w - .1, Math.max(.2, h * .45), d - .08, woodM(darker(c, .92)), 0, .08, 0));
      fronts(g, -w/2 + .06, .1, w - .12, Math.max(.18, h*.4), fz - .01, 3, 1, cm, 'knob');
      vase(g, -w*.28, h, 0, .06, .22, '#e9e2d6', R);
      g.add(rbox(.24, .02, .16, '#3b5566', w*.26, h, .02, .004));
      break;
    }
    case 'hanger': {
      const bm = woodM(c), r = Math.min(w, d) / 2;
      g.add(cyl(r * .35, r * .35, .03, bm, 0, 0, 0, 24));
      g.add(rod([0, .03, 0], [0, 1.65, 0], .018, bm));
      [-.28, 0, .28].forEach((x, i) => g.add(rod([0, 1.35 + i * .08, 0], [x, 1.25 + i * .05, 0], .01, bm)));
      g.add(rod([-.25, 1.55, 0], [.25, 1.55, 0], .012, bm));
      break;
    }
    case 'microwave': {
      const mm = mat(c, {metalness:.55, roughness:.28}), dark = mat('#15171a', {roughness:.25, metalness:.2});
      const glass = mat('#1a2228', {roughness:.08, metalness:.35}), chrome = mat('#d0d4d8', {metalness:.85, roughness:.2});
      const y0 = .82, h = .38;
      g.add(rbox(w, h, d, mm, 0, y0, 0, .012));
      // window + bezel
      g.add(rbox(w * .58, h * .62, .012, dark, -w * .12, y0 + h * .18, d / 2 - .008, .008));
      g.add(box(w * .52, h * .52, .004, glass, -w * .12, y0 + h * .22, d / 2 + .002));
      // mesh pattern hint inside window
      for (let i = 0; i < 5; i++) g.add(box(w * .48, .004, .002, '#2a3238', -w * .12, y0 + h * .28 + i * .04, d / 2 + .005));
      // control panel
      g.add(rbox(w * .22, h * .72, .018, mat(darker(c, .88), {metalness:.4, roughness:.35}), w * .32, y0 + h * .14, d / 2 - .01, .006));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
        g.add(box(.028, .022, .006, chrome, w * .26 + j * .04, y0 + h * .55 - i * .06, d / 2 + .005));
      g.add(cyl(.018, .018, .012, chrome, w * .34, y0 + h * .22, d / 2 + .002, 16));
      // handle
      g.add(box(.012, h * .45, .02, chrome, -w * .42, y0 + h * .28, d / 2 + .01));
      g.add(box(.04, .012, .016, chrome, -w * .4, y0 + h * .48, d / 2 + .012));
      g.add(box(.04, .012, .016, chrome, -w * .4, y0 + h * .28, d / 2 + .012));
      // feet + brand strip
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
        g.add(box(.04, .02, .04, dark, sx * (w / 2 - .06), y0, sz * (d / 2 - .06))));
      g.add(box(w * .3, .008, .004, glowMat('#8af', '#4cf', .4), w * .3, y0 + h * .72, d / 2 + .006));
      break;
    }
    case 'planter': {
      const long = w / d > 1.5, terracotta = mat(c, {roughness:.72}), rim = woodM(darker(c, .82)), soil = mat('#3d2f22', {roughness:.95});
      const leafA = mat('#5f8f4e', {roughness:.6, side:THREE.DoubleSide}), leafB = mat('#7eab62', {roughness:.6, side:THREE.DoubleSide}), leafC = mat('#4e7a40', {roughness:.65, side:THREE.DoubleSide});
      const flowerCols = ['#f3e6d8', '#e8a090', '#f6d27a', '#ffffff', '#d4a5c8', '#f0b070'];
      const addBloom = (px, py, pz, col) => {
        g.add(blob(.022, .018, .022, col, px, py, pz, 12));
        for (let p = 0; p < 5; p++){
          const a = p * 1.26;
          g.add(blob(.012, .005, .016, col, px + Math.cos(a) * .028, py + .004, pz + Math.sin(a) * .028, 8));
        }
      };
      if (long){
        const h = .5;
        g.add(rbox(w, h - .04, d, terracotta, 0, 0, 0, .025));
        g.add(rbox(w + .04, .045, d + .04, rim, 0, h - .04, 0, .01));
        g.add(rbox(w - .02, .02, d - .02, terracotta, 0, h - .055, 0, .006));
        g.add(box(w - .12, .03, d - .12, soil, 0, h - .02, 0));
        // drainage feet
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) =>
          g.add(box(.06, .025, .06, rim, sx * (w / 2 - .1), 0, sz * (d / 2 - .08))));
        const n = Math.max(6, Math.round(w / .2));
        for (let k = 0; k < n; k++){
          const px = -w / 2 + .16 + k * ((w - .32) / Math.max(1, n - 1)), pz = (R() - .5) * (d - .2);
          const hh = .26 + R() * .42;
          g.add(rod([px, h, pz], [px + (R() - .5) * .05, h + hh, pz + (R() - .5) * .05], .006, '#5a4a30', .004, 6));
          for (let L = 0; L < 5; L++){
            const a = L * 1.35 + R(), len = .06 + R() * .08;
            const lf = blob(len / 2, .004, len * .3, [leafA, leafB, leafC][L % 3], px + Math.cos(a) * .025, h + hh * (.35 + L * .12), pz + Math.sin(a) * .025, 12);
            lf.rotation.z = -.4; g.add(lf);
          }
          if (R() > .35) addBloom(px, h + hh + .02, pz, flowerCols[k % flowerCols.length]);
        }
      } else {
        const r = Math.min(w, d) / 2, h = .5;
        g.add(lathe([[0, 0], [r * .55, 0], [r * .62, .02], [r * .78, .04], [r * .92, h * .5], [r * .86, h * .82], [r * .94, h]], terracotta, 0, 0, 0, 40));
        g.add(ring(r * .9, .014, rim, 0, h - .01, 0));
        g.add(cyl(r * .78, r * .78, .025, soil, 0, h - .015, 0, 28));
        for (let k = 0; k < 9; k++){
          const a = k * .7 + R() * .25, rr = r * (.12 + R() * .4), px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
          const hh = .28 + R() * .48;
          g.add(rod([px, h, pz], [px + (R() - .5) * .04, h + hh, pz + (R() - .5) * .04], .007, '#5a4a30', .005, 6));
          for (let L = 0; L < 5; L++){
            const ang = L * 1.35 + a, len = .07 + R() * .08;
            const lf = blob(len / 2, .005, len * .3, [leafA, leafB, leafC][L % 3], px + Math.cos(ang) * .03, h + hh * (.4 + L * .1), pz + Math.sin(ang) * .03, 12);
            lf.rotation.z = -.35; g.add(lf);
          }
          if (R() > .3) addBloom(px, h + hh + .025, pz, flowerCols[k % flowerCols.length]);
        }
      }
      break;
    }
    case 'umbrella': {
      // 伞形：尖顶 + 分骨伞瓣 + 骨间下垂波浪边，避免标准圆球盖
      const r = Math.min(w, d) / 2;
      const pole = mat('#5c564e', {metalness:.45, roughness:.35});
      const baseM = woodM('#6b5d4c');
      const clothA = mat(c, {roughness:.92, side:THREE.DoubleSide});
      const clothB = mat(darker(c, .86), {roughness:.92, side:THREE.DoubleSide});
      const segs = 8, apex = 2.42, edgeY0 = 1.72, scallop = .14;
      const ribM = mat(darker(c, .72), {roughness:.85});   // 伞骨与伞面同色系，避免看成裂缝
      g.add(cyl(r * .28, r * .3, .08, baseM, 0, 0, 0, 36));
      g.add(cyl(r * .22, r * .22, .04, woodM(darker('#6b5d4c', .85)), 0, .08, 0, 28));
      g.add(cyl(r * .06, r * .07, .1, pole, 0, .1, 0, 16));
      g.add(rod([0, .2, 0], [0, apex - .06, 0], .016, pole, .02));
      g.add(rbox(.06, .07, .045, pole, .055, 1.05, 0, .008));
      g.add(cyl(.014, .014, .06, pole, .09, 1.05, 0, 12));
      g.add(cyl(.034, .026, .055, pole, 0, apex - .1, 0, 16));
      // 伞面高度：尖顶陡落到边缘，骨间再下垂形成伞形波浪
      const canopyY = (t, u) => {
        const dome = apex - (apex - edgeY0) * Math.pow(t, 1.15);
        const dip = scallop * Math.sin(Math.PI * u) * Math.pow(t, 2.2);
        return dome - dip;
      };
      const canopyR = (t) => r * (.04 + .96 * (1 - Math.pow(1 - t, 1.35)));
      for (let k = 0; k < segs; k++){
        const a0 = k * Math.PI * 2 / segs, a1 = (k + 1) * Math.PI * 2 / segs;
        const nr = 12, nu = 8;
        const pos = [], idx = [];
        for (let i = 0; i <= nr; i++){
          const t = i / nr;
          for (let j = 0; j <= nu; j++){
            const u = j / nu, ang = a0 + (a1 - a0) * u;
            const rr = canopyR(t), yy = canopyY(t, u);
            pos.push(Math.cos(ang) * rr, yy, Math.sin(ang) * rr);
          }
        }
        for (let i = 0; i < nr; i++){
          for (let j = 0; j < nu; j++){
            const a = i * (nu + 1) + j, b = a + nu + 1;
            idx.push(a, b, a + 1, a + 1, b, b + 1);
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        const panel = new THREE.Mesh(geo, k % 2 ? clothA : clothB);
        panel.castShadow = panel.receiveShadow = true;
        g.add(panel);
        // 伞骨：顶到骨尖（边缘最高点，无下垂）
        const mid = a0 + Math.PI / segs;
        const ribR = canopyR(1), ribY = canopyY(1, 0);
        g.add(rod([0, apex - .04, 0], [Math.cos(a0) * ribR, ribY, Math.sin(a0) * ribR], .007, ribM, .005, 8));
        // 骨尖小帽
        g.add(cyl(.01, .007, .03, pole, Math.cos(a0) * ribR, ribY - .01, Math.sin(a0) * ribR, 8));
        // 波浪边沿细绳感（中点下垂处）
        const scallopY = canopyY(1, .5);
        g.add(blob(.025, .012, .025, darker(c, .75), Math.cos(mid) * r * .98, scallopY - .01, Math.sin(mid) * r * .98, 8));
      }
      g.add(blob(.05, .028, .05, pole, 0, apex - .02, 0, 12));
      g.add(cyl(.014, .008, .09, pole, 0, apex, 0, 10));
      break;
    }
    case 'bbq': {
      const mm = mat(c, {metalness:.72, roughness:.28}), dark = mat('#141416', {metalness:.45, roughness:.48});
      const chr = mat('#d4d8dc', {metalness:.9, roughness:.15}), rust = mat('#3a2a22', {metalness:.35, roughness:.55});
      const y0 = .42, bodyH = .48, bw = w * .78, bd = d * .88;
      // 前轮后脚
      [[-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const x = sx * (bw / 2 - .06), z = sz * (bd / 2 - .06);
        g.add(box(.045, y0 - .06, .045, mm, x, .06, z));
        const wh = cyl(.055, .055, .04, dark, x, .02, z + .02, 18);
        wh.rotation.z = Math.PI / 2; g.add(wh);
        g.add(cyl(.012, .012, .05, chr, x, .05, z + .02, 10));
      });
      [[-1, -1], [1, -1]].forEach(([sx]) => {
        const x = sx * (bw / 2 - .06), z = -bd / 2 + .06;
        g.add(box(.05, .03, .05, dark, x, 0, z));
        g.add(box(.04, y0, .04, mm, x, .03, z));
      });
      // 下柜 + 储物门
      g.add(rbox(bw, y0 - .02, bd, mm, 0, .02, 0, .015));
      g.add(rbox(bw * .9, y0 * .55, .02, dark, 0, .08, bd / 2 - .01, .006));
      g.add(box(.08, .015, .02, chr, 0, y0 * .35, bd / 2 + .01));
      // 炉膛
      g.add(rbox(bw, bodyH, bd, mm, 0, y0, 0, .02));
      g.add(box(bw - .06, .02, bd - .06, rust, 0, y0 + .02, 0));
      g.add(box(bw * .72, .012, bd * .62, glowMat('#ff7a30', '#ff3a08', .85), 0, y0 + .06, 0));
      // 烤网
      for (let i = 0; i < 9; i++){
        const z = -bd * .32 + i * (bd * .64 / 8);
        g.add(box(bw * .7, .008, .01, chr, 0, y0 + bodyH - .05, z));
      }
      for (let i = 0; i < 3; i++) g.add(box(.01, .008, bd * .64, chr, -bw * .28 + i * (bw * .28), y0 + bodyH - .05, 0));
      // 正面温控旋钮 + 标牌
      [-.16, 0, .16].forEach(x => {
        g.add(cyl(.028, .03, .02, dark, x, y0 + .18, bd / 2 + .01, 16));
        g.add(cyl(.012, .012, .015, chr, x, y0 + .19, bd / 2 + .025, 10));
      });
      g.add(box(.14, .04, .008, chr, 0, y0 + .32, bd / 2 + .01));
      // 铰链盖（后缘）+ 温度表 + 把手
      const lidG = new THREE.Group();
      lidG.add(rbox(bw * .96, .07, bd * .72, mm, 0, 0, 0, .02));
      lidG.add(box(bw * .9, .015, bd * .66, dark, 0, .04, 0));
      lidG.add(cyl(.035, .035, .02, dark, 0, .055, -bd * .12, 20));
      lidG.add(cyl(.02, .02, .012, chr, 0, .065, -bd * .12, 14));
      lidG.add(box(bw * .32, .025, .04, chr, 0, .05, bd * .28));
      [-1, 1].forEach(sx => lidG.add(cyl(.012, .012, .04, dark, sx * (bw / 2 - .04), .02, -bd * .34, 10)));
      lidG.position.set(0, y0 + bodyH, -bd * .28);
      lidG.rotation.x = -.72;
      g.add(lidG);
      // 侧台 + 挂勾
      g.add(rbox(.22, .025, bd * .7, mm, bw / 2 + .12, y0 + bodyH - .02, 0, .008));
      g.add(box(.03, .1, .04, mm, bw / 2 + .02, y0 + bodyH - .12, 0));
      [-.12, 0, .12].forEach(z => g.add(rod([bw / 2 + .18, y0 + bodyH - .02, z], [bw / 2 + .18, y0 + bodyH - .12, z], .006, chr)));
      // 烟囱帽
      g.add(cyl(.04, .05, .08, mm, -bw / 2 + .08, y0 + bodyH, -bd / 2 + .08, 14));
      g.add(cyl(.06, .02, .03, dark, -bw / 2 + .08, y0 + bodyH + .08, -bd / 2 + .08, 14));
      break;
    }
    case 'fountain': case 'pond': {
      const stone = mat(c, {roughness:.52}), moss = mat('#6a8a5c', {roughness:.85});
      const water = mat('#6eb8c8', {roughness:.04, metalness:.28, transparent:true, opacity:.48});
      const waterDeep = mat('#3a7a8c', {roughness:.08, metalness:.22, transparent:true, opacity:.62});
      const r = Math.min(w, d) / 2;
      if (f.type === 'pond'){
        g.add(shell(w, d, .18, .08, Math.min(.2, r * .35), stone, 0, 0, 0));
        g.add(box(w - .2, .04, d - .2, waterDeep, 0, .04, 0));
        g.add(box(w - .22, .03, d - .22, water, 0, .07, 0));
        for (let k = 0; k < 5; k++){
          const a = k * 1.4 + .3, rr = r * (.25 + (k % 3) * .12);
          g.add(cyl(.08 + R() * .04, .08, .015, moss, Math.cos(a) * rr, .1, Math.sin(a) * rr, 16));
        }
        for (let k = 0; k < 8; k++){
          const a = k * .9, rr = r * (.35 + R() * .25);
          g.add(blob(.02, .015, .02, water, Math.cos(a) * rr, .12 + R() * .04, Math.sin(a) * rr, 8));
        }
        for (let k = 0; k < 12; k++){
          const a = k * Math.PI / 6;
          g.add(blob(.03 + R() * .02, .02, .025, stone, Math.cos(a) * (r - .05), .16, Math.sin(a) * (r - .05), 10));
        }
        break;
      }
      const rim = mat(lighter(c, .1), {roughness:.48});
      const mkWater = (hex, op) => mat(hex, {roughness:.05, metalness:.2, transparent:true, opacity:op, depthWrite:false}).clone();
      // 底座盆（竖直、稳）
      g.add(cyl(r, r * .97, .2, stone, 0, 0, 0, 48));
      // 底座石盆：双层压边与凿痕
      g.add(ring(r*.99, .012, mat(lighter(c,.18),{roughness:.5}), 0, .04, 0));
      for(let k=0;k<24;k++){ const a=k*Math.PI/12; g.add(box(.012,.006,.02,mat(darker(c,.8),{roughness:.8}),Math.cos(a)*r*.98,.12,Math.sin(a)*r*.98)); }
      g.add(ring(r * .96, .03, rim, 0, .19, 0));
      const poolLo = cyl(r * .86, r * .86, .05, mkWater('#5aaec0', .45), 0, .14, 0, 40);
      g.add(poolLo);
      g.add(cyl(r * .82, r * .82, .02, waterDeep, 0, .12, 0, 36));
      // 中柱（圆柱，避免异形 lathe 视觉歪斜）
      const colR = Math.max(.07, r * .13);
      g.add(cyl(colR * 1.25, colR * 1.35, .06, rim, 0, .2, 0, 24));
      g.add(cyl(colR, colR * .95, .7, stone, 0, .26, 0, 28));
      g.add(cyl(colR * 1.2, colR * 1.1, .05, rim, 0, .96, 0, 24));
      // 中盆
      g.add(cyl(r * .4, r * .36, .09, stone, 0, 1.0, 0, 40));
      g.add(ring(r * .38, .02, rim, 0, 1.07, 0));
      const poolMid = cyl(r * .32, r * .32, .04, mkWater('#5aaec0', .5), 0, 1.04, 0, 32);
      g.add(poolMid);
      // 顶盆 + 喷嘴
      g.add(cyl(r * .15, r * .13, .07, stone, 0, 1.1, 0, 28));
      g.add(cyl(r * .05, r * .055, .08, stone, 0, 1.16, 0, 16));
      const jetY0 = 1.24;
      const mkSpray = () => mkWater('#b8e8f2', .5);
      const jet = cyl(.014, .01, .32, mkSpray(), 0, jetY0, 0, 12);
      g.add(jet);
      const crown = blob(.04, .045, .04, mkSpray(), 0, jetY0 + .34, 0, 12);
      g.add(crown);
      // 水珠（只做位移动画，不缩放杆件）
      const drops = [];
      for (let k = 0; k < 12; k++){
        const drop = blob(.01, .014, .01, mkSpray(), 0, jetY0, 0, 8);
        drop.userData.phase = k / 12;
        g.add(drop); drops.push(drop);
      }
      // 溢流：细柱竖直落点，避免斜杆非均匀缩放产生“大气泡”
      const streams = [];
      for (let k = 0; k < 6; k++){
        const a = k * Math.PI / 3;
        const x = Math.cos(a) * r * .3, z = Math.sin(a) * r * .3;
        const stream = cyl(.008, .01, .72, mkSpray(), x, .3, z, 8);
        stream.userData.phase = k / 6;
        stream.userData.baseX = x; stream.userData.baseZ = z;
        g.add(stream); streams.push(stream);
      }
      for (let k = 0; k < 6; k++){
        const a = k * 1.05;
        g.add(blob(.03, .012, .025, moss, Math.cos(a) * r * .88, .2, Math.sin(a) * r * .88, 10));
      }
      g.userData.fx = 'fountain';
      g.userData.fxParts = {jet, crown, drops, streams, poolLo, poolMid, r, jetY0};
      break;
    }
    case 'pergola': {
      // 干净木构凉棚：柱脚/柱头、主梁出挑、密椽，藤蔓克制贴梁不垂挂彩蘑菇
      const wm = woodM(c), dark = woodM(darker(c, .78)), light = woodM(lighter(c, .1));
      const leaf = mat('#6a9a58', {roughness:.7, side:THREE.DoubleSide});
      const h = 2.5, tw = .14, oh = .28;
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
        const x = sx * (w / 2 - tw), z = sz * (d / 2 - tw);
        g.add(box(tw * 1.35, .1, tw * 1.35, dark, x, 0, z));
        g.add(box(tw, h - .16, tw, wm, x, .1, z));
        g.add(box(tw * 1.25, .06, tw * 1.25, dark, x, h - .1, z));
        g.add(box(tw * 1.4, .04, tw * 1.4, light, x, h - .05, z));
      });
      // 主梁（长向出挑）
      [-1, 1].forEach(sz => {
        const z = sz * (d / 2 - tw);
        g.add(box(w + oh * 2, tw * .85, tw * .75, wm, 0, h - tw * .7, z));
        [-1, 1].forEach(sx => g.add(box(.06, tw * .85, .04, dark, sx * (w / 2 + oh * .55), h - tw * .7, z)));
      });
      // 次梁（短向）
      [-1, 1].forEach(sx => {
        g.add(box(tw * .75, tw * .7, d + oh * 1.2, dark, sx * (w / 2 - tw), h - tw * .65, 0));
      });
      // 密椽（均匀间距，两端切角感）
      const n = Math.max(7, Math.round((w + oh) / .28));
      for (let i = 0; i < n; i++){
        const x = -(w / 2 + oh * .6) + (w + oh * 1.2) * (i + .5) / n;
        g.add(box(.055, .05, d + oh * 1.4, light, x, h - .02, 0));
      }
      // 少量藤叶贴在梁侧与椽上，不垂长条彩花
      for (let k = 0; k < 12; k++){
        const x = (R() - .5) * (w * .7), z = (R() - .5) * (d * .7);
        g.add(blob(.05 + R() * .03, .015, .06 + R() * .03, leaf, x, h + .02, z, 10));
      }
      // 一根柱上稀疏攀藤（细茎+小叶）
      {
        const x = w / 2 - tw, z = d / 2 - tw;
        for (let i = 0; i < 5; i++){
          const y0 = .4 + i * .38, y1 = y0 + .32;
          g.add(rod([x + .08, y0, z + .02], [x + .1, y1, z + .04], .008, '#5a4a30', .006, 6));
          g.add(blob(.04, .012, .05, leaf, x + .12, y1, z + .05, 10));
        }
      }
      // 椽间藤花与垂叶（克制点缀）
      for(let k=0;k<10;k++){
        const x=(R()-.5)*(w*.78), z=(R()-.5)*(d*.78);
        g.add(blob(.04+R()*.02,.014,.05+R()*.02,mat(k%2?'#e8a090':'#f3e6d8',{roughness:.8}),x,h+.05,z,10));
        g.add(blob(.05,.012,.06,leaf,x+.03,h+.03,z-.02,10));
      }
      break;
    }
    case 'gardenfence': {
      // 花园围墙：石柱 + 压顶 + 木栅/铁横档，可自由摆放拼段
      const stone = mat(c, {roughness:.88}), stoneDark = mat(darker(c, .82), {roughness:.9});
      const cap = mat(lighter(c, .08), {roughness:.75});
      const wood = woodM('#8a7355'), woodDark = woodM('#6a5640');
      const iron = mat('#2a2826', {metalness:.45, roughness:.42});
      const leaf = mat('#6a9a58', {roughness:.7});
      const short = /矮|low/i.test(f.name || '') || w < 2.2;
      const h = short ? 1.05 : 1.35, post = Math.min(.22, w * .08), panelH = h * .72;
      // 两端石柱
      [-1, 1].forEach(sx => {
        const x = sx * (w / 2 - post / 2);
        g.add(box(post * 1.15, .08, Math.max(d, .22), stoneDark, x, 0, 0));
        g.add(box(post, h, Math.max(d * .85, .18), stone, x, .08, 0));
        g.add(box(post * 1.2, .05, Math.max(d, .22), cap, x, h + .08, 0));
        g.add(box(post * .7, .04, post * .7, stoneDark, x, h + .13, 0));
        // 柱身浅槽
        g.add(box(post * .08, h * .7, Math.max(d * .9, .2), stoneDark, x + sx * post * .42, h * .2, 0));
      });
      // 中柱（长段）
      const span = w - post * 2;
      const midN = short ? 0 : (span > 2.2 ? 1 : 0);
      for (let i = 0; i < midN; i++){
        const x = -span / 2 + span * (i + 1) / (midN + 1);
        g.add(box(post * .7, h * .92, Math.max(d * .7, .14), stone, x, .06, 0));
        g.add(box(post * .85, .04, Math.max(d * .8, .16), cap, x, h * .92 + .06, 0));
      }
      // 横梁 + 竖栅
      const rails = [panelH * .22, panelH * .55, panelH * .88];
      const z0 = 0;
      rails.forEach((yy, ri) => {
        g.add(box(span - .04, ri === 1 ? .045 : .035, .05, ri === 1 ? woodDark : wood, 0, yy, z0));
      });
      const pickets = Math.max(6, Math.round(span / .16));
      for (let i = 0; i < pickets; i++){
        const x = -span / 2 + span * (i + .5) / pickets;
        g.add(box(.04, panelH - .06, .03, wood, x, .1, z0));
        g.add(box(.028, .08, .028, iron, x, panelH + .04, z0));
      }
      // 底梁 / 踢脚
      g.add(box(span - .02, .06, Math.max(d * .7, .12), stoneDark, 0, 0, 0));
      // 少量藤叶点缀柱侧
      [-1, 1].forEach(sx => {
        const x = sx * (w / 2 - post / 2);
        for (let k = 0; k < 3; k++){
          g.add(blob(.04, .015, .05, leaf, x + sx * .08, .35 + k * .28, d * .35, 8));
        }
      });
      break;
    }
    case 'gardenbench': {
      // 公园长椅：侧架一体、扶手连到前后腿、底撑接在腿上
      const wood = woodM(c), woodDark = woodM(darker(c, .82));
      const iron = mat('#2a2826', {metalness:.4, roughness:.45});
      const seatY = .44, backH = .42;
      const zF = d / 2 - .07, zB = -d / 2 + .07;
      const seatDepth = zF - zB - .06;
      [-1, 1].forEach(sx => {
        const x = sx * (w / 2 - .05);
        // 前腿、后腿（后腿通到靠背顶）
        g.add(box(.05, seatY, .05, iron, x, 0, zF));
        g.add(box(.05, seatY + backH, .05, iron, x, 0, zB));
        // 坐面侧梁：贴住前后腿
        g.add(box(.04, .04, zF - zB, iron, x, seatY - .02, (zF + zB) / 2));
        // 扶手立柱（前）+ 扶手横杆接到后腿
        g.add(box(.045, .2, .045, iron, x, seatY, zF));
        g.add(box(.045, .04, zF - zB - .04, iron, x, seatY + .18, (zF + zB) / 2 + .02));
        // 靠背顶与后腿连接块
        g.add(box(.05, .04, .05, iron, x, seatY + backH - .02, zB));
      });
      // 底撑：卡在前后腿之间
      g.add(box(w - .12, .035, .04, iron, 0, .12, zF));
      g.add(box(w - .12, .035, .04, iron, 0, .12, zB));
      // 坐板
      const nSeat = 5;
      for (let i = 0; i < nSeat; i++){
        const z = zB + .08 + i * ((seatDepth - .04) / (nSeat - 1));
        g.add(rbox(w - .14, .032, .048, i % 2 ? woodDark : wood, 0, seatY, z, .005));
      }
      // 靠背横条
      const nBack = 4;
      for (let i = 0; i < nBack; i++){
        const y = seatY + .08 + i * ((backH - .12) / (nBack - 1));
        g.add(rbox(w - .14, .042, .028, i % 2 ? wood : woodDark, 0, y, zB + .02, .005));
      }
      g.add(box(w - .12, .035, .04, iron, 0, seatY + backH - .02, zB));
      // 铸铁卷花侧架 + 木条端头倒角
      [-1,1].forEach(sx=>{
        const x=sx*(w/2-.05);
        const curl=mesh(new THREE.TorusGeometry(.09,.008,8,20,Math.PI*1.6),iron);
        curl.position.set(x,seatY+.13,zB-.02); curl.rotation.set(0,Math.PI/2,.5); g.add(curl);
        g.add(box(.012,.14,.012,iron,x,seatY+.05,zF));
      });
      break;
    }
    case 'stonebench': {
      // 矮石凳：整板坐面 + 两端石墩
      const stone = mat(c, {roughness:.62}), shade = mat(darker(c, .88), {roughness:.7});
      const seatY = .38, seatT = .09, seatD = Math.min(d * .88, .55);
      const legW = Math.min(.22, w * .2), legD = seatD * .7;
      g.add(rbox(w, seatT, seatD, stone, 0, seatY, 0, .02));
      g.add(rbox(w * .98, .02, seatD * .92, shade, 0, seatY + seatT - .01, 0, .01));
      [-1, 1].forEach(sx => {
        const x = sx * (w / 2 - legW / 2 - w * .04);
        g.add(rbox(legW * 1.15, .04, legD * 1.1, shade, x, 0, 0, .012));
        g.add(rbox(legW, seatY, legD, stone, x, .04, 0, .015));
      });
      break;
    }
    case 'patiochaise': {
      // 躺椅：四腿矩形底框 + 侧梁 + 铰接靠背；斜撑两端落在侧梁与靠背框上
      const fab = fabric(c), pillow = fabric(lighter(c, .14)), seam = fabric(darker(c, .88));
      const frame = mat('#2c2a28', {metalness:.4, roughness:.38});
      const h = .38, zFoot = d / 2 - .05, zHead = -d / 2 + .05;
      const zHinge = zHead + .12;
      const seatLen = zFoot - zHinge;
      const backLen = Math.min(d * .36, .68);
      const theta = .88;
      const xL = -(w / 2 - .05), xR = w / 2 - .05;
      const yLow = .11;
      // 四腿
      [[xL, zFoot], [xR, zFoot], [xL, zHead], [xR, zHead]].forEach(([x, z], i) => {
        g.add(box(.04, h, .04, frame, x, 0, z));
        if (i < 2){
          const wh = cyl(.042, .042, .03, frame, x, .04, z + .025, 14);
          wh.rotation.z = Math.PI / 2; g.add(wh);
        } else g.add(cyl(.035, .035, .015, frame, x, 0, z, 12));
      });
      // 底框：前后横撑 + 左右纵撑，全部接到四腿（无悬空杆）
      g.add(box(w - .12, .03, .03, frame, 0, yLow, zFoot));
      g.add(box(w - .12, .03, .03, frame, 0, yLow, zHead));
      g.add(box(.03, .03, zFoot - zHead, frame, xL, yLow, (zFoot + zHead) / 2));
      g.add(box(.03, .03, zFoot - zHead, frame, xR, yLow, (zFoot + zHead) / 2));
      // 坐面侧梁 + 前后横梁
      g.add(box(.04, .04, zFoot - zHead, frame, xL, h, (zFoot + zHead) / 2));
      g.add(box(.04, .04, zFoot - zHead, frame, xR, h, (zFoot + zHead) / 2));
      g.add(box(w - .12, .035, .035, frame, 0, h, zFoot));
      g.add(box(w - .12, .035, .035, frame, 0, h, zHead));
      // 坐垫（仅平躺段）
      g.add(rbox(w - .1, .07, seatLen - .05, fab, 0, h + .02, (zFoot + zHinge) / 2, .02));
      for (let i = 0; i < 3; i++){
        const z = zHinge + .12 + i * ((seatLen - .22) / 2);
        g.add(box(w - .16, .01, .025, seam, 0, h + .08, z));
      }
      // 靠背
      const back = new THREE.Group();
      [xL + .015, xR - .015].forEach(x => back.add(box(.032, backLen, .032, frame, x, 0, 0)));
      back.add(box(w - .16, .03, .03, frame, 0, .01, 0));
      back.add(box(w - .16, .03, .03, frame, 0, backLen - .04, 0));
      back.add(rbox(w - .14, backLen - .1, .055, fab, 0, .05, .015, .02));
      back.add(rbox(w - .24, .13, .07, pillow, 0, backLen - .16, .04, .025));
      back.position.set(0, h + .02, zHinge);
      back.rotation.x = -theta;
      g.add(back);
      [-1, 1].forEach(sx => g.add(cyl(.018, .018, .04, frame, sx * (w / 2 - .05), h + .02, zHinge, 12)));
      // 斜撑：从侧梁卡位到靠背中段横杆
      const ly = backLen * .4;
      const ay = h + .02 + ly * Math.cos(theta);
      const az = zHinge - ly * Math.sin(theta);
      const pz = zHinge + .22;
      [xL, xR].forEach(x => {
        g.add(box(.018, .02, .03, frame, x, h + .02, pz)); // 卡位块贴在侧梁上
        g.add(rod([x, h + .03, pz], [x, ay, az], .01, frame));
      });
      // 腰枕与搭毯
      g.add(rbox(w*.36,.1,.12,pillow,0,h+.1,zHinge+.12,.03));
      const throwM=fabric('#c9a98a');
      g.add(rbox(w*.5,.012,.26,throwM,w*.16,h+.09,zFoot-.18,.01));
      break;
    }
    case 'gardenlamp': {
      // 欧式庭院灯：铸铁灯柱 + 六角玻璃灯箱 + 檐盖
      const metal = mat(c, {metalness:.55, roughness:.36}), black = mat('#2a2826', {metalness:.4, roughness:.45});
      const r = Math.min(w, d) / 2, glow = glowMat('#fff4dc', '#ffdca0', .8);
      const glass = mat('#dfeaf0', {transparent:true, opacity:.28, roughness:.06, side:THREE.DoubleSide});
      const brass = mat('#c8a86e', {metalness:.8, roughness:.25});
      g.add(cyl(r * .5, r * .55, .05, metal, 0, 0, 0, 28));
      g.add(lathe([[r*.2, 0], [r*.24, .03], [r*.16, .08], [.03, .1]], black, 0, .05, 0, 24));
      g.add(rod([0, .14, 0], [0, 1.46, 0], .018, metal, .022));
      g.add(ring(r * .13, .008, brass, 0, .45, 0), ring(r * .13, .008, brass, 0, 1.36, 0));
      g.add(cyl(r * .36, r * .36, .36, glow, 0, 1.52, 0, 24));
      for (let k = 0; k < 6; k++){
        const a = k * Math.PI / 3;
        g.add(box(.012, .34, r * .5, glass, Math.cos(a) * r * .33, 1.54, Math.sin(a) * r * .33));
        g.add(rod([Math.cos(a) * r * .46, 1.48, Math.sin(a) * r * .46], [Math.cos(a) * r * .46, 1.91, Math.sin(a) * r * .46], .008, metal));
      }
      g.add(lathe([[r*.5, 0], [r*.55, .03], [r*.48, .06]], metal, 0, 1.44, 0, 30));
      g.add(lathe([[r*.5, 0], [r*.52, .04], [.02, .14]], metal, 0, 1.9, 0, 30));
      g.add(ring(r * .5, .006, black, 0, 1.9, 0));
      g.add(blob(.035, .03, .035, metal, 0, 2.05, 0, 12));
      glowBulb(g, 0, 1.7, 0, .05, {halo:.55});
      lampLight(g, 0, 1.66, 0, {intensity:2, distance:5.5, priority:3});
      break;
    }
    case 'dryingrack': {
      const frame = mat(c, {metalness:.4, roughness:.42}), h = 1.4;
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
        g.add(rod([sx * (w / 2 - .05), 0, sz * (d / 2 - .05)], [sx * (w / 2 - .05), h, sz * (d / 2 - .05)], .014, frame, .018));
        g.add(cyl(.03, .03, .02, frame, sx * (w / 2 - .05), 0, sz * (d / 2 - .05), 12));
      });
      [0.32, 0.62, 0.92, 1.2].forEach(y => {
        g.add(box(w - .1, .018, .018, frame, 0, y, -(d / 2 - .05)));
        g.add(box(w - .1, .018, .018, frame, 0, y, d / 2 - .05));
        g.add(box(.018, .018, d - .1, frame, -(w / 2 - .05), y, 0));
        g.add(box(.018, .018, d - .1, frame, w / 2 - .05, y, 0));
        // cross bars for hanging
        for (let i = 0; i < 3; i++) g.add(box(w - .16, .01, .01, frame, 0, y, -d * .25 + i * (d * .25)));
      });
      // hanging laundry with folds
      [[-w * .22, '#e8eef3', .42], [w * .05, '#f5e6d8', .5], [w * .28, '#dce8f0', .36]].forEach(([x, col, hh], i) => {
        g.add(rbox(.26, hh, .02, fabric(col), x, .95 - hh, (i - 1) * .03, .01));
        g.add(box(.22, .008, .015, fabric(darker(col, .9)), x, .95 - hh * .35, (i - 1) * .03 + .01));
      });
      break;
    }
    case 'tree': {
      const r = Math.min(w, d) / 2;
      const barkM = mat('#5a4838', {roughness:.85}), leafM = [mat(c, {roughness:.7, side:THREE.DoubleSide}), mat(lighter(c, .12), {roughness:.7, side:THREE.DoubleSide}), mat(darker(c, .75), {roughness:.72, side:THREE.DoubleSide})];
      const trunkH = 1.2 + r * 1.1, canopyR = r * .85;
      g.add(cyl(r * .12, r * .18, .08, barkM, 0, 0, 0, 16));
      g.add(rod([0, .06, 0], [(R() - .5) * .05, trunkH, (R() - .5) * .04], r * .1, barkM, r * .06, 10));
      for (let b = 0; b < 5; b++){
        const a = b * 1.35 + .4, by = trunkH * (.45 + b * .08), bl = canopyR * (.4 + R() * .35);
        g.add(rod([0, by, 0], [Math.cos(a) * bl, by + .15 + R() * .2, Math.sin(a) * bl], .025, barkM, .012, 8));
      }
      for (let k = 0; k < 28; k++){
        const a = k * 2.4 + R(), rr = canopyR * (.15 + R() * .85), yy = trunkH * .55 + R() * canopyR * 1.1;
        g.add(blob(.12 + R() * .1, .1 + R() * .08, .12 + R() * .1, leafM[k % 3], Math.cos(a) * rr, yy, Math.sin(a) * rr, 12));
      }
      break;
    }
    case 'swing': {
      // 户外秋千：四柱门形架 + 中央悬挂横梁 + 四根吊绳 + 座板靠垫
      const wm = woodM(c), rope = mat('#8a7a62', {roughness:.8}), fab = fabric(lighter(c, .15)), h = 2.2;
      const px = w / 2 - .1, pz = d / 2 - .1;
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
        g.add(box(.08, h, .08, wm, sx * px, 0, sz * pz));
        g.add(box(.1, .05, .1, woodM(darker(c, .8)), sx * px, 0, sz * pz));
      });
      // 顶部口字框
      [-1, 1].forEach(sz => g.add(box(w - .12, .07, .07, wm, 0, h - .05, sz * pz)));
      [-1, 1].forEach(sx => g.add(box(.07, .07, d - .12, wm, sx * px, h - .05, 0)));
      // 中央悬挂横梁：吊绳的真实挂点，避免绳子悬在空中
      g.add(box(w - .24, .085, .09, woodM(darker(c, .84)), 0, h - .13, 0));
      // A 字斜撑只在外侧立柱间收分，不侵入座板空间
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
        g.add(rod([sx * px, .3, sz * pz], [sx * px, h - .3, sz * pz * .22], .02, wm, .016, 8)));
      const seatY = .55, seatW = Math.min(w * .55, 1.1);
      [-1, 1].forEach(sx => {
        [-1, 1].forEach(sz => g.add(rod(
          [sx * seatW / 2, h - .13, sz * .055],
          [sx * seatW / 2, seatY + .04, sz * .16], .01, rope, .01, 8)));
      });
      g.add(rbox(seatW, .05, .4, wm, 0, seatY, 0, .015));
      g.add(rbox(seatW - .04, .04, .08, fab, 0, seatY + .04, -.12, .01));
      g.add(rbox(seatW - .08, .26, .06, fab, 0, seatY + .2, -.2, .03));
      [-1, 1].forEach(sx => { for (let k = 0; k < 4; k++) g.add(ring(.018, .004, mat('#c8a86e', {metalness:.8, roughness:.25}), sx * seatW / 2, .72 + k * .28, 0)); });
      break;
    }
    case 'gpath': {
      const stone = mat(c, {roughness:.7}), dark = mat(darker(c, .85), {roughness:.75});
      const wood = /木|栈道|wood/i.test(f.name || '');
      if (wood){
        const wm = woodM(c), n = Math.max(4, Math.round(d / .25));
        g.add(box(w, .04, d, woodM(darker(c, .7)), 0, 0, 0));
        // 栈道缝隙苔藓
        for(let k=0;k<10;k++){ const x=(R()-.5)*w*.9, z=(R()-.5)*d*.9; g.add(blob(.035,.008,.03,mat('#6a8a5c',{roughness:.9}),x,.055,z,8)); }
        for (let i = 0; i < n; i++){
          const z = -d / 2 + .12 + i * ((d - .24) / Math.max(1, n - 1));
          g.add(rbox(w - .06, .03, .18, wm, 0, .04, z, .008));
        }
        [-1, 1].forEach(sx => g.add(box(.04, .08, d, woodM(darker(c, .75)), sx * (w / 2 - .02), 0, 0)));
      } else {
        const n = Math.max(5, Math.round(Math.max(w, d) / .35));
        for (let i = 0; i < n; i++){
          const t = i / Math.max(1, n - 1), px = (t - .5) * (w - .35), pz = (t - .5) * (d - .35) * (w > d ? .15 : 1);
          const rw = .22 + R() * .12, rd = .18 + R() * .1;
          g.add(cyl(rw, rw * .95, .04 + R() * .02, i % 2 ? stone : dark, px + (R() - .5) * .08, 0, pz + (R() - .5) * .08, 10));
        }
      }
      break;
    }
    case 'outdoorsofa': {
      // 户外藤编沙发：编织框架 + 贴合的分格坐垫 + 立体抱枕 + 圆扶手
      const rattan = mat(c, {roughness:.72}), rp = mat(lighter(c, .14), {roughness:.7}), wm = woodM(darker(c, .78));
      const fab = fabric('#f3ece0'), fab2 = fabric('#e8d9c3'), seatY = .33;
      g.add(rbox(w, .28, d, rattan, 0, .05, 0, .04));   // 底座顶面 = .33
      // 正面藤编竖条（朝向观察者）
      for (let i = 0; i < 18; i++){ const x = -w/2 + .07 + i*((w-.14)/17); g.add(rod([x, .08, d/2-.04], [x, .32, d/2-.04], .005, rp, .005, 6)); }
      for (let j = 0; j < 6; j++) g.add(box(w - .12, .006, .006, rp, 0, .1 + j*.04, d/2-.03));
      // 靠背与横向编织
      g.add(rbox(w, .58, .12, rattan, 0, .33, -d/2 + .06, .05));
      for (let i = 0; i < 16; i++){ const x = -w/2 + .08 + i*((w-.16)/15); g.add(rod([x, .38, -d/2 + .004], [x, .88, -d/2 + .004], .005, rp, .005, 6)); }
      for (let j = 0; j < 8; j++) g.add(box(w - .14, .005, .005, rp, 0, .38 + j*.06, -d/2 + .002));
      [-1, 1].forEach(sx => {
        g.add(rbox(.14, .16, d*.94, rattan, sx*(w/2-.07), .33, 0, .06));
        g.add(cyl(.07, .07, .16, rp, sx*(w/2-.07), .33, 0, 20));
      });
      const n = 3;
      for (let i = 0; i < n; i++){
        const x = -w/2 + .1 + (w-.2)*(i+.5)/n;
        g.add(rbox((w-.2)/n - .02, .1, d*.68, i%2 ? fab : fab2, x, seatY, 0, .03));
        g.add(box((w-.2)/n - .06, .006, .008, wm, x, seatY + .105, 0));
      }
      // 立体抱枕：方形软包斜靠在靠背上
      [-1, 1].forEach((sx, i) => {
        const p = rbox(.3, .3, .12, i ? fab2 : fab, sx*w*.27, seatY + .16, -d/2 + .25, .06);
        p.rotation.set(-.18, 0, sx*.2); g.add(p);
        g.add(blob(.022, .022, .022, i ? fab : fab2, sx*w*.27 - .12, seatY + .3, -d/2 + .32, 10));
      });
      legs(g, w, d, .05, wm, .06, .018);
      break;
    }
    case 'outdoorchair': {
      // 户外藤编单椅：圆形编织座 + 半环包裹靠背 + 软坐垫 + 收分木腿
      const rattan = mat(c, {roughness:.72}), rp = mat(lighter(c, .14), {roughness:.7}), wm = woodM(darker(c, .8));
      const r = Math.min(w, d)/2, seatY = .42;
      g.add(cyl(r*.9, r*.88, .06, rattan, 0, seatY-.06, 0, 36));
      for (let k = 0; k < 16; k++){ const a = k*Math.PI/8; g.add(rod([0, seatY, 0], [Math.cos(a)*r*.86, seatY, Math.sin(a)*r*.86], .005, rp, .005, 6)); }
      for (let k = 1; k < 4; k++) g.add(ring(r*.86*k/4, .005, rp, 0, seatY, 0));
      g.add(cyl(r*.72, r*.72, .05, fabric('#f3ece0'), 0, seatY, 0, 32));
      // 半环靠背：竖编条沿后半圆分布，上下弧形圈收边
      const bR = r*.82, bH = .52, a0 = Math.PI*.12, a1 = Math.PI*.88;
      const back = new THREE.Group();
      for (let k = 0; k <= 12; k++){
        const a = a0 + (a1-a0)*k/12, px = Math.cos(a)*bR, pz = -Math.sin(a)*bR;
        back.add(rod([px, 0, pz], [px, bH, pz], .011, rattan, .009, 8));
      }
      for (const hy of [.04, bH*.5, bH-.03]){
        const arc = [];
        for (let k = 0; k <= 14; k++){ const a = a0 + (a1-a0)*k/14; arc.push([Math.cos(a)*bR, hy, -Math.sin(a)*bR]); }
        back.add(tube(arc, .016, rp, 24));
      }
      back.position.set(0, seatY, 0); g.add(back);
      // 靠背软垫贴合弧面
      for (let k = 0; k < 5; k++){
        const a = a0 + (a1-a0)*(k+.5)/5, px = Math.cos(a)*bR*.93, pz = -Math.sin(a)*bR*.93;
        const q = rbox(.16, .34, .05, fabric(k%2 ? '#e8d9c3' : '#f3ece0'), px, seatY + .12, pz, .025);
        q.rotation.y = a - Math.PI/2; g.add(q);
      }
      legs(g, w*.78, d*.78, seatY-.06, wm, .08, .018);
      break;
    }
    case 'hangingchair': {
      // 吊篮椅：落地 C 形支架 + 正面大开口的镂空编织篮 + 吊绳 + 坐垫靠枕
      const rattan = mat(c, {roughness:.72}), rp = mat(lighter(c, .16), {roughness:.7}), iron = blackMetal();
      const r = Math.min(w, d)/2, cx = r*.42;
      g.add(cyl(r*.6, r*.66, .05, iron, 0, 0, 0, 32));
      g.add(rod([0, .05, 0], [0, 2.16, 0], .024, iron, .03));
      g.add(tube([[0, 2.16, 0], [-r*.22, 2.24, 0], [r*.1, 2.14, 0], [cx, 1.92, 0]], .024, iron, 32));
      g.add(cyl(.045, .045, .04, iron, cx, 1.9, 0, 16));
      g.add(rod([cx, 1.9, 0], [cx, 1.64, 0], .008, iron, .008, 8));
      // 篮体：下部整圈编织兜 + 上部只在后半圈做靠背，正面完全敞开
      const open = Math.PI*.86, start = Math.PI/2 + open/2, span = Math.PI*2 - open;
      const botR = r*.6, midR = r*.7, topR = r*.62, yBot = .62, yMid = 1.02, yTop = 1.56;
      // 下部兜：整圈竖条与两道完整环
      for (let k = 0; k < 20; k++){
        const a = k*Math.PI/10;
        g.add(tube([
          [cx + Math.cos(a)*botR, yBot, Math.sin(a)*botR],
          [cx + Math.cos(a)*midR*1.06, (yBot+yMid)/2, Math.sin(a)*midR*1.06],
          [cx + Math.cos(a)*midR, yMid, Math.sin(a)*midR]
        ], .012, rattan, 14));
      }
      for (const [rr, yy] of [[botR, yBot], [midR, yMid]]){
        const arc = [];
        for (let k = 0; k <= 30; k++){ const a = k*Math.PI/15; arc.push([cx + Math.cos(a)*rr, yy, Math.sin(a)*rr]); }
        g.add(tube(arc, .014, rp, 32));
      }
      // 上部靠背：只保留后半圈，形成 U 形开口
      for (let k = 0; k <= 14; k++){
        const a = start + span*k/14;
        g.add(tube([
          [cx + Math.cos(a)*midR, yMid, Math.sin(a)*midR],
          [cx + Math.cos(a)*topR*1.05, (yMid+yTop)/2, Math.sin(a)*topR*1.05],
          [cx + Math.cos(a)*topR, yTop, Math.sin(a)*topR]
        ], .012, rattan, 14));
      }
      for (const [rr, yy] of [[topR, yTop], [(midR+topR)/2, (yMid+yTop)/2]]){
        const arc = [];
        for (let k = 0; k <= 24; k++){ const a = start + span*k/24; arc.push([cx + Math.cos(a)*rr, yy, Math.sin(a)*rr]); }
        g.add(tube(arc, .014, rp, 28));
      }
      // 开口两侧包边，强调椅子轮廓
      [start, start+span].forEach(a => {
        g.add(rod([cx + Math.cos(a)*botR, yBot, Math.sin(a)*botR],
                  [cx + Math.cos(a)*topR, yTop, Math.sin(a)*topR], .018, rp, .016, 8));
      });
      // 分吊绳连到篮口
      for (let k = 0; k < 5; k++){
        const a = start + span*k/4, tx = cx + Math.cos(a)*topR, tz = Math.sin(a)*topR;
        g.add(rod([cx, 1.9, 0], [tx, yTop, tz], .005, rp, .004, 6));
      }
      // 底盘与坐垫、靠枕：坐垫略向前，从开口露出
      g.add(cyl(botR*.96, botR*.9, .05, rattan, cx, yBot-.03, 0, 28));
      g.add(rbox(r*1.02, .16, r*.82, fabric('#f3ece0'), cx, yBot + .02, r*.08, .05));
      g.add(blob(.22, .26, .1, fabric('#e8d9c3'), cx, yBot + .3, -r*.34, 14));
      break;
    }
    case 'hammock': {
      // 吊床：两端门形支架 + 端头横杆 + 放射吊绳 + 下垂弧形床面 + 条纹与流苏
      const wm = woodM(c), rope = mat('#8a7a62', {roughness:.85}), cloth = mat(c, {roughness:.92, side:THREE.DoubleSide});
      const H = 1.5, half = w/2 - .12, endX = w*.36, halfD = d*.3;
      [-1, 1].forEach(sx => {
        const x = sx*half;
        [-1, 1].forEach(sz => {
          g.add(rod([x, 0, sz*d*.28], [x, H, sz*d*.28], .034, wm, .04, 10));
          g.add(cyl(.055, .06, .04, wm, x, 0, sz*d*.28, 12));
        });
        g.add(box(.09, .06, d*.6, wm, x, H-.04, 0));
        // 斜撑收向床面端头
        [-1, 1].forEach(sz => g.add(rod([x, .25, sz*d*.28], [sx*(endX-.04), H-.12, 0], .018, wm, .014, 8)));
        // 端头横杆：床面与吊绳都挂在这里
        g.add(rod([sx*endX, H*.72, -halfD], [sx*endX, H*.72, halfD], .018, wm, .018, 10));
        for (let k = 0; k < 7; k++){
          const z = (k-3)*d*.085;
          g.add(rod([x, H-.05, z*.35], [sx*endX, H*.72, z], .004, rope, .004, 6));
        }
      });
      const pos = [], idx = [], nu = 16, nv = 10;
      for (let i = 0; i <= nu; i++){
        const t = i/nu, px = -endX + t*endX*2, sag = .26*Math.sin(Math.PI*t);
        for (let j = 0; j <= nv; j++){
          const u = j/nv, pz = (u-.5)*d*.6;
          pos.push(px, H*.72 - sag, pz);
        }
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++){
        const a = i*(nv+1)+j, b = a+nv+1;
        idx.push(a, b, a+1, a+1, b, b+1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      g.add(mesh(geo, cloth));
      // 横向织纹随床面下垂
      for (let i = 1; i < 14; i++){
        const t = i/14, px = -endX + t*endX*2, sag = .26*Math.sin(Math.PI*t);
        g.add(box(.012, .006, d*.6, mat(darker(c, .82), {side:THREE.DoubleSide}), px, H*.72 - sag + .006, 0));
      }
      // 两侧流苏从床面边缘垂下
      for (let i = 0; i < 16; i++){
        const t = i/15, px = -endX + t*endX*2, sag = .26*Math.sin(Math.PI*t);
        [-1, 1].forEach(s => g.add(rod([px, H*.72 - sag, s*d*.3], [px, H*.72 - sag - .12, s*d*.315], .004, rope, .003, 6)));
      }
      break;
    }
    case 'shadesail': {
      // 三角遮阳帆：三杆与布角对齐 + 弧边内凹布面 + 边索与角环
      const cloth = mat(c, {roughness:.9, side:THREE.DoubleSide}), pole = blackMetal(), rope = mat('#8a7a62', {roughness:.8});
      const H = 2.5;
      const P = [[-w*.42, H, -d*.38], [w*.42, H*.92, -d*.34], [0, H*.78, d*.42]];
      const G = [P.reduce((s,p)=>s+p[0],0)/3, P.reduce((s,p)=>s+p[1],0)/3, P.reduce((s,p)=>s+p[2],0)/3];
      P.forEach(([x, y, z]) => {
        g.add(cyl(.032, .042, y, pole, x, 0, z, 14));
        g.add(cyl(.085, .095, .05, blackMetal(), x, 0, z, 18));
        g.add(ring(.03, .008, pole, x, y, z));
      });
      // 重心下垂 + 三条弧边内凹，形成张拉帆布
      const bary = (w0, w1, w2) => {
        const raw = [P[0][0]*w0 + P[1][0]*w1 + P[2][0]*w2,
                     P[0][1]*w0 + P[1][1]*w1 + P[2][1]*w2,
                     P[0][2]*w0 + P[1][2]*w1 + P[2][2]*w2];
        const sag = .3 * (27 * w0 * w1 * w2);
        const edge = .1 * Math.max(0, 1 - 3*Math.min(w0, w1, w2));
        return [raw[0] + (G[0]-raw[0])*edge, raw[1] - sag, raw[2] + (G[2]-raw[2])*edge];
      };
      const pos = [], idx = [], n = 14, grid = [];
      for (let i = 0; i <= n; i++){
        grid[i] = [];
        for (let j = 0; j <= n-i; j++){
          const a = i/n, b = j/n, cc = 1-a-b;
          pos.push(...bary(cc, a, b));
          grid[i][j] = pos.length/3 - 1;
        }
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < n-i; j++){
        const a = grid[i][j], b = grid[i+1][j], c2 = grid[i][j+1];
        idx.push(a, b, c2);
        if (j < n-i-1) idx.push(b, grid[i+1][j+1], c2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx); geo.computeVertexNormals();
      g.add(mesh(geo, cloth));
      // 三条弧边张拉索
      const e0 = [], e1 = [], e2 = [];
      for (let k = 0; k <= 14; k++){
        const t = k/14;
        e0.push(bary(1-t, t, 0)); e1.push(bary(0, 1-t, t)); e2.push(bary(t, 0, 1-t));
      }
      [e0, e1, e2].forEach(pts => g.add(tube(pts, .007, rope, 30)));
      break;
    }
    case 'gazebo': {
      // 六角凉亭：六柱 + 六坡攒尖顶 + 五面栏杆（留一面入口）+ 六角薄地坪
      const wm = woodM(c), dark = woodM(darker(c, .76)), light = woodM(lighter(c, .14));
      const R = Math.min(w, d)/2*.9, h = 2.3, N = 6;
      const ca = k => k*Math.PI/3, P = k => [Math.cos(ca(k))*R*.86, Math.sin(ca(k))*R*.86];
      for (let k = 0; k < N; k++){
        const [x, z] = P(k);
        g.add(cyl(.09, .1, .12, dark, x, 0, z, 16));
        g.add(rbox(.11, h, .11, wm, x, .1, z, .02));
        g.add(box(.14, .05, .14, light, x, h + .08, z));
      }
      for (let k = 0; k < N; k++){
        const [x1, z1] = P(k), [x2, z2] = P((k+1)%N);
        g.add(rod([x1, h + .1, z1], [x2, h + .1, z2], .032, dark, .032, 8));
      }
      // 六坡攒尖屋面：檐口六边形向宝顶收拢
      const eaveY = h + .16, tipY = h + .95, eaveR = R*1.04, topR = R*.16;
      for (let k = 0; k < N; k++){
        const a1 = ca(k), a2 = ca(k+1);
        const E1 = [Math.cos(a1)*eaveR, eaveY, Math.sin(a1)*eaveR];
        const E2 = [Math.cos(a2)*eaveR, eaveY, Math.sin(a2)*eaveR];
        const T1 = [Math.cos(a1)*topR, tipY, Math.sin(a1)*topR];
        const T2 = [Math.cos(a2)*topR, tipY, Math.sin(a2)*topR];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([...E1, ...E2, ...T2, ...T1], 3));
        geo.setIndex([0,1,2, 0,2,3]); geo.computeVertexNormals();
        g.add(mesh(geo, mat(k%2 ? lighter(c, .22) : darker(c, .86), {roughness:.82, side:THREE.DoubleSide})));
        g.add(rod(E1, [0, tipY, 0], .018, wm, .012, 8));   // 檐角到宝顶的屋脊
        g.add(rod(E1, E2, .026, dark, .026, 8));            // 檐口封边
      }
      g.add(cyl(topR*1.2, topR*1.4, .08, dark, 0, tipY-.04, 0, 12));
      g.add(blob(.055, .09, .055, metal(), 0, tipY + .09, 0, 12));
      // 栏杆留一面作为入口，竖杆稀疏以保持通透
      for (let k = 1; k < N; k++){
        const [x1, z1] = P(k), [x2, z2] = P((k+1)%N);
        g.add(rod([x1, .72, z1], [x2, .72, z2], .016, wm, .016, 8));
        g.add(rod([x1, .38, z1], [x2, .38, z2], .011, wm, .011, 8));
        for (let j = 1; j <= 2; j++){
          const t = j/3, px = x1 + (x2-x1)*t, pz = z1 + (z2-z1)*t;
          g.add(rod([px, .12, pz], [px, .72, pz], .01, wm, .01, 6));
        }
      }
      const floor = mesh(new THREE.CylinderGeometry(R*.68, R*.68, .03, 6), mat(lighter(c, .24), {roughness:.9}));
      floor.position.y = .015; g.add(floor);
      break;
    }
    case 'gardenarch': {
      // 花架拱门：前后两片立柱 + 双层拱管 + 落地竖格栅 + 横向连杆 + 攀藤花
      const wm = woodM(c), dark = woodM(darker(c, .78)), rp = mat(lighter(c, .12), {roughness:.7});
      const h = 2.0, halfW = w/2 - .1, zz = [-d*.32, d*.32];
      const archY = t => h + Math.sin(Math.PI*t)*w*.28;
      zz.forEach(z => {
        [-1, 1].forEach(sx => {
          const x = sx*halfW;
          g.add(box(.18, .08, d*.16, dark, x, 0, z));
          g.add(rbox(.12, h, .12, wm, x, .08, z, .02));
          g.add(box(.16, .05, .16, dark, x, h + .06, z));
        });
        const outer = [], inner = [];
        for (let i = 0; i <= 18; i++){
          const t = i/18, x = -halfW + t*halfW*2;
          outer.push([x, archY(t) + .06, z]); inner.push([x, archY(t) - .1, z]);
        }
        g.add(tube(outer, .028, rp, 36)); g.add(tube(inner, .018, dark, 36));
        // 竖格栅从地面一直连到内拱，不再悬空
        for (let i = 1; i < 11; i++){
          const t = i/11, x = -halfW + t*halfW*2, yTop = archY(t) - .1;
          g.add(rod([x, .1, z], [x, yTop, z], .009, wm, .009, 6));
        }
        g.add(rod([-halfW, .55, z], [halfW, .55, z], .012, dark, .012, 8));
      });
      // 前后两片之间的连杆，让拱门有真实进深
      for (const t of [0, .25, .5, .75, 1]){
        const x = -halfW + t*halfW*2, y = Math.min(archY(t) + .02, h + .5);
        g.add(rod([x, y, zz[0]], [x, y, zz[1]], .012, wm, .012, 8));
      }
      const leaf = ['#5f8f4e', '#7eab62', '#4e7a40'].map(q => mat(q, {roughness:.7, side:THREE.DoubleSide}));
      for (let k = 0; k < 18; k++){
        const t = (k+.5)/18, x = -halfW*.9 + t*halfW*1.8;
        const y = .5 + R()*1.35, z = zz[k%2] + (R()-.5)*d*.2;
        g.add(blob(.05 + R()*.03, .014, .06 + R()*.03, leaf[k%3], x, y, z, 10));
        if (k%3 === 0) g.add(blob(.024, .02, .024, mat(['#f3e6d8', '#e8a090', '#f6d27a'][k%3]), x+.04, y+.03, z, 10));
      }
      break;
    }
    case 'firepit': {
      // 户外火盆：连续石砌围边 + 抬高石盆 + 炭床木柴 + 多簇小火苗，夜景投射暖光
      const stone = mat(c, {roughness:.82}), stone2 = mat(darker(c, .86), {roughness:.85});
      const r = Math.min(w, d)/2, ember = glowMat('#ffb04a', '#ff5a10', .9);
      const n = 12;
      for (let k = 0; k < n; k++){
        const a = (k+.5)*Math.PI*2/n, rr = r*.82;
        const b = rbox(r*.44, .22, r*.3, k%2 ? stone : stone2, Math.cos(a)*rr, .02, Math.sin(a)*rr, .035);
        b.rotation.y = -a; g.add(b);
      }
      // 石盆：外壁折返到内壁，形成有厚度的盆体
      g.add(lathe([[0, 0], [r*.62, 0], [r*.66, .06], [r*.64, .2], [r*.6, .22],
                   [r*.56, .2], [r*.54, .06], [0, .055]], stone2, 0, 0, 0, 32));
      g.add(cyl(r*.52, r*.52, .03, mat('#2a2018', {roughness:.95}), 0, .06, 0, 28));
      for (let k = 0; k < 9; k++){
        const a = k*1.4, rr = r*.34*R();
        g.add(blob(.045, .022, .04, ember, Math.cos(a)*rr, .1, Math.sin(a)*rr, 8));
      }
      for (let k = 0; k < 3; k++){
        const a = k*2.1;
        g.add(rod([-Math.cos(a)*r*.34, .12, -Math.sin(a)*r*.28],
                  [Math.cos(a)*r*.34, .12, Math.sin(a)*r*.28], .026, mat('#6b4a30', {roughness:.9}), .022, 8));
      }
      for (let k = 0; k < 7; k++){
        const a = k*.93, rr = r*(.06 + R()*.24), hh = .12 + R()*.12;
        const fl = mesh(new THREE.ConeGeometry(.028 + R()*.018, hh, 7),
                        glowMat(k%2 ? '#ffd06a' : '#ff8a34', '#ff4a08', 1));
        fl.position.set(Math.cos(a)*rr, .09 + hh/2, Math.sin(a)*rr);
        g.add(fl);
      }
      glowBulb(g, 0, .11, 0, .028, {halo:.55});   // 发光核藏进炭火，不做成悬空白球
      lampLight(g, 0, .22, 0, {color:0xff8a3a, intensity:2.2, distance:5, priority:3});
      break;
    }
    case 'barcounter': {
      // 户外吧台：石纹台面 + 木条立面 + 正确高度的脚踏杆 + 杯具与高脚凳
      const wm = woodM(c), dark = woodM(darker(c, .76)), stone = mat(lighter(c, .3), {roughness:.42});
      const top = .95;
      g.add(rbox(w, top - .06, d*.8, wm, 0, .02, 0, .02));
      for (let i = 1; i < 5; i++) g.add(box(.014, top - .1, .014, dark, -w/2 + i*(w/5), .06, d*.4 + .008));
      g.add(rbox(w + .06, .06, d*.86, stone, 0, top - .04, 0, .015));
      g.add(box(w*.9, .006, .006, mat('#ffffff', {roughness:.2}), 0, top + .02, -d*.3));
      // 脚踏杆用两点圆杆，避免旋转圆柱时把高度抬到台面
      g.add(rod([-w*.4, .24, d*.48], [w*.4, .24, d*.48], .018,
                mat('#c8a86e', {metalness:.8, roughness:.25}), .018, 12));
      [-w*.28, 0, w*.28].forEach(x => {
        g.add(cyl(.034, .03, .1, mat('#dfeef3', {transparent:true, opacity:.42, roughness:.05}), x, top + .02, 0, 16));
        g.add(cyl(.02, .02, .01, ceramic(), x, top + .02, 0, 14));
      });
      [-w*.26, w*.26].forEach(x => {
        const z = d*.78;
        g.add(cyl(.028, .034, .62, blackMetal(), x, 0, z, 14));
        g.add(cyl(.16, .16, .05, woodM(lighter(c, .12)), x, .62, z, 24));
        g.add(ring(.14, .007, blackMetal(), x, .2, z));
      });
      break;
    }
    case 'flowerpot': {
      // 陶罐花器：曲面罐身 + 环纹 + 釉面 + 花草
      const pot=mat(c,{roughness:.68}), rim=woodM(darker(c,.8)), soil=mat('#3d2f22',{roughness:.95});
      const r=Math.min(w,d)/2, h=.62;
      g.add(lathe([[0,0],[r*.52,0],[r*.6,.03],[r*.78,h*.3],[r*.72,h*.72],[r*.84,h],[r*.8,h+.03]],pot,0,0,0,40));
      for(let i=1;i<4;i++) g.add(ring(r*(.62+i*.05),.007,rim,0,h*(.2+i*.16),0));
      g.add(cyl(r*.76,r*.76,.02,soil,0,h-.01,0,32));
      const leaf=['#5f8f4e','#7eab62','#4e7a40'].map(q=>mat(q,{roughness:.65,side:THREE.DoubleSide}));
      for(let k=0;k<12;k++){
        const a=k*2.4+R()*.3,rr=r*(.15+R()*.4),px=Math.cos(a)*rr,pz=Math.sin(a)*rr,hh=.25+R()*.4;
        g.add(rod([px,h,pz],[px+(R()-.5)*.05,h+hh,pz+(R()-.5)*.05],.006,'#5a4a30',.004,6));
        for(let L=0;L<4;L++){
          const lf=blob(.05+R()*.02,.005,.03,leaf[L%3],px+Math.cos(a+L*1.4)*.03,h+hh*(.4+L*.12),pz+Math.sin(a+L*1.4)*.03,10);
          lf.rotation.z=-.35; g.add(lf);
        }
        if(k%2===0){
          const col=mat(['#f3e6d8','#e8a090','#f6d27a'][k%3],{roughness:.8});
          g.add(blob(.024,.02,.024,col,px,h+hh+.02,pz,10));
          for(let p=0;p<5;p++){ const pa=p*1.26; g.add(blob(.012,.006,.016,col,px+Math.cos(pa)*.028,h+hh+.025,pz+Math.sin(pa)*.028,8)); }
        }
      }
      break;
    }
    case 'rockery': {
      // 景石假山：多面棱角石块 + 青苔 + 从地面长出的小草
      const stone = [mat(c, {roughness:.9}), mat(lighter(c, .14), {roughness:.88}), mat(darker(c, .82), {roughness:.9})];
      const moss = mat('#6a8a5c', {roughness:.9}), grass = mat('#5f8f4e', {roughness:.7, side:THREE.DoubleSide});
      const geo = new THREE.IcosahedronGeometry(1, 0);
      [[0, 0, .42, .5, 0], [-.42, .1, .3, .3, 1], [.4, .08, .32, .34, 2], [.05, .3, .5, .22, 0]].forEach(([x, z, rx, ry, ci], i) => {
        const b = mesh(geo.clone(), stone[ci%3]);
        b.scale.set(rx, ry, rx*.82); b.position.set(x, ry + .04, z);
        b.rotation.set(i*.5, i*.7, i*.3); g.add(b);
        g.add(blob(rx*.38, .02, rx*.3, moss, x + rx*.3, ry*1.55, z, 8));
      });
      for (let k = 0; k < 14; k++){
        const a = k*2.1, rr = .25 + R()*.45, x = Math.cos(a)*rr, z = Math.sin(a)*rr, hh = .1 + R()*.1;
        g.add(rod([x, 0, z], [x, hh, z], .004, mat('#4e7a40', {roughness:.8}), .002, 6));
        g.add(blob(.03, .012, .045, grass, x, hh, z, 8));
      }
      break;
    }
    case 'birdbath': {
      // 鸟浴盆：石柱 + 有内壁的凹形石钵 + 水面波纹 + 立于盆沿的小鸟
      const stone = mat(c, {roughness:.62}), rim = mat(lighter(c, .16), {roughness:.55});
      const water = mat('#7fc0d0', {roughness:.06, metalness:.2, transparent:true, opacity:.72});
      const r = Math.min(w, d)/2;
      g.add(cyl(r*.45, r*.5, .08, stone, 0, 0, 0, 28));
      g.add(lathe([[r*.16, 0], [r*.2, .03], [r*.13, .1], [r*.16, .6], [r*.22, .66]], stone, 0, .08, 0, 32));
      // 碗形钵：外壁上升到沿口后折返成内壁
      g.add(lathe([[0, 0], [r*.18, 0], [r*.3, .02], [r*.5, .05], [r*.72, .1], [r*.8, .16],
                   [r*.78, .18], [r*.7, .145], [r*.52, .09], [r*.24, .06], [0, .055]],
                  stone, 0, .74, 0, 36));
      g.add(ring(r*.76, .018, rim, 0, .92, 0));
      g.add(cyl(r*.62, r*.62, .015, water, 0, .86, 0, 32));
      for (let k = 0; k < 3; k++) g.add(ring(r*(.18 + k*.16), .005, mat('#dff2f8', {transparent:true, opacity:.5}), 0, .875, 0));
      const bird = mat('#8a9aa5', {roughness:.8});
      g.add(blob(.06, .045, .04, bird, -r*.62, .95, r*.1, 12));
      g.add(blob(.03, .028, .025, bird, -r*.68, 1.0, r*.1, 10));
      g.add(blob(.02, .008, .035, bird, -r*.56, .95, r*.1, 8));
      break;
    }
    case 'waterwall': {
      // 叠水景墙：石砖墙 + 顶部溢流槽 + 从槽口连续落到池面的水帘 + 底部水池
      const stone = mat(c, {roughness:.75}), alt = mat(lighter(c, .14), {roughness:.72});
      const water = mat('#a8d8e6', {roughness:.06, transparent:true, opacity:.5, side:THREE.DoubleSide, depthWrite:false});
      const h = 1.8, tw = .12, spoutY = h*.72, poolY = .05;
      g.add(rbox(w, h, tw, stone, 0, 0, 0, .01));
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++)
        g.add(rbox(w/5 - .02, h/3 - .02, .014, i%2 ? stone : alt,
                   -w/2 + (i+.5)*(w/5), .01 + j*(h/3), tw/2 + .008, .006));
      // 溢流槽
      g.add(box(w*.86, .045, .07, mat('#4a4540', {metalness:.4, roughness:.5}), 0, spoutY, tw/2 + .035));
      // 水帘：一层薄底幕 + 四股更清晰的落水，上沿接槽口、下沿落入池面
      g.add(box(w*.84, spoutY - poolY - .02, .006, water, 0, poolY + .02, tw/2 + .052));
      for (let i = 0; i < 4; i++){
        const x = -w/2 + (i+.5)*(w/4);
        g.add(box(w/4*.78, spoutY - poolY - .02, .01,
                  mat('#bfe4ef', {roughness:.05, transparent:true, opacity:.6, side:THREE.DoubleSide, depthWrite:false}),
                  x, poolY + .02, tw/2 + .062));
      }
      for (let k = 0; k < 11; k++){
        const x = -w*.4 + k*(w*.8/10);
        g.add(rod([x, spoutY, tw/2 + .062], [x, poolY + .02, tw/2 + .062], .004,
                  mat('#eaf8fc', {transparent:true, opacity:.5}), .003, 6));
      }
      g.add(shell(w*.96, d*.62, .12, .05, .06, stone, 0, 0, d*.32));
      g.add(box(w*.9, .02, d*.52, mat('#5a97a8', {roughness:.05, metalness:.2}), 0, .04, d*.32));
      for (let k = 0; k < 9; k++){
        const x = -w*.4 + k*(w*.8/8);
        g.add(blob(.035, .008, .02, mat('#dff2f8', {transparent:true, opacity:.55}),
                   x, .075, d*.32 + d*.2, 8));
      }
      break;
    }
    case 'trellis': {
      // 攀爬花格：木框 + 真正的菱形交叉网格 + 落地支脚 + 藤叶与花
      const wm = woodM(c), dark = woodM(darker(c, .76));
      const h = 2.1, tw = Math.min(.1, w*.08);
      const W = w - 2*tw, H = h - .24, x0 = -W/2, y0 = .12;
      g.add(box(tw, h, tw*1.4, wm, -w/2 + tw/2, 0, 0));
      g.add(box(tw, h, tw*1.4, wm, w/2 - tw/2, 0, 0));
      g.add(box(w, .07, tw*1.2, wm, 0, h - .04, 0));
      g.add(box(w, .06, tw*1.2, wm, 0, .1, 0));
      // 两组 45° 平行斜杆相交成菱形网格，端点裁剪在框内
      const step = Math.max(.22, Math.min(W, V.H)/5);
      for (let xs = x0 - V.H; xs <= x0 + W + V.H; xs += step){
        const s0 = Math.max(0, x0 - xs), s1 = Math.min(V.H, x0 + W - xs);
        if (s1 > s0 + .02) g.add(rod([xs + s0, y0 + s0, 0], [xs + s1, y0 + s1, 0], .008, dark, .008, 6));
        const a0 = Math.max(0, xs - (x0 + W)), a1 = Math.min(V.H, xs - x0);
        if (a1 > a0 + .02) g.add(rod([xs - a0, y0 + a0, 0], [xs - a1, y0 + a1, 0], .008, dark, .008, 6));
      }
      // 落地支脚
      [-1, 1].forEach(sx => {
        g.add(box(tw*1.8, .06, d*.5, woodM(darker(c, .8)), sx*(w/2 - tw/2), 0, 0));
        g.add(rod([sx*(w/2 - tw/2), .06, d*.22], [sx*(w/2 - tw/2), .55, 0], .014, dark, .014, 8));
      });
      const leaf = ['#5f8f4e', '#7eab62', '#4e7a40'].map(q => mat(q, {roughness:.7, side:THREE.DoubleSide}));
      for (let k = 0; k < 18; k++){
        const x = (R()-.5)*(w*.88), y = .2 + R()*(h-.4), z = (R()-.5)*tw;
        g.add(blob(.05 + R()*.03, .014, .06 + R()*.03, leaf[k%3], x, y, z, 10));
        if (k%3 === 0) g.add(blob(.022, .018, .022, mat(['#f3e6d8', '#e8a090', '#f6d27a'][k%3]), x+.03, y+.02, z+.01, 10));
      }
      break;
    }
    case 'stairs': {
      /* 实木楼梯（参照实拍）：山棕闭踢面 · 踏步微出边 · 方立柱 + 扁方扶手 · 平顶大方柱 */
      const sg = new THREE.Group();
      const style = (typeof stairsStyleOf === 'function' ? stairsStyleOf(f) : (f.style || 'straight'));
      const up = (f.dir || 'up') !== 'down';
      const col = (c && c !== '#ddd') ? c : '#6b4a32';
      const wood = woodM(col), woodD = woodM(darker(col, .84)), woodL = woodM(lighter(col, .1));
      const treadM = woodL, riserM = wood, beamM = woodD, railM = woodD, newelM = wood;
      const H = Math.max(2.2, Math.min(4.0, V.H || 2.8));
      const rh = .9, bal = .02;
      const addSlopeBeam = (x, y0, z0, y1, z1, tw, th, m) => {
        const len = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y1 - y0, z1 - z0);
        const o = mesh(new THREE.BoxGeometry(tw, th, len), asMat(m));
        o.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
        o.rotation.x = -ang;
        sg.add(o);
      };
      const addSlopeBeamX = (z, y0, x0, y1, x1b, tw, th, m) => {
        const len = Math.hypot(x1b - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1b - x0);
        const o = mesh(new THREE.BoxGeometry(len, th, tw), asMat(m));
        o.position.set((x0 + x1b) / 2, (y0 + y1) / 2, z);
        o.rotation.z = ang;
        sg.add(o);
      };
      /** 大方柱 + 平顶帽 */
      const addNewel = (x, y0, z, h) => {
        const hh = Math.max(.2, h);
        sg.add(box(.085, hh, .085, newelM, x, y0, z));
        sg.add(box(.11, .03, .11, woodD, x, y0 + hh, z));
      };
      /** 方木立柱（栏杆）——实拍密度偏密，约每踏一步一根 */
      const addBaluster = (x, y0, z, h) => {
        sg.add(box(bal, Math.max(.08, h), bal, railM, x, y0, z));
      };
      /** 两踏之间补一根，贴近实拍密立柱 */
      const addMidBal = (ax, ay, az, bx, by, bz, h) => {
        addBaluster((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, h);
      };
      /** 扁方木扶手：沿折线逐段铺设 */
      const linkWoodRail = (pts, rw = .042, rhk = .032) => {
        const clean = [];
        pts.forEach(p => {
          if (!p || p.some(v => !Number.isFinite(v))) return;
          const last = clean[clean.length - 1];
          if (!last || Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) > 1e-3) clean.push(p);
        });
        for (let i = 0; i < clean.length - 1; i++){
          const a = clean[i], b = clean[i + 1];
          const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
          const len = Math.hypot(dx, dy, dz);
          if (len < 1e-3) continue;
          const o = mesh(new THREE.BoxGeometry(rw, rhk, len), wood);
          o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
          o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dx, dy, dz).normalize());
          sg.add(o);
        }
      };
      /** 踏步：微圆角 + 出边。userData.walk 标记「可站立面」，
       *  漫游据此对真实几何打竖直射线生成高程网格（旋转 / L / U / 三跑 / 旋转楼梯都适用） */
      const addTread = (tw, th, dep, x, y, z) => {
        const o = rbox(tw, th, dep, treadM, x, y, z, .006);
        o.userData.walk = 1; sg.add(o);
      };
      /** 扇形踏板/踢面：外缘顶到扶手立柱（XZ 平面扇环，沿 Y 挤出） */
      const addWedge = (rIn, rOut, a0, a1, y, thk, m) => {
        const n = 10;
        const sh = new THREE.Shape();
        for (let i = 0; i <= n; i++){
          const a = a0 + (a1 - a0) * (i / n);
          const px = Math.sin(a) * rOut, pz = Math.cos(a) * rOut;
          if (i === 0) sh.moveTo(px, -pz); else sh.lineTo(px, -pz);
        }
        for (let i = n; i >= 0; i--){
          const a = a0 + (a1 - a0) * (i / n);
          sh.lineTo(Math.sin(a) * rIn, -Math.cos(a) * rIn);
        }
        sh.closePath();
        const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(.012, thk), bevelEnabled: false, curveSegments: 1 });
        geo.rotateX(-Math.PI / 2);
        const o = mesh(geo, asMat(m));
        o.position.y = y;
        o.userData.walk = 1;          // 扇形踏步同样是可站立面
        sg.add(o);
      };

      if (style === 'spiral'){
        const R = Math.min(w, d) / 2;
        const rNewel = Math.max(.08, R * .13);
        // 踏板从中柱外缘一直铺到扶手立柱内侧
        const rIn = rNewel * 1.05, rOut = R * .97, rRail = rOut - .03;
        const steps = Math.max(14, Math.min(18, Math.round(R * 12)));
        const rise = H / steps, dA = (Math.PI * 2) / steps, treadH = .045;
        sg.add(box(rNewel * 2.2, .05, rNewel * 2.2, beamM, 0, 0, 0));
        sg.add(box(rNewel * 1.7, H + .08, rNewel * 1.7, newelM, 0, .05, 0));
        [H * .33, H * .66, H].forEach(yy => sg.add(box(rNewel * 2, .03, rNewel * 2, woodD, 0, yy, 0)));
        sg.add(box(rNewel * 1.1, .04, rNewel * 1.1, woodD, 0, H + .08, 0));
        const top = [];
        for (let i = 0; i < steps; i++){
          const a0 = i * dA, a1 = a0 + dA * .92, mid = (a0 + a1) / 2;
          const y = up ? i * rise : (steps - 1 - i) * rise;
          addWedge(rIn, rOut, a0, a1, y, treadH, treadM);
          if (i > 0){
            const ry = up ? y - rise + .002 : y + treadH;
            addWedge(rIn * 1.02, rOut * .98, a0, a1, ry, Math.max(.03, rise - treadH + .004), riserM);
          }
          // 立柱落在踏板外缘上，与扶手相连
          const bx = Math.sin(mid) * rRail, bz = Math.cos(mid) * rRail;
          addBaluster(bx, y + treadH, bz, rh);
          top.push([bx, y + treadH + rh, bz]);
        }
        linkWoodRail(top);
        const yS = up ? 0 : (steps - 1) * rise, yE = up ? (steps - 1) * rise : 0;
        const aS = dA * .46, aE = (steps - .46) * dA;
        addNewel(Math.sin(aS) * rRail, yS, Math.cos(aS) * rRail, rh + treadH + .05);
        addNewel(Math.sin(aE) * rRail, yE, Math.cos(aE) * rRail, rh + treadH + .05);
      } else if (style === 'l'){
        // 直角：z 跑 → 平台 → x 跑；实木闭踢面 + 外侧方栏杆
        const sw = Math.min(w, d) * .42, land = sw, st = .04;
        const runZ = Math.max(.45, d - land), runX = Math.max(.45, w - land);
        const n1 = Math.max(5, Math.round(runZ / .22)), n2 = Math.max(5, Math.round(runX / .22));
        const rise1 = (H * .5) / n1, rise2 = (H * .5) / n2;
        const stepZ = runZ / n1, stepX = runX / n2, th = .045, nose = .02, landTh = .05;
        const xC = -w / 2 + sw / 2, zC = d / 2 - sw / 2;
        const landY = H * .5, z0 = -d / 2, zLand = d / 2 - land;
        const xLand = -w / 2 + land, xEnd = w / 2;
        const tw = Math.max(.2, sw - 2 * st);
        const y1 = (i) => up ? rise1 * i : H - rise1 * (i + 1);
        const y2 = (i) => up ? landY + rise2 * i : landY - rise2 * (i + 1);
        const sideX = (s) => xC + s * (sw / 2 - st / 2);
        const sideZ = (s) => zC + s * (sw / 2 - st / 2);
        // 侧斜梁（锯齿外露侧）
        [-1, 1].forEach(s => {
          const x = sideX(s), z = sideZ(s);
          addSlopeBeam(x, y1(0) + th * .5, z0 + stepZ * .4, y1(n1 - 1) + th * .5, zLand - stepZ * .25, st, .16, beamM);
          addSlopeBeamX(z, y2(0) + th * .5, xLand + stepX * .4, y2(n2 - 1) + th * .5, xEnd - stepX * .25, st, .16, beamM);
        });
        // 第一跑：踏步 + 闭踢面 + 外侧栏杆
        const top1 = [];
        const xo = xC - sw / 2 + .028;
        for (let i = 0; i < n1; i++){
          const z = z0 + stepZ * (i + .5), y = y1(i);
          addTread(tw, th, stepZ + nose - .008, xC, y, z + (up ? nose * .15 : -nose * .15));
          if (i > 0){
            const prev = y1(i - 1), yLo = Math.min(y, prev);
            sg.add(box(tw, Math.abs(y - prev), .022, riserM, xC, yLo, z - stepZ * .5 + .008));
          } else {
            sg.add(box(tw, Math.max(.04, y + th), .022, riserM, xC, 0, z - stepZ * .5 + .008));
          }
          addBaluster(xo, y + th, z, rh);
          top1.push([xo, y + th + rh, z]);
        }
        {
          const yA = y1(n1 - 1) + th, yLo = Math.min(yA, landY), yHi = Math.max(yA, landY + landTh);
          sg.add(box(tw, Math.max(.03, yHi - yLo), .024, riserM, xC, yLo, zLand - .01));
        }
        linkWoodRail(top1);
        // 平台：木柱 + 面板
        const lx = -w / 2 + land / 2, lz = d / 2 - land / 2;
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
          sg.add(box(.07, landY, .07, beamM, lx + sx * (land / 2 - .04), 0, lz + sz * (land / 2 - .04)));
        });
        const ldL = box(land - .02, landTh, land - .02, treadM, lx, landY, lz);
        ldL.userData.walk = 1; sg.add(ldL);
        sg.add(box(land, .02, land, beamM, lx, landY - .02, lz));
        {
          const yFirst = y2(0), yLo = Math.min(landY, yFirst), yHi = Math.max(landY + landTh, yFirst + th);
          sg.add(box(.024, Math.max(.05, yHi - yLo), tw, riserM, xLand + .01, yLo, zC));
        }
        // 平台转角大方柱 + 扶手
        const railY = landY + rh;
        const zo = zC + sw / 2 - .028;
        const pIn = [xo, railY, zLand];
        const pCorner = [-w / 2 + .05, railY, d / 2 - .05];
        const pOut = [xLand + .02, railY, zo];
        addNewel(-w / 2 + .05, landY, d / 2 - .05, rh + .05);
        addNewel(xLand + .02, landY, zo, rh + .05);
        addBaluster(pCorner[0], landY + landTh, pCorner[2], rh);
        addBaluster(pOut[0], landY + landTh, pOut[2], rh);
        linkWoodRail([top1[top1.length - 1], pIn, pCorner, pOut]);
        // 第二跑
        const top2 = [];
        for (let i = 0; i < n2; i++){
          const x = xLand + stepX * (i + .5), y = y2(i);
          addTread(stepX + nose - .008, th, tw, x + (up ? nose * .15 : -nose * .15), y, zC);
          if (i > 0){
            const prev = y2(i - 1), yLo = Math.min(y, prev);
            sg.add(box(.022, Math.abs(y - prev), tw, riserM, x - stepX * .5 + .008, yLo, zC));
          }
          addBaluster(x, y + th, zo, rh);
          top2.push([x, y + th + rh, zo]);
        }
        if (up) linkWoodRail([pOut, ...top2]);
        else {
          const pDrop = [pOut[0], y2(0) + th + rh, pOut[2]];
          linkWoodRail([pOut, pDrop, ...top2]);
        }
        addNewel(xo, y1(0), z0 + .05, rh + .06);
        addNewel(xEnd - .05, y2(n2 - 1), zo, rh + .06);
        // 密立柱：两踏之间补一根
        for (let i = 0; i < top1.length - 1; i++){
          const a = top1[i], b = top1[i + 1];
          addMidBal(a[0], a[1] - rh, a[2], b[0], b[1] - rh, b[2], rh);
        }
        for (let i = 0; i < top2.length - 1; i++){
          const a = top2[i], b = top2[i + 1];
          addMidBal(a[0], a[1] - rh, a[2], b[0], b[1] - rh, b[2], rh);
        }
      } else if (style === 'u'){
        /* U 形回转（参照实拍）：双平行跑 + 端平台 · 外侧密方栏杆 */
        const gap = .06;
        const sw = Math.max(.42, (w - gap) / 2);
        const landD = Math.min(Math.max(.55, sw * .95), d * .32);
        const run = Math.max(.55, d - landD);
        const n = Math.max(6, Math.round(run / .2));
        const rise = (H * .5) / n, stepZ = run / n, th = .045, nose = .018, landTh = .05;
        const xL = -w / 2 + sw / 2, xR = w / 2 - sw / 2;
        const z0 = -d / 2, zLand = d / 2 - landD, landY = H * .5;
        const tw = Math.max(.22, sw - .1);
        const yA = (i) => up ? rise * i : H - rise * (i + 1);
        const yB = (i) => up ? landY + rise * i : landY - rise * (i + 1);
        // 两侧斜梁
        [-1, 1].forEach(s => {
          const ox = s * (sw / 2 - .03);
          addSlopeBeam(xL + ox, yA(0) + th * .5, z0 + stepZ * .35, yA(n - 1) + th * .5, zLand - stepZ * .2, .045, .15, beamM);
          addSlopeBeam(xR + ox, yB(0) + th * .5, zLand - stepZ * .2, yB(n - 1) + th * .5, z0 + stepZ * .35, .045, .15, beamM);
        });
        // 第一跑（左 · 向前上台）
        const topL = [];
        const xoL = xL - sw / 2 + .03;
        for (let i = 0; i < n; i++){
          const z = z0 + stepZ * (i + .5), y = yA(i);
          addTread(tw, th, stepZ + nose - .006, xL, y, z + (up ? nose * .12 : -nose * .12));
          if (i > 0){
            const prev = yA(i - 1), yLo = Math.min(y, prev);
            sg.add(box(tw, Math.abs(y - prev), .02, riserM, xL, yLo, z - stepZ * .5 + .006));
          } else {
            sg.add(box(tw, Math.max(.04, y + th), .02, riserM, xL, 0, z - stepZ * .5 + .006));
          }
          addBaluster(xoL, y + th, z, rh);
          topL.push([xoL, y + th + rh, z]);
          if (i > 0){
            const pz = z0 + stepZ * (i - .5), py = yA(i - 1);
            addMidBal(xoL, py + th, pz, xoL, y + th, z, rh);
          }
        }
        {
          const yA1 = yA(n - 1) + th, yLo = Math.min(yA1, landY), yHi = Math.max(yA1, landY + landTh);
          sg.add(box(tw, Math.max(.03, yHi - yLo), .022, riserM, xL, yLo, zLand - .008));
        }
        linkWoodRail(topL);
        // 平台
        const lx = 0, lz = d / 2 - landD / 2;
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
          sg.add(box(.07, landY, .07, beamM, lx + sx * (w / 2 - .05), 0, lz + sz * (landD / 2 - .04)));
        });
        const ldU = box(w - .04, landTh, landD - .02, treadM, lx, landY, lz);
        ldU.userData.walk = 1; sg.add(ldU);
        sg.add(box(w, .02, landD, beamM, lx, landY - .02, lz));
        // 平台转角大方柱 + 扶手衔接
        const railY = landY + rh;
        const pL = [xoL, railY, zLand];
        const pBackL = [-w / 2 + .04, railY, d / 2 - .04];
        const pBackR = [w / 2 - .04, railY, d / 2 - .04];
        const xoR = xR + sw / 2 - .03;
        const pR = [xoR, railY, zLand];
        addNewel(-w / 2 + .04, landY, d / 2 - .04, rh + .05);
        addNewel(w / 2 - .04, landY, d / 2 - .04, rh + .05);
        linkWoodRail([topL[topL.length - 1], pL, pBackL, pBackR, pR]);
        // 第二跑（右 · 回转向前）
        const topR = [];
        {
          const yFirst = yB(0), yLo = Math.min(landY, yFirst), yHi = Math.max(landY + landTh, yFirst + th);
          sg.add(box(tw, Math.max(.05, yHi - yLo), .022, riserM, xR, yLo, zLand - .008));
        }
        for (let i = 0; i < n; i++){
          const z = zLand - stepZ * (i + .5), y = yB(i);
          addTread(tw, th, stepZ + nose - .006, xR, y, z + (up ? -nose * .12 : nose * .12));
          if (i > 0){
            const prev = yB(i - 1), yLo = Math.min(y, prev);
            sg.add(box(tw, Math.abs(y - prev), .02, riserM, xR, yLo, z + stepZ * .5 - .006));
          }
          addBaluster(xoR, y + th, z, rh);
          topR.push([xoR, y + th + rh, z]);
          if (i > 0){
            const pz = zLand - stepZ * (i - .5), py = yB(i - 1);
            addMidBal(xoR, py + th, pz, xoR, y + th, z, rh);
          }
        }
        if (up) linkWoodRail([pR, ...topR]);
        else {
          const pDrop = [pR[0], yB(0) + th + rh, pR[2]];
          linkWoodRail([pR, pDrop, ...topR]);
        }
        addNewel(xoL, yA(0), z0 + .05, rh + .06);
        addNewel(xoR, yB(n - 1), z0 + .05, rh + .06);
      } else if (style === 'triple'){
        /* 三跑：z 跑 → 平台1 → x 跑 → 平台2 → -z 跑；每跑升 H/3 */
        const sw = Math.min(w, d) * .36, land = Math.max(sw, Math.min(w, d) * .32), st = .04;
        const runZ = Math.max(.5, d - land), runX = Math.max(.45, w - 2 * land);
        const n1 = Math.max(4, Math.round(runZ / .22));
        const n2 = Math.max(3, Math.round(runX / .22));
        const n3 = Math.max(4, Math.round(runZ / .22));
        const rise1 = (H / 3) / n1, rise2 = (H / 3) / n2, rise3 = (H / 3) / n3;
        const stepZ = runZ / n1, stepZ3 = runZ / n3, stepX = runX / n2;
        const th = .045, nose = .018, landTh = .05;
        const z0 = -d / 2, zLand = d / 2 - land;
        const xL = -w / 2 + sw / 2, xR = w / 2 - sw / 2;
        const zMid = d / 2 - sw / 2;
        const xLand1 = -w / 2 + land, xLand2 = w / 2 - land;
        const landY1 = H / 3, landY2 = (H * 2) / 3;
        const tw = Math.max(.2, sw - 2 * st);
        const y1 = (i) => up ? rise1 * i : H - rise1 * (i + 1);
        const y2 = (i) => up ? landY1 + rise2 * i : landY2 - rise2 * (i + 1);
        const y3 = (i) => up ? landY2 + rise3 * i : landY1 - rise3 * (i + 1);
        const addLand = (lx, lz, ly) => {
          [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
            sg.add(box(.065, Math.max(.08, ly), .065, beamM, lx + sx * (land / 2 - .04), 0, lz + sz * (land / 2 - .04)));
          });
          const ldT = box(land - .02, landTh, land - .02, treadM, lx, ly, lz);
          ldT.userData.walk = 1; sg.add(ldT);
          sg.add(box(land, .02, land, beamM, lx, ly - .02, lz));
        };
        // 斜梁
        [-1, 1].forEach(s => {
          const ox = s * (sw / 2 - st / 2);
          addSlopeBeam(xL + ox, y1(0) + th * .5, z0 + stepZ * .35, y1(n1 - 1) + th * .5, zLand - stepZ * .2, st, .14, beamM);
          addSlopeBeamX(zMid + s * (sw / 2 - st / 2), y2(0) + th * .5, xLand1 + stepX * .35, y2(n2 - 1) + th * .5, xLand2 - stepX * .2, st, .14, beamM);
          addSlopeBeam(xR + ox, y3(0) + th * .5, zLand - stepZ3 * .2, y3(n3 - 1) + th * .5, z0 + stepZ3 * .35, st, .14, beamM);
        });
        // 第一跑（左 · +z）
        const top1 = [];
        const xo1 = xL - sw / 2 + .028;
        for (let i = 0; i < n1; i++){
          const z = z0 + stepZ * (i + .5), y = y1(i);
          addTread(tw, th, stepZ + nose - .006, xL, y, z + (up ? nose * .12 : -nose * .12));
          if (i > 0){
            const prev = y1(i - 1), yLo = Math.min(y, prev);
            sg.add(box(tw, Math.abs(y - prev), .02, riserM, xL, yLo, z - stepZ * .5 + .006));
          } else {
            sg.add(box(tw, Math.max(.04, y + th), .02, riserM, xL, 0, z - stepZ * .5 + .006));
          }
          addBaluster(xo1, y + th, z, rh);
          top1.push([xo1, y + th + rh, z]);
          if (i > 0) addMidBal(xo1, y1(i - 1) + th, z0 + stepZ * (i - .5), xo1, y + th, z, rh);
        }
        {
          const yA = y1(n1 - 1) + th, yLo = Math.min(yA, landY1), yHi = Math.max(yA, landY1 + landTh);
          sg.add(box(tw, Math.max(.03, yHi - yLo), .022, riserM, xL, yLo, zLand - .008));
        }
        linkWoodRail(top1);
        // 平台 1
        const l1x = -w / 2 + land / 2, l1z = d / 2 - land / 2;
        addLand(l1x, l1z, landY1);
        // 第二跑（后 · +x）
        const top2 = [];
        const zo2 = zMid + sw / 2 - .028;
        {
          const yFirst = y2(0), yLo = Math.min(landY1, yFirst), yHi = Math.max(landY1 + landTh, yFirst + th);
          sg.add(box(.022, Math.max(.05, yHi - yLo), tw, riserM, xLand1 + .01, yLo, zMid));
        }
        for (let i = 0; i < n2; i++){
          const x = xLand1 + stepX * (i + .5), y = y2(i);
          addTread(stepX + nose - .006, th, tw, x + (up ? nose * .12 : -nose * .12), y, zMid);
          if (i > 0){
            const prev = y2(i - 1), yLo = Math.min(y, prev);
            sg.add(box(.02, Math.abs(y - prev), tw, riserM, x - stepX * .5 + .006, yLo, zMid));
          }
          addBaluster(x, y + th, zo2, rh);
          top2.push([x, y + th + rh, zo2]);
          if (i > 0) addMidBal(xLand1 + stepX * (i - .5), y2(i - 1) + th, zo2, x, y + th, zo2, rh);
        }
        {
          const yA = y2(n2 - 1) + th, yLo = Math.min(yA, landY2), yHi = Math.max(yA, landY2 + landTh);
          sg.add(box(.022, Math.max(.03, yHi - yLo), tw, riserM, xLand2 - .01, yLo, zMid));
        }
        // 平台衔接扶手
        const r1 = landY1 + rh, r2 = landY2 + rh;
        const p1a = [xo1, r1, zLand];
        const p1b = [-w / 2 + .05, r1, d / 2 - .05];
        const p1c = [xLand1 + .02, r1, zo2];
        addNewel(-w / 2 + .05, landY1, d / 2 - .05, rh + .05);
        addNewel(xLand1 + .02, landY1, zo2, rh + .05);
        linkWoodRail([top1[top1.length - 1], p1a, p1b, p1c, top2[0] || p1c]);
        linkWoodRail(top2);
        // 平台 2
        const l2x = w / 2 - land / 2, l2z = d / 2 - land / 2;
        addLand(l2x, l2z, landY2);
        const p2a = [xLand2 - .02, r2, zo2];
        const p2b = [w / 2 - .05, r2, d / 2 - .05];
        const xo3 = xR + sw / 2 - .028;
        const p2c = [xo3, r2, zLand];
        addNewel(w / 2 - .05, landY2, d / 2 - .05, rh + .05);
        addNewel(xo3, landY2, zLand, rh + .05);
        linkWoodRail([top2[top2.length - 1], p2a, p2b, p2c]);
        // 第三跑（右 · -z）
        const top3 = [];
        {
          const yFirst = y3(0), yLo = Math.min(landY2, yFirst), yHi = Math.max(landY2 + landTh, yFirst + th);
          sg.add(box(tw, Math.max(.05, yHi - yLo), .022, riserM, xR, yLo, zLand - .008));
        }
        for (let i = 0; i < n3; i++){
          const z = zLand - stepZ3 * (i + .5), y = y3(i);
          addTread(tw, th, stepZ3 + nose - .006, xR, y, z + (up ? -nose * .12 : nose * .12));
          if (i > 0){
            const prev = y3(i - 1), yLo = Math.min(y, prev);
            sg.add(box(tw, Math.abs(y - prev), .02, riserM, xR, yLo, z + stepZ3 * .5 - .006));
          }
          addBaluster(xo3, y + th, z, rh);
          top3.push([xo3, y + th + rh, z]);
          if (i > 0) addMidBal(xo3, y3(i - 1) + th, zLand - stepZ3 * (i - .5), xo3, y + th, z, rh);
        }
        if (up) linkWoodRail([p2c, ...top3]);
        else {
          const pDrop = [p2c[0], y3(0) + th + rh, p2c[2]];
          linkWoodRail([p2c, pDrop, ...top3]);
        }
        addNewel(xo1, y1(0), z0 + .05, rh + .06);
        addNewel(xo3, y3(n3 - 1), z0 + .05, rh + .06);
      } else {
        // 直跑实木梯：闭踢面 · 双斜梁 · 密方栏杆
        const steps = Math.max(10, Math.round(d / .2));
        const rise = H / steps, run = d / steps, st = .05, th = .045, nose = .02;
        const z0 = -d / 2, z1 = d / 2, tw = w - 2 * st;
        [-1, 1].forEach(sx => addSlopeBeam(sx * (w / 2 - st / 2), .05, z0 + .02, H + .05, z1 - .02, st, .15, beamM));
        sg.add(box(w, .05, .08, beamM, 0, 0, z0 + .04));
        sg.add(box(w, .05, .08, beamM, 0, H, z1 - .04));
        const topL = [], topR = [];
        for (let i = 0; i < steps; i++){
          const y = up ? rise * i : rise * (steps - 1 - i);
          const z = z0 + run * (i + .5);
          addTread(tw, th, run + nose - .01, 0, y, z + (up ? nose * .15 : -nose * .15));
          if (up ? i > 0 : i < steps - 1){
            const ry = up ? y - rise + .004 : y + th;
            sg.add(box(tw, Math.max(.03, rise - .008), .018, riserM, 0, ry, z - run * .5 + .008));
          } else if (up && i === 0){
            sg.add(box(tw, Math.max(.04, y + th), .018, riserM, 0, 0, z - run * .5 + .008));
          }
          [-1, 1].forEach((sx, si) => {
            const x = sx * (w / 2 - st - .02);
            addBaluster(x, y + th, z, rh);
            (si ? topR : topL).push([x, y + th + rh, z]);
            if (i > 0){
              const pz = z0 + run * (i - .5);
              const py = up ? rise * (i - 1) : rise * (steps - i);
              addMidBal(x, py + th, pz, x, y + th, z, rh);
            }
          });
        }
        const yStart = up ? 0 : H - rise, yEnd = up ? H - rise : 0;
        [[topL, -1], [topR, 1]].forEach(([top, sx]) => {
          const x = sx * (w / 2 - st - .02);
          addNewel(x, yStart, z0 + .05, rh + .06);
          addNewel(x, yEnd, z1 - .05, rh + .06);
          linkWoodRail([[x, yStart + rh + .04, z0 + .05], ...top, [x, yEnd + rh + .04, z1 - .05]]);
        });
      }
      sg.scale.x = f.flip ? -1 : 1;
      g.add(sg);
      break;
    }
    /* ——— 新增客厅家具 ——— */
    case 'chaise': {
      const fab = fabric(c), dk = fabric(darker(c, .86)), piping = fabric(lighter(c, .3)), wm = woodM('#4a3b2e');
      legs(g, w, d, .12, wm, .07, .016);
      g.add(rbox(w, .16, d, dk, 0, .12, 0, .03));
      // 长坐垫
      g.add(rbox(w - .18, .15, d - .14, fab, .06, .28, .01, .06));
      g.add(rbox(w - .22, .012, .012, piping, .06, .28, d/2 - .09, .005));
      for (let i = 1; i < 3; i++) g.add(box(.006, .006, d - .2, dk, -w/2 + .1 + (w - .2)*i/3, .435, 0));
      // 单侧高靠背 + 斜靠垫 + 拉扣
      g.add(rbox(.22, .82, d, dk, -w/2 + .11, .12, 0, .07));
      g.add(rot(rbox(.16, .52, d - .14, fab, -w/2 + .21, .34, .01, .06), 0, 0, .18));
      for (let k = 0; k < 3; k++) g.add(blob(.013, .013, .006, dk, -w/2 + .3, .55, -d*.3 + k*d*.3, 10));
      // 圆柱抱枕（沿 X 轴）
      g.add(rod([-w*.1, .52, -d*.1], [w*.06, .52, -d*.1], .075, fabric(lighter(c, .3)), .075, 20));
      // 搭毯
      g.add(rot(rbox(w*.3, .02, d*.7, fabric(darker(c, .72)), w*.2, .435, .06, .01), 0, 0, .03));
      break;
    }
    case 'curvedsofa': {
      const fab = fabric(c), dk = fabric(darker(c, .86)), piping = fabric(lighter(c, .3)), R0 = w*.5, seg = 7;
      for (let i = 0; i < seg; i++){
        const t = (i + .5)/seg, a = (t - .5)*1.45;
        const x = Math.sin(a)*R0*.8, z = -Math.cos(a)*R0*.3 + R0*.3 - d*.16;
        const seat = rbox(w/seg + .03, .15, d*.62, fab, 0, .12, 0, .06);
        seat.position.set(x, .195, z); seat.rotation.y = a; g.add(seat);
        const back = rbox(w/seg + .02, .52, .12, dk, 0, .12, 0, .05);
        back.position.set(x, .38, z - d*.3); back.rotation.y = a; g.add(back);
        const pip = rbox(w/seg, .012, .012, piping, 0, 0, 0, .005);
        pip.position.set(x, .27, z + d*.29); pip.rotation.y = a; g.add(pip);
        g.add(blob(.012, .012, .006, dk, x, .53, z - d*.3 + .06, 10));
        [-1, 1].forEach(sg => g.add(rod([x + sg*w/seg*.32, 0, z - d*.2], [x + sg*w/seg*.32, .12, z - d*.2], .012, woodM('#3a3027'), .016)));
      }
      // 两端抱枕
      [-1, 1].forEach((sg, k) => {
        const a = sg*.62, x = Math.sin(a)*R0*.8, z = -Math.cos(a)*R0*.3 + R0*.3 - d*.16;
        g.add(rot(rbox(.38, .38, .1, fabric(k ? darker(c,.68) : lighter(c,.32)), x, .3, z + d*.1, .05), -.25, a, 0));
      });
      break;
    }
    case 'sectional': {
      const k = Math.min(.8, d*.42, w*.3), b = .2, fab = fabric(c), dk = fabric(darker(c, .86)), piping = fabric(lighter(c, .3)), lh = .1;
      legs(g, w, d, lh, woodM('#3a3027'), .07, .016);
      g.add(rbox(w, .18, d, dk, 0, lh, 0, .03));
      // 三段坐垫（横向 + 左右竖向）
      const hx = 0, hw = w - 2*k, hz = bz + k/2;
      g.add(rbox(hw, .15, k - b, fab, hx, lh + .18, hz + b*.4, .055));
      for (let i = 0; i < 2; i++){
        const x = -w/2 + k/2 + i*(w - k);
        g.add(rbox(k - b, .15, d - k - .1, fab, x, lh + .18, bz + k + (d - k)/2, .055));
        g.add(rbox(k - b, .012, .012, piping, x, lh + .18, d/2 - .06, .005));
        for (let q = 0; q < 2; q++) g.add(blob(.012, .012, .006, dk, x, lh + .46, bz + k*.6 + q*.2, 10));
      }
      // U 形靠背
      g.add(rbox(w, .7, b, dk, 0, lh, bz + b/2, .06));
      [-1, 1].forEach(sg => g.add(rbox(b, .7, d - b, dk, sg*(w/2 - b/2), lh, b/2, .06)));
      for (let i = 0; i < 4; i++) g.add(blob(.012, .012, .006, dk, -w*.3 + i*w*.2, lh + .48, bz + b*.65, 10));
      g.add(rbox(w - .06, .012, .012, piping, 0, lh + .7, bz + b*.65, .005));
      // 抱枕
      [[-1, lighter(c,.32)], [1, darker(c,.68)]].forEach(([sg, pc]) =>
        g.add(rot(rbox(.4, .4, .12, fabric(pc), sg*(w*.22), lh + .34, bz + b + .26, .06), -.3, sg*.2, 0)));
      break;
    }
    case 'eggchair': {
      const fab = fabric(c), dk = mat(darker(c, .82), {roughness:.96, side:THREE.DoubleSide}), bm = blackMetal();
      // 开口蛋壳：球面裁掉朝向 +z 的扇形，露出内部软包坐垫
      const shell = mesh(new THREE.SphereGeometry(1, 36, 24, Math.PI/2 + 1.3, Math.PI*2 - 2.6, .05, Math.PI*.82), dk);
      shell.scale.set(w*.42, .58, d*.44); shell.position.set(0, .78, 0);
      g.add(shell);
      // 内壁软包 + 坐垫 + 腰枕 + 拉扣
      g.add(rbox(w*.54, .5, .1, fab, 0, .5, -d*.28, .18));
      g.add(rbox(w*.5, .13, d*.44, fab, 0, .42, .06, .06));
      g.add(rbox(w*.36, .3, .1, fabric(lighter(c, .3)), 0, .55, -d*.2, .05));
      for (let i = 0; i < 3; i++) g.add(blob(.012, .012, .006, fabric(darker(c, .7)), -w*.1 + i*w*.1, .86, -d*.22, 10));
      // 星形底座 + 立杆
      g.add(cyl(.05, .05, .42, bm, 0, 0, 0, 20), cyl(.22, .24, .025, metal(), 0, .42, 0, 32));
      for (let k = 0; k < 4; k++){
        const a = k*Math.PI/2 + Math.PI/4;
        g.add(rod([0, .02, 0], [Math.cos(a)*.24, .02, Math.sin(a)*.24], .012, bm, .016));
      }
      break;
    }
    case 'rockingchair': {
      const wm = woodM(c), fab = fabric(c), dk = fabric(darker(c, .8));
      // 两条弧形摇杆
      [-1, 1].forEach(sg => {
        const pts = [];
        for (let i = 0; i <= 12; i++){
          const t = i/12;
          pts.push([sg*(w*.36), .035 + Math.sin(Math.PI*t)*.075, -d*.42 + t*d*.84]);
        }
        g.add(tube(pts, .018, wm, 32));
      });
      // 椅座 + 坐垫
      g.add(rbox(w*.78, .045, d*.62, wm, 0, .4, 0, .01));
      g.add(rbox(w*.72, .07, d*.56, fab, 0, .445, .01, .03));
      // 靠背（后倾）+ 竖条
      g.add(rot(rbox(w*.76, .62, .04, wm, 0, .46, bz + .12, .015), -.2, 0, 0));
      for (let i = 0; i < 5; i++) g.add(rot(rbox(.035, .5, .02, woodM(lighter(c, .18)), -w*.3 + i*w*.15, .5, bz + .14, .008), -.2, 0, 0));
      g.add(rbox(w*.74, .1, .03, dk, 0, .94, bz + .18, .02));
      // 扶手
      [-1, 1].forEach(sg => g.add(rbox(.045, .035, d*.5, wm, sg*(w*.36), .62, 0, .012)));
      [-1, 1].forEach(sg => g.add(rod([sg*(w*.36), .4, d*.22], [sg*(w*.36), .62, d*.22], .014, wm, .018)));
      break;
    }
    case 'nestingtable': {
      const tm = woodM(c), bm = blackMetal(), r1 = Math.min(w, d)*.42, r2 = r1*.66;
      // 大几
      g.add(cyl(r1, r1, .03, tm, 0, .42, 0, 48));
      for (let k = 0; k < 3; k++){
        const a = k*Math.PI*2/3;
        g.add(rod([Math.cos(a)*r1*.75, 0, Math.sin(a)*r1*.75], [Math.cos(a)*r1*.75, .42, Math.sin(a)*r1*.75], .01, bm, .014));
      }
      g.add(ring(r1*.99, .004, metal(), 0, .45, 0));
      // 小几（错位）
      const ox = w*.18, oz = -d*.16;
      g.add(cyl(r2, r2, .026, woodM(lighter(c, .16)), ox, .31, oz, 40));
      for (let k = 0; k < 3; k++){
        const a = k*Math.PI*2/3 + .4;
        g.add(rod([ox + Math.cos(a)*r2*.7, 0, oz + Math.sin(a)*r2*.7], [ox + Math.cos(a)*r2*.7, .31, oz + Math.sin(a)*r2*.7], .009, bm, .012));
      }
      g.add(ring(r2*.98, .0035, metal(), ox, .336, oz));
      // 台面小物
      g.add(box(.18, .022, .14, '#e6dccd', -r1*.3, .45, .02), box(.16, .018, .12, '#3b5566', -r1*.3, .472, .02));
      vase(g, r1*.32, .45, -.04, .045, .16, '#e9e2d6', R);
      break;
    }
    case 'drumstool': {
      const r = Math.min(w, d)/2, fm = fabric(c), dk = fabric(darker(c, .78));
      g.add(lathe([[r*.68, 0], [r*.82, .04], [r*.92, .16], [r*.92, .32], [r*.82, .44], [r*.68, .48]], fm, 0, 0, 0, 40));
      g.add(cyl(r*.68, r*.68, .018, fabric(lighter(c, .14)), 0, .48, 0, 40));
      for (let k = 0; k < 12; k++){
        const a = k*Math.PI/6;
        g.add(rod([Math.cos(a)*r*.7, .01, Math.sin(a)*r*.7], [Math.cos(a)*r*.92, .47, Math.sin(a)*r*.92], .006, dk, .006, 6));
      }
      g.add(ring(r*.7, .007, mat('#c9a86a', {metalness:.7, roughness:.3}), 0, .03, 0));
      g.add(ring(r*.7, .007, mat('#c9a86a', {metalness:.7, roughness:.3}), 0, .46, 0));
      g.add(blob(.024, .008, .024, dk, 0, .5, 0, 12));
      for (let k = 0; k < 8; k++){
        const a = k*Math.PI/4;
        g.add(blob(.014, .006, .014, dk, Math.cos(a)*r*.4, .498, Math.sin(a)*r*.4, 10));
      }
      break;
    }
    case 'barcart': {
      const bm = chrome(), tm = woodM(c);
      g.add(rbox(w, .025, d, tm, 0, .72, 0, .008), rbox(w, .02, d, tm, 0, .28, 0, .006));
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(rod([sx*(w/2-.03), .05, sz*(d/2-.03)], [sx*(w/2-.03), .75, sz*(d/2-.03)], .009, bm, .011));
        g.add(blob(.042, .042, .018, blackMetal(), sx*(w/2-.03), .042, sz*(d/2-.03), 14));
      });
      // 上下层围边
      g.add(rbox(w, .03, .012, bm, 0, .745, d/2 - .01, .004), rbox(w, .03, .012, bm, 0, .745, -d/2 + .01, .004));
      g.add(rbox(w, .026, .012, bm, 0, .3, d/2 - .01, .004));
      // 酒瓶与玻璃杯
      const bottle = (x, z, col, h) => {
        g.add(lathe([[0, 0], [.035, 0], [.042, .03], [.04, h*.62], [.018, h*.78], [.014, h]], mat(col, {roughness:.15, metalness:.1, transparent:true, opacity:.85}), x, .745, z, 24));
        g.add(cyl(.014, .014, .02, mat('#6b4a30'), x, .745 + h, z, 12));
      };
      bottle(-w*.2, -d*.12, '#5d7a4a', .26);
      bottle(-w*.05, -d*.12, '#8a5a3a', .22);
      bottle(w*.1, -d*.12, '#3f5a6a', .24);
      g.add(cyl(.035, .03, .09, mat('#e8f0f2', {roughness:.08, transparent:true, opacity:.55}), w*.26, .745, d*.12, 20));
      g.add(lathe([[0, 0], [.05, 0], [.055, .012]], metal(), -w*.26, .745, d*.14, 24));
      break;
    }
    case 'fireplace': {
      const sm = mat(c, {roughness:.55}), mantle = woodM(darker(c, .78));
      g.add(rbox(w, 1.02, d, sm, 0, 0, 0, .015));
      g.add(rbox(w + .1, .075, d + .08, mantle, 0, 1.02, 0, .008));
      // 炉膛
      const fz = d/2 + .003;
      g.add(box(w*.64, .64, .02, mat('#1b1815', {roughness:.95}), 0, .16, fz));
      g.add(box(w*.64, .02, .03, mat('#3a332c'), 0, .8, fz + .01));
      // 火焰（发光材质，夜景自动提亮）
      const flame = glowMat('#ffb24a', '#ff7416', .95);
      for (let k = 0; k < 5; k++){
        const x = -w*.22 + k*w*.11;
        g.add(blob(.055 + (k%2)*.02, .16 + (k%3)*.05, .035, flame, x, .28, fz + .035, 16));
      }
      // 木柴
      for (let k = 0; k < 3; k++) g.add(rod([-w*.2 + k*w*.1, .19, fz + .05], [w*.02 + k*w*.08, .23, fz + .09], .022, mat('#5a402c', {roughness:.95}), .018, 8));
      // 壁炉台上的装饰
      vase(g, -w*.3, 1.095, 0, .06, .24, '#e9e2d6', R);
      g.add(rbox(.22, .03, .16, '#3b5566', w*.28, 1.095, 0, .005));
      break;
    }
    case 'screen': {
      const fm = woodM(c), paper = mat('#f2e9dc', {roughness:.95, side:THREE.DoubleSide});
      const pw = w/3 - .03, ph = 1.75;
      for (let i = 0; i < 3; i++){
        const a = (i - 1)*.24, o = new THREE.Group();
        o.add(box(pw, ph, .014, paper, 0, .02, 0));
        // 木框 + 竖横格
        [-1, 1].forEach(sg => o.add(box(.035, ph + .04, .03, fm, sg*(pw/2 - .018), 0, 0)));
        [0, 1].forEach(sg => o.add(box(pw, .035, .03, fm, 0, sg*ph - .018 + .02, 0)));
        for (let k = 1; k < 4; k++) o.add(box(.012, ph - .08, .02, fm, -pw/2 + pw*k/4, .02, .012));
        for (let k = 1; k < 4; k++) o.add(box(pw - .08, .012, .02, fm, 0, .02 + ph*k/4 - ph*.38, .012));
        o.position.set((i - 1)*pw*.92, 0, Math.abs(i - 1)*.06);
        o.rotation.y = a;
        g.add(o);
      }
      break;
    }
    case 'floorcushion': {
      const fm = fabric(c), dk = fabric(darker(c, .76));
      g.add(blob(w*.46, .1, d*.46, fm, 0, .1, 0, 32));
      for (let k = 0; k < 10; k++){
        const a = k*Math.PI/5;
        g.add(rod([Math.cos(a)*w*.1, .198, Math.sin(a)*d*.1], [Math.cos(a)*w*.42, .198, Math.sin(a)*d*.42], .0024, dk, .0024, 6));
      }
      g.add(blob(w*.14, .012, d*.14, fabric(lighter(c, .12)), 0, .198, 0, 20));
      g.add(blob(.026, .008, .026, dk, 0, .208, 0, 12));
      break;
    }
    case 'speaker': {
      const bm = mat(darker(c, .42), {roughness:.62}), gr = mat('#17191b', {roughness:.9});
      g.add(rbox(w, 1.02, d, bm, 0, 0, 0, .012));
      g.add(box(w - .04, .012, d - .04, woodM(darker(c, .7)), 0, 1.02, 0));
      const unit = (y, r, col) => {
        const o = cyl(r, r, .012, mat(col, {roughness:.75}), 0, y, d/2 + .006, 32);
        o.rotation.x = Math.PI/2; g.add(o);
        const o2 = cyl(r*.62, r*.62, .014, gr, 0, y, d/2 + .013, 28);
        o2.rotation.x = Math.PI/2; g.add(o2);
        const o3 = cyl(r*.24, r*.24, .016, mat(lighter(col, .2)), 0, y, d/2 + .02, 20);
        o3.rotation.x = Math.PI/2; g.add(o3);
      };
      unit(.76, Math.min(w*.3, .13), '#2b2d30');
      unit(.42, Math.min(w*.22, .095), '#2b2d30');
      const port = cyl(Math.min(w*.08, .035), Math.min(w*.08, .035), .018, gr, 0, .18, d/2 + .008, 20);
      port.rotation.x = Math.PI/2; g.add(port);
      break;
    }
    case 'artframe': {
      const h = Math.min(1.5, Math.max(.8, w*1.05)), fm = woodM(darker(c, .72));
      g.add(rbox(w, h, .045, fm, 0, .14, 0, .008));
      g.add(box(w - .09, h - .09, .006, mat(lighter(c, .28), {roughness:.9}), 0, .185, .026));
      g.add(box(w*.42, h*.36, .004, mat(darker(c, .84), {roughness:.9}), -w*.14, .46, .031));
      g.add(box(w*.3, h*.22, .004, mat(lighter(c, .12), {roughness:.9}), w*.2, .34, .031));
      // 落地画架
      [-1, 1].forEach(sg => g.add(rod([sg*w*.3, 0, -.1], [sg*w*.16, .9, .02], .014, fm, .018)));
      g.add(rod([0, 0, -.22], [0, .3, .02], .014, fm, .018));
      g.add(rbox(w*.8, .03, .06, fm, 0, .12, .04, .006));
      break;
    }
    /* ======================= 装饰 ======================= */
    /* 挂墙类：模型竖立在局部 +Z 正面，底边离地约 1.05m；
       摆放位置与朝向由 addItem/snapWallDecor 吸附墙面时写入 f.cx/f.cy/f.rot，
       因此这里无需读取墙体数据，多层 withFloorData 切换也不会错位。 */
    case 'wallart': {
      // 挂画：单幅画框 + 程序化抽象画面
      const H = Math.min(1.25, Math.max(.55, w * .74));
      g.add(decorFrame(w, H, .04, .045, 1.05, darker(c, .72), decorArtMat('abstract', Math.floor(R() * 4))));
      break;
    }
    case 'gallerywall': {
      // 照片墙：四幅错落相框组成一组
      const n = 4, gap = w * .03, pw = (w - gap * (n - 1)) / n;
      const hs = [.62, .48, .55, .44], ys = [1.02, 1.18, 1.08, 1.22];
      const kinds = ['abstract', 'botanical', 'mono', 'landscape'];
      for (let i = 0; i < n; i++){
        const px = -w / 2 + pw / 2 + i * (pw + gap), ph = Math.min(hs[i], pw * 1.35);
        const fr = decorFrame(pw, ph, .028, Math.min(.03, pw * .12), ys[i],
          i % 2 ? '#6b5844' : darker(c, .7), decorArtMat(kinds[i], i + 2));
        fr.position.x = px; g.add(fr);
      }
      break;
    }
    case 'wallmirror': {
      // 装饰镜：金属圆框 + 冷色镜面 + 斜向高光
      const H = Math.min(1.3, Math.max(.68, w * .95)), yc = 1.05 + H / 2, r = Math.min(w, H) / 2;
      const fr = mat(darker(c, .55), {metalness:.55, roughness:.3});
      const outer = mesh(new THREE.TorusGeometry(r, .026, 14, 64), fr);
      outer.position.set(0, yc, 0); g.add(outer);
      // 低金属度 + 亮银底色：无强环境贴图时也能保持镜面通透，不会发灰发黑
      const disc = mesh(new THREE.CircleGeometry(r - .026, 64), mat('#e9f2f6', {metalness:.12, roughness:.06}));
      disc.position.set(0, yc, .012); g.add(disc);
      const gl = mesh(new THREE.PlaneGeometry(.055, H * .7), mat('#ffffff', {transparent:true, opacity:.38, roughness:.08, depthWrite:false}));
      gl.position.set(-r * .32, yc, .016); gl.rotation.z = .48; g.add(gl);
      const gl2 = mesh(new THREE.PlaneGeometry(.018, H * .58), mat('#ffffff', {transparent:true, opacity:.22, roughness:.08, depthWrite:false}));
      gl2.position.set(-r * .12, yc, .017); gl2.rotation.z = .48; g.add(gl2);
      break;
    }
    case 'wallclock': {
      // 挂钟：金属表壳 + 12 刻度 + 时针分针
      const r = Math.max(.16, Math.min(.3, w / 2)), yc = 1.42;
      const bm = mat(darker(c, .6), {metalness:.55, roughness:.35});
      const body = mesh(new THREE.CylinderGeometry(r, r, .045, 48), bm);
      body.rotation.x = Math.PI / 2; body.position.set(0, yc, 0); g.add(body);
      const face = mesh(new THREE.CircleGeometry(r - .018, 48), mat('#f8f3e7', {roughness:.9}));
      face.position.set(0, yc, .024); g.add(face);
      for (let i = 0; i < 12; i++){
        const a = i * Math.PI / 6;
        const tk = mesh(new THREE.CircleGeometry(i % 3 ? .006 : .009, 12), mat('#3a352e'));
        tk.position.set(Math.sin(a) * (r - .04), yc + Math.cos(a) * (r - .04), .026); g.add(tk);
      }
      const hand = (len, wd, ang) => {
        const h = mesh(new THREE.PlaneGeometry(wd, len), mat('#2b2b2b'));
        h.position.set(Math.sin(ang) * len / 2, yc + Math.cos(ang) * len / 2, .028);
        h.rotation.z = -ang; g.add(h);
      };
      hand(r * .62, .012, 1.9); hand(r * .82, .008, -1.05);
      g.add(blob(.012, .012, .008, bm, 0, yc, .03, 12));
      break;
    }
    case 'tapestry': {
      // 挂毯：褶皱布面 + 几何纹样 + 顶部木杆 + 底部流苏
      const H = Math.min(1.35, Math.max(.8, w * .8)), y0 = .95, n = 12, pw = w / n;
      for (let i = 0; i < n; i++){
        const ph = H - Math.abs(i - n / 2) * .006;
        g.add(box(pw + .002, ph, i % 2 ? .018 : .012,
          mat(i % 2 ? lighter(c, .14) : c, {roughness:.96}),
          -w / 2 + pw * (i + .5), y0, i % 2 ? .008 : -.006));
      }
      g.add(box(w * .3, H * .4, .004, mat(darker(c, .68), {roughness:.95}), -w * .18, y0 + H * .3, .018));
      g.add(box(w * .22, H * .26, .004, mat(lighter(c, .24), {roughness:.95}), w * .16, y0 + H * .46, .018));
      g.add(rod([-w / 2 - .06, y0 + H + .03, 0], [w / 2 + .06, y0 + H + .03, 0], .016, woodM('#6b5844')));
      const cord = mat(lighter(c, .1), {roughness:.96});
      for (let i = 0; i < 20; i++){
        const px = -w / 2 + w * (i + .5) / 20;
        g.add(rod([px, y0, .002], [px + (i % 2 ? .008 : -.008), y0 - .1, .008], .004, cord));
      }
      break;
    }
    case 'macrame': {
      // 编织壁挂：木杆 + V 形编绳 + 菱形结 + 流苏
      const H = Math.min(1.15, Math.max(.7, w * 1.05)), yT = 1.05 + H;
      const cord = mat(lighter(c, .12), {roughness:.96});
      g.add(rod([-w / 2 - .05, yT, 0], [w / 2 + .05, yT, 0], .016, woodM('#6b5844')));
      for (let i = 0; i < 7; i++){
        const px = -w / 2 + w * (i + .5) / 7;
        g.add(rod([px, yT, 0], [0, yT - H * .68, .012], .004, cord));
      }
      g.add(rod([-w * .22, yT - H * .34, .014], [0, yT - H * .58, .02], .005, cord));
      g.add(rod([ w * .22, yT - H * .34, .014], [0, yT - H * .58, .02], .005, cord));
      for (let i = 0; i < 11; i++){
        const px = -w * .28 + w * .56 * (i + .5) / 11;
        g.add(rod([px, yT - H * .6, .012], [px + (i % 2 ? .012 : -.012), yT - H * .9, .02], .004, cord));
      }
      break;
    }
    case 'wallshelf': {
      // 壁挂搁板：木板 + 三角支架 + 书 / 花器 / 小绿植
      const y0 = 1.12, wm = woodM(darker(c, .82));
      g.add(rbox(w, .035, d, wm, 0, y0, 0, .006));
      [-1, 1].forEach(s => {
        g.add(rod([s * (w / 2 - .08), y0 - .16, -d / 2 + .03], [s * (w / 2 - .08), y0, -d / 2 + .03], .011, blackMetal()));
        g.add(rod([s * (w / 2 - .08), y0 - .16, -d / 2 + .03], [s * (w / 2 - .08), y0 - .16, d / 2 - .03], .009, blackMetal()));
      });
      g.add(box(.15, .22, .028, mat('#b98f6e', {roughness:.9}), -w * .28, y0 + .035, .01));
      g.add(box(.14, .19, .028, mat('#9bad8e', {roughness:.9}), -w * .28 + .025, y0 + .035, .016));
      vase(g, w * .08, y0 + .035, 0, .042, .15, '#e8dcc8', R, false);
      g.add(blob(.05, .06, .05, mat('#7fa06a'), w * .3, y0 + .16, 0, 16));
      break;
    }
    case 'recordwall': {
      // 碟片墙：错落两排黑胶唱片贴墙挂起，微微歪斜更自然
      const lbl = ['#c8a86e', '#b96a4c', '#9bad8e', '#d5dde3', '#d9b56c'], r = .13;
      [[1.64, 4], [1.30, 5]].forEach(([y0, n], ri) => {
        const step = w / n;
        for (let i = 0; i < n; i++){
          const px = -w / 2 + step * (i + .5), dz = .012 + (i % 2) * .006, tilt = i % 2 ? .05 : -.04;
          const disc = mesh(new THREE.CircleGeometry(r, 40), mat('#161412', {roughness:.32, metalness:.12}));
          disc.position.set(px, y0, dz); disc.rotation.z = tilt; g.add(disc);
          const tag = mesh(new THREE.CircleGeometry(r * .36, 32), mat(lbl[(i + ri * 2) % lbl.length], {roughness:.7}));
          tag.position.set(px, y0, dz + .003); tag.rotation.z = tilt; g.add(tag);
          const hole = mesh(new THREE.CircleGeometry(.01, 12), mat('#0c0b0a'));
          hole.position.set(px, y0, dz + .005); hole.rotation.z = tilt; g.add(hole);
        }
      });
      break;
    }
    /* —— 落地 / 台面摆件 —— */
    case 'floorvase': {
      // 落地花瓶：石质底座 + 收腰瓶身 + 干花
      const r = Math.min(w, d) * .32;
      g.add(cyl(r * .92, r * 1.08, .022, mat('#8a7d6d', {roughness:.8}), 0, 0, 0, 32));
      vase(g, 0, .022, 0, r, 1.0, c, R, true);
      break;
    }
    case 'sculpture': {
      // 抽象雕塑：石质方座 + 两道交叠金属环
      const bw = Math.min(w, d) * .6;
      g.add(rbox(bw, .12, bw, mat('#e8e2d6', {roughness:.72}), 0, 0, 0, .01));
      const t1 = mesh(new THREE.TorusGeometry(.16, .045, 16, 64), mat(c, {metalness:.25, roughness:.42}));
      t1.position.set(0, .36, 0); t1.rotation.set(.3, .4, .2); g.add(t1);
      const t2 = mesh(new THREE.TorusGeometry(.12, .034, 16, 64), mat(lighter(c, .2), {metalness:.25, roughness:.42}));
      t2.position.set(0, .47, 0); t2.rotation.set(-.4, .2, .7); g.add(t2);
      break;
    }
    case 'candleholder': {
      // 烛台：圆盘底座 + 三支分叉烛臂 + 火苗
      const bm = mat(darker(c, .58), {metalness:.7, roughness:.3});
      g.add(cyl(.11, .13, .025, bm, 0, 0, 0, 32));
      g.add(cyl(.02, .032, .28, bm, 0, .025, 0, 24));
      for (let i = 0; i < 3; i++){
        const a = i * Math.PI * 2 / 3, px = Math.cos(a) * .085, pz = Math.sin(a) * .085;
        g.add(rod([0, .26, 0], [px, .34, pz], .009, bm));
        g.add(cyl(.018, .02, .028, bm, px, .34, pz, 16));
        g.add(cyl(.013, .013, .1, mat('#f7f0df', {roughness:.9}), px, .368, pz, 16));
        g.add(blob(.011, .022, .011, glowMat('#ffd88a', '#ffb347', .9), px, .485, pz, 12));
      }
      break;
    }
    case 'decotray': {
      // 装饰托盘：三脚小圆几 + 金属托盘 + 几件小摆设
      const r = Math.min(w, d) * .4, tm = mat(darker(c, .6), {roughness:.45, metalness:.3});
      for (let i = 0; i < 3; i++){
        const a = i * Math.PI * 2 / 3;
        g.add(rod([Math.cos(a) * r * .82, 0, Math.sin(a) * r * .82], [Math.cos(a) * r * .6, .44, Math.sin(a) * r * .6], .008, tm));
      }
      g.add(cyl(r * .9, r * .9, .018, mat(c, {roughness:.4, metalness:.3}), 0, .44, 0, 40));
      g.add(ring(r * .86, .011, tm, 0, .462, 0));
      g.add(blob(.035, .035, .035, mat('#9bad8e'), -r * .3, .48, 0, 16));
      g.add(blob(.03, .03, .03, mat('#c8a86e'), r * .25, .48, -r * .2, 16));
      g.add(cyl(.02, .022, .08, mat('#f7f0df'), r * .1, .458, r * .3, 20));
      break;
    }
    case 'gramophone': {
      // 留声机：胡桃木箱体 + 黄铜花瓣大喇叭 + 转盘黑胶 + 侧面摇柄
      const brass = mat('#c9a35a', {metalness:.8, roughness:.3, side:THREE.DoubleSide});
      const wm = woodM(darker(c, .8));
      g.add(rbox(w * .68, .24, d * .66, wm, 0, 0, 0, .014));                            // 箱体
      g.add(rbox(w * .7, .02, d * .68, mat('#2b2320', {roughness:.6}), 0, .24, 0, .005)); // 顶板
      g.add(cyl(.12, .12, .014, brass, 0, .26, -.02, 32));                              // 转盘
      g.add(cyl(.14, .14, .005, mat('#141210', {roughness:.4}), 0, .274, -.02, 40));    // 唱片
      for (let k = 1; k <= 3; k++) g.add(ring(.03 + .035 * k, .0035, mat('#2a2725'), 0, .281, -.02));
      g.add(cyl(.04, .04, .006, mat('#d9b56c', {roughness:.5}), 0, .279, -.02, 24));    // 唱片标签
      g.add(cyl(.006, .006, .034, brass, 0, .274, -.02, 12));                           // 中心轴
      // 喇叭弯管 + 花瓣喇叭口（口朝上并向前倾斜）
      g.add(rod([0, .26, -.02], [w * .22, .5, d * .18], .013, brass));
      const horn = lathe([[.05, 0], [.065, .07], [.095, .17], [.15, .3], [.21, .43], [.25, .52]],
        brass, w * .24, .5, d * .18, 40);
      horn.rotation.x = -.42; g.add(horn);
      // 侧面摇柄（水平轴 → 竖臂 → 曲柄 → 木球柄）
      g.add(rod([-w * .36, .06, d * .12], [-w * .46, .06, d * .12], .007, brass));
      g.add(rod([-w * .46, .06, d * .12], [-w * .46, .15, d * .12], .007, brass));
      g.add(rod([-w * .46, .15, d * .12], [-w * .46, .15, d * .12 + .09], .007, brass));
      g.add(blob(.022, .022, .022, woodM('#3a2c20'), -w * .46, .15, d * .12 + .11, 12));
      break;
    }
    default: g.add(box(w, .8, d, c));
  }
  g.position.set(wx(f.cx), 0, wz(f.cy));
  g.rotation.y = -f.rot * Math.PI/180;       // 平面顺时针旋转 → 绕 Y 轴负向
  g.userData.fid = f.id;
  // 悬挂类：把天花罩标为「贴顶固定件」、把 rod() 生成的长吊线标为「可伸缩件」，
  // 供 applyLampSettings 按安装高度实时调整（灯体降低 → 吊线自动补长，天花罩始终不动）。
  if (window.LAMP_HANG && window.LAMP_HANG.has(f.type)){
    const ceilY = V.H - .15;                 // 天花罩建在 V.H-.04~-.06；吊线中点明显低于此
    g.children.forEach(o => {
      const p = o.geometry && o.geometry.parameters;
      if (o.position.y > ceilY){
        o.userData.lampAnchor = true;
      } else if (o.geometry && o.geometry.type === 'CylinderGeometry' && p && p.height > .4){
        o.userData.lampCord = true;
        o.userData.lampCordLen = p.height;
      }
    });
  }
  applyLampSettings(f, g);                   // 应用安装高度 / 亮度 / 色温（非灯具无副作用）
  return g;
}