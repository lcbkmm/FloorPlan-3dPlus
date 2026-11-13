# -*- coding: utf-8 -*-
"""Probe DXF wall extraction for 嘉裕.dxf"""
from collections import defaultdict, Counter
import math
import json

path = r'f:\floorplan-3d\data\嘉裕.dxf'
# File declares ANSI_936 but content is UTF-8
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    raw = f.read().splitlines()


def parse_pairs(lines):
    i = 0
    while i + 1 < len(lines):
        try:
            code = int(lines[i].strip())
        except ValueError:
            i += 1
            continue
        val = lines[i + 1].strip()
        yield code, val
        i += 2


pairs = list(parse_pairs(raw))
i = 0
section = None
blocks = {}
entities = []
current_ents = None

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
        current_ents = None
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
            block_name = name or ''
            blocks[block_name] = []
            current_ents = blocks[block_name]
            i += 1
            continue
        if code == 0 and val == 'ENDBLK':
            current_ents = None
            i += 1
            continue
    if section == 'ENTITIES':
        current_ents = entities

    if current_ents is not None and code == 0:
        etype = val
        fields = []
        j = i + 1
        while j < len(pairs) and pairs[j][0] != 0:
            fields.append(pairs[j])
            j += 1
        if etype == 'LINE':
            d = {c: v for c, v in fields}
            current_ents.append({
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
            current_ents.append({'type': 'LWPOLYLINE', 'layer': layer, 'closed': closed, 'pts': pts})
        elif etype == 'INSERT':
            d = {c: v for c, v in fields}
            current_ents.append({
                'type': 'INSERT', 'layer': d.get(8, '0'), 'name': d.get(2, ''),
                'x': float(d.get(10, 0)), 'y': float(d.get(20, 0)),
                'sx': float(d.get(41, 1)), 'sy': float(d.get(42, 1)), 'rot': float(d.get(50, 0)),
            })
        elif etype == 'ARC':
            d = {c: v for c, v in fields}
            current_ents.append({
                'type': 'ARC', 'layer': d.get(8, '0'),
                'cx': float(d.get(10, 0)), 'cy': float(d.get(20, 0)),
                'r': float(d.get(40, 0)), 'a0': float(d.get(50, 0)), 'a1': float(d.get(51, 0)),
            })
        i = j
        continue
    i += 1

import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
print('entities', len(entities), 'blocks', len(blocks))
print('types', Counter(e['type'] for e in entities))


def transform_pt(x, y, ins):
    x, y = x * ins['sx'], y * ins['sy']
    rad = math.radians(ins['rot'])
    c, s = math.cos(rad), math.sin(rad)
    return x * c - y * s + ins['x'], x * s + y * c + ins['y']


def explode(ents, depth=0):
    out = []
    for e in ents:
        if e['type'] == 'INSERT' and depth < 6:
            blk = blocks.get(e['name'], [])
            for ce in explode(blk, depth + 1):
                if ce['type'] == 'LINE':
                    x1, y1 = transform_pt(ce['x1'], ce['y1'], e)
                    x2, y2 = transform_pt(ce['x2'], ce['y2'], e)
                    out.append({'type': 'LINE', 'layer': ce.get('layer', e['layer']),
                                'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2})
                elif ce['type'] == 'LWPOLYLINE':
                    pts = [transform_pt(px, py, e) for px, py in ce['pts']]
                    out.append({'type': 'LWPOLYLINE', 'layer': ce.get('layer', e['layer']),
                                'closed': ce['closed'], 'pts': pts})
                elif ce['type'] == 'ARC':
                    cx, cy = transform_pt(ce['cx'], ce['cy'], e)
                    out.append({**ce, 'cx': cx, 'cy': cy, 'r': ce['r'] * abs(e['sx']),
                                'layer': ce.get('layer', e['layer'])})
        elif e['type'] in ('LINE', 'LWPOLYLINE', 'ARC'):
            out.append(e)
    return out


geom = explode(entities)
print('exploded', len(geom), Counter(e['type'] for e in geom))
print('layers', Counter(e.get('layer', '?') for e in geom).most_common(25))

segs = []
TOL = 1.0


def add_seg(x1, y1, x2, y2, layer):
    if abs(x2 - x1) < TOL and abs(y2 - y1) < TOL:
        return
    if abs(x2 - x1) < abs(y2 - y1) * 0.02:
        x = round((x1 + x2) / 2)
        segs.append((x, min(y1, y2), x, max(y1, y2), layer, 'v'))
    elif abs(y2 - y1) < abs(x2 - x1) * 0.02:
        y = round((y1 + y2) / 2)
        segs.append((min(x1, x2), y, max(x1, x2), y, layer, 'h'))


for e in geom:
    if e['type'] == 'LINE':
        add_seg(e['x1'], e['y1'], e['x2'], e['y2'], e['layer'])
    elif e['type'] == 'LWPOLYLINE':
        pts = e['pts']
        n = len(pts)
        if n < 2:
            continue
        for i in range(n if e['closed'] else n - 1):
            a, b = pts[i], pts[(i + 1) % n]
            add_seg(a[0], a[1], b[0], b[1], e['layer'])

print('ortho segs', len(segs))
print('seg layers', Counter(s[4] for s in segs).most_common(20))

THICKS = (100, 120, 180, 200, 240, 300, 370, 400)
THOL = 30
OLAP = 80


def pair_walls(use):
    H = [s for s in use if s[5] == 'h']
    V = [s for s in use if s[5] == 'v']
    walls = []

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
                    score = (x1 - x0) - abs(thick - 240) * 0.1
                    if best is None or score > best[0]:
                        best = (score, j, [x0, min(a[1], b[1]), x1, max(a[1], b[1]), 'n'])
                else:
                    thick = abs(a[0] - b[0])
                    if not any(abs(thick - t) < THOL for t in THICKS):
                        continue
                    y0, y1 = max(a[1], b[1]), min(a[3], b[3])
                    if y1 - y0 < OLAP:
                        continue
                    score = (y1 - y0) - abs(thick - 240) * 0.1
                    if best is None or score > best[0]:
                        best = (score, j, [min(a[0], b[0]), y0, max(a[0], b[0]), y1, 'n'])
            if best:
                used.add(i)
                used.add(best[1])
                out.append(best[2])
        return out

    return pair(H, 'h') + pair(V, 'v')


candidates = [
    ['图层1', 'WALL墙体'],
    ['图层1'],
    ['0'],
    ['WALL墙体'],
    None,
]
for focus in candidates:
    use = segs if focus is None else [s for s in segs if s[4] in focus]
    label = 'ALL' if focus is None else '+'.join(focus)
    walls = pair_walls(use)
    if not walls:
        print(label, 'walls=0 segs=', len(use))
        continue
    xs = [w[0] for w in walls] + [w[2] for w in walls]
    ys = [w[1] for w in walls] + [w[3] for w in walls]
    print(label, 'segs', len(use), 'walls', len(walls),
          'bbox', (round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))),
          'avgThick', round(sum(min(w[2] - w[0], w[3] - w[1]) for w in walls) / len(walls), 1))

# Save best guess walls for inspection
use = [s for s in segs if s[4] in ('图层1', 'WALL墙体', '0')]
walls = pair_walls(use)
# normalize origin to min corner
if walls:
    ox = min(w[0] for w in walls)
    oy = min(w[1] for w in walls)
    norm = [[round(w[0] - ox), round(w[1] - oy), round(w[2] - ox), round(w[3] - oy), w[4]] for w in walls]
    with open(r'f:\floorplan-3d\tools\walls_probe.json', 'w', encoding='utf-8') as f:
        json.dump({'origin': [ox, oy], 'walls': norm, 'count': len(norm)}, f)
    print('wrote walls_probe.json', len(norm))
