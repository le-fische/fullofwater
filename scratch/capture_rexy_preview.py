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
PORT = 9292

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
time.sleep(3.5)

async def capture_rexy():
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

            # Ensure Rexy livery is selected in Showroom (index 0) with #80
            print('Selecting Rexy livery and setting camera for front 3/4 hero view...')
            script_hero = """
            (() => {
                const host = window.__racingHost;
                const stage = host.showroomStage;
                // Select livery 0 (Rexy) and car number 80
                stage.setLivery(0);
                stage.setCarNumber('80');
                
                // Position camera for 3/4 front hero view matching user reference photo
                stage.targetYaw = stage.yaw = 0.58; // Front 3/4 angle
                stage.targetPitch = stage.pitch = 0.08; // Low aggressive stance
                stage.targetDistance = stage.distance = 4.2;
                stage.lastUserInteractTime = performance.now() + 999999;
            })()
            """
            await send('Runtime.evaluate', {'expression': script_hero})
            await asyncio.sleep(1.5)

            res1 = await send('Page.captureScreenshot', {'format': 'png'})
            data1 = base64.b64decode(res1.get('data', ''))
            path1 = os.path.join(ARTIFACT_DIR, 'rexy_three_quarter_hero_stance.png')
            with open(path1, 'wb') as f:
                f.write(data1)
            im1 = Image.open(path1)
            print(f'Captured rexy_three_quarter_hero_stance.png: size={im1.size}, bytes={len(data1)}')

            # View 2: Direct Front Bumper & Mouth Close-Up
            print('Positioning camera for direct front bumper & mouth close-up...')
            script_front = """
            (() => {
                const host = window.__racingHost;
                const stage = host.showroomStage;
                stage.targetYaw = stage.yaw = 0.0; // Straight on front nose
                stage.targetPitch = stage.pitch = 0.06; // Low angle looking right into the teeth
                stage.targetDistance = stage.distance = 3.2;
                stage.lastUserInteractTime = performance.now() + 999999;
            })()
            """
            await send('Runtime.evaluate', {'expression': script_front})
            await asyncio.sleep(1.2)

            res2 = await send('Page.captureScreenshot', {'format': 'png'})
            data2 = base64.b64decode(res2.get('data', ''))
            path2 = os.path.join(ARTIFACT_DIR, 'rexy_front_bumper_mouth_close_up.png')
            with open(path2, 'wb') as f:
                f.write(data2)
            im2 = Image.open(path2)
            print(f'Captured rexy_front_bumper_mouth_close_up.png: size={im2.size}, bytes={len(data2)}')

            # View 3: Side Profile showing T-Rex Arm, Talons, IMSA #80, and Belly Scales
            print('Positioning camera for side profile view...')
            script_side = """
            (() => {
                const host = window.__racingHost;
                const stage = host.showroomStage;
                stage.targetYaw = stage.yaw = 1.57; // 90 degrees side profile
                stage.targetPitch = stage.pitch = 0.06;
                stage.targetDistance = 4.0;
                stage.lastUserInteractTime = performance.now() + 999999;
            })()
            """
            await send('Runtime.evaluate', {'expression': script_side})
            await asyncio.sleep(1.2)

            res3 = await send('Page.captureScreenshot', {'format': 'png'})
            data3 = base64.b64decode(res3.get('data', ''))
            path3 = os.path.join(ARTIFACT_DIR, 'rexy_side_flank_belly_and_claw.png')
            with open(path3, 'wb') as f:
                f.write(data3)
            im3 = Image.open(path3)
            print(f'Captured rexy_side_flank_belly_and_claw.png: size={im3.size}, bytes={len(data3)}')

    finally:
        p.terminate()

asyncio.run(capture_rexy())
