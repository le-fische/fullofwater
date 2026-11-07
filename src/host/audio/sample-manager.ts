/**
 * Audio Sample Manager & Multi-Class Sound Profile Configurator
 * Provides sample loading, audio decoding, pitch-shifted looped playback,
 * and standard sound profile mapping across vehicle classes (GT, F1, Prototype).
 */

export type VehicleClassId = 'gt' | 'f1' | 'prototype';

export interface VehicleSoundConfig {
  classId: VehicleClassId;
  gearMeshTeeth: number;
  diffWhineRatio: number;
  engineCylinders: number;
  samplePaths: {
    shiftUp?: string;
    shiftDown?: string;
    backfire?: string;
    transmissionWhine?: string;
    engineIdle?: string;
    engineRedline?: string;
  };
}

export const STANDARD_SOUND_PROFILES: Record<VehicleClassId, VehicleSoundConfig> = {
  gt: {
    classId: 'gt',
    gearMeshTeeth: 32, // Hewland sequential spur gear mesh
    diffWhineRatio: 11.2, // Differential ring & pinion ground whine ratio
    engineCylinders: 6, // 4.2L NA flat-six
    samplePaths: {
      shiftUp: '/assets/audio/gt/shift_up.wav',
      shiftDown: '/assets/audio/gt/shift_down.wav',
      backfire: '/assets/audio/gt/backfire.wav',
    },
  },
  f1: {
    classId: 'f1',
    gearMeshTeeth: 38, // Ultra-high RPM 8-speed seamless shift box
    diffWhineRatio: 14.5, // High-speed bevel ring & pinion
    engineCylinders: 6, // 1.6L V6 Turbo-hybrid (15,000 RPM)
    samplePaths: {
      shiftUp: '/assets/audio/f1/shift_up.wav',
      shiftDown: '/assets/audio/f1/shift_down.wav',
      backfire: '/assets/audio/f1/backfire.wav',
    },
  },
  prototype: {
    classId: 'prototype',
    gearMeshTeeth: 34, // Xtrac 7-speed transverse sequential
    diffWhineRatio: 12.0,
    engineCylinders: 8, // 4.0L twin-turbo V8 + front MGU
    samplePaths: {
      shiftUp: '/assets/audio/prototype/shift_up.wav',
      shiftDown: '/assets/audio/prototype/shift_down.wav',
      backfire: '/assets/audio/prototype/backfire.wav',
    },
  },
};

export class AudioSampleManager {
  private ctx: AudioContext | null = null;
  private samples: Map<string, AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();
  private currentConfig: VehicleSoundConfig = STANDARD_SOUND_PROFILES.gt;

  constructor() {}

  setContext(ctx: AudioContext): void {
    this.ctx = ctx;
  }

  setVehicleClass(classId: VehicleClassId): void {
    if (STANDARD_SOUND_PROFILES[classId]) {
      this.currentConfig = STANDARD_SOUND_PROFILES[classId];
    }
  }

  getConfig(): VehicleSoundConfig {
    return this.currentConfig;
  }

  /**
   * Asynchronously load and cache an audio file.
   * Gracefully returns null if file is missing (allowing seamless procedural synthesis fallback).
   */
  async loadSample(id: string, url: string): Promise<AudioBuffer | null> {
    if (this.samples.has(id)) {
      return this.samples.get(id)!;
    }

    if (this.loadingPromises.has(id)) {
      return this.loadingPromises.get(id)!;
    }

    if (!this.ctx) return null;

    const promise = (async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const arrayBuffer = await resp.arrayBuffer();
        const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
        this.samples.set(id, decoded);
        return decoded;
      } catch {
        // Sample file not present or unreadable - procedural synthesis active
        return null;
      } finally {
        this.loadingPromises.delete(id);
      }
    })();

    this.loadingPromises.set(id, promise);
    return promise;
  }

  hasSample(id: string): boolean {
    return this.samples.has(id);
  }

  getSample(id: string): AudioBuffer | undefined {
    return this.samples.get(id);
  }

  /**
   * Plays a one-shot sample buffer if loaded. Returns true if played, false if not loaded.
   */
  playOneShot(
    id: string,
    destination: AudioNode,
    volume = 1.0,
    playbackRate = 1.0
  ): boolean {
    const buffer = this.samples.get(id);
    if (!buffer || !this.ctx) return false;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      const gain = this.ctx.createGain();
      gain.gain.value = volume;

      source.connect(gain);
      gain.connect(destination);

      source.start();
      return true;
    } catch {
      return false;
    }
  }
}
