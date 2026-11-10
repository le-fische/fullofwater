import {
  ControllerPacketDecoder,
  TelemetryPacketEncoder,
  ControllerButtons,
  BridgeControlMessage,
} from '../../common/protocol';
import { ControllerInput } from '../../common/types';

export interface HostNetworkCallbacks {
  onControllerStatusChange?: (connected: boolean) => void;
  onControllerInput?: (input: ControllerInput) => void;
  onButtonPress?: (button: ControllerButtons) => void;
}

export class HostNetworkBridge {
  private ws: WebSocket | null = null;
  private decoder = new ControllerPacketDecoder();
  private encoder = new TelemetryPacketEncoder();
  private isConnected = false;
  private isControllerActive = false;
  private callbacks: HostNetworkCallbacks;

  // Emergency Phase II-A: Direct Phone-to-Desktop WebRTC Pairing
  private pairToken: string | null = null;
  private rtcPc: RTCPeerConnection | null = null;
  private rtcDc: RTCDataChannel | null = null;
  private pairPollTimer: number | null = null;

  private lastInput: ControllerInput = {
    seq: 0,
    steer: 0,
    throttle: 0,
    brake: 0,
    buttons: 0,
    timestamp: performance.now(),
  };

  private lastPingSeq = 0;
  private prevButtons = ControllerButtons.NONE;

  constructor(callbacks: HostNetworkCallbacks = {}) {
    this.callbacks = callbacks;
    this.connect();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('Host resumed from background, reconnecting WebSocket...');
            this.connect();
          }
        }
      });
    }
  }

  private connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?role=host`;

    console.log(`Host connecting to ${wsUrl}...`);
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('Host connected to WebSocket bridge');
      this.isConnected = true;
    };

    this.ws.onclose = () => {
      console.warn('Host WebSocket disconnected. Retrying in 1s...');
      this.isConnected = false;
      this.ws = null;
      this.setControllerActive(false);
      setTimeout(() => this.connect(), 1000);
    };

    this.ws.onerror = (err) => {
      console.error('Host WebSocket bridge error:', err);
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'controller_connected') {
            this.setControllerActive(true);
          } else if (msg.type === 'controller_disconnected') {
            this.setControllerActive(false);
          }
        } catch (e) {
          // ignore
        }
        return;
      }

      if (event.data instanceof ArrayBuffer) {
        this.setControllerActive(true);
        const data = this.decoder.decode(event.data);
        this.lastPingSeq = data.seq & 0xff;

        const input: ControllerInput = {
          seq: data.seq,
          steer: data.steer,
          throttle: data.throttle,
          brake: data.brake,
          buttons: data.buttons,
          timestamp: performance.now(),
        };

        this.lastInput = input;

        if (this.callbacks.onControllerInput) {
          this.callbacks.onControllerInput(input);
        }

        // Rising-edge button detection (triggers once on initial press)
        const justPressed = data.buttons & ~this.prevButtons;
        this.prevButtons = data.buttons;

        if (justPressed !== ControllerButtons.NONE && this.callbacks.onButtonPress) {
          this.callbacks.onButtonPress(justPressed);
        }
      }
    };
  }

  // ==========================================
  // DIRECT PHONE-TO-DESKTOP WEBRTC PAIRING
  // ==========================================

  public listenForPairingWebRTC(pairToken: string): void {
    if (!pairToken) return;
    this.pairToken = pairToken.trim();

    if (this.pairPollTimer) {
      clearInterval(this.pairPollTimer);
      this.pairPollTimer = null;
    }

    if (this.rtcPc) {
      try { this.rtcPc.close(); } catch {}
      this.rtcPc = null;
      this.rtcDc = null;
    }

    if (typeof RTCPeerConnection === 'undefined') return;

    try {
      this.rtcPc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      this.rtcPc.ondatachannel = (ev) => {
        this.bindRtcDataChannel(ev.channel);
      };

      this.rtcPc.onicecandidate = (ev) => {
        if (ev.candidate && this.pairToken) {
          void this.sendPairSignal('ice', ev.candidate);
        }
      };

      // Poll serverless pair signal broker every 500ms
      this.pairPollTimer = window.setInterval(() => {
        void this.pollPairSignals();
      }, 500);
    } catch (err) {
      console.warn('[Host WebRTC] Init failed:', err);
    }
  }

  private bindRtcDataChannel(dc: RTCDataChannel): void {
    this.rtcDc = dc;
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      console.log('[Host] Phone paired over WebRTC DataChannel!');
      this.setControllerActive(true);
    };

    dc.onclose = () => {
      console.warn('[Host] WebRTC DataChannel closed');
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.setControllerActive(false);
      }
    };

    dc.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.setControllerActive(true);
        const data = this.decoder.decode(event.data);
        this.lastPingSeq = data.seq & 0xff;

        const input: ControllerInput = {
          seq: data.seq,
          steer: data.steer,
          throttle: data.throttle,
          brake: data.brake,
          buttons: data.buttons,
          timestamp: performance.now(),
        };

        this.lastInput = input;

        if (this.callbacks.onControllerInput) {
          this.callbacks.onControllerInput(input);
        }

        const justPressed = data.buttons & ~this.prevButtons;
        this.prevButtons = data.buttons;

        if (justPressed !== ControllerButtons.NONE && this.callbacks.onButtonPress) {
          this.callbacks.onButtonPress(justPressed);
        }
      }
    };
  }

  private async sendPairSignal(type: string, payload: any): Promise<void> {
    if (!this.pairToken || typeof fetch === 'undefined') return;
    try {
      await fetch('/api/pair/signal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairToken: this.pairToken,
          from: 'host',
          type,
          payload,
        }),
      });
    } catch {}
  }

  private async pollPairSignals(): Promise<void> {
    if (!this.pairToken || typeof fetch === 'undefined') return;
    try {
      const res = await fetch(`/api/pair/signal/poll?token=${encodeURIComponent(this.pairToken)}&role=host`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.success || !Array.isArray(data.messages)) return;

      for (const msg of data.messages) {
        if (msg.type === 'offer' && msg.payload && this.rtcPc) {
          await this.rtcPc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          const answer = await this.rtcPc.createAnswer();
          await this.rtcPc.setLocalDescription(answer);
          await this.sendPairSignal('answer', this.rtcPc.localDescription);
        } else if (msg.type === 'ice' && msg.payload && this.rtcPc) {
          await this.rtcPc.addIceCandidate(new RTCIceCandidate(msg.payload));
        }
      }
    } catch {}
  }

  private setControllerActive(active: boolean): void {
    if (this.isControllerActive !== active) {
      this.isControllerActive = active;
      if (this.callbacks.onControllerStatusChange) {
        this.callbacks.onControllerStatusChange(active);
      }
    }
  }

  sendTelemetry(
    rpmRatio: number,
    gear: number,
    speedKmh: number,
    shiftLight: boolean,
    abs: boolean,
    tc: boolean
  ): void {
    if (!this.isControllerActive) return;
    const buffer = this.encoder.encode(
      rpmRatio,
      gear,
      speedKmh,
      shiftLight,
      abs,
      tc,
      this.lastPingSeq
    );

    // Send over WebRTC DataChannel if open
    if (this.rtcDc && this.rtcDc.readyState === 'open') {
      try { this.rtcDc.send(buffer); } catch {}
    }

    // Send over WebSocket bridge if open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(buffer); } catch {}
    }
  }

  /**
   * Sends a JSON control message to the mobile Controller.
   */
  public sendControlMessage(msg: BridgeControlMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
    if (this.rtcDc && this.rtcDc.readyState === 'open') {
      try { this.rtcDc.send(JSON.stringify(msg)); } catch {}
    }
  }

  getLatestInput(): ControllerInput {
    return this.lastInput;
  }

  isBridgeConnected(): boolean {
    return this.isConnected;
  }

  isPhoneConnected(): boolean {
    return this.isControllerActive;
  }
}
