# Implementation Plan & Agent Prompts: Full of Water

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

## 4. Phase 3: Advanced Motorsport Systems (Paused & Merged into Phase 5)

> **Status:** Paused per user directive. Core vehicle physical simulation systems (tyre degradation, dynamic fuel depletion, thermal brake efficiency) are directly merged into Phase 5: Nürburgring & Simulation Realism.

---

## 5. Phase 5: Nürburgring & Simulation Realism (Assetto Corsa Competizione Level) Implementation Architecture

### Objective
Elevate the Nürburgring circuit and Porsche 911 RSR simulation to Assetto Corsa Competizione (ACC) standards of visual fidelity, trackside atmosphere, and physical authenticity.

### Step-by-Step Architecture & Deliverables
#### Step 5.1: Topographical Elevation Recalibration & Vertical Dynamics
- Ingest and un-flatten authentic surveyed elevation profile in `tracks/nordschleife/` with genuine $306.8\text{ m}$ vertical drop (Breidscheid $320.0\text{ m}$ to Hohe Acht $626.8\text{ m}$).
- Restore sustained $11.7\%$ Fuchsröhre plunge with massive vertical G-compression at the valley trough, climbing up to Adenauer Forst.
- Restore continuous $300\text{ m}$ Bergwerk mountain climb and authentic banking (33.0° Karussell bowl, 22.0° Kleines Karussell).
- Calibrate vertical spline curvature at Flugplatz and Pflanzgarten to produce authentic chassis unweighting without raycast contact loss.

#### Step 5.2: Multi-Layer Dense Forest Immersion & Roadside Canopy Engine
- Enhance `ForestFoliage` in `src/host/render/` to generate dense multi-layer forest walls lining both sides of the circuit:
  - Layer 1: Roadside shrubs, grass tufts, and young spruce behind Armco ($5.5\text{ m} \dots 10.0\text{ m}$).
  - Layer 2: Mature Scots pine, Norway spruce, and European beech trees ($10.0\text{ m} \dots 28.0\text{ m}$) with foliage canopies overhanging track edges.
  - Layer 3: Mountain forest backdrop extending $28.0\text{ m} \dots 75.0\text{ m}$ up mountain ridges.
- Global 2D spatial clearance hash grid strictly enforcing $|d_{\text{lateral}}| \ge w_{\text{track}} / 2 + 5.5\text{ m}$ clearance from all track segments, eliminating loop bleed-through.
- GPU instancing via `THREE.InstancedMesh` with distance-based cross-quad billboard LODs beyond $150\text{ m}$ maintaining locked 60–120 FPS on Apple M4 Pro hardware.

#### Step 5.3: Trackside Asset Expansion (Catch Fencing, Red/White Barriers & Sponsor Bridges)
- Construct FIA debris catch fences: $2.5\text{ m}$ steel vertical support stanchions supporting dark steel wire mesh safety cages mounted directly atop Armco barriers.
- Place red-and-white striped tire barriers and Tecpro energy-absorbing blocks at acute-angle runoff zones (Aremberg, Adenauer Forst, Wehrseifen, Brünnchen, Hohenrain).
- Ingest overhead sponsor bridges: Bilstein Bridge at Döttinger Höhe ($s \approx 19,200\text{ m}$), Audi, Yokohama, and Dunlop overhead bridges on Grand Prix straight and Nordschleife approaches.

#### Step 5.4: Thickened Safety Barriers & Continuous Collision Detection (CCD)
- Extrude barrier colliders as continuous 3D collision volumes with minimum depth $t \ge 0.50\text{ m}$ behind the Armco face.
- Enable Continuous Collision Detection on the Rapier chassis rigid body:
  ```typescript
  bodyDesc.setCcdEnabled(true);
  ```
- Swept-sphere time-of-impact (TOI) calculations eliminate barrier noclipping and tunneling on high-speed ($300+\text{ km/h}$) impacts.

#### Step 5.5: Authentic Dedicated Drivable Pit Lane, Pit Wall Divider & Pit Box Architecture
- Construct physically dedicated pit lane geometry running parallel to Start-Ziel straight, partitioned by continuous concrete pit wall ($h = 1.05\text{ m}, w = 0.45\text{ m}$) with safety fencing and team pit perches.
- Distinct angled deceleration entry lane with painted chevrons, $7.5\text{ m}$ concrete pit apron, 10+ marked team pit stalls ($6.5\text{ m} \times 3.2\text{ m}$) with overhead fuel/air lollipop gantries, and acceleration exit blend lane.
- Automated $60\text{ km/h}$ pit speed limiter trigger volume with controller/HUD toggle (`[L]`), staccato engine cut audio, and stationary pit service timer.

#### Step 5.6: HUD Radar & Flag Cleanup
- Remove broken placeholder yellow flag triggers and flashing sector warnings from HUD.
- Remove synthetic moving AI competitor dots from HUD radar and cockpit micro-radar.
- Strictly retain player's own personal best ghost car blip/silhouette on radar during timed hotlaps.

#### Step 5.7: Full Vehicle Physical Realism (Assetto Corsa Standard)
- Slip-energy tyre wear model in `RaycastVehicle.ts` reducing peak Pacejka friction coefficient $D$ progressively over laps:
  $$D(t) = D_{\text{fresh}} \cdot \left(1.0 - k_{\text{wear}} \cdot \frac{E_{\text{accum}}}{E_{\max}}\right)$$
- Dynamic fuel mass depletion: fuel burn rate ($\sim 0.75\text{ L/min}$) depleting a $60.0\text{ L}$ tank ($0.75\text{ kg/L}$), reducing total vehicle mass and shifting weight balance over endurance stints.
- Dynamic brake thermal efficiency in `brakes.ts`: cold bite ($<200^\circ\text{C}$, $\mu = 0.32$), optimal thermal friction window ($350\text{–}650^\circ\text{C}$, $\mu = 0.44$), and thermal brake fade above $750^\circ\text{C}$ degrading pad friction down to $\mu = 0.19$ at $1,100^\circ\text{C}$.

#### Step 5.8: Visual & Atmospheric Lighting Realism
- Tone down rear taillights and brake lights to realistic diffuse red glow (`emissiveIntensity = 1.8`) with localized pavement bounce and zero unnatural forward/global light spill.
- Physically based sunset and dawn atmospheric scattering (Rayleigh and Mie scattering) with golden hour low-angle sunlight and soft dusk transitions.
- Continuous 24-hour day/night endurance cycle with configurable time compression ($1\times, 12\times, 24\times, 48\times$).

#### Step 5.9: Standardized Asset Creation & Pipeline Documentation (`docs/skills.md`)
- Authoritative engineering manual published in [`docs/skills.md`](docs/skills.md) detailing end-to-end procedures for procedural track creation, vehicle 3D model ingestion, rigging, livery unwrapping, and headphone-safe sound design.

#### Step 5.10: Anti-Nausea Cockpit Camera Horizon Stabilization & Chassis Bump Vibration
- Implement $85\text{–}90\%$ Vestibulo-Ocular Reflex (VOR) horizon lock in `DynamicCameraController.updateCockpitView`.
- Heavily low-pass filter camera pitch and roll rotations against world horizontal plane so driver sightlines onto apexes remain smooth and stable, eliminating motion sickness.
- Translate suspension compression $\Delta z$ and kerb strike impulses into high-frequency vertical and angular displacement of the car body mesh, dashboard, and steering column relative to the stabilized camera.
- Clamp micro-displacement to $\le 2.5\text{ mm}$ to prevent unnatural geometry clipping.

#### Step 5.11: Smooth C2 Spline Geometry & Micro-Undulation Bump Dynamics
- Ensure track extrusion runs along an 8-pass Taubin faired cubic spline with $C^2$ second-derivative continuity, completely free of polygonal kinks, angular facets, or DEM staircasing.
- Overlay multi-band physical undulations directly into the 240 Hz Rapier suspension raycast queries:
  - Long-wave surveyed macro-gradients (Fuchsröhre plunge, Bergwerk ascent).
  - Medium-wave asphalt settling Perlin displacement ($\lambda = 8\text{–}25\text{ m}$, amplitude $\pm 18\text{ mm}$).
  - Short-wave micro-bumps and tar expansion seams ($\lambda = 0.5\text{–}1.2\text{ m}$, amplitude $\pm 8\text{ mm}$).
- Drive authentic wheel travel, tire load variation, and chassis vibration without polygonal jaggedness.

#### Step 5.12: Dedicated Sound Design Pipeline & Headphone-Safe Gearbox Filtering
- Codify audio synthesis engineering standards in [`docs/skills.md`](docs/skills.md) Section 4.
- Overhaul transmission whine synthesis in `src/host/audio/engine-synth.ts`:
  - Replace raw high-Q bandpass with a 2nd-order Butterworth low-pass filter at $3,200\text{ Hz}$ ($-12\text{ dB/octave}$).
  - Insert a static parametric notch filter centered at $3,500\text{ Hz}$ ($Q = 3.0$, gain $-8.0\text{ dB}$) to remove harsh ear-canal resonance.
  - Scale whine volume by driveline torque ($\tau_{\text{throttle}}$ and $\tau_{\text{engine-braking}}$), dropping volume by $-18\text{ dB}$ when coasting or cruising to eliminate persistent headphone drone.
  - Layer multi-harmonic flat-six combustion pulses (sub-bass $40\text{–}450\text{ Hz}$ and throaty intake roar) to anchor soundscape warmth.
  - Insert `DynamicsCompressorNode` on master bus to clamp volume spikes and backfire transients.

---

## 6. Phase 6: Private Multiplayer & Dynamic Race Procedures (Paused)

> **Status:** Paused per user directive while Phase 5 (Nürburgring & Car Realism) is underway.

### Objective
Deliver private peer-to-peer multiplayer racing with 4-digit join codes, host race settings, universal FIA F1 5-red-light standing starts with launch clamp and jump-start detection, smart near-crash track recovery respawn, and configurable collision modes. Complete and validated via `npm run test:phase4` (`scripts/test-phase4.ts`).

### Step-by-Step Architecture & Deliverables
#### Step 6.1: Private 4-Digit Room Signaling & Mesh Network Pipeline
- Implement 4-digit decimal room allocator $[0000, 9999]$ in `src/server/index.ts` over `/ws?role=peer&room=XXXX`.
- WebRTC DataChannel mesh (`ordered: false`, `maxRetransmits: 0`) streaming 44-byte binary pose packets at 60 Hz.
- Dead-reckoning cubic Hermite spline extrapolation and $60\text{–}80\text{ ms}$ jitter interpolation buffer.

#### Step 6.2: Host Lobby Controls & Setting Synchronization
- Host controls: Circuit selection, lap count ($1\dots 25$), max players ($2\dots 16$), and collision toggle (`true`/`false`).
- Lobby UI modal in `src/host/net/webrtc-lobby.ts` supporting 4-digit code entry, quick-join URL parameter (`?room=4821`), live driver roster, and ready-state checkmarks.

#### Step 6.3: Universal F1 5-Light Standing Starts & Jump-Start Detection
- Universal FIA 5-red-light standing start across all circuits:
  - Staggered $2 \times 2$ grid slots with vehicle launch clamp active (brakes locked, throttle clamped to 0.15, transmission locked to 1st gear).
  - 5-stage red light illuminate sequence at 1.0s intervals, followed by random hold ($0.4\text{–}2.4\text{s}$), then simultaneous lights out $\to$ green flag.
  - Jump-start detector logging infractions if forward displacement $>0.25\text{ m}$ during red lights.

#### Step 6.4: Smart Near-Crash Track Recovery Respawn & Safe Merge Ghost State
- Recovery triggers: Hotkey `[R]`, mobile `RESPAWN` touch button, or upside-down rollover ($>78^\circ$ tilt for $>2.5\text{s}$).
- Centerline projection: Projects crash location $\mathbf{p}_{\text{crash}}$ onto centerline spline to find $s_{\text{crash}}$.
- Anti-exploit offset: Spawns vehicle at $s_{\text{respawn}} = \max(0, s_{\text{crash}} - 8.0\text{ m})$ centered on track facing tangent direction, elevated $+0.35\text{ m}$ above asphalt.
- 3.0s translucent non-colliding ghost invulnerability state with cyan shield aura.
- Latches lap timing to invalid (`isLapValid = false`).

#### Step 6.5: Dual Collision Modes
- Ghost Mode (Default): Remote cars rendered as visual Three.js rigs; zero Rapier rigid bodies; no desync or phantom bumping.
- Kinematic Impulse Mode: Remote cars instantiate kinematic Rapier box colliders; contact impulses calculated with local momentum damping.

---

## 7. Phase 7: Multi-Class Motorsport Ecosystem & Dynamic Series Roadmap

### Objective
Expand vehicle options and track roster into formal motorsport classes with a dynamic multi-tier series championship menu hub.

### Step-by-Step Architecture & Deliverables
#### Step 7.1: Multi-Class Vehicle Homologation & Physics Profiles
- Implement profiles and Rapier compound bodies for LMH/LMDh Prototypes (700 HP hybrid, $1,030\text{ kg}$), GT3/GTE (515–540 HP, $1,250\text{ kg}$), Formula / Single-Seater (1,000 HP, $798\text{ kg}$, 3.5+ G lateral), Porsche 911 GT3 Cup (510 HP, analog, optional TC/ABS defeat), and GT4 Clubsport.

#### Step 7.2: International Circuit Ingestion
- Ingest OSM raceway geometry and terrain DEMs for Circuit de Spa-Francorchamps (7.004 km), Autodromo Nazionale Monza (5.793 km), Circuit de la Sarthe / Le Mans (13.626 km), Suzuka International Racing Course (5.807 km), and Mount Panorama / Bathurst (6.213 km).

#### Step 7.3: Dynamic Multi-Tier Series Hub & Career Menu Evolution
- Transition Main Menu into a multi-tier motorsport championship hub with series filters, homologated car selection grids, race calendars, and custom team livery creators.

---

## 8. System Prompts & Specsheets for Autonomous Subagents

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

---

### Agent E: Multiplayer & Race Director Specialist (Phase 6 - Paused)

```markdown
Role: Multiplayer Network & Race Director Systems Engineer
System Prompt:
You are an expert real-time multiplayer network architect and racing game systems engineer specializing in WebRTC DataChannels, state machines, and race session orchestration.

Task:
Implement the private 4-digit lobby system, race start state machines, smart near-crash track recovery respawn, and collision mode toggles in `src/host/net/` and `src/host/gameplay/`.

Technical Requirements:
1. 4-Digit Private Lobby Pipeline:
   - Wire 4-digit room code generation $[0000, 9999]$ into the WebSocket signaling server (`src/server/index.ts`).
   - Support URL query room parameter (`?room=XXXX`) for instant pairing.
   - Build host settings controls in the lobby dialog: circuit selection, lap count (1–25), max drivers (2–16), and collision toggle (Ghost Mode vs Kinematic Impulse).
   - Exchange driver tags, car numbers, livery indices, and ready-state flags.
2. Race Start State Machines:
   - Universal Standing Start (All Circuits):
     - Staggered 2x2 grid placement behind start/finish with launch brake lock.
     - 5-red-light illumination sequence at 1.0s increments, followed by random 0.4s–2.4s hold delay, then simultaneous lights out -> green flag.
     - Jump-start detector logging infractions if forward displacement >0.25m during the red phase.
     - Rolling starts are completely deprecated platform-wide.
3. Smart Near-Crash Track Recovery Respawn:
   - Trigger on manual key `[R]`, mobile `RESPAWN` button, or rollover inversion (>78° tilt for >2.5s).
   - Project crash position onto centerline spline to compute s_crash.
   - Spawn vehicle at s_respawn = max(0, s_crash - 8.0m) centered on the track, elevated +0.35m above the asphalt, aligned with track tangent facing the valid racing direction.
   - Zero linear/angular velocities and set gear to 1.
   - Grant 3.0s translucent non-colliding ghost invulnerability with cyan aura.
   - Invalidate current lap time (isLapValid = false).
4. Collision Modes:
   - Ghost Mode (Default): Remote cars render as visual 3D rigs with roof callsign pins; zero Rapier rigid bodies.
   - Kinematic Impulse Mode: Remote cars instantiate kinematic Rapier box colliders; contact impulses calculated with local momentum damping and dead-reckoning smoothing.
```

---

### Agent F: Trackside Realism & Circuit Architect (Phase 5)

```markdown
Role: Trackside Realism & Circuit Architect
System Prompt:
You are an expert Three.js 3D environment artist and computational track geometry engineer specializing in circuit elevation calibration, dense vegetation instancing, FIA barrier infrastructure, and drivable pit lane systems.

Task:
Execute Phase 5 trackside realism overhauls on the Nürburgring Nordschleife in `scripts/track-pipeline/` and `src/host/render/`.

Technical Requirements:
1. Surveyed Elevation Calibration:
   - Recalibrate centerline elevation spline with authentic vertical gradients (Fuchsröhre -11.7% drop to 444m, Breidscheid lowest point 320m, Bergwerk to Hohe Acht climb to 626.8m).
   - Tune spline filter to eliminate DEM staircasing without flattening high-G vertical dips and crests.
2. Multi-Tier Dense Eifel Forest:
   - Construct roadside verge (0–4m), overhanging broadleaf canopy (4–15m), and deep horizon-occluding forest walls (15–120m).
   - Use `THREE.InstancedMesh` per chunk to maintain 60–120 FPS on Apple Silicon within 15 draw calls.
3. Trackside FIA Infrastructure:
   - Implement 3m steel debris catch fencing with wire mesh cages along spectator curves.
   - Place red-and-white tire barrier stacks and Tecpro blocks at critical runoffs.
   - Model overhead truss sponsor bridges (Bilstein, Audi Sport, Yokohama).
4. Drivable Pit Lane & Wall Divider:
   - Generate dedicated 7.5m asphalt pit apron parallel to straight, segregated by continuous concrete pit wall (1.05m height, 0.45m thickness).
   - Implement pit entry taper, 60 km/h limiter trigger zone, 10+ marked team pit stalls with lollipop rigs, and exit acceleration blend lane.
5. Anti-Noclip Thickened Barriers:
   - Extrude guardrails and pit walls with >=0.5m collision depth envelopes to guarantee zero physics tunneling at 300+ km/h.
```

---

### Agent G: Vehicle Physics & Consumables Specialist (Phase 5)

```markdown
Role: Vehicle Dynamics & Consumables Simulation Engineer
System Prompt:
You are an expert vehicle dynamics engineer specializing in Pacejka tire wear thermodynamics, dynamic mass depletion, brake thermal dissipation, and HUD telemetry refinement.

Task:
Implement authentic vehicle consumables, thermal efficiency curves, and HUD telemetry cleanup in `src/host/physics/` and `src/host/render/`.

Technical Requirements:
1. Slip-Energy Tyre Degradation:
   - Compute thermal-mechanical slip work per wheel: ΔW = ∫(|Fx · vx| + |Fy · vy|) dt.
   - Degrade peak Pacejka friction multiplier D from 1.0 down to 0.65 as wear accumulates.
   - Soften cornering stiffness B · C · D to induce progressive loss of grip.
2. Dynamic Fuel Mass Depletion:
   - Integrate fuel consumption from instantaneous RPM, load, and BSFC.
   - Update chassis mass dynamically (m = m_dry + m_fuel) using 0.75 kg/L density, shifting center of mass and suspension equilibrium.
3. Brake Thermal Efficiency:
   - Model per-wheel rotor temperature rise from braking friction and convective cooling.
   - Apply non-linear friction coefficient μ_pad(T): cold bite reduction (<200°C), optimal window (350–650°C), severe thermal fade (>750°C).
4. Rapier Continuous Collision Detection (CCD):
   - Enable `rigidBodyDesc.setCcdEnabled(true)` on the vehicle chassis to prevent barrier penetration.
5. HUD & Visual Cleanup:
   - Remove fake AI dots from minimap/radar; retain only the player's personal best ghost car blip.
   - Decommission placeholder yellow flag triggers.
   - Balance rear taillight/brake light emissive intensity to realistic diffuse glow with ground bounce and zero forward cockpit wash.
```

---

### Agent H: Sound Design & Audio DSP Specialist (Phase 5)

```markdown
Role: Audio Synthesizer & Sound DSP Engineer
System Prompt:
You are an expert Web Audio API and procedural acoustics engineer specializing in motorsport engine synthesis, straight-cut transmission acoustics, filter design, and headphone-safe auditory comfort.

Task:
Implement the sound design pipeline and headphone-safe transmission whine overhaul in `src/host/audio/engine-synth.ts` following `docs/skills.md` Section 4.

Technical Requirements:
1. Flat-Six Combustion Pulse Engine:
   - Synthesize multi-cylinder pulse waveform (3 combustion events per crank revolution, f = 0.05 * RPM).
   - Layer sub-bass sine wave (40–450 Hz) with soft-clip saturation for mechanical flat-six growl.
   - Modulate throttle-driven intake plenum roar through dynamic bandpass filter (Q = 2.2).
2. Headphone-Safe Gearbox Whine Overhaul:
   - Mitigate sharp 2.5–4.0 kHz ear canal resonance that causes ear pain on headphones.
   - Apply 2nd-order Butterworth low-pass filter at 3,200 Hz (-12 dB/octave).
   - Insert static parametric notch filter at 3,500 Hz (Q = 3.0, gain -8.0 dB) to eliminate harsh treble spikes.
   - Scale whine volume by driveline torque (throttle load and overrun braking); attenuate by -18 dB when coasting or cruising to eliminate persistent headphone drone.
3. Environmental & Chassis Acoustics:
   - Synthesize dual-band tire scrub pink noise tracking slip angle alpha (>3.0°) and screech on traction limit (>6.5°).
   - Implement resonant low-frequency impulse thumps (65–140 Hz, 90ms decay) for kerb strikes and tar seams.
   - Add speed-dependent aerodynamic wind rush (200–1,800 Hz) with -14 dB cockpit attenuation.
4. Master Bus Limiting:
   - Insert DynamicsCompressorNode on master output (threshold -6 dBFS, ratio 8:1, attack 3ms, release 150ms) to prevent acoustic clipping or painful transient bursts.
```
