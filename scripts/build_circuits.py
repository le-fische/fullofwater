#!/usr/bin/env python3
"""
Builds high-precision 3D spline tracks for:
1. Nürburgring Nordschleife (20.71 km)
2. Nürburgring 24h-Layout (Nordschleife + GP Strecke, 25.38 km)
3. Nürburgring GP-Strecke (Sprintstrecke, 5.15 km)

Uses authentic OpenStreetMap surveyed raceway nodes + SRTM DEM 3D elevations.
All tracks share the identical world coordinate origin so they align seamlessly.
"""
import json, math, os, sys

RAW_PATH = 'tracks/nordschleife/osm_raw.json'
DEM_PATH = 'tracks/nordschleife/dem.json'

d = json.load(open(RAW_PATH))
dem = json.load(open(DEM_PATH))

elements = {e['id']: e for e in d['elements']}
ways = [e for e in d['elements'] if e['type'] == 'way']

lat0 = 50.36399483033708
lon0 = 6.96253655599251
kx = 111320.0 * math.cos(math.radians(lat0))
ky = 110574.0

x0, z0, step, nx, nz, h = dem['x0'], dem['z0'], dem['step'], dem['nx'], dem['nz'], dem['h']

def get_elevation(x, z):
    gx = (x - x0) / step
    gz = (z - z0) / step
    ix = int(gx)
    iz = int(gz)
    if ix < 0 or ix >= nx - 1 or iz < 0 or iz >= nz - 1:
        return 600.0
    fx = gx - ix
    fz = gz - iz
    h00 = h[iz * nx + ix]
    h10 = h[iz * nx + ix + 1]
    h01 = h[(iz + 1) * nx + ix]
    h11 = h[(iz + 1) * nx + ix + 1]
    return (1 - fx) * (1 - fz) * h00 + fx * (1 - fz) * h10 + (1 - fx) * fz * h01 + fx * fz * h11

def to_local(lat, lon):
    return ((lon - lon0) * kx, -(lat - lat0) * ky)

def resample(pts_2d, target_step=5.0):
    out = [pts_2d[0]]
    acc = 0.0
    for i in range(1, len(pts_2d)):
        ax, az = pts_2d[i - 1]
        bx, bz = pts_2d[i]
        seg = math.hypot(bx - ax, bz - az)
        while acc + seg >= target_step:
            t = (target_step - acc) / seg
            ax, az = ax + (bx - ax) * t, az + (bz - az) * t
            out.append((ax, az))
            seg = math.hypot(bx - ax, bz - az)
            acc = 0.0
        acc += seg
    return out

def smooth_closed(vals, window, passes=1):
    n = len(vals)
    half = window // 2
    for _ in range(passes):
        out = []
        for i in range(n):
            s = 0.0
            for k in range(-half, half + 1):
                s += vals[(i + k) % n]
            out.append(s / (2 * half + 1))
        vals = out
    return vals

# 1. Build 24h Loop
print('Building Nürburgring 24h Layout...')
by_start = {}
for w in ways:
    by_start.setdefault(w['nodes'][0], []).append(w)

# Start 24h loop at start/finish straight of GP circuit (node 290934601 out of NGK-Schikane)
# Part A: GP straight from 290934601 down to 290934599
w1149 = elements[1149161210]
idx_599 = w1149['nodes'].index(290934599)
gp_straight_A = w1149['nodes'][:idx_599 + 1]

# Part B: Anbindung zur Nordschleife (node 290934599 -> 65385942)
anb_nord = elements[26543901]['nodes']

# Part C: T13 remainder (node 65385942 -> 344795485)
t13 = elements[41395670]
idx_t13_exit = t13['nodes'].index(65385942)
t13_exit_nodes = t13['nodes'][idx_t13_exit:]

# Part D: Full Nordschleife walk from 344795485 back around to Hohenrain (node 506284053)
nord_ways = []
cur = t13_exit_nodes[-1]
visited = {t13['id']}
for _ in range(100):
    cands = [w for w in by_start.get(cur, []) if w['id'] not in visited]
    cands = [w for w in cands if not any(k in (w.get('tags', {}).get('name') or '') for k in ['Boxen', 'Rally', 'Sprint', 'Anbindung', 'Variante', 'Müllen'])]
    if not cands: break
    nxt = cands[0]
    nord_ways.append(nxt)
    visited.add(nxt['id'])
    cur = nxt['nodes'][-1]
    if cur == 506284053:
        break

# Part E: T13 entrance to node 65385912
idx_t13_split = t13['nodes'].index(65385912)
t13_entry_nodes = t13['nodes'][:idx_t13_split + 1]

# Part F: Anbindung zum GP Kurs (node 65385912 -> 290934250)
anb_gp = elements[27852583]['nodes']

# Part G: GP circuit from 290934250 through Turn 1, Kurve 2, etc.
idx_250 = w1149['nodes'].index(290934250)
gp_t1_approach = w1149['nodes'][idx_250:]

# Part H: GP circuit ways from 290934637 to 290934601
gp_ways = []
cur = gp_t1_approach[-1]
visited_gp = {w1149['id']}
for _ in range(30):
    cands = [w for w in by_start.get(cur, []) if w['id'] not in visited_gp]
    cands = [w for w in cands if not any(k in (w.get('tags', {}).get('name') or '') for k in ['Boxen', 'Rally', 'Müllenbach'])]
    if not cands: break
    nxt = cands[0]
    gp_ways.append(nxt)
    visited_gp.add(nxt['id'])
    cur = nxt['nodes'][-1]
    if cur == 290934601:
        break

print(f'24h Segments gathered: GP straight A ({len(gp_straight_A)}), Anb Nord ({len(anb_nord)}), T13 exit ({len(t13_exit_nodes)}), Nord ways ({len(nord_ways)}), T13 entry ({len(t13_entry_nodes)}), Anb GP ({len(anb_gp)}), GP T1 approach ({len(gp_t1_approach)}), GP ways ({len(gp_ways)})')

# Assemble continuous lat/lon node list with segment tracking
# Helper node map
node_coord = {}
for e in d['elements']:
    if e['type'] == 'node':
        node_coord[e['id']] = (e['lat'], e['lon'])
    elif 'geometry' in e:
        for nid, g in zip(e['nodes'], e['geometry']):
            node_coord[nid] = (g['lat'], g['lon'])

def assemble_chain(node_sequences_and_ways):
    all_coords = []
    seg_marks = []
    for item in node_sequences_and_ways:
        if isinstance(item, tuple) and len(item) == 2 and isinstance(item[1], list):
            name, nids = item
            if name:
                seg_marks.append((name, len(all_coords)))
            for nid in nids:
                if not all_coords or node_coord[nid] != all_coords[-1]:
                    all_coords.append(node_coord[nid])
        elif isinstance(item, dict) and 'geometry' in item:
            name = item.get('tags', {}).get('name', '')
            if name:
                seg_marks.append((name, len(all_coords)))
            for pt in [(g['lat'], g['lon']) for g in item['geometry']]:
                if not all_coords or pt != all_coords[-1]:
                    all_coords.append(pt)
    return all_coords, seg_marks

chain_24h_defs = [
    ('GP Start-Ziel', gp_straight_A),
    ('Anbindung zur Nordschleife', anb_nord),
    ('T13 Nord-Spur', t13_exit_nodes),
]
for w in nord_ways:
    chain_24h_defs.append(w)
chain_24h_defs.extend([
    ('Hohenrain / T13', t13_entry_nodes),
    ('Anbindung zum GP-Kurs', anb_gp),
    ('GP-Turn 1 Approach', gp_t1_approach),
])
for w in gp_ways:
    chain_24h_defs.append(w)

coords_24h, seg_marks_24h = assemble_chain(chain_24h_defs)
print(f'Total raw 24h coords: {len(coords_24h)}')

local_24h = [to_local(lat, lon) for lat, lon in coords_24h]
# Resample to 5m intervals
pts_24h = resample(local_24h, 5.0)
n_24h = len(pts_24h)
xs_24h = smooth_closed([p[0] for p in pts_24h], 5, passes=2)
zs_24h = smooth_closed([p[1] for p in pts_24h], 5, passes=2)
ys_24h = [get_elevation(x, z) for x, z in zip(xs_24h, zs_24h)]
ys_24h = smooth_closed(ys_24h, 9, passes=3)

total_24h_m = n_24h * 5.0
print(f'24h Circuit built: {n_24h} points, length: {total_24h_m/1000:.3f} km, elevation: {min(ys_24h):.1f}m - {max(ys_24h):.1f}m')

# Segments arc length
cum_24h = [0.0]
for i in range(1, len(local_24h)):
    cum_24h.append(cum_24h[-1] + math.hypot(local_24h[i][0] - local_24h[i-1][0], local_24h[i][1] - local_24h[i-1][1]))
scale_24h = total_24h_m / cum_24h[-1]
segs_24h = [{'name': name, 's': round(cum_24h[idx] * scale_24h, 1)} for name, idx in seg_marks_24h if name]

data_24h = {
    'name': 'Nürburgring 24h Layout',
    'step': 5.0,
    'total': total_24h_m,
    'points': [[round(x, 2), round(y, 2), round(z, 2)] for x, y, z in zip(xs_24h, ys_24h, zs_24h)],
    'segments': segs_24h,
    'origin': {'lat': lat0, 'lon': lon0}
}
os.makedirs('tracks/24h', exist_ok=True)
json.dump(data_24h, open('tracks/24h/osm_24h.json', 'w'), indent=2)
print('Saved tracks/24h/osm_24h.json')

# 2. Build GP-Strecke loop
print('\nBuilding Nürburgring GP-Strecke...')
gp_chain_defs = [
    ('GP Start-Ziel', w1149['nodes']),
]
for w in gp_ways:
    gp_chain_defs.append(w)

coords_gp, seg_marks_gp = assemble_chain(gp_chain_defs)
local_gp = [to_local(lat, lon) for lat, lon in coords_gp]
pts_gp = resample(local_gp, 5.0)
n_gp = len(pts_gp)
xs_gp = smooth_closed([p[0] for p in pts_gp], 5, passes=2)
zs_gp = smooth_closed([p[1] for p in pts_gp], 5, passes=2)
ys_gp = [get_elevation(x, z) for x, z in zip(xs_gp, zs_gp)]
ys_gp = smooth_closed(ys_gp, 9, passes=3)
total_gp_m = n_gp * 5.0
print(f'GP Circuit built: {n_gp} points, length: {total_gp_m/1000:.3f} km, elevation: {min(ys_gp):.1f}m - {max(ys_gp):.1f}m')

cum_gp = [0.0]
for i in range(1, len(local_gp)):
    cum_gp.append(cum_gp[-1] + math.hypot(local_gp[i][0] - local_gp[i-1][0], local_gp[i][1] - local_gp[i-1][1]))
scale_gp = total_gp_m / cum_gp[-1]
segs_gp = [{'name': name, 's': round(cum_gp[idx] * scale_gp, 1)} for name, idx in seg_marks_gp if name]

data_gp = {
    'name': 'Nürburgring GP-Strecke',
    'step': 5.0,
    'total': total_gp_m,
    'points': [[round(x, 2), round(y, 2), round(z, 2)] for x, y, z in zip(xs_gp, ys_gp, zs_gp)],
    'segments': segs_gp,
    'origin': {'lat': lat0, 'lon': lon0}
}
os.makedirs('tracks/gp', exist_ok=True)
json.dump(data_gp, open('tracks/gp/osm_gp.json', 'w'), indent=2)
print('Saved tracks/gp/osm_gp.json')
