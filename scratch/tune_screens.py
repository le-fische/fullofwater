import subprocess
import time
import urllib.request
import json
import asyncio
import websockets
import base64
import os

ARTIFACT_DIR = '/Users/le/.gemini/antigravity/brain/55db9843-3d10-4f3e-bca2-e56e595ad88a'
PORT = 9302

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

async def run():
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

            # Switch to cockpit view
            script_cockpit = """
            (() => {
                const host = window.__racingHost;
                if (host.cameraCtrl && host.cameraCtrl.mode !== 'cockpit') {
                    host.cameraCtrl.cycleView();
                }
            })()
            """
            await send('Runtime.evaluate', {'expression': script_cockpit})
            await asyncio.sleep(1.0)

            # Tune console and mirror bracket
            tune_script = """
            (() => {
                const host = window.__racingHost;
                const cockpit = host.carMesh.cockpit;

                // Find bracket
                let bracket = null;
                cockpit.group.children.forEach(child => {
                    if (child.type === 'Group' && child.children.some(c => c.name === 'In_Cockpit_Micro_Radar')) {
                        bracket = child;
                    }
                });

                // Find console mesh (the carbon box at x = -0.06)
                let consoleMesh = null;
                cockpit.group.children.forEach(child => {
                    if (child.type === 'Mesh' && Math.abs(child.position.x - (-0.06)) < 0.02) {
                        consoleMesh = child;
                    }
                });

                // Lower the procedural console mesh down to tunnel height so it doesn't occlude the dash
                if (consoleMesh) {
                    consoleMesh.position.set(-0.06, 0.20, 0.24);
                    consoleMesh.rotation.set(-0.70, 0.20, -0.05);
                }

                // Position bracket cleanly on dash
                if (bracket) {
                    bracket.position.set(-0.10, 0.51, 0.26);
                    bracket.rotation.y = -0.38;
                    bracket.rotation.x = -0.12;
                    
                    // Also adjust microRadar local position forward
                    const radar = bracket.children.find(c => c.name === 'In_Cockpit_Micro_Radar');
                    if (radar) {
                        radar.position.set(0, -0.055, -0.015);
                    }
                }
                return { bracket: !!bracket, console: !!consoleMesh };
            })()
            """
            res_tune = await send('Runtime.evaluate', {'expression': tune_script, 'returnByValue': True})
            print('Tune result:', res_tune)
            await asyncio.sleep(0.5)

            res_ss = await send('Page.captureScreenshot', {'format': 'png'})
            data_ss = base64.b64decode(res_ss.get('data', ''))
            fn = "cockpit_perfect_view.png"
            with open(os.path.join(ARTIFACT_DIR, fn), 'wb') as f:
                f.write(data_ss)
            print(f"Saved {fn}")

    finally:
        p.terminate()

if __name__ == '__main__':
    asyncio.run(run())
