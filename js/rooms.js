/* ======================= 墙体 → 房间识别 ======================= */
// Standalone room detection (mirrors index.html) for smoke tests
function snapCoords(arr, tol){
  tol = tol || 10;
  const a = [...arr].sort((x,y)=>x-y);
  if (!a.length) return [];
  const out = [a[0]];
  for (let i = 1; i < a.length; i++){
    if (a[i] - out[out.length - 1] > tol) out.push(a[i]);
  }
  return out.map(v => Math.round(v));
}

function orthoPolyFromCells(cells, X, Y){
  const set = new Set(cells.map(([i,j]) => i + ',' + j));
  let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
  for (const [i,j] of cells){
    minI = Math.min(minI, i); maxI = Math.max(maxI, i);
    minJ = Math.min(minJ, j); maxJ = Math.max(maxJ, j);
  }
  let rect = true;
  for (let i = minI; i <= maxI && rect; i++)
    for (let j = minJ; j <= maxJ; j++)
      if (!set.has(i + ',' + j)) rect = false;
  if (rect){
    return [
      [X[minI], Y[minJ]], [X[maxI + 1], Y[minJ]],
      [X[maxI + 1], Y[maxJ + 1]], [X[minI], Y[maxJ + 1]],
    ];
  }
  // Boundary edge walk: collect unit edges that appear once
  const he = new Map(), ve = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  for (const [i, j] of cells){
    bump(he, j + ',' + i);       // bottom y=j, x=i
    bump(he, (j + 1) + ',' + i); // top
    bump(ve, i + ',' + j);       // left x=i, y=j
    bump(ve, (i + 1) + ',' + j); // right
  }
  const adj = new Map();
  const link = (ax, ay, bx, by) => {
    const a = ax + ',' + ay, b = bx + ',' + by;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  };
  for (const [k, c] of he){
    if (c !== 1) continue;
    const [yj, xi] = k.split(',').map(Number);
    link(X[xi], Y[yj], X[xi + 1], Y[yj]);
  }
  for (const [k, c] of ve){
    if (c !== 1) continue;
    const [xi, yj] = k.split(',').map(Number);
    link(X[xi], Y[yj], X[xi], Y[yj + 1]);
  }
  let start = null;
  for (const k of adj.keys()){
    if (!start){ start = k; continue; }
    const [x, y] = k.split(',').map(Number);
    const [sx, sy] = start.split(',').map(Number);
    if (y < sy || (y === sy && x < sx)) start = k;
  }
  if (!start) return null;
  const poly = [];
  const used = new Set();
  let cur = start, prev = null;
  for (let n = 0; n < adj.size * 4; n++){
    const [cx, cy] = cur.split(',').map(Number);
    poly.push([cx, cy]);
    const nbrs = adj.get(cur) || [];
    let next = null;
    // Prefer unused neighbor; at corners prefer left turn relative to incoming
    const candidates = nbrs.filter(nb => {
      const ek = [cur, nb].sort().join('>');
      return !used.has(ek) && nb !== prev;
    });
    if (!candidates.length){
      const any = nbrs.filter(nb => {
        const ek = [cur, nb].sort().join('>');
        return !used.has(ek);
      });
      if (!any.length) break;
      next = any[0];
    } else if (candidates.length === 1 || !prev){
      next = candidates[0];
    } else {
      const [px, py] = prev.split(',').map(Number);
      const idx = dx => (dx[0] === 1 && dx[1] === 0) ? 0 : (dx[0] === 0 && dx[1] === 1) ? 1 : (dx[0] === -1 && dx[1] === 0) ? 2 : 3;
      const inDir = idx([Math.sign(cx - px), Math.sign(cy - py)]);
      // try left, straight, right, u-turn relative to incoming direction
      const order = [(inDir + 3) % 4, inDir, (inDir + 1) % 4, (inDir + 2) % 4];
      const dirs = [[1,0],[0,1],[-1,0],[0,-1]];
      outer: for (const od of order){
        const [dx, dy] = dirs[od];
        for (const nb of candidates){
          const [nx, ny] = nb.split(',').map(Number);
          if (Math.sign(nx - cx) === dx && Math.sign(ny - cy) === dy){ next = nb; break outer; }
        }
      }
      if (!next) next = candidates[0];
    }
    used.add([cur, next].sort().join('>'));
    prev = cur; cur = next;
    if (cur === start) break;
  }
  if (poly.length >= 3 && (poly[0][0] !== poly[poly.length-1][0] || poly[0][1] !== poly[poly.length-1][1])){
    // closed by returning to start implicitly
  }
  return poly.length >= 3 ? poly : null;
}

/** 在网格上把矩形区域标为墙（阻挡） */
function markRectAsWall(isWall, X, Y, rect, pad){
  pad = pad || 0;
  const x0 = rect[0] - pad, y0 = rect[1] - pad, x1 = rect[2] + pad, y1 = rect[3] + pad;
  const cols = X.length - 1, rows = Y.length - 1;
  for (let i = 0; i < cols; i++){
    for (let j = 0; j < rows; j++){
      if (isWall[i][j]) continue;
      const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2;
      if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) isWall[i][j] = true;
    }
  }
}
/** 窗户隔断矩形：沿厚度方向至少扩到墙厚，避免窗洞两侧漏连通 */
function barrierRectForWin(win, hostWall){
  if (hostWall) return [hostWall[0], hostWall[1], hostWall[2], hostWall[3]];
  const [x0, y0, x1, y1] = win;
  const horiz = (x1 - x0) >= (y1 - y0);
  const minT = 220;
  if (horiz){
    const cy = (y0 + y1) / 2, t = Math.max(minT, y1 - y0);
    return [x0, cy - t / 2, x1, cy + t / 2];
  }
  const cx = (x0 + x1) / 2, t = Math.max(minT, x1 - x0);
  return [cx - t / 2, y0, cx + t / 2, y1];
}
/** 共线墙端头细缝补墙，防止识别时从缝里串通 */
function sealWallEndGaps(isWall, X, Y, walls){
  const TOL = 160;
  for (let a = 0; a < walls.length; a++){
    for (let b = a + 1; b < walls.length; b++){
      const A = walls[a], B = walls[b];
      const Ah = wallIsHoriz(A), Bh = wallIsHoriz(B);
      if (Ah !== Bh) continue;
      if (Ah){
        const cyA = (A[1] + A[3]) / 2, cyB = (B[1] + B[3]) / 2;
        if (Math.abs(cyA - cyB) > 60) continue;
        const gap = Math.max(A[0] - B[2], B[0] - A[2]);
        if (gap <= 0 || gap > TOL) continue;
        const y0 = Math.min(A[1], B[1]), y1 = Math.max(A[3], B[3]);
        const x0 = Math.min(A[2], B[2]), x1 = Math.max(A[0], B[0]);
        markRectAsWall(isWall, X, Y, [x0, y0, x1, y1], 4);
      } else {
        const cxA = (A[0] + A[2]) / 2, cxB = (B[0] + B[2]) / 2;
        if (Math.abs(cxA - cxB) > 60) continue;
        const gap = Math.max(A[1] - B[3], B[1] - A[3]);
        if (gap <= 0 || gap > TOL) continue;
        const x0 = Math.min(A[0], B[0]), x1 = Math.max(A[2], B[2]);
        const y0 = Math.min(A[3], B[3]), y1 = Math.max(A[1], B[1]);
        markRectAsWall(isWall, X, Y, [x0, y0, x1, y1], 4);
      }
    }
  }
}

/** 门洞两侧探测点 → 命中的房间（不含窗外连通） */
function roomsTouchingOpening(rect, rooms){
  const [x0, y0, x1, y1] = rect;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const horiz = (x1 - x0) >= (y1 - y0);
  const probes = horiz
    ? [[cx, y0 - 80], [cx, y1 + 80]]
    : [[x0 - 80, cy], [x1 + 80, cy]];
  const hit = [];
  for (const [px, py] of probes){
    for (const r of rooms){
      if (r.poly && pointInPoly(px, py, r.poly) && !hit.includes(r)) hit.push(r);
    }
  }
  return hit;
}

function polyCentroid(poly){
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++){
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const c = p[0] * q[1] - q[0] * p[1];
    a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c;
  }
  a *= 0.5;
  if (Math.abs(a) < 1){
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
  return [cx / (6 * a), cy / (6 * a)];
}
function cellAt(X, Y, x, y){
  let i = -1, j = -1;
  for (let k = 0; k < X.length - 1; k++) if (x >= X[k] && x <= X[k + 1]){ i = k; break; }
  for (let k = 0; k < Y.length - 1; k++) if (y >= Y[k] && y <= Y[k + 1]){ j = k; break; }
  return (i >= 0 && j >= 0) ? [i, j] : null;
}
/** 在填充网格上沿两点画一条加粗通道，确保两块区域连通 */
function paintFillCorridor(fill, X, Y, x0, y0, x1, y1, radiusMm){
  const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 40));
  const cols = X.length - 1, rows = Y.length - 1;
  for (let s = 0; s <= steps; s++){
    const t = s / steps;
    const px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
    for (let i = 0; i < cols; i++){
      for (let j = 0; j < rows; j++){
        if (fill[i][j]) continue;
        const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2;
        if (Math.hypot(cx - px, cy - py) <= radiusMm) fill[i][j] = true;
      }
    }
  }
}
function floodFillCells(fill, si, sj){
  const cols = fill.length, rows = fill[0].length;
  if (si < 0 || sj < 0 || si >= cols || sj >= rows || !fill[si][sj]) return [];
  const seen = Array.from({length: cols}, () => Array(rows).fill(false));
  const q = [[si, sj]], out = [];
  seen[si][sj] = true;
  while (q.length){
    const [ci, cj] = q.pop();
    out.push([ci, cj]);
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows || seen[ni][nj] || !fill[ni][nj]) continue;
      seen[ni][nj] = true;
      q.push([ni, nj]);
    }
  }
  return out;
}

/** 将多个正交多边形并成一个（含桥接矩形，用于合并隔墙/门洞） */
function unionOrthoPolys(polys, bridges){
  bridges = bridges || [];
  if (!polys.length) return null;
  const xs = [], ys = [];
  for (const p of polys) for (const [x, y] of p){ xs.push(x); ys.push(y); }
  for (const b of bridges){
    xs.push(b[0] - 60, b[2] + 60);
    ys.push(b[1] - 60, b[3] + 60);
  }
  // 质心也进网格，便于强制连通
  const cents = polys.map(polyCentroid);
  for (const [cx, cy] of cents){ xs.push(cx); ys.push(cy); }
  if (!xs.length) return null;
  const X = snapCoords(xs, 10), Y = snapCoords(ys, 10);
  const cols = X.length - 1, rows = Y.length - 1;
  if (cols < 1 || rows < 1) return null;
  const fill = Array.from({length: cols}, () => Array(rows).fill(false));
  const hitBridge = (cx, cy) => bridges.some(b =>
    cx >= b[0] - 40 && cx <= b[2] + 40 && cy >= b[1] - 40 && cy <= b[3] + 40
  );
  for (let i = 0; i < cols; i++){
    for (let j = 0; j < rows; j++){
      const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2;
      if (polys.some(p => pointInPoly(cx, cy, p)) || hitBridge(cx, cy)) fill[i][j] = true;
    }
  }
  // 若各房间质心仍不在同一连通块，沿质心连线强制开通道（穿过门洞/隔墙）
  if (cents.length >= 2){
    const starts = cents.map(c => cellAt(X, Y, c[0], c[1])).filter(Boolean);
    if (starts.length >= 2){
      let comp = floodFillCells(fill, starts[0][0], starts[0][1]);
      const inComp = (i, j) => comp.some(([a, b]) => a === i && b === j);
      for (let n = 1; n < starts.length; n++){
        const [ti, tj] = starts[n];
        if (inComp(ti, tj)) continue;
        paintFillCorridor(fill, X, Y, cents[0][0], cents[0][1], cents[n][0], cents[n][1], 140);
        comp = floodFillCells(fill, starts[0][0], starts[0][1]);
      }
    }
  }
  // 只取包含第一个质心的连通块，避免「标签在中间、轮廓只有一半」
  let cells;
  const c0 = cents[0] && cellAt(X, Y, cents[0][0], cents[0][1]);
  if (c0 && fill[c0[0]][c0[1]]) cells = floodFillCells(fill, c0[0], c0[1]);
  else {
    cells = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (fill[i][j]) cells.push([i, j]);
  }
  let areaMm = 0, sx = 0, sy = 0;
  for (const [ci, cj] of cells){
    const a = (X[ci + 1] - X[ci]) * (Y[cj + 1] - Y[cj]);
    areaMm += a;
    sx += (X[ci] + X[ci + 1]) / 2 * a;
    sy += (Y[cj] + Y[cj + 1]) / 2 * a;
  }
  if (!cells.length || areaMm < 8e5) return null;
  // 校验：合并后应覆盖各原房间质心；否则再强制通道一次
  for (let n = 1; n < cents.length; n++){
    const c = cellAt(X, Y, cents[n][0], cents[n][1]);
    if (c && cells.some(([i, j]) => i === c[0] && j === c[1])) continue;
    paintFillCorridor(fill, X, Y, cents[0][0], cents[0][1], cents[n][0], cents[n][1], 180);
    if (c0) cells = floodFillCells(fill, c0[0], c0[1]);
    areaMm = 0; sx = 0; sy = 0;
    for (const [ci, cj] of cells){
      const a = (X[ci + 1] - X[ci]) * (Y[cj + 1] - Y[cj]);
      areaMm += a;
      sx += (X[ci] + X[ci + 1]) / 2 * a;
      sy += (Y[cj] + Y[cj + 1]) / 2 * a;
    }
  }
  const poly = orthoPolyFromCells(cells, X, Y);
  if (!poly || poly.length < 3) return null;
  return {poly, at: [Math.round(sx / areaMm), Math.round(sy / areaMm)], areaMm};
}

/** 在房间多边形内按阻挡矩形拆分 */
function splitPolyByBarriers(poly, barriers){
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  for (const b of barriers){ xs.push(b[0], b[2]); ys.push(b[1], b[3]); }
  const X = snapCoords(xs, 10), Y = snapCoords(ys, 10);
  const cols = X.length - 1, rows = Y.length - 1;
  if (cols < 1 || rows < 1) return [];
  const block = Array.from({length: cols}, () => Array(rows).fill(false));
  const inside = Array.from({length: cols}, () => Array(rows).fill(false));
  for (let i = 0; i < cols; i++){
    for (let j = 0; j < rows; j++){
      const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2;
      if (!pointInPoly(cx, cy, poly)) continue;
      inside[i][j] = true;
      for (const b of barriers){
        if (cx >= b[0] && cx <= b[2] && cy >= b[1] && cy <= b[3]){ block[i][j] = true; break; }
      }
    }
  }
  const seen = Array.from({length: cols}, () => Array(rows).fill(0));
  const parts = [];
  let rid = 0;
  for (let i = 0; i < cols; i++){
    for (let j = 0; j < rows; j++){
      if (!inside[i][j] || block[i][j] || seen[i][j]) continue;
      rid++;
      const q = [[i, j]], cells = [];
      seen[i][j] = rid;
      while (q.length){
        const [ci, cj] = q.pop();
        cells.push([ci, cj]);
        for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          if (!inside[ni][nj] || block[ni][nj] || seen[ni][nj]) continue;
          seen[ni][nj] = rid;
          q.push([ni, nj]);
        }
      }
      let areaMm = 0, sx = 0, sy = 0;
      for (const [ci, cj] of cells){
        const a = (X[ci + 1] - X[ci]) * (Y[cj + 1] - Y[cj]);
        areaMm += a;
        sx += (X[ci] + X[ci + 1]) / 2 * a;
        sy += (Y[cj] + Y[cj + 1]) / 2 * a;
      }
      if (areaMm < 8e5) continue;
      const p = orthoPolyFromCells(cells, X, Y);
      if (!p || p.length < 3) continue;
      parts.push({poly: p, at: [Math.round(sx / areaMm), Math.round(sy / areaMm)], areaMm});
    }
  }
  parts.sort((a, b) => b.areaMm - a.areaMm);
  return parts;
}

function detectRoomsFromWalls(walls){
  if (!walls || walls.length < 3) return [];
  const xs = [], ys = [];
  for (const w of walls){ xs.push(w[0], w[2]); ys.push(w[1], w[3]); }
  // 窗户坐标参与网格，确保带窗墙段被完整挡住
  for (const win of WINS){ xs.push(win[0], win[2]); ys.push(win[1], win[3]); }
  for (const d of DOORS){ xs.push(d.rect[0], d.rect[2]); ys.push(d.rect[1], d.rect[3]); }
  for (const s of SLIDES){ xs.push(s.rect[0], s.rect[2]); ys.push(s.rect[1], s.rect[3]); }
  const X = snapCoords(xs, 10), Y = snapCoords(ys, 10);
  const cols = X.length - 1, rows = Y.length - 1;
  if (cols < 1 || rows < 1) return [];

  const WALL_PAD = 12; // 略膨胀，避免网格中心落在墙皮外侧而漏连通
  const isWall = Array.from({length: cols}, () => Array(rows).fill(false));
  const floorWalls = walls.filter(w => (w[4] || 'n') !== 'beam'); // 横梁不挡房间连通
  for (let i = 0; i < cols; i++){
    for (let j = 0; j < rows; j++){
      const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2;
      const cw = X[i + 1] - X[i], ch = Y[j + 1] - Y[j];
      for (const w of floorWalls){
        if (cx >= w[0] - WALL_PAD && cx <= w[2] + WALL_PAD && cy >= w[1] - WALL_PAD && cy <= w[3] + WALL_PAD){
          isWall[i][j] = true; break;
        }
      }
      if (!isWall[i][j] && (cw <= 40 || ch <= 40)){
        for (const w of floorWalls){
          const ox0 = Math.max(X[i], w[0] - WALL_PAD), oy0 = Math.max(Y[j], w[1] - WALL_PAD);
          const ox1 = Math.min(X[i + 1], w[2] + WALL_PAD), oy1 = Math.min(Y[j + 1], w[3] + WALL_PAD);
          if (ox1 > ox0 && oy1 > oy0 && (ox1 - ox0) * (oy1 - oy0) >= cw * ch * 0.35){
            isWall[i][j] = true; break;
          }
        }
      }
    }
  }
  // 带窗墙：整段实心隔断（窗户不算连通）
  for (const w of walls){
    if ((w[4] || 'n') === 'win') markRectAsWall(isWall, X, Y, w, 20);
  }
  // 窗户：优先按宿主墙整段封堵；无宿主则按窗洞加厚封堵
  for (const win of WINS){
    const host = Number.isFinite(win[6]) && walls[win[6]] ? walls[win[6]] : null;
    markRectAsWall(isWall, X, Y, barrierRectForWin(win, host), 20);
  }
  // 共线墙端头细缝补死（含带窗墙与邻墙未贴齐时）
  sealWallEndGaps(isWall, X, Y, floorWalls);

  const seen = Array.from({length: cols}, () => Array(rows).fill(0));
  const found = [];
  let rid = 0;
  for (let i = 0; i < cols; i++){
    for (let j = 0; j < rows; j++){
      if (isWall[i][j] || seen[i][j]) continue;
      rid++;
      const q = [[i, j]], cells = [];
      let exterior = false;
      seen[i][j] = rid;
      while (q.length){
        const [ci, cj] = q.pop();
        cells.push([ci, cj]);
        for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows){ exterior = true; continue; }
          if (isWall[ni][nj] || seen[ni][nj]) continue;
          seen[ni][nj] = rid;
          q.push([ni, nj]);
        }
      }
      if (exterior) continue;
      let areaMm = 0, sx = 0, sy = 0;
      for (const [ci, cj] of cells){
        const a = (X[ci + 1] - X[ci]) * (Y[cj + 1] - Y[cj]);
        areaMm += a;
        sx += (X[ci] + X[ci + 1]) / 2 * a;
        sy += (Y[cj] + Y[cj + 1]) / 2 * a;
      }
      if (areaMm < 8e5) continue; // < 0.8 m²
      const poly = orthoPolyFromCells(cells, X, Y);
      if (!poly || poly.length < 3) continue;
      found.push({
        poly,
        at: [Math.round(sx / areaMm), Math.round(sy / areaMm)],
        areaMm,
      });
    }
  }
  found.sort((a, b) => b.areaMm - a.areaMm);
  return found.map((r, i) => ({
    id: 'r' + (i + 1),
    name: '房间' + (i + 1),
    poly: r.poly,
    mat: null, // 未选择地面，不默认铺砖
    at: r.at,
  }));
}

/** 房间当前地面材料键；未选择时返回 null（不回退到默认砖） */
function roomMatKey(r){
  if (!r) return null;
  const id = typeof r === 'string' ? r : r.id;
  const st = (typeof state !== 'undefined' && state.rooms && state.rooms[id]) || null;
  const m = (st && st.mat) || (typeof r === 'object' && r.mat) || null;
  return (m && typeof MATS !== 'undefined' && MATS[m]) ? m : null;
}

function nextRoomId(){
  let n = 1;
  const used = new Set(ROOMS.map(r => r.id));
  while (used.has('r' + n)) n++;
  return 'r' + n;
}

/** @deprecated 保留空实现，避免旧调用报错；不再自动推断地面 */
function guessRoomMat(){ return null; }
let _matsEnrichedGen = 0;
function resetRoomMatEnrichment(){ _matsEnrichedGen++; }
function enrichPlainRoomMatsIfNeeded(){ /* 不自动铺砖 */ }

function mergeRooms(idA, idB){
  const ra = ROOMS.find(r => r.id === idA), rb = ROOMS.find(r => r.id === idB);
  if (!ra || !rb || ra === rb) return toast(tr('请选择两个不同的房间', 'Select two different rooms'));
  const bridges = [];
  for (const w of WALLS){
    const sides = roomsTouchingOpening(w, [ra, rb]);
    if (sides.length === 2) bridges.push(w.slice(0, 4));
  }
  for (const d of DOORS){
    const hit = roomsTouchingOpening(d.rect, [ra, rb]);
    if (hit.length === 2) bridges.push(d.rect.slice());
  }
  for (const s of SLIDES){
    const hit = roomsTouchingOpening(s.rect, [ra, rb]);
    if (hit.length === 2) bridges.push(s.rect.slice());
  }
  // 无门墙桥时，用两房间质心包围盒作后备桥，避免合并后轮廓只剩一半
  if (!bridges.length){
    const ca = polyCentroid(ra.poly), cb = polyCentroid(rb.poly);
    bridges.push([
      Math.min(ca[0], cb[0]) - 100, Math.min(ca[1], cb[1]) - 100,
      Math.max(ca[0], cb[0]) + 100, Math.max(ca[1], cb[1]) + 100,
    ]);
  }
  const u = unionOrthoPolys([ra.poly, rb.poly], bridges);
  if (!u) return toast(tr('这两个房间不相邻，无法合并', 'Rooms are not adjacent — cannot merge'));
  // 合并结果必须覆盖两个原房间质心，否则视为失败
  const ca = polyCentroid(ra.poly), cb = polyCentroid(rb.poly);
  if (!pointInPoly(ca[0], ca[1], u.poly) || !pointInPoly(cb[0], cb[1], u.poly)){
    return toast(tr('合并未完整连通两房间，请确认中间有门或相邻墙', 'Merge did not fully join both rooms — check for a door or shared wall'));
  }
  const stA = state.rooms[idA] || {name: ra.name, mat: ra.mat || null};
  const stB = state.rooms[idB] || {name: rb.name, mat: rb.mat || null};
  const areaA = area(ra.poly), areaB = area(rb.poly);
  const keepMat = areaA >= areaB ? stA.mat : stB.mat;
  const keepName = areaA >= areaB ? stA.name : stB.name;
  const keepWall = areaA >= areaB ? stA.wallpaper : stB.wallpaper;
  const b = snap();
  ROOMS = ROOMS.filter(r => r.id !== idA && r.id !== idB);
  const id = nextRoomId();
  ROOMS.push({id, name: keepName, poly: u.poly, mat: keepMat, at: u.at});
  delete state.rooms[idA]; delete state.rooms[idB];
  state.rooms[id] = {name: keepName, mat: keepMat, wallpaper: keepWall || null};
  persistCustomPlan();
  commit(b);
  select({kind:'room', id});
  renderAll();
  toast(tr(`已合并房间 · ${fmt(area(u.poly))} m²`, `Rooms merged · ${fmt(area(u.poly))} m²`));
}

function splitRoomByDoors(roomId){
  const room = ROOMS.find(r => r.id === roomId);
  if (!room) return;
  // 门洞作为分界：穿过或贴在该房间上的门 / 推拉门
  const barriers = [];
  for (const d of DOORS){
    const [x0, y0, x1, y1] = d.rect;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const horiz = (x1 - x0) >= (y1 - y0);
    const probes = horiz
      ? [[cx, cy], [cx, y0 - 40], [cx, y1 + 40]]
      : [[cx, cy], [x0 - 40, cy], [x1 + 40, cy]];
    if (probes.some(([px, py]) => pointInPoly(px, py, room.poly))) barriers.push(d.rect.slice());
  }
  for (const s of SLIDES){
    const [x0, y0, x1, y1] = s.rect;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (pointInPoly(cx, cy, room.poly)
      || pointInPoly(cx, y0 - 40, room.poly) || pointInPoly(cx, y1 + 40, room.poly)
      || pointInPoly(x0 - 40, cy, room.poly) || pointInPoly(x1 + 40, cy, room.poly)){
      barriers.push(s.rect.slice());
    }
  }
  if (!barriers.length) return toast(tr('该房间没有可作为分界的门', 'No doors available to split this room'));
  const parts = splitPolyByBarriers(room.poly, barriers);
  if (parts.length < 2) return toast(tr('无法按门拆分：门洞未能把房间分成多块', 'Cannot split — doors do not divide this room into parts'));
  const st = state.rooms[roomId] || {name: room.name, mat: room.mat || null};
  const b = snap();
  ROOMS = ROOMS.filter(r => r.id !== roomId);
  delete state.rooms[roomId];
  parts.forEach((p, i) => {
    const id = nextRoomId();
    const name = i === 0 ? st.name : (st.name + '-' + (i + 1));
    ROOMS.push({id, name, poly: p.poly, mat: st.mat, at: p.at});
    state.rooms[id] = {name, mat: st.mat, wallpaper: st.wallpaper || null};
  });
  persistCustomPlan();
  commit(b);
  select({kind:'room', id: ROOMS[ROOMS.length - parts.length].id});
  renderAll();
  toast(tr(`已按门拆分为 ${parts.length} 个房间`, `Split into ${parts.length} rooms by doors`));
}

function applyDetectedRooms(opts){
  opts = opts || {};
  if (!WALLS.length){
    if (!opts.silent) toast(tr('请先画墙，再识别房间', 'Draw walls first, then detect rooms'));
    return false;
  }
  const found = detectRoomsFromWalls(WALLS);
  if (!found.length){
    if (!opts.silent) toast(tr('未识别到封闭房间，请把外墙与内墙画闭合', 'No closed rooms found — close exterior and interior walls'));
    return false;
  }
  const b = snap();
  ROOMS = found;
  state.rooms = {};
  found.forEach(r => { state.rooms[r.id] = {name: r.name, mat: null, wallpaper:null}; });
  state._matsEnrichedGen = _matsEnrichedGen;
  state._floorMatPolicy = 1;
  if (ui.sel && ui.sel.kind === 'room') ui.sel = null;
  ui.awaitMerge = null;
  planFlags.tracing = false;
  persistCustomPlan();
  commit(b);
  renderOpenings(); renderDims(); renderAll();
  if (!opts.silent) toast(tr('已识别 ' + found.length + ' 个房间（带窗墙不连通）', 'Detected ' + found.length + ' rooms (windowed walls do not connect)'));
  return true;
}

/** 上传底图后进入空白描墙方案（先不显示房间，画完再识别） */
function startTraceFromImage(dataUrl, naturalW, naturalH){
  const planW = 18000;
  const planH = Math.max(9000, Math.round(planW * (naturalH / Math.max(naturalW, 1))));
  applyPlanGeometry({
    walls: [],
    wins: [],
    doors: [],
    slides: [],
    rooms: [],
    underlay: [],
    bounds: {x:-800, y:-800, w:planW+1600, h:planH+1600},
    hasDefaultDims: false,
    hasBayLintels: false,
    hasEntryMark: false,
    cadMode: false,
    tracing: true,
  }, {imported:true, allowEmpty:true, allowEmptyRooms:true});
  state.furniture = [];
  state.demolished = [];
  state.measures = [];
  state.rooms = {};
  state.bgImage = dataUrl;
  state.bgOpacity = 0.35;
  state.bgScale = 1.5;
  state.bgAspect = naturalW / Math.max(naturalH, 1);
  state.bgFrame = {x:0, y:0, w:planW, h:planH};
  planFlags.tracing = true;
  persistCustomPlan();
  syncBgControlsUi();
  fitView();
  renderOpenings(); renderDims(); renderAll();
  setTool('draw');
  toast(tr('新画布已就绪：可用「校准」按已知尺寸缩放底图，再画墙', 'New canvas ready — use Calibrate to scale the underlay, then draw walls'));
}

function setTool(t){
  const prev = ui.tool;
  if (t === 'calibrate' && !state.bgImage){
    toast(tr('请先上传底图，再校准比例', 'Upload an underlay image first'));
    t = prev === 'calibrate' ? 'select' : prev;
  }
  if (t !== 'calibrate' && typeof closeCalibrateModal === 'function' && $('#calModal') && !$('#calModal').hidden){
    closeCalibrateModal();
  }
  ui.tool = t; ui.mA = null; ui.mCur = null; ui.drawA = null; ui.drawCur = null;
  ui.linkA = null; ui.linkCur = null; ui.linkSel = null;
  // 画连通区时不选中任何家具 / 房间，避免选中框与手柄干扰画区域
  if (t === 'link' && ui.sel && typeof select === 'function') select(null);
  svg.setAttribute('class', 'tool-' + t);
  document.querySelectorAll('#tools .btn').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  syncModeHint();
  if (typeof syncToolOptions === 'function') syncToolOptions();   // 参数组只留与当前工具相关的
  renderMeasure();
  renderWallDraft();
  if (typeof renderLinks === 'function') renderLinks();
  // 描墙结束后切回选择：自动识别房间
  if (prev === 'draw' && t === 'select' && planFlags.tracing && WALLS.length && !ROOMS.length){
    applyDetectedRooms({silent:false});
  }
}
function syncModeHint(){
  const hints = {select:'',
    draw:tr('左键拖动画墙 · 可选普通/承重/带窗/矮围墙/横梁 · 右键平移 · 画完点「识别房间」', 'Left-drag walls · Normal/Bearing/Windowed/Low/Beam · right-pan · Detect rooms when done'),
    erase:tr('点击墙体 / 窗户 / 门即可删除（可撤销）', 'Click a wall, window or door to delete (undoable)'),
    measure:COARSE ? tr('按住拖出测量线，或依次点两点 · 靠近墙面自动吸附 · 点「选择」退出', 'Hold and drag a line, or tap two points · snaps to walls · tap "Select" to exit')
      : tr('点击两点（或按住拖动）测量距离 · 靠近墙面自动吸附 · Shift 锁定水平/垂直 · Esc 取消', 'Click two points (or drag) to measure · snaps to walls · Shift locks horizontal/vertical · Esc cancels'),
    calibrate:COARSE ? tr('在底图上拖出已知长度的线段，松手后输入实际长度', 'Drag a known-length segment on the underlay, then enter its real length')
      : tr('在底图上画一段已知尺寸的线（两点或拖动）· 输入实际长度后自动缩放底图 · Esc 取消', 'Draw a known-length segment on the underlay · enter real length to auto-scale · Esc cancels'),
    demolish:tr('点击选中墙体 · 拖移 / 拖两端改长度 · 面板可输入长度或标记拆除', 'Click to select · drag to move / ends to resize · panel: length or demolish'),
    link:((state.activeFloor | 0) === 0
      ? tr('拖出矩形定义本层连通区（与上层对齐的锚点）· 也可直接拖动青色的「另一层连通区」在本层设锚点，另一层位置保持不变 · 3D 中两层建筑各自平移，使两个不同位置的连通区重合 · 拖动移动 / 拖手柄调大小 / 点 × 删除 · Esc 取消',
           'Drag a rectangle to define this floor\'s link (anchor to the floor above) · or drag the cyan link from the other floor to set an anchor here, leaving that floor unchanged · in 3D both buildings shift so the two links coincide · tap × to delete · Esc cancels')
      : tr('拖出矩形定义本层连通区（本层楼板在此开洞）· 也可直接拖动青色的「另一层连通区」在本层设锚点，另一层位置保持不变 · 3D 中两层建筑各自平移，使两个不同位置的连通区重合 · 拖动移动 / 拖手柄调大小 / 点 × 删除 · Esc 取消',
           'Drag a rectangle to define this floor\'s link (its slab is cut out here) · or drag the cyan link from the other floor to set an anchor here, leaving that floor unchanged · in 3D both buildings shift so the two links coincide · tap × to delete · Esc cancels'))};
  const h = $('#modehint'); h.textContent = hints[ui.tool] || ''; h.classList.toggle('show', !!hints[ui.tool]);
}
