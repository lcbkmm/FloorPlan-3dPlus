# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
code = open(r'f:\floorplan-3d\tools\probe_frames.py', encoding='utf-8').read()
idx = code.find('results = []')
ns = {}
exec(code[:idx], ns)

frames = ns['frames']
segs = ns['segs']
WALL_LAYERS = ns['WALL_LAYERS']
frame_world = ns['frame_world']
inset = ns['inset']
inside = ns['inside']
pair_walls = ns['pair_walls']
merge_colinear = ns['merge_colinear']

ranked = []
for i, ins in enumerate(frames):
    bb = frame_world(ins)
    crop = inset(bb, 1800)
    use = [s for s in segs if s[4] in WALL_LAYERS and inside(s, crop, 0)]
    walls = pair_walls(use)
    max_span = max(crop[2] - crop[0], crop[3] - crop[1]) * 0.85
    walls = [w for w in walls if max(w[2] - w[0], w[3] - w[1]) < max_span]
    walls = merge_colinear(walls)
    if not walls:
        continue
    xs = [w[0] for w in walls] + [w[2] for w in walls]
    ys = [w[1] for w in walls] + [w[3] for w in walls]
    wdt, hgt = max(xs) - min(xs), max(ys) - min(ys)
    apt = 10000 <= wdt <= 22000 and 8000 <= hgt <= 16000
    score = len(walls) + (100 if apt else 0)
    ranked.append((score, apt, wdt, hgt, i, walls, min(xs), min(ys)))

ranked.sort(reverse=True)
for score, apt, wdt, hgt, i, walls, ox, oy in ranked[:10]:
    print(f'#{i} apt={apt} score={score} size={wdt/1000:.1f}x{hgt/1000:.1f}m walls={len(walls)}')

score, apt, wdt, hgt, i, walls, ox, oy = ranked[0]
W, H = wdt + 400, hgt + 400
parts = [
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="900">',
    '<rect width="100%" height="100%" fill="#111"/>',
]
for w in walls:
    parts.append(
        f'<rect x="{w[0]-ox+200}" y="{w[1]-oy+200}" width="{w[2]-w[0]}" height="{w[3]-w[1]}" fill="#7ec8e3"/>'
    )
parts.append('</svg>')
open(r'f:\floorplan-3d\tools\walls_preview.svg', 'w', encoding='utf-8').write('\n'.join(parts))
print('wrote preview sheet', i)
