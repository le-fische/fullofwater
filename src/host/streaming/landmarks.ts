/**
 * Nürburgring Nordschleife Landmark Definitions & Topography Profile
 * Elevation bounds: High point ~618m (Hohe Acht), Low point ~320m (Breidscheid),
 * Total length: 20,832m.
 */

export interface TrackLandmark {
  name: string;
  distanceM: number;
  elevationM: number;
  bankingDeg: number;
  trackWidthM: number;
  notes?: string;
}

export const NORDSCHLEIFE_LANDMARKS: TrackLandmark[] = [
  { name: 'T13 / Antoniusbuche (Start/Finish)', distanceM: 0, elevationM: 615, bankingDeg: 1.5, trackWidthM: 9.0 },
  { name: 'Hatzenbach', distanceM: 1100, elevationM: 585, bankingDeg: 3.0, trackWidthM: 8.5 },
  { name: 'Hocheichen', distanceM: 1950, elevationM: 562, bankingDeg: 4.0, trackWidthM: 8.0 },
  { name: 'Flugplatz', distanceM: 2550, elevationM: 574, bankingDeg: 3.5, trackWidthM: 8.5 },
  { name: 'Schwedenkreuz', distanceM: 3200, elevationM: 550, bankingDeg: 2.0, trackWidthM: 9.0 },
  { name: 'Aremberg', distanceM: 3800, elevationM: 520, bankingDeg: 5.0, trackWidthM: 8.0 },
  { name: 'Fuchsröhre (Compression)', distanceM: 4600, elevationM: 420, bankingDeg: 6.0, trackWidthM: 8.0 },
  { name: 'Adenauer Forst', distanceM: 5400, elevationM: 450, bankingDeg: 4.5, trackWidthM: 7.5 },
  { name: 'Metzgesfeld', distanceM: 6100, elevationM: 440, bankingDeg: 3.0, trackWidthM: 8.0 },
  { name: 'Kallenhard', distanceM: 7000, elevationM: 400, bankingDeg: 5.0, trackWidthM: 7.5 },
  { name: 'Wehrseifen', distanceM: 8200, elevationM: 350, bankingDeg: 6.5, trackWidthM: 7.0 },
  { name: 'Breidscheid (Lowest Point)', distanceM: 8900, elevationM: 320, bankingDeg: 3.0, trackWidthM: 8.0 },
  { name: 'Ex-Mühle', distanceM: 9400, elevationM: 355, bankingDeg: 5.0, trackWidthM: 7.5 },
  { name: 'Bergwerk', distanceM: 10400, elevationM: 410, bankingDeg: 5.5, trackWidthM: 7.5 },
  { name: 'Kesselchen', distanceM: 11500, elevationM: 475, bankingDeg: 3.5, trackWidthM: 8.5 },
  { name: 'Klostertal', distanceM: 12400, elevationM: 505, bankingDeg: 4.0, trackWidthM: 8.0 },
  { name: 'Caracciola-Karussell (Banked Concrete Bowl)', distanceM: 13150, elevationM: 525, bankingDeg: 33.0, trackWidthM: 8.0 },
  { name: 'Hohe Acht (Highest Point)', distanceM: 14100, elevationM: 618, bankingDeg: 3.0, trackWidthM: 8.0 },
  { name: 'Hedwigshöhe / Wippermann', distanceM: 14700, elevationM: 600, bankingDeg: 4.5, trackWidthM: 8.0 },
  { name: 'Eschbach', distanceM: 15300, elevationM: 575, bankingDeg: 5.0, trackWidthM: 7.5 },
  { name: 'Brünnchen', distanceM: 16100, elevationM: 540, bankingDeg: 6.0, trackWidthM: 8.5 },
  { name: 'Pflanzgarten I (Sprunghügel Jump)', distanceM: 16900, elevationM: 510, bankingDeg: 4.0, trackWidthM: 8.5 },
  { name: 'Pflanzgarten II', distanceM: 17600, elevationM: 495, bankingDeg: 5.0, trackWidthM: 8.0 },
  { name: 'Schwalbenschwanz', distanceM: 18300, elevationM: 525, bankingDeg: 4.0, trackWidthM: 8.5 },
  { name: 'Kleines Karussell', distanceM: 18750, elevationM: 540, bankingDeg: 18.0, trackWidthM: 7.5 },
  { name: 'Galgenkopf', distanceM: 19100, elevationM: 565, bankingDeg: 7.0, trackWidthM: 9.0 },
  { name: 'Döttinger Höhe (Long Straight)', distanceM: 19600, elevationM: 590, bankingDeg: 1.0, trackWidthM: 10.0 },
  { name: 'Tiergarten / Hohenrain Chicane', distanceM: 20400, elevationM: 610, bankingDeg: 3.0, trackWidthM: 8.5 },
  { name: 'T13 (Lap Finish)', distanceM: 20832, elevationM: 615, bankingDeg: 1.5, trackWidthM: 9.0 },
];
