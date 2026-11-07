import subprocess
import time
import urllib.request
import json
import asyncio
import websockets
import base64
import os
from PIL import Image

ARTIFACT_DIR = '/Users/le/.gemini/antigravity/brain/55db9843-3d10-4f3e-bca2-e56e595ad88a'
PORT = 9290

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

            print('Waiting for showroom model loaded...')
            for attempt in range(120):
                res = await send('Runtime.evaluate', {'expression': '!!window.__racingHost?.showroomStage?.isModelLoaded'})
                if res.get('result', {}).get('value') is True:
                    print(f'Showroom model loaded on attempt {attempt}!')
                    break
                await asyncio.sleep(0.5)

            await asyncio.sleep(1.0)

            # 1. Start Nordschleife race
            print('Starting race on Nordschleife...')
            script_nord = """
            (() => {
                window.__racingHost.startRace('nordschleife', 0, '911');
                document.getElementById('hud-qr-box')?.click();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_nord})
            await asyncio.sleep(4.0)

            # Teleport to a curvy corner section (e.g. Hatzenbach or Wehrseifen) to look at track white lines
            script_teleport = """
            (() => {
                const host = window.__racingHost;
                // Hatzenbach S-curves (around 1050m)
                const pt = host.centerline.samples[210];
                host.vehicle.chassisBody.setTranslation({ x: pt.position.x, y: pt.position.y + 0.3, z: pt.position.z }, true);
                host.vehicle.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
                // Look ahead from chase cam
                host.cameraController.setMode('chase');
            })()
            """
            await send('Runtime.evaluate', {'expression': script_teleport})
            await asyncio.sleep(2.0)

            res1 = await send('Page.captureScreenshot', {'format': 'png'})
            data1 = base64.b64decode(res1.get('data', ''))
            path1 = os.path.join(ARTIFACT_DIR, 'nordschleife_smooth_white_lines_corner.png')
            with open(path1, 'wb') as f:
                f.write(data1)
            print('Saved nordschleife_smooth_white_lines_corner.png')

            # Close up on track edge / white line
            script_close = """
            (() => {
                const host = window.__racingHost;
                const cam = host.stage.camera;
                const pt = host.centerline.samples[210];
                cam.position.set(pt.position.x - 4.2, pt.position.y + 1.2, pt.position.z + 2.0);
                cam.lookAt(pt.position.x - 5.5, pt.position.y, pt.position.z + 10.0);
            })()
            """
            await send('Runtime.evaluate', {'expression': script_close})
            await asyncio.sleep(1.0)

            res2 = await send('Page.captureScreenshot', {'format': 'png'})
            data2 = base64.b64decode(res2.get('data', ''))
            path2 = os.path.join(ARTIFACT_DIR, 'nordschleife_white_line_close_up.png')
            with open(path2, 'wb') as f:
                f.write(data2)
            print('Saved nordschleife_white_line_close_up.png')

            # 2. Switch to GP-Strecke and capture
            print('Switching to GP-Strecke...')
            script_gp = """
            (() => {
                window.__racingHost.startRace('gp_strecke', 0, '911');
                document.getElementById('hud-qr-box')?.click();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_gp})
            await asyncio.sleep(4.0)

            # Teleport to Dunlop Kehre hairpin
            script_gp_dunlop = """
            (() => {
                const host = window.__racingHost;
                const pt = host.centerline.samples[180];
                host.vehicle.chassisBody.setTranslation({ x: pt.position.x, y: pt.position.y + 0.3, z: pt.position.z }, true);
                host.vehicle.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
                host.cameraController.setMode('chase');
            })()
            """
            await send('Runtime.evaluate', {'expression': script_gp_dunlop})
            await asyncio.sleep(2.0)

            res3 = await send('Page.captureScreenshot', {'format': 'png'})
            data3 = base64.b64decode(res3.get('data', ''))
            path3 = os.path.join(ARTIFACT_DIR, 'gp_dunlop_smooth_outline.png')
            with open(path3, 'wb') as f:
                f.write(data3)
            print('Saved gp_dunlop_smooth_outline.png')

    finally:
        p.terminate()

asyncio.run(capture())
