import { WebSocket } from 'ws';
import { ControllerPacketEncoder, ControllerPacketDecoder } from '../src/common/protocol';

async function testWebSocketBridge() {
  console.log('Testing WebSocket bridge over HTTPS upgrade...');

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const hostWs = new WebSocket('wss://localhost:5173/ws?role=host', {
    rejectUnauthorized: false,
  });
  const ctrlWs = new WebSocket('wss://localhost:5173/ws?role=controller', {
    rejectUnauthorized: false,
  });

  const encoder = new ControllerPacketEncoder();
  const decoder = new ControllerPacketDecoder();

  await Promise.all([
    new Promise((resolve) => hostWs.on('open', resolve)),
    new Promise((resolve) => ctrlWs.on('open', resolve)),
  ]);

  console.log('Both Host and Controller WebSockets connected successfully!');

  let packetReceived = false;

  hostWs.on('message', (data: Buffer) => {
    const decoded = decoder.decode(data);
    console.log(`Host received packet: seq=${decoded.seq}, steer=${decoded.steer.toFixed(2)}, throttle=${decoded.throttle}`);
    if (decoded.seq === 1234 && Math.abs(decoded.steer - 0.5) < 0.01) {
      packetReceived = true;
    }
  });

  // Send packet from controller
  const packet = encoder.encode(1234, 0.5, 1.0, 0.0, 0);
  ctrlWs.send(packet);

  await new Promise((resolve) => setTimeout(resolve, 300));

  hostWs.close();
  ctrlWs.close();

  if (!packetReceived) {
    throw new Error('Host did not receive controller packet via WebSocket bridge');
  }

  console.log('🎉 WebSocket bridge verified end-to-end!');
}

testWebSocketBridge().catch((err) => {
  console.error('❌ WebSocket test failed:', err);
  process.exit(1);
});
