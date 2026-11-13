# -*- coding: utf-8 -*-
"""Find title-block sheets and walls inside each."""
import sys, math
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
path = r'f:\floorplan-3d\data\嘉裕.dxf'
raw = open(path, encoding='utf-8', errors='replace').read().splitlines()

pairs = []
i = 0
while i + 1 < len(raw):
    try:
        code = int(raw[i].strip())
    except ValueError:
        i += 1
        continue
    pairs.append((code, raw[i + 1].strip()))
    i += 2

blocks = {}
entities = []
section = None
current = None
i = 0
while i < len(pairs):
    code, val = pairs[i]
    if code == 0 and val == 'SECTION':
        i += 1
        if i < len(pairs) and pairs[i][0] == 2:
            section = pairs[i][1]
        i += 1
        continue
    if code == 0 and val == 'ENDSEC':
        section = None
        current = None
        i += 1
        continue
    if section == 'BLOCKS':
        if code == 0 and val == 'BLOCK':
            j = i + 1
            name = None
            while j < len(pairs) and pairs[j][0] != 0:
                if pairs[j][0] == 2 and name is None:
                    name = pairs[j][1]
                j += 1
            blocks[name or ''] = []
            current = blocks[name or '']
            i += 1
            continue
        if code == 0 and val == 'ENDBLK':
            current = None
            i += 1
            continue
    if section == 'ENTITIES':
        current = entities
    if current is not None and code == 0:
        etype = val
        fields = []
        j = i + 1
        while j < len(pairs) and pairs[j][0] != 0:
            fields.append(pairs[j])
            j += 1
        d = {c: v for c, v in fields}
        if etype == 'LINE':
            current.append({
                'type': 'LINE', 'layer': d.get(8, '0'),
                'x1': float(d.get(10, 0)), 'y1': float(d.get(20, 0)),
                'x2': float(d.get(11, 0)), 'y2': float(d.get(21, 0)),
            })
        elif etype == 'LWPOLYLINE':
            layer, closed, pts, x = '0', False, [], None
            for c, v in fields:
                if c == 8:
                    layer = v
                elif c == 70:
                    closed = bool(int(float(v)) & 1)
                elif c == 10:
                    x = float(v)
                elif c == 20 and x is not None:
                    pts.append((x, float(v)))
                    x = None
            current.append({'type': 'LWPOLYLINE', 'layer': layer, 'closed': closed, 'pts': pts})
        elif etype == 'INSERT':
            current.append({
                'type': 'INSERT', 'layer': d.get(8, '0'), 'name': d.get(2, ''),
                'x': float(d.get(10, 0)), 'y': float(d.get(20, 0)),
                'sx': float(d.get(41, 1)), 'sy': float(d.get(42, 1)), 'rot': float(d.get(50, 0)),
            })
        elif etype == 'ARC':
            current.append({
                'type': 'ARC', 'layer': d.get(8, '0'),
                'cx': float(d.get(10, 0)), 'cy': float(d.get(20, 0)),
                'r': float(d.get(40, 0)), 'a0': float(d.get(50, 0)), 'a1': float(d.get(51, 0)),
            })
        i = j
        continue
    i += 1


def xform(x, y, ins):
    x, y = x * ins['sx'], y * ins['sy']
    rad = math.radians(ins['rot'])
    c, s = math.cos(rad), math.sin(rad)
    return x * c - y * s + ins['x'], x * s + y * c + ins['y']


def explode(ents, depth=0):
    out = []
    for e in ents:
        if e['type'] == 'INSERT' and depth < 6:
            for ce in explode(blocks.get(e['name'], []), depth + 1):
                if ce['type'] == 'LINE':
                    x1, y1 = xform(ce['x1'], ce['y1'], e)
                    x2, y2 = xform(ce['x2'], ce['y2'], e)
                    out.append({'type': 'LINE', 'layer': ce.get('layer', e['layer']),
                                'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2})
                elif ce['type'] == 'LWPOLYLINE':
                    pts = [xform(px, py, e) for px, py in ce['pts']]
                    out.append({'type': 'LWPOLYLINE', 'layer': ce.get('layer', e['layer']),
                                'closed': ce['closed'], 'pts': pts})
        elif e['type'] in ('LINE', 'LWPOLYLINE'):
            out.append(e)
    return out


# frame local bbox
fb = blocks.get('图框', [])
fx, fy = [], []
for e in fb:
    if e['type'] == 'LINE':
        fx += [e['x1'], e['x2']]
        fy += [e['y1'], e['y2']]
    elif e['type'] == 'LWPOLYLINE':
        for p in e['pts']:
            fx.append(p[0])
            fy.append(p[1])
local = (min(fx), min(fy), max(fx), max(fy))
print('图框 local', local, 'size', local[2] - local[0], local[3] - local[1])

frames = [e for e in entities if e['type'] == 'INSERT' and e['name'] == '图框']
print('frames', len(frames))

geom = explode(entities)
segs = []


def add_seg(x1, y1, x2, y2, layer):
    if abs(x2 - x1) < 1 and abs(y2 - y1) < 1:
        return
    if abs(x2 - x1) < abs(y2 - y1) * 0.02:
        x = (x1 + x2) / 2
        segs.append((x, min(y1, y2), x, max(y1, y2), layer, 'v'))
    elif abs(y2 - y1) < abs(x2 - x1) * 0.02:
        y = (y1 + y2) / 2
        segs.append((min(x1, x2), y, max(x1, x2), y, layer, 'h'))


for e in geom:
    if e['type'] == 'LINE':
        add_seg(e['x1'], e['y1'], e['x2'], e['y2'], e['layer'])
    elif e['type'] == 'LWPOLYLINE':
        pts = e['pts']
        n = len(pts)
        for i in range(n if e['closed'] else n - 1):
            a, b = pts[i], pts[(i + 1) % n]
            add_seg(a[0], a[1], b[0], b[1], e['layer'])

WALL_LAYERS = {'图层1', 'WALL墙体', 'WALL', '窗线', 'WINDOW'}


def frame_world(ins):
    corners = [(local[0], local[1]), (local[2], local[1]), (local[2], local[3]), (local[0], local[3])]
    pts = [xform(x, y, ins) for x, y in corners]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def inside(seg, bb, margin=200):
    x0, y0, x1, y1 = bb
    x0 -= margin
    y0 -= margin
    x1 += margin
    y1 += margin
    mx = (seg[0] + seg[2]) / 2
    my = (seg[1] + seg[3]) / 2
    return x0 <= mx <= x1 and y0 <= my <= y1


THICKS = (100, 120, 180, 200, 240, 300, 370, 400)
THOL = 30
OLAP = 80


def pair_walls(use):
    H = [s for s in use if s[5] == 'h']
    V = [s for s in use if s[5] == 'v']

    def pair(group, orient):
        used = set()
        out = []
        items = list(enumerate(group))
        for i, a in items:
            if i in used:
                continue
            best = None
            for j, b in items:
                if j <= i or j in used:
                    continue
                if orient == 'h':
                    thick = abs(a[1] - b[1])
                    if not any(abs(thick - t) < THOL for t in THICKS):
                        continue
                    x0, x1 = max(a[0], b[0]), min(a[2], b[2])
                    if x1 - x0 < OLAP:
                        continue
                    score = x1 - x0
                    if best is None or score > best[0]:
                        best = (score, j, [x0, min(a[1], b[1]), x1, max(a[1], b[1]), 'n'])
                else:
                    thick = abs(a[0] - b[0])
                    if not any(abs(thick - t) < THOL for t in THICKS):
                        continue
                    y0, y1 = max(a[1], b[1]), min(a[3], b[3])
                    if y1 - y0 < OLAP:
                        continue
                    score = y1 - y0
                    if best is None or score > best[0]:
                        best = (score, j, [min(a[0], b[0]), y0, max(a[0], b[0]), y1, 'n'])
            if best:
                used.add(i)
                used.add(best[1])
                out.append(best[2])
        return out

    return pair(H, 'h') + pair(V, 'v')


def inset(bb, m):
    return (bb[0] + m, bb[1] + m, bb[2] - m, bb[3] - m)


def merge_colinear(walls, gap=30, axis_tol=15):
    """Merge axis-aligned wall rects that share thickness and align."""
    walls = [list(w) for w in walls]
    changed = True
    while changed:
        changed = False
        out = []
        used = set()
        for i, a in enumerate(walls):
            if i in used:
                continue
            ax0, ay0, ax1, ay1, ak = a
            aw, ah = ax1 - ax0, ay1 - ay0
            a_horiz = aw >= ah
            merged = a[:]
            for j, b in enumerate(walls):
                if j <= i or j in used:
                    continue
                bx0, by0, bx1, by1, bk = b
                bw, bh = bx1 - bx0, by1 - by0
                b_horiz = bw >= bh
                if a_horiz != b_horiz:
                    continue
                if a_horiz:
                    if abs(ay0 - by0) > axis_tol or abs(ay1 - by1) > axis_tol:
                        continue
                    if bx0 > merged[2] + gap or bx1 < merged[0] - gap:
                        continue
                    merged[0] = min(merged[0], bx0)
                    merged[2] = max(merged[2], bx1)
                    used.add(j)
                    changed = True
                else:
                    if abs(ax0 - bx0) > axis_tol or abs(ax1 - bx1) > axis_tol:
                        continue
                    if by0 > merged[3] + gap or by1 < merged[1] - gap:
                        continue
                    merged[1] = min(merged[1], by0)
                    merged[3] = max(merged[3], by1)
                    used.add(j)
                    changed = True
            used.add(i)
            out.append(merged)
        walls = out
    return walls


results = []
for idx, ins in enumerate(frames):
    bb = frame_world(ins)
    crop = inset(bb, 1800)  # exclude title block border + outer dims
    if crop[2] <= crop[0] or crop[3] <= crop[1]:
        continue
    use = [s for s in segs if s[4] in WALL_LAYERS and inside(s, crop, 0)]
    if len(use) < 30:
        use = [s for s in segs if inside(s, crop, 0) and s[4] not in ('FURNITURE', '标注', 'Defpoints')]
    walls = pair_walls(use)
    # drop near-full-frame spans (dimension lines mistaken as walls)
    max_span = max(crop[2] - crop[0], crop[3] - crop[1]) * 0.85
    walls = [w for w in walls if max(w[2] - w[0], w[3] - w[1]) < max_span]
    walls = merge_colinear(walls)
    wlen = sum(max(w[2] - w[0], w[3] - w[1]) for w in walls) if walls else 0
    results.append((len(walls), wlen, idx, bb, crop, len(use), walls))

results.sort(reverse=True)
for nwall, wlen, idx, bb, crop, nseg, walls in results[:10]:
    print(f'#{idx} segs={nseg} walls={nwall} wallLen={wlen/1000:.1f}m crop size={(crop[2]-crop[0])/1000:.1f}x{(crop[3]-crop[1])/1000:.1f}m')
    if walls:
        xs = [w[0] for w in walls] + [w[2] for w in walls]
        ys = [w[1] for w in walls] + [w[3] for w in walls]
        print(f'   wall bbox size={(max(xs)-min(xs))/1000:.1f}x{(max(ys)-min(ys))/1000:.1f}m n={len(walls)}')

# write SVG preview of top sheet
if results:
    nwall, wlen, idx, bb, crop, nseg, walls = results[0]
    xs = [w[0] for w in walls] + [w[2] for w in walls]
    ys = [w[1] for w in walls] + [w[3] for w in walls]
    ox, oy = min(xs), min(ys)
    W, H = max(xs) - ox + 400, max(ys) - oy + 400
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="900" height="600">',
        f'<rect width="100%" height="100%" fill="#1a1a1a"/>',
    ]
    for w in walls:
        parts.append(
            f'<rect x="{w[0]-ox+200}" y="{w[1]-oy+200}" width="{w[2]-w[0]}" height="{w[3]-w[1]}" fill="#7ec8e3" opacity=".85"/>'
        )
    parts.append('</svg>')
    out = r'f:\floorplan-3d\tools\walls_preview.svg'
    open(out, 'w', encoding='utf-8').write('\n'.join(parts))
    print('wrote', out, 'sheet', idx, 'walls', len(walls))
