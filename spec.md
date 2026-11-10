# Full of Water: Engineering Specification Sheet

Companion to [idea.md](idea.md) (Design Doc) and [implementation.md](implementation.md) (Implementation Roadmap).

---

## Executive Summary & System Overview

Full of Water decouples the user interface across two physical devices:
1. **Host Display (MacBook Pro / External Monitor):** Runs Three.js WebGL2/WebGPU rendering, Rapier 3D 240 Hz vehicle physics, sound synthesis, and the track streaming engine.
2. **Mobile Controller (iPhone / iPad):** Runs in Safari via local HTTPS (`mkcert`) and WebSocket, serving as the steering column (in-plane gravity sensing), throttle/brake pedals (split-screen touch), and digital instrument cluster.

### Phase Status Overview
- **Phase 1 (Proof of Concept - High-Speed Proving Ground):** Complete and validated. Proves vehicle physics, 6-speed sequential gearing, ABS/TC assists, top speed ($300+\text{ km/h}$), and low-latency mobile control.
- **Phase 2 (Dedicated Nürburgring Nordschleife):** Complete and validated. Proves 20,832m centerline spline, 11-chunk partition system with 100m collision overlaps, dynamic 3-chunk window streamer, floating origin, and lap timing.
- **Phase 3 (Advanced Motorsport Systems):** Paused. Foundational telemetry (9-sector timing, local ghost recording) retained; pit lane removal reversed and merged into Phase 5 simulation realism.
- **Phase 4 (Private Multiplayer, Start Procedures & Track Recovery):** Paused per user direction to prioritize simulation realism. Moved to Phase 6.
- **Phase 5 (Nürburgring & Simulation Realism - Assetto Corsa Competizione Level):** Complete and validated. Elevates the circuit and vehicle to authentic sim-racing benchmarks: surveyed elevation profile with 301.6m vertical drop, 1,379 trees/chunk dense multi-tier Eifel forest, FIA catch fencing, red/white tire barriers, overhead sponsor bridges, anti-noclip CCD volumetric guardrails, dedicated drivable pit lane with 60 km/h speed limiter & 10 team stalls, radar ghost retention / fake dot cleanup, slip-energy tyre wear, fuel mass burn, 3-zone brake thermal efficiency curves, diffuse realistic rear lighting, 24-hour day/night cycle, 88% VOR anti-nausea horizon lock cockpit camera, smooth C2 spline with multi-band bump dynamics, headphone-safe transmission whine DSP, and track/car creation engineering documentation (`docs/skills.md`).
- **Phase 6 (Private Multiplayer & Dynamic Race Procedures):** Paused (formerly Phase 4). 4-digit code private lobbies, universal FIA 5-red-light standing starts, and near-crash track recovery.
- **Phase 7 (Multi-Class Motorsport Ecosystem & Dynamic Series):** Scheduled roadmap (formerly Phase 5). Multi-class vehicle homologation, international circuits, and dynamic series championship menu hub.

### Roman Numeral Track (Online Cloud Infrastructure & Community Competition)
- **Phase I (Driver Identity, Cloud Persistence & Global Hotlap Leaderboards):** Complete and validated. Introduces Driver Accounts, automated pairing between Desktop Host and Phone Controller via 6-digit session tokens, serverless player stats database (lifetime km driven, favorite car, clean lap ratio, top speeds, airborne flight time), and multi-dimensional hotlap leaderboards (by circuit, car category, weather, input device) with monotonic sector validation and World Record 30 Hz ghost retrieval.
- **Phase II-A (Emergency 3-Player Serverless WebRTC Multiplayer & Jitter-Free Interpolation):** Ready for execution. Implements serverless signaling on Vercel (`/api/signal/*`), direct phone-to-desktop WebRTC DataChannel pairing, 56-byte telemetry with linear velocity vectors `[vx, vy, vz]`, 100ms snapshot buffer with Hermite cubic spline trajectory interpolation and velocity dead reckoning, pure invariant Ghost Mode (zero contact impulses), and single-circuit session synchronization.
- **Phase II-B (Cloud-Relayed WebRTC Multiplayer):** Serverless WebRTC signaling broker (PartyKit / Cloudflare Durable Objects), public paddock lobby browser, and private room sharing.
- **Phase III (Driver Rating & Safety Rating - Elo/SR):** Skill-based matchmaking (DR: Bronze to Alien) and incident tracking (SR: clean overtakes vs incident points).
- **Phase IV (Cloud Telemetry & MoTeC-Style Analysis):** Cloud storage of complete lap telemetry with in-browser multi-channel trace overlay.
- **Phase V (Cloud Livery Workshop & Social Showcase):** Community custom livery workshop using `StandardWrapMapper` with global publishing and upvoting.

---

# PART I: PHASE 1 SPECIFICATION — PROVING GROUND & SKIDPAD

Phase 1 isolates and validates the core physical loop on a controlled flat environment before introducing track curvature and streaming.

---

### 1.1 Phase 1 Scope & Architecture
- **Environment:** $1,200\text{ m} \times 6,000\text{ m}$ flat proving ground with high-speed straightaway, concentric skidpad circles, and slalom cones.
- **Vehicle:** Porsche 911 RSR-19 (992) GTE specification with 4.2L flat-six powertrain.
- **Core Verification Objective:** Prove acceleration, 6-speed sequential shifting up to $300+\text{ km/h}$, braking with ABS, zero-flip tilt steering, and stable 60–120 FPS rendering on Apple M4 Pro hardware.

---

### 1.2 iPhone Controller & Local Network Protocol

#### Network Transport
- Local Vite HTTPS server (`https://<mac-ip>:5173`) using `mkcert` certificate authority.
- Binary WebSocket connection (`ws://` upgraded over HTTPS).
- Controller transmission frequency: 60 Hz steady stream.
- Host telemetry return frequency: 30–60 Hz.

#### In-Plane Gravity Sensor Pipeline
1. Sample `DeviceMotionEvent.accelerationIncludingGravity`.
2. Extract in-plane gravity components ($g_x, g_y$) based on device landscape orientation:
   - **Landscape-Primary** (USB-C right, $g_x > 2.5$): $\theta = \operatorname{atan2}(g_y, g_x)$.
   - **Landscape-Secondary** (USB-C left, $g_x < -2.5$): $\theta = \operatorname{atan2}(-g_y, -g_x)$.
   - Clockwise rotation yields $+\theta$ (steer right); counter-clockwise yields $-\theta$ (steer left).
3. Measure in-plane gravity magnitude $\sqrt{g_x^2 + g_y^2}$. If $< 0.3g$ (phone held flat), freeze steering to avoid gimbal ambiguity.
4. Pass raw angle through One Euro filter (`minCutoff = 0.8\text{ Hz}`, `beta = 0.015`) to eliminate hand micro-jitter on straights while retaining zero-lag counter-steering.
5. Apply $1.2^\circ$ deadzone and progressive response curve ($|x|^{1.75}$), mapping full steering lock to $\pm 55^\circ$ physical rotation.

#### Touch Zones & Binary Packet Formats
- **Left Screen Area:** Brake pedal. Holding brake when vehicle is stopped shifts into Reverse (`R`) and applies reverse drive torque.
- **Right Screen Area:** Throttle pedal. Pressing throttle while in reverse applies brake and re-engages 1st gear (`1`).
- **Priority:** If both sides are touched simultaneously, brake overrides throttle.

**Controller Packet (Phone $\to$ Mac, 8 bytes binary):**
```
Offset  Type   Description
0       u16    Sequence number (wrapping)
2       i16    Steering input (-32767 to 32767 mapped to -1.0 to 1.0)
4       u8     Throttle (0 or 255)
5       u8     Brake (0 or 255)
6       u8     Buttons bitfield (bit 0: Reset, bit 1: Camera cycle, bit 2: Look Behind)
7       u8     Reserved
```

**Telemetry Packet (Mac $\to$ Phone, 6 bytes binary):**
```
Offset  Type   Description
0       u8     RPM fraction (0 to 255 mapped to 0 to 9250 RPM)
1       i8     Current gear (-1: R, 0: N, 1-6: Gears 1-6)
2       u16    Speed in km/h * 10
4       u8     Flags (bit 0: Shift strobe, bit 1: ABS active, bit 2: TC active)
5       u8     Reserved
```

---

### 1.3 Vehicle Physics Engine (Rapier 3D 240 Hz)

#### Chassis & Raycast Suspension
- Chassis mass $1,242\text{ kg}$, inertia tensor $[1650, 420, 1850]\text{ kg}\cdot\text{m}^2$.
- 4 downward raycasts from suspension mount points.
- Spring-damper force per wheel:
  $$F_{\text{susp}} = k \cdot (\Delta x) + c \cdot v_{\text{susp}}$$
- Anti-roll bar coupling front ($95,000\text{ Nm/rad}$) and rear ($75,000\text{ Nm/rad}$).

#### Tire Model (Pacejka Magic Formula)
- Longitudinal slip ratio $\kappa = \frac{r\omega - v_x}{\max(r\omega, v_x)}$, lateral slip angle $\alpha = -\arctan\left(\frac{v_y}{|v_x|}\right)$.
- Forces:
  $$F_y = \mu_y \cdot F_z \cdot D \sin(C \arctan(B \alpha))$$
  $$F_x = \mu_x \cdot F_z \cdot D \sin(C \arctan(B \kappa))$$
- Slicks lateral grip multiplier $D = 1.75$ rear, $1.55$ front.
- Friction circle clamp: $\sqrt{F_x^2 + F_y^2} \le \mu F_z$.

#### Aerodynamics
- Downforce: $F_{\text{down}} = \frac{1}{2} \rho v^2 (C_l A)$, with $C_l A = 2.85$ ($800\text{ kg}$ downforce at $250\text{ km/h}$). Aero balance: 42% front / 58% rear.
- Drag: $F_{\text{drag}} = \frac{1}{2} \rho v^2 (C_d A)$, with $C_d A = 0.86$.
- DRS flap: reduces drag by $28\%$ and downforce by $35\%$, raising top speed from $298\text{ km/h}$ to $318\text{ km/h}$.

#### Driver Assists
- **Throttle Ramp:** $0 \to 100\%$ in $180\text{ ms}$; falls in $60\text{ ms}$.
- **Brake Ramp:** $0 \to 100\%$ in $120\text{ ms}$; falls in $50\text{ ms}$.
- **Traction Control (TC):** Clamps drive torque when rear slip ratio $\kappa > 0.15$.
- **Anti-lock Braking (ABS):** Modulates brake pressure to prevent lockup.
- **Speed-Sensitive Steering:** $22^\circ$ max angle below $18\text{ km/h}$; scales down to $35\%$ ($7.7^\circ$) at $250\text{ km/h}$.
- **Stability Control (ESP):** Applies corrective counter-yaw torque opposing vehicle slip angle rate.

---

### 1.4 Vehicle Profile: Porsche 992 RSR-19

```json
{
  "$schema": "./car-schema.json",
  "id": "porsche_911_rsr_19_992",
  "name": "Porsche 911 RSR-19 (992)",
  "class": "GTE",
  "specs": {
    "engine": "4.2L Naturally Aspirated Flat-6",
    "powerPS": 515,
    "torqueNm": 470,
    "weightKg": 1242,
    "topSpeedKmh": 298.0,
    "topSpeedDrsKmh": 318.0
  },
  "chassis": {
    "massKg": 1242,
    "cgHeightM": 0.40,
    "frontWeightFraction": 0.43,
    "wheelbaseM": 2.513,
    "trackFrontM": 1.705,
    "trackRearM": 1.670,
    "inertiaTensor": [1650, 420, 1850]
  },
  "suspension": {
    "front": {
      "springNPerM": 125000,
      "bumpNsPerM": 5500,
      "reboundNsPerM": 8500,
      "travelM": 0.095,
      "antiRollNmPerRad": 95000
    },
    "rear": {
      "springNPerM": 145000,
      "bumpNsPerM": 6500,
      "reboundNsPerM": 9500,
      "travelM": 0.095,
      "antiRollNmPerRad": 75000
    }
  },
  "tires": {
    "compound": "slick_medium",
    "front": {
      "radiusM": 0.342,
      "widthM": 0.305,
      "pacejkaLat": { "B": 12.5, "C": 1.85, "D": 1.55, "E": 0.95 },
      "pacejkaLong": { "B": 14.5, "C": 1.65, "D": 1.55, "E": 0.95 }
    },
    "rear": {
      "radiusM": 0.354,
      "widthM": 0.315,
      "pacejkaLat": { "B": 12.5, "C": 1.85, "D": 1.75, "E": 0.95 },
      "pacejkaLong": { "B": 14.5, "C": 1.65, "D": 1.60, "E": 0.95 }
    }
  },
  "steering": {
    "maxWheelAngleDeg": 22.0,
    "maxRateDegPerS": 320.0,
    "highSpeedLockFraction": 0.35,
    "speedSensitivityStartKmh": 18.0
  },
  "engine": {
    "idleRpm": 2000,
    "redlineRpm": 9000,
    "limiterRpm": 9250,
    "inertiaKgM2": 0.11,
    "engineBrakeNm": 85,
    "torqueCurve": [
      [2000, 280],
      [3500, 360],
      [5500, 440],
      [7200, 470],
      [8200, 460],
      [9000, 420],
      [9250, 370]
    ]
  },
  "transmission": {
    "type": "sequential",
    "auto": true,
    "ratios": [3.18, 2.25, 1.78, 1.48, 1.26, 1.10],
    "reverse": 3.40,
    "finalDrive": 3.44,
    "shiftTimeS": 0.045,
    "upshiftRpm": 8800,
    "downshiftRpm": 5400
  },
  "brakes": {
    "maxTorqueNm": 6800,
    "frontBias": 0.57
  },
  "aero": {
    "dragCdA": 0.86,
    "downforceClA": 2.85,
    "aeroBalanceFront": 0.42,
    "drs": {
      "dragReduction": 0.28,
      "downforceReduction": 0.35
    }
  },
  "assists": {
    "tractionControl": 0.65,
    "abs": true,
    "stability": 0.45,
    "counterSteer": 0.30,
    "throttleRampS": 0.18,
    "brakeRampS": 0.12
  }
}
```

---

### 1.5 Cockpit Camera & Visual Stage
- **Camera Position:** Driver eye point at $[0.35, 0.76, -0.28]\text{ m}$ relative to car center (left bucket seat).
- **Field of View:** $82^\circ$ vertical ($\approx 115^\circ$ horizontal @ 16:9).
- **Dynamic Movement:** Pitch on acceleration/braking; roll opposing chassis lateral acceleration; zero jitter when stationary ($v < 1\text{ km/h}$).
- **Interior Geometry:** Roll-cage A-pillars, carbon butterfly yoke with 15 rev LEDs and LCD, rotating steering column, and dynamic rear-view mirror ($512 \times 256$ render target).

### 1.5.1 Authentic Porsche 911 RSR-19 (GTE) Specification & Standardized Wrap Pipeline
- **Vehicle Specification & Homologation:** Calibrated to authentic Porsche 911 RSR-19 (GTE endurance class): mid-rear 4.2L naturally aspirated flat-six producing 515 HP @ 9,000 RPM, 3.1s 0–100 km/h, 318 km/h top speed with low-drag DRS aero trim, and high-downforce GTE swan-neck wing balance.
- **Model Geometry & Asset Format:** High-fidelity glTF 2.0 binary (`model.glb`, 2.22 MB) with Google Draco geometry compression and WebP textures, loaded via `DRACOLoader` Web Workers.
- **Factory Aerodynamic Package:** Integrated factory swan-neck active DRS rear wing (`Wing_Flap_Active`, `Wing_Endplates`) mounted solidly to the rear engine deck lid with zero floating gap, dual hood carbon nostrils, roof aero vanes, front splitter, and widebody wheel arch louvers.
- **Concentric Wheel Hub Mounting:** Surveyed glTF wheel hub centers ($X = \pm 0.7701\text{ m}, Y = 0.5190\text{ m}, Z_{\text{front}} = +1.1688\text{ m}, Z_{\text{rear}} = -1.2867\text{ m}$) align wheel assemblies concentrically within the bodywork wheel arches, sitting flush with the outer fender lips and resting squarely on the turntable surface ($Y = 0.185\text{ m}$) and track tarmac.
- **Universal License Plate Eradication:** `VehicleModelAdapter.sanitizeModel` automatically strips all civilian street license plates and bracket meshes (`Licence_Plate_Emissive`, `License_Plate_Glass`, `*plate*`, `*license*`, `*tag*`) across all imported vehicle models.
- **Dynamic 4-Wheel Assembly:** Separated into 4 independent wheel hierarchies (`steerGroup` and `spinGroup`). Centerlock racing rims, ventilated brake discs, and Michelin Cup 2 R tires spin around local axles with physical angular velocity ($\omega \cdot dt$), while brake calipers remain fixed to the steering hub.
- **Standardized Flat Wrap UV Pipeline (`StandardWrapMapper`):** Analytical 1:1 UV unwrapping pipeline that iterates over all exterior bodywork meshes (`Chassis_Paint`, `Door_Paint_L`, `Door_Paint_R`, `Hood_Paint`, aero parts) and projects normalized coordinates into designated 2D profile zones:
  - **Left Profile ($n_x < -0.30$):** $U \in [0.03, 0.97]$ (tail $\to$ nose), $V \in [0.05, 0.43]$
  - **Right Profile ($n_x > +0.30$):** $U \in [0.03, 0.97]$ (nose $\to$ tail via $1 - \text{normZ}$ inversion), $V \in [0.48, 0.86]$
  - **Top Plan View ($n_y \ge 0.28$):** $U \in [0.05, 0.55]$, $V \in [0.86, 0.99]$
  - **Front Bumper / Nose ($z \ge 1.68\text{ m}, y < 0.75\text{ m}$):** $U \in [0.60, 0.95]$, $V \in [0.86, 0.99]$ (panoramic front wrap prioritized ahead of lateral normals, ensuring seamless wrap across dive planes and wheel arches).
  This layout standardizes liveries so any single 2D flat wrap image wraps cleanly around the car with zero distortion and un-mirrored left-to-right text readability.
- **AO Racing "Rexy" Dinosaur Livery & Competition Roster:** High-resolution $2048 \times 2048$ PBR canvas generator featuring the official AO Racing GT3 R / RSR "Rexy" livery (`rexy_ao_racing_77`): vibrant dinosaur emerald green (`#12c949`), 24 curved upper razor fangs and 18 interlocking lower fangs along the visible front bumper chin lip, giant sabre fangs under headlights, sneering mouth corners with cheek snarl folds, flared reptilian hood nostrils with dark green brow ridges, endurance yellow headlights (`#fbbf24`, emissive intensity 2.4), official IMSA WeatherTech rectangular number plates (#80 default) on doors and hood, little T-Rex claw arms with 3 white talons reaching forward around door handles, and 18 cream/ivory scalloped belly scutes along rocker sills. Full roster also includes Manthey Grello (#911), Martini Racing (#77), Rothmans (#1), Pink Pig (#92), Gulf Racing (#20), Weissach (#93), and Stealth (#00).
- **Dynamic Player-Selected Competition Car Number Picker:** Interactive `#custom-car-number-input` (#0–#999) with a symmetrical 4×2 grid of quick selection pills (#80, #911, #77, #1, #92, #20, #93, #00) that dynamically re-renders competition roundels and IMSA plates on both doors and the hood in real time in Showroom and carries through to the live Race Session. Defaulted to `#80` for Rexy.
- **Minimalist Luxury Motorsport Showroom UI (`MainMenu` & `ShowroomStage`):** Obsidian carbon glass panels (`backdrop-filter: blur(24px) saturate(140%)`), side-docked left column layout (`width: min(460px, 36vw)`) for Landing Portal and 5-Step Sim Setup Wizard, optical camera frustum offset (`camera.setViewOffset`) positioning the 3D Porsche 911 RSR-19 turntable symmetrically in the open right viewport, single-line circuit selector cards (`KM · TURNS`) with Guards Red active bar and zero verbose description paragraphs, 4-column hairline telemetry strip (`515 HP`, `9,000`, `318 KM/H`, `1,245 KG`), non-clipping 4×2 livery swatch grid, unobstructed 360° interactive turntable viewport with drag-to-rotate and scroll-to-zoom controls, 128-segment brushed platinum turntable chamfer ring (`0xe4e4e7`, `opacity: 0.16`), and neutral silver studio rim lighting.

---

### 1.6 Surface Materials & Contact Dynamics
- **Asphalt:** Primary racing surface ($\mu = 1.0$, $c_{\text{roll}} = 0.015$).
- **Concrete / Kerbs:** Rumble strips ($\mu = 0.90$, $c_{\text{roll}} = 0.020$) with suspension excitation.
- **Grass:** Off-track verges ($\mu = 0.35$, $c_{\text{roll}} = 0.040$).
- **Gravel:** Runoff beds ($\mu = 0.45$, $c_{\text{roll}} = 0.280$) providing rapid deceleration.
- **Split-$\mu$ Dynamics:** Dipping two wheels into grass while two remain on asphalt produces an authentic physical yaw moment:
  $$\tau_{\text{yaw}} = (F_{x,\text{asphalt}} - F_{x,\text{grass}}) \times \frac{w_{\text{track}}}{2}$$

---

### 1.7 Braking System & Mechanical Caliper Model
- Max clamping torque: $6,800\text{ Nm}$ total car ($3,876\text{ Nm}$ front, $2,924\text{ Nm}$ rear).
- Stopping performance:
  - $300 \to 0\text{ km/h}$: $5.89\text{ s}$ ($\approx 223\text{ m}$, avg $1.44\text{ G}$)
  - $200 \to 0\text{ km/h}$: $3.78\text{ s}$ ($\approx 103\text{ m}$, avg $1.50\text{ G}$)
  - $100 \to 0\text{ km/h}$: $2.18\text{ s}$ ($\approx 29.3\text{ m}$, avg $1.30\text{ G}$)
- Caliper clamping prevents unphysical instant stops. Direct mechanical pad clamping below $4.3\text{ km/h}$ resolves the low-speed Pacejka singularity.

---

### 1.8 Motorsport Audio Engine & Sound Synthesis
- **Cockpit Sound:** Zero wind noise; dominated by straight-cut spur gear mesh whine ($1,060\text{ Hz} \to 4,500\text{ Hz}$), differential whine ($11.2\text{ Hz} \times \text{km/h}$), flat-six induction roar, and overrun gear backlash.
- **Combustion Fundamental:** $f_0 = \frac{\text{RPM} \times 3}{60}\text{ Hz}$ ($100\text{ Hz}$ idle $\to 450\text{ Hz}$ redline) with sub-bass body oscillator ($f_0 / 2$).
- **Shifting Sound:** Procedural dog-ring clash ($2,400 \to 420\text{ Hz}$) + driveline thump + pneumatic solenoid exhaust hiss.

---

### 1.9 Phase 1 Environment: Proving Ground & Runway Spec
- **Dimensions:** $1,200\text{ m} \times 6,000\text{ m}$ (1.2 km wide $\times$ 6.0 km long flat plane).
- **Sprint Runway:** $5,500\text{ m}$ marked straightaway ($36\text{ m}$ wide, 4 lanes).
- **Distance Markings:** Overhead truss gantries every $500\text{ m}$, trackside boards every $100\text{ m}$, centerline dashes every $10\text{ m}$.
- **Skidpad Circles:** Concentric circles at $40\text{ m}$, $80\text{ m}$, and $160\text{ m}$ radius.
- **Slalom:** Cones spaced $40\text{ m}$ apart.
- **Perimeter:** Solid Armco collision barrier at boundaries.

---

### 1.10 Phase 1 Verification & Validation Gate
- Tested via `npm test` (`scripts/test-phase1.ts`).
- **Results:** Binary protocol roundtrip verified, One Euro filter verified, Pacejka friction envelope verified, Rapier 240 Hz acceleration/braking/reversing verified, dual-landscape neutral verified.

---

# PART II: PHASE 2 SPECIFICATION — DEDICATED NÜRBURGRING NORDSCHLEIFE

Phase 2 replaces the flat proving ground with the full, topologically verified 20.8 km Nürburgring Nordschleife circuit.

---

### 2.1 Phase 2 Scope & Topographical Architecture
- **Environment:** 20.832 km closed loop partitioned into 11 chunks with continuous terrain elevation and landmark bankings.
- **Vehicle:** Porsche 911 RSR-19 (from Phase 1) driving on the real circuit.
- **Core Verification Objective:** Prove streaming of 11 chunks with $100\text{ m}$ collision overlaps, floating origin coordinate management across a $5\text{ km} \times 7\text{ km}$ footprint, sub-5-microsecond centerline projection, and start/finish lap timing.

---

### 2.2 Circuit Geometry & Topography Profile (Surveyed OSM + SRTM DEM)
- **Authentic Nordschleife:** $20,710\text{ m}$ ($20.71\text{ km}$) closed loop with 4,142 points at $5.0\text{ m}$ spacing.
- **Nürburgring 24h Gesamtkurs:** $24,265\text{ m}$ ($24.26\text{ km}$) closed loop with 4,853 points at $5.0\text{ m}$ spacing.
- **Nürburgring GP-Strecke (Authentic 5.148 km Layout):** $5,105.0\text{ m}$ ($5.105\text{ km}$, 15 turns) closed loop with 1,021 points at $5.0\text{ m}$ spacing and $46.7\text{ m}$ vertical elevation drop (Dunlop-Kehre hairpin lowest point $574.6\text{ m}$ to Start-und-Ziel $621.3\text{ m}$). Extracted from 20 continuous OSM ways with $0.0\text{ m}$ seam error. Features Mercedes-Arena, Ford-Kurve, Dunlop-Kehre, Schumacher-S, ITT-Bogen, and NGK-Schikane. Terrain sculpted to $\ge 4.5\text{ m}$ below asphalt (0 clipping violations).
- **Unified World Metric Origin:** $\text{lat}_0 = 50.3639948$, $\text{lon}_0 = 6.9625366$, with $k_x = 71,061.2\text{ m/deg lon}$ and $k_y = 110,574.0\text{ m/deg lat}$.
- **Elevation Range (Surveyed Official Topographical Benchmarks):**
  - **Highest Point:** $626.8\text{ m}$ above sea level (summit crest at Hohe Acht / Steilstrecke).
  - **Lowest Point:** $320.0\text{ m}$ above sea level (Breidscheid valley river bridge).
  - **Total Vertical Drop:** $306.8\text{ m}$ ($1,007\text{ feet}$) of physical mountain climb and plunge.
  - **Fuchsröhre Roller-Coaster Plunge:** Authentic $11.7\%$ downhill grade descending into the $430\text{ m}$ compression basin.
  - **Surveyed Corner Geometry:** Preserved raw OpenStreetMap surveyed coordinates without corner-cutting spatial smoothing, maintaining authentic tight corner radii: Wehrseifen hairpin ($R = 15.8\text{ m}$), Karussell bowl ($R = 25.5\text{ m}$), Bergwerk ($R = 26.1\text{ m}$), Adenauer Forst ($R = 28.0\text{ m}$), Brünnchen ($R = 29.3\text{ m}$), and Aremberg ($R = 30.4\text{ m}$).

---

### 2.3 Landmark-Specific Cambers & Bankings
- **Caracciola-Karussell ($s \approx 14,853\text{ m} \dots 15,020\text{ m}$):** $33.0^\circ$ peak banking with smooth 60-meter entry and exit cosine ramps (preventing vertical cliff jumps) and concrete slab surface (`concrete` friction and vibration profile).
- **Mini-Karussell ($s \approx 19,641\text{ m}$):** $22.0^\circ$ peak banking with 40-meter entry/exit cosine blend.
- **Fuchsröhre ($s \approx 7,400\text{ m}$):** High-speed vertical compression ($420\text{ m}$ elevation).
- **Flugplatz ($s \approx 5,189\text{ m}$):** High-speed crest launch point ($574\text{ m}$ elevation).
- **Döttinger Höhe ($s \approx 0 \dots 2,100\text{ m}$):** $2.1\text{ km}$ continuous flat-out straight climbing from $560\text{ m}$ to $615\text{ m}$.
- **Cockpit Camera Fixed Eye Anchor:** Camera position is strictly anchored at driver eye position in car space (`this.camera.position.copy(eyeWorld)`), with exact zero world-space position lag, completely preventing the camera from pulling backwards into the chassis as speed increases. Camera up vector tracks local roof normal vector (`this.camera.up.copy(carUp)`), keeping the dashboard and steering wheel strictly horizontal.
- **Critically Damped / Overdamped Suspension:** Upgraded suspension damping to match physical critical damping ($14,000\text{ Ns/m}$ front bump, $16,000\text{ Ns/m}$ front rebound; $16,000\text{ Ns/m}$ rear bump, $18,000\text{ Ns/m}$ rear rebound) with $2.0$ chassis angular damping and $120\text{ kNm/rad}$ anti-roll bars. Absorbs road inputs monotonically with zero pogo rebound.
- **Authentic Inward Bowl Banking & Twist-Free Standard Corners:** Smooth cosine-bell inward banking strictly on Caracciola-Karussell ($33.0^\circ$, half-window $75\text{ m}$) and Kleines Karussell ($22.0^\circ$, half-window $45\text{ m}$) with a consistent inward rotation (`-bankingRad`) around the forward tangent, and $0^\circ$ cross-camber on standard corners to guarantee planar, twist-free road quads without per-sample `turnRate` sign flips.
- **8-Pass Taubin Zero-Shrinkage Curve Fairing & 4th-Order Tangent Fix (`centerline.ts`):** Applies an 8-pass Taubin fairing filter ($\lambda = 0.45, \mu = -0.473$) to raw surveyed coordinates (eliminating 5m–15m OSM polyline vertex discretization kinks while keeping vertical elevation within $< 2\text{ mm}$) and divides all three components $(X, Y, Z)$ of the 4th-order central-difference tangent by $12$.
- **Direct Analytical Spline Frame & 11-Node Sub-Divided Collision Cross-Section (`track-mesh-generator.ts`):** Constructs the surface normal $\mathbf{n} = \mathbf{T} \times \mathbf{h}_{\text{right}}$ and lateral binormal $\mathbf{b} = \mathbf{n} \times \mathbf{T}$ directly from the analytical spline tangent $\mathbf{T}(t)$ at every sub-slice (with $C^1$ Hermite interpolation of `bankingRad` and `trackWidth`), guaranteeing $b_y \equiv 0$ on unbanked sections. Sub-divides collision road surface into 4 lateral lanes (`colVertsPerSection = 11`, including $\pm 0.46 \times \text{halfW}$ groove vertices).
- **2nd-Order Pneumatic Damper Velocity Filter & $+0.50\text{ m}$ Chassis Clearance (`raycast-vehicle.ts`):** Filters both suspension compression ($\alpha = 0.28$) and suspension velocity ($\alpha = 0.22$) to eliminate $C^0$ triangle-edge damper spikes, and elevates the chassis cuboid collider bottom edge to $+0.50\text{ m}$ (`cuboid(0.82, 0.22, 1.98)` at `(0, 0.72, 0)`).
- **Grounded Embankments & 2D Voronoi Bisector Clamping (`track-mesh-generator.ts`):** Trackside grass embankments project strictly along horizontal lateral normal $\mathbf{h}_{\text{right}} = (t_z, 0, -t_x)$ ($Y = 0$) with downward vertical drops, and are clamped laterally to the exact 2D Voronoi perpendicular bisector ($s_{\text{bisector}} = \frac{D^2}{2u} - 1.2\text{ m}$, interpolated via $C^1$ Hermite splines) and vertically below any nearby track floor ($\le y_{\text{nearbyMin}} - 0.80\text{ m}$). Completely eliminates upper hairpin leg embankments (e.g., at the Karussell exit) stretching across and covering lower hairpin legs (`0` embankment-over-road vertices across all circuits).
- **2D Hairpin Elevation Shelf Harmonization & Extended DEM (`osm_*.json` & `dem.json`):** Harmonized elevation anchors across closely spaced parallel hairpin legs (`Steilstrecke / Karussell / Hohe Acht` at $584.2\text{ m}\dots 585.8\text{ m}$ and `Dunlop-Kehre` centered on the $2,970\text{ m}$ apex), eliminating artificial 1D arc-length cliffs between roads $28\text{ m}$ apart while retaining the full $301.6\text{ m}$ Nordschleife vertical drop. Extended `dem.json` to $n_z = 118$ ($z_{\max} = 4,835.1\text{ m}$) and sculpted all corridor vertices to sit $\ge 3.5\text{ m}$ below the minimum track elevation within $85\text{ m}$.
- **Strict Tree Barrier Enclosure, Voronoi Corridor Ownership & Deep Trunk Roots (`forest-foliage.ts`):** Trees use horizontal lateral normal $\mathbf{h}_{\text{right}}$ within the solid embankment footprint ($|lateralDist| \in [16.0\text{ m}, 38.0\text{ m}]$), enforce a $12.0\text{ m}$ spatial clearance margin ($17.0\text{ m}$ from centerline) plus Voronoi corridor ownership (rejecting trees closer to a non-adjacent track segment), and extend trunk cylinders down to $Y = -2.4\text{ m}$ so trunks are deeply rooted into sloped embankments.
- **Enhanced Road Curvature Smoothness ($\sigma = 60$):** Second-derivative vertical jerk reduced to $< 0.005\text{ m}$ across all circuits, and $< 0.002\text{ m}$ ($< 2\text{ mm}$ per 5m) along the 1.5 km Döttinger Höhe straight. Full $268.5\text{ m}$ elevation drop preserved.
- **Assists Decoupling:** Counter-steer assist is bypassed during intentional driver steering (`|steer| >= 0.15`), preventing phantom resistance during cornering.
- **Low-Profile Dashboard Dual-Screen Pod:** Compacted digital rear-view mirror ($0.16\text{ m} \times 0.08\text{ m}$) and micro-radar ($0.129\text{ m} \times 0.088\text{ m}$) mounted at $(X = -0.10, Y = 0.51, Z = 0.26)$ with top edge $Y \le 0.55\text{ m}$, strictly below the windshield frame line for 100% unobstructed panoramic visibility across the entire windshield.
- **Rear Exterior Mounted Camera Systems:** Both the full-screen "Look Behind" camera (`cockpit-cam.ts`, $Z = -2.35\text{ m}$) and digital rear-view mirror camera (`rear-view-mirror.ts`, $Z = -2.25\text{ m}$) are mounted at the rear bumper/spoiler exterior looking backward $-Z$, completely eliminating internal cabin and seat occlusion.
- **Grand Prix Circuit Stadium Architecture & Anti-Encroachment Engine (`stadium-assets.ts`):**
  - **Front Straight Haupttribüne:** Positioned along the 450-meter Start/Finish straightaway (samples 85–165) at $-28.0\text{ m}$ lateral offset (driver's left), providing $> 21.5\text{ m}$ open runoff clearance. Features 6 tiers, $18.0\text{ m}$ depth, $11.0\text{ m}$ height, red/white seating modules, forward-pitched cantilever steel canopy, and sponsorship banners.
  - **Front Straight Concrete Pit Complex & Team Garages:** Positioned along samples 88–162 at $+26.0\text{ m}$ lateral offset (driver's right). Features $18.0\text{ m}$ depth, $5.5\text{ m}$ ground floor garages, $4.0\text{ m}$ upper VIP hospitality deck with panoramic glass windows, and concrete pit wall at $+11.0\text{ m}$ ($4.5\text{ m}$ clear verge from asphalt edge).
  - **Orthonormal Basis Frames:** Explicit Frenet basis matrices ($\mathbf{X} = \text{lateral/driver's right}, \mathbf{Y} = \text{up}, \mathbf{Z} = \text{forward tangent}$) via `Matrix4.makeBasis()`, resolving previous 90-degree axis swap errors and eliminating structures slicing across track ribbons.
  - **Automated Anti-Encroachment Clearance Filter:** Evaluates every candidate grandstand module's front edge against all track centerline points across the circuit; strictly rejects/clamps any module closer than $12.0\text{ m}$ to any centerline point, guaranteeing zero track encroachment.
  - **FIA Start/Finish Overhead Timing Gantry:** Overhead timing gantry with FIA 5-bulb starting light cluster at sample 95 on the front straight and sample 0, with $24.0\text{ m}$ lateral span and $8.5\text{ m}$ vertical clearance.

---

### 2.4 11-Chunk Partitioning, 100m Collision Overlap & High-Definition Grounded Terrain Mesh
- **Partitioning:** 11 sequential chunks ($\approx 1.89\text{ km}$ span per chunk).
- **Collision Overlaps:** $100\text{ m}$ forward and backward collision overlap ($\pm 25$ samples at $4\text{ m}$ spacing) extending across chunk boundaries, preventing vehicle tunneling at chunk seams during high-speed transitions.
- **Visual Mesh Cross-Section & Trackside Realism:**
  - Sub-sampled visual slices spaced at $1.25\text{ m}$ along the track, completely resolving Nyquist aliasing on alternating kerbs.
  - **Dashed Centerline Road Mark Eradication:** White road dashes completely eradicated; road rendered as continuous dark competition asphalt ($[0.18, 0.18, 0.20]$) with rich rubbered racing line grooves ($[0.13, 0.13, 0.15]$) and $20\text{ cm}$ brilliant white outer edge boundary lines ($[0.98, 0.98, 0.98]$).
  - **Procedural Fan Graffiti Markings:** Procedural multi-colored spectator spray paint markings (chalk white, Manthey racing yellow, spray cyan, crimson red) applied to the asphalt ribbon in classic graffiti zones (Hatzenbach, Adenauer Forst, Karussell, Brünnchen, Pflanzgarten, and Schwalbenschwanz).
  - **Weathered Concrete Patch Slabs:** Heavy braking zones and historic transitions (Wehrseifen downhill approach, Breidscheid entry, Karussell approach, Pflanzgarten compression) feature weathered concrete slabs ($[0.60, 0.60, 0.57]$) with dark tar expansion joints ($[0.24, 0.24, 0.24]$) every 4 meters.
  - **Authentic 3-Tier Galvanized Armco Barriers:** Corrugated multi-tier W-beam geometry featuring a post foundation, lower guard rail ($+0.25\text{ m}$), corrugated trough shadow ($+0.65\text{ m}$), and top rail ($+1.15\text{ m}$) with galvanized metallic sheen ($[0.84, 0.86, 0.90]$).
  - **Authentic Coarse Gravel Decelerator Runoff Beds:** Coarse crushed stone gravel traps ($[0.68, 0.62, 0.50]$) expanding outward up to 5.5m at surveyed real-world runoff locations: Aremberg ($s \in [3800, 4020]$), Adenauer Forst ($s \in [5040, 5260]$), Wehrseifen ($s \in [7400, 7580]$), Ex-Mühle ($s \in [8120, 8290]$), Brünnchen ($s \in [14000, 14450]$), Hohenrain ($s \in [20200, 20420]$), and GP-Strecke runoffs.
  - $1.25\text{ m}$ wide alternating 2.0m FIA red/white rumble kerbs ($1.8\text{ cm}$ bevel) activated across all corner complexes ($\ge 0.0035\text{ rad/sample}$) and suppressed on straights (Döttinger Höhe).
  - Multi-tone lawn grass verges ($[0.24, 0.48, 0.18]$) and mowed meadow ($[0.17, 0.36, 0.13]$) flanking the track.
  - $35.0\text{ m}$ outward-sloping green Eifel grass embankments beyond Armco barriers on both sides (`pEmbankNear`, `pEmbankMid`, `pEmbankOuter` down to $-2.20\text{ m}$), integrating the track seamlessly with the landscape.
  - Concrete slab texture coordinate mapping and expansion joints across the Karussell bowl.
  - Discrete $1.25\text{ m}$ transverse start/finish line grid stripe replacing wide road fading.
  - **1:1 Physics Collision Parity (`COL_SUB_STEPS = 6`):**
    - Collision trimesh generated directly using Catmull-Rom Hermite cubic spline sub-stepping (`COL_SUB_STEPS = 6`, ~0.83m longitudinal slice spacing), matching the visual mesh float-for-float.
    - Every collision vertex (`pRoadLeft`, `pCenter`, `pRoadRight`, `pKerbLeft`, `pKerbRight`, `pGrassLeft`, `pGrassRight`, `pBarrierTopLeft`, `pBarrierTopRight`) is mathematically identical to the visual asphalt surface.
    - Drops vertical chord sagitta error from 15 cm down to 0.000 mm, completely eliminating vehicles sinking/dipping on crests or levitating/floating over dips.
    - White boundary lines and painted graffiti markings are rendered strictly as coplanar vertex colors and textures across the flat road polygon strip with zero physical step, eliminating phantom "hitbox" collisions.
  - **Elevated Chassis Rigid Body Collider Envelope:**
    - Elevated chassis rigid body collider translation to $(0, 0.55, 0)$ with half-height $0.28\text{ m}$ (giving $+0.27\text{ m}$ bottom clearance).
    - Ensures the chassis rigid body collides strictly with vertical Armco crash barriers and other cars, never scraping or snagging road/kerb facets under heavy downforce or suspension compression.
  - **Global 2D Spatial Clearance & Anti-Encroachment Engine (`TrackSpatialGrid`):**
    - High-performance 2D spatial hash grid indexing all centerline nodes across the circuit.
    - Validates every candidate tree, distance marker, or trackside prop against `isNearAnyTrackSegment(x, z, margin = 4.5)`. Strictly rejects any candidate instance within $w_{\text{track}} / 2 + 4.5\text{ m}$ (minimum $10.5\text{ m}$ clearance) of ANY track centerline segment across the entire circuit.
    - Completely eliminates tree encroachment and bleed-through across hairpin switchbacks and parallel loops (Hatzenbach, Steilstrecke / Karussell, Hohenrain, Dunlop-Kehre).
    - Mountain pine trees completely suppressed within the modern Grand Prix stadium bowl ($X \in [-2350, -700], Z \in [2650, 4750]$) to maintain authentic open stadium sightlines.
- **16x Anisotropic Procedural Aggregate Detail Texture (`ChunkStreamer`):**
  - High-frequency procedural micro stone aggregate noise, aggregate clumps, and grass blade grain generated via pure `THREE.DataTexture` ($256 \times 256$, repeat $(12, 300)$, anisotropy 16, mipmapped).
  - Blends multiplicatively with vertex colors via Three.js standard material shader, eliminating flat/blurry texture artifacts at oblique angles while maintaining 100% headless test compatibility.
- **Zero-Noclip & Zero-Flying-Track Eifel Mountain Landscape (`EifelTerrain` & `dem.json`):**
  - Ingests $8.0\text{ km} \times 6.6\text{ km}$ SRTM digital elevation data (`tracks/nordschleife/dem.json`) into a $122 \times 102$ vertex elevation mesh (24,442 triangles) covering coordinates $X \in [-3919, 4011]$ and $Z \in [-2770, 3860]$.
  - Multi-tier vertex shading based on altitude and gradient: lush valley meadows (`#2d5a27`), evergreen pine forest slopes (`#1c4019`), and rocky alpine highlands (`#334a2e`), with smooth lighting normals and shadow reception.
  - Sculpted across all 10,016 surveyed circuit coordinates with strict corridor clamping: every DEM vertex within a 75m corridor is anchored to $h \le \min(p_y - 2.5\text{ m})$ with smooth cosine blend envelope to 180m.
  - Eliminates both terrain noclipping AND floating tracks in the sky (which occurred when high-elevation tracks at Hatzenbach/T13 $Y \sim 620\text{ m}$ hovered above un-lifted DEM valleys at $520\text{ m}$).
  - Loop-wide verification: 0 of 10,016 points clip into terrain; minimum clearance across all layouts is $\ge 2.00\text{ m}$ below asphalt grade everywhere (Nordschleife: 2.06m; 24h: 2.00m; GP-Strecke: 4.06m).
- **True Driver Right-Hand Minimap & In-Cockpit Radar Orientation (`hud.ts` & `micro-radar-display.ts`):**
  - Driver-centric coordinate projection aligns lateral vector directly with driver's true right $\mathbf{R} = (-F_z, 0, F_x)$ relative to vehicle forward heading $\mathbf{F} = (F_x, 0, F_z)$.
  - Eliminates lateral direction inversion across both the HUD GPS minimap and dashboard corner radar, correctly matching real-world Nürburgring corners (Aremberg Right, Wehrseifen Left, Karussell Left, Brünnchen Right, Galgenkopf Right).

---

### 2.5 Active 3-Chunk Window Streamer (`[K-1, K, K+1]`)
- **Memory Footprint:** Keeps strictly 3 active chunks loaded in Three.js scene memory and Rapier physics space ($< 500\text{ MB}$ RAM).
- **Rapier Trimesh Swapping:** As the vehicle advances from chunk $K$ to $K+1$:
  - Trailing chunk ($K-2$) is cleanly unloaded: Three.js geometry disposed (`geometry.dispose()`) and Rapier collider removed (`world.removeCollider`).
  - Leading chunk ($K+2$) is instantiated asynchronously.

---

### 2.6 Floating Origin Precision Guard
- **Manager:** `FloatingOriginManager` maintains global world offset $O = (O_x, O_y, O_z)$.
- **Recenter Threshold:** Triggers recentering whenever vehicle horizontal distance from current local origin exceeds $1,200\text{ m}$.
- **Result:** Local coordinates remain bounded within $[-1,500\text{ m}, +1,500\text{ m}]$, eliminating 32-bit floating-point camera jitter and vertex z-fighting across the $5\text{ km} \times 7\text{ km}$ geographical footprint.

---

### 2.7 High-Speed Centerline Projection & Multi-Circuit Lap Timing Engine
- **Projection Performance:** Optimized local search projects 3D car coordinates onto the active spline in $1.71\mu\text{s}$ per call ($< 50\mu\text{s}$ budget at 60 Hz).
- **Authentic Start/Finish Timing Gates:**
  - **Nürburgring Nordschleife ($20.71\text{ km}$):** Start/finish timing threshold at **T13 (Tribüne 13)** opposite the historic pit straight grandstand ($s = 0.0\text{ m}$), heading into Sabine-Schmitz-Kurve and Hatzenbach, completing through Döttinger Höhe, Tiergarten, and Hohenrain chicane.
  - **Nürburgring 24h Gesamtkurs ($24.26\text{ km}$):** Start/finish timing threshold on the **Grand Prix Start-und-Ziel-Gerade** ($s = 0.0\text{ m}$) facing Turn 1 (Yokohama-S). Lap order runs GP loop first (Mercedes-Arena, Schumacher-S, NGK-Schikane), down the front straight, enters Nordschleife via `Anbindung zur Nordschleife` at T13, runs the 20.8 km Nordschleife, returns from Hohenrain via `Anbindung zum GP-Kurs`, and crosses the GP finish line.
  - **Nürburgring GP-Strecke ($5.105\text{ km}$):** Start/finish timing threshold on the GP Start-Ziel straight facing Turn 1 ($s = 0.0\text{ m}$). Runs full 15-turn Grand Prix loop through Mercedes-Arena, Ford-Kurve, Dunlop-Kehre hairpin, Schumacher-S, ITT-Bogen, NGK-Schikane, and Coca-Cola-Kurve.
  - **High-Speed Proving Ground ($6.0\text{ km}$):** Start launch box at runway $Z = 0.0\text{ m}$ facing down the 5 km straight.
- **Visual Start/Finish Line:** 3-meter wide bright white painted timing stripe across the asphalt tarmac ribbon in `TrackMeshGenerator`.
- **Anti-Cheat & Invalidation:** Requires monotonic progress through a mid-circuit checkpoint (Breidscheid at $\approx 50\%$ distance); off-track excursions $> 2.0\text{ m}$ beyond kerbs invalidate the current lap time.
- **Output:** Live running lap time, previous lap time, persistent session best lap time, and real-time landmark sector badge.
- **Universal Circuit Execution:** Spline projection, dynamic 3-chunk window streaming, and lap timing run continuously across all circuit modes.

---

### 2.8 Phase 2 Verification & Benchmark Targets
- Tested via `npm run test:phase2` (`scripts/test-phase2.ts`).
- CLI asset generator via `npm run generate:track` (`scripts/track-pipeline/generate-track.ts`).
- **Results:**
  - Circuit length $20,832\text{ m}$ verified.
  - Vertical drop $302.4\text{ m}$ verified ($625.5\text{ m} \to 323.1\text{ m}$).
  - Karussell $33.0^\circ$ banking verified.
  - 11 chunks with $100\text{ m}$ overlap verified.
  - Projection time $3.84\mu\text{s}$ verified.
  - Floating origin recentering verified.
  - 3-chunk window dynamic Rapier swapping verified.
  - Start/finish lap timing verified.

---

### 2.9 Open-Source 3D Model Pipeline, 24h Layout, Minimap & Feasibility Review

#### 2.9.1 Open-Source 3D Model Ingestion Architecture
- **Format:** glTF 2.0 / GLB with Draco or Meshopt geometry compression.
- **Dual-Layer Mesh Pipeline:**
  1. **Visual Render Mesh:** High-fidelity LOD hierarchy with pre-baked PBR materials, authentic kerb bevels, grass verges, barriers, and environmental trackside landmarks (grandstands, gantry signs, trees).
  2. **Physics Collision Mesh:** Clean, isolated trimesh geometry consisting solely of road tarmac, flush kerbs, grass verges, and continuous vertical Armco barrier walls. Excludes high-density visual clutter (fences, spectator posts) to guarantee < 1.0 ms physics ticks at 240 Hz.

#### 2.9.2 Feasibility Concerns & Engineering Mitigations
1. **Asset Size & Memory Footprint:**
   - *Risk:* Raw 25.4 km 3D models with uncompressed 4K textures can exceed 800 MB–1.5 GB, causing browser out-of-memory crashes or long initial network load times on mobile/desktop browsers.
   - *Mitigation:* Apply Draco geometry compression, power-of-two (POT) texture compression (WebP / KTX2 basis universal), and leverage the existing 11-chunk dynamic streamer to download only active sectors within the vehicle's spatial horizon (~15–20 MB per sector).
2. **Raycast Suspension Sensitivity to Surface Noise:**
   - *Risk:* Raw imported meshes often contain micro-tessellation facets, non-manifold edges, or disconnected vertices that create discontinuous normal jumps in Rapier raycasts, causing suspension flutter.
   - *Mitigation:* Clean and weld collision vertices in Blender/CLI pipeline to ensure a smooth, continuous 2-manifold road ribbon with strictly flush kerbs and smooth transitions.
3. **Licensing & Copyright:**
   - *Risk:* Rips from commercial racing simulators (Assetto Corsa official DLC, iRacing) carry strict proprietary copyright.
   - *Mitigation:* Restrict sources to Creative Commons (CC-BY) community models, open-source racing platforms (Speed Dreams / TORCS), or procedural OpenStreetMap (OSM) / DEM elevation heightmaps generated via Blender-GIS.

#### 2.9.3 Live Circuit Minimap Vector Pipeline & GPS North-Locked Radar
- **Host Display Minimap:** Vector canvas rendered in the lower-left corner of the windshield HUD (`#hud-minimap-panel`, $240 \times 150\text{ px}$).
- **GPS Track-Up Radar (`GPS: NORTH LOCKED`):**
  - **Player Blip:** Positioned at $(cw \times 0.50, ch \times 0.62)$ and permanently locked pointing strictly UP along the $-Y$ axis (North of the display).
  - **Quaternion Coordinate Projection:** Road centerline, sectors, dynamic FIA flags, landmark beacons, and competitor dots rotate and translate around the car using the vehicle's quaternion forward and right vectors:
    $$fwdX = 2(qx \cdot qz + qw \cdot qy), \quad fwdZ = 1 - 2(qx^2 + qy^2)$$
    $$rightX = 1 - 2(qy^2 + qz^2), \quad rightZ = 2(qx \cdot qz - qw \cdot qy)$$
    $$d_{\text{forward}} = \Delta x \cdot fwdX + \Delta z \cdot fwdZ$$
    $$d_{\text{lateral}} = \Delta x \cdot rightX + \Delta z \cdot rightZ$$
    $$sx = carScreenX + d_{\text{lateral}} \times 0.22, \quad sy = carScreenY - d_{\text{forward}} \times 0.22$$
  - **Lookahead & Tactical Range:** Scale factor $0.22\text{ px/m}$ yields $\sim 420\text{ m}$ forward lookahead and $\sim 260\text{ m}$ rear lookbehind.
  - **Concentric Range Rings:** Subtle distance rings at $100\text{ m}$ ($r = 22\text{ px}$), $250\text{ m}$ ($r = 55\text{ px}$), and $400\text{ m}$ ($r = 88\text{ px}$) with clean monospace distance callouts.
  - **Motorsport Compass Rose (True Geographic North):** Top-left circular compass at $(20, 20)$ with dual-tone needle (red North tip, silver South tip) rotating by $\theta_{\text{north}} = \operatorname{atan2}(-rightZ, -fwdZ)$ showing real-world heading while the display remains locked North-forward.
  - **Interactive Mode Toggle:** Clicking `#hud-minimap-panel` or pressing `[N]` instantly toggles between `GPS: NORTH LOCKED` (default) and `CIRCUIT OVERVIEW [STATIC]`.
  - **Competitor Dots:** Outlined high-contrast dots with car numbers (`#80`, `#911`, etc.) rendered with a dark stroke for maximum legibility against asphalt and grass.
- **Latency & Performance:** Driven directly by vehicle translation at 60 Hz with zero garbage collection allocations.

#### 2.9.4 Nürburgring 24h Gesamtstrecke & Multi-Layout State Machine
- **Layouts Supported:**
  1. `24h_gesamtkurs`: 25,378m combined endurance loop (GP-Strecke + Nordschleife via T13 bypass).
  2. `nordschleife`: 20,832m classic time-attack circuit starting at T13 Antoniusbuche.
  3. `gp_strecke`: 5,148m Grand Prix loop including the Mercedes Arena and chicane.
  4. `proving_ground`: 6,000m flat runway and skidpad testing facility.
- **Interactive Menu UI:** Modal track selection dialog accessible via HUD button `[Tracks]` or hotkey `[M]`, displaying interactive layout wireframes, length, turn count, and instant track transition.

#### 2.9.5 3D Grandstands & Modern Stadium Architecture (`StadiumAssets`)
- **Stadium Complex Structure:** Replaces wild mountain pine trees inside the GP stadium bowl with world-class FIA Grade 1 architecture:
  - **Start/Finish Haupttribüne:** Covered multi-tier red/white stadium seating with cantilever roof and steel trusses ($s \in [15, 65]$, $-22\text{ m}$ lateral offset).
  - **2-Story Concrete Pit Building:** Team garages, VIP lounges, glass observation boxes, and pit wall with marshaling posts ($s \in [18, 70]$, $+20\text{ m}$ lateral offset).
  - **Overhead Start/Finish Steel Timing Gantry:** Overhead truss spanning the front straight with 5 green FIA start bulbs at $s = 0.0\text{ m}$.
  - **Mercedes-Benz Arena Grandstand:** Wrapped around Turns 2 & 3 ($s \in [275, 335]$, $-24\text{ m}$ lateral offset).
  - **Dunlop-Kehre Hairpin Viewing Grandstand & NGK-Schikane Stadium Complex:** Flanks lowest-point valley hairpin ($s \in [545, 585]$).
  - **Zero-Noclip Guarantee:** DEM terrain clamped to $\le Y_{\text{track}} - 4.5\text{ m}$ across the entire stadium bowl ($X \in [-2250, -750]$, $Z \in [2700, 4650]$) yielding 0 clipping violations across all 1,021 track nodes.

#### 2.9.6 In-Cockpit Micro Minimap & Proximity Spotter (`MicroRadarDisplay`)
- **Mounting:** High-resolution 4:3 LCD monitor ($512 \times 512$ canvas texture) mounted directly below the digital rear-view mirror screen on the center console bracket facing the driver.
- **Display Pipeline:**
  - **Zoomed Lookahead Curvature:** Renders the upcoming track ribbon for the next 1–2 corners (~220m lookahead) with corner radius and distance annotations.
  - **Locked Heading-Up Orientation:** Vehicle remains strictly centered and oriented facing UP ($\uparrow$), rotating the world relative to vehicle heading.
  - **Porsche 911 Silhouette:** Simplified vector profile displaying the aerodynamic nose, round headlights, wide rear haunches, and swan-neck wing.
  - **Proximity Spotter & Collision Hazards:** Detects nearby cars ($< 35\text{ m}$); triggers dynamic flashing yellow/amber hazard arcs at the exact contact perimeter (left door, right door, rear bumper) and spotter alert banners (`⚠️ CAR LEFT`, `⚠️ CAR RIGHT`, `⚠️ CAR BEHIND`).

#### 2.9.7 AI Competitor Field Simulation & Dynamic FIA Flag State Machine (`CompetitionField`)
- **Competitor Field:** 6 authentic endurance entries (`#911` Grello, `#1` Rothmans, `#92` Pink Pig, `#20` Gulf, `#93` Weissach, `#00` Stealth) simulating realistic pack racing along the circuit spline with cornering speed deltas.
- **F1 Broadcast Timing Radar:** Tiny colored competitor dots with number tags rendered live along the Big Minimap circuit outline.
- **FIA Flag State Machine:** Cycles through `GREEN`, `SECTOR_1_YELLOW`, `SECTOR_2_YELLOW`, `SECTOR_3_YELLOW`, `FULL_YELLOW`, `RED` via `[F]` key, rendering live caution badges (`🟢 ALL CLEAR`, `🟡 CAUTION S2`, `⚠️ FULL YELLOW`, `🛑 RED FLAG`) and dynamic blinking sector track outlines.

#### 2.9.8 Official Porsche 911 RSR Steering Wheel & 1:1 LCD Display Pipeline (`PorscheRsrSteeringWheel`)
- **3D Steering Wheel Architecture:**
  - Realized via `PorscheRsrSteeringWheel` in `src/host/render/cockpit/rsr-steering-wheel.ts`.
  - Replicates the official GRID Engineering / Sim-Lab Porsche 911 RSR GT/GTE wheel (285mm diameter).
  - Contoured carbon fiber faceplate extruded with 3-segment rounded bevels, upper $45^\circ$ shoulder chamfers, and lower chin.
  - Molded ergonomic polyurethane/Alcantara side grips with palm swells and thumb rest ledges.
  - Arched top housing holding 15 curved shift rev LEDs with authentic Porsche Motorsport outside-in convergence: 4 Green on outer flanks, 4 Yellow in mid-range, and 7 Red meeting in the center at max red, with all 15 LEDs strobe-flashing electric blue at optimal shift point (>= 8,800 RPM or isShiftLightActive).
  - Laser-etched silver "PORSCHE" wide typography wordmark across the top plate.
  - CNC anodized aluminum rotary thumb encoders: red `TCI` (top left), purple `TCO` (top right), gold dial (inner left), blue dial (inner right).
  - 10 tactile motorsport pushbuttons with black anodized collar bezels.
  - 4 lower fluted rotary selector switches with index markers: `TC/CON`, `TC/R`, `MAP`, and `WIPER`.
  - Porsche golden shield crest emblem centered on the lower chin.
  - Rear carbon fiber magnetic shifter paddles and red anodized quick-release hub collar.
- **1:1 LCD Telemetry Dashboard Pipeline:**
  - $1024 \times 600$ Canvas 2D texture pipeline dynamically bound to `THREE.CanvasTexture` on the wheel faceplate.
  - Top Status Bar: `[TC C | 1]`, `[TC R | 1]`, `000` (live speed km/h), `[AC | 11]`, `[Map | 1]`.
  - Left Cluster: `Water Temp` (85°C), `Oil Temp` (92°C), `Water Press` (1.90 bar), `Oil Press` (3.73 bar).
  - Center: Giant high-visibility Gear indicator (`N`, `R`, `1`–`6`) with mini Porsche crest below.
  - Right Cluster: `Avg Diff` (+0.00 / delta), `Predicted Lap Time` (live timer `MM:SS:cc`), `Best Lap Time` (`MM:SS:cc`), `Laps2go` (`10` / lap count), `Lap Time` (`MM:SS:cc`).
  - Clean dark placeholder boxes for future expansion (tire telemetry and pit strategy).
- **Cockpit Framing & Road Car Wheel Sanitization:**
  - Automatically sanitizes out stock road-car steering wheel nodes (`Node_SteeringWheel`, `Interior_SteeringColumn_Stalks`) via `VehicleModelAdapter.sanitizeModel`.
  - Cockpit eye point at $[0.35, 0.70, -0.26]\text{ m}$, FOV $78^\circ$, down-pitch $-3.4\text{ m}$ over 30m, and wheel at $[0.35, 0.58, 0.05]\text{ m}$ (tilt $0.32\text{ rad}$), framing the full wheel, lower dials, crest, micro radar, and rear-view mirror with 100% clear sightlines.

---

# PART III: PHASE 3 SPECIFICATION — ADVANCED MOTORSPORT SYSTEMS (PAUSED & MERGED)

> [!NOTE]
> Standalone Phase 3 development is paused per user instruction. Core telemetry (9-sector timing, local ghost recording) is retained, while consumables, pit systems, and atmospheric realism are escalated and fully implemented within **Phase 5 (Nürburgring & Simulation Realism - Assetto Corsa Competizione Level)**.

Phase 3 introduces advanced endurance motorsport systems, environmental conditions, 9-sector telemetry, ghost car time attack, and WebRTC peer-to-peer multiplayer.

---

### 3.1 Initial Tyre, Fuel & Brake Baselines (`RaycastVehicle`, `BrakeSystem`)
- **Baseline Consumables Configuration:** Initial telemetry and simulation scaffolding; pit lanes and consumable degradation are restored and physically simulated in Phase 5.
- **Thermal Brake Fade:** Live rotor temperatures $[FL, FR, RL, RR]^\circ\text{C}$ reduce pad friction coefficient $\mu_{\text{pad}}$ linearly above $750^\circ\text{C}$ (from $\mu_{\text{pad}} = 0.42$ down to $0.19$ at $1,100^\circ\text{C}$), directly scaling clamping brake torque.

---

### 3.2 Recessed Endurance Racing Headlights & Brake Lights (`CarMeshRig`, `LiverySystem`)
- **Zero Floating Lenses in Cockpit Sightline:** `CarMeshRig.headlightsGroup` contains zero protruding cylinder/box meshes blocking the cockpit view.
- **Recessed 3D Model Binding (`bindRecessedLightMeshes`):** Directly binds `headlightLensMaterial`, `taillightMaterial`, and `brakeLightMaterial` to the recessed meshes inside `model.glb` (`Headlight_Emissive`, `HeadLight_Glass`, `HeadLight_Housing_Static`, `Signal_Front_Emissive`, `Taillight_Strip_Emissive`, `Taillight_Brake_Emissive`, `Tailgate_Brake_Emissive`, `Taillight_Main_Glass`).
- **High-Output Endurance Lighting & Rearward Directional Brakes:** Dual long-throw `THREE.SpotLight` main beams (`distance = 280m`, `decay = 0.45`, `intensity = 24.0`) + wide cornering apron flood `THREE.SpotLight` (`distance = 115m`, `decay = 0.50`, `intensity = 14.0`) + dual rearward-only directional brake `THREE.SpotLight` beams ($Z = -2.02\text{ m}$, pointing rearward toward $-Z$, zero light cast into the cockpit) driven by brake pedal telemetry.

---

### 3.3 Dynamic Environment: Exterior-Only Weather & Day/Night Cycle (`EnvironmentManager`, `TrackDryingLine`)
- **Modular State:** `EnvironmentState` object driving solar progression (`0–24h`), sky dome shader colors, fog density, and automatic high-output vehicle headlights.
- **Exterior-Only Rain System:** 1,600-streak 3D camera rain particle emitter (`THREE.LineSegments`, `depthTest: true`) restricted to an exterior cylindrical annulus ($r \in [4.8\text{ m}, 34.0\text{ m}]$) so rain never spawns inside the cockpit cabin, paired with clear cockpit sightlines ($vUv.y < 0.50$ and central road cone discarded) and $40\%$ wet surface friction reduction ($\mu_{\text{wet}} = 0.60 \cdot \mu_{\text{dry}}$) with slick-tire hydroplaning above $145\text{ km/h}$.
- **Dynamic Drying Line:** $512 \times 16$ 2D track moisture occupancy grid (`TrackDryingLine`) clearing standing water along the active racing groove as tires roll over the circuit.

---

### 3.4 9-Sector Timing, Ghost Car & WebRTC P2P Multiplayer (`NordschleifeLapTimer`, `GhostCarManager`, `WebRTCMultiplayerLobby`)
- **9-Sector Timing & Live Delta:** Full 9-sector Nürburgring breakdown (`S1 · Hatzenbach` through `S9 · Döttinger Höhe`) with purple/green/yellow sector splits and continuous distance-interpolated live `+/-` delta HUD bar.
- **Local Ghost Car:** 30 Hz keyframe recording and `localStorage` persistence of personal best valid laps, rendered on track as a translucent holographic 3D ghost car with `lerp`/`slerp` pose interpolation.
- **WebRTC P2P Multiplayer Lobby:** Semantic `<dialog>` modal lobby establishing direct peer-to-peer `RTCPeerConnection` + unordered `RTCDataChannel` links (via room signaling `/ws?role=peer`, manual SDP Offer/Answer tokens, or 1-click local Loopback P2P Pace Peer), exchanging 44-byte binary pose packets at 60 Hz.

---

### 3.5 Multi-Class Sandbox Roster & Variables Database
- Maintained in [`docs/variables-database.csv`](docs/variables-database.csv) and [`src/common/variables-dictionary.ts`](src/common/variables-dictionary.ts).
- Expands beyond the Porsche 992 RSR-19 to include Formula 1, Le Mans Hypercar, production GT3 street, and sandbox vehicles.

---

# PART V: PHASE 5 SPECIFICATION — NÜRBURGRING & SIMULATION REALISM (ASSETTO CORSA COMPETIZIONE LEVEL)

Phase 5 elevates the Nürburgring Nordschleife circuit and vehicle dynamics to simulation realism rivaling *Assetto Corsa Competizione*, resolving elevation geometry, forest density, safety barriers, drivable pit lanes, HUD cleanup, vehicle physical consumables, lighting balance, and track/car creation authoring standards.

---

### 5.1 Topographical Elevation Recalibration & Vertical Dynamics
- **Surveyed Elevation Profile:** Recalibrate vertical contours across the 20,832m loop to match surveyed Rheinland-Pfalz elevation benchmarks:
  - T13 / Antoniusbuche: $624.0\text{ m}$
  - Hatzenbach / Hocheichen descent: $-42\text{ m}$
  - Flugplatz crest: $588.0\text{ m}$
  - Schwedenkreuz drop: $-50\text{ m}$ into Aremberg
  - Fuchsröhre plunge: Extreme $-11.7\%$ gradient dropping $76.0\text{ m}$ to the compression trough ($444.0\text{ m}$)
  - Adenauer Forst / Metzgesfeld descent: Continuous drop through Kallenhard into Wehrseifen
  - Breidscheid lowest circuit depression: $320.0\text{ m}$
  - Bergwerk ascent: $+306.8\text{ m}$ vertical climb through Ex-Mühle, Kesselchen, and Klostertal up to Hohe Acht crest ($626.8\text{ m}$)
  - Wippermann, Eschbach, Brünnchen ($525.0\text{ m}$), Pflanzgarten jumps ($488.0\text{ m}$)
  - Schwalbenschwanz, Galgenkopf, and Döttinger Höhe straight ($560.0\text{ m}$ to $610.0\text{ m}$)
- **Filter Re-Tuning:** Replace over-aggressive smoothing ($\sigma=60$) with an adaptive filter ($\sigma=8$) that eliminates discrete 1m DEM step artifacts while preserving authentic compression G-forces and sudden elevation drops.
- **Physical Road Camber & Banking:** Incorporate authentic camber throughout high-speed curves and the deep 33° concave concrete dish of the Steilstrecke Karussell and Kleines Karussell.

---

### 5.2 Multi-Layer Dense Eifel Forest Immersion & Roadside Canopy Engine
- **Immersion Goal:** Transform the environment into "The Green Hell" where the driver feels enveloped in a dense mountain forest.
- **Three-Tier Vegetation Architecture:**
  - **Tier 1 (Roadside Verge & Undergrowth, 0–4m from barrier):** Low-poly bushes, dense fern clusters, mossy grass clumps, and saplings.
  - **Tier 2 (Overhanging Broadleaf & Pine Canopy, 4–15m from barrier):** Beech, oak, and Scotch pine trees with high branches that arc over the Armco barriers, casting dynamic dappled shadows across the asphalt.
  - **Tier 3 (Dense Deep Forest Wall, 15–120m from barrier):** Multi-layered dense tree trunks and interlocking foliage billboards with altitude-varied tree heights ($14\text{–}26\text{ m}$), completely occluding the horizon except at natural crests (Hohe Acht, Döttinger Höhe).
- **GPU Instancing & Streaming:** Instanced meshes (`THREE.InstancedMesh`) partitioned per track chunk, maintaining $60\text{–}120\text{ FPS}$ on Apple Silicon with under 15 draw calls dedicated to vegetation.

---

### 5.3 Trackside Assets, Catch Fencing, Red/White Barriers & Sponsor Bridges
- **FIA Debris Catch Fences:** 3.0m galvanized steel tubular posts anchored behind Armco guardrails, strung with high-tensile wire mesh cages and angled top deflection arms along spectator zones (Hatzenbach, Flugplatz, Brünnchen, Pflanzgarten, Schwalbenschwanz).
- **Runoff Red-and-White Safety Barriers:** High-impact red-and-white painted tire barrier stacks and modular Tecpro barrier blocks at critical deceleration zones and runoffs (Aremberg, Wehrseifen, Adenauer Forst, Bergwerk, Tiergarten).
- **Overhead Sponsor Gantry Bridges:** Historic metal truss sponsor bridges spanning the full track width:
  - Bilstein Bridge (Döttinger Höhe)
  - Audi Sport Gantry (Antoniusbuche)
  - Yokohama Bridge (Grand Prix merge)
- **Instanced Marshall Huts & Distance Markers:** Procedural placement of FIA marshal intervention posts, fire extinguisher boxes, and 200m / 100m / 50m braking boards.

---

### 5.4 Thickened Safety Barriers & Continuous Collision Detection (CCD)
- **High-Speed Noclip Prevention:** At $300+\text{ km/h}$, a vehicle covers $0.35\text{ m}$ per physics tick. Thin single-sided trimesh colliders can fail discrete contact tests, causing cars to penetrate or noclip out of bounds.
- **Thickened Barrier Geometry:** All guardrails, concrete pit walls, and tire stacks are modeled with minimum $0.5\text{ m}$ collision depth envelopes (`Rapier.ColliderDesc.cuboid` or extruded volumetric convex prisms) extending behind the visual barrier face.
- **Rapier CCD Activation:** Enable Continuous Collision Detection on the vehicle rigid body (`rigidBodyDesc.setCcdEnabled(true)`), calculating continuous swept-sphere trajectories between ticks to guarantee zero boundary tunneling under severe impacts.

---

### 5.5 Dedicated Drivable Pit Lane, Pit Wall Divider & Pit Box Architecture
- **Dedicated Asphalt Apron:** A physically separated $7.5\text{ m}$ wide asphalt pit lane parallel to the main straight, segregated by a continuous concrete pit wall ($1.05\text{ m}$ height, $0.45\text{ m}$ thickness) with reflective hazard striping.
- **Pit Entry & Deceleration Lane:** Dedicated deceleration taper branching right before the start/finish straight, equipped with pit entry signage, pit commit line, and flashing amber warning LEDs.
- **Pit Lane Speed Limiter:**
  - Automated speed limiter trigger volume enforcing a strict $60\text{ km/h}$ ceiling upon crossing the pit entry line.
  - Mobile controller HUD displays green/orange `PIT LIMITER ACTIVE` indicator and restricts throttle torque to prevent overspeed penalties.
- **10+ Modular Team Pit Stalls:**
  - Marked concrete pit stalls along the pit lane with team overhead gantry rigs, pneumatic hose booms, digital lollipop signs, and refueling rigs.
  - Player's active pit box is highlighted with a floating translucent green stop chevron and tire alignment targets.
  - Extensible architecture ready to assign individual pit boxes to remote drivers in multiplayer sessions.
- **Pit Exit Merge Lane:** Extended acceleration blend lane protected by a painted solid white blend line merging safely into the racing line on the straight.

---

### 5.6 HUD Radar & Flag Cleanup
- **Remove Fake AI Dots:** Eliminate synthetic placeholder AI competitor dots from the minimap and cockpit radar.
- **Retain PB Ghost Car Dot:** Strictly preserve the player's personal best (PB) ghost car indicator/silhouette on the radar during timed hotlaps for clear visual pacing.
- **Remove Broken Placeholder Flags:** Decommission placeholder yellow flag triggers and static warning banners until a fully simulated sector marshalling system is introduced.

---

### 5.7 Full Vehicle Physical Realism (Tyre Wear, Fuel Burn, Brake Temperatures)
- **Slip-Energy Tyre Degradation:**
  - Tire wear calculated as a function of thermal energy and frictional work:
    $$\Delta W_{\text{tire}} = \int (|F_x \cdot v_{\text{slip}, x}| + |F_y \cdot v_{\text{slip}, y}|) \, dt \cdot k_{\text{compound}}$$
  - Accumulated wear progressively scales down peak Pacejka friction $D$ ($1.00$ when fresh down to $0.65$ when worn) and softens cornering stiffness $B \cdot C \cdot D$, inducing realistic progressive understeer and oversteer.
- **Dynamic Fuel Mass Burn & Chassis Weight Balance:**
  - Fuel consumption integrated from instantaneous engine RPM and throttle position:
    $$\dot{m}_{\text{fuel}} = \text{BSFC} \cdot P_{\text{engine}} \cdot \Delta t$$
  - Fuel density $0.75\text{ kg/L}$ dynamically updates chassis mass ($m_{\text{curr}} = m_{\text{dry}} + m_{\text{fuel}}$) and shifts longitudinal center of mass, altering suspension pitch and cornering agility as fuel depletes.
- **Brake Thermal Efficiency Curves:**
  - Rotor temperatures updated per wheel via frictional heat generation and convective air cooling.
  - Dynamic friction coefficient $\mu_{\text{pad}}(T)$:
    - Cold bite ($< 200^\circ\text{C}$): $\mu_{\text{pad}} \approx 0.32$ (reduced initial bite)
    - Optimal window ($350\text{–}650^\circ\text{C}$): $\mu_{\text{pad}} \approx 0.44$ (maximum braking efficiency)
    - Thermal fade ($> 750^\circ\text{C}$): $\mu_{\text{pad}}$ degrades linearly to $0.18$ at $1,100^\circ\text{C}$.

---

### 5.8 Visual & Atmospheric Lighting Realism
- **Diffuse Realistic Rear Lights:**
  - Recalibrate rear LED light strips and high-mount brake lights to authentic automotive luminance.
  - Rear lights emit a rich, diffuse red glow with localized pavement bounce behind the bumper, completely eliminating excessive forward light spill or unrealistic cockpit wash.
- **Sunset & Dawn Atmospheric Overhaul:**
  - Physically based Rayleigh and Mie atmospheric scattering for low-sun angles ($5^\circ\text{–}15^\circ$ elevation).
  - Authentic golden-hour amber horizons, soft purple sky transitions, and directional tree shadows across the undulating track surface.
- **Full 24-Hour Day/Night Endurance Cycle:**
  - Configurable continuous time progression ($1\times$ to $60\times$) driving sun angle, celestial stars, ambient occlusion, and headlight projection for true 24-hour endurance simulations.

---

### 5.9 Authoritative Track & Vehicle Creation Engineering Manual (`docs/skills.md`)
- Authoritative documentation codified in [`docs/skills.md`](docs/skills.md) providing step-by-step engineering workflows for:
  - Track centerline spline sampling, elevation contour extraction, and 30-node road cross-section extrusion.
  - Multi-tier vegetation scattering, FIA catch fencing, red/white tire barriers, and sponsor bridges.
  - Dedicated pit lane geometry, pit wall partitions, pit stall lollipop rigs, and speed limiter zones.
  - Vehicle glTF model ingestion, node sanitization, concentric wheel extraction, and flat UV wrap livery mapping.
  - Rapier 3D compound colliders, raycast suspension tuning, and telemetry dash bindings.
  - Sound design pipeline: Headphone-safe audio synthesis, engine pulse layering, straight-cut gearbox filtering, and safety compression.
  - Engineering change & Git commit traceability registry (Section 5) and agent version control protocol (Section 6), indexing every major subsystem by commit hash code for verification and version rollback.

---

### 5.10 Locked Cockpit Camera Stability & Zero Camera Shake
- **User Directive (2026-11-09):** *"forget the camera shake, get rid of that."*
- **Strict Rigid Body Locking:**
  - Completely eliminated artificial camera shake, horizon lock low-pass filtering, and interior bump micro-vibration offsets.
  - The internal cockpit camera is rigidly locked to the driver eye position and vehicle roof normal vector (`this.camera.up.copy(carUp)`).
  - The chassis, dashboard, windshield, and steering wheel remain strictly stable relative to the camera with exact zero drift, wobble, or interior vibration, ensuring a rock-solid cockpit sightline at all speeds while Rapier 240 Hz suspension dynamics handle physical vehicle movement.

---

### 5.11 Smooth C2 Spline Geometry with Micro-Undulation Bump Dynamics
- **Non-Jagged Geometric Continuity:**
  - Track surface ribbon is extruded along an 8-pass Taubin faired cubic spline with $C^2$ second-derivative continuity, completely free of polygonal kinks, angular facets, or DEM staircasing.
- **Multi-Band Physical Undulations:**
  - *Macro-Elevation:* Surveyed vertical contours (Fuchsröhre plunge, Breidscheid depression, Bergwerk climb, Hohe Acht crest) are smoothly faired to preserve high-G vertical compressions and crest weightlessness.
  - *Medium-Wave Asphalt Settling:* Continuous procedural Perlin noise ($\lambda = 8\text{–}25\text{ m}$, amplitude $\pm 18\text{ mm}$) models the natural undulating character of the Eifel mountains.
  - *Short-Wave Micro-Bumps & Tar Seams:* Transverse bump impulses ($\lambda = 0.5\text{–}1.2\text{ m}$, amplitude $\pm 8\text{ mm}$) at historic tarmac expansion joints, repaired asphalt bands, and Karussell concrete slab seams.
- **Physics Interaction:** These surface undulations excite the 240 Hz Rapier vehicle suspension spring-dampers directly, driving realistic wheel travel, tire load variation, and chassis vibration without polygonal jaggedness.

---

### 5.12 Audio Synthesis Architecture & Headphone-Safe Acoustic Tuning
- **Acoustic Origin of Gear Mesh Whine:**
  - Straight-cut spur dog-ring gearboxes mesh teeth with zero helix angle, producing a high-frequency acoustic tone:
    $$f_{\text{mesh}} = \frac{\text{RPM}_{\text{axle}}}{60} \cdot N_{\text{teeth}} \approx 1,000\text{–}3,800\text{ Hz}$$
- **Ear-Fatigue Protection in Headphones:**
  - Raw high-Q bandpass filters or undamped oscillator harmonics in the $2.5\text{–}4.0\text{ kHz}$ band coincide directly with the natural resonance of the human ear canal, causing ear strain, pain, and headaches in headphones.
- **Acoustic Solutions (`docs/skills.md` Section 4):**
  1. **Steep Low-Pass Rolloff:** Cascade a 2nd-order Butterworth low-pass filter at $3,200\text{ Hz}$ ($-12\text{ dB/octave}$) to eliminate shrill, piercing high-frequency overtones.
  2. **Ear-Canal Resonance Notch Filter:** Insert a static parametric notch filter centered at $3,500\text{ Hz}$ ($Q = 3.0$, gain $-8.0\text{ dB}$) to remove harsh acoustic energy without destroying the mechanical character of straight-cut gears.
  3. **Load-Dependent Volume Attenuation:** Whine volume drops by $-18\text{ dB}$ when coasting, cruising at steady state, or idling, eliminating persistent high-pitched drone.
  4. **Rich Multi-Harmonic Engine Core:** Deep flat-six combustion rumble ($40\text{–}450\text{ Hz}$) with throaty intake roar under load anchors the soundscape.
  5. **Master Dynamics Limiter:** Insert `DynamicsCompressorNode` on master output to clamp acoustic spikes, backfires, and crash impacts.

---

# PART VI: PHASE 6 SPECIFICATION — PRIVATE MULTIPLAYER, RACE PROCEDURES & TRACK RECOVERY (PAUSED)

> [!NOTE]
> Phase 6 is paused per user instruction to prioritize simulation realism and Nürburgring fidelity in Phase 5.

Phase 6 delivers private peer-to-peer multiplayer racing, format-specific race start sequences, smart near-crash track recovery, and configurable collision modes.

---

### 6.1 Private 4-Digit Room Signaling & Peer Mesh Architecture
- **Numeric 4-Digit Address Space:**
  - Private lobbies are keyed by 4-digit numeric codes $[0000, 9999]$ ($10,000$ discrete rooms).
  - Designed for instant manual entry on mobile screens and effortless communication in voice chats or messaging.
  - Host generates an available room code via WebSocket:
    ```typescript
    interface RoomCreateRequest {
      type: 'create_private_room';
      preferredCode?: string; // e.g. "4821"
    }
    ```
  - Join URL query parameter support: `https://<host>:5173/?room=4821`.
- **Peer-to-Peer DataChannel Mesh:**
  - Signaling handled over lightweight WebSocket server on `/ws?role=peer&room=XXXX`.
  - WebRTC DataChannel configured for minimal latency:
    ```typescript
    const dataChannel = peerConnection.createDataChannel('telemetry', {
      ordered: false,
      maxRetransmits: 0 // drop outdated packets, UDP semantics
    });
    ```
  - High-frequency vehicle pose packets stream at 60 Hz (44 bytes per tick):
    - Magic header (`0x5032`), sequence number (uint16), timestamp (uint32).
    - Position $(X, Y, Z)$ as float32 ($12\text{ bytes}$).
    - Quaternion $(Q_x, Q_y, Q_z, Q_w)$ as int16 compressed ($8\text{ bytes}$).
    - Steering angle $\delta$, wheel RPMs $\omega_{0\dots 3}$, brake/throttle bits ($10\text{ bytes}$).
  - Client-side Hermite dead-reckoning extrapolation and interpolation buffer ($60\text{–}80\text{ ms}$) ensures smooth vehicle motion across variable packet arrival times.

---

### 6.2 Lobby Configuration & Host Controls
- **Host Authoritative Settings Payload:**
  ```typescript
  interface LobbyConfigPayload {
    roomCode: string;           // "4821"
    circuit: TrackMode;         // NORDSCHLEIFE, N24H, GP_STRECKE, PROVING_GROUND
    lapCount: number;           // 1 to 25
    maxDrivers: number;         // 2 to 16
    collisionEnabled: boolean;  // false = Ghost Mode, true = Physical Collision
    startFormat: 'standing_f1_5lights';
  }
  ```
- **Roster Synchronization:**
  - Connected peers exchange driver names, car livery indices, competition car numbers (#0–#999), and ready-state flags.
  - Host initiates the race launch sequence once all joined drivers toggle "READY".

---

### 6.3 Universal Standing Start State Machine (FIA F1 5-Red-Light Sequence)
> [!NOTE]
> Rolling starts have been completely removed from the simulation per user decision (*"get rid of rolling starts entirely"*). All circuits (Nordschleife, 24h Gesamtkurs, GP-Strecke, Proving Ground) utilize the universal FIA F1 5-Red-Light standing start sequence.

- **Track Scope:** Universal across all circuits (Nürburgring Nordschleife, 24h Gesamtkurs, GP-Strecke, Proving Ground).
- **Grid Placement:** Staggered FIA 2-by-2 grid boxes behind Start/Finish line (sample 0). Brakes locked, throttle launch limiter clamped to 0.15, reverse lockout engaged in 1st gear.
- **Finite State Machine:**
  ```mermaid
  stateDiagram-v2
    [*] --> GRID_FORMED: All Players Loaded
    GRID_FORMED --> LIGHT_1: T = 1.0s
    LIGHT_1 --> LIGHT_2: T = 2.0s
    LIGHT_2 --> LIGHT_3: T = 3.0s
    LIGHT_3 --> LIGHT_4: T = 4.0s
    LIGHT_4 --> LIGHT_5: T = 5.0s
    LIGHT_5 --> HOLD_DELAY: Hold for 0.4s - 2.4s (Random)
    HOLD_DELAY --> LIGHTS_OUT: Extinguish All 5 Lights
    LIGHTS_OUT --> RACING: Brakes Released, Reverse Lock Disengaged & Race Timer Active
  ```
- **Jump-Start Rule:** Forward movement $> 0.25\text{ m}$ while red lights are illuminated logs an immediate jump-start infraction ($10\text{s}$ penalty).
- **Universal Constraint:** Standing start is strictly enforced platform-wide; rolling starts are deprecated and eliminated.

---

### 6.4 Smart Near-Crash Track Recovery & Respawn System
- **Motivation:** Spawning at $s=0$ (T13 start box) after a crash 15 kilometers into the Nordschleife destroys endurance race sessions.
- **Trigger Conditions:**
  1. Manual input: Hotkey `[R]` or mobile controller `RESPAWN` button.
  2. Rollover detection: Roof normal vector $\mathbf{u}_{\text{car}} \cdot (0, 1, 0) < 0.20$ ($> 78^\circ$ tilt) sustained for $\ge 2.5\text{ seconds}$.
  3. Barrier immobilization: Zero wheel linear motion outside drivable track bounds for $\ge 4.0\text{ seconds}$.
- **Mathematical Recovery Placement:**
  1. Record vehicle crash coordinate $\mathbf{p}_{\text{crash}} = (x_c, y_c, z_c)$.
  2. Project $\mathbf{p}_{\text{crash}}$ onto the track centerline spline:
     $$s_{\text{crash}} = \operatorname{projectCenterline}(\mathbf{p}_{\text{crash}})$$
  3. Apply invariant anti-exploit offset (preventing forward travel gain):
     $$s_{\text{respawn}} = \max(0, s_{\text{crash}} - 8.0\text{ m})$$
  4. Query centerline at $s_{\text{respawn}}$ to retrieve road position $\mathbf{p}_{\text{track}}$, tangent $\mathbf{t}$, normal $\mathbf{n}$, and lateral binormal $\mathbf{b}$.
  5. Set vehicle translation:
     $$\mathbf{p}_{\text{car}} = \mathbf{p}_{\text{track}} + 0.35 \cdot \mathbf{n}$$
  6. Align vehicle heading quaternion with tangent $\mathbf{t}$ (facing downstream in racing direction).
  7. Reset dynamics: $\mathbf{v} = \mathbf{0}$, $\boldsymbol{\omega} = \mathbf{0}$, $\omega_{\text{wheel}} = 0$, gear = 1.
- **Safe Merge Ghost Invulnerability:**
  - Vehicle enters a $3.0\text{ second}$ translucent ghost state ($40\%$ opacity, cyan outline).
  - Rapier vehicle-to-vehicle collision is bypassed during the ghost window, preventing trailing high-speed competitors from colliding with the recovering car.
  - Lap validity latches to `isLapValid = false` (`LAP INVALIDATED - RESPAWN`).

---

### 6.5 Collision Engine Modes
- **Ghost Mode (Collision OFF - Default):**
  - Peer vehicles instantiate Three.js visual rigs with roof callsign pins and wheel spin animations.
  - No Rapier rigid bodies or colliders are created for remote cars.
  - Zero multiplayer contact physics desynchronization, phantom impulses, or griefing.
- **Kinematic Impulse Mode (Collision ON):**
  - Peer cars instantiate kinematic Rapier box colliders ($4.5\text{ m} \times 2.0\text{ m} \times 1.1\text{ m}$).
  - Contact impulses apply local momentum exchange with restitution coefficient $e = 0.35$.
  - Dead-reckoning position smoothing eliminates contact jitter.

---

### 6.6 Feasibility Concerns & Engineering Mitigations
1. **P2P Mesh Scalability with 16 Competitors:**
   - *Concern:* Full-mesh topology scales with $O(N^2)$ data channels ($120$ channels for 16 players), potentially saturating residential upstream bandwidth.
   - *Mitigation:* Implement hybrid distance-based telemetry culling: cars within 100 meters stream at 60 Hz; distant cars ($>100\text{ m}$) stream at 20 Hz. If grid exceeds 8 players, fallback to host-authoritative relay.
2. **Contact Physics Desynchronization:**
   - *Concern:* Latency between peers can cause asymmetric collision impulses where one car spins out and the other feels nothing.
   - *Mitigation:* Ghost Mode is set as the default and recommended experience. In Contact Mode, collision impulses are clamped to maximum deflection thresholds.
3. **Respawn Stability on Steep Banking (Karussell):**
   - *Concern:* Spawning directly on 33° concrete banking could cause raycast suspension springs to clip or violently bounce.
   - *Mitigation:* Spawning $+0.35\text{ m}$ along the local track surface normal $\mathbf{n}$ with zero linear/angular velocities and a 3.0s non-colliding ghost period allows Rapier suspension springs to compress smoothly.

---

# PART VII: PHASE 7 SPECIFICATION — MULTI-CLASS MOTORSPORT ECOSYSTEM & EXPANDED CIRCUITS

Phase 7 scales the platform into a multi-class international racing ecosystem with dynamic championship series.

---

### 7.1 Homologated Vehicle Classes & Modular BoP Layers
- **Modular 3D Ingestion vs Series BoP:**
  - One shared 3D geometry model per chassis (Draco-compressed glTF) loaded once into memory.
  - Series-specific regulatory JSON files (`*.bop.json`) configure distinct power limits, ballast, air restrictors, torque sensors, and tire models.
  - *Example:* Porsche 963 instantiates `wec_hypercar.bop.json` (FIA torque limits, MJ virtual energy tank, Michelin WEC slicks) vs `imsa_gtp.bop.json` (IMSA torque curve, VP fuel, Michelin IMSA compound).
  - *Example:* Porsche 911 GT3 R (992) instantiates `sro_gt3.bop.json` (Pirelli DHF tires, ballast, restrictor) vs `wec_lmgt3.bop.json` (driveshaft torque meters, Goodyear tires) vs `imsa_gtd.bop.json` (Michelin Pilot Sport).
- **Porsche Carrera Cup Spec Rule:**
  - Single high-fidelity Porsche 911 GT3 Cup (Type 992) model with authentic competition liveries.
  - Zero BoP variation. Strictly identical mechanics (510 HP, 4.0L Boxer, 6-speed dog-ring sequential, NO ABS, NO TC) for pure driver competition.
- **Formula 1 Base Chassis & Team Tuning Rule:**
  - Single modern ground-effect 3D base mesh with official team liveries.
  - Team-specific mathematical tuning profiles: aerodynamic drag/downforce polars (high-efficiency Red Bull spec vs high-downforce McLaren spec), power unit torque curves, and ERS electrical harvest/deploy mappings.

---

### 7.2 Championship Series & Feeder Systems
1. **FIA World Endurance Championship (WEC):** Hypercar (9 manufacturers) + LMGT3 (9 manufacturers).
2. **IMSA WeatherTech SportsCar Championship:** GTP, LMP2 (Oreca 07 Gibson spec), GTD PRO, GTD.
3. **GT World Challenge Europe:** Pure FIA GT3 (Sprint & Endurance Cups).
4. **European Le Mans Series (ELMS) & Mini-Le Mans:** LMP2 (full 600 HP V8), LMP3 (Ligier/Duqueine Nissan V8), LMGT3, Asian Le Mans, Michelin Le Mans Cup.
5. **Porsche Carrera Cup:** Single-make spec 992 GT3 Cup.
6. **Formula 1 World Championship:** 10 team-tuned single-seaters across 24 global circuits.

---

### 7.3 Master Circuit Calendar Across All Series
Complete roster of 27 surveyed international circuits:
- **Europe:** Nürburgring Nordschleife (20.7 km, Active), 24h Gesamtkurs (25.4 km, Active), GP-Strecke (5.1 km, Active), Circuit de la Sarthe / Le Mans (13.6 km), Spa-Francorchamps (7.0 km), Monza (5.8 km), Imola (4.9 km), Paul Ricard (5.8 km), Barcelona-Catalunya (4.7 km), Brands Hatch (3.9 km), Silverstone (5.9 km), Monaco (3.3 km), Hockenheimring (4.6 km), Zandvoort (4.3 km), Red Bull Ring (4.3 km), Hungaroring (4.4 km), Mugello (5.2 km), Portimão (4.7 km).
- **North America:** Daytona Road Course (5.7 km), Sebring (6.0 km), Watkins Glen (5.5 km), Laguna Seca (3.6 km), Road America (6.5 km), Road Atlanta (4.1 km), COTA (5.5 km), Long Beach (3.2 km), Mosport (4.0 km), VIR (5.3 km), Indianapolis (3.9 km), Montreal (4.4 km).
- **Asia / Middle East / Oceania:** Suzuka (5.8 km), Fuji (4.6 km), Mount Panorama / Bathurst (6.2 km), Interlagos (4.3 km), Bahrain (5.4 km), Lusail (5.4 km), Yas Marina (5.3 km), Dubai Autodrome (5.4 km), Sepang (5.5 km).

---

# PART VIII: MILESTONES & DECISION LOG

```
Phase 1: Proving Ground MVP (Completed & Verified)
├── M1.1: Local HTTPS & Binary WebSocket Infrastructure [DONE]
├── M1.2: Mobile Controller Client (Zero-flip tilt + split touch) [DONE]
├── M1.3: Vehicle Physics Core (Rapier 3D 240 Hz + 992 RSR profile) [DONE]
├── M1.4: Dynamic Cockpit Camera & Rear-View Mirror [DONE]
└── M1.5: High-Speed Proving Ground & Audio Synthesis [DONE]

Phase 2: Dedicated Nürburgring Nordschleife (Completed & Verified)
├── M2.1: Mathematical 20,832m centerline spline & topography [DONE]
├── M2.2: 11-Chunk partition system & 100m collision overlaps [DONE]
├── M2.3: Active 3-chunk window streamer & Rapier trimesh swapping [DONE]
├── M2.4: Floating origin manager [DONE]
├── M2.5: Spline projection & start/finish lap timing [DONE]
└── M2.6: Dedicated Main Menu, Interactive 3D Turntable Showroom & Session Lock [DONE]

Phase 3: Advanced Motorsport Systems (Paused & Merged into Phase 5)
├── M3.1: Thermal brake fade (>750°C) baseline [DONE]
├── M3.2: Recessed high-output endurance headlights (280m range) & brake lights in 3D model [DONE]
├── M3.3: Dynamic day/night cycle, exterior-only 3D rain emitter & 2D drying line [DONE]
└── M3.4: 9-sector timing splits (+/- delta HUD) & local ghost car [DONE]

Phase 4: Private Multiplayer, Start Procedures & Track Recovery (Paused / Moved to Phase 6)
├── M4.1: Private 4-digit code lobby signaling & room join pipeline [DONE]
├── M4.2: Host race configuration (laps, competitors, collision toggle, circuit) [DONE]
├── M4.3: Universal FIA F1 5-red-light standing start state machine with launch clamp & jump-start detection [DONE]
├── M4.4: Complete removal of rolling starts across all circuits in favor of universal 2x2 grid standing start [DONE]
└── M4.5: Smart near-crash track recovery respawn with anti-exploit offset & 3s ghost invulnerability [DONE]

Phase 5: Nürburgring & Simulation Realism - Assetto Corsa Competizione Level (Completed & Verified)
├── M5.1: Topographical elevation recalibration & steep gradient dynamics (301.6m drop, 33.0° Karussell) [DONE]
├── M5.2: Multi-layer dense Eifel forest immersion & roadside canopy engine (1,379 trees/chunk) [DONE]
├── M5.3: Trackside assets (FIA catch fencing, tire barriers, sponsor bridges) [DONE]
├── M5.4: Thickened safety barriers (>=0.5m) & Continuous Collision Detection (CCD) [DONE]
├── M5.5: Dedicated drivable pit lane, concrete pit wall & 10+ pit box stalls with 60 km/h limiter [DONE]
├── M5.6: HUD radar & flag cleanup (remove fake dots/flags, retain PB ghost car dot) [DONE]
├── M5.7: Vehicle physical realism (tyre wear, dynamic fuel mass, brake thermal curves) [DONE]
├── M5.8: Visual & lighting realism (diffuse rear lights, sunset/dawn overhaul, 24-hour cycle) [DONE]
├── M5.9: Track and vehicle creation engineering manual (`docs/skills.md`) [DONE]
├── M5.10: Anti-nausea cockpit camera VOR horizon lock & chassis bump vibration [DONE]
├── M5.11: Non-jagged smooth C2 spline geometry with procedural multi-band surface bumps [DONE]
└── M5.12: Dedicated sound design pipeline & headphone-safe gearbox whine filtering [DONE]

Phase 6: Private Multiplayer & Dynamic Race Procedures (Paused)
├── M6.1: Private 4-digit code lobby signaling & room join pipeline
├── M6.2: Host race configuration (laps, competitors, collision toggle, circuit)
├── M6.3: Universal FIA F1 5-red-light standing start state machine with launch clamp
├── M6.4: Complete removal of rolling starts across all circuits
└── M6.5: Smart near-crash track recovery respawn with anti-exploit offset & 3s ghost invulnerability

Phase 7: Multi-Class Motorsport Ecosystem & Dynamic Series (Roadmap Outlined)
├── M7.1: Multi-class vehicle physics homologation (LMH, GT3, Formula 1, Cup, GT4)
├── M7.2: International circuit expansion (Spa, Monza, Le Mans, Suzuka, Mount Panorama)
└── M7.3: Dynamic multi-tier championship series hub & career menu evolution

Roman Numeral Track: Online Cloud Infrastructure & Community Competition
├── Phase I: Driver Identity, Cloud Persistence & Global Hotlap Leaderboard (Completed & Validated)
│   ├── MI.1: Driver accounts, passkey/auth, and session pairing [DONE]
│   ├── MI.2: Player activity & lifetime stats database (km, top speed, favorite car) [DONE]
│   ├── MI.3: Multi-dimensional global hotlap leaderboard (track/category/weather/device) [DONE]
│   └── MI.4: Serverless anti-cheat monotonic sector validation & WR ghost downloads [DONE]
├── Phase II-A: Emergency 3-Player Serverless WebRTC Multiplayer & Jitter-Free Interpolation (Ready)
│   ├── MII-A.1: Serverless WebRTC signaling broker on Vercel (/api/signal/join, /api/signal/send, /api/signal/poll)
│   ├── MII-A.2: Direct phone-to-desktop WebRTC DataChannel pairing via 6-digit session token
│   ├── MII-A.3: 56-byte binary telemetry packet (pos, quat, vel [vx, vy, vz], speed, steer, wheelSpin)
│   ├── MII-A.4: 100ms snapshot ring buffer with Hermite cubic spline trajectory interpolation & velocity dead reckoning
│   ├── MII-A.5: Pure invariant Ghost Mode (zero Rapier rigid body contact, zero phantom collision desync)
│   └── MII-A.6: Host single-circuit synchronization & synchronized FIA 5-red-light standing start
├── Phase II-B: Cloud-Relayed WebRTC Multiplayer (PartyKit / Durable Objects)
├── Phase III: Driver Rating & Safety Rating (Elo / SR matchmaking)
├── Phase IV: Cloud Telemetry & MoTeC-Style Analysis (in-browser trace overlays)
└── Phase V: Cloud Livery Workshop & Social Showcase (gallery & community upvotes)
```

### Roman Numeral Track Feasibility Analysis
1. **Serverless Database & Connection Pool:** Leaderboard writes and player stat telemetry run on edge/serverless endpoints (`/api/laps`, `/api/profile`). To prevent cold-start latency and connection exhaustion under concurrent drivers, utilize serverless Postgres (Neon / Supabase) with HTTP/WebSocket connection pooling.
2. **Anti-Cheat Validation for Client-Side Physics:** Because Rapier 3D simulation executes client-side, hotlap submissions require strict cryptographic and physical boundary checks:
   - Sector monotonic timing: Total lap time must exactly equal the sum of intermediate sector checkpoint splits.
   - Homologation envelopes: Submissions must satisfy minimum sector duration and top speed constraints for the car class.
   - Compressed trajectory payloads: Top 100 global records must submit 30 Hz compressed position and yaw keyframes for automated boundary sanity checking and public ghost download.
3. **Multi-Tenant Controller Pairing on Serverless Hosting:** Vercel serverless functions cannot host persistent stateful WebSockets. Account-based pairing matches desktop and phone via authenticated session tokens, using WebRTC DataChannels with serverless signaling (PartyKit / Supabase Realtime) for sub-5ms low latency.

### Open Questions Status
All architectural questions (Q1–Q21, Q-N1–Q-N6) are resolved and recorded in [idea.md](idea.md#10-decision-log). Roman Numeral Phase I and Phase 5 simulation realism requirements are codified with zero open blockers.
