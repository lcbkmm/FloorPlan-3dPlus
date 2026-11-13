/* ======================= 颜色 / 材质图案 ======================= */
function hex2rgb(h){ h = h.replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join(''); const n = parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function shade(h,k){ const f = v => Math.max(0,Math.min(255,Math.round(k>1 ? v+(255-v)*(k-1)*2 : v*k))); return '#'+hex2rgb(h).map(v=>f(v).toString(16).padStart(2,'0')).join(''); }

function buildDefs(){
  // 确定性伪随机：图案每次渲染完全一致，不会随刷新跳动
  const rnd = seed => { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
  const grads = [];
  // 共享渐变（objectBoundingBox，按各自图形缩放）：四边明暗对称，平铺不出现接缝
  const grad = (id, stops, vertical) => {
    grads.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">`
      + stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a == null ? '' : ` stop-opacity="${a}"`}/>`).join('') + '</linearGradient>');
    return `url(#${id})`;
  };
  const gSheen = grad('fp-sheen',   [[0,'#000',.10],[.14,'#000',.02],[.5,'#fff',.06],[.86,'#000',.02],[1,'#000',.10]], false);
  const gV     = grad('fp-v',       [[0,'#fff',.09],[.42,'#fff',0],[1,'#000',.11]], true);
  const gTile  = grad('fp-tile',    [[0,'#000',.07],[.18,'#fff',.06],[.62,'#fff',.015],[1,'#000',.08]], false);
  const gTileV = grad('fp-tile-v',  [[0,'#fff',.10],[.36,'#fff',0],[1,'#000',.10]], true);
  const N = n => (Math.round(n * 10) / 10).toString();
  const bx = (x, y, w, h, f, ex = '') => `<rect x="${N(x)}" y="${N(y)}" width="${N(Math.max(0, w))}" height="${N(Math.max(0, h))}" fill="${f}"${ex ? ' ' + ex : ''}/>`;
  const P = (id, w, h, body) => `<pattern id="m-${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}">${body}</pattern>`;
  // 表面颗粒：细小明暗短线，模拟微粗糙度；ox/oy 用于把颗粒限制在砖面内部
  const grain = (w, h, seed, count = 60, op = .05, ox = 0, oy = 0) => {
    const r = rnd(seed); let s = '';
    for (let i = 0; i < count; i++){
      const x = (ox + r() * w).toFixed(0), y = (oy + r() * h).toFixed(0);
      const len = (.8 + r() * 2.6).toFixed(1), a = (op * (.4 + r() * .6)).toFixed(3);
      s += `<path d="M${x} ${y}h${len}" stroke="${r() > .5 ? '#000' : '#fff'}" stroke-width="${(.6 + r() * .9).toFixed(1)}" opacity="${a}"/>`;
    }
    return s;
  };

  /* 木板 / 竹板：板面色差 + 多层木纹 + 端缝与行缝倒角 + 木节 + 颗粒 */
  const plank = (id, base, line, o = {}) => {
    const W = 1800, h = o.h || 360, rows = o.rows || 2, rowH = h / rows, r = rnd(o.seed || 7);
    const grains = o.grains == null ? 9 : o.grains, fine = o.fine == null ? 3 : o.fine;
    let body = bx(0, 0, W, h, base) + bx(0, 0, W, h, gSheen);
    for (let row = 0; row < rows; row++){
      const y = row * rowH, cuts = [];
      let acc = row % 2 ? 300 : 640;
      while (acc < W - 180){ cuts.push(acc); acc += 420 + r() * 560; }
      cuts.push(W);
      let x0 = 0;
      cuts.forEach(x1 => {
        const tone = shade(base, .89 + r() * .22);
        body += bx(x0, y, x1 - x0, rowH, tone) + bx(x0, y, x1 - x0, rowH, gV);
        for (let k = 0; k < grains; k++){
          const yy = y + rowH * (.08 + k * .102 + r() * .02), amp = 2 + r() * 8;
          body += `<path d="M${N(x0)} ${N(yy)} Q ${N((x0 + x1) / 2)} ${N(yy - amp)} ${N(x1)} ${N(yy + amp * .3)}" stroke="${shade(line, .78 + r() * .42)}" stroke-width="${(.8 + r() * 1.7).toFixed(1)}" fill="none" opacity="${(.05 + r() * .16).toFixed(2)}"/>`;
        }
        for (let k = 0; k < fine; k++)
          body += `<path d="M${N(x0)} ${N(y + rowH * (.12 + r() * .76))}H${N(x1)}" stroke="${shade(line, .95)}" stroke-width=".7" opacity="${(.05 + r() * .07).toFixed(2)}"/>`;
        body += bx(x1 - 3, y, 3, rowH, shade(line, .6), 'opacity=".9"') + bx(x1 - 6, y, 2, rowH, '#fff', 'opacity=".12"');
        if (grains && r() > .58){
          const kx = x0 + 40 + r() * Math.max(20, x1 - x0 - 80), ky = y + rowH * (.25 + r() * .5);
          body += `<ellipse cx="${N(kx)}" cy="${N(ky)}" rx="${(4 + r() * 5).toFixed(1)}" ry="${(2 + r() * 2).toFixed(1)}" fill="${shade(line, .52)}" opacity=".32"/>`;
        }
        x0 = x1;
      });
      body += bx(0, y, W, 3, shade(line, .52), 'opacity=".9"') + bx(0, y + 3, W, 2, '#fff', 'opacity=".13"');
    }
    if (o.decor) body += o.decor({r, W, h, base, line});
    body += grain(W, h, (o.seed || 7) + 91, o.grainN || 80, o.grainOp || .055);
    return P(id, W, h, body);
  };

  /* 369 拼（三六九 / 1/3 错缝）：三行一循环，相邻行端缝依次错开 1/3 板长。
     图案宽 = 3 × 板长，跨图案边界的那一块板左右两截共用同一色差，平铺后仍是完整长板。 */
  const plank369 = (id, base, line, o = {}) => {
    const L = o.L || 1200, W = L * 3, rows = 3, h = o.h || 600, rowH = h / rows, r = rnd(o.seed || 71);
    const grains = 10, fine = 3;
    let body = bx(0, 0, W, h, base) + bx(0, 0, W, h, gSheen);
    const board = (x0, y, w, tone, seam) => {
      let s = bx(x0, y, w, rowH, tone) + bx(x0, y, w, rowH, gV);
      for (let k = 0; k < grains; k++){
        const yy = y + rowH * (.08 + k * .092 + r() * .02), amp = 2 + r() * 7;
        s += `<path d="M${N(x0)} ${N(yy)} Q ${N(x0 + w / 2)} ${N(yy - amp)} ${N(x0 + w)} ${N(yy + amp * .3)}" stroke="${shade(line, .82 + r() * .34)}" stroke-width="${(.8 + r() * 1.5).toFixed(1)}" fill="none" opacity="${(.05 + r() * .13).toFixed(2)}"/>`;
      }
      for (let k = 0; k < fine; k++)
        s += `<path d="M${N(x0)} ${N(y + rowH * (.12 + r() * .76))}H${N(x0 + w)}" stroke="${shade(line, .96)}" stroke-width=".7" opacity="${(.04 + r() * .06).toFixed(2)}"/>`;
      // seam 只画在真正的板端；图案边界处是同一块板的中段，不能切出假缝
      if (seam) s += bx(x0 + w - 3, y, 3, rowH, shade(line, .62), 'opacity=".9"')
        + bx(x0 + w - 6, y, 2, rowH, '#fff', 'opacity=".12"');
      if (r() > .62){
        const kx = x0 + 40 + r() * Math.max(20, w - 80), ky = y + rowH * (.25 + r() * .5);
        s += `<ellipse cx="${N(kx)}" cy="${N(ky)}" rx="${(4 + r() * 5).toFixed(1)}" ry="${(2 + r() * 2).toFixed(1)}" fill="${shade(line, .55)}" opacity=".28"/>`;
      }
      return s;
    };
    for (let row = 0; row < rows; row++){
      const y = row * rowH, off = row * L / 3;
      for (let k = 0; k < 3; k++){
        const a = off + k * L, b = a + L, tone = shade(base, .94 + r() * .1);
        if (b <= W) body += board(a, y, b - a, tone, true);
        else { body += board(a, y, W - a, tone, false); body += board(0, y, b - W, tone, true); }
      }
      body += bx(0, y, W, 3, shade(line, .55), 'opacity=".9"') + bx(0, y + 3, W, 2, '#fff', 'opacity=".13"');
    }
    body += grain(W, h, (o.seed || 71) + 91, o.grainN || 110, o.grainOp || .05);
    return P(id, W, h, body);
  };

  /* 砖 / 石板：砖面色差 + 双向光泽 + 倒角亮边暗边 + 缝底阴影；decor 叠加专属花纹 */
  const tile = (id, size, base, line, o = {}) => {
    const W = size, H = o.h || size, pad = o.pad || Math.max(7, size * .022), r = rnd(o.seed || 21);
    const iw = W - pad * 2, ih = H - pad * 2, grout = o.grout || line;
    const tone = shade(base, .95 + r() * .1);
    let body = bx(0, 0, W, H, grout);
    body += bx(pad, pad, iw, ih, tone) + bx(pad, pad, iw, ih, gTile) + bx(pad, pad, iw, ih, gTileV);
    body += bx(pad, pad, iw, 3, '#fff', 'opacity=".18"') + bx(pad, pad, 3, ih, '#fff', 'opacity=".11"');
    body += bx(pad, pad + ih - 3, iw, 3, '#000', 'opacity=".16"') + bx(pad + iw - 3, pad, 3, ih, '#000', 'opacity=".13"');
    body += `<rect x="${N(pad + 7)}" y="${N(pad + 7)}" width="${N(iw - 14)}" height="${N(ih - 14)}" fill="none" stroke="${shade(base, 1.12)}" stroke-width="${N(size * .008)}" opacity=".45"/>`;
    if (o.decor) body += o.decor({r, W, H, pad, iw, ih, base, line});
    body += grain(iw, ih, (o.seed || 21) + 7, o.grain || 46, o.grainOp || .045, pad, pad);
    return P(id, W, H, body);
  };

  // 石材脉络：多条平滑曲线 + 伴生细脉
  const veins = (W, H, seed, col, n = 4, sw = 10) => {
    const r = rnd(seed); let s = '';
    for (let k = 0; k < n; k++){
      let x = r() * W, y = -40;
      const d = [`M${N(x)} ${N(y)}`];
      while (y < H + 40){ const nx = x + (r() - .5) * W * .28, ny = y + H * (.12 + r() * .18); d.push(`Q${N((x + nx) / 2 + (r() - .5) * 80)} ${N((y + ny) / 2)} ${N(nx)} ${N(ny)}`); x = nx; y = ny; }
      s += `<path d="${d.join('')}" stroke="${col}" stroke-width="${(sw * (.4 + r() * .8)).toFixed(1)}" fill="none" opacity="${(.18 + r() * .3).toFixed(2)}"/>`;
      s += `<path d="${d.join('')}" stroke="#fff" stroke-width="${(sw * .2).toFixed(1)}" fill="none" opacity=".12" transform="translate(${(3 + r() * 6).toFixed(0)} ${(3 + r() * 6).toFixed(0)})"/>`;
    }
    return s;
  };

  const out = [
    /* ——— 木 / 竹 / 软木 ——— */
    plank('wood', '#dcc09a', '#b78f60', {seed:11}),
    plank('maple', '#e8d4aa', '#c9a878', {seed:23}),
    plank('walnut', '#a57c56', '#6f4a2e', {seed:37}),
    plank('greywood', '#c8beb4', '#948a7e', {seed:41}),
    plank('smoked', '#8a7768', '#584a3f', {seed:53}),
    plank('bamboo', '#dcc890', '#ab9152', {seed:67, h:280, rows:3}),
    plank369('woodtile', '#bf8756', '#885d3b', {seed:71}),
    plank('cork', '#cba87c', '#9b7850', {seed:83, grains:0, fine:0, grainN:150, grainOp:.085,
      decor: ({r, W, h}) => {
        let s = '';
        for (let i = 0; i < 190; i++)
          s += `<ellipse cx="${N(r() * W)}" cy="${N(r() * h)}" rx="${(2 + r() * 8).toFixed(1)}" ry="${(1.5 + r() * 4).toFixed(1)}" fill="${r() > .5 ? '#8d6b45' : '#e3c8a0'}" opacity="${(.1 + r() * .3).toFixed(2)}"/>`;
        return s;
      }}),

    /* ——— 人字拼 / 鱼骨拼 / 凡尔赛拼花 ——— */
    (() => {
      // 经典 45° 人字拼（短边顶长边，竖向 V 列）；单板更大，约 1:5
      const pw = 120, pl = 600; // ≈1:5
      const colW = pl / Math.SQRT2, rowH = pw * Math.SQRT2;
      const W = Math.round(colW * 2), H = Math.round(rowH * 4);
      const r = rnd(97);
      let b = bx(0, 0, W, H, '#d0b089') + bx(0, 0, W, H, gSheen);
      const plank = (cx, cy, deg, tint) => {
        const t = shade('#d8bc94', tint);
        return `<g transform="translate(${N(cx)} ${N(cy)}) rotate(${deg})">`
          + bx(-pl / 2, -pw / 2, pl, pw, t, 'rx="2"')
          + bx(-pl / 2, -pw / 2, pl, pw, gV)
          + `<path d="M${N(-pl / 2 + 16)} ${N(-pw * .22)}H${N(pl / 2 - 16)}M${N(-pl / 2 + 16)} ${N(pw * .18)}H${N(pl / 2 - 16)}" stroke="#9a7a52" stroke-width="2.2" fill="none" opacity=".28"/>`
          + `<rect x="${N(-pl / 2)}" y="${N(-pw / 2)}" width="${N(pl)}" height="${N(pw)}" fill="none" stroke="#8f7048" stroke-width="2.4" opacity=".45"/>`
          + bx(-pl / 2, -pw / 2, pl, 3, '#fff', 'opacity=".14"')
          + bx(-pl / 2, pw / 2 - 3, pl, 3, '#000', 'opacity=".12"')
          + '</g>';
      };
      for (let col = -1; col < 4; col++) for (let row = -1; row < 10; row++){
        const x = col * colW, y = row * rowH;
        const tA = .82 + ((col * 17 + row * 13) % 9) * .03 + r() * .04;
        const tB = .82 + ((col * 11 + row * 19) % 9) * .03 + r() * .04;
        b += plank(x + colW * .25, y + rowH * .5, 45, tA);
        b += plank(x + colW * .75, y + rowH * .5, -45, tB);
      }
      b += grain(W, H, 98, 90, .04);
      return P('herringbone', W, H, b);
    })(),
    (() => {
      // 鱼骨拼：连续 V 形木条
      const W = 600, H = 300, r = rnd(101), bw = 210, bh = 52;
      let b = bx(0, 0, W, H, '#c8a273') + bx(0, 0, W, H, gSheen);
      for (let row = -1; row < 5; row++) for (let col = -1; col < 4; col++){
        const cx = col * 300 + (row & 1 ? 150 : 0), cy = row * 75;
        [-1, 1].forEach(sg => {
          b += `<g transform="translate(${N(cx)} ${N(cy)}) rotate(${sg * 30})">`
            + bx(0, -bh / 2, bw, bh, shade('#d5b489', .86 + r() * .26), 'rx="2"')
            + bx(0, -bh / 2, bw, bh, gV)
            + `<path d="M6 -12H${bw - 6}M6 8H${bw - 6}" stroke="#9a7a52" stroke-width="1.5" fill="none" opacity=".28"/>`
            + `<rect x="0" y="${-bh / 2}" width="${bw}" height="${bh}" fill="none" stroke="#96734c" stroke-width="2.2" opacity=".7" rx="2"/>`
            + bx(0, -bh / 2, bw, 2, '#fff', 'opacity=".18"') + bx(0, bh / 2 - 2, bw, 2, '#000', 'opacity=".18"')
            + '</g>';
        });
      }
      b += grain(W, H, 102, 100, .05);
      return P('chevron', W, H, b);
    })(),
    (() => {
      // 凡尔赛拼花：方格内纵横交错的小木条（篮编）
      const W = 600, H = 600, r = rnd(107), cell = 300, sl = 56;
      let b = bx(0, 0, W, H, '#d0ae82') + bx(0, 0, W, H, gSheen);
      const strip = (x, y, w, h, horiz) => {
        const t = shade('#dcc09a', .84 + r() * .3);
        let s = bx(x, y, w, h, t, 'rx="2"') + bx(x, y, w, h, horiz ? gTile : gV);
        for (let i = 1; i < 3; i++) s += horiz
          ? `<path d="M${N(x)} ${N(y + h * i / 3)}H${N(x + w)}" stroke="#a4835c" stroke-width="1.4" opacity=".28"/>`
          : `<path d="M${N(x + w * i / 3)} ${N(y)}V${N(y + h)}" stroke="#a4835c" stroke-width="1.4" opacity=".28"/>`;
        return s + `<rect x="${N(x)}" y="${N(y)}" width="${N(w)}" height="${N(h)}" fill="none" stroke="#9a7850" stroke-width="2.2" opacity=".65" rx="2"/>`;
      };
      for (let gy = 0; gy < 2; gy++) for (let gx = 0; gx < 2; gx++){
        const ox = gx * cell, oy = gy * cell, flip = (gx + gy) & 1;
        b += bx(ox, oy, cell, cell, '#c3a077');
        for (let i = 0; i < 5; i++) b += flip
          ? strip(ox + 8, oy + 8 + i * sl, cell - 16, sl - 6, true)
          : strip(ox + 8 + i * sl, oy + 8, sl - 6, cell - 16, false);
        if (flip) for (let i = 0; i < 5; i++) b += strip(ox + 8 + i * sl, oy + 8, sl - 6, cell - 16, false);
        else for (let i = 0; i < 5; i++) b += strip(ox + 8, oy + 8 + i * sl, cell - 16, sl - 6, true);
        b += `<rect x="${N(ox)}" y="${N(oy)}" width="${cell}" height="${cell}" fill="none" stroke="#8f7049" stroke-width="5" opacity=".7"/>`;
      }
      b += grain(W, H, 108, 110, .05);
      return P('parquet', W, H, b);
    })(),

    /* ——— 砖 / 石 ——— */
    tile('tile800', 800, '#e8e0d4', '#bfb2a0', {seed:113}),
    tile('tile600', 600, '#d8ded9', '#a8b3ad', {seed:117}),
    tile('porcelain', 800, '#efece6', '#c9c3b8', {seed:121, grout:'#d4d0c8'}),
    tile('antislip', 300, '#cfd6d1', '#93a099', {seed:127, grain:100, grainOp:.075}),
    tile('granite', 800, '#bdbbb6', '#8f8d89', {seed:131, grain:150, grainOp:.08,
      decor: ({r, W, H}) => {
        let s = '';
        for (let i = 0; i < 420; i++){
          const x = N(r() * W), y = N(r() * H), rad = (.8 + r() * 3.6).toFixed(1);
          s += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${['#6f6d6a','#e9e7e2','#9a9894','#d2d0cb'][(r() * 4) | 0]}" opacity="${(.2 + r() * .45).toFixed(2)}"/>`;
        }
        return s;
      }}),
    tile('encaustic', 400, '#dfe6e4', '#a9bcbe', {seed:137,
      decor: ({W, H}) => {
        const cx = W / 2, cy = H / 2, q = W * .26;
        return `<g fill="none" stroke="#5b7f88" stroke-width="7" opacity=".72">
          <path d="M${N(cx)} ${N(cy - q)}Q${N(cx + q)} ${N(cy)} ${N(cx)} ${N(cy + q)}Q${N(cx - q)} ${N(cy)} ${N(cx)} ${N(cy - q)}Z"/>
          <circle cx="${N(cx)}" cy="${N(cy)}" r="${N(q * .34)}" fill="#5b7f88" stroke="none" opacity=".55"/>
          <path d="M${N(cx - q)} ${N(cy)}H${N(cx + q)}M${N(cx)} ${N(cy - q)}V${N(cy + q)}" opacity=".45"/></g>
          <rect x="14" y="14" width="${N(W - 28)}" height="${N(H - 28)}" fill="none" stroke="#7fa0a5" stroke-width="4" opacity=".5"/>`;
      }}),
    tile('bluestone', 900, '#8d949a', '#697077', {seed:149, h:600,
      decor: ({r, W, H}) => {
        let s = '';
        for (let k = 0; k < 9; k++){
          const x = r() * W, y = r() * H;
          s += `<path d="M${N(x)} ${N(y)}l${N(60 + r() * 130)} ${N(-20 + r() * 30)}l${N(-10 + r() * 40)} ${N(70 + r() * 80)}l${N(-90 - r() * 90)} ${N(10 + r() * 30)}Z" fill="${r() > .5 ? '#9fa6ac' : '#798188'}" opacity="${(.1 + r() * .22).toFixed(2)}"/>`;
        }
        return s;
      }}),
    (() => {
      // 花园瓷砖：法式多尺寸拼铺 · 偏黄米色石灰石
      const W = 800, H = 800, r = rnd(157), u = W / 4, gw = 5;
      let b = bx(0, 0, W, H, '#dcc28e') + bx(0, 0, W, H, gSheen);
      const tiles = [
        [0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 1],
        [2, 1, 2, 1],
        [0, 2, 1, 1], [1, 2, 1, 2], [2, 2, 2, 2],
        [0, 3, 2, 1],
      ];
      const paver = (tx, ty, tw, th) => {
        const x = tx * u + gw, y = ty * u + gw, pw = tw * u - gw * 2, ph = th * u - gw * 2;
        const t = shade('#edcfa0', .9 + r() * .16);
        return bx(x, y, pw, ph, t, 'rx="3"') + bx(x, y, pw, ph, gTileV)
          + bx(x, y, pw, 3, '#fff8e0', 'opacity=".22"') + bx(x, y + ph - 3, pw, 3, '#000', 'opacity=".1"')
          + `<ellipse cx="${N(x + pw * (.3 + r() * .4))}" cy="${N(y + ph * (.3 + r() * .4))}" rx="${N(pw * (.15 + r() * .2))}" ry="${N(ph * (.12 + r() * .18))}" fill="${r() > .5 ? '#d4b878' : '#f5e6c0'}" opacity="${(.12 + r() * .18).toFixed(2)}"/>`;
      };
      tiles.forEach(([tx, ty, tw, th]) => { b += paver(tx, ty, tw, th); });
      b += grain(W, H, 158, 90, .04);
      return P('gardentile', W, H, b);
    })(),
    (() => {
      // 地铁砖：白色长条，工字铺
      const W = 600, H = 300, bw = 300, bh = 150, r = rnd(153);
      let b = bx(0, 0, W, H, '#c9c4b9');
      const brick = (x, y) => {
        const t = shade('#ebe8e0', .95 + r() * .1);
        return bx(x + 4, y + 4, bw - 8, bh - 8, t, 'rx="4"')
          + bx(x + 4, y + 4, bw - 8, bh - 8, gTileV)
          + bx(x + 4, y + 4, bw - 8, 3, '#fff', 'opacity=".28"')
          + bx(x + 4, y + bh - 7, bw - 8, 3, '#000', 'opacity=".14"')
          + `<rect x="${N(x + 11)}" y="${N(y + 11)}" width="${N(bw - 22)}" height="${N(bh - 22)}" fill="none" stroke="#fff" stroke-width="2" opacity=".28" rx="3"/>`;
      };
      b += brick(0, 0) + brick(bw, 0) + brick(-bw / 2, bh) + brick(bw / 2, bh) + brick(bw * 1.5, bh);
      b += grain(W, H, 154, 70, .04);
      return P('subway', W, H, b);
    })(),

    /* ——— 天然石材 / 水泥 ——— */
    (() => {
      const W = 1200, H = 1200, r = rnd(163);
      let b = bx(0, 0, W, H, '#f0ebe3') + bx(0, 0, W, H, gSheen);
      b += bx(0, 0, W, 12, '#cfc6b8') + bx(0, 0, 12, H, '#cfc6b8');
      // 云絮状色差 + 主脉络 + 伴生细脉，层次比纯色底更接近真实石材
      for (let k = 0; k < 10; k++)
        b += `<ellipse cx="${N(r() * W)}" cy="${N(r() * H)}" rx="${N(120 + r() * 260)}" ry="${N(60 + r() * 150)}" fill="${r() > .5 ? '#e0d8cb' : '#fbf8f2'}" opacity="${(.14 + r() * .22).toFixed(2)}"/>`;
      b += veins(W, H, 164, '#a2957f', 6, 17) + veins(W, H, 165, '#c6bba9', 4, 8);
      b += grain(W, H, 166, 130, .035);
      return P('marble', W, H, b);
    })(),
    (() => {
      const W = 1000, H = 1000, r = rnd(171);
      let b = bx(0, 0, W, H, '#e4d6be') + bx(0, 0, W, H, gSheen);
      b += bx(0, 0, W, 12, '#c4b498') + bx(0, 0, 12, H, '#c4b498');
      for (let k = 0; k < 46; k++){
        const cx = N(r() * W), cy = N(r() * H);
        b += `<ellipse cx="${cx}" cy="${cy}" rx="${N(22 + r() * 90)}" ry="${N(3 + r() * 10)}" fill="${r() > .5 ? '#c2a882' : '#b39a72'}" opacity="${(.34 + r() * .42).toFixed(2)}" transform="rotate(${N((r() - .5) * 16)} ${cx} ${cy})"/>`;
      }
      for (let y = 120; y < H; y += 190) b += `<path d="M0 ${N(y)}H${W}" stroke="#bcaa8c" stroke-width="5" opacity=".42"/>`;
      b += grain(W, H, 172, 120, .04);
      return P('travertine', W, H, b);
    })(),
    (() => {
      const W = 900, H = 600, r = rnd(181);
      let b = bx(0, 0, W, H, '#8a8e93') + bx(0, 0, W, H, gSheen);
      b += bx(0, 0, W, 10, '#6d7176') + bx(0, 0, 10, H, '#6d7176');
      for (let k = 0; k < 16; k++){
        const x = r() * W, y = r() * H;
        b += `<path d="M${N(x)} ${N(y)}l${N(70 + r() * 150)} ${N(-30 + r() * 40)}l${N(20 + r() * 60)} ${N(80 + r() * 110)}l${N(-110 - r() * 110)} ${N(-10 + r() * 40)}Z" fill="${r() > .5 ? '#a2a7ad' : '#767b81'}" opacity="${(.12 + r() * .26).toFixed(2)}"/>`;
      }
      for (let k = 0; k < 26; k++) b += `<path d="M${N(r() * W)} ${N(r() * H)}l${N(12 + r() * 50)} ${N(-6 + r() * 12)}" stroke="#d5d8db" stroke-width="1" opacity=".16"/>`;
      b += grain(W, H, 182, 150, .05);
      return P('slate', W, H, b);
    })(),
    (() => {
      const W = 520, H = 300, r = rnd(191);
      let b = bx(0, 0, W, H, '#b5bbb5') + bx(0, 0, W, H, gSheen);
      const hex = (cx, cy) => {
        let pts = '';
        for (let i = 0; i < 6; i++){ const a = Math.PI / 3 * i + Math.PI / 6; pts += `${N(cx + Math.cos(a) * 84)},${N(cy + Math.sin(a) * 84)} `; }
        return `<polygon points="${pts.trim()}" fill="${shade('#d9ddd8', .88 + r() * .22)}" stroke="#aeb5ae" stroke-width="7"/>`
          + `<polygon points="${pts.trim()}" fill="${gTileV}"/>`;
      };
      for (let row = -1; row < 3; row++) for (let col = -1; col < 4; col++) b += hex(col * 180, row * 180 + (col & 1 ? 90 : 0));
      b += grain(W, H, 192, 80, .04);
      return P('hexatile', W, H, b);
    })(),
    (() => {
      const W = 240, H = 240, r = rnd(197);
      let b = bx(0, 0, W, H, '#9aa3a0') + bx(0, 0, W, H, gSheen);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++){
        const x = 6 + i * 120, y = 6 + j * 120, t = shade('#d4dbd7', .88 + r() * .26);
        b += bx(x, y, 108, 108, t, 'rx="4"') + bx(x, y, 108, 108, gTileV)
          + bx(x, y, 108, 3, '#fff', 'opacity=".3"') + bx(x, y + 105, 108, 3, '#000', 'opacity=".14"');
      }
      b += grain(W, H, 198, 40, .045);
      return P('mosaic', W, H, b);
    })(),
    (() => {
      const W = 500, H = 500, r = rnd(203), cs = ['#b9a58c','#8fa3a0','#c9b7a2','#a88f76','#7e8a86','#d2c4b0','#9aa8a4','#c4b09a','#6f7a76'];
      let b = bx(0, 0, W, H, '#e8e1d5') + bx(0, 0, W, H, gSheen);
      for (let k = 0; k < 160; k++){
        const x = N(r() * W), y = N(r() * H), rad = N(3 + r() * 15);
        b += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${cs[(r() * cs.length) | 0]}" opacity="${(.45 + r() * .4).toFixed(2)}"/>`
          + `<circle cx="${x}" cy="${y}" r="${rad}" fill="none" stroke="#fff" stroke-width="1.4" opacity=".18"/>`;
      }
      b += grain(W, H, 204, 110, .035);
      return P('terrazzo', W, H, b);
    })(),
    (() => {
      const W = 800, H = 800, r = rnd(211);
      let b = bx(0, 0, W, H, '#cfc9c0') + bx(0, 0, W, H, gSheen);
      for (let k = 0; k < 12; k++)
        b += `<ellipse cx="${N(r() * W)}" cy="${N(r() * H)}" rx="${N(60 + r() * 190)}" ry="${N(50 + r() * 150)}" fill="${r() > .5 ? '#c2bcb3' : '#dad4cb'}" opacity="${(.1 + r() * .18).toFixed(2)}"/>`;
      for (let k = 0; k < 18; k++) b += `<path d="M${N(r() * W)} ${N(r() * H)}l${N((r() - .5) * 180)} ${N((r() - .5) * 180)}" stroke="#b3ada4" stroke-width="2" fill="none" opacity=".2"/>`;
      b += grain(W, H, 212, 260, .055);
      return P('cement', W, H, b);
    })(),

    /* ——— 地毯 / 编织 ——— */
    (() => {
      const W = 120, H = 120, r = rnd(223);
      let b = bx(0, 0, W, H, '#c9c3d3') + bx(0, 0, W, H, gSheen);
      for (let i = 0; i < 90; i++){
        const x = N(r() * W), y = N(r() * H);
        b += `<circle cx="${x}" cy="${y}" r="${(2 + r() * 3).toFixed(1)}" fill="${r() > .5 ? '#b4adc1' : '#d6d0df'}" opacity="${(.35 + r() * .4).toFixed(2)}"/>`;
      }
      for (let i = 0; i < 40; i++) b += `<path d="M${N(r() * W)} ${N(r() * H)}l${N((r() - .5) * 4)} ${N(2 + r() * 5)}" stroke="#fff" stroke-width=".9" opacity=".22"/>`;
      return P('carpet', W, H, b);
    })(),
    (() => {
      // 剑麻：经纬交错的粗编织
      const W = 240, H = 240, r = rnd(229), n = 12, step = W / n;
      let b = bx(0, 0, W, H, '#c8bda2') + bx(0, 0, W, H, gSheen);
      for (let i = 0; i < n; i++){
        const light = (i & 1) === 0;
        b += bx(i * step, 0, step - 3, H, shade('#cbbfa4', light ? 1.06 : .92), 'rx="3"')
          + bx(0, i * step, W, step - 3, shade('#c4b89d', light ? .94 : 1.08), 'rx="3" opacity=".55"');
        b += bx(i * step, 0, 2, H, '#fff', 'opacity=".14"') + bx(i * step + step - 5, 0, 2, H, '#000', 'opacity=".13"');
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
        if ((i + j) & 1) b += bx(i * step, j * step, step - 3, step - 3, '#a99b7c', 'opacity=".16" rx="2"');
      b += grain(W, H, 230, 120, .06);
      return P('sisal', W, H, b);
    })(),
    (() => {
      // 榻榻米：细密草席横纹 + 深色布边
      const W = 1000, H = 500, r = rnd(233);
      let b = bx(0, 0, W, H, '#c9c49a') + bx(0, 0, W, H, gSheen);
      for (let y = 0; y < H; y += 6)
        b += `<path d="M0 ${N(y)}H${W}" stroke="${r() > .5 ? '#b3ae82' : '#d8d3ab'}" stroke-width="2.4" opacity="${(.3 + r() * .3).toFixed(2)}"/>`;
      for (let x = 0; x < W; x += 12) b += `<path d="M${N(x)} 0V${H}" stroke="#a9a47c" stroke-width="1.4" opacity=".18"/>`;
      b += bx(0, 0, W, 16, '#3f4a3c') + bx(0, H - 16, W, 16, '#3f4a3c')
        + bx(0, 0, 16, H, '#3f4a3c') + bx(W - 16, 0, 16, H, '#3f4a3c');
      b += bx(0, 16, W, 3, '#fff', 'opacity=".18"');
      b += grain(W, H, 234, 160, .045);
      return P('tatami', W, H, b);
    })(),
  ];

  $('#defs').innerHTML = grads.join('') + out.join('') +
    `<pattern id="grid" patternUnits="userSpaceOnUse" width="1000" height="1000">
      <path d="M500 0V1000M0 500H1000" stroke="#e5dfd3" stroke-width="8"/><path d="M0 0V1000M0 0H1000" stroke="#d8d0c1" stroke-width="14"/></pattern>`;
}

/* 材质色板：右侧面板 / 总览里的纯色块改成带纹理的预览（CSS 渐变，轻量且与 2D 图案同调） */
function matSwatch(kind){
  const m = MATS[kind]; if (!m) return '';
  const c = m.sw;
  const wood = /wood|maple|walnut|greywood|bamboo|herringbone|chevron|parquet|smoked|cork|woodtile/.test(kind);
  const soft = /carpet|sisal|tatami/.test(kind);
  const stone = /marble|travertine|slate|granite|bluestone|gardentile|terrazzo|cement/.test(kind);
  const glow = `linear-gradient(155deg,rgba(255,255,255,.3),rgba(255,255,255,0) 52%,rgba(0,0,0,.18))`;
  let tex;
  // 木纹砖 369 拼：三行横缝，每行竖缝按 1/3 板长递进，色板里也能一眼区分
  if (kind === 'woodtile'){
    const v = p => `linear-gradient(90deg,rgba(0,0,0,0) 0 ${p}%,rgba(0,0,0,.26) ${p}% calc(${p}% + 1px),rgba(0,0,0,0) calc(${p}% + 1px))`;
    const t369 = [v(33.333), v(66.666), v(0),
      'repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 1px,rgba(0,0,0,0) 1px 33.333%)',
      'repeating-linear-gradient(90deg,rgba(255,255,255,.1) 0 1px,rgba(255,255,255,0) 1px 6px)'].join(',');
    return `background-color:${c};background-image:${t369},${glow};`
      + 'background-size:100% 33.333%,100% 33.333%,100% 33.333%,100% 100%,100% 100%,100% 100%;'
      + 'background-position:0 0,0 50%,0 100%,0 0,0 0,0 0;'
      + 'background-repeat:no-repeat,no-repeat,no-repeat,repeat,repeat,repeat';
  }
  if (wood) tex = `repeating-linear-gradient(0deg,rgba(0,0,0,.17) 0 1px,rgba(0,0,0,0) 1px 8px),`
    + `repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 1px,rgba(255,255,255,0) 1px 20px)`;
  else if (soft) tex = `repeating-linear-gradient(45deg,rgba(255,255,255,.16) 0 2px,rgba(255,255,255,0) 2px 5px),`
    + `repeating-linear-gradient(-45deg,rgba(0,0,0,.13) 0 2px,rgba(0,0,0,0) 2px 5px)`;
  else if (stone) tex = `radial-gradient(circle at 28% 32%,rgba(255,255,255,.22),rgba(255,255,255,0) 38%),`
    + `radial-gradient(circle at 72% 74%,rgba(0,0,0,.14),rgba(0,0,0,0) 42%),`
    + `repeating-linear-gradient(118deg,rgba(120,110,95,.13) 0 1px,rgba(0,0,0,0) 1px 13px)`;
  else tex = `linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,rgba(0,0,0,0) 1px 50%),`
    + `linear-gradient(90deg,rgba(0,0,0,.16) 0 1px,rgba(0,0,0,0) 1px 50%),`
    + `linear-gradient(0deg,rgba(255,255,255,.2) 1px,rgba(255,255,255,0) 3px),`
    + `linear-gradient(90deg,rgba(255,255,255,.2) 1px,rgba(255,255,255,0) 3px)`;
  return `background-color:${c};background-image:${tex},${glow}`;
}

/* ======================= 家具图例 ======================= */
const ST = 'stroke="#3d3a34" stroke-width="1" vector-effect="non-scaling-stroke"';
const rc = (x,y,w,h,f,ex='') => `<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="${Math.max(0,h)}" fill="${f}" ${ST} ${ex}/>`;
const ec = (cx,cy,rx,ry,f,ex='') => `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(0,rx)}" ry="${Math.max(0,ry)}" fill="${f}" ${ST} ${ex}/>`;
const ln = (x1,y1,x2,y2,ex='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${ST} ${ex}/>`;
const pa = (d,f='none',ex='') => `<path d="${d}" fill="${f}" ${ST} ${ex}/>`;
const DASH = 'stroke-dasharray="4 3"';

function furnSVG(t,w,d,c,meta){
  const x = -w/2, y = -d/2, m = Math.min(w,d);
  /* —— 客厅家具质感层：无描边半透明高光/阴影、缝线、拉扣、木纹/石纹/玻璃 —— */
  const qR = (px,py,pw,ph,col,ex='') => `<rect x="${px}" y="${py}" width="${Math.max(0,pw)}" height="${Math.max(0,ph)}" fill="${col}" ${ex}/>`;
  const qE = (cx,cy,rx,ry,col,ex='') => `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(0,rx)}" ry="${Math.max(0,ry)}" fill="${col}" ${ex}/>`;
  const qL = (x1,y1,x2,y2,ex='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${ex}/>`;
  const qP = (dd,col,ex='') => `<path d="${dd}" fill="${col}" ${ex}/>`;
  const qHi = (px,py,pw,ph,o=.5,rx=24) => qR(px,py,pw,ph,'#ffffff',`rx="${rx}" opacity="${o}"`);
  const qLo = (px,py,pw,ph,o=.16,rx=24) => qR(px,py,pw,ph,'#000000',`rx="${rx}" opacity="${o}"`);
  const qSeam = (x1,y1,x2,y2,o=.4) => qL(x1,y1,x2,y2,`stroke="${shade(c,.6)}" stroke-width="2.4" stroke-dasharray="12 9" opacity="${o}" vector-effect="non-scaling-stroke"`);
  const qTuft = (cx,cy,rr) => qE(cx,cy+rr*.3,rr*1.2,rr*.85,'#000','opacity=".15"')
    + `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${shade(c,.64)}" opacity=".9"/>`
    + `<circle cx="${cx-rr*.3}" cy="${cy-rr*.32}" r="${rr*.34}" fill="#fff" opacity=".3"/>`;
  const qWood = (px,py,pw,ph,rows=4) => { let z=''; for(let i=1;i<rows;i++){ const yy=py+ph*i/rows; z+=qP(`M${px} ${yy}Q${px+pw*.28} ${yy-7} ${px+pw*.55} ${yy+6}T${px+pw} ${yy-3}`,'none',`stroke="${shade(c,.76)}" stroke-width="2.2" opacity=".3"`); } return z; };
  const qStone = (px,py,pw,ph) => { let z=''; for(let i=0;i<3;i++){ const yy=py+ph*(.22+i*.28); z+=qP(`M${px+pw*.03} ${yy}Q${px+pw*.3} ${yy-ph*.18} ${px+pw*.58} ${yy+ph*.07}T${px+pw*.97} ${yy-ph*.05}`,'none',`stroke="${shade(c,.66)}" stroke-width="${3.4-i*.7}" opacity=".32"`); } return z; };
  const qGlass = (px,py,pw,ph) => qR(px,py,pw,ph,'#ffffff','opacity=".1"') + qP(`M${px+pw*.08} ${py+ph}H${px+pw*.4} ${py}H${px+pw*.58} ${py}H${px+pw*.26} ${py+ph}Z`,'#ffffff','opacity=".2"');
  /* —— 花园家具质感层：叶片叶脉 / 五瓣花 / 水波 / 木板条 / 石纹 —— */
  const qLeafS = (cx,cy,rx,ry,ang,col,op=.95) => `<g transform="translate(${cx} ${cy}) rotate(${ang})"><ellipse rx="${rx}" ry="${ry}" fill="${col}" opacity="${op}"/><path d="M${-rx} 0H${rx}" stroke="#2e5227" stroke-width="1.4" opacity=".45" fill="none"/><path d="M0 0Q${rx*.42} ${-ry*.55} ${rx*.86} 0M0 0Q${rx*.42} ${ry*.55} ${rx*.86} 0" stroke="#2e5227" stroke-width="1" opacity=".3" fill="none"/></g>`;
  const qBloomS = (cx,cy,r,col) => { let z=''; for(let k=0;k<5;k++){ const a=k*Math.PI*2/5, px=cx+Math.cos(a)*r*.52, py=cy+Math.sin(a)*r*.52; z+=`<ellipse cx="${px}" cy="${py}" rx="${r*.44}" ry="${r*.3}" fill="${col}" opacity=".92" transform="rotate(${a*180/Math.PI} ${px} ${py})"/>`; } return z+`<circle cx="${cx}" cy="${cy}" r="${r*.26}" fill="#f4cf72"/><circle cx="${cx-r*.07}" cy="${cy-r*.08}" r="${r*.1}" fill="#fff" opacity=".55"/>`; };
  const qRippleS = (cx,cy,r,col='#bfe0ea',n=3) => { let z=''; for(let k=1;k<=n;k++) z+=`<circle cx="${cx}" cy="${cy}" r="${r*k/(n+1)}" fill="none" stroke="${col}" stroke-width="${2.4-k*.45}" opacity="${(.58-k*.11).toFixed(2)}"/>`; return z; };
  const qPlankS = (px,py,pw,ph,n,col) => { let z=''; for(let i=0;i<n;i++){ const yy=py+ph*i/n; z+=qR(px,yy,pw,Math.max(1,ph/n-3),i%2?shade(col,1.08):shade(col,.93),'opacity=".55"')+qL(px,yy,px+pw,yy,`stroke="${shade(col,.68)}" stroke-width="2" opacity=".5"`); } return z; };
  const qStoneS = (px,py,pw,ph,col) => { let z=''; for(let i=0;i<4;i++){ const yy=py+ph*(.16+i*.22); z+=qP(`M${px+pw*.04} ${yy}Q${px+pw*.3} ${yy-ph*.14} ${px+pw*.56} ${yy+ph*.08}T${px+pw*.96} ${yy-ph*.06}`,'none',`stroke="${shade(col,.62)}" stroke-width="${3.2-i*.55}" opacity=".3"`); } return z; };
  switch (t){
    case 'bed': {
      let s = rc(x,y,w,d,'#fbf8f2','rx="30"') + rc(x,y,w,Math.min(90,d*.05),shade(c,.62),'rx="20"');
      const ph = Math.min(360,d*.18), py = y+150;
      if (w >= 1300){ const pw = (w-240)/2; s += rc(x+80,py,pw,ph,'#fff','rx="70"') + rc(x+160+pw,py,pw,ph,'#fff','rx="70"'); }
      else s += rc(x+80,py,w-160,ph,'#fff','rx="70"');
      const by = py+ph+110, bh = y+d-15-by;
      s += rc(x+15,by,w-30,bh,c,'rx="40"') + pa(`M${x+15} ${by+300}H${x+w-15}`,'none',DASH);
      s += pa(`M${x+w-15-Math.min(420,w*.3)} ${by}L${x+w-15} ${by}L${x+w-15} ${by+Math.min(420,w*.3)}Z`, shade(c,1.12));
      return s;
    }
    case 'premiumdresser': {
      // 高端梳妆台俯视：通长圆角台面 + 抽拉搭板 / 马蹄镂空侧腿 / 曲面座凳 / 台式翻转镜
      //                + 右侧「3 小抽 · 回纹腰线 · 2 大抽」斗柜 + 台面摆件
      // 深黑胡桃底色上用「暖浅木高光」拉出层次，避免细节糊成一块深色
      const wood = shade(c, .92), woodD = shade(c, .68), woodL = shade(c, 1.20),
            ink = shade(c, 1.34);
      const openW = w * .43, dressW = w - openW, jx = x + openW;
      let s = rc(x, y, w, d, wood, 'rx="18"');                       // 通长台面
      for (let i = 1; i < 4; i++){                                    // 自然山纹 / 拼板缝
        const yy = y + d * i / 4;
        s += pa(`M${x + 18} ${yy}Q${x + w * .28} ${yy - 9} ${x + w * .55} ${yy + 8}T${x + w - 18} ${yy - 4}`,
                'none', `stroke="${ink}" stroke-width="2.4" opacity=".26"`);
        s += pa(`M${x + w * i / 4} ${y + 16}V${y + d - 16}`, 'none',
                `stroke="${ink}" stroke-width="2" opacity=".20"`);
      }
      s += pa(`M${x + 14} ${y + d - 13}H${x + w - 14}`, 'none',       // 前缘亮边
              `stroke="${ink}" stroke-width="3" opacity=".55"`);

      // 抽拉搭板：开放区右侧向前探出的薄板
      s += rc(jx - openW * .46, y + d - 30, openW * .42, 42, woodL, 'rx="8" opacity=".85"');
      s += pa(`M${jx - openW * .44} ${y + d - 22}H${jx - openW * .06}`, 'none',
              `stroke="${ink}" stroke-width="2" opacity=".5"`);

      // 左侧马蹄形镂空整板侧腿（俯视为窄边，末端水滴暗示）
      s += rc(x + 12, y + d * .10, 30, d * .80, woodL, 'rx="7" opacity=".8"');
      s += pa(`M${x + 27} ${y + d * .32} q ${18} ${d * .10} 0 ${d * .22} q ${-18} ${d * .10} 0 ${-d * .22} Z`,
              woodD, `stroke="${ink}" stroke-width="1.5" opacity=".9"`);

      // 曲面座梳妆凳
      s += rc(x + openW * .30, y + d * .28, openW * .40, d * .46, woodL, 'rx="12" opacity=".85"');
      s += pa(`M${x + openW * .34} ${y + d * .36}H${x + openW * .66}`, 'none',
              `stroke="${woodD}" stroke-width="2" opacity=".55"`);
      // 台式翻转化妆镜（俯视示意：超椭圆框 + 镜面）
      s += rc(x + openW * .26, y + d * .10, openW * .34, d * .22, woodL, 'rx="26" opacity=".9"');
      s += rc(x + openW * .29, y + d * .13, openW * .28, d * .16, '#cfd8e0', 'rx="20"');

      // 右侧斗柜：后带 3 小抽 / 中带回纹腰线 / 前带 2 大抽
      s += rc(jx + 8, y + 10, dressW - 18, d - 20, woodD, 'rx="10" opacity=".85"');
      const y1 = y + d * .34, y2 = y + d * .52;
      for (let i = 1; i < 3; i++)
        s += pa(`M${jx + 8 + (dressW - 18) * i / 3} ${y + 14}V${y1}`, 'none',
                `stroke="${ink}" stroke-width="2.5" opacity=".5"`);
      s += pa(`M${jx + 8 + (dressW - 18) / 2} ${y2}V${y + d - 14}`, 'none',
              `stroke="${ink}" stroke-width="2.5" opacity=".5"`);
      s += pa(`M${jx + 12} ${y1}H${x + w - 12}`, 'none', `stroke="${ink}" stroke-width="2.5" opacity=".55"`);
      s += pa(`M${jx + 12} ${y2}H${x + w - 12}`, 'none', `stroke="${ink}" stroke-width="2.5" opacity=".55"`);
      const n = Math.max(9, Math.round(dressW / 90)), st = (dressW - 24) / n;
      for (let i = 0; i < n; i++)
        s += rc(jx + 12 + st * (i + .5) - 7, (y1 + y2) / 2 - 7, 14, 14, ink,
                'rx="2" opacity=".72"');

      // 台面摆件：小木托盘 / 相框 / 粗陶瓶
      s += ec(x + openW * .72, y + d * .30, Math.min(34, d * .10), Math.min(22, d * .07), woodL,
              'opacity=".9"');
      s += rc(x + openW * .82, y + d * .22, 26, 34, woodL, 'rx="3" opacity=".9"');
      s += rc(x + openW * .82 + 3, y + d * .22 + 3, 20, 28, '#e8e2d6', 'rx="2"');
      s += ec(jx + dressW * .78, y + d * .28, Math.min(30, d * .10), Math.min(30, d * .10), '#e9e6df');
      return s;
    }
    case 'leatherbed': {
      // 真皮大床俯视（v3）：全黑荔枝纹皮包 / 4 列 × 2 行鼓包床头窄带
      //   / 3 格鼓包床尾板 / 白色厚被 / 深灰人字纹针织毯（流苏）
      //   / 两枚豆沙棕扁方枕 + 一枚米白抱枕
      const hi = shade(c, 1.42), mid = shade(c, 1.16), dk = shade(c, .54), ink = shade(c, 1.60);
      const hb = Math.min(168, d * .088), ft = Math.min(94, d * .05);
      let s = rc(x, y, w, d, shade(c, .96), 'rx="34"');

      // 皮包顶沿滚边
      s += `<path d="M${x + 24} ${y + d - 18}H${x + w - 24}" fill="none" stroke="${hi}" stroke-width="3" opacity=".40" stroke-linecap="round"/>`;

      // 床头软包窄带：4 列 × 2 行饱满鼓包，交叉点压深色拉扣
      s += rc(x - 18, y - 12, w + 36, hb + 12, dk, 'rx="24"');
      const hw = w + 36, gap = 6, mg = 12, n = 4;
      const cw = (hw - mg * 2 - gap * (n - 1)) / n;
      const ch = (hb - 14) / 2;
      for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++){
        const px = x - 18 + mg + cw * i + gap * i;
        const py = y + 2 + r * (ch + 4);
        const tone = (i + r * 2) % 3 === 0 ? hi : ((i + r * 2) % 3 === 1 ? mid : shade(c, 1.26));
        const rr = Math.min(24, ch * .42);
        s += qR(px, py, cw, ch, tone, `rx="${rr}"`);
        s += qR(px + 8, py + 5, cw - 16, ch * .36, '#ffffff', `rx="${Math.min(16, ch * .26)}" opacity=".10"`);
        s += qE(px + cw / 2, py + ch * .52, cw * .34, ch * .30, '#ffffff', 'opacity=".055"');
        s += qR(px + 5, py + ch * .72, cw - 10, ch * .20, '#000000', `rx="${Math.min(14, ch * .2)}" opacity=".24"`);
      }
      for (let i = 1; i < n; i++){
        const px = x - 18 + mg + cw * i + gap * (i - .5);
        s += qE(px, y + 2 + ch + 2, 8, 8, dk, 'opacity=".9"');
        s += qE(px - 2, y + ch, 3.4, 3.4, '#ffffff', 'opacity=".16"');
      }
      s += `<path d="M${x - 12} ${y + 2}H${x + w + 12}" fill="none" stroke="${ink}" stroke-width="3" opacity=".38" stroke-linecap="round"/>`;

      // 白色床垫 / 床单（四边露出一圈黑色皮包边）
      s += rc(x + 18, y + hb + 10, w - 36, d - hb - ft - 24, '#f3f1ea', 'rx="22"');

      // 白色厚被 + 被头翻边 + 淡竖向褶皱
      const by = y + hb + Math.min(320, d * .17), bh = y + d - ft - 18 - by;
      s += rc(x + 22, by, w - 44, bh, '#faf8f3', 'rx="26"');
      s += rc(x + 28, by + 6, w - 56, Math.min(48, bh * .10), '#ffffff', 'rx="16" opacity=".92"');
      for (let i = 1; i < 7; i++){
        const lx = x + 22 + (w - 44) * i / 7;
        s += `<path d="M${lx} ${by + 54}Q${lx + 16} ${by + bh * .5} ${lx - 10} ${by + bh - 24}" fill="none" stroke="#c9c5bb" stroke-width="2.6" opacity=".18"/>`;
      }

      // 深灰人字纹针织毯：每行用「一个 path 多段 V 形」绘制，避免上千节点
      const ky = by + bh * .34, kh = Math.min(190, bh * .30);
      s += qR(x + w * .05, ky, w * .90, kh, '#44444a', 'rx="12"');
      s += qR(x + w * .05 + 4, ky + 4, w * .90 - 8, kh * .20, '#ffffff', 'rx="8" opacity=".05"');
      for (let yy = ky + 12; yy < ky + kh - 8; yy += 21){
        let dHi = '', dLo = '';
        for (let xx = x + w * .06; xx < x + w * .94; xx += 50){
          dHi += `M${xx} ${yy + 4}L${xx + 16} ${yy + 13}L${xx + 32} ${yy + 4}`;
          dLo += `M${xx} ${yy + 10}L${xx + 16} ${yy + 19}L${xx + 32} ${yy + 10}`;
        }
        s += `<path d="${dHi}" fill="none" stroke="#77756f" stroke-width="2.2" opacity=".6" stroke-linecap="round" stroke-linejoin="round"/>`;
        s += `<path d="${dLo}" fill="none" stroke="#26262a" stroke-width="2" opacity=".65" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      let fringe = '';
      for (let i = 0; i < 22; i++){
        const tx = x + w * .06 + i * (w * .88 / 21);
        fringe += `M${tx} ${ky + kh - 3}q2 13 -1 24`;
      }
      s += `<path d="${fringe}" fill="none" stroke="#2b2b2f" stroke-width="2.2" opacity=".85" stroke-linecap="round"/>`;

      // 床尾板：3 格饱满鼓包 + 格间拉扣
      s += rc(x - 6, y + d - ft - 10, w + 12, ft + 10, dk, 'rx="24"');
      const fw2 = (w + 12 - 20 - 16) / 3;
      for (let i = 0; i < 3; i++){
        const px = x - 6 + 10 + fw2 * i + 8 * i;
        s += qR(px, y + d - ft - 4, fw2, ft - 6, i % 2 ? mid : hi, 'rx="18"');
        s += qR(px + 6, y + d - ft, fw2 - 12, (ft - 6) * .34, '#ffffff', 'rx="12" opacity=".09"');
        s += qR(px + 5, y + d - ft + (ft - 6) * .72, fw2 - 10, (ft - 6) * .20, '#000000', 'rx="10" opacity=".20"');
      }
      for (let i = 1; i < 3; i++){
        const px = x - 6 + 10 + fw2 * i + 8 * (i - .5) + 4;
        s += qE(px, y + d - ft - 4 + (ft - 6) / 2, 7, 7, dk, 'opacity=".85"');
      }

      // 枕头：两枚豆沙棕扁方枕 + 一枚米白抱枕
      const py = y + hb + 26, ph = Math.min(250, d * .125), pw = (w - 210) / 2;
      [0, 1].forEach(i => {
        const px = x + 66 + i * (pw + 78);
        s += qR(px, py - 10, pw, ph, '#8b6a5d', 'rx="38"');
        s += qE(px + pw / 2, py + ph * .42, pw * .34, ph * .26, '#ffffff', 'opacity=".10"');
        s += qR(px + 12, py + 6, pw - 24, ph * .26, '#ffffff', 'rx="20" opacity=".11"');
        s += qR(px + 10, py + ph * .74, pw - 20, ph * .18, '#000000', 'rx="18" opacity=".12"');
      });
      const q = Math.min(ph * .86, 220), qx = x + w * .50 - q * .42, qy = py + ph * .52;
      s += qR(qx, qy, q, q * .82, '#eae4d6', 'rx="24"');
      s += qR(qx + 12, qy + 10, q - 24, q * .22, '#ffffff', 'rx="16" opacity=".55"');
      return s;
    }
    case 'premiumbed': {
      // 高端木床俯视：自然边山纹大板床头 + 落地高箱木框 + 中灰棉麻被
      //              + 白色大枕 / 绿白人字纹抱枕 / 床尾书册
      const wood = shade(c,.90), woodD = shade(c,.66), ink = shade(c,1.42);
      const hb = Math.min(120, d*.075);
      let s = rc(x, y, w, d, wood, 'rx="14"');

      // 床头大板：略宽出床体，上沿做自然边起伏
      s += qP(`M${x-22} ${y+hb-2}L${x-22} ${y+8}Q${x+w*.20} ${y-7} ${x+w*.50} ${y+5}T${x+w+22} ${y+7}L${x+w+22} ${y+hb-2}Z`,
              woodD, `stroke="${ink}" stroke-width="2" opacity=".85"`);
      for (let i = 1; i < 4; i++){                       // 横向山纹
        const yy = y + hb*i/4;
        s += qP(`M${x-14} ${yy}Q${x+w*.28} ${yy-8} ${x+w*.55} ${yy+7}T${x+w+14} ${yy-3}`,
                'none', `stroke="${ink}" stroke-width="2.2" opacity=".28"`);
      }
      [1, 2].forEach(i =>                                 // 拼板缝
        s += qP(`M${x+w*i/3} ${y+10}V${y+hb-8}`, 'none',
                `stroke="${ink}" stroke-width="2" opacity=".30"`));

      // 高箱木体：前沿亮边 + 竖向拼板缝
      s += qP(`M${x+14} ${y+d-16}H${x+w-14}`, 'none', `stroke="${ink}" stroke-width="3" opacity=".50"`);
      [1, 2].forEach(i =>
        s += qP(`M${x+w*i/3} ${y+hb}V${y+d-16}`, 'none',
                `stroke="${ink}" stroke-width="2" opacity=".20"`));

      // 白色床垫 / 床单（四周露出一圈）
      s += rc(x+16, y+hb+8, w-32, d-hb-28, '#f3f1ea', 'rx="16"');

      // 中灰棉麻被 + 被头翻边 + 淡竖向褶皱
      const by = y + hb + Math.min(430, d*.27), bh = y + d - 24 - by;
      s += rc(x+20, by, w-40, bh, '#7d807b', 'rx="20"');
      s += rc(x+26, by+5, w-52, Math.min(48, bh*.10), '#8e908b', 'rx="14" opacity=".9"');
      for (let i = 1; i < 7; i++){
        const lx = x + 20 + w*i/7;
        s += qP(`M${lx} ${by+56}Q${lx+18} ${by+bh*.52} ${lx-9} ${by+bh-20}`,
                'none', 'stroke="#ffffff" stroke-width="2.4" opacity=".10"');
      }

      // 白色大枕
      const ph = Math.min(300, d*.15), py = y + hb + 42;
      if (w >= 1300){
        const pw = (w - 180)/2;
        [0, 1].forEach(i => s += rc(x+60+i*(pw+60), py, pw, ph, '#fbfaf6', 'rx="40"'));
      } else s += rc(x+60, py, w-120, ph, '#fbfaf6', 'rx="40"');

      // 绿白人字纹抱枕（Chevron 连续 Z 字）
      const qs = Math.min(ph*.80, 230), qy = py + ph*.60;
      const chev = (cx0, cy0, qw, qh) => {
        let z = rc(cx0, cy0, qw, qh, '#f7f6ee', 'rx="26"');
        const rows = 4, amp = qh*.115, x0 = cx0+12, x1 = cx0+qw-12;
        for (let r = 0; r < rows; r++){
          const yy0 = cy0 + qh*(r+.65)/(rows+.35);
          let dd = `M${x0} ${yy0}`;
          const n = 4, dx = (x1-x0)/n;
          for (let k = 0; k < n; k++) dd += `L${x0+dx*(k+.5)} ${yy0-amp}L${x0+dx*(k+1)} ${yy0}`;
          z += qP(dd, 'none', `stroke="#9aa85c" stroke-width="${Math.max(6,amp*.5)}" stroke-linejoin="round" stroke-linecap="round" opacity=".92"`);
        }
        return z;
      };
      if (w >= 1300){
        const qw = Math.min((w-280)/2, 420);
        s += chev(x+w*.5-qw-26, qy, qw, qs);
        s += chev(x+w*.5+26, qy, qw, qs);
      } else {
        const qw = Math.min(w*.32, 380);
        s += chev(x+w*.5-qw/2, qy, qw, qs);
      }

      // 床尾书册：摊开的书 + 白色大书 + 米色小书
      const bkY = by + bh*.36, bkw = Math.min(240, w*.16), bkh = Math.min(150, d*.09);
      s += rc(x+w*.14, bkY, bkw*.58, bkh, '#f2ecdc', 'rx="5"');
      s += rc(x+w*.14+bkw*.61, bkY, bkw*.58, bkh, '#f2ecdc', 'rx="5"');
      s += qP(`M${x+w*.14+bkw*.595} ${bkY+7}V${bkY+bkh-7}`, 'none',
              'stroke="#cbb894" stroke-width="3" opacity=".9"');
      s += rc(x+w*.44, bkY+16, bkw*.86, bkh*.84, '#faf8f1', 'rx="6"');
      s += rc(x+w*.66, bkY-16, bkw*.56, bkh*.64, '#e2d5b8', 'rx="5"');
      for (let i = 1; i <= 3; i++)
        s += qP(`M${x+w*.44+14} ${bkY+16+bkh*.84*i/4}H${x+w*.44+bkw*.86-14}`, 'none',
                'stroke="#c9bfa8" stroke-width="2" opacity=".65"');
      return s;
    }
    case 'sofa': case 'armchair': case 'loveseat': {
      const b = Math.min(d*.26, 250), a = Math.min(210, w*.13);
      const n = t === 'armchair' ? 1 : (w > 1900 ? 3 : 2);
      const cw = (w - 2*a)/n, dk = shade(c,.83), sy = y+b, sh = d-b-28;
      let s = rc(x,y,w,d,dk,'rx="70"');
      s += qHi(x+14,y+12,w-28,d-24,.16,60) + qLo(x,y+d-50,w,50,.14,30);
      // 靠背分格缝 + 拉扣
      for (let i=1;i<n;i++) s += qL(x+a+i*cw,y+20,x+a+i*cw,y+b-14,`stroke="${shade(c,.64)}" stroke-width="2.4" opacity=".5"`);
      for (let i=0;i<n;i++) for (let k=0;k<2;k++) s += qTuft(x+a+cw*(i+(k+.5)/2), y+b*.52, Math.min(17,cw*.04,b*.1));
      // 坐垫：独立软包 + 高光 + 中缝 + 前沿滚边
      for (let i=0;i<n;i++){
        const px=x+a+i*cw+9, py=sy+10, pw=cw-18, ph=sh-12;
        s += rc(px,py,pw,ph,c,'rx="46"');
        s += qHi(px+10,py+8,pw-20,ph*.3,.2,34) + qLo(px+6,py+ph-28,pw-12,26,.1,18);
        s += qSeam(px+pw*.5,py+14,px+pw*.5,py+ph-14,.16);
        s += qL(px+14,py+ph-10,px+pw-14,py+ph-10,'stroke="#fff" stroke-width="2.5" opacity=".26"');
      }
      // 扶手：滚边 + 顶部高光
      [[x,x+a],[x+w-a,x+w]].forEach(([ax,bx]) => {
        s += rc(ax,y,bx-ax,d,dk,'rx="50"') + qHi(ax+10,y+10,bx-ax-20,d-20,.15,40);
        s += qL((ax+bx)/2,y+22,(ax+bx)/2,y+d-22,`stroke="#fff" stroke-width="3" opacity=".22"`);
      });
      // 靠背顶条
      s += rc(x,y,w,b,dk,'rx="50"') + qHi(x+16,y+8,w-32,b*.3,.17,40);
      // 抱枕：带阴影、缝线与高光
      const pw=Math.min(cw*.44,w*.2), ph=Math.min(sh*.58,230);
      const pillows = n>1 ? [[-1,shade(c,.8)],[1,shade(c,1.16)]] : [[0,shade(c,1.16)]];
      pillows.forEach(([sg,pc]) => {
        const px=x+w/2+sg*(w*(n>1?.28:0))-pw/2, py=sy+sh*.14;
        s += qLo(px+7,py+9,pw,ph,.15,22) + rc(px,py,pw,ph,pc,'rx="36"');
        s += qHi(px+8,py+8,pw-16,ph*.34,.18,26);
        s += qL(px+pw*.5,py+12,px+pw*.5,py+ph-12,'stroke="#fff" stroke-width="2" opacity=".2"');
        s += qSeam(px+10,py+ph*.5,px+pw-10,py+ph*.5,.3);
      });
      // 四角木脚（俯视）
      [[x+32,y+32],[x+w-32,y+32],[x+32,y+d-32],[x+w-32,y+d-32]].forEach(([px,py]) =>
        s += qR(px-13,py-13,26,26,shade(c,.5),'rx="8" opacity=".5"'));
      return s;
    }
    case 'cornersofa': {
      const k = Math.min(950,d*.56,w*.4), b = 220, dk = shade(c,.83);
      let s = pa(`M${x} ${y}H${x+w}V${y+k}H${x+k}V${y+d}H${x}Z`, dk);
      s += qHi(x+14,y+14,w-28,k-28,.14,50) + qLo(x,y+k-40,w,40,.12,20);
      const cw = (w-b-200)/2, segs = [[x+b,y+b,cw,k-b-30],[x+b+cw,y+b,cw,k-b-30],[x+b,y+k,k-b-30,d-k-200]];
      segs.forEach(([px,py,pw,ph]) => {
        s += rc(px,py,pw,ph,c,'rx="40"');
        s += qHi(px+10,py+8,pw-20,ph*.3,.18,30) + qLo(px+6,py+ph-26,pw-12,24,.1,16);
        s += qSeam(px+pw*.5,py+12,px+pw*.5,py+ph-12,.16);
      });
      // 靠背拉扣
      for (let i=0;i<4;i++) s += qTuft(x+b+cw*(i+.5)/2, y+b*.5, 14);
      // 三段包边
      s += rc(x,y,w,b,dk,'rx="50"') + rc(x,y,b,d,dk,'rx="50"')
        + rc(x+w-200,y,200,k,dk,'rx="50"') + rc(x,y+d-200,k,200,dk,'rx="50"');
      s += qHi(x+16,y+8,w-32,b*.3,.15,40) + qHi(x+8,y+16,b*.3,d-32,.15,40);
      // 抱枕
      const pw=Math.min(cw*.42,300), ph=Math.min(k*.36,220);
      [[-1,shade(c,.8)],[1,shade(c,1.16)]].forEach(([sg,pc]) => {
        const px=x+w/2+sg*w*.22-pw/2, py=y+b+40;
        s += qLo(px+6,py+8,pw,ph,.14,20) + rc(px,py,pw,ph,pc,'rx="34"') + qHi(px+8,py+8,pw-16,ph*.3,.18,26) + qSeam(px+10,py+ph*.5,px+pw-10,py+ph*.5,.3);
      });
      return s;
    }
    case 'nightstand': return rc(x,y,w,d,c,'rx="30"') + `<circle r="${m*.24}" fill="#fff6dd" ${ST}/>` + `<circle r="${m*.08}" fill="${shade(c,.8)}" ${ST}/>`;
    case 'wardrobe': {
      let s = rc(x,y,w,d,c) + ln(x+50,0,x+w-50,0);
      for (let hx = x+160; hx < x+w-100; hx += 180) s += ln(hx-45,-d*.28,hx+45,d*.28,'opacity=".6"');
      return s;
    }
    case 'premiumshoecab': {
      /* 高端定制鞋柜：三扇胶囊形藤编门 + 暖光开放格 + 格栅抽屉 + 通高对开门（俯视缩略） */
      const WL = w * .60, xd = x + WL, WR = w - WL;
      const cane = '#d9cbb0', caneDot = '#b09a79', brass = '#c9a45d';
      let s = qR(x, y, w, d, shade(c, .52), 'rx="10"')
        + qR(x + 5, y + 5, w - 10, d - 10, c, 'rx="7"')
        + qR(x + 8, y + 8, w - 16, 6, '#ffffff', 'rx="3" opacity=".14"');
      /* 左区：三扇拱形藤编门 —— 深木框 + 米白藤编面 + 交叉编织网格 + 黄铜圆点拉手 */
      const dw = (WL - 10) / 3, pad = Math.min(d * .15, 52);
      for (let i = 0; i < 3; i++){
        const cx = x + 5 + dw * (i + .5);
        s += qR(cx - dw / 2 + 3, y + pad, dw - 6, d - pad * 2 - 18, shade(c, .4), `rx="${(dw - 6) * .38}"`);
        s += qR(cx - dw / 2 + 9, y + pad + 6, dw - 18, d - pad * 2 - 30, cane, `rx="${(dw - 18) * .32}"`);
        const gw = dw - 26, gh = d - pad * 2 - 42, gx = cx - gw / 2, gy = y + pad + 12;
        const cols = Math.max(3, Math.round(gw / 36)), rows = Math.max(2, Math.round(gh / 34));
        for (let a = 1; a < cols; a++) s += qL(gx + gw * a / cols, gy + 7, gx + gw * a / cols, gy + gh - 7,
          `stroke="${caneDot}" stroke-width="2" opacity=".55"`);
        for (let b = 1; b < rows; b++) s += qL(gx + 7, gy + gh * b / rows, gx + gw - 7, gy + gh * b / rows,
          `stroke="${caneDot}" stroke-width="2" opacity=".55"`);
        s += qE(cx, y + d - pad - 36, 6, 6, brass) + qE(cx - 1.6, y + d - pad - 37.6, 2, 2, '#ffffff', 'opacity=".5"');
      }
      /* 开放格暖光灯带 + 格栅抽屉竖纹（沿柜体前沿） */
      s += qR(x + 10, y + d - 46, WL - 20, 8, '#e2944a', 'rx="4" opacity=".82"')
        + qR(x + 10, y + d - 51, WL - 20, 5, '#ffd8a0', 'rx="2" opacity=".55"');
      const gy2 = y + d - 34, gh2 = 20;
      s += qR(x + 10, gy2, WL - 20, gh2, shade(c, .5), 'rx="3"');
      for (let k = 1; k < 46; k++) s += qL(x + 10 + (WL - 20) * k / 46, gy2 + 2, x + 10 + (WL - 20) * k / 46, gy2 + gh2 - 2,
        `stroke="${k % 2 ? shade(c, 1.18) : shade(c, .32)}" stroke-width="2.2" opacity=".85"`);
      for (let k = 0; k < 3; k++) s += qE(x + 10 + (WL - 20) * (k + .5) / 3, gy2 + gh2 / 2, 5, 5, brass);
      /* 左右分区立板 */
      s += qR(xd - 4, y + 4, 8, d - 8, shade(c, .46), 'rx="2"');
      /* 右区：通高对开门 —— 竖向木纹 + 中缝 + 一对黄铜圆点 */
      const rpw = (WR - 12) / 2;
      for (let i = 0; i < 2; i++){
        const cx = xd + 6 + rpw * (i + .5);
        s += qR(cx - rpw / 2 + 3, y + 9, rpw - 6, d - 18, shade(c, .94), 'rx="5"');
        for (let k = 1; k < 9; k++) s += qL(cx - rpw / 2 + 3 + (rpw - 6) * k / 9, y + 13,
          cx - rpw / 2 + 3 + (rpw - 6) * k / 9, y + d - 13, `stroke="${shade(c, 1.18)}" stroke-width="2.2" opacity=".26"`);
        s += qE(i === 0 ? cx + rpw / 2 - 18 : cx - rpw / 2 + 18, y + d * .5, 6, 6, brass);
      }
      /* 底部悬空鞋区浅色带 */
      s += qR(x + 10, y + d - 9, w - 20, 5, shade(c, 1.3), 'rx="2" opacity=".7"');
      return s;
    }
    case 'cabinet': case 'shoecab': {
      let s = rc(x,y,w,d,c) + qWood(x,y,w,d,3);
      s += qHi(x+10,y+8,w-20,d*.3,.14,10) + qLo(x,y+d-22,w,22,.12,8);
      const n = Math.max(2,Math.round(w/500));
      for (let i=1;i<n;i++) s += qL(x+w*i/n,y+12,x+w*i/n,y+d-12,`stroke="${shade(c,.68)}" stroke-width="2" opacity=".5"`);
      for (let i=0;i<n;i++){
        const cx=x+w*(i+.5)/n;
        s += qR(cx-40,y+d*.45,80,7,shade(c,.5),'rx="3" opacity=".75"');
        s += qR(cx-40,y+d*.45-16,80,3,'#ffffff','rx="2" opacity=".35"');
      }
      return s;
    }
    case 'dresser': return rc(x,y,w,d,c,'rx="20"') + rc(x+w*.2,y,w*.6,55,'#dfe9ee') + ec(0,d/2+180,160,140,shade(c,.9));
    case 'desk': return rc(x,y,w,d,c,'rx="20"') + rc(-w*.18,y+50,w*.36,45,'#555') + rc(-w*.14,y+d*.45,w*.28,d*.28,'#f4f4f4','rx="10"');
    case 'chair': return rc(x+25,y+d*.16,w-50,d*.84-10,c,'rx="60"') + rc(x,y,w,d*.2,shade(c,.78),'rx="40"');
    case 'bookshelf': { let s = rc(x,y,w,d,c); for (let bx = x+400; bx < x+w-50; bx += 400) s += ln(bx,y,bx,y+d); return s; }
    case 'baycushion': return rc(x,y,w,d,c,'rx="60"') + rc(x+60,y+80,w-120,Math.min(300,d*.2),'#fff','rx="60"') + rc(x+60,y+d-80-Math.min(300,d*.2),w-120,Math.min(300,d*.2),'#fff','rx="60"');
    case 'coffeetable': {
      let s = rc(x,y,w,d,c,'rx="80"');
      s += qLo(x+18,y+d-70,w-36,60,.12,40);
      s += rc(x+34,y+34,w-68,d-68,shade(c,1.07),'rx="56"');
      s += qStone(x+34,y+34,w-68,d-68);
      s += qGlass(x+34,y+34,w-68,d-68);
      // 台面边高光 / 倒角
      s += qR(x+34,y+34,w-68,12,'#ffffff','rx="6" opacity=".4"') + qR(x+34,y+d-46,w-68,10,'#000000','rx="5" opacity=".12"');
      // 托盘 + 书 + 杯
      s += qLo(x+w*.14,y+d*.2,w*.3,d*.45,.1,18) + rc(x+w*.14,y+d*.2,w*.3,d*.45,shade(c,.78),'rx="18"');
      s += rc(x+w*.16,y+d*.24,w*.26,d*.1,'#f3ece0','rx="6"') + rc(x+w*.17,y+d*.36,w*.24,d*.08,'#b98f6e','rx="6"');
      s += qE(x+w*.74,y+d*.62,w*.05,d*.08,'#fff','opacity=".8"') + qE(x+w*.74,y+d*.62,w*.032,d*.055,shade(c,.5),'opacity=".9"');
      return s;
    }
    case 'tvstand': {
      let s = rc(x,y,w,d,c) + qWood(x,y,w,d,3);
      s += qHi(x+10,y+8,w-20,d*.28,.16,10) + qLo(x,y+d-24,w,24,.12,8);
      const n = Math.max(2,Math.round(w/700));
      for (let i=1;i<n;i++) s += qL(x+w*i/n,y+14,x+w*i/n,y+d-14,`stroke="${shade(c,.7)}" stroke-width="2" opacity=".55"`);
      for (let i=0;i<n;i++){
        const cx=x+w*(i+.5)/n;
        s += qR(cx-w/n*.16,y+d*.42,w/n*.32,6,shade(c,.55),'rx="3" opacity=".7"');
      }
      // 电视屏幕 + 底座 + 反光
      const tw=Math.min(w*.62,1500), tx=-tw/2, ty=y+d+Math.min(50,d*.14);
      s += qR(tx,ty,tw,Math.min(60,d*.16),shade(c,.7),'rx="8"');
      s += qR(tx+40,ty-tw*.3,tw-80,tw*.32,'#20242a','rx="12"');
      s += qR(tx+52,ty-tw*.3+10,tw-104,tw*.32-20,'#2f4a63','rx="8" opacity=".55"');
      s += qP(`M${tx+70} ${ty-tw*.3+14}H${tx+tw*.34}V${ty-8}H${tx+70}Z`,'#ffffff','opacity=".09"');
      return s;
    }
    case 'rug': {
      // 户外地垫：粗编织格 + 双层包边 + 四周流苏，比室内地毯更醒目
      if (/户外|outdoor|地垫/i.test((meta&&meta.name)||'')){
        let s = qLo(x+20,y+20,w-40,d-40,.1,30);
        s += rc(x,y,w,d,shade(c,.96),'rx="24"');
        const nx=14, ny=10;
        for(let i=0;i<nx;i++) for(let j=0;j<ny;j++){
          const px=x+60+i*(w-120)/nx, py=y+60+j*(d-120)/ny;
          s += qR(px,py,(w-120)/nx-6,(d-120)/ny-6,(i+j)%2?shade(c,1.12):shade(c,.85),'rx="4" opacity=".72"');
        }
        s += rc(x+40,y+40,w-80,d-80,'none',`rx="18" stroke="${shade(c,.58)}" stroke-width="6" opacity=".65"`);
        const nf=Math.max(2,Math.floor(w/90));
        for(let i=0;i<nf;i++){
          const px=x+50+i*(w-100)/Math.max(1,nf-1);
          s += qL(px,y-20,px,y+16,`stroke="${shade(c,.68)}" stroke-width="4" opacity=".7"`);
          s += qL(px,y+d-16,px,y+d+20,`stroke="${shade(c,.68)}" stroke-width="4" opacity=".7"`);
        }
        s += qHi(x+50,y+50,w*.4,d*.08,.14,10);
        return s;
      }
      let s = rc(x,y,w,d,c,'rx="40" fill-opacity=".72"');
      // 织纹：经纬细线 + 斜纹颗粒
      for (let i=1;i<14;i++) s += qL(x+w*i/14,y+30,x+w*i/14,y+d-30,'stroke="#fff" stroke-width="2" opacity=".13"');
      for (let j=1;j<10;j++) s += qL(x+30,y+d*j/10,x+w-30,y+d*j/10,'stroke="#000" stroke-width="2" opacity=".09"');
      // 双层边框 + 中央菱形纹
      s += rc(x+55,y+55,w-110,d-110,'none','rx="28" stroke-dasharray="3 3" opacity=".55"');
      s += rc(x+95,y+95,w-190,d-190,'none','rx="20" opacity=".45"');
      for (let i=0;i<3;i++) s += qP(`M${-w*.18+i*w*.18} ${0}L0 ${-d*.2+i*d*.2}L${w*.18-i*w*.18} ${0}L0 ${d*.2-i*d*.2}Z`,'none',`stroke="${shade(c,.72)}" stroke-width="3" opacity=".3"`);
      // 四周流苏
      for (let i=0;i<Math.floor(w/70);i++){ const px=x+40+i*(w-80)/Math.max(1,Math.floor(w/70)-1); s += qL(px,y-24,px,y+10,`stroke="${shade(c,.8)}" stroke-width="3" opacity=".65"`) + qL(px,y+d-10,px,y+d+24,`stroke="${shade(c,.8)}" stroke-width="3" opacity=".65"`); }
      s += qHi(x+20,y+20,w-40,d*.16,.1,30);
      return s;
    }
    case 'plant': {
      // 陶盆 + 多层叶簇 + 叶脉 + 花，带盆沿高光与落地阴影
      const leafy = ['#5f8f4e','#7eab62','#4e7a40','#8fad6a','#6f9f5e'];
      let s = qE(0, m*.34, m*.26, m*.075, '#000', 'opacity=".12"');
      s += pa(`M${-m*.27} ${m*.1}L${-m*.21} ${m*.44}Q0 ${m*.5} ${m*.21} ${m*.44}L${m*.27} ${m*.1}Z`, '#c9a27a');
      s += qR(-m*.23,m*.16,m*.46,m*.24,'#a67f5c','opacity=".28"');
      s += rc(-m*.3,m*.06,m*.6,m*.11,shade('#c9a27a',1.14),'rx="9"');
      s += qHi(-m*.25,m*.08,m*.22,m*.035,.3,5);
      s += ec(0,m*.11,m*.27,m*.07,'#3d2f22');
      // 叶簇：三层叶丛从盆心向四周发散——底层 9 片长叶定轮廓、中层 7 片填缝、
      // 中心 4 片小叶盖住盆口。叶片长轴沿半径方向（qLeafS 椭圆默认长轴沿 x，
      // 旋转角度取方位角本身），半径 / 大小 / 角度都带确定性抖动，天然错落，
      // 不再是旧版「沿两圈同心圆排一圈空心花环」的效果。
      const rndL = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
      const cy0 = -m * .12;
      // 朝下（y+ 方向）的叶子大幅收短，避免垂到花盆正面盖住盆身
      for (let k = 0; k < 9; k++){
        const a = k * Math.PI * 2 / 9 + (rndL(k) - .5) * .5;
        const down = Math.max(0, Math.sin(a));
        const rr = m * (.10 + rndL(k + 9) * .09);
        const L = m * (.30 + rndL(k + 21) * .10) * (1 - down * .55);
        const Wd = m * (.095 + rndL(k + 33) * .028);
        s += qLeafS(Math.cos(a) * rr, Math.sin(a) * rr * .9 + cy0, L, Wd,
                    a * 180 / Math.PI + (rndL(k + 45) - .5) * 16, leafy[k % 5], .93);
      }
      for (let k = 0; k < 7; k++){
        const a = k * Math.PI * 2 / 7 + 2.1 + (rndL(k + 41) - .5) * .6;
        const down = Math.max(0, Math.sin(a));
        const rr = m * (.05 + rndL(k + 55) * .06);
        const L = m * (.21 + rndL(k + 67) * .06) * (1 - down * .45);
        const Wd = m * (.085 + rndL(k + 79) * .022);
        s += qLeafS(Math.cos(a) * rr, Math.sin(a) * rr * .9 + cy0, L, Wd,
                    a * 180 / Math.PI + (rndL(k + 91) - .5) * 26, leafy[(k + 2) % 5], .95);
      }
      for (let k = 0; k < 4; k++){
        const a = k * Math.PI / 2 + .4 + (rndL(k + 101) - .5) * .5;
        s += qLeafS(Math.cos(a) * m * .03, Math.sin(a) * m * .027 + cy0, m * .15, m * .075,
                    a * 180 / Math.PI + (rndL(k + 111) - .5) * 40, leafy[k % 5], .97);
      }
      if (/花|flower/i.test((meta&&meta.name)||'')) for(let k=0;k<4;k++){
        const a=k*1.6+.4; s += qBloomS(Math.cos(a)*m*.22,Math.sin(a)*m*.18-m*.16,m*.085,['#f3e6d8','#e8a090','#f6d27a','#d4a5c8'][k]);
      }
      return s;
    }
    /* ===== 3 款配套桌椅（2D 俯视图例）===== */
    case 'chinesetable': {
      // 新中式长餐桌：深木台面 + 冰盘沿内框 + 四角回纹 + 拼板中缝 + 桌上茶具
      const wood = shade(c, 1.08), dk = shade(c, .58), ink = shade(c, 1.42);
      let s = qLo(x + 20, y + 20, w - 40, d - 40, .18, 14);
      s += rc(x, y, w, d, wood, 'rx="12"');
      s += qWood(x + 24, y + 24, w - 48, d - 48, 5);
      for (let i = 1; i < 5; i++){
        const yy = y + d * i / 5;
        s += `<path d="M${x + 44} ${yy} Q${-w * .18} ${yy - d * .035} 0 ${yy + d * .012} T${x + w - 44} ${yy - d * .01}" fill="none" stroke="${shade(c, .68)}" stroke-width="2.6" opacity=".4"/>`;
      }
      s += rc(x + 36, y + 36, w - 72, d - 72, 'none', 'rx="8" opacity=".55"');
      s += qHi(x + 36, y + 36, w - 72, d * .085, .17, 8);
      s += `<line x1="0" y1="${y + 44}" x2="0" y2="${y + d - 44}" stroke="${dk}" stroke-width="2.6" opacity=".4"/>`;
      const g0 = Math.min(w, d) * .13;
      [[x + 52, y + 52, 1, 1], [x + w - 52, y + 52, -1, 1],
       [x + 52, y + d - 52, 1, -1], [x + w - 52, y + d - 52, -1, -1]].forEach(([px, py, sx, sy]) => {
        s += `<path d="M${px + sx * g0} ${py}V${py + sy * g0}H${px}V${py + sy * g0 * .48}H${px + sx * g0 * .52}V${py + sy * g0 * .78}H${px + sx * g0 * .2}" fill="none" stroke="${ink}" stroke-width="3.6" opacity=".7" stroke-linejoin="miter"/>`;
      });
      s += rc(-w * .13, -d * .12, w * .26, d * .24, shade(c, .68), 'rx="10" opacity=".9"');
      s += ec(-w * .025, 0, w * .048, d * .075, '#e9dfcb') + qE(-w * .04, -d * .02, w * .016, d * .022, '#ffffff', 'opacity=".4"');
      [-1, 1].forEach(k => s += ec(w * .075, k * d * .065, w * .016, d * .028, '#f2ead9'));
      return s;
    }
    case 'mingchair': {
      // 明式圈椅：月牙形扶手圈 + 中央靠背板 + 座面软垫 + 踏脚枨
      const dk = shade(c, .62), wood = shade(c, 1.12), R = w * .43, cy = y + d * .36;
      let s = `<path d="M${-R} ${cy + d * .1} Q0 ${y - d * .12} ${R} ${cy + d * .1}" fill="none" stroke="${dk}" stroke-width="${Math.min(w, d) * .115}" stroke-linecap="round" opacity=".92"/>`;
      s += `<path d="M${-R * .96} ${cy + d * .1} Q0 ${y - d * .04} ${R * .96} ${cy + d * .1}" fill="none" stroke="${wood}" stroke-width="${Math.min(w, d) * .045}" stroke-linecap="round" opacity=".85"/>`;
      [-1, 1].forEach(k => s += ec(k * R, cy + d * .1, w * .055, d * .05, dk));
      s += rc(-w * .13, y + d * .1, w * .26, d * .34, shade(c, .9), 'rx="18"');
      s += qHi(-w * .11, y + d * .12, w * .22, d * .07, .15, 14);
      s += ec(0, y + d * .28, w * .055, d * .06, shade(c, .6), 'opacity=".6"');
      s += rc(x + w * .12, y + d * .38, w * .76, d * .46, wood, 'rx="20"');
      s += rc(x + w * .18, y + d * .44, w * .64, d * .34, shade(c, 1.2), 'rx="16" opacity=".7"');
      s += `<line x1="${x + w * .16}" y1="${y + d * .9}" x2="${x + w * .84}" y2="${y + d * .9}" stroke="${dk}" stroke-width="7" stroke-linecap="round" opacity=".8"/>`;
      return s;
    }
    case 'tuliptable': {
      // 郁金香岩板圆桌：浅石纹圆台 + 中央单柱底座
      let s = qE(0, d * .045, w * .48, d * .46, '#000000', 'opacity=".12"');
      s += ec(0, 0, w / 2, d / 2, shade(c, 1.06));
      s += qStone(-w * .42, -d * .42, w * .84, d * .84);
      for (let i = 0; i < 3; i++){
        const yy = -d * .22 + i * d * .2;
        s += `<path d="M${-w * .34} ${yy} Q${-w * .1} ${yy - d * .1} ${w * .08} ${yy + d * .04} T${w * .34} ${yy - d * .02}" fill="none" stroke="${shade(c, .76)}" stroke-width="3" opacity=".5"/>`;
      }
      s += ec(0, 0, w * .44, d * .44, 'none', 'opacity=".45"');
      s += qE(-w * .17, -d * .19, w * .25, d * .11, '#ffffff', 'opacity=".28"');
      s += `<path d="M${-w * .3} ${-d * .16} Q0 ${-d * .36} ${w * .3} ${-d * .1}" fill="none" stroke="#ffffff" stroke-width="10" opacity=".16" stroke-linecap="round"/>`;
      s += ec(0, 0, w * .12, d * .12, shade(c, .82)) + ec(0, 0, w * .065, d * .065, shade(c, 1.2));
      return s;
    }
    case 'shellchair': {
      // 贝壳餐椅：扇形壳背 + 放射褶皱 + 座垫 + 底座
      const dk = shade(c, .7), lt = shade(c, 1.16);
      let s = qLo(x + w * .08, y + d * .08, w * .84, d * .84, .13, 60);
      s += ec(0, y + d * .32, w * .45, d * .34, dk);
      s += ec(0, y + d * .33, w * .4, d * .29, c);
      for (let i = -3; i <= 3; i++){
        const a = i * .34;
        s += qL(0, y + d * .64, Math.sin(a) * w * .37, y + d * .33 - Math.cos(a) * d * .27,
          `stroke="${shade(c, .58)}" stroke-width="3.2" opacity=".55"`);
      }
      s += ec(0, y + d * .62, w * .34, d * .23, lt, 'opacity=".96"');
      s += qHi(-w * .22, y + d * .5, w * .44, d * .1, .18, 30);
      s += ec(0, y + d * .9, w * .075, d * .05, shade(c, .6));
      return s;
    }
    case 'ovaltable': {
      // 北欧椭圆餐桌：整块椭圆木台面 + 拼板木纹 + 四腿位置
      let s = qE(0, d * .045, w * .48, d * .46, '#000000', 'opacity=".12"');
      s += ec(0, 0, w / 2, d / 2, shade(c, 1.07));
      s += ec(0, 0, w * .455, d * .455, 'none', 'opacity=".5"');
      for (let i = -2; i <= 2; i++){
        const yy = i * d * .135;
        const hw = w * .46 * Math.sqrt(Math.max(.08, 1 - Math.pow(yy / (d / 2), 2)));
        s += `<path d="M${-hw} ${yy} Q0 ${yy - d * .045} ${hw} ${yy + d * .01}" fill="none" stroke="${shade(c, .72)}" stroke-width="2.6" opacity=".38"/>`;
      }
      s += qE(-w * .2, -d * .2, w * .24, d * .1, '#ffffff', 'opacity=".2"');
      [[-.3, -.27], [.3, -.27], [-.3, .27], [.3, .27]].forEach(([a, b]) =>
        s += ec(a * w, b * d, w * .022, d * .036, shade(c, .58), 'opacity=".45"'));
      return s;
    }
    case 'windsorchair': {
      // 温莎椅：弓形靠背 + 七根放射辐条 + 鞍形座面
      const dk = shade(c, .6), lt = shade(c, 1.14), R = w * .43;
      let s = `<path d="M${-R} ${y + d * .36} Q0 ${y - d * .16} ${R} ${y + d * .36}" fill="none" stroke="${dk}" stroke-width="${Math.min(w, d) * .085}" stroke-linecap="round"/>`;
      for (let i = -3; i <= 3; i++){
        const t = i / 3, px = t * w * .33;
        s += qL(px * .7, y + d * .56, px, y + d * .2 + Math.abs(t) * d * .12,
          `stroke="${dk}" stroke-width="4.6" opacity=".85"`);
      }
      s += ec(0, y + d * .6, w * .4, d * .3, c);
      s += ec(0, y + d * .58, w * .33, d * .23, lt, 'opacity=".75"');
      s += qHi(-w * .22, y + d * .44, w * .44, d * .1, .16, 30);
      s += ec(0, y + d * .9, w * .055, d * .04, dk, 'opacity=".6"');
      return s;
    }
    case 'table': {
      // 户外餐桌：柚木板条 + 倒角亮边 + 中央伞孔；非户外保持原来的简洁图例
      const out = /户外|庭院|花园|outdoor|patio/i.test((meta&&meta.name)||'');
      if (!out) return rc(x,y,w,d,c,'rx="30"') + rc(x+50,y+50,w-100,d-100,'none','rx="20" opacity=".4"');
      let s = qLo(x+30,y+30,w-60,d-60,.14,26);
      s += rc(x,y,w,d,shade(c,1.04),'rx="26"');
      s += qPlankS(x+42,y+42,w-84,d-84,4,c);
      s += qHi(x+42,y+42,w-84,d*.11,.16,14);
      s += qP(`M${x+42} ${y+42}H${x+w-42}`,'none',`stroke="${shade(c,1.3)}" stroke-width="4" opacity=".4"`);
      s += ec(0,0,m*.075,m*.075,shade(c,.6)) + ec(0,0,m*.045,m*.045,'#3a352f','opacity=".6"');
      [[x+52,y+52],[x+w-92,y+52],[x+52,y+d-92],[x+w-92,y+d-92]].forEach(([px,py])=>s+=rc(px,py,40,40,shade(c,.58),'rx="8" opacity=".45"'));
      return s;
    }
    case 'roundtable': {
      const out = /户外|庭院|花园|outdoor|patio/i.test((meta&&meta.name)||'');
      if (!out) return ec(0,0,w/2,d/2,c) + ec(0,0,w/2-50,d/2-50,'none','opacity=".4"');
      let s = qE(0,d*.05,w*.48,d*.46,'#000','opacity=".12"');
      s += ec(0,0,w/2,d/2,shade(c,1.05));
      s += qPlankS(-w*.44,-d*.42,w*.88,d*.84,5,c);
      s += ec(0,0,w*.46,d*.46,'none',`stroke="${shade(c,1.25)}" stroke-width="6" opacity=".5"`);
      s += qE(-w*.14,-d*.16,w*.24,d*.1,'#ffffff','opacity=".16"');
      s += ec(0,0,m*.07,m*.07,shade(c,.55)) + ec(0,0,m*.042,m*.042,'#3a352f','opacity=".6"');
      return s;
    }
    case 'counter': return rc(x,y,w,d,c) + ln(x,y+d-40,x+w,y+d-40,DASH);
    case 'kitchencab': {
      // 半截矮橱柜：台面亮边 + 上抽屉横拉手 + 双门对开（中缝 + 两点拉手）+ 靠墙虚线
      const dy = y + Math.min(110, d * .2), my = (dy + y + d) / 2;
      return rc(x,y,w,d,c,'rx="16"') + rc(x,y,w,dy-y,shade(c,1.1),'rx="12"')
        + ln(x,dy,x+w,dy)
        + ln(0,dy,0,y+d)
        + rc(-46,my-11,26,22,shade(c,.58),'rx="5"') + rc(20,my-11,26,22,shade(c,.58),'rx="5"')
        + rc(-34,y+(dy-y)*.36,68,18,shade(c,.58),'rx="6"')
        + ln(x,y+d-40,x+w,y+d-40,DASH);
    }
    case 'stove': {
      let s = rc(x,y,w,d,'#2f2f2f','rx="20"'); const r = m*.26;
      const pts = w/d > 1.4 ? [[-w/4,0],[w/4,0]] : [[-w/4,-d/4],[w/4,-d/4],[-w/4,d/4],[w/4,d/4]];
      pts.forEach(([px,py]) => s += `<circle cx="${px}" cy="${py}" r="${r}" fill="none" stroke="#bbb" stroke-width="1" vector-effect="non-scaling-stroke"/><circle cx="${px}" cy="${py}" r="${r*.45}" fill="#666"/>`);
      return s;
    }
    case 'ksink': return rc(x,y,w,d,c,'rx="20"') + rc(x+w*.06,y+d*.18,w*.42,d*.66,'#fff','rx="50"') + rc(x+w*.52,y+d*.18,w*.42,d*.66,'#fff','rx="50"') + `<circle cx="0" cy="${y+d*.09}" r="22" fill="#999"/>`;
    case 'fridge': return rc(x,y,w,d,c,'rx="30"') + ln(x,y+d*.14,x+w,y+d*.14) + ln(0,y+d*.14,0,y+d) + rc(-70,y+d*.5,40,d*.25,'#aab') + rc(30,y+d*.5,40,d*.25,'#aab');
    case 'toilet': return rc(x+w*.04,y,w*.92,d*.27,c,'rx="30"') + ec(0,y+d*.27+d*.36,w*.47,d*.36,c) + ec(0,y+d*.27+d*.4,w*.3,d*.24,'#eef4f7');
    case 'vanity': return rc(x,y,w,d,c,'rx="20"') + ec(0,y+d*.57,Math.min(w*.32,260),d*.28,'#fff') + `<circle cx="0" cy="${y+d*.17}" r="26" fill="#999"/>`;
    case 'shower': return rc(x,y,w,d,c) + ln(x,y,x+w,y+d,DASH) + ln(x+w,y,x,y+d,DASH) + `<circle r="45" fill="#fff" ${ST}/>`;
    case 'bathtub': return rc(x,y,w,d,c,'rx="40"') + rc(x+80,y+80,w-160,d-160,'#fff',`rx="${m*.33}"`) + `<circle cx="${x+w-260}" cy="0" r="35" fill="#ccc" ${ST}/>`;
    case 'washer': case 'dryer': return rc(x,y,w,d,c,'rx="30"') + rc(x,y,w,d*.14,shade(c,.9)) + `<circle cy="${d*.06}" r="${m*.34}" fill="#fff" ${ST}/><circle cy="${d*.06}" r="${m*.24}" fill="${t==='dryer'?'#e9dccb':'#cfdde4'}" ${ST}/>`;
    case 'crib': {
      let s = rc(x,y,w,d,c,'rx="20"') + rc(x+45,y+45,w-90,d-90,'#fff','rx="20"');
      for (let sx = x+90; sx < x+w-60; sx += 90) s += ln(sx,y,sx,y+45,'opacity=".5"') + ln(sx,y+d-45,sx,y+d,'opacity=".5"');
      return s;
    }
    case 'beanbag': {
      let s = ec(0,0,w/2,d/2,c);
      s += qHi(-w*.28,-d*.3,w*.56,d*.24,.14,60) + qLo(-w*.42,d*.12,w*.84,d*.3,.12,60);
      // 放射缝线
      for (let k=0;k<8;k++){
        const a=k*Math.PI/4;
        s += qL(Math.cos(a)*w*.12,Math.sin(a)*d*.12,Math.cos(a)*w*.46,Math.sin(a)*d*.46,`stroke="${shade(c,.68)}" stroke-width="2" stroke-dasharray="14 10" opacity=".55"`);
      }
      s += ec(-w*.04,-d*.06,w*.3,d*.28,shade(c,1.12),'opacity=".5"');
      return s;
    }
    case 'sidetable': {
      let s = ec(0,0,w/2,d/2,c);
      s += qStone(-w*.42,-d*.42,w*.84,d*.84) + qGlass(-w*.42,-d*.42,w*.84,d*.84);
      s += ec(0,0,w*.34,d*.34,'none','opacity=".4"');
      s += qE(-w*.12,-d*.14,w*.24,d*.16,'#ffffff','opacity=".18"');
      // 台面上一只小杯
      s += qE(w*.16,d*.12,w*.075,d*.075,'#ffffff','opacity=".9"') + qE(w*.16,d*.12,w*.045,d*.045,shade(c,.55),'opacity=".8"');
      return s;
    }
    case 'floorlamp': {
      let s = `<circle r="${m*.5}" fill="#fff6dd" fill-opacity=".85" ${ST}/>`;
      s += `<circle r="${m*.4}" fill="#fff9ec" fill-opacity=".5" ${ST}/>`;
      for (let k=0;k<12;k++){
        const a=k*Math.PI/6;
        s += qL(Math.cos(a)*m*.12,Math.sin(a)*m*.12,Math.cos(a)*m*.34,Math.sin(a)*m*.34,`stroke="${shade(c,.7)}" stroke-width="1.6" opacity=".35"`);
      }
      s += `<circle r="${m*.32}" fill="none" ${ST} ${DASH}/>` + `<circle r="${m*.07}" fill="${c}" ${ST}/>`;
      s += `<circle r="${m*.03}" fill="#fff3d0" ${ST}/>`;
      return s;
    }
    case 'tablelamp': return `<circle r="${m*.42}" fill="#fff6dd" fill-opacity=".7" ${ST}/>` + rc(-m*.18,-m*.18,m*.36,m*.36,c,'rx="8"') + `<circle r="${m*.08}" fill="#ffe9b0" ${ST}/>`;
    case 'pendant':
    case 'chandelier':
    case 'ceilinglamp': {
      let s = `<circle r="${m*.48}" fill="#fff8e6" fill-opacity=".75" ${ST}/>`;
      if (t === 'chandelier'){
        for (let k = 0; k < 6; k++) s += `<circle cx="${Math.cos(k*Math.PI/3)*m*.28}" cy="${Math.sin(k*Math.PI/3)*m*.28}" r="${m*.08}" fill="#ffe9b0" ${ST}/>`;
      } else if (t === 'ceilinglamp') s += ec(0,0,m*.32,m*.32,c) + ec(0,0,m*.18,m*.18,'#fff6dd');
      else s += ec(0,0,m*.22,m*.22,c) + `<circle r="${m*.08}" fill="#ffe9b0" ${ST}/>`;
      return s;
    }
    case 'walllamp': return rc(x,y+d*.15,w,d*.7,c,'rx="10"') + rc(x+w*.15,y+d*.28,w*.7,d*.4,'#fff6dd','rx="6"');
    case 'tracklight': {
      let s = rc(x,y+d*.35,w,d*.3,c,'rx="6"');
      const n = Math.max(2, Math.round(w / 350));
      for (let i = 0; i < n; i++){
        const cx = x + w * (i + .5) / n;
        s += rc(cx - 28, y + d * .15, 56, d * .7, shade(c,.7),'rx="8"') + `<circle cx="${cx}" cy="${y+d*.5}" r="18" fill="#fff6dd" ${ST}/>`;
      }
      return s;
    }
    case 'downlight': return `<circle r="${m*.45}" fill="${c}" ${ST}/>` + `<circle r="${m*.28}" fill="#fff6dd" ${ST}/>` + `<circle r="${m*.12}" fill="#ffe9b0" ${ST}/>`;
    case 'ledstrip': {
      // 拐角灯带：L 形；线性灯带：长条发光带
      if (Math.min(w, d) > Math.max(w, d) * .45){
        const t0 = Math.min(70, Math.min(w, d) * .12);
        return rc(x, y, w, t0, '#fff6dd', 'rx="8"') + rc(x, y, t0, d, '#fff6dd', 'rx="8"')
          + rc(x + 8, y + 8, w - 16, t0 - 16, shade(c, 1.05), 'rx="4"') + rc(x + 8, y + 8, t0 - 16, d - 16, shade(c, 1.05), 'rx="4"');
      }
      const alongW = w >= d;
      return alongW
        ? rc(x, y + d * .2, w, d * .6, shade(c, .9), 'rx="10"') + rc(x + 20, y + d * .32, w - 40, d * .36, '#fff6dd', 'rx="6"')
        : rc(x + w * .2, y, w * .6, d, shade(c, .9), 'rx="10"') + rc(x + w * .32, y + 20, w * .36, d - 40, '#fff6dd', 'rx="6"');
    }
    case 'crystalpendant': {
      let s = `<circle r="${m*.48}" fill="#fff8e6" fill-opacity=".7" ${ST}/>`;
      s += `<circle r="${m*.38}" fill="none" ${ST} ${DASH}/>`;
      for (let k = 0; k < 12; k++){
        const a = k * Math.PI / 6;
        s += `<circle cx="${Math.cos(a)*m*.38}" cy="${Math.sin(a)*m*.38}" r="${m*.045}" fill="#eaf3f8" ${ST}/>`;
      }
      for (let k = 0; k < 5; k++){
        const a = k * Math.PI * 2 / 5;
        s += `<circle cx="${Math.cos(a)*m*.18}" cy="${Math.sin(a)*m*.18}" r="${m*.07}" fill="#ffe9b0" ${ST}/>`;
      }
      return s;
    }
    case 'globependant': return `<circle r="${m*.48}" fill="#fff8e6" fill-opacity=".65" ${ST}/>` + ec(0,0,m*.34,m*.34,c,'fill-opacity=".7"') + `<circle r="${m*.2}" fill="#fff6dd" ${ST}/>` + `<circle r="${m*.07}" fill="#ffe9b0" ${ST}/>`;
    case 'cagependant': {
      let s = `<circle r="${m*.48}" fill="#fff8e6" fill-opacity=".6" ${ST}/>` + `<circle r="${m*.4}" fill="none" ${ST}/>`;
      for (let k = 0; k < 8; k++){
        const a = k * Math.PI / 4;
        s += ln(Math.cos(a)*m*.4, Math.sin(a)*m*.4, Math.cos(a)*m*.14, Math.sin(a)*m*.14, 'opacity=".7"');
      }
      return s + `<circle r="${m*.12}" fill="#ffe9b0" ${ST}/>`;
    }
    case 'torchere': return `<circle r="${m*.48}" fill="#fff6dd" fill-opacity=".8" ${ST}/>` + pa(`M${-m*.3} ${-m*.18} Q0 ${m*.26} ${m*.3} ${-m*.18} Z`, c) + `<circle r="${m*.07}" fill="${c}" ${ST}/>`;
    case 'tripodlamp': {
      let s = `<circle r="${m*.48}" fill="#fff6dd" fill-opacity=".7" ${ST}/>`;
      for (let k = 0; k < 3; k++){
        const a = k * Math.PI * 2 / 3;
        s += ln(0, 0, Math.cos(a)*m*.36, Math.sin(a)*m*.36, 'opacity=".7"');
      }
      return s + ec(0,0,m*.22,m*.22,c) + `<circle r="${m*.09}" fill="#ffe9b0" ${ST}/>`;
    }
    case 'bankerslamp': return `<circle r="${m*.46}" fill="#eaf6d9" fill-opacity=".7" ${ST}/>` + rc(-m*.3,-m*.14,m*.6,m*.28,'#2f6b4f','rx="14"') + rc(-m*.24,-m*.08,m*.48,m*.16,'#cfe8a0','rx="8"') + `<circle r="${m*.08}" fill="${c}" ${ST}/>`;
    case 'globetablelamp': return `<circle r="${m*.48}" fill="#fff8e6" fill-opacity=".65" ${ST}/>` + `<circle r="${m*.3}" fill="${c}" ${ST}/>` + `<circle r="${m*.2}" fill="#fff6dd" ${ST}/>` + `<circle r="${m*.07}" fill="#ffe9b0" ${ST}/>`;
    case 'sconce': {
      let s = `<circle r="${m*.48}" fill="#fff6dd" fill-opacity=".55" ${ST}/>` + rc(-m*.42,-m*.06,m*.84,m*.12,c,'rx="6"');
      [-1, 1].forEach(sg => {
        s += `<circle cx="${sg*m*.26}" cy="0" r="${m*.14}" fill="#fff6dd" ${ST}/>` + `<circle cx="${sg*m*.26}" cy="0" r="${m*.06}" fill="#ffe9b0" ${ST}/>`;
      });
      return s;
    }
    case 'bollardlight': return qE(0,0,m*.5,m*.5,'#fff1c8','opacity=".2"') + `<circle r="${m*.48}" fill="#fff6dd" fill-opacity=".6" ${ST}/>` + ec(0,0,m*.2,m*.2,c) + ec(0,0,m*.12,m*.12,'#fff6dd') + `<circle r="${m*.05}" fill="#ffe9b0" ${ST}/>`;
    case 'lantern': {
      let s = qE(0,0,m*.5,m*.5,'#ffecbf','opacity=".22"');
      s += ec(0,0,m*.34,m*.34,'#fff1c8','opacity=".32"');
      s += rc(-m*.2,-m*.24,m*.4,m*.48,shade(c,.85),'rx="10"');
      for(let k=0;k<4;k++) s += qL(-m*.16,-m*.16+k*m*.1,m*.16,-m*.16+k*m*.1,`stroke="${shade(c,.55)}" stroke-width="3" opacity=".7"`);
      s += rc(-m*.24,-m*.3,m*.48,m*.09,shade(c,.62),'rx="5"');
      s += rc(-m*.24,m*.21,m*.48,m*.07,shade(c,.62),'rx="4"');
      s += qHi(-m*.16,-m*.2,m*.14,m*.3,.14,4);
      s += ec(0,0,m*.11,m*.14,'#fff6dd','opacity=".9"');
      return s;
    }
    case 'island': return rc(x,y,w,d,c) + ln(x,y+d-250,x+w,y+d-250,DASH);
    case 'barstool': return `<circle r="${m/2}" fill="${c}" ${ST}/><circle r="${m*.3}" fill="${shade(c,1.15)}" ${ST}/>`;
    case 'waterheater': return rc(x,y,w,d,c,`rx="${d/2}" ${DASH}`) + ln(x+w*.2,0,x+w*.8,0,DASH);
    case 'tv': return rc(x,y,w,d,c,'rx="10"') + rc(x+w*.3,y+d,w*.4,Math.min(40,d),'#666');
    case 'aircon': return rc(x,y,w,d,c,'rx="30"') + ln(x+40,y+d*.72,x+w-40,y+d*.72) + ln(x+40,y+d*.86,x+w-40,y+d*.86);
    case 'acwall': {
      let s = rc(x,y,w,d,c,`rx="30" ${DASH}`);
      [.25,.5,.75].forEach(k => s += ln(x+w*k,y+d,x+w*k,y+d+200,`${DASH} opacity=".6"`));
      return s;
    }
    case 'dishwasher': return rc(x,y,w,d,c,'rx="15"') + ln(x,y+d-70,x+w,y+d-70) + rc(x+w*.3,y+d-45,w*.4,25,'#888');
    case 'ovencol': return rc(x,y,w,d,c) + ln(x,y,x+w,y+d) + ln(x+w,y,x,y+d);
    case 'purifier': return rc(x,y,w,d,c,'rx="60"') + rc(x+45,y+45,w-90,d-90,'none',`rx="40" ${DASH}`);
    case 'officechair': {
      let s = '';
      for (let k = 0; k < 5; k++) s += `<line x1="0" y1="0" x2="0" y2="${m*.48}" transform="rotate(${k*72+36})" stroke="#555" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      return s + rc(x+w*.12,y+d*.22,w*.76,d*.66,c,'rx="80"') + rc(x+w*.15,y+d*.04,w*.7,d*.16,shade(c,.78),'rx="40"')
        + rc(x+w*.02,y+d*.3,w*.1,d*.45,shade(c,.7),'rx="30"') + rc(x+w*.88,y+d*.3,w*.1,d*.45,shade(c,.7),'rx="30"');
    }
    case 'piano': {
      let s = rc(x,y,w,d*.55,c,'rx="10"') + rc(x+40,y+d*.55,w-80,d*.4,shade(c,1.4),'rx="10"');
      const kx = x+90, kw = w-180, kd = d*.2;
      s += rc(kx,y+d*.55,kw,kd,'#faf8f3');
      for (let i = 1; i < 26; i++) s += ln(kx+kw*i/26,y+d*.55,kx+kw*i/26,y+d*.55+kd,'opacity=".5"');
      return s;
    }
    case 'treadmill': return rc(x,y,w,d,c,'rx="50"') + rc(x+90,y+320,w-180,d-400,'#1c1c1e','rx="25"') + rc(x,y,w,230,shade(c,1.4),'rx="40"');
    case 'door': {
      // 平面门扇符号：门洞矩形 + 开启弧
      const T = Math.min(d, 80);
      let s = rc(x, y, w, d, '#f7f4ee');
      s += `<polygon points="${x},${y+d/2} ${x+w},${y+d/2} ${x+w},${y+d/2-T} ${x},${y+d/2-T}" fill="${c}" ${ST}/>`;
      s += `<path d="M${x+w} ${y+d/2}A${w} ${w} 0 0 0 ${x} ${y+d/2-w}" fill="none" ${ST} stroke-dasharray="6 4" opacity=".75"/>`;
      return s;
    }
    case 'gardengate': {
      // 家具库图标：双扇示意（浅色门柱 + 竖栅 + 腰梁）
      const post = Math.min(100, w * .09), gap = 14;
      const leaf = (w - post * 2 - gap * 3) / 2;
      let s = rc(x, y, w, d, '#ece8e0', 'rx="12"');
      s += rc(x + 8, y + 16, post, d - 32, '#d5d0c6', 'rx="6"');
      s += rc(x + w - post - 8, y + 16, post, d - 32, '#d5d0c6', 'rx="6"');
      s += rc(x + 10, y + 8, post - 4, 16, '#ebe7df', 'rx="3"');
      s += rc(x + w - post - 6, y + 8, post - 4, 16, '#ebe7df', 'rx="3"');
      const y0 = y + d * .16, yh = d * .68, dark = shade(c, .5);
      [0, 1].forEach(i => {
        const lx = x + post + gap + i * (leaf + gap);
        s += rc(lx, y0, leaf, yh, dark, 'rx="4"');
        const panel = Math.max(26, leaf * .2);
        const gridW = leaf - panel - 8;
        s += rc(lx + 4, y0 + yh * .42, gridW, 8, shade(c, .75), 'rx="2"');
        for (let k = 0; k < 6; k++){
          const sx = lx + 4 + gridW * (k + .5) / 6;
          s += rc(sx - 2.5, y0 + 8, 5, yh * .32, k % 2 ? shade(c, .72) : shade(c, .35), 'rx="1"');
          s += rc(sx - 2.5, y0 + yh * .5, 5, yh * .38, k % 2 ? shade(c, .72) : shade(c, .35), 'rx="1"');
        }
        s += rc(lx + leaf - panel - 2, y0 + 6, panel, yh - 12, shade(c, .32), 'rx="2"');
        s += rc(lx + leaf - panel * .55, y0 + yh * .32, 7, yh * .28, shade(c, .18), 'rx="3"');
      });
      return s;
    }
    case 'gardenfence': {
      // 围墙段：两端石柱 + 中间横栏/竖栅
      const pw = Math.min(140, w * .1), ph = d * .85;
      let s = '';
      [-1, 1].forEach(sx => {
        const px = sx < 0 ? x + 20 : x + w - pw - 20;
        s += rc(px, y + (d - ph) / 2, pw, ph, shade(c, .82), 'rx="16"');
        s += rc(px + pw * .15, y + (d - ph) / 2 - 18, pw * .7, 28, shade(c, .7), 'rx="8"');
      });
      const ix = x + pw + 50, iw = w - 2 * pw - 100;
      s += rc(ix, y + d * .28, iw, d * .12, shade(c, .9), 'rx="10"');
      s += rc(ix, y + d * .58, iw, d * .1, shade(c, .88), 'rx="8"');
      const n = Math.max(5, Math.round(iw / 120));
      for (let i = 0; i < n; i++){
        const xx = ix + iw * (i + .5) / n;
        s += rc(xx - 14, y + d * .22, 28, d * .55, shade(c, 1.05), 'rx="6"');
      }
      return s;
    }
    case 'slidedoor': {
      const leaf = w * .48, gap = w * .04;
      let s = rc(x, y, w, d, '#f7fbfd');
      s += rc(x + gap * .3, y + d * .15, leaf, d * .7, '#fff');
      s += rc(x + w - leaf - gap * .3, y + d * .15, leaf, d * .7, shade(c, 1.05));
      s += ln(x, y + d / 2, x + w, y + d / 2, 'opacity=".4"');
      return s;
    }
    case 'floor': {
      // 色板按材料类型画示意纹理，方便在库里一眼区分
      const mk = (meta && (meta.mat || meta.style)) || '';
      const key = mk + ((meta && meta.name) || '');
      let s = rc(x, y, w, d, c, 'rx="36"');
      if (/sisal|tatami|剑麻|榻榻米|编织/.test(key)){
        for (let i = 1; i < 8; i++){
          s += ln(x + 30 + i * (w - 60) / 8, y + 30, x + 30 + i * (w - 60) / 8, y + d - 30, 'opacity=".34"');
          s += ln(x + 30, y + 30 + i * (d - 60) / 8, x + w - 30, y + 30 + i * (d - 60) / 8, 'opacity=".2"');
        }
        for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++)
          if ((i + j) % 2 === 0) s += rc(x + 30 + i * (w - 60) / 7, y + 30 + j * (d - 60) / 7, (w - 60) / 7, (d - 60) / 7, shade(c, .9), 'opacity=".2"');
      } else if (/chevron|鱼骨/.test(key)){
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++){
          const px = x + w * (.08 + i * .3), py = y + d * (.22 + j * .4);
          s += pa(`M${px} ${py}L${px+w*.16} ${py+d*.14}L${px+w*.32} ${py}`, 'none', 'opacity=".6"');
        }
      } else if (/parquet|凡尔赛|拼花/.test(key)){
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++){
          const px = x + w * (.12 + i * .4), py = y + d * (.12 + j * .4);
          s += rc(px, py, w * .34, d * .34, shade(c, .93), 'rx="8" opacity=".55"');
          for (let k = 1; k < 3; k++) s += ln(px, py + d * .34 * k / 3, px + w * .34, py + d * .34 * k / 3, 'opacity=".35"');
        }
      } else if (/encaustic|花砖/.test(key)){
        s += pa(`M${x+w*.5} ${y+d*.24}Q${x+w*.72} ${y+d*.5} ${x+w*.5} ${y+d*.76}Q${x+w*.28} ${y+d*.5} ${x+w*.5} ${y+d*.24}Z`, 'none', 'opacity=".65"');
        s += ec(x + w * .5, y + d * .5, w * .07, d * .07, shade(c, .76), 'opacity=".75"');
      } else if (/subway|地铁砖|工字/.test(key)){
        for (let j = 0; j < 3; j++){
          const py = y + 30 + j * (d - 60) / 3, off = (j % 2) ? (w - 60) / 4 : 0;
          s += ln(x + 30, py, x + w - 30, py, 'opacity=".42"');
          for (let i = 0; i < 3; i++) s += ln(x + 30 + off + i * (w - 60) / 2, py, x + 30 + off + i * (w - 60) / 2, py + (d - 60) / 3, 'opacity=".3"');
        }
      } else if (/granite|花岗岩/.test(key)){
        for (let i = 0; i < 34; i++){
          const px = x + 40 + ((i * 137) % (w - 80)), py = y + 40 + ((i * 89) % (d - 80));
          s += ec(px, py, 8 + (i % 3) * 4, 6 + (i % 2) * 3, i % 2 ? shade(c, .75) : shade(c, 1.16), 'opacity=".55"');
        }
      } else if (/woodtile|369/i.test(key)){
        // 369 拼（三六九）：三行横缝，相邻行端缝依次错开 1/3 板长
        const rows = 3, oy = y + 30, ox = x + 30, iw = w - 60, rh = (d - 60) / rows, PL = iw / 2;
        for (let j = 1; j < rows; j++) s += ln(ox, oy + j * rh, ox + iw, oy + j * rh, 'opacity=".42"');
        for (let j = 0; j < rows; j++){
          const off = j * PL / 3;
          for (let k = -1; k <= 2; k++){
            const px = ox + off + k * PL;
            if (px > ox + 1 && px < ox + iw - 1)
              s += ln(px, oy + j * rh, px, oy + (j + 1) * rh, 'opacity=".38"');
          }
        }
      } else if (/wood|maple|walnut|greywood|bamboo|herringbone|smoked|cork|woodtile/i.test(mk) || /木|竹|人字/.test(key)){
        const rows = /bamboo|竹/.test(key) ? 5 : 4;
        for (let j = 1; j < rows; j++) s += ln(x + 30, y + d * j / rows, x + w - 30, y + d * j / rows, 'opacity=".4"');
        for (let j = 0; j < rows; j++){
          const yy = y + d * (j + .5) / rows, xoff = (j % 2) ? w * .35 : w * .55;
          s += ln(x + xoff, yy - d / rows * .45, x + xoff, yy + d / rows * .45, 'opacity=".35"');
        }
        if (/herringbone|人字/.test(key)){
          // 家具库缩略：45° 人字 V 示意
          const cx = x + w / 2, cy = y + d / 2, u = Math.min(w, d) * .18;
          s += pa(`M${cx-u*1.6} ${cy-u}L${cx} ${cy}L${cx-u*1.6} ${cy+u}M${cx+u*1.6} ${cy-u}L${cx} ${cy}L${cx+u*1.6} ${cy+u}`, 'none', 'opacity=".55" stroke-width="2"');
          s += pa(`M${cx-u*.3} ${cy-u*1.5}L${cx+u*1.1} ${cy-u*.2}M${cx-u*.3} ${cy+u*1.5}L${cx+u*1.1} ${cy+u*.2}`, 'none', 'opacity=".4"');
        }
      } else if (/hex|六角/.test(key)){
        const rr = m * .16;
        [[-.28, -.18],[.12, -.18],[-.08, .12],[.32, .12]].forEach(([px, py]) => {
          const cx = px * w, cy = py * d;
          s += pa(`M${cx+rr} ${cy}L${cx+rr*.5} ${cy+rr*.86}L${cx-rr*.5} ${cy+rr*.86}L${cx-rr} ${cy}L${cx-rr*.5} ${cy-rr*.86}L${cx+rr*.5} ${cy-rr*.86}Z`, shade(c, 1.06), 'opacity=".85"');
        });
      } else if (/mosaic|马赛克/.test(key)){
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
          s += rc(x + 40 + i * (w - 80) / 4, y + 40 + j * (d - 80) / 4, (w - 100) / 4, (d - 100) / 4, shade(c, .92 + ((i + j) % 3) * .06), 'rx="6" opacity=".9"');
      } else if (/carpet|地毯/.test(key)){
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)
          s += ec(x + w * (i + .5) / 5, y + d * (j + .5) / 5, 14, 14, shade(c, .9), 'opacity=".5"');
      } else {
        const nx = 3, ny = 3;
        for (let i = 1; i < nx; i++) s += ln(x + w * i / nx, y + 36, x + w * i / nx, y + d - 36, 'opacity=".35"');
        for (let j = 1; j < ny; j++) s += ln(x + 36, y + d * j / ny, x + w - 36, y + d * j / ny, 'opacity=".35"');
        if (/marble|瓷|洞石|travertine|porcelain|bluestone|青石/.test(key))
          s += pa(`M${x+w*.15} ${y+d*.3}Q${x+w*.4} ${y+d*.2} ${x+w*.7} ${y+d*.45}T${x+w*.9} ${y+d*.35}`, 'none', 'opacity=".4"');
      }
      s += rc(x + w * .12, y + d * .1, w * .76, d * .16, shade(c, 1.12), 'rx="18" opacity=".45"');
      return s;
    }

    case 'ottoman': {
      let s = rc(x,y,w,d,c,'rx="80"');
      s += qHi(x+18,y+18,w-36,d*.28,.16,60) + qLo(x,y+d-44,w,44,.12,40);
      s += rc(x+50,y+50,w-100,d-100,shade(c,1.08),'rx="50"');
      // 拉扣绗缝：3×3
      for (let i=0;i<3;i++) for (let j=0;j<3;j++){
        const px=x+w*(i+1)/4, py=y+d*(j+1)/4;
        s += qTuft(px,py,Math.min(15,m*.028));
      }
      for (let i=1;i<4;i++) s += qSeam(x+w*i/4,y+50,x+w*i/4,y+d-50,.22);
      for (let j=1;j<4;j++) s += qSeam(x+50,y+d*j/4,x+w-50,y+d*j/4,.22);
      return s;
    }
    case 'bench': return rc(x, y, w, d, c, 'rx="40"') + rc(x + 40, y + d * .15, w - 80, d * .55, shade(c, .9), 'rx="20"');
    case 'mirror': return rc(x, y, w, d, '#e8eef3', 'rx="10"') + rc(x + 20, y + 20, w - 40, d - 40, c, 'rx="6" opacity=".55"') + rc(x, y, w, Math.min(30, d * .2), shade(c, .7));
    case 'console': {
      let s = rc(x,y,w,d,c,'rx="20"') + qWood(x,y,w,d,3);
      s += qHi(x+10,y+8,w-20,d*.3,.16,16) + qLo(x,y+d-20,w,20,.12,10);
      s += qL(x+40,y+d*.55,x+w-40,y+d*.55,`stroke="${shade(c,.7)}" stroke-width="2" opacity=".5"`);
      s += rc(x+w*.2,y+d*.62,w*.6,d*.28,shade(c,.88),'rx="10"');
      for (let i=1;i<3;i++) s += qL(x+w*(.2+i*.2),y+d*.62,x+w*(.2+i*.2),y+d*.9,`stroke="${shade(c,.66)}" stroke-width="2" opacity=".45"`);
      for (let i=0;i<3;i++) s += qR(x+w*(.2+(i+.5)*.2)-26,y+d*.72,52,6,shade(c,.5),'rx="3" opacity=".7"');
      return s;
    }
    case 'hanger': {
      let s = `<circle r="${m * .08}" fill="${c}" ${ST}/>` + ln(0, -m * .35, 0, m * .4, `stroke="${c}" stroke-width="8"`);
      [-1, 1].forEach(sgn => {
        s += ln(0, -m * .15, sgn * m * .35, -m * .28, `stroke="${c}" stroke-width="6"`);
        s += `<circle cx="${sgn*m*.35}" cy="${-m*.28}" r="${m*.045}" fill="${shade(c,1.2)}" ${ST}/>`;
      });
      s += ln(-m * .22, m * .4, m * .22, m * .4, `stroke="${c}" stroke-width="10"`);
      s += qR(-m*.24,m*.35,m*.48,3,'#ffffff','opacity=".25"');
      return s;
    }
    case 'rangehood': return rc(x, y, w, d * .55, c, 'rx="20"') + pa(`M${x} ${y + d * .55}L${x + w * .2} ${y + d}H${x + w * .8}L${x + w} ${y + d * .55}Z`, shade(c, .9));
    case 'microwave': return rc(x, y, w, d, c, 'rx="20"') + rc(x + w * .08, y + d * .18, w * .55, d * .64, '#1a1c1e', 'rx="10"') + rc(x + w * .7, y + d * .25, w * .2, d * .5, shade(c, .85), 'rx="8"');
    case 'planter': {
      // 木质花箱：板条木纹 + 盆沿 + 金属箍 + 土面 + 叶簇与五瓣花
      const long = w/d > 1.6, wood = shade(c,.92);
      let s = qLo(x+22,y+24,w-44,d-48,.13,18);
      s += rc(x,y,w,d,wood,'rx="18"');
      s += qPlankS(x+w*.05,y+d*.07,w*.9,d*.86,long?3:4,wood);
      s += qStoneS(x+w*.06,y+d*.1,w*.88,d*.8,wood);
      s += rc(x+w*.025,y+d*.015,w*.95,d*.115,shade(c,1.18),'rx="9"');
      s += qHi(x+w*.06,y+d*.04,w*.46,d*.035,.26,5);
      s += rc(x+w*.02,y+d*.44,w*.055,d*.12,shade(c,.55),'rx="3" opacity=".55"');
      s += rc(x+w*.925,y+d*.44,w*.055,d*.12,shade(c,.55),'rx="3" opacity=".55"');
      s += rc(x+w*.09,y+d*.17,w*.82,d*.25,'#3d2f22','rx="9" opacity=".5"');
      const n = long?7:5;
      for(let k=0;k<n;k++){
        const px = long? x+w*(.14+k*.12) : x+w*(.24+(k%3)*.26);
        const py = long? y+d*(.44+(k%2)*.1) : y+d*(.38+Math.floor(k/3)*.2);
        const rr=m*.085;
        for(let j=0;j<3;j++) s += qLeafS(px+Math.cos(j*2.1)*rr*.55,py+Math.sin(j*2.1)*rr*.4,rr*1.05,rr*.5,j*120+20,['#5f8f4e','#7eab62','#4e7a40'][j],.92);
        if(k%2===0) s += qBloomS(px,py-rr*.9,rr*.62,['#f3e6d8','#e8a090','#f6d27a'][k%3]);
      }
      return s;
    }
    case 'umbrella': {
      // 俯视八角伞：布料明暗 + 伞骨 + 波浪边流苏 + 伞顶与投影
      const r=m/2, segs=8, scallop=r*.1;
      let s = qE(0,r*.12,r*.98,r*.94,'#000','opacity=".1"');
      let rim='';
      for(let k=0;k<segs;k++){
        const a0=k*Math.PI*2/segs,a1=(k+1)*Math.PI*2/segs,mid=(a0+a1)/2;
        rim+=(k===0?`M${Math.cos(a0)*r} ${Math.sin(a0)*r}`:'');
        rim+=`Q${Math.cos(mid)*(r-scallop)} ${Math.sin(mid)*(r-scallop)} ${Math.cos(a1)*r} ${Math.sin(a1)*r}`;
      }
      s += pa(rim+'Z',shade(c,1.02),'opacity=".92"');
      for(let k=0;k<segs;k++){
        const a0=k*Math.PI*2/segs,a1=(k+1)*Math.PI*2/segs,mid=(a0+a1)/2;
        const cx=Math.cos(mid)*(r-scallop),cy=Math.sin(mid)*(r-scallop);
        s += pa(`M0 0L${Math.cos(a0)*r} ${Math.sin(a0)*r}Q${cx} ${cy} ${Math.cos(a1)*r} ${Math.sin(a1)*r}Z`,k%2?shade(c,.86):shade(c,1.13),'opacity=".72"');
        s += qL(0,0,Math.cos(a0)*r,Math.sin(a0)*r,`stroke="${shade(c,.6)}" stroke-width="4" opacity=".55"`);
        s += qL(0,0,Math.cos(a0)*r*.94,Math.sin(a0)*r*.94,`stroke="#ffffff" stroke-width="2" opacity=".28"`);
        s += `<circle cx="${cx}" cy="${cy}" r="${m*.022}" fill="${shade(c,.72)}" opacity=".8"/>`;
      }
      s += qE(-r*.25,-r*.3,r*.3,r*.14,'#ffffff','opacity=".12"');
      s += ec(0,0,m*.085,m*.085,'#5a5048') + ec(0,0,m*.04,m*.04,'#efe6d8');
      s += qRippleS(0,0,r*.42,'#ffffff',2);
      return s;
    }
    case 'bbq': {
      // 烤炉：炭火橙光 + 细密烤网 + 旋钮/温度计 + 侧台与轮子
      let s = qLo(x+22,y+22,w-44,d-44,.16,22);
      s += rc(x,y,w,d,shade(c,1.05),'rx="24"');
      s += rc(x+w*.08,y+d*.1,w*.84,d*.52,'#171719','rx="14"');
      s += qR(x+w*.12,y+d*.14,w*.76,d*.42,'#ff7a30','rx="10" opacity=".28"');
      s += qR(x+w*.16,y+d*.2,w*.68,d*.3,'#ffb04a','rx="10" opacity=".38"');
      for(let i=0;i<9;i++) s += qL(x+w*.1,y+d*(.12+i*.055),x+w*.9,y+d*(.12+i*.055),`stroke="#d4d8dc" stroke-width="2.4" opacity=".72"`);
      for(let i=0;i<5;i++) s += qL(x+w*(.14+i*.18),y+d*.1,x+w*(.14+i*.18),y+d*.62,`stroke="#d4d8dc" stroke-width="1.8" opacity=".6"`);
      s += rc(x+w*.12,y+d*.66,w*.76,d*.1,shade(c,1.28),'rx="8"');
      s += qHi(x+w*.14,y+d*.67,w*.4,d*.03,.22,4);
      for(let k=0;k<3;k++){
        s += ec(x+w*(.24+k*.24),y+d*.71,w*.035,d*.035,'#2a2a2c');
        s += ec(x+w*(.24+k*.24),y+d*.71,w*.014,d*.014,'#eef0f2');
      }
      s += rc(x+w*.04,y+d*.82,w*.12,d*.14,shade(c,.6),'rx="10"') + rc(x+w*.84,y+d*.82,w*.12,d*.14,shade(c,.6),'rx="10"');
      s += qR(x+w*.14,y+d*.63,w*.24,d*.04,'#c45a2a','rx="4" opacity=".8"');
      return s;
    }
    case 'fountain': {
      // 三层水钵：石材脉络 + 水面同心波 + 喷嘴水柱 + 外圈卵石
      let s = qE(0,d*.06,w*.48,d*.44,'#000','opacity=".12"');
      s += ec(0,0,w/2,d/2,shade(c,.96)) + ec(0,0,w*.44,d*.44,shade(c,1.1));
      s += qStoneS(-w*.4,-d*.4,w*.8,d*.8,c);
      s += ec(0,0,w*.36,d*.36,'#5a97a8','opacity=".85"');
      s += ec(0,0,w*.3,d*.3,'#7fc0d0','opacity=".7"');
      s += qRippleS(0,0,w*.33,'#dff2f8',4);
      s += ec(0,0,w*.19,d*.19,shade(c,1.16)) + ec(0,0,w*.13,d*.13,'#4d8b9e','opacity=".8"');
      s += qRippleS(0,0,w*.14,'#dff2f8',2);
      s += ec(0,0,w*.06,d*.06,'#ffffff','opacity=".75"');
      for(let k=0;k<8;k++){
        const a=k*Math.PI/4;
        s += `<circle cx="${Math.cos(a)*w*.26}" cy="${Math.sin(a)*d*.26}" r="${m*.022}" fill="#cfe4ec" opacity=".8"/>`;
      }
      for(let k=0;k<12;k++){
        const a=k*Math.PI/6;
        s += qE(Math.cos(a)*w*.46,Math.sin(a)*d*.46,w*.035,d*.03,shade(c,.82+(k%3)*.06),'opacity=".9"');
      }
      s += qHi(-w*.2,-d*.28,w*.22,d*.06,.2,20);
      return s;
    }
    case 'pergola': {
      // 木构凉棚：柱脚石础 + 主梁出挑 + 密椽阴影 + 藤叶与花串
      const pw=Math.max(80,w*.05),pd=Math.max(80,d*.05);
      let s = qLo(x+pw,y+pd,w-2*pw,d-2*pd,.1,10);
      s += rc(x,y,w,d,'none',`stroke="${shade(c,.8)}" stroke-width="3" opacity=".5"`);
      [[0,0],[w-pw,0],[0,d-pd],[w-pw,d-pd]].forEach(([px,py])=>{
        s += rc(x+px-8,y+py-8,pw+16,pd+16,shade(c,.7),'rx="8"');
        s += rc(x+px,y+py,pw,pd,shade(c,1.06),'rx="6"');
        s += qWood(x+px,y+py,pw,pd,3);
        s += qHi(x+px+4,y+py+4,pw*.3,pd*.2,.16,4);
      });
      for(let i=1;i<7;i++) s += rc(x+w*i/7-pd*.12,y+pd,pd*.24,d-2*pd,shade(c,1.12),'rx="3" opacity=".82"');
      for(let j=1;j<4;j++) s += rc(x+pw,y+d*j/4-pd*.1,w-2*pw,pd*.2,shade(c,.82),'rx="3" opacity=".6"');
      for(let k=0;k<14;k++){
        const px=x+pw+(k*137%Math.max(1,w-2*pw)), py=y+pd+(k*89%Math.max(1,d-2*pd));
        s += qLeafS(px,py,m*.055,m*.028,k*47,['#5f8f4e','#7eab62','#4e7a40'][k%3],.85);
        if(k%3===0) s += qBloomS(px+m*.04,py+m*.02,m*.03,['#f3e6d8','#e8a090'][k%2]);
      }
      return s;
    }
    case 'gardenbench': {
      // 公园长椅：木条板缝 + 铸铁侧架卷花 + 扶手与投影
      let s = qLo(x+w*.04,y+d*.42,w*.92,d*.5,.14,14);
      s += rc(x,y+d*.32,w,d*.56,shade(c,.78),'rx="18"');
      s += qPlankS(x+w*.03,y+d*.36,w*.94,d*.4,4,c);
      s += qWood(x+w*.05,y+d*.38,w*.9,d*.34,4);
      s += rc(x,y+d*.06,w,d*.2,shade(c,.72),'rx="12"');
      for(let i=0;i<5;i++) s += qL(x+w*(.1+i*.2),y+d*.1,x+w*(.1+i*.2),y+d*.24,`stroke="${shade(c,1.2)}" stroke-width="3" opacity=".45"`);
      [[x,y],[x+w*.9,y]].forEach(([px,py])=>{
        s += rc(px,py+d*.08,w*.1,d*.84,shade(c,.55),'rx="10"');
        s += qP(`M${px+w*.05} ${py+d*.16}Q${px+w*.13} ${py+d*.3} ${px+w*.05} ${py+d*.44}Q${px-w*.03} ${py+d*.3} ${px+w*.05} ${py+d*.16}Z`,'none',`stroke="${shade(c,.5)}" stroke-width="3" opacity=".8"`);
      });
      s += qHi(x+w*.08,y+d*.38,w*.4,d*.05,.16,6);
      return s;
    }
    case 'stonebench': {
      // 整板石凳：石材脉络 + 倒角亮边 + 两端石墩 + 接地阴影
      let s = qLo(x+w*.04,y+d*.3,w*.92,d*.46,.14,10);
      s += rc(x,y+d*.22,w,d*.52,shade(c,.96),'rx="12"');
      s += qStoneS(x+w*.03,y+d*.24,w*.94,d*.46,c);
      s += rc(x+w*.05,y+d*.27,w*.9,d*.07,shade(c,1.18),'rx="4" opacity=".7"');
      s += qHi(x+w*.1,y+d*.28,w*.36,d*.04,.2,4);
      s += rc(x+w*.1,y+d*.74,w*.2,d*.2,shade(c,.86),'rx="6"');
      s += rc(x+w*.7,y+d*.74,w*.2,d*.2,shade(c,.86),'rx="6"');
      s += qStoneS(x+w*.1,y+d*.76,w*.2,d*.16,c);
      return s;
    }
    case 'patiochaise': {
      // 花园躺椅：织物条纹 + 可调节靠背分档 + 腰枕 + 木扶手与轮
      let s = qLo(x+w*.1,y+d*.1,w*.8,d*.8,.12,30);
      s += rc(x+w*.08,y+d*.08,w*.84,d*.84,shade(c,.94),'rx="40"');
      s += qPlankS(x+w*.13,y+d*.54,w*.74,d*.32,4,c);
      s += pa(`M${x+w*.14} ${y+d*.55}L${x+w*.14} ${y+d*.18}Q${x+w*.5} ${y+d*.07} ${x+w*.86} ${y+d*.18}L${x+w*.86} ${y+d*.55}Z`,shade(c,1.08));
      for(let i=0;i<5;i++) s += qL(x+w*.18,y+d*(.2+i*.07),x+w*.82,y+d*(.2+i*.07),`stroke="${shade(c,.72)}" stroke-width="2.6" opacity=".4"`);
      s += rc(x+w*.3,y+d*.24,w*.4,d*.1,'#ffffff','rx="20" opacity=".55"');
      s += qHi(x+w*.32,y+d*.25,w*.28,d*.03,.4,8);
      for(let i=0;i<4;i++) s += qL(x+w*.2,y+d*(.58+i*.06),x+w*.8,y+d*(.58+i*.06),`stroke="${shade(c,.7)}" stroke-width="2" opacity=".35"`);
      s += rc(x+w*.02,y+d*.12,w*.08,d*.5,shade(c,.65),'rx="8"') + rc(x+w*.9,y+d*.12,w*.08,d*.5,shade(c,.65),'rx="8"');
      s += ec(x+w*.12,y+d*.9,w*.05,d*.03,shade(c,.55)) + ec(x+w*.88,y+d*.9,w*.05,d*.03,shade(c,.55));
      return s;
    }
    case 'gardenlamp': {
      // 欧式庭院灯：暖光晕 + 六角灯箱格 + 铸铁柱纹 + 檐盖顶珠
      let s = qE(0,0,m*.5,m*.5,'#fff1c8','opacity=".2"');
      s += qE(0,0,m*.36,m*.36,'#ffe9ae','opacity=".28"');
      s += ec(0,0,m*.23,m*.23,shade(c,.9));
      for(let k=0;k<6;k++){
        const a=k*Math.PI/3;
        s += qL(Math.cos(a)*m*.23,Math.sin(a)*m*.23,Math.cos(a)*m*.1,Math.sin(a)*m*.1,`stroke="${shade(c,.55)}" stroke-width="4" opacity=".8"`);
        s += qL(Math.cos(a)*m*.05,Math.sin(a)*m*.05,0,0,`stroke="#fff4dc" stroke-width="2" opacity=".5"`);
      }
      s += rc(-m*.1,-m*.1,m*.2,m*.2,shade(c,1.15),'rx="4"');
      s += qHi(-m*.08,-m*.08,m*.09,m*.05,.3,3);
      s += ec(0,0,m*.075,m*.075,'#fff6dd') + ec(0,0,m*.035,m*.035,'#ffe9b0');
      return s;
    }
    case 'dryingrack': {
      // 晾衣架：双层横杆 + 挂衣与夹子 + 侧架与接地脚
      let s = qLo(x+w*.06,y+d*.16,w*.88,d*.68,.1,10);
      s += rc(x+w*.05,y+d*.15,w*.9,d*.7,'none',`stroke="${shade(c,.85)}" stroke-width="4"`);
      for(let i=0;i<4;i++) s += qL(x+w*.12,y+d*(.22+i*.15),x+w*.88,y+d*(.22+i*.15),`stroke="${shade(c,1.1)}" stroke-width="3" opacity=".75"`);
      s += rc(x,y+d*.33,w*.08,d*.34,shade(c,.75),'rx="6"') + rc(x+w*.92,y+d*.33,w*.08,d*.34,shade(c,.75),'rx="6"');
      const cols=['#e8eef3','#f5e6d8','#dce8f0'];
      for(let k=0;k<3;k++){
        const px=x+w*(.24+k*.26), py=y+d*.28;
        s += pa(`M${px-w*.07} ${py}L${px+w*.07} ${py}L${px+w*.055} ${py+d*.34}Q${px} ${py+d*.38} ${px-w*.055} ${py+d*.34}Z`,cols[k],'opacity=".8"');
        s += qL(px-w*.05,py,px-w*.05,py+d*.3,`stroke="#fff" stroke-width="2" opacity=".5"`);
        s += qR(px-w*.065,py-w*.012,w*.03,d*.025,'#b5653a','rx="2"');
        s += qR(px+w*.035,py-w*.012,w*.03,d*.025,'#b5653a','rx="2"');
      }
      return s;
    }
    case 'stairs': {
      const metaF = meta || {type: t};
      const style = typeof stairsStyleOf === 'function' ? stairsStyleOf(metaF) : 'straight';
      const down = metaF.dir === 'down';
      const flip = !!metaF.flip;
      const woodC = c && c !== '#ddd' ? c : '#6b4a32';
      const dk = shade(woodC, .78), hi = shade(woodC, 1.08);
      const arrow = (cx, cy, towardPlusD) => {
        // towardPlusD: 箭头指向 +d（平面图下方）；下行时指向低端
        const s = towardPlusD ? 1 : -1;
        return pa(`M${cx} ${cy + s * m * .12}L${cx + m * .1} ${cy - s * m * .02}L${cx - m * .1} ${cy - s * m * .02}Z`, dk);
      };
      const tag = (label) => `<text x="0" y="${y + d - 8}" text-anchor="middle" font-size="${Math.max(90, m * .14)}" fill="${dk}" opacity=".75" pointer-events="none">${label}</text>`;
      let body = '';
      if (style === 'spiral'){
        const R = m / 2, r0 = R * .14;
        body = ec(0, 0, R, R, hi) + ec(0, 0, r0, r0, dk);
        const n = 12;
        for (let i = 0; i < n; i++){
          const t = down ? (n - 1 - i) / n : i / n;
          const a0 = (i / n) * Math.PI * 2, a1 = ((i + .85) / n) * Math.PI * 2;
          const rr = R * (.28 + .62 * t);
          body += pa(`M${Math.sin(a0)*r0} ${-Math.cos(a0)*r0}L${Math.sin(a0)*rr} ${-Math.cos(a0)*rr}A${rr} ${rr} 0 0 1 ${Math.sin(a1)*rr} ${-Math.cos(a1)*rr}L${Math.sin(a1)*r0} ${-Math.cos(a1)*r0}Z`, c, 'opacity=".9"');
        }
        body += arrow(0, 0, !down) + tag(down ? '↓' : '↑');
      } else if (style === 'l'){
        const sw = Math.min(w, d) * .42;
        body = pa(`M${x} ${y}H${x+sw}V${y+d-sw}H${x+w}V${y+d}H${x}Z`, hi);
        const n1 = Math.max(4, Math.round((d - sw) / 220));
        for (let i = 1; i <= n1; i++){
          const yy = y + (d - sw) * (i / (n1 + 1));
          body += ln(x, yy, x + sw, yy, `stroke="${dk}"`);
        }
        const n2 = Math.max(4, Math.round((w - sw) / 220));
        for (let i = 1; i <= n2; i++){
          const xx = x + sw + (w - sw) * (i / (n2 + 1));
          body += ln(xx, y + d - sw, xx, y + d, `stroke="${dk}"`);
        }
        body += rc(x, y + d - sw, sw, sw, c);
        body += arrow(x + sw * .5, y + (d - sw) * .35, !down) + tag(down ? '↓' : '↑');
      } else if (style === 'u'){
        const sw = (w - Math.max(40, w * .04)) / 2, land = Math.min(sw * .95, d * .28);
        body = rc(x, y, sw, d - land, hi) + rc(x + w - sw, y, sw, d - land, hi);
        body += rc(x, y + d - land, w, land, c);
        const n = Math.max(4, Math.round((d - land) / 220));
        for (let i = 1; i <= n; i++){
          const yy = y + (d - land) * (i / (n + 1));
          body += ln(x, yy, x + sw, yy, `stroke="${dk}"`);
          body += ln(x + w - sw, yy, x + w, yy, `stroke="${dk}"`);
        }
        body += arrow(x + sw * .5, y + (d - land) * .3, !down) + tag(down ? '↓' : '↑');
      } else if (style === 'triple'){
        const sw = Math.min(w, d) * .36, land = Math.max(sw, Math.min(w, d) * .32);
        body = rc(x, y, sw, d - land, hi);
        body += rc(x + w - sw, y, sw, d - land, hi);
        body += rc(x + land, y + d - sw, w - 2 * land, sw, hi);
        body += rc(x, y + d - land, land, land, c);
        body += rc(x + w - land, y + d - land, land, land, c);
        const nZ = Math.max(3, Math.round((d - land) / 220));
        for (let i = 1; i <= nZ; i++){
          const yy = y + (d - land) * (i / (nZ + 1));
          body += ln(x, yy, x + sw, yy, `stroke="${dk}"`);
          body += ln(x + w - sw, yy, x + w, yy, `stroke="${dk}"`);
        }
        const nX = Math.max(2, Math.round((w - 2 * land) / 220));
        for (let i = 1; i <= nX; i++){
          const xx = x + land + (w - 2 * land) * (i / (nX + 1));
          body += ln(xx, y + d - sw, xx, y + d, `stroke="${dk}"`);
        }
        body += arrow(x + sw * .5, y + (d - land) * .3, !down) + tag(down ? '↓' : '↑');
      } else {
        body = rc(x, y, w, d, hi);
        const n = Math.max(5, Math.round(d / 220));
        for (let i = 1; i < n; i++){
          const yy = y + d * (i / n);
          body += ln(x, yy, x + w, yy, `stroke="${dk}"`);
        }
        // 高端加粗边提示
        if (down) body += rc(x, y + d - Math.max(40, d * .04), w, Math.max(40, d * .04), dk);
        else body += rc(x, y, w, Math.max(40, d * .04), dk);
        body += arrow(0, down ? y + d * .72 : y + d * .22, !down);
        body += ln(x + 40, y + 30, x + 40, y + d - 30, `stroke="${dk}" opacity=".55"`);
        body += ln(x + w - 40, y + 30, x + w - 40, y + d - 30, `stroke="${dk}" opacity=".55"`);
        body += tag(down ? '↓' : '↑');
      }
      return flip ? `<g transform="scale(-1,1)">${body}</g>` : body;
    }
    /* ——— 新增客厅家具 ——— */
    case 'chaise': {
      // 贵妃榻：单侧高靠背 + 长坐垫 + 拉扣
      const a = Math.min(w*.16,260), b = Math.min(d*.24,200), dk = shade(c,.83);
      let s = rc(x,y,w,d,dk,'rx="80"') + qHi(x+14,y+12,w-28,d-24,.15,60);
      s += rc(x,y,a,d,dk,'rx="50"') + qHi(x+10,y+10,a-20,d-20,.15,40);
      const cw=w-a-40, ch=d-b-50;
      s += rc(x+a+20,y+b+10,cw,ch,c,'rx="46"');
      s += qHi(x+a+30,y+b+18,cw-20,ch*.3,.18,34) + qLo(x+a+26,y+b+ch-30,cw-12,26,.1,18);
      for (let i=1;i<3;i++) s += qSeam(x+a+20+cw*i/3,y+b+16,x+a+20+cw*i/3,y+b+ch-6,.2);
      for (let i=0;i<3;i++) s += qTuft(x+a/2,y+d*(i+1)/4,Math.min(15,a*.06));
      s += rc(x,y,w,b,dk,'rx="50"') + qHi(x+16,y+8,w-32,b*.3,.16,40);
      // 圆枕
      s += qLo(x+a+40,y+b+30,180,180,.14,90) + ec(x+a+130,y+b+120,90,90,shade(c,1.16)) + qE(x+a+100,y+b+95,45,45,'#ffffff','opacity=".2"');
      return s;
    }
    case 'curvedsofa': {
      // 弧形沙发：弓形外框 + 放射分格
      const r = w*.62, dk = shade(c,.83);
      const outer = `M${x} ${y+d}Q0 ${y-d*.55} ${x+w} ${y+d}L${x+w} ${y+d}Q0 ${y+d*.1} ${x} ${y+d}Z`;
      let s = qP(outer,dk,`${ST}`);
      const inner = `M${x+60} ${y+d-30}Q0 ${y-d*.25} ${x+w-60} ${y+d-30}L${x+w-60} ${y+d-30}Q0 ${y+d*.28} ${x+60} ${y+d-30}Z`;
      s += qP(inner,c,`${ST}`);
      for (let i=1;i<5;i++){
        const t0=i/5, px=x+w*t0, py=y+d*.62-Math.sin(Math.PI*t0)*d*.5;
        s += qL(px,py,px,py+d*.3,`stroke="${shade(c,.66)}" stroke-width="2.4" opacity=".5"`);
      }
      for (let i=0;i<4;i++){
        const t0=(i+.5)/4, px=x+w*t0, py=y+d*.55-Math.sin(Math.PI*t0)*d*.42;
        s += qTuft(px,py,12);
      }
      s += qHi(x+40,y+d*.1,w-80,d*.14,.14,40);
      [-1,1].forEach((sg,i)=>{
        const px=x+w/2+sg*w*.28, py=y+d*.42;
        s += qLo(px-70,py+8,140,140,.13,40) + ec(px,py+70,70,70,i?shade(c,1.16):shade(c,.82)) + qE(px-22,py+48,32,24,'#ffffff','opacity=".18"');
      });
      return s;
    }
    case 'sectional': {
      // 模块组合沙发：U 形三段
      const k = Math.min(750,d*.42,w*.3), b = 200, dk = shade(c,.83);
      let s = pa(`M${x} ${y}H${x+w}V${y+d}H${x+w-k}V${y+k}H${x+k}V${y+d}H${x}V${y+k}Z`, dk);
      s += qHi(x+14,y+14,w-28,d-28,.13,50);
      const segs=[[x+k,y+b,w-2*k,k-b-30],[x+b,y+k,k-b-30,d-k-b],[x+w-k,y+k,k-b-30,d-k-b]];
      segs.forEach(([px,py,pw,ph])=>{
        s += rc(px,py,pw,ph,c,'rx="40"') + qHi(px+10,py+8,pw-20,ph*.3,.17,30) + qSeam(px+pw*.5,py+12,px+pw*.5,py+ph-12,.18);
      });
      for (let i=0;i<5;i++) s += qTuft(x+k+(w-2*k)*(i+.5)/5,y+b*.5,13);
      s += rc(x,y,w,b,dk,'rx="50"') + rc(x,y,k,d,dk,'rx="50"') + rc(x+w-k,y,k,d,dk,'rx="50"');
      s += qHi(x+16,y+8,w-32,b*.3,.14,40);
      [[-1,shade(c,.8)],[1,shade(c,1.16)]].forEach(([sg,pc])=>{
        const px=x+w/2+sg*w*.22-90, py=y+b+34;
        s += qLo(px+6,py+8,180,170,.13,30) + rc(px,py,180,170,pc,'rx="34"') + qHi(px+8,py+8,164,54,.17,26);
      });
      return s;
    }
    case 'eggchair': {
      // 蛋形休闲椅：椭圆壳体 + 内坐垫 + 底座
      let s = ec(0,0,w*.46,d*.48,shade(c,.82));
      s += qHi(-w*.3,-d*.34,w*.6,d*.22,.16,80);
      s += ec(0,d*.04,w*.36,d*.38,c) + qHi(-w*.24,d*.02,w*.48,d*.16,.16,60);
      s += qSeam(0,-d*.3,0,d*.3,.3);
      for (let i=0;i<3;i++) s += qTuft(-w*.12+i*w*.12,-d*.16,11);
      s += ec(0,d*.1,w*.22,d*.2,shade(c,1.14),'opacity=".75"') + qE(-w*.06,d*.04,w*.1,d*.06,'#ffffff','opacity=".18"');
      s += ec(0,d*.42,w*.12,d*.07,shade(c,.55)) + `<circle r="${m*.05}" fill="${shade(c,.5)}" ${ST}/>`;
      return s;
    }
    case 'rockingchair': {
      // 摇椅：椅身 + 弧形摇杆 + 靠背条
      const dk=shade(c,.82);
      let s = qP(`M${x} ${y+d*.72}Q${0} ${y+d*.96} ${x+w} ${y+d*.72}`,'none',`stroke="${shade(c,.6)}" stroke-width="${m*.07}" stroke-linecap="round" opacity=".9"`);
      s += rc(x+w*.12,y+d*.12,w*.76,d*.62,dk,'rx="60"');
      s += rc(x+w*.18,y+d*.18,w*.64,d*.5,c,'rx="46"') + qHi(x+w*.22,y+d*.22,w*.56,d*.18,.17,36);
      for (let i=1;i<5;i++) s += qL(x+w*(.18+.64*i/5),y+d*.2,x+w*(.18+.64*i/5),y+d*.66,`stroke="${shade(c,.66)}" stroke-width="2" opacity=".4"`);
      s += rc(x+w*.08,y,w*.84,d*.18,dk,'rx="40"') + qHi(x+w*.14,y+8,w*.72,d*.08,.16,30);
      s += qL(x+w*.1,y+d*.76,x+w*.16,y+d*.9,`stroke="${shade(c,.6)}" stroke-width="7"`) + qL(x+w*.9,y+d*.76,x+w*.84,y+d*.9,`stroke="${shade(c,.6)}" stroke-width="7"`);
      return s;
    }
    case 'nestingtable': {
      // 组合圆茶几：大小两个嵌套圆台
      const r1=m*.46, r2=m*.3;
      let s = qE(-w*.06,d*.06,r1,r1,shade(c,.8),'opacity=".85"');
      s += qE(-w*.06,d*.06,r1*.86,r1*.86,c) + qStone(-w*.06-r1*.8,d*.06-r1*.8,r1*1.6,r1*1.6);
      s += ec(w*.22,-d*.18,r2,r2,shade(c,1.12));
      s += ec(w*.22,-d*.18,r2*.84,r2*.84,c) + qE(w*.22-r2*.2,-d*.18-r2*.24,r2*.5,r2*.28,'#ffffff','opacity=".2"');
      s += qE(-w*.06,d*.06,r1*.3,r1*.3,'#ffffff','opacity=".1"');
      return s;
    }
    case 'drumstool': {
      // 鼓墩：圆鼓身 + 竖棱 + 顶面拉扣
      const r=m*.46;
      let s = qE(0,0,r,r,shade(c,.85),`${ST}`);
      s += qE(0,0,r*.82,r*.82,c);
      for (let k=0;k<12;k++){
        const a=k*Math.PI/6;
        s += qL(Math.cos(a)*r*.82,Math.sin(a)*r*.82,Math.cos(a)*r*.98,Math.sin(a)*r*.98,`stroke="${shade(c,.6)}" stroke-width="3" opacity=".55"`);
      }
      s += qE(0,0,r*.5,r*.5,shade(c,1.1),`${ST}`);
      s += qTuft(0,0,r*.13);
      for (let k=0;k<8;k++){
        const a=k*Math.PI/4;
        s += qTuft(Math.cos(a)*r*.34,Math.sin(a)*r*.34,r*.055);
      }
      s += qE(-r*.2,-r*.24,r*.4,r*.22,'#ffffff','opacity=".14"');
      return s;
    }
    case 'barcart': {
      // 茶水推车：双层台面 + 框架 + 轮子 + 酒瓶
      let s = rc(x,y,w,d,c,'rx="24"') + qWood(x,y,w,d,3);
      s += qHi(x+10,y+8,w-20,d*.25,.16,18) + qLo(x,y+d-20,w,20,.12,12);
      s += rc(x+40,y+40,w-80,d-80,'none','rx="16" stroke-dasharray="6 5" opacity=".5"');
      s += qR(x+30,y+d*.1,w-60,8,shade(c,.6),'rx="4" opacity=".6"') + qR(x+30,y+d*.88,w-60,8,shade(c,.6),'rx="4" opacity=".6"');
      // 瓶与杯
      for (let i=0;i<3;i++){
        const px=x+w*(.24+i*.16);
        s += qR(px-16,y+d*.3,32,d*.36,shade(c,.55+i*.1),'rx="10" opacity=".85"') + qR(px-6,y+d*.22,12,d*.1,shade(c,.5),'rx="4"');
      }
      s += qE(x+w*.76,y+d*.6,26,26,'#ffffff','opacity=".75"') + qE(x+w*.76,y+d*.6,16,16,shade(c,.6),'opacity=".85"');
      [[x+50,y+d-10],[x+w-50,y+d-10],[x+50,y+10],[x+w-50,y+10]].forEach(([px,py])=>s+=`<circle cx="${px}" cy="${py}" r="${Math.max(14,m*.045)}" fill="${shade(c,.5)}" ${ST}/>`);
      return s;
    }
    case 'fireplace': {
      // 壁炉：台面 + 炉膛 + 火焰 + 木柴
      let s = rc(x,y,w,d,c,'rx="16"') + qStone(x,y,w,d);
      s += qHi(x+14,y+10,w-28,d*.3,.16,12) + qLo(x,y+d-18,w,18,.12,8);
      s += rc(x+w*.16,y+d*.22,w*.68,d*.62,'#2b2722','rx="12"');
      s += qP(`M${x+w*.32} ${y+d*.78}Q${x+w*.38} ${y+d*.48} ${x+w*.46} ${y+d*.62}Q${x+w*.5} ${y+d*.34} ${x+w*.58} ${y+d*.6}Q${x+w*.66} ${y+d*.44} ${x+w*.7} ${y+d*.78}Z`,'#e8953f','opacity=".85"');
      s += qP(`M${x+w*.4} ${y+d*.78}Q${x+w*.46} ${y+d*.58} ${x+w*.52} ${y+d*.68}Q${x+w*.58} ${y+d*.52} ${x+w*.62} ${y+d*.78}Z`,'#ffd98a','opacity=".9"');
      for (let i=0;i<3;i++) s += qL(x+w*(.3+i*.16),y+d*.76,x+w*(.42+i*.16),y+d*.82,`stroke="#6b4a30" stroke-width="8" stroke-linecap="round" opacity=".9"`);
      s += qR(x+w*.16,y+d*.18,w*.68,10,'#ffffff','rx="4" opacity=".3"');
      return s;
    }
    case 'screen': {
      // 屏风：三折板 + 竖格 + 折痕阴影
      const n=3, pw=(w-40)/n;
      let s='';
      for (let i=0;i<n;i++){
        const px=x+20+i*pw;
        s += rc(px,y,pw-8,d,i%2?shade(c,.92):c,'rx="8"');
        s += qHi(px+8,y+8,pw-24,d*.2,.14,8);
        s += rc(px+18,y+24,pw-44,d-48,'none','rx="6" opacity=".55"');
        for (let k=1;k<4;k++) s += qL(px+18+(pw-44)*k/4,y+24,px+18+(pw-44)*k/4,y+d-24,'opacity=".3"');
        for (let k=1;k<3;k++) s += qL(px+18,y+24+(d-48)*k/3,px+pw-26,y+24+(d-48)*k/3,'opacity=".3"');
        if (i<n-1) s += qR(px+pw-12,y,12,d,'#000000','opacity=".14"');
      }
      return s;
    }
    case 'floorcushion': {
      // 蒲团：圆坐垫 + 放射缝线 + 中心拉扣
      const r=m*.46;
      let s = qE(0,0,r,r,shade(c,.88),`${ST}`);
      s += qE(0,0,r*.88,r*.88,c);
      for (let k=0;k<12;k++){
        const a=k*Math.PI/6;
        s += qL(Math.cos(a)*r*.16,Math.sin(a)*r*.16,Math.cos(a)*r*.84,Math.sin(a)*r*.84,`stroke="${shade(c,.64)}" stroke-width="2.4" stroke-dasharray="14 10" opacity=".5"`);
      }
      s += qE(0,0,r*.3,r*.3,shade(c,1.08),'opacity=".6"') + qTuft(0,0,r*.1);
      s += qE(-r*.22,-r*.26,r*.42,r*.24,'#ffffff','opacity=".16"');
      return s;
    }
    case 'speaker': {
      // 落地音箱：箱体 + 高低音单元 + 倒相孔
      let s = rc(x,y,w,d,shade(c,.5),'rx="16"');
      s += qHi(x+8,y+8,w-16,d*.16,.13,10);
      s += ec(0,-d*.16,w*.33,d*.28,shade(c,.22)) + ec(0,-d*.16,w*.2,d*.18,shade(c,.55));
      s += ec(0,d*.2,w*.22,d*.18,shade(c,.22)) + ec(0,d*.2,w*.1,d*.08,shade(c,.6));
      s += qE(0,d*.36,w*.06,d*.04,'#0a0a0a','opacity=".8"');
      s += qR(x+10,y+8,w-20,4,'#ffffff','rx="2" opacity=".22"');
      return s;
    }
    case 'artframe': {
      // 装饰画：画框 + 画面色块 + 玻璃反光
      let s = rc(x,y,w,d,shade(c,.6),'rx="6"');
      s += rc(x+24,y+10,w-48,Math.max(20,d-20),shade(c,1.25),'rx="3"');
      s += qP(`M${x+w*.2} ${y+d*.8}L${x+w*.42} ${y+d*.25}L${x+w*.6} ${y+d*.62}L${x+w*.74} ${y+d*.4}L${x+w*.82} ${y+d*.8}Z`,shade(c,.72),'opacity=".7"');
      s += qP(`M${x+w*.2} ${y+10}H${x+w*.46}V${y+d-10}H${x+w*.3}Z`,'#ffffff','opacity=".12"');
      s += qR(x+24,y+10,w-48,5,'#ffffff','rx="2" opacity=".3"');
      return s;
    }
    /* —— 装饰：挂墙类俯视为贴墙细条，摆件类为俯视圆盘 —— */
    case 'wallart': {
      // 挂画：画框 + 画布 + 抽象山形画面 + 玻璃斜向反光
      let s = rc(x,y,w,d,shade(c,.52),'rx="3"');
      s += rc(x+18,y+8,w-36,Math.max(6,d-16),shade(c,1.3),'rx="2"');
      s += qP(`M${x+w*.2} ${y+d*.8}L${x+w*.4} ${y+d*.28}L${x+w*.58} ${y+d*.66}L${x+w*.72} ${y+d*.34}L${x+w*.82} ${y+d*.8}Z`,shade(c,.68),'opacity=".65"');
      s += qR(x+18,y+8,w-36,3,'#ffffff','rx="1" opacity=".32"');
      return s;
    }
    case 'gallerywall': {
      // 照片墙：一排大小相近、深浅错落的相框
      let s = ''; const n = 5, gap = w*.02, pw = (w-gap*(n-1))/n;
      for (let i=0;i<n;i++){
        const px = x+i*(pw+gap);
        s += rc(px,y,pw,d,shade(c,.55+(i%3)*.08),'rx="2"');
        s += rc(px+5,y+5,Math.max(4,pw-10),Math.max(4,d-10),i%2?shade(c,1.28):'#f3ece0','rx="1"');
      }
      return s;
    }
    case 'wallmirror': {
      // 装饰镜：金属圆框 + 冷色镜面 + 斜向反光
      let s = rc(x,y,w,d,shade(c,.6),'rx="8"');
      s += ec(0,0,w*.42,Math.max(7,d*.34),'#e9f2f7');
      s += qP(`M${-w*.3} ${d*.3}L${-w*.04} ${-d*.3}L${w*.08} ${-d*.3}L${-w*.18} ${d*.3}Z`,'#ffffff','opacity=".55"');
      return s;
    }
    case 'wallclock': {
      // 挂钟：表盘 + 刻度 + 指针
      let s = ec(0,0,w*.46,Math.max(9,d*.46),shade(c,.55));
      s += ec(0,0,w*.38,Math.max(6,d*.36),'#f7f2e6');
      for (let i=0;i<12;i++){ const a=i*Math.PI/6; s += qL(Math.cos(a)*w*.32,Math.sin(a)*d*.28,Math.cos(a)*w*.36,Math.sin(a)*d*.32,`stroke="${shade(c,.5)}" stroke-width="2"`); }
      s += qL(0,0,0,-d*.22,`stroke="${shade(c,.45)}" stroke-width="3" stroke-linecap="round"`);
      s += qL(0,0,w*.14,0,`stroke="${shade(c,.45)}" stroke-width="3" stroke-linecap="round"`);
      s += `<circle cx="0" cy="0" r="3" fill="${shade(c,.4)}"/>`;
      return s;
    }
    case 'tapestry': {
      // 挂毯：织物色块 + 竖纹 + 底部流苏
      let s = rc(x,y,w,d,shade(c,.85),'rx="2"');
      s += qR(x+10,y+8,w-20,Math.max(4,d-16),shade(c,1.14),'opacity=".85"');
      for (let i=1;i<6;i++) s += qL(x+w*i/6,y+8,x+w*i/6,y+d-8,`stroke="${shade(c,.7)}" stroke-width="2" opacity=".45"`);
      for (let i=0;i<9;i++) s += qL(x+w*(i+.5)/9,y+d-2,x+w*(i+.5)/9,y+d+Math.max(7,d*.34),`stroke="${shade(c,.68)}" stroke-width="2"`);
      return s;
    }
    case 'macrame': {
      // 编织壁挂：顶部木杆 + 交叉编绳 + 流苏
      const top = y+6, bot = y+d*.9;
      let s = qL(x,top,x+w,top,`stroke="${shade(c,.5)}" stroke-width="7" stroke-linecap="round"`);
      for (let i=0;i<5;i++) s += qL(x+w*(i+.5)/5,top,0,bot,`stroke="${shade(c,.92)}" stroke-width="2" opacity=".85"`);
      s += qL(-w*.3,y+d*.5,0,bot,`stroke="${c}" stroke-width="3"`);
      s += qL(w*.3,y+d*.5,0,bot,`stroke="${c}" stroke-width="3"`);
      for (let i=0;i<7;i++) s += qL(x+w*(i+.5)/7,bot-2,x+w*(i+.5)/7,y+d+Math.max(8,d*.42),`stroke="${shade(c,.72)}" stroke-width="2"`);
      return s;
    }
    case 'wallshelf': {
      // 壁挂搁板：木板 + 木纹 + 板上的小摆件
      let s = rc(x,y,w,d,shade(c,.62),'rx="3"');
      s += rc(x+12,y+10,w-24,d-20,shade(c,1.16),'rx="2"');
      for (let i=1;i<4;i++) s += qL(x+12,y+10+(d-20)*i/4,x+w-12,y+10+(d-20)*i/4,`stroke="${shade(c,.78)}" stroke-width="2" opacity=".35"`);
      s += ec(-w*.24,0,w*.055,d*.16,'#e8dcc8') + ec(w*.12,-d*.1,w*.04,d*.13,'#9bad8e') + ec(w*.3,d*.1,w*.035,d*.12,'#c8a86e');
      return s;
    }
    case 'recordwall': {
      // 碟片墙：贴墙细条上一排黑胶唱片正影
      let s = rc(x,y,w,d,shade(c,.55),'rx="3"');
      const n = Math.max(4, Math.round(w/300)), lbl = ['#c8a86e','#b96a4c','#9bad8e','#d5dde3','#d9b56c'];
      for (let i=0;i<n;i++){
        const cx2 = x+w*(i+.5)/n, r = Math.min(d*.34, w/n*.42);
        s += `<circle cx="${cx2}" cy="0" r="${r}" fill="#1c1a18"/>`;
        s += `<circle cx="${cx2}" cy="0" r="${r*.38}" fill="${lbl[i%lbl.length]}"/>`;
        s += `<circle cx="${cx2}" cy="0" r="${Math.max(1.4,r*.09)}" fill="#0c0b0a"/>`;
      }
      return s;
    }
    case 'floorvase': {
      // 落地花瓶：同心瓶口 + 几枝干花
      let s = ec(0,0,w*.46,d*.46,shade(c,.68));
      s += ec(0,0,w*.38,d*.38,c) + ec(0,0,w*.2,d*.2,shade(c,.52));
      s += ec(-w*.07,-d*.09,w*.1,d*.08,'#ffffff','opacity=".32"');
      const cols = ['#f3e6d8','#e8b4a0','#f6d27a','#ffffff','#e8b4a0'];
      for (let i=0;i<5;i++){
        const a=i*1.32, px=Math.cos(a)*w*.33, py=Math.sin(a)*d*.33;
        s += qL(0,0,px,py,`stroke="#6f8f4a" stroke-width="3" opacity=".8"`) + ec(px,py,w*.05,d*.05,cols[i]);
      }
      return s;
    }
    case 'sculpture': {
      // 抽象雕塑：方形底座 + 交叠曲面 + 一道弧线
      let s = ec(0,0,w*.46,d*.46,'#000','opacity=".08"');
      s += rc(-w*.28,-d*.28,w*.56,d*.56,shade(c,.72),'rx="6"');
      s += ec(-w*.05,-d*.04,w*.2,d*.3,shade(c,1.16),'transform="rotate(20)" opacity=".95"');
      s += ec(w*.1,d*.08,w*.16,d*.22,shade(c,.9),'transform="rotate(-25)" opacity=".95"');
      s += qP(`M${-w*.22} ${d*.32}Q0 ${-d*.3} ${w*.24} ${d*.24}`,'none',`stroke="${shade(c,.55)}" stroke-width="6" opacity=".7"`);
      return s;
    }
    case 'candleholder': {
      // 烛台：底盘 + 三支蜡烛 + 火苗
      let s = ec(0,0,w*.44,d*.44,shade(c,.6));
      s += ec(0,0,w*.36,d*.36,shade(c,1.18));
      [[-w*.16,-d*.1],[w*.16,-d*.1],[0,d*.2]].forEach(([px,py])=>{
        s += ec(px,py,w*.09,d*.09,'#f7f0df') + ec(px,py,w*.032,d*.032,'#f6c86a','opacity=".95"');
      });
      s += ec(-w*.14,-d*.15,w*.1,d*.07,'#ffffff','opacity=".3"');
      return s;
    }
    case 'decotray': {
      // 装饰托盘：椭圆盘 + 内圈描边 + 几件小摆设
      let s = ec(0,0,w*.46,d*.4,shade(c,.6));
      s += ec(0,0,w*.4,d*.34,shade(c,1.2));
      s += ec(0,0,w*.36,d*.3,'none',`stroke="${shade(c,.7)}" stroke-width="3"`);
      s += ec(-w*.16,d*.02,w*.09,d*.09,'#9bad8e') + ec(w*.12,-d*.08,w*.07,d*.07,'#c8a86e') + ec(w*.18,d*.1,w*.055,d*.055,'#b98f6e');
      return s;
    }
    case 'gramophone': {
      // 留声机：木箱底座 + 金色大喇叭俯视 + 转盘唱片 + 摇柄
      let s = rc(-w*.32,-d*.3,w*.64,d*.6,shade(c,.7),'rx="8"');
      s += qR(-w*.26,-d*.24,w*.52,d*.42,shade(c,1.14),'opacity=".5"');
      s += ec(w*.1,-d*.02,w*.3,d*.28,'#d9b56c');
      s += ec(w*.1,-d*.02,w*.2,d*.19,'#ecd7a4');
      s += ec(w*.1,-d*.02,w*.08,d*.08,shade(c,.5));
      s += ec(-w*.14,d*.16,w*.11,d*.11,'#1c1a18');
      s += ec(-w*.14,d*.16,w*.05,d*.05,'#c8a86e');
      s += qL(-w*.3,d*.3,-w*.42,d*.42,`stroke="${shade(c,.55)}" stroke-width="4" stroke-linecap="round"`);
      return s;
    }
    case 'tree': {
      // 乔木：树冠多层次叶簇 + 树干与枝丫 + 落地树影
      let s = qE(0,m*.1,m*.46,m*.42,'#000','opacity=".1"');
      const cols=[shade(c,.82),c,shade(c,1.14),shade(c,.95)];
      for(let k=0;k<22;k++){
        const a=k*2.4, rr=m*(.1+(k%5)*.075), px=Math.cos(a)*rr, py=Math.sin(a)*rr*.82;
        s += qE(px,py,m*(.13+(k%3)*.03),m*(.1+(k%2)*.025),cols[k%4],'opacity=".92"');
      }
      s += qE(0,0,m*.38,m*.34,shade(c,.9),'opacity=".35"');
      s += qR(-m*.045,m*.06,m*.09,m*.3,'#5a4838','rx="8"');
      for(let k=0;k<5;k++){
        const a=k*1.26;
        s += qL(0,m*.2,Math.cos(a)*m*.26,m*.06+Math.sin(a)*m*.14,`stroke="#5a4838" stroke-width="5" opacity=".8"`);
      }
      for(let k=0;k<8;k++){
        const a=k*.8;
        s += qLeafS(Math.cos(a)*m*.3,Math.sin(a)*m*.24,m*.075,m*.04,a*60,cols[k%4],.95);
      }
      return s;
    }
    case 'swing': {
      // 户外秋千：A 字木架 + 横梁 + 吊绳 + 坐板与软垫
      let s = qLo(x+w*.08,y+d*.1,w*.84,d*.8,.1,16);
      s += rc(x+w*.06,y+d*.08,w*.88,d*.1,shade(c,.7),'rx="8"');
      s += qWood(x+w*.06,y+d*.08,w*.88,d*.1,2);
      [[x+w*.08,y+d*.14],[x+w*.84,y+d*.14]].forEach(([px,py])=>{
        s += pa(`M${px} ${py}L${px+w*.04} ${y+d*.9}L${px+w*.1} ${y+d*.9}L${px+w*.06} ${py}Z`,shade(c,1.05));
        s += qL(px+w*.02,py+d*.05,px+w*.07,y+d*.86,`stroke="${shade(c,.65)}" stroke-width="2.5" opacity=".5"`);
      });
      s += rc(x+w*.1,y+d*.2,w*.8,d*.05,shade(c,.82),'rx="4"');
      for(let k=0;k<2;k++){
        const px=x+w*(.3+k*.4);
        s += qL(px,y+d*.2,px,y+d*.66,`stroke="#8a7a62" stroke-width="3" opacity=".85"`);
      }
      s += rc(x+w*.22,y+d*.64,w*.56,d*.14,shade(c,1.14),'rx="10"');
      s += qPlankS(x+w*.24,y+d*.66,w*.52,d*.1,2,c);
      s += rc(x+w*.28,y+d*.58,w*.44,d*.08,'#f3e6d8','rx="10" opacity=".7"');
      return s;
    }
    case 'gpath': {
      // 汀步石 / 木栈道：按名称分石材或木板
      const wood = /木|栈道|wood|deck/i.test((meta&&meta.name)||'');
      let s = '';
      if (wood){
        s += rc(x,y,w,d,shade(c,.72),'rx="6"');
        s += qPlankS(x+20,y+20,w-40,d-40,Math.max(5,Math.round(d/150)),c);
        s += qHi(x+20,y+20,w-40,d*.08,.14,4);
      } else {
        s += qE(0,0,w*.48,d*.46,'#000','opacity=".07"');
        for(let k=0;k<5;k++){
          const px=x+w*(.12+k*.19), py=y+d*(.42+(k%2)*.16), rr=Math.min(w*.09,d*.3);
          s += qE(px,py,rr,rr*.78,k%2?shade(c,1.1):shade(c,.92),'opacity=".95"');
          s += qStoneS(px-rr,py-rr*.6,rr*2,rr*1.2,c);
          s += qHi(px-rr*.5,py-rr*.5,rr*.7,rr*.2,.14,10);
        }
      }
      return s;
    }
    case 'pond': {
      // 锦鲤水池：自然岸线 + 水面波光 + 荷叶与锦鲤 + 岸石
      let s = qE(0,0,w*.48,d*.46,'#000','opacity=".1"');
      s += pa(`M${x+w*.06} ${y+d*.4}Q${x+w*.2} ${y+d*.08} ${x+w*.5} ${y+d*.12}Q${x+w*.86} ${y+d*.14} ${x+w*.94} ${y+d*.44}Q${x+w*.9} ${y+d*.88} ${x+w*.5} ${y+d*.9}Q${x+w*.14} ${y+d*.88} ${x+w*.06} ${y+d*.4}Z`,'#5a97a8');
      s += pa(`M${x+w*.1} ${y+d*.42}Q${x+w*.24} ${y+d*.16} ${x+w*.5} ${y+d*.18}Q${x+w*.82} ${y+d*.2} ${x+w*.9} ${y+d*.45}Q${x+w*.86} ${y+d*.82} ${x+w*.5} ${y+d*.84}Q${x+w*.18} ${y+d*.82} ${x+w*.1} ${y+d*.42}Z`,'#7fc0d0','opacity=".72"');
      s += qRippleS(0,0,w*.32,'#dff2f8',4);
      for(let k=0;k<4;k++){
        const a=k*1.6, px=Math.cos(a)*w*.22, py=Math.sin(a)*d*.2;
        s += qE(px,py,w*.075,d*.05,'#5f8f4e','opacity=".85"');
        s += qL(px,py,px+w*.02,py+d*.02,`stroke="#2e5227" stroke-width="1.6" opacity=".5"`);
      }
      for(let k=0;k<2;k++){
        const px=x+w*(.36+k*.28), py=y+d*(.42+k*.18);
        s += pa(`M${px} ${py}q${w*.05} ${-d*.05} ${w*.1} 0q${-w*.05} ${d*.05} ${-w*.1} 0Z`,k?'#e8a090':'#f6d27a','opacity=".9"');
        s += qL(px+w*.1,py,px+w*.14,py-d*.02,`stroke="${k?'#e8a090':'#f6d27a'}" stroke-width="3" opacity=".8"`);
      }
      for(let k=0;k<14;k++){
        const a=k*Math.PI/7;
        s += qE(Math.cos(a)*w*.47,Math.sin(a)*d*.46,w*.04,d*.035,shade(c,.8+(k%3)*.07),'opacity=".9"');
      }
      return s;
    }
    case 'outdoorsofa': {
      // 户外藤编沙发：编织纹理 + 分格坐垫 + 抱枕 + 圆扶手
      let s = qLo(x+22,y+22,w-44,d-44,.12,26);
      s += rc(x,y,w,d,shade(c,.9),'rx="30"');
      s += rc(x+w*.03,y+d*.08,w*.94,d*.78,'none',`stroke="${shade(c,.6)}" stroke-width="3" opacity=".5"`);
      for(let i=0;i<14;i++) s += qL(x+w*(.05+i*.066),y+d*.1,x+w*(.05+i*.066),y+d*.86,`stroke="${shade(c,.7)}" stroke-width="2" opacity=".4"`);
      for(let j=0;j<7;j++) s += qL(x+w*.04,y+d*(.12+j*.12),x+w*.96,y+d*(.12+j*.12),`stroke="${shade(c,1.15)}" stroke-width="2" opacity=".35"`);
      s += rc(x+w*.06,y+d*.06,w*.88,d*.24,shade(c,1.16),'rx="18"');
      const n=3;
      for(let i=0;i<n;i++){
        const px=x+w*(.1+i*.29);
        s += rc(px,y+d*.36,w*.26,d*.46,'#f3ece0','rx="16"');
        s += qHi(px+10,y+d*.38,w*.2,d*.07,.24,8);
        s += qL(px+w*.13,y+d*.38,px+w*.13,y+d*.8,`stroke="${shade(c,.75)}" stroke-width="2" opacity=".4"`);
      }
      s += rc(x+w*.16,y+d*.14,w*.18,d*.2,'#e8d9c3','rx="14"');
      s += rc(x+w*.66,y+d*.14,w*.18,d*.2,'#d9c9ae','rx="14"');
      s += qHi(x+w*.18,y+d*.16,w*.1,d*.05,.3,6);
      return s;
    }
    case 'outdoorchair': {
      // 户外藤编单椅：圆形编织座 + 靠背 + 坐垫
      let s = qE(0,d*.06,w*.44,d*.42,'#000','opacity=".1"');
      s += ec(0,0,w*.46,d*.46,shade(c,.9));
      for(let k=0;k<12;k++){
        const a=k*Math.PI/6;
        s += qL(0,0,Math.cos(a)*w*.44,Math.sin(a)*d*.44,`stroke="${shade(c,.65)}" stroke-width="2.4" opacity=".45"`);
      }
      for(let k=1;k<4;k++) s += ec(0,0,w*.46*k/4,d*.46*k/4,'none',`stroke="${shade(c,1.15)}" stroke-width="2.4" opacity=".45"`);
      s += ec(0,0,w*.34,d*.34,'#f3ece0');
      s += qHi(-w*.16,-d*.18,w*.26,d*.1,.22,20);
      s += ec(0,-d*.3,w*.34,d*.16,shade(c,.78));
      return s;
    }
    case 'hangingchair': {
      // 吊篮椅：圆形吊篮 + 编织网 + 坐垫 + 吊链与支架
      let s = qE(0,d*.16,w*.4,d*.34,'#000','opacity=".1"');
      s += qL(0,-d*.46,0,-d*.2,`stroke="#4a4540" stroke-width="5" opacity=".8"`);
      s += ec(0,-d*.46,w*.12,d*.05,'#4a4540');
      s += ec(0,0,w*.42,d*.42,shade(c,.9));
      for(let k=0;k<14;k++){
        const a=k*Math.PI/7;
        s += qL(0,-d*.2,Math.cos(a)*w*.4,Math.sin(a)*d*.4,`stroke="${shade(c,.62)}" stroke-width="2.2" opacity=".55"`);
      }
      for(let k=1;k<4;k++) s += ec(0,0,w*.4*k/4,d*.4*k/4,'none',`stroke="${shade(c,1.2)}" stroke-width="2" opacity=".45"`);
      s += ec(0,d*.08,w*.3,d*.2,'#f3ece0');
      s += qHi(-w*.12,-d*.02,w*.2,d*.07,.24,14);
      s += ec(0,-d*.24,w*.18,d*.07,'#e8d9c3');
      return s;
    }
    case 'hammock': {
      // 吊床：两端吊绳 + 弧形床面 + 条纹织物 + 流苏
      let s = qE(0,d*.1,w*.44,d*.26,'#000','opacity=".09"');
      [[x+w*.04,x+w*.2],[x+w*.96,x+w*.8]].forEach(([ex,ix])=>{
        s += qL(ex,y+d*.2,ix,y+d*.5,`stroke="#8a7a62" stroke-width="4" opacity=".85"`);
        s += qL(ex,y+d*.8,ix,y+d*.5,`stroke="#8a7a62" stroke-width="4" opacity=".85"`);
        s += ec(ex,y+d*.5,w*.03,d*.06,'#6b5d4c');
      });
      s += pa(`M${x+w*.2} ${y+d*.5}Q${x+w*.5} ${y+d*.94} ${x+w*.8} ${y+d*.5}Q${x+w*.5} ${y+d*.7} ${x+w*.2} ${y+d*.5}Z`,shade(c,1.08));
      for(let i=0;i<9;i++){
        const px=x+w*(.22+i*.07);
        s += qL(px,y+d*.56,px,y+d*.78,`stroke="${shade(c,.7)}" stroke-width="3" opacity=".55"`);
      }
      for(let i=0;i<12;i++){
        const px=x+w*(.21+i*.058);
        s += qL(px,y+d*.78,px,y+d*.86,`stroke="${shade(c,.75)}" stroke-width="2.5" opacity=".65"`);
      }
      return s;
    }
    case 'shadesail': {
      // 三角遮阳帆：三边内凹弧 + 布料明暗 + 角环与拉索
      let s = qE(0,0,w*.48,d*.46,'#000','opacity=".08"');
      const pts=[[x+w*.06,y+d*.12],[x+w*.94,y+d*.2],[x+w*.44,y+d*.92]];
      s += pa(`M${pts[0][0]} ${pts[0][1]}Q${x+w*.5} ${y+d*.02} ${pts[1][0]} ${pts[1][1]}Q${x+w*.72} ${y+d*.62} ${pts[2][0]} ${pts[2][1]}Q${x+w*.2} ${y+d*.62} ${pts[0][0]} ${pts[0][1]}Z`,shade(c,1.06));
      s += pa(`M${pts[0][0]} ${pts[0][1]}Q${x+w*.5} ${y+d*.1} ${pts[1][0]} ${pts[1][1]}Q${x+w*.66} ${y+d*.56} ${pts[2][0]} ${pts[2][1]}Z`,shade(c,.9),'opacity=".55"');
      pts.forEach(([px,py])=>{
        s += ec(px,py,m*.035,m*.035,'#4a4540');
        s += ec(px,py,m*.018,m*.018,'#efe6d8');
      });
      s += qHi(x+w*.2,y+d*.2,w*.24,d*.08,.16,16);
      return s;
    }
    case 'gazebo': {
      // 六角凉亭：双层檐顶 + 六柱 + 栏杆 + 中心地坪
      let s = qE(0,0,w*.48,d*.46,'#000','opacity=".09"');
      const R=w*.44, cy=0, pts=[];
      for(let k=0;k<6;k++){ const a=k*Math.PI/3; pts.push([Math.cos(a)*R,Math.sin(a)*R*.94]); }
      s += pa(`M${pts.map(p=>p.join(' ')).join('L')}Z`,shade(c,1.08));
      for(let k=0;k<6;k++){
        const a=k*Math.PI/3, b=(k+1)*Math.PI/3;
        s += pa(`M0 0L${Math.cos(a)*R} ${Math.sin(a)*R*.94}L${Math.cos(b)*R} ${Math.sin(b)*R*.94}Z`,k%2?shade(c,.88):shade(c,1.16),'opacity=".72"');
        s += qL(0,0,Math.cos(a)*R,Math.sin(a)*R*.94,`stroke="${shade(c,.6)}" stroke-width="3" opacity=".6"`);
      }
      s += ec(0,0,w*.3,d*.28,'#f3ede0','opacity=".75"');
      s += ec(0,0,w*.14,d*.13,shade(c,1.2));
      pts.forEach(([px,py])=>{
        s += ec(px,py,w*.045,d*.045,shade(c,.7));
        s += ec(px,py,w*.022,d*.022,shade(c,1.2));
      });
      for(let k=0;k<6;k++){
        const a=k*Math.PI/3,b=(k+1)*Math.PI/3;
        s += qL(Math.cos(a)*R*.82,Math.sin(a)*R*.94*.82,Math.cos(b)*R*.82,Math.sin(b)*R*.94*.82,`stroke="${shade(c,.72)}" stroke-width="3" opacity=".65"`);
      }
      return s;
    }
    case 'gardenarch': {
      // 花架拱门：双柱 + 拱形横梁 + 格栅 + 攀藤花
      let s = qLo(x+w*.06,y+d*.1,w*.88,d*.8,.1,10);
      s += rc(x+w*.04,y+d*.3,w*.1,d*.68,shade(c,.78),'rx="6"');
      s += rc(x+w*.86,y+d*.3,w*.1,d*.68,shade(c,.78),'rx="6"');
      s += qWood(x+w*.04,y+d*.3,w*.1,d*.68,4);
      s += qWood(x+w*.86,y+d*.3,w*.1,d*.68,4);
      s += pa(`M${x+w*.04} ${y+d*.34}Q${x+w*.5} ${y-d*.16} ${x+w*.96} ${y+d*.34}L${x+w*.96} ${y+d*.46}Q${x+w*.5} ${y-d*.02} ${x+w*.04} ${y+d*.46}Z`,shade(c,1.08));
      for(let i=0;i<7;i++){
        const px=x+w*(.12+i*.13);
        s += qL(px,y+d*.12,px,y+d*.38,`stroke="${shade(c,.7)}" stroke-width="2.6" opacity=".6"`);
      }
      for(let k=0;k<10;k++){
        const px=x+w*(.1+k*.085), py=y+d*(.16+(k%3)*.1);
        s += qLeafS(px,py,m*.055,m*.03,k*43,['#5f8f4e','#7eab62','#4e7a40'][k%3],.9);
        if(k%2===0) s += qBloomS(px+m*.03,py-m*.03,m*.028,['#f3e6d8','#e8a090'][k%2]);
      }
      return s;
    }
    case 'firepit': {
      // 户外火盆：石砌外圈 + 炭火 + 火焰 + 木柴
      let s = qE(0,d*.05,w*.46,d*.42,'#000','opacity=".12"');
      s += ec(0,0,w*.46,d*.46,shade(c,.8));
      s += ec(0,0,w*.38,d*.38,shade(c,1.14));
      s += qStoneS(-w*.4,-d*.4,w*.8,d*.8,c);
      s += ec(0,0,w*.28,d*.28,'#2a2018');
      s += ec(0,0,w*.22,d*.22,'#ff7a30','opacity=".55"');
      s += ec(0,0,w*.14,d*.14,'#ffd06a','opacity=".8"');
      for(let k=0;k<7;k++){
        const a=k*Math.PI/3.5;
        s += pa(`M${Math.cos(a)*w*.08} ${Math.sin(a)*d*.08}Q${Math.cos(a)*w*.16+12} ${-d*.16} ${Math.cos(a)*w*.1} ${-d*.24}Q${Math.cos(a)*w*.04} ${-d*.1} ${Math.cos(a)*w*.08} ${Math.sin(a)*d*.08}Z`,k%2?'#ffb04a':'#ff7a30','opacity=".8"');
      }
      for(let k=0;k<3;k++){
        const a=k*2.1;
        s += qL(-Math.cos(a)*w*.16,-Math.sin(a)*d*.12,Math.cos(a)*w*.16,Math.sin(a)*d*.12,`stroke="#6b4a30" stroke-width="9" opacity=".75"`);
      }
      for(let k=0;k<12;k++){
        const a=k*Math.PI/6;
        s += qE(Math.cos(a)*w*.43,Math.sin(a)*d*.43,w*.05,d*.045,shade(c,.86+(k%3)*.07),'opacity=".95"');
      }
      return s;
    }
    case 'barcounter': {
      // 户外吧台：石纹台面 + 木条立面 + 杯具与高脚凳位
      let s = qLo(x+22,y+22,w-44,d-44,.13,16);
      s += rc(x,y+d*.18,w,d*.82,shade(c,.86),'rx="14"');
      s += qPlankS(x+w*.04,y+d*.24,w*.92,d*.66,4,c);
      s += rc(x,y,w,d*.26,shade(c,1.2),'rx="12"');
      s += qStoneS(x+w*.03,y+d*.02,w*.94,d*.2,c);
      s += qHi(x+w*.05,y+d*.03,w*.5,d*.04,.22,5);
      for(let k=0;k<3;k++){
        const px=x+w*(.24+k*.26);
        s += ec(px,y+d*.1,w*.035,d*.05,'#e8eef3','opacity=".85"');
        s += qR(px-w*.012,y+d*.02,w*.024,d*.07,'#cfe4ec','rx="3" opacity=".8"');
      }
      s += rc(x+w*.1,y+d*.7,w*.8,d*.05,shade(c,.6),'rx="4" opacity=".6"');
      return s;
    }
    case 'flowerpot': {
      // 陶罐花器：罐身曲线 + 环纹 + 高光 + 花草
      let s = qE(0,m*.34,m*.24,m*.07,'#000','opacity=".12"');
      s += pa(`M${-m*.2} ${-m*.02}Q${-m*.3} ${m*.16} ${-m*.22} ${m*.4}Q0 ${m*.48} ${m*.22} ${m*.4}Q${m*.3} ${m*.16} ${m*.2} ${-m*.02}Z`,shade(c,.92));
      s += rc(-m*.24,-m*.06,m*.48,m*.09,shade(c,1.16),'rx="8"');
      for(let i=0;i<3;i++) s += qL(-m*.24,m*(.1+i*.09),m*.24,m*(.1+i*.09),`stroke="${shade(c,.7)}" stroke-width="2.5" opacity=".5"`);
      s += qHi(-m*.18,m*.02,m*.1,m*.28,.2,10);
      s += ec(0,-m*.06,m*.23,m*.06,'#3d2f22');
      for(let k=0;k<9;k++){
        const a=k*Math.PI*2/9, px=Math.cos(a)*m*.2, py=Math.sin(a)*m*.12-m*.2;
        s += qLeafS(px,py,m*.1,m*.05,a*60,['#5f8f4e','#7eab62','#4e7a40'][k%3],.92);
      }
      for(let k=0;k<3;k++){
        const a=k*2.1; s += qBloomS(Math.cos(a)*m*.16,Math.sin(a)*m*.1-m*.24,m*.055,['#f3e6d8','#e8a090','#f6d27a'][k]);
      }
      return s;
    }
    case 'rockery': {
      // 景石假山：多块山石层叠 + 石材纹理 + 青苔与小草
      let s = qE(0,d*.16,w*.44,d*.3,'#000','opacity=".1"');
      const rocks=[[0,-d*.05,w*.2,d*.2,shade(c,1.1)],[-w*.24,d*.12,w*.17,d*.17,shade(c,.88)],[w*.22,d*.1,w*.18,d*.16,shade(c,.95)],[0,d*.24,w*.3,d*.14,shade(c,.78)]];
      rocks.forEach(([px,py,rw,rd,col],i)=>{
        s += pa(`M${px-rw} ${py+rd*.4}Q${px-rw*.7} ${py-rd*.5} ${px} ${py-rd}Q${px+rw*.8} ${py-rd*.4} ${px+rw} ${py+rd*.4}Q${px} ${py+rd} ${px-rw} ${py+rd*.4}Z`,col);
        s += qStoneS(px-rw*.8,py-rd*.6,rw*1.6,rd*1.3,col);
        s += qHi(px-rw*.5,py-rd*.5,rw*.5,rd*.25,.14,10);
      });
      for(let k=0;k<10;k++){
        const px=x+w*(.1+(k*137%80)/100), py=y+d*(.2+(k*89%60)/100);
        s += qE(px,py,m*.035,m*.022,'#6a8a5c','opacity=".7"');
        s += qLeafS(px+m*.02,py-m*.03,m*.05,m*.022,k*37,'#5f8f4e',.85);
      }
      return s;
    }
    case 'birdbath': {
      // 鸟浴盆：石钵 + 水面波 + 立柱与底座 + 停鸟
      let s = qE(0,d*.3,w*.3,d*.12,'#000','opacity=".12"');
      s += ec(0,-d*.1,w*.44,d*.24,shade(c,.86));
      s += ec(0,-d*.12,w*.36,d*.17,shade(c,1.16));
      s += ec(0,-d*.12,w*.3,d*.13,'#7fc0d0','opacity=".9"');
      s += qRippleS(0,-d*.12,w*.3,'#dff2f8',3);
      s += qStoneS(-w*.4,-d*.24,w*.8,d*.26,c);
      s += rc(-w*.11,-d*.02,w*.22,d*.42,shade(c,.8),'rx="8"');
      s += ec(0,d*.4,w*.24,d*.08,shade(c,.72));
      s += qE(-w*.08,-d*.24,w*.075,d*.05,'#8a9aa5','opacity=".9"');
      s += qE(w*.02,-d*.26,w*.05,d*.035,'#8a9aa5','opacity=".9"');
      return s;
    }
    case 'waterwall': {
      // 叠水景墙：石砖墙 + 多层出水口 + 水帘 + 底部水池
      let s = qLo(x+20,y+20,w-40,d-40,.12,10);
      s += rc(x,y,w,d*.82,shade(c,.85),'rx="8"');
      for(let i=0;i<5;i++) for(let j=0;j<2;j++){
        s += rc(x+w*(.03+i*.19),y+d*(.05+j*.36),w*.17,d*.32,i%2?shade(c,1.1):shade(c,.94),'rx="4"');
        s += qStoneS(x+w*(.03+i*.19),y+d*(.05+j*.36),w*.17,d*.32,c);
      }
      for(let i=0;i<4;i++){
        const px=x+w*(.2+i*.2);
        s += qR(px-w*.055,y+d*.36,w*.11,d*.04,'#4a4540','rx="3"');
        s += qL(px,y+d*.4,px,y+d*.78,`stroke="#bfe0ea" stroke-width="6" opacity=".55"`);
        s += qL(px+8,y+d*.42,px+8,y+d*.76,`stroke="#ffffff" stroke-width="2" opacity=".4"`);
      }
      s += rc(x,y+d*.82,w,d*.18,'#5a97a8','rx="6"');
      s += qRippleS(0,y+d*.9,w*.4,'#dff2f8',2);
      return s;
    }
    case 'trellis': {
      // 攀爬花格：浅木框 + 深色菱形格栅 + 藤叶与花
      let s = qLo(x+16,y+16,w-32,d-32,.1,8);
      s += rc(x,y,w,d,shade(c,1.24),'rx="6"');
      s += qWood(x,y,w,d,3);
      s += rc(x+w*.03,y+d*.1,w*.94,d*.8,'none',`stroke="${shade(c,.58)}" stroke-width="6" opacity=".9"`);
      for(let i=0;i<10;i++){
        const px=x+w*(.06+i*.1);
        s += qP(`M${px} ${y+d*.12}L${px+w*.1} ${y+d*.88}M${px} ${y+d*.88}L${px+w*.1} ${y+d*.12}`,'none',`stroke="${shade(c,.48)}" stroke-width="5" opacity=".92"`);
      }
      for(let k=0;k<12;k++){
        const px=x+w*(.08+(k*137%84)/100), py=y+d*(.18+(k*89%64)/100);
        s += qLeafS(px,py,m*.055,m*.032,k*41,['#4e7a40','#5f8f4e','#7eab62'][k%3],.95);
        if(k%3===0) s += qBloomS(px+m*.03,py-m*.02,m*.03,['#f3e6d8','#e8a090'][k%2]);
      }
      return s;
    }
    default: return rc(x,y,w,d,c);
  }
}

/* ======================= 渲染 ======================= */
const NOLABEL = ['tree','swing','gpath','pond','hangingchair','hammock','shadesail','gazebo','gardenarch','firepit','flowerpot','rockery','birdbath','waterwall','trellis','plant','floorlamp','sidetable','barstool','beanbag','hanger','ottoman','artframe','drumstool','floorcushion','speaker','eggchair','gardenlamp','planter','tablelamp','pendant','chandelier','ceilinglamp','walllamp','tracklight','downlight','ledstrip','crystalpendant','globependant','cagependant','torchere','tripodlamp','bankerslamp','globetablelamp','sconce','bollardlight','lantern','wallart','gallerywall','wallmirror','wallclock','tapestry','macrame','wallshelf','floorvase','sculpture','candleholder','decotray','recordwall','gramophone'];
function renderRooms(){
  let s = '';
  // 有图片底图且仍在描墙时几乎透明；CAD 线稿略透明但仍能看出材质网格
  const tracingBg = !!(state.bgImage && planFlags.tracing && !ROOMS.length);
  const roomOp = tracingBg ? '0.06' : (state.bgImage && planFlags.tracing ? '0.72' : (planFlags.cadMode ? '0.82' : '1'));
  ROOMS.forEach(r => {
    const mk = typeof roomMatKey === 'function' ? roomMatKey(r) : ((state.rooms[r.id] && state.rooms[r.id].mat) || r.mat || null);
    const fill = (mk && MATS[mk]) ? `url(#m-${mk})` : '#f4f0e8';
    const pts = r.poly.map(p => p.join(',')).join(' ');
    s += `<polygon class="room" data-room="${r.id}" points="${pts}" fill="${fill}" fill-opacity="${roomOp}"/>`;
    // 选了墙纸的房间：沿房间内缘描一圈淡色带，2D 里也能看出这间换了墙面
    const wk = typeof roomWallKey === 'function' ? roomWallKey(r) : null;
    if (wk && wk !== 'plain' && WALLPAPERS[wk]){
      s += `<polygon points="${pts}" fill="none" stroke="${WALLPAPERS[wk].sw}" stroke-width="110" stroke-opacity=".34" stroke-linejoin="round" pointer-events="none"/>`;
    }
  });
  const sill = ([a,b,c,d]) => `<rect x="${a}" y="${b}" width="${c-a}" height="${d-b}" fill="#e2dacb" stroke="#b9b0a0" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  DOORS.forEach(d => s += sill(d.rect)); SLIDES.forEach(d => s += sill(d.rect));
  $('#gRooms').innerHTML = s;
}

function renderFurn(){
  const g = $('#gFurn');
  g.setAttribute('display', ui.layers.furn ? 'inline' : 'none');
  g.innerHTML = state.furniture.map(f => {
    const fs = Math.max(80, Math.min(170, Math.min(f.w,f.d)*.2));
    const label = Math.min(f.w,f.d) >= 380 && !NOLABEL.includes(f.type)
      ? `<text transform="rotate(${-f.rot})" font-size="${fs}" text-anchor="middle" dominant-baseline="central" fill="#3a352e" stroke="#fcfaf6" stroke-width="${Math.max(7, fs * .15)}" paint-order="stroke" stroke-linejoin="round" pointer-events="none">${esc(nm(f.name))}</text>` : '';
    return `<g class="furn" data-fid="${f.id}" transform="translate(${f.cx} ${f.cy}) rotate(${f.rot})">${furnSVG(f.type,f.w,f.d,f.color,f)}${label}</g>`;
  }).join('');
}

function renderWalls(){
  // CAD 导入：用等厚中心线描边，避免碎矩形叠在一起像像素块
  if (planFlags.cadMode){
    $('#gWalls').innerHTML = WALLS.map((w,i) => {
      const [x0,y0,x1,y1,k] = w, id = 'w'+i, dem = state.demolished.includes(id);
      const thick = Math.min(x1-x0, y1-y0);
      const horiz = (x1-x0) >= (y1-y0);
      const stroke = dem ? '#c65b3a' : (k==='b' && ui.layers.bearing ? '#b8412c' : k==='win' ? '#3d5a6c' : k==='beam' ? '#8a6238' : k==='e' ? '#4a453c' : '#2b2824');
      const dash = dem ? 'stroke-dasharray="120 80"' : (k==='beam' ? 'stroke-dasharray="160 90"' : '');
      const op = dem ? '0.45' : '1';
      if (horiz){
        const y = (y0+y1)/2;
        return `<line class="wall" data-wall="${id}" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${stroke}" stroke-width="${thick}" stroke-linecap="square" opacity="${op}" ${dash}/>`;
      }
      const x = (x0+x1)/2;
      return `<line class="wall" data-wall="${id}" x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${stroke}" stroke-width="${thick}" stroke-linecap="square" opacity="${op}" ${dash}/>`;
    }).join('');
    return;
  }
  $('#gWalls').innerHTML = WALLS.map((w,i) => {
    const [x0,y0,x1,y1,k] = w, id = 'w'+i, dem = state.demolished.includes(id);
    let fill = k==='b' ? (ui.layers.bearing ? '#b8412c' : '#26241f') : k==='win' ? '#5a6d7a' : k==='low' ? '#e9e5dc' : k==='beam' ? '#c4a078' : k==='e' ? '#8f897d' : '#6e695f';
    let ex = k==='low' ? 'stroke="#c8c2b6" stroke-width="1" vector-effect="non-scaling-stroke"'
      : k==='beam' ? 'stroke="#8a6238" stroke-width="1.2" stroke-dasharray="14 8" vector-effect="non-scaling-stroke"' : '';
    if (dem){ fill = 'rgba(198,91,58,.12)'; ex = 'stroke="#c65b3a" stroke-width="1.2" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"'; }
    let html = `<rect class="wall" data-wall="${id}" x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="${fill}" ${ex}/>`;
    // 横梁：平面用木色虚边 + 中心线示意
    if (k === 'beam' && !dem){
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, horiz = (x1 - x0) >= (y1 - y0);
      if (horiz) html += `<line x1="${x0 + 20}" y1="${cy}" x2="${x1 - 20}" y2="${cy}" stroke="#8a6238" stroke-width="3" opacity=".55" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      else html += `<line x1="${cx}" y1="${y0 + 20}" x2="${cx}" y2="${y1 - 20}" stroke="#8a6238" stroke-width="3" opacity=".55" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    }
    // 矮围墙：平面示意立柱 + 透空条纹
    if (k === 'low' && !dem){
      const ww = x1 - x0, hh = y1 - y0, horiz = ww >= hh;
      const long = Math.max(ww, hh), thick = Math.min(ww, hh);
      const n = Math.max(2, Math.round(long / 900));
      for (let i = 0; i <= n; i++){
        const t = i / n;
        if (horiz){
          const px = x0 + t * ww - thick * .15;
          html += `<rect x="${px}" y="${y0 - thick * .1}" width="${thick * .45}" height="${hh + thick * .2}" fill="#ddd8ce" stroke="#c8c2b6" stroke-width="0.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
        } else {
          const py = y0 + t * hh - thick * .15;
          html += `<rect x="${x0 - thick * .1}" y="${py}" width="${ww + thick * .2}" height="${thick * .45}" fill="#ddd8ce" stroke="#c8c2b6" stroke-width="0.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
        }
      }
      if (horiz){
        for (let i = 0; i < 3; i++) html += `<line x1="${x0 + thick}" y1="${y0 + hh * (i + 1) / 4}" x2="${x1 - thick}" y2="${y0 + hh * (i + 1) / 4}" stroke="#cfc9bd" stroke-width="2" opacity=".7" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      } else {
        for (let i = 0; i < 3; i++) html += `<line x1="${x0 + ww * (i + 1) / 4}" y1="${y0 + thick}" x2="${x0 + ww * (i + 1) / 4}" y2="${y1 - thick}" stroke="#cfc9bd" stroke-width="2" opacity=".7" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      }
    }
    return html;
  }).join('');
}

function renderOpenings(){
  const WS = 'stroke="#4f7394" stroke-width="1" vector-effect="non-scaling-stroke"';
  let s = '';
  WINS.forEach((win, i) => {
    const [x0,y0,x1,y1] = win;
    const w = x1-x0, h = y1-y0;
    s += `<rect class="win" data-win="${i}" x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#f7fbfd" ${WS} style="cursor:pointer"/>`;
    if (w >= h) [1/3,2/3].forEach(t => s += `<line x1="${x0}" y1="${y0+h*t}" x2="${x1}" y2="${y0+h*t}" ${WS} pointer-events="none"/>`);
    else [1/3,2/3].forEach(t => s += `<line x1="${x0+w*t}" y1="${y0}" x2="${x0+w*t}" y2="${y1}" ${WS} pointer-events="none"/>`);
  });
  const DS = 'stroke="#3d3a34" stroke-width="1" vector-effect="non-scaling-stroke"';
  DOORS.forEach((d, i) => {
    const [rx0,ry0,rx1,ry1] = d.rect;
    const horiz = (rx1 - rx0) >= (ry1 - ry0);
    const gate = !!(d.gate || /花园门|garden\s*gate/i.test(d.name || ''));
    // 可见标识只贴合门洞。过去它与点击热区共用一个 rect，随热区每侧外扩 120mm，
    // 于是在门两侧染出大片浅红/浅绿，看起来比门本身宽一倍；两者分开后视觉收紧。
    s += `<rect x="${rx0}" y="${ry0}" width="${rx1-rx0}" height="${ry1-ry0}" fill="${gate ? 'rgba(90,120,70,.08)' : 'rgba(181,101,58,.06)'}" stroke="none" pointer-events="none"/>`;
    // 点击热区仍向外扩，保证薄墙上的门也容易点中；完全透明，不参与视觉
    const pad = 120;
    const hx0 = horiz ? rx0 : rx0 - pad, hy0 = horiz ? ry0 - pad : ry0;
    const hw = horiz ? (rx1 - rx0) : (rx1 - rx0 + pad * 2), hh = horiz ? (ry1 - ry0 + pad * 2) : (ry1 - ry0);
    s += `<rect class="door" data-door="${i}" x="${hx0}" y="${hy0}" width="${hw}" height="${hh}" fill="transparent" stroke="none" pointer-events="all" style="cursor:pointer"/>`;
    const [hx,hy] = d.h, L = d.len, T = gate ? 32 : 40;
    const ox = hx + d.o[0]*L, oy = hy + d.o[1]*L, cx = hx + d.c[0]*L, cy = hy + d.c[1]*L;
    const sweep = d.o[0]*d.c[1] - d.o[1]*d.c[0] > 0 ? 1 : 0;
    // 门扇按所选材质着色；未选材质时沿用门型默认（花园门金属黑、入户门橙木色、普通门深灰）
    const fin = doorFinishOf(d);
    const col = gate ? '#2a2a2c' : (fin ? shade(fin.col, .55) : (d.entry ? '#b5653a' : '#3d3a34'));
    const leafFill = gate ? '#fff' : (fin ? (fin.glass ? '#e8f2f8' : shade(fin.col, 1.18)) : '#fff');
    s += `<rect x="${rx0}" y="${ry0}" width="${rx1-rx0}" height="${ry1-ry0}" fill="rgba(255,255,255,.55)" stroke="${col}" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
    if (gate){
      const leaves = (typeof gateLeaves === 'function' ? gateLeaves(d) : (+d.leaves === 1 ? 1 : 2));
      const T2 = 26;
      if (leaves === 1){
        s += `<polygon points="${hx},${hy} ${ox},${oy} ${ox+d.c[0]*T2},${oy+d.c[1]*T2} ${hx+d.c[0]*T2},${hy+d.c[1]*T2}" fill="#2e2e30" stroke="${col}" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
        s += `<path d="M${ox} ${oy}A${L} ${L} 0 0 ${sweep} ${cx} ${cy}" fill="none" ${DS} stroke-dasharray="4 3" opacity=".65" pointer-events="none"/>`;
      } else {
        const half = L * .5;
        const mx = hx + d.c[0] * half, my = hy + d.c[1] * half;
        const ox1 = hx + d.o[0] * half, oy1 = hy + d.o[1] * half;
        const hx2 = hx + d.c[0] * L, hy2 = hy + d.c[1] * L;
        const ox2 = hx2 + d.o[0] * half, oy2 = hy2 + d.o[1] * half;
        s += `<polygon points="${hx},${hy} ${ox1},${oy1} ${ox1+d.c[0]*T2},${oy1+d.c[1]*T2} ${hx+d.c[0]*T2},${hy+d.c[1]*T2}" fill="#3a3a3c" stroke="${col}" stroke-width="1.4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
        s += `<polygon points="${hx2},${hy2} ${ox2},${oy2} ${ox2-d.c[0]*T2},${oy2-d.c[1]*T2} ${hx2-d.c[0]*T2},${hy2-d.c[1]*T2}" fill="#2e2e30" stroke="${col}" stroke-width="1.4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
        s += `<path d="M${ox1} ${oy1}A${half} ${half} 0 0 ${sweep} ${mx} ${my}" fill="none" ${DS} stroke-dasharray="4 3" opacity=".65" pointer-events="none"/>`;
      }
    } else {
      s += `<polygon points="${hx},${hy} ${ox},${oy} ${ox+d.c[0]*T},${oy+d.c[1]*T} ${hx+d.c[0]*T},${hy+d.c[1]*T}" fill="${leafFill}" stroke="${col}" stroke-width="${d.entry?1.8:1}" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      s += `<path d="M${ox} ${oy}A${L} ${L} 0 0 ${sweep} ${cx} ${cy}" fill="none" ${DS} stroke-dasharray="5 3" opacity=".7" pointer-events="none"/>`;
    }
  });
  SLIDES.forEach((sl, i) => {
    const {rect:[x0,y0,x1,y1], v} = sl;
    const n = typeof slideLeaves === 'function' ? slideLeaves(sl) : Math.max(1, Math.min(4, +sl.leaves || 2));
    const toEnd = (typeof slideToSide === 'function' ? slideToSide(sl) : sl.slideTo) === 'end';
    // 浅蓝标识只覆盖推拉门洞（洞宽常仅 60mm），不再随点击热区外扩成一大片淡蓝
    s += `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="rgba(79,115,148,.06)" stroke="none" pointer-events="none"/>`;
    const pad = 120;
    const hx0 = v ? x0 - pad : x0, hy0 = v ? y0 : y0 - pad;
    const hw = v ? (x1 - x0 + pad * 2) : (x1 - x0), hh = v ? (y1 - y0) : (y1 - y0 + pad * 2);
    s += `<rect class="slide" data-slide="${i}" x="${hx0}" y="${hy0}" width="${hw}" height="${hh}" fill="transparent" stroke="none" pointer-events="all" style="cursor:pointer"/>`;
    const L = v ? (y1 - y0) : (x1 - x0);
    const pl = n === 1 ? L * .72 : Math.min(L * .92, L / n + 60);
    const span = Math.max(0, L - pl);
    const thick = 40, gap = 8;
    for (let k = 0; k < n; k++){
      const along = n === 1 ? (L - pl) / 2 : (span * k) / Math.max(1, n - 1);
      const off = ((k % 2) ? 1 : -1) * (thick / 2 + gap / 2);
      if (v){
        const m = (x0 + x1) / 2;
        s += `<rect x="${m + off - thick / 2}" y="${y0 + along}" width="${thick}" height="${pl}" fill="#fff" ${DS} pointer-events="none"/>`;
      } else {
        const m = (y0 + y1) / 2;
        s += `<rect x="${x0 + along}" y="${m + off - thick / 2}" width="${pl}" height="${thick}" fill="#fff" ${DS} pointer-events="none"/>`;
      }
    }
    // 小箭头标示打开后叠靠方向
    const ax = v ? (x0 + x1) / 2 : (toEnd ? x1 - 180 : x0 + 180);
    const ay = v ? (toEnd ? y1 - 180 : y0 + 180) : (y0 + y1) / 2;
    const tip = v
      ? (toEnd ? `M${ax} ${ay - 80}L${ax} ${ay + 80}M${ax - 50} ${ay + 20}L${ax} ${ay + 80}L${ax + 50} ${ay + 20}`
               : `M${ax} ${ay + 80}L${ax} ${ay - 80}M${ax - 50} ${ay - 20}L${ax} ${ay - 80}L${ax + 50} ${ay - 20}`)
      : (toEnd ? `M${ax - 80} ${ay}L${ax + 80} ${ay}M${ax + 20} ${ay - 50}L${ax + 80} ${ay}L${ax + 20} ${ay + 50}`
               : `M${ax + 80} ${ay}L${ax - 80} ${ay}M${ax - 20} ${ay - 50}L${ax - 80} ${ay}L${ax - 20} ${ay + 50}`);
    s += `<path d="${tip}" fill="none" stroke="#4f7394" stroke-width="2" opacity=".75" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  });
  // 入户标识（仅默认户型）
  if (planFlags.hasEntryMark){
    s += `<path d="M3350 8755H4350M4150 8600L4400 8755L4150 8910" fill="none" stroke="#b5653a" stroke-width="2" vector-effect="non-scaling-stroke"/>
          <text x="3380" y="8600" font-size="200" fill="#b5653a">${tr('入户','Entry')}</text>`;
  }
  $('#gOpen').innerHTML = s;
}

function renderLabels(){
  const g = $('#gLabels');
  g.setAttribute('display', ui.layers.labels ? 'inline' : 'none');
  // 图片底图仅作对照，不应把房间名/面积压成浅灰；只有「清空墙体描墙」时才轻微降低以免遮挡底图线条
  const labOp = (state.bgImage && planFlags.tracing) ? '0.88' : '1';
  g.innerHTML = ROOMS.filter(r => r.at).map(r => {
    const [x,y] = r.at;
    // 描边光晕按字号分档，保证深色地砖与浅色木地板上都能读清，小字也不会被白边糊住
    const haloName = 'stroke="#fcfaf6" stroke-width="46" paint-order="stroke" stroke-linejoin="round"';
    const haloArea = 'stroke="#fcfaf6" stroke-width="34" paint-order="stroke" stroke-linejoin="round"';
    return `<g opacity="${labOp}"><text x="${x}" y="${y}" font-size="250" font-weight="700" text-anchor="middle" fill="#201d19" ${haloName}>${esc(nm(state.rooms[r.id].name))}</text>
      <text x="${x}" y="${y+260}" font-size="180" font-weight="600" text-anchor="middle" fill="#463e34" ${haloArea}>${fmt(area(r.poly))} m²</text></g>`;
  }).join('');
}

function renderDims(){
  const DC = '#7d7160', LS = `stroke="${DC}" stroke-width="1" vector-effect="non-scaling-stroke"`, TK = `stroke="${DC}" stroke-width="2" vector-effect="non-scaling-stroke"`;
  const txt = (x,y,v,rot) => `<text x="${x}" y="${y}" font-size="${v<400?140:200}" text-anchor="middle" fill="${DC}" ${rot?`transform="rotate(-90 ${x} ${y})"`:''}>${v}</text>`;
  const chain = (horiz, at, start, segs) => {
    if (!segs.length) return '';
    const pts = [start]; segs.forEach(v => pts.push(pts[pts.length-1]+v));
    let s = horiz ? `<line x1="${pts[0]}" y1="${at}" x2="${pts.at(-1)}" y2="${at}" ${LS}/>` : `<line x1="${at}" y1="${pts[0]}" x2="${at}" y2="${pts.at(-1)}" ${LS}/>`;
    pts.forEach(p => s += horiz
      ? `<line x1="${p}" y1="${at-170}" x2="${p}" y2="${at+170}" ${LS}/><line x1="${p-80}" y1="${at+80}" x2="${p+80}" y2="${at-80}" ${TK}/>`
      : `<line x1="${at-170}" y1="${p}" x2="${at+170}" y2="${p}" ${LS}/><line x1="${at-80}" y1="${p+80}" x2="${at+80}" y2="${p-80}" ${TK}/>`);
    segs.forEach((v,i) => { const mid = (pts[i]+pts[i+1])/2; s += horiz ? txt(mid, at-70, v) : txt(at-70, mid, v, true); });
    return s;
  };
  /** 自定义/导入户型：按外轮廓墙自动推分段尺寸 */
  const autoDims = () => {
    const walls = WALLS.filter((w, i) => !state.demolished.includes('w' + i) && (w[4] || 'n') !== 'low' && (w[4] || 'n') !== 'beam');
    const use = walls.length ? walls : WALLS.filter((w, i) => !state.demolished.includes('w' + i));
    if (!use.length) return '';
    const xs = use.flatMap(w => [w[0], w[2]]), ys = use.flatMap(w => [w[1], w[3]]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const tol = 80;
    const uniqSorted = (arr) => {
      const a = [...arr].map(v => Math.round(v / 10) * 10).sort((p, q) => p - q);
      const out = [];
      a.forEach(v => { if (!out.length || Math.abs(out[out.length - 1] - v) > 30) out.push(v); });
      return out;
    };
    const segsFrom = (pts) => {
      const s = [];
      for (let i = 0; i < pts.length - 1; i++){
        const d = Math.round(pts[i + 1] - pts[i]);
        if (d >= 50) s.push(d);
      }
      return s;
    };
    // 顶/底边：靠近外轮廓的水平墙端点 + 竖墙端
    const topXs = [x0, x1], botXs = [x0, x1], leftYs = [y0, y1], rightYs = [y0, y1];
    use.forEach(w => {
      const [a, b, c, d] = w;
      if (wallIsHoriz(w)){
        if (Math.abs(b - y0) <= tol || Math.abs(d - y0) <= tol){ topXs.push(a, c); }
        if (Math.abs(b - y1) <= tol || Math.abs(d - y1) <= tol){ botXs.push(a, c); }
      } else {
        if (Math.abs(a - x0) <= tol || Math.abs(c - x0) <= tol){ leftYs.push(b, d); }
        if (Math.abs(a - x1) <= tol || Math.abs(c - x1) <= tol){ rightYs.push(b, d); }
        if (Math.min(b, d) <= y0 + tol) topXs.push(a, c);
        if (Math.max(b, d) >= y1 - tol) botXs.push(a, c);
        if (Math.min(a, c) <= x0 + tol) leftYs.push(b, d);
        if (Math.max(a, c) >= x1 - tol) rightYs.push(b, d);
      }
    });
    const topSegs = segsFrom(uniqSorted(topXs));
    const botSegs = segsFrom(uniqSorted(botXs));
    const leftSegs = segsFrom(uniqSorted(leftYs));
    const rightSegs = segsFrom(uniqSorted(rightYs));
    const W = Math.round(x1 - x0), H = Math.round(y1 - y0);
    let s = '';
    s += chain(true, y0 - 700, x0, topSegs.length ? topSegs : [W]);
    s += chain(true, y0 - 1200, x0, [W]);
    s += chain(true, y1 + 700, x0, botSegs.length ? botSegs : [W]);
    s += chain(true, y1 + 1200, x0, [W]);
    s += chain(false, x0 - 700, y0, leftSegs.length ? leftSegs : [H]);
    s += chain(false, x0 - 1200, y0, [H]);
    s += chain(false, x1 + 700, y0, rightSegs.length ? rightSegs : [H]);
    s += chain(false, x1 + 1200, y0, [H]);
    return s;
  };
  const g = $('#gDims');
  g.innerHTML = planFlags.hasDefaultDims
    ? (
      chain(true,-750,0,[1580,240,2760,240,1540,240,3670]) + chain(true,-1250,0,[10270]) +
      chain(true,11350,0,[2180,240,2160,240,5450,240,1340]) + chain(true,11850,0,[11850]) +
      chain(false,-800,0,[3370,1580,240,2770,240,2360]) + chain(false,-1300,0,[10560]) +
      chain(false,12750,0,[3370,240,2760,240,3950]) + chain(false,13250,0,[10560])
    )
    : autoDims();
  g.setAttribute('display', ui.layers.dims ? 'inline' : 'none');
}

function ensureBgFrame(){
  if (state.bgFrame && Number.isFinite(state.bgFrame.w) && state.bgFrame.w > 0 && Number.isFinite(state.bgFrame.h) && state.bgFrame.h > 0){
    return state.bgFrame;
  }
  return {x:BOUNDS.x, y:BOUNDS.y, w:BOUNDS.w, h:BOUNDS.h};
}
/** 底图缩放倍率（1=100%）；兼容误存百分数 */
function bgScaleMul(){
  let s = state.bgScale == null ? 1 : +state.bgScale;
  if (!Number.isFinite(s)) s = 1;
  if (s > 10) s = s / 100;
  return Math.max(0.1, Math.min(8, s));
}
/** 底图透明度 0–1；兼容误存百分数 */
function bgOpacity01(){
  let o = state.bgOpacity == null ? 0.45 : +state.bgOpacity;
  if (!Number.isFinite(o)) o = 0.45;
  if (o > 1) o = o / 100;
  return Math.max(0, Math.min(1, o));
}
/** 底图实际绘制矩形（含缩放，绕中心） */
function bgDrawRect(){
  const f = ensureBgFrame();
  const s = bgScaleMul();
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
  const w = f.w * s, h = f.h * s;
  return {x: cx - w / 2, y: cy - h / 2, w, h};
}
function renderBg(){
  const g = $('#gBg');
  if (!g) return;
  const parts = [];
  if (state.bgImage){
    const op = bgOpacity01();
    const r = bgDrawRect();
    parts.push(`<image href="${state.bgImage}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" opacity="${op}" preserveAspectRatio="xMidYMid meet"/>`);
  }
  // CAD 线稿默认关闭，避免与墙体重叠发花；需要时在图层里打开
  if (ui.layers.cadLines && CAD_UNDERLAY && CAD_UNDERLAY.length){
    parts.push(`<g fill="none" stroke="#6b7c8a" stroke-width="35" stroke-linecap="round" opacity="0.4" pointer-events="none">` +
      CAD_UNDERLAY.map(([x1,y1,x2,y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('') +
      `</g>`);
  }
  g.innerHTML = parts.join('');
}

function renderGrid(){
  $('#gGrid').innerHTML = `<rect x="-20000" y="-20000" width="55000" height="55000" fill="${ui.layers.grid ? 'url(#grid)' : 'transparent'}" data-bg="1"/>`;
}

/* ============================================================
 *  层间连通区域：每层各有自己独立的连通区
 *  1F 是「与上层对齐的锚点」（不挖地面），2F+ 是本层楼板开洞
 *  本层用橙色虚线框 + 删除按钮；其它楼层用青色虚线参考框（可拖动设本层锚点）
 * ============================================================ */
function renderLinks(){
  const g = $('#gLinks');
  if (!g) return;
  const k = 1/view.s, i = state.activeFloor | 0;
  const floors = Array.isArray(state.floors) ? state.floors : [];
  const cur = floors[i];
  // 本层连通区所连通的相邻楼层：1F 为与上层对齐的锚点（指向上层），
  // 其余层为本层楼板开洞（指向下一层）。名称取自相邻层自身，避免出现「0F」。
  const peerIdx = i === 0 ? i + 1 : i - 1;
  const peer = floors[peerIdx];
  const peerNm = (peer && peer.name) || ((peerIdx + 1) + 'F');
  const links = (cur && Array.isArray(cur.links)) ? cur.links : [];
  const cnt = $('#linkCount');
  if (cnt) cnt.textContent = String(links.length);
  // 连通区计数 / 清除只在「连通区」工具且多层时出现；显隐统一收敛到 syncToolOptions()
  if (typeof syncToolOptions === 'function') syncToolOptions();

  // 校验选中引用（ui.linkSel = {f: 楼层索引, i: 该层 links 索引}）
  if (ui.linkSel){
    const f = floors[ui.linkSel.f];
    if (!f || !Array.isArray(f.links) || ui.linkSel.i < 0 || ui.linkSel.i >= f.links.length) ui.linkSel = null;
  }

  // 描边用固定屏幕像素 + non-scaling-stroke，不随缩放变粗
  const rectSvg = (r, fill, stroke, dash, extra) => {
    const [x0, y0, x1, y1] = r;
    return `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="${fill}" stroke="${stroke}"
      stroke-width="1.5" stroke-dasharray="${dash}" vector-effect="non-scaling-stroke" pointer-events="none" ${extra || ''}/>`;
  };
  const textSvg = (x, y, str, col, size) =>
    `<text x="${x}" y="${y}" font-size="${(size || 12)*k}" text-anchor="middle" dominant-baseline="central"
      fill="${col}" font-weight="600" pointer-events="none" stroke="#fffdf9" stroke-width="${3.5*k}"
      paint-order="stroke">${esc(str)}</text>`;
  const delBtn = (f, n, x0, y0, x1, y1, col) => {
    const cxp = x1 - 11*k, cyp = y0 + 11*k, rr = 9*k;
    return `<g data-link-del-floor="${f}" data-link-del="${n}" style="cursor:pointer"><circle cx="${cxp}" cy="${cyp}" r="${rr + 3*k}" fill="transparent" pointer-events="all"/>
      <circle cx="${cxp}" cy="${cyp}" r="${rr}" fill="#fffdf9" stroke="${col}" stroke-width="1.2" vector-effect="non-scaling-stroke" pointer-events="all"/>
      <text x="${cxp}" y="${cyp}" font-size="${14*k}" text-anchor="middle" dominant-baseline="central" fill="${col}" font-weight="700" pointer-events="all">×</text></g>`;
  };
  // 选中态：高亮描边 + 八向手柄（拖动内部 = 移动本层连通区；拖手柄 = 调整大小）
  const selDecor = (f, n, r) => {
    if (!(ui.linkSel && ui.linkSel.f === f && ui.linkSel.i === n)) return '';
    const [x0, y0, x1, y1] = r;
    let out = rectSvg(r, 'rgba(181,101,58,.18)', '#b5653a', '4 3');
    const hs = (COARSE ? 10 : 7) * k;
    const H = {nw:[x0,y0,'nwse-resize'], n:[(x0+x1)/2,y0,'ns-resize'], ne:[x1,y0,'nesw-resize'], e:[x1,(y0+y1)/2,'ew-resize'],
               se:[x1,y1,'nwse-resize'], s:[(x0+x1)/2,y1,'ns-resize'], sw:[x0,y1,'nesw-resize'], w:[x0,(y0+y1)/2,'ew-resize']};
    for (const h in H){
      const [hx, hy, cur] = H[h];
      out += `<rect data-link-floor="${f}" data-link-idx="${n}" data-link-handle="${h}" x="${hx-hs}" y="${hy-hs}" width="${hs*2}" height="${hs*2}" fill="#fffdf9" stroke="#b5653a" stroke-width="1.5" vector-effect="non-scaling-stroke" style="cursor:${cur}" pointer-events="all"/>`;
    }
    out += textSvg((x0+x1)/2, (y0+y1)/2 + 26*k, tr('拖动移动本层连通区 · 不影响其它楼层', 'Drag to move this floor\'s link · other floors unchanged'), '#b5653a', 9.5);
    return out;
  };

  let s = '';
  // 其它楼层的连通区：参考框，可直接拖动。
  // 拖动它会在「本层」建立自己的连通区（对齐锚点）并随鼠标移动；
  // 参考框本身留在原位、另一层的数据完全不变，于是两层在 2D 平面中位置不同，
  // 3D 中由两层建筑各自平移来让它们重合。
  floors.forEach((fl, fi) => {
    if (fi === i || !fl || !Array.isArray(fl.links)) return;
    const tag = fl.name || ((fi + 1) + 'F');
    fl.links.forEach(l => {
      if (!l || !Array.isArray(l.rect) || l.rect.length !== 4) return;
      const [x0, y0, x1, y1] = l.rect;
      s += rectSvg(l.rect, 'rgba(47,93,98,.07)', '#2f5d62', '9 6');
      s += textSvg((x0+x1)/2, (y0+y1)/2, tr(`${tag} 连通区 · 拖动设本层锚点`, `${tag} link · drag to anchor`), '#2f5d62', 10.5);
    });
  });

  // 本层连通区：橙框（1F 为与上层对齐的锚点，其余层为本层楼板开洞）
  links.forEach((l, n) => {
    if (!l || !Array.isArray(l.rect) || l.rect.length !== 4) return;
    const [x0, y0, x1, y1] = l.rect;
    s += rectSvg(l.rect, 'rgba(181,101,58,.13)', '#b5653a', '10 7');
    // 对角斜线，强调这是「洞口」而非普通标注
    const step = Math.max(120, Math.min(x1-x0, y1-y0) / 6);
    for (let t = x0 - (y1-y0); t < x1; t += step){
      const a = Math.max(x0, t), b = Math.min(x1, t + (y1-y0));
      if (b > a) s += `<line x1="${a}" y1="${y0 + (a-t)}" x2="${b}" y2="${y0 + (b-t)}" stroke="#b5653a" stroke-opacity=".28" stroke-width="${1*k}" pointer-events="none"/>`;
    }
    s += textSvg((x0+x1)/2, (y0+y1)/2 - 9*k,
      peer ? tr(`↕ 与 ${peerNm} 连通`, `↕ linked to ${peerNm}`) : tr('↕ 连通区', '↕ link'), '#b5653a', 12);
    s += textSvg((x0+x1)/2, (y0+y1)/2 + 11*k, `${Math.round(x1-x0)} × ${Math.round(y1-y0)} mm`, '#a4765b', 10.5);
    s += delBtn(i, n, x0, y0, x1, y1, '#b5653a');
    s += selDecor(i, n, l.rect);
  });

  // 正在拖拽的草稿
  if (ui.linkA && ui.linkCur){
    const r = [Math.min(ui.linkA.x, ui.linkCur.x), Math.min(ui.linkA.y, ui.linkCur.y),
               Math.max(ui.linkA.x, ui.linkCur.x), Math.max(ui.linkA.y, ui.linkCur.y)];
    if (r[2] > r[0] && r[3] > r[1]){
      s += rectSvg(r, 'rgba(181,101,58,.10)', '#b5653a', '7 5');
      s += textSvg((r[0]+r[2])/2, (r[1]+r[3])/2, `${Math.round(r[2]-r[0])} × ${Math.round(r[3]-r[1])}`, '#b5653a', 11);
    }
  }
  g.innerHTML = s;
}

function renderMeasure(){
  const k = 1/view.s, fs = 12*k;
  const cal = ui.tool === 'calibrate';
  const one = (a,b,tmp) => {
    const L = Math.hypot(b.x-a.x, b.y-a.y); if (L < 1) return '';
    let ang = Math.atan2(b.y-a.y, b.x-a.x)*180/Math.PI; if (ang > 90 || ang < -90) ang += 180;
    const mx = (a.x+b.x)/2, my = (a.y+b.y)/2, nx = -(b.y-a.y)/L*5*k, ny = (b.x-a.x)/L*5*k;
    const col = tmp ? (cal ? '#1a6b5c' : '#2f5d62') : '#b5653a';
    const S = `stroke="${col}" stroke-width="1.5" vector-effect="non-scaling-stroke"${cal && tmp ? ' stroke-dasharray="18 10"' : ''}`;
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${S}/>
      <line x1="${a.x-nx}" y1="${a.y-ny}" x2="${a.x+nx}" y2="${a.y+ny}" ${S}/><line x1="${b.x-nx}" y1="${b.y-ny}" x2="${b.x+nx}" y2="${b.y+ny}" ${S}/>
      <text x="${mx}" y="${my-5*k}" font-size="${fs}" text-anchor="middle" fill="${col}" font-weight="600" transform="rotate(${ang} ${mx} ${my})"
        stroke="#fff" stroke-width="${3.5*k}" paint-order="stroke">${Math.round(L)} mm</text>`;
  };
  let s = state.measures.map(m => one(m.a,m.b)).join('');
  if (ui.mA && ui.mCur) s += one(ui.mA, ui.mCur, true);
  if (ui.mA) s += `<circle cx="${ui.mA.x}" cy="${ui.mA.y}" r="${3*k}" fill="${cal ? '#1a6b5c' : '#2f5d62'}"/>`;
  $('#gMeasure').innerHTML = s;
}

function renderSel(){
  const k = 1/view.s; let s = '';
  if (ui.sel?.kind === 'furn'){
    const f = getF(ui.sel.id);
    if (f){
      // 触屏上手柄更大、离家具更远，并各带一圈透明的大热区
      const p = 5*k, A = 'stroke="#b5653a" vector-effect="non-scaling-stroke"', hs = COARSE ? 1.7 : 1, ro = (COARSE ? 40 : 26)*k, hit = (COARSE ? 24 : 11)*k;
      const sx = f.w/2+p, sy = f.d/2+p;
      s += `<g transform="translate(${f.cx} ${f.cy}) rotate(${f.rot})">
        <rect x="${-f.w/2-p}" y="${-f.d/2-p}" width="${f.w+2*p}" height="${f.d+2*p}" fill="none" ${A} stroke-width="1.5" stroke-dasharray="5 3" pointer-events="none"/>
        <line x1="0" y1="${-f.d/2-p}" x2="0" y2="${-f.d/2-ro}" ${A} stroke-width="1" pointer-events="none"/>
        <circle data-handle="rot" cx="0" cy="${-f.d/2-ro}" r="${hit}" fill="transparent"/>
        <circle data-handle="rot" cx="0" cy="${-f.d/2-ro}" r="${6*hs*k}" fill="#fff" ${A} stroke-width="1.5"><title>${tr('拖动旋转（Shift 自由角度）','Drag to rotate (Shift for free angle)')}</title></circle>
        <circle data-handle="size" cx="${sx}" cy="${sy}" r="${hit}" fill="transparent"/>
        <rect data-handle="size" x="${sx-5*hs*k}" y="${sy-5*hs*k}" width="${10*hs*k}" height="${10*hs*k}" fill="#b5653a"><title>${tr('拖动调整尺寸','Drag to resize')}</title></rect></g>`;
      const {hh} = aabb(f);
      s += `<text x="${f.cx}" y="${f.cy+hh+24*k}" font-size="${12*k}" text-anchor="middle" fill="#b5653a" font-weight="600" pointer-events="none"
        stroke="#fff" stroke-width="${3*k}" paint-order="stroke">${f.w} × ${f.d}</text>`;
    }
  } else if (ui.sel?.kind === 'room'){
    const r = ROOMS.find(r => r.id === ui.sel.id);
    s += `<polygon points="${r.poly.map(p=>p.join(',')).join(' ')}" fill="rgba(181,101,58,.08)" stroke="#b5653a" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
  } else if (ui.sel?.kind === 'wall'){
    const ww = getWall(ui.sel.id);
    if (ww){
      const [x0,y0,x1,y1] = ww.w, horiz = wallIsHoriz(ww.w), hr = (COARSE ? 14 : 9) * k;
      const dem = state.demolished.includes(ww.id);
      s += `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="rgba(181,101,58,.22)" stroke="#b5653a" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"${dem?' stroke-dasharray="8 4"':''}/>`;
      if (horiz){
        const my = (y0 + y1) / 2;
        s += `<circle data-whandle="a" cx="${x0}" cy="${my}" r="${hr}" fill="#fff" stroke="#b5653a" stroke-width="2" vector-effect="non-scaling-stroke"><title>${tr('拖动改长度','Drag to change length')}</title></circle>`;
        s += `<circle data-whandle="b" cx="${x1}" cy="${my}" r="${hr}" fill="#fff" stroke="#b5653a" stroke-width="2" vector-effect="non-scaling-stroke"><title>${tr('拖动改长度','Drag to change length')}</title></circle>`;
      } else {
        const mx = (x0 + x1) / 2;
        s += `<circle data-whandle="a" cx="${mx}" cy="${y0}" r="${hr}" fill="#fff" stroke="#b5653a" stroke-width="2" vector-effect="non-scaling-stroke"><title>${tr('拖动改长度','Drag to change length')}</title></circle>`;
        s += `<circle data-whandle="b" cx="${mx}" cy="${y1}" r="${hr}" fill="#fff" stroke="#b5653a" stroke-width="2" vector-effect="non-scaling-stroke"><title>${tr('拖动改长度','Drag to change length')}</title></circle>`;
      }
      const L = Math.round(wallLenOf(ww.w));
      s += `<text x="${(x0+x1)/2}" y="${(y0+y1)/2}" font-size="${14*k}" text-anchor="middle" dominant-baseline="central" fill="#b5653a" font-weight="600" pointer-events="none" stroke="#fff" stroke-width="${3*k}" paint-order="stroke">${L} mm</text>`;
    }
  } else if (ui.sel?.kind === 'win'){
    const w = WINS[ui.sel.id];
    if (w){
      const [x0,y0,x1,y1] = w;
      s += `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="rgba(79,115,148,.2)" stroke="#4f7394" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      const WW = Math.round(winWidthOf(w)), sill = Math.round(winSillMm(w, ui.sel.id)), head = Math.round(winHeadMm(w));
      s += `<text x="${(x0+x1)/2}" y="${(y0+y1)/2}" font-size="${13*k}" text-anchor="middle" dominant-baseline="central" fill="#4f7394" font-weight="600" pointer-events="none" stroke="#fff" stroke-width="${3*k}" paint-order="stroke">${WW}×${head - sill}</text>`;
    }
  } else if (ui.sel?.kind === 'door'){
    const d = DOORS[ui.sel.id];
    if (d){
      const [x0,y0,x1,y1] = d.rect;
      s += `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="rgba(181,101,58,.22)" stroke="#b5653a" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      s += `<text x="${(x0+x1)/2}" y="${(y0+y1)/2}" font-size="${13*k}" text-anchor="middle" dominant-baseline="central" fill="#b5653a" font-weight="600" pointer-events="none" stroke="#fff" stroke-width="${3*k}" paint-order="stroke">${Math.round(d.len)}×${doorHeightMm(d)}</text>`;
    }
  } else if (ui.sel?.kind === 'slide'){
    const sl = SLIDES[ui.sel.id];
    if (sl){
      const [x0,y0,x1,y1] = sl.rect;
      const L = Math.round(Math.max(x1-x0, y1-y0));
      s += `<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="rgba(79,115,148,.2)" stroke="#4f7394" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      s += `<text x="${(x0+x1)/2}" y="${(y0+y1)/2}" font-size="${13*k}" text-anchor="middle" dominant-baseline="central" fill="#4f7394" font-weight="600" pointer-events="none" stroke="#fff" stroke-width="${3*k}" paint-order="stroke">${L}×${slideHeightMm(sl)}</text>`;
    }
  }
  $('#gSel').innerHTML = s;
}

function renderAll(){
  if (typeof enrichPlainRoomMatsIfNeeded === 'function') enrichPlainRoomMatsIfNeeded();
  renderBg(); renderGrid(); renderRooms(); renderFurn(); renderWalls(); renderLinks(); renderLabels(); renderDims(); renderMeasure(); renderSel(); renderPanel(); updateHeader();
  window.View3D?.sync();
}

function updateHeader(){
  const tot = ROOMS.filter(r => r.counted !== false).reduce((a,r) => a + area(r.poly), 0);
  let sub;
  if (planFlags.tracing && !ROOMS.length){
    sub = tr(`描墙中 · ${WALLS.length} 段墙 · 画完后点「识别房间」`, `Tracing · ${WALLS.length} walls · Detect rooms when done`);
  } else {
    const src = state.plan && !state.plan.hasDefaultDims
      ? tr('CAD 导入户型', 'CAD-imported plan')
      : tr('原图比例 1:60', 'Original scale 1:60');
    sub = tr(`套内使用面积约 ${fmt(tot)} m² · 尺寸单位 mm · ${src}`, `Net floor area ≈ ${fmt(tot)} m² · Units: mm · ${src}`);
  }
  const fl = Array.isArray(state.floors) ? state.floors[state.activeFloor | 0] : null;
  $('#subtitle').textContent = sub + (fl && fl.name ? ' · ' + fl.name : '');
  $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length;
  $('#undo').style.opacity = undoStack.length ? 1 : .4; $('#redo').style.opacity = redoStack.length ? 1 : .4;
  // 厚度是工具偏好，不随撤销栈回退
  const thickIn = $('#wallThickIn');
  if (thickIn && +thickIn.value !== ui.wallThick) thickIn.value = ui.wallThick;
}
