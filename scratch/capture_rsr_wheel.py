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

async def capture_wheel():
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

            # 1. Start Race session in cockpit mode
            print('Starting race...')
            script_start = """
            (() => {
                window.__racingHost.startRace('gp_strecke', 0, '911');
                document.getElementById('hud-qr-box')?.click();
            })()
            """
            await send('Runtime.evaluate', {'expression': script_start})
            await asyncio.sleep(4.0)

            # Screenshot 1: Full cockpit view showcasing the new Porsche 911 RSR steering wheel in driver view
            print('Capturing full cockpit driver view...')
            # Dismiss QR code and let frame settle
            await send('Runtime.evaluate', {'expression': "document.getElementById('hud-qr-box')?.remove();"})
            await asyncio.sleep(1.0)

            res1 = await send('Page.captureScreenshot', {'format': 'png'})
            data1 = base64.b64decode(res1.get('data', ''))
            path1 = os.path.join(ARTIFACT_DIR, 'porsche_rsr_steering_wheel_cockpit.png')
            with open(path1, 'wb') as f:
                f.write(data1)
            im1 = Image.open(path1)
            print(f'Captured porsche_rsr_steering_wheel_cockpit.png: size={im1.size}, bytes={len(data1)}')

            # Screenshot 2: Direct Close-Up on the Porsche 911 RSR Steering Wheel & 1:1 Screen
            print('Focusing close-up on RSR steering wheel & screen...')
            script_wheel_closeup = """
            (() => {
                const host = window.__racingHost;
                if (host.cameraCtrl) {
                    host.cameraCtrl.driverEyeOffset.set(0.35, 0.63, -0.14);
                    host.cameraCtrl.camera.fov = 46;
                    host.cameraCtrl.camera.updateProjectionMatrix();
                }
            })()
            """
            await send('Runtime.evaluate', {'expression': script_wheel_closeup})
            await asyncio.sleep(1.2)

            res2 = await send('Page.captureScreenshot', {'format': 'png'})
            data2 = base64.b64decode(res2.get('data', ''))
            path2 = os.path.join(ARTIFACT_DIR, 'porsche_rsr_screen_close_up.png')
            with open(path2, 'wb') as f:
                f.write(data2)
            im2 = Image.open(path2)
            print(f'Captured porsche_rsr_screen_close_up.png: size={im2.size}, bytes={len(data2)}')

            # Screenshot 3: Active Driving State with Revs & Steering Lock
            print('Applying steering angle and throttle revs...')
            script_revs = """
            (() => {
                const host = window.__racingHost;
                if (host.cameraCtrl) {
                    host.cameraCtrl.driverEyeOffset.set(0.35, 0.64, -0.16);
                    host.cameraCtrl.camera.fov = 54;
                    host.cameraCtrl.camera.updateProjectionMatrix();
                }

                const simTelem = {
                    speedKmh: 114,
                    rpm: 7850,
                    rpmRatio: 7850 / 9000,
                    gear: 2,
                    isShiftLightActive: false,
                    isAbsActive: false,
                    isTcActive: false,
                    steerAngleDeg: 18,
                    engineTorqueNm: 450,
                    wheelSlipAngle: [0, 0, 0, 0],
                    wheelSlipRatio: [0, 0, 0, 0],
                    suspensionCompression: [0, 0, 0, 0],
                    lateralG: 0.8,
                    longitudinalG: 0.4,
                    lapTimeSeconds: 42.85,
                    bestLapSeconds: 43.12,
                    sprint0to100Time: null,
                    rttMs: 0
                };
                
                const origUpdate = host.carMesh.cockpit.update;
                host.carMesh.cockpit.update = function(t, s, dt) {
                    origUpdate.call(this, simTelem, 18, dt);
                };
            })()
            """
            await send('Runtime.evaluate', {'expression': script_revs})
            await asyncio.sleep(1.0)

            res3 = await send('Page.captureScreenshot', {'format': 'png'})
            data3 = base64.b64decode(res3.get('data', ''))
            path3 = os.path.join(ARTIFACT_DIR, 'porsche_rsr_steering_wheel_turning.png')
            with open(path3, 'wb') as f:
                f.write(data3)
            im3 = Image.open(path3)
            print(f'Captured porsche_rsr_steering_wheel_turning.png: size={im3.size}, bytes={len(data3)}')

    finally:
        p.terminate()
        try:
            p.wait(timeout=2)
        except Exception:
            p.kill()

asyncio.run(capture_wheel())
