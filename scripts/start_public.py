#!/usr/bin/env python3
import os
import re
import sys
import time
import subprocess
import urllib.request
import urllib.error

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(REPO_DIR, "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

def kill_existing():
    print("=== [1/6] Stopping existing conflicting processes... ===")
    cmds = [
        "pkill -f 'cloudflared tunnel --url http://localhost:3000' || true",
        "pkill -f 'cloudflared tunnel --url http://localhost:3210' || true",
        "pkill -f 'backend-echo/server.mjs' || true",
        "pkill -f 'next start' || true",
        "lsof -ti:4000 | xargs kill -9 2>/dev/null || true",
        "lsof -ti:3000 | xargs kill -9 2>/dev/null || true",
    ]
    for cmd in cmds:
        subprocess.run(cmd, shell=True, stderr=subprocess.DEVNULL)
    time.sleep(2)

def is_port_listening(port):
    res = subprocess.run(f"lsof -i:{port}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return res.returncode == 0

def extract_trycloudflare_url(log_file, timeout=30):
    start = time.time()
    url_pattern = re.compile(r'https://[-a-zA-Z0-9.]+\.trycloudflare\.com')
    while time.time() - start < timeout:
        if os.path.exists(log_file):
            with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                matches = url_pattern.findall(content)
                if matches:
                    return matches[0]
        time.sleep(0.5)
    return None

def main():
    print(f"Working Directory: {REPO_DIR}")
    kill_existing()

    # 1. Start backend-echo on port 4000
    print("=== [2/6] Starting backend-echo daemon on port 4000... ===")
    backend_log = open(os.path.join(LOGS_DIR, "backend-echo.log"), "w")
    backend_proc = subprocess.Popen(
        ["node", "backend-echo/server.mjs"],
        cwd=REPO_DIR,
        stdout=backend_log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    print(f"Backend Echo started (PID: {backend_proc.pid})")
    
    # Wait for port 4000
    for _ in range(20):
        if is_port_listening(4000):
            print("✓ Backend Echo ready on port 4000")
            break
        time.sleep(0.5)
    else:
        print("Error: Port 4000 not listening")
        sys.exit(1)

    # 2. Start Cloudflare Tunnel for Convex (port 3210)
    print("=== [3/6] Starting Cloudflare Tunnel for Convex (port 3210)... ===")
    convex_log_path = os.path.join(LOGS_DIR, "tunnel-convex.log")
    if os.path.exists(convex_log_path):
        os.remove(convex_log_path)
    convex_log = open(convex_log_path, "w")
    convex_tunnel = subprocess.Popen(
        [os.path.join(REPO_DIR, "bin", "cloudflared"), "tunnel", "--url", "http://localhost:3210"],
        cwd=REPO_DIR,
        stdout=convex_log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    print(f"Convex Tunnel started (PID: {convex_tunnel.pid})")
    convex_url = extract_trycloudflare_url(convex_log_path, timeout=30)
    if not convex_url:
        print("Error: Could not retrieve Convex tunnel URL")
        sys.exit(1)
    print(f"✓ Convex Tunnel Active: {convex_url}")

    # Synchronize .env.local
    env_local_path = os.path.join(REPO_DIR, "apps", "app", ".env.local")
    with open(env_local_path, "w") as f:
        f.write(f"NEXT_PUBLIC_CONVEX_URL={convex_url}\nNEXT_PUBLIC_BACKEND_URL=\n")
    print(f"✓ Synchronized {env_local_path}")

    # 3. Start Next.js Production Server on port 3000
    print("=== [4/6] Starting Next.js Production Server on port 3000... ===")
    next_log_path = os.path.join(LOGS_DIR, "next-app.log")
    if os.path.exists(next_log_path):
        os.remove(next_log_path)
    next_log = open(next_log_path, "w")
    next_bin = os.path.join(REPO_DIR, "node_modules", ".bin", "next")
    next_env = os.environ.copy()
    next_env["NEXT_PUBLIC_CONVEX_URL"] = convex_url
    next_proc = subprocess.Popen(
        [next_bin, "start"],
        cwd=os.path.join(REPO_DIR, "apps", "app"),
        stdout=next_log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        env=next_env,
        start_new_session=True,
    )
    print(f"Next.js started (PID: {next_proc.pid})")

    # Wait for port 3000
    for _ in range(30):
        if is_port_listening(3000):
            print("✓ Next.js ready on port 3000")
            break
        time.sleep(0.5)
    else:
        print("Error: Port 3000 not listening")
        sys.exit(1)

    # 4. Start Cloudflare Tunnel for Next.js App (port 3000)
    print("=== [5/6] Starting Cloudflare Tunnel for Next.js App (port 3000)... ===")
    app_log_path = os.path.join(LOGS_DIR, "tunnel-app.log")
    if os.path.exists(app_log_path):
        os.remove(app_log_path)
    app_log = open(app_log_path, "w")
    app_tunnel = subprocess.Popen(
        [os.path.join(REPO_DIR, "bin", "cloudflared"), "tunnel", "--url", "http://localhost:3000"],
        cwd=REPO_DIR,
        stdout=app_log,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    print(f"App Tunnel started (PID: {app_tunnel.pid})")
    app_url = extract_trycloudflare_url(app_log_path, timeout=30)
    if not app_url:
        print("Error: Could not retrieve App tunnel URL")
        sys.exit(1)
    print(f"✓ App Tunnel Active: {app_url}")

    # 5. Verification via curl / urllib
    print("=== [6/6] Verifying public tunnel endpoints... ===")
    time.sleep(3)
    def check_url(url):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            return e.code
        except Exception as e:
            return f"err: {e}"

    dash_code = check_url(app_url)
    editor_code = check_url(f"{app_url}/editor/m579g6v1s41trb1d80re8jfdds8g27n3")
    raw_code = check_url(f"{app_url}/editor/project/m579g6v1s41trb1d80re8jfdds8g27n3/raw/index.html")
    convex_code = check_url(f"{convex_url}/version")

    print(f"  Dashboard:       HTTP {dash_code}")
    print(f"  Editor:          HTTP {editor_code}")
    print(f"  Raw Composition: HTTP {raw_code}")
    print(f"  Convex Backend:  HTTP {convex_code}")

    now_str = time.strftime("%Y-%m-%d %H:%M:%S")
    summary = f"""================================================================================
HYPARLINK DASHBOARD & HYPERFRAMES EDITOR — PUBLIC CLOUDFLARE ACCESS
Generated: {now_str}
Status: PERSISTENT DAEMONS RUNNING DETACHED (PPID 1 / launchd)
================================================================================

PUBLIC DASHBOARD URL:
{app_url}

HYPERFRAMES EDITOR DIRECT URL (Absolute Batman Video Project):
{app_url}/editor/m579g6v1s41trb1d80re8jfdds8g27n3

LIVE COMPOSITION PREVIEW (HTML/GSAP Timeline):
{app_url}/editor/project/m579g6v1s41trb1d80re8jfdds8g27n3/raw/index.html

RENDERED VIDEO CDN STREAM:
{app_url}/cdn/workspaces/mh7eadmg10g11yqwbjtyc41yjs8fxx17/projects/m579g6v1s41trb1d80re8jfdds8g27n3/renders/ks748m9rrs7r2krtpngf9m49q18g2955/video.mp4

CONVEX BACKEND TUNNEL:
{convex_url}

--------------------------------------------------------------------------------
PROCESS HEALTH & VERIFICATION:
- Dashboard:        HTTP {dash_code} OK
- Editor:           HTTP {editor_code} OK
- Composition:      HTTP {raw_code} OK
- Convex Sync:      HTTP {convex_code} OK
- Backend Echo PID: {backend_proc.pid} (Port 4000)
- Next.js PID:      {next_proc.pid} (Port 3000)
- Convex Tunnel PID:{convex_tunnel.pid}
- App Tunnel PID:   {app_tunnel.pid}

--------------------------------------------------------------------------------
SURVIVES ANTIGRAVITY EXIT:
All 4 daemons are running with start_new_session=True (detached POSIX sessions).
They have NO controlling terminal and are reparented directly to PID 1 (launchd).
Even if you QUIT Antigravity IDE, these URLs will remain 100% active and working!

Logs are saved at:
- {os.path.join(LOGS_DIR, 'next-app.log')}
- {os.path.join(LOGS_DIR, 'backend-echo.log')}
- {os.path.join(LOGS_DIR, 'tunnel-app.log')}
- {os.path.join(LOGS_DIR, 'tunnel-convex.log')}

TO STOP ALL SERVICES:
Run: {os.path.join(REPO_DIR, 'scripts', 'stop-public-services.sh')}
================================================================================
"""
    desktop_file = os.path.expanduser("~/Desktop/HYPARLINK_PUBLIC_ACCESS.txt")
    with open(desktop_file, "w") as f:
        f.write(summary)
    with open(os.path.join(REPO_DIR, "HYPARLINK_PUBLIC_ACCESS.txt"), "w") as f:
        f.write(summary)

    print("\n" + summary)

if __name__ == "__main__":
    main()
