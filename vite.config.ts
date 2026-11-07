import { defineConfig, Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import os from 'os';

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
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

      const ip = getLocalIpAddress();

      // Serve network info for Host HUD and QR code
      server.middlewares.use('/api/network-info', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ip,
          hostname: 'les-MacBook-Pro.local',
          port: 5173,
          controllerUrl: `https://${ip}:5173/controller.html`,
          mdnsUrl: `https://les-MacBook-Pro.local:5173/controller.html`,
        }));
      });

      const wss = new WebSocketServer({ noServer: true });
      const hostSockets = new Set<WebSocket>();
      const controllerSockets = new Set<WebSocket>();

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
        }
      });

      console.log('\n======================================================');
      console.log('🏎️  DUAL-SCREEN WEB RACER READY');
      console.log(`🖥️  Host Screen:       https://${ip}:5173/`);
      console.log(`📱 iPhone Controller: https://${ip}:5173/controller.html`);
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
