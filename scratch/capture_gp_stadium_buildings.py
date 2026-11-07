import subprocess
import time
import urllib.request
import json
import asyncio
import websockets
import base64
import os

ARTIFACT_DIR = '/Users/le/.gemini/antigravity/brain/55db9843-3d10-4f3e-bca2-e56e595ad88a'
PORT = 9298

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

            # Wait for showroom model
            for attempt in range(120):
                res = await send('Runtime.evaluate', {'expression': '!!window.__racingHost?.showroomStage?.isModelLoaded'})
                if res.get('result', {}).get('value') is True:
                    break
                await asyncio.sleep(0.5)

            # Start GP-Strecke race with Rexy livery (#80)
            script_gp = """
            (() => {
                window.__racingHost.startRace('gp_strecke', 0, '80');
                document.getElementById('hud-qr-box')?.click();
                // Cycle camera from Cockpit (default) to Chase view
                window.__racingHost.cameraCtrl.cycleView();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_gp})
            await asyncio.sleep(3.0)

            # Screenshot 1: GP circuit spawn in chase view
            shot = await send('Page.captureScreenshot', {'format': 'png'})
            with open(os.path.join(ARTIFACT_DIR, 'gp_spawn_chase_view.png'), 'wb') as f:
                f.write(base64.b64decode(shot['data']))
            print('Saved gp_spawn_chase_view.png')

            # Teleport to sample 70 (approaching front straight where the user took their screenshot)
            script_sample_70 = """
            (() => {
                const host = window.__racingHost;
                const sp = host.centerline.samples[70];
                const yaw = Math.atan2(sp.tangent.x, sp.tangent.z);
                host.vehicle.respawn(sp.position.x, sp.position.y + 0.6, sp.position.z, yaw);
                host.streamer.update(sp.distance);
                host.cameraCtrl.reset();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_sample_70})
            await asyncio.sleep(2.0)

            shot = await send('Page.captureScreenshot', {'format': 'png'})
            with open(os.path.join(ARTIFACT_DIR, 'gp_sample_70_chase_clear_track.png'), 'wb') as f:
                f.write(base64.b64decode(shot['data']))
            print('Saved gp_sample_70_chase_clear_track.png')

            # Teleport to sample 105 (front straight between Haupttribune and Pit Complex)
            script_sample_105 = """
            (() => {
                const host = window.__racingHost;
                const sp = host.centerline.samples[105];
                const yaw = Math.atan2(sp.tangent.x, sp.tangent.z);
                host.vehicle.respawn(sp.position.x, sp.position.y + 0.6, sp.position.z, yaw);
                host.streamer.update(sp.distance);
                host.cameraCtrl.reset();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_sample_105})
            await asyncio.sleep(2.0)

            shot = await send('Page.captureScreenshot', {'format': 'png'})
            with open(os.path.join(ARTIFACT_DIR, 'gp_sample_105_front_straight_stadium.png'), 'wb') as f:
                f.write(base64.b64decode(shot['data']))
            print('Saved gp_sample_105_front_straight_stadium.png')

    finally:
        p.kill()

asyncio.run(capture())
