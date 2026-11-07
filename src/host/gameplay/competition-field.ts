import * as THREE from 'three';
import { NordschleifeCenterline } from '../streaming/centerline';
import { NearbyCar } from '../render/cockpit/micro-radar-display';

export enum RaceFlagStatus {
  GREEN = 'GREEN',
  SECTOR_1_YELLOW = 'SECTOR_1_YELLOW',
  SECTOR_2_YELLOW = 'SECTOR_2_YELLOW',
  SECTOR_3_YELLOW = 'SECTOR_3_YELLOW',
  FULL_YELLOW = 'FULL_YELLOW',
  RED = 'RED',
}

export interface GridCar {
  id: string;
  number: string;
  name: string;
  color: string;
  distanceM: number;
  speedKmh: number;
  worldPos: THREE.Vector3;
  headingRad: number;
}

/**
 * Competition Field Simulation & Race Flag State Machine.
 * Manages endurance GT / F1 competitor cars running along the circuit spline:
 * - Simulates realistic pack racing, draft overtakes, and cornering deltas
 * - Feeds tiny colored dots into the Big Minimap (F1 broadcast style)
 * - Feeds nearby competition cars into the in-cockpit Micro Radar & Spotter display
 * - Manages FIA Race Flags (Green, Sector Yellow, Full Course Yellow / VSC, Red)
 */
export class CompetitionField {
  public cars: GridCar[] = [];
  public flagStatus: RaceFlagStatus = RaceFlagStatus.GREEN;
  private centerline?: NordschleifeCenterline;

  constructor() {
    this.initDefaultField();
  }

  private initDefaultField(): void {
    // 6 Authentic Competition Endurance Entries
    this.cars = [
      {
        id: 'car_911',
        number: '911',
        name: 'Manthey Racing Grello',
        color: '#eab308', // Racing Yellow
        distanceM: 65.0,
        speedKmh: 185.0,
        worldPos: new THREE.Vector3(),
        headingRad: 0,
      },
      {
        id: 'car_1',
        number: '1',
        name: 'Rothmans Heritage',
        color: '#1e3a8a', // Dark Blue
        distanceM: 140.0,
        speedKmh: 190.0,
        worldPos: new THREE.Vector3(),
        headingRad: 0,
      },
      {
        id: 'car_92',
        number: '92',
        name: 'Pink Pig Sau',
        color: '#f472b6', // Pink
        distanceM: 260.0,
        speedKmh: 178.0,
        worldPos: new THREE.Vector3(),
        headingRad: 0,
      },
      {
        id: 'car_20',
        number: '20',
        name: 'Gulf Racing Heritage',
        color: '#38bdf8', // Gulf Light Blue
        distanceM: 380.0,
        speedKmh: 182.0,
        worldPos: new THREE.Vector3(),
        headingRad: 0,
      },
      {
        id: 'car_93',
        number: '93',
        name: 'Weissach Motorsport',
        color: '#ef4444', // Guards Red
        distanceM: 520.0,
        speedKmh: 188.0,
        worldPos: new THREE.Vector3(),
        headingRad: 0,
      },
      {
        id: 'car_00',
        number: '00',
        name: 'Stealth Carbon',
        color: '#94a3b8', // Silver Carbon
        distanceM: 690.0,
        speedKmh: 175.0,
        worldPos: new THREE.Vector3(),
        headingRad: 0,
      },
    ];
  }

  public setCenterline(centerline: NordschleifeCenterline): void {
    this.centerline = centerline;
    // Distribute cars relative to total track length
    const totalM = centerline.totalLengthM;
    const spacing = Math.min(350, totalM / (this.cars.length + 1));

    // Place the first competitor car right in front/behind the player for immediate spotter engagement!
    this.cars[0].distanceM = 12.0; // 12m ahead of start line
    this.cars[1].distanceM = totalM - 14.0; // 14m behind start line
    for (let i = 2; i < this.cars.length; i++) {
      this.cars[i].distanceM = (i * spacing) % totalM;
    }
  }

  /**
   * Cycles FIA Race Flag status (Green -> Sector 1 -> Sector 2 -> Sector 3 -> Full Yellow -> Red -> Green).
   */
  public cycleFlag(): RaceFlagStatus {
    switch (this.flagStatus) {
      case RaceFlagStatus.GREEN:
        this.flagStatus = RaceFlagStatus.SECTOR_2_YELLOW;
        break;
      case RaceFlagStatus.SECTOR_2_YELLOW:
        this.flagStatus = RaceFlagStatus.SECTOR_1_YELLOW;
        break;
      case RaceFlagStatus.SECTOR_1_YELLOW:
        this.flagStatus = RaceFlagStatus.SECTOR_3_YELLOW;
        break;
      case RaceFlagStatus.SECTOR_3_YELLOW:
        this.flagStatus = RaceFlagStatus.FULL_YELLOW;
        break;
      case RaceFlagStatus.FULL_YELLOW:
        this.flagStatus = RaceFlagStatus.RED;
        break;
      case RaceFlagStatus.RED:
      default:
        this.flagStatus = RaceFlagStatus.GREEN;
        break;
    }
    console.log(`🏁 Race Flag Updated: ${this.flagStatus}`);
    return this.flagStatus;
  }

  /**
   * Updates competitor positions along the circuit spline.
   */
  public update(_playerDistanceM: number, _playerSpeedKmh: number, dt: number): void {
    if (!this.centerline || this.centerline.samples.length === 0) return;

    const samples = this.centerline.samples;
    const totalM = this.centerline.totalLengthM;
    const stepM = this.centerline.sampleSpacingM;

    for (let c = 0; c < this.cars.length; c++) {
      const car = this.cars[c];

      // Flag speed limits
      let maxPace = 220.0;
      if (this.flagStatus === RaceFlagStatus.FULL_YELLOW) maxPace = 80.0;
      if (this.flagStatus === RaceFlagStatus.RED) maxPace = 0.0;

      // Realistic speed modulation based on upcoming corner curvature
      const sampleIdx = Math.floor(car.distanceM / stepM) % samples.length;
      const sp = samples[sampleIdx];
      const turnSeverity = Math.abs(sp.turnRate);
      const cornerSpeed = Math.max(65.0, 240.0 - turnSeverity * 5500.0);
      const targetSpeed = Math.min(maxPace, cornerSpeed);

      // Smooth acceleration / braking
      const accelRate = targetSpeed > car.speedKmh ? 28.0 : 45.0; // km/h per second
      car.speedKmh += (targetSpeed - car.speedKmh) * Math.min(1.0, accelRate * dt / 30.0);

      // Advance distance along circuit
      const mPerSec = car.speedKmh / 3.6;
      car.distanceM = (car.distanceM + mPerSec * dt) % totalM;

      // Compute 3D world position and heading
      const s0Idx = Math.floor(car.distanceM / stepM) % samples.length;
      const s1Idx = (s0Idx + 1) % samples.length;
      const t = (car.distanceM % stepM) / stepM;

      const p0 = samples[s0Idx];
      const p1 = samples[s1Idx];

      // Stagger slightly left/right on track for overtaking realism
      const laneOffset = (c % 2 === 0 ? -1.8 : 1.8);
      const binorm = p0.binormal.clone().lerp(p1.binormal, t).normalize();

      car.worldPos.copy(p0.position).lerp(p1.position, t).addScaledVector(binorm, laneOffset);
      const tangent = p0.tangent.clone().lerp(p1.tangent, t).normalize();
      car.headingRad = Math.atan2(tangent.x, tangent.z);
    }
  }

  /**
   * Returns nearby competitor cars within proximity range (e.g. 35 meters) for the in-cockpit Micro Radar.
   */
  public getNearbyCars(playerPos: THREE.Vector3, maxRadiusM = 35.0): NearbyCar[] {
    const nearby: NearbyCar[] = [];

    for (const car of this.cars) {
      const d = playerPos.distanceTo(car.worldPos);
      if (d <= maxRadiusM) {
        nearby.push({
          id: car.id,
          number: car.number,
          color: car.color,
          worldPos: car.worldPos.clone(),
          headingRad: car.headingRad,
          speedKmh: car.speedKmh,
        });
      }
    }

    return nearby;
  }
}
