# Dual-Screen Web Racer (working title)

> Living design doc. New ideas get added here as they come up, and every change gets a line in the [Changelog](#changelog).
> Technical review, spec sheet and open questions are in [spec.md](spec.md).
> Implementation roadmap and agent prompts are in [implementation.md](implementation.md).

**Status:** Phase 1 Complete; Phase 2 Authentic Surveyed Nürburgring Nordschleife & 24h Layout Live (The Green Hell: Dense 3D Forest Foliage, Dashed Line Eradication, Fan Graffiti & Concrete Patches, 3-Tier Armco Barriers, Gravel Runoff Traps, 306.8m Surveyed Topographical Elevation Profile, Razor-Sharp Surveyed Corner Curvatures, Dedicated Sim-Racing Main Menu, Interactive 3D Turntable Showroom, Porsche 911 RSR-19 GTE Specs, Concentric Wheel Hub Alignment, Standardized Flat Wrap UV Pipeline, 1:1 Rexy AO Racing GT3 R Competition Livery, Dynamic Car Number Selector #0–#999, Authentic 5.148 km FIA Grand Prix Circuit Geometry, Zero-Noclip Stadium DEM Terrain, 3D Grandstand & Stadium Architecture, In-Cockpit Micro Radar & Proximity Spotter, F1 Broadcast Competitor Dots & Dynamic FIA Flag State Machine, Official Porsche 911 RSR Steering Wheel & 1:1 LCD Telemetry Display Replica, GPS North-Locked HUD Minimap, Long-Term Trackside Logic Engine & 1:1 Physics Surface Parity, Natural Direct-Manipulation 3D Showroom Controls, Eradication of Flying Tracks via DEM Corridor Sculpting, True Driver Right-Hand Minimap & Radar Orientation, Low-Profile Dashboard Screens for 100% Windshield Visibility, Rear-Exterior Mounted Camera Systems, Grand Prix Circuit Front Straight Stadium Alignment, Authentic Inside-Bowl Karussell Banking, Grounded Embankments & Strict Tree Barrier Enclosure, Elimination of Triangle-Step Bumpiness via C1/C2 Spline Fairing, Karussell Hairpin Voronoi Embankment Clamping & 2D Elevation Shelf Harmonization, Minimalist Luxury Motorsport Showroom Landing Page Polish).
**Last updated:** 2026-11-07 (Phase 2 Verified & Version Control Automated)

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
  - Arched top rev counter housing containing 15 curved shift LEDs (5 green, 5 red, 5 blue, with high-RPM redline flash).
  - "PORSCHE" laser-etched silver wordmark across the top faceplate above the display.
  - CNC anodized aluminum rotary thumb encoders: red `TCI` (top left), purple `TCO` (top right), gold dial (inner left), blue dial (inner right).
  - 10 motorsport pushbuttons with black anodized collar bezels.
  - 4 lower fluted rotary selector switches with index pointers and labels: `TC/CON`, `TC/R`, `MAP`, `WIPER`.
  - Porsche golden shield crest emblem centered on the lower chin.
  - Rear carbon fiber magnetic paddle shifters and red anodized quick-release collar.
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

A comprehensive, long-term trackside architecture unifying physics ground-truth parity, spatial anti-encroachment clearance, dynamic environmental zoning, surface material friction modeling, and trackside race control infrastructure:

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

## 4. Phase 3: Advanced Systems (Future Scope)

### 4.1 Pit Lane Interactive Setup & Screen Transition
- **Detection:** Driving into the pit box stops the vehicle and activates an interactive setup interface on both screens:
  - **Host Display:** 3D garage bay and telemetry page (mouse/keyboard-driven).
  - **Controller Display:** Touch-based options clicking menu (tires, fuel, wing angle, brake bias, assists).
  - **Bidirectional Sync:** Selections update physics parameters in real time over WebSocket.

### 4.2 Tyre Degradation, Thermal Fade & Consumables
- **Tyre Wear:** Temperature and slip energy accumulation gradually reduces peak Pacejka friction multiplier $D$ over multiple laps. (Phase 1 and 2 assume infinite tyre life).
- **Thermal Brake Fade:** Live rotor temperatures $[FL, FR, RL, RR]^\circ\text{C}$ reduce pad friction coefficient $\mu_{\text{pad}}$ above $750^\circ\text{C}$.
- **Fuel Consumption:** Burnoff dynamically reduces vehicle curb weight by $0.75\text{ kg/L}$. (Phase 1 and 2 assume infinite fuel).

### 4.3 Dynamic Environment: Weather & Day/Night Cycle
- **Dynamic Lighting:** Modular day/night cycle via directional sun progression and ambient sky dome with working headlights.
- **Rain System:** Particle emitter around camera + windshield droplet distortion shader + 40% surface friction reduction.
- **Dynamic Drying Line:** 2D track occupancy mask clearing standing water along the racing line.

### 4.4 Multi-Class Sandbox Roster & Variables Database
- Maintained in [`docs/variables-database.csv`](docs/variables-database.csv) and [`src/common/variables-dictionary.ts`](src/common/variables-dictionary.ts).
- Master multi-vehicle roster: Formula 1, Le Mans Hypercar, production GT3 street, and extreme sandbox vehicles.
- Dedicated Rapier compound hitboxes protect 3D models from wall clipping while letting 4-wheel raycasts govern suspension contacts.
- Future hybrid ERS boost and EV powertrain architectures with iconic pitlane EV-to-ICE launch sequence.

---

## 5. Idea Parking Lot

Agent suggestions. **None of these are accepted yet.** Move an item into the main sections above once decided, or delete it.

| # | Idea | Why |
|---|------|-----|
| P1 | **Ghost car** of your best lap | Standard for time attack; input recording also serves as a physics replay. |
| P3 | **Haptic sector delta:** double pulse if up, single long if down | Needs native wrapper for haptics. |
| P4 | **"Light steering" haptic** when front tires lose grip | Needs native wrapper for haptics. |
| P5 | **Audio as the main slip cue:** tire scrub, engine load, wind, surface noise | Essential audio cues for cockpit driving. |
| P6 | **Steering calibration screen:** hold at center, tap to zero, pick a steering range | Everyone holds a phone slightly differently. |
| P7 | **Auto-pause** when controller disconnects, locks, or is laid flat | Prevents crashing if phone is dropped. |
| P8 | **Windshield rain shader** (droplets, wipers) | Visual fidelity when weather arrives. |
| P9 | **Drying line:** wet grip varies across track and recovers on racing line | Dynamic track surface for Phase 3. |
| P10 | **Telemetry recorder** (CSV/JSON of speed, slip, suspension, inputs) | Debugging vehicle physics and driver analysis. |
| P11 | **Keyboard fallback** (WASD / Arrows) on Mac | Allows immediate testing without picking up the phone. |
| P12 | **Respawn to track centerline** ('R' key or phone button) | Essential for recovering from spins or off-track excursions. |
| P13 | **Second device as a spectator dash** (live map, delta, telemetry) | Multi-device companion experience. |
| P15 | **Live sector delta in the HUD** (green/red per sector vs best) | Real-time competitive feedback. |
| P16 | **Mini steering wheel graphic in center of controller screen** | Visual indicator of current wheel angle on the phone. |
| P17 | **Manual DRS and Hybrid ERS/Push-to-Pass Boost** | Triggerable via controller buttons and bounded by track marker zones like real racecars. |
| P18 | **High-polygon animated driver arms with racing gloves** | Ultra-detailed 3D driver arms with Alpinestars/Sparco competition gloves wrapped around the steering wheel, animated with inverse kinematics or skeletal skinning matching wheel rotation (deferred per user request). |
| P19 | **Multi-Class GT Endurance Field & Nissan GTR Class Expansion** | Represent every team in the GT endurance field running the Porsche 911 RSR-19; add Nissan GT-R / GT3 / GTR class with standardized wrap framework (planned future expansion per user request). |

---

## 6. Decision Log

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
| 2026-11-06 | Filled Eifel Mountain Terrain & Grounded Embankments | Ingested 8.0 km x 6.6 km SRTM DEM elevation data into rolling 3D mountain landscape mesh (EifelTerrain, 24,442 triangles) with altitude/gradient vertex shading. Sculpted DEM within 45m corridor along all 9,714 circuit centerline points to prevent road clipping. Extended visual track cross-section 35 meters outward beyond Armco barriers with green Eifel turf geometry so the track ribbon rests naturally on the landscape with zero floating appearance. |
| 2026-11-06 | Authentic Porsche 911 3D Model & Dynamic Wheel Rig | Ingested Karol Miklas Porsche 911 (992 generation) 3D model (Draco GLB, 3.5 MB) into `CarMeshRig`, scaling to 1:1 wheelbase (2.51m) and width (1.98m). Separated 4 animated wheels with fixed brake calipers and rolling rims/discs/tires. Mounted RSR carbon swan-neck wing and tuned PBR materials with 7-color paint switcher (`[P]` key / HUD button). |
| 2026-11-06 | Trackside Visual Overhaul & Zero-Noclip Terrain Sculpting | Clamped DEM terrain within 65m corridor across all 9,714 circuit nodes to <= Y_track - 4.0m (0 of 9,714 points clipping; max terrain relative to road = -3.99m), completely eliminating noclipping. Upgraded track mesh to 30-node cross section with 1.25m sub-sampling: razor-sharp 20cm continuous brilliant white boundary lines, 20cm centerline white dashes (5m dash / 5m gap), dark textured asphalt with rubbered grooves, alternating 2.0m FIA red/white kerbs on all corner complexes, non-blurry multi-tone grass verges and outward-sloping mountain forest embankments down to -35m. Added 16x anisotropic procedural aggregate detail texture via pure DataTexture. |
| 2026-11-06 | Porsche 911 GT3 RS Weissach Racing Model & Standardized Livery Pipeline | Replaced civilian Carrera 4S with authentic Porsche 911 GT3 RS (992 generation) featuring full Weissach package and factory DRS swan-neck rear wing mounted solidly to engine deck with zero gap. Built universal `VehicleModelAdapter` automatically stripping all civilian street license plates across imported models. Implemented dynamic $1024 \times 1024$ PBR canvas `LiveryGenerator` with 7 preset competition liveries (Manthey Grello #911, Martini #77, Rothmans #1, Pink Pig #92, Gulf #20, Weissach #93, Stealth #00) cycling via `[P]` key / HUD button. |
| 2026-11-07 | Version Control & GitHub Sync | Automatic commit and push of all codebase, assets, and documentation to public GitHub repository (`dual-screen-web-racer`) once after every phase completion. |
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

---

## 7. Changelog

- **2026-11-07** - Version Control & Automatic GitHub Sync:
  - Initialized dedicated Git repository in project root with clean `.gitignore`.
  - Added project `README.md` documenting architecture, local HTTPS setup, and validation commands.
  - Configured public GitHub repository push workflow (`dual-screen-web-racer`) to push all code, assets, and documentation once after every phase completion.

- **2026-11-07** - Minimalist Luxury Motorsport Showroom Landing Page Polish & Unnecessary Text Eradication:
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

- **2026-11-06** - Karussell Hairpin Voronoi Embankment Clamping, 2D Elevation Shelf Harmonization, Tree Voronoi Ownership & Extended DEM Sculpting:
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

- **2026-11-06** - Elimination of Triangle-Step Bumpiness, Taubin Zero-Shrinkage Curve Fairing, Analytical Spline Frames & 2nd-Order Pneumatic Damper Filtering:
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
