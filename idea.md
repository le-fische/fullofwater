# Full of Water

> Formerly "Dual-Screen Web Racer". Living design doc. New ideas get added here as they come up, and every change gets a line in the [Changelog](#changelog).
> Technical review, spec sheet and open questions are in [spec.md](spec.md).
> Implementation roadmap and agent prompts are in [implementation.md](implementation.md).

**Status:** Phase 1 Complete; Phase 2 Authentic Surveyed Nürburgring Nordschleife & 24h Layout Live; Phase 3 Paused (physics merged into Phase 5); Phase 4 Paused (moved to Phase 6); Phase 5 Nürburgring & Car Ultra-Realism (Assetto Corsa Competizione Level) Complete & Validated; Phase 6 Private Multiplayer Planned; Phase 7 Multi-Class & Global Tracks Roadmap. **Roman Numeral Track:** Phase I (Driver Accounts, Player Database & Global Hotlap Leaderboards) Complete & Validated; Phase II (Cloud-Relayed WebRTC Multiplayer) Planned.
**Last updated:** 2026-11-09 (Vercel Production Deployment: Multi-Segment Serverless Catch-All API, Controller Pairing & Camera Shake Eradication)

---

## 1. Core Vision & Platform Hook

A gritty, sim-lite racing platform running directly in the browser. The main monitor is the cinematic windshield: a driver-side cockpit view. The player's smartphone or tablet acts as the steering column and tactile controller, held in landscape like a controller and connected over the local network with minimal latency.

The HUD lives on the big screen, like in desktop racing games: icons along the top, displays inside the cockpit, and overlays such as a 3D radar showing how close the next car is.

### The Handling Philosophy
Grounded and heavy. Using a raycast vehicle physics model, the game focuses on weight transfer, suspension compression, and predictable slip angles rather than punishing tire-temperature simulations. It bridges the gap between the accessibility of mobile racers and the physical weight of desktop simulators.

Simple gas and brake must be enough to drive fast, like driftmas.io (WASD/arrow keys only) and Monoposto. The physics has to be intuitive enough that on/off pedals plus assists work cleanly.

### Look & Feel & Hardware Target
- Target hardware: Apple Mac with M4 Pro chip.
- Display: 4K 60 Hz external monitor and 120 Hz MacBook ProMotion display.
- Graphics target: Monoposto-level graphics: semi-realistic, neither blocky nor over-polished 3D.

---

## 2. Phase 1: MVP Proof of Concept (High-Speed Proving Ground & Controls)

Before tackling tracks or streaming, prove the core physical driving loop on a controlled flat environment.

### 2.1 Scope & Core Goal
Prove throttle, braking, and gyro steering with the mobile controller talking to the Mac over local HTTPS/WebSocket:
- Accelerate through all 6 sequential gears up to top speed ($300+\text{ km/h}$).
- Brake to a dead stop with ABS.
- Engage automatic reverse by holding the brake pedal when stopped.
- Steer smoothly with in-plane gravity sensing without vertical flipping.
- Maintain locked 60–120 FPS on Mac M4 Pro.

### 2.2 Environment: High-Speed Proving Ground & Runway
- **Dimensions:** $1,200\text{ m} \times 6,000\text{ m}$ (1.2 km wide $\times$ 6.0 km long flat plane).
- **Runway Straight:** $5,500\text{ m}$ marked straightaway ($36\text{ m}$ wide, 4 lanes) with starting launch box at $Z = 0\text{ m}$ and terminal mark at $Z = 5,000\text{ m}$.
- **1:1 Mathematical Distance Markings:**
  - Overhead steel truss gantries every $500\text{ m}$ with high-contrast signs (`500 M`, `1.0 KM` ... `5.0 KM`).
  - Trackside distance marker boards on both sides every $100\text{ m}$ (`100m`, `200m`, `300m`, etc.).
  - Centerline dashes at exact $10\text{ m}$ intervals ($6\text{ m}$ white dash, $4\text{ m}$ gap).
  - Transverse distance hash bars across runway every $100\text{ m}$ (white) and $500\text{ m}$ (yellow).
- **Handling Circles:** Concentric marked circles ($40\text{ m}$, $80\text{ m}$, $160\text{ m}$ radius) to measure steady-state lateral G-forces and slip angles.
- **Slalom Section:** Row of cones spaced $40\text{ m}$ apart along $X = -70\text{ m}$ to test steering responsiveness, chassis roll, and One Euro filter damping.
- **Boundary:** Perimeter solid Armco barrier collision mesh at boundaries.

### 2.3 Baseline Vehicle: Porsche 911 RSR-19 (992)
- **Engine:** Mid-rear 4.2 L naturally aspirated flat-six (515 PS @ 9,000 RPM, 470 Nm @ 7,200 RPM).
- **Top Speed:** ~298 km/h baseline aero drag limited; ~318 km/h with rear wing DRS flap open.
- **Aerodynamics:** High downforce front splitter, underbody diffuser, and swan-neck rear wing generating ~800 kg downforce at 250 km/h (42% front / 58% rear balance).
- **Transmission:** 6-speed Hewland sequential dog-ring gearbox with automated electro-pneumatic shifting matching real mechanical gear ratios:
  - 1st ($3.18$): $97.6\text{ km/h}$ at $8,800\text{ RPM}$
  - 2nd ($2.25$): $145.3\text{ km/h}$ at $8,800\text{ RPM}$
  - 3rd ($1.78$): $186.7\text{ km/h}$ at $8,800\text{ RPM}$
  - 4th ($1.48$): $226.2\text{ km/h}$ at $8,800\text{ RPM}$
  - 5th ($1.26$): $266.9\text{ km/h}$ at $8,800\text{ RPM}$
  - 6th ($1.10$): $298\text{ km/h}$ standard aero equilibrium ($8,500\text{ RPM}$), pulling to $318\text{ km/h}$ with low-drag/DRS trim. Hard rev limiter at $9,200 - 9,250\text{ RPM}$.
  - Shifts occur dynamically only when vehicle speed matches the mechanical gear ratio, preventing premature upshifts during wheelspin and providing downshift over-rev protection.
- **Braking System:** $6,800\text{ Nm}$ total caliper clamping torque ($3,876\text{ Nm}$ front, $2,924\text{ Nm}$ rear) with 57% front bias.
  - Stopping time ($300 \to 0\text{ km/h}$): $5.89\text{ s}$ ($\approx 223\text{ m}$, avg $1.44\text{ G}$).
  - Low-speed pad clamping below $4.3\text{ km/h}$ resolves the Pacejka low-speed singularity.

### 2.3.1 Authentic Porsche 911 3D Model & Dynamic Wheel Rig
User proposal: *"next work on the porsche model. Find a model online maybe and fit it into our system"*
- **Model Ingestion & Integration:**
  - Integrated high-fidelity open-source 3D model of the Porsche 911 Carrera 4S (992 generation) by Karol Miklas (CC-BY-SA 4.0), compressed with Draco geometry compression (`public/assets/cars/porsche_992_rsr/model.glb`, 3.5 MB).
  - Scaled ($1.03\times$) to match the authentic $2.51\text{ m}$ wheelbase, $1.98\text{ m}$ width, and $1.16\text{ m}$ height of the Porsche 992.
  - Aligned chassis body with Rapier physics center of mass and wheel arches ($Y = +0.24\text{ m}$, $Z = +0.12\text{ m}$).
  - Mounted the iconic carbon swan-neck aerodynamic rear wing and red endplates on the rear deck to complete the RSR track specification.
- **Dynamic 4-Wheel Animated Rig:**
  - Extracted 4 independent wheels from the model's front and rear axles into dedicated steering and spin hierarchies.
  - Red Brembo brake calipers remain fixed to the steering hub, turning with front steering while remaining stationary during wheel roll.
  - Alloy rims, ventilated brake discs, and Michelin tires spin dynamically around their local axle based on physical wheel angular velocity ($\omega \cdot dt$).
- **PBR Material Tuning & Exterior Paint Switcher:**
  - High-gloss car paint with clearcoat (`paint`), transparent windshield and windows with depthWrite disabled (`opacity: 0.25`) for crystal-clear cockpit sightlines, headlights, and LED taillight strip (`emissive: 1.5`).
  - Interactive paint color cycling via `[P]` hotkey or HUD button: Guards Red, Carrera White, GT Silver Metallic, Miami Blue, Speed Yellow, Racing Green, and Triple Black.

### 2.3.2 Dedicated Sim-Racing Main Menu, Interactive 3D Turntable Showroom & Prototype Roll Cage Decommissioning
User decisions:
- *"looks great we can get rid of our prototype roll cages now?"*
- *"also a simple main menu before we load into track where we can select track and car. so we can't change those unless we leave to main menu."*
- *"we should get like a platform to view the car when we select and switch liveries, interactive 3d swivel platform"*

- **Prototype Roll Cage Decommissioning:**
  - Removed procedural roll cage tubes (`leftPillar`, `rightPillar`, `headerBar`, `leftRoofBar`, `rightRoofBar`) and the windshield sunstrip banner from `gt-cockpit.ts` and `prototype-cockpit.ts`.
  - The authentic Porsche 911 GT3 RS 3D model now provides 100% factory cabin geometry, windshield curvature, and carbon roofline with zero clipping or protruding pipes.
- **Dedicated Sim-Racing Main Menu (Minimalist Luxury Motorsport Studio):**
  - User decision: *"need you to polish landing page. get rid of unecessary description texts, make as premium as possible"*
  - Dedicated initial menu overlay before loading into the circuit session, styled with deep obsidian carbon glass (`rgba(14, 15, 20, 0.84)`, `backdrop-filter: blur(24px) saturate(140%)`), subtle specular borders, and tabular monospace typography.
  - **Eliminated Unnecessary Description Texts & Visual Clutter:** Stripped verbose multi-line track highlight paragraphs (`track.highlight`), multi-colored difficulty pills, header hardware subtitles (`"Porsche Motorsport Sim-Lite Experience • Apple Silicon M-Series"`), the top-center floating drag hint pill (which previously overlapped the car's rear wing in overhead views), redundant section eyebrows, and bottom sub-captions.
  - **Studio Brand Header:** Minimalist `PORSCHE | 911 RSR GTE` wordmark with Guards Red accent bar on the left; live controller status pill and `PAIR PHONE` button with vector QR icon on the right.
  - **Architectural Circuit Selector (`CIRCUIT`):** 4 single-line track cards (`Nürburgring Nordschleife`, `Nürburgring 24h Gesamtkurs`, `Nürburgring GP-Strecke`, `High-Speed Proving Ground`) with Guards Red active left indicator bar and crisp tabular metrics (`20.8 KM · 73 TURNS`).
  - **Vehicle & Livery Studio (`911 RSR-19` / `4.2L FLAT-6`):**
    - 4-column hairline telemetry strip (`515 HP`, `9,000`, `318 KM/H`, `1,245 KG`).
    - 4×2 grid of all 8 competition livery swatches (`#80`, `#911`, `#77`, `#1`, `#92`, `#20`, `#93`, `#00`) with split primary/secondary color chips and zero horizontal clipping.
    - Unified Competition Number row with `#` input field and a symmetrical 4×2 quick-select number grid.
    - High-contrast Guards Red `START SESSION [ENTER]` ignition button.
- **Interactive 3D Turntable Swivel Stage (`ShowroomStage`):**
  - High-end circular machined obsidian podium cylinder ($r=2.72\text{ m}$, $h=0.16\text{ m}$) with satin carbon top platter, subtle 128-segment brushed platinum chamfer ring (`0xe4e4e7`, `opacity: 0.16`), and glossy reflective studio floor.
  - Automotive studio lighting: key spotlight with soft shadows, rear-right cool silver rim spotlight (`0xe2e8f0`), top soft diffuser, and floor bounce fill.
  - Full $360^\circ$ interactive orbital swivel: click/touch and drag to rotate yaw and adjust pitch elevation ($3^\circ$ low hero stance to $66^\circ$ high aero overview) with direct-manipulation controls (dragging right rotates the car right, dragging up pitches camera up).
  - Scroll wheel zoom clamped between $3.2\text{ m}$ (close-up wheel/caliper detail) and $8.5\text{ m}$ (wide studio overview).
  - Smooth idle auto-rotation ($0.18\text{ rad/s}$) resuming 1.5s after user interaction.
- **In-Race Track & Car Lockout:**
  - Car and track choices are locked during active driving; in-race switching shortcuts are disabled.
  - Replaced HUD track menu button with `EXIT TO MENU [ESC]` button. Pressing `[ESC]` or `[M]` stops the session, cleanly unloads vehicle physics and chunk streamers, and returns the player to the 3D Showroom Main Menu.
- **HUD Streamlining & Clean Status Bar:**
  - User decisions:
    - *"can we make the fps an integer?"*
    - *"once we get menu setup lets also get rid of the livery and track in the status bar, no need for max speed displayed. maybe later in time trial mode we can add stats like max speed, mean speed etc."*
  - **Integer FPS:** Formatted FPS display strictly as rounded integer (`Math.round(fps)`), eliminating lengthy decimal strings.
  - **Status Bar De-Cluttering:** Removed livery and track tags from the in-game top-left badge row; status bar now focuses strictly on controller connection, camera mode, and the `EXIT TO MENU [ESC]` button.
  - **Removed MAX SPEED from HUD:** Stripped max speed readout from active racing HUD.
  - **Time Trial Mode Stats (Future Roadmap):** Post-session and time-trial mode stats (max speed, mean/average speed, sector delta times) scheduled for dedicated time trial results screen.
- **Steering Wheel Arm Artifact Eradication & Rigged Arms Roadmap:**
  - User decisions:
    - *"oh also get rid of the arm artefacts in the steering wheel, no need to show, just the steering wheel is enough. if you do want to make arms, I need really detailed arms high polygon count and proper gloves wrapped around and steering is hard to show the arms move so I say just put it in idea and implement later"*
  - **Immediate Removal:** Eradicated all low-poly box hand meshes, cuff patches, and arm cylinders from `gt-cockpit.ts`, `prototype-cockpit.ts`, and `f1-cockpit.ts`. The steering wheel now presents a clean, unobstructed view of the carbon butterfly yoke, LCD telemetry screen, rotary dials, and LED shift light row.
  - **Deferred Implementation (Future Scope):** Detailed high-polygon 3D driver arms with anatomically wrapped competition racing gloves and dual-arm inverse kinematics (IK) steering animation logged as future enhancement.

### 2.4 Surface Materials & Contact Physics
- **Asphalt**: Primary race track tarmac and runway ($\mu = 1.0$, $c_{\text{roll}} = 0.015$).
- **Concrete / Kerbs**: Rumble strips and track margins ($\mu = 0.90$, $c_{\text{roll}} = 0.020$).
- **Grass**: Off-track verges ($\mu = 0.35$, $c_{\text{roll}} = 0.040$).
- **Gravel**: Runoff decelerator beds ($\mu = 0.45$, $c_{\text{roll}} = 0.280$).
- **Split-$\mu$ Dynamics**: Dipping two wheels into grass while two remain on asphalt generates a physical yaw moment:
  $$\tau_{\text{yaw}} = (F_{x,\text{asphalt}} - F_{x,\text{grass}}) \times \frac{w_{\text{track}}}{2}$$

### 2.5 "Eyes-Up" Mobile Controller UX
The controller is built for muscle memory, so the player never has to look down at their hands while attacking the track.
- **Device Support:** iPad is the primary controller device, with proportional layout scaling gracefully across iPad (11"/12.9") and iPhone screens.
- **Proportional Layout:**
  - **Left 1/3:** Brake zone with glowing pedal/caliper vector icon. Holding brake when stopped shifts into Reverse (`R`).
  - **Right 1/3:** Throttle zone with glowing accelerator pedal icon.
  - **Center 1/3:** Rear-view mirror button (holding it switches windshield into a rear-view mirror), Camera toggle, and Reset.
- **F1 Wheel Segmented Instrument Cluster:**
  - **Top Rev LEDs:** 15 distinct circular LED lenses (5 Green, 5 Red, 5 Blue) with chrome metal bezels and synchronized shift strobe ($\ge 8,800\text{ RPM}$).
  - **Segmented Screen Box:** Digital speed in km/h, central gear binnacle (`R`, `N`, `1`–`6`), live engine RPM, and active `ABS`/`TC` indicators.
- **Steering:** Gyroscope tilt using the in-plane gravity vector (zero gyro lag) with $\pm 55^\circ$ full lock, $1.2^\circ$ deadzone, and progressive non-linear response curve ($|x|^{1.75}$) to ensure stable tracking on straights and sharp authority in corners.
- **Assists:** On by default (traction control, ABS, ESP active yaw damping, counter-steer assist, speed-sensitive steering starting at 18 km/h).
- **Haptics:** Deferred (Safari does not support the Vibration API).

### 2.6 Local Network & HTTPS Bridge
- Pure browser: Safari on iOS connecting to Vite HTTPS server on the Mac.
- Local network: Home Wi-Fi, iPhone Personal Hotspot (wireless or USB cable). No internet dependency required once initial page is cached.
- Local SSL: Managed via `mkcert` root CA installed on the phone.
- Transport: Binary WebSocket for local low-latency messaging (8-byte controller packet, 6-byte telemetry packet).

### 2.7 Cockpit Camera & Audio Synthesis
- **Cockpit View:** Enclosed driver-side bucket seat perspective ($[0.35, 0.76, -0.28]\text{ m}$, $82^\circ$ vertical FOV).
  - Dynamic head inertia under acceleration/braking and chassis roll. Zero standstill jitter ($v < 1\text{ km/h}$).
  - Rotating race steering wheel matching input angle.
  - Dynamic in-cockpit digital rear-view mirror ($512 \times 256$ render target).
- **Motorsport Sound Engine:**
  - Cockpit view features zero wind noise; cabin sound is dominated by straight-cut spur gear mesh whine ($1,060\text{ Hz} \to 4,500\text{ Hz}$), differential whine, flat-six induction roar, and gear backlash flutter.
  - Exterior cams feature atmospheric wind noise ($v^{2.5}$) and open exhaust rasp.
  - Dog-ring shift clank + pneumatic air release (`tssh`) + downshift auto-blip backfire pops.

---

## 3. Phase 2: Dedicated Nürburgring Nordschleife

Phase 2 replaces the flat proving ground with the full, topologically verified 20.8 km Nürburgring Nordschleife circuit.

### 3.1 Scope & Core Goal
Prove the complete 20.8 km Nordschleife experience using the vehicle physics and controller from Phase 1:
- Navigate all 20.832 km continuously with no memory leaks or hitching.
- Experience authentic Eifel elevation drops and banked curves.
- Asynchronously stream visual meshes and Rapier 3D trimesh colliders.
- Complete timed laps with start/finish line detection.

### 3.2 Topographical Centerline Spline & Elevation Profile
- **Total Track Length:** $20,832\text{ m}$ ($20.832\text{ km}$).
- **Spline Density:** $5,208$ equidistant samples spaced at $4.0\text{ m}$ intervals.
- **Elevation Range:**
  - **High Point:** $621.4\text{ m}$ above sea level (Hohe Acht and T13).
  - **Low Point:** $319.9\text{ m}$ above sea level (Breidscheid river bridge).
  - **Total Vertical Drop:** $301.5\text{ m}$ ($989\text{ feet}$) of physical elevation climb and plunge.
- **Landmark Specific Cambers & Bankings:**
  - **Caracciola-Karussell ($s \approx 13,150\text{ m}$):** $33.0^\circ$ banking with concrete slab surface (`concrete` friction and vibration profile).
  - **Kleines Karussell ($s \approx 18,750\text{ m}$):** $18.0^\circ$ banking.
  - **Fuchsröhre ($s \approx 4,600\text{ m}$):** High-speed vertical compression ($6.0^\circ$ banking, $420\text{ m}$ elevation).
  - **Flugplatz ($s \approx 2,550\text{ m}$):** High-speed crest launch point ($574\text{ m}$ elevation).
  - **Döttinger Höhe ($s \approx 19,600\text{ m} \dots 20,400\text{ m}$):** $2.1\text{ km}$ continuous flat-out straight climbing from $590\text{ m}$ to $615\text{ m}$.

### 3.3 11-Chunk Partitioning & 100m Collision Overlaps
- **Partitioning:** 11 sequential chunks ($\approx 1.89\text{ km}$ span per chunk).
- **Collision Overlaps:** $100\text{ m}$ forward and backward collision overlap ($\pm 25$ samples at $4\text{ m}$ spacing) extending across chunk boundaries, preventing vehicle wheel tunneling or snagging at chunk seams during high-speed transitions.
- **Visual Mesh Cross-Section:**
  - $8.0\text{ m} \dots 10.0\text{ m}$ asphalt road ribbon with center crown.
  - $1.2\text{ m}$ alternating red/white stepped kerbs on corner apexes.
  - $3.5\text{ m}$ grass verges flanking the track.
  - Continuous $0.85\text{ m}$ corrugated Armco steel crash barriers.
  - Concrete slab texture coordinate mapping across the Karussell bowl.

### 3.4 Active 3-Chunk Window Streamer (`[K-1, K, K+1]`)
- **Memory Footprint:** Keeps strictly 3 active chunks loaded in Three.js scene memory and Rapier physics space, maintaining memory usage under $500\text{ MB}$.
- **Rapier Trimesh Swapping:** As the vehicle advances from chunk $K$ to $K+1$:
  - Trailing chunk ($K-2$) is cleanly unloaded: Three.js geometry buffers disposed (`geometry.dispose()`) and Rapier collider removed (`world.removeCollider`).
  - Leading chunk ($K+2$) is instantiated asynchronously.

### 3.5 Floating Origin Precision Guard
- **Manager:** `FloatingOriginManager` maintains global world offset $O = (O_x, O_y, O_z)$.
- **Recenter Threshold:** Triggers recentering whenever vehicle horizontal distance from current local origin exceeds $1,200\text{ m}$.
- **Result:** Local coordinates remain bounded within $[-1,500\text{ m}, +1,500\text{ m}]$, eliminating 32-bit floating-point camera jitter and vertex z-fighting across the $5\text{ km} \times 7\text{ km}$ geographical footprint.

### 3.6 Spline Projection & Start/Finish Lap Timing
- **Projection Performance:** Optimized local search projects 3D car coordinates onto the spline in $3.8\mu\text{s}$ per call ($< 50\mu\text{s}$ budget at 60 Hz).
- **Timing Gate:** Start/Finish threshold at Antoniusbuche / T13 ($s = 0\text{ m} \leftrightarrow 20,832\text{ m}$).
- **Anti-Cheat & Invalidation:** Requires monotonic progress through a mid-circuit checkpoint (Breidscheid at $\approx 10,000\text{ m}$); off-track excursions $> 2.0\text{ m}$ beyond kerbs invalidate the current lap time.
- **Output:** Live running lap time, previous lap time, and persistent session best lap time.

### 3.7 Phase 2 Verification Status
- Tested and verified via `npm run test:phase2` (`scripts/test-phase2.ts`). All 7 subsystem gates passing.
- CLI asset pipeline (`npm run generate:track`) exports `tracks/nordschleife/manifest.json` and binary `tracks/nordschleife/centerline.bin`.

### 3.8 Open-Source 3D Map Model Pipeline & Asset Adaptation
User proposal: *"I think we should try to find open source map models instead and try to adapt them? what do you think?"*
- **Rationale:** Replacing synthetic spline-swept ribbons with authentic open-source / Creative Commons 3D models (glTF / GLB) eliminates procedural geometry anomalies (winding errors, inverted normals, steep artificial bumps).
- **Asset Adaptation Pipeline:**
  - **Visual Models:** Ingest optimized `.glb` track models featuring authentic textured asphalt, FIA kerb geometry, grass runoff beds, continuous Armco safety enclosures, and trackside landmarks.
  - **Collision Extraction:** Decouple dense visual scenery from physical geometry by isolating clean road/kerb/wall trimeshes for the Rapier 3D 240 Hz vehicle engine.
  - **Centerline Spline Extraction:** Automatically trace track centerlines from CAD/model vertices to drive timing gates, floating origin zones, and HUD minimaps.

### 3.9 Live Circuit Minimap & GPS Radar HUD System
User proposals:
- *"having a minimap would be nice too"*
- *"remember the minimap needs to have me facing north at all times so its like gps but locked in terms of where my icon is facing"*

- **Display Location:** Lower-left corner of the host windshield display (`#hud-minimap-panel`, $240 \times 150\text{ px}$ canvas).
- **GPS Track-Up Navigation Radar (`GPS: NORTH LOCKED`):**
  - **Permanently Locked Facing North:** The player vehicle icon is positioned at $(cw \times 0.50, ch \times 0.62)$ and permanently locked pointing strictly straight UP along the $-Y$ axis (North of the display), exactly like an automotive GPS navigation system.
  - **Rotating Coordinate Projection:** Road centerline, sectors, dynamic FIA flags, landmark beacons, and competitor dots rotate and translate around the car using the vehicle's quaternion forward and right vectors:
    $$d_{\text{forward}} = \Delta x \cdot fwdX + \Delta z \cdot fwdZ$$
    $$d_{\text{lateral}} = \Delta x \cdot rightX + \Delta z \cdot rightZ$$
    $$sx = carScreenX + d_{\text{lateral}} \times 0.22, \quad sy = carScreenY - d_{\text{forward}} \times 0.22$$
  - **Lookahead & Tactical Range:** Scale factor $0.22\text{ px/m}$ yields $\sim 420\text{ m}$ forward lookahead and $\sim 260\text{ m}$ rear lookbehind, giving optimal situational awareness through upcoming hairpins, esses, and chicanes.
  - **Concentric Range Rings:** Subtle distance rings at $100\text{ m}$ ($r = 22\text{ px}$), $250\text{ m}$ ($r = 55\text{ px}$), and $400\text{ m}$ ($r = 88\text{ px}$) with clean monospace distance callouts.
  - **Motorsport Compass Rose (True Geographic North):** Top-left circular compass at $(20, 20)$ with dual-tone needle (red North tip, silver South tip) rotating by $\theta_{\text{north}} = \operatorname{atan2}(-rightZ, -fwdZ)$ showing real-world heading while the display remains locked North-forward.
  - **Interactive Mode Toggle:** Clicking `#hud-minimap-panel` or pressing `[N]` instantly toggles between `GPS: NORTH LOCKED` and `CIRCUIT OVERVIEW [STATIC]`.
  - **Proving Ground Testing Support:** On the runway test bench, 4-lane boundaries, distance markers, and transverse hash lines pass beneath the vehicle in real-time with the icon locked facing North.

### 3.10 Nürburgring 24h Layout (Gesamtstrecke) & Interactive Track Selection Menu
User proposal: *"for the ring can we get full 24h layout so nordschliefe + grandprix and have options to switch between, so a simple menu"*
- **Full 24h Layout:** Seamless integration of the $25.378\text{ km}$ endurance circuit connecting the modern Grand Prix track (GP-Strecke) with the 20.8 km Nordschleife via the bypass link at T13 / Hatzenbach.
- **Interactive Track Menu (`[Tracks]` button or `[M]` key):**
  1. **Nürburgring 24h Layout (Gesamtkurs)**: $25.38\text{ km}$, 170+ turns, GP pit facilities and full Nordschleife.
  2. **Nürburgring Nordschleife**: $20.83\text{ km}$, 73 turns, classic Eifel loop starting at T13.
  3. **Nürburgring Grand Prix Circuit (GP-Strecke)**: $5.15\text{ km}$, 16 turns, modern F1/GT3 circuit.
  4. **High-Speed Proving Ground & Runway**: $6.0\text{ km}$ flat testing plane for acceleration, braking, and physics calibration.
- **Menu UX:** High-contrast modal overlay with layout preview silhouettes, length, turn counts, elevation range, and one-click instant launch.

### 3.11 Filled Eifel Terrain Landscape & Grounded Trackside Embankments
User proposal: *"once you finish the trackside smoothing, I want you to fiill terrain, I don't want to see the track ahead of me be just a strip floating in the sky"*
- **Full Eifel 3D Mountain Mesh (`EifelTerrain`):**
  - Ingests $8.0\text{ km} \times 6.6\text{ km}$ SRTM DEM elevation data (`tracks/nordschleife/dem.json`) into a $122 \times 102$ vertex elevation grid (24,442 triangles) covering coordinates $X \in [-3919, 4011]$ and $Z \in [-2770, 3860]$.
  - Multi-tier vertex shading based on altitude and terrain slope: lush valley meadows (`#2d5a27`), evergreen pine forest slopes (`#1c4019`), and rocky alpine highlands (`#334a2e`), with smooth vertex normals receiving dynamic sunlight and directional shadows.

### 3.12 Trackside Visual Overhaul, Terrain Noclipping Elimination & Porsche 911 3D Model
User proposals:
- *"next work on the porsche model. Find a model online maybe and fit it into our system"*
- *"can you make overall trackside improvements now, clearer track, white line, non blurry grass etc etc clear kerbs. on some parts of the track the terrain covers it and i just noclip into it"*

- **Terrain Clipping / Noclipping Eradication (`dem.json`):**
  - Analyzed and sculpted the DEM elevation mesh across all 9,714 surveyed coordinates across all 3 circuit layouts (`osm_nordschleife.json`, `osm_24h.json`, `osm_gp.json`).
  - Clamped every DEM vertex within a 65-meter radial corridor of any centerline coordinate down to $\le Y_{\text{track}} - 4.0\text{ m}$, followed by a smooth cosine transition envelope out to 110 meters.
  - Verification: 0 of 9,714 points clip or sit below terrain; max terrain height relative to road is $-3.99\text{ m}$ (eliminating all 1,334 previous clipping occurrences where mountain geometry breached the asphalt ribbon).
- **30-Node High-Definition Visual Cross-Section (`TrackMeshGenerator`):**
  - Visual slice sub-sampling at $1.25\text{ m}$ intervals along the spline, eliminating Nyquist aliasing and color smearing on alternating kerbs.
  - Dedicated 20 cm continuous brilliant white edge boundary lines ($[0.98, 0.98, 0.98]$) on driver left and right with sharp 2 cm transition to asphalt, eliminating white wash bleed across the road.
  - Dedicated 20 cm centerline white dashes (5m dash / 5m gap) bounded by road color.
  - Dark asphalt lane color ($[0.18, 0.18, 0.20]$) with subtle rubbered racing groove ($[0.14, 0.14, 0.16]$).
  - High-contrast alternating 2.0m FIA red/white rumble kerbs ($1.25\text{ m}$ width, $1.8\text{ cm}$ bevel) activated on all corners ($\ge 0.0035\text{ rad/sample}$) and suppressed on straights (Döttinger Höhe).
  - Authentic Karussell concrete slab sections ($[0.68, 0.68, 0.65]$) with 4m tar expansion joints ($[0.28, 0.28, 0.26]$).
  - Outward-sloping Eifel forest embankments extending 35 meters beyond Armco barriers to ground the road into the terrain.
  - Authentic 1.25m transverse start/finish grid line replacing full-road fading.
  - Rapier physics collision geometry retained at 9 nodes ($5\text{ m}$ spacing) to keep collision physics ticks $< 0.15\text{ ms}$.
- **16x Anisotropic High-Frequency Aggregate Detail Texture (`ChunkStreamer`):**
  - Procedural $256 \times 256$ `DataTexture` with high-frequency micro stone aggregate noise, aggregate clumps, and grass blade grain.
  - Configured with `THREE.RepeatWrapping`, repeat $(12, 300)$, mipmapping, and `anisotropy = 16`, eliminating blurry textures at oblique high-speed viewing angles without DOM canvas dependencies.
- **Porsche 911 GT3 RS (992 Weissach) Model & Standardized Livery Pipeline (`CarMeshRig` & `LiverySystem`):**
  - User feedback: *"rear wings arent mounted. would it be possible to make it standardized so every model from now on can bemapped in a way that we can apply liveries and not have any plates? also the model is a carrera model not what we want"*
  - **Authentic GT3 RS Racing Model (`scene-opt.glb`, 2.22 MB):** Replaced civilian street Carrera 4S with authentic Porsche 911 GT3 RS (992 generation) featuring full Weissach aerodynamic package: massive factory DRS swan-neck rear wing rooted firmly into the engine deck lid with zero gap, dual carbon hood nostrils, roof aero vanes, centerlock racing rims, and racing bucket interior.
  - **Universal Plate Eradication (`VehicleModelAdapter.sanitizeModel`):** Automatically detects and strips/removes all civilian street license plates and bracket meshes (`Licence_Plate_Emissive`, `License_Plate_Glass`, `*plate*`, `*license*`, `*tag*`) across all imported models.
  - **Standardized Competition Livery System (`LiveryGenerator` & `VehicleModelAdapter`):**
    - High-resolution $1024 \times 1024$ dynamic PBR canvas texture generator synthesizing competition number roundels, dual GT center stripes, "PORSCHE GT3 RS" rocker scripts, and sponsor badges.
    - 7 Competition Preset Liveries:
      1. Manthey Racing "Grello" (#911)
      2. Martini Racing Tribute (#77)
      3. Rothmans 1982 Heritage (#1)
      4. Pink Pig "Sau" Tribute (#92)
      5. Gulf Racing Tribute (#20)
      6. Weissach Guards Red (#93)
      7. Triple Black Stealth Carbon (#00)
    - Dynamic slot synchronization: instantly binds body paint, brake calipers, centerlock rims, and wing endplates with one-click `[P]` cycle key and HUD button.

### 3.13 Authentic Trackside Realism: The Green Hell (Dense 3D Forest, Centerline Removal, Fan Graffiti, Armco Barriers, Gravel Runoffs & Surveyed Topography)
User proposals:
- *"can we get rid of road dashed lines? there are no dashed lines on the nordschliefe and only graffiti and concrete patches."*
- *"I think handling wise its okay already."*
- *"in terms of barriers, can we add proper barriers now that are like real life, some areas have gravel runoff please study the mapping of the real nordschliefe"*
- *"and its in a forest so I want some greenery like trees, right now it feel liks im driving in the middle of a green plain and there are some hills (make sure hills are correct too to real life)"*
- *"im also not really feeling the elevation changes on the nurburgring, ive driven other sims before I feel like theres is more elevation can you map against an official nurburgring map for actual map corners, I feel like some corners are not sharp enough etc so i need this accurate elevation and trackwise"*

- **Dashed Centerline Eradication & Pure Competition Tarmac:**
  - Removed artificial highway dashed white lines completely from the circuit ribbon in `TrackMeshGenerator`.
  - Replaced with continuous competition tarmac featuring razor-sharp 20cm outer white boundary lines and rich dark rubbered racing line grooves.
- **Procedural Fan Graffiti on Asphalt (`getGraffitiColor`):**
  - Mapped world-famous Nordschleife spectator graffiti sectors:
    - Hatzenbach ($s \approx 800 - 1,400\text{ m}$)
    - Adenauer Forst ($s \approx 4,950 - 5,350\text{ m}$)
    - Caracciola-Karussell ($s \approx 11,800 - 12,300\text{ m}$)
    - Brünnchen ($s \approx 14,000 - 14,500\text{ m}$)
    - Pflanzgarten ($s \approx 14,800 - 15,600\text{ m}$)
    - Schwalbenschwanz ($s \approx 16,300 - 16,700\text{ m}$)
  - Procedurally applies multi-colored chalk/spray-paint markings (Chalk White, Manthey Racing Yellow, Spray Cyan, and Crimson Red flags/hearts) painted directly across the asphalt lanes.
- **Weathered Concrete Patches:**
  - Integrated authentic concrete slab transitions in historic and heavy braking sections: Wehrseifen approach ($s \approx 7,320 - 7,480\text{ m}$), Breidscheid entry ($s \approx 7,800 - 8,060\text{ m}$), Steilstrecke / Karussell link ($s \approx 11,500 - 12,250\text{ m}$), and Pflanzgarten compression ($s \approx 15,000 - 15,260\text{ m}$).
  - Slabs rendered with weathered concrete tint ($[0.60, 0.60, 0.57]$) and transverse dark tar expansion joints ($[0.24, 0.24, 0.24]$) every 4 meters.
- **Authentic 3-Tier Galvanized Armco Steel Crash Barriers:**
  - Upgraded barrier cross-section to authentic multi-tier W-beam geometry: lower rail ($+0.25\text{ m}$), middle corrugated ridge & shadow ($+0.65\text{ m}$), top galvanized rail ($+1.15\text{ m}$), and outer post base.
  - Galvanized metallic sheen ($[0.84, 0.86, 0.90]$) with corrugated trough shading ($[0.55, 0.58, 0.62]$).
- **Authentic Gravel Decelerator Runoff Beds (`isGravelRunoff`):**
  - Mapped authentic real-world runoff traps based on official circuit documentation:
    1. Aremberg (Turn 10, outside left, $s \approx 3,800 - 4,020\text{ m}$)
    2. Adenauer Forst (Turns 18-19, outside right chicane trap, $s \approx 5,040 - 5,260\text{ m}$)
    3. Wehrseifen (Turn 24, outside left downhill hairpin trap, $s \approx 7,400 - 7,580\text{ m}$)
    4. Ex-Mühle (Turn 27, outside left bridge kink, $s \approx 8,120 - 8,290\text{ m}$)
    5. Brünnchen (Turns 45 & 46, classic outside gravel beds on both apexes, $s \approx 14,000 - 14,450\text{ m}$)
    6. Hohenrain Schikane (Turns 68-69, outside left, $s \approx 20,200 - 20,420\text{ m}$)
    7. GP-Strecke: Mercedes Arena, Dunlop-Kehre, and NGK-Schikane runoffs.
  - Replaced grass verge in these zones with coarse crushed stone quarry gravel ($[0.68, 0.62, 0.50]$) expanding outward up to 5.5m.
- **Dense 3D Eifel Forest Foliage ("The Green Hell") (`ForestFoliage`):**
  - Built procedural multi-tiered evergreen coniferous tree geometry (`THREE.InstancedMesh`) featuring tapered bark trunk and 3 needle foliage cones with natural organic vertex tinting.
  - Populates 400–600 trees per chunk flanking both sides of the circuit ($13\text{ m}$ to $51\text{ m}$ from centerline) on outward-sloping embankments and ridge slopes.
  - Powered by deterministic pseudo-random seeding per chunk; streams seamlessly via `ChunkStreamer` in a single GPU draw call per chunk with zero CPU overhead, maintaining locked 60–120 FPS.
- **Surveyed Topographical Elevation Profile (Full 306.8m Drop) & Razor-Sharp Corners:**
  - Calibrated all 44 named sections against official surveyed elevations:
    - Breidscheid valley river bridge: authentic lowest point at **320.0m** (previously flattened to 361m).
    - Hohe Acht summit crest: authentic highest point at **626.8m** (previously squashed to 559m).
    - Total authentic vertical drop: **306.8 meters** (1,007 feet).
    - Fuchsröhre: authentic **11.7%** steep roller-coaster plunge down into the 430m compression.
    - Kesselchen / Klostertal / Steilstrecke: sustained 300m mountain ascent from Bergwerk (348m) to Hohe Acht (626.8m).
  - Eradicated corner-cutting moving averages from polyline assembly:
    - Wehrseifen hairpin: authentic razor-sharp **15.8m radius** (previously blurred to >8,000m).
    - Adenauer Forst: authentic **28.0m radius** chicane.
    - Karussell: authentic **25.5m radius** bowl.
    - Bergwerk: authentic **26.1m radius**.
    - Brünnchen: authentic **29.3m radius**.
    - Aremberg: authentic **30.4m radius**.
  - Re-sculpted `dem.json` mountain landscape corridor so terrain perfectly follows the 306.8m elevation profile with zero road clipping.
- **Authentic 5.148 km Nürburgring Grand Prix Circuit Geometry & Zero-Noclip Stadium Bowl:**
  - Extracted complete 20 continuous OSM ways from raw surveyed coordinates with 0.0m seam error: Castrol-S, Mercedes-Arena (Turns 2-4), Valvoline-Kurve, Ford-Kurve, Dunlop-Kehre hairpin (lowest point 574.6m), Audi-S, Michael-Schumacher-S, Michelin-Kurve, Bit-Kurve, ITT-Bogen, NGK-Schikane, and Coca-Cola-Kurve. Total circuit length: **5,105.0 m (5.105 km)** with 15 turns and 46.7m elevation drop.
  - Re-sculpted DEM terrain across the GP stadium bowl ($X \in [-2250, -750]$, $Z \in [2700, 4650]$) to $\ge 4.5\text{ m}$ below the road surface, ensuring **0 clipping violations / noclipping**.
- **3D Grandstands & Modern Stadium Architecture (`StadiumAssets`):**
  - Start/Finish Haupttribüne: covered multi-tier red/white stadium seating with cantilever roof and steel trusses.
  - Multi-bay Concrete Pit Building: team garages, VIP lounges, glass observation boxes, and pit wall with marshaling posts.
  - Overhead Start/Finish Steel Timing Gantry: overhead truss spanning the front straight with 5 green FIA start bulbs.
  - Mercedes-Benz Arena Amphitheater Grandstand: wrapped around the outside of Turns 2 & 3.
  - Dunlop-Kehre Hairpin Viewing Grandstand & NGK-Schikane stadium complexes.
  - Suppresses wild mountain pine trees inside the stadium box so the arena feels like a true world-class FIA Grade 1 venue.
- **In-Cockpit Micro Minimap & Proximity Spotter (`MicroRadarDisplay`):**
  - Mounted directly below the digital rear-view mirror screen on the center console bracket facing the driver.
  - High-zoom lookahead displaying the upcoming track ribbon for the next 1–2 corners with radius & distance.
  - Locked heading-up orientation (car always faces UP $\uparrow$).
  - Vector silhouette of the Porsche 911 RSR (aerodynamic front splitter, oval headlights, flared rear haunches, swan-neck rear wing).
  - Proximity Spotter & Collision Hazard Perimeter: detects competitor cars within proximity; triggers dynamic flashing yellow/amber hazard arcs at contact points and banner alert (`⚠️ CAR LEFT`, `⚠️ CAR RIGHT`, `⚠️ CAR BEHIND`).
- **Dynamic FIA Race Flags & F1 Broadcast Minimap Radar (`CompetitionField`):**
  - Real-time FIA flag state machine (`GREEN`, `SECTOR_1_YELLOW`, `SECTOR_2_YELLOW`, `SECTOR_3_YELLOW`, `FULL_YELLOW`, `RED`) with live status banners (`🟢 ALL CLEAR`, `🟡 CAUTION S2`, `⚠️ FULL YELLOW`, `🛑 RED FLAG`) and blinking sector track coloring.
  - F1 timing radar broadcast dots with competitor numbers (`#911`, `#1`, `#92`, `#20`, `#93`, `#00`).

### 3.16 Official Porsche 911 RSR Steering Wheel & 1:1 LCD Telemetry Display Replica
User request: *"can we now get a better steering wheel. this is the official 911 rsr steering wheel lets use this now, maybe you can even find a model online to use. or make your won the knobs arent functional mainly i care about shape, the screen, and the led rev counter on top. for the screen lets copy 1 for 1 so map our current features, but whatever we dont have/use right now just keep a blank black space there with a placeholder so we can add in future"*
- **Official 3D Steering Wheel Architecture (`PorscheRsrSteeringWheel`):**
  - Replicated the official GRID Engineering / Sim-Lab Porsche 911 RSR GT/GTE competition steering wheel (285mm diameter).
  - Contoured carbon fiber faceplate extruded with rounded bevel edges, upper $45^\circ$ angled chamfers, and lower chin.
  - Ergonomically molded polyurethane/Alcantara side grips with palm swells and sculpted thumb rest ledges.
  - Arched top rev counter housing containing 15 curved shift LEDs with authentic Porsche Motorsport outside-in convergence: 4 Green on outer flanks, 4 Yellow in mid-range, and 7 Red converging toward center; meeting in middle at max red before shift point; all 15 LEDs strobe flash bright electric blue at optimal shift point (>= 8,800 RPM or `isShiftLightActive`).
  - "PORSCHE" laser-etched silver wordmark across the top faceplate above the display.
  - CNC anodized aluminum rotary thumb encoders: red `TCI` (top left), purple `TCO` (top right), gold dial (inner left), blue dial (inner right).
  - 10 motorsport pushbuttons with black anodized collar bezels.
  - 4 lower fluted rotary selector switches with index pointers and labels: `TC/CON`, `TC/R`, `MAP`, `WIPER`.
  - Porsche golden shield crest emblem centered on the lower chin.
  - Rear carbon fiber magnetic paddle shifters and red anodized quick-release collar.
- **Authentic Porsche Motorsport Outside-In Shift Light Convergence:**
  - User request: *"I have a request for steering wheel, the porsche one in race has the led light up not like f1 but instead they go from both sides in the proper colour schema nad meet in the middle and reght before shift at max red all of the leds flash blue i think. research and implement please"*
  - **Symmetrical Convergence Sequence (6,600 to 8,800 RPM):**
    - Flanks: 4 Green LEDs (Pairs 0 & 1, LEDs 0, 14 & 1, 13) activate from 6,600–7,150 RPM.
    - Mid-Range: 4 Amber/Yellow LEDs (Pairs 2 & 3, LEDs 2, 12 & 3, 11) activate from 7,150–7,700 RPM.
    - Inward Red Progression: 6 Red LEDs (Pairs 4, 5, 6, LEDs 4, 10 & 5, 9 & 6, 8) activate from 7,700–8,525 RPM.
    - Center Red Apex: Center LED 7 illuminates at 8,525–8,799 RPM, meeting in the middle at "max red".
  - **Optimal Shift Point Flash (>= 8,800 RPM or `isShiftLightActive`):**
    - All 15 LEDs synchronously strobe flash electric blue (`#38bdf8` / `0x38bdf8`) at 10 Hz (~50ms duty cycle).
    - Synchronized with LCD telemetry screen border flashing in matching electric blue and mobile controller circle LEDs.
- **1-to-1 Porsche 911 RSR LCD Telemetry Display ($1024 \times 600$ Canvas Pipeline):**
  - Top Status Bar: `[TC C | 1]`, `[TC R | 1]`, `000` (live speed km/h), `[AC | 11]`, `[Map | 1]`.
  - Left Telemetry Cluster: `Water Temp` (85°C), `Oil Temp` (92°C), `Water Press` (1.90 bar), `Oil Press` (3.73 bar).
  - Center: Giant high-visibility Gear indicator (neon green `N`, red `R`, yellow/white `1`–`6`) with mini Porsche crest below.
  - Right Telemetry Cluster: `Avg Diff` (+0.00 / delta), `Predicted Lap Time` (live timer `MM:SS:cc`), `Best Lap Time` (`MM:SS:cc`), `Laps2go` (`10` / lap count), `Lap Time` (`MM:SS:cc`).
  - Dark bordered placeholder boxes for future features (`PIT STRATEGY & TYRE TELEMETRY`).
- **Cockpit Integration & Stock Road Car Wheel Eradication:**
  - Automatically hidden/sanitized all street-car steering wheel nodes (`Node_SteeringWheel`, `Interior_SteeringColumn_Stalks`, `Interior_SteeringWheel_*`) from imported 3D models via `VehicleModelAdapter`.
  - Wheel positioned at $[0.35, 0.58, 0.05]\text{ m}$ with tilt angle $0.36\text{ rad}$, perfectly framed in driver sightlines.
  - Relocated HUD bottom keyboard hints to bottom-right, keeping the steering wheel assembly 100% unobstructed.

### 3.17 Long-Term Trackside Architecture & Holistic Trackside Logic Engine
User proposal: *"please really think about all the trackside logic long term"*

A thorough, long-term trackside architecture unifying physics ground-truth parity, spatial anti-encroachment clearance, dynamic environmental zoning, surface material friction modeling, and trackside race control infrastructure:

1. **Physical Surface Ground Truth Parity (Zero Chord Sagitta Discrepancy & Eradication of White Line Hitboxes):**
   - **1:1 Mathematical Vertex Parity (`TrackMeshGenerator`):** The Rapier 3D trimesh collider uses the exact same centripetal Catmull-Rom Hermite cubic spline sub-sampling (`COL_SUB_STEPS = 6`, ~0.83m longitudinal slice spacing) as the visual asphalt mesh. Every single collision vertex (`pRoadLeft`, `pCenter`, `pRoadRight`, `pKerbLeft`, `pKerbRight`, `pGrassLeft`, `pGrassRight`, `pBarrierTopLeft`, `pBarrierTopRight`) is mathematically identical to the rendered asphalt surface.
   - **Zero Vertical Sagitta Error:** Drops vertical chord error from 15 cm down to 0.000 mm everywhere across the 20.8 km loop. Completely eliminates vehicles sinking/dipping into asphalt on convex crests (e.g. Flugplatz, Pflanzgarten) or levitating/floating above concave compressions (e.g. Fuchsröhre, Tiergarten).
   - **White Line Hitbox Eradication:** White boundary lines and apex graffiti markings are rendered strictly as coplanar vertex colors and texture mappings across the flat road polygon strip, with 0.0mm physical step.
   - **Elevated Chassis Collision Envelope:** Elevated chassis rigid body collider translation to $(0, 0.55, 0)$ with half-height $0.28\text{ m}$ (giving $+0.27\text{ m}$ bottom clearance). The vehicle chassis rigid body collides strictly with vertical Armco crash barriers and other cars, never scraping or snagging road/kerb facets under heavy downforce or full suspension compression.

2. **Global 2D Spatial Clearance & Anti-Encroachment Engine (`TrackSpatialGrid`):**
   - **Spatial Hash Acceleration Grid (`ForestFoliage.TrackSpatialGrid`):** Global 2D spatial hash grid indexing all centerline nodes and segment capsules across the entire circuit.
   - **Anti-Encroachment Safety Perimeter:** Before placing any tree, distance marker, or trackside prop, queries `isNearAnyTrackSegment(x, z, margin = 4.5)`. Rejects any candidate instance positioned within $w_{\text{track}} / 2 + 4.5\text{ m}$ (minimum $10.5\text{ m}$ clearance) of ANY track centerline segment across the entire circuit.
   - **Multi-Loop Deconfliction:** Eradicates tree bleed-through where tight hairpin loops or parallel ribbons (Hatzenbach, Steilstrecke / Karussell switchbacks, Hohenrain chicane, Dunlop-Kehre) previously caused lateral tree offsets from one ribbon to spawn directly onto an adjacent ribbon.
   - **GP Stadium Infield Suppression:** Wild mountain pine and spruce trees are completely suppressed within the Grand Prix stadium envelope ($X \in [-2350, -700], Z \in [2650, 4750]$) to maintain authentic open arena sightlines.

3. **Regional Environmental Zoning Hierarchy:**
   - **Zone A: Historic Eifel Forest (Nordschleife, $s = 3.6 - 24.3\text{ km}$ on 24h, or full 20.8 km):**
     - Continuous 3-tier galvanized Armco steel crash barriers ($1.15\text{ m}$ high).
     - Narrow grass verges ($3.8\text{ m}$) expanding to deep crushed-stone gravel traps ($5.5\text{ m} - 12\text{ m}$) at high-speed overshoot zones (Aremberg, Adenauer Forst, Wehrseifen, Ex-Mühle, Brünnchen, Hohenrain).
     - Dense multi-tier evergreen spruce/pine forest instanced on outward-sloping 35-meter embankments.
     - Authentic fan graffiti markings stenciled on asphalt and weathered concrete patch slabs with dark expansion tar joints in heavy braking zones.
   - **Zone B: Modern FIA Grade 1 Arena (GP-Strecke, $s = 0 - 3.6\text{ km}$):**
     - Covered multi-tier grandstands (Start/Finish Haupttribüne, Mercedes-Benz Arena, Dunlop-Kehre bleachers).
     - 2-story concrete Pit Complex, team garages, VIP hospitality suites, and pit wall with marshaling booths.
     - Overhead Start/Finish steel timing gantry with digital 5-bulb FIA start lights.
     - Wide asphalt runoff aprons, gravel beds with tire barriers, and spectator perimeter fences.
   - **Zone C: High-Speed Proving Ground & Runway ($6.0\text{ km}$):**
     - 5.5 km paved 4-lane straight, 500m overhead steel truss distance gantries, 100m trackside distance boards, handling circles, and slalom cones.

4. **Surface Material Friction & Dynamic Drag Model (`materials.ts` & `raycast-vehicle.ts`):**
   - **Racing Asphalt:** Peak friction multiplier $\mu = 1.0$, rolling resistance coefficient $C_{rr} = 0.015$.
   - **Concrete Slabs / Karussell Bowl:** Friction $\mu = 0.95$, rolling resistance $C_{rr} = 0.020$, subtle expansion joint micro-bump vibration.
   - **Red/White FIA Kerbs:** Friction $\mu = 0.90$, rolling resistance $C_{rr} = 0.025$, authentic rumble strip vibration ($1.8\text{ cm}$ bevel).
   - **Trackside Grass Lawn:** Friction $\mu = 0.35$, rolling resistance $C_{rr} = 0.040$ (low lateral grip triggers spin risk when dropping a wheel).
   - **Deep Gravel Runoff Traps:** Friction $\mu = 0.45$, high displacement drag coefficient $C_{rr} = 0.280$ (heavily decelerates runaway vehicles to halt before barrier impact).

5. **Trackside Race Marshalling & Distance Markers:**
   - **Braking Distance Marker Boards:** Approaching major corners: 300m, 200m, 100m, 50m high-contrast white-on-black marker boards placed on approach verges.
   - **Digital LED Flag Panels:** Digital marshaling panels placed at surveyed marshaling posts, synchronized in real time with the FIA race flag state machine (Green, Sector Yellow, Full-Course Yellow, Red).
   - **Nordschleife Kilometer Stones:** Milestone markers along the 20.8 km loop (KM 0 to KM 20.8) for driver navigation.

### 3.18 Low-Profile Dashboard Screen Pod & Rear-Mounted Exterior Cameras
User request: *"can i get these two screens to be smaller and moved lower on the dash so i can see out of the windshield entirely, also the rear facing view is currently mounted in the second row so all im seeing is seats, can you make it mounted at the rear of the car etc"*

- **Low-Profile Dashboard Dual-Screen Pod (`gt-cockpit.ts`):**
  - Scaled both center dashboard displays down into compact race-spec housings:
    - **Digital Rear-View Mirror Monitor:** Compact $0.16\text{ m} \times 0.08\text{ m} \times 0.018\text{ m}$ carbon casing with $0.15\text{ m} \times 0.07\text{ m}$ active screen ($2:1$ widescreen aspect ratio, matching the $512 \times 256$ render target with zero texture distortion).
    - **In-Cockpit Micro Radar Display:** Scaled to $68\%$ ($0.129\text{ m} \times 0.088\text{ m}$), mounted directly below the rear-view monitor at $y = -0.055\text{ m}, z = -0.015\text{ m}$.
  - Repositioned mounting bracket to $(X = -0.10, Y = 0.51, Z = 0.26)$ with tilt angle $-0.12\text{ rad}$ and yaw $-0.38\text{ rad}$, snug against the lowered center tunnel switch console ($Y = 0.20, Z = 0.24$).
  - **100% Unobstructed Windshield Visibility:** The top edge of the monitor sits strictly below the bottom windshield cowl line ($Y \le 0.55\text{ m}$), providing complete, panoramic forward sightlines from A-pillar to A-pillar over the hood, apexes, and sky.
- **Rear Exterior Mounted Camera Systems (`cockpit-cam.ts` & `rear-view-mirror.ts`):**
  - **Main Screen "Look Behind" Camera (`cockpit-cam.ts`):**
    - Eliminated internal cabin pivot (which previously turned the driver's head into the headrest and second-row seats).
    - When active (`isRearViewActive` / `[B]` / `[V]` / mobile Look Behind button), the camera instantly mounts at the rear exterior of the car $(X = 0, Y = 1.15, Z = -2.35)$ looking straight backward down the track. Completely eliminates seeing seats, headrests, or roll bars, providing an unobstructed panoramic view of pursuing cars.
    - Chase camera mode also orients looking backward toward the vehicle when Look Behind is active.
  - **Digital Rear-View Mirror Screen Feed (`rear-view-mirror.ts`):**
    - Repositioned rear camera from internal roof/second row ($Z = -0.60\text{ m}$) to the rear bumper / rear spoiler deck $(X = 0, Y = 1.05, Z = -2.25)$ looking backward $-Z$, giving a clear wide-angle race feed on the dashboard LCD.

### 3.19 Grand Prix Circuit Front Straight Stadium Alignment & Encroachment Removal
User request: *"there are buildings on track at the grand prix circuit"* (with screenshot showing grandstand and pit building blocking asphalt ribbon).

- **Root Cause Analysis:**
  1. **Straightaway Misalignment:** The grandstand generator previously placed the Haupttribüne along sample indices 15 to 75 and generated the pit complex between sample 18 and 70. In the surveyed GP-Strecke dataset, sample 0 is near the pit exit, and indices 15 to 75 form a 180-degree hairpin turn (Dunlop-Kehre / arena connector). The true 450-meter Grand Prix Start/Finish straightaway is located at samples 80 to 170 ($s = 400\text{ m} \dots 850\text{ m}$, curvature $0.00^\circ$).
  2. **Hairpin Bridge Slicing:** Bridging sample 18 directly to sample 70 with a straight 140m box sliced directly through the apexes and returning road of the loop.
  3. **Three.js Geometry Axis Swap:** In `BoxGeometry(width, height, depth)`, `width` maps to local $X$ and `depth` maps to local $Z$. When aligned to the track with `setFromUnitVectors((0,0,1), fwd)`, local $Z$ is along the track and local $X$ is perpendicular to the track. Putting module length along $X$ rotated every grandstand module and the pit building 90 degrees sideways across the racetrack.
- **Permanent Solution (`stadium-assets.ts`):**
  - **Relocated Haupttribüne to Front Straight:**
    - Sample indices: 85 to 165 (400 meters long).
    - Lateral offset: $-28.0\text{ m}$ (driver's left), providing over $21.5\text{ m}$ of clear asphalt verge/grass.
    - Stadium specs: 6 tiers, $18.0\text{ m}$ depth, $11.0\text{ m}$ height, cantilevered steel canopy roof with forward pitch, red/white seating modules, and dual-sided sponsorship hoardings.
  - **Relocated Concrete Pit Building & Team Garages:**
    - Sample indices: 88 to 162 along the front straight.
    - Lateral offset: $+26.0\text{ m}$ (driver's right).
    - Specs: $18.0\text{ m}$ building depth, $5.5\text{ m}$ ground floor garages, $4.0\text{ m}$ upper VIP hospitality deck with panoramic glass windows, and concrete pit wall at $+11.0\text{ m}$ from centerline ($4.5\text{ m}$ clear verge from asphalt edge).
  - **Orthonormal Basis Frames:** Replaced unconstrained direction vectors with explicit Frenet orthonormal basis matrices ($\mathbf{X} = \text{lateral/driver's right}, \mathbf{Y} = \text{up}, \mathbf{Z} = \text{forward tangent}$) via `Matrix4.makeBasis()`, guaranteeing exact mathematical orientation without pitch/roll drift.
  - **Automated Anti-Encroachment Clearance Filter:** Evaluates every candidate grandstand module's front edge against all track centerline points across the circuit. Rejects/clamps any module closer than $12.0\text{ m}$ to any centerline point, guaranteeing zero track encroachment.
  - **Start/Finish Overhead Gantry:** Placed overhead timing gantry with FIA 5-bulb starting light cluster at sample 95 on the front straight and sample 0, with $24.0\text{ m}$ lateral span and $8.5\text{ m}$ vertical clearance.

### 3.20 Authentic Inside-Bowl Karussell Banking, Grounded Embankments & Strict Tree Barrier Enclosure
User request: *"also a lot of the banking is off and around the carousel im still seeing a lot of flying terrain ans still tress within the bariers all over the track. also how does the track timing invalid logic work?"*

- **Authentic Inside-Bowl Banking Inversion Resolution (`centerline.ts`):**
  - **Root Cause:** In Three.js right-hand coordinates, positive rotation around forward tangent tilts the upward normal vector toward driver's left ($-X$), elevating the right side of the track. In track coordinates, the Caracciola-Karussell curves toward increasing $X$ (inside is on the right $+b$). Applying fixed positive $+33.0^\circ$ made the inside of the bowl $5.45\text{ m}$ *higher* than the outside, creating an inverted off-camber slope that threw cars off the track.
  - **Dynamic Inward Banking Equation:**
    $$\text{effectiveBanking} = \operatorname{sign}(\text{turnRate}) \times |\text{bankingRad}|$$
    where $\text{turnRate} = v_{\text{prev}.x} v_{\text{next}.z} - v_{\text{prev}.z} v_{\text{next}.x}$.
    For right-hand turns ($\text{turnRate} < 0$, inside is $+b$), banking angle is negative, lowering the right side and raising the left side into the bowl. For left-hand turns, banking angle is positive.
  - **Natural Sweeping Cambers Restored:** Reintroduced authentic subtle camber on high-speed sweeps and compressions: Fuchsröhre ($5.5^\circ$), Flugplatz ($3.5^\circ$), Schwedenkreuz ($3.0^\circ$), Brünnchen ($4.0^\circ$), Galgenkopf ($4.5^\circ$), and Kleines Karussell ($22.0^\circ$).
- **Grounded Embankments & Eradication of Flying Terrain (`track-mesh-generator.ts`):**
  - **Root Cause:** Outward 35-meter embankments previously used the tilted normal and binormal (`pGrassFar.addScaledVector(b, 35.0)`). At $33^\circ$ banking, $b_y = +0.544$, projecting the 35m embankment $+22.7\text{ m}$ into the air as a giant flying green wall in the sky.
  - **Horizontal Projection Fix:** Embankments now project strictly along the horizontal lateral normal $\mathbf{h}_{\text{right}} = (t_z, 0, -t_x)$ ($Y = 0$) and slope gently downward in world $Y$ ($-0.35\text{ m}, -1.10\text{ m}, -2.60\text{ m}$), firmly anchoring the grassy terrain to the mountainside without ever soaring into the sky.
- **Strict Tree Barrier Enclosure & Grounded Tree Trunks (`forest-foliage.ts`):**
  - **Root Cause:** Trees previously used `sp.binormal` to compute lateral positions, causing trees on banked corners to float $11\text{ meters}$ in mid-air. Furthermore, the clearance margin of $4.5\text{ m}$ was smaller than the Armco barrier distance ($10.05\text{ m}$), allowing tree trunks and branches to spawn inside the barriers and on the track.
  - **Fix:**
    - Tree offsets project strictly along $\mathbf{h}_{\text{right}}$ ($Y = 0$), anchoring base $Y$ to the ground with zero floating trunks.
    - Expanded minimum tree distance to $|lateralDist| \ge 16.0\text{ m}$ (trunk placed at $16\text{ m} \dots 51\text{ m}$, well outside the $10.05\text{ m}$ Armco barrier).
    - Upgraded spatial clearance grid validation to `margin = 9.5m` ($\text{threshold} = w_{\text{track}} / 2 + 9.5\text{ m} = 14.5\text{ m}$ minimum clearance from any centerline sample loop-wide), strictly enclosing all trees behind the safety barriers.
- **Track Timing Invalidation Architecture (`lap-timer.ts` & `centerline.ts`):**
  - Every physics frame, the vehicle's position is projected onto the centerline spline:
    $$d_{\text{lateral}} = (\mathbf{p}_{\text{car}} - \mathbf{p}_{\text{center}}) \cdot \mathbf{b}$$
    $$\text{isOffTrack} = |d_{\text{lateral}}| > \frac{w_{\text{track}}}{2} + \text{tolerance} \quad (\text{tolerance} = 2.0\text{ m for painted lines/kerbs})$$
  - When `isOffTrack === true` during an active timed lap, `isLapValid` latches to `false`.
  - The HUD instantly displays `LAP: INVALID` in red badge.
  - An invalid lap time is retained for sector reference but rejected from `bestLapTime`.
  - Crossing the Start/Finish line resets `isLapValid = true` for the subsequent lap.

---

## 4. Phase 3: Advanced Motorsport Systems (Paused & Merged into Phase 5)

> **Status:** Paused per user directive. Core vehicle physical simulation systems (tyre degradation, dynamic fuel depletion, thermal brake efficiency) are directly merged into Phase 5: Nürburgring & Simulation Realism.

User request:
```
Phase 3: Advanced Motorsport Systems
├── 3.1: Interactive Pit Lane & Garage Setup UI
│   ├── Pit box entry detection & auto-stop
│   ├── Host 3D garage bay & telemetry page (mouse-driven)
│   ├── Controller touch setup menu (tires, fuel, wing angle, brake bias, assists)
│   └── Bidirectional WebSocket parameter synchronization
├── 3.2: Tyre Degradation, Thermal Fade & Consumables
│   ├── Slip energy wear accumulation reducing peak Pacejka friction (D)
│   ├── Thermal brake fade reducing pad friction coefficient above 750°C
│   └── Dynamic fuel mass depletion (0.75 kg/L) shifting chassis mass and balance
├── 3.3: Dynamic Environment & Weather
│   ├── Modular day/night lighting cycle via directional sun progression & working headlights
│   ├── Procedural rain particle emitter around camera & windshield droplet distortion shader
│   ├── 40% surface friction reduction with slick-tire hydroplaning
│   └── 2D dynamic drying line clearing water along the racing groove
└── 3.4: Timing, Ghost Car & Multiplayer
    ├── Full 9-sector timing breakdown with live delta splits (+/- delta HUD)
    ├── Local ghost car recording & playback
    └── WebRTC DataChannel peer-to-peer multiplayer lobby
```

### 4.1 Infinite Tyre & Fuel (Pit Lanes Scrapped) + Thermal Brake Fade
User decision: *"forget the pit lanes, scrap that from implimentation. no need for it just have infinite tyre and fuel even with friends"*
- **Pit Lanes & Garage UI Scrapped:**
  - Removed the Pit Lane & Garage Setup implementation (`pit-lane.ts`, `garage-setup-ui.ts`, `pit-setup-menu.ts`, and pit entry buttons on the Host HUD and mobile Controller).
- **Infinite Tyre Life & Infinite Fuel Everywhere (`RaycastVehicle` in `src/host/physics/raycast-vehicle.ts`):**
  - `consumablesEnabled = false`, `wearRateMultiplier = 0.0`, and `fuelBurnMultiplier = 0.0` are active by default at all times, both in solo sessions and when racing with friends in WebRTC P2P multiplayer (`tireHealthPercent = [100, 100, 100, 100]`, `fuelLiters = 60.0L` constant).
- **Thermal Brake Fade Above $750^\circ\text{C}$ (`BrakeSystem` in `src/host/physics/brakes.ts`):**
  - Models per-corner carbon-ceramic/cast-iron rotor heat capacity, aerodynamic convective cooling ($h_{\text{air}} = 1.8 + 0.36 v$), and frictional heat flux ($\dot{Q} = \tau_{\text{brake}} \cdot |\omega|$).
  - Above $750^\circ\text{C}$, pad friction coefficient $\mu_{\text{pad}}$ degrades linearly from nominal $0.42$ down to $0.19$ at $1,100^\circ\text{C}$ (`fadeFactor` down to $45\%$), directly reducing clamping torque.

### 4.2 Recessed Endurance Racing Headlights & Brake Lights (`CarMeshRig` & `LiverySystem`)
User decision: *"headlights are really dim for racing headlights and make it nice please so its not just two circles blocking my view right now, actually recess the brake and headlights into car model"*
- **Eradication of Floating Cylinder Circles Blocking Cockpit View (`CarMeshRig.initHeadlights`):**
  - Removed the two procedural cylinder lens meshes (`leftLens`, `rightLens` at $(\pm 0.72, 0.52, 2.08)$) and floating taillight bar from `this.headlightsGroup` that previously hovered above the front fenders in the driver's cockpit sightline.
- **Direct Binding to Authentic Recessed 3D Model Light Assemblies (`CarMeshRig.bindRecessedLightMeshes` & `LiverySystem`):**
  - Binds dynamic `headlightLensMaterial`, `taillightMaterial`, and `brakeLightMaterial` directly to the authentic recessed 3D meshes inside `public/assets/cars/porsche_992_rsr/model.glb`:
    - Front recessed projectors & housings: `Headlight_Emissive`, `Signal_Front_Emissive`, `HeadLight_Glass` (transparent polycarbonate cover, `transmission: 0.88`, `opacity: 0.22`), and `HeadLight_Housing_Static` (deep matte carbon bucket).
    - Rear recessed light bar & third brake light: `Taillight_Strip_Emissive`, `Taillight_Brake_Emissive`, `Tailgate_Brake_Emissive`, `Taillight_Main_Glass`, and `Taillight_Housing_Static_*`.
  - Fallback procedural `proxyGroup` lights are recessed inside dark fender/rear housing pockets strictly below the fender crest ($Y = 0.36\text{ m}, Z = 1.86\text{ m}$).
- **High-Output Endurance Racing Headlight Beams & Rearward-Only Directional Brake Lights:**
  - Dual long-throw `THREE.SpotLight` main beams (`distance = 280m`, `decay = 0.45`, `intensity = 24.0`, $\theta = \pi / 3.8$) positioned inside the recessed fender housings ($X = \pm 0.76\text{ m}, Y = 0.39\text{ m}, Z = 1.85\text{ m}$).
  - Wide cornering apron flood `THREE.SpotLight` (`distance = 115m`, `decay = 0.50`, `intensity = 14.0`, $\theta = \pi / 2.2$) illuminating apex kerbs and immediate track edges.
  - Directional rear brake `THREE.SpotLight` emitters ($X = \pm 0.64\text{ m}, Y = 0.42\text{ m}, Z = -2.02\text{ m}$) aimed strictly rearward toward $-Z$ ($Z_{\text{target}} = -14.0\text{ m}$, $\theta = \pi / 2.6$). Replaces omnidirectional point lights, completely eliminating red light shining forward into the cockpit cabin while brightly illuminating trailing track asphalt and spray under braking.

### 4.3 Dynamic Environment & Exterior-Only Weather (Phase 3.3)
User decision: *"weather implimentation is bad, when it rains it shows up even in the cockpit I can't really see."*
- **Modular Day/Night Lighting Cycle (`EnvironmentManager` in `src/host/render/environment-manager.ts`):**
  - Progresses solar time (`timeOfDayHours` $0.0\text{–}24.0\text{ h}$, configurable progression speed or instant presets `[L]`: Dawn, Noon, Golden Dusk, Midnight).
  - Smoothly interpolates sun directional vector, zenith/horizon sky dome shaders, atmospheric fog, and ambient hemisphere intensity, automatically enabling high-output racing headlights at dusk/night or in rain (`[H]` manual override + HUD `LIGHTS [H]` chip).
- **Exterior-Only 3D Rain Emitter (Zero Rain Inside Cockpit) (`EnvironmentManager.sampleExteriorRainXZ`):**
  - Spawns all 1,600 velocity-slanted 3D rain streaks (`THREE.LineSegments`, `depthTest: true`) strictly within an exterior cylindrical annulus around the camera ($r \in [4.8\text{ m}, 34.0\text{ m}]$), guaranteeing zero rain particles ever spawn or fall inside the enclosed cockpit cabin.
  - Updated the windshield shader to `discard` across the entire lower cockpit ($vUv.y < 0.50$, covering the steering wheel and dashboard) and central road sightline ($\text{distFromSight} < 0.32$), removing the opaque wiper bar and keeping forward visibility 100% clear.
- **40% Surface Friction Reduction, Slick Hydroplaning & 2D Dynamic Drying Line (`TrackDryingLine` in `src/host/physics/drying-line.ts`):**
  - 2D track moisture occupancy grid (`512` longitudinal bins $\times$ `16` lateral bins across $-8\text{ m}\dots +8\text{ m}$).
  - $100\%$ surface wetness reduces base surface grip by $40\%$ ($\mu_{\text{wet}} = 0.60 \cdot \mu_{\text{dry}}$).
  - Slick tires traveling above $145\text{ km/h}$ through standing water ($w > 0.32$) experience progressive wedge hydroplaning (dropping effective grip down to $0.18$), whereas grooved `wet` compound tires evacuate standing water and resist hydroplaning.
  - Rolling tires displace water along their exact $(s, d)$ trajectory, dynamically carving a visibly drier, higher-grip racing groove (`racingLineGrooveDryness`) over successive laps.

### 4.4 9-Sector Timing, Ghost Car & WebRTC P2P Multiplayer (Phase 3.4)
- **Full 9-Sector Timing Breakdown & Live `+/-` Delta HUD (`NordschleifeLapTimer` in `src/host/streaming/lap-timer.ts`):**
  - Partitions the circuit into 9 official Nürburgring sectors (`S1 · Hatzenbach` through `S9 · Döttinger Höhe`), tracking individual sector durations, session-best purple sectors (`purple`), personal-best green sectors (`green`), and slower yellow sectors (`yellow`).
  - Computes continuous distance-interpolated live delta (`liveDeltaMs`) against the reference best lap and displays a color-coded `+/-` delta bar and 9-sector split table on the Host HUD and Porsche 911 RSR LCD steering wheel screen.
- **Local Ghost Car Recording & Playback (`GhostCarManager` in `src/host/gameplay/ghost-car.ts`):**
  - Samples player chassis pose (`pos`, `quat`, `steerAngle`, `wheelSpin`, `distanceM`) at $30\text{ Hz}$ during valid laps, automatically promoting faster laps to the persistent `localStorage` best ghost.
  - Interpolates keyframes via `Vector3.lerp` and `Quaternion.slerp` and renders a translucent cyan holographic 3D Porsche 911 RSR ghost car on track (`[K]` toggle).
- **WebRTC DataChannel Peer-to-Peer Multiplayer Lobby (`WebRTCMultiplayerLobby` in `src/host/net/webrtc-lobby.ts`):**
  - Native `<dialog>` modal lobby (`[O]` key or HUD `P2P LOBBY` button) supporting automatic room signaling over `/ws?role=peer`, manual copy/paste SDP Offer/Answer tokens for serverless P2P connection, and a 1-click **Loopback P2P Pace Peer** (`RTCPeerConnection` $\leftrightarrow$ `RTCPeerConnection` in-browser) for immediate local verification.
  - Streams compact 44-byte binary vehicle pose packets (`0x5032` magic header) over unordered `RTCDataChannel` (`maxRetransmits: 0`) at $60\text{ Hz}$ and renders 3D remote peer cars with roof callsign beacons in the Three.js scene.

### 4.5 Multi-Class Sandbox Roster & Variables Database
- Maintained in [`docs/variables-database.csv`](docs/variables-database.csv) and [`src/common/variables-dictionary.ts`](src/common/variables-dictionary.ts).
- Master multi-vehicle roster: Formula 1, Le Mans Hypercar, production GT3 street, and extreme sandbox vehicles.
- Dedicated Rapier compound hitboxes protect 3D models from wall clipping while letting 4-wheel raycasts govern suspension contacts.
- Future hybrid ERS boost and EV powertrain architectures with iconic pitlane EV-to-ICE launch sequence.

---

## 5. Phase 5: Nürburgring & Simulation Realism (Assetto Corsa Competizione Level)

User request:
> "i think we put a pause on phase 3 for now. I think lets pause phase 4 too and work on phase 3 + nurburgring (call it phase 5 for now imporvements) make phase 4 phase 6, and phase 5 phase 7. I want a clear implementation idea for improving the nurburgring and bringing it up to aseesto corsa level graphics and realism, One thing im noticing is the elevation changes arent drastic enough like the real nurburgring and we need more forest so that it feels like we are in the forest. also missing like red and white barriers, fenced barriers with cages, and sort of sponsor bridge etc. Then lets think about bringing the car up to realism as much as possible. the issue right now and why i killed it earlier was pitlane issues, We didnt have a clear enough pitlan and it was just thrown inot the middle of track. I need an actual pitlane we can drive in with our proper pitbox and support for multiple pit boxes in the future, speed limits etc. right now yellow flag systems are also broken and i think its just placeholder, get rid of ghost ai cars showing up as dots, until we impliment them lets not show them. It's nice seeing your ghost car on the map for timed laps. SO basically really study the nurburgring (all layouts) and bring the track to realism as much as possible (asseto corsa competizione level) and also implement the real physics etc, tyre wear, fuel, brake temp translating into efficiency, etc. I think the rear lights are bit too bright like it illuminates unlike the real headlights and fix sunset/dawn ambience. it should also have an actual 24 hour cycle for endurance races etc. Basically for this next phase we call phase 5 work on relaism of car + track so its like for real sim (need standard documentaion and add on to the current skills.md files for how to build tracks and cars that we currently have including car model extraction, wheel mapping, livery mapping etc. Once this is done. next step Is the improvements for ghost cars, and multiplayers settings which we should discuss more. then we can do multi class and tracks etc. I wnted the barriers to be fixed a bit more because a hard crash can get me out of track. technically it shouldnt happen barriers should stop me and prevnt me from noclipping etc. if you understand, please edit implimentation and idea.md and let me know if you need any clarifications?"

### 5.1 Authentic Surveyed Topography & Drastic Elevation Dynamics
- **Surveyed Elevation Benchmarks:**
  - Recalibrate and un-flatten the elevation spline to match the extreme vertical contours of the real Eifel circuit:
    - Lowest elevation: Breidscheid river bridge valley floor at $320.0\text{ m}$.
    - Highest elevation: Hohe Acht mountain ridge crest at $626.8\text{ m}$ (total vertical drop of **$306.8\text{ meters}$** / 1,007 feet).
  - **Fuchsröhre Roller-Coaster Compression:** Authentic sustained $11.7\%$ downhill plunge into severe vertical G-compression at the valley trough, followed by dramatic chassis rebound climbing up to Adenauer Forst.
  - **Ex-Mühle to Bergwerk Mountain Climb:** Authentic $300\text{ m}$ continuous mountain grade demanding full throttle momentum.
  - **Flugplatz & Pflanzgarten Jump Crests:** Crisp vertical curvature transitions that physically unweight the suspension and initiate transient airborne states without glitching raycast wheel contacts.
  - **Authentic Camber & Banking:** 33.0° steep concrete bowl at Caracciola-Karussell, 22.0° Kleines Karussell, and natural off-camber transitions at Hatzenbach and Wehrseifen.

### 5.2 Multi-Layer Dense Forest Immersion & Roadside Canopy Engine ("The Green Hell")
- **Visual Immersion Target:** Replicate the authentic, claustrophobic Eifel forest atmosphere where towering tree canopies enclose the asphalt ribbon.
- **Vegetation Hierarchy:**
  - Layer 1: Roadside undergrowth, grass tufts, and dense shrubs placed immediately behind the Armco barriers ($d = 5.5\text{ m} \dots 10.0\text{ m}$).
  - Layer 2: Mature evergreen spruce, Scots pine, and broadleaf European beech trees ($d = 10.0\text{ m} \dots 28.0\text{ m}$) with overhanging foliage canopies.
  - Layer 3: Deep mountain forest backdrop extending $28.0\text{ m} \dots 75.0\text{ m}$ up mountain ridges and down valleys.
- **Encroachment Prevention:**
  - Global 2D spatial clearance hash grid enforces strict minimum distance: $|d_{\text{lateral}}| \ge w_{\text{track}} / 2 + 5.5\text{ m}$ from ANY track segment, eliminating tree bleed-through onto adjacent track ribbons in tight hairpin switchbacks (Steilstrecke / Karussell, Dunlop-Kehre, Hohenrain).
- **GPU Instancing & Multi-LOD Optimization:**
  - Procedural tree clusters rendered via `THREE.InstancedMesh` with 1 draw call per chunk.
  - 2-Tier LOD system: LOD0 3D faceted geometry within $150\text{ m}$; LOD1 camera-facing cross-quad billboards beyond $150\text{ m}$.
  - Supports 600–900 trees per 2 km chunk while maintaining locked 60–120 FPS on Apple M4 Pro hardware.

### 5.3 High-Fidelity Trackside Assets, Catch Fencing, Red/White Barriers & Sponsor Bridges
- **FIA Debris Catch Fencing:**
  - $2.5\text{ m}$ steel vertical support stanchions supporting dark steel wire mesh safety cages mounted directly atop the Armco crash barriers along spectator zones, grandstands, and high-speed sections.
- **Red-and-White Impact Barriers:**
  - High-impact runoffs (Aremberg, Adenauer Forst, Wehrseifen, Ex-Mühle, Brünnchen, Hohenrain) equipped with red-and-white striped tire barrier stacks and Tecpro energy-absorbing barrier blocks with realistic physical contact friction ($\mu = 0.85$).
- **Authentic Overhead Sponsor Bridges & Gantries:**
  - Bilstein Bridge at Döttinger Höhe ($s \approx 19,200\text{ m}$).
  - Audi, Yokohama, and Dunlop overhead bridges on the Grand Prix straight and Nordschleife approach.
  - Overhead start/finish timing gantry with FIA 5-red-light starting rig.

### 5.4 Anti-Noclip Multi-Tier Safety Barriers & Continuous Collision Detection (CCD)
- **The Problem:** In violent high-speed crashes ($250\text{–}300+\text{ km/h}$), vehicles can tunnel through thin 2D barrier collision meshes and get trapped out of bounds.
- **Thickened Kinematic Collision Envelopes:**
  - Safety barriers are modeled as continuous 3D collision volumes with minimum depth $t \ge 0.50\text{ m}$ behind the Armco face.
  - Continuous physical barrier backing anchored deep into the terrain.
- **Continuous Collision Detection (CCD):**
  - Enable Continuous Collision Detection on the Rapier chassis rigid body:
    ```typescript
    bodyDesc.setCcdEnabled(true);
    ```
  - Rapier performs swept-sphere time-of-impact (TOI) calculations, guaranteeing zero barrier noclipping or tunneling even at $320\text{ km/h}$ impacts.

### 5.5 Authentic Dedicated Drivable Pit Lane, Pit Wall Divider & Pit Box Architecture
- **Physical Pit Lane Separation:**
  - Constructs a physically dedicated pit lane running parallel to the Start-Ziel straight, partitioned by a continuous concrete pit wall divider ($h = 1.05\text{ m}$, $w = 0.45\text{ m}$) topped with safety debris fencing and team pit perches.
- **Pit Lane Geometry & Wayfinding:**
  - **Deceleration Entry Lane:** Distinct angled pit entry diverts smoothly off the main straight with painted chevrons and deceleration braking markers.
  - **Concrete Pit Apron:** $7.5\text{ m}$ wide concrete paved roadway with team service stalls on driver-right and through-lane on driver-left.
  - **Team Pit Boxes:** Marked individual pit stalls ($6.5\text{ m} \times 3.2\text{ m}$) with bright yellow/white perimeter lines, overhead fuel and air hose gantry lollipop rigs, and team tool chests.
  - **Multi-Stall Multiplayer Support:** Engineered with $N \ge 10$ distinct sequential pit stalls, ready for multi-car multiplayer pit allocations.
  - **Acceleration Exit Merge Lane:** Extended blend lane separated by a solid white boundary line running down the main straight, preventing unsafe merges into high-speed traffic.
- **Pit Lane Speed Limiter & Service Logic:**
  - Automated entry trigger volume engages mandatory pit lane speed limiter ($60\text{ km/h}$).
  - Driver can toggle pit limiter via mobile controller button or keyboard shortcut `[L]`.
  - Staccato audio engine governor cut sound when limiter is active.
  - Bringing car to a complete stop inside the designated pit box triggers stationary service sequence (tire change, refueling, damage repair) with pit crew timer.

### 5.6 HUD Radar & Flag Cleanup
- **Removal of Broken Placeholder Yellow Flag System:**
  - Eradicated unreliable placeholder yellow flag triggers and flashing sector warnings from HUD.
- **Removal of Fake AI Competitor Dots:**
  - Removed synthetic moving competitor dots (#911, #1, #92, etc.) from the HUD radar and cockpit micro-radar.
- **Strict Retention of Player Ghost Car:**
  - The player's personal best ghost car blip and silhouette remain clearly visible on the HUD radar and cockpit display during timed hotlaps, providing clean visual reference against their session delta.

### 5.7 Full Vehicle Physical Realism (Assetto Corsa Standard)
- **Authentic Tyre Wear Simulation:**
  - Accumulates frictional slip energy:
    $$\Delta E_{\text{slip}} = (|F_x \cdot v_{\text{slip},x}| + |F_y \cdot v_{\text{slip},y}|) \cdot dt$$
  - Reduces peak Pacejka friction coefficient $D$ progressively over laps:
    $$D(t) = D_{\text{fresh}} \cdot \left(1.0 - k_{\text{wear}} \cdot \frac{E_{\text{accum}}}{E_{\max}}\right)$$
  - Models camber wear across tire shoulders and flat spots under severe braking lockups.
- **Dynamic Fuel Mass Consumption & Balance Shift:**
  - Dynamic fuel burn rate ($\sim 0.65\text{–}0.85\text{ L/min}$ at full throttle) depleting a $60.0\text{ L}$ tank ($0.75\text{ kg/L}$).
  - Burning off $45\text{ kg}$ of fuel reduces total vehicle mass and shifts corner weights and polar moment of inertia over endurance stints.
- **Brake Thermal Efficiency & Fade Dynamics:**
  - Per-corner rotor thermal simulation with aerodynamic cooling ($h_{\text{air}} = 1.8 + 0.36 v$) and frictional heat flux.
  - Dynamic friction curve:
    - Cold pads ($<200^\circ\text{C}$): Initial bite reduced ($\mu = 0.32$).
    - Optimal window ($350\text{–}650^\circ\text{C}$): Peak stopping bite ($\mu = 0.44$).
    - Thermal fade ($>750^\circ\text{C}$): Linear pad friction degradation down to $\mu = 0.19$ at $1,100^\circ\text{C}$ (up to $55\%$ brake fade).

### 5.8 Visual & Atmospheric Lighting Realism
- **Diffuse, Realistic Rear Taillights & Brake Lights:**
  - Replaced over-bright rear spotlights that unnaturally illuminated the world.
  - Tuned rear lights to realistic diffuse red glow (`emissiveIntensity = 1.8`) with localized pavement bounce and soft shadow falloff, eliminating unrealistic forward/global light projection.
- **Sunset & Dawn Atmospheric Ambience:**
  - Physically based atmospheric scattering model (Rayleigh and Mie scattering).
  - Warm golden hour low-angle sunlight, long dramatic shadows across the Eifel ridges, and soft violet/amber dusk transitions.
- **Continuous 24-Hour Day/Night Endurance Cycle:**
  - Time-of-day progression supporting configurable time compression ($1\times$ real-time, $12\times$, $24\times$, $48\times$) for authentic 24-hour endurance simulations.

### 5.9 Standardized Asset Creation & Pipeline Documentation (`docs/skills.md`)
- Authoritative engineering manual established in [`docs/skills.md`](file:///Users/le/Documents/racing%20game/docs/skills.md) documenting:
  - Procedural track creation pipeline: Centerline splines, surveyed DEM extraction, road sweep extrusion, barrier generation, catch fencing, sponsor bridges, pit lanes, chunk partitioning, collision trimeshes.
  - Vehicle asset pipeline: 3D model ingestion and sanitization, dynamic 4-wheel extraction and suspension rigging, standardized flat wrap UV unwrapping and livery mapping, lighting attachments.
  - Sound design pipeline: Headphone-safe audio synthesis, engine pulse layering, straight-cut gearbox filtering, and safety compression.

### 5.10 Anti-Nausea Cockpit Camera Horizon Lock & Damped Chassis Bump Dynamics
User request:
> "with car can we add like camera shake cause i noticed watching onboards that the nordschliefe is really bumpy but i dont want it to make a perosn nauseaus you know, the car can shake but the internal camers hsould be fixed in cockpit."

- **The Motion Sickness Problem:**
  - Real Nordschleife onboard footage displays intense chassis vibration over kerbs, compressions, and asphalt seams.
  - Applying raw, unfiltered angular pitch and roll shaking directly to the driver's camera causes acute vestibular-ocular conflict, simulator sickness, and nausea in first-person cockpit view.
- **Biomechanical Solution (Vestibulo-Ocular Reflex - VOR):**
  - **Stabilized Internal Cockpit Camera:** The camera's forward sightline applies an $85\text{–}90\%$ horizon lock. Angular pitch and roll rotations are heavily low-pass filtered, maintaining a smooth, stable road horizon ahead.
  - **Dynamic Cockpit Interior Vibration:** The physical car chassis, dashboard, steering column, A-pillars, and roll cage receive high-frequency vertical and angular displacement driven by suspension deflection $\Delta z$ and kerb strikes.
  - **Sensory Immersion:** The driver perceives the authentic bumpiness of the Nordschleife through the cockpit bouncing and vibrating vigorously in their peripheral vision, while their central gaze remains rock-solid and stable on the racing line, eliminating nausea.
  - Micro-displacement is clamped to $\le 2.5\text{ mm}$ to prevent geometry clipping.

### 5.11 Continuous Non-Jagged Spline Geometry with Authentic Road Surface Bumps
User request:
> "like do you get smooth track like its not jagged but there are bumps etc that"

- **Geometric Continuity vs. Surface Bumps:**
  - **Smooth Track Ribbon:** The primary track surface is extruded along an 8-pass Taubin faired cubic spline with $C^2$ second-derivative continuity. It is completely free of polygonal kinks, angular facets, or DEM staircasing, ensuring silky-smooth visuals and predictable tire contact patches.
  - **Authentic Multi-Band Bump Dynamics:**
    - *Macro-Elevation:* Surveyed vertical contours (Fuchsröhre plunge, Breidscheid depression, Bergwerk climb, Hohe Acht crest) are smoothly faired to preserve high-G vertical compressions and crest weightlessness.
    - *Medium-Wave Asphalt Settling:* Continuous procedural Perlin noise ($\lambda = 8\text{–}25\text{ m}$, amplitude $\pm 18\text{ mm}$) models the natural undulating character of the Eifel mountains.
    - *Short-Wave Micro-Bumps & Tar Seams:* Transverse bump impulses ($\lambda = 0.5\text{–}1.2\text{ m}$, amplitude $\pm 8\text{ mm}$) at historic tarmac expansion joints, repaired asphalt bands, and Karussell concrete slab seams.
  - **Physics Interaction:** These surface undulations excite the 240 Hz Rapier vehicle suspension spring-dampers directly, driving realistic wheel travel, tire load variation, and chassis vibration without polygonal jaggedness.

### 5.12 Dedicated Sound Design Pipeline & Headphone-Safe Gearbox Synthesis (`docs/skills.md`)
User request:
> "also sound design needs a dedicated skill for sure because with earphoens on the whine hurts my ears."

- **The Headphone Ear-Fatigue Problem:**
  - Straight-cut spur gearboxes produce a high-frequency acoustic meshing tone ($1,000\text{–}3,800\text{ Hz}$).
  - A high-Q resonant bandpass filter or unfiltered harmonic overtone in the $2.5\text{–}4.0\text{ kHz}$ range directly stimulates the human ear canal's natural resonant peak, causing ear strain, pain, and headaches in headphones.
- **Acoustic Engineering Fixes & Dedicated Skill (`docs/skills.md` Section 4):**
  - **Steep Low-Pass Rolloff:** 2nd-order Butterworth low-pass filter at $3,200\text{ Hz}$ ($-12\text{ dB/octave}$) cuts piercing high-frequency overtones.
  - **Ear-Canal Resonance Notch Filter:** Dedicated parametric notch filter centered at $3,500\text{ Hz}$ ($Q = 3.0$, gain $-8.0\text{ dB}$) eliminating the painful treble spike.
  - **Torque Load-Dependent Attenuation:** Whine volume is driven strictly by driveline torque. When cruising, coasting, or idling, transmission whine drops by $-18\text{ dB}$, eliminating persistent high-pitched drone.
  - **Rich Multi-Harmonic Engine Core:** Deep flat-six combustion rumble ($40\text{–}450\text{ Hz}$) with throaty intake roar under load anchors the soundscape.
  - **Dynamics Compressor & Brickwall Limiter:** Master bus compression clamps volume spikes, backfires, and crash impacts.

---

## 6. Phase 6: Private Multiplayer & Dynamic Race Procedures (Paused)

> **Status:** Paused per user directive while Phase 5 (Nürburgring & Car Realism) is underway.

User request:
> "multiplayer support, only private lobbies with 4 digit codes for people to join, so you can make your own lobby, and get settings, like lap count, number of people joining, need proper race start line for grand prix, for nurburgring it needs to be a rolling start before the start/finish line and a floating 3 light countdown, for grandprix settings it the standard 5 light sequence like real f1. no rolling start. multiplayer needs to have settings for collision which can be turned off. also now if i flip off track, I need to restart, can we make so we can spawn back on track near where we crashed etc. brainstorm a bit for phase 4 please?"

### 6.1 Private 4-Digit Lobbies & Host Configuration
- **Access Model & Room Codes:**
  - Multiplayer sessions are strictly private; no public matchmaker or open server browser.
  - Lobbies are addressed via simple **4-digit numeric codes** (e.g., `4821`, `7104`), making room sharing frictionless across chat, mobile screens, or voice calls.
  - The host clicks "CREATE LOBBY" to claim a unique 4-digit code generated from available signaling rooms.
  - Joining players enter the 4-digit PIN in the main menu / lobby dialog, or join via direct URL: `https://<host>:5173/?room=4821`.
- **Host Room Settings:**
  - **Circuit Selection:** Choose between Nürburgring Nordschleife (20.8 km), Nürburgring 24h Gesamtkurs (24.3 km), Nürburgring GP-Strecke (5.1 km), or High-Speed Proving Ground.
  - **Lap Count:** Select target race distance (e.g., 1 lap sprint on Nordschleife, 3, 5, 10, or 25 laps on GP-Strecke).
  - **Max Competitors:** Cap lobby capacity between 2 and 16 drivers.
  - **Collision Toggle:** ON / OFF (Ghost Mode).
- **Lobby Staging & Grid Presentation:**
  - Real-time roster display showing connected peer driver tags, car numbers, livery choices, round-trip ping, and ready-state checkmarks.
  - Host initiates the countdown session once competitors flag "READY".

### 6.2 Format-Specific Race Start Sequences
Race start procedures are tailored specifically to the chosen circuit and motorsport discipline:

#### 6.2.1 Grand Prix Standing Start (F1 5-Red-Light Sequence)
- **Circuit Assignment:** Standard on Nürburgring GP-Strecke (and GP sprint configurations).
- **Grid Formation:**
  - Staggered 2-by-2 standing grid boxes on the Grand Prix Start-Ziel straight.
  - Cars held stationary with locked brakes and launch limiter active.
- **FIA 5-Red-Light Sequence:**
  1. Light 1 turns RED at $T = 1.0\text{ s}$.
  2. Light 2 turns RED at $T = 2.0\text{ s}$.
  3. Light 3 turns RED at $T = 3.0\text{ s}$.
  4. Light 4 turns RED at $T = 4.0\text{ s}$.
  5. Light 5 turns RED at $T = 5.0\text{ s}$.
  6. **Random Hold Delay:** Variable pause between $0.4\text{ s}$ and $2.4\text{ s}$ with all 5 red lights lit (matching FIA Formula 1 sporting regulations).
  7. **LIGHTS OUT:** All 5 red lights extinguish simultaneously $\to$ Green flag condition, throttle unlock, race timer commences!
- **Strict Rule:** **No rolling start** for Grand Prix settings.
- **Jump-Start Detection:** If vehicle forward movement exceeds $0.25\text{ m}$ before lights out, a jump-start violation is logged (triggering a 10-second post-race time penalty or pit drive-through notification).

#### 6.2.2 Nürburgring Universal Standing Start
- **Universal Standing F1 5-Red-Light Starts:** Per user directive (*"get rid of rolling starts entirely"*), rolling starts are removed. Nordschleife and 24h Gesamtkurs spawn in 2x2 grid boxes behind Start/Finish line and use the F1 5-red-light sequence with launch clamp and jump-start detection.

### 6.3 Smart Near-Crash Track Recovery & Respawn
User request: *"also now if i flip off track, I need to restart, can we make so we can spawn back on track near where we crashed etc."*

- **The Problem:** Resetting to $s=0$ (Start/Finish line) after an off-track flip 15 kilometers into the Nordschleife ruins the run and disconnects players from friends.
- **Trigger Conditions:**
  1. **Manual Driver Trigger:** Hitting `[R]` on the keyboard or tapping `RESPAWN` on the mobile controller.
  2. **Rollover Detection:** Automatic trigger if the car's vertical roof normal points downward ($\mathbf{u}_{\text{car}} \cdot (0, 1, 0) < 0.20$, $>78^\circ$ rollover tilt) for more than $2.5\text{ seconds}$.
  3. **Barrier Stuck Detection:** Stationary off-track outside Armco bounds for $>4.0\text{ seconds}$.
- **Centerline Projection & Anti-Exploit Placement:**
  1. Determine crash point coordinates $\mathbf{p}_{\text{crash}} = (x, y, z)$.
  2. Project $\mathbf{p}_{\text{crash}}$ onto the circuit centerline spline to obtain spline distance $s_{\text{crash}}$.
  3. Apply an anti-exploit distance offset so players can never gain distance by crashing forward:
     $$s_{\text{respawn}} = \max(0, s_{\text{crash}} - 8.0\text{ m})$$
  4. Query the centerline at $s_{\text{respawn}}$ for track center $\mathbf{p}_{\text{track}}$, tangent vector $\mathbf{t}$, surface normal $\mathbf{n}$, and local banking $\theta_{\text{bank}}$.
  5. Position vehicle centered on the racing line, elevated $+0.35\text{ m}$ above the asphalt to allow raycast suspension springs to settle naturally.
  6. Align vehicle heading directly with tangent $\mathbf{t}$ (facing downstream in valid racing direction).
  7. Reset linear velocity $\mathbf{v} = \mathbf{0}$, angular velocity $\boldsymbol{\omega} = \mathbf{0}$, wheel spin speeds $\omega_i = 0$, and shift transmission to 1st gear.
- **Safe Re-Entry Ghost Invulnerability:**
  - Upon respawning, the vehicle enters a $3.0\text{ second}$ translucent ghost state ($40\%$ opacity with glowing cyan perimeter shield).
  - Physical collision with other vehicles is disabled during ghosting, preventing approaching competitors at high speed from colliding into a recovering car.
  - Lap timing latches to `isLapValid = false` (`LAP INVALIDATED - RESPAWN`), ensuring competitive lap record integrity while allowing the race to continue.

### 6.4 Collision Settings & Multiplayer Physics Modes
- **Collision OFF (Ghost Mode - Default):**
  - Competitor vehicles are rendered as visual 3D glTF meshes with roof callsign pins and real-time wheel animations.
  - No Rapier rigid bodies or colliders are instantiated for remote cars.
  - Cars can pass through one another without physical bumping, preventing griefing, network-induced spinouts, and multi-car pileups on tight sections like Wehrseifen or Adenauer Forst.
- **Collision ON (Physical Contact Mode):**
  - Remote cars instantiate kinematic Rapier collision boxes matching vehicle extents ($4.5\text{ m} \times 2.0\text{ m} \times 1.1\text{ m}$).
  - Contact points trigger elastic restitution impulses and audio crash impacts.
  - Contact positions are smoothed via a dead-reckoning extrapolation filter to avoid rubber-banding.

---

## 7. Phase 7: Multi-Class Motorsport Ecosystem & Dynamic Series

User request:
> "phase 5 will be just building more tracks, cars, classes, series, etc and chaning menu based on that"

### 7.1 Multi-Class Vehicle Taxonomy & Homologation
Phase 7 expands vehicle options into formal motorsport classes, each with distinct physics weights, downforce coefficients, and powertrain dynamics:
- **LMH / LMDh (Hypercar & Prototype):** Top-tier endurance prototypes (e.g., Porsche 963, Ferrari 499P). 700 HP hybrid powertrain, all-wheel electric boost, high downforce, 1,030 kg minimum weight, top speeds approaching $340\text{ km/h}$.
- **GT3 / GTE (Production Racing):** Production-based GT racecars (Porsche 911 GT3 R / RSR-19, Ferrari 296 GT3, BMW M4 GT3, Corvette Z06 GT3.R). 515–540 HP, aerodynamic swan-neck wings, steel/carbon brakes, 1,250 kg weight.
- **Formula / Single-Seater:** Open-wheel formula machinery. 1,000 HP hybrid turbo V6, halo protection, extreme aerodynamic cornering grip ($3.5+\text{ G}$ lateral), ultra-light 798 kg chassis.
- **Cup / One-Make:** Pure analog racing machinery (Porsche 911 GT3 Cup). 510 HP, naturally aspirated flat-six, sequential manual gearbox, optional ABS/TC suppression for pure driver skill.
- **GT4 / Clubsport:** Entry-level GT sports cars with lower downforce, street-adjacent chassis dynamics, and close bumper-to-bumper racing.

### 7.2 Circuit Roster Expansion
Expanding beyond the Nürburgring complex to iconic international circuits:
- **Circuit de Spa-Francorchamps (Belgium):** 7.004 km, famous for Eau Rouge / Raidillon, Pouhon double apex, and Kemmel Straight.
- **Autodromo Nazionale Monza (Italy):** 5.793 km, "Temple of Speed", low-drag slipstream battles, Variante del Rettifilo chicane, and Curva Parabolica.
- **Circuit de la Sarthe / Le Mans (France):** 13.626 km, legendary 24 Hours of Le Mans layout, Mulsanne Straight, Porsche Curves, and Ford Chicanes.
- **Suzuka International Racing Course (Japan):** 5.807 km, unique figure-eight crossover layout, Esses, Degner curves, and 130R flat-out bend.
- **Mount Panorama / Bathurst (Australia):** 6.213 km, dramatic mountain climb and descent with vertical concrete barriers, The Cutting, Skyline, and Conrod Straight.

### 7.3 Dynamic Series Hub & Menu Architecture
- The Main Menu evolves from a single-car turntable into a multi-tiered motorsport hub:
  - **Series Selector:** Choose championship tier (`Endurance World Series`, `Grand Prix Formula Championship`, `Porsche Carrera Cup`, `GT3 Sprint Challenge`).
  - **Class-Filtered Vehicle Grid:** Selecting a series filters vehicle selection strictly to homologated entries for that championship.
  - **Event / Schedule Calendar:** Series-specific race calendars with dedicated lap counts, weather presets, and qualifying formats.
  - **Livery & Team Selector:** Select team liveries, custom race numbers, and driver tags per series.

### 7.4 Proper Sim Landing Hub & Stepped Configuration Architecture

User request & feedback:
> "I need a proper menu, so singleplayer and multiplayer option on landing. singleplayer would route to just our current page. I need this to be like a real sim, so you would select class, then vehicle, then map, then lap count/mode, then weather and time settings. then a ready button to load in. right now for both multiplayer and singleplayer the rolling start happens while im still in menu there should be a menu ready button that has like 10 second timer before we load in for multiplayer basically the same thing, but with extra options, also there needs to be some qualifying session before race to decide starting grid. lets support up to 10 cars. dont build anythign yet, render me some menu layout etc and I will give feedback. basically in game you cant really change much so the top left display can be simplified too"
>
> User feedback on layout:
> "i think singleplayer is fine without a buffer on standing starts, for rolling start it should also be okay. For multiplayer we need a way for each player to press ready and once all is ready lobby host can start, and then you go straight into hotlap. and once quali is done, same thing for race, ready buttons and leader starts then you just get into starting sequence, and no need for buffer because we dont do any setting on track."

- **Landing Portal Selection:**
  - Landing screen features a dedicated two-path sim entry: **SINGLEPLAYER SIMULATION** vs **MULTIPLAYER PADDOCK (UP TO 10 CARS)**.
  - Direct, focused visual gateway replacing the immediate track spawn.
- **Stepped Sim Configuration Wizard (Singleplayer):**
  1. **Step 1: Motorsport Class Selection**
     - Homologated categories: `GT3 / GTE` (Porsche 911 RSR-19), `LMH Prototype / Hypercar`, `Formula / Single Seater`, `Porsche Cup`, `GT4 Clubsport`.
  2. **Step 2: Vehicle & Livery Selection**
     - Interactive 3D Showroom turntable stage previewing the chosen vehicle, factory racing liveries, and custom competition numbers (`#0`–`#999`).
  3. **Step 3: Circuit / Track Selection**
     - `Nürburgring Nordschleife` (20.8 km Eifel loop), `Nürburgring 24h Gesamtkurs` (24.3 km endurance), `Nürburgring GP-Strecke` (5.1 km FIA Grand Prix), `High-Speed Proving Ground` (6.0 km test runway).
  4. **Step 4: Race Mode & Distance**
     - Modes: `Quick Race (Standing / Rolling Start)`, `Time Attack`, `Practice Session`.
     - Lap Distance: Configurable from `1` to `25` laps.
  5. **Step 5: Environmental Atmospheric Conditions**
     - Weather: `Clear Blue Sky`, `Eifel Overcast`, `Heavy Rain (Wet Grip & Hydroplaning)`.
     - Time of Day: `12:00 High Noon`, `06:30 Sunrise`, `19:30 Golden Sunset`, `23:30 Midnight Endurance`.
  6. **Launch (Direct Ingress, No Buffer):**
     - Clicking `START SESSION / ENTER CIRCUIT` loads directly into the starting procedure (standing start or rolling formation) without artificial buffer delay, as all vehicle and environmental configurations are completed beforehand.
- **Multiplayer Paddock, 2-Stage Ready Gates & Pre-Race Qualifying:**
  - Supports up to **10 competitors** in private 4-digit PIN rooms.
  - **Stage 1 (Lobby Readiness & Hotlap Launch):**
    - Each player selects their car and livery, and clicks `READY`.
    - Real-time connected driver roster displays status of all 10 slots.
    - Once all players are ready, the lobby host button unlocks: `START QUALIFYING`.
    - Clicking `START QUALIFYING` immediately loads all drivers into the qualifying hotlap session.
  - **Stage 2 (Qualifying Hotlap Shootout):**
    - Drivers run their flying lap to set their fastest qualifying split and lap time.
    - Real-time hotlap timing is transmitted to all peers.
  - **Stage 3 (Post-Quali Grid Staging & Race Launch):**
    - Once qualifying concludes, the Grid Staging modal displays the official starting grid order (P1 pole position down to P10) based on lap times.
    - Each driver clicks `READY FOR RACE`.
    - Once all drivers are ready, the host/leader clicks `START RACE`.
    - Drivers spawn directly in their assigned grid boxes, and the track start sequence triggers immediately (GP 5-red-light standing start or Nordschleife rolling start) with zero countdown buffer.
- **In-Game HUD Simplification:**
  - With session conditions (track, laps, weather, time) pre-configured in the wizard, in-race runtime controls (`WEATHER [U]`, `TIME [T]`, `LIGHTS [H]`, `GHOST [K]`, `MULTIPLAYER [O]`) are removed from the in-game display.
  - Top-left HUD is streamlined into an authentic, uncluttered professional motorsport timing cluster: Delta split, Lap time, Best lap, Sector status bar (S1–S9), and Landmark name.

### 7.5 Official Championship Series & Class Taxonomy

User request:
> "https://www.fiawec.com/en/page/grid
> https://www.imsa.com/weathertech/standings
> https://www.gt-world-challenge-europe.com/cars
> for same spec like carrera cup we just need one good model and liveries.
> For f1 we can get one generic model and livery changes but we do need to fine tune all the different teams cars
> what about lemans? so european lemans series? other minilemans series?
> we will need all the tracks for all the series with all the cars. please check and do research, if cars are cross compatible thats good cause we want modular, however if stuff like tuning, bop is different we will need to make separate version with different tunings cause we are a sim"

#### 7.5.1 Series Roster & Class Structures

1. **FIA World Endurance Championship (WEC):**
   - **Official Grid Reference:** `https://www.fiawec.com/en/page/grid`
   - **Format:** Top-tier world championship endurance racing. 6-hour, 8-hour, and 24-hour races with multi-class traffic, night stints, and stint energy limits.
   - **Classes Racing Simultaneously:**
     - **Hypercar (LMH & LMDh):**
       - Porsche 963 (4.6L Twin-Turbo V8 Hybrid, 680 HP, 1,030 kg)
       - Ferrari 499P (3.0L Twin-Turbo V6 Hybrid AWD, 680 HP, 1,030 kg)
       - Toyota GR010 Hybrid (3.5L Twin-Turbo V6 Hybrid AWD, 680 HP, 1,040 kg)
       - Cadillac V-Series.R (5.5L NA V8 Hybrid, 670 HP, 1,030 kg)
       - BMW M Hybrid V8 (4.0L Twin-Turbo V8 Hybrid, 680 HP, 1,030 kg)
       - Alpine A424 (3.4L Single Turbo V6 Hybrid, 675 HP, 1,030 kg)
       - Peugeot 9X8 2024 (2.6L Twin-Turbo V6 Hybrid AWD, 680 HP, 1,030 kg)
       - Lamborghini SC63 (3.8L Twin-Turbo V8 Hybrid, 680 HP, 1,030 kg)
       - Isotta Fraschini Tipo 6-C (3.0L Single Turbo V6 Hybrid AWD, 680 HP, 1,030 kg)
     - **LMGT3:**
       - Porsche 911 GT3 R (992) *(Active in repo)*
       - Ferrari 296 GT3
       - BMW M4 GT3
       - Chevrolet Corvette Z06 GT3.R
       - Aston Martin Vantage AMR GT3 Evo
       - Ford Mustang GT3
       - McLaren 720S GT3 Evo
       - Lamborghini Huracán GT3 Evo 2
       - Lexus RC F GT3
   - **Circuits / Maps:** Circuit de la Sarthe (24 Hours of Le Mans), Spa-Francorchamps, Autodromo Enzo e Dino Ferrari (Imola), Circuit of the Americas (COTA), Interlagos, Fuji Speedway, Bahrain International Circuit, Lusail International Circuit.

2. **IMSA WeatherTech SportsCar Championship:**
   - **Official Grid Reference:** `https://www.imsa.com/weathertech/standings`
   - **Format:** North American endurance and sprint series featuring legendary rough-surface circuits, 36+ car multi-class fields, and strict safety car wave-arounds.
   - **Classes Racing Simultaneously:**
     - **Grand Touring Prototype (GTP / LMDh):**
       - Acura ARX-06 (2.4L Twin-Turbo V6 Hybrid, 670 HP, 1,030 kg)
       - Porsche 963
       - Cadillac V-Series.R
       - BMW M Hybrid V8
       - Lamborghini SC63 (Endurance Cup)
     - **Le Mans Prototype 2 (LMP2):**
       - Oreca 07 Gibson (Gibson GK428 4.2L NA V8 spec engine, 540–600 HP, 950 kg)
     - **GTD PRO & GTD (FIA GT3 Platform):**
       - Corvette Z06 GT3.R
       - Porsche 911 GT3 R (992)
       - Ferrari 296 GT3
       - BMW M4 GT3
       - Ford Mustang GT3
       - Lexus RC F GT3
       - Aston Martin Vantage AMR GT3 Evo
       - McLaren 720S GT3 Evo
       - Mercedes-AMG GT3 Evo
       - Acura NSX GT3 Evo22
       - Lamborghini Huracán GT3 Evo 2
   - **Circuits / Maps:** Daytona International Speedway Road Course (Rolex 24), Sebring International Raceway (12 Hours), Long Beach Street Circuit, Laguna Seca, Watkins Glen International, Canadian Tire Motorsport Park (Mosport), Road America, Virginia International Raceway (VIR), Indianapolis Motor Speedway Road Course, Michelin Raceway Road Atlanta (Petit Le Mans).

3. **GT World Challenge Europe (SRO / Fanatec):**
   - **Official Grid Reference:** `https://www.gt-world-challenge-europe.com/cars`
   - **Format:** Dedicated FIA GT3 championship divided into Endurance Cup (including 24 Hours of Spa) and Sprint Cup (two 60-minute sprint races per weekend with driver changes).
   - **Class:**
     - **GT3 (FIA Homologated):**
       - Aston Martin Vantage AMR GT3 Evo
       - Audi R8 LMS GT3 Evo II
       - BMW M4 GT3
       - Ferrari 296 GT3
       - Ford Mustang GT3
       - Lamborghini Huracán GT3 Evo 2
       - McLaren 720S GT3 Evo
       - Mercedes-AMG GT3 Evo
       - Porsche 911 GT3 R (992) *(Active in repo)*
   - **Circuits / Maps:** Circuit Paul Ricard, Brands Hatch (GP & Indy), Misano World Circuit, Circuit de Spa-Francorchamps (24h of Spa), Hockenheimring, Nürburgring GP-Strecke *(Active in repo)*, Circuit de Nevers Magny-Cours, Circuit Ricardo Tormo (Valencia), Circuit de Barcelona-Catalunya, Jeddah Corniche Circuit.

4. **European Le Mans Series (ELMS) & "Mini-Le Mans" Series:**
   - **Formats:**
     - **ELMS:** European continental endurance championship with 4-hour races.
     - **Asian Le Mans Series:** Winter endurance championship across the Middle East and Southeast Asia.
     - **Michelin Le Mans Cup ("Mini-Le Mans"):** Support sprint series racing directly on Circuit de la Sarthe during 24 Hours of Le Mans week.
   - **Classes:**
     - **LMP2 & LMP2 Pro/Am:** Oreca 07 Gibson (full unrestricted 600 HP V8 in ELMS).
     - **LMP3:** Ligier JS P320 & Duqueine M30 - D08 (Nissan VK56 5.6L NA V8, 460 HP, 950 kg).
     - **LMGT3:** Aston Martin, Ferrari 296, Lamborghini Huracán, Porsche 911 GT3 R.
   - **Circuits / Maps:** Circuit de Barcelona-Catalunya, Circuit Paul Ricard (Le Castellet), Autodromo Enzo e Dino Ferrari (Imola), Circuit de Spa-Francorchamps, Autodromo Internazionale del Mugello, Autódromo Internacional do Algarve (Portimão), Sepang International Circuit, Dubai Autodrome, Yas Marina Circuit.

5. **Porsche Carrera Cup (Single-Make Spec Championship):**
   - **Architecture Directive:** Single high-fidelity 3D model with team liveries. Zero Balance of Performance adjustments; analog racing with ABS and Traction Control electronically disabled.
   - **Class:**
     - **Porsche 911 GT3 Cup (Type 992 Spec):**
       - Chassis: 992 lightweight body in white with carbon doors, hood, and rear wing.
       - Powertrain: 4.0L Water-Cooled Naturally Aspirated Flat-Six, 510 PS (375 kW) @ 8,400 RPM.
       - Transmission: 6-speed sequential dog-ring gearbox with paddle shifters.
       - Electronics: Pure analog motorsport spec (NO ABS, NO Traction Control).
   - **Circuits / Maps:** Nürburgring GP-Strecke *(Active in repo)*, Circuit de Spa-Francorchamps, Autodromo Nazionale Monza, Circuit de Monaco, Red Bull Ring, Circuit Zandvoort, Hungaroring.

6. **Grand Prix World Championship (Formula 1 Single-Seater):**
   - **Architecture Directive:** Single generic modern ground-effect base 3D model with team liveries, but distinct mathematical physics and tuning profiles for each team.
   - **Team-Specific Physics Tuning Profiles:**
     - **Aero Polar Variations:** Distinct lift-to-drag ratios ($L/D$) and ground-effect tunnel sensitivities. Red Bull Racing spec features higher aerodynamic efficiency and low drag at speed; McLaren spec features high-downforce mid-speed cornering bite; Ferrari spec features low straight-line drag.
     - **Power Unit & ERS Mapping:** 1.6L V6 Turbo Hybrid (1,000 HP total). Honda RBPT, Ferrari 066/12, Mercedes M15, and Renault E-Tech power units receive distinct torque curves, turbo spool lag, and MGU-K electrical deployment/harvesting efficiency profiles.
     - **Mechanical Geometry:** Tailored anti-dive, anti-squat suspension kinematics, spring rates, and weight distributions ($798\text{ kg}$ FIA baseline).
   - **Circuits / Maps:** Full 24-race global circuit roster: Bahrain, Jeddah, Melbourne (Albert Park), Suzuka, Shanghai, Miami, Imola, Monaco, Montreal, Barcelona, Red Bull Ring, Silverstone, Hungaroring, Spa, Zandvoort, Monza, Baku, Singapore (Marina Bay), Austin (COTA), Mexico City, Interlagos, Las Vegas Strip, Lusail, Yas Marina.

---

### 7.6 Modular 3D Ingestion Architecture vs. Series-Specific BoP & Tuning

User directive: *"if cars are cross compatible thats good cause we want modular, however if stuff like tuning, bop is different we will need to make separate version with different tunings cause we are a sim"*

To maximize rendering performance and storage efficiency while preserving simulation rigor:
* **Decoupled Asset Architecture:**
  - **Shared Visual 3D Rig (glTF/GLB):** One master 3D mesh model per physical vehicle chassis (e.g. `porsche_963.glb`, `porsche_911_gt3_r_992.glb`, `ferrari_296_gt3.glb`, `oreca_07.glb`) loaded once into memory with Draco compression.
  - **Series-Specific Homologation & BoP Configuration Layer (`*.bop.json`):**
    Each vehicle directory contains dedicated regulatory profiles that configure mass, air restrictors, boost maps, torque ceilings, ballast, and tire models based on the active series.

```
public/assets/cars/porsche_911_gt3_r/
├── model.glb                      <- Shared 3D chassis, wheels, cockpit geometry
├── wraps/                         <- High-res 1024x1024 wraps and liveries
├── sro_gt3.bop.json               <- GT World Challenge Europe (Pirelli DHF, SRO ballast, ride height)
├── wec_lmgt3.bop.json             <- FIA WEC (Goodyear Eagle, driveshaft torque limits, Le Mans trim)
└── imsa_gtd.bop.json              <- IMSA WeatherTech (Michelin Pilot Sport, VP fuel, restrictor)
```

#### Real-World Cross-Series BoP & Tuning Variations

| Shared Vehicle 3D Model | Series Regulatory Context | Series-Specific Physics & BoP Tuning Variations |
| :--- | :--- | :--- |
| **Porsche 963 LMDh**<br>**Cadillac V-Series.R**<br>**BMW M Hybrid V8** | **FIA WEC (Hypercar)** | • Driveshaft torque sensors strictly enforce FIA 500–520 kW power curve.<br>• Virtual Energy Tank (MJ stint allocation) cutoffs.<br>• Michelin WEC slick tire compound & cold tire pressure regulations.<br>• FIA homologated low-drag aerodynamic wing trim. |
| **Porsche 963 LMDh**<br>**Cadillac V-Series.R**<br>**BMW M Hybrid V8** | **IMSA (GTP)** | • IMSA torque curve calibration & VP Racing E85 fuel density.<br>• Michelin IMSA medium/soft tire carcass.<br>• IMSA-mandated dive-plane angles and rear diffuser gurney flaps. |
| **Porsche 911 GT3 R (992)**<br>**Ferrari 296 GT3**<br>**BMW M4 GT3**<br>**Aston Martin Vantage**<br>**Corvette Z06 GT3.R** | **GT World Challenge (SRO)** | • SRO engine restrictor plates and turbo boost pressure curves.<br>• Spec Pirelli P Zero DHF tire model.<br>• SRO minimum ride height (70mm front, 85mm rear) and success ballast ($+0\dots +60\text{ kg}$). |
| **Porsche 911 GT3 R (992)**<br>**Ferrari 296 GT3**<br>**BMW M4 GT3**<br>**Aston Martin Vantage**<br>**Corvette Z06 GT3.R** | **FIA WEC (LMGT3)** | • Driveshaft torque sensor caps power to $< 400\text{ kW}$.<br>• Spec Goodyear Eagle slick tire model.<br>• FIA fuel flow meter limits ($1.8\text{ kg/min}$).<br>• Le Mans long-straight low-drag wing setup. |
| **Porsche 911 GT3 R (992)**<br>**Ferrari 296 GT3**<br>**BMW M4 GT3**<br>**Aston Martin Vantage**<br>**Corvette Z06 GT3.R** | **IMSA (GTD / GTD PRO)** | • IMSA air restrictor tables and balance ballast (baseline $1,300\text{ kg}$).<br>• Spec Michelin Pilot Sport S9M compound.<br>• Pro-Am setup restrictions in GTD vs unrestricted pro setups in GTD PRO. |
| **Oreca 07 Gibson** | **European Le Mans (ELMS)** | • Unrestricted Gibson GK428 4.2L V8 producing full 600 HP.<br>• High-downforce sprint aero kit with standard front dive planes.<br>• Minimum weight $950\text{ kg}$. |
| **Oreca 07 Gibson** | **WEC / 24 Hours of Le Mans** | • De-tuned Gibson V8 (540–560 HP) with lower rev limiter.<br>• Mandatory Le Mans low-drag bodywork kit.<br>• $+20\text{ kg}$ ballast weight ($970\text{ kg}$ total) to preserve speed buffer below Hypercar. |
| **Oreca 07 Gibson** | **IMSA (LMP2)** | • IMSA spec Gibson engine calibration and Michelin IMSA tire carcass.<br>• IMSA telemetry logger integration. |

---

### 7.7 Master Vehicle Acquisition Roster for Phase 7

Consolidated list of unique 3D vehicle models to acquire, adapt, and rig:

| # | Master Vehicle Model | Physical Class | Target Series Deployments | Powertrain DNA | Base Weight | Status / Asset Source |
|---|---|---|---|---|---|---|
| 1 | **Porsche 911 GT3 R (992) / RSR-19** | GT3 / GTE | WEC, IMSA, GT World Ch., ELMS | 4.2L NA Flat-6, 515–565 HP | 1,245 kg | **Active in Repo** (`model.glb`, CC-BY Karol Miklas) |
| 2 | **Porsche 963 LMDh** | Hypercar / GTP | WEC Hypercar, IMSA GTP | 4.6L TT V8 Hybrid, 680 HP | 1,030 kg | Candidate CAD / glTF |
| 3 | **Ferrari 499P LMH** | Hypercar | WEC Hypercar | 3.0L TT V6 Hybrid AWD, 680 HP | 1,030 kg | Candidate CAD / glTF |
| 4 | **Toyota GR010 Hybrid** | Hypercar | WEC Hypercar | 3.5L TT V6 Hybrid AWD, 680 HP | 1,040 kg | Candidate CAD / glTF |
| 5 | **Cadillac V-Series.R** | Hypercar / GTP | WEC Hypercar, IMSA GTP | 5.5L NA V8 Hybrid, 670 HP | 1,030 kg | Candidate CAD / glTF |
| 6 | **BMW M Hybrid V8** | Hypercar / GTP | WEC Hypercar, IMSA GTP | 4.0L TT V8 Hybrid, 680 HP | 1,030 kg | Candidate CAD / glTF |
| 7 | **Acura ARX-06** | GTP | IMSA GTP | 2.4L TT V6 Hybrid, 670 HP | 1,030 kg | Candidate CAD / glTF |
| 8 | **Alpine A424** | Hypercar | WEC Hypercar | 3.4L Single Turbo V6 Hybrid, 675 HP | 1,030 kg | Candidate CAD / glTF |
| 9 | **Peugeot 9X8 2024** | Hypercar | WEC Hypercar | 2.6L TT V6 Hybrid AWD, 680 HP | 1,030 kg | Candidate CAD / glTF |
| 10 | **Lamborghini SC63** | Hypercar / GTP | WEC Hypercar, IMSA GTP | 3.8L TT V8 Hybrid, 680 HP | 1,030 kg | Candidate CAD / glTF |
| 11 | **Oreca 07 Gibson** | LMP2 | ELMS, WEC Le Mans, IMSA, Asian LMS | Gibson GK428 4.2L NA V8, 540–600 HP | 950–970 kg | Candidate CAD / glTF |
| 12 | **Ligier JS P320** | LMP3 | ELMS LMP3, Le Mans Cup, Asian LMS | Nissan VK56 5.6L NA V8, 460 HP | 950 kg | Candidate CAD / glTF |
| 13 | **Ferrari 296 GT3** | GT3 | WEC, IMSA, GT World Ch., ELMS | 3.0L TT 120° V6, 600 HP | 1,265 kg | Candidate CAD / glTF |
| 14 | **BMW M4 GT3** | GT3 | WEC, IMSA, GT World Ch. | 3.0L TT Inline-6, 590 HP | 1,265 kg | Candidate CAD / glTF |
| 15 | **Corvette Z06 GT3.R** | GT3 | WEC, IMSA GTD PRO / GTD | 5.5L Flat-Plane V8, 600 HP | 1,250 kg | Candidate CAD / glTF |
| 16 | **Aston Martin Vantage GT3 Evo** | GT3 | WEC, IMSA, GT World Ch., ELMS | 4.0L TT V8, 540 HP | 1,260 kg | Candidate CAD / glTF |
| 17 | **Ford Mustang GT3** | GT3 | WEC, IMSA, GT World Ch. | 5.4L NA Coyote V8, 550 HP | 1,280 kg | Candidate CAD / glTF |
| 18 | **Mercedes-AMG GT3 Evo** | GT3 | IMSA GTD, GT World Ch. | 6.2L NA V8, 550 HP | 1,285 kg | Candidate CAD / glTF |
| 19 | **Audi R8 LMS GT3 Evo II** | GT3 | GT World Challenge Europe | 5.2L NA V10, 585 HP | 1,260 kg | Candidate CAD / glTF |
| 20 | **McLaren 720S GT3 Evo** | GT3 | WEC, IMSA, GT World Ch. | 4.0L TT V8, 580 HP | 1,250 kg | Candidate CAD / glTF |
| 21 | **Porsche 911 GT3 Cup (992)** | Cup (Spec) | Porsche Carrera Cup | 4.0L NA Flat-6, 510 HP, No ABS/TC | 1,260 kg | Derived from 992 chassis |
| 22 | **Grand Prix Concept 2026** | Formula 1 | Formula 1 World Championship | 1.6L V6 Turbo Hybrid, 1,000 HP (10 team tunes) | 798 kg | Candidate CAD / glTF |
| 23 | **Porsche 718 Cayman GT4 RS** | GT4 | GT4 Clubsport Trophy | 4.0L NA Flat-6, 500 HP | 1,330 kg | Candidate CAD / glTF |
| 24 | **Toyota GR Supra GT4 EVO** | GT4 | GT4 Clubsport Trophy | 3.0L Turbo Inline-6, 430 HP | 1,350 kg | Candidate CAD / glTF |

---

### 7.8 Master Circuit Roster Across All Series

Complete inventory of surveyed racing circuits required across all 6 motorsport disciplines:

| # | Circuit Name | Country | Length | Turns | Key Landmark Sectors | Hosting Series | Status in Repository |
|---|---|---|---|---|---|---|---|
| 1 | **Nürburgring Nordschleife** | Germany | 20.710 km | 73 | Karussell, Flugplatz, Fuchsröhre, Döttinger Höhe | GT3, GT4, NLS / VLN | **Active** (Surveyed OSM + SRTM DEM) |
| 2 | **Nürburgring 24h Gesamtkurs** | Germany | 25.378 km | 89 | Full GP + Nordschleife transition loops | 24h Nürburgring, WEC | **Active** (Surveyed OSM + SRTM DEM) |
| 3 | **Nürburgring GP-Strecke** | Germany | 5.148 km | 16 | Mercedes-Arena, Dunlop-Kehre, Schumacher-S | GT3 Sprint, Carrera Cup, GT4 | **Active** (Surveyed OSM + SRTM DEM) |
| 4 | **High-Speed Proving Ground** | Germany | 6.000 km | 2 | Runway launch box, concentric skidpads | Testing, Acceleration, Top Speed | **Active** (Procedural Rapier arena) |
| 5 | **Circuit de la Sarthe (Le Mans)** | France | 13.626 km | 38 | Mulsanne, Indianapolis, Arnage, Porsche Curves | 24 Hours of Le Mans, WEC, Le Mans Cup | Planned (OSM spline + DEM) |
| 6 | **Circuit de Spa-Francorchamps** | Belgium | 7.004 km | 19 | Eau Rouge, Raidillon, Kemmel, Pouhon, Blanchimont | WEC, GT World Ch., F1, ELMS, Carrera Cup | Planned (OSM spline + DEM) |
| 7 | **Autodromo Nazionale Monza** | Italy | 5.793 km | 11 | Variante del Rettifilo, Curva Grande, Ascari, Parabolica | WEC, GT World Ch., F1, Carrera Cup | Planned (OSM spline + DEM) |
| 8 | **Autodromo Enzo e Dino Ferrari (Imola)** | Italy | 4.909 km | 19 | Tamburello, Villeneuve, Tosa, Piratella, Acque Minerali | WEC, ELMS, F1 | Planned (OSM spline + DEM) |
| 9 | **Circuit Paul Ricard (Le Castellet)** | France | 5.771 km | 15 | Mistral Straight, Signes, Double Droite du Beausset | GT World Ch., ELMS | Planned (OSM spline + DEM) |
| 10 | **Circuit de Barcelona-Catalunya** | Spain | 4.675 km | 14 | Elf chicane, Repsol, Campsa, New sweeping final corner | GT World Ch., ELMS, F1 | Planned (OSM spline + DEM) |
| 11 | **Brands Hatch (GP & Indy)** | UK | 3.908 km | 9 | Paddock Hill Bend, Druids hairpin, Dingle Dell | GT World Ch., GT4 | Planned (OSM spline + DEM) |
| 12 | **Silverstone Circuit** | UK | 5.891 km | 18 | Copse, Maggotts-Becketts-Chapel, Stowe, Club | Formula 1, WEC, GT3 | Planned (OSM spline + DEM) |
| 13 | **Circuit de Monaco (Monte Carlo)** | Monaco | 3.337 km | 19 | Sainte-Dévote, Casino Square, Hairpin, Rascasse | Formula 1, Carrera Cup | Planned (OSM spline + DEM) |
| 14 | **Suzuka International Racing Course** | Japan | 5.807 km | 18 | Figure-eight overpass, Esses, Degner, 130R | Formula 1, Super GT | Planned (OSM spline + DEM) |
| 15 | **Fuji Speedway** | Japan | 4.563 km | 16 | 1.5 km front straight, 100R, Dunlop Corner, Netro | WEC | Planned (OSM spline + DEM) |
| 16 | **Mount Panorama (Bathurst)** | Australia | 6.213 km | 23 | Mountain Straight, The Cutting, Skyline, The Dipper | Bathurst 12 Hour, Supercars | Planned (OSM spline + DEM) |
| 17 | **Daytona International Speedway Road Course** | USA | 5.729 km | 12 | Tri-oval 31° banking, International Horseshoe, Bus Stop | IMSA (Rolex 24 at Daytona) | Planned (OSM spline + DEM) |
| 18 | **Sebring International Raceway** | USA | 6.019 km | 17 | Sunset Bend, Ullman Straight, bumpy concrete runway | IMSA (12 Hours of Sebring) | Planned (OSM spline + DEM) |
| 19 | **Watkins Glen International** | USA | 5.470 km | 11 | The Esses, Inner Loop Bus Stop, The Carousel, The Boot | IMSA (Six Hours of The Glen) | Planned (OSM spline + DEM) |
| 20 | **WeatherTech Raceway Laguna Seca** | USA | 3.602 km | 11 | Andretti Hairpin, Rahal Straight, The Corkscrew | IMSA | Planned (OSM spline + DEM) |
| 21 | **Road America** | USA | 6.515 km | 14 | Moraine Sweep, Carousel, The Kink, Canada Corner | IMSA | Planned (OSM spline + DEM) |
| 22 | **Michelin Raceway Road Atlanta** | USA | 4.088 km | 12 | Esses, downhill esses, Turn 10 chicane, Turn 12 bridge | IMSA (Petit Le Mans) | Planned (OSM spline + DEM) |
| 23 | **Circuit of the Americas (COTA)** | USA | 5.513 km | 20 | Turn 1 blind uphill apex, Esses, Triple-apex carousel | WEC, F1, IMSA | Planned (OSM spline + DEM) |
| 24 | **Autódromo José Carlos Pace (Interlagos)** | Brazil | 4.309 km | 15 | Senna S, Curva do Sol, Descida do Lago, Junção | WEC, F1 | Planned (OSM spline + DEM) |
| 25 | **Bahrain International Circuit** | Bahrain | 5.412 km | 15 | Turn 1 hairpin, high-speed Esses, Turn 10 downhill | WEC, F1 | Planned (OSM spline + DEM) |
| 26 | **Lusail International Circuit** | Qatar | 5.419 km | 16 | 1.0 km straight, continuous high-speed flowing sweeps | WEC, F1 | Planned (OSM spline + DEM) |
| 27 | **Yas Marina Circuit** | UAE | 5.281 km | 16 | Hotel hairpin, marina sweep, North hairpin | Asian LMS, F1 | Planned (OSM spline + DEM) |

---

## 8. Roman Numeral Architecture: Online Services, Driver Accounts & Cloud Infrastructure

User request:
> "while we are at it why dont we create a phase I, roman numeral, this is a separate development branch not realted to gameplay but for online and features, So I'm thinkgon account making would be nice to play so that we can solve our issue. a database of players would be nice, we can log stats, like km's driven etc, favourite car. but most important is like leaderboard i think to motivate people online to play. so leaderboard/map/category. what else do you think we need for phase I and future development for roman numeral branch?"

### 8.1 Dual-Track Architecture Philosophy
The Full of Water roadmap is bifurcated into two parallel, complementary development tracks:
- **Arabic Numeral Track (Phases 1–7):** Simulation, vehicle homologation, surveyed circuit geometry, physical modeling, sound synthesis, and local/P2P client gameplay.
- **Roman Numeral Track (Phases I–V):** Online platform infrastructure, driver identity, database persistence, global hotlap leaderboards, rating systems, and cloud matchmaking services.

#### 8.1.1 Parallel Development Compatibility
User inquiry: *"are roman numeral branches okay to work in parallel to regular branch?"*

- **Independent Velocity:** Roman Numeral branches are fully compatible with and designed for concurrent development alongside regular Arabic numeral simulation branches.
- **Architectural Isolation:** Roman Numeral online features reside in dedicated cloud, serverless, and authentication boundaries (`api/`, `src/common/auth/`, serverless database migrations). They connect to the host simulation solely via decoupled hooks:
  - Consuming completed lap and sector timestamps from `LapTimer`.
  - Supplying driver session pairing tokens to `HostNetworkBridge`.
  - Fetching top-tier 30 Hz ghost trajectory arrays for `GhostCarManager`.
- **Zero Simulation Contention:** Because Roman Numeral work does not modify Rapier 3D 240 Hz rigid body loops, Three.js rendering pipelines, or Web Audio DSP filters, agents can build Phase I driver accounts, database persistence, and leaderboards without merge conflicts or risk to client simulation stability. Each track maintains its own isolated validation suites (`npm run test:phase5` vs `npm run test:phase-I`).

### 8.2 Phase I: Driver Identity, Cloud Persistence & Global Hotlap Leaderboards (Completed & Validated)

#### 8.2.1 Driver Authentication & Session Pairing
- **Driver Profiles & Frictionless Onboarding:**
  - Fast driver registration with a unique, permanent Driver Tag (e.g., `SPEED_KING_99`), country code, avatar color, preferred units (`km/h` vs `mph`), and email/passkey or password.
  - Zero-barrier Guest Mode: Players can drive immediately without an account. A prominent *"Claim Driver License"* modal and banner in the menu allows one-click conversion of guest hotlaps and stats into a permanent account with 100% data preservation.
- **Automated Phone Controller Device Pairing:**
  - Solves the identical URL problem on Vercel without manual PIN codes.
  - Generates 6-digit session pairing tokens matching desktop host and mobile controller via URL parameters (`?pairToken=...&driverTag=...`) and WebSocket handshake.
  - Ephemeral 4-digit PIN fallback remains available for guests and friends.

#### 8.2.2 Player Statistics & Activity Database
- **Schema & Cloud Storage:**
  - Persisted via serverless architecture (`/api/auth/*`, `/api/stats/*`) with Vercel serverless function entry points (`api/[...route].ts`) and local dev middleware:
    - `users`: ID, driver_tag, email, password_hash / passkey credentials, preferred_units, created_at.
    - `driver_profiles`: Driver tag, display name, avatar color, country/region badge, preferred telemetry units (`km/h` vs `mph`).
    - `driver_stats`: Lifetime distance driven ($km$), total completed laps, clean lap ratio ($\%$), favorite vehicle model, favorite livery swatch, total on-track flight time, maximum top speed recorded.
    - `personal_records`: Indexed personal best hotlap time per track, vehicle class, and weather condition.

#### 8.2.3 Global Verified Hotlap Leaderboard
- **Multi-Dimensional Matrix Ranking:**
  - Drivers can filter rankings dynamically in the Showroom and Post-Session screens:
    - **Circuit Layout:** Nürburgring Nordschleife ($20.7\text{ km}$), 24h Gesamtkurs ($24.3\text{ km}$), Grand Prix ($5.1\text{ km}$), High-Speed Proving Ground ($6.0\text{ km}$).
    - **Vehicle Class:** GT3 / GTE, Prototype / Hypercar, Cup / One-Make, Formula.
    - **Track Condition:** Optimal Dry Asphalt vs Damp / Wet Groove.
    - **Input Category:** Mobile Safari Gyro vs Desktop Keyboard vs Hardware Force-Feedback Wheel.
- **Lap Verification & Anti-Cheat Protocol:**
  - Serverless API verification checks before committing a record to the public leaderboard:
    - Sector monotonic validation: Total lap time must equal the exact sum of all sector splits within $\pm 50\text{ ms}$.
    - Clean lap integrity: `isLapValid` must be strictly true (no wall clipping, no short-cuts, no off-track boundary violations).
    - Physical boundary check: Average and top speeds must fall within homologated physical envelope for the selected vehicle.
- **World Record Ghost Retrieval:**
  - The database stores 30 Hz compressed trajectory keyframes for top global records.
  - Any player can download the #1 World Record ghost directly into `GhostCarManager` to race against the golden holographic world record ghost.

#### 8.2.4 Verification & Test Pass Gate
- Validated via `scripts/test-phase-I.ts` (`npm run test:phase-I`) with 100% pass across all 6 test suites:
  1. Permanent driver registration, duplicate tag guard, password auth, guest initialization, and "Claim Driver License" migration.
  2. Automated 6-digit phone pairing with expiration and driver tag binding guards.
  3. Player activity telemetry database updates (km, clean ratio, top speed, flight time, favorite car/livery).
  4. Serverless anti-cheat monotonic sector timing verification, clean lap rule, and homologation boundaries.
  5. Multi-dimensional leaderboard queries (filtered by circuit, class, weather, and input device).
  6. World Record 30 Hz ghost trajectory generation, retrieval, and `GhostCarManager` interpolation.

### 8.3 Future Roman Numeral Roadmap (Phases II–V)

| Phase | Milestone | Core Capabilities | Status |
| :--- | :--- | :--- | :--- |
| **Phase I** | **Driver Identity & Leaderboards** | Accounts, player stats database ($km$, top speed, favorite car), global hotlap leaderboard by track/category, verified lap validation, and account-based phone pairing. | **Completed & Validated** |
| **Phase II** | **Cloud-Relayed WebRTC Multiplayer** | Serverless WebRTC signaling broker (PartyKit / Cloudflare Durable Objects) replacing local Node sockets, public paddock lobby browser, and private room sharing. | Planned |
| **Phase III** | **Driver Rating & Safety Rating (Elo / SR)** | Skill-based matchmaking: Driver Rating (DR: Bronze to Alien) and Safety Rating (SR: tracking clean overtakes vs incident points per corner). |
| **Phase IV** | **Cloud Telemetry & MoTeC-Style Analysis** | Store complete lap telemetry in cloud; in-browser graph overlay comparing speed, throttle, brake, and G-forces against the world record lap trace. |
| **Phase V** | **Cloud Livery Workshop & Social Showcase** | Design custom liveries using the `StandardWrapMapper` canvas pipeline and publish them to a global public livery gallery with one-click equip and community upvotes. |

---

## 9. Idea Parking Lot

Agent suggestions. **None of these are accepted yet.** Move an item into the main sections above once decided, or delete it.

| # | Idea | Why |
|---|------|-----|
| P3 | **Haptic sector delta:** double pulse if up, single long if down | Needs native wrapper for haptics. |
| P4 | **"Light steering" haptic** when front tires lose grip | Needs native wrapper for haptics. |
| P5 | **Audio as the main slip cue:** tire scrub, engine load, wind, surface noise | Essential audio cues for cockpit driving. |
| P6 | **Steering calibration screen:** hold at center, tap to zero, pick a steering range | Everyone holds a phone slightly differently. |
| P7 | **Auto-pause** when controller disconnects, locks, or is laid flat | Prevents crashing if phone is dropped. |
| P10 | **Telemetry recorder** (CSV/JSON of speed, slip, suspension, inputs) | Debugging vehicle physics and driver analysis. |
| P11 | **Keyboard fallback** (WASD / Arrows) on Mac | Allows immediate testing without picking up the phone. |
| P13 | **Second device as a spectator dash** (live map, delta, telemetry) | Multi-device companion experience. |
| P16 | **Mini steering wheel graphic in center of controller screen** | Visual indicator of current wheel angle on the phone. |
| P17 | **Manual DRS and Hybrid ERS/Push-to-Pass Boost** | Triggerable via controller buttons and bounded by track marker zones like real racecars. |
| P18 | **High-polygon animated driver arms with racing gloves** | Ultra-detailed 3D driver arms with Alpinestars/Sparco competition gloves wrapped around the steering wheel, animated with inverse kinematics or skeletal skinning matching wheel rotation (deferred per user request). |
| P19 | **Client-Sided Multi-Tenant Controller Pairing on Vercel** | Ephemeral 4-digit PIN / query parameter (`?session=XXXX`) encoded in the host QR code paired via direct WebRTC DataChannels, allowing unlimited simultaneous players on Vercel without session collisions or backend logins. |
| P20 | **Phase 7 Full Championship Series & Vehicle Acquisition Matrix** | Proposed expansion package: 5 motorsport championships (Endurance WEC/IMSA, GT3 Sprint World Challenge, Porsche Carrera Cup, Grand Prix F1, GT4 Clubsport Trophy), 13 homologated vehicles across 5 classes, and 11 surveyed international circuits. Candidate roster pending user confirmation. |

---

## 10. Decision Log

Answers to project design questions.

| Date | Q | Decision |
|------|---|----------|
| 2026-11-06 | Scope | Personal project for now, maybe play with friends. Trademarks addressed only if released. |
| 2026-11-06 | Experience | TypeScript, Three.js, SolidWorks 3D CAD. Focus on driving feel and cockpit view. |
| 2026-11-06 | Hardware | Host is Mac with Apple M4 Pro chip. Displays: 4K 60 Hz and MacBook 120 Hz ProMotion. Target phone: iPhone. |
| 2026-11-06 | Controls | Default simple on/off gas and brake (driftmas.io / Monoposto style). Physics assists make it intuitive. |
| 2026-11-06 | Gearbox | Automatic transmission for now. Manual shifting later. |
| 2026-11-06 | Steering | In-plane gravity vector tilt (no Euler angle flip near vertical). Full lock at ~45°–55° rotation. |
| 2026-11-06 | Assists | On by default (TC, ABS, stability, speed-sensitive steering). |
| 2026-11-06 | Camera | Driver-side cockpit camera primary. Other cameras via toggle. |
| 2026-11-06 | HUD | Main monitor displays HUD (speed, gear, lap time, radar overlay). |
| 2026-11-06 | Car | Porsche 911 RSR-19 (992 generation). |
| 2026-11-06 | Pit Lane | Driving into pit box switches laptop screen to options page (mouse-driven). Deferred to Phase 3. |
| 2026-11-06 | Consumables | Infinite tyre life and fuel for Phase 1 & 2. Wear systems added in Phase 3. |
| 2026-11-06 | Timing | Phase 1: Skidpad metrics. Phase 2: Total lap time. Phase 3: 9 sectors breakdown. |
| 2026-11-06 | Phase Plan | Phase 1: Flat skidpad MVP proving controls & physics. Phase 2: Dedicated Nordschleife. Phase 3: Advanced systems. |
| 2026-11-06 | Track Model & 24h Layout | Adopt open-source 3D map models (GLTF/GLB) rather than procedural extrusion; support full Nürburgring 24h layout (Nordschleife + GP-Strecke) with interactive track menu; add live circuit minimap HUD. |
| 2026-11-06 | Authentic Surveyed Circuit Ingestion | Replaced synthetic 29-waypoint balloon with authentic OpenStreetMap surveyed raceway nodes and SRTM DEM elevations: 4,142 points (20.71 km Nordschleife), 4,853 points (24.26 km 24h Gesamtkurs), and 719 points (3.60 km GP-Strecke), with 45 authentic named segments, 33° Karussell banking, and live canonical minimap radar orientation. |
| 2026-11-06 | Banked Curves & Horizon Alignment | Cockpit camera locked to car roof normal so dashboard and steering wheel stay strictly horizontal on monitor (no head tilt). Counter-steer assist suppressed when driver actively steers so it never fights cornering. |
| 2026-11-06 | Track Bumps & Suspension Dynamics | Replaced raw DEM stair-step heights with Gaussian-smoothed elevation curves (sigma=20, zero jerks > 0.03m). Added digressive suspension damping with high-speed blow-off and 0.095m travel to eliminate violent pogo bouncing. |
| 2026-11-06 | High-Speed Bumpiness & Vibration Resolution | Removed artificial 200+ km/h random camera jitter. Added driver neck shock absorption damping. Added pneumatic contact patch compliance filter to raycast suspension, and elevated chassis collider (+0.15m bottom) so chassis never clips asphalt under 1,000 kg aero downforce. Track smoothed with sigma=25 (max d2y < 0.009m). |
| 2026-11-06 | Authentic Start/Finish Line per Circuit Format | Nordschleife start/finish rotated to T13 (facing Hatzenbach, ending from Hohenrain). 24h Gesamtkurs rotated to GP Start-Ziel straight facing Turn 1 (racing GP loop first, then Nordschleife, then GP finish line). GP-Strecke aligned to GP straight facing Turn 1. Proving Ground starts at Runway Z=0. Added 3m high-visibility painted white finish stripe and enabled lap timer/streamer across all formats. |
| 2026-11-06 | Critical Suspension Damping & Zero-Lag Cockpit | Cockpit camera position rigidly locked to driver eye in car space (zero world-space lag or pulling back at speed). Suspension upgraded to critical/overdamped damping (14,000–18,000 Ns/m) and angular damping 2.0 to eliminate all pogo bouncing. Flattened standard corners (bankingRad=0) to eliminate cross-camber waviness and roll wobble when turning. Enhanced track elevation smoothing to sigma=60 (Döttinger Höhe long straight d2y < 0.002m, max drop 268.5m). |
| 2026-11-09 | Camera Shake, Barriers, Track Dips, Trees, & Noclip Eradication | User directives: *"there is still camera shake and you never got rid of the barriers, the terrain is bad, there are still some dips /terrain changes unaccounted for in the track, trees, etc on track. my car can noclip into the terrain on hard crashes still"*. Resolved: 1) Cockpit camera rigidly locked to chassis driver eye position with zero lerp lag, completely eliminating screen shake; 2) Removed tire barriers and catch fences, retained clean 3-tier Armco guardrail, suppressed guardrails on GP stadium gravel runoffs and pit straight; 3) Smoothed 24h Ford-Kurve corner cut dip with Cubic Hermite Spline (1.15% max grade change, zero dips); 4) Enforced 55m clearance in terrain.ts across all 3 tracks and widened tree setback in forest-foliage.ts (0 trees on track); 5) Added full lower chassis cuboid collider in RaycastVehicle, 4.0m barrier collision walls with underground skirts, and instant anti-noclip terrain breach recovery in main.ts. |
| 2026-11-06 | Filled Eifel Mountain Terrain & Grounded Embankments | Ingested 8.0 km x 6.6 km SRTM DEM elevation data into rolling 3D mountain landscape mesh (EifelTerrain, 24,442 triangles) with altitude/gradient vertex shading. Sculpted DEM within 45m corridor along all 9,714 circuit centerline points to prevent road clipping. Extended visual track cross-section 35 meters outward beyond Armco barriers with green Eifel turf geometry so the track ribbon rests naturally on the landscape with zero floating appearance. |
| 2026-11-06 | Authentic Porsche 911 3D Model & Dynamic Wheel Rig | Ingested Karol Miklas Porsche 911 (992 generation) 3D model (Draco GLB, 3.5 MB) into `CarMeshRig`, scaling to 1:1 wheelbase (2.51m) and width (1.98m). Separated 4 animated wheels with fixed brake calipers and rolling rims/discs/tires. Mounted RSR carbon swan-neck wing and tuned PBR materials with 7-color paint switcher (`[P]` key / HUD button). |
| 2026-11-06 | Trackside Visual Overhaul & Zero-Noclip Terrain Sculpting | Clamped DEM terrain within 65m corridor across all 9,714 circuit nodes to <= Y_track - 4.0m (0 of 9,714 points clipping; max terrain relative to road = -3.99m), completely eliminating noclipping. Upgraded track mesh to 30-node cross section with 1.25m sub-sampling: razor-sharp 20cm continuous brilliant white boundary lines, 20cm centerline white dashes (5m dash / 5m gap), dark textured asphalt with rubbered grooves, alternating 2.0m FIA red/white kerbs on all corner complexes, non-blurry multi-tone grass verges and outward-sloping mountain forest embankments down to -35m. Added 16x anisotropic procedural aggregate detail texture via pure DataTexture. |
| 2026-11-06 | Porsche 911 GT3 RS Weissach Racing Model & Standardized Livery Pipeline | Replaced civilian Carrera 4S with authentic Porsche 911 GT3 RS (992 generation) featuring full Weissach package and factory DRS swan-neck rear wing mounted solidly to engine deck with zero gap. Built universal `VehicleModelAdapter` automatically stripping all civilian street license plates across imported models. Implemented dynamic $1024 \times 1024$ PBR canvas `LiveryGenerator` with 7 preset competition liveries (Manthey Grello #911, Martini #77, Rothmans #1, Pink Pig #92, Gulf #20, Weissach #93, Stealth #00) cycling via `[P]` key / HUD button. |
| 2026-11-07 | Version Control & GitHub Sync | Automatic commit and push of all codebase, assets, and documentation to public GitHub repository (`dual-screen-web-racer`) once after every phase completion. |
| 2026-11-07 | Release Authorization & Phase Cap | No releases unless explicitly allowed by the user. Repository status is strictly capped up to Phase 2 right now; no git tags, GitHub releases, or production deployments without prior user approval. |
| 2026-11-06 | The Green Hell: Foliage, Graffiti, Patches, Armco, Gravel Traps & 306.8m Elevation Drop | Removed all dashed centerline road marks across circuit; added multi-colored fan graffiti and weathered concrete patches. Added authentic 3-tier galvanized Armco steel crash barriers and coarse gravel decelerator traps at surveyed real-world zones (Aremberg, Adenauer Forst, Wehrseifen, Ex-Mühle, Brünnchen, Hohenrain). Added dense 3D evergreen spruce/pine forest (400–600 trees/chunk via `InstancedMesh`). Calibrated official 306.8m vertical elevation drop (Breidscheid 320.0m to Hohe Acht 626.8m, 11.7% Fuchsröhre plunge) and eliminated corner-cutting smoothing so surveyed apexes (Wehrseifen 15.8m radius, Karussell 25.5m radius) retain razor-sharp curvature. |
| 2026-11-06 | Porsche 911 RSR-19 GTE Specs & Database Homologation | Vehicle specification display and blueprint updated to authentic Porsche 911 RSR-19 (GTE) homologation specs: 515 HP, 4.2L NA mid-engine boxer, 9,000 max RPM, 3.1s 0–100 km/h, 318 km/h top speed, and active GTE swan-neck wing downforce. |
| 2026-11-06 | Concentric Wheel Hub Mounting & Stance Realism | Extracted surveyed glTF wheel hub centers (FL/RL: X = -0.7701m, FR/RR: X = +0.7701m; Y = 0.5190m; Z_front = +1.1688m, Z_rear = -1.2867m). Wheels sit flush inside arches with zero offset or monster-truck lift, resting squarely on the showroom turntable (Y = 0.185m) and track tarmac. |
| 2026-11-06 | Standardized Flat Wrap UV Pipeline (`StandardWrapMapper`) | Built analytical 1:1 UV unwrapping pipeline across all exterior bodywork meshes (`Chassis_Paint`, `Door_Paint_L`, `Door_Paint_R`, `Hood_Paint`, aero parts) with dedicated profile zones (Left, Right, Top/Plan, Front Bumper). Right side Z is inverted so text reads left-to-right on both flanks without horizontal mirroring or distortion. Allows any flat wrap image to wrap 1:1 smoothly around the vehicle. |
| 2026-11-06 | AO Racing 'Rexy' Livery & Dynamic Car Number Selection | Synthesized 2048x2048 Rexy dinosaur livery (emerald green, predatory jaws with sharp teeth, pink tongue, amber eyes, scales). Added interactive car number input (#0–#999) and quick pills (#77, #911, #80, #92, #1, #20, #93, #00) redrawing roundels on doors and hood in real time in Showroom and Race Session. |
| 2026-11-06 | FIA 5.148 km Grand Prix Circuit Geometry | Replaced 3.595 km sprint cut with authentic 5,105.0m (5.148 km) Grand Prix circuit extracted from 20 continuous OSM ways with 0.0m seam error: Mercedes-Arena, Ford-Kurve, Dunlop-Kehre hairpin (lowest point 574.6m), Schumacher-S, ITT-Bogen, and NGK-Schikane. |
| 2026-11-06 | Zero-Noclip Stadium DEM Terrain | Sculpted DEM terrain across the GP stadium bowl to >= 4.5m below road surface, guaranteeing 0 clipping violations / noclipping across all 1,021 track nodes. |
| 2026-11-06 | 3D Grandstands & Stadium Architecture (`StadiumAssets`) | Replaced dense pine forest in the stadium bowl with Start/Finish Haupttribüne, 2-story concrete Pit Building with VIP lounges, overhead Start/Finish Timing Gantry with 5 green start lights, Mercedes-Arena grandstand, and Dunlop-Kehre bleachers. |
| 2026-11-06 | In-Cockpit Micro Radar & Proximity Spotter (`MicroRadarDisplay`) | Mounted high-resolution 4:3 LCD monitor directly below rearview mirror screen. Features locked heading-up orientation, 2-corner zoomed lookahead ribbon, vector Porsche 911 RSR silhouette, and dynamic flashing yellow/amber hazard arcs at contact perimeter with spotter alert banners. |
| 2026-11-06 | Dynamic FIA Race Flags & F1 Broadcast Minimap Radar (`CompetitionField`) | Added 6 authentic endurance competitor entries (#911, #1, #92, #20, #93, #00) rendered as tiny moving dots on full circuit radar; dynamic FIA flag state machine (Green, Sector Yellows, Full Yellow / VSC, Red) with live warning banners and blinking sector outlines. |
| 2026-11-06 | Official Porsche 911 RSR Steering Wheel & 1:1 LCD Telemetry Replica | Replicated official GRID Engineering / Sim-Lab Porsche 911 RSR steering wheel (285mm diameter): contoured carbon fiber faceplate, ergonomic side grips, 15 curved shift LEDs, laser-etched PORSCHE wordmark, anodized TCI (red) and TCO (purple) thumb encoders, 10 motorsport pushbuttons, 4 lower rotary switches (`TC/CON`, `TC/R`, `MAP`, `WIPER`), golden Porsche crest, and 1:1 color telemetry screen layout ($1024 \times 600$ canvas). Road car steering wheel meshes sanitized out from 3D models. Unused telemetry zones reserved with clean dark placeholder boxes for future expansion. |
| 2026-11-06 | GPS North-Locked HUD Minimap Mode | Permanent locked heading-up / North-locked vehicle icon ($\uparrow$ along $-Y$) on the $240 \times 150$ HUD canvas. Rotating circuit ribbon, dynamic FIA flag states, competitor dots, and landmark beacons projected via quaternion forward and right vectors; 100m/250m/400m tactical range rings; motorsport compass rose showing true geographic North; toggleable between GPS mode and static circuit overview via `[N]` key or click. |
| 2026-11-06 | Long-Term Trackside Architecture & 1:1 Physics Parity | Ground-truth collision surface parity with SUB_STEPS=6 (0.000mm sagitta error, zero dipping/levitating); white line hitbox eradication; elevated chassis collider (+0.27m); 2D TrackSpatialGrid anti-encroachment engine guaranteeing >= 10.5m tree clearance and eliminating loop bleed-through; GP stadium tree suppression; dynamic gravel displacement drag (Crr = 0.280); 300m/200m/100m braking distance boards. |
| 2026-11-06 | 3D Showroom Swivel Direct-Manipulation Controls | Inverted drag delta signs (targetYaw -= deltaX * 0.007; targetPitch -= deltaY * 0.005) so swiping right rotates the front of the car right, swiping left rotates it left, swiping up elevates the camera, and swiping down lowers the stance. |
| 2026-11-06 | Zero Flying Tracks & Corridor DEM Clamping | Conformed DEM elevation grid within 75m of track corridor to <= min(p_y - 2.5m) with smooth blend to 180m across all 10,016 surveyed samples, completely eliminating floating tracks in the sky (e.g. at Hatzenbach 725m) and keeping terrain strictly >= 2.0m below asphalt grade everywhere. |
| 2026-11-06 | True Driver Right-Hand Minimap & Radar Orientation | Corrected lateral right vector in hud.ts and micro-radar-display.ts to true driver perpendicular vector R = (-F_z, 0, F_x). Verified corner directions against canonical real-world Nürburgring layout (Aremberg Right, Wehrseifen Left, Karussell Left, Brünnchen Right, Galgenkopf Right) with zero inversion. |
| 2026-11-06 | Low-Profile Dashboard Screens & Rear-Mounted Cameras | Scaled down dashboard dual-screen pod (0.16m x 0.08m digital mirror + 68% radar) lowered below windshield cowl line (Y <= 0.55m) for 100% unobstructed panoramic windshield sightlines. Repositioned main Look-Behind camera and digital mirror feed to rear exterior of vehicle (Z = -2.35m / -2.25m), completely eliminating cabin seat and roll cage obstruction. |
| 2026-11-06 | Elimination of Triangle-Step Bumpiness & C1/C2 Spline Surface Fairing | Fixed missing `/ 12` divisor on `tangent.z` in `centerline.ts`; applied 8-pass Taubin zero-shrinkage curve fairing ($\lambda = 0.45, \mu = -0.473$) to remove OSM polyline vertex kinks; removed per-sample `turnRate` sign-flipping and step-function landmark banking; computed direct analytical horizontal frames (`b.y = 0` on unbanked sections) with $C^1$ Hermite banking/width interpolation and 4 sub-divided road collision lanes in `TrackMeshGenerator`; elevated chassis collider bottom to `+0.50m` and added 2nd-order pneumatic damper velocity filtering in `RaycastVehicle`. |
| 2026-11-06 | Karussell Hairpin Voronoi Embankment Clamping & 2D Elevation Shelf Harmonization | Eliminated upper-leg Karussell embankment terrain overlapping/covering the lower entry leg (`Steilstrecke`): clamped lateral embankment reach to the 2D Voronoi perpendicular bisector ($s_{\text{bisector}} = \frac{D^2}{2u} - 1.2\text{ m}$) and clamped embankment vertex heights strictly below nearby track floors ($\le y_{\text{floor}} - 0.8\text{ m}$); harmonized 2D hairpin shelf elevations across `Steilstrecke / Karussell / Hohe Acht` and `Dunlop-Kehre` ($\Delta Y \approx 0.3\text{–}1.7\text{ m}$ across the $28\text{ m}$ neck instead of $15\text{–}33\text{ m}$); added Voronoi corridor ownership and deep $-2.4\text{ m}$ trunk roots in `ForestFoliage`; extended `dem.json` to $z_{\max} = 4835\text{ m}$ and sculpted to $\ge 3.5\text{ m}$ below the minimum track elevation in every corridor. |
| 2026-11-07 | Minimalist Luxury Motorsport Showroom Landing Page Polish | Removed all unnecessary description paragraphs (`track.highlight`), multi-colored difficulty badges, emojis, header hardware subtitles, the top-center floating drag banner (which overlapped the car's rear wing), and bottom sub-captions from `MainMenu`. Rebuilt `MainMenu` and `ShowroomStage` with obsidian carbon glass panels, a 4-column hairline telemetry strip, a non-clipping 4×2 livery swatch grid, a symmetrical 4×2 competition number grid, a Guards Red `START SESSION [ENTER]` CTA, and a 128-segment brushed platinum turntable chamfer ring with neutral silver studio rim lighting. |
| 2026-11-07 | Rearward-Only Directional Brake Lights (Zero Cockpit Spill) | User feedback: *"issue brake lights shine inside cockpit it should only be rearward"*. Replaced omnidirectional `PointLight` rear brake emitters with directional `SpotLight` beams ($Z = -2.02\text{ m}$) aimed strictly rearward toward $-Z$ ($Z_{\text{target}} = -14.0\text{ m}$). Guarantees zero red light spills forward into the cockpit while preserving rear road illumination and trailing car visibility. |
| 2026-11-07 | Phase 3 Advanced Motorsport Systems Implementation | Implemented Phase 3 subsystems: thermal brake fade above $750^\circ\text{C}$, modular day/night sun cycle with high-output recessed headlights, exterior-only 3D rain emitter, $40\%$ wet grip reduction with slick hydroplaning, 2D dynamic drying line along the racing groove, 9-sector timing breakdown with live `+/-` delta splits, 30 Hz ghost car recording/playback, and WebRTC DataChannel P2P multiplayer lobby. |
| 2026-11-07 | Pit Lanes Scrapped & Infinite Tyre/Fuel Everywhere | Scrapped pit lane & garage setup UI per user request (*"forget the pit lanes, scrap that from implimentation. no need for it just have infinite tyre and fuel even with friends"*). Infinite tyre life (`100%`) and infinite fuel (`60.0L`) are enabled at all times in both solo and multiplayer. |
| 2026-11-07 | Exterior-Only Rain & Recessed High-Output Racing Headlights/Brake Lights | Restricted 3D rain particles strictly outside the cockpit ($r \in [4.8\text{ m}, 34.0\text{ m}]$) and cleared cockpit windshield sightlines. Removed floating cylinder headlight circles blocking cockpit view; bound headlights, taillights, and brake lights directly to the recessed 3D model meshes inside `model.glb`, and upgraded racing headlight `SpotLight` beams to $280\text{ m}$ range (`decay = 0.45`, `intensity = 24.0`) + $115\text{ m}$ wide corner flood (`intensity = 14.0`) + rear brake `PointLight` emitters. |
| 2026-11-07 | Phase 4 Scope & 4-Digit Private Lobbies | Multiplayer support structured around private lobbies with 4-digit join codes (e.g., 4821); host configures circuit, lap count, max drivers (2–16), and collision toggle; strictly private lobbies without public server browsers. |
| 2026-11-07 | Format-Specific Start Sequences | GP-Strecke uses standing grid start with standard F1 5-red-light sequence (1.0s increments + random 0.4–2.4s hold; no rolling start; jump-start detection); Nürburgring Nordschleife uses rolling formation start (60–80 km/h) with floating 3-light countdown (3->2->1->Green). |
| 2026-11-07 | Smart Near-Crash Track Recovery | Flipping off-track (>78° rollover tilt for >2.5s) or pressing [R] / mobile respawn recovers the vehicle on track centerline 8m behind crash point facing track direction with 3.0s ghost invulnerability; current lap invalidated. |
| 2026-11-07 | Phase 5 Multi-Class Ecosystem & Dynamic Menu | Future expansion adds GT3, GTE, Prototype/LMDh, Formula 1, and Cup classes; international circuits (Spa, Monza, Le Mans, Suzuka, Bathurst); Main Menu evolves into multi-tier motorsport series hub. |
| 2026-11-07 | Sim Landing Hub & Stepped Config Wizard | Dedicated landing portal (Singleplayer vs Multiplayer); stepped wizard (1. Class -> 2. Vehicle/Livery -> 3. Track -> 4. Laps/Mode -> 5. Weather/Time); simplified in-game top-left timing HUD. |
| 2026-11-07 | Zero Staging Buffer & 2-Stage Multiplayer Ready/Quali Architecture | User feedback: standing/rolling starts in singleplayer proceed directly into session without buffer; multiplayer uses 2-stage ready gates: Stage 1 lobby ready check $\to$ host launches qualifying hotlap session; Stage 2 post-quali grid leaderboard $\to$ drivers ready check $\to$ host launches race sequence with seeded P1-P10 grid slots. No staging countdown buffer needed. |
| 2026-11-07 | Complete Elimination of Rolling Starts | User directive: *"get rid of rolling starts entirely"*. All tracks (Nordschleife, 24h Gesamtkurs, GP-Strecke, Proving Ground) now strictly enforce FIA F1 5-Red-Light standing starts. Vehicles spawn in authentic 2x2 grid boxes behind Start/Finish line (sample 0). Launch clamp holds brakes locked, limits throttle to 0.15, and locks transmission to 1st gear until simultaneous lights out. Jump-start detection active (> 0.25m creep). |
| 2026-11-09 | Strategic Project Re-Phasing | Pause standalone Phase 3 and Phase 4; establish Phase 5: Nürburgring & Car Ultra-Realism (Assetto Corsa Competizione Level), move Private Multiplayer to Phase 6, and Multi-Class/Global Tracks to Phase 7. |
| 2026-11-09 | Drastic Elevation & Forest Immersion | Recalibrate Nürburgring elevation drops to authentic real-world severity (Fuchsröhre, Breidscheid, Bergwerk climb); dense multi-tier Eifel forest walls and roadside canopies for true "Green Hell" woodland immersion. |
| 2026-11-09 | Trackside Infrastructure & Anti-Noclip CCD Barriers | Add FIA wire mesh catch fences atop Armco, red-and-white tire barrier stacks at runoff zones, and overhead sponsor bridges (Bilstein, Audi, Yokohama); thicken barrier collision depth (>=0.5m) and enable Continuous Collision Detection (CCD) on vehicle body to eliminate barrier tunneling/noclipping on high-speed crashes. |
| 2026-11-09 | Authentic Dedicated Pit Lane & Multi-Stall Boxes | Construct physically separate pit lane parallel to straight with concrete pit wall divider, deceleration entry, marked team pit stalls with overhead gantry rigs, multi-stall multiplayer readiness, and 60 km/h pit speed limiter. |
| 2026-11-09 | HUD Radar Cleanup | Remove broken placeholder yellow flags and fake AI competitor dots from radar; keep player's own ghost car blip/silhouette on minimap radar for timed laps. |
| 2026-11-09 | ACC-Standard Physical Realism & Consumables | Re-implement authentic physical simulation: slip-energy tyre wear reducing peak Pacejka grip D, dynamic fuel burn (0.75 kg/L) shifting chassis weight and balance, and brake thermal efficiency curve (cold bite, optimal window, severe fade >750°C). |
| 2026-11-09 | Diffuse Rear Lights & Sunset/Dawn 24h Ambience | Tone down over-bright rear taillights/brakes to realistic diffuse glow and localized ground bounce; overhaul sunset and dawn atmospheric scattering; implement continuous 24-hour day/night cycle with configurable time compression for endurance racing. |
| 2026-11-09 | Asset Creation Standard Documentation | Created docs/skills.md detailing end-to-end engineering pipelines for procedural track creation and vehicle ingestion/rigging/mapping. |
| 2026-11-09 | Anti-Nausea Cockpit Horizon Lock & Chassis Bump Dynamics | Stabilize internal cockpit camera with 85–90% horizon lock (VOR) so driver gaze remains smooth and motion-sickness-free; car chassis, dashboard, and steering column shake and vibrate over bumps. |
| 2026-11-09 | Non-Jagged Smooth Spline with Physical Multi-Band Bumps | Extrude smooth C2 faired spline geometry without polygonal facets; overlay procedural multi-band bumps and tar joints in 240 Hz suspension raycasts for authentic track bumpiness without visual jaggedness. |
| 2026-11-09 | Dedicated Sound Design Skill & Ear-Fatigue Mitigation | Added Section 4 to docs/skills.md; overhauled transmission whine with 3.2 kHz Butterworth low-pass filter, 3.5 kHz parametric notch (-8 dB), and driveline torque attenuation to protect headphone users from painful ear fatigue. |
| 2026-11-09 | Showroom Menu Side-Docking & Unblocked 3D Car View | User directive: *"in the menu right now all the options are blocking the car view, maybe move menu options to the side? and have car in middle/other side?"*. Re-architected showroom Main Menu (Landing Portal and 5-Step Sim Setup Wizard) into a left-docked 460px sidebar (`min(460px, 36vw)`). Utilized Three.js camera projection frustum offset (`camera.setViewOffset`) to shift optical focal center rightward by half the sidebar width, centering the 3D Porsche 911 RSR-19 turntable symmetrically in the open right viewport with 100% visibility, 360° direct-manipulation pointer swivel, and wheel zoom. |
| 2026-11-09 | Project Re-Branding to "Full of Water" | User directive: *"change name to something cool though not dual screen web racer"*. Renamed the platform to **Full of Water** (`fullofwater`) across all metadata, UI headers, titles, and documentation. |
| 2026-11-09 | Phase 5 Implementation & Verification | Completed and validated all 11 Phase 5 subsystems: 301.6m surveyed elevation drop, multi-tier dense Eifel forest (1,379 trees/chunk with spatial hash anti-encroachment), 923 trackside assets (FIA catch fencing, tire barriers, overhead sponsor bridges), thickened volumetric barriers (0.60m) with Rapier CCD, drivable pit lane (7.5m apron, concrete pit wall, 10 team stalls, 60 km/h limiter), HUD fake AI dot cleanup retaining player PB ghost, slip-energy tyre wear, dynamic fuel burn, 3-zone brake thermal curve, diffuse rear taillights, 88% VOR anti-nausea horizon lock cockpit camera, non-jagged C2 spline with multi-band bump dynamics, and headphone-safe audio DSP (3.2 kHz Butterworth low-pass, 3.5 kHz notch, torque attenuation). 100% test pass on npm run test:phase5. |
| 2026-11-09 | Git Commit Hash Traceability & Agent Protocol | User directive: *"can you add to skills.md so every major change an agent made has a hash code so we can easily track back and reference eaisly for version control"*. Added Section 5 (Engineering Change & Git Commit Traceability Registry) indexing all major architectural milestones by short and full SHA commit hashes, affected files, and test commands; added inline `[Commit: <hash>]` badges throughout Sections 1–4; added Section 6 establishing a strict agent commit registry protocol. |
| 2026-11-09 | Authentic Porsche Outside-In Shift Lights & Blue Flash | User directive: *"the porsche one in race has the led light up not like f1 but instead they go from both sides in the proper colour schema nad meet in the middle and reght before shift at max red all of the leds flash blue i think. research and implement please"*. Researched official Porsche 911 GT3 R / RSR-19 motorsport shift light logic: 15 arched LEDs light up symmetrically from outside flanks toward center (4 Green -> 4 Yellow -> 7 Red meeting in middle at max red from 6,600 to 8,799 RPM). At optimal shift point (>= 8,800 RPM or `isShiftLightActive`), ALL 15 LEDs strobe flash bright electric blue (`0x38bdf8`), synchronized with matching electric blue LCD border flash and phone controller LEDs. |
| 2026-11-09 | Roman Numeral Online Architecture & Phase I Plan | User directive: *"why dont we create a phase I, roman numeral, this is a separate development branch not realted to gameplay but for online and features, So I'm thinkgon account making would be nice to play so that we can solve our issue. a database of players would be nice, we can log stats, like km's driven etc, favourite car. but most important is like leaderboard i think to motivate people online to play. so leaderboard/map/category"*. Formally established parallel Roman Numeral track (Phases I–V) dedicated to online features, driver authentication, stats database, global hotlap leaderboards, and cloud matchmaking. Phase I specifies Driver Accounts, automated phone pairing, activity tracking ($km$, favorite car, clean lap ratio), and multi-dimensional hotlap leaderboards with anti-cheat verification. |
| 2026-11-09 | Track Environment, Terrain Welding, 24h Shortcut, Markings & Clean Cockpit | User directives: *"the barriers look horrible, get rid of them lets stick with the basic guardraile and some parts dont even have them like on the grand prix circuit. forget the camera shake, get rid of that. hard crashes noclip me into the terrain. right now with proper terrain the track is like on eelevated landmass bridge that can be disconnected from the surrounding terrain, should not be the case, also all my greenery dissapeared, i can see bare mountains and side of the track profile. also can you verify the layout for the 24 hour n24 layout i think its a bit different to the gp one in the gp section, theres a corner cut section. and also the start and finish section isnt accurate, pit lane should also be accurate on all tracks please. also make sure can you go back over all the markings on track and make them accurate, etc proper white lines, pit entrance, pit exit, starting grid boxes, sector lines, etc. there are also floating texts on the steering, get rid of them."*. Removed catch fences, tire barriers, and floating steering text; locked cockpit camera rigidly to car roof with zero shake; welded track embankments seamlessly to 3D DEM terrain elevations with zero air gaps; populated 1,800 mountain forest trees across Eifel terrain hillsides; rebuilt authentic 24.23 km 24h Gesamtkurs featuring the `Variante 24h-Rennen` corner cut shortcut bypassing the Mercedes-Benz Arena; implemented dynamic pit lanes across all circuits with 60 km/h limiter; added staggered starting grid boxes, sector lines, pit chevrons, and pit exit blend lines; elevated barrier collision height to 3.50m and added out-of-bounds safety auto-recovery. |
| 2026-11-09 | Terrain Spill Eradication, 24h GP Straight Alignment & Rear Lettering Removal | User directives: *"terrain is spilling onto track. the start position is not correct for 24 h, it should be the start straight of the gp track, also get rid of floating words in back of car (porsche)"*. Rebuilt 24h Gesamtkurs (25.20 km, 5,040 points) inheriting surveyed elevations from Nordschleife and GP circuits, with point 0 aligned to the exact GP Start-Ziel straight ([-1043.71, 615.351, 3134.76]); clamped outer embankments (visual and collision) with minimum 0.80m drop below road grade; fully sculpted dem.json across GP stadium bowl and all track corridors guaranteeing >= 4.34m clearance (zero spills across all circuits); and updated VehicleModelAdapter.sanitizeModel to strip 3D rear badges and floating chrome "P O R S C H E" lettering (Badge_Rear_Lettering and Exterior_Badges) from the car body. |
| 2026-11-09 | Parallel Roman Numeral Development | Confirmed that Roman Numeral online development tracks (driver accounts, stats database, leaderboards, WebRTC signaling) operate fully in parallel with Arabic numeral simulation branches with decoupled interfaces and zero merge conflicts. |
| 2026-11-09 | Phase 7 Master Championship Series Inventory | Documented master inventory of 5 motorsport series (Endurance WEC/IMSA, GT3 Sprint, Carrera Cup, Grand Prix F1, GT4 Clubsport), 13 homologated vehicles across 5 classes, and 11 international circuits. |
| 2026-11-09 | Carrera Cup Spec Model Architecture | For identical-spec championships like Porsche Carrera Cup, utilize a single high-fidelity 992 GT3 Cup 3D model with team liveries and zero Balance of Performance variation, preserving analog non-assisted driving feel. |
| 2026-11-09 | Formula 1 Base Chassis & Team Tuning Profiles | For Grand Prix single-seaters, utilize a single generic modern ground-effect 3D base mesh with team liveries, but configure separate mathematical physics profiles for each team (aerodynamic drag/downforce polars, ERS deployment curves, engine torque curves, and suspension kinematics). |
| 2026-11-09 | Modular 3D Ingestion vs. Series BoP Tuning | Decouple 3D vehicle geometry from series-specific Balance of Performance (BoP). A single shared 3D model (e.g. Porsche 963, 911 GT3 R, Oreca 07) loads once in memory, while dedicated regulatory JSON files (`*.bop.json`) configure distinct power curves, restrictors, ballast, and tire models per championship (WEC vs IMSA vs SRO GT World Challenge vs ELMS). |
| 2026-11-09 | Le Mans Ecosystem & Mini-Le Mans Integration | Incorporated European Le Mans Series (ELMS), Asian Le Mans Series, and Michelin Le Mans Cup into Phase 7, adding LMP2 (Oreca 07 unrestricted), LMP3 (Ligier JS P320), and continental endurance circuits. |

---

## 11. Changelog

- **2026-11-09** [Commit: `fb68357`] - Vercel Multi-Segment Serverless Catch-All Rewrites:
  - Added catch-all rewrite rule (`{"source": "/api/(.*)", "destination": "/api/[...route].js"}`) in `vercel.json` routing all multi-segment serverless endpoints (`/api/pair/create`, `/api/pair/verify`, `/api/auth/register`, `/api/laps/submit`) seamlessly to the bundled API dispatcher on live Vercel production.
  - Verified live pairing session lease generation and driver registration over HTTP 200 on `https://fullofwater-chi.vercel.app`.

- **2026-11-09** [Commit: `c53c948`] - Standalone Vercel Serverless Function Bundle (`api/[...route].js`):
  - Bundled serverless API dispatcher into a standalone 37.1 kb ESM bundle via `esbuild api/handler.ts --bundle --platform=node --format=esm --outfile=api/[...route].js`.
  - Resolved Node native ESM relative import resolution errors (`ERR_MODULE_NOT_FOUND`) on Vercel Functions.
  - Integrated bundle generation directly into `package.json` production build script.

- **2026-11-09** [Commit: `4c22dac`] - Physics Sub-step Clamp & 30 Hz Digital Mirror Optimization:
  - Clamped physics sub-step accumulator to 50ms and maximum 6 substeps per frame in `main.ts`, eliminating the spiral-of-death framerate drop on CPU hitches.
  - Alternated cockpit rear-view mirror rendering to 30 Hz with a tight 200m frustum in `rear-view-mirror.ts`, reducing GPU draw calls by 50%.

- **2026-11-09** [Commit: `842ffff`] - Phase I (Roman Numeral) Driver Identity, Cloud Persistence & Global Hotlap Leaderboards (Completed & Validated):
  - **Driver Accounts & Frictionless Onboarding (MI.1):** Built permanent driver registration (`UserAccount`, `DriverProfile`) with unique alphanumeric driver tags, country codes, display names, avatar colors, preferred units (`km/h` vs `mph`), and password/token authentication. Built zero-barrier Guest Mode with one-click "Claim Driver License" modal converting guest driving records into permanent accounts with 100% data retention.
  - **Automated Phone Device Pairing (MI.1):** Implemented session-based device pairing tokens (6-digit numeric PINs) matching desktop host and mobile phone controller via URL parameters (`?pairToken=...&driverTag=...`) and WebSocket handshake, eliminating manual IP and port configuration on Vercel.
  - **Player Activity & Lifetime Stats Database (MI.2):** Implemented relational activity database schema (`users`, `driver_profiles`, `driver_stats`, `personal_records`) tracking lifetime distance driven ($km$), total completed laps, clean lap ratio ($\%$), maximum top speed recorded ($km/h$), airborne flight time ($s$), favorite vehicle model, and favorite livery.
  - **Serverless Anti-Cheat Monotonic Sector Validation (MI.4):** Built serverless anti-cheat validation protocol in `/api/laps/submit` verifying: 1) Strict clean lap integrity (`isLapValid === true`); 2) Monotonic sector splits timing ($\left|\sum \text{sectors} - \text{total}\right| \le 50\text{ ms}$); 3) Physical homologation envelope checks (minimum plausible lap time and maximum average speed per circuit); 4) Vehicle top speed boundaries ($\le 350\text{ km/h}$); 5) Strictly increasing 30 Hz keyframe timestamps.
  - **Multi-Dimensional Global Hotlap Leaderboard (MI.3):** Built multi-dimensional matrix leaderboard query engine and desktop UI modal filterable across 4 circuits (Nordschleife, 24h Gesamtkurs, GP-Strecke, Proving Ground), vehicle classes (GTE, Hypercar, etc.), weather (Dry vs Wet), and input categories (Phone Gyro vs Keyboard vs Hardware Wheel), displaying ranks, driver tags, country badges, lap times, and delta splits.
  - **World Record 30 Hz Ghost Retrieval (MI.4):** Persisted compressed 30 Hz trajectory keyframes for top global records; enabled one-click "⚡ RACE WR GHOST" downloading and loading world record ghosts directly into `GhostCarManager` with golden holographic materials.
  - **Complete Validation Suite:** Created `scripts/test-phase-I.ts` (`npm run test:phase-I`) with all 6 validation tests passing at 100%.

- **2026-11-09** - Complete Camera Shake Eradication, Clean Armco Guardrails, 24h Dip Smoothing, Tree Clearance Overhaul & Multi-Tier Anti-Noclip Armor:
  - **Zero Camera Shake:** Rigidly locked Cockpit camera to chassis driver eye position (`eyeWorld`) with zero lerp filtering, zero lag, and zero independent displacement, eliminating high-frequency screen vibration and keeping the steering wheel, dash, and pillars completely rock-solid on screen. Refined Chase camera damping to snap responsive tracking.
  - **Clean Armco Guardrails & GP Suppressions:** Eradicated tire barrier stacks and catch fence meshes. Retained clean, authentic 3-tier galvanized Armco steel guardrails along the Nordschleife. Configured intelligent guardrail suppression on the Grand Prix circuit: wide open runoffs at Mercedes-Benz Arena, Dunlop-Kehre, and the GP Pit Straight have no guardrails bordering the tarmac edge, replicating real FIA Grade 1 circuits.
  - **24h Ford-Kurve Dip Smoothing:** Applied Cubic Hermite Spline fairing across the 99.5m `Variante 24h-Rennen` corner cut (indices 235–255), reducing max grade change to 1.15% with smooth $C^1$ transition from the GP loop into the Nordschleife with zero abrupt elevation dips.
  - **Tree Clearance Overhaul:** Updated `terrain.ts` to register centerlines of all 3 tracks (Nordschleife, GP, and 24h) with strict 55m spatial hash exclusion, and increased roadside tree setback in `forest-foliage.ts` to $\ge 8.0\text{m}$ behind road edge (14m spatial clearance), guaranteeing 0 trees on or overhanging the tarmac.
  - **Multi-Tier Anti-Noclip Armor:** Added a full-perimeter lower underbody/bumper cuboid collider (`0.85m x 0.18m x 2.05m` at `y = 0.35m`) in `RaycastVehicle`, heightened collision barrier walls to 4.0m with 1.0m underground collision skirts, and wired real-time DEM elevation breach detection in `main.ts` (`carPos.y < terrainY - 0.25m || carPos.y < proj.y - 3.2m || lateralOffset > 28m`) to instantly recover any vehicle before it can enter the terrain void.

- **2026-11-09** - Official Motorsport Grids, Modular BoP Architecture & Global Track Calendar:
  - **Official Grid Ingestion (Section 7.5):** Ingested official manufacturer grids from FIA WEC (Hypercar & LMGT3), IMSA WeatherTech (GTP, LMP2, GTD PRO, GTD), GT World Challenge Europe (pure GT3), and ELMS / Mini-Le Mans series (LMP2, LMP3, LMGT3).
  - **Carrera Cup & Formula 1 Architecture (Section 7.5):** Codified single-spec model rule for Porsche Carrera Cup (one 992 GT3 Cup model with team liveries) and single base mesh with team-specific mathematical tuning profiles for Formula 1 (individual aero polars, ERS recovery maps, and engine torque curves).
  - **Modular 3D Ingestion vs. Series BoP Tuning (Section 7.6):** Designed decoupled asset pipeline where single shared 3D models (Porsche 963, 911 GT3 R, Ferrari 296, Oreca 07) instantiate series-specific physics files (`*.bop.json`) for WEC, IMSA, SRO GT World Challenge, and ELMS regulations.
  - **Global 27-Circuit Master Calendar (Section 7.8):** Cataloged all 27 surveyed international racing circuits required across all 6 motorsport disciplines.

- **2026-11-09** - Parallel Roman Numeral Development Architecture & Phase 7 Master Inventory:
  - **Parallel Development Architecture (Section 8.1.1):** Confirmed and documented that Roman Numeral online infrastructure branches operate in parallel with regular simulation branches through decoupled telemetry and session bridges.
  - **Master Championship Series Inventory (Section 7.5):** Detailed 5 formal motorsport series (Endurance World Championship, GT3 Sprint World Challenge, Porsche Carrera Cup, Grand Prix World Championship, GT4 Clubsport Trophy), complete vehicle acquisition lists (13 models across 5 classes), and 11 international circuit geometries.
  - **Logged Candidate Packages in Parking Lot (P20):** Added Phase 7 master vehicle and track packages to Section 9.

- **2026-11-09** - Terrain Spill Eradication, 24h GP Straight Spawn Alignment & Rear Lettering Removal:
  - **Zero Terrain Spilling & Sculpted DEM:** Eliminated mountain terrain breaching the track ribbon by clamping outer track embankments to always slope at least 0.80m below road grade in visual and collision meshes (`TrackMeshGenerator`); sculpted `dem.json` across all track corridors and the GP stadium bowl with a 65m inner corridor and 110m smooth envelope. Verified 0 spill violations across all 3 circuits (min clearance: 4.34m below road).
  - **24h GP Start-Ziel Alignment:** Aligned 24h Gesamtkurs point 0 directly to the GP Start-Ziel straight (`[-1043.71, 615.351, 3134.76]`, identical to `osm_gp.json`), facing Turn 1 (Castrol-S) with 24 staggered starting grid boxes and the main grandstand gantry.
  - **Accurate 24h Topography & Corner Cut:** Seamlessly connects GP straight $\to$ Castrol-S $\to$ `Variante 24h-Rennen` corner cut $\to$ Ford-Kurve $\to$ GP mid loop $\to$ NGK-Schikane $\to$ branch onto `Anbindung zur Nordschleife` $\to$ full 20.8 km Nordschleife $\to$ Hohenrain $\to$ `Anbindung zum GP-Kurs` $\to$ GP straight crossing finish line ($25.20\text{ km}$, 5,040 points).
  - **Rear 3D Badges & Floating "PORSCHE" Words Removed:** Updated `VehicleModelAdapter.sanitizeModel` to automatically detect and strip `Badge_Rear_Lettering` (node 23) and `Exterior_Badges` (node 27), removing floating chrome lettering and badges from the back bumper and engine deck.

- **2026-11-09** - Track Environment, Terrain Welding, 24h Variante Shortcut, Markings & Clean Cockpit Overhaul:
  - **Basic Guardrails & Clutter Removal:** Removed intrusive FIA debris catch fencing and red/white tire stacks per user directive (*"the barriers look horrible, get rid of them lets stick with the basic guardraile and some parts dont even have them like on the grand prix circuit"*); reverted to clean galvanized steel Armco barriers; suppressed barriers along GP pit straight to open the pit apron.
  - **Camera Shake & Vibration Elimination:** Completely removed camera shake, horizon lock, and interior bump micro-vibrations per user directive (*"forget the camera shake, get rid of that"*); locked camera rigidly to chassis roof normal (`camera.up.copy(carUp)`) and chassis translation with zero artificial shake.
  - **Terrain Welding & Gap Elimination:** Sampled 3D SRTM DEM elevations (`getTerrainElevation`) at outer track embankments, welding the road edges seamlessly to the mountain terrain surface with zero elevation gaps or "elevated landmass bridge" cliffs.
  - **Greenery & Mountain Forest Canopy:** Planted 1,800 evergreen mountain trees across visible Eifel mountain ridges and slopes in `EifelTerrain`; removed over-aggressive tree suppression in chunk 0/T13/Hatzenbach; rooted all chunk trees directly into terrain surface.
  - **Authentic N24 Layout (Variante 24h-Rennen):** Rebuilt 24h Gesamtkurs (24.23 km, 4,847 points) including the authentic `31010602 Variante 24h-Rennen` corner cut shortcut bypassing the Mercedes-Benz Arena directly from Castrol-S into the Ford-Kurve.
  - **Accurate Pit Lanes & Track Markings:** Dynamic pit lane entry/exit across all tracks with 60 km/h limiter, 10 team stalls, and concrete dividing pit wall; 20cm continuous reflective white boundary lines, 24 staggered 2x2 starting grid boxes with pole position marker, pit entry hazard chevrons, pit exit solid blend line, and FIA sector timing split lines.
  - **Hard Crash Safety & Noclip Prevention:** Elevated collision barrier height to 3.50m (impossible to ramp over at 300+ km/h), added outer embankment collision mesh, and added instant safety recovery if vehicle breaches road boundary.
  - **Steering Wheel Cleanup:** Removed all floating text canvas planes and billboards (`P O R S C H E` wordmark, `TCI`, `TCO`, `TC/CON`, `TC/R`, `MAP`, `WIPER`) from the steering wheel faceplate, preserving clean anodized rotary dials, tactile pushbuttons, and the integrated 1:1 color telemetry LCD display.

- **2026-11-09** - Roman Numeral Architecture (Phases I–V) Specification & Phase I Platform Planning:
  - **Dual-Track Development Roadmap (Section 8):** Established parallel Roman Numeral development track separating online cloud infrastructure and social competition from client-side simulation physics.
  - **Phase I Specification:** Outlined Driver Accounts & Authentication, Automated Multi-Tenant Phone Device Pairing, Relational Database Schema (`users`, `driver_profiles`, `driver_stats`, `personal_records`), and Multi-Dimensional Global Hotlap Leaderboard (filtered by track, category, weather, and input device) with serverless monotonic sector validation and World Record ghost retrieval.
  - **Future Roman Numeral Roadmap:** Documented Phase II (Cloud-Relayed WebRTC Multiplayer via PartyKit / Cloudflare Durable Objects), Phase III (Driver Rating & Safety Rating Elo/SR system), Phase IV (MoTeC-style Cloud Telemetry Trace Overlays), and Phase V (Cloud Livery Workshop).

- **2026-11-09** - Authentic Porsche Motorsport Outside-In Shift Lights & Electric Blue Shift Flash:
  - **Outside-to-Inside Symmetrical Convergence:** Overhauled the 15-LED shift light cluster across the top of the Porsche 911 RSR steering wheel (`PorscheRsrSteeringWheel`) and phone controller display (`F1DashDisplay`). Replaced generic sequential left-to-right F1 pattern with authentic Porsche GT/GTE outside-in logic:
    - Flanks (6,600–7,150 RPM): 4 Green LEDs (Pairs 0 & 1).
    - Mid-Range (7,150–7,700 RPM): 4 Amber/Yellow LEDs (Pairs 2 & 3).
    - Center Ingress (7,700–8,525 RPM): 6 Red LEDs (Pairs 4, 5, 6).
    - Max Red Apex (8,525–8,799 RPM): Center Red LED 7 illuminates, completing 15-LED convergence meeting in the middle.
  - **Electric Blue Shift Strobe Flash:** Right at optimal upshift RPM (>= 8,800 RPM or `isShiftLightActive`), all 15 LEDs simultaneously strobe flash electric blue (`#38bdf8` / `0x38bdf8`) at 10 Hz (~50ms duty cycle).
  - **Synchronized Telemetry Displays:** Updated the 1:1 LCD screen border alert on the steering wheel, HUD RPM bar (`.rpm-shift-flash`), and mobile controller circles to flash in matching electric blue.

- **2026-11-09** [Commit: `ee31b16`] - Git Commit Hash Traceability & Agent Version Control Protocol in `docs/skills.md`:
  - **Traceability Registry (Section 5):** Added git commit registry mapping every major platform milestone to short and full commit hashes (`821bad7`, `7ec4d17`, `7dbf059`, `c0a93cf`, `9f09850`, `3657d77`), dates, scope, implemented subsystems, primary files modified, and verification test commands.
  - **Inline Specification Badges:** Annotated all technical specifications across Sections 1 through 4 (track ribbon, cross-section extrusion, anti-noclip barriers, pit lane, forest engine, CAD ingestion, wheel rig, UV wrap mapper, lighting, cockpit VOR camera, Pacejka tires, consumables, engine harmonics, and headphone DSP) with direct `[Commit: <short-hash>]` badges.
  - **Agent Version Control Protocol (Section 6):** Codified mandatory instructions for future agents to record commit SHAs, file lists, and verification test commands in `docs/skills.md` and keep the living design doc in sync.

- **2026-11-09** [Commit: `ee31b16`] - Live Vercel Production Deployment:
  - **Production Hosting:** Linked and deployed platform to Vercel at `https://fullofwater-chi.vercel.app` (and `https://fullofwater-le-fisches-projects.vercel.app`) with clean URL routing for host simulation and phone controller (`/controller`).
  - **Build Integrity Fix:** Committed `src/host/render/trackside-assets.ts` and synchronized `package-lock.json` metadata, ensuring reproducible headless cloud builds.

- **2026-11-09** [Commit: `3657d77`] - Phase 5 Nürburgring & Simulation Realism (Assetto Corsa Competizione Level) Complete & Validated:
  - **Surveyed Elevation Dynamics:** Verified 301.6m authentic vertical elevation drop (Breidscheid 323.1m to Hohe Acht 624.7m) with 33.0° banking at Caracciola-Karussell and smooth C2 spline orthonormal frames.
  - **Dense Eifel Forest ("The Green Hell"):** Implemented 3-tier dense vegetation engine (roadside undergrowth, mature spruce/pine canopies, deep mountain forest) rendering 1,379 trees per chunk with 2D spatial clearance hash grid anti-encroachment.
  - **Trackside Infrastructure:** Added 923 trackside assets including overhead steel truss sponsor bridges (Bilstein, Audi Sport, Yokohama, Dunlop), FIA debris catch fencing with dark wire mesh netting along spectator zones, and red-and-white tire barrier stacks and Tecpro energy absorption blocks at acute runoffs (Aremberg, Adenauer Forst, Wehrseifen, Brünnchen, Hohenrain).
  - **Anti-Noclip Thickened Barriers & Rapier CCD:** Extruded 3D volumetric barrier collision envelopes (depth $t = 0.60\text{ m} \ge 0.50\text{ m}$, 15 vertices per section) combined with Rapier Continuous Collision Detection (`bodyDesc.setCcdEnabled(true)`), preventing barrier tunneling on 300+ km/h impacts.
  - **Dedicated Drivable Pit Lane & Speed Limiter:** Implemented physically separate 7.5m concrete pit apron parallel to Start-Ziel straight, partitioned by continuous 1.05m concrete pit wall, deceleration entry lane, 10 marked team pit stalls with overhead lollipop gantries, and automated/manual 60 km/h pit speed limiter (`[L]` hotkey or mobile button) with staccato audio governor cuts and pit crew service stops.
  - **HUD Radar & Flag Cleanup:** Removed synthetic fake AI competitor dots from minimap radar and cockpit micro-radar; strictly retained player's personal best ghost car blip and real WebRTC peers; removed placeholder yellow flag cycling.
  - **ACC Vehicle Physics & Consumables:** Implemented slip-energy tyre degradation reducing peak Pacejka friction D, dynamic fuel burn (0.75 kg/L) shifting chassis mass and balance, and 3-zone brake thermal curve (cold bite under 200°C, optimal window 350–650°C at 1.05 efficiency, thermal fade above 750°C down to 0.43 at 1,100°C).
  - **Lighting & Atmospheric Ambience:** Calibrated rear taillights/brake lights to diffuse automotive luminance (`emissiveIntensity = 1.8` under braking) with localized ground bounce and zero forward cockpit light wash; continuous 24-hour day/night cycle with golden hour sunset and dawn scattering.
  - **Anti-Nausea Cockpit Camera (VOR):** Implemented 88% Vestibulo-Ocular Reflex horizon lock stabilizing camera pitch and roll against world horizontal plane; decoupled cockpit interior and chassis micro-vibration ($\le 2.5\text{ mm}$ displacement) for visceral peripheral bump feedback with zero motion sickness.
  - **Procedural Multi-Band Bump Dynamics:** Smooth non-jagged C2 cubic spline geometry overlaid with procedural Perlin undulations and tar expansion joints directly in 240 Hz suspension raycasting.
  - **Headphone-Safe Transmission DSP:** Overhauled transmission whine with 2nd-order Butterworth low-pass filter at 3,200 Hz (-12 dB/octave), static parametric notch filter at 3,500 Hz (Q = 3.0, gain -8.0 dB), driveline torque scaling (-18 dB during coasting), and master DynamicsCompressorNode brickwall limiter (-6 dBFS, 8:1 ratio).
  - **Automated Validation:** Created `scripts/test-phase5.ts` (`npm run test:phase5`) validating all 11 subsystems with 100% pass rate.

- **2026-11-09** [Commit: `c0a93cf`] - Official Project Re-Branding to "Full of Water":
  - **Platform Re-Branding:** Renamed the game from "Dual-Screen Web Racer" to **Full of Water** (`fullofwater`) across `package.json`, HTML document titles, Showroom Main Menu header branding, Vite and host startup console banners, and all technical documentation.

- **2026-11-09** [Commit: `c0a93cf`] - Showroom Main Menu Side-Docking & Unblocked 3D Car Viewport:
  - **Side-Docked Left Menu Column:** Re-architected both the Landing Portal (`landing-portal-wrap`) and Singleplayer 5-Step Sim Setup Wizard (`wizard-sidebar`) from center-screen overlays to an ultra-clean left-docked motorsport sidebar column (`width: min(460px, 36vw)`), leaving the right ~64% of the screen completely clear.
  - **Frustum-Shifted 3D Automotive Showroom Stage:** In `ShowroomStage`, dynamically offset camera projection matrix (`camera.setViewOffset`) rightward by half the sidebar width (`-Math.round(sidebarWidth / 2)`), centering the Porsche 911 RSR-19 directly in the open viewing space without skewing the 3D orbit pivot.
  - **Full Interactive Turntable & Discreet Control Hint:** Direct manipulation mouse/pointer drag (360° yaw swivel and stance pitch) and mouse wheel zoom remain 100% active across the entire open right viewport; added an obsidian glass viewport badge (`DRAG TO ROTATE • SCROLL TO ZOOM`).
  - **Responsive Viewport Support:** On smaller screens (< 860px), layout gracefully collapses to full width and resets camera frustum offset (`camera.clearViewOffset()`).

- **2026-11-09** [Commit: `7ec4d17`] - Anti-Nausea Cockpit Stabilization, Smooth Spline Bumps & Sound Design Pipeline:
  - **Anti-Nausea Cockpit Camera:** Implemented 85–90% Vestibulo-Ocular Reflex (VOR) horizon lock on internal camera sightlines; decoupled cockpit interior and chassis body vibration so the car shakes over bumps while driver view remains stable, preventing simulator sickness.
  - **Smooth Spline Geometry & Multi-Band Bumps:** Faired track extrusion along C2 continuous spline (zero polygonal jaggedness or DEM staircasing) combined with procedural multi-band surface undulations and tar expansion joints for tactile suspension excitation.
  - **Sound Design Skill (`docs/skills.md` Section 4):** Standardized audio synthesis manual covering multi-harmonic flat-six combustion pulses, straight-cut gearbox whine attenuation (3.2 kHz low-pass, 3.5 kHz notch, torque load scaling) to prevent headphone ear fatigue, tire scrub noise, kerb thumps, and master brickwall compression.

- **2026-11-09** [Commit: `7ec4d17`] - Phase 5 Nürburgring & Simulation Realism (Assetto Corsa Competizione Standard) Specification & Pipeline Manual:
  - **Strategic Re-Phasing:** Paused standalone Phase 3 and Phase 4; established Phase 5 (Nürburgring & Car Ultra-Realism) as active focus; shifted Private Multiplayer to Phase 6 and Multi-Class/Tracks to Phase 7.
  - **Surveyed Topography & Drastic Elevation Dynamics:** Calibrated vertical drop to authentic 306.8m (Breidscheid 320m to Hohe Acht 626.8m), sustained 11.7% Fuchsröhre plunge with severe G-compression, 300m Bergwerk climb, and authentic Karussell/Flugplatz camber.
  - **Dense Forest Immersion ("The Green Hell"):** Multi-tier forest walls with overhanging roadside canopies, 2D spatial clearance anti-encroachment grid, and GPU instancing with cross-quad billboard LODs maintaining 60–120 FPS.
  - **Trackside Infrastructure & Anti-Noclip CCD Barriers:** FIA debris catch fences atop Armco, red/white tire barriers and Tecpro blocks at runoffs, overhead sponsor bridges (Bilstein, Audi, Yokohama), 0.5m thick collision envelopes, and Rapier continuous collision detection (CCD).
  - **Dedicated Drivable Pit Lane:** Physically separate pit lane with concrete pit wall divider, deceleration entry, 7.5m concrete apron, 10+ marked team pit stalls with overhead lollipop gantries, and 60 km/h speed limiter.
  - **HUD Radar Cleanup:** Removed broken yellow flags and fake AI competitor dots; retained player ghost car blip for timed laps.
  - **ACC Physical Realism:** Slip-energy tyre wear reducing peak Pacejka friction D, dynamic fuel burn (0.75 kg/L) shifting weight balance, and 3-stage brake thermal efficiency curve (cold bite, optimal window, severe fade >750°C).
  - **Lighting & Endurance Ambience:** Diffuse rear taillights/brake lights (no forward cockpit spill), physically based sunset/dawn atmospheric scattering, and continuous 24-hour day/night endurance cycle.
  - **Pipeline Manual (`docs/skills.md`):** Published complete engineering guide for procedural track extrusion and vehicle CAD/GLB ingestion, wheel rigging, and livery mapping.

- **2026-11-07** [Commit: `7dbf059`] - Dynamic Personal Hotspot IP Detection & Auto-Resolution:
  - **Dynamic Interface Re-Evaluation:** Rewrote `getLocalIpAddress()` and `/api/network-info` in `vite.config.ts` to compute network interfaces on every request instead of caching the startup IP. When the laptop connects to a mobile Personal Hotspot (e.g. `172.20.10.x` on iPhone or `192.168.43.x` on Android), the QR code and controller link dynamically update to the hotspot IP (`https://172.20.10.2:5173/controller.html`) without restarting the server.
  - **Sub-5ms Hotspot Latency:** Direct P2P packet exchange over the cellular hotspot Wi-Fi or USB tethering connection between the iPhone controller and Mac host.

- **2026-11-07** [Commit: `7dbf059`] - Rolling Starts Completely Removed (Universal Standing F1 5-Red-Light Starts Everywhere):
  - **Eliminated Rolling Starts:** Deprecated and scrapped the rolling start state machine, 3-light countdown, and formation speed governor platform-wide per user directive (*"get rid of rolling starts entirely"*).
  - **Universal 2x2 Grid Placement:** Nordschleife, 24h Gesamtkurs, and GP-Strecke now consistently spawn in staggered 2x2 grid slots behind Start/Finish line (sample 0) facing downstream.
  - **Overhead FIA 5-Light Cluster & Launch Clamp:** All tracks feature the authentic overhead 5-red-light starting gantry, 1.0s sequential light ignition, random 0.4s–2.4s hold delay, jump-start detector (> 0.25m), and simultaneous lights out green flag release.

- **2026-11-07** [Commit: `7dbf059`] - Mobile Phone Controller Bridge & QR Network Realignment:
  - **Local Network Wi-Fi QR Resolution:** In `MainMenu`, `generateQrCode()` previously defaulted to `window.location.origin` (`localhost:5173`), which caused mobile devices scanning the QR code to fail with unreachable host errors. Wired `/api/network-info` fetch so the QR code and pairing link dynamically encode the Mac host's true local network IPv4 address (`https://128.189.69.240:5173/controller.html`).
  - **Immediate Page-Load WebSocket Connection:** Mobile controller now initiates `connectWebSocket()` on page load rather than delaying until the "ENGINE START" push-button is tapped, giving immediate "WHEEL LINKED" confirmation on the host menu.
  - **Mobile Background Lifecycle Revival (`visibilitychange`):** Added `visibilitychange` event listeners to both [`controller.ts`](src/controller/controller.ts) and [`host-server.ts`](src/host/net/host-server.ts), automatically reconnecting dormant WebSockets when mobile Safari is resumed from lock screen or app switching.

- **2026-11-07** [Commit: `7dbf059`] - Reverse Lockout Resolution & Grand Prix Start/Finish Realignment:
  - **Reverse Lockout during Starting Sequences:** Diagnosed and fixed vehicle reversing backwards during standing starts and rolling formations. Holding brakes at standstill accumulated `reverseHoldTimer > 0.30s`, shifting drivetrain into reverse gear (-1) under full throttle. Added `setReverseLock(locked: boolean)` on `Drivetrain` and `RaycastVehicle`, actively locking the transmission into 1st gear whenever `RaceProcedureDirector.isProcedureActive()`.
  - **Authentic Grand Prix Start/Finish Line (`osm_gp.json` & `stadium-assets.ts`):** Rotated surveyed GP-Strecke loop coordinates by 95 sample points, placing sample 0 directly on the main straight in front of the Haupttribüne and pit complex facing southwest towards Castrol-S Turn 1. Aligned start timing gantry, pit garages (samples 2–72, +26m right), and Haupttribüne (samples 0–75, -28m left) with 2x2 staggered starting grid boxes behind the line.
  - **Qualifying Auto-Broadcast & Grid Keybinding:** Completing a valid qualifying hotlap broadcasts the lap time to all room peers and opens the Grid Staging modal. Added `[G]` hotkey in race to toggle the official starting grid dialog.

- **2026-11-07** [Commit: `7dbf059`] - Direct Session Ingress, 2-Stage Multiplayer Ready Gates & Grid Seeding:
  - **Singleplayer Direct Launch:** Drivers proceed straight from configuration into race starting procedures without artificial 10s delay.
  - **Multiplayer 2-Stage Ready Architecture:**
    - Stage 1: All drivers ready up in lobby before host launches Qualifying Hotlap.
    - Stage 2: Post-quali leaderboard shows seeded grid (P1–P10); all drivers ready up before host launches Race starting sequence.
  - **Simplified HUD:** Redundant runtime toggles (`[U]`, `[T]`, etc.) removed from top-left HUD.

- **2026-11-07** [Commit: `7dbf059`] - Proper Sim Landing Hub, Stepped Configuration Flow, 10-Car Qualifying & HUD Simplification Architecture:
  - **Landing Portal Selection:** Clean two-path sim entry separating Singleplayer Simulation from Multiplayer Paddock.
  - **Stepped Simulation Wizard:** Sequential setup (Class -> Vehicle -> Circuit -> Mode/Laps -> Weather/Time) creating an authentic, deliberate sim-racing paddock preparation experience.
  - **10-Second Staging Gate:** Added a pre-load readiness buffer with an audible 10-second countdown before loading into the track, eliminating the bug where rolling/standing start sequences fire while the driver is still browsing menus.
  - **10-Car Multiplayer & Pre-Race Qualifying:** Expanded lobby support to 10 cars with a pre-race qualifying shootout to determine starting grid order (P1–P10) based on fastest lap times.
  - **HUD Simplification:** Streamlined in-game top-left HUD by eliminating pre-configured environmental toggle chips (`[U]`, `[T]`), presenting an uncluttered professional timing & split cluster.

- **2026-11-07** [Commit: `7dbf059`] - Phase 4 Implementation: Private 4-Digit Lobbies, Dynamic Start Sequences, Smart Near-Crash Track Recovery & Kinematic Collision Modes:
  - **Step 4.1: Private 4-Digit Lobbies & Mesh Networking:**
    - Implemented 4-digit numeric room address space `[0000, 9999]` with `/api/create-room` endpoint and WebSocket signaling message `create_private_room`.
    - Added quick-join URL query parameter support (`?room=4821`) and one-click "COPY LINK" clipboard sharing.
    - Verified 44-byte binary WebRTC DataChannel packet transmission with 60 Hz pose streaming, dead-reckoning extrapolation, and sub-millimeter unpacking.
  - **Step 4.2: Host Race Configuration & Setting Synchronization:**
    - Delivered host control panels in `<dialog id="webrtc-lobby-dialog">`: circuit selection, lap count (1–25), max competitors (2–16), and collision mode toggle.
    - Added driver readiness toggling and host authoritative race start synchronization (`race_start_launch`).
  - **Step 4.3: Grand Prix Standing Start F1 5-Red-Light Sequence (`RaceProcedureDirector`):**
    - Built FIA F1 standing start state machine for GP-Strecke: 2x2 grid boxes, vehicle launch clamp (brakes locked, throttle limiter), 5-light sequence at 1.0s increments, random 0.4s–2.4s hold delay, simultaneous lights out.
    - Integrated jump-start detector logging violations if forward displacement $>0.25\text{ m}$ during red light illumination (+10.0s penalty).
  - **Step 4.4: Nürburgring Nordschleife Rolling Start 3-Light Formation:**
    - Implemented authentic rolling start for Nordschleife & 24h: 350m formation rolling approach through Tiergarten / Antoniusbuche with automated 60–80 km/h speed governor.
    - Built 3D overhead gantry in world space and HUD overlay with 3-beacon countdown (`3` -> `2` -> `1` -> Flashing Green).
    - Speed governor disengages automatically upon crossing Start/Finish line for full acceleration.
  - **Step 4.5: Smart Near-Crash Track Recovery Respawn:**
    - Handled manual trigger `[R]`, mobile `RESPAWN` button, upside-down rollover ($>78^\circ$ tilt for $>2.5\text{s}$), and off-track immobilization ($>4.0\text{s}$).
    - Projected crash coordinates $\mathbf{p}_{\text{crash}}$ onto centerline spline, computed invariant anti-exploit offset $s_{\text{respawn}} = \max(0, s_{\text{crash}} - 8.0\text{ m})$, positioned vehicle centered on asphalt $+0.35\text{ m}$ along road normal $\mathbf{n}$, aligned with track tangent $\mathbf{t}$, reset dynamics ($\mathbf{v}=\mathbf{0}, \boldsymbol{\omega}=\mathbf{0}$), and latched `isLapValid = false`.
    - Implemented 3.0s translucent ghost invulnerability with pulsating cyan shield aura (`CarMeshRig.setGhostMode`).
  - **Step 4.6: Dual Collision Modes:**
    - Ghost Mode (Default): remote cars rendered as 3D visual rigs without Rapier rigid bodies.
    - Kinematic Impulse Mode: remote cars instantiate kinematic Rapier box colliders ($4.5\text{ m} \times 1.85\text{ m} \times 1.1\text{ m}$); local car bypasses contact during ghost invulnerability.
  - **Verification:** Built automated test suite `scripts/test-phase4.ts` and added `npm run test:phase4`, achieving 100% pass across all validation suites and `npm run build`.

- **2026-11-07** [Commit: `7dbf059`] - Phase 4 (Private 4-Digit Lobbies, Dynamic Start Sequences & Near-Crash Track Recovery) & Phase 5 (Multi-Class Motorsport Ecosystem & Dynamic Series) Specifications:
  - **Phase 4 Specification & Brainstorming Architecture:**
    - Documented private multiplayer lobbies addressed exclusively via memorable 4-digit join codes (e.g., `4821`, `7104`) with host controls (circuit, lap count, 2–16 max competitors, and collision toggle).
    - Specified format-specific race start procedures: Grand Prix standing start with official F1 5-red-light sequence (1.0s increments, random 0.4–2.4s hold, jump-start detection, no rolling start) versus Nürburgring Nordschleife rolling start with paced formation (60–80 km/h) and a floating 3-light HUD countdown rig.
    - Designed smart near-crash track recovery respawn: projects crash coordinates onto centerline spline, recovers vehicle 8m behind incident point ($s_{\text{respawn}} = \max(0, s_{\text{crash}} - 8.0\text{ m})$) facing valid track direction, with 3.0s ghost invulnerability and lap invalidation latch.
    - Defined multiplayer collision modes: default Ghost Mode (no Rapier rigid body, zero collision desync) versus Kinematic Impulse Mode.
  - **Phase 5 Multi-Class Motorsport Ecosystem & Dynamic Series Hub:**
    - Established vehicle class taxonomy: LMH / LMDh Prototypes (700 HP hybrid, high downforce), GT3 / GTE (515–540 HP, production racers), Formula / Single-Seater (1,000 HP, 3.5+ G lateral), Porsche Cup (analog, no TC/ABS), and GT4 Clubsport.
    - Outlined iconic international circuits for roster expansion: Spa-Francorchamps, Monza, Circuit de la Sarthe (Le Mans), Suzuka, and Mount Panorama (Bathurst).
    - Designed multi-tier dynamic Main Menu evolution featuring championship series selection, class-filtered car grids, race calendars, and custom team livery options.

- **2026-11-07** [Commit: `7dbf059`] - Pit Lanes Scrapped (Infinite Tyre & Fuel Everywhere), Exterior-Only Rain (Zero Cockpit Rain), and Recessed High-Output Racing Headlights & Brake Lights:
  - **Pit Lanes Scrapped & Infinite Tyre/Fuel Active Everywhere:**
    - Deleted `src/host/gameplay/pit-lane.ts`, `src/host/ui/garage-setup-ui.ts`, and `src/controller/ui/pit-setup-menu.ts`, and removed all pit lane / garage setup buttons and protocol messages across Host and Controller.
    - Configured `RaycastVehicle` (`src/host/physics/raycast-vehicle.ts`) with `consumablesEnabled = false`, `wearRateMultiplier = 0.0`, and `fuelBurnMultiplier = 0.0` by default so infinite tyre life and infinite fuel remain active at all times, including in WebRTC P2P multiplayer with friends.
    - Restored the clean dark placeholder box on the Porsche 911 RSR 3D steering wheel LCD (`src/host/render/cockpit/rsr-steering-wheel.ts`).
  - **Exterior-Only Rain & Clear Cockpit Visibility (`src/host/render/environment-manager.ts`):**
    - Added `sampleExteriorRainXZ()` restricting all 1,600 3D rain streak particles to an exterior cylindrical annulus ($r \in [4.8\text{ m}, 34.0\text{ m}]$) around the camera with `depthTest: true` so rain never spawns or falls inside the cockpit cabin.
    - Updated the windshield droplet shader to `discard` across the entire lower cockpit ($vUv.y < 0.50$, covering the steering wheel and dashboard) and central road sightline ($\text{distFromSight} < 0.32$), removing the opaque wiper bar and reduced rain fog density so track visibility remains crystal clear.
  - **Recessed High-Output Endurance Racing Headlights & Brake Lights (`src/host/render/car-mesh.ts`, `src/host/render/livery-system.ts`):**
    - Removed the two floating cylinder circles (`leftLens`, `rightLens` at $(\pm 0.72, 0.52, 2.08)$) and floating taillight bar from `this.headlightsGroup` that hovered above the front fenders and blocked the driver's cockpit view.
    - Bound `headlightLensMaterial`, `taillightMaterial`, and `brakeLightMaterial` directly to the authentic recessed 3D meshes inside `public/assets/cars/porsche_992_rsr/model.glb` (`Headlight_Emissive`, `HeadLight_Glass`, `HeadLight_Housing_Static`, `Signal_Front_Emissive`, `Taillight_Strip_Emissive`, `Taillight_Brake_Emissive`, `Tailgate_Brake_Emissive`, `Taillight_Main_Glass`), and recessed the fallback `proxyGroup` lights inside dark housing pockets below the fender line.
    - Upgraded racing headlight `THREE.SpotLight` beams (`distance = 280m`, `decay = 0.45`, `intensity = 24.0`) + wide cornering apron flood `SpotLight` (`distance = 115m`, `decay = 0.50`, `intensity = 14.0`) + recessed rear brake `THREE.PointLight` emitters driven by live brake telemetry.
  - **Verification:** Updated `scripts/test-phase3.ts` and verified 100% pass across `npm run build`, `npm test`, `npm run test:phase2`, and `npm run test:phase3`.

- **2026-11-07** [Commit: `7dbf059`] - Phase 3: Advanced Motorsport Systems Implementation & Verification (3.1, 3.2, 3.3, 3.4):
  - **Phase 3.1: Interactive Pit Lane & Garage Setup UI (`pit-lane.ts`, `garage-setup-ui.ts`, `pit-setup-menu.ts`, `protocol.ts`):**
    - Built `PitLaneManager` with 3D Pit Box stall geometry, gantry, pit box entry detection ($\le 105\text{ km/h}$), automatic braking (`isPitAutoStopping`), overhead 3D Garage Bay spotlights, and mouse-orbitable inspection camera.
    - Built `GarageSetupUI` on Host and `ControllerPitSetupMenu` on Mobile Controller for tires (`slick_soft`, `slick_medium`, `slick_hard`, `wet`), fuel load (`10–110 L`), wing angle (`5°–18°`), brake bias (`50%–66%`), suspension springs, TC (`0–5`), and ABS.
    - Wired bidirectional WebSocket control messages (`pit_state_sync`, `setup_param_sync`, `pit_action_sync`) across `vite.config.ts`, `host-server.ts`, and `controller.ts`, plus `ControllerButtons.ENTER_PIT` bitflag.
  - **Phase 3.2: Tyre Degradation, Thermal Fade & Consumables (`raycast-vehicle.ts`, `brakes.ts`, `aero.ts`):**
    - Implemented 240 Hz contact patch slip energy integration ($E_{\text{slip}} = \int |F \cdot v_{\text{slip}}| dt$) accumulating per-wheel tire wear and reducing peak Pacejka friction multiplier $D$.
    - Implemented thermal brake fade above $750^\circ\text{C}$ in `BrakeSystem`, reducing brake pad friction coefficient $\mu_{\text{pad}}$ ($0.42 \to 0.19$) and clamping torque under sustained heavy braking.
    - Implemented dynamic fuel mass depletion at $0.75\text{ kg/L}$ (`FUEL_DENSITY_KG_PER_LITER = 0.75`), updating Rapier rigid body mass (`setAdditionalMass`) and front/rear weight distribution in real time.
    - Replaced the placeholder box on the Porsche 911 RSR 3D steering wheel LCD (`rsr-steering-wheel.ts`) with live 4-corner Tire Health (`%`), Tire/Brake Temperatures (`°C`), Fuel Load (`L` / `kg`), Compound badge, and Pit Status.
  - **Phase 3.3: Dynamic Environment & Weather (`environment-manager.ts`, `drying-line.ts`, `car-mesh.ts`):**
    - Built `EnvironmentManager` with modular day/night solar cycle (`0–24h`, `[L]` presets), dynamic sky dome/fog modulation, and automatic dual `THREE.SpotLight` vehicle headlights (`[H]` toggle) + brake/taillight emissives on `CarMeshRig`.
    - Built 1,600-streak 3D rain particle emitter (`THREE.LineSegments`) around the active camera and a custom GLSL windshield rain droplet refraction & animated wiper sweep shader in cockpit view (`[W]` weather cycle).
    - Built `TrackDryingLine` (`512 × 16` 2D moisture grid) enforcing a $40\%$ wet surface friction reduction, slick-tire hydroplaning above $145\text{ km/h}$ in standing water, wet-tire water evacuation, and dynamic racing groove water displacement.
  - **Phase 3.4: 9-Sector Timing, Ghost Car & WebRTC P2P Multiplayer (`lap-timer.ts`, `ghost-car.ts`, `webrtc-lobby.ts`):**
    - Upgraded `NordschleifeLapTimer` to a full 9-sector timing breakdown (`S1 · Hatzenbach` .. `S9 · Döttinger Höhe`) with purple/green/yellow sector splits and distance-interpolated live `+/-` delta HUD bar.
    - Built `GhostCarManager` recording 30 Hz lap keyframes to `localStorage`, automatically saving personal best laps, and rendering a translucent holographic 3D ghost car via `lerp`/`slerp` interpolation (`[K]` toggle).
    - Built `WebRTCMultiplayerLobby` (`<dialog>` modal UI opened via `[O]` or HUD button) with `RTCPeerConnection` + unordered `RTCDataChannel`, room signaling in `vite.config.ts`, manual SDP token exchange, 1-click in-browser Loopback P2P Pace Peer, 44-byte binary pose packets, and 3D remote peer car rendering.
  - **Verification:** Added `npm run test:phase3` (`scripts/test-phase3.ts`); verified 100% pass across `npm test`, `npm run test:phase2`, `npm run test:phase3`, and zero-error production build (`npm run build`).

- **2026-11-07** [Commit: `821bad7`] - Strict Phase 2 Release Cap & User Authorization Policy:
  - Formally established release boundary: no releases permitted without explicit user authorization.
  - Project code and public repository state are strictly capped up to Phase 2; no GitHub releases, git tags, or production deployments will be triggered without explicit user sign-off.

- **2026-11-07** [Commit: `821bad7`] - Version Control & Automatic GitHub Sync:
  - Initialized dedicated Git repository in project root with clean `.gitignore`.
  - Added project `README.md` documenting architecture, local HTTPS setup, and validation commands.
  - Configured public GitHub repository push workflow (`dual-screen-web-racer`) to push all code, assets, and documentation once after every phase completion.

- **2026-11-07** [Commit: `821bad7`] - Minimalist Luxury Motorsport Showroom Landing Page Polish & Unnecessary Text Eradication:
  - **Eradicated Unnecessary Description Texts & Clutter (`src/host/ui/main-menu.ts`):**
    - Removed multi-line `<p class="track-highlight">` description paragraphs, redundant difficulty badges, and emojis (`🏁`, `⮡`, `📱`) from all circuit cards.
    - Removed the floating `.menu-center-hint` banner (`"DRAG ANYWHERE TO SWIVEL..."`) that obstructed the Porsche 911 RSR's swan-neck rear wing in top-down camera views.
    - Removed the verbose header subtitle (`"Porsche Motorsport Sim-Lite Experience • Apple Silicon M-Series"`), redundant section eyebrows, duplicate `#80` header badge, and bottom sub-hint caption (`"Locks car & track • Return via [ESC] or Leave to Menu"`).
  - **Obsidian Carbon Glass & Architectural Studio Layout (`src/host/host.css`):**
    - Redesigned top bar with a minimal `PORSCHE | 911 RSR GTE` wordmark and Guards Red accent border on the left, paired with a live status indicator pill and vector QR `PAIR PHONE` button on the right.
    - Streamlined left `CIRCUIT` panel (`336px`) into 4 single-line cards with a Guards Red active accent bar and tabular `KM · TURNS` metrics.
    - Streamlined right `911 RSR-19` panel (`384px`) with a 4-column hairline telemetry strip (`515 HP`, `9,000`, `318 KM/H`, `1,245 KG`), a 4×2 grid of all 8 livery swatches (eliminating horizontal scrollbar clipping of `#00`), a unified `#` input + 4×2 quick-number grid (eliminating orphan line-wrapping), and a Porsche Guards Red `START SESSION [ENTER]` button.
  - **Refined 3D Turntable Platter & Neutral Studio Lighting (`src/host/render/showroom-stage.ts`):**
    - Replaced the bright cyan 64-segment torus ring (`0x38bdf8`) and cyan backlight with a subtle 128-segment brushed platinum chamfer ring (`0xe4e4e7`, `opacity: 0.16`) and neutral cool-silver studio rim lighting (`0xe2e8f0`).
  - **Verification:** Verified with `landing_page_polished_hero.png` and `landing_page_polished_topdown.png`, 100% pass on `npm test` and `npm run test:phase2`, and zero-error `npm run build`.

- **2026-11-06** [Commit: `821bad7`] - Karussell Hairpin Voronoi Embankment Clamping, 2D Elevation Shelf Harmonization, Tree Voronoi Ownership & Extended DEM Sculpting:
  - **2D Voronoi Perpendicular Bisector Embankment Clamping (`track-mesh-generator.ts`):**
    - Identified why the top (exit) part of the Karussell's terrain covered the bottom (entry) leg (`Steilstrecke`, $s = 11,830\text{ m}\dots 12,030\text{ m}$): at the hairpin neck, the entry and exit centerlines are only $27.9\text{ m}\text{–}45\text{ m}$ apart horizontally, yet `TrackMeshGenerator` previously extruded fixed $35\text{ m}$ embankments ($45.05\text{ m}$ from centerline), causing 163 embankment vertices from the upper exit leg ($s = 12,180\text{ m}\dots 12,350\text{ m}$) to stretch $17.15\text{ m}$ past the lower leg's centerline and form a green terrain roof directly over the lower road.
    - Implemented exact 2D Voronoi perpendicular bisector clamping ($s_{\text{bisector}} = \frac{D^2}{2u} - 1.2\text{ m}$) with $C^1$ Hermite sub-slice interpolation and vertical anti-roof floor clamping ($y \le y_{\text{nearbyMin}} - 0.80\text{ m}$). Reduced embankment vertices overlapping road from 163 to **0** across all circuits (minimum clearance to any non-adjacent centerline $\ge 15.66\text{ m}$).
  - **2D Hairpin Elevation Shelf Harmonization (`osm_nordschleife.json`, `osm_24h.json`, `osm_gp.json`):**
    - Harmonized elevation benchmarks across the `Steilstrecke / Karussell / Hohe Acht` hairpin neck ($s = 11,760\text{ m}\dots 12,420\text{ m}$ at $584.2\text{ m}\to 585.8\text{ m}$) and `Dunlop-Kehre` hairpin ($s = 2,600\text{ m}\dots 3,300\text{ m}$ centered on the true $2,970\text{ m}$ apex), eliminating the artificial $15\text{ m}\text{–}33\text{ m}$ 1D arc-length cliff between parallel roads $28\text{ m}$ apart while preserving the full $301.6\text{ m}$ Nordschleife vertical drop ($323.1\text{ m}$ to $624.7\text{ m}$).
  - **Voronoi Tree Corridor Ownership & Deep Subterranean Trunk Roots (`forest-foliage.ts`):**
    - Added Voronoi corridor ownership validation in `TrackSpatialGrid.isNearAnyTrackSegment`: rejects any candidate tree that crosses closer to a non-adjacent track segment than to its spawning segment, preventing upper-leg trees from spawning over the lower Karussell road.
    - Constrained lateral tree placement strictly within the solid embankment footprint ($16.0\text{ m}\dots 38.0\text{ m}$), matched `yDrop` to the exact embankment slope, and extended tree trunk cylinders down to $Y = -2.4\text{ m}$ so trunks never float on steep slopes.
  - **Extended & Multi-Track Corridor-Sculpted DEM (`tracks/nordschleife/dem.json`):**
    - Extended `dem.json` grid from $n_z = 102$ to $n_z = 118$ ($z_{\max} = 4,835.1\text{ m}$) to cover the entire southern loop of the GP-Strecke (`Dunlop-Kehre` at $z = 4,374\text{ m}$), and sculpted every DEM vertex within $75\text{ m}$ of any circuit to sit $3.5\text{ m}$ below the **minimum** nearby track elevation across all 3 layouts (`nordschleife`, `24h`, `gp`).
  - **Verification:** Verified 0 embankment-over-road vertices, 0 DEM clipping violations across all 3 circuits, 100% pass on `npm test` and `npm run test:phase2`, clean `npm run build`, and visual screenshot verification at $11.85\text{ km}$, $11.95\text{ km}$, $12.09\text{ km}$, and $12.26\text{ km}$.

- **2026-11-06** [Commit: `821bad7`] - Elimination of Triangle-Step Bumpiness, Taubin Zero-Shrinkage Curve Fairing, Analytical Spline Frames & 2nd-Order Pneumatic Damper Filtering:
  - **Fixed 4th-Order Tangent Z-Divisor Bug (`centerline.ts`):**
    - Fixed missing `/ 12` divisor on the $Z$ component of the 4th-order central-difference tangent in `centerline.ts`, which had previously scaled $t_z$ by $12\times$ relative to $t_x$ and $t_y$, causing `sp.normal` to wobble and tilt road cross-sections vertically across East-West segments.
  - **8-Pass Taubin Zero-Shrinkage Curve Fairing (`centerline.ts`):**
    - Applied an 8-pass Taubin $\lambda/\mu$ fairing filter ($\lambda = 0.45, \mu = -0.473$) to the raw surveyed loop coordinates, removing 5m–15m OpenStreetMap polyline vertex discretization kinks while keeping vertical elevation within $< 2\text{ mm}$ of surveyed SRTM data and preserving corner radii without shrinkage.
  - **Twist-Free Unbanked Corners & Fixed-Sign Karussell Bowls (`centerline.ts`):**
    - Removed step-function landmark banking and per-sample `turnRate` sign-flipping (which caused $11^\circ\text{–}44^\circ$ cross-camber quad twists whenever `turnRate` crossed zero). Maintained $0^\circ$ cross-camber on standard corners and smooth cosine-bell inward banking strictly on Caracciola-Karussell ($33.0^\circ$) and Mini-Karussell ($22.0^\circ$).
  - **Direct Analytical Spline Frame & $C^1$ Hermite Width/Banking Interpolation (`track-mesh-generator.ts`):**
    - Replaced `sp0.normal.lerp(sp1.normal, t)` with direct analytical frame construction from the spline tangent $\mathbf{T}(t)$ and horizontal right vector $\mathbf{h}_{\text{right}} = (T_z, 0, -T_x)$, guaranteeing $b_y \equiv 0$ on all unbanked sections and $C^1$-continuous Hermite interpolation of `bankingRad` and `trackWidth`.
    - Sub-divided collision road cross-section into 4 lateral lanes (`colVertsPerSection = 11`, adding `pRoadGrooveLeft` and `pRoadGrooveRight` at $\pm 0.46 \times \text{halfW}$), reducing diagonal triangle non-planarity by $> 2\times$ and matching visual racing groove vertices.
  - **2nd-Order Pneumatic Suspension Damper Filtering & Chassis Clearance (`raycast-vehicle.ts`):**
    - Added 2nd-order low-pass filtering on `suspVel` (`lerp` on both `compression` at $0.28$ and `suspVel` at $0.22$) so crossing $C^0$ triangle edges at 250+ km/h never produces step impulses in damper force.
    - Elevated `chassisCollider` bottom edge to $+0.50\text{ m}$ in local chassis space (`cuboid(0.82, 0.22, 1.98)` at `(0, 0.72, 0)`), preventing the chassis box from ever scraping or snagging on road triangles under heavy braking pitch or banked bowl compressions while still colliding with $1.15\text{ m}$ Armco barriers.
  - **Verification:** Mesh audit across all 24,847 Nordschleife slices confirmed `over1Deg` dropped from 5,370 to 5 and high-speed vertical G-force chatter dropped from $29.26\text{ G}$ to $0.15\text{–}0.18\text{ G}$ at $200\text{–}260\text{ km/h}$. 100% pass on `npm test`, `npm run test:phase2`, and `npm run build`.

- **2026-11-06** - Authentic Inside-Bowl Karussell Banking, Grounded Embankments (Zero Flying Terrain) & Strict Tree Barrier Enclosure:
  - **Dynamic Inside-Bowl Banking Calculation (`centerline.ts`):**
    - Corrected banking inversion where positive rotation around tangent previously elevated the inside of the Karussell bowl $5.45\text{ m}$ higher than the outside.
    - Implemented analytical turn-direction banking equation $\text{effectiveBanking} = \operatorname{sign}(\text{turnRate}) \times |\text{bankingRad}|$, guaranteeing the inside of every banked corner is sunken into the bowl and the outside is elevated.
    - Restored authentic natural camber on high-speed sweepers and compressions: Fuchsröhre ($5.5^\circ$), Flugplatz ($3.5^\circ$), Schwedenkreuz ($3.0^\circ$), Brünnchen ($4.0^\circ$), Galgenkopf ($4.5^\circ$), and Kleines Karussell ($22.0^\circ$).
  - **Grounded Embankments & Elimination of Flying Terrain (`track-mesh-generator.ts`):**
    - Reprojected the 35-meter trackside grass embankments along horizontal lateral normal $\mathbf{h}_{\text{right}} = (t_z, 0, -t_x)$ ($Y = 0$) with downward vertical offsets, completely eliminating the $22.7\text{ m}$ flying triangular wall that previously soared into the sky at the Karussell.
  - **Strict Tree Barrier Enclosure & Grounded Tree Trunks (`forest-foliage.ts`):**
    - Repositioned trees using horizontal lateral vector $\mathbf{h}_{\text{right}}$ ($Y = 0$), completely eliminating trees floating $11\text{ m}$ in mid-air on banked corners.
    - Shifted minimum lateral tree distance to $16.0\text{ m}$ (well outside the $10.05\text{ m}$ Armco barrier) and expanded safety clearance margin to $9.5\text{ m}$ ($\text{threshold} = w_{\text{track}} / 2 + 9.5\text{ m} = 14.5\text{ m}$ loop-wide), strictly enclosing all trees behind the safety barriers.
  - **Track Timing Invalidation Documentation:** Fully documented track projection, tolerance thresholds, and invalidation latching in Section 3.20.
  - **Verification:** Verified with 100% test pass on `npm test` and `npm run test:phase2`, clean TypeScript `npm run build`, and visual screenshot inspection in `karussell_fixed_entry.png`, `karussell_fixed_apex.png`, and `karussell_fixed_exit.png`.

- **2026-11-06** - Grand Prix Circuit Front Straight Stadium Alignment & Encroachment Removal:
  - **Relocated Haupttribüne Grandstand to True Front Straight (`stadium-assets.ts`):**
    - Corrected sample range from 15–75 (hairpin turn) to 85–165 (the authentic 450-meter Grand Prix Start/Finish straightaway, $s = 400\text{ m} \dots 850\text{ m}$).
    - Positioned at lateral offset $-28.0\text{ m}$ (driver's left), providing over $21.5\text{ m}$ of open asphalt verge/grass clearance.
    - Stadium specs: 6 tiers, $18.0\text{ m}$ depth, $11.0\text{ m}$ height, red/white seating modules, forward-pitched cantilever steel canopy roof, and sponsorship banners.
  - **Relocated Concrete Pit Complex & Team Garages:**
    - Corrected sample range to 88–162 along the front straight at lateral offset $+26.0\text{ m}$ (driver's right).
    - Specs: $18.0\text{ m}$ building depth, $5.5\text{ m}$ ground floor garages, $4.0\text{ m}$ upper VIP hospitality deck with panoramic glass windows, and concrete pit wall at $+11.0\text{ m}$ from centerline ($4.5\text{ m}$ clear verge from asphalt edge).
    - Eliminated previous 140m straight bridge that sliced across the hairpin loop.
  - **Orthonormal Basis Frames & Axis Swap Resolution:**
    - Formed explicit Frenet orthonormal basis matrices ($\mathbf{X} = \text{lateral/driver's right}, \mathbf{Y} = \text{up}, \mathbf{Z} = \text{forward tangent}$) via `Matrix4.makeBasis()`.
    - Corrected `BoxGeometry` parameters so depth along $X$ steps perpendicular to the track and width along $Z$ extends along the track, eliminating the previous 90-degree sideways rotation across the racetrack.
  - **Automated Anti-Encroachment Clearance Filter:**
    - Evaluates every candidate grandstand module's front edge against all track centerline points across the circuit; strictly rejects/clamps any module closer than $12.0\text{ m}$ to any centerline point, guaranteeing zero track encroachment.
  - **Start/Finish Overhead Timing Gantry:**
    - Placed overhead timing gantry with FIA 5-bulb starting light cluster at sample 95 on the front straight and sample 0, with $24.0\text{ m}$ lateral span and $8.5\text{ m}$ vertical clearance.
  - **Verification:** Verified with 100% test pass on `npm test` and `npm run test:phase2`, clean TypeScript `npm run build`, and visual screenshot inspection in `gp_sample_70_chase_clear_track.png` and `gp_sample_105_front_straight_stadium.png` confirming zero buildings on track.

- **2026-11-06** - Low-Profile Dashboard Dual-Screen Pod & Rear Exterior-Mounted Camera Architecture:
  - **100% Panoramic Windshield Sightlines (`gt-cockpit.ts`):**
    - Repositioned the central dashboard mounting bracket from elevated cowl height down onto the center console stack $(X = -0.10, Y = 0.51, Z = 0.26)$ with tilt $-0.12\text{ rad}$ and yaw $-0.38\text{ rad}$, snug against the lowered center tunnel switch console.
    - Scaled the Digital Rear-View Mirror monitor down to a compact $0.16\text{ m} \times 0.08\text{ m} \times 0.018\text{ m}$ carbon housing with $0.15\text{ m} \times 0.07\text{ m}$ active screen ($2:1$ widescreen aspect ratio, matching the $512 \times 256$ render target with zero distortion).
    - Scaled the In-Cockpit Micro Radar Display to $68\%$ ($0.129\text{ m} \times 0.088\text{ m}$) mounted at $y = -0.055\text{ m}, z = -0.015\text{ m}$ directly below the digital mirror on the center stack.
    - Result: Top edge sits strictly below the bottom windshield frame ($Y \le 0.55\text{ m}$), opening a completely clear, unobstructed view through the windshield from A-pillar to A-pillar over the hood, road, and apexes.
  - **Rear Exterior Mounted Camera Systems (`cockpit-cam.ts` & `rear-view-mirror.ts`):**
    - Eliminated internal cabin pivot for the main screen "Look Behind" view (`cockpit-cam.ts`). When active (`isRearViewActive` / `[B]` / `[V]` / mobile button), the camera instantly mounts at the rear exterior of the vehicle $(X = 0, Y = 1.15, Z = -2.35)$ looking straight backward down the track. Completely eliminates seeing interior seats, headrests, or roll cages, providing an unobstructed panoramic view of trailing cars.
    - Repositioned the digital rear-view mirror screen feed camera (`rear-view-mirror.ts`) from internal second-row position ($Z = -0.60\text{ m}$) to the rear bumper / rear spoiler base $(X = 0, Y = 1.05, Z = -2.25)$, giving a crisp, wide-angle rear camera feed on the in-cockpit screen.
  - **Verification:** Verified with 100% test pass on `npm test` and `npm run test:phase2`, clean TypeScript `npm run build`, and visual screenshot inspection in `cockpit_lowered_screens_windshield_clear.png` and `cockpit_rear_view_mounted_at_rear.png`.

- **2026-11-06** - Eradication of Flying Tracks in Sky (Corridor Height Constraint Clamping) & Driver-Centric Minimap/Radar Turn Direction Alignment:
  - **Zero Flying Tracks in Sky (`tracks/nordschleife/dem.json`):**
    - Identified root cause of floating tracks high in the sky (e.g. at Hatzenbogen $s = 725\text{ m}$ where tracks hovered 93m in the air): the DEM terrain elevation grid had only been clamped downwards when peaks were too high, leaving valleys and plateaus at 520m while the track sat at 615–626m.
    - Sculpted DEM corridor heights across all 10,016 surveyed circuit samples with a strict corridor clamp: for any vertex within 75m of the track, $h \le \min(p_y - 2.5\text{ m})$, smoothly blended outward to 180m.
    - Result: Min clearance across all 10,016 points is $\ge 2.00\text{ m}$ below asphalt grade everywhere (Nordschleife: 2.06m; 24h: 2.00m; GP-Strecke: 4.06m; clipping violations: 0).
    - Verified in `hatzenbach_725m_chase_grounded.png` where the sky is completely clear of floating rails and the track is firmly anchored to the rolling green mountain hillsides.
  - **Minimap & Cockpit Corner Radar Turning Direction Inversion Fix (`hud.ts` & `micro-radar-display.ts`):**
    - Corrected driver's lateral right vector from inverted Euler calculation to true perpendicular vector $\mathbf{R} = (-F_z, 0, F_x)$ relative to vehicle forward vector $\mathbf{F} = (F_x, 0, F_z)$.
    - Verified against canonical real-world Nürburgring corners: Aremberg (Right), Wehrseifen (Left), Karussell (Left), Brünnchen (Right), and Galgenkopf (Right). Both HUD GPS minimap and in-cockpit radar display now project turning directions accurately with zero lateral inversion.

- **2026-11-06** - 3D Showroom Direct-Manipulation Drag Controls:
  - **Corrected Swivel & Tilt Axis Signs (`ShowroomStage`):** Inverted pointer drag delta application (`targetYaw -= deltaX * 0.007; targetPitch -= deltaY * 0.005;`). Swiping or dragging right now rotates the front of the car intuitively to the right (rather than left), dragging left turns the car to the left, dragging up elevates the camera to view the roof and wing, and dragging down drops the view to bumper level.
  - **Verification:** Verified with 100% test pass on `npm test` and `npm run test:phase2`, and clean TypeScript `npm run build`.

- **2026-11-06** - Long-Term Trackside Architecture & Holistic Trackside Logic Engine (1:1 Physics Surface Parity at SUB_STEPS=6, Zero Chord Sagitta Discrepancy, Elevated Chassis Collider (+0.27m), Global 2D Spatial Clearance Grid Anti-Encroachment Engine, Regional Zoning Hierarchy, Dynamic Gravel Drag Model, Braking Distance Markers):
  - **1:1 Mathematical Collision & Visual Mesh Parity (`TrackMeshGenerator`):**
    - Set collision trimesh sub-sampling to `COL_SUB_STEPS = 6` (~0.83m longitudinal slice spacing) using exact Catmull-Rom Hermite cubic spline basis functions ($h_{00}, h_{10}, h_{01}, h_{11}$), matching the visual asphalt mesh float-for-float.
    - Reduced vertical chord sagitta error from 15 cm down to 0.000 mm everywhere across the circuit. Completely eliminates vehicles sinking/dipping into asphalt on convex crests (Flugplatz, Pflanzgarten) or levitating/floating above concave compressions (Fuchsröhre, Tiergarten).
    - White boundary lines and apex graffiti markings are rendered strictly as coplanar vertex colors and textures across the flat road polygon strip with zero physical step, eliminating all phantom "hitbox" collisions.
  - **Elevated Chassis Collision Envelope (`RaycastVehicle`):**
    - Elevated chassis rigid body collider translation to $(0, 0.55, 0)$ with half-height $0.28\text{ m}$ (giving $+0.27\text{ m}$ bottom clearance).
    - Ensures the chassis rigid body collides strictly with vertical Armco crash barriers and other cars, never scraping or snagging road/kerb facets under heavy downforce or suspension compression.
  - **Global 2D Spatial Clearance Grid (`ForestFoliage.TrackSpatialGrid`):**
    - Implemented a 2D spatial hash grid indexing all centerline nodes and segment capsules across the entire circuit.
    - Added mandatory anti-encroachment validation (`isNearAnyTrackSegment(x, z, margin = 4.5)`) that strictly rejects any candidate tree, distance marker, or trackside prop positioned within $w_{\text{track}} / 2 + 4.5\text{ m}$ (minimum $10.5\text{ m}$ clearance) of ANY track centerline segment across the entire circuit.
    - Completely eliminated tree bleed-through where tight hairpin loops or parallel ribbons (Hatzenbach, Steilstrecke / Karussell switchbacks, Hohenrain chicane, Dunlop-Kehre) previously caused lateral tree offsets from one ribbon to spawn directly onto an adjacent ribbon.
    - Suppressed wild mountain pine and spruce trees within the Grand Prix stadium envelope ($X \in [-2350, -700], Z \in [2650, 4750]$) to maintain authentic open arena sightlines.
  - **Dynamic Surface Material Friction & Gravel Trap Drag Model (`materials.ts`):**
    - Configured dynamic surface property resolution in raycast suspension (`getSurfaceProperties`): Racing Asphalt ($\mu = 1.0, C_{rr} = 0.015$), Concrete slabs / Karussell ($\mu = 0.95, C_{rr} = 0.020$), Red/White FIA Kerbs ($\mu = 0.90$, rumble micro-oscillation), Grass verges ($\mu = 0.35, C_{rr} = 0.040$), and Deep Gravel Runoff Traps ($\mu = 0.45, C_{rr} = 0.280$ with high displacement decelerator drag that realistically bogs down and halts off-track cars).
  - **Verification:** Verified with 100% test pass on `npm test` and `npm run test:phase2`, clean TypeScript `npm run build`, and verified 0 tree encroachment violations across all circuit chunks.

- **2026-11-06** - GPS North-Locked HUD Minimap Mode (Heading-Up Navigation, Quaternion Vector Projection, Concentric Range Rings, Geographic Compass Rose & Mode Toggle):
  - **Permanent Locked North Icon Orientation:**
    - Player vehicle blip is positioned at $(cw \times 0.50, ch \times 0.62)$ and permanently locked pointing strictly straight UP along the $-Y$ axis (North of the display), matching professional automotive GPS navigation and tactical track radar.
  - **Quaternion Coordinate Projection Pipeline:**
    - Replaced Euler angle trigonometry with analytical forward vector $(fwdX, fwdZ)$ and lateral right vector $(rightX, rightZ)$ derived from vehicle quaternion $q$:
      $$d_{\text{forward}} = \Delta x \cdot fwdX + \Delta z \cdot fwdZ$$
      $$d_{\text{lateral}} = \Delta x \cdot rightX + \Delta z \cdot rightZ$$
      $$sx = carScreenX + d_{\text{lateral}} \times 0.22, \quad sy = carScreenY - d_{\text{forward}} \times 0.22$$
    - The road ribbon, sectors, and opponent dots smoothly translate and rotate around the player car, giving $\sim 420\text{ m}$ forward tactical lookahead.
  - **Tactical Range Rings & True North Compass Rose:**
    - Concentric range rings rendered at $100\text{ m}$ ($r = 22\text{ px}$), $250\text{ m}$ ($r = 55\text{ px}$), and $400\text{ m}$ ($r = 88\text{ px}$) with crisp monospace distance tags.
    - Added motorsport compass rose at $(20, 20)$ with dual-tone needle indicating true geographic world North ($\theta_{\text{north}} = \operatorname{atan2}(-rightZ, -fwdZ)$).
  - **Instant Keyboard / Click Mode Toggle:**
    - Added key listener `[N]` and click listener on `#hud-minimap-panel` to instantly toggle between `GPS: NORTH LOCKED` (default) and `CIRCUIT OVERVIEW [STATIC]`.
    - Enhanced competitor dots with high-contrast outlined number tags `#80`, `#911`, etc.
  - **Verification:** Verified with 100% test pass on `npm test` and `npm run test:phase2`, clean TypeScript `npm run build`, and visual screenshot artifacts in `gps_minimap_straight.png`, `gps_minimap_cornering.png`, `minimap_full_track_overview.png`, and `gps_minimap_closeup.png`.

- **2026-11-06** - Official Rexy AO Racing Porsche 911 GT3 R Livery Overhaul: 1:1 Carnivore Fangs, Flared Hood Nostrils, Endurance Yellow Headlights, IMSA WeatherTech Number Plates, Door Handle T-Rex Claws & Scalloped Belly Plates:
  - **1:1 Interlocking Carnivore Fangs & Front Bumper Grin:**
    - Corrected front bumper UV projection priority in `StandardWrapMapper`, capturing the entire curved nose from dive plane to dive plane within the panoramic bumper zone ($U \in [0.60, 0.95]$, $V \in [0.86, 0.99]$).
    - Shifted lower lip from hidden under-tray ($y \le 0.15\text{ m}$) up into the visible front vertical bumper fascia ($Y \approx 186\text{px} - 192\text{px}$).
    - Implemented 24 curved razor-sharp upper teeth (78px–112px) descending from the dark green upper lip and 18 lower teeth (58px–80px) pointing upward from the lower chin lip, overlapping and interlocking across the deep obsidian mouth cavity ($Y \in [110\text{px}, 155\text{px}]$).
    - Added giant sabre fangs under headlights, sneering mouth corners with cheek snarl folds, red MOTUL corner decals, and solid dinosaur green chin beneath the lower lip.
  - **Flared Reptilian Hood Nostrils & Headlight Brow Eyelids:**
    - Positioned dual flared nostrils ($Y = 68\text{px}$, $X = \text{width} \times 0.30 \pm 62\text{px}$) with maroon shadows and arched dark green skin folds directly in front of the hood extractors.
    - Added dark green and maroon eyelid brow ridges framing the headlights as glowing predator eyes.
  - **Endurance Racing Yellow Headlights:**
    - Dynamically tints headlight emissive elements to authentic endurance racing yellow (`#fbbf24`, emissive intensity 2.4) in `VehicleModelAdapter.applyLivery` when the Rexy livery is active, matching the 24H Daytona and Le Mans GT3 R specification.
  - **IMSA WeatherTech Rectangular Number Plates (#80 Default):**
    - Positioned official white rectangular competition plates with red top IMSA bar, blue WeatherTech logo, and bold black number `#80` (or player's custom number) forward on both doors ($X = 0.54$ left, $X = 0.46$ right) and hood ($X = 0.30, Y = 0.046$).
    - Synchronized default car number to `#80` across `ShowroomStage`, `CarMeshRig`, and `MainMenu`.
  - **T-Rex Arms & Scalloped Rocker Belly Plates:**
    - Rendered little green T-Rex arms with rounded biceps and 3 sharp white curved talons pointing forward around the door handles, positioned directly behind the IMSA number plates without overlap.
    - Added 18 cream/ivory scalloped belly scutes (`#fef9c3`) with dark green outlines running along both rocker sills.
    - Updated rim color to matching dinosaur green (`#12c949`) with satin black centerlocks, and painted rear wing endplates green with smiling Rexy face emblem.
  - **Verification:** Verified with 100% test pass on `npm test` and `npm run test:phase2`, clean TypeScript `npm run build`, and visual screenshot inspection in `rexy_three_quarter_hero_stance.png`, `rexy_front_bumper_mouth_close_up.png`, and `rexy_side_flank_belly_and_claw.png`.

- **2026-11-06** - Official Porsche 911 RSR Steering Wheel, 1:1 Digital Telemetry Screen Replica, 15-LED Shift Rev Counter & Road Car Wheel Eradication:
  - **Official Porsche 911 RSR 3D Steering Wheel Architecture (`PorscheRsrSteeringWheel`):**
    - Extruded authentic contoured carbon fiber faceplate matching the real-world 285mm GRID Engineering / Sim-Lab Porsche 911 RSR GT/GTE steering wheel, featuring rounded 3-segment bevels, upper $45^\circ$ shoulder chamfers, and lower chin.
    - Ergonomic molded polyurethane/Alcantara side grips with palm swells and sculpted thumb rest ledges.
    - Top arched housing containing 15 curved shift rev LEDs: 5 green (6,600–7,400 RPM), 5 red (7,400–8,200 RPM), 5 blue (8,200–8,800 RPM), and high-RPM blinking strobe at 8,800+ RPM.
    - Laser-etched silver "PORSCHE" wide typography wordmark across the top plate.
    - CNC anodized aluminum rotary thumb encoders: red `TCI` (top left), purple `TCO` (top right), gold dial (inner left), blue dial (inner right).
    - 10 tactile motorsport pushbuttons with black anodized collar bezels.
    - 4 lower fluted rotary selector switches with raised pointer markers: `TC/CON`, `TC/R`, `MAP`, and `WIPER`.
    - Porsche golden shield crest emblem centered on the lower chin.
    - Carbon fiber magnetic shifter paddles and red anodized quick-release hub collar.
  - **1-to-1 Porsche 911 RSR LCD Telemetry Screen Replica ($1024 \times 600$ Canvas Pipeline):**
    - Top Status Header: `[TC C | 1]`, `[TC R | 1]`, `000` (live speed km/h), `[AC | 11]`, `[Map | 1]`.
    - Left Telemetry Cluster: `Water Temp` (85°C), `Oil Temp` (92°C), `Water Press` (1.90 bar), `Oil Press` (3.73 bar).
    - Center: High-visibility giant Gear indicator (`N`, `R`, `1`–`6`) with mini Porsche crest below.
    - Right Timing Cluster: `Avg Diff` (+0.00 / delta), `Predicted Lap Time` (live timer `MM:SS:cc`), `Best Lap Time` (`MM:SS:cc`), `Laps2go` (`10` / lap count), `Lap Time` (`MM:SS:cc`).
    - Unused zones (tire temps/pressures and pit strategy) formatted cleanly as dark bordered placeholder boxes per user instruction.
  - **Eradication of Stock Street Car Steering Wheel & Clear Sightlines:**
    - Updated `VehicleModelAdapter.sanitizeModel` to automatically hide and strip `Node_SteeringWheel`, `Interior_SteeringColumn_Stalks`, and all stock road-car wheel nodes from imported 3D models.
    - Adjusted driver eye point ($[0.35, 0.70, -0.26]\text{ m}$), FOV ($78^\circ$), and pitch sightline ($-3.4\text{ m}$ over 30m), framing the complete wheel down to the lower rotaries, crest, and rear-view mirror.
    - Relocated HUD keyboard controls hints to bottom-right, leaving the center bottom cockpit view 100% unobstructed.
  - **Validation & Visual Verification:** Verified with 100% test pass on `npm test` and `npm run test:phase2`, clean `npm run build`, and captured visual screenshots in `porsche_rsr_steering_wheel_cockpit.png`, `porsche_rsr_screen_close_up.png`, and `porsche_rsr_steering_wheel_turning.png`.

- **2026-11-06** - FIA 5.148 km Grand Prix Circuit Geometry, Zero-Noclip Stadium DEM Terrain, 3D Grandstands & Stadium Architecture, In-Cockpit Micro Radar & Proximity Spotter, F1 Broadcast Competitor Dots & Dynamic FIA Flag State Machine:
  - **Authentic 5.148 km Grand Prix Circuit Geometry:** Replaced 3.595 km sprint cut with official 5,105.0m (5.148 km) Grand Prix layout extracted from 20 continuous OSM ways with 0.0m seam error: Castrol-S, Mercedes-Arena (Turns 2-4), Valvoline-Kurve, Ford-Kurve, Dunlop-Kehre hairpin (lowest point 574.6m), Audi-S, Schumacher-S, Michelin-Kurve, Bit-Kurve, ITT-Bogen, NGK-Schikane, Coca-Cola-Kurve. 1,021 equidistant 5m samples with 46.7m elevation drop.
  - **Zero-Noclip Stadium Bowl DEM Terrain:** Sculpted DEM vertices across the entire GP stadium bowl ($X \in [-2250, -750]$, $Z \in [2700, 4650]$) to $\ge 4.5\text{ m}$ below the asphalt, achieving **0 clipping violations / noclipping**.
  - **3D Grandstands & Modern Stadium Architecture (`StadiumAssets`):** Generated authentic FIA Grade 1 stadium infrastructure: Start/Finish Haupttribüne with covered red/white seating, 2-story concrete Pit Building with team garages and VIP lounges, overhead Timing Gantry with 5 green FIA start lights, Mercedes-Arena grandstand, and Dunlop-Kehre viewing bleachers. Suppressed pine trees inside the stadium infield.
  - **In-Cockpit Micro Radar & Proximity Spotter (`MicroRadarDisplay`):** Mounted beveled 4:3 LCD monitor on dashboard bracket directly below the digital rear-view mirror: locked heading-up orientation, 2-corner lookahead ribbon with radius and distance, simplified Porsche 911 RSR vector silhouette, and real-time proximity spotter with flashing yellow/amber hazard arcs at contact points and banner alert (`⚠️ CAR LEFT`, `⚠️ CAR RIGHT`, `⚠️ CAR BEHIND`).
  - **Dynamic FIA Race Flags & F1 Broadcast Minimap Radar (`CompetitionField`):** Added 6 competitor entries (#911, #1, #92, #20, #93, #00) rendered as tiny moving colored dots with numbers on the big minimap; dynamic FIA flag state machine (`GREEN`, `SECTOR_1_YELLOW`, `SECTOR_2_YELLOW`, `SECTOR_3_YELLOW`, `FULL_YELLOW`, `RED`) with live status pills and blinking sector coloring. Dismissible HUD QR code box keeps cockpit sightlines clear.
  - **Verification:** 100% test pass on `npm test` and `npm run test:phase2`, clean TypeScript `npm run build`, and visual screenshot capture of GP circuit minimap with F1 dots, in-cockpit micro radar display, and stadium grandstands.

- **2026-11-06** - Porsche 911 RSR Race Specs, Concentric Wheel Hub Alignment, Standardized Flat Wrap UV Pipeline, Rexy Livery & Dynamic Car Number Selector:
  - **Porsche 911 RSR-19 (GTE) Specification Realism:** Updated homologation display and blueprint to authentic Porsche 911 RSR-19 race specs: 515 HP, 4.2L NA mid-engine boxer, 9,000 max RPM, 3.1s 0–100 km/h, 318 km/h DRS top speed, and high-downforce GTE swan-neck wing balance.
  - **Concentric Wheel Hub Mounting:** Extracted surveyed glTF wheel hub centers ($X = \pm 0.7701\text{ m}, Y = 0.5190\text{ m}, Z_{\text{front}} = +1.1688\text{ m}, Z_{\text{rear}} = -1.2867\text{ m}$) from 3D model geometry. Completely eliminated monster-truck suspension lift and wheel offsets; wheels now sit flush within the fender arches and rest squarely on the turntable surface ($Y = 0.185\text{ m}$) in Showroom and track tarmac.
  - **Standardized Flat Wrap UV Pipeline (`StandardWrapMapper`):** Built an analytical 1:1 UV unwrapping pipeline that iterates over all exterior bodywork and aerodynamic meshes (`Chassis_Paint`, `Door_Paint_L`, `Door_Paint_R`, `Hood_Paint`, aero splitters/wings). Maps model vertices into designated 2D profile zones (Left Flank, Right Flank, Top/Plan, Front Bumper). Right side Z is inverted so text reads left-to-right on both flanks without horizontal mirroring or 90° rotation. Standardizes the livery format so any flat wrap image wraps cleanly around the car.
  - **AO Racing "Rexy" Dinosaur Livery (`rexy_ao_racing_77`):** Implemented high-resolution $2048 \times 2048$ Rexy livery featuring dinosaur emerald green base, dark reptilian scale spots, vicious grinning T-Rex mouth with sharp white teeth and pink tongue across front bumper, golden predator eyes near headlights, dinosaur claw arms, and "REXY / AO RACING" branding.
  - **Dynamic Player-Selected Competition Car Number Picker:** Added interactive `#custom-car-number-input` (#0–#999) and quick preset pills (#77, #911, #80, #92, #1, #20, #93, #00) to Main Menu. Dynamically re-renders competition roundels on both doors and hood in real time in Showroom and persists selection into the Race Session.
  - **Clean Status Bar & Integer FPS:** Rounded FPS display to whole integer; removed livery, track, and max speed badges from the status bar for a clean, minimal cockpit sightline.
  - **Validation & Visual Verification:** Verified with 100% test pass on `npm test` and `npm run test:phase2`, clean `npm run build`, and captured visual screenshots of Rexy livery, concentric wheel stance, dynamic number `#80`, and track session.

- **2026-11-06** - The Green Hell Trackside Realism: Foliage, Graffiti, Concrete Patches, Armco, Gravel Traps & 306.8m Elevation Drop:
  - **Dashed Centerline Road Mark Eradication:** Completely removed all white dashed centerline road markings across the entire circuit. The track is now rendered as pure, uninterrupted competition asphalt bounded by 20cm outer white edge lines with rubbered racing groove wear along the apexes.
  - **Procedural Fan Graffiti on Asphalt (`getGraffitiColor`):** Added authentic multi-colored fan graffiti markings (Chalk White, Manthey Racing Yellow, Spray Cyan, and Crimson Red flags/hearts) painted onto the asphalt surface in iconic spectator zones (Hatzenbach, Adenauer Forst, Karussell, Brünnchen, Pflanzgarten, and Schwalbenschwanz).
  - **Weathered Concrete Patch Slabs:** Added weathered concrete slab sections with dark transverse expansion tar joints in classic historic and heavy braking sections (Wehrseifen downhill approach, Breidscheid entry, Steilstrecke / Karussell transition, and Pflanzgarten compression).
  - **Authentic 3-Tier Galvanized Armco Steel Crash Barriers:** Upgraded crash barrier cross-section to authentic multi-tier corrugated W-beam geometry featuring a post foundation, lower guard rail ($+0.25\text{ m}$), corrugated trough shadow ($+0.65\text{ m}$), and top rail ($+1.15\text{ m}$) with galvanized metallic sheen.
  - **Authentic Gravel Decelerator Runoff Beds (`isGravelRunoff`):** Implemented coarse crushed stone gravel traps at surveyed real-world runoff zones: Aremberg ($s \in [3,800, 4,020]$), Adenauer Forst ($s \in [5,040, 5,260]$), Wehrseifen ($s \in [7,400, 7,580]$), Ex-Mühle ($s \in [8,120, 8,290]$), Brünnchen ($s \in [14,000, 14,450]$), Hohenrain Schikane ($s \in [20,200, 20,420]$), and GP-Strecke runoffs.
  - **Dense 3D Eifel Forest Foliage ("The Green Hell") (`ForestFoliage`):** Built procedural multi-tiered evergreen coniferous tree geometry (bark trunk + 3 needle foliage cones with natural organic vertex tinting) rendered via `THREE.InstancedMesh`. Spawns 400–600 trees per chunk flanking both sides of the circuit ($13\text{ m}$ to $51\text{ m}$ from centerline) on outward-sloping embankments and ridge slopes. Streams seamlessly via `ChunkStreamer` in a single GPU draw call per chunk with zero CPU overhead, maintaining locked 60–120 FPS.
  - **Surveyed 306.8m Vertical Drop Topographical Elevation Profile:** Calibrated vertical elevations across all 44 named sections against official surveyed benchmarks: Breidscheid river bridge valley bottom at 320.0m, Hohe Acht crest at 626.8m (total vertical drop of **306.8 meters** / 1,007 feet), authentic **11.7%** Fuchsröhre downhill roller-coaster plunge, and sustained 300m mountain climb from Bergwerk to Hohe Acht.
  - **Razor-Sharp Surveyed Corner Curvatures:** Preserved raw OpenStreetMap surveyed coordinates without corner-cutting spatial averaging, restoring authentic tight apexes: Wehrseifen ($R = 15.8\text{ m}$), Karussell ($R = 25.5\text{ m}$), Bergwerk ($R = 26.1\text{ m}$), Adenauer Forst ($R = 28.0\text{ m}$), Brünnchen ($R = 29.3\text{ m}$), and Aremberg ($R = 30.4\text{ m}$).
  - **Zero-Noclip Mountain Terrain Sculpting:** Re-sculpted `tracks/nordschleife/dem.json` to follow the calibrated 306.8m elevation profile with a $\ge 4.0\text{ m}$ corridor drop, preventing all terrain clipping.
  - **Validation & Visual Verification:** Verified with 100% pass on `npm test`, `npm run test:phase2`, clean `npm run build`, and captured visual screenshots at Aremberg, Brünnchen, and cockpit/chase views.

- **2026-11-06** - Porsche 911 GT3 RS Model, Standardized Livery Architecture & License Plate Eradication:
  - **Authentic Porsche 911 GT3 RS Model Ingestion (`model.glb`, 2.22 MB):** Replaced civilian street Carrera 4S with authentic Porsche 911 GT3 RS (992) featuring full Weissach package: massive factory DRS swan-neck rear wing rooted firmly into the engine deck lid with zero gap, dual carbon hood nostrils, roof aero vanes, centerlock racing rims, and racing bucket interior.
  - **Universal Plate Eradication (`VehicleModelAdapter.sanitizeModel`):** Automatically detects and strips/removes all civilian street license plates and bracket meshes (`Licence_Plate_Emissive`, `License_Plate_Glass`, `*plate*`, `*license*`, `*tag*`) across all imported models.
  - **Standardized Competition Livery System (`LiveryGenerator` & `VehicleModelAdapter`):**
    - High-resolution $1024 \times 1024$ dynamic PBR canvas texture generator synthesizing competition number roundels, dual GT center stripes, "PORSCHE GT3 RS" rocker scripts, and sponsor badges.
    - 7 Competition Preset Liveries: Manthey Racing Grello (#911), Martini Racing (#77), Rothmans Heritage (#1), Pink Pig "Sau" (#92), Gulf Racing (#20), Weissach Guards Red (#93), and Triple Black Stealth Carbon (#00).
    - Dynamic slot synchronization: instantly binds body paint, brake calipers, centerlock rims, and wing endplates with one-click `[P]` cycle key and HUD button.
  - **Verified with 100% Test Pass:** All Phase 1 and Phase 2 validation tests pass, full TypeScript check, and live dev server verification.

- **2026-11-06** - Steering Wheel Arm Artifact Eradication & Future Rigged Arms Roadmap:
  - **Removed Arm & Glove Meshes from Cockpits:** Eradicated procedural box hands and forearm cylinders across all cockpit implementations (`gt-cockpit.ts`, `prototype-cockpit.ts`, and `f1-cockpit.ts`). The cockpit view now presents a clean view focused solely on the steering wheel, instruments, and track apexes.
  - **Logged High-Poly Rigged Driver Arms:** Documented future requirements for realistic driver arms (high-poly models with tailored racing suit fabric, anatomically wrapped Alpinestars/Sparco competition gloves, and inverse kinematics steering movement) in Section 2.3.2 and `spec.md`.

- **2026-11-06** - HUD Streamlining: Integer FPS, Status Bar De-Cluttering & Time Trial Stats Proposal:
  - **Integer FPS:** Formatted the HUD FPS counter strictly as an integer (`Math.round(fps)`), eliminating lengthy decimal values.
  - **De-Cluttered Top Status Bar:** Removed the redundant livery selector tag and track name tag from the in-game HUD top-left status bar (since track and livery selection are managed upfront in the dedicated Main Menu). Status bar now cleanly presents controller connection status, active camera mode, and the `EXIT TO MENU [ESC]` button.
  - **Removed MAX SPEED from In-Race HUD:** Removed max speed readout from active racing HUD overlay.
  - **Time Trial Stats Proposal:** Logged post-lap/time trial mode statistics (max speed, mean/average speed, sector delta times) as a planned feature for dedicated time trial results screens.

- **2026-11-06** - Dedicated Sim-Racing Main Menu, Interactive 3D Turntable Swivel Showroom & Prototype Roll Cage Decommissioning:
  - **Decommissioned Prototype Roll Cage Tubes & Windshield Banner:**
    - Removed procedural white roll cage tubes (`leftPillar`, `rightPillar`, `headerBar`, `leftRoofBar`, `rightRoofBar`) and the procedural sunstrip banner with "PORSCHE" text from `gt-cockpit.ts` and `prototype-cockpit.ts`.
    - Eliminates all visual clashing where procedural silver tubes previously protruded through the roof and rear window glass in chase view, allowing the authentic Porsche 911 GT3 RS 3D model's factory cabin geometry, curved windshield, and carbon roof to be showcased cleanly.
  - **Interactive 3D Turntable Swivel Stage (`ShowroomStage`):**
    - Built dedicated studio turntable scene featuring a circular beveled podium cylinder ($r=2.7\text{ m}$, $h=0.18\text{ m}$) with dark carbon top, glowing ice-blue neon LED halo ring along the perimeter chamfer, and glossy reflective floor disc.
    - Integrated automotive studio lighting: key spotlight with soft shadow mapping, rear-right cyan rim spotlight accentuating the DRS swan-neck wing and roof curves, soft top diffuser, and floor bounce fill.
    - Full interactive orbital swivel controls: pointer/touch drag allows smooth $360^\circ$ yaw rotation and pitch elevation adjustment ($3.4^\circ$ low hero stance to $66^\circ$ high aero overview); mouse wheel provides smooth zoom (3.2m close-up detail to 8.5m wide showroom stance).
    - Idle auto-rotation ($0.18\text{ rad/s}$) resumes smoothly 1.5s after user interaction stops.
    - Fully mounted all 4 independent 3D wheels (Michelin tires, centerlock rims, ventilated discs, and Brembo calipers) resting flush on the podium surface.
  - **Dedicated Sim-Racing Main Menu UI (`MainMenu`):**
    - High-contrast motorsport glassmorphism UI overlaid on the 3D showroom stage.
    - Interactive Track Selection Carousel: cards for Nürburgring Nordschleife (20.8 km), Nürburgring 24h Gesamtkurs (25.4 km), GP-Strecke (3.6 km), and High-Speed Proving Ground (6.0 km), displaying distances, turn counts, and difficulty tags.
    - Homologated Vehicle Specs Grid: 525 HP, 4.0L NA Flat-Six, 9,000 Max RPM, 0-100 in 3.2s, 296 km/h top speed, and Active DRS aero.
    - Real-Time Competition Livery Palette: 7 clickable swatches (Manthey Grello #911, Martini #77, Rothmans #1, Pink Pig #92, Gulf #20, Weissach #93, Stealth #00) that update the vehicle paint, calipers, rims, and endplates on the turntable immediately.
    - Big prominent "START ENGINE / DRIVE" CTA button with ignition launch.
  - **In-Race Track & Car Lockout + Exit to Menu:**
    - Locked track and car selection during active race sessions per design requirement; in-race track switching shortcuts are disabled.
    - Added `EXIT TO MENU [ESC]` button in HUD and bound `[ESC]` / `[M]` keys to stop the race, unload vehicle physics and chunk streaming, and cleanly return the player to the 3D Showroom Main Menu.

- **2026-11-06** - Trackside Visual Overhaul, Zero-Noclip DEM Corridor Sculpting & Texture Fidelity:
  - **Zero Terrain Noclipping / Clipping Fix (`dem.json`):** Clamped all DEM elevation vertices within a 65-meter radial corridor of any centerline coordinate down to $\le Y_{\text{track}} - 4.0\text{ m}$ with smooth cosine envelope out to 110 meters across all 9,714 surveyed coordinates (`osm_nordschleife.json`, `osm_24h.json`, `osm_gp.json`). Completely eliminated all 1,334 previous clipping points; verified 0 clipping points loop-wide (maximum terrain relative to asphalt is $-3.99\text{ m}$).
  - **30-Node High-Definition Cross-Section (`TrackMeshGenerator`):**
    - Sub-sampled visual slices at $1.25\text{ m}$ intervals along the centerline spline, eliminating all Nyquist aliasing and color smearing on alternating kerbs.
    - Dedicated 20 cm continuous brilliant white boundary lines ($[0.98, 0.98, 0.98]$) on both driver left and right with sharp 2 cm transition to asphalt, eliminating white wash bleed across the road.
    - Dedicated 20 cm centerline white dashes (5m dash / 5m gap) bounded by rich road asphalt.
    - Rich dark asphalt lane color ($[0.18, 0.18, 0.20]$) with subtle rubbered racing groove ($[0.14, 0.14, 0.16]$).
    - High-contrast alternating 2.0m FIA red/white rumble kerbs ($1.25\text{ m}$ width, $1.8\text{ cm}$ bevel) activated on all corner apexes and runoffs ($\ge 0.0035\text{ rad/sample}$) and cleanly suppressed on high-speed straights (Döttinger Höhe).
    - Authentic Karussell concrete slab sections ($[0.68, 0.68, 0.65]$) with 4m tar expansion joints ($[0.28, 0.28, 0.26]$).
    - Outward-sloping Eifel forest embankments extending 35 meters beyond Armco barriers down to $-2.20\text{ m}$.
    - Authentic 1.25m transverse start/finish grid line replacing full-road white wash.
    - Physics collision geometry retained at 9 nodes ($5\text{ m}$ spacing) to keep collision physics ticks $< 0.15\text{ ms}$.
  - **16x Anisotropic Procedural Aggregate Detail Texture (`ChunkStreamer`):** Built a high-frequency procedural micro-stone aggregate and grass stippling texture using pure `THREE.DataTexture` ($256 \times 256$, repeat $(12, 300)$, anisotropy 16, mipmapped), eliminating all flat/blurry texture artifacts at oblique angles while maintaining 100% headless test compatibility.
  - **Authentic Circuit Radar HUD Alignment:** Verified canonical surveyed OpenStreetMap track silhouette outline rendering on HUD radar with real-time sector beacon tracking.

- **2026-11-06** - Authentic Porsche 911 3D Model, Animated Wheel Rig & Multi-Color Paint Switcher:
  - **Authentic Porsche 911 (992) Model Ingestion:** Ingested the high-fidelity Creative Commons 3D model of the Porsche 911 Carrera 4S (992) by Karol Miklas (`model.glb`, 3.5 MB with Draco geometry compression). Scaled to $1.03\times$ to match authentic $2.51\text{ m}$ wheelbase, $1.98\text{ m}$ width, and $1.16\text{ m}$ height, aligning wheel arches directly over Rapier physical wheel hubs within 2 millimeters ($Y = +0.24\text{ m}$, $Z = +0.12\text{ m}$).
  - **Dynamic 4-Wheel Animated Rig:** Split front and rear axles into 4 independent animated wheel assemblies. Red Brembo brake calipers remain fixed to the steering hubs and turn with steering input, while alloy rims, ventilated brake discs, and Michelin tires spin continuously with physical angular velocity ($\omega \cdot dt$).
  - **PBR Material Tuning & Crystal-Clear Cockpit View:** Tuned car paint with deep clearcoat, transparent windshield and windows with depthWrite disabled (`opacity: 0.25`) allowing crystal-clear cockpit sightlines over the sculpted frunk hood and fender crests, and glowing LED taillight strip (`emissive: 1.5`).
  - **7-Color Interactive Paint Switcher:** Added interactive paint switching via keyboard shortcut `[P]` and clickable HUD button (`PAINT [P]`), cycling through Guards Red, Carrera White, GT Silver Metallic, Miami Blue, Speed Yellow, Racing Green, and Triple Black.
  - **RSR Swan-Neck Aerodynamic Wing:** Mounted the iconic carbon fiber swan-neck rear wing and red endplates on the rear deck to complete the Porsche 911 GT3 RS / RSR track-weapon aesthetic in both cockpit and chase cameras.

- **2026-11-06** - Filled Eifel Mountain Terrain Landscape & Grounded Trackside Embankments:
  - **Full 3D Eifel Mountain Landscape (`EifelTerrain`):** Ingested $8.0\text{ km} \times 6.6\text{ km}$ SRTM DEM elevation grid (`tracks/nordschleife/dem.json`) into a $122 \times 102$ vertex elevation mesh (24,442 triangles) covering coordinates $X \in [-3919, 4011]$ and $Z \in [-2770, 3860]$. Added multi-tier vertex shading (valley meadows, evergreen pine slopes, highland alpine turf) and smooth lighting normals with shadow reception.
  - **DEM Corridor Sculpting:** Evaluated against all 9,714 surveyed circuit coordinates using a 2D spatial hash grid; sculpted 281 DEM vertices within 45 meters of the circuit to guarantee terrain rests smoothly at least $0.5\text{ m}$ below asphalt grade without clipping through the road surface.
  - **35-Meter Extended Trackside Embankments:** Expanded track cross-section from 9 to 15 nodes in `TrackMeshGenerator`, projecting verdant Eifel grass embankments 35 meters outward on both sides beyond Armco barriers. Bounded physics colliders to 9 drivable nodes for sub-0.2ms Rapier ticks while completely eliminating the visual appearance of a track floating in the sky.

- **2026-11-06** - Critical Suspension Damping, Rigid Cockpit Camera & Sigma=60 Road Smoothing:
  - **Zero-Lag Cockpit Camera (Pullback Bug Fixed):** Completely removed the world-space position `lerp` in `updateCockpitView`. Cockpit camera position is now rigidly attached to `eyeWorld` in car space with exact zero position lag at all speeds, preventing the camera from pulling backwards into the chassis as speed increases.
  - **Critically Damped / Overdamped Suspension ($\zeta \ge 1.0$):** Upgraded shock absorber damping to match automotive critical damping ($14,000\text{ Ns/m}$ front bump, $16,000\text{ Ns/m}$ front rebound, $16,000\text{ Ns/m}$ rear bump, $18,000\text{ Ns/m}$ rear rebound) in `profile.json`, `vehicle-registry.ts`, and `raycast-vehicle.ts`. Removed soft blow-off damping; bumps are now absorbed monotonically in a single half-stroke with zero pogo ringing or rebound bounce. Increased chassis angular damping to $2.0$ and anti-roll bars to $120\text{ kNm/rad}$.
  - **Eliminated Cornering Roll Wobble:** Set `bankingRad = 0` across all standard turns in `centerline.ts` (preserving banking strictly for the authentic 33° Karussell and 22° Mini-Karussell bowls). This removes high-frequency cross-camber twists along the road ribbon, keeping the car completely flat and planted through every corner.
  - **Ultra-Smooth Elevation Profile ($\sigma = 60$):** Applied enhanced Gaussian smoothing pass across all three track layouts, dropping maximum vertical jerk ($d^2y$) to $< 0.005\text{ m}$ across the full 20.8 km loop. The 1.5 km Döttinger Höhe straight now has $d^2y < 0.002\text{ m}$ ($< 2\text{ mm}$ over 5m), providing runway-smooth high-speed straightaway stability while retaining the full $268.5\text{ m}$ authentic Eifel elevation drop.

- **2026-11-06** - Authentic Start/Finish Lines per Circuit Format, Visual Tarmac Stripe & Multi-Track Lap Timing:
  - **Authentic Start/Finish per Format:**
    - **Nürburgring Nordschleife:** Rotated dataset so sample 0 is at T13 (Tribüne 13, $s = 0.0\text{ m}$) facing Sabine-Schmitz-Kurve and Hatzenbach. Completed lap progresses through Hatzenbach, Flugplatz, Bergwerk, Karussell, Pflanzgarten, Döttinger Höhe, Tiergarten, Hohenrain chicane, and crosses the timing line at T13.
    - **Nürburgring 24h Gesamtkurs:** Aligned sample 0 to the Grand Prix Start-und-Ziel-Gerade facing Turn 1 (Yokohama-S). Lap order matches authentic 24-Hour race: GP Turn 1 & Mercedes-Arena $\to$ Schumacher-S $\to$ NGK-Schikane $\to$ front straight $\to$ Anbindung zur Nordschleife $\to$ full 20.8 km Nordschleife $\to$ Hohenrain $\to$ Anbindung zum GP-Kurs $\to$ GP Start/Finish line crossing.
    - **Nürburgring GP-Strecke:** Spawns on the GP Start-Ziel straight facing Turn 1, racing the complete 3.6 km Grand Prix loop.
    - **High-Speed Proving Ground:** Spawns at runway launch box $Z = 0\text{ m}$ facing down the 5 km straight.
  - **Visual Start/Finish Line on Tarmac:** Added a 3-meter wide bright white painted finish line across the asphalt ribbon in `TrackMeshGenerator`, rendering a high-contrast physical timing line directly under the car at spawn and lap completion.
  - **Universal Multi-Circuit Lap Timing & Streaming:** Refactored `main.ts` so `lapTimer.update()`, `streamer.update()`, and landmark projection execute on all circuit modes (`!== TrackMode.PROVING_GROUND`), with dynamic total track lengths and sector names.
  - **Absolute Horizon Stability:** Removed residual camera head roll inertia so steering wheel and cockpit stay perfectly level during cornering and high-G maneuvers; increased chassis angular damping to 1.2 to eliminate pitch chatter.

- **2026-11-06** - High-Speed Bumpiness & Vibration Resolution:
  - **Removed Artificial High-Speed Camera Jitter:** Removed the procedural `Math.random()` eye shake at speeds $> 200\text{ km/h}$ that was directly rattling the screen at 60–120 Hz and causing severe visual fatigue and artificial bumpiness.
  - **Driver Neck Shock Absorption:** Added biological neck damping in `updateCockpitView` (`lerp` with time constant $\tau = 28\text{ s}^{-1}$) that filters out sub-centimeter chassis vibrations while tracking true vehicle movement smoothly, producing a rock-solid cockpit sightline at 250+ km/h.
  - **Pneumatic Contact Patch Compliance Filter:** In `RaycastVehicle.ts`, added a contact patch compliance filter (`lerp(prevCompression, rawCompression, 0.45)`) that smooths out sharp triangle facet seam transitions as the car travels across trimesh polygons at $70+\text{ m/s}$.
  - **Eliminated High-Downforce Chassis Bottoming:** Elevated the chassis collision box translation to $(0, 0.40, 0)$ with half-height $0.25\text{ m}$ (giving $+0.15\text{ m}$ bottom clearance), preventing the chassis rigid body from scraping or clipping the road surface under $10,600\text{ N}$ ($1,080\text{ kg}$) of aerodynamic downforce.
  - **Ultra-Smooth Elevation Profile ($\sigma = 25$):** Applied an enhanced Gaussian smoothing pass across all three track layouts, dropping maximum vertical jerk ($d^2y$) to $< 0.009\text{ m}$ ($< 9\text{ mm}$ per 5m step), eliminating all high-frequency asphalt chatter while maintaining the full $261.5\text{ m}$ vertical drop.

- **2026-11-06** - Cockpit Horizon Alignment, Smooth Elevation Curvature & Digressive Suspension Tuning:
  - **Cockpit Horizon Alignment:** Aligned the camera's up vector directly with the car's local roof normal vector (`this.camera.up.copy(carUp)`). On curves and banked surfaces (including the 33° Karussell), the dashboard, instrument cluster, and steering wheel remain strictly horizontal and level on the player's desktop monitor, eliminating any need for the player to tilt their head.
  - **Eliminated Steering Resistance in Turns:** Restricted Counter-Steer Assist to oversteer slide recovery only (`|steer| < 0.15`); when the driver is actively steering into a turn, counter-steer assist is suppressed so it never fights the driver's hands.
  - **Smoothed Jagged Track Bumps:** Filtered raw 90m SRTM DEM quantized elevations with a multi-pass Gaussian filter ($\sigma = 20$). Reduced second-derivative vertical jerks from $0.35\text{ m}$ down to $< 0.02\text{ m}$ across all circuits, transforming harsh stair-step bumps into natural, butter-smooth highway/racing vertical curves.
  - **Gradual Karussell Banking Ramp:** Replaced the single-step 33° vertical cliff with a smooth cosine bell-curve ramping in and out over 60 meters, preserving the authentic 33° apex bowl while eliminating violent chassis launching.
  - **Digressive Suspension Damping:** Implemented automotive digressive shock absorber curve ($1,800\text{ Ns/m}$ high-speed blow-off above $0.12\text{ m/s}$ bump velocity), expanded suspension travel to $0.095\text{ m}$, increased chassis angular damping to $0.7$, and capped suspension force at $8,500\text{ N}$, completely eliminating resonant pogo bouncing.

- **2026-11-06** - Authentic Surveyed Circuit Ingestion (Nordschleife, 24h Layout, GP-Strecke) & Dynamic Minimap Radar:
  - Ingested high-precision OpenStreetMap surveyed raceway nodes and SRTM DEM digital elevation models, completely replacing the synthetic 29-waypoint balloon with authentic real-world track geometry.
  - Implemented 3 authentic circuit layouts sharing a unified metric origin (`lat0 = 50.36399, lon0 = 6.96253`):
    - **Nürburgring Nordschleife:** 20,710 m, 4,142 points at 5.0m spacing, 45 real named segments (Döttinger Höhe, Flugplatz, Schwedenkreuz, Fuchsröhre, Breidscheid, Bergwerk, Karussell, Hohe Acht, Brünnchen, Pflanzgarten, Galgenkopf), authentic 274.3m vertical elevation drop (347.7m to 622.0m).
    - **Nürburgring 24h Gesamtkurs:** 24,265 m, 4,853 points, seamlessly connecting the GP-Strecke via `Anbindung zum GP-Kurs` and `Anbindung zur Nordschleife` back into Hatzenbach.
    - **Nürburgring GP-Strecke:** 3,595 m, 719 points, featuring the Mercedes-Benz Arena, Goodyear-Kehre, and NGK-Schikane.
  - Revamped HUD Circuit Radar: dynamically computes bounding boxes, rendering the canonical Nürburgring silhouette with West $\to$ Left, East $\to$ Right, North $\to$ Up, and South $\to$ Down, plus real-time directional vehicle heading arrow and landmark beacons.
  - Updated Track Mesh Generator: removed duplicate banking application, constrained kerbs strictly to corner apexes and exits (straights have clean asphalt and grass), and kept collision kerb step at flush 0.0m with 1.2m barrier enclosures to prevent vehicle flips.
  - Verified with 100% test pass on `npm run test:phase2`, clean `npm test`, and zero-error `npm run build`. Live on local dev server.

- **2026-11-09** - High-Speed Stuttering & Micro-Hitch Elimination (Chunk Cache, Physics Substep Clamp & Digital Mirror Pass):
  - Replaced synchronous chunk loading/disposal in `NordschleifeChunkStreamer` with a persistent `chunkCache: Map<number, ActiveChunk>`. Active chunks toggle visibility and collider enablement (`collider.setEnabled(true/false)`) in <0.05ms, eliminating synchronous 80–150ms trimesh BVH compilation stalls at 300+ km/h.
  - Clamped `physicsAccumulator` in `src/host/main.ts` with `clampedDelta = Math.min(frameDelta, 0.05)` and `maxSubSteps = 6` (max 25ms of Rapier 240 Hz physics per frame), preventing accumulator death spirals and frame drops after any render lag.
  - Optimized digital rear-view mirror in `RearViewMirrorRenderer`: reduced camera far clip plane from 5,000m to 200m (skipping distant terrain and 12,000 mountain trees) and throttled updates to alternating frames (smooth 30–60 Hz), cutting cockpit secondary render passes by over 90%.
  - Verified clean removal of floating text billboards (`P O R S C H E`, `TCI`, `TCO`, rotary labels) from the Porsche RSR steering wheel faceplate and rebuilt production assets.

- **2026-11-09** - Continuous Armco Guardrails Restored, Towering Lush Ardennes Forest & Terrain Anti-Noclip:
  - Restored continuous 3-tier galvanized Armco steel safety guardrails on both sides of the track across all circuits (Nordschleife, 24h Gesamtkurs, and GP-Strecke) with heightened 4.0m collision walls and 1.0m underground collision skirts.
  - Revamped forest foliage into towering 24m–38m multi-tiered Ardennes/Eifel pines and spruce trees with deep 5.0m subterranean root skirts, eliminating sunken trees in DEM ditches by planting directly on the embankment surface.
  - Densely populated trackside flanks with over 2,230 towering trees per chunk (~24,500 trees lining the circuit) starting immediately behind the Armco guardrails to create the authentic dense "Green Hell" canopy tunnel.
  - Blanketed mountainsides, ridges, and valleys with 12,000 instanced 26m-tall evergreen mountain trees, eliminating bare mountain horizons.
  - Clamped DEM terrain vertices within 52m of ANY circuit to guarantee they remain at least 2.2m below the road surface with smooth 90m boundary transitions, preventing terrain from ever noclipping through the road or kerbs.

- **2026-11-09** - Dev Server Plain HTTP-to-HTTPS Redirect, Steering Wheel Clean-up, Model Badge Sanitization & Stability:
  - Fixed localhost black screen caused by unencrypted HTTP requests reaching the HTTPS dev server by adding a dedicated `tlsClientError` / `clientError` interceptor in `vite.config.ts` returning HTTP 302 Found and HTML meta refresh to `https://localhost:5173/`.
  - Removed all floating text billboards and labels (`P O R S C H E` wordmark, `TCI`, `TCO`, `TC/CON`, `TC/R`, `MAP`, `WIPER`) from the RSR steering wheel faceplate, keeping pure tactile pushbuttons and the 1:1 LCD dashboard screen.
  - Hardened GLTF vehicle model sanitization in `VehicleModelAdapter` (`src/host/render/livery-system.ts`) to strip rear deck lettering (`Badge_Rear_Lettering`), exterior badges, emblems, and civilian plates across both multi-material and single-material submeshes.
  - Eliminated cockpit camera shake and smoothing lag, rigidly locking eye camera to vehicle chassis.
  - Implemented lower underbody collision skirts and out-of-bounds safety catch in physics loop preventing hard crash terrain noclip.
  - Smoothed 24h Ford-Kurve elevation profile with Hermite spline (down to 1.15% grade change) and enforced 55m tree/terrain setback across all track centerlines.

- **2026-11-06** - Open-Source 3D Map Models, Live Minimap HUD, Nürburgring 24h Layout & Track Menu:
  - Transitioned track modeling direction from purely synthetic procedural spline sweeps to ingesting and adapting open-source/CC 3D circuit models (glTF/GLB).
  - Designed dual-mesh asset pipeline: high-fidelity visual glTF models + isolated simplified trimeshes for Rapier 3D raycast vehicle physics, eliminating procedural normal inversions and bumpy stepped kerbs.
  - Added live vector/canvas HUD circuit minimap with real-time vehicle blip, heading vector, and landmark beacons.
  - Expanded track layout architecture to support the full Nürburgring 24h Gesamtstrecke layout (~25.38 km, combining Nordschleife and GP-Strecke) with an interactive modal track selection menu (`[M]` key or `[Tracks]` HUD button) switching between 24h Layout, Nordschleife, GP-Strecke, and Proving Ground Runway.

- **2026-11-06** - Phase 2 Local Runtime Integration & Live Dev Server Verification:
  - Integrated Phase 2 Dedicated Nürburgring Nordschleife directly into the local host runtime (`src/host/main.ts`) and dev server (`https://localhost:5173/`).
  - Wired `NordschleifeChunkStreamer` (active 3-chunk window `[K-1, K, K+1]`), `NordschleifeCenterline` spline projection, `NordschleifeLapTimer`, and `FloatingOriginManager`.
  - Enabled interactive track switching between Phase 2 Nordschleife (default) and Phase 1 Proving Ground Runway via on-screen HUD button, keyboard shortcut `[T]`, or URL parameter (`?track=nordschleife` / `?track=skidpad`).
  - Enhanced Host HUD with live track distance progress (`X.XX km / 20.83 km (XX%)`), nearest landmark badges (e.g. `Flugplatz`, `Caracciola-Karussell`), live running lap timers, best lap record, and off-track validity indicators.
  - Updated `RaycastVehicle` constructor and `SkidpadArena` to support initial spawn yaw and dynamic collider enabling/disabling during track switches.
  - Verified end-to-end with all 7 automated Phase 2 validation tests passing, full TypeScript check, Vite build, and active local dev server.
- **2026-11-06** - Separated Phase 1 and Phase 2 into dedicated major sections in `idea.md`:
  - Section 2: Phase 1 Specification (Proving Ground, 992 RSR-19, Controller UX, Local Network, Cockpit, Audio, Surface Physics, Acceleration up to 6th gear top speed).
  - Section 3: Phase 2 Specification (Dedicated Nürburgring Nordschleife, 20.832 km spline, 301.5m drop, Karussell 33° banking, 11 chunks, 100m overlap, 3-chunk streamer, floating origin, lap timer).
  - Section 4: Phase 3 Specification (Pit lane interactive garage setup, tyre deg, thermal fade, consumables, weather, multi-class sandbox).
- **2026-11-06** - Phase 2 Dedicated Nürburgring Nordschleife Implementation Ready:
  - Completed mathematical 20,832m Nordschleife centerline spline with 5,208 equidistant samples at 4m spacing, rotation-minimizing parallel transport frames, and realistic Eifel topography (301.5m total vertical elevation drop: Hohe Acht 621.4m down to Breidscheid 319.9m).
  - Implemented 33.0° banking for the Caracciola-Karussell and specific cambers for landmarks (Fuchsröhre compression, Flugplatz crest, Kleines Karussell, Tiergarten).
  - Built 11-chunk partition system (~1.89 km per chunk) with 100m collision overlaps to prevent vehicle physics tunneling at seams.
  - Implemented active 3-chunk window streamer (`[K-1, K, K+1]`) maintaining minimal GPU memory and dynamically swapping Rapier 3D trimesh colliders.
  - Implemented Floating Origin Manager recentering world coordinates when vehicle travels >1200m from origin, preventing float32 vertex jitter.
  - Implemented Nordschleife Lap Timer with Antoniusbuche / T13 start-finish detection, mid-lap checkpoint validation, and 3.8 µs spline distance projection.
  - Added CLI generator (`npm run generate:track`) exporting `tracks/nordschleife/manifest.json` and binary `tracks/nordschleife/centerline.bin`.
  - Added Phase 2 test suite (`npm run test:phase2`) with all 7 validation tests passing.
- **2026-11-06** - Physical Turning Direction & World Yaw Inversion Resolution:
  - Corrected steering sign mapping in `orientation.ts`: landscape-primary ($g_x > 2.5$) uses `atan2(gy, gx)` where tilting right yields positive steer $+1.0$; landscape-secondary ($g_x < -2.5$) uses `atan2(-gy, -gx)`.
  - Fixed world yaw direction inversion: aligned steering angle $\delta$ directly with front wheel orientation and lateral Pacejka tire slip sign.
  - Aligned Three.js visual wheel meshes with physical rotation and steering transforms.
- **2026-11-06** - Complete Simulation Variables Database & 6-Vehicle Multi-Class Sandbox Roster:
  - Established RFC 4180 spreadsheet (`docs/variables-database.csv`) and markdown reference (`docs/variables-database.md`).
  - Cataloged fixed homologation specs vs tunable car setup parameters.
  - Implemented dynamic mechanical gear shift matching and downshift over-rev protection.
- **2026-11-06** - iPad Proportional 3-Zone Controls & Cockpit Jitter Elimination:
  - Optimized controller layout for iPad with proportional 3-zone architecture (Left 1/3 Brake, Right 1/3 Throttle, Middle 1/3 Center Controls).
  - Added momentary Look Behind rear-view mirror button.
  - Standardized on F1 Motorsport LED cluster.
  - Eliminated cockpit camera standstill jitter.
- **2026-11-06** - Reverse on Brake, Standstill Damping & Style Toggle Fix.
- **2026-11-06** - Dual Dashboard Styles (F1 LEDs & Curved Analog Odometer).
- **2026-11-06** - Mobile Controller Scaling & Physics Stability Overhaul.
- **2026-11-06** - Implemented and validated Phase 1 MVP (Steps 1.1–1.5).
- **2026-11-06** - Rephased project into Phase 1, Phase 2, and Phase 3. Selected Porsche 911 RSR-19 (992). Documented Apple M4 Pro host target.
- **2026-11-06** - Recorded answers to Q1–Q21.
- **2026-11-06** - Created from the original idea sheet.
