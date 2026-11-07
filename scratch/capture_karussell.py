import subprocess
import time
import urllib.request
import json
import asyncio
import websockets
import base64
import os

ARTIFACT_DIR = '/Users/le/.gemini/antigravity/brain/55db9843-3d10-4f3e-bca2-e56e595ad88a'
PORT = 9299

p = subprocess.Popen([
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '--headless',
    f'--remote-debugging-port={PORT}',
    '--window-size=1280,720',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-certificate-errors',
    'https://localhost:5173'
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(4.0)

async def capture():
    try:
        with urllib.request.urlopen(f'http://localhost:{PORT}/json') as resp:
            tabs = json.loads(resp.read().decode())
        ws_url = [t for t in tabs if t.get('type') == 'page' and '5173' in t.get('url', '')][0]['webSocketDebuggerUrl']
        
        async with websockets.connect(ws_url, max_size=30*1024*1024) as ws:
            mid = 0
            async def send(method, params=None):
                nonlocal mid
                mid += 1
                await ws.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == mid:
                        return m.get('result', {})

            await send('Runtime.enable')
            await send('Page.enable')

            for attempt in range(120):
                res = await send('Runtime.evaluate', {'expression': '!!window.__racingHost?.showroomStage?.isModelLoaded'})
                if res.get('result', {}).get('value') is True:
                    break
                await asyncio.sleep(0.5)

            # Start Nordschleife race
            script_start = """
            (() => {
                window.__racingHost.startRace('nordschleife', 0, '80');
                document.getElementById('hud-qr-box')?.click();
                window.__racingHost.cameraCtrl.cycleView(); // chase view
            })()
            """
            await send('Runtime.evaluate', {'expression': script_start})
            await asyncio.sleep(2.5)

            # Teleport to Karussell entry (s = 12020m, sample ~2404)
            script_teleport_entry = """
            (() => {
                const host = window.__racingHost;
                const sp = host.centerline.samples[2404];
                const yaw = Math.atan2(sp.tangent.x, sp.tangent.z);
                host.vehicle.respawn(sp.position.x, sp.position.y + 0.6, sp.position.z, yaw);
                host.streamer.update(sp.distance);
                host.cameraCtrl.reset();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_teleport_entry})
            await asyncio.sleep(2.0)

            shot = await send('Page.captureScreenshot', {'format': 'png'})
            with open(os.path.join(ARTIFACT_DIR, 'karussell_fixed_entry.png'), 'wb') as f:
                f.write(base64.b64decode(shot['data']))
            print('Saved karussell_fixed_entry.png')

            # Teleport to Karussell apex (s = 12086m, sample ~2417)
            script_teleport_apex = """
            (() => {
                const host = window.__racingHost;
                const sp = host.centerline.samples[2417];
                const yaw = Math.atan2(sp.tangent.x, sp.tangent.z);
                host.vehicle.respawn(sp.position.x, sp.position.y + 0.6, sp.position.z, yaw);
                host.streamer.update(sp.distance);
                host.cameraCtrl.reset();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_teleport_apex})
            await asyncio.sleep(2.0)

            shot = await send('Page.captureScreenshot', {'format': 'png'})
            with open(os.path.join(ARTIFACT_DIR, 'karussell_fixed_apex.png'), 'wb') as f:
                f.write(base64.b64decode(shot['data']))
            print('Saved karussell_fixed_apex.png')

            # Teleport to Karussell exit (s = 12150m, sample ~2430)
            script_teleport_exit = """
            (() => {
                const host = window.__racingHost;
                const sp = host.centerline.samples[2430];
                const yaw = Math.atan2(sp.tangent.x, sp.tangent.z);
                host.vehicle.respawn(sp.position.x, sp.position.y + 0.6, sp.position.z, yaw);
                host.streamer.update(sp.distance);
                host.cameraCtrl.reset();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_teleport_exit})
            await asyncio.sleep(2.0)

            shot = await send('Page.captureScreenshot', {'format': 'png'})
            with open(os.path.join(ARTIFACT_DIR, 'karussell_fixed_exit.png'), 'wb') as f:
                f.write(base64.b64decode(shot['data']))
            print('Saved karussell_fixed_exit.png')

    finally:
        p.kill()

asyncio.run(capture())
