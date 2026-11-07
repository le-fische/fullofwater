import asyncio
import json
import base64
import os
import subprocess
import websockets

ARTIFACT_DIR = "/Users/le/.gemini/antigravity/brain/55db9843-3d10-4f3e-bca2-e56e595ad88a"

async def main():
    chrome_cmd = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless=new",
        "--remote-debugging-port=9224",
        "--ignore-certificate-errors",
        "--enable-webgl",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--window-size=1920,1080",
        "https://localhost:5173"
    ]
    proc = subprocess.Popen(chrome_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    await asyncio.sleep(2.5)

    try:
        import urllib.request
        resp = urllib.request.urlopen("http://localhost:9224/json", timeout=5)
        tabs = json.loads(resp.read().decode())
        ws_url = tabs[0]["webSocketDebuggerUrl"]

        async with websockets.connect(ws_url, max_size=30*1024*1024) as ws:
            async def send_cmd(method, params=None):
                req_id = int(asyncio.get_event_loop().time() * 1000) % 1000000
                msg = {"id": req_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(msg))
                while True:
                    res = json.loads(await ws.recv())
                    if res.get("id") == req_id:
                        return res.get("result", {})

            await send_cmd("Page.enable")
            await send_cmd("Runtime.enable")

            # Wait 3s for model and app to initialize
            await asyncio.sleep(3.5)

            # 1. Launch Race on Grand Prix Circuit with Rexy or Grello
            launch_gp_code = """
            (() => {
                window.__racingHost.startRace('gp_strecke', 0, '911');
            })()
            """
            await send_cmd("Runtime.evaluate", {"expression": launch_gp_code})
            await asyncio.sleep(2.0)

            # Trigger a flag cycle so we see a live flag caution banner (e.g. SECTOR_2_YELLOW)
            flag_code = """
            (() => {
                window.__racingHost.competitionField.cycleFlag();
            })()
            """
            await send_cmd("Runtime.evaluate", {"expression": flag_code})
            await asyncio.sleep(0.5)

            # Capture 1: Big Minimap on GP Circuit with F1 competitor dots, dynamic flags, and track ribbon
            shot1 = await send_cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
            with open(os.path.join(ARTIFACT_DIR, "gp_accurate_minimap_f1_dots.png"), "wb") as f:
                f.write(base64.b64decode(shot1["data"]))
            print("Saved gp_accurate_minimap_f1_dots.png")

            # Capture 2: Cockpit Camera with In-Cockpit Micro Radar & Proximity Spotter
            cockpit_code = """
            (() => {
                window.__racingHost.cameraCtrl.setMode('cockpit');
                // Adjust cockpit camera slightly to give a clear view of both mirror and micro radar
                const cam = window.__racingHost.stage.camera;
                const cockpit = window.__racingHost.carMesh.cockpit;
            })()
            """
            await send_cmd("Runtime.evaluate", {"expression": cockpit_code})
            await asyncio.sleep(1.0)

            shot2 = await send_cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
            with open(os.path.join(ARTIFACT_DIR, "cockpit_micro_radar_display.png"), "wb") as f:
                f.write(base64.b64decode(shot2["data"]))
            print("Saved cockpit_micro_radar_display.png")

            # Capture 3: Chase Camera showcasing the GP Stadium Grandstands, Pit Building & Timing Gantry
            chase_code = """
            (() => {
                window.__racingHost.cameraCtrl.setMode('chase');
            })()
            """
            await send_cmd("Runtime.evaluate", {"expression": chase_code})
            await asyncio.sleep(0.8)

            shot3 = await send_cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
            with open(os.path.join(ARTIFACT_DIR, "gp_stadium_grandstands.png"), "wb") as f:
                f.write(base64.b64decode(shot3["data"]))
            print("Saved gp_stadium_grandstands.png")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()

asyncio.run(main())
