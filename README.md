# Dual-Screen Web Racer

A sim-lite racing platform running directly in modern web browsers.

- **Main Screen (Mac / PC):** Acts as the cinematic windshield with driver-side cockpit view, Three.js WebGL2/WebGPU rendering, Rapier 3D 240 Hz vehicle physics, sound synthesis, and real-time track streaming.
- **Mobile Controller (iPhone / iPad):** Connects over local HTTPS / WebSocket with zero perceptible latency. Features in-plane gravity tilt steering, split-screen touch pedals (left = brake/reverse, right = throttle), and an AMOLED digital instrument cluster.

---

## Current Status

- **Phase 1 (Proof of Concept - Proving Ground):** Complete & Validated. $1.2\text{ km} \times 6.0\text{ km}$ testing runway, Porsche 911 RSR-19 (992) physics with 6-speed sequential gearing, ABS/TC assists, and sub-10ms mobile control.
- **Phase 2 (Dedicated Nürburgring Nordschleife):** Complete & Verified. Full $20.71\text{ km}$ surveyed circuit with realistic topography (301.6m vertical elevation drop), Caracciola-Karussell 33° banking, 11-chunk partition system with 100m collision overlaps, dynamic 3-chunk window streamer, floating origin, and start/finish lap timing. Additional layouts include the 24h Gesamtkurs ($24.26\text{ km}$) and GP-Strecke ($3.60\text{ km}$).
- **Phase 3 (Advanced Systems):** In progress (interactive pit lane setup UI, tyre degradation, thermal brake fade, fuel consumption, weather, multiplayer).

---

## Architecture

```
dual-screen-web-racer/
├── src/
│   ├── host/                 # Host computer application (Three.js & Rapier 3D)
│   │   ├── main.ts           # Game loop orchestrator
│   │   ├── physics/          # Raycast vehicle, Pacejka tire curves, aero, assists
│   │   ├── render/           # Stage, cockpit camera, stadium assets, showroom
│   │   ├── streaming/        # Spline centerline, 3-chunk window streamer, lap timer
│   │   ├── audio/            # Web Audio API engine, gear whine & shift synthesis
│   │   ├── net/              # WebSocket host bridge
│   │   └── ui/               # Main menu & circuit selection
│   ├── controller/           # Mobile Safari client (iPhone / iPad)
│   │   ├── controller.ts     # Mobile lifecycle & WebSocket bridge
│   │   ├── sensors/          # In-plane gravity orientation & One Euro filter
│   │   └── ui/               # Split-screen touch pedals & F1 LED dash
│   └── common/               # Shared binary protocol, math, and car profiles
├── tracks/                   # Surveyed OSM & DEM elevation circuit data
├── scripts/                  # Track generation pipeline & test suites
└── docs/                     # Physics variables database & specifications
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Modern desktop browser (Chrome, Edge, Safari)
- iPhone or iPad running Safari (connected to the same local Wi-Fi or hotspot)

### Installation
```bash
# Clone the repository
git clone https://github.com/le-fische/dual-screen-web-racer.git
cd dual-screen-web-racer

# Install dependencies
npm install
```

### Local HTTPS Setup (for iOS Sensors)
iOS Safari requires HTTPS to access `DeviceMotionEvent`:
```bash
# Generate local SSL certs via mkcert
chmod +x scripts/generate-certs.sh
./scripts/generate-certs.sh
```

### Running the Application
```bash
# Start Vite development server
npm run dev
```
1. Open `https://localhost:5173` on your host computer.
2. Scan the on-screen QR code with your iPhone / iPad camera to open `/controller.html`.
3. Tap "START CONTROLLER" on your phone to unlock motion sensors.

---

## Testing & Validation

```bash
# Run Phase 1 validation suite (vehicle physics, assists, protocol)
npm test

# Run Phase 2 validation suite (Nordschleife spline, streaming, topography)
npm run test:phase2

# Run full TypeScript and Vite build
npm run build
```

---

## Documentation

- [idea.md](idea.md): Living design doc, handling philosophy, and changelog.
- [spec.md](spec.md): Complete engineering specification sheet for all phases.
- [implementation.md](implementation.md): Multi-phase implementation roadmap and subagent briefs.
- [docs/variables-database.md](docs/variables-database.md): Physics parameters dictionary and multi-class car roster.

---

## License

MIT
