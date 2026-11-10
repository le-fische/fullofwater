import {
  ControllerPacketEncoder,
  TelemetryPacketDecoder,
  ControllerButtons,
} from '../common/protocol';
import { DeviceOrientationManager } from './sensors/orientation';
import { TouchZones } from './ui/touch-zones';
import { DashDisplay } from './ui/dash-display';

class MobileControllerApp {
  private orientationMgr = new DeviceOrientationManager();
  private touchZones!: TouchZones;
  private dashDisplay!: DashDisplay;
  private encoder = new ControllerPacketEncoder();
  private decoder = new TelemetryPacketDecoder();

  private ws: WebSocket | null = null;
  private rtcPc: RTCPeerConnection | null = null;
  private rtcDc: RTCDataChannel | null = null;
  private rtcPollTimer: number | null = null;
  private seq = 0;
  private isConnected = false;
  private sendInterval: number | null = null;
  private engineStartFrames = 0;

  // Latency tracking
  private pingTimes = new Map<number, number>();
  private currentRttMs = 0;

  // Telemetry cache
  private currentRpmRatio = 0;
  private currentGear = 0;
  private currentSpeedKmh = 0;
  private currentShiftLight = false;
  private currentAbs = false;
  private currentTc = false;

  constructor() {
    const container = document.getElementById('app-container');
    if (!container) throw new Error('Missing #app-container');

    this.dashDisplay = new DashDisplay(container);
    this.touchZones = new TouchZones(container);

    this.setupButtons();
    this.setupGate();
    this.setupVisibilityListener();
    this.connectWebSocket();
  }

  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          console.log('Mobile controller resumed from background, reconnecting WebSocket...');
          this.connectWebSocket();
        }
      }
    });
  }

  private setupButtons(): void {
    const bindActionButton = (id: string, action: () => void) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      let lastTrigger = 0;
      const trigger = (e: Event) => {
        const now = performance.now();
        if (now - lastTrigger < 220) return; // Debounce
        lastTrigger = now;

        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 180);
        action();
      };

      btn.addEventListener('pointerdown', trigger);
      btn.addEventListener('touchstart', trigger, { passive: false });
      btn.addEventListener('click', trigger);
    };

    bindActionButton('btn-cam', () => {
      this.touchZones.triggerCamera();
    });

    bindActionButton('btn-reset', () => {
      this.touchZones.triggerReset();
    });
  }

  private setupGate(): void {
    const gate = document.getElementById('gate-overlay');
    const btnStart = document.getElementById('btn-start-drive');

    let started = false;
    const handleStart = async (e: Event) => {
      if (started) return;
      started = true;
      e.preventDefault();

      // 1. Immediately request motion sensor permission in the user gesture tick (iOS Safari requirement)
      try {
        await this.orientationMgr.requestPermission();
      } catch (err) {
        console.warn('Motion permission request error:', err);
      }
      this.orientationMgr.start();

      // Tactile button depression feedback
      btnStart?.classList.add('is-pressed');
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([40, 30, 90]);
      }

      // Local starter crank & ignition audio on mobile phone
      playMobileStarterAudio();

      // 2. Request Wake Lock if available
      try {
        if ('wakeLock' in navigator) {
          await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }

      // 3. Try to go fullscreen
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        // Fullscreen may not be allowed on iOS Safari without home screen icon
      }

      // Arm 20 frames of START_ENGINE button packet to notify Host via WebSocket
      this.engineStartFrames = 20;

      // Smooth cinematic fade-out of start gate
      if (gate) {
        gate.classList.add('fade-out');
        setTimeout(() => {
          gate.style.display = 'none';
        }, 420);
      }

      // Connect to WebSocket and begin 60 Hz input transmission
      this.connectWebSocket();
      this.startTransmissionLoop();
    };

    // Use click and touchend for iOS Safari permission activation window
    btnStart?.addEventListener('click', handleStart);
    btnStart?.addEventListener('touchend', handleStart, { passive: false });
  }

  private connectWebSocket(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const pairToken = urlParams.get('pairToken') || (typeof localStorage !== 'undefined' ? localStorage.getItem('fullofwater_pair_token') : null) || '';
    const driverTag = urlParams.get('driverTag') || (typeof localStorage !== 'undefined' ? localStorage.getItem('fullofwater_driver_tag') : null) || '';

    if (pairToken && typeof localStorage !== 'undefined') {
      localStorage.setItem('fullofwater_pair_token', pairToken);
    }
    if (driverTag && typeof localStorage !== 'undefined') {
      localStorage.setItem('fullofwater_driver_tag', driverTag);
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${window.location.host}/ws?role=controller`;
    if (pairToken) wsUrl += `&pairToken=${encodeURIComponent(pairToken)}`;
    if (driverTag) wsUrl += `&driverTag=${encodeURIComponent(driverTag)}`;

    console.log(`Connecting to ${wsUrl}...`);
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('Controller WebSocket connected');
        this.isConnected = true;

        // Also verify pairing session with serverless API
        if (pairToken) {
          fetch('/api/pair/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pairToken, driverTag: driverTag || undefined }),
          }).catch(() => {});
        }
      };

      this.ws.onclose = () => {
        console.warn('Controller WebSocket closed. Reconnecting in 1s...');
        if (!this.rtcDc || this.rtcDc.readyState !== 'open') {
          this.isConnected = false;
        }
        this.ws = null;
        setTimeout(() => this.connectWebSocket(), 1000);
      };

      this.ws.onerror = (_err) => {
        // WebSocket error (e.g. on serverless Vercel). WebRTC DataChannel will provide connection.
      };

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.handleIncomingTelemetry(event.data);
        }
      };
    } catch (_e) {
      // Ignore WebSocket instantiation error
    }

    // Emergency Phase II-A: Direct Phone-to-Desktop WebRTC Pairing over DataChannel
    if (pairToken) {
      void this.initWebRTCPairing(pairToken);
    }
  }

  private handleIncomingTelemetry(buffer: ArrayBuffer): void {
    const tel = this.decoder.decode(buffer);
    this.currentRpmRatio = tel.rpmRatio;
    this.currentGear = tel.gear;
    this.currentSpeedKmh = tel.speedKmh;
    this.currentShiftLight = tel.shiftLight;
    this.currentAbs = tel.abs;
    this.currentTc = tel.tc;

    // Calculate RTT from pingSeq
    const sentTime = this.pingTimes.get(tel.pingSeq);
    if (sentTime !== undefined) {
      this.currentRttMs = performance.now() - sentTime;
      this.pingTimes.delete(tel.pingSeq);
    }
  }

  private async initWebRTCPairing(pairToken: string): Promise<void> {
    if (!pairToken || typeof RTCPeerConnection === 'undefined') return;

    if (this.rtcPollTimer) {
      clearInterval(this.rtcPollTimer);
      this.rtcPollTimer = null;
    }

    if (this.rtcPc) {
      try { this.rtcPc.close(); } catch (_err) {}
      this.rtcPc = null;
      this.rtcDc = null;
    }

    try {
      this.rtcPc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      const dc = this.rtcPc.createDataChannel('controller-input', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.rtcDc = dc;
      dc.binaryType = 'arraybuffer';

      dc.onopen = () => {
        console.log('[Controller] Direct Phone-to-Desktop WebRTC DataChannel open!');
        this.isConnected = true;
      };

      dc.onclose = () => {
        console.warn('[Controller] WebRTC DataChannel closed');
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.isConnected = false;
        }
      };

      dc.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.handleIncomingTelemetry(event.data);
        }
      };

      this.rtcPc.onicecandidate = (ev) => {
        if (ev.candidate) {
          void this.sendPairSignal(pairToken, 'ice', ev.candidate);
        }
      };

      const offer = await this.rtcPc.createOffer();
      await this.rtcPc.setLocalDescription(offer);
      await this.sendPairSignal(pairToken, 'offer', this.rtcPc.localDescription);

      // Poll serverless pair signal endpoint every 500ms for host answer & ICE
      this.rtcPollTimer = window.setInterval(async () => {
        try {
          const res = await fetch(`/api/pair/signal/poll?token=${encodeURIComponent(pairToken)}&role=controller`);
          if (!res.ok) return;
          const data = await res.json();
          if (!data || !data.success || !Array.isArray(data.messages)) return;

          for (const msg of data.messages) {
            if (msg.type === 'answer' && msg.payload && this.rtcPc) {
              await this.rtcPc.setRemoteDescription(new RTCSessionDescription(msg.payload));
            } else if (msg.type === 'ice' && msg.payload && this.rtcPc) {
              await this.rtcPc.addIceCandidate(new RTCIceCandidate(msg.payload));
            }
          }
        } catch (_err) {}
      }, 500);
    } catch (err) {
      console.warn('[Controller WebRTC] Init error:', err);
    }
  }

  private async sendPairSignal(pairToken: string, type: string, payload: any): Promise<void> {
    if (typeof fetch === 'undefined') return;
    try {
      await fetch('/api/pair/signal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairToken,
          from: 'controller',
          type,
          payload,
        }),
      });
    } catch (_err) {}
  }

  private startTransmissionLoop(): void {
    if (this.sendInterval) clearInterval(this.sendInterval);

    // 60 Hz transmission loop (16.6 ms)
    this.sendInterval = window.setInterval(() => {
      this.tick();
    }, 1000 / 60);
  }

  private tick(): void {
    const steer = this.orientationMgr.getSteer();
    const touch = this.touchZones.getState();
    const buttonActions = this.touchZones.consumeButtons();

    let buttonsBitfield = ControllerButtons.NONE;
    if (buttonActions.reset) buttonsBitfield |= ControllerButtons.RESET;
    if (buttonActions.camera) buttonsBitfield |= ControllerButtons.CYCLE_CAMERA;
    if (touch.rearView) buttonsBitfield |= ControllerButtons.REAR_VIEW;
    if (this.engineStartFrames > 0) {
      buttonsBitfield |= ControllerButtons.START_ENGINE;
      this.engineStartFrames--;
    }

    const currentSeq = this.seq++ & 0xffff;
    const pingToken = currentSeq & 0xff;
    this.pingTimes.set(pingToken, performance.now());

    // Clean up older ping tokens
    if (this.pingTimes.size > 120) {
      const oldestKey = this.pingTimes.keys().next().value;
      if (oldestKey !== undefined) this.pingTimes.delete(oldestKey);
    }

    const packet = this.encoder.encode(
      currentSeq,
      steer,
      touch.throttle,
      touch.brake,
      buttonsBitfield
    );

    // Direct WebRTC DataChannel transmission (<5ms UDP stream)
    if (this.rtcDc && this.rtcDc.readyState === 'open') {
      try { this.rtcDc.send(packet); } catch (_err) {}
    }

    // WebSocket fallback transmission
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(packet); } catch (_err) {}
    }

    // Update Controller AMOLED Display
    const orientationData = this.orientationMgr.getTelemetry();
    this.dashDisplay.update({
      rpmRatio: this.currentRpmRatio,
      gear: this.currentGear,
      speedKmh: this.currentSpeedKmh,
      shiftLight: this.currentShiftLight,
      abs: this.currentAbs,
      tc: this.currentTc,
      rttMs: this.currentRttMs,
      steerAngleDeg: orientationData.angleDeg,
      connected: this.isConnected || (this.rtcDc?.readyState === 'open') || (this.ws?.readyState === WebSocket.OPEN),
    });
  }
}

/**
 * Synthesizes an authentic starter motor and ignition sound locally on the phone.
 */
function playMobileStarterAudio(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const t0 = ctx.currentTime + 0.02;

    // 1. Starter motor whine
    const starterOsc = ctx.createOscillator();
    const starterGain = ctx.createGain();
    starterOsc.type = 'sawtooth';
    starterOsc.frequency.setValueAtTime(115, t0);
    starterOsc.frequency.exponentialRampToValueAtTime(175, t0 + 0.45);
    starterGain.gain.setValueAtTime(0.18, t0);
    starterGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.50);
    starterOsc.connect(starterGain);
    starterGain.connect(ctx.destination);
    starterOsc.start(t0);
    starterOsc.stop(t0 + 0.52);

    // 2. Ignition cough & flare
    const engineOsc = ctx.createOscillator();
    const engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.setValueAtTime(75, t0 + 0.48);
    engineOsc.frequency.exponentialRampToValueAtTime(175, t0 + 0.70); // 3,500 RPM flare
    engineOsc.frequency.exponentialRampToValueAtTime(100, t0 + 1.50); // 2,000 RPM idle
    engineGain.gain.setValueAtTime(0.001, t0 + 0.48);
    engineGain.gain.linearRampToValueAtTime(0.25, t0 + 0.65);
    engineGain.gain.exponentialRampToValueAtTime(0.08, t0 + 1.50);
    engineGain.gain.exponentialRampToValueAtTime(0.001, t0 + 2.20);
    engineOsc.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start(t0 + 0.48);
    engineOsc.stop(t0 + 2.25);
  } catch (err) {
    console.warn('Mobile starter audio unavailable:', err);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new MobileControllerApp();
});
