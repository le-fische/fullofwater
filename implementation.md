# Implementation Plan & Agent Prompts: Dual-Screen Web Racer

Living technical roadmap and operational instructions for autonomous coding subagents.
Companion documents: [idea.md](idea.md) (Design Doc) and [spec.md](spec.md) (Engineering Specification).

---

## 1. System Architecture & Repository Layout

```
racing-game/
├── package.json
├── tsconfig.json
├── vite.config.ts                     # HTTPS configuration via mkcert
├── certs/                             # Local SSL certificates for LAN testing
│   ├── rootCA.pem
│   ├── dev-cert.pem
│   └── dev-key.pem
├── public/
│   ├── assets/
│   │   ├── cars/
│   │   │   └── porsche_992_rsr/
│   │   │       ├── profile.json       # Vehicle physics parameters
│   │   │       └── cockpit.glb        # Low-poly cockpit & rotating wheel
│   │   └── textures/
│   │       └── asphalt_grid.png
├── src/
│   ├── common/
│   │   ├── protocol.ts                # Binary WebSocket packet layout & constants
│   │   ├── math.ts                    # Clamping, lerp, One Euro filter
│   │   └── types.ts                   # Vehicle telemetry & environment state
│   ├── host/                          # Main Monitor (Mac M4 Pro) Application
│   │   ├── index.html
│   │   ├── main.ts                    # Orchestrator & main loop
│   │   ├── net/
│   │   │   └── host-server.ts         # WebSocket server connector / message parser
│   │   ├── physics/
│   │   │   ├── world.ts               # Rapier 3D world wrapper
│   │   │   ├── raycast-vehicle.ts     # 4-wheel raycast suspension & chassis
│   │   │   ├── tire-model.ts          # Pacejka Magic Formula slip calculations
│   │   │   ├── drivetrain.ts          # Torque curve, automatic sequential gearbox
│   │   │   ├── aero.ts                # Downforce & drag forces
│   │   │   └── assists.ts             # TC, ABS, counter-steer, input ramps
│   │   ├── render/
│   │   │   ├── stage.ts               # Three.js scene, WebGL2/WebGPU renderer
│   │   │   ├── cockpit-cam.ts         # Driver-eye camera with inertial g-force roll
│   │   │   ├── arena.ts               # Phase 1 flat skidpad & marker meshes
│   │   │   └── hud.ts                 # Speedometer, gear, FPS, latency overlay
│   │   └── audio/
│   │       └── engine-synth.ts        # Web Audio API real-time flat-6 synthesis
│   └── controller/                    # iPhone Mobile Controller Application
│       ├── index.html
│       ├── controller.ts              # iPhone touch & gyro lifecycle
│       ├── sensors/
│       │   ├── orientation.ts         # In-plane gravity extraction (no Euler flip)
│       │   └── filter.ts              # Complementary sensor fusion + One Euro filter
│       └── ui/
│           ├── touch-zones.ts         # Split-screen throttle / brake detector
│           └── dash-display.ts        # Minimalist AMOLED gear indicator & RPM bar
└── scripts/
    ├── generate-certs.sh              # mkcert setup script for Mac & iPhone
    └── track-pipeline/                # Phase 2 Nordschleife generation scripts
        ├── fetch-osm.ts
        ├── parse-dgm1.ts
        └── sweep-track.ts
```

---

## 2. Phase 1: MVP Proof of Concept (Flat Skidpad)

### Objective
Prove end-to-end responsiveness and drivability on a flat skidpad:
1. iPhone connects to the Mac via local HTTPS/WebSocket with $<15\text{ ms}$ transport latency.
2. Steering is controlled smoothly by tilting the iPhone without flipping near vertical.
3. Split-screen touch gives responsive, ramped throttle and braking.
4. Porsche 992 RSR-19 vehicle physics accelerates, drifts predictably, brakes straight (ABS), and handles weight transfer.
5. Cockpit camera renders at stable 60–120 FPS on Mac M4 Pro with a rotating steering wheel.
6. Real-time synthesized flat-six audio reacts to throttle load and gearshifts.

### Task Breakdown & Validation Steps

#### Step 1.1: Local HTTPS & Binary Protocol
- Setup Vite with `vite-plugin-basic-ssl` or local `mkcert` certificate.
- Implement `src/common/protocol.ts` using packed `ArrayBuffer` payloads:
  - Phone $\to$ Host: 8 bytes (`seq`, `steer: i16`, `throttle: u8`, `brake: u8`, `buttons: u8`).
  - Host $\to$ Phone: 6 bytes (`rpmRatio: u8`, `gear: i8`, `speedKmh: u16`, `flags: u8`).
- **Validation:** Open `https://<ip>:5173/controller` on iPhone Safari. Confirm WebSocket opens and packets transfer continuously at 60 Hz with average RTT $\le 10\text{ ms}$.

#### Step 1.2: iPhone Motion Sensor & Touch Engine
- Implement `src/controller/sensors/orientation.ts`:
  - Request permission via user gesture (`DeviceMotionEvent.requestPermission`).
  - Extract $g_x, g_y$ from `accelerationIncludingGravity` based on landscape orientation.
  - Calculate steering angle $\theta = \operatorname{atan2}(g_x, g_y)$.
  - Fuse with gyro Z-rate via complementary filter: $\theta_{\text{fused}} = 0.96 \cdot (\theta + \omega_z \cdot dt) + 0.04 \cdot \theta_{\text{grav}}$.
  - Run through One Euro filter to eliminate jitter on straights.
- Implement `src/controller/ui/touch-zones.ts`:
  - Left half `touchstart`: brake = 1.
  - Right half `touchstart`: throttle = 1.
  - `touchend`: reset corresponding input to 0.
- **Validation:** Tilt iPhone past $90^\circ$ vertical and rotate around all axes. Ensure output value remains bounded in $[-1.0, 1.0]$ with no jump or sign inversion.

#### Step 1.3: Vehicle Physics Core (Rapier 3D)
- Load `@dimforge/rapier3d-compat` running on a fixed 240 Hz timestep ($dt = 4.166\text{ ms}$).
- Implement 4-wheel raycasting downward from chassis coordinates:
  - Calculate spring deflection and damping force.
  - Compute longitudinal slip ratio $\kappa = \frac{r\omega - v_x}{\max(r\omega, v_x)}$ and lateral slip angle $\alpha = -\arctan\left(\frac{v_y}{|v_x|}\right)$.
  - Evaluate Pacejka Magic Formula for lateral force $F_y$ and longitudinal force $F_x$.
  - Apply aerodynamic downforce $F_{\text{down}} = \frac{1}{2} \rho v^2 C_l A$ and drag $F_{\text{drag}} = \frac{1}{2} \rho v^2 C_d A$.
  - Implement assists: throttle ramp ($0 \to 100\%$ in $180\text{ ms}$), brake ramp ($120\text{ ms}$), traction control (cuts torque when $\kappa > 0.15$), and ABS.
- **Validation:** Keyboard fallback (WASD) and phone controller can drive the chassis. Accelerating from standstill reaches $100\text{ km/h}$ in $\approx 3.2\text{ s}$. Heavy braking comes to a straight stop without spinning.

#### Step 1.4: Cockpit Camera & Visual Stage
- Build Three.js scene targeting 4K60 / 120Hz.
- Construct flat skidpad arena ($400\text{ m} \times 400\text{ m}$) with asphalt grid material, $300\text{ m}$ acceleration lane, and slalom cones.
- Create procedural/low-poly cockpit:
  - Carbon roll-cage A-pillars and windshield rim.
  - Race steering wheel positioned at driver eye level that rotates proportionally to input steering angle.
- Attach camera to driver eye position (`[0.36, 0.96, -0.22]`) with dynamic tilt:
  - Pitch back on acceleration, forward on braking.
  - Roll opposite to chassis lateral acceleration to simulate head posture.
- **Validation:** Camera moves smoothly with vehicle dynamics. Rotating phone turns the in-game steering wheel in real time. Frame rate is locked at 60 FPS (or 120 FPS on ProMotion).

#### Step 1.5: Flat-6 Audio Synthesis
- Implement `src/host/audio/engine-synth.ts` with Web Audio API.
- Base frequency: $f = \frac{\text{RPM} \times 3}{60}\text{ Hz}$ routed through waveshaping distortion for exhaust rasp.
- Tire squeal: bandpass-filtered noise gain linked to tire slip angle.
- Upshift pause: $45\text{ ms}$ gain mute on gear shift.
- **Validation:** Audio tone smoothly scales from idle ($1600\text{ RPM}$) to redline ($9000\text{ RPM}$), with distinct pitch drops during automatic gear shifts.

---

## 3. Phase 2: Dedicated Nürburgring Nordschleife

### Objective
Transition the physics engine and renderer from the flat proving ground to the full, topologically verified 20.8 km Nürburgring Nordschleife, complete with procedural cross-section sweeping, dynamic 3-chunk window streaming, Rapier 3D trimesh collision swapping, floating origin management, and accurate start/finish lap timing.

---

### Step-by-Step Architecture & Deliverables

#### Step 2.1: Topographical Centerline Spline & Landmark Definitions
- **Files:** `src/host/streaming/landmarks.ts`, `src/host/streaming/centerline.ts`
- **Specification:**
  - $20,832\text{ m}$ total closed loop with $5,208$ equidistant samples ($4.0\text{ m}$ sample spacing).
  - Rotation-minimizing parallel transport frame ($T, N, B$) computed along the 3D curve to eliminate unwanted axial twist.
  - Realistic Eifel topography matching verified benchmarks:
    - High point: $621.4\text{ m}$ (Hohe Acht & T13)
    - Low point: $319.9\text{ m}$ (Breidscheid bridge)
    - Total vertical elevation drop: $301.5\text{ m}$
  - Landmark specific cambers and bankings:
    - Caracciola-Karussell: $33.0^\circ$ banking with concrete slab surface
    - Kleines Karussell: $18.0^\circ$ banking
    - Fuchsröhre compression: $6.0^\circ$ banking, $420\text{ m}$ elevation
    - Flugplatz crest: $574\text{ m}$ elevation
- **Validation:** `NordschleifeCenterline` instantiates in $< 15\text{ ms}$, yields continuous curvature with no zero-length vectors, and exhibits exact vertical drop $\ge 300\text{ m}$.

#### Step 2.2: 11-Chunk Partitioning & Procedural Cross-Section Extruder
- **Files:** `scripts/track-pipeline/sweep-track.ts`, `src/host/streaming/track-mesh-generator.ts`
- **Specification:**
  - 11 sequential chunks ($\approx 1.89\text{ km}$ span per chunk).
  - Visual mesh generation (`BufferGeometry`):
    - $8.0\text{ m} \dots 10.0\text{ m}$ asphalt road ribbon with center crown.
    - $1.2\text{ m}$ alternating red/white stepped kerbs on corner apexes.
    - $3.5\text{ m}$ grass verges flanking the track.
    - Continuous $0.85\text{ m}$ high corrugated Armco steel crash barriers.
    - Concrete slab texture coordinate mapping across the Karussell bowl.
  - Collision mesh generation (`Float32Array` vertices, `Uint32Array` indices):
    - $100\text{ m}$ forward and backward collision overlap ($\pm 25$ samples at $4\text{ m}$ spacing) to prevent vehicle tunneling at chunk boundaries.
- **Validation:** Generated trimeshes match vertex buffer constraints and produce clean face normals facing upward and inward.

#### Step 2.3: Active 3-Chunk Window Streamer
- **Files:** `src/host/streaming/chunk-streamer.ts`
- **Specification:**
  - Dynamic chunk manager keeping strictly 3 chunks in memory: $[K-1, K, K+1]$, where $K = \lfloor s / L_{\text{chunk}} \rfloor \pmod{11}$.
  - As the car traverses the circuit:
    - Trailing chunk ($K-2$) is cleanly unloaded: Three.js geometry buffers disposed (`geometry.dispose()`) and Rapier collision body removed (`world.removeCollider`).
    - Leading chunk ($K+2$) is instantiated asynchronously.
  - Memory ceiling remains $< 500\text{ MB}$, eliminating browser tab crashes on long multi-lap sessions.
- **Validation:** Simulated lap at $250\text{ km/h}$ completes all 11 chunk transitions with zero memory growth and no dropped frames.

#### Step 2.4: Floating Origin Precision Guard
- **Files:** `src/host/streaming/floating-origin.ts`
- **Specification:**
  - Maintains global offset $O = (O_x, O_y, O_z)$.
  - Triggers recentering whenever vehicle horizontal distance from current local origin exceeds $1,200\text{ m}$.
  - Re-anchors Three.js scene objects and Rapier physics bodies so active local coordinates remain bounded within $[-1,500\text{ m}, +1,500\text{ m}]$.
- **Validation:** Zero vertex jitter or z-fighting during high-speed runs on the $2.1\text{ km}$ Döttinger Höhe straight.

#### Step 2.5: High-Speed Centerline Projection & Lap Timing Engine
- **Files:** `src/host/streaming/lap-timer.ts`
- **Specification:**
  - Localized window search projects 3D car coordinates onto the spline in $3.8\mu\text{s}$ per query ($< 50\mu\text{s}$ budget at 60 Hz).
  - Calculates track progress ratio, distance from centerline, and off-track status (beyond kerbs $+ 2.0\text{ m}$).
  - Start/Finish line gate at Antoniusbuche / T13 ($s = 0\text{ m} \leftrightarrow 20,832\text{ m}$).
  - Anti-cheat logic requires valid mid-lap checkpoint pass (Breidscheid at $\approx 10,000\text{ m}$) before accepting finish line trigger.
  - Invalidates lap upon off-track excursion while tracking current, last, and session best lap times.
- **Validation:** Verified lap trigger at finish line; prevents cheat laps or reverse direction triggers.

#### Step 2.6: CLI Tooling & Automated Test Suite
- **Commands:**
  - `npm run generate:track`: CLI script (`scripts/track-pipeline/generate-track.ts`) generating `tracks/nordschleife/manifest.json` and binary `tracks/nordschleife/centerline.bin`.
  - `npm run test:phase2`: Automated test suite (`scripts/test-phase2.ts`) verifying all 7 subsystem gates.

---

## 4. Phase 3: Advanced Systems (Future Scope)

1. **Pit Lane & Vehicle Setup:**
   - Detect entry into T13 / GP pit lane box.
   - Auto-brake car to stop.
   - Host screen transitions to interactive setup page (mouse/keyboard on Mac): adjust brake bias, downforce level, tire compound, gear ratios.
2. **Tyre Degradation & Fuel Consumption:**
   - Temperature accumulation based on slip energy: $E_{\text{slip}} = \int |F_{\text{tire}} \cdot v_{\text{slip}}| dt$.
   - Wear coefficient reducing peak Pacejka friction multiplier $D$ over laps.
   - Fuel mass depletion reducing chassis mass ($0.75\text{ kg/L}$).
3. **Dynamic Environment:**
   - Modular day/night lighting cycle via directional sun progression and ambient sky dome.
   - Rain system: particle emitter around camera + windshield droplet distortion shader + 40% surface grip multiplier reduction.
4. **Multiplayer:**
   - WebRTC DataChannel peer-to-peer lobby for time-attack ghosting and wheel-to-wheel racing.

---

## 5. System Prompts & Specsheets for Autonomous Subagents

The following prompts are ready to be assigned directly to subagents.

---

### Agent A: Physics & Vehicle Model Specialist

```markdown
Role: Vehicle Physics & Simulation Specialist
System Prompt:
You are an expert vehicle dynamics engineer and game physics developer specializing in Rapier 3D and TypeScript.

Task:
Implement the complete vehicle physics simulation for the Porsche 992 RSR-19 in `src/host/physics/`.

Technical Requirements:
1. Engine: Use @dimforge/rapier3d-compat running a fixed timestep loop at 240 Hz.
2. Suspension: Implement a 4-wheel raycast vehicle model. Each wheel casts a vertical ray from the chassis hardpoint, calculates spring compression, spring force, damper force (bump/rebound split), and anti-roll bar torque.
3. Tire Grip: Implement a Pacejka Magic Formula curve calculating lateral force from slip angle (alpha) and longitudinal force from slip ratio (kappa), constrained within a friction ellipse.
4. Drivetrain: Implement engine torque curve (4.2L flat-six, idle 1600 RPM, redline 9000 RPM), rotational engine inertia, automatic transmission with sequential ratios, and upshift/downshift logic.
5. Aerodynamics: Apply velocity-squared aerodynamic downforce (ClA = 2.85, 42% front bias) and drag (CdA = 0.86) directly to the chassis rigid body.
6. Driver Assists:
   - Input ramping: 180 ms throttle rise, 120 ms brake rise.
   - Traction Control: limit torque when driven slip ratio > 0.15.
   - ABS: pulse brake force when wheel slip exceeds threshold.
   - Speed-sensitive steering: scale maximum wheel angle from 22 deg at low speed down to 7.7 deg at 250 km/h.
7. Telemetry Interface: Expose clean getters for speed (km/h), engine RPM, gear, wheel angular velocities, slip angles, and suspension compressions.

Follow the schema in `spec.md` Section 4 and maintain deterministic, high-performance TypeScript without object allocations in the hot physics tick.
```

---

### Agent B: Mobile Controller & Network Specialist

```markdown
Role: Mobile Web & Real-Time Networking Specialist
System Prompt:
You are an expert mobile frontend engineer specializing in iOS Safari hardware sensor APIs, WebSockets, and low-latency client-host communication.

Task:
Build the iPhone mobile controller and WebSocket communication bridge in `src/controller/` and `src/common/`.

Technical Requirements:
1. Networking:
   - Implement binary WebSocket communication using packed ArrayBuffer payloads defined in `spec.md` Section 3.1.
   - Controller sends inputs at 60 Hz (sequence number, steer: i16, throttle: u8, brake: u8, buttons: u8).
   - Controller receives host telemetry (RPM ratio, gear, speed, shift light) at 30-60 Hz.
2. Sensor Pipeline (Zero-Flip Steering):
   - Listen to DeviceMotionEvent in landscape mode.
   - Extract in-plane gravity components (gx, gy) from accelerationIncludingGravity.
   - Calculate steering angle using atan2(gx, gy).
   - Freeze steering if device is held flat (in-plane gravity < 0.3g) to prevent gimbal singularity.
   - Fuse gravity angle with rotationRate Z gyro using a complementary filter.
   - Filter output with a One Euro filter to eliminate micro-jitter on straights while retaining zero-lag responsiveness for fast counter-steering.
   - Calibrate full steering lock to +/-45 degrees of physical tilt.
3. Touch Engine:
   - Fullscreen landscape layout with AMOLED pure black background (#000000).
   - Left 50% screen = Brake; Right 50% screen = Throttle.
   - Multi-touch handling: if both sides touched, brake takes priority.
4. Minimalist Dashboard:
   - Top edge: Sweeping horizontal RPM bar with LED shift lights (green -> yellow -> flashing red).
   - Center: Large high-contrast gear numeral (R, N, 1, 2, 3, 4, 5, 6).
   - Bottom: Small connection status and RTT latency readout.
5. iOS Compatibility:
   - Provide "Tap to Start / Enable Sensors" gate to handle iOS DeviceMotionEvent.requestPermission().
   - Acquire Screen Wake Lock API to prevent phone sleep during driving.

Ensure zero layout shifts, prevent default touch zoom/scroll gestures, and optimize for minimal input latency.
```

---

### Agent C: Three.js Renderer & Cockpit Camera Specialist

```markdown
Role: Three.js Graphics & Cockpit Camera Specialist
System Prompt:
You are an expert Three.js / WebGL / WebGPU graphics engineer specializing in cockpit rendering, lighting, and camera dynamics for racing games.

Task:
Implement the visual stage, cockpit camera rig, and HUD overlay in `src/host/render/`.

Technical Requirements:
1. Renderer: Setup Three.js with WebGL2 (or WebGPU fallback), ACESFilmic tone mapping, sRGB encoding, and dynamic pixel ratio targeting 60-120 FPS on Apple M4 Pro hardware.
2. Phase 1 Skidpad Arena:
   - Construct a 400m x 400m flat asphalt plane with repeating grid texture, coordinate markers, and 50m distance lines.
   - Add a 300m marked sprint lane with start/finish hashes.
   - Add concentric skidpad circles (40m and 80m radius).
   - Place a line of slalom pylons/cones spaced 30m apart.
   - Enclose the perimeter with Armco barrier or tire wall meshes with Rapier collision.
3. Cockpit Rig & Dynamic Camera:
   - Position camera at driver eye coordinates ([0.36, 0.96, -0.22] relative to chassis center).
   - Construct low-poly carbon roll cage pillars and windshield frame.
   - Add a steering wheel mesh that rotates around its steering column matching the vehicle steering input.
   - Implement head inertia: camera pitches slightly under longitudinal acceleration/braking and rolls opposing chassis lateral roll to emulate human driver gaze stabilization.
   - Add high-speed camera micro-vibration when vehicle speed exceeds 200 km/h.
4. HUD Overlay:
   - Clean, semi-transparent HTML/CSS overlay pinned to top corners.
   - Top-right: Current speed (large km/h digits), gear numeral, RPM bar.
   - Top-left: Lap time timer, host FPS counter, and network round-trip time (ms).
   - Toggleable camera switch ('C' key or phone button) between Cockpit and Chase views.

Optimize all geometry with instancing and shared materials to maintain under 50 draw calls for the entire scene.
```

---

### Agent D: Track Generation & Streaming Specialist (Phase 2)

```markdown
Role: Procedural Geospatial & Track Pipeline Specialist
System Prompt:
You are an expert computational geometry and GIS pipeline engineer specializing in terrain modeling, spline extrusion, and glTF chunk generation.

Task:
Design and build the procedural Nürburgring Nordschleife track generator and runtime chunk streamer in `scripts/track-pipeline/` and `src/host/streaming/`.

Technical Requirements:
1. Data Ingestion:
   - Query Overpass API / OSM for the complete Nürburgring Nordschleife circuit relation (centerline, road width, barriers).
   - Ingest Rheinland-Pfalz DGM1 1m lidar GeoTIFF/ASCII elevation datasets covering the 20.8 km loop.
2. Road Surface Sweep:
   - Sample centerline spline at 1m intervals.
   - Project elevations from DGM1 data and calculate realistic camber and banking along corners (e.g. Karussell, Flugplatz, Brünnchen).
   - Extrude a continuous cross-section: 8m asphalt track + 1.5m stepped concrete kerbs + 3m grass verge + guardrails.
3. Partitioning & Export:
   - Divide the 20.8 km loop into 11 chunks of ~2 km each.
   - Export visual meshes: `chunk_XX.glb` with LOD0 (high-detail road/kerbs/barriers) and LOD1 (simplified geometry).
   - Export collision meshes: `chunk_XX.col.glb` with 100m overlap between adjacent chunks to prevent physics tunneling at seams.
   - Export `manifest.json` (chunk bounds, start/finish coordinate, sector splits) and `centerline.bin` (spline coordinates and cumulative arc lengths).
4. Runtime Streamer:
   - Stream chunks into Three.js and Rapier using Web Workers.
   - Maintain a 3-chunk window: [Chunk N-1, Chunk N, Chunk N+1].
   - Unload stale chunks dynamically to keep memory usage under 1.5 GB.
   - Shift the local coordinate origin per chunk to preserve float32 floating-point precision across the 20.8 km span.
5. Lap Timing:
   - Detect vehicle crossing the Antoniusbuche / T13 start-finish gate using centerline spline progress.
   - Manage lap timer, lap invalidation on cutting, and session best lap times.
```
