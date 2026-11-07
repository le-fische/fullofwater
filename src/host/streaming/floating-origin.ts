import * as THREE from 'three';

/**
 * Floating Origin Manager.
 * Mitigates 32-bit floating point precision loss and vertex jitter
 * across the 20.8 km Nürburgring circuit by maintaining a global world offset.
 */
export class FloatingOriginManager {
  public globalOffset = new THREE.Vector3(0, 0, 0);
  public readonly thresholdDistanceM = 1200; // Recenter when car moves > 1200m from current origin

  /**
   * Checks if recentering is needed based on car position.
   * Returns true if origin was shifted.
   */
  public checkAndShift(carPosition: THREE.Vector3): { shifted: boolean; shiftDelta: THREE.Vector3 } {
    const horizontalDistSq = carPosition.x * carPosition.x + carPosition.z * carPosition.z;
    const thresholdSq = this.thresholdDistanceM * this.thresholdDistanceM;

    if (horizontalDistSq > thresholdSq) {
      const shiftDelta = new THREE.Vector3(carPosition.x, 0, carPosition.z);
      this.globalOffset.add(shiftDelta);

      // Car position is adjusted by negative shiftDelta
      carPosition.sub(shiftDelta);

      return { shifted: true, shiftDelta };
    }

    return { shifted: false, shiftDelta: new THREE.Vector3(0, 0, 0) };
  }

  /**
   * Converts a global track coordinate to current local scene coordinates.
   */
  public toLocal(globalPoint: THREE.Vector3): THREE.Vector3 {
    return globalPoint.clone().sub(this.globalOffset);
  }

  /**
   * Converts a local scene coordinate to absolute global track coordinate.
   */
  public toGlobal(localPoint: THREE.Vector3): THREE.Vector3 {
    return localPoint.clone().add(this.globalOffset);
  }
}
