import { clamp } from '../../common/math';
import { AudioSampleManager, VehicleClassId } from './sample-manager';

export class EngineAudioSynth {
  private ctx: AudioContext | null = null;
  private isStarted = false;
  private isIgnited = false;
  private isStartingSequence = false;
  private ignitionEndTime = 0;
  private lastGear = 0;

  // Sample audio manager & class profiles
  private sampleMgr = new AudioSampleManager();

  // Engine combustion oscillators & acoustic formant filters
  private fundamentalOsc: OscillatorNode | null = null;
  private harmonicOsc1: OscillatorNode | null = null;
  private harmonicOsc2: OscillatorNode | null = null;
  private subBassOsc: OscillatorNode | null = null;
  private distortionNode: WaveShaperNode | null = null;

  private subBassGain: GainNode | null = null;
  private engineGain: GainNode | null = null;

  // Straight-cut transmission whine nodes (spur gear tooth meshing)
  private gearMeshOsc: OscillatorNode | null = null;
  private gearMeshHarmonicOsc: OscillatorNode | null = null;
  private gearMeshFilter: BiquadFilterNode | null = null;
  private gearMeshLowPass: BiquadFilterNode | null = null;
  private gearMeshNotch: BiquadFilterNode | null = null;
  private gearMeshGain: GainNode | null = null;
  private overrunLfo: OscillatorNode | null = null;
  private overrunTremoloGain: GainNode | null = null;

  // Driveshaft & differential final drive whine nodes
  private diffWhineOsc: OscillatorNode | null = null;
  private diffWhineFilter: BiquadFilterNode | null = null;
  private diffWhineGain: GainNode | null = null;

  // Tire squeal nodes
  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireFilterNode: BiquadFilterNode | null = null;
  private tireGain: GainNode | null = null;

  // Aerodynamic wind noise nodes
  private windNoiseNode: AudioBufferSourceNode | null = null;
  private windFilterNode: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // Master output bus with DynamicsCompressor brickwall limiter
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;

  constructor() {
    // AudioContext is initialized on first user gesture
  }

  setVehicleClass(classId: VehicleClassId): void {
    this.sampleMgr.setVehicleClass(classId);
  }

  async init(): Promise<void> {
    if (this.isStarted) {
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.sampleMgr.setContext(this.ctx);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.75;

    // Phase 5 Step 5.12: Master Output Dynamics Compressor / Brickwall Limiter
    // Prevents acoustic clipping, painful transient spikes, and ear damage during backfires or crashes
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -6; // -6 dBFS
    this.masterCompressor.knee.value = 12;      // 12 dB
    this.masterCompressor.ratio.value = 8;      // 8:1
    this.masterCompressor.attack.value = 0.003; // 3 ms
    this.masterCompressor.release.value = 0.15; // 150 ms

    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.ctx.destination);

    this.setupEngineSound();
    this.setupTransmissionSound();
    this.setupTireSound();
    this.setupWindSound();

    this.isStarted = true;
  }

  public isRunning(): boolean {
    return this.isIgnited || this.isStartingSequence;
  }

  /**
   * Immediately silences and mutes all engine combustion, straight-cut gearbox whine,
   * tire noise, wind, and master output bus. Guarantees complete silence in menus.
   */
  public stopEngine(): void {
    this.isIgnited = false;
    this.isStartingSequence = false;
    this.lastGear = 0;

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.engineGain) {
      this.engineGain.gain.cancelScheduledValues(now);
      this.engineGain.gain.setValueAtTime(0.0, now);
    }
    if (this.subBassGain) {
      this.subBassGain.gain.cancelScheduledValues(now);
      this.subBassGain.gain.setValueAtTime(0.0, now);
    }
    if (this.gearMeshGain) {
      this.gearMeshGain.gain.cancelScheduledValues(now);
      this.gearMeshGain.gain.setValueAtTime(0.0, now);
    }
    if (this.diffWhineGain) {
      this.diffWhineGain.gain.cancelScheduledValues(now);
      this.diffWhineGain.gain.setValueAtTime(0.0, now);
    }
    if (this.overrunTremoloGain) {
      this.overrunTremoloGain.gain.cancelScheduledValues(now);
      this.overrunTremoloGain.gain.setValueAtTime(0.0, now);
    }
    if (this.tireGain) {
      this.tireGain.gain.cancelScheduledValues(now);
      this.tireGain.gain.setValueAtTime(0.0, now);
    }
    if (this.windGain) {
      this.windGain.gain.cancelScheduledValues(now);
      this.windGain.gain.setValueAtTime(0.0, now);
    }
    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(0.0, now);
    }
  }

  /**
   * Triggers an authentic motorsport starter motor & ignition turnover sequence:
   * 1. High-torque starter motor whine + 4 rhythmic compression thuds (0.0s - 0.52s)
   * 2. Spark ignition cough + RPM flare up to 3,400 RPM (0.52s - 0.75s)
   * 3. Smooth settling down to 2,000 RPM flat-six idle rumble (0.75s - 1.65s)
   */
  async startIgnition(): Promise<void> {
    await this.init();
    if (!this.ctx || !this.masterGain || this.isIgnited || this.isStartingSequence) {
      return;
    }

    this.isStartingSequence = true;
    const now = this.ctx.currentTime;
    const t0 = now + 0.02;

    // Restore master volume if previously muted in menus
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.75, now);

    // --- 1. Starter Motor Whine ---
    const starterOsc = this.ctx.createOscillator();
    const starterGain = this.ctx.createGain();
    const starterFilter = this.ctx.createBiquadFilter();

    starterOsc.type = 'sawtooth';
    starterOsc.frequency.setValueAtTime(110, t0);
    starterOsc.frequency.exponentialRampToValueAtTime(165, t0 + 0.48);

    starterFilter.type = 'bandpass';
    starterFilter.frequency.setValueAtTime(650, t0);
    starterFilter.Q.setValueAtTime(3.0, t0);

    starterGain.gain.setValueAtTime(0.001, t0);
    starterGain.gain.exponentialRampToValueAtTime(0.24, t0 + 0.05);
    starterGain.gain.setValueAtTime(0.24, t0 + 0.45);
    starterGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.54);

    starterOsc.connect(starterFilter);
    starterFilter.connect(starterGain);
    starterGain.connect(this.masterGain);

    starterOsc.start(t0);
    starterOsc.stop(t0 + 0.58);

    // --- 2. Cranking Compression Chugs (4 rhythmic top-dead-center thuds) ---
    const chugTimes = [t0 + 0.08, t0 + 0.20, t0 + 0.32, t0 + 0.44];
    for (const ct of chugTimes) {
      const chugOsc = this.ctx.createOscillator();
      const chugGain = this.ctx.createGain();

      chugOsc.type = 'sine';
      chugOsc.frequency.setValueAtTime(75, ct);
      chugOsc.frequency.exponentialRampToValueAtTime(35, ct + 0.06);

      chugGain.gain.setValueAtTime(0.32, ct);
      chugGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.065);

      chugOsc.connect(chugGain);
      chugGain.connect(this.masterGain);

      chugOsc.start(ct);
      chugOsc.stop(ct + 0.07);
    }

    // --- 3. Ignition Spark & Exhaust Cough (at t0 + 0.52s) ---
    const popBuffer = this.createNoiseBuffer();
    const popSource = this.ctx.createBufferSource();
    const popFilter = this.ctx.createBiquadFilter();
    const popGain = this.ctx.createGain();

    popSource.buffer = popBuffer;
    popFilter.type = 'bandpass';
    popFilter.frequency.setValueAtTime(1200, t0 + 0.52);
    popFilter.Q.setValueAtTime(2.2, t0 + 0.52);

    popGain.gain.setValueAtTime(0.38, t0 + 0.52);
    popGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.62);

    popSource.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(this.masterGain);

    popSource.start(t0 + 0.52);
    popSource.stop(t0 + 0.64);

    // --- 4. Flat-Six Combustion Flare & Settle to 2,000 RPM Idle ---
    const flareStart = t0 + 0.52;
    const flarePeak = t0 + 0.75;
    const settleEnd = t0 + 1.65;
    this.ignitionEndTime = settleEnd;

    if (this.fundamentalOsc && this.harmonicOsc1 && this.harmonicOsc2 && this.engineGain) {
      this.engineGain.gain.cancelScheduledValues(flareStart);
      this.engineGain.gain.setValueAtTime(0.001, flareStart);
      this.engineGain.gain.exponentialRampToValueAtTime(0.36, flarePeak);
      this.engineGain.gain.exponentialRampToValueAtTime(0.24, settleEnd);

      this.fundamentalOsc.frequency.cancelScheduledValues(flareStart);
      this.fundamentalOsc.frequency.setValueAtTime(80, flareStart);
      this.fundamentalOsc.frequency.exponentialRampToValueAtTime(175, flarePeak);
      this.fundamentalOsc.frequency.exponentialRampToValueAtTime(100, settleEnd);

      this.harmonicOsc1.frequency.cancelScheduledValues(flareStart);
      this.harmonicOsc1.frequency.setValueAtTime(160, flareStart);
      this.harmonicOsc1.frequency.exponentialRampToValueAtTime(350, flarePeak);
      this.harmonicOsc1.frequency.exponentialRampToValueAtTime(200, settleEnd);

      this.harmonicOsc2.frequency.cancelScheduledValues(flareStart);
      this.harmonicOsc2.frequency.setValueAtTime(320, flareStart);
      this.harmonicOsc2.frequency.exponentialRampToValueAtTime(700, flarePeak);
      this.harmonicOsc2.frequency.exponentialRampToValueAtTime(400, settleEnd);
    }

    setTimeout(() => {
      this.isIgnited = true;
      this.isStartingSequence = false;
    }, (settleEnd - now) * 1000);
  }

  private makeDistortionCurve(amount = 25): Float32Array {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;

    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private setupEngineSound(): void {
    if (!this.ctx || !this.masterGain) return;

    // 1. Fundamental oscillator (3 firings per rev for 6-cyl flat-six)
    this.fundamentalOsc = this.ctx.createOscillator();
    this.fundamentalOsc.type = 'sawtooth';
    this.fundamentalOsc.frequency.value = 100; // 2,000 RPM idle

    // 2. Harmonic overtone 1 (intake pulse)
    this.harmonicOsc1 = this.ctx.createOscillator();
    this.harmonicOsc1.type = 'triangle';
    this.harmonicOsc1.frequency.value = 200;

    // 3. Harmonic overtone 2 (valve-train and exhaust rasp)
    this.harmonicOsc2 = this.ctx.createOscillator();
    this.harmonicOsc2.type = 'sawtooth';
    this.harmonicOsc2.frequency.value = 400;

    // 4. Sub-bass oscillator (chassis body vibration)
    this.subBassOsc = this.ctx.createOscillator();
    this.subBassOsc.type = 'sine';
    this.subBassOsc.frequency.value = 50;

    // Distortion waveshaper for raw flat-six exhaust crackle
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve = this.makeDistortionCurve(18) as unknown as Float32Array<ArrayBuffer>;
    this.distortionNode.oversample = '4x';

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0; // Muted until starter ignition triggers

    this.subBassGain = this.ctx.createGain();
    this.subBassGain.gain.value = 0.0;

    this.fundamentalOsc.connect(this.distortionNode);
    this.harmonicOsc1.connect(this.distortionNode);
    this.harmonicOsc2.connect(this.distortionNode);

    this.distortionNode.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.subBassOsc.connect(this.subBassGain);
    this.subBassGain.connect(this.masterGain);

    this.fundamentalOsc.start();
    this.harmonicOsc1.start();
    this.harmonicOsc2.start();
    this.subBassOsc.start();
  }

  /**
   * Sets up high-pitched straight-cut spur gear whine, driveshaft ring & pinion whine,
   * and trailing overrun gear chatter tremolo.
   */
  private setupTransmissionSound(): void {
    if (!this.ctx || !this.masterGain) return;

    // 1. Straight-cut spur gear mesh (tracks engine RPM and gear ratio)
    this.gearMeshOsc = this.ctx.createOscillator();
    this.gearMeshOsc.type = 'sawtooth';
    this.gearMeshOsc.frequency.value = 1060; // Base 2,000 RPM mesh frequency

    this.gearMeshHarmonicOsc = this.ctx.createOscillator();
    this.gearMeshHarmonicOsc.type = 'triangle';
    this.gearMeshHarmonicOsc.frequency.value = 2120; // 2nd harmonic overtone

    // Phase 5 Step 5.12: Headphone-Safe Gearbox Synthesis & Ear-Fatigue Mitigation
    // High-Q bandpass replaced by moderated bandpass + 2nd-order Butterworth low-pass + 3.5 kHz ear-canal notch filter
    this.gearMeshFilter = this.ctx.createBiquadFilter();
    this.gearMeshFilter.type = 'bandpass';
    this.gearMeshFilter.frequency.value = 1060;
    this.gearMeshFilter.Q.value = 2.2;

    // 2nd-Order Butterworth Low-Pass Filter at 3,200 Hz (-12 dB/octave) rolls off piercing high frequencies
    this.gearMeshLowPass = this.ctx.createBiquadFilter();
    this.gearMeshLowPass.type = 'lowpass';
    this.gearMeshLowPass.frequency.value = 3200;
    this.gearMeshLowPass.Q.value = 0.7071;

    // Static Parametric Notch Filter at 3,500 Hz (Q = 3.0, gain -8.0 dB) targets human ear-canal resonance
    this.gearMeshNotch = this.ctx.createBiquadFilter();
    this.gearMeshNotch.type = 'notch';
    this.gearMeshNotch.frequency.value = 3500;
    this.gearMeshNotch.Q.value = 3.0;

    this.gearMeshGain = this.ctx.createGain();
    this.gearMeshGain.gain.value = 0.0;

    // 32 Hz tremolo LFO for overrun gear tooth backlash chatter
    this.overrunLfo = this.ctx.createOscillator();
    this.overrunLfo.type = 'sine';
    this.overrunLfo.frequency.value = 32.0;

    this.overrunTremoloGain = this.ctx.createGain();
    this.overrunTremoloGain.gain.value = 0.0;

    this.gearMeshOsc.connect(this.gearMeshFilter);
    this.gearMeshHarmonicOsc.connect(this.gearMeshFilter);
    this.gearMeshFilter.connect(this.gearMeshLowPass);
    this.gearMeshLowPass.connect(this.gearMeshNotch);
    this.gearMeshNotch.connect(this.gearMeshGain);
    this.gearMeshGain.connect(this.masterGain);

    this.gearMeshOsc.start();
    this.gearMeshHarmonicOsc.start();
    this.overrunLfo.start();

    // 2. Driveshaft & Differential final drive ring-and-pinion whine (tracks vehicle road speed)
    this.diffWhineOsc = this.ctx.createOscillator();
    this.diffWhineOsc.type = 'triangle';
    this.diffWhineOsc.frequency.value = 100;

    this.diffWhineFilter = this.ctx.createBiquadFilter();
    this.diffWhineFilter.type = 'bandpass';
    this.diffWhineFilter.frequency.value = 100;
    this.diffWhineFilter.Q.value = 4.5;

    this.diffWhineGain = this.ctx.createGain();
    this.diffWhineGain.gain.value = 0.0;

    this.diffWhineOsc.connect(this.diffWhineFilter);
    this.diffWhineFilter.connect(this.diffWhineGain);
    this.diffWhineGain.connect(this.masterGain);

    this.diffWhineOsc.start();
  }

  private createNoiseBuffer(): AudioBuffer {
    const bufferSize = this.ctx!.sampleRate * 2;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private setupTireSound(): void {
    if (!this.ctx || !this.masterGain) return;

    const noiseBuffer = this.createNoiseBuffer();
    this.tireNoiseNode = this.ctx.createBufferSource();
    this.tireNoiseNode.buffer = noiseBuffer;
    this.tireNoiseNode.loop = true;

    this.tireFilterNode = this.ctx.createBiquadFilter();
    this.tireFilterNode.type = 'bandpass';
    this.tireFilterNode.frequency.value = 1100;
    this.tireFilterNode.Q.value = 3.0;

    this.tireGain = this.ctx.createGain();
    this.tireGain.gain.value = 0.0;

    this.tireNoiseNode.connect(this.tireFilterNode);
    this.tireFilterNode.connect(this.tireGain);
    this.tireGain.connect(this.masterGain);

    this.tireNoiseNode.start();
  }

  private setupWindSound(): void {
    if (!this.ctx || !this.masterGain) return;

    const noiseBuffer = this.createNoiseBuffer();
    this.windNoiseNode = this.ctx.createBufferSource();
    this.windNoiseNode.buffer = noiseBuffer;
    this.windNoiseNode.loop = true;

    this.windFilterNode = this.ctx.createBiquadFilter();
    this.windFilterNode.type = 'highpass';
    this.windFilterNode.frequency.value = 450;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;

    this.windNoiseNode.connect(this.windFilterNode);
    this.windFilterNode.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    this.windNoiseNode.start();
  }

  /**
   * Triggers realistic mechanical dog-ring shift clash, pneumatic actuator solenoid hiss,
   * and downshift auto-blip exhaust backfire crackle.
   */
  triggerGearshift(_oldGear: number, _newGear: number, isDownshift: boolean): void {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // Check if sample manager has a recorded one-shot sample loaded
    const sampleKey = isDownshift ? 'shiftDown' : 'shiftUp';
    const playedSample = this.sampleMgr.playOneShot(sampleKey, this.masterGain, 0.45);

    // Procedural dog-ring mechanical strike & pneumatic blast
    // 1. Dog-ring metallic clash (pitch sweep 2,400 Hz -> 420 Hz in 35 ms)
    const clashOsc = this.ctx.createOscillator();
    const clashFilter = this.ctx.createBiquadFilter();
    const clashGain = this.ctx.createGain();

    clashOsc.type = 'triangle';
    clashOsc.frequency.setValueAtTime(2400, now);
    clashOsc.frequency.exponentialRampToValueAtTime(420, now + 0.035);

    clashFilter.type = 'bandpass';
    clashFilter.frequency.setValueAtTime(1800, now);
    clashFilter.Q.setValueAtTime(4.0, now);

    clashGain.gain.setValueAtTime(playedSample ? 0.12 : 0.32, now);
    clashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    clashOsc.connect(clashFilter);
    clashFilter.connect(clashGain);
    clashGain.connect(this.masterGain);

    clashOsc.start(now);
    clashOsc.stop(now + 0.05);

    // 2. Driveline chassis thump (80 Hz mechanical impulse)
    const thumpOsc = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();

    thumpOsc.type = 'sine';
    thumpOsc.frequency.setValueAtTime(90, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(40, now + 0.04);

    thumpGain.gain.setValueAtTime(0.35, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(this.masterGain);

    thumpOsc.start(now);
    thumpOsc.stop(now + 0.05);

    // 3. Pneumatic actuator solenoid burst (high-pressure air release 'tssh')
    const airBuffer = this.createNoiseBuffer();
    const airSource = this.ctx.createBufferSource();
    const airFilter = this.ctx.createBiquadFilter();
    const airGain = this.ctx.createGain();

    airSource.buffer = airBuffer;
    airFilter.type = 'bandpass';
    airFilter.frequency.setValueAtTime(3400, now);
    airFilter.Q.setValueAtTime(2.5, now);

    airGain.gain.setValueAtTime(0.20, now);
    airGain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

    airSource.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(this.masterGain);

    airSource.start(now);
    airSource.stop(now + 0.042);

    // 4. Downshift auto-blip exhaust backfire crackle
    if (isDownshift) {
      const crackBuffer = this.createNoiseBuffer();
      const crackSource = this.ctx.createBufferSource();
      const crackFilter = this.ctx.createBiquadFilter();
      const crackGain = this.ctx.createGain();

      crackSource.buffer = crackBuffer;
      crackFilter.type = 'lowpass';
      crackFilter.frequency.setValueAtTime(2600, now + 0.015);

      crackGain.gain.setValueAtTime(0.001, now);
      crackGain.gain.setValueAtTime(0.36, now + 0.018);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      crackSource.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.masterGain);

      crackSource.start(now + 0.015);
      crackSource.stop(now + 0.08);
    }
  }

  /**
   * Update synth parameters based on physics state.
   */
  update(
    rpm: number,
    throttle: number,
    speedKmh: number,
    gear: number,
    maxSlipAngleRad: number,
    isShifting: boolean,
    isDownshiftBlip = false,
    isCockpitView = true
  ): void {
    if (!this.isStarted || !this.ctx) return;

    const now = this.ctx.currentTime;

    // Detect gear shift transition to trigger mechanical dog-ring clank & pneumatic bang
    if (gear !== this.lastGear) {
      const isDownshift = gear < this.lastGear && this.lastGear > 0;
      this.triggerGearshift(this.lastGear, gear, isDownshift || isDownshiftBlip);
      this.lastGear = gear;
    }

    // Starting sequence guard
    if (this.isStartingSequence && now < this.ignitionEndTime) {
      if (throttle <= 0.25) {
        return;
      }
      this.isStartingSequence = false;
      this.isIgnited = true;
    }

    if (!this.isIgnited && !this.isStartingSequence) {
      if (this.engineGain) this.engineGain.gain.setValueAtTime(0.0, now);
      if (this.subBassGain) this.subBassGain.gain.setValueAtTime(0.0, now);
      if (this.gearMeshGain) this.gearMeshGain.gain.setValueAtTime(0.0, now);
      if (this.diffWhineGain) this.diffWhineGain.gain.setValueAtTime(0.0, now);
      if (this.tireGain) this.tireGain.gain.setValueAtTime(0.0, now);
      if (this.windGain) this.windGain.gain.setValueAtTime(0.0, now);
      return;
    }

    const soundConfig = this.sampleMgr.getConfig();

    // --- 1. Engine Combustion Frequency (f0 = RPM * (cylinders / 2) / 60) ---
    const cylinders = soundConfig.engineCylinders;
    const f0 = Math.max(30, (rpm * (cylinders / 2)) / 60);

    this.fundamentalOsc?.frequency.setTargetAtTime(f0, now, 0.02);
    this.harmonicOsc1?.frequency.setTargetAtTime(f0 * 2, now, 0.02);
    this.harmonicOsc2?.frequency.setTargetAtTime(f0 * 4, now, 0.02);

    // Sub-bass chassis vibration (f0 / 2)
    const fSub = Math.max(25, f0 / 2);
    this.subBassOsc?.frequency.setTargetAtTime(fSub, now, 0.02);

    // Engine volume & shift dynamics
    if (isDownshiftBlip) {
      // Aggressive throttle blip bark during pneumatic rev-matching
      this.engineGain?.gain.setTargetAtTime(0.40, now, 0.012);
      this.subBassGain?.gain.setTargetAtTime(0.24, now, 0.012);
    } else if (isShifting) {
      // 45ms ignition cut on upshift
      this.engineGain?.gain.setTargetAtTime(0.04, now, 0.01);
      this.subBassGain?.gain.setTargetAtTime(0.04, now, 0.01);
    } else {
      const loadVolume = 0.18 + throttle * 0.22;
      this.engineGain?.gain.setTargetAtTime(loadVolume, now, 0.04);
      const subVolume = (0.08 + throttle * 0.18) * (isCockpitView ? 1.0 : 0.7);
      this.subBassGain?.gain.setTargetAtTime(subVolume, now, 0.04);
    }

    // --- 2. Straight-Cut Gearbox Whine (Spur Gear Tooth Meshing) ---
    // Frequency tracks engine RPM and selected gear ratio
    const teeth = soundConfig.gearMeshTeeth; // e.g. 32
    let gearRatioMultiplier = 1.0;

    if (gear >= 1 && gear <= 6) {
      gearRatioMultiplier = 1.0 + (gear - 1) * 0.06;
    } else if (gear === -1) {
      gearRatioMultiplier = 0.85; // Reverse gear rougher spur engagement
    }

    const fMesh = Math.max(80, (rpm / 60) * teeth * gearRatioMultiplier);
    this.gearMeshOsc?.frequency.setTargetAtTime(fMesh, now, 0.02);
    this.gearMeshHarmonicOsc?.frequency.setTargetAtTime(fMesh * 2, now, 0.02);
    this.gearMeshFilter?.frequency.setTargetAtTime(fMesh, now, 0.02);

    // Driveshaft & differential final drive whine tracks ground speed directly
    const fDiff = Math.max(35, speedKmh * soundConfig.diffWhineRatio);
    this.diffWhineOsc?.frequency.setTargetAtTime(fDiff, now, 0.02);
    this.diffWhineFilter?.frequency.setTargetAtTime(fDiff, now, 0.02);

    // Gearbox volume dynamics (Drive vs Decel Overrun Chatter vs Neutral)
    let meshVolume = 0;
    let diffVolume = 0;

    if (gear === 0) {
      // Neutral: output shaft decoupled, faint idle bearing whir
      meshVolume = 0.012;
      diffVolume = 0.0;
    } else {
      const rpmRatio = clamp((rpm - 2000) / 7000, 0, 1);
      const speedRatio = clamp(speedKmh / 280, 0, 1);

      // Phase 5 Step 5.12: Whine volume strictly driven by driveline torque
      // Drops by -18 dB (attenuated by factor ~0.125) when cruising or coasting, eliminating persistent headphone drone
      const throttleTorque = Math.pow(Math.max(0, throttle), 1.5);
      const overrunBraking = throttle <= 0.05 && speedKmh > 30 ? 0.65 : 0.0;
      const torqueLoad = Math.max(0.125, Math.max(throttleTorque, overrunBraking));

      if (throttle > 0.08) {
        // DRIVE SIDE: Gear teeth under load
        meshVolume = (0.16 + throttle * 0.14 + rpmRatio * 0.12) * torqueLoad;
        diffVolume = (0.05 + speedRatio * 0.10) * torqueLoad;
      } else if (speedKmh > 10) {
        // COAST / OVERRUN: Backlash tooth chatter attenuated by -18 dB
        meshVolume = (0.12 + rpmRatio * 0.08) * torqueLoad;
        diffVolume = (0.04 + speedRatio * 0.08) * torqueLoad;
      } else {
        meshVolume = 0.015;
        diffVolume = 0.0;
      }
    }

    if (!isCockpitView) {
      // Exterior view: transmission whine is attenuated by outer bodywork panels
      meshVolume *= 0.65;
      diffVolume *= 0.65;
    }

    this.gearMeshGain?.gain.setTargetAtTime(meshVolume, now, 0.03);
    this.diffWhineGain?.gain.setTargetAtTime(diffVolume, now, 0.03);

    // --- 3. Tire Scrub & Squeal ---
    const slipDeg = (maxSlipAngleRad * 180) / Math.PI;
    let tireVolume = 0;
    if (slipDeg > 4.5 && speedKmh > 12) {
      tireVolume = clamp((slipDeg - 4.5) / 8.0, 0, 0.45);
    }
    this.tireGain?.gain.setTargetAtTime(tireVolume, now, 0.03);

    // --- 4. Aerodynamic Wind Noise ---
    // User specification: "i shouldnt hear any wind in cockpit view, maybe in the other outside cams sure"
    if (isCockpitView) {
      // Completely muted inside cockpit
      this.windGain?.gain.setTargetAtTime(0.0, now, 0.04);
    } else {
      // Active in exterior chase camera
      const vNorm = clamp(speedKmh / 260, 0, 1);
      const windVolume = Math.pow(vNorm, 2.5) * 0.30;
      this.windGain?.gain.setTargetAtTime(windVolume, now, 0.05);
    }
  }
}
