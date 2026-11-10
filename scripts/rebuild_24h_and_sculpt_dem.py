#!/usr/bin/env python3
"""
Rebuilds the authentic Nürburgring 24h Gesamtkurs and sculpts dem.json:
1. Start position aligned to the EXACT GP Start-Ziel straight ([-1043.71, 615.351, 3134.76]).
2. Uses Variante 24h-Rennen (corner cut from Castrol-S bypassing Mercedes-Benz Arena into Ford-Kurve).
3. Connects full GP track through NGK-Schikane, branching at node 290934599 to Nordschleife.
4. Seamlessly traverses the complete 20.8 km Nordschleife loop.
5. Returns via Anbindung zum GP-Kurs to the GP front straight.
6. Inherits 3D elevations directly from surveyed GP and Nordschleife datasets with smooth transition blending.
7. Fully sculpts dem.json so that ZERO terrain vertices spill or noclip onto ANY track.
"""

import json
import math
import os

RAW_PATH = 'tracks/nordschleife/osm_raw.json'
DEM_PATH = 'tracks/nordschleife/dem.json'

d = json.load(open(RAW_PATH))
dem = json.load(open(DEM_PATH))
elements = {e['id']: e for e in d['elements']}

node_coord = {}
for e in d['elements']:
    if e['type'] == 'node':
        node_coord[e['id']] = (e['lat'], e['lon'])
    elif 'geometry' in e:
        for nid, g in zip(e['nodes'], e['geometry']):
            node_coord[nid] = (g['lat'], g['lon'])

lat0 = 50.36399483033708
lon0 = 6.96253655599251
kx = 111320.0 * math.cos(math.radians(lat0))
ky = 110574.0

def to_local(lat, lon):
    return ((lon - lon0) * kx, -(lat - lat0) * ky)

def resample_polyline(pts_2d, target_step=5.0):
    out = [pts_2d[0]]
    acc = 0.0
    for i in range(1, len(pts_2d)):
        ax, az = pts_2d[i - 1]
        bx, bz = pts_2d[i]
        seg = math.hypot(bx - ax, bz - az)
        if seg < 1e-6:
            continue
        while acc + seg >= target_step:
            t = (target_step - acc) / seg
            ax, az = ax + (bx - ax) * t, az + (bz - az) * t
            out.append((ax, az))
            seg = math.hypot(bx - ax, bz - az)
            acc = 0.0
        acc += seg
    return out

print('🏁 1. Assembling Authentic 24h Chain starting on GP Start-Ziel straight...')

w1149 = elements[1149161210] # GP Start-Ziel
w1208 = elements[1149161208] # Castrol-S
w_cut = elements[31010602]   # Variante 24h-Rennen (Corner Cut!)
w_ford = elements[820679446] # Ford-Kurve
w_to_nord = elements[26543901]  # Anbindung zur Nordschleife
t13 = elements[41395670]        # T13
w_to_gp = elements[27852583]    # Anbindung zum GP Kurs

chain_gp_mid_ids = [
    1113009623, # Descent to Dunlop
    820679445,  # Dunlop-Kehre Approach
    820330155,  # Dunlop-Kehre (Hairpin Turn 7)
    820330154,  # Audi-S Ascent Approach
    1113009624, # Audi-S (Turn 8 & 9)
    820330153,  # Michael-Schumacher-S
    820330152,  # Michelin-Kurve Approach
    1079809245, # Michelin-Kurve Entry
    1443047845, # Michelin-Kurve (Turn 10)
    1443047844, # Bit-Kurve Entry
    27852990,   # Bit-Kurve & ITT-Bogen
    820679450   # NGK-Schikane (Turns 13 & 14)
]

# Exact GP Start-Ziel line point:
P0_GP_2D = (-1043.71, 3134.76)

# 1. Front straight from node 370477491 (index 30 of w1149) down to Castrol-S
idx_370 = w1149['nodes'].index(370477491)
gp_straight_start = w1149['nodes'][idx_370:]

# 2. Castrol-S up to corner cut start (node 290934238)
idx_cut_start = w1208['nodes'].index(290934238)
nodes_castrol_s = w1208['nodes'][:idx_cut_start + 1]

# 3. Corner cut (Variante 24h-Rennen)
nodes_cut = w_cut['nodes']

# 4. Arena exit rejoining at node 368405665
idx_rejoin = w1208['nodes'].index(368405665)
nodes_arena_exit = w1208['nodes'][idx_rejoin:]

# 5. Ford-Kurve
nodes_ford = w_ford['nodes']

# 6. GP mid ways (Dunlop through NGK-Schikane)
nodes_gp_mid = []
for wid in chain_gp_mid_ids:
    for nid in elements[wid]['nodes']:
        if not nodes_gp_mid or nid != nodes_gp_mid[-1]:
            nodes_gp_mid.append(nid)

# 7. From NGK-Schikane exit along w1149 to node 290934599 (branch to Nordschleife)
idx_599 = w1149['nodes'].index(290934599)
nodes_to_nord_branch = w1149['nodes'][:idx_599 + 1]

# 8. Anbindung zur Nordschleife
nodes_anb_nord = w_to_nord['nodes']

# 9. T13 exit nodes onto Nordschleife
idx_t13_exit = t13['nodes'].index(65385942)
t13_exit_nodes = t13['nodes'][idx_t13_exit:]

# 10. Nordschleife ways around the complete loop
by_start = {}
for w in [e for e in d['elements'] if e['type'] == 'way']:
    by_start.setdefault(w['nodes'][0], []).append(w)

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

# 11. T13 entry nodes to Hohenrain
idx_t13_split = t13['nodes'].index(65385912)
t13_entry_nodes = t13['nodes'][:idx_t13_split + 1]

# 12. Anbindung zum GP-Kurs
nodes_anb_gp = w_to_gp['nodes']

# 13. Rejoin w1149 from node 290934250 (index 28) up to node 290934644 (index 29)
idx_250 = w1149['nodes'].index(290934250)
gp_straight_rejoin = w1149['nodes'][idx_250:idx_370]

# Assemble the 2D coordinates starting at P0_GP_2D
raw_coords = [P0_GP_2D]
seg_markers_24h = [('GP Start-Ziel (Front Straight)', 0)]

def add_chain_part(name, nids):
    if name:
        seg_markers_24h.append((name, len(raw_coords)))
    for nid in nids:
        pt = to_local(*node_coord[nid])
        if pt != raw_coords[-1]:
            raw_coords.append(pt)

add_chain_part('', gp_straight_start)
add_chain_part('Castrol-S (Turn 1)', nodes_castrol_s)
add_chain_part('Variante 24h-Rennen (Corner Cut)', nodes_cut)
add_chain_part('Ford-Kurve Approach', nodes_arena_exit)
add_chain_part('Ford-Kurve (Turn 6)', nodes_ford)

gp_labels = [
    'Descent to Dunlop', 'Dunlop-Kehre Approach', 'Dunlop-Kehre (Hairpin)',
    'Audi-S Ascent Approach', 'Audi-S', 'Michael-Schumacher-S',
    'Michelin-Kurve Approach', 'Michelin-Kurve Entry', 'Michelin-Kurve',
    'Bit-Kurve Entry', 'Bit-Kurve & ITT-Bogen', 'NGK-Schikane'
]
for wid, label in zip(chain_gp_mid_ids, gp_labels):
    add_chain_part(label, elements[wid]['nodes'])

add_chain_part('GP Straight curve', nodes_to_nord_branch)
add_chain_part('Anbindung zur Nordschleife', nodes_anb_nord)
add_chain_part('T13 Nord-Spur', t13_exit_nodes)

nord_landmark_names = [
    'Hatzenbach', 'Hocheichen', 'Quiddelbacher Höhe', 'Flugplatz', 'Schwedenkreuz',
    'Aremberg', 'Fuchsröhre', 'Adenauer Forst', 'Metzgesfeld', 'Kallenhard',
    'Wehrseifen', 'Breidscheid', 'Ex-Mühle', 'Bergwerk', 'Kesselchen',
    'Klostertal', 'Steilstrecke', 'Caracciola-Karussell', 'Hohe Acht', 'Hedwigshöhe',
    'Wippermann', 'Eschbach', 'Brünnchen', 'Eiskurve', 'Pflanzgarten',
    'Sprunghügel', 'Schwalbenschwanz', 'Kleines Karussell', 'Galgenkopf', 'Döttinger Höhe',
    'Antoniusbuche', 'Tiergarten', 'Hohenrain'
]
for i, w in enumerate(nord_ways):
    tag_name = w.get('tags', {}).get('name', '')
    name = tag_name if tag_name else (nord_landmark_names[i] if i < len(nord_landmark_names) else '')
    add_chain_part(name, w['nodes'])

add_chain_part('Hohenrain / T13', t13_entry_nodes)
add_chain_part('Anbindung zum GP-Kurs', nodes_anb_gp)
add_chain_part('GP-Ziel-Gerade Rejoin', gp_straight_rejoin)

# Close cleanly at P0_GP_2D
if raw_coords[-1] != P0_GP_2D:
    raw_coords.append(P0_GP_2D)

print(f'Total coordinates in 24h chain: {len(raw_coords)}')
pts_24h = resample_polyline(raw_coords, 5.0)
N_24h = len(pts_24h)
total_24h_m = N_24h * 5.0
print(f'Resampled 24h circuit: {N_24h} points, {total_24h_m:.1f} m ({total_24h_m/1000:.3f} km)')
print(f'Point 0: {pts_24h[0]} (Matches GP Start-Ziel: {pts_24h[0] == P0_GP_2D})')

cum_24h = [0.0]
for i in range(1, len(raw_coords)):
    cum_24h.append(cum_24h[-1] + math.hypot(raw_coords[i][0] - raw_coords[i-1][0], raw_coords[i][1] - raw_coords[i-1][1]))
scale_24h = total_24h_m / cum_24h[-1]

clean_segs_24h = []
for name, idx in seg_markers_24h:
    if name:
        s_val = round(cum_24h[idx] * scale_24h, 1)
        if not clean_segs_24h or clean_segs_24h[-1]['name'] != name:
            clean_segs_24h.append({'name': name, 's': s_val})

# Load surveyed GP and Nordschleife datasets for direct elevation inheritance
gp_data = json.load(open('tracks/gp/osm_gp.json'))
nord_data = json.load(open('tracks/nordschleife/osm_nordschleife.json'))

gp_grid = {}
for p in gp_data['points']:
    cx, cz = int(p[0] // 50.0), int(p[2] // 50.0)
    gp_grid.setdefault((cx, cz), []).append(p)

def query_gp(x, z):
    cx, cz = int(x // 50.0), int(z // 50.0)
    min_d = 99999.0
    best_y = None
    for dcx in (-1, 0, 1):
        for dcz in (-1, 0, 1):
            for cp in gp_grid.get((cx + dcx, cz + dcz), []):
                d = math.hypot(x - cp[0], z - cp[2])
                if d < min_d:
                    min_d = d
                    best_y = cp[1]
    return best_y, min_d

nord_grid = {}
for p in nord_data['points']:
    cx, cz = int(p[0] // 50.0), int(p[2] // 50.0)
    nord_grid.setdefault((cx, cz), []).append(p)

def query_nord(x, z):
    cx, cz = int(x // 50.0), int(z // 50.0)
    min_d = 99999.0
    best_y = None
    for dcx in (-1, 0, 1):
        for dcz in (-1, 0, 1):
            for cp in nord_grid.get((cx + dcx, cz + dcz), []):
                d = math.hypot(x - cp[0], z - cp[2])
                if d < min_d:
                    min_d = d
                    best_y = cp[1]
    return best_y, min_d

raw_ys = [None] * N_24h

for i, p in enumerate(pts_24h):
    in_gp_zone = p[1] > 2500 and p[0] < -700
    if in_gp_zone:
        ygp, dgp = query_gp(p[0], p[1])
        if dgp <= 6.0:
            raw_ys[i] = ygp
            continue
    ynord, dnord = query_nord(p[0], p[1])
    if dnord <= 6.0:
        raw_ys[i] = ynord
        continue
    ygp, dgp = query_gp(p[0], p[1])
    if dgp <= 6.0:
        raw_ys[i] = ygp

# Smooth cosine interpolation for transition points
for i in range(N_24h):
    if raw_ys[i] is None:
        prev_idx = (i - 1) % N_24h
        while raw_ys[prev_idx] is None:
            prev_idx = (prev_idx - 1) % N_24h
        next_idx = (i + 1) % N_24h
        while raw_ys[next_idx] is None:
            next_idx = (next_idx + 1) % N_24h
        dist_total = (next_idx - prev_idx) % N_24h
        dist_curr = (i - prev_idx) % N_24h
        t = dist_curr / dist_total
        blend = 0.5 * (1.0 - math.cos(t * math.pi))
        raw_ys[i] = raw_ys[prev_idx] + (raw_ys[next_idx] - raw_ys[prev_idx]) * blend

def smooth(vals, sigma=3):
    n = len(vals)
    r = int(sigma * 3)
    w = [math.exp(-0.5 * (k / sigma) ** 2) for k in range(-r, r + 1)]
    ws = sum(w)
    nw = [x / ws for x in w]
    out = []
    for i in range(n):
        s = sum(vals[(i + k) % n] * nw[idx] for idx, k in enumerate(range(-r, r + 1)))
        out.append(s)
    return out

smooth_ys = smooth(raw_ys, sigma=3)
print(f'24h Elevation: min={min(smooth_ys):.2f}m, max={max(smooth_ys):.2f}m, drop={max(smooth_ys)-min(smooth_ys):.2f}m')

data_24h = {
    'name': 'Nürburgring 24h Layout',
    'step': 5.0,
    'total': total_24h_m,
    'points': [[round(pts_24h[i][0], 2), round(smooth_ys[i], 3), round(pts_24h[i][1], 2)] for i in range(N_24h)],
    'segments': clean_segs_24h,
    'origin': {'lat': lat0, 'lon': lon0}
}
json.dump(data_24h, open('tracks/24h/osm_24h.json', 'w'), indent=2)
print('✅ Saved tracks/24h/osm_24h.json')

# ========================================================
# 2. SCULPT DEM TERRAIN FOR ZERO ROAD NOCLIPPING / SPILLING
# ========================================================
print('\n⛰️ 2. Sculpting dem.json terrain across GP Stadium Bowl and all circuit corridors...')
all_circuit_points = nord_data['points'] + data_24h['points'] + gp_data['points']

x0, z0, step, nx, nz, h = dem['x0'], dem['z0'], dem['step'], dem['nx'], dem['nz'], list(dem['h'])

# Spatial hash grid of all circuit points
cell_size = 75.0
grid = {}
for p in all_circuit_points:
    cx = int(p[0] // cell_size)
    cz = int(p[2] // cell_size)
    grid.setdefault((cx, cz), []).append(p)

STADIUM_X_MIN = -2250.0
STADIUM_X_MAX = -750.0
STADIUM_Z_MIN = 2700.0
STADIUM_Z_MAX = 4650.0

sculpted_count = 0
stadium_sculpted = 0

for iz in range(nz):
    vz = z0 + iz * step
    cz = int(vz // cell_size)
    for ix in range(nx):
        vx = x0 + ix * step
        cx = int(vx // cell_size)
        v_idx = iz * nx + ix
        current_y = h[v_idx]

        min_dist = 99999.0
        nearest_track_y = current_y

        for dcx in (-2, -1, 0, 1, 2):
            for dcz in (-2, -1, 0, 1, 2):
                candidates = grid.get((cx + dcx, cz + dcz), [])
                for cp in candidates:
                    d_sq = (vx - cp[0]) ** 2 + (vz - cp[2]) ** 2
                    if d_sq < min_dist * min_dist:
                        min_dist = math.sqrt(d_sq)
                        nearest_track_y = cp[1]

        in_stadium = (STADIUM_X_MIN <= vx <= STADIUM_X_MAX) and (STADIUM_Z_MIN <= vz <= STADIUM_Z_MAX)

        if in_stadium and min_dist <= 250.0:
            max_stadium_y = nearest_track_y - 4.5
            if current_y > max_stadium_y:
                h[v_idx] = max_stadium_y
                sculpted_count += 1
                stadium_sculpted += 1
            continue

        CORRIDOR_INNER = 65.0
        CORRIDOR_OUTER = 110.0
        SAFE_DROP = 4.5

        if min_dist <= CORRIDOR_INNER:
            max_allowed = nearest_track_y - SAFE_DROP
            if current_y > max_allowed:
                h[v_idx] = max_allowed
                sculpted_count += 1
        elif min_dist < CORRIDOR_OUTER:
            envelope = (min_dist - CORRIDOR_INNER) / (CORRIDOR_OUTER - CORRIDOR_INNER)
            envelope_blend = 0.5 * (1.0 - math.cos(envelope * math.pi))
            max_allowed = nearest_track_y - SAFE_DROP + envelope_blend * 18.0
            if current_y > max_allowed:
                h[v_idx] = max_allowed
                sculpted_count += 1

dem['h'] = [round(val, 2) for val in h]
json.dump(dem, open(DEM_PATH, 'w'), indent=2)
print(f'   ✅ Sculpted {sculpted_count} DEM vertices (including {stadium_sculpted} in GP stadium bowl).')
print(f'   Saved updated {DEM_PATH}')

# ========================================================
# 3. VERIFICATION CHECK: ZERO NOCLIPPING ON ANY CIRCUIT
# ========================================================
print('\n🔍 3. Verifying zero terrain spilling / noclipping across all 3 circuits...')

def get_h(x, z):
    gx = (x - x0) / step
    gz = (z - z0) / step
    if gx < 0 or gx >= nx - 1 or gz < 0 or gz >= nz - 1:
        return 600.0
    ix = int(gx)
    iz = int(gz)
    fx = gx - ix
    fz = gz - iz
    h00 = h[iz * nx + ix]
    h10 = h[iz * nx + ix + 1]
    h01 = h[(iz + 1) * nx + ix]
    h11 = h[(iz + 1) * nx + ix + 1]
    return (1 - fx) * (1 - fz) * h00 + fx * (1 - fz) * h10 + (1 - fx) * fz * h01 + fx * fz * h11

for track_name, track_path in [
    ('Nordschleife', 'tracks/nordschleife/osm_nordschleife.json'),
    ('24h Layout', 'tracks/24h/osm_24h.json'),
    ('GP-Strecke', 'tracks/gp/osm_gp.json')
]:
    tdata = json.load(open(track_path))
    pts = tdata['points']
    spills = 0
    max_terrain_relative = -999.0
    for p in pts:
        th = get_h(p[0], p[2])
        diff = th - p[1]
        if diff > max_terrain_relative:
            max_terrain_relative = diff
        if diff >= -0.2:
            spills += 1
    print(f'   {track_name} ({len(pts)} pts): Spills={spills}, Max terrain relative to road = {max_terrain_relative:.2f} m')
    assert spills == 0, f'SPILL FAILURE on {track_name}: {spills} points violate clearance!'

print('\n🎉 ALL CIRCUITS 100% CLEAR! ZERO TERRAIN SPILLING CONFIRMED!')
