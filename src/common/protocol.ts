/**
 * Binary WebSocket Packet Layout and packing / unpacking utilities.
 * Follows spec.md Section 3.1.
 */

export const PACKET_MAGIC = 0x5243; // 'RC'

// Phone -> Host: 8 bytes
export const PHONE_PACKET_SIZE = 8;
// Host -> Phone: 6 bytes
export const HOST_PACKET_SIZE = 6;

// Emergency Phase II-A: Peer-to-Peer WebRTC Pose Packet Sizes & Magic
export const PEER_POSE_MAGIC_V1 = 0x50325031; // 'P2P1' (Legacy 44-byte frame)
export const PEER_POSE_MAGIC_V2 = 0x50325032; // 'P2P2' (Phase II-A 56-byte frame with velocity)
export const PEER_POSE_V1_SIZE = 44;
export const PEER_POSE_V2_SIZE = 56;

export enum ControllerButtons {
  NONE = 0,
  RESET = 1 << 0,
  CYCLE_CAMERA = 1 << 1,
  REAR_VIEW = 1 << 2,
  START_ENGINE = 1 << 3,
}

export enum TelemetryFlags {
  NONE = 0,
  SHIFT_LIGHT = 1 << 0,
  ABS_ACTIVE = 1 << 1,
  TC_ACTIVE = 1 << 2,
}

/**
 * Packs controller inputs into a compact 8-byte ArrayBuffer.
 */
export class ControllerPacketEncoder {
  private buffer = new ArrayBuffer(PHONE_PACKET_SIZE);
  private view = new DataView(this.buffer);

  encode(seq: number, steer: number, throttle: number, brake: number, buttons: number): ArrayBuffer {
    const s16 = Math.round(Math.max(-1, Math.min(1, steer)) * 32767);
    const u8Throttle = Math.round(Math.max(0, Math.min(1, throttle)) * 255);
    const u8Brake = Math.round(Math.max(0, Math.min(1, brake)) * 255);

    this.view.setUint16(0, seq & 0xffff, true);
    this.view.setInt16(2, s16, true);
    this.view.setUint8(4, u8Throttle);
    this.view.setUint8(5, u8Brake);
    this.view.setUint8(6, buttons & 0xff);
    this.view.setUint8(7, 0); // reserved

    return this.buffer;
  }
}

/**
 * Decodes 8-byte ArrayBuffer into controller input values.
 */
export class ControllerPacketDecoder {
  decode(buffer: ArrayBuffer | ArrayBufferView): {
    seq: number;
    steer: number;
    throttle: number;
    brake: number;
    buttons: number;
  } {
    const view = ArrayBuffer.isView(buffer)
      ? new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new DataView(buffer);

    const seq = view.getUint16(0, true);
    const s16 = view.getInt16(2, true);
    const steer = s16 / 32767;
    const throttle = view.getUint8(4) / 255;
    const brake = view.getUint8(5) / 255;
    const buttons = view.getUint8(6);

    return { seq, steer, throttle, brake, buttons };
  }
}

/**
 * Packs host telemetry into a 6-byte ArrayBuffer.
 */
export class TelemetryPacketEncoder {
  private buffer = new ArrayBuffer(HOST_PACKET_SIZE);
  private view = new DataView(this.buffer);

  encode(
    rpmRatio: number,
    gear: number,
    speedKmh: number,
    shiftLight: boolean,
    abs: boolean,
    tc: boolean,
    pingSeq: number
  ): ArrayBuffer {
    const u8Rpm = Math.round(Math.max(0, Math.min(1, rpmRatio)) * 255);
    let flags = 0;
    if (shiftLight) flags |= TelemetryFlags.SHIFT_LIGHT;
    if (abs) flags |= TelemetryFlags.ABS_ACTIVE;
    if (tc) flags |= TelemetryFlags.TC_ACTIVE;

    this.view.setUint8(0, u8Rpm);
    this.view.setInt8(1, Math.max(-1, Math.min(6, gear)));
    this.view.setUint16(2, Math.round(Math.max(0, Math.min(65535, speedKmh))), true);
    this.view.setUint8(4, flags);
    this.view.setUint8(5, pingSeq & 0xff);

    return this.buffer;
  }
}

/**
 * Decodes 6-byte ArrayBuffer into telemetry state.
 */
export class TelemetryPacketDecoder {
  decode(buffer: ArrayBuffer | ArrayBufferView): {
    rpmRatio: number;
    gear: number;
    speedKmh: number;
    shiftLight: boolean;
    abs: boolean;
    tc: boolean;
    pingSeq: number;
  } {
    const view = ArrayBuffer.isView(buffer)
      ? new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new DataView(buffer);

    const rpmRatio = view.getUint8(0) / 255;
    const gear = view.getInt8(1);
    const speedKmh = view.getUint16(2, true);
    const flags = view.getUint8(4);
    const pingSeq = view.getUint8(5);

    return {
      rpmRatio,
      gear,
      speedKmh,
      shiftLight: (flags & TelemetryFlags.SHIFT_LIGHT) !== 0,
      abs: (flags & TelemetryFlags.ABS_ACTIVE) !== 0,
      tc: (flags & TelemetryFlags.TC_ACTIVE) !== 0,
      pingSeq,
    };
  }
}

export type BridgeControlMessage =
  | { type: 'controller_connected' }
  | { type: 'controller_disconnected' };
