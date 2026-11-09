import * as THREE from 'three';
import { TrackMode } from '../../common/types';

export interface PeerTelemetryPacket {
  peerId: string;
  carNumber: string;
  pos: [number, number, number];
  quat: [number, number, number, number];
  speedKmh: number;
  steerAngleRad: number;
  wheelSpinRad: number;
  timestampMs: number;
}

export interface LobbyConfig {
  roomCode: string;          // 4-digit code e.g. "4821"
  circuit: TrackMode;        // GP_STRECKE, NORDSCHLEIFE, NURBURGRING_24H, PROVING_GROUND
  lapCount: number;          // 1 to 25
  maxDrivers: number;        // 2 to 10
  collisionEnabled: boolean; // false = Ghost Mode, true = Kinematic Impulse
  startFormat: 'standing_f1_5lights' | 'rolling_3lights';
  sessionStage?: 'lobby' | 'qualifying' | 'grid_staging' | 'race';
}

/**
 * Encodes a peer vehicle pose into a compact 44-byte binary ArrayBuffer for
 * unordered, zero-retransmit WebRTC DataChannel transmission at 60 Hz.
 */
export function encodePeerPoseBinary(
  pos: [number, number, number],
  quat: [number, number, number, number],
  speedKmh: number,
  steerAngleRad: number,
  wheelSpinRad: number,
  timestampMs: number
): ArrayBuffer {
  const buf = new ArrayBuffer(44);
  const view = new DataView(buf);
  view.setUint32(0, 0x50325031, true); // Magic 'P2P1'
  view.setFloat32(4, pos[0], true);
  view.setFloat32(8, pos[1], true);
  view.setFloat32(12, pos[2], true);
  view.setFloat32(16, quat[0], true);
  view.setFloat32(20, quat[1], true);
  view.setFloat32(24, quat[2], true);
  view.setFloat32(28, quat[3], true);
  view.setFloat32(32, speedKmh, true);
  view.setFloat32(36, steerAngleRad, true);
  view.setFloat32(40, wheelSpinRad, true);
  void timestampMs;
  return buf;
}

/**
 * Decodes a 44-byte binary WebRTC DataChannel pose packet.
 */
export function decodePeerPoseBinary(buf: ArrayBuffer): Omit<
  PeerTelemetryPacket,
  'peerId' | 'carNumber' | 'timestampMs'
> | null {
  if (buf.byteLength < 44) return null;
  const view = new DataView(buf);
  const magic = view.getUint32(0, true);
  if (magic !== 0x50325031) return null;

  return {
    pos: [view.getFloat32(4, true), view.getFloat32(8, true), view.getFloat32(12, true)],
    quat: [
      view.getFloat32(16, true),
      view.getFloat32(20, true),
      view.getFloat32(24, true),
      view.getFloat32(28, true),
    ],
    speedKmh: view.getFloat32(32, true),
    steerAngleRad: view.getFloat32(36, true),
    wheelSpinRad: view.getFloat32(40, true),
  };
}

interface RemotePeerSession {
  peerId: string;
  carNumber: string;
  isReady: boolean;
  isHost: boolean;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  meshGroup: THREE.Group;
  wheelGroups: THREE.Group[];
  targetPos: THREE.Vector3;
  targetQuat: THREE.Quaternion;
  speedKmh: number;
  steerAngleRad: number;
  wheelSpinRad: number;
  lastUpdateMs: number;
  kinematicBody?: any;
  kinematicCollider?: any;
}

/**
 * Phase 4: WebRTC DataChannel Peer-to-Peer Multiplayer Lobby.
 * - Private 4-digit room signaling [0000, 9999] (e.g. 4821)
 * - Host race settings (Circuit, Laps, Max Drivers, Collision Mode)
 * - Quick-join URL query parameter support (?room=4821)
 * - Kinematic Rapier collision mode vs Ghost mode
 * - Peer roster & readiness synchronization
 */
export class WebRTCMultiplayerLobby {
  private scene: THREE.Scene;
  private localPeerId: string;
  private roomId = '4821';
  private isHost = true;
  private isLocalReady = false;
  private signalingWs: WebSocket | null = null;
  private peers: Map<string, RemotePeerSession> = new Map();

  // Physics collision world & Rapier handles (Phase 4.6 Kinematic Impulse Mode)
  private physicsWorld: any = null;
  private rapier: any = null;
  private isLocalGhostInvulnerable = false;

  // Host configuration
  public lobbyConfig: LobbyConfig = {
    roomCode: '4821',
    circuit: TrackMode.NORDSCHLEIFE,
    lapCount: 3,
    maxDrivers: 10,
    sessionStage: 'lobby',
    collisionEnabled: false, // Default: Ghost Mode
    startFormat: 'standing_f1_5lights',
  };

  // Callbacks for 2-Stage Multiplayer Flow
  public onStartQualifying?: (config: LobbyConfig) => void;
  public onStartRace?: (config: LobbyConfig, gridOrder?: string[]) => void;
  public qualiResults: Map<string, { carNumber: string; bestLapMs: number }> = new Map();
  public isGridReady: boolean = false;
  private gridDialogEl: HTMLDialogElement | null = null;
  private gridRosterTableEl: HTMLElement | null = null;
  private gridReadyBtnEl: HTMLButtonElement | null = null;
  private gridLaunchBtnEl: HTMLButtonElement | null = null;

  // In-browser loopback RTCPeerConnection for solo P2P verification
  private loopbackRemotePc: RTCPeerConnection | null = null;
  private loopbackRemoteDc: RTCDataChannel | null = null;
  private loopbackHistory: { pos: [number, number, number]; quat: [number, number, number, number]; speedKmh: number; steerAngleRad: number; wheelSpinRad: number }[] = [];

  // Native <dialog> modal UI
  private dialogEl: HTMLDialogElement | null = null;
  private roomInputEl: HTMLInputElement | null = null;
  private peerListEl: HTMLElement | null = null;
  private statusBadgeEl: HTMLElement | null = null;
  private manualSdpTextarea: HTMLTextAreaElement | null = null;
  private hostSettingsPanelEl: HTMLElement | null = null;
  private startRaceBtnEl: HTMLButtonElement | null = null;
  private readyBtnEl: HTMLButtonElement | null = null;
  private collisionBtnEl: HTMLButtonElement | null = null;
  private circuitSelectEl: HTMLSelectElement | null = null;
  private lapInputEl: HTMLInputElement | null = null;
  private maxDriversInputEl: HTMLInputElement | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.localPeerId = `RSR-${Math.floor(100 + Math.random() * 899)}`;

    // Read URL query parameter for instant 4-digit room pairing (e.g. ?room=4821)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        this.roomId = roomParam.trim().slice(0, 8);
        this.lobbyConfig.roomCode = this.roomId;
        this.isHost = false; // Joiner by default if URL parameter provided
      } else {
        // Generate a random 4-digit room code
        this.roomId = String(Math.floor(1000 + Math.random() * 9000));
        this.lobbyConfig.roomCode = this.roomId;
      }

      this.buildDialogUI();
    }
  }

  public setPhysicsWorld(world: any, rapier: any): void {
    this.physicsWorld = world;
    this.rapier = rapier;
    this.syncPeerColliders();
  }

  public setLocalGhostInvulnerable(ghost: boolean): void {
    this.isLocalGhostInvulnerable = ghost;
  }

  private buildDialogUI(): void {
    this.dialogEl = document.createElement('dialog');
    this.dialogEl.id = 'webrtc-lobby-dialog';
    this.dialogEl.className = 'webrtc-lobby-dialog';

    this.dialogEl.innerHTML = `
      <div class="webrtc-modal-inner">
        <header class="webrtc-modal-header">
          <div>
            <span class="webrtc-eyebrow">PHASE 4 PRIVATE P2P MOTORSPORT</span>
            <h2 class="webrtc-title">PRIVATE 4-DIGIT MULTIPLAYER PADDOCK</h2>
          </div>
          <div class="webrtc-header-right">
            <span id="webrtc-status-badge" class="webrtc-badge">ROOM ${this.roomId} • ${this.localPeerId}</span>
            <button type="button" id="webrtc-close-btn" class="webrtc-close-btn" aria-label="Close Multiplayer Lobby">✕</button>
          </div>
        </header>

        <div class="webrtc-modal-body">
          <!-- 4-Digit Room Allocation & Join Bar -->
          <div class="webrtc-section">
            <label for="webrtc-room-input" class="webrtc-label">PRIVATE 4-DIGIT ROOM CODE</label>
            <div class="webrtc-room-row">
              <input
                type="text"
                id="webrtc-room-input"
                class="webrtc-input"
                value="${this.roomId}"
                maxlength="6"
                placeholder="4821"
              />
              <button type="button" id="webrtc-join-btn" class="webrtc-btn webrtc-btn-primary">
                JOIN LOBBY
              </button>
              <button type="button" id="webrtc-create-room-btn" class="webrtc-btn webrtc-btn-secondary">
                NEW 4-DIGIT PIN
              </button>
              <button type="button" id="webrtc-copy-link-btn" class="webrtc-btn webrtc-btn-secondary">
                COPY LINK
              </button>
            </div>
          </div>

          <!-- Host Authoritative Race Settings Panel -->
          <div class="webrtc-section webrtc-host-settings" id="webrtc-host-settings">
            <span class="webrtc-label">HOST RACE CONFIGURATION</span>
            <div class="webrtc-settings-grid">
              <div class="webrtc-setting-item">
                <label for="webrtc-circuit-select">CIRCUIT</label>
                <select id="webrtc-circuit-select" class="webrtc-select">
                  <option value="${TrackMode.NORDSCHLEIFE}" selected>Nordschleife (20.8 km) - Rolling 3-Light</option>
                  <option value="${TrackMode.NURBURGRING_24H}">24h Gesamtkurs (24.3 km) - Rolling 3-Light</option>
                  <option value="${TrackMode.GP_STRECKE}">GP-Strecke (5.1 km) - Standing F1 5-Light</option>
                  <option value="${TrackMode.PROVING_GROUND}">Proving Ground Runway - Standing Start</option>
                </select>
              </div>

              <div class="webrtc-setting-item">
                <label for="webrtc-laps-input">LAPS (1-25)</label>
                <input type="number" id="webrtc-laps-input" class="webrtc-number-input" value="3" min="1" max="25" />
              </div>

              <div class="webrtc-setting-item">
                <label for="webrtc-max-drivers-input">MAX DRIVERS (2-10)</label>
                <input type="number" id="webrtc-max-drivers-input" class="webrtc-number-input" value="10" min="2" max="10" />
              </div>

              <div class="webrtc-setting-item">
                <label>COLLISION MODE</label>
                <button type="button" id="webrtc-collision-toggle-btn" class="webrtc-toggle-btn">
                  GHOST MODE (DEFAULT)
                </button>
              </div>
            </div>
          </div>

          <!-- Active P2P Peer Roster -->
          <div class="webrtc-section">
            <div class="webrtc-roster-header">
              <span class="webrtc-label">CONNECTED DRIVER ROSTER & READINESS</span>
              <button type="button" id="webrtc-loopback-btn" class="webrtc-btn-small">
                + SPAWN PACE PEER
              </button>
            </div>
            <div id="webrtc-peer-list" class="webrtc-peer-list">
              <div class="webrtc-empty-state">No other drivers in room. Share code ${this.roomId} or click 'Copy Link'.</div>
            </div>
          </div>

          <!-- Bottom Action Bar: Ready Checkmark + Host Start Race -->
          <div class="webrtc-actions-bar">
            <button type="button" id="webrtc-ready-btn" class="webrtc-btn webrtc-btn-ready">
              TOGGLE READY: NOT READY
            </button>
            <button type="button" id="webrtc-start-race-btn" class="webrtc-btn webrtc-btn-launch">
              START QUALIFYING [HOST]
            </button>
          </div>

          <!-- Serverless SDP Token Accordion -->
          <details class="webrtc-sdp-accordion">
            <summary class="webrtc-sdp-summary">Serverless Manual SDP Token Exchange (Fallback)</summary>
            <div class="webrtc-sdp-inner">
              <div class="webrtc-sdp-actions">
                <button type="button" id="webrtc-create-offer-btn" class="webrtc-btn-small">1. GENERATE OFFER</button>
                <button type="button" id="webrtc-accept-sdp-btn" class="webrtc-btn-small">2. ACCEPT OFFER/ANSWER</button>
              </div>
              <textarea
                id="webrtc-sdp-textarea"
                class="webrtc-sdp-textarea"
                rows="2"
                placeholder="Paste peer base64 token..."
              ></textarea>
            </div>
          </details>
        </div>
      </div>
    `;

    document.body.appendChild(this.dialogEl);

    this.roomInputEl = this.dialogEl.querySelector('#webrtc-room-input') as HTMLInputElement;
    this.peerListEl = this.dialogEl.querySelector('#webrtc-peer-list') as HTMLElement;
    this.statusBadgeEl = this.dialogEl.querySelector('#webrtc-status-badge') as HTMLElement;
    this.manualSdpTextarea = this.dialogEl.querySelector('#webrtc-sdp-textarea') as HTMLTextAreaElement;
    this.hostSettingsPanelEl = this.dialogEl.querySelector('#webrtc-host-settings') as HTMLElement;
    this.startRaceBtnEl = this.dialogEl.querySelector('#webrtc-start-race-btn') as HTMLButtonElement;
    this.readyBtnEl = this.dialogEl.querySelector('#webrtc-ready-btn') as HTMLButtonElement;
    this.collisionBtnEl = this.dialogEl.querySelector('#webrtc-collision-toggle-btn') as HTMLButtonElement;
    this.circuitSelectEl = this.dialogEl.querySelector('#webrtc-circuit-select') as HTMLSelectElement;
    this.lapInputEl = this.dialogEl.querySelector('#webrtc-laps-input') as HTMLInputElement;
    this.maxDriversInputEl = this.dialogEl.querySelector('#webrtc-max-drivers-input') as HTMLInputElement;

    // Event Listeners
    const closeBtn = this.dialogEl.querySelector('#webrtc-close-btn') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.closeModal());

    this.dialogEl.addEventListener('click', (e) => {
      if (e.target === this.dialogEl) this.closeModal();
    });

    const joinBtn = this.dialogEl.querySelector('#webrtc-join-btn') as HTMLButtonElement;
    joinBtn.addEventListener('click', () => {
      const code = (this.roomInputEl?.value || '4821').trim().toUpperCase();
      this.joinSignalingRoom(code);
    });

    const createRoomBtn = this.dialogEl.querySelector('#webrtc-create-room-btn') as HTMLButtonElement;
    createRoomBtn.addEventListener('click', () => {
      const newPin = String(Math.floor(1000 + Math.random() * 9000));
      if (this.roomInputEl) this.roomInputEl.value = newPin;
      this.isHost = true;
      this.joinSignalingRoom(newPin);
    });

    const copyLinkBtn = this.dialogEl.querySelector('#webrtc-copy-link-btn') as HTMLButtonElement;
    copyLinkBtn.addEventListener('click', () => {
      this.copyInviteLink(copyLinkBtn);
    });

    // Host Settings Listeners
    this.circuitSelectEl?.addEventListener('change', () => {
      const circ = this.circuitSelectEl?.value as TrackMode;
      this.lobbyConfig.circuit = circ;
      this.lobbyConfig.startFormat = 'standing_f1_5lights';
      this.broadcastLobbyConfig();
    });

    this.lapInputEl?.addEventListener('change', () => {
      const laps = Math.max(1, Math.min(25, parseInt(this.lapInputEl?.value || '3', 10)));
      this.lobbyConfig.lapCount = laps;
      this.broadcastLobbyConfig();
    });

    this.maxDriversInputEl?.addEventListener('change', () => {
      const maxD = Math.max(2, Math.min(16, parseInt(this.maxDriversInputEl?.value || '8', 10)));
      this.lobbyConfig.maxDrivers = maxD;
      this.broadcastLobbyConfig();
    });

    this.collisionBtnEl?.addEventListener('click', () => {
      this.lobbyConfig.collisionEnabled = !this.lobbyConfig.collisionEnabled;
      this.updateCollisionBtnUI();
      this.syncPeerColliders();
      this.broadcastLobbyConfig();
    });

    // Driver Readiness & Host Start
    this.readyBtnEl?.addEventListener('click', () => {
      this.isLocalReady = !this.isLocalReady;
      if (this.readyBtnEl) {
        this.readyBtnEl.textContent = this.isLocalReady
          ? 'TOGGLE READY: ✅ READY'
          : 'TOGGLE READY: NOT READY';
        this.readyBtnEl.classList.toggle('ready-active', this.isLocalReady);
      }
      this.broadcastReadyState();
    });

    this.startRaceBtnEl?.addEventListener('click', () => {
      this.launchHostQualifying();
    });

    const loopbackBtn = this.dialogEl.querySelector('#webrtc-loopback-btn') as HTMLButtonElement;
    loopbackBtn.addEventListener('click', () => {
      void this.spawnLocalLoopbackPeer();
    });

    const createOfferBtn = this.dialogEl.querySelector('#webrtc-create-offer-btn') as HTMLButtonElement;
    createOfferBtn.addEventListener('click', async () => {
      const token = await this.createManualOfferInvite();
      if (this.manualSdpTextarea) {
        this.manualSdpTextarea.value = token;
        this.manualSdpTextarea.select();
      }
    });

    const acceptSdpBtn = this.dialogEl.querySelector('#webrtc-accept-sdp-btn') as HTMLButtonElement;
    acceptSdpBtn.addEventListener('click', async () => {
      const raw = this.manualSdpTextarea?.value.trim() || '';
      if (!raw) return;
      const responseToken = await this.acceptManualSdpToken(raw);
      if (responseToken && this.manualSdpTextarea) {
        this.manualSdpTextarea.value = responseToken;
        this.manualSdpTextarea.select();
      }
    });

    this.updateCollisionBtnUI();
  }

  private updateCollisionBtnUI(): void {
    if (!this.collisionBtnEl) return;
    if (this.lobbyConfig.collisionEnabled) {
      this.collisionBtnEl.textContent = 'PHYSICAL CONTACT MODE (ON)';
      this.collisionBtnEl.classList.add('collision-active');
    } else {
      this.collisionBtnEl.textContent = 'GHOST MODE (DEFAULT - OFF)';
      this.collisionBtnEl.classList.remove('collision-active');
    }
  }

  public copyInviteLink(btn?: HTMLButtonElement): void {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/?room=${this.roomId}`;
    navigator.clipboard?.writeText(url).then(() => {
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'COPIED!';
        setTimeout(() => {
          btn.textContent = originalText;
        }, 1800);
      }
    }).catch(() => {
      prompt('Copy multiplayer join link:', url);
    });
  }

  public openModal(): void {
    if (!this.dialogEl) return;
    if (!this.dialogEl.open) {
      this.dialogEl.showModal();
    }
    this.refreshLobbyUI();
  }

  public closeModal(): void {
    if (this.dialogEl && this.dialogEl.open) {
      this.dialogEl.close();
    }
  }

  public toggleModal(): void {
    if (this.dialogEl?.open) {
      this.closeModal();
    } else {
      this.openModal();
    }
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getLocalPeerId(): string {
    return this.localPeerId;
  }

  public setIsHost(val: boolean): void {
    this.isHost = val;
    if (this.hostSettingsPanelEl) {
      this.hostSettingsPanelEl.style.opacity = val ? '1' : '0.85';
    }
  }

  public getConnectedPeerCount(): number {
    let count = 0;
    for (const peer of this.peers.values()) {
      if (peer.dc && peer.dc.readyState === 'open') {
        count++;
      }
    }
    return count;
  }

  public getRemotePeers(): { peerId: string; pos: [number, number, number]; speedKmh: number }[] {
    const list: { peerId: string; pos: [number, number, number]; speedKmh: number }[] = [];
    for (const p of this.peers.values()) {
      list.push({
        peerId: p.peerId,
        pos: [p.meshGroup.position.x, p.meshGroup.position.y, p.meshGroup.position.z],
        speedKmh: p.speedKmh,
      });
    }
    return list;
  }

  public isConnectedToRoom(): boolean {
    return Boolean(this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN);
  }

  /**
   * Connects to the WebSocket signaling room for automatic WebRTC P2P discovery.
   */
  public joinSignalingRoom(roomId: string): void {
    this.roomId = roomId.trim().toUpperCase();
    this.lobbyConfig.roomCode = this.roomId;

    if (this.roomInputEl) {
      this.roomInputEl.value = this.roomId;
    }

    if (this.signalingWs) {
      this.signalingWs.close();
      this.signalingWs = null;
    }

    if (typeof window === 'undefined') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?role=peer&room=${encodeURIComponent(
      this.roomId
    )}&peerId=${encodeURIComponent(this.localPeerId)}`;

    this.signalingWs = new WebSocket(wsUrl);
    this.signalingWs.onopen = () => {
      this.refreshLobbyUI(`ROOM: ${this.roomId}`);
      this.broadcastLobbyConfig();
    };

    this.signalingWs.onmessage = async (ev) => {
      if (typeof ev.data !== 'string') return;
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'webrtc_room_peers' && Array.isArray(msg.peers)) {
          for (const remotePeerId of msg.peers) {
            await this.initiatePeerConnection(remotePeerId);
          }
        } else if (msg.type === 'webrtc_offer' && msg.from && msg.sdp) {
          await this.handleIncomingOffer(msg.from, msg.sdp);
        } else if (msg.type === 'webrtc_answer' && msg.from && msg.sdp) {
          await this.handleIncomingAnswer(msg.from, msg.sdp);
        } else if (msg.type === 'webrtc_ice' && msg.from && msg.candidate) {
          const session = this.peers.get(msg.from);
          if (session) {
            await session.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
        } else if (msg.type === 'lobby_config_update' && msg.config) {
          // Received host authoritative race settings
          this.applyIncomingLobbyConfig(msg.config);
        } else if (msg.type === 'peer_ready_sync' && msg.from) {
          const session = this.peers.get(msg.from);
          if (session) {
            session.isReady = !!msg.isReady;
            this.refreshLobbyUI();
          }
        } else if (msg.type === 'race_start_qualifying' && msg.config) {
          this.closeModal();
          this.lobbyConfig.sessionStage = 'qualifying';
          this.applyIncomingLobbyConfig(msg.config);
          this.onStartQualifying?.(this.lobbyConfig);
        } else if (msg.type === 'quali_lap_result' && msg.from) {
          this.recordQualiResult(msg.from, msg.carNumber, msg.bestLapMs);
        } else if (msg.type === 'grid_ready_sync' && msg.from) {
          // Update remote driver grid readiness
          this.refreshGridStagingUI();
        } else if (msg.type === 'race_start_launch' && msg.config) {
          // Host has launched the race from grid!
          this.closeModal();
          this.closeGridModal();
          this.lobbyConfig.sessionStage = 'race';
          this.applyIncomingLobbyConfig(msg.config);
          this.onStartRace?.(this.lobbyConfig, msg.gridOrder);
        } else if (msg.type === 'webrtc_peer_left' && msg.peerId) {
          this.removePeer(msg.peerId);
        }
      } catch (_e) {
        // Ignore signaling errors
      }
    };
  }

  private broadcastLobbyConfig(): void {
    if (!this.signalingWs || this.signalingWs.readyState !== WebSocket.OPEN) return;
    this.signalingWs.send(
      JSON.stringify({
        type: 'lobby_config_update',
        config: this.lobbyConfig,
      })
    );
  }

  private broadcastReadyState(): void {
    if (!this.signalingWs || this.signalingWs.readyState !== WebSocket.OPEN) return;
    this.signalingWs.send(
      JSON.stringify({
        type: 'peer_ready_sync',
        isReady: this.isLocalReady,
      })
    );
  }

  private applyIncomingLobbyConfig(config: LobbyConfig): void {
    this.lobbyConfig = { ...this.lobbyConfig, ...config };
    if (this.circuitSelectEl) this.circuitSelectEl.value = this.lobbyConfig.circuit;
    if (this.lapInputEl) this.lapInputEl.value = String(this.lobbyConfig.lapCount);
    if (this.maxDriversInputEl) this.maxDriversInputEl.value = String(this.lobbyConfig.maxDrivers);
    this.updateCollisionBtnUI();
    this.syncPeerColliders();
    this.refreshLobbyUI();
  }


  public launchHostQualifying(): void {
    this.closeModal();
    this.lobbyConfig.sessionStage = 'qualifying';
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(
        JSON.stringify({
          type: 'race_start_qualifying',
          config: this.lobbyConfig,
        })
      );
    }
    this.onStartQualifying?.(this.lobbyConfig);
  }

  public recordQualiResult(peerId: string, carNumber: string, bestLapMs: number): void {
    this.qualiResults.set(peerId, { carNumber, bestLapMs });
    this.refreshGridStagingUI();
  }

  public broadcastQualiResult(bestLapMs: number, carNumber: string = '80'): void {
    this.qualiResults.set(this.localPeerId, { carNumber, bestLapMs });
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(
        JSON.stringify({
          type: 'quali_lap_result',
          from: this.localPeerId,
          carNumber,
          bestLapMs,
        })
      );
    }
    this.refreshGridStagingUI();
  }

  public getSeededGridOrder(): Array<{ gridPos: number; peerId: string; carNumber: string; lapMs: number | null }> {
    const drivers: Array<{ peerId: string; carNumber: string; lapMs: number | null }> = [];
    const localRes = this.qualiResults.get(this.localPeerId);
    drivers.push({
      peerId: this.localPeerId,
      carNumber: localRes?.carNumber || '80',
      lapMs: localRes?.bestLapMs ?? null,
    });

    for (const peer of this.peers.values()) {
      const res = this.qualiResults.get(peer.peerId);
      drivers.push({
        peerId: peer.peerId,
        carNumber: res?.carNumber || peer.carNumber,
        lapMs: res?.bestLapMs ?? null,
      });
    }

    // Sort by bestLapMs ascending (fastest first). null times go to back.
    drivers.sort((a, b) => {
      if (a.lapMs === null && b.lapMs === null) return 0;
      if (a.lapMs === null) return 1;
      if (b.lapMs === null) return -1;
      return a.lapMs - b.lapMs;
    });

    return drivers.slice(0, 10).map((d, idx) => ({
      gridPos: idx + 1,
      peerId: d.peerId,
      carNumber: d.carNumber,
      lapMs: d.lapMs,
    }));
  }

  public openGridStagingModal(): void {
    if (!this.gridDialogEl) {
      this.buildGridDialogUI();
    }
    if (this.gridDialogEl && !this.gridDialogEl.open) {
      this.gridDialogEl.showModal();
    }
    this.refreshGridStagingUI();
  }

  public closeGridModal(): void {
    if (this.gridDialogEl && this.gridDialogEl.open) {
      this.gridDialogEl.close();
    }
  }

  private buildGridDialogUI(): void {
    this.gridDialogEl = document.createElement('dialog');
    this.gridDialogEl.id = 'webrtc-grid-dialog';
    this.gridDialogEl.className = 'webrtc-lobby-dialog';

    this.gridDialogEl.innerHTML = `
      <div class="webrtc-modal-inner">
        <header class="webrtc-modal-header">
          <div>
            <span class="webrtc-eyebrow">STAGE 2 • POST-QUALIFYING GRID</span>
            <h2 class="webrtc-title">OFFICIAL STARTING GRID (SEEDED P1–P10)</h2>
          </div>
          <div class="webrtc-header-right">
            <span class="webrtc-badge">10-CAR CHAMPIONSHIP</span>
            <button type="button" id="webrtc-grid-close-btn" class="webrtc-close-btn" aria-label="Close Grid Dialog">✕</button>
          </div>
        </header>

        <div class="webrtc-modal-body">
          <div class="webrtc-section">
            <div id="webrtc-grid-roster-table" class="webrtc-grid-table"></div>
          </div>

          <div class="webrtc-actions-bar">
            <button type="button" id="webrtc-grid-ready-btn" class="webrtc-btn webrtc-btn-ready">
              RACE READY: NOT READY
            </button>
            <button type="button" id="webrtc-grid-launch-btn" class="webrtc-btn webrtc-btn-launch">
              START RACE [HOST] &rarr; SPAWN ON GRID
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.gridDialogEl);
    this.gridRosterTableEl = this.gridDialogEl.querySelector('#webrtc-grid-roster-table');
    this.gridReadyBtnEl = this.gridDialogEl.querySelector('#webrtc-grid-ready-btn');
    this.gridLaunchBtnEl = this.gridDialogEl.querySelector('#webrtc-grid-launch-btn');

    this.gridDialogEl.querySelector('#webrtc-grid-close-btn')?.addEventListener('click', () => {
      this.closeGridModal();
    });

    this.gridReadyBtnEl?.addEventListener('click', () => {
      this.isGridReady = !this.isGridReady;
      if (this.gridReadyBtnEl) {
        this.gridReadyBtnEl.textContent = this.isGridReady ? 'RACE READY: ✅ READY' : 'RACE READY: NOT READY';
        this.gridReadyBtnEl.classList.toggle('ready-active', this.isGridReady);
      }
      if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
        this.signalingWs.send(JSON.stringify({ type: 'grid_ready_sync', isReady: this.isGridReady }));
      }
    });

    this.gridLaunchBtnEl?.addEventListener('click', () => {
      this.launchHostRaceFromGrid();
    });
  }

  public refreshGridStagingUI(): void {
    if (!this.gridRosterTableEl) return;
    const grid = this.getSeededGridOrder();
    let poleMs: number | null = grid[0]?.lapMs ?? null;

    const rows = grid.map((entry) => {
      const posLabel = `P${entry.gridPos}`;
      const isPole = entry.gridPos === 1;
      let timeStr = '--:--.---';
      let gapStr = isPole ? 'POLE' : '--';

      if (entry.lapMs !== null) {
        const m = Math.floor(entry.lapMs / 60000);
        const s = Math.floor((entry.lapMs % 60000) / 1000);
        const ms = Math.floor(entry.lapMs % 1000);
        timeStr = `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;

        if (!isPole && poleMs !== null) {
          const diffSec = (entry.lapMs - poleMs) / 1000;
          gapStr = `+${diffSec.toFixed(3)}s`;
        }
      }

      return `
        <div class="webrtc-grid-row ${isPole ? 'grid-row-pole' : ''}">
          <span class="grid-pos">${posLabel}</span>
          <span class="grid-driver">${entry.peerId} (#${entry.carNumber})</span>
          <span class="grid-time">${timeStr}</span>
          <span class="grid-gap">${gapStr}</span>
        </div>
      `;
    });

    this.gridRosterTableEl.innerHTML = `
      <div class="webrtc-grid-header">
        <span>GRID</span>
        <span>DRIVER</span>
        <span>BEST HOTLAP</span>
        <span>GAP</span>
      </div>
      <div class="webrtc-grid-body">
        ${rows.join('')}
      </div>
    `;
  }

  public launchHostRaceFromGrid(): void {
    this.closeModal();
    this.closeGridModal();
    this.lobbyConfig.sessionStage = 'race';
    const gridOrder = this.getSeededGridOrder().map((d) => d.peerId);
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(
        JSON.stringify({
          type: 'race_start_launch',
          config: this.lobbyConfig,
          gridOrder,
        })
      );
    }
    this.onStartRace?.(this.lobbyConfig, gridOrder);
  }

  public launchHostRace(): void {
    this.closeModal();
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(
        JSON.stringify({
          type: 'race_start_launch',
          config: this.lobbyConfig,
        })
      );
    }
    this.onStartRace?.(this.lobbyConfig);
  }

  private createPeerSession(remotePeerId: string, isInitiator: boolean): RemotePeerSession {
    const existing = this.peers.get(remotePeerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    const { meshGroup, wheelGroups } = this.buildRemotePeerCarMesh(remotePeerId);
    this.scene.add(meshGroup);

    const session: RemotePeerSession = {
      peerId: remotePeerId,
      carNumber: remotePeerId.replace(/\D/g, '').slice(0, 2) || '92',
      isReady: false,
      isHost: false,
      pc,
      dc: null,
      meshGroup,
      wheelGroups,
      targetPos: new THREE.Vector3(0, -100, 0),
      targetQuat: new THREE.Quaternion(),
      speedKmh: 0,
      steerAngleRad: 0,
      wheelSpinRad: 0,
      lastUpdateMs: performance.now(),
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
        this.signalingWs.send(
          JSON.stringify({
            type: 'webrtc_ice',
            to: remotePeerId,
            candidate: ev.candidate,
          })
        );
      }
    };

    if (isInitiator) {
      const dc = pc.createDataChannel('telemetry-p2p', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.bindDataChannel(session, dc);
    } else {
      pc.ondatachannel = (ev) => {
        this.bindDataChannel(session, ev.channel);
      };
    }

    this.peers.set(remotePeerId, session);
    this.createKinematicColliderForPeer(session);
    this.refreshLobbyUI();
    return session;
  }

  private bindDataChannel(session: RemotePeerSession, dc: RTCDataChannel): void {
    session.dc = dc;
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      this.refreshLobbyUI();
    };

    dc.onclose = () => {
      this.refreshLobbyUI();
    };

    dc.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        const decoded = decodePeerPoseBinary(ev.data);
        if (decoded) {
          session.targetPos.set(decoded.pos[0], decoded.pos[1], decoded.pos[2]);
          session.targetQuat.set(
            decoded.quat[0],
            decoded.quat[1],
            decoded.quat[2],
            decoded.quat[3]
          );
          session.speedKmh = decoded.speedKmh;
          session.steerAngleRad = decoded.steerAngleRad;
          session.wheelSpinRad = decoded.wheelSpinRad;
          session.lastUpdateMs = performance.now();
          session.meshGroup.visible = true;
        }
      }
    };
  }

  private async initiatePeerConnection(remotePeerId: string): Promise<void> {
    const session = this.createPeerSession(remotePeerId, true);
    const offer = await session.pc.createOffer();
    await session.pc.setLocalDescription(offer);

    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(
        JSON.stringify({
          type: 'webrtc_offer',
          to: remotePeerId,
          sdp: session.pc.localDescription,
        })
      );
    }
  }

  private async handleIncomingOffer(
    remotePeerId: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<void> {
    const session = this.createPeerSession(remotePeerId, false);
    await session.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await session.pc.createAnswer();
    await session.pc.setLocalDescription(answer);

    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      this.signalingWs.send(
        JSON.stringify({
          type: 'webrtc_answer',
          to: remotePeerId,
          sdp: session.pc.localDescription,
        })
      );
    }
  }

  private async handleIncomingAnswer(
    remotePeerId: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<void> {
    const session = this.peers.get(remotePeerId);
    if (!session) return;
    await session.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.refreshLobbyUI();
  }

  public async createManualOfferInvite(): Promise<string> {
    const manualPeerId = `MANUAL-${Math.floor(10 + Math.random() * 89)}`;
    const session = this.createPeerSession(manualPeerId, true);
    const offer = await session.pc.createOffer();
    await session.pc.setLocalDescription(offer);

    return btoa(
      JSON.stringify({
        kind: 'offer',
        peerId: this.localPeerId,
        targetId: manualPeerId,
        sdp: session.pc.localDescription,
      })
    );
  }

  public async acceptManualSdpToken(token: string): Promise<string | null> {
    try {
      const payload = JSON.parse(atob(token));
      if (payload.kind === 'offer' && payload.sdp) {
        const remoteId = payload.peerId || 'PEER-MANUAL';
        const session = this.createPeerSession(remoteId, false);
        await session.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await session.pc.createAnswer();
        await session.pc.setLocalDescription(answer);
        this.refreshLobbyUI();
        return btoa(
          JSON.stringify({
            kind: 'answer',
            peerId: this.localPeerId,
            targetId: payload.targetId,
            sdp: session.pc.localDescription,
          })
        );
      } else if (payload.kind === 'answer' && payload.sdp) {
        const session =
          this.peers.get(payload.targetId) || Array.from(this.peers.values())[0];
        if (session) {
          await session.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          this.refreshLobbyUI();
        }
      }
    } catch (_e) {
      // Invalid token
    }
    return null;
  }

  public async spawnLocalLoopbackPeer(): Promise<string> {
    const peerId = 'RSR-PACE-91';
    if (this.peers.has(peerId)) {
      return peerId;
    }

    const localSession = this.createPeerSession(peerId, true);
    const remotePc = new RTCPeerConnection();
    this.loopbackRemotePc = remotePc;

    localSession.pc.onicecandidate = (e) => {
      if (e.candidate) void remotePc.addIceCandidate(e.candidate);
    };
    remotePc.onicecandidate = (e) => {
      if (e.candidate) void localSession.pc.addIceCandidate(e.candidate);
    };

    remotePc.ondatachannel = (ev) => {
      this.loopbackRemoteDc = ev.channel;
      this.loopbackRemoteDc.binaryType = 'arraybuffer';
    };

    const offer = await localSession.pc.createOffer();
    await localSession.pc.setLocalDescription(offer);
    await remotePc.setRemoteDescription(offer);
    const answer = await remotePc.createAnswer();
    await remotePc.setLocalDescription(answer);
    await localSession.pc.setRemoteDescription(answer);

    this.refreshLobbyUI('P2P PACE PEER ACTIVE');
    return peerId;
  }

  public removePeer(peerId: string): void {
    const session = this.peers.get(peerId);
    if (!session) return;
    if (this.loopbackRemotePc && peerId === 'RSR-PACE-91') {
      this.loopbackRemotePc.close();
      this.loopbackRemotePc = null;
    }
    session.dc?.close();
    session.pc.close();
    this.removeKinematicColliderForPeer(session);
    this.scene.remove(session.meshGroup);
    this.peers.delete(peerId);
    this.refreshLobbyUI();
  }

  /**
   * Phase 4.6: Kinematic Collider Management (Ghost Mode vs Physical Contact Mode)
   */
  private createKinematicColliderForPeer(session: RemotePeerSession): void {
    if (!this.lobbyConfig.collisionEnabled || !this.physicsWorld || !this.rapier) return;
    if (session.kinematicBody) return;

    try {
      const bodyDesc = this.rapier.RigidBodyDesc.kinematicPositionBased();
      const body = this.physicsWorld.createRigidBody(bodyDesc);
      // Dimensions: 4.5m length, 1.85m width, 1.1m height
      const colDesc = this.rapier.ColliderDesc.cuboid(0.925, 0.55, 2.25);
      const collider = this.physicsWorld.createCollider(colDesc, body);

      session.kinematicBody = body;
      session.kinematicCollider = collider;
    } catch (_e) {
      // Ignore physics init errors in mock tests
    }
  }

  private removeKinematicColliderForPeer(session: RemotePeerSession): void {
    if (session.kinematicBody && this.physicsWorld) {
      try {
        this.physicsWorld.removeRigidBody(session.kinematicBody);
      } catch (_e) {
        // Ignore
      }
      session.kinematicBody = undefined;
      session.kinematicCollider = undefined;
    }
  }

  private syncPeerColliders(): void {
    for (const session of this.peers.values()) {
      if (this.lobbyConfig.collisionEnabled) {
        this.createKinematicColliderForPeer(session);
      } else {
        this.removeKinematicColliderForPeer(session);
      }
    }
  }

  /**
   * Broadcasts local vehicle pose over all open WebRTC DataChannels and updates remote 3D peer cars.
   */
  public update(
    dt: number,
    localPos: [number, number, number],
    localQuat: [number, number, number, number],
    speedKmh: number,
    steerAngleRad: number,
    wheelSpinRad: number
  ): void {
    const now = performance.now();
    const packet = encodePeerPoseBinary(
      localPos,
      localQuat,
      speedKmh,
      steerAngleRad,
      wheelSpinRad,
      now
    );

    // 1. Broadcast over all open WebRTC DataChannels
    for (const session of this.peers.values()) {
      if (session.dc && session.dc.readyState === 'open' && session.peerId !== 'RSR-PACE-91') {
        try {
          session.dc.send(packet);
        } catch (_e) {
          // Ignore
        }
      }
    }

    // 2. If Loopback Pace Peer is active, transmit offset pose
    if (this.loopbackRemoteDc && this.loopbackRemoteDc.readyState === 'open') {
      this.loopbackHistory.push({
        pos: [...localPos],
        quat: [...localQuat],
        speedKmh,
        steerAngleRad,
        wheelSpinRad,
      });
      if (this.loopbackHistory.length > 45) {
        this.loopbackHistory.shift();
      }
      const sample = this.loopbackHistory[0];
      const q = new THREE.Quaternion(sample.quat[0], sample.quat[1], sample.quat[2], sample.quat[3]);
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(q);

      const pacePos: [number, number, number] = [
        sample.pos[0] + forward.x * 14.0 + right.x * 2.8,
        sample.pos[1],
        sample.pos[2] + forward.z * 14.0 + right.z * 2.8,
      ];
      const pacePacket = encodePeerPoseBinary(
        pacePos,
        sample.quat,
        sample.speedKmh,
        sample.steerAngleRad,
        sample.wheelSpinRad,
        now
      );
      try {
        this.loopbackRemoteDc.send(pacePacket);
      } catch (_e) {
        // Ignore
      }
    }

    // 3. Smoothly interpolate remote peer 3D car rigs and update kinematic colliders
    const alpha = Math.min(1.0, dt * 18.0);
    for (const session of this.peers.values()) {
      if (!session.meshGroup.visible) continue;
      if (session.meshGroup.position.y < -50) {
        session.meshGroup.position.copy(session.targetPos);
        session.meshGroup.quaternion.copy(session.targetQuat);
      } else {
        session.meshGroup.position.lerp(session.targetPos, alpha);
        session.meshGroup.quaternion.slerp(session.targetQuat, alpha);
      }

      // Update Kinematic Collider position if active and local car is not ghost invulnerable
      if (
        session.kinematicBody &&
        this.lobbyConfig.collisionEnabled &&
        !this.isLocalGhostInvulnerable
      ) {
        try {
          session.kinematicBody.setNextKinematicTranslation({
            x: session.meshGroup.position.x,
            y: session.meshGroup.position.y + 0.55,
            z: session.meshGroup.position.z,
          });
          session.kinematicBody.setNextKinematicRotation({
            x: session.meshGroup.quaternion.x,
            y: session.meshGroup.quaternion.y,
            z: session.meshGroup.quaternion.z,
            w: session.meshGroup.quaternion.w,
          });
        } catch (_e) {
          // Ignore
        }
      }

      for (let i = 0; i < 4; i++) {
        const wg = session.wheelGroups[i];
        wg.rotation.y = i < 2 ? session.steerAngleRad : 0;
        wg.rotation.x = session.wheelSpinRad;
      }
    }
  }

  private buildRemotePeerCarMesh(peerId: string): {
    meshGroup: THREE.Group;
    wheelGroups: THREE.Group[];
  } {
    const group = new THREE.Group();
    group.name = `WebRTC_Peer_Car_${peerId}`;
    group.visible = false;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.22,
      metalness: 0.35,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.5,
      metalness: 0.6,
    });

    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.36, 4.4), bodyMat);
    tub.position.set(0, 0.18, 0);
    tub.castShadow = true;
    group.add(tub);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.48, 1.85), darkMat);
    cabin.position.set(0, 0.62, -0.15);
    group.add(cabin);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.42), darkMat);
    wing.position.set(0, 1.12, -2.05);
    group.add(wing);

    // Floating Driver Tag Sprite
    if (typeof document !== 'undefined') {
      const tagCanvas = document.createElement('canvas');
      tagCanvas.width = 256;
      tagCanvas.height = 64;
      const ctx = tagCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 252, 60);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(peerId, 128, 32);
      }
      const tagTex = new THREE.CanvasTexture(tagCanvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tagTex, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, 1.85, 0);
      sprite.scale.set(1.8, 0.45, 1);
      group.add(sprite);
    }

    const wheelOffsets: [number, number, number][] = [
      [0.82, -0.12, 1.4],
      [-0.82, -0.12, 1.4],
      [0.84, -0.12, -1.06],
      [-0.84, -0.12, -1.06],
    ];
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 18);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelGroups: THREE.Group[] = [];
    for (const [wx, wy, wz] of wheelOffsets) {
      const wg = new THREE.Group();
      wg.position.set(wx, wy, wz);
      wg.add(new THREE.Mesh(wheelGeo, darkMat));
      group.add(wg);
      wheelGroups.push(wg);
    }

    return { meshGroup: group, wheelGroups };
  }

  private refreshLobbyUI(statusOverride?: string): void {
    if (!this.peerListEl || !this.statusBadgeEl) return;

    const openCount = this.getConnectedPeerCount();
    if (statusOverride) {
      this.statusBadgeEl.textContent = `${statusOverride} • ${openCount} PEER(S)`;
    } else {
      this.statusBadgeEl.textContent =
        openCount > 0
          ? `LIVE P2P ROOM ${this.roomId} (${openCount} CONNECTED)`
          : `READY • ROOM ${this.roomId}`;
    }

    if (this.peers.size === 0) {
      this.peerListEl.innerHTML = `<div class="webrtc-empty-state">No other drivers in room. Share PIN <strong>${this.roomId}</strong> or click 'Copy Link'.</div>`;
      return;
    }

    const rows: string[] = [];
    for (const peer of this.peers.values()) {
      const state = peer.dc?.readyState || 'connecting';
      const stateClass = state === 'open' ? 'peer-open' : 'peer-connecting';
      const readyBadge = peer.isReady ? '✅ READY' : '⏳ PADDOCK';
      rows.push(`
        <div class="webrtc-peer-row">
          <span class="webrtc-peer-id">${peer.peerId} (#${peer.carNumber})</span>
          <span class="webrtc-peer-speed">${Math.round(peer.speedKmh)} km/h</span>
          <span class="webrtc-peer-ready-state ${peer.isReady ? 'ready-true' : ''}">${readyBadge}</span>
          <span class="webrtc-peer-state ${stateClass}">${state.toUpperCase()}</span>
        </div>
      `);
    }
    this.peerListEl.innerHTML = rows.join('');
  }
}
