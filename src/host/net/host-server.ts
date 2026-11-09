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
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isControllerActive) {
      const buffer = this.encoder.encode(
        rpmRatio,
        gear,
        speedKmh,
        shiftLight,
        abs,
        tc,
        this.lastPingSeq
      );
      this.ws.send(buffer);
    }
  }

  /**
   * Sends a JSON control message to the mobile Controller.
   */
  public sendControlMessage(msg: BridgeControlMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
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
