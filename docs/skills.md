# Sim-Racing Asset Creation & Engineering Pipeline (skills.md)

Standard technical specifications and step-by-step procedures for constructing circuits, vehicles, physical simulation models, and liveries for the Full of Water platform.

---

## 1. Track Creation & Ingestion Pipeline

### 1.1 Centerline Splines & Surveyed Data Ingestion
- **Surveyed Data Sourcing:**
  - Ingest OpenStreetMap (OSM) raceway relations (`highway=raceway`) for circuit boundaries and centerline way sequences.
  - Ingest Digital Elevation Models (SRTM 30m / Rheinland-Pfalz DGM1 1m lidar) for authentic 3D vertical topography.
- **Spline Representation:**
  - Represent track centerline as an equidistant cubic Catmull-Rom Hermite spline sampled at $\Delta s = 1.0\text{ m}$ to $5.0\text{ m}$.
  - Store analytical orthonormal parallel-transport frames at each sample index $i$:
    - $\mathbf{p}(s)$: World position vector $(x, y, z)$.
    - $\mathbf{t}(s)$: Unit tangent vector (racing direction).
    - $\mathbf{n}(s)$: Surface normal vector (perpendicular to asphalt plane).
    - $\mathbf{b}(s) = \mathbf{t}(s) \times \mathbf{n}(s)$: Lateral binormal vector (pointing driver-right).
    - $\theta_{\text{bank}}(s)$: Road surface banking angle in radians.
    - $w_{\text{track}}(s)$: Local road width in meters (nominal $8.0\text{–}12.0\text{ m}$).
- **Elevation Corridor Clamping:**
  - To prevent terrain clipping or "noclipping", evaluate all digital elevation model (DEM) vertices against a 2D spatial clearance grid.
  - Any terrain vertex within distance $d \le 65\text{ m}$ of the track ribbon must be clamped:
    $$y_{\text{terrain}} \le y_{\text{asphalt}} - 2.5\text{ m}$$
  - Blend smoothly outward to the undisturbed natural mountain profile between $65\text{ m}$ and $180\text{ m}$.

### 1.2 30-Node High-Definition Cross-Section Extrusion
Extrude visual and physical ribbons from the centerline samples using a multi-node transverse profile:
```
[-35m Embankment] ... [-10m Armco] ... [-6m Grass] ... [-5m Kerb] ... [-4m White Line] ... [0m Centerline] ... [+4m White Line] ... [+5m Kerb] ... [+6m Grass] ... [+10m Armco] ... [+35m Embankment]
```
- **Asphalt Ribbon ($[-4\text{ m}, +4\text{ m}]$):** Dark fine-aggregate asphalt with rubbered racing groove wear along optimal apex paths.
- **FIA Red/White Kerbs:** $1.25\text{ m}$ width, $1.8\text{ cm}$ beveled crown, activated dynamically on corners ($\kappa \ge 0.0035\text{ rad/m}$) with $2.0\text{ m}$ alternating red/white stripes.
- **Boundary Lines:** Dedicated $0.20\text{ m}$ continuous brilliant white edge markings on driver left and right.
- **Historic Concrete Slabs:** Integrated tar-jointed concrete paving for classic sections (Karussell, Mini-Karussell, historic chicanes).

### 1.3 Anti-Noclip Multi-Tier Safety Barriers & Catch Fencing
- **Visual Barrier Geometry:**
  - 3-tier galvanized Armco steel W-beams: lower rail ($+0.25\text{ m}$), corrugated trough ($+0.65\text{ m}$), top rail ($+1.15\text{ m}$).
  - FIA debris catch fences: $2.5\text{ m}$ steel vertical support stanchions supporting dark steel wire mesh safety cages atop the barriers.
  - Energy-absorbing red-and-white tire barrier stacks and Tecpro blocks at acute-angle runoff zones (Aremberg, Adenauer Forst, Wehrseifen, Brünnchen).
- **Rapier Physics Collision Envelopes:**
  - Barriers must NEVER be modeled as zero-thickness single-sided 2D polygons. High-speed impacts at $300+\text{ km/h}$ ($83.3\text{ m/s}$) travel $0.35\text{ m}$ per 240 Hz tick and will tunnel through thin geometry.
  - Model barrier colliders as continuous 3D convex hulls or extruded prisms with minimum thickness $t \ge 0.50\text{ m}$ behind the barrier face.
  - Enable Continuous Collision Detection (CCD) on the vehicle rigid body:
    ```typescript
    bodyDesc.setCcdEnabled(true);
    ```

### 1.4 Dedicated Drivable Pit Lane & Pit Box Architecture
- **Geometric Separation:**
  - Pit lane runs parallel to the main straight, physically partitioned by a continuous concrete pit wall divider ($h = 1.05\text{ m}$, $w = 0.45\text{ m}$) topped with safety debris fencing and team pit perches.
  - Dedicated deceleration entry lane with painted chevron blend line and pit entrance chicane.
  - Concrete pit apron ($w = 7.5\text{ m}$) featuring marked individual team pit stalls/boxes ($6.5\text{ m} \times 3.2\text{ m}$) and overhead fuel/air gantry lollipop rigs.
  - Support for multi-stall grid allocation (Pit Box 1 through N) for multiplayer paddocks.
  - Pit exit acceleration lane with solid white blend line extending downstream to prevent collision with racing traffic.
- **Pit Lane Control Logic:**
  - Automated detection trigger volume at pit entry gate.
  - Enforces mandatory pit lane speed limiter ($60\text{ km/h}$ or $80\text{ km/h}$ depending on FIA track license).
  - Audio limiter governor (staccato ignition cut sound) and HUD `PIT LIMITER: 60 KM/H` indicator.
  - Pit stop service trigger: Vehicle halts in assigned pit box $\to$ stationary timer initiates tire change, refuel, and damage repair.

### 1.5 Overhead Sponsor Bridges & Trackside Infrastructure
- **Bridges & Gantries:**
  - Ingest and place authentic overhead steel truss sponsor bridges at surveyed coordinates:
    - Bilstein Bridge (Döttinger Höhe)
    - Audi / Yokohama / Dunlop Bridges (Grand Prix straight & Nordschleife approach)
    - Start/Finish Haupttribüne gantry with 5 green/red FIA starting light clusters.
- **Grandstands & Stadium Architecture:**
  - Ingest covered Haupttribüne grandstands, multi-story concrete pit building with team garages and VIP lounges, Mercedes-Arena bleachers, and Dunlop-Kehre viewing banks.

### 1.6 Dense Eifel Forest Immersion Engine
- **Tree Population & Zoning:**
  - Multi-tier evergreen conifers (Norway spruce, Scots pine) and deciduous broadleaf trees (European beech, silver birch) lining both flanks of the circuit ($13\text{ m}$ to $65\text{ m}$ from centerline).
  - Spatial clearance hash grid: Enforces minimum distance $|d_{\text{lateral}}| \ge w_{\text{track}} / 2 + 5.5\text{ m}$ from any track segment, eliminating tree bleed-through onto adjacent track ribbons in hairpin switchbacks.
- **GPU Instancing & LOD Pipeline:**
  - Render forest walls via `THREE.InstancedMesh` with a single draw call per chunk.
  - Employ 2-tier LODs: LOD0 3D geometry within $150\text{ m}$, LOD1 cross-quad billboard quads beyond $150\text{ m}$.
  - Dense tree placement (600–900 trees per 2 km chunk) providing complete forest canopy immersion ("The Green Hell") while maintaining locked 60–120 FPS on Apple M4 Pro hardware.

### 1.7 11-Chunk Partitioning & Runtime Streaming
- **Chunk Partitioning:**
  - Divide long circuits into manageable longitudinal segments of $\sim 1.8\text{–}2.0\text{ km}$.
  - Nürburgring Nordschleife: 11 chunks spanning the $20,710\text{ m}$ loop.
- **100m Collision Overlap:**
  - Visual chunks end exactly at chunk boundaries.
  - Physics collision trimeshes extend $100\text{ m}$ into adjacent chunks, ensuring the vehicle's 4 suspension raycasts and chassis box collider never encounter a missing physics facet during high-speed transitions.
- **Active 3-Chunk Window Streamer:**
  - Maintains `[K-1, K, K+1]` in memory relative to the player's current chunk $K$.
  - Dynamically swaps visual meshes into the Three.js scene and collision trimeshes into the Rapier 3D physics world.
- **Floating Origin Precision Guard:**
  - Whenever vehicle displacement exceeds $1,200\text{ m}$ from the active world origin, shift world coordinates:
    $$\mathbf{p}_{\text{world}} \gets \mathbf{p}_{\text{world}} - \mathbf{p}_{\text{car}}$$
  - Prevents float32 vertex shaking and camera jitter on circuits $>20\text{ km}$.

### 1.8 Continuous Spline Fairing & Procedural Road Bump Dynamics
- **Non-Jagged Geometric Continuity:**
  - Track surface ribbon must be completely free of polygonal kinks, faceted seams, or DEM staircasing.
  - Extrusion runs along an 8-pass Taubin faired cubic spline with $C^2$ second-derivative continuity, guaranteeing smooth visual flow.
- **Physics Micro-Undulation & Tar Seams:**
  - While visual ribbon geometry is smooth and clean, authentic Nordschleife bumpiness is modeled through high-frequency physical displacement:
    - Long-wave undulations: Surveyed vertical gradient changes (Fuchsröhre compression, Flugplatz crest, Bergwerk dip).
    - Medium-wave surface undulations: Continuous procedural Perlin noise ($\lambda = 8\text{–}25\text{ m}$, amplitude $\pm 18\text{ mm}$) emulating aged Eifel asphalt settling.
    - Short-wave micro-bumps & tar seams: High-frequency transverse impulses ($\lambda = 0.5\text{–}1.2\text{ m}$, amplitude $\pm 8\text{ mm}$) at historic expansion joints, patched tarmac bands, and kerb bevels.
  - Bumps excite the 240 Hz Rapier vehicle suspension spring-dampers, causing realistic wheel travel, load transfers, and chassis bounce without geometric polygon jaggedness.

---

## 2. Vehicle Modeling & Asset Pipeline

### 2.1 3D CAD & glTF Model Ingestion & Sanitization
- **Geometry Format:** Open-source or licensed glTF/GLB binary format with Draco mesh compression (target file size $\le 4.0\text{ MB}$).
- **Scale & Coordinate Alignment:**
  - Align vehicle model forward along $+Z$ (or $-Z$ matching standard engine convention), roof toward $+Y$, and driver-right toward $+X$.
  - Rescale to exact homologation dimensions: Wheelbase ($2.51\text{ m}$ for Porsche 992 RSR), overall width ($1.98\text{ m}$), height ($1.16\text{ m}$).
- **Mesh Sanitization (`VehicleModelAdapter.sanitizeModel`):**
  - Automatically detect, hide, and strip non-racing street assets: civilian license plates (`*plate*`, `*tag*`), road car steering stalks (`Interior_SteeringColumn_Stalks`), and street steering wheels (`Node_SteeringWheel`).

### 2.2 Dynamic 4-Wheel Assembly Rig
- **Separation of Axles & Hubs:**
  - Extract 4 distinct wheel objects from the model hierarchy: `Wheel_FL`, `Wheel_FR`, `Wheel_RL`, `Wheel_RR`.
  - Extract brake calipers into fixed hub groups: Calipers steer with the front wheels ($\delta$) but DO NOT rotate around the spin axle.
  - Rims, ventilated brake discs, and Michelin tires attach to the spin sub-node:
    ```typescript
    wheelMesh.rotation.x += wheelAngularVelocity * dt;
    ```
- **Concentric Stance Alignment:**
  - Survey exact wheel hub centers from the 3D model geometry (e.g. $X = \pm 0.7701\text{ m}, Y = 0.5190\text{ m}, Z_{\text{front}} = +1.1688\text{ m}, Z_{\text{rear}} = -1.2867\text{ m}$).
  - Align Rapier physical suspension raycast anchors directly over these coordinates within $2\text{ mm}$, eliminating suspension offset errors and wheel poking.

### 2.3 Standardized Flat Wrap UV Livery Pipeline (`StandardWrapMapper`)
- **UV Projection Methodology:**
  - Analytical 1:1 planar and cylindrical UV projection mapping exterior painted body panels (`Chassis_Paint`, `Door_Paint_L`, `Door_Paint_R`, `Hood_Paint`, aero wings) into designated 2D texture regions:
    - **Top/Plan View:** Hood, roof, rear deck, rear wing upper surface.
    - **Left Flank:** Left front fender, door, rocker panel, rear quarter panel.
    - **Right Flank:** Right front fender, door, rocker panel, rear quarter panel (inverted $Z$ mapping so sponsor text reads correctly left-to-right on both flanks without horizontal mirroring).
    - **Front Bumper:** Curved panoramic nose from dive plane to dive plane.
- **Dynamic 2048x2048 Canvas Livery Generator:**
  - Synthesizes competition liveries (Manthey Grello, Martini, Rothmans, Pink Pig, Gulf, Weissach, Rexy AO Racing) in real time.
  - Dynamically renders interactive competition roundels (`#0`–`#999`) and sponsor logos onto PBR canvas textures.

### 2.4 Recessed Lighting & Directional Emissive Tuning
- **Recessed Projector Headlights:**
  - Bind materials directly to model headlight cavities (`Headlight_Emissive`, `HeadLight_Glass`, `HeadLight_Housing_Static`).
  - Dual long-throw forward `THREE.SpotLight` beams ($280\text{ m}$ throw, $24.0$ intensity) + wide corner flood ($115\text{ m}$ throw).
  - Recessed strictly below fender crests ($Y \le 0.39\text{ m}$) with zero protruding geometry in cockpit view.
- **Diffuse Rear Taillights & Directional Brake Lights:**
  - Bind red emissive materials to recessed rear light strip (`Taillight_Strip_Emissive`, `Taillight_Brake_Emissive`).
  - Directional rear brake `THREE.SpotLight` beams positioned at rear bumper ($Z = -2.02\text{ m}$) aimed strictly rearward toward $-Z$ ($Z_{\text{target}} = -14.0\text{ m}$).
  - Diffuse ground bounce only; completely eliminates unrealistic forward light spill into the cockpit while providing realistic road illumination behind the car.

### 2.5 Cockpit Rig & LCD Digital Dashboard
- **Driver Eye Positioning:**
  - Driver-side cockpit camera mounted at $[0.35, 0.70, -0.26]\text{ m}$ in car space, FOV $78^\circ$, down-pitch $-3.4\text{ m}$ over $30\text{ m}$.
  - Rigidly attached to chassis (zero position lag at high speed).
  - Biological neck shock absorption filter ($\tau = 28\text{ s}^{-1}$) damping sub-centimeter vibration while preserving real vehicle dynamics.
- **1:1 Official Porsche 911 RSR Steering Wheel (`PorscheRsrSteeringWheel`):**
  - Authentic 285mm carbon fiber GT steering wheel faceplate with ergonomic Alcantara grips.
  - 15 curved shift rev LEDs: 5 green (6,600–7,400 RPM), 5 red (7,400–8,200 RPM), 5 blue (8,200–8,800 RPM), strobe at 8,800+ RPM.
  - $1024 \times 600$ real-time canvas telemetry display: live speed, gear numeral, water/oil temperatures and pressures, predicted lap time, live delta.
  - In-cockpit micro radar display mounted below rear-view mirror with proximity spotter hazard arcs (`CAR LEFT`, `CAR RIGHT`, `CAR BEHIND`).

### 2.6 Anti-Nausea Cockpit Camera Horizon Stabilization & Chassis Bump Vibration
- **Biomechanical Principle (Vestibulo-Ocular Reflex - VOR):**
  - In real racing cars over rough surfaces like the Nordschleife, human neck muscles and ocular tracking keep the driver's gaze locked to the horizon and road vanishing point.
  - Rapid, unrestrained camera pitch and roll swings relative to the horizon trigger severe simulator sickness and nausea.
- **Decoupled Camera vs. Chassis Motion:**
  - **Internal Cockpit Camera:** Anchored at the driver's eye position, but its angular orientation applies an $85\text{–}90\%$ horizon lock. Pitch and roll rotations are heavily low-pass filtered, keeping the central horizon and road sightlines smooth and stable.
  - **Chassis & Interior Vibration:** The physical car chassis, dashboard, steering column, A-pillars, and roll cage receive high-frequency vertical and angular displacement driven by suspension deflection $\Delta z$ and kerb strikes.
  - **Visual Result:** The driver sees the cockpit bouncing and vibrating vigorously in their peripheral vision—delivering the visceral bumpiness of the Nordschleife—while their central focal point remains stable, completely eliminating motion sickness.
  - High-frequency micro-displacement is clamped to $\le 2.5\text{ mm}$ to prevent unnatural clipping.

---

## 3. Physical Simulation & Realism Models

### 3.1 Pacejka Magic Formula Tire Dynamics
- **Longitudinal Traction ($F_x$):**
  $$F_x = D_x \cdot \sin\left(C_x \cdot \arctan\left(B_x \cdot \kappa - E_x \cdot (B_x \cdot \kappa - \arctan(B_x \cdot \kappa))\right)\right)$$
- **Lateral Cornering Grip ($F_y$):**
  $$F_y = D_y \cdot \sin\left(C_y \cdot \arctan\left(B_y \cdot \alpha - E_y \cdot (B_y \cdot \alpha - \arctan(B_y \cdot \alpha))\right)\right)$$
- **Friction Ellipse Coupling:**
  $$F_{\text{total}} = \sqrt{\left(\frac{F_x}{F_{x,\max}}\right)^2 + \left(\frac{F_y}{F_{y,\max}}\right)^2} \le 1.0$$

### 3.2 Dynamic Consumables Simulation
- **Tyre Wear & Thermal Grip Degradation:**
  - Accumulates frictional slip energy:
    $$\Delta E_{\text{slip}} = (|F_x \cdot v_{\text{slip},x}| + |F_y \cdot v_{\text{slip},y}|) \cdot dt$$
  - Wear reduces peak friction coefficient $D$:
    $$D(t) = D_{\text{fresh}} \cdot \left(1.0 - k_{\text{wear}} \cdot \frac{E_{\text{accum}}}{E_{\max}}\right)$$
  - Models camber scrub and flat-spotting under sustained wheel lockups.
- **Fuel Mass Depletion & Balance Shift:**
  - Fuel burns dynamically at $\sim 0.65\text{–}0.85\text{ L/min}$ at full racing throttle.
  - Liquid density $\rho_{\text{fuel}} = 0.75\text{ kg/L}$.
  - Fuel cell location ($X=0, Y=0.22, Z=+0.45\text{ m}$) shifts total chassis mass and front/rear weight distribution as fuel burns down over a stint.
- **Brake Thermal Efficiency & Fade:**
  - Rotor heat capacity $C_{\text{rotor}} = 650\text{ J/(kg}\cdot\text{K)}$, convective cooling $h_{\text{air}} = 1.8 + 0.36 v$.
  - Thermal efficiency curve:
    - Cold pads ($<200^\circ\text{C}$): Initial pad coefficient $\mu = 0.32$.
    - Optimal operating window ($350\text{–}650^\circ\text{C}$): Peak pad coefficient $\mu = 0.44$.
    - Overheating thermal fade ($>750^\circ\text{C}$): Pad coefficient degrades linearly down to $\mu = 0.19$ at $1,100^\circ\text{C}$ (torque fade factor up to $55\%$).

---

## 4. Sound Design & Audio Synthesis Pipeline

### 4.1 Multi-Layer Engine Combustion Synthesis (Porsche Flat-Six Pulse Model)
- **Cylinder Pulse Sequencing:**
  - Porsche 4.2L naturally aspirated flat-six firing order produces 3 discrete combustion events per crankshaft revolution:
    $$f_{\text{combustion}} = \frac{\text{RPM}}{60} \cdot 3 = 0.05 \cdot \text{RPM}$$
  - At 9,000 RPM redline, fundamental combustion pulse occurs at $450\text{ Hz}$.
- **Multi-Harmonic Layering:**
  - Layer 1 (Sub-bass rumble): Sine wave at fundamental firing frequency ($40\text{–}450\text{ Hz}$) with high-pass floor at $35\text{ Hz}$.
  - Layer 2 (Mechanical body): Asymmetric pulse wave generating odd and even harmonics, driven through soft-clip saturation for flat-six mechanical growl.
  - Layer 3 (Intake plenum roar): High-resonance bandpass filter ($Q = 2.2$) modulated by throttle pedal position ($0.0\text{–}1.0$), opening up throatiness under full throttle load.

### 4.2 Straight-Cut Gearbox Whine & Ear-Fatigue Mitigation (Headphone Safety)
- **Acoustic Origin of Gear Mesh Whine:**
  - Straight-cut spur dog-ring gearboxes mesh teeth with zero helix angle, producing a high-frequency acoustic tone:
    $$f_{\text{mesh}} = \frac{\text{RPM}_{\text{axle}}}{60} \cdot N_{\text{teeth}} \approx 1,000\text{–}3,800\text{ Hz}$$
- **The Ear-Fatigue Problem in Headphones:**
  - Raw high-Q bandpass filters or undamped oscillator harmonics in the $2.5\text{–}4.0\text{ kHz}$ band coincide directly with the natural resonance of the human ear canal, causing ear strain, headaches, and auditory fatigue within minutes of headphone use.
- **Acoustic Engineering Fixes:**
  1. **Steep Low-Pass Rolloff:** Cascade a 2nd-order Butterworth low-pass filter at $3,200\text{ Hz}$ ($-12\text{ dB/octave}$) to eliminate shrill, piercing high-frequency overtones.
  2. **Ear-Canal Resonance Notch Filter:** Insert a static parametric notch filter centered at $3,500\text{ Hz}$ ($Q = 3.0$, gain $-8.0\text{ dB}$) to remove harsh acoustic energy without destroying the mechanical character of straight-cut gears.
  3. **Load-Dependent Volume Attenuation:**
     - Drive whine volume strictly by driveline torque:
       $$V_{\text{whine}} = V_{\text{base}} \cdot \max(\text{throttle}^{1.5}, \text{overrun\_braking}^{1.2})$$
     - When coasting, cruising at steady state, or dipping the clutch, gearbox whine drops by $-18\text{ dB}$, eliminating persistent high-pitched drone.
  4. **Smooth Frequency Interpolation:** Slew rate limiter on oscillator frequency changes ($15\text{ ms}$ ramp) to prevent sharp frequency clicks during aggressive sequential shifts.

### 4.3 Tire Scrub, Carcass Deflection & Skid Acoustics
- **Tire Noise Synthesis:**
  - Dual-band pink noise source dynamically routed through high-pass and low-pass filters.
  - Carcass scrubbing rumble ($70\text{–}220\text{ Hz}$) tracks lateral slip angle $\alpha$ starting from $3.0^\circ$.
  - High-frequency rubber skid screech ($900\text{–}1,600\text{ Hz}$) activates when slip exceeds the peak traction limit ($\alpha > 6.5^\circ$ or longitudinal lockup $\kappa > 0.15$).
- **Grip Threshold Acoustic Feedback:** Provides intuitive auditory cues for impending breakaway before the car spins.

### 4.4 Environmental & Surface Acoustics
- **Kerb Strike Thumps:**
  - Transient impact synthesizer triggered when tire position intersects raised FIA kerb nodes.
  - Low-frequency resonant impulse ($65\text{–}140\text{ Hz}$) decaying over $90\text{ ms}$, accompanied by high-frequency chassis rattle.
- **Aerodynamic Wind Rush:**
  - White noise source processed by low-pass filter moving from $200\text{ Hz}$ to $1,800\text{ Hz}$ as vehicle speed climbs from $140\text{ km/h}$ to $300+\text{ km/h}$.
  - Cockpit cabin dampens exterior wind noise by $-14\text{ dB}$ relative to chase view.

### 4.5 Master Bus Processing & Safety Compression
- **Dynamics Compressor / Brickwall Limiter:**
  - Insert `DynamicsCompressorNode` on master output:
    - Threshold: $-6\text{ dBFS}$
    - Knee: $12\text{ dB}$
    - Ratio: $8:1$
    - Attack: $0.003\text{ s}$
    - Release: $0.15\text{ s}$
  - Guarantees zero acoustic clipping, volume spikes, or ear damage during sudden multi-car crashes or redline backfires.
