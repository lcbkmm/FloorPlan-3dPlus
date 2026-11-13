import * as THREE from 'three';
import {V} from './shared.js';

export function mat(color, o = {}){
  const key = color + JSON.stringify(o);
  if (!V.matCache.has(key)){
    const m = new THREE.MeshStandardMaterial({color, roughness:.7, ...o});
    // 金属 / 光滑表面挂环境反射，墙面等哑光材质不挂，避免整体变亮
    if (V.envTex && (m.metalness > 0 || m.roughness < .4)){ m.envMap = V.envTex; m.userData.env = m.metalness > .5 ? 1 : .5; m.envMapIntensity = m.userData.env*V.envK; }
    V.matCache.set(key, m);
  }
  return V.matCache.get(key);
}
export function rng(seed){ return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const rgbK = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v*k))); return `rgb(${f(n>>16&255)},${f(n>>8&255)},${f(n&255)})`; };
// 地面贴图按真实尺寸平铺（UV 单位 = 米）
export const TEX = {
  wood:{sx:1.8, sy:.36, base:'#d6b58a', rough:.62}, maple:{sx:1.8, sy:.32, base:'#e4cfa0', rough:.6},
  walnut:{sx:1.8, sy:.36, base:'#9a6f4b', rough:.58}, greywood:{sx:1.8, sy:.34, base:'#c2b8ad', rough:.64},
  herringbone:{sx:1.25, sy:1.25, base:'#d0b089', rough:.58}, bamboo:{sx:1.6, sy:.28, base:'#d7c286', rough:.56},
  tile800:{sx:.8, sy:.8, base:'#ebe6dd', grout:'#cfc6b7', rough:.38}, tile600:{sx:.6, sy:.6, base:'#dfe3e0', grout:'#bfc6c1', rough:.4},
  porcelain:{sx:.8, sy:.8, base:'#f0eeea', grout:'#d4d0c8', rough:.14, metal:.08, env:.55},
  antislip:{sx:.3, sy:.3, base:'#d3d8d4', grout:'#aab2ac', rough:.9},
  marble:{sx:1.2, sy:1.2, base:'#f2efe9', grout:'#d9d2c4', rough:.16, metal:.1, env:.65},
  travertine:{sx:1.0, sy:1.0, base:'#e8dcc8', grout:'#d2c4ae', rough:.42},
  slate:{sx:.9, sy:.6, base:'#8a8e93', grout:'#6d7176', rough:.72},
  hexatile:{sx:.6, sy:.52, base:'#d9ddd8', grout:'#b5bbb5', rough:.45},
  mosaic:{sx:.3, sy:.3, base:'#cfd6d2', grout:'#9aa3a0', rough:.5},
  terrazzo:{sx:.55, sy:.55, base:'#e6dfd3', rough:.42}, cement:{sx:2.4, sy:2.4, base:'#cfc9c0', rough:.78},
  carpet:{sx:.35, sy:.35, base:'#c6bfd2', rough:1},
  // —— 扩展材质：draw 指定复用哪套绘制逻辑，颜色 / 尺寸 / 粗糙度各自独立 ——
  chevron:{sx:.9, sy:.9, base:'#c8a273', rough:.6, draw:'chevron'},
  parquet:{sx:1.1, sy:1.1, base:'#d0ae82', rough:.6, draw:'parquet'},
  smoked:{sx:1.8, sy:.36, base:'#847161', rough:.6, draw:'wood'},
  cork:{sx:1.2, sy:.6, base:'#c9a67a', rough:.88, draw:'wood'},
  woodtile:{sx:3.6, sy:.6, base:'#af794c', rough:.52, draw:'wood'},
  granite:{sx:1.0, sy:1.0, base:'#bdbbb6', grout:'#8f8d89', rough:.32, metal:.05, env:.42, draw:'granite'},
  encaustic:{sx:.4, sy:.4, base:'#dfe6e4', grout:'#a9bcbe', rough:.5, draw:'decotile'},
  subway:{sx:.6, sy:.3, base:'#ebe8e0', grout:'#c9c4b9', rough:.42, draw:'decotile'},
  bluestone:{sx:.9, sy:.6, base:'#8d949a', grout:'#697077', rough:.74, draw:'slate'},
  gardentile:{sx:1.6, sy:1.6, base:'#edcfa0', grout:'#dcc28e', rough:.78, draw:'gardentile'},
  sisal:{sx:.4, sy:.4, base:'#c8bda2', rough:.95, draw:'weave'},
  tatami:{sx:1.0, sy:.5, base:'#c9c49a', rough:.92, draw:'weave'},
};
export function floorMat(kind){
  if (V.floorMats[kind]) return V.floorMats[kind];
  const s = TEX[kind] || TEX.tile800, R = rng(kind.length * 977 + (kind.charCodeAt(0) || 13) * 31);
  // draw = 绘制风格：新材质复用成熟分支，只换颜色 / 尺寸 / 粗糙度；kind 仍用于随机种子与专属细节
  const draw = s.draw || kind;
  const woodLike = ['wood','maple','walnut','greywood','bamboo','smoked','cork','woodtile'].includes(draw);
  const glossy = draw === 'marble' || draw === 'porcelain';
  // albedo / bump / roughness 三通道
  const cv = document.createElement('canvas'), bv = document.createElement('canvas'), rv = document.createElement('canvas');
  const big = woodLike || ['herringbone','chevron','parquet','granite','decotile','weave','gardentile'].includes(draw) || glossy || draw === 'travertine' || draw === 'slate';
  // 贴图分辨率整体提高一档，纹理更细腻（按需生成，只在实际用到的材质上开销）
  const W = cv.width = bv.width = rv.width = woodLike ? 2048 : (['herringbone','chevron','parquet','gardentile'].includes(draw) ? 1536 : 1024);
  const Hh = cv.height = bv.height = rv.height = woodLike ? 512 : (['herringbone','chevron','parquet','gardentile'].includes(draw) ? 1536 : 1024);
  const g = cv.getContext('2d', {willReadFrequently:false});
  const b = bv.getContext('2d'), rr = rv.getContext('2d');
  g.fillStyle = s.base; g.fillRect(0, 0, W, Hh);
  b.fillStyle = '#808080'; b.fillRect(0, 0, W, Hh);
  // 粗糙度图：白=更糙，黑=更滑；默认按材质基准灰阶
  const rBase = Math.round(40 + s.rough * 180);
  rr.fillStyle = `rgb(${rBase},${rBase},${rBase})`; rr.fillRect(0, 0, W, Hh);

  const grain = (x0, y0, x1, y1, base, density = 10) => {
    g.save(); rr.save(); b.save();
    const h = Math.max(4, y1 - y0);
    // 板面微孔隙噪点
    for (let k = 0; k < 180; k++){
      const px = x0 + R() * (x1 - x0), py = y0 + R() * h;
      g.fillStyle = `rgba(0,0,0,${.015 + R() * .03})`; g.fillRect(px, py, 1, 1 + R());
      b.fillStyle = `rgba(0,0,0,${.04 + R() * .06})`; b.fillRect(px, py, 1, 1);
    }
    // 多层木纹：粗纹 + 细纹 + 深色年轮线
    for (let k = 0; k < density; k++){
      const yy = y0 + 3 + R() * (h - 6);
      const amp = 1.2 + R() * 2.8, freq = .012 + R() * .02;
      g.strokeStyle = rgbK(base, .68 + R() * .3); g.globalAlpha = .16 + R() * .28; g.lineWidth = .6 + R() * 1.8;
      g.beginPath(); g.moveTo(x0, yy);
      for (let x = x0; x <= x1; x += 18) g.lineTo(x, yy + Math.sin(x * freq + k) * amp + Math.sin(x * freq * 2.3) * amp * .35);
      g.stroke();
      // bump / rough 跟随木纹
      b.strokeStyle = `rgba(0,0,0,${.1 + R() * .12})`; b.lineWidth = g.lineWidth; b.globalAlpha = 1;
      b.beginPath(); b.moveTo(x0, yy);
      for (let x = x0; x <= x1; x += 18) b.lineTo(x, yy + Math.sin(x * freq + k) * amp);
      b.stroke();
      rr.strokeStyle = `rgba(255,255,255,${.08 + R() * .12})`; rr.lineWidth = 1; rr.globalAlpha = 1;
      rr.beginPath(); rr.moveTo(x0, yy); for (let x = x0; x <= x1; x += 24) rr.lineTo(x, yy); rr.stroke();
    }
    for (let k = 0; k < density * 1.4; k++){
      const yy = y0 + 2 + R() * (h - 4);
      g.strokeStyle = rgbK(base, .78 + R() * .2); g.globalAlpha = .08 + R() * .12; g.lineWidth = .4;
      g.beginPath(); g.moveTo(x0, yy);
      for (let x = x0; x <= x1; x += 14) g.lineTo(x, yy + Math.sin(x * .04 + k * .7) * .8);
      g.stroke();
    }
    // 木节
    if (R() > .4){
      const kx = x0 + 24 + R() * Math.max(8, x1 - x0 - 48), ky = y0 + 6 + R() * Math.max(4, h - 12);
      const kr = 3 + R() * 6;
      g.globalAlpha = .35; g.fillStyle = rgbK(base, .5);
      g.beginPath(); g.ellipse(kx, ky, kr, kr * (.45 + R() * .35), R() * 2, 0, 7); g.fill();
      g.strokeStyle = rgbK(base, .4); g.lineWidth = 1; g.globalAlpha = .4;
      for (let ring = 1; ring <= 3; ring++){ g.beginPath(); g.ellipse(kx, ky, kr * ring * .45, kr * ring * .25, 0, 0, 7); g.stroke(); }
      b.fillStyle = 'rgba(0,0,0,.22)'; b.beginPath(); b.ellipse(kx, ky, kr, kr * .5, 0, 0, 7); b.fill();
      rr.fillStyle = 'rgba(255,255,255,.2)'; rr.beginPath(); rr.ellipse(kx, ky, kr, kr * .5, 0, 0, 7); rr.fill();
    }
    g.restore(); rr.restore(); b.restore();
  };
  const noise = (n = 3000, a = .04, tgt = g) => {
    for (let k = 0; k < n; k++){
      const aa = R() * a; tgt.fillStyle = R() > .5 ? `rgba(255,255,255,${aa})` : `rgba(0,0,0,${aa})`;
      tgt.fillRect(R() * W, R() * Hh, 1 + R() * 2, 1 + R() * 2);
    }
  };
  const bevelTile = (pad = 6) => {
    // 砖心光泽 / 砖缝暗槽
    const lg = g.createLinearGradient(pad, pad, W - pad, Hh - pad);
    lg.addColorStop(0, 'rgba(255,255,255,.07)'); lg.addColorStop(.35, 'rgba(255,255,255,.02)'); lg.addColorStop(1, 'rgba(0,0,0,.05)');
    g.fillStyle = lg; g.fillRect(pad, pad, W - pad * 2, Hh - pad * 2);
    const soft = g.createRadialGradient(W * .35, Hh * .3, 10, W * .5, Hh * .5, W * .55);
    soft.addColorStop(0, 'rgba(255,255,255,.06)'); soft.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = soft; g.fillRect(pad, pad, W - pad * 2, Hh - pad * 2);
    // 粗糙度：砖面更滑、近缝更糙
    const rg = rr.createRadialGradient(W / 2, Hh / 2, W * .1, W / 2, Hh / 2, W * .65);
    rg.addColorStop(0, 'rgba(0,0,0,.35)'); rg.addColorStop(1, 'rgba(255,255,255,.15)');
    rr.fillStyle = rg; rr.fillRect(pad, pad, W - pad * 2, Hh - pad * 2);
    b.fillStyle = 'rgba(255,255,255,.12)'; b.fillRect(pad, pad, W - pad * 2, 3); b.fillRect(pad, pad, 3, Hh - pad * 2);
    b.fillStyle = 'rgba(0,0,0,.18)'; b.fillRect(pad, Hh - pad - 3, W - pad * 2, 3); b.fillRect(W - pad - 3, pad, 3, Hh - pad * 2);
    // 砖面斜向高光带 + 细划痕：让釉面 / 石面有真实的反光层次
    const hl = g.createLinearGradient(pad, pad, W - pad, Hh - pad);
    hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(.28, 'rgba(255,255,255,.055)');
    hl.addColorStop(.34, 'rgba(255,255,255,0)'); hl.addColorStop(.72, 'rgba(255,255,255,.035)'); hl.addColorStop(.78, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.fillRect(pad, pad, W - pad * 2, Hh - pad * 2);
    for (let k = 0; k < 26; k++){
      const x0 = pad + R() * (W - 2 * pad), y0 = pad + R() * (Hh - 2 * pad);
      g.strokeStyle = `rgba(255,255,255,${.02 + R() * .045})`; g.lineWidth = .6;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 8 + R() * 40, y0 + 3 + R() * 12); g.stroke();
    }
  };

  if (woodLike){
    // 木纹砖 369 拼（三六九）：三行一循环，相邻行端缝依次错开 1/3 板长；
    // 贴图宽 = 3 × 板长，跨贴图边界的那块板左右两截共用同一色差，平铺后仍是完整长板。
    const is369 = kind === 'woodtile';   // TEX 里 draw='wood' 复用木纹绘制，铺法要用 kind 判断
    const rows = is369 || draw === 'bamboo' ? 3 : 2, rowH = Hh / rows;
    for (let r = 0; r < rows; r++){
      let segs;
      if (is369){
        const L = W / 3, off = r * L / 3;
        segs = [];
        for (let k = 0; k < 3; k++){
          const a = off + k * L, b = a + L, toneK = .94 + R() * .1;
          if (b <= W) segs.push([a, b, toneK, true]);
          else { segs.push([a, W, toneK, false]); segs.push([0, b - W, toneK, true]); }
        }
      } else {
        const cuts = []; let acc = 0;
        while (acc < W - 120){ acc += W * (.22 + R() * .38); if (acc < W - 60) cuts.push(acc); }
        segs = []; let x0 = 0;
        [...cuts, W].forEach(x1 => { segs.push([x0, x1, .86 + R() * .26, true]); x0 = x1; });
      }
      segs.forEach(([x0, x1, toneK, seam]) => {
        const tone = s.base;
        g.fillStyle = rgbK(tone, toneK); g.fillRect(x0, r * rowH, x1 - x0, rowH);
        // 板面横向明暗 + 涂装光泽带
        const lg = g.createLinearGradient(x0, r * rowH, x1, r * rowH);
        lg.addColorStop(0, `rgba(0,0,0,${.05 + R() * .05})`); lg.addColorStop(.45, 'rgba(255,255,255,.045)'); lg.addColorStop(1, `rgba(0,0,0,${.04 + R() * .05})`);
        g.fillStyle = lg; g.fillRect(x0, r * rowH, x1 - x0, rowH);
        const vg = g.createLinearGradient(0, r * rowH, 0, (r + 1) * rowH);
        vg.addColorStop(0, 'rgba(255,255,255,.03)'); vg.addColorStop(1, 'rgba(0,0,0,.04)');
        g.fillStyle = vg; g.fillRect(x0, r * rowH, x1 - x0, rowH);
        grain(x0 + 3, r * rowH + 2, x1 - 3, (r + 1) * rowH - 2, tone, draw === 'bamboo' ? 14 : 11);
        // 板缝倒角：只画在真正的板端，贴图边界是同一块板的中段，不切假缝
        if (seam){
          g.fillStyle = rgbK(tone, .48); g.fillRect(x1 - 2.5, r * rowH, 3.5, rowH);
          g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x0 + 1, r * rowH + 1, 2, rowH - 2);
          b.fillStyle = '#3a3a3a'; b.fillRect(x1 - 3, r * rowH, 4, rowH);
          b.fillStyle = '#b0b0b0'; b.fillRect(x0, r * rowH, 2, rowH);
          rr.fillStyle = 'rgba(255,255,255,.35)'; rr.fillRect(x1 - 4, r * rowH, 5, rowH);
        }
        // 板面中心略抛光
        rr.fillStyle = 'rgba(0,0,0,.18)'; rr.fillRect(x0 + 6, r * rowH + 4, Math.max(4, x1 - x0 - 12), rowH - 8);
        // 木材导管孔：细短竖线，近看才显现的天然孔隙
        for (let k = 0; k < 22; k++){
          const px = x0 + 8 + R() * Math.max(6, x1 - x0 - 16), py = r * rowH + 6 + R() * (rowH - 12);
          g.fillStyle = `rgba(0,0,0,${.04 + R() * .07})`; g.fillRect(px, py, 1 + R() * 3, .8);
          b.fillStyle = 'rgba(0,0,0,.09)'; b.fillRect(px, py, 2, 1);
        }
      });
      g.fillStyle = rgbK(s.base, .45); g.fillRect(0, r * rowH, W, 3);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, r * rowH + 3, W, 2);
      b.fillStyle = '#2e2e2e'; b.fillRect(0, r * rowH, W, 3.5);
      rr.fillStyle = 'rgba(255,255,255,.4)'; rr.fillRect(0, r * rowH, W, 4);
    }
    if (kind === 'cork'){
      // 软木：密集的栓皮颗粒，没有木纹
      for (let k = 0; k < 1100; k++){
        const px = R() * W, py = R() * Hh, rw = 2 + R() * 10, rh = 1 + R() * 4;
        g.fillStyle = R() > .5 ? 'rgba(105,76,44,.34)' : 'rgba(238,210,165,.34)';
        g.beginPath(); g.ellipse(px, py, rw, rh, 0, 0, 7); g.fill();
        b.fillStyle = 'rgba(0,0,0,.17)'; b.beginPath(); b.ellipse(px, py, rw, rh, 0, 0, 7); b.fill();
      }
    }
  } else if (draw === 'chevron' || draw === 'parquet'){
    const parq = draw === 'parquet';
    g.fillStyle = s.base; g.fillRect(0, 0, W, Hh);
    if (parq){
      const cell = W / 2;
      for (let gy = 0; gy < 2; gy++) for (let gx = 0; gx < 2; gx++){
        const ox = gx * cell, oy = gy * cell, flip = (gx + gy) & 1;
        g.fillStyle = rgbK(s.base, .78); g.fillRect(ox, oy, cell, cell);
        const n = 5, sw = cell / n;
        for (let i = 0; i < n; i++){
          [flip, !flip].forEach(H => {
            const x0 = H ? ox + 4 : ox + 4 + i * sw, y0 = H ? oy + 4 + i * sw : oy + 4;
            const ww = H ? cell - 8 : sw - 6, hh = H ? sw - 6 : cell - 8;
            const t = rgbK(s.base, .88 + R() * .26);
            g.fillStyle = t; g.fillRect(x0, y0, ww, hh);
            const lg = g.createLinearGradient(x0, y0, x0 + (H ? ww : 0), y0 + (H ? 0 : hh));
            lg.addColorStop(0, 'rgba(0,0,0,.09)'); lg.addColorStop(.5, 'rgba(255,255,255,.055)'); lg.addColorStop(1, 'rgba(0,0,0,.07)');
            g.fillStyle = lg; g.fillRect(x0, y0, ww, hh);
            grain(x0 + 2, y0 + 2, x0 + ww - 2, y0 + hh - 2, t, 4);
            g.strokeStyle = rgbK(s.base, .5); g.lineWidth = 1.8; g.strokeRect(x0, y0, ww, hh);
            b.fillStyle = '#454545'; b.fillRect(x0, y0 + hh - 2, ww, 2);
            rr.fillStyle = 'rgba(0,0,0,.2)'; rr.fillRect(x0 + 2, y0 + 2, ww - 4, hh - 4);
          });
        }
        g.strokeStyle = rgbK(s.base, .45); g.lineWidth = 5; g.strokeRect(ox, oy, cell, cell);
        b.fillStyle = '#303030'; b.fillRect(ox, oy, cell, 5); b.fillRect(ox, oy, 5, cell);
      }
    } else {
      const bw = W * .36, bh = Math.max(26, Hh * .075);
      for (let row = -2; row < Hh / (bh * .9) + 2; row++) for (let col = -1; col < W / (bw * .85) + 1; col++){
        const cx = col * bw * .85 + (row & 1 ? bw * .42 : 0), cy = row * bh * .9;
        [-1, 1].forEach(sg => {
          g.save(); b.save(); rr.save();
          g.translate(cx, cy); g.rotate(sg * .52);
          b.translate(cx, cy); b.rotate(sg * .52);
          rr.translate(cx, cy); rr.rotate(sg * .52);
          const t = rgbK(s.base, .86 + R() * .28);
          g.fillStyle = t; g.fillRect(0, -bh / 2, bw, bh);
          const lg = g.createLinearGradient(0, 0, bw, 0);
          lg.addColorStop(0, 'rgba(0,0,0,.08)'); lg.addColorStop(.5, 'rgba(255,255,255,.055)'); lg.addColorStop(1, 'rgba(0,0,0,.08)');
          g.fillStyle = lg; g.fillRect(0, -bh / 2, bw, bh);
          grain(2, -bh / 2 + 2, bw - 2, bh / 2 - 2, t, 5);
          g.strokeStyle = rgbK(s.base, .5); g.lineWidth = 1.8; g.strokeRect(0, -bh / 2, bw, bh);
          b.fillStyle = '#454545'; b.fillRect(0, bh / 2 - 2, bw, 2);
          rr.fillStyle = 'rgba(0,0,0,.2)'; rr.fillRect(2, -bh / 2 + 2, bw - 4, bh - 4);
          g.restore(); b.restore(); rr.restore();
        });
      }
    }
    noise(2600, .03); noise(900, .02, b);
  } else if (draw === 'weave'){
    const tatami = kind === 'tatami';
    for (let y = 0; y < Hh; y += 2) for (let x = 0; x < W; x += 2){
      g.fillStyle = rgbK(s.base, .84 + R() * .3); g.fillRect(x, y, 2, 2);
    }
    if (tatami){
      for (let y = 0; y < Hh; y += 5){
        g.strokeStyle = `rgba(0,0,0,${.06 + R() * .11})`; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.055)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, y + 2); g.lineTo(W, y + 2); g.stroke();
        b.fillStyle = 'rgba(0,0,0,.13)'; b.fillRect(0, y, W, 2);
      }
      for (let x = 0; x < W; x += 14){ g.strokeStyle = 'rgba(0,0,0,.05)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hh); g.stroke(); }
      const edge = Math.max(8, Hh * .055);
      g.fillStyle = '#3f4a3c'; g.fillRect(0, 0, W, edge); g.fillRect(0, Hh - edge, W, edge);
      g.fillRect(0, 0, edge, Hh); g.fillRect(W - edge, 0, edge, Hh);
      b.fillStyle = '#a8a8a8'; b.fillRect(0, 0, W, edge); b.fillRect(0, Hh - edge, W, edge);
    } else {
      const n = 14, sw = W / n, sh = Hh / n;
      for (let i = 0; i < n; i++){
        const x = i * sw, y = i * sh;
        g.fillStyle = rgbK(s.base, i % 2 ? .9 : 1.1); g.fillRect(x, 0, sw - 3, Hh);
        g.globalAlpha = .55; g.fillStyle = rgbK(s.base, i % 2 ? 1.1 : .9); g.fillRect(0, y, W, sh - 3); g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(x, 0, 2, Hh);
        g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + sw - 5, 0, 2, Hh);
        b.fillStyle = '#565656'; b.fillRect(x + sw - 4, 0, 3, Hh); b.fillRect(0, y + sh - 4, W, 3);
        rr.fillStyle = 'rgba(255,255,255,.14)'; rr.fillRect(x + 2, 2, sw - 8, Hh - 4);
      }
    }
    for (let k = 0; k < 2600; k++){
      const x = R() * W, y = R() * Hh;
      g.strokeStyle = R() > .5 ? `rgba(255,255,255,${.05 + R() * .1})` : `rgba(0,0,0,${.04 + R() * .08})`;
      g.lineWidth = .7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 4, y + 2 + R() * 4); g.stroke();
    }
  } else if (draw === 'herringbone'){
    // 经典 45° 人字拼：短边顶长边、板长宽比约 5:1；单板约 10×50 cm
    const pw = 128, pl = 640; // 宽×长，≈1:5（贴图像素）
    const colW = pl / Math.SQRT2;   // V 列距
    const rowH = pw * Math.SQRT2;   // 沿列推进（保证短边顶长边）
    g.fillStyle = rgbK(s.base, .74);
    g.fillRect(0, 0, W, Hh);
    b.fillStyle = '#3c3c3c'; b.fillRect(0, 0, W, Hh);
    const place = (cx, cy, deg, tint) => {
      const ang = deg * Math.PI / 180, gap = 2.2;
      g.save(); b.save(); rr.save();
      g.translate(cx, cy); g.rotate(ang);
      b.translate(cx, cy); b.rotate(ang);
      rr.translate(cx, cy); rr.rotate(ang);
      const x0 = -pl / 2, y0 = -pw / 2;
      g.fillStyle = rgbK(s.base, tint);
      g.fillRect(x0 + gap / 2, y0 + gap / 2, pl - gap, pw - gap);
      const lg = g.createLinearGradient(x0, 0, x0 + pl, 0);
      lg.addColorStop(0, 'rgba(0,0,0,.05)'); lg.addColorStop(.4, 'rgba(255,255,255,.07)'); lg.addColorStop(1, 'rgba(0,0,0,.04)');
      g.fillStyle = lg; g.fillRect(x0 + gap / 2, y0 + gap / 2, pl - gap, pw - gap);
      grain(x0 + 6, y0 + 4, x0 + pl - 6, y0 + pw - 4, s.base, 12);
      // 紧缝：浅描边，不做厚倒角
      g.globalAlpha = .32; g.strokeStyle = rgbK(s.base, .5); g.lineWidth = 1.6;
      g.strokeRect(x0 + gap / 2, y0 + gap / 2, pl - gap, pw - gap); g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,.11)'; g.fillRect(x0 + gap / 2, y0 + gap / 2, pl - gap, 2.2);
      g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(x0 + gap / 2, y0 + pw - gap / 2 - 2.2, pl - gap, 2.2);
      b.fillStyle = '#8a8a8a'; b.fillRect(x0 + gap / 2, y0 + gap / 2, pl - gap, pw - gap);
      b.fillStyle = '#2e2e2e'; b.fillRect(x0, y0 + pw - 3, pl, 3); b.fillRect(x0 + pl - 3, y0, 3, pw);
      rr.fillStyle = `rgba(0,0,0,${.1 + Math.max(0, tint - .88) * .4})`;
      rr.fillRect(x0 + 4, y0 + 3, pl - 8, pw - 6);
      g.restore(); b.restore(); rr.restore();
    };
    for (let col = -3; col < W / colW + 3; col++){
      for (let row = -3; row < Hh / rowH + 3; row++){
        const x = col * colW, y = row * rowH;
        const tA = .8 + ((col * 17 + row * 13) % 11) * .025 + R() * .04;
        const tB = .8 + ((col * 11 + row * 19) % 11) * .025 + R() * .04;
        // / 与 \ 组成竖向人字 V，短边在中缝顶住邻板长边
        place(x + colW * .25, y + rowH * .5, 45, tA);
        place(x + colW * .75, y + rowH * .5, -45, tB);
      }
    }
  } else if (glossy){
    noise(4200, .028); noise(1800, .02, b); noise(1200, .04, rr);
    for (let k = 0; k < 14; k++){
      const rg = g.createRadialGradient(R() * W, R() * Hh, 8, R() * W, R() * Hh, 70 + R() * 160);
      rg.addColorStop(0, `rgba(255,255,255,${.03 + R() * .07})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, Hh);
    }
    // 主纹 + 伴生细纹
    const veinN = draw === 'marble' ? 12 : 5;
    for (let k = 0; k < veinN; k++){
      const pts = []; let x = R() * W, y = -30; pts.push([x, y]);
      while (y < Hh + 40){ x += (R() - .5) * 100; y += 24 + R() * 48; pts.push([x, y]); }
      const col = draw === 'marble'
        ? `rgba(${130 + R() * 50},${125 + R() * 35},${118 + R() * 30},${.16 + R() * .32})`
        : `rgba(180,178,172,${.08 + R() * .12})`;
      const lw = .7 + R() * (draw === 'marble' ? 4 : 1.5);
      [g, b, rr].forEach((ctx, ci) => {
        ctx.strokeStyle = ci === 0 ? col : (ci === 1 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.12)');
        ctx.lineWidth = ci === 0 ? lw : lw * .7; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++){
          const [px, py] = pts[i - 1], [qx, qy] = pts[i];
          ctx.quadraticCurveTo((px + qx) * .5, (py + qy) * .5, qx, qy);
        }
        ctx.stroke();
      });
      // 伴生细脉
      if (draw === 'marble' && R() > .45){
        g.strokeStyle = `rgba(160,155,145,${.08 + R() * .12})`; g.lineWidth = .5;
        g.beginPath(); g.moveTo(pts[0][0] + 8, pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + 6 + R() * 8, pts[i][1]);
        g.stroke();
      }
    }
    bevelTile(8);
    // 抛光：整体压低粗糙度
    rr.fillStyle = 'rgba(0,0,0,.28)'; rr.fillRect(8, 8, W - 16, Hh - 16);
  } else if (draw === 'granite'){
    noise(3600, .03); noise(1400, .03, b); noise(1000, .035, rr);
    const cs = ['#6f6d6a','#e9e7e2','#9a9894','#d2d0cb','#55585a','#f2f0ec'];
    for (let k = 0; k < 1600; k++){
      const x = R() * W, y = R() * Hh, rad = .8 + R() * 4.4;
      g.fillStyle = cs[(R() * cs.length) | 0]; g.globalAlpha = .25 + R() * .5;
      g.beginPath();
      if (R() > .6){ g.moveTo(x, y); for (let i = 0; i < 5; i++) g.lineTo(x + Math.cos(i * 1.3) * rad, y + Math.sin(i * 1.6) * rad); g.closePath(); }
      else g.arc(x, y, rad, 0, 7);
      g.fill();
      b.fillStyle = 'rgba(0,0,0,.1)'; b.beginPath(); b.arc(x, y, rad * .8, 0, 7); b.fill();
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 20; k++){
      const rgx = g.createRadialGradient(R() * W, R() * Hh, 6, R() * W, R() * Hh, 60 + R() * 160);
      rgx.addColorStop(0, `rgba(255,255,255,${.02 + R() * .05})`); rgx.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rgx; g.fillRect(0, 0, W, Hh);
    }
    bevelTile(6);
    rr.fillStyle = 'rgba(0,0,0,.14)'; rr.fillRect(6, 6, W - 12, Hh - 12);
  } else if (draw === 'decotile'){
    const enc = kind === 'encaustic';
    g.fillStyle = s.grout; g.fillRect(0, 0, W, Hh);
    b.fillStyle = '#3c3c3c'; b.fillRect(0, 0, W, Hh);
    const brick = (x, y, w, h) => {
      const t = rgbK(s.base, .94 + R() * .12);
      g.fillStyle = t; g.fillRect(x + 5, y + 5, w - 10, h - 10);
      const lg = g.createLinearGradient(x + 5, y + 5, x + w - 5, y + h - 5);
      lg.addColorStop(0, 'rgba(255,255,255,.09)'); lg.addColorStop(.55, 'rgba(255,255,255,.01)'); lg.addColorStop(1, 'rgba(0,0,0,.09)');
      g.fillStyle = lg; g.fillRect(x + 5, y + 5, w - 10, h - 10);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x + 5, y + 5, w - 10, 3); g.fillRect(x + 5, y + 5, 3, h - 10);
      g.fillStyle = 'rgba(0,0,0,.17)'; g.fillRect(x + 5, y + h - 8, w - 10, 3); g.fillRect(x + w - 8, y + 5, 3, h - 10);
      b.fillStyle = '#a8a8a8'; b.fillRect(x + 5, y + 5, w - 10, h - 10);
      b.fillStyle = '#d0d0d0'; b.fillRect(x + 5, y + 5, w - 10, 3);
      rr.fillStyle = 'rgba(0,0,0,.18)'; rr.fillRect(x + 8, y + 8, w - 16, h - 16);
      if (enc){
        const cx = x + w / 2, cy = y + h / 2, q = Math.min(w, h) * .28;
        g.strokeStyle = '#5b7f88'; g.lineWidth = Math.max(3, w * .018); g.globalAlpha = .65;
        g.beginPath(); g.moveTo(cx, cy - q); g.quadraticCurveTo(cx + q, cy, cx, cy + q); g.quadraticCurveTo(cx - q, cy, cx, cy - q); g.stroke();
        g.beginPath(); g.moveTo(cx - q, cy); g.quadraticCurveTo(cx, cy - q, cx + q, cy); g.quadraticCurveTo(cx, cy + q, cx - q, cy); g.stroke();
        g.fillStyle = '#5b7f88'; g.globalAlpha = .5; g.beginPath(); g.arc(cx, cy, q * .26, 0, 7); g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = 'rgba(90,127,136,.4)'; g.lineWidth = 2; g.strokeRect(x + 14, y + 14, w - 28, h - 28);
      }
    };
    if (enc) brick(0, 0, W, Hh);
    else {
      const bw = W / 2, bh = Hh / 2;
      brick(0, 0, bw, bh); brick(bw, 0, bw, bh);
      brick(-bw / 2, bh, bw, bh); brick(bw / 2, bh, bw, bh); brick(bw * 1.5, bh, bw, bh);
    }
    noise(1800, .025); noise(700, .02, b);
  } else if (draw === 'travertine'){
    noise(2600, .035); noise(900, .03, b);
    for (let k = 0; k < 110; k++){
      const x = R() * W, y = R() * Hh, rw = 6 + R() * 48, rh = 1.5 + R() * 6;
      g.globalAlpha = .3 + R() * .4; g.fillStyle = rgbK(s.base, .74 + R() * .24);
      g.beginPath(); g.ellipse(x, y, rw, rh, (R() - .5) * .5, 0, 7); g.fill();
      b.fillStyle = 'rgba(0,0,0,.18)'; b.beginPath(); b.ellipse(x, y, rw, rh, 0, 0, 7); b.fill();
      rr.fillStyle = 'rgba(255,255,255,.15)'; rr.beginPath(); rr.ellipse(x, y, rw, rh, 0, 0, 7); rr.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = rgbK(s.base, .68); g.globalAlpha = .22; g.lineWidth = 1.2;
    for (let y = 6; y < Hh; y += 8 + R() * 12){
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x < W; x += 28) g.lineTo(x, y + Math.sin(x * .025 + y) * 2.2);
      g.stroke();
      b.strokeStyle = 'rgba(0,0,0,.1)'; b.lineWidth = 1; b.beginPath(); b.moveTo(0, y); for (let x = 0; x < W; x += 28) b.lineTo(x, y); b.stroke();
    }
    g.globalAlpha = 1; bevelTile(7);
  } else if (draw === 'slate'){
    noise(3600, .055); noise(1400, .05, b);
    for (let k = 0; k < 24; k++){
      const x0 = R() * W, y0 = R() * Hh;
      g.fillStyle = rgbK(s.base, .7 + R() * .4); g.globalAlpha = .18 + R() * .3;
      g.beginPath(); g.moveTo(x0, y0);
      for (let i = 0; i < 6; i++) g.lineTo(x0 + (R() - .5) * 180, y0 + (R() - .5) * 120);
      g.closePath(); g.fill();
      b.fillStyle = 'rgba(0,0,0,.12)'; b.beginPath(); b.moveTo(x0, y0);
      for (let i = 0; i < 5; i++) b.lineTo(x0 + (R() - .5) * 140, y0 + (R() - .5) * 90);
      b.closePath(); b.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1;
    for (let k = 0; k < 18; k++){ g.beginPath(); g.moveTo(R() * W, R() * Hh); g.lineTo(R() * W, R() * Hh); g.stroke(); }
    bevelTile(6);
  } else if (draw === 'terrazzo'){
    noise(1400, .025);
    const cs = ['#b9a58c','#8fa3a0','#c9b7a2','#a88f76','#7e8a86','#d2c4b0','#9aa8a4','#c4b09a','#e8e0d4','#6f7a76'];
    for (let k = 0; k < 420; k++){
      const rad = 1.2 + R() * 10, x = R() * W, y = R() * Hh;
      g.fillStyle = cs[(k + (R() * 8 | 0)) % cs.length]; g.globalAlpha = .7 + R() * .3;
      g.beginPath();
      if (R() > .5){ g.moveTo(x, y); for (let i = 0; i < 5; i++) g.lineTo(x + Math.cos(i * 1.4) * rad, y + Math.sin(i * 1.7) * rad); g.closePath(); }
      else g.arc(x, y, rad, 0, 7);
      g.fill();
      // 骨料微高光
      if (rad > 4 && R() > .6){ g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(x - rad * .25, y - rad * .25, rad * .25, 0, 7); g.fill(); }
      b.fillStyle = 'rgba(0,0,0,.1)'; b.beginPath(); b.arc(x, y, rad * .8, 0, 7); b.fill();
    }
    g.globalAlpha = 1;
    // 打磨面：略抛光
    rr.fillStyle = 'rgba(0,0,0,.15)'; rr.fillRect(0, 0, W, Hh);
    noise(800, .03, rr);
  } else if (draw === 'cement'){
    noise(7000, .05); noise(2500, .045, b); noise(2000, .06, rr);
    for (let k = 0; k < 22; k++){
      const rg = g.createRadialGradient(R() * W, R() * Hh, 4, R() * W, R() * Hh, 50 + R() * 180);
      rg.addColorStop(0, `rgba(${R() > .5 ? '0,0,0' : '255,255,255'},${.025 + R() * .05})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, Hh);
    }
    g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = .8;
    for (let k = 0; k < 12; k++){ g.beginPath(); g.moveTo(R() * W, R() * Hh); for (let i = 0; i < 5; i++) g.lineTo(R() * W, R() * Hh); g.stroke(); }
  } else if (draw === 'carpet'){
    // 绒感：交错纤丝 + 明暗簇
    for (let y = 0; y < Hh; y += 2){
      for (let x = 0; x < W; x += 2){
        const n = .82 + R() * .28 + ((x + y) % 7 === 0 ? .06 : 0);
        g.fillStyle = rgbK(s.base, n); g.fillRect(x, y, 2, 2);
      }
    }
    for (let k = 0; k < 2800; k++){
      const x = R() * W, y = R() * Hh;
      g.strokeStyle = R() > .5 ? `rgba(255,255,255,${.04 + R() * .08})` : `rgba(0,0,0,${.03 + R() * .06})`;
      g.lineWidth = .6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 3, y + 2 + R() * 3); g.stroke();
    }
    for (let y = 0; y < Hh; y += 3){ b.fillStyle = y % 6 ? '#6a6a6a' : '#8a8a8a'; b.fillRect(0, y, W, 1.5); }
    rr.fillStyle = '#f0f0f0'; rr.fillRect(0, 0, W, Hh);
  } else if (draw === 'hexatile'){
    const rad = 52, h = rad * Math.sqrt(3);
    g.fillStyle = s.grout || '#b5bbb5'; g.fillRect(0, 0, W, Hh);
    b.fillStyle = '#404040'; b.fillRect(0, 0, W, Hh);
    for (let row = -1; row < Hh / h + 1; row++){
      for (let col = -1; col < W / (rad * 1.5) + 1; col++){
        const cx = col * rad * 1.5, cy = row * h + (col & 1 ? h / 2 : 0);
        g.fillStyle = rgbK(s.base, .88 + R() * .2); g.beginPath();
        for (let i = 0; i < 6; i++){ const a = Math.PI / 3 * i + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * (rad - 2), cy + Math.sin(a) * (rad - 2)); }
        g.closePath(); g.fill();
        const soft = g.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, rad);
        soft.addColorStop(0, 'rgba(255,255,255,.08)'); soft.addColorStop(1, 'rgba(0,0,0,.04)');
        g.fillStyle = soft; g.beginPath();
        for (let i = 0; i < 6; i++){ const a = Math.PI / 3 * i + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * (rad - 3), cy + Math.sin(a) * (rad - 3)); }
        g.closePath(); g.fill();
        for (let k = 0; k < 10; k++){ g.fillStyle = `rgba(0,0,0,${.015 + R() * .025})`; g.fillRect(cx + (R() - .5) * rad, cy + (R() - .5) * rad, 1.5, 1.5); }
        b.fillStyle = '#9a9a9a'; b.beginPath();
        for (let i = 0; i < 6; i++){ const a = Math.PI / 3 * i + Math.PI / 6; b[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * (rad - 3), cy + Math.sin(a) * (rad - 3)); }
        b.closePath(); b.fill();
        rr.fillStyle = 'rgba(0,0,0,.2)'; rr.beginPath();
        for (let i = 0; i < 6; i++){ const a = Math.PI / 3 * i + Math.PI / 6; rr[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * (rad - 6), cy + Math.sin(a) * (rad - 6)); }
        rr.closePath(); rr.fill();
      }
    }
  } else if (draw === 'mosaic'){
    const cell = 32;
    g.fillStyle = s.grout || '#9aa3a0'; g.fillRect(0, 0, W, Hh);
    b.fillStyle = '#454545'; b.fillRect(0, 0, W, Hh);
    for (let y = 0; y < Hh; y += cell){
      for (let x = 0; x < W; x += cell){
        const jx = x + 2 + (R() - .5), jy = y + 2 + (R() - .5), cw = cell - 5, ch = cell - 5;
        g.fillStyle = rgbK(s.base, .82 + R() * .32); g.fillRect(jx, jy, cw, ch);
        if (R() > .55){ g.fillStyle = `rgba(255,255,255,${.08 + R() * .12})`; g.fillRect(jx + 2, jy + 2, cw * .4, ch * .22); }
        b.fillStyle = '#a0a0a0'; b.fillRect(jx, jy, cw, ch);
        rr.fillStyle = R() > .5 ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.08)'; rr.fillRect(jx, jy, cw, ch);
      }
    }
  } else if (draw === 'gardentile'){
    /* 花园瓷砖：法式多尺寸拼铺 · 偏黄米色石灰石哑光防滑感 */
    const grout = s.grout || '#dcc28e';
    const gw = Math.max(3, Math.round(W * .005));
    g.fillStyle = grout; g.fillRect(0, 0, W, Hh);
    b.fillStyle = '#4a4a4a'; b.fillRect(0, 0, W, Hh);
    rr.fillStyle = `rgb(${rBase},${rBase},${rBase})`; rr.fillRect(0, 0, W, Hh);
    // 4×4 单元模块可无缝平铺：大方砖 + 中矩形 + 小方砖
    const tiles = [
      [0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 1],
      [2, 1, 2, 1],
      [0, 2, 1, 1], [1, 2, 1, 2], [2, 2, 2, 2],
      [0, 3, 2, 1],
    ];
    const paintPavers = (ox, oy, mod) => {
      const u = mod / 4;
      tiles.forEach(([tx, ty, tw, th]) => {
        const x = ox + tx * u, y = oy + ty * u, pw = tw * u, ph = th * u;
        const ix = x + gw, iy = y + gw, iw = Math.max(2, pw - gw * 2), ih = Math.max(2, ph - gw * 2);
        const tone = .86 + R() * .2;
        g.fillStyle = rgbK(s.base, tone);
        g.fillRect(ix, iy, iw, ih);
        // 云絮色差（天然石灰石感）
        for (let k = 0; k < 5; k++){
          const cx = ix + R() * iw, cy = iy + R() * ih, rad = Math.min(iw, ih) * (.18 + R() * .4);
          const rgx = g.createRadialGradient(cx, cy, 1, cx, cy, rad);
          const dark = R() > .45;
          rgx.addColorStop(0, dark
            ? `rgba(150,120,70,${.05 + R() * .08})`
            : `rgba(255,246,220,${.05 + R() * .09})`);
          rgx.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = rgx; g.fillRect(ix, iy, iw, ih);
        }
        // 哑光细颗粒 + 微划痕
        for (let k = 0; k < 28; k++){
          g.fillStyle = `rgba(0,0,0,${.02 + R() * .04})`;
          g.fillRect(ix + R() * iw, iy + R() * ih, 1 + R() * 2, 1 + R() * 2);
        }
        for (let k = 0; k < 4; k++){
          g.strokeStyle = `rgba(255,248,220,${.02 + R() * .03})`; g.lineWidth = .7;
          const x0 = ix + R() * iw, y0 = iy + R() * ih;
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 10 + R() * 40, y0 + (R() - .5) * 8); g.stroke();
        }
        // 砖面微倒角
        g.fillStyle = 'rgba(255,248,220,.12)'; g.fillRect(ix, iy, iw, 2); g.fillRect(ix, iy, 2, ih);
        g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(ix, iy + ih - 2, iw, 2); g.fillRect(ix + iw - 2, iy, 2, ih);
        b.fillStyle = '#9a9a9a'; b.fillRect(ix, iy, iw, ih);
        b.fillStyle = 'rgba(255,255,255,.18)'; b.fillRect(ix, iy, iw, 2); b.fillRect(ix, iy, 2, ih);
        b.fillStyle = 'rgba(0,0,0,.22)'; b.fillRect(ix, iy + ih - 2, iw, 2); b.fillRect(ix + iw - 2, iy, 2, ih);
        rr.fillStyle = 'rgba(255,255,255,.12)'; rr.fillRect(ix, iy, iw, ih);
        rr.fillStyle = 'rgba(255,255,255,.35)'; rr.fillRect(x, y, pw, gw); rr.fillRect(x, y, gw, ph);
      });
    };
    // 贴图像素刚好覆盖 1×1 模块；sx=1.6m → 模块约 1.6m
    paintPavers(0, 0, W);
  } else {
    // 瓷砖 / 防滑
    noise(draw === 'antislip' ? 5500 : 2800, draw === 'antislip' ? .065 : .032);
    noise(draw === 'antislip' ? 2000 : 900, .04, b);
    bevelTile(7);
    // 砖面云纹 / 结晶层次：避免大面积纯色显得塑料，近看有细微明暗起伏
    for (let k = 0; k < 8; k++){
      const cx = R() * W, cy = R() * Hh, rad = W * (.16 + R() * .34);
      const rgx = g.createRadialGradient(cx, cy, 4, cx, cy, rad);
      rgx.addColorStop(0, `rgba(${R() > .5 ? '255,255,255' : '110,106,98'},${.02 + R() * .035})`);
      rgx.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rgx; g.fillRect(0, 0, W, Hh);
    }
    for (let k = 0; k < 30; k++){
      const x0 = R() * W, y0 = R() * Hh;
      g.strokeStyle = `rgba(255,255,255,${.015 + R() * .035})`; g.lineWidth = .8;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 30 + R() * 130, y0 + (R() - .5) * 22); g.stroke();
    }
    rr.fillStyle = 'rgba(0,0,0,.05)'; rr.fillRect(0, 0, W, Hh);
    if (draw === 'antislip'){
      for (let k = 0; k < 1400; k++){
        const x = R() * W, y = R() * Hh, rad = .5 + R() * 1.6;
        g.fillStyle = `rgba(0,0,0,${.04 + R() * .06})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
        b.fillStyle = 'rgba(0,0,0,.2)'; b.beginPath(); b.arc(x, y, rad, 0, 7); b.fill();
        rr.fillStyle = 'rgba(255,255,255,.2)'; rr.fillRect(x, y, 1, 1);
      }
    } else {
      // 微结晶反光点
      for (let k = 0; k < 80; k++){
        g.fillStyle = `rgba(255,255,255,${.04 + R() * .08})`; g.beginPath(); g.arc(R() * W, R() * Hh, .8 + R() * 2, 0, 7); g.fill();
      }
    }
  }
  // 通用质感层：大尺度明暗不均（模拟自然色差 / 光照）+ albedo / bump / roughness 三通道细颗粒
  for (let k = 0; k < 12; k++){
    const cx = R() * W, cy = R() * Hh, rad = W * (.12 + R() * .3);
    const rgx = g.createRadialGradient(cx, cy, 4, cx, cy, rad);
    rgx.addColorStop(0, `rgba(${R() > .5 ? '0,0,0' : '255,255,255'},${.012 + R() * .022})`);
    rgx.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rgx; g.fillRect(0, 0, W, Hh);
  }
  noise(2600, .022); noise(900, .018, b); noise(700, .02, rr);
  if (s.grout && !['hexatile','mosaic','herringbone','chevron','parquet','weave','granite','decotile','gardentile'].includes(draw)){
    const gw = glossy ? 5 : 6;
    g.fillStyle = s.grout; g.fillRect(0, 0, W, gw); g.fillRect(0, 0, gw, Hh);
    // 缝底阴影 + 邻砖倒角亮边
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, W, 2); g.fillRect(0, 0, 2, Hh);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(gw, gw, W - gw, 2); g.fillRect(gw, gw, 2, Hh - gw);
    b.fillStyle = '#2a2a2a'; b.fillRect(0, 0, W, gw); b.fillRect(0, 0, gw, Hh);
    b.fillStyle = '#c8c8c8'; b.fillRect(gw, gw, W - gw, 2); b.fillRect(gw, gw, 2, Hh - gw);
    rr.fillStyle = 'rgba(255,255,255,.55)'; rr.fillRect(0, 0, W, gw + 1); rr.fillRect(0, 0, gw + 1, Hh);
  }

  let aniso = 1;
  try { if (V.renderer?.capabilities) aniso = V.renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
  const wrap = (tex, colorSpace) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / s.sx, 1 / s.sy);
    tex.anisotropy = aniso;
    if (colorSpace) tex.colorSpace = colorSpace;
    tex.needsUpdate = true;
    return tex;
  };
  const map = wrap(new THREE.CanvasTexture(cv), THREE.SRGBColorSpace);
  const bump = wrap(new THREE.CanvasTexture(bv));
  const roughMap = wrap(new THREE.CanvasTexture(rv));
  const bumpScale = woodLike || ['herringbone','chevron','parquet'].includes(draw) ? .032
    : ['carpet','weave'].includes(draw) ? .05
    : ['slate','travertine','antislip','granite','gardentile'].includes(draw) ? .028
    : draw === 'cement' ? .02
    : glossy ? .01 : .016;
  const m = new THREE.MeshStandardMaterial({
    map, bumpMap: bump, bumpScale,
    roughnessMap: roughMap, roughness: s.rough,
    metalness: s.metal || 0,
    envMapIntensity: s.env || 0,
  });
  if (V.envTex && (s.env || glossy || (s.metal || 0) > 0 || s.rough < .42 || ['granite','decotile','bluestone'].includes(draw))){
    m.envMap = V.envTex; m.userData.env = s.env || .4; m.envMapIntensity = m.userData.env * V.envK;
  }
  return V.floorMats[kind] = m;
}

/* ======================= 墙面 / 墙纸材质 =======================
 * 贴图统一按 1m × 1m 绘制，UV 由墙盒几何按真实尺寸缩放（见 scaleWallUV），
 * 因此不同长度的墙不会出现图案拉伸，且 18 种墙纸共享材质实例。
 * ============================================================== */
export function wallpaperMat(key){
  const k = (typeof WALLPAPERS !== 'undefined' && WALLPAPERS[key]) ? key : 'plain';
  if (V.wallMats[k]) return V.wallMats[k];
  const spec = WALLPAPERS[k];
  const S = 512;
  const cv = document.createElement('canvas'), bv = document.createElement('canvas'), rv = document.createElement('canvas');
  cv.width = bv.width = rv.width = S; cv.height = bv.height = rv.height = S;
  paintWallpaper(k, cv.getContext('2d'), bv.getContext('2d'), rv.getContext('2d'), S, S);
  let aniso = 1;
  try { if (V.renderer && V.renderer.capabilities) aniso = V.renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
  const wrap = (c, cs) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    if (cs) t.colorSpace = cs;
    t.needsUpdate = true;
    return t;
  };
  const m = new THREE.MeshStandardMaterial({
    map: wrap(cv, THREE.SRGBColorSpace),
    bumpMap: wrap(bv), bumpScale: spec.bump,
    roughnessMap: wrap(rv), roughness: spec.rough,
    metalness: 0,
  });
  return V.wallMats[k] = m;
}
