/**
 * Track Pipeline: Fetch OpenStreetMap Nürburgring Nordschleife relation
 * Companion script for Agent D (Phase 2).
 */

import fs from 'fs';
import path from 'path';

// Bounding box for Nürburgring Nordschleife (Rheinland-Pfalz, Germany)
// Lat: 50.31 to 50.38, Lon: 6.92 to 7.02
const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  relation["name"="Nürburgring Nordschleife"](50.31,6.92,50.38,7.02);
  way["highway"="raceway"](50.31,6.92,50.38,7.02);
);
out body;
>;
out skel qt;
`;

export async function fetchNordschleifeOsm(outputFilePath?: string): Promise<void> {
  const targetPath = outputFilePath || path.resolve(process.cwd(), 'public/assets/track/osm_nordschleife.json');
  console.log('Querying Overpass API for Nürburgring Nordschleife geometry...');

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API responded with HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
    console.log(`Successfully fetched OSM data -> ${targetPath} (${data.elements?.length || 0} elements)`);
  } catch (err) {
    console.warn(`Overpass API query failed or offline: ${(err as Error).message}`);
    console.log('Creating placeholder osm_nordschleife.json for offline development.');

    // Offline stub
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(
      targetPath,
      JSON.stringify(
        {
          version: 0.6,
          generator: 'Dual-Screen-Web-Racer-Offline-Stub',
          elements: [
            { type: 'node', id: 1, lat: 50.3341, lon: 6.9426 },
            { type: 'node', id: 2, lat: 50.3355, lon: 6.9448 },
          ],
        },
        null,
        2
      )
    );
  }
}

if (process.argv[1]?.endsWith('fetch-osm.ts')) {
  fetchNordschleifeOsm();
}
