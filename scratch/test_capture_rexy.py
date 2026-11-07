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
        "--remote-debugging-port=9223",
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
        resp = urllib.request.urlopen("http://localhost:9223/json", timeout=5)
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

            # Wait 3s for model and textures to load
            await asyncio.sleep(3.5)

            # Check if model is loaded
            check_code = "!!(window.__racingHost && window.__racingHost.showroomStage && window.__racingHost.showroomStage.isModelLoaded)"
            res = await send_cmd("Runtime.evaluate", {"expression": check_code, "returnByValue": True})
            print("Model loaded in showroom:", res.get("result", {}).get("value"))

            # Capture 1: Main Menu & Showroom Front 3/4 Stance
            shot1 = await send_cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
            with open(os.path.join(ARTIFACT_DIR, "rexy_showroom_stance.png"), "wb") as f:
                f.write(base64.b64decode(shot1["data"]))
            print("Saved rexy_showroom_stance.png")

            # Set camera to Side View matching user's uploaded image (Image 2)
            side_cam_code = """
            (() => {
                const s = window.__racingHost.showroomStage;
                // side view angle: yaw = PI/2, pitch = 0.15, distance = 4.8
                s.yaw = Math.PI / 2;
                s.targetYaw = Math.PI / 2;
                s.pitch = 0.14;
                s.targetPitch = 0.14;
                s.distance = 4.8;
                s.targetDistance = 4.8;
                s.updateCamera();
            })()
            """
            await send_cmd("Runtime.evaluate", {"expression": side_cam_code})
            await asyncio.sleep(0.5)

            shot2 = await send_cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
            with open(os.path.join(ARTIFACT_DIR, "rexy_side_wheel_hub_alignment.png"), "wb") as f:
                f.write(base64.b64decode(shot2["data"]))
            print("Saved rexy_side_wheel_hub_alignment.png")

            # Test picking a custom number e.g. #80
            change_num_code = """
            (() => {
                const menu = window.__racingHost.mainMenu;
                const input = document.getElementById('custom-car-number-input');
                if (input) {
                    input.value = '80';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            })()
            """
            await send_cmd("Runtime.evaluate", {"expression": change_num_code})
            await asyncio.sleep(0.8)

            shot3 = await send_cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
            with open(os.path.join(ARTIFACT_DIR, "rexy_custom_number_80.png"), "wb") as f:
                f.write(base64.b64decode(shot3["data"]))
            print("Saved rexy_custom_number_80.png")

            # Launch race session to check track
            launch_code = """
            (() => {
                window.__racingHost.startRace('nordschleife', 0, '77');
            })()
            """
            await send_cmd("Runtime.evaluate", {"expression": launch_code})
            await asyncio.sleep(2.0)

            # Switch to chase view to observe the car body and wheels
            chase_cam_code = """
            (() => {
                window.__racingHost.cameraCtrl.setMode('chase');
            })()
            """
            await send_cmd("Runtime.evaluate", {"expression": chase_cam_code})
            await asyncio.sleep(0.8)

            shot4 = await send_cmd("Page.captureScreenshot", {"format": "png", "fromSurface": True})
            with open(os.path.join(ARTIFACT_DIR, "rexy_track_chase_view.png"), "wb") as f:
                f.write(base64.b64decode(shot4["data"]))
            print("Saved rexy_track_chase_view.png")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()

asyncio.run(main())
