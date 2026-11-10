# Vehicle & Simulation Variables Database (Data Dictionary)

> Modular reference manual and database mapping all global constants, vehicle blueprint specifications, tunable garage setup variables, and runtime telemetry outputs across all racing and sandbox vehicle classes.
> Machine-readable spreadsheet export: [`variables-database.csv`](variables-database.csv) (compatible with Excel, Google Sheets, Numbers, and Pandas).

---

## 1. Variable Classification Taxonomy

To ensure scalability from strict motorsport homologation to an unrestricted multi-class sandbox (e.g. 20 diverse cars on track, Tuk-Tuk vs. F1), variables are organized into four functional tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SIMULATION ARCHITECTURE                         │
├────────────────────────────────┬───────────────────────────────────────┤
│ Tier 1: Global Constants       │ Environmental physics, gravity, ticks │
├────────────────────────────────┼───────────────────────────────────────┤
│ Tier 2: Homologation Blueprint │ Car-specific physical DNA (fixed)     │
├────────────────────────────────┼───────────────────────────────────────┤
│ Tier 3: Tunable Garage Setup   │ Driver-adjustable in Pit Lane / Setup │
├────────────────────────────────┼───────────────────────────────────────┤
│ Tier 4: Runtime Telemetry      │ Live 240 Hz state & 60 Hz UDP packets │
└────────────────────────────────┴───────────────────────────────────────┘
```

1. **Tier 1 — Global Simulation Constants**: Immutable physics laws, environmental atmospheric properties, surface friction coefficients, and network rates shared across all vehicles and sessions.
2. **Tier 2 — Vehicle Homologation Blueprint Specs**: The intrinsic mechanical DNA of a vehicle (curb mass, wheelbase, track widths, inertia tensor, engine displacement, cylinder count, rev limiter, suspension travel, tire sizes, aerodynamic drag and downforce baselines). These define the character of a car and are uneditable during a race.
3. **Tier 3 — Tunable Setup Variables (Pit Lane / Garage)**: Mechanical and electronic settings that the player/engineer can adjust in the garage to tailor the car to specific tracks or driving styles (wing angles, gearing drop sets, coilover spring rates, anti-roll bars, brake bias, tire compound, assist levels).
4. **Tier 4 — Dynamic Runtime Telemetry**: Real-time state variables computed by Rapier 3D and the drivetrain model every 240 Hz tick and broadcast over binary WebSocket to the mobile controller and HUD at 60 Hz.

---

## 2. Multi-Class Vehicle Sandbox Taxonomy

The simulation supports multiple distinct vehicle categories and split tiers (Stock vs. Race):

| Vehicle Class | Archetype Code | Typical Power | Typical Weight | Aero Downforce ($C_l A$) | Top Speed | Transmission | Seating |
|---|---|---|---|---|---|---|---|
| **GT / GTE** | `gt` | $500 - 650\text{ PS}$ | $1,200 - 1,350\text{ kg}$ | $2.5 - 3.2\text{ m}^2$ | $295 - 320\text{ km/h}$ | 6-speed Sequential | Left-Hand Drive ($X=-0.35$) |
| **Formula 1** | `f1` | $1,000\text{ PS}$ | $798\text{ kg}$ | $5.0 - 5.8\text{ m}^2$ | $350 - 365\text{ km/h}$ | 8-speed Seamless | Centerline ($X=0.0$) |
| **Hypercar / LMDh** | `prototype` | $680 - 710\text{ PS}$ | $1,030\text{ kg}$ | $3.8 - 4.5\text{ m}^2$ | $335 - 350\text{ km/h}$ | 7-speed Transverse | Centerline ($X=0.0$) |
| **Street Production** | `street` | $300 - 550\text{ PS}$ | $1,400 - 1,650\text{ kg}$ | $0.2 - 0.8\text{ m}^2$ | $260 - 300\text{ km/h}$ | Dual-Clutch / Manual | Left-Hand Drive ($X=-0.38$) |
| **Sandbox / Novelty** | `sandbox` | $9 - 250\text{ PS}$ | $250 - 450\text{ kg}$ | $0.0\text{ m}^2$ | $65 - 220\text{ km/h}$ | Dog Box / Sequential | Centerline ($X=0.0$) |

---

## 3. Master Variable Data Dictionary

### 3.1 Global & Environmental Constants (Tier 1)

| Variable Name | Code Property Path | Unit | Value | Mapped Function / Module | Description |
|---|---|---|---|---|---|
| Universal Gravity | `world.gravity` | $\text{m/s}^2$ | $-9.81$ | `Rapier.World(new Vector3(0, -9.81, 0))` | Downward gravitational acceleration. |
| Physics Tick Frequency | `world.physicsTickHz` | $\text{Hz}$ | $240$ | `RaycastVehicle.step(1/240)` | High-rate deterministic simulation timestep ($\Delta t \approx 4.167\text{ ms}$). |
| Sea-Level Air Density | `world.airDensity` | $\text{kg/m}^3$ | $1.225$ | `RaycastVehicle.stepAeroDynamics()` | Standard atmospheric air density $\rho$ for aerodynamic drag/downforce. |
| Speed of Sound | `world.speedOfSound` | $\text{m/s}$ | $343.0$ | `EngineAudioSynth.calcDoppler()` | Acoustic speed used for Doppler shift pitch scaling. |
| Ambient Temperature | `world.ambientTempC` | $^\circ\text{C}$ | $20.0$ | `BrakeSystem.stepThermals()` | Ambient reference temperature for brake disc and tire thermals. |
| Telemetry Broadcast Rate | `network.telemetryRateHz` | $\text{Hz}$ | $60$ | `HostNetworkBridge.broadcastTelemetry()` | Packed binary WebSocket telemetry broadcast frequency. |
| Asphalt Friction Scale | `surface.asphalt.friction` | $\times$ | $1.00$ | `Pacejka.calcTireForces()` | Baseline tire friction scale on track tarmac. |
| Concrete Kerb Friction | `surface.concrete.friction` | $\times$ | $0.90$ | `Pacejka.calcTireForces()` | Kerb and rumble strip grip multiplier. |
| Grass Verge Friction | `surface.grass.friction` | $\times$ | $0.35$ | `Pacejka.calcTireForces()` | Low-grip grass friction trigger for split-$\mu$ yaw moments. |
| Gravel Trap Friction | `surface.gravel.friction` | $\times$ | $0.45$ | `Pacejka.calcTireForces()` | Gravel friction coefficient. |
| Gravel Rolling Resistance | `surface.gravel.rollingResistance` | $\times$ | $0.280$ | `RaycastVehicle.step()` | High displacement deceleration drag in gravel runoffs. |

---

### 3.2 Vehicle Blueprint Specifications (Tier 2: Homologation)

#### Chassis & Mass Properties
| Variable Name | Code Property Path | Unit | Baseline (911 RSR) | Mapped Module | Physical Meaning |
|---|---|---|---|---|---|
| Total Curb Mass | `chassis.massKg` | $\text{kg}$ | $1,242$ | `Rapier.RigidBodyDesc.setMass()` | Total dry vehicle mass without driver ballast. |
| Center of Gravity Height | `chassis.cgHeightM` | $\text{m}$ | $0.40$ | `RaycastVehicle.initChassisBody()` | Vertical distance of mass center above ground surface. |
| Static Front Weight Split | `chassis.frontWeightFraction` | ratio | $0.43$ | `RaycastVehicle.calcStaticWheelLoads()` | $43\%$ front axle load / $57\%$ rear axle load. |
| Wheelbase | `chassis.wheelbaseM` | $\text{m}$ | $2.513$ | `RaycastVehicle.initSuspensionRays()` | Distance between front and rear axle centers. |
| Front Track Width | `chassis.trackFrontM` | $\text{m}$ | $1.705$ | `RaycastVehicle.initSuspensionRays()` | Center-to-center distance between front tires. |
| Rear Track Width | `chassis.trackRearM` | $\text{m}$ | $1.670$ | `RaycastVehicle.initSuspensionRays()` | Center-to-center distance between rear tires. |
| Roll Inertia $I_{xx}$ | `chassis.inertiaTensor[0]` | $\text{kg}\cdot\text{m}^2$ | $1,650$ | `chassisBody.setMassProperties()` | Rotational inertia around longitudinal axis. |
| Pitch Inertia $I_{yy}$ | `chassis.inertiaTensor[1]` | $\text{kg}\cdot\text{m}^2$ | $420$ | `chassisBody.setMassProperties()` | Rotational inertia around lateral axis. |
| Polar Yaw Inertia $I_{zz}$ | `chassis.inertiaTensor[2]` | $\text{kg}\cdot\text{m}^2$ | $1,850$ | `chassisBody.setMassProperties()` | Rotational inertia around vertical yaw axis (governs spin dynamics). |
| Linear Translation Damping | `chassis.linearDamping` | ratio | $0.01$ | `chassisBody.setLinearDamping()` | Residual chassis damping (kept minimal so aero drag governs top speed). |
| Angular Velocity Damping | `chassis.angularDamping` | ratio | $0.05$ | `chassisBody.setAngularDamping()` | Rotational pitch, roll, and yaw damping. |

#### Powertrain & Engine Blueprint
| Variable Name | Code Property Path | Unit | Baseline (911 RSR) | Mapped Module | Physical Meaning |
|---|---|---|---|---|---|
| Architecture Layout | `engine.type` | enum | `ice` | `Drivetrain.constructor()` | Powertrain type: `ice` (Gas), `hybrid` (ICE + MGU-K), `electric` (BEV). |
| Displacement | `engine.displacementL` | $\text{L}$ | $4.2$ | `EngineAudioSynth.constructor()` | Engine swept combustion volume. |
| Cylinder Count | `engine.cylinders` | count | $6$ | `EngineAudioSynth.update()` | Number of cylinders (3 firings per crankshaft revolution). |
| Idle Crankshaft Speed | `engine.idleRpm` | $\text{RPM}$ | $2,000$ | `Drivetrain.step()` | Stationary engine idle speed. |
| Redline Speed | `engine.redlineRpm` | $\text{RPM}$ | $9,000$ | `Drivetrain.step()` | Peak horsepower rating RPM. |
| Electronic Rev Limiter | `engine.limiterRpm` | $\text{RPM}$ | $9,250$ | `Drivetrain.step()` | Hard fuel and ignition cut limiter. |
| Rated Horsepower | `specs.powerPS` | $\text{PS}$ | $515$ | `CarProfile.specs` | Peak brake horsepower. |
| Peak Engine Torque | `specs.torqueNm` | $\text{Nm}$ | $470$ | `Drivetrain.getEngineTorque()` | Peak mechanical crankshaft torque @ $7,200\text{ RPM}$. |
| Flywheel Inertia | `engine.inertiaKgM2` | $\text{kg}\cdot\text{m}^2$ | $0.11$ | `Drivetrain.step()` | Crankshaft and flywheel rotating rotational inertia. |
| Engine Compression Braking | `engine.engineBrakeNm` | $\text{Nm}$ | $85$ | `Drivetrain.step()` | Base compression drag torque scaled quadratically with RPM. |
| Torque Lookup Curve | `engine.torqueCurve` | $[[\text{RPM}, \text{Nm}]]$ | $[[2000, 280] \dots]$ | `Drivetrain.getEngineTorque()` | Discrete piecewise torque curve table. |

#### Transmission Blueprint
| Variable Name | Code Property Path | Unit | Baseline (911 RSR) | Mapped Module | Physical Meaning |
|---|---|---|---|---|---|
| Transmission Type | `transmission.type` | enum | `sequential` | `Drivetrain.constructor()` | Sequential dog-ring gearbox. |
| Automated Shifting | `transmission.auto` | bool | `true` | `Drivetrain.step()` | Pneumatic shift actuator automation. |
| Forward Gear Ratios | `transmission.ratios` | array | $[3.18, 2.25, 1.78, 1.48, 1.26, 1.10]$ | `Drivetrain.getGearRatio()` | Hewland sequential 6-speed cog ratios. |
| Reverse Gear Ratio | `transmission.reverse` | ratio | $-3.20$ | `Drivetrain.getGearRatio()` | Reverse gear mechanical ratio. |
| Base Final Drive | `transmission.finalDrive` | ratio | $3.44$ | `Drivetrain.getGearRatio()` | Differential ring-and-pinion reduction ratio. |
| Shift Actuator Time | `transmission.shiftTimeS` | $\text{s}$ | $0.045$ | `Drivetrain.step()` | Pneumatic gear change and ignition cut duration ($45\text{ ms}$). |
| Clutch Lockup Speed | `transmission.clutchEngageKmh` | $\text{km/h}$ | $8.0$ | `Drivetrain.step()` | Low-speed smooth clutch slip ramp from standstill. |
| Reverse Hold Delay | `transmission.autoReverseHoldTimeS` | $\text{s}$ | $0.30$ | `Drivetrain.step()` | Brake hold time required at standstill to shift into Reverse. |

#### Aerodynamics Blueprint
| Variable Name | Code Property Path | Unit | Baseline (911 RSR) | Mapped Module | Physical Meaning |
|---|---|---|---|---|---|
| Drag Area $C_d A$ | `aero.dragCdA` | $\text{m}^2$ | $0.88$ | `RaycastVehicle.stepAeroDynamics()` | Effective aerodynamic frontal drag area product ($F_d = \frac{1}{2} \rho v^2 C_d A$). |
| Downforce Area $C_l A$ | `aero.downforceClA` | $\text{m}^2$ | $3.42$ | `RaycastVehicle.stepAeroDynamics()` | Effective aerodynamic downforce area product ($F_l = \frac{1}{2} \rho v^2 C_l A$, +20% high-grip trim). |
| Aero Balance Center | `aero.aeroBalanceFront` | ratio | $0.45$ | `RaycastVehicle.stepAeroDynamics()` | $45\%$ front axle downforce / $55\%$ rear axle downforce. |
| DRS Drag Reduction | `aero.drs.dragReduction` | fraction | $0.28$ | `RaycastVehicle.stepAeroDynamics()` | $28\%$ drag reduction when rear wing DRS flap opens. |
| DRS Downforce Drop | `aero.drs.downforceReduction` | fraction | $0.35$ | `RaycastVehicle.stepAeroDynamics()` | $35\%$ downforce reduction when rear wing DRS flap opens. |
| Baseline Top Speed | `specs.topSpeedKmh` | $\text{km/h}$ | $298$ | `CarProfile.specs` | Equilibrium top speed with standard rear wing. |
| DRS Top Speed | `specs.topSpeedDrsKmh` | $\text{km/h}$ | $318$ | `CarProfile.specs` | Equilibrium top speed with DRS flap open. |

#### Sound Design Blueprint
| Variable Name | Code Property Path | Unit | Baseline (911 RSR) | Mapped Module | Physical Meaning |
|---|---|---|---|---|---|
| Spur Mesh Teeth Count | `sound.gearMeshTeeth` | teeth | $32$ | `EngineAudioSynth.setupTransmissionSound()` | Gear teeth count creating straight-cut transmission whine. |
| Differential Whine Ratio | `sound.diffWhineRatio` | $\text{Hz/(km/h)}$ | $11.2$ | `EngineAudioSynth.setupTransmissionSound()` | Ground-speed proportional final drive whine frequency multiplier. |
| Cockpit Wind Volume | `sound.cockpitWindVolume` | gain | $0.0$ | `EngineAudioSynth.update()` | Wind volume inside cockpit view (strictly 0.0). |
| Chase Cam Wind Volume | `sound.chaseWindVolume` | gain | $0.30$ | `EngineAudioSynth.update()` | Wind volume in exterior chase cam ($v^{2.5}$). |

---

### 3.3 Tunable Car Setup Variables (Tier 3: Garage Screen)

These variables are player-adjustable in the Phase 3 Pit Lane garage screen and can be freely tweaked in Sandbox mode:

| Variable Name | Code Property Path | Unit | Default | Tunable Min | Tunable Max | Impact on Car Handling |
|---|---|---|---|---|---|---|
| **Rear Wing Angle** | `setup.rearWingAngleDeg` | $^\circ$ | $10.0$ | $5.0$ | $18.0$ | Higher angle increases rear downforce and stability but reduces top speed. |
| **DRS Toggle** | `setup.drsEnabled` | bool | `true` | `false` | `true` | Enables DRS flap opening on high-speed straights. |
| **Final Drive Ratio** | `setup.finalDriveRatio` | ratio | $3.44$ | $3.20$ | $3.65$ | Shorter (3.65) yields faster acceleration; longer (3.20) yields higher top speed. |
| **Gear Ratio Set** | `setup.gearRatioSet` | enum | `'standard'` | `'short'` | `'long'` | Preconfigured drop gear tooth ratio sets. |
| **Upshift Target RPM** | `setup.upshiftRpm` | $\text{RPM}$ | $8,800$ | $8,600$ | $8,900$ | Shifts closer to redline or short-shifts for fuel/tire saving. |
| **Front Spring Stiffness** | `setup.frontSpringNPerM` | $\text{N/m}$ | $145,000$ | $120,000$ | $180,000$ | Stiffer front resists dive under braking; softer aids turn-in grip. |
| **Rear Spring Stiffness** | `setup.rearSpringNPerM` | $\text{N/m}$ | $165,000$ | $140,000$ | $200,000$ | Stiffer rear stabilizes under aero downforce; softer promotes traction. |
| **Front Anti-Roll Bar** | `setup.frontAntiRollNmPerRad` | $\text{Nm/rad}$ | $95,000$ | $70,000$ | $120,000$ | Stiffening front ARB induces understeer; softening aids mid-corner bite. |
| **Rear Anti-Roll Bar** | `setup.rearAntiRollNmPerRad` | $\text{Nm/rad}$ | $75,000$ | $50,000$ | $100,000$ | Stiffening rear ARB rotates the car; softening reduces oversteer snaps. |
| **Ride Height Perch** | `setup.rideHeightOffsetM` | $\text{m}$ | $0.000$ | $-0.010$ | $+0.015$ | Lowering lowers CG and raises downforce ground effect. |
| **Front Brake Bias** | `setup.frontBrakeBias` | $\%$ | $57.0$ | $50.0$ | $64.0$ | Forward bias prevents rear lockup spin; rearward bias aids trail-braking. |
| **Max Brake Clamping** | `setup.maxBrakeTorqueNm` | $\text{Nm}$ | $6,800$ | $5,000$ | $7,500$ | Total mechanical clamping force clamp across the 4 calipers. |
| **Tire Compound** | `setup.tireCompound` | enum | `'slick_medium'` | `'slick_soft'` | `'wet'` | Soft (maximum grip, high wear), Medium (balanced), Hard, Wet. |
| **Front Cold Pressure** | `setup.tirePressureBarFront` | $\text{bar}$ | $1.70$ | $1.40$ | $2.20$ | Lower pressure increases contact patch width; higher pressure improves response. |
| **Rear Cold Pressure** | `setup.tirePressureBarRear` | $\text{bar}$ | $1.70$ | $1.40$ | $2.20$ | Cold inflation pressure on rear drive axle. |
| **Traction Control Level** | `setup.tcLevel` | $0-10$ | $6$ | $0$ | $10$ | Cut torque on wheelspin. $0=\text{Off}$ (pure driver control), $10=\text{Aggressive}$. |
| **ABS Intervention Level** | `setup.absLevel` | $0-10$ | $7$ | $0$ | $10$ | Modulate brake pressure at tire slip limit. $0=\text{Lockup permitted}$. |
| **ESP Yaw Damping Gain** | `setup.espGain` | $0.0-1.0$ | $0.45$ | $0.00$ | $1.00$ | Active chassis yaw damping opposing rapid spin moments. |
| **Counter-Steer Assist** | `setup.counterSteerGain` | $0.0-1.0$ | $0.30$ | $0.00$ | $1.00$ | Stabilizing steering torque assisting driver in catching slides. |

---

### 3.4 Dynamic Runtime Telemetry (Tier 4)

Outputs updated at 240 Hz and broadcast over binary WebSocket:

| Variable Name | Code Property Path | Unit | Frequency | Description |
|---|---|---|---|---|
| Vehicle Speed | `telemetry.speedKmh` | $\text{km/h}$ | $240\text{ Hz}$ | Forward ground velocity. |
| Engine RPM | `telemetry.rpm` | $\text{RPM}$ | $240\text{ Hz}$ | Live crankshaft rotational speed. |
| Current Gear | `telemetry.gear` | int | $240\text{ Hz}$ | Current engaged transmission gear ($-1 = \text{R}$, $0 = \text{N}$, $1..6$). |
| Steering Wheel Angle | `telemetry.steerAngleDeg` | $^\circ$ | $240\text{ Hz}$ | Effective road wheel steering angle. |
| Wheel Slip Angles | `telemetry.wheelSlipAngle` | $\text{rad}[4]$ | $240\text{ Hz}$ | Lateral slip angle per tire $[FL, FR, RL, RR]$. |
| Wheel Slip Ratios | `telemetry.wheelSlipRatio` | ratio $[4]$ | $240\text{ Hz}$ | Longitudinal slip ratio per tire $[FL, FR, RL, RR]$. |
| Suspension Deflection | `telemetry.suspensionCompression` | $\text{m}[4]$ | $240\text{ Hz}$ | Live spring displacement per wheel. |
| Lateral Acceleration | `telemetry.lateralG` | $\text{G}$ | $240\text{ Hz}$ | Dynamic cornering lateral G-force. |
| Longitudinal Accel | `telemetry.longitudinalG` | $\text{G}$ | $240\text{ Hz}$ | Acceleration and braking G-force. |
| Brake Rotor Temps | `telemetry.brakeTempsC` | $^\circ\text{C}[4]$ | $240\text{ Hz}$ | Live disc temperatures from thermodynamic friction solver. |
| Shift Actuator Active | `telemetry.isShifting` | bool | $240\text{ Hz}$ | Indicates pneumatic solenoid firing and ignition cut. |
| Downshift Auto-Blip | `telemetry.isDownshiftBlip` | bool | $240\text{ Hz}$ | Indicates electronic throttle rev-matching blip. |
