/*! DXF → floor-plan extractor (LINE / LWPOLYLINE / INSERT / ARC). */
(function (global) {
  'use strict';

  const WALL_LAYER_RE = /wall|墙|图层\s*1/i;
  const WIN_LAYER_RE = /window|窗/i;
  const SKIP_LAYER_RE = /furniture|家具|标注|defpoints|hatch|轴网|dim/i;
  // Prefer real masonry thicknesses; ignore flaky 70–110 false pairs from hatch/stairs
  const THICKS = [120, 200, 240, 370];
  const THOL = 25;
  const OLAP = 200;
  const MIN_SEG = 400;
  const MIN_WALL = 500;

  function decodeText(buf) {
    const u8 = new Uint8Array(buf);
    // Prefer UTF-8; many "ANSI_936" exports are actually UTF-8
    try {
      const t = new TextDecoder('utf-8', { fatal: true }).decode(u8);
      if (/[\u4e00-\u9fff]/.test(t) || !/\$DWGCODEPAGE/.test(t)) return t;
    } catch (_) {}
    try {
      return new TextDecoder('gbk').decode(u8);
    } catch (_) {
      try {
        return new TextDecoder('gb18030').decode(u8);
      } catch (_) {
        return new TextDecoder('utf-8', { fatal: false }).decode(u8);
      }
    }
  }

  function parsePairs(text) {
    const lines = text.split(/\r?\n/);
    const pairs = [];
    for (let i = 0; i + 1 < lines.length; i++) {
      const code = parseInt(lines[i].trim(), 10);
      if (Number.isNaN(code)) continue;
      pairs.push([code, lines[i + 1].trim()]);
      i++;
    }
    return pairs;
  }

  function parseDxf(text) {
    const pairs = parsePairs(text);
    const blocks = Object.create(null);
    const entities = [];
    let section = null;
    let current = null;
    let i = 0;
    while (i < pairs.length) {
      const [code, val] = pairs[i];
      if (code === 0 && val === 'SECTION') {
        i++;
        if (i < pairs.length && pairs[i][0] === 2) section = pairs[i][1];
        i++;
        continue;
      }
      if (code === 0 && val === 'ENDSEC') {
        section = null;
        current = null;
        i++;
        continue;
      }
      if (section === 'BLOCKS') {
        if (code === 0 && val === 'BLOCK') {
          let j = i + 1;
          let name = '';
          while (j < pairs.length && pairs[j][0] !== 0) {
            if (pairs[j][0] === 2 && !name) name = pairs[j][1];
            j++;
          }
          blocks[name] = [];
          current = blocks[name];
          i++;
          continue;
        }
        if (code === 0 && val === 'ENDBLK') {
          current = null;
          i++;
          continue;
        }
      }
      if (section === 'ENTITIES') current = entities;
      if (current && code === 0) {
        const etype = val;
        const fields = [];
        let j = i + 1;
        while (j < pairs.length && pairs[j][0] !== 0) {
          fields.push(pairs[j]);
          j++;
        }
        const d = Object.create(null);
        for (const [c, v] of fields) d[c] = v;
        if (etype === 'LINE') {
          current.push({
            type: 'LINE',
            layer: d[8] || '0',
            x1: +d[10] || 0,
            y1: +d[20] || 0,
            x2: +d[11] || 0,
            y2: +d[21] || 0,
          });
        } else if (etype === 'LWPOLYLINE') {
          let layer = '0';
          let closed = false;
          const pts = [];
          let x = null;
          for (const [c, v] of fields) {
            if (c === 8) layer = v;
            else if (c === 70) closed = !!(parseInt(v, 10) & 1);
            else if (c === 10) x = +v;
            else if (c === 20 && x != null) {
              pts.push([x, +v]);
              x = null;
            }
          }
          current.push({ type: 'LWPOLYLINE', layer, closed, pts });
        } else if (etype === 'INSERT') {
          current.push({
            type: 'INSERT',
            layer: d[8] || '0',
            name: d[2] || '',
            x: +d[10] || 0,
            y: +d[20] || 0,
            sx: d[41] != null ? +d[41] : 1,
            sy: d[42] != null ? +d[42] : 1,
            rot: +d[50] || 0,
          });
        } else if (etype === 'ARC') {
          current.push({
            type: 'ARC',
            layer: d[8] || '0',
            cx: +d[10] || 0,
            cy: +d[20] || 0,
            r: +d[40] || 0,
            a0: +d[50] || 0,
            a1: +d[51] || 0,
          });
        }
        i = j;
        continue;
      }
      i++;
    }
    return { blocks, entities };
  }

  function xform(x, y, ins) {
    x *= ins.sx;
    y *= ins.sy;
    const rad = (ins.rot * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return [x * c - y * s + ins.x, x * s + y * c + ins.y];
  }

  function explode(ents, blocks, depth) {
    const out = [];
    for (const e of ents) {
      if (e.type === 'INSERT' && depth < 6) {
        const blk = blocks[e.name] || [];
        for (const ce of explode(blk, blocks, depth + 1)) {
          if (ce.type === 'LINE') {
            const [x1, y1] = xform(ce.x1, ce.y1, e);
            const [x2, y2] = xform(ce.x2, ce.y2, e);
            out.push({ type: 'LINE', layer: ce.layer || e.layer, x1, y1, x2, y2 });
          } else if (ce.type === 'LWPOLYLINE') {
            out.push({
              type: 'LWPOLYLINE',
              layer: ce.layer || e.layer,
              closed: ce.closed,
              pts: ce.pts.map(([px, py]) => xform(px, py, e)),
            });
          } else if (ce.type === 'ARC') {
            const [cx, cy] = xform(ce.cx, ce.cy, e);
            out.push({
              ...ce,
              cx,
              cy,
              r: ce.r * Math.abs(e.sx),
              layer: ce.layer || e.layer,
            });
          }
        }
      } else if (e.type === 'LINE' || e.type === 'LWPOLYLINE' || e.type === 'ARC') {
        out.push(e);
      }
    }
    return out;
  }

  function blockBBox(ents) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    let n = 0;
    const add = (x, y) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      n++;
    };
    for (const e of ents) {
      if (e.type === 'LINE') {
        add(e.x1, e.y1);
        add(e.x2, e.y2);
      } else if (e.type === 'LWPOLYLINE') {
        for (const p of e.pts) add(p[0], p[1]);
      }
    }
    return n ? [minX, minY, maxX, maxY] : null;
  }

  function frameWorld(ins, local) {
    const corners = [
      [local[0], local[1]],
      [local[2], local[1]],
      [local[2], local[3]],
      [local[0], local[3]],
    ];
    const pts = corners.map(([x, y]) => xform(x, y, ins));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  function toSegs(geom) {
    const segs = [];
    const add = (x1, y1, x2, y2, layer) => {
      if (Math.abs(x2 - x1) < 1 && Math.abs(y2 - y1) < 1) return;
      const ax = Math.abs(x2 - x1);
      const ay = Math.abs(y2 - y1);
      if (ax < ay * 0.02) {
        const x = (x1 + x2) / 2;
        segs.push({ x1: x, y1: Math.min(y1, y2), x2: x, y2: Math.max(y1, y2), layer, o: 'v' });
      } else if (ay < ax * 0.02) {
        const y = (y1 + y2) / 2;
        segs.push({
          x1: Math.min(x1, x2),
          y1: y,
          x2: Math.max(x1, x2),
          y2: y,
          layer,
          o: 'h',
        });
      }
    };
    for (const e of geom) {
      if (e.type === 'LINE') add(e.x1, e.y1, e.x2, e.y2, e.layer);
      else if (e.type === 'LWPOLYLINE') {
        const pts = e.pts;
        const n = pts.length;
        for (let i = 0; i < (e.closed ? n : n - 1); i++) {
          const a = pts[i];
          const b = pts[(i + 1) % n];
          add(a[0], a[1], b[0], b[1], e.layer);
        }
      }
    }
    return segs;
  }

  function inside(seg, bb) {
    const mx = (seg.x1 + seg.x2) / 2;
    const my = (seg.y1 + seg.y2) / 2;
    return mx >= bb[0] && mx <= bb[2] && my >= bb[1] && my <= bb[3];
  }

    /** Merge colinear CAD segments into long runs before wall pairing. */
  function mergeSegs(segs, gap, bin) {
    gap = gap || 120;
    bin = bin || 10;
    const buckets = Object.create(null);
    for (const s of segs) {
      const len = s.o === 'h' ? s.x2 - s.x1 : s.y2 - s.y1;
      if (len < MIN_SEG * 0.45) continue;
      const key =
        s.o === 'h'
          ? 'h:' + Math.round(s.y1 / bin) * bin
          : 'v:' + Math.round(s.x1 / bin) * bin;
      (buckets[key] || (buckets[key] = [])).push(s);
    }
    const out = [];
    for (const key of Object.keys(buckets)) {
      const orient = key[0];
      const list = buckets[key];
      if (orient === 'h') {
        list.sort((a, b) => a.x1 - b.x1);
        let x0 = list[0].x1,
          x1 = list[0].x2,
          y = list[0].y1,
          layer = list[0].layer,
          n = 1;
        for (let i = 1; i < list.length; i++) {
          const s = list[i];
          if (s.x1 <= x1 + gap) {
            x1 = Math.max(x1, s.x2);
            y = (y * n + s.y1) / (n + 1);
            n++;
          } else {
            if (x1 - x0 >= MIN_SEG) out.push({ x1: x0, y1: y, x2: x1, y2: y, layer, o: 'h' });
            x0 = s.x1;
            x1 = s.x2;
            y = s.y1;
            layer = s.layer;
            n = 1;
          }
        }
        if (x1 - x0 >= MIN_SEG) out.push({ x1: x0, y1: y, x2: x1, y2: y, layer, o: 'h' });
      } else {
        list.sort((a, b) => a.y1 - b.y1);
        let y0 = list[0].y1,
          y1 = list[0].y2,
          x = list[0].x1,
          layer = list[0].layer,
          n = 1;
        for (let i = 1; i < list.length; i++) {
          const s = list[i];
          if (s.y1 <= y1 + gap) {
            y1 = Math.max(y1, s.y2);
            x = (x * n + s.x1) / (n + 1);
            n++;
          } else {
            if (y1 - y0 >= MIN_SEG) out.push({ x1: x, y1: y0, x2: x, y2: y1, layer, o: 'v' });
            y0 = s.y1;
            y1 = s.y2;
            x = s.x1;
            layer = s.layer;
            n = 1;
          }
        }
        if (y1 - y0 >= MIN_SEG) out.push({ x1: x, y1: y0, x2: x, y2: y1, layer, o: 'v' });
      }
    }
    return out;
  }

  function thickScore(thick) {
    let best = Infinity;
    for (const t of THICKS) best = Math.min(best, Math.abs(thick - t));
    return best;
  }

  function pairWalls(segs) {
    const merged = mergeSegs(segs, 120, 10);
    const H = merged.filter((s) => s.o === 'h');
    const V = merged.filter((s) => s.o === 'v');
    const pair = (group, orient) => {
      const order = group
        .map((s, i) => ({ i, len: orient === 'h' ? s.x2 - s.x1 : s.y2 - s.y1 }))
        .sort((a, b) => b.len - a.len);
      const used = new Set();
      const out = [];
      for (const { i } of order) {
        if (used.has(i)) continue;
        const a = group[i];
        let best = null;
        for (let j = 0; j < group.length; j++) {
          if (j === i || used.has(j)) continue;
          const b = group[j];
          if (orient === 'h') {
            const thick = Math.abs(a.y1 - b.y1);
            const ts = thickScore(thick);
            if (ts > THOL) continue;
            const x0 = Math.max(a.x1, b.x1);
            const x1 = Math.min(a.x2, b.x2);
            const olap = x1 - x0;
            if (olap < OLAP) continue;
            const shorter = Math.min(a.x2 - a.x1, b.x2 - b.x1);
            const score = olap - ts * 5 + (olap / Math.max(shorter, 1)) * 250;
            if (!best || score > best.score)
              best = { score, j, w: [x0, Math.min(a.y1, b.y1), x1, Math.max(a.y1, b.y1), 'n'] };
          } else {
            const thick = Math.abs(a.x1 - b.x1);
            const ts = thickScore(thick);
            if (ts > THOL) continue;
            const y0 = Math.max(a.y1, b.y1);
            const y1 = Math.min(a.y2, b.y2);
            const olap = y1 - y0;
            if (olap < OLAP) continue;
            const shorter = Math.min(a.y2 - a.y1, b.y2 - b.y1);
            const score = olap - ts * 5 + (olap / Math.max(shorter, 1)) * 250;
            if (!best || score > best.score)
              best = { score, j, w: [Math.min(a.x1, b.x1), y0, Math.max(a.x1, b.x1), y1, 'n'] };
          }
        }
        if (best) {
          used.add(i);
          used.add(best.j);
          out.push(best.w);
        }
      }
      return out;
    };
    return pair(H, 'h').concat(pair(V, 'v'));
  }

  function mergeColinear(walls, gap, axisTol) {
    gap = gap || 250;
    axisTol = axisTol || 35;
    let cur = walls.map((w) => w.slice());
    let changed = true;
    while (changed) {
      changed = false;
      const out = [];
      const used = new Set();
      for (let i = 0; i < cur.length; i++) {
        if (used.has(i)) continue;
        const m = cur[i].slice();
        const aHoriz = m[2] - m[0] >= m[3] - m[1];
        for (let j = i + 1; j < cur.length; j++) {
          if (used.has(j)) continue;
          const b = cur[j];
          const bHoriz = b[2] - b[0] >= b[3] - b[1];
          if (aHoriz !== bHoriz) continue;
          if (aHoriz) {
            if (Math.abs(m[1] - b[1]) > axisTol || Math.abs(m[3] - b[3]) > axisTol) continue;
            if (Math.abs(m[3] - m[1] - (b[3] - b[1])) > axisTol) continue;
            if (b[0] > m[2] + gap || b[2] < m[0] - gap) continue;
            m[0] = Math.min(m[0], b[0]);
            m[2] = Math.max(m[2], b[2]);
            m[1] = (m[1] + b[1]) / 2;
            m[3] = m[1] + Math.max(m[3] - m[1], b[3] - b[1]);
            // keep thickness from first after averaging top
            const th = Math.max(cur[i][3] - cur[i][1], b[3] - b[1]);
            m[1] = Math.min(cur[i][1], b[1]);
            m[3] = m[1] + th;
            used.add(j);
            changed = true;
          } else {
            if (Math.abs(m[0] - b[0]) > axisTol || Math.abs(m[2] - b[2]) > axisTol) continue;
            if (Math.abs(m[2] - m[0] - (b[2] - b[0])) > axisTol) continue;
            if (b[1] > m[3] + gap || b[3] < m[1] - gap) continue;
            const th = Math.max(cur[i][2] - cur[i][0], b[2] - b[0]);
            m[1] = Math.min(m[1], b[1]);
            m[3] = Math.max(m[3], b[3]);
            m[0] = Math.min(cur[i][0], b[0]);
            m[2] = m[0] + th;
            used.add(j);
            changed = true;
          }
        }
        used.add(i);
        out.push(m);
      }
      cur = out;
    }
    return cur;
  }

  function cleanWalls(walls) {
    let list = walls
      .map((w) => {
        const x0 = Math.min(w[0], w[2]),
          x1 = Math.max(w[0], w[2]),
          y0 = Math.min(w[1], w[3]),
          y1 = Math.max(w[1], w[3]);
        return [x0, y0, x1, y1, w[4] || 'n'];
      })
      .filter((w) => {
        const L = Math.max(w[2] - w[0], w[3] - w[1]);
        const T = Math.min(w[2] - w[0], w[3] - w[1]);
        return L >= MIN_WALL && L >= T * 2 && T >= 100 && T <= 420;
      });
    list.sort((a, b) => b[2] - b[0] + (b[3] - b[1]) - (a[2] - a[0] + (a[3] - a[1])));
    const kept = [];
    for (const w of list) {
      const area = (w[2] - w[0]) * (w[3] - w[1]);
      const dup = kept.some((k) => {
        const ox = Math.max(0, Math.min(w[2], k[2]) - Math.max(w[0], k[0]));
        const oy = Math.max(0, Math.min(w[3], k[3]) - Math.max(w[1], k[1]));
        return area > 0 && (ox * oy) / area > 0.65;
      });
      if (!dup) kept.push(w);
    }
    return kept;
  }

  function buildUnderlay(segs, crop, ox, oy) {
    const lines = [];
    for (const s of segs) {
      if (!inside(s, crop)) continue;
      if (SKIP_LAYER_RE.test(s.layer) || WIN_LAYER_RE.test(s.layer)) continue;
      if (!(WALL_LAYER_RE.test(s.layer) || s.layer === '0' || s.layer === '图层1')) continue;
      const len = s.o === 'h' ? s.x2 - s.x1 : s.y2 - s.y1;
      if (len < 250) continue;
      lines.push([
        Math.round(s.x1 - ox),
        Math.round(s.y1 - oy),
        Math.round(s.x2 - ox),
        Math.round(s.y2 - oy),
      ]);
    }
    if (lines.length > 2000) {
      lines.sort(
        (a, b) =>
          Math.hypot(b[2] - b[0], b[3] - b[1]) - Math.hypot(a[2] - a[0], a[3] - a[1])
      );
      return lines.slice(0, 2000);
    }
    return lines;
  }

  function extractWallsFromSegs(segs, crop) {
    let use = segs.filter(
      (s) => WALL_LAYER_RE.test(s.layer) && !SKIP_LAYER_RE.test(s.layer) && inside(s, crop)
    );
    if (use.length < 40) {
      use = segs.filter((s) => !SKIP_LAYER_RE.test(s.layer) && !WIN_LAYER_RE.test(s.layer) && inside(s, crop));
    }
    let walls = pairWalls(use);
    const maxSpan = Math.max(crop[2] - crop[0], crop[3] - crop[1]) * 0.85;
    walls = walls.filter((w) => Math.max(w[2] - w[0], w[3] - w[1]) < maxSpan);
    walls = cleanWalls(mergeColinear(walls, 280, 40));
    return walls;
  }

  function detectWindows(segs, crop) {
    const winSegs = segs.filter((s) => WIN_LAYER_RE.test(s.layer) && inside(s, crop));
    const merged = mergeSegs(winSegs, 60, 8);
    // Windows: parallel lines ~50–120 apart, or thin wall-like pairs
    const H = merged.filter((s) => s.o === 'h');
    const V = merged.filter((s) => s.o === 'v');
    const wins = [];
    const pairThin = (group, orient) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i],
            b = group[j];
          if (orient === 'h') {
            const thick = Math.abs(a.y1 - b.y1);
            if (thick < 40 || thick > 140) continue;
            const x0 = Math.max(a.x1, b.x1),
              x1 = Math.min(a.x2, b.x2);
            if (x1 - x0 < 400) continue;
            wins.push([x0, Math.min(a.y1, b.y1), x1, Math.max(a.y1, b.y1)]);
          } else {
            const thick = Math.abs(a.x1 - b.x1);
            if (thick < 40 || thick > 140) continue;
            const y0 = Math.max(a.y1, b.y1),
              y1 = Math.min(a.y2, b.y2);
            if (y1 - y0 < 400) continue;
            wins.push([Math.min(a.x1, b.x1), y0, Math.max(a.x1, b.x1), y1]);
          }
        }
      }
    };
    pairThin(H, 'h');
    pairThin(V, 'v');
    return wins.map((w) => w.map(Math.round));
  }

  function detectDoors(walls, arcs, crop) {
    const doors = [];
    const inCrop = arcs
      .filter((a) => a.cx >= crop[0] && a.cx <= crop[2] && a.cy >= crop[1] && a.cy <= crop[3])
      .filter((a) => a.r >= 600 && a.r <= 1050)
      .sort((a, b) => b.r - a.r);
    for (const a of inCrop) {
      if (doors.length >= 10) break;
      let best = null;
      for (const w of walls) {
        const horiz = w[2] - w[0] >= w[3] - w[1];
        if (horiz) {
          const midY = (w[1] + w[3]) / 2;
          if (Math.abs(a.cy - midY) > 380) continue;
          if (a.cx < w[0] - 80 || a.cx > w[2] + 80) continue;
          const dist = Math.abs(a.cy - midY);
          if (!best || dist < best.dist) best = { w, horiz, dist };
        } else {
          const midX = (w[0] + w[2]) / 2;
          if (Math.abs(a.cx - midX) > 380) continue;
          if (a.cy < w[1] - 80 || a.cy > w[3] + 80) continue;
          const dist = Math.abs(a.cx - midX);
          if (!best || dist < best.dist) best = { w, horiz, dist };
        }
      }
      if (!best || best.dist > 320) continue;
      // skip if too close to an existing door
      if (doors.some((d) => Math.hypot(d.h[0] - a.cx, d.h[1] - a.cy) < 500)) continue;
      const L = Math.round(a.r);
      let rect, h, c, o;
      if (best.horiz) {
        const y0 = best.w[1],
          y1 = best.w[3];
        const openDown = a.cy > (y0 + y1) / 2;
        rect = [Math.round(a.cx - L / 2), Math.round(y0), Math.round(a.cx + L / 2), Math.round(y1)];
        h = openDown ? [a.cx - L / 2, y1] : [a.cx - L / 2, y0];
        c = openDown ? [0, -1] : [0, 1];
        o = [1, 0];
      } else {
        const x0 = best.w[0],
          x1 = best.w[2];
        const openRight = a.cx > (x0 + x1) / 2;
        rect = [Math.round(x0), Math.round(a.cy - L / 2), Math.round(x1), Math.round(a.cy + L / 2)];
        h = openRight ? [x0, a.cy - L / 2] : [x1, a.cy - L / 2];
        c = openRight ? [-1, 0] : [1, 0];
        o = [0, 1];
      }
      doors.push({
        name: '门' + (doors.length + 1),
        rect,
        h: [Math.round(h[0]), Math.round(h[1])],
        c,
        o,
        len: L,
      });
    }
    return doors;
  }

  function cutDoorOpenings(walls, doors) {
    let out = walls.map((w) => w.slice());
    for (const d of doors) {
      const [dx0, dy0, dx1, dy1] = d.rect;
      const next = [];
      for (const w of out) {
        const [x0, y0, x1, y1, k] = w;
        const horiz = x1 - x0 >= y1 - y0;
        if (horiz) {
          if (Math.abs((y0 + y1) / 2 - (dy0 + dy1) / 2) > (y1 - y0) / 2 + 25) {
            next.push(w);
            continue;
          }
          if (dx1 <= x0 + 10 || dx0 >= x1 - 10) {
            next.push(w);
            continue;
          }
          if (dx0 > x0 + 80) next.push([x0, y0, dx0, y1, k]);
          if (dx1 < x1 - 80) next.push([dx1, y0, x1, y1, k]);
        } else {
          if (Math.abs((x0 + x1) / 2 - (dx0 + dx1) / 2) > (x1 - x0) / 2 + 25) {
            next.push(w);
            continue;
          }
          if (dy1 <= y0 + 10 || dy0 >= y1 - 10) {
            next.push(w);
            continue;
          }
          if (dy0 > y0 + 80) next.push([x0, y0, x1, dy0, k]);
          if (dy1 < y1 - 80) next.push([x0, dy1, x1, y1, k]);
        }
      }
      out = next;
    }
    return out.filter((w) => Math.max(w[2] - w[0], w[3] - w[1]) >= MIN_WALL);
  }

  function detectRooms(walls, crop) {
    const fallback = () => [
      {
        id: 'room1',
        name: '全屋',
        poly: [
          [crop[0], crop[1]],
          [crop[2], crop[1]],
          [crop[2], crop[3]],
          [crop[0], crop[3]],
        ],
        mat: null,
        at: [(crop[0] + crop[2]) / 2, (crop[1] + crop[3]) / 2],
      },
    ];
    if (!walls.length) return fallback();

    // Orthogonal partition: split by wall centerlines into rectangular cells
    const xs = new Set(),
      ys = new Set();
    for (const w of walls) {
      const horiz = w[2] - w[0] >= w[3] - w[1];
      if (horiz) {
        ys.add(Math.round((w[1] + w[3]) / 2));
        xs.add(Math.round(w[0]));
        xs.add(Math.round(w[2]));
      } else {
        xs.add(Math.round((w[0] + w[2]) / 2));
        ys.add(Math.round(w[1]));
        ys.add(Math.round(w[3]));
      }
    }
    xs.add(Math.round(crop[0]));
    xs.add(Math.round(crop[2]));
    ys.add(Math.round(crop[1]));
    ys.add(Math.round(crop[3]));
    const X = [...xs].sort((a, b) => a - b);
    const Y = [...ys].sort((a, b) => a - b);
    // Merge near-duplicate cut lines
    const uniq = (arr, tol) => {
      const out = [];
      for (const v of arr) {
        if (!out.length || v - out[out.length - 1] > tol) out.push(v);
        else out[out.length - 1] = Math.round((out[out.length - 1] + v) / 2);
      }
      return out;
    };
    const UX = uniq(X, 200);
    const UY = uniq(Y, 200);
    if (UX.length < 2 || UY.length < 2) return fallback();

    const hitWall = (x0, y0, x1, y1) => {
      const cx = (x0 + x1) / 2,
        cy = (y0 + y1) / 2;
      for (const w of walls) {
        if (cx >= w[0] - 20 && cx <= w[2] + 20 && cy >= w[1] - 20 && cy <= w[3] + 20) return true;
      }
      return false;
    };

    const cols = UX.length - 1,
      rows = UY.length - 1;
    // cell open? (not buried in wall mass)
    const open = Array.from({ length: cols * rows }, () => false);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x0 = UX[i],
          x1 = UX[i + 1],
          y0 = UY[j],
          y1 = UY[j + 1];
        if (x1 - x0 < 500 || y1 - y0 < 500) continue;
        if (hitWall(x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.3, x1, y1)) continue;
        open[j * cols + i] = true;
      }
    }
    const wallBlocks = (x0, y0, x1, y1, horiz) =>
      walls.some((w) => {
        const wh = w[2] - w[0] >= w[3] - w[1];
        if (wh !== horiz) return false;
        if (horiz) {
          const wy = (w[1] + w[3]) / 2;
          if (Math.abs(wy - (y0 + y1) / 2) > 100) return false;
          return Math.min(w[2], x1) - Math.max(w[0], x0) > Math.min(x1 - x0, w[2] - w[0]) * 0.4;
        }
        const wx = (w[0] + w[2]) / 2;
        if (Math.abs(wx - (x0 + x1) / 2) > 100) return false;
        return Math.min(w[3], y1) - Math.max(w[1], y0) > Math.min(y1 - y0, w[3] - w[1]) * 0.4;
      });

    const seen = new Uint8Array(cols * rows);
    const rooms = [];
    let rid = 1;
    for (let start = 0; start < open.length; start++) {
      if (!open[start] || seen[start]) continue;
      const q = [start];
      seen[start] = 1;
      let minI = start % cols,
        maxI = minI,
        minJ = (start / cols) | 0,
        maxJ = minJ;
      for (let qi = 0; qi < q.length; qi++) {
        const id = q[qi];
        const i = id % cols,
          j = (id / cols) | 0;
        minI = Math.min(minI, i);
        maxI = Math.max(maxI, i);
        minJ = Math.min(minJ, j);
        maxJ = Math.max(maxJ, j);
        const tryGo = (ni, nj) => {
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) return;
          const nid = nj * cols + ni;
          if (!open[nid] || seen[nid]) return;
          // blocked by wall on shared edge?
          if (ni !== i) {
            const x = ni > i ? UX[i + 1] : UX[i];
            if (wallBlocks(x - 40, UY[j], x + 40, UY[j + 1], false)) return;
          } else {
            const y = nj > j ? UY[j + 1] : UY[j];
            if (wallBlocks(UX[i], y - 40, UX[i + 1], y + 40, true)) return;
          }
          seen[nid] = 1;
          q.push(nid);
        };
        tryGo(i + 1, j);
        tryGo(i - 1, j);
        tryGo(i, j + 1);
        tryGo(i, j - 1);
      }
      const x0 = UX[minI],
        x1 = UX[maxI + 1],
        y0 = UY[minJ],
        y1 = UY[maxJ + 1];
      const area = ((x1 - x0) * (y1 - y0)) / 1e6;
      if (area < 4 || area > 160) continue;
      rooms.push({
        id: 'room' + rid,
        name: '房间' + rid,
        poly: [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ],
        mat: null,
        at: [(x0 + x1) / 2, (y0 + y1) / 2],
      });
      rid++;
    }

    if (!rooms.length) return fallback();
    if (rooms.length === 1) rooms[0].name = '全屋';
    return rooms;
  }

  function classifyExterior(walls, crop) {
    const margin = 700;
    return walls.map((w) => {
      const [x0, y0, x1, y1] = w;
      const near =
        x0 < crop[0] + margin ||
        y0 < crop[1] + margin ||
        x1 > crop[2] - margin ||
        y1 > crop[3] - margin;
      const thick = Math.min(x1 - x0, y1 - y0);
      const k = near ? 'e' : thick >= 200 ? 'b' : 'n';
      return [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), k];
    });
  }

  function normalizePlan(walls, wins, doors, rooms, underlay) {
    if (!walls.length) return null;
    const xs = [];
    const ys = [];
    for (const w of walls) {
      xs.push(w[0], w[2]);
      ys.push(w[1], w[3]);
    }
    for (const r of rooms) for (const p of r.poly) {
      xs.push(p[0]);
      ys.push(p[1]);
    }
    const ox = Math.min(...xs);
    const oy = Math.min(...ys);
    const shift = (x, y) => [x - ox, y - oy];
    const nWalls = walls.map((w) => [w[0] - ox, w[1] - oy, w[2] - ox, w[3] - oy, w[4]]);
    const nWins = wins.map((w) => [w[0] - ox, w[1] - oy, w[2] - ox, w[3] - oy]);
    const nDoors = doors.map((d) => ({
      ...d,
      rect: [d.rect[0] - ox, d.rect[1] - oy, d.rect[2] - ox, d.rect[3] - oy],
      h: [d.h[0] - ox, d.h[1] - oy],
    }));
    const nRooms = rooms.map((r) => ({
      ...r,
      poly: r.poly.map((p) => shift(p[0], p[1])),
      at: r.at ? shift(r.at[0], r.at[1]) : null,
    }));
    const maxX = Math.max(
      ...nWalls.map((w) => w[2]),
      ...nRooms.flatMap((r) => r.poly.map((p) => p[0]))
    );
    const maxY = Math.max(
      ...nWalls.map((w) => w[3]),
      ...nRooms.flatMap((r) => r.poly.map((p) => p[1]))
    );
    return {
      walls: nWalls,
      wins: nWins,
      doors: nDoors,
      slides: [],
      rooms: nRooms,
      underlay: underlay || [],
      bounds: { x: -800, y: -800, w: maxX + 1600, h: maxY + 1600 },
      origin: [ox, oy],
      hasDefaultDims: false,
      hasBayLintels: false,
      hasEntryMark: false,
    };
  }

  function sheetPreviewSvg(walls, size) {
    size = size || 180;
    if (!walls.length) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#f0ebe3"/><text x="50%" y="50%" text-anchor="middle" fill="#999" font-size="12">empty</text></svg>`;
    }
    const xs = walls.flatMap((w) => [w[0], w[2]]);
    const ys = walls.flatMap((w) => [w[1], w[3]]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const wdt = Math.max(...xs) - minX || 1;
    const hgt = Math.max(...ys) - minY || 1;
    const pad = 0.06;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wdt * (1 + 2 * pad)} ${hgt * (1 + 2 * pad)}" width="${size}" height="${size}">`,
      `<rect width="100%" height="100%" fill="#f7f4ee"/>`,
    ];
    for (const w of walls) {
      parts.push(
        `<rect x="${w[0] - minX + wdt * pad}" y="${w[1] - minY + hgt * pad}" width="${Math.max(w[2] - w[0], 1)}" height="${Math.max(w[3] - w[1], 1)}" fill="#3d3a34"/>`
      );
    }
    parts.push('</svg>');
    return parts.join('');
  }

  function analyze(buffer) {
    const text = typeof buffer === 'string' ? buffer : decodeText(buffer);
    const { blocks, entities } = parseDxf(text);
    const geom = explode(entities, blocks, 0);
    const segs = toSegs(geom);
    const arcs = geom.filter((e) => e.type === 'ARC');
    const layers = {};
    for (const s of segs) layers[s.layer] = (layers[s.layer] || 0) + 1;

    const frameBlk = blocks['图框'] || blocks['TITLE'] || null;
    const local = frameBlk ? blockBBox(frameBlk) : null;
    const frameInserts = entities.filter(
      (e) => e.type === 'INSERT' && (e.name === '图框' || /title|frame|图框/i.test(e.name))
    );

    const sheets = [];
    if (local && frameInserts.length) {
      frameInserts.forEach((ins, idx) => {
        const bb = frameWorld(ins, local);
        const inset = 2000;
        const crop = [bb[0] + inset, bb[1] + inset, bb[2] - inset, bb[3] - inset];
        if (crop[2] <= crop[0] || crop[3] <= crop[1]) return;
        const walls = extractWallsFromSegs(segs, crop);
        if (walls.length < 4) return;
        const xs = walls.flatMap((w) => [w[0], w[2]]);
        const ys = walls.flatMap((w) => [w[1], w[3]]);
        const wdt = Math.max(...xs) - Math.min(...xs);
        const hgt = Math.max(...ys) - Math.min(...ys);
        const apt = wdt >= 9000 && wdt <= 26000 && hgt >= 7500 && hgt <= 18000;
        const idealW = 16000,
          idealH = 11000;
        const sizeFit =
          1 /
          (1 +
            Math.abs(wdt - idealW) / 7000 +
            Math.abs(hgt - idealH) / 5000 +
            Math.max(0, walls.length - 80) / 60);
        // Prefer fewer, longer walls (cleaner plans score higher)
        const avgLen =
          walls.reduce((a, w) => a + Math.max(w[2] - w[0], w[3] - w[1]), 0) / walls.length;
        // Prefer mid wall counts (complete unit, not over-fragmented)
        const countFit =
          walls.length >= 16 && walls.length <= 45 ? 60 : walls.length >= 10 && walls.length <= 60 ? 25 : 0;
        const score =
          (apt ? 220 : 0) + sizeFit * 200 + Math.min(avgLen / 40, 70) + countFit + walls.length * 0.15;
        sheets.push({
          index: idx,
          crop,
          frame: bb,
          walls,
          wallCount: walls.length,
          size: [wdt, hgt],
          apt,
          score,
          preview: sheetPreviewSvg(walls),
        });
      });
      sheets.sort((a, b) => b.score - a.score);
    }

    if (!sheets.length) {
      const xs0 = segs.map((s) => s.x1),
        ys0 = segs.map((s) => s.y1);
      if (xs0.length) {
        const crop = [
          Math.min(...xs0),
          Math.min(...ys0),
          Math.max(...segs.map((s) => s.x2)),
          Math.max(...segs.map((s) => s.y2)),
        ];
        const walls = extractWallsFromSegs(segs, crop);
        if (walls.length) {
          const xs = walls.flatMap((w) => [w[0], w[2]]);
          const ys = walls.flatMap((w) => [w[1], w[3]]);
          const tight = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
          sheets.push({
            index: 0,
            crop: tight,
            frame: tight,
            walls,
            wallCount: walls.length,
            size: [tight[2] - tight[0], tight[3] - tight[1]],
            apt: true,
            score: walls.length,
            preview: sheetPreviewSvg(walls),
          });
        }
      }
    }

    return { segs, arcs, layers, sheets, geomCount: geom.length };
  }

  function snapThick(t) {
    return Math.abs(t - 120) <= Math.abs(t - 240) ? 120 : 240;
  }

  /** Unify thickness, snap joints, drop floating stubs — for cleaner 2D/3D. */
  function polishWallNetwork(walls) {
    const GRID = 50;
    const JOIN = 180;
    let strokes = walls.map((w) => {
      const x0 = Math.min(w[0], w[2]),
        x1 = Math.max(w[0], w[2]),
        y0 = Math.min(w[1], w[3]),
        y1 = Math.max(w[1], w[3]);
      const thick = snapThick(Math.min(x1 - x0, y1 - y0));
      const horiz = x1 - x0 >= y1 - y0;
      if (horiz) {
        const y = Math.round((y0 + y1) / 2 / GRID) * GRID;
        return {
          x1: x0,
          y1: y,
          x2: x1,
          y2: y,
          thick,
          k: w[4] || 'n',
          o: 'h',
        };
      }
      const x = Math.round((x0 + x1) / 2 / GRID) * GRID;
      return { x1: x, y1: y0, x2: x, y2: y1, thick, k: w[4] || 'n', o: 'v' };
    });

    // Snap endpoints that are close into shared junctions
    const pts = [];
    strokes.forEach((s, i) => {
      pts.push({ i, end: 0, x: s.x1, y: s.y1 });
      pts.push({ i, end: 1, x: s.x2, y: s.y2 });
    });
    const used = new Set();
    for (let a = 0; a < pts.length; a++) {
      if (used.has(a)) continue;
      const cluster = [a];
      used.add(a);
      for (let b = a + 1; b < pts.length; b++) {
        if (used.has(b)) continue;
        if (Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y) <= JOIN) {
          cluster.push(b);
          used.add(b);
        }
      }
      if (cluster.length < 2) continue;
      const cx = Math.round(cluster.reduce((s, j) => s + pts[j].x, 0) / cluster.length / GRID) * GRID;
      const cy = Math.round(cluster.reduce((s, j) => s + pts[j].y, 0) / cluster.length / GRID) * GRID;
      for (const j of cluster) {
        const p = pts[j];
        const s = strokes[p.i];
        if (p.end === 0) {
          s.x1 = cx;
          s.y1 = cy;
        } else {
          s.x2 = cx;
          s.y2 = cy;
        }
      }
    }

    // T-junction: project free endpoint onto nearby crossing wall
    for (const s of strokes) {
      for (const end of [0, 1]) {
        let x = end ? s.x2 : s.x1;
        let y = end ? s.y2 : s.y1;
        let best = null;
        for (const o of strokes) {
          if (o === s) continue;
          if (o.o === s.o) continue;
          if (o.o === 'h') {
            if (Math.abs(y - o.y1) > JOIN) continue;
            if (x < o.x1 - JOIN || x > o.x2 + JOIN) continue;
            const px = Math.max(o.x1, Math.min(o.x2, x));
            const d = Math.hypot(x - px, y - o.y1);
            if (d <= JOIN && (!best || d < best.d)) best = { d, x: px, y: o.y1 };
          } else {
            if (Math.abs(x - o.x1) > JOIN) continue;
            if (y < o.y1 - JOIN || y > o.y2 + JOIN) continue;
            const py = Math.max(o.y1, Math.min(o.y2, y));
            const d = Math.hypot(x - o.x1, y - py);
            if (d <= JOIN && (!best || d < best.d)) best = { d, x: o.x1, y: py };
          }
        }
        if (best) {
          if (end) {
            s.x2 = best.x;
            s.y2 = best.y;
          } else {
            s.x1 = best.x;
            s.y1 = best.y;
          }
        }
      }
    }

    // Re-normalize axis-aligned after snaps
    strokes = strokes.map((s) => {
      if (s.o === 'h') {
        const y = Math.round(((s.y1 + s.y2) / 2) / GRID) * GRID;
        return {
          x1: Math.min(s.x1, s.x2),
          y1: y,
          x2: Math.max(s.x1, s.x2),
          y2: y,
          thick: s.thick,
          k: s.k,
          o: 'h',
        };
      }
      const x = Math.round(((s.x1 + s.x2) / 2) / GRID) * GRID;
      return {
        x1: x,
        y1: Math.min(s.y1, s.y2),
        x2: x,
        y2: Math.max(s.y1, s.y2),
        thick: s.thick,
        k: s.k,
        o: 'v',
      };
    }).filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 400);

    // Drop short stubs that don't meet any other wall
    strokes = strokes.filter((s) => {
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      if (len >= 1200) return true;
      const ends = [
        [s.x1, s.y1],
        [s.x2, s.y2],
      ];
      let hits = 0;
      for (const [x, y] of ends) {
        for (const o of strokes) {
          if (o === s) continue;
          const d1 = Math.hypot(x - o.x1, y - o.y1);
          const d2 = Math.hypot(x - o.x2, y - o.y2);
          if (Math.min(d1, d2) <= JOIN + 20) {
            hits++;
            break;
          }
          if (o.o === 'h' && Math.abs(y - o.y1) <= JOIN && x >= o.x1 - 20 && x <= o.x2 + 20) {
            hits++;
            break;
          }
          if (o.o === 'v' && Math.abs(x - o.x1) <= JOIN && y >= o.y1 - 20 && y <= o.y2 + 20) {
            hits++;
            break;
          }
        }
      }
      return hits >= 1;
    });

    strokes = mergeColinear(
      strokes.map((s) => {
        if (s.o === 'h') return [s.x1, s.y1 - s.thick / 2, s.x2, s.y1 + s.thick / 2, s.k];
        return [s.x1 - s.thick / 2, s.y1, s.x2 + s.thick / 2, s.y2, s.k];
      }),
      200,
      40
    );

    return cleanWalls(
      strokes.map((w) => {
        const thick = snapThick(Math.min(w[2] - w[0], w[3] - w[1]));
        const horiz = w[2] - w[0] >= w[3] - w[1];
        if (horiz) {
          const y = (w[1] + w[3]) / 2;
          return [w[0], y - thick / 2, w[2], y + thick / 2, w[4]];
        }
        const x = (w[0] + w[2]) / 2;
        return [x - thick / 2, w[1], x + thick / 2, w[3], w[4]];
      })
    );
  }

  /** Clean CAD line underlay clipped to wall footprint (for 2D reference). */
  function buildCleanUnderlay(segs, crop, walls, ox, oy) {
    if (!walls.length) return [];
    const xs = walls.flatMap((w) => [w[0], w[2]]);
    const ys = walls.flatMap((w) => [w[1], w[3]]);
    const bb = [
      Math.min(...xs) - 400,
      Math.min(...ys) - 400,
      Math.max(...xs) + 400,
      Math.max(...ys) + 400,
    ];
    const merged = mergeSegs(
      segs.filter((s) => WALL_LAYER_RE.test(s.layer) && inside(s, crop) && inside(s, bb)),
      100,
      10
    );
    return merged
      .filter((s) => {
        const len = s.o === 'h' ? s.x2 - s.x1 : s.y2 - s.y1;
        return len >= 600;
      })
      .map((s) => [
        Math.round(s.x1 - ox),
        Math.round(s.y1 - oy),
        Math.round(s.x2 - ox),
        Math.round(s.y2 - oy),
      ]);
  }

  function extractSheet(analysis, sheetIndex) {
    const sheet =
      analysis.sheets.find((s) => s.index === sheetIndex) ||
      analysis.sheets[sheetIndex] ||
      analysis.sheets[0];
    if (!sheet) throw new Error('No sheet');
    const crop = sheet.crop;
    let walls = classifyExterior(polishWallNetwork(cleanWalls(sheet.walls)), crop);
    const wins = detectWindows(analysis.segs, crop);
    let doors = detectDoors(walls, analysis.arcs || [], crop);
    walls = cutDoorOpenings(walls, doors);
    walls = polishWallNetwork(walls);
    if (!walls.length) throw new Error('No walls after cleanup');
    const xs = walls.flatMap((w) => [w[0], w[2]]);
    const ys = walls.flatMap((w) => [w[1], w[3]]);
    const tight = [
      Math.min(...xs) - 300,
      Math.min(...ys) - 300,
      Math.max(...xs) + 300,
      Math.max(...ys) + 300,
    ];
    const rooms = detectRooms(walls, tight);
    const ox = Math.min(...xs);
    const oy = Math.min(...ys);
    let underlay = buildCleanUnderlay(analysis.segs, crop, walls, ox, oy);
    // Fallback: underlay = polished wall centerlines (always available for CAD线稿)
    if (!underlay.length) {
      underlay = walls.map((w) => {
        const horiz = w[2] - w[0] >= w[3] - w[1];
        if (horiz) {
          const y = Math.round((w[1] + w[3]) / 2 - oy);
          return [Math.round(w[0] - ox), y, Math.round(w[2] - ox), y];
        }
        const x = Math.round((w[0] + w[2]) / 2 - ox);
        return [x, Math.round(w[1] - oy), x, Math.round(w[3] - oy)];
      });
    }
    const plan = normalizePlan(walls, wins, doors, rooms, underlay);
    if (!plan) throw new Error('Empty plan');
    plan.sheetIndex = sheet.index;
    plan.rawWallCount = sheet.wallCount;
    plan.cadMode = true;
    return plan;
  }

  async function fromFile(file) {
    const buf = await file.arrayBuffer();
    return analyze(buf);
  }

  global.DxfImport = { decodeText, analyze, extractSheet, fromFile, parseDxf };
})(typeof window !== 'undefined' ? window : globalThis);
