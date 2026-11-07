import * as THREE from 'three';
import { VehicleTelemetry } from '../../../common/types';

export type CockpitType = 'gt' | 'f1' | 'prototype';

export interface CockpitRig {
  readonly type: CockpitType;
  readonly group: THREE.Group;
  readonly steeringWheelGroup: THREE.Group;
  readonly driverEyeOffset: THREE.Vector3;
  readonly verticalFov: number;

  /**
   * Optional mesh representing the in-cockpit digital rear-view mirror LCD.
   * If provided, the RearViewMirrorRenderer can render live track feed onto it.
   */
  getRearViewScreenMesh?(): THREE.Mesh | null;

  /**
   * Optional micro radar display mounted directly beneath the rear-view mirror screen.
   */
  getMicroRadarDisplay?(): import('./micro-radar-display').MicroRadarDisplay | null;

  /**
   * Update visual cockpit state (rotating steering wheel, hands, LCD dash, shift LEDs).
   */
  update(telemetry: VehicleTelemetry, steerAngleDeg: number, dt: number): void;

  /**
   * Clean up textures, geometries, and materials.
   */
  dispose(): void;
}
