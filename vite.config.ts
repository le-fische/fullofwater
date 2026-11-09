import { defineConfig, Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import os from 'os';

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();

  // 1. Prioritize hotspot subnet (iOS Personal Hotspot 172.20.10.x, Android 192.168.43.x)
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('172.20.10.') || net.address.startsWith('192.168.43.')) {
          return net.address;
        }
      }
    }
  }

  // 2. Physical Wi-Fi / Ethernet adapters (en0, en1, ...)
  for (const name of Object.keys(interfaces)) {
    if (name.startsWith('en')) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }

  // 3. Fallback to any non-internal IPv4
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function webSocketBridgePlugin(): Plugin {
  return {
    name: 'websocket-bridge-plugin',
    configureServer(server) {
      if (!server.httpServer) return;

      // Serve network info dynamically for Host HUD and QR code (updates when switching Wi-Fi/Hotspot)
      server.middlewares.use('/api/network-info', (_req, res) => {
        const ip = getLocalIpAddress();
        const hostname = os.hostname();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ip,
          hostname,
          port: 5173,
          controllerUrl: `https://${ip}:5173/controller.html`,
          mdnsUrl: `https://${hostname}:5173/controller.html`,
        }));
      });

      // Phase 4: Allocate a unique 4-digit private lobby code [1000, 9999]
      server.middlewares.use('/api/create-room', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        let code = '';
        for (let i = 0; i < 1000; i++) {
          const candidate = String(Math.floor(1000 + Math.random() * 9000));
          if (!peerRooms.has(candidate)) {
            code = candidate;
            break;
          }
        }
        if (!code) code = String(Math.floor(1000 + Math.random() * 9000));
        res.end(JSON.stringify({ roomCode: code }));
      });

      const wss = new WebSocketServer({ noServer: true });
      const hostSockets = new Set<WebSocket>();
      const controllerSockets = new Set<WebSocket>();
      // WebRTC P2P Signaling rooms: roomId -> Map<peerId, WebSocket>
      const peerRooms = new Map<string, Map<string, WebSocket>>();

      server.httpServer.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        if (url.pathname === '/ws') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const role = url.searchParams.get('role');

        if (role === 'host') {
          hostSockets.add(ws);
          console.log(`[WebSocket Bridge] Host connected (${hostSockets.size} active)`);

          // Inform host if controller is already present
          if (controllerSockets.size > 0) {
            ws.send(JSON.stringify({ type: 'controller_connected' }));
          }

          ws.on('message', (data: Buffer | ArrayBuffer, isBinary: boolean) => {
            // Forward host telemetry directly to all active controllers
            for (const ctrl of controllerSockets) {
              if (ctrl.readyState === WebSocket.OPEN) {
                ctrl.send(data, { binary: isBinary });
              }
            }
          });

          ws.on('close', () => {
            hostSockets.delete(ws);
            console.log(`[WebSocket Bridge] Host disconnected (${hostSockets.size} remaining)`);
          });
        } else if (role === 'controller') {
          controllerSockets.add(ws);
          console.log(`[WebSocket Bridge] Controller connected (${controllerSockets.size} active)`);

          // Notify all hosts that controller is linked
          for (const h of hostSockets) {
            if (h.readyState === WebSocket.OPEN) {
              h.send(JSON.stringify({ type: 'controller_connected' }));
            }
          }

          ws.on('message', (data: Buffer | ArrayBuffer, isBinary: boolean) => {
            // Forward controller inputs directly to all active hosts
            for (const h of hostSockets) {
              if (h.readyState === WebSocket.OPEN) {
                h.send(data, { binary: isBinary });
              }
            }
          });

          ws.on('close', () => {
            controllerSockets.delete(ws);
            console.log(`[WebSocket Bridge] Controller disconnected (${controllerSockets.size} remaining)`);

            if (controllerSockets.size === 0) {
              for (const h of hostSockets) {
                if (h.readyState === WebSocket.OPEN) {
                  h.send(JSON.stringify({ type: 'controller_disconnected' }));
                }
              }
            }
          });
        } else if (role === 'peer') {
          const roomId = (url.searchParams.get('room') || 'NORDSCHLEIFE-1').toUpperCase();
          const peerId = url.searchParams.get('peerId') || `peer-${Math.random().toString(36).slice(2, 8)}`;

          let roomMap = peerRooms.get(roomId);
          if (!roomMap) {
            roomMap = new Map<string, WebSocket>();
            peerRooms.set(roomId, roomMap);
          }

          // Send existing peer IDs in this room to the newly joined peer
          const existingPeers = Array.from(roomMap.keys()).filter((id) => id !== peerId);
          ws.send(
            JSON.stringify({
              type: 'webrtc_room_peers',
              roomId,
              peerId,
              peers: existingPeers,
            })
          );

          // Notify existing peers that a new peer joined
          for (const [otherId, otherWs] of roomMap.entries()) {
            if (otherId !== peerId && otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(
                JSON.stringify({
                  type: 'webrtc_peer_joined',
                  roomId,
                  peerId,
                })
              );
            }
          }

          roomMap.set(peerId, ws);

          ws.on('message', (data: Buffer | ArrayBuffer) => {
            try {
              const msg = JSON.parse(data.toString());

              // Handle 4-digit room creation request
              if (msg.type === 'create_private_room') {
                let code = '';
                for (let i = 0; i < 1000; i++) {
                  const candidate = String(Math.floor(1000 + Math.random() * 9000));
                  if (!peerRooms.has(candidate)) {
                    code = candidate;
                    break;
                  }
                }
                if (!code) code = String(Math.floor(1000 + Math.random() * 9000));
                ws.send(JSON.stringify({ type: 'room_created', roomCode: code }));
                return;
              }

              const targetPeerId = msg.to as string | undefined;
              const activeRoom = peerRooms.get(roomId);
              if (!activeRoom) return;

              if (targetPeerId) {
                const targetWs = activeRoom.get(targetPeerId);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                  targetWs.send(JSON.stringify({ ...msg, from: peerId, roomId }));
                }
              } else {
                for (const [otherId, otherWs] of activeRoom.entries()) {
                  if (otherId !== peerId && otherWs.readyState === WebSocket.OPEN) {
                    otherWs.send(JSON.stringify({ ...msg, from: peerId, roomId }));
                  }
                }
              }
            } catch (_e) {
              // Ignore malformed signaling JSON
            }
          });

          ws.on('close', () => {
            const activeRoom = peerRooms.get(roomId);
            if (!activeRoom) return;
            activeRoom.delete(peerId);
            for (const [, otherWs] of activeRoom.entries()) {
              if (otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(
                  JSON.stringify({
                    type: 'webrtc_peer_left',
                    roomId,
                    peerId,
                  })
                );
              }
            }
            if (activeRoom.size === 0) {
              peerRooms.delete(roomId);
            }
          });
        }
      });

      const currentIp = getLocalIpAddress();
      console.log('\n======================================================');
      console.log('🏎️  DUAL-SCREEN WEB RACER READY');
      console.log(`🖥️  Host Screen:       https://${currentIp}:5173/`);
      console.log(`📱 iPhone Controller: https://${currentIp}:5173/controller.html`);
      console.log('======================================================\n');
    },
  };
}

export default defineConfig({
  plugins: [
    basicSsl(),
    webSocketBridgePlugin(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        controller: './controller.html',
      },
    },
  },
});
