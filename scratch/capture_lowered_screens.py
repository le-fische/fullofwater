import subprocess
import time
import urllib.request
import json
import asyncio
import websockets
import base64
import os

ARTIFACT_DIR = '/Users/le/.gemini/antigravity/brain/55db9843-3d10-4f3e-bca2-e56e595ad88a'
PORT = 9303

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
            })()
            """
            await send('Runtime.evaluate', {'expression': script_start})
            await asyncio.sleep(3.0)

            # 1. Capture standard cockpit view with lowered screens and unobstructed windshield
            script_cockpit = """
            (() => {
                const host = window.__racingHost;
                if (host.cameraCtrl && host.cameraCtrl.mode !== 'cockpit') {
                    host.cameraCtrl.cycleView();
                }
            })()
            """
            await send('Runtime.evaluate', {'expression': script_cockpit})
            await asyncio.sleep(1.5)

            res1 = await send('Page.captureScreenshot', {'format': 'png'})
            data1 = base64.b64decode(res1.get('data', ''))
            path1 = os.path.join(ARTIFACT_DIR, 'cockpit_lowered_screens_windshield_clear.png')
            with open(path1, 'wb') as f:
                f.write(data1)
            print('Saved cockpit_lowered_screens_windshield_clear.png')

            # 2. Activate Rear-View mode (Look Behind) via host.keyState.rearView = true
            script_rear = """
            (() => {
                const host = window.__racingHost;
                host.keyState.rearView = true;
            })()
            """
            await send('Runtime.evaluate', {'expression': script_rear})
            await asyncio.sleep(1.0)

            res2 = await send('Page.captureScreenshot', {'format': 'png'})
            data2 = base64.b64decode(res2.get('data', ''))
            path2 = os.path.join(ARTIFACT_DIR, 'cockpit_rear_view_mounted_at_rear.png')
            with open(path2, 'wb') as f:
                f.write(data2)
            print('Saved cockpit_rear_view_mounted_at_rear.png')

            # Release Rear-View mode
            script_release = """
            (() => {
                const host = window.__racingHost;
                host.keyState.rearView = false;
            })()
            """
            await send('Runtime.evaluate', {'expression': script_release})

    finally:
        p.terminate()

if __name__ == '__main__':
    asyncio.run(capture())
