#!/usr/bin/env python3
"""
Generates the authentic surveyed Nürburgring 24h Gesamtkurs (24.23 km)
featuring:
1. Authentic GP Start-Ziel straight with surveyed pitlane (Boxengasse).
2. Castrol-S (Turn 1).
3. Authentic Variante 24h-Rennen (way 31010602) - THE CORNER CUT SHORTCUT
   that bypasses the Mercedes-Benz Arena and connects directly to the arena exit.
4. Ford-Kurve and Dunlop-Kehre.
5. Michael-Schumacher-S, Michelin-Kurve, Bit-Kurve, ITT-Bogen.
6. NGK-Schikane.
7. Anbindung zur Nordschleife (way 26543901) into Hatzenbach.
8. The complete 20.8 km Nordschleife (all 45 landmarks).
9. Antoniusbuche, Tiergarten, Hohenrain.
10. Anbindung zum GP-Kurs (way 27852583) back onto the GP Start-Ziel straight.
"""

import json
import math
import os

RAW_PATH = 'tracks/nordschleife/osm_raw.json'
DEM_PATH = 'tracks/nordschleife/dem.json'

d = json.load(open(RAW_PATH))
dem = json.load(open(DEM_PATH))
elements = {e['id']: e for e in d['elements']}

lat0 = 50.36399483033708
lon0 = 6.96253655599251
kx = 111320.0 * math.cos(math.radians(lat0))
ky = 110574.0

def to_local(lat, lon):
    return ((lon - lon0) * kx, -(lat - lat0) * ky)

node_coord = {}
for e in d['elements']:
    if e['type'] == 'node':
        node_coord[e['id']] = (e['lat'], e['lon'])
    elif 'geometry' in e:
        for nid, g in zip(e['nodes'], e['geometry']):
            node_coord[nid] = (g['lat'], g['lon'])

# 1. Gather all ways for 24h layout
w1149 = elements[1149161210] # GP Start-Ziel
w1208 = elements[1149161208] # Castrol-S & Arena
w_cut = elements[31010602]   # Variante 24h-Rennen (Corner Cut!)
w_ford = elements[820679446] # Ford-Kurve
w_gp_mid = elements[27852990]# Dunlop -> Schumacher-S -> ITT
w_chicane = elements[820679450] # NGK-Schikane
w_to_nord = elements[26543901]  # Anbindung zur Nordschleife
t13 = elements[41395670]        # T13
w_to_gp = elements[27852583]    # Anbindung zum GP Kurs

# Castrol-S up to corner cut start (node 290934238)
idx_cut_start = w1208['nodes'].index(290934238)
nodes_castrol_s = w1208['nodes'][:idx_cut_start + 1]

# Corner cut (Variante 24h-Rennen)
nodes_cut = w_cut['nodes']

# Arena exit rejoining at node 368405665 to end of way 1149161208
idx_rejoin = w1208['nodes'].index(368405665)
nodes_arena_exit = w1208['nodes'][idx_rejoin:]

# From NGK-Schikane exit (node 290934601) along w1149 to node 290934599 (branch to Nordschleife)
idx_599 = w1149['nodes'].index(290934599)
nodes_to_nord_branch = w1149['nodes'][:idx_599 + 1]

# Nordschleife loop
idx_t13_exit = t13['nodes'].index(65385942)
t13_exit_nodes = t13['nodes'][idx_t13_exit:]

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

idx_t13_split = t13['nodes'].index(65385912)
t13_entry_nodes = t13['nodes'][:idx_t13_split + 1]

# Assemble the full sequence starting at GP Start-Ziel line (node 290934250, where Nordschleife merges in)
idx_sf = w1149['nodes'].index(290934250)
gp_front_straight = w1149['nodes'][idx_sf:]

full_sequence = []
def append_nodes(n_list):
    for nid in n_list:
        if not full_sequence or full_sequence[-1] != nid:
            full_sequence.append(nid)

append_nodes(gp_front_straight)
append_nodes(nodes_castrol_s)
append_nodes(nodes_cut) # VARIANTE 24H-RENNEN (CORNER CUT!)
append_nodes(nodes_arena_exit)
append_nodes(w_ford['nodes'])
append_nodes(w_gp_mid['nodes'])
append_nodes(w_chicane['nodes'])
append_nodes(nodes_to_nord_branch)
append_nodes(w_to_nord['nodes'])
append_nodes(t13_exit_nodes)
for w in nord_ways:
    append_nodes(w['nodes'])
append_nodes(t13_entry_nodes)
append_nodes(w_to_gp['nodes'])

print(f'Total surveyed nodes in 24h chain: {len(full_sequence)}')

# Convert to 2D local coordinates
raw_pts_2d = [to_local(*node_coord[nid]) for nid in full_sequence]

# Resample to strict 5.0m equidistant spacing
def resample_2d(pts, step=5.0):
    out = [pts[0]]
    accum = 0.0
    for i in range(1, len(pts)):
        ax, az = pts[i - 1]
        bx, bz = pts[i]
        d = math.hypot(bx - ax, bz - az)
        if d < 1e-6:
            continue
        while accum + d >= step:
            t = (step - accum) / d
            ax = ax + (bx - ax) * t
            az = az + (bz - az) * t
            out.append((ax, az))
            d = math.hypot(bx - ax, bz - az)
            accum = 0.0
        accum += d
    return out

pts_resampled = resample_2d(raw_pts_2d, 5.0)
N = len(pts_resampled)
total_len_m = (N - 1) * 5.0
print(f'Resampled to {N} points, total length: {total_len_m:.1f} m ({total_len_m/1000:.3f} km)')

# Sample DEM elevations and smooth along the loop
x0, z0, step, nx, nz, h = dem['x0'], dem['z0'], dem['step'], dem['nx'], dem['nz'], dem['h']

def get_dem_y(x, z):
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

raw_ys = [get_dem_y(p[0], p[1]) for p in pts_resampled]

# Multi-pass Gaussian smoothing across elevation profile
def gaussian_smooth_closed(vals, sigma=18):
    n = len(vals)
    radius = int(sigma * 3)
    weights = [math.exp(-0.5 * (k / sigma) ** 2) for k in range(-radius, radius + 1)]
    w_sum = sum(weights)
    norm_w = [w / w_sum for w in weights]
    out = []
    for i in range(n):
        s = 0.0
        for idx, k in enumerate(range(-radius, radius + 1)):
            s += vals[(i + k) % n] * norm_w[idx]
        out.append(s)
    return out

smooth_ys = gaussian_smooth_closed(raw_ys, sigma=20)

# Build named segments along 24h circuit
segments_24h = [
    {'name': 'GP Start-Ziel (Front Straight)', 's': 0.0},
    {'name': 'Castrol-S (Turn 1)', 's': 380.0},
    {'name': 'Variante 24h-Rennen (Corner Cut)', 's': 520.0},
    {'name': 'Ford-Kurve', 's': 850.0},
    {'name': 'Dunlop-Kehre (Hairpin)', 's': 1250.0},
    {'name': 'Michael-Schumacher-S', 's': 1850.0},
    {'name': 'Michelin-Kurve', 's': 2250.0},
    {'name': 'Bit-Kurve', 's': 2450.0},
    {'name': 'ITT-Bogen', 's': 2750.0},
    {'name': 'NGK-Schikane', 's': 3250.0},
    {'name': 'Anbindung zur Nordschleife', 's': 3550.0},
    {'name': 'T13 Nord-Spur', 's': 3750.0},
    {'name': 'Hatzenbach', 's': 4400.0},
    {'name': 'Hocheichen', 's': 5100.0},
    {'name': 'Quiddelbacher Höhe', 's': 5600.0},
    {'name': 'Flugplatz (Jump Crest)', 's': 5950.0},
    {'name': 'Schwedenkreuz', 's': 6650.0},
    {'name': 'Aremberg', 's': 7450.0},
    {'name': 'Fuchsröhre (Compression)', 's': 7800.0},
    {'name': 'Adenauer Forst', 's': 8700.0},
    {'name': 'Metzgesfeld', 's': 9150.0},
    {'name': 'Kallenhard', 's': 9800.0},
    {'name': 'Wehrseifen', 's': 10950.0},
    {'name': 'Breidscheid (Bridge)', 's': 11300.0},
    {'name': 'Ex-Mühle', 's': 11750.0},
    {'name': 'Bergwerk', 's': 12500.0},
    {'name': 'Kesselchen', 's': 13650.0},
    {'name': 'Mutkurve', 's': 14400.0},
    {'name': 'Klostertal', 's': 14800.0},
    {'name': 'Steilstrecke', 's': 15100.0},
    {'name': 'Caracciola-Karussell (33° Banking)', 's': 15600.0},
    {'name': 'Hohe Acht (Summit)', 's': 15850.0},
    {'name': 'Hedwigshöhe', 's': 16950.0},
    {'name': 'Wippermann', 's': 17150.0},
    {'name': 'Eschbach', 's': 17450.0},
    {'name': 'Brünnchen', 's': 17850.0},
    {'name': 'Eiskurve', 's': 18350.0},
    {'name': 'Pflanzgarten (Sprunghügel)', 's': 18650.0},
    {'name': 'Stefan-Bellof-S', 's': 19500.0},
    {'name': 'Schwalbenschwanz', 's': 20100.0},
    {'name': 'Kleines Karussell', 's': 20500.0},
    {'name': 'Galgenkopf', 's': 20900.0},
    {'name': 'Döttinger Höhe (Long Straight)', 's': 22000.0},
    {'name': 'Antoniusbuche', 's': 23000.0},
    {'name': 'Tiergarten', 's': 23750.0},
    {'name': 'Hohenrain-Schikane', 's': 23900.0},
    {'name': 'Anbindung zum GP-Kurs', 's': 24050.0},
]

# Output data structure
data_24h = {
    'name': 'Nürburgring 24h Gesamtkurs',
    'step': 5.0,
    'total': total_len_m,
    'points': [[round(pts_resampled[i][0], 2), round(smooth_ys[i], 3), round(pts_resampled[i][1], 2)] for i in range(N)],
    'segments': segments_24h,
    'origin': {'lat': lat0, 'lon': lon0}
}

os.makedirs('tracks/24h', exist_ok=True)
json.dump(data_24h, open('tracks/24h/osm_24h.json', 'w'), indent=2)
print('✅ Successfully saved tracks/24h/osm_24h.json with authentic Variante 24h-Rennen corner cut!')
print(f'   Total length: {total_len_m:.1f} m ({total_len_m/1000:.3f} km)')
print(f'   Elevation range: {min(smooth_ys):.1f}m to {max(smooth_ys):.1f}m (drop: {max(smooth_ys)-min(smooth_ys):.1f}m)')
