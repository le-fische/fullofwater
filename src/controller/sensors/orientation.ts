import { clamp, degToRad } from '../../common/math';
import { SteeringFilter } from './filter';

export interface OrientationData {
  steer: number; // -1.0 to 1.0
  angleDeg: number;
  inPlaneG: number;
  isCalibrated: boolean;
}

export class DeviceOrientationManager {
  private filter = new SteeringFilter(0.8, 0.015, 1.0);
  private calibratedNeutralAngle = 0; // Absolute truth neutral: 0.0 rad when horizontal edge is flat
  private isCalibrated = true;
  private currentSteer = 0;
  private currentAngleDeg = 0;
  private currentInPlaneG = 0;
  private lastMotionTime = 0;

  // Max tilt angle in degrees for full lock (+/- 55 deg for progressive sim feel)
  public maxTiltAngleDeg = 55.0;

  // Deadzone around center (in normalized range [-1, 1], approx 1.3 deg)
  public deadzone = 0.024;

  // Exponent for non-linear progressive steering response curve
  public steerExponent = 1.75;

  constructor() {
    this.handleMotion = this.handleMotion.bind(this);
    this.handleOrientation = this.handleOrientation.bind(this);
  }

  /**
   * Request permissions on iOS 13+ devices.
   * Prompts once for motion/orientation permission in the user gesture window.
   */
  async requestPermission(): Promise<boolean> {
    // 1. DeviceOrientationEvent (primary motion API on iOS Safari)
    const OrientTyped = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
    };
    if (typeof OrientTyped?.requestPermission === 'function') {
      try {
        const response = await OrientTyped.requestPermission();
        if (response === 'granted') return true;
        if (response === 'denied') return false;
      } catch (err) {
        console.warn('DeviceOrientationEvent permission error:', err);
      }
    }

    // 2. DeviceMotionEvent fallback if orientation permission API was not present
    const MotionTyped = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
    };
    if (typeof MotionTyped?.requestPermission === 'function') {
      try {
        const response = await MotionTyped.requestPermission();
        return response === 'granted';
      } catch (err) {
        console.warn('DeviceMotionEvent permission error:', err);
      }
    }

    return true;
  }

  start(): void {
    window.addEventListener('devicemotion', this.handleMotion, { passive: false });
    window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
  }

  stop(): void {
    window.removeEventListener('devicemotion', this.handleMotion);
    window.removeEventListener('deviceorientation', this.handleOrientation);
    this.filter.reset();
  }

  calibrate(): void {
    // Reset to absolute truth horizontal neutral (0.0 rad)
    this.calibratedNeutralAngle = 0;
    this.filter.reset();
    this.isCalibrated = true;
  }

  private handleMotion(event: DeviceMotionEvent): void {
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const gx = acc.x;
    const gy = acc.y;
    const inPlaneG = Math.sqrt(gx * gx + gy * gy);
    this.currentInPlaneG = inPlaneG;

    // Only process via devicemotion if there is sufficient in-plane gravity vector (>= 0.35 m/s^2)
    // If phone is resting flat on a surface, let handleOrientation process orientation instead.
    if (inPlaneG < 0.35) {
      return;
    }

    this.lastMotionTime = performance.now();

    // 1. Determine Landscape Orientation Mode (Primary vs Secondary):
    // Primary: USB-C port on right (front camera on left)
    // Secondary: USB-C port on left (front camera on right)
    let isLandscapeSecondary = false;

    if (typeof window !== 'undefined' && typeof (window as unknown as { orientation?: number }).orientation === 'number') {
      const winOrientation = (window as unknown as { orientation: number }).orientation;
      if (winOrientation === -90 || winOrientation === 270) {
        isLandscapeSecondary = true;
      }
    } else if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.type === 'string') {
      if (screen.orientation.type.includes('secondary') || screen.orientation.angle === 270) {
        isLandscapeSecondary = true;
      }
    }

    // Dynamic Gravity Confirmation (self-healing if OS rotation event lagged):
    if (Math.abs(gx) > 2.5) {
      isLandscapeSecondary = gx < -2.5;
    }

    // 2. Absolute Truth Neutral Steering Angle:
    // In landscape mode, the long edge of the screen is the hardware Y-axis.
    // When the horizontal landscape horizon is level (gy = 0), rawAngleRad is EXACTLY 0.0 rad.
    // Clockwise tilt (Turn Right) produces positive angle (+deg, steer > 0).
    // Counter-clockwise tilt (Turn Left) produces negative angle (-deg, steer < 0).
    let rawAngleRad = 0;
    if (isLandscapeSecondary) {
      // Landscape-Secondary (USB-C on left, gx < 0)
      rawAngleRad = Math.atan2(-gy, -gx);
    } else {
      // Landscape-Primary (USB-C on right, gx > 0)
      rawAngleRad = Math.atan2(gy, gx);
    }

    this.processAngle(rawAngleRad);
  }

  /**
   * Dual Fallback: processes DeviceOrientationEvent (gyro/compass/gravity fusion)
   * if devicemotion does not provide updates or if device is held flat.
   */
  private handleOrientation(event: DeviceOrientationEvent): void {
    // If devicemotion is actively processing high-confidence motion, prioritize devicemotion
    if (performance.now() - this.lastMotionTime < 150) {
      return;
    }
    if (event.gamma === null && event.beta === null) return;

    let orientAngle = 90;
    if (typeof window !== 'undefined' && typeof (window as unknown as { orientation?: number }).orientation === 'number') {
      orientAngle = (window as unknown as { orientation: number }).orientation;
    } else if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
      orientAngle = screen.orientation.angle;
    }

    // In landscape mode:
    // When orientAngle == 90 (USB-C right): tilting right tilts beta
    // When orientAngle == -90 / 270 (USB-C left): inverted
    let tiltDeg = 0;
    if (orientAngle === 90) {
      tiltDeg = -(event.beta ?? 0);
    } else if (orientAngle === -90 || orientAngle === 270) {
      tiltDeg = event.beta ?? 0;
    } else {
      tiltDeg = event.gamma ?? 0;
    }

    const rawAngleRad = degToRad(tiltDeg);
    this.processAngle(rawAngleRad);
  }

  private processAngle(rawAngleRad: number): void {
    // Compute relative angle to absolute neutral (calibratedNeutralAngle = 0 by default)
    let deltaAngle = rawAngleRad - this.calibratedNeutralAngle;
    // Normalize to [-PI, PI]
    while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    const nowSec = performance.now() / 1000;

    // Linear fraction of max tilt angle
    const maxAngleRad = degToRad(this.maxTiltAngleDeg);
    const linearFraction = clamp(deltaAngle / maxAngleRad, -1.0, 1.0);

    // Apply deadzone around center
    let shapedSteer = 0;
    const absFraction = Math.abs(linearFraction);
    if (absFraction > this.deadzone) {
      const remapped = (absFraction - this.deadzone) / (1.0 - this.deadzone);
      shapedSteer = Math.sign(linearFraction) * Math.pow(remapped, this.steerExponent);
    }

    // Filter with One Euro filter: responsive when moving, rock-solid stable when held still
    this.currentSteer = clamp(this.filter.process(shapedSteer, nowSec), -1.0, 1.0);
    this.currentAngleDeg = (deltaAngle * 180) / Math.PI;
  }

  getSteer(): number {
    return this.currentSteer;
  }

  getTelemetry(): OrientationData {
    return {
      steer: this.currentSteer,
      angleDeg: this.currentAngleDeg,
      inPlaneG: this.currentInPlaneG,
      isCalibrated: this.isCalibrated,
    };
  }
}
