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
PORT = 9285

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

async def capture_all():
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

            await asyncio.sleep(1.5)

            # 1. Launch GP-Strecke Race with Livery #0 (#911 Rexy) and cycle flag to Caution
            print('Starting race on GP-Strecke...')
            script_gp = """
            (() => {
                window.__racingHost.startRace('gp_strecke', 0, '911');
                // Trigger sector yellow flag
                window.__racingHost.competitionField.cycleFlag();
                // Dismiss HUD QR code box to keep cockpit windshield and micro radar clear
                document.getElementById('hud-qr-box')?.click();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_gp})
            print('Waiting 5s for track chunks and stadium assets to initialize...')
            await asyncio.sleep(5.0)

            # Check appState
            state_res = await send('Runtime.evaluate', {'expression': 'window.__racingHost?.appState', 'returnByValue': True})
            print('AppState:', state_res.get('result', {}).get('value'))

            # Screenshot 1: Big Minimap on GP Circuit with F1 competitor dots, yellow flag caution pill & 5.1km track ribbon
            res1 = await send('Page.captureScreenshot', {'format': 'png'})
            data1 = base64.b64decode(res1.get('data', ''))
            path1 = os.path.join(ARTIFACT_DIR, 'gp_accurate_minimap_f1_dots.png')
            with open(path1, 'wb') as f:
                f.write(data1)
            im1 = Image.open(path1)
            print(f'Captured gp_accurate_minimap_f1_dots.png: size={im1.size}, bytes={len(data1)}')

            # Screenshot 2: Cockpit Camera with focused view of In-Cockpit Micro Radar Display
            print('Focusing on micro radar display...')
            script_radar_focus = """
            (() => {
                const host = window.__racingHost;
                // Move competitor car alongside to activate the proximity hazard arc & banner
                if (host.competitionField && host.competitionField.cars.length > 0) {
                    const c0 = host.competitionField.cars[0];
                    c0.distanceM = 3.5; // right ahead/alongside
                    const c1 = host.competitionField.cars[1];
                    c1.distanceM = host.centerline.totalLengthM - 2.5; // right behind
                }
                // Zoom camera onto center console (micro radar & rear-view screen)
                const cam = host.stage.camera;
                cam.position.set(0.18, 0.60, -0.05);
                cam.lookAt(0.20, 0.48, 0.65);
                cam.fov = 50;
                cam.updateProjectionMatrix();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_radar_focus})
            await asyncio.sleep(1.5)

            res2 = await send('Page.captureScreenshot', {'format': 'png'})
            data2 = base64.b64decode(res2.get('data', ''))
            path2 = os.path.join(ARTIFACT_DIR, 'cockpit_micro_radar_display.png')
            with open(path2, 'wb') as f:
                f.write(data2)
            im2 = Image.open(path2)
            print(f'Captured cockpit_micro_radar_display.png: size={im2.size}, bytes={len(data2)}')

            # Screenshot 3: Chase Camera viewing the GP Stadium Grandstands, Concrete Pit Building & Gantry
            print('Switching to chase view to inspect grandstands...')
            script_chase_stadium = """
            (() => {
                const host = window.__racingHost;
                if (host.cameraCtrl.mode !== 'chase') {
                    host.cameraCtrl.cycleView();
                }
            })()
            """
            await send('Runtime.evaluate', {'expression': script_chase_stadium})
            await asyncio.sleep(1.8)

            res3 = await send('Page.captureScreenshot', {'format': 'png'})
            data3 = base64.b64decode(res3.get('data', ''))
            path3 = os.path.join(ARTIFACT_DIR, 'gp_stadium_grandstands.png')
            with open(path3, 'wb') as f:
                f.write(data3)
            im3 = Image.open(path3)
            print(f'Captured gp_stadium_grandstands.png: size={im3.size}, bytes={len(data3)}')

    finally:
        p.terminate()
        try:
            p.wait(timeout=2)
        except Exception:
            p.kill()

asyncio.run(capture_all())
