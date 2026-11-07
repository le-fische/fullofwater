import osmNordschleife from '../tracks/nordschleife/osm_nordschleife.json';
import osmGp from '../tracks/gp/osm_gp.json';

function analyzeBinormals(name: string, pts: number[][]) {
  console.log(`=== ANALYZING ${name} (${pts.length} points) ===`);
  const N = pts.length;
  const angles: number[] = [];
  const edgeDistDeltas: number[] = [];

  for (let i = 0; i < N; i++) {
    const pPrev = pts[(i - 1 + N) % N];
    const pNext = pts[(i + 1) % N];
    const tx = pNext[0] - pPrev[0];
    const tz = pNext[2] - pPrev[2];
    const hLen = Math.hypot(tx, tz) || 1e-5;
    const bx = tz / hLen;
    const bz = -tx / hLen;

    const pNext2 = pts[(i + 2) % N];
    const txNext = pNext2[0] - pts[i][0];
    const tzNext = pNext2[2] - pts[i][2];
    const hLenNext = Math.hypot(txNext, tzNext) || 1e-5;
    const bxNext = tzNext / hLenNext;
    const bzNext = -txNext / hLenNext;

    // Dot product between consecutive binormals
    const dot = Math.min(1.0, Math.max(-1.0, bx * bxNext + bz * bzNext));
    const angleDeg = Math.acos(dot) * (180 / Math.PI);
    angles.push(angleDeg);

    // Kink on 6m wide track edge: 6 * sin(angle)
    const kinkMeters = 6.0 * Math.sin(angleDeg * (Math.PI / 180));
    edgeDistDeltas.push(kinkMeters);
  }

  const maxAngle = Math.max(...angles);
  const avgAngle = angles.reduce((a, b) => a + b, 0) / N;
  const maxKink = Math.max(...edgeDistDeltas);
  const avgKink = edgeDistDeltas.reduce((a, b) => a + b, 0) / N;

  console.log(`Max binormal turn between consecutive 5m points: ${maxAngle.toFixed(2)} deg`);
  console.log(`Average binormal turn: ${avgAngle.toFixed(2)} deg`);
  console.log(`Max edge kink on white line outline: ${(maxKink * 100).toFixed(1)} cm`);
  console.log(`Average edge kink: ${(avgKink * 100).toFixed(1)} cm`);
}

analyzeBinormals('Nordschleife', osmNordschleife.points);
analyzeBinormals('GP Strecke', osmGp.points);
