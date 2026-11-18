"""
Deterministic Code-Based Video Render HTTP Service
Provides REST API, live progress tracking, and Web UI for rendering HTML/CSS/SVG animations into 1080p MP4s.
"""

import os
import sys
import uuid
import json
import asyncio
import subprocess
from aiohttp import web
from typing import Dict, Any

from linter import lint_html
from worker import render_job_async

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JOBS_DIR = os.path.join(BASE_DIR, "jobs")
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(JOBS_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

# In-memory job state store
jobs: Dict[str, Dict[str, Any]] = {}

INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ollastar Video Render Studio — Code to 1080p MP4</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card: #111827;
      --border: #1f293d;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.25);
      --success: #10b981;
      --text: #f3f4f6;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Poppins', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(17, 24, 39, 0.8);
      backdrop-filter: blur(12px);
    }
    .logo {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .badge {
      background: var(--accent-glow);
      color: var(--accent);
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      border: 1px solid var(--accent);
    }
    main {
      flex: 1;
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    @media (max-width: 960px) {
      main { grid-template-columns: 1fr; }
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .card-title {
      font-size: 1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    textarea {
      width: 100%;
      height: 380px;
      background: #060911;
      border: 1px solid var(--border);
      border-radius: 8px;
      color: #38bdf8;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      padding: 1rem;
      outline: none;
      resize: vertical;
    }
    textarea:focus { border-color: var(--accent); }
    .row { display: flex; gap: 1rem; }
    .col { flex: 1; display: flex; flex-direction: column; gap: 0.35rem; }
    label { font-size: 0.8rem; color: var(--muted); font-weight: 600; }
    input[type="number"], select {
      background: #060911;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.6rem;
      color: var(--text);
      font-family: inherit;
      outline: none;
    }
    .btn {
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .btn-primary { background: #0284c7; color: white; }
    .btn-primary:hover { background: #0369a1; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #1e293b; color: var(--text); }
    .btn-secondary:hover { background: #334155; }
    .progress-bar-bg {
      height: 8px;
      background: #1e293b;
      border-radius: 999px;
      overflow: hidden;
      margin-top: 0.5rem;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--accent);
      width: 0%;
      transition: width 0.3s ease;
    }
    .status-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: var(--accent);
    }
    video {
      width: 100%;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: black;
    }
    .lint-box {
      background: #060911;
      border-radius: 8px;
      padding: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
    }
    .lint-err { color: #f87171; }
    .lint-ok { color: #34d399; }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <span>🎬</span> Ollastar Render Backend
      <span class="badge">1080p 30fps</span>
    </div>
    <div style="font-size: 0.85rem; color: var(--muted);">Deterministic Playwright + FFmpeg Engine</div>
  </header>

  <main>
    <div class="card">
      <div class="card-title">
        <span>Animation Code (HTML/CSS/SVG)</span>
        <button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="loadSample()">Load Shoe Ad</button>
      </div>
      <textarea id="htmlCode" placeholder="Paste full self-contained HTML with CSS @keyframes and inline SVG here..."></textarea>
      
      <div class="row">
        <div class="col">
          <label>Duration (seconds)</label>
          <input type="number" id="durInput" value="27" step="0.5" min="1">
        </div>
        <div class="col">
          <label>Framerate (FPS)</label>
          <input type="number" id="fpsInput" value="30" readonly>
        </div>
        <div class="col">
          <label>Resolution</label>
          <select id="resSelect">
            <option value="1920x1080">1920x1080 (1080p)</option>
          </select>
        </div>
      </div>

      <div class="row" style="margin-top: 0.5rem;">
        <button class="btn btn-secondary" style="flex: 1;" onclick="validateCode()">Verify & Lint</button>
        <button class="btn btn-primary" style="flex: 2;" id="renderBtn" onclick="startRender()">🚀 Render 1080p MP4</button>
      </div>

      <div id="lintOutput" class="lint-box" style="display: none;"></div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Render Output & Verification</span>
        <span id="jobBadge" class="badge" style="display:none;">Job: -</span>
      </div>

      <div id="statusContainer" style="display: none; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span class="status-text" id="statusLabel">Queued...</span>
          <span class="status-text" id="pctLabel">0%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="progressBar"></div>
        </div>
      </div>

      <div id="videoContainer" style="display: none; flex-direction: column; gap: 1rem;">
        <video id="player" controls playsinline></video>
        <div class="row">
          <a id="downloadLink" class="btn btn-primary" style="flex: 1; text-decoration: none;" download="ad.mp4">⬇ Download MP4</a>
          <button class="btn btn-secondary" onclick="viewContactSheet()">View Contact Sheet</button>
        </div>
      </div>

      <div id="contactContainer" style="display: none; margin-top: 0.5rem;">
        <label style="margin-bottom: 0.25rem;">Contact Sheet (Verification Montage):</label>
        <img id="contactImg" style="width: 100%; border-radius: 8px; border: 1px solid var(--border);" />
      </div>

      <div id="placeholder" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--muted); gap: 0.5rem; min-height: 250px;">
        <span style="font-size: 2.5rem;">🎞️</span>
        <span>Rendered 1080p video player will appear here</span>
      </div>
    </div>
  </main>

  <script>
    let currentJobId = null;
    let pollInterval = null;

    async function validateCode() {
      const html = document.getElementById('htmlCode').value;
      if (!html) return alert('Please paste HTML code first');
      const box = document.getElementById('lintOutput');
      box.style.display = 'block';
      box.innerHTML = 'Validating syntax...';
      try {
        const res = await fetch('/lint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html })
        });
        const data = await res.json();
        if (data.valid) {
          box.innerHTML = `<span class="lint-ok">✓ Ready for deterministic render!</span><br>SeekTo: ${data.stats.hasSeekTo ? 'Present' : 'Auto-injected'}<br>Estimated Dur: ${data.stats.estimatedDuration}s (${data.stats.estimatedWidth}x${data.stats.estimatedHeight})`;
          if (data.stats.estimatedDuration) {
            document.getElementById('durInput').value = data.stats.estimatedDuration;
          }
        } else {
          box.innerHTML = `<span class="lint-err">Lint Errors:</span><br>` + data.errors.map(e => '• ' + e).join('<br>');
        }
      } catch (err) {
        box.innerHTML = `<span class="lint-err">Validation failed: ${err.message}</span>`;
      }
    }

    async function startRender() {
      const html = document.getElementById('htmlCode').value;
      if (!html) return alert('Please enter HTML first');
      const duration = parseFloat(document.getElementById('durInput').value) || 27;
      const btn = document.getElementById('renderBtn');
      btn.disabled = true;

      document.getElementById('statusContainer').style.display = 'flex';
      document.getElementById('videoContainer').style.display = 'none';
      document.getElementById('placeholder').style.display = 'none';
      document.getElementById('statusLabel').textContent = 'Queuing render job...';
      document.getElementById('progressBar').style.width = '2%';
      document.getElementById('pctLabel').textContent = '2%';

      try {
        const res = await fetch('/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, duration, fps: 30, width: 1920, height: 1080 })
        });
        const data = await res.json();
        if (data.jobId) {
          currentJobId = data.jobId;
          document.getElementById('jobBadge').style.display = 'inline-block';
          document.getElementById('jobBadge').textContent = 'Job: ' + currentJobId.slice(0, 8);
          pollJob(currentJobId);
        } else {
          alert('Failed to start job: ' + (data.error || 'Unknown'));
          btn.disabled = false;
        }
      } catch (err) {
        alert('Render dispatch failed: ' + err.message);
        btn.disabled = false;
      }
    }

    function pollJob(jobId) {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/jobs/${jobId}`);
          const job = await res.json();
          document.getElementById('statusLabel').textContent = job.status.toUpperCase() + '...';
          document.getElementById('progressBar').style.width = (job.progress || 0) + '%';
          document.getElementById('pctLabel').textContent = (job.progress || 0) + '%';

          if (job.status === 'done') {
            clearInterval(pollInterval);
            document.getElementById('renderBtn').disabled = false;
            document.getElementById('statusLabel').textContent = 'RENDER COMPLETE';
            document.getElementById('videoContainer').style.display = 'flex';
            const vid = document.getElementById('player');
            vid.src = `/jobs/${jobId}/video.mp4`;
            document.getElementById('downloadLink').href = `/jobs/${jobId}/video.mp4`;
            document.getElementById('contactImg').src = `/jobs/${jobId}/contact.jpg`;
            document.getElementById('contactContainer').style.display = 'block';
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            document.getElementById('renderBtn').disabled = false;
            document.getElementById('statusLabel').textContent = 'FAILED: ' + (job.error || 'Render failed');
            alert('Render failed: ' + job.error);
          }
        } catch (e) {}
      }, 1000);
    }

    async function loadSample() {
      try {
        const res = await fetch('/samples/shoe-ad.html');
        if (res.ok) {
          const code = await res.text();
          document.getElementById('htmlCode').value = code;
          document.getElementById('durInput').value = 27;
        }
      } catch (e) {
        alert('Could not load sample shoe ad');
      }
    }
  </script>
</body>
</html>
"""

async def handle_index(request: web.Request) -> web.Response:
    return web.Response(text=INDEX_HTML, content_type="text/html")

async def handle_lint(request: web.Request) -> web.Response:
    try:
        data = await request.json()
        html = data.get("html", "")
        res = lint_html(html)
        return web.json_response(res)
    except Exception as e:
        return web.json_response({"valid": False, "errors": [str(e)]}, status=400)

async def handle_render(request: web.Request) -> web.Response:
    try:
        html = ""
        duration = 27.0
        fps = 30
        width = 1920
        height = 1080

        if request.content_type == "multipart/form-data":
            reader = await request.multipart()
            while True:
                part = await reader.next()
                if part is None:
                    break
                if part.name == "html":
                    html = (await part.read()).decode("utf-8")
                elif part.name == "file":
                    html = (await part.read()).decode("utf-8")
                elif part.name == "duration":
                    duration = float((await part.read()).decode("utf-8"))
                elif part.name == "fps":
                    fps = int((await part.read()).decode("utf-8"))
        else:
            data = await request.json()
            html = data.get("html", "")
            duration = float(data.get("duration", 27.0))
            fps = int(data.get("fps", 30))
            width = int(data.get("width", 1920))
            height = int(data.get("height", 1080))

        if not html:
            return web.json_response({"error": "Missing html parameter"}, status=400)

        # Pre-lint verification
        lint_res = lint_html(html)
        if not lint_res["valid"]:
            return web.json_response({
                "error": "HTML validation failed",
                "details": lint_res["errors"]
            }, status=400)

        job_id = str(uuid.uuid4())
        job_dir = os.path.join(JOBS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)

        job_entry = {
            "id": job_id,
            "status": "queued",
            "progress": 0,
            "duration": duration,
            "fps": fps,
            "width": width,
            "height": height,
            "dir": job_dir,
            "error": None,
            "videoUrl": f"/jobs/{job_id}/video.mp4",
            "previewUrl": f"/jobs/{job_id}/preview",
            "contactUrl": f"/jobs/{job_id}/contact.jpg"
        }
        jobs[job_id] = job_entry

        def update_job_status(status: str, progress: int, error: str = None):
            job_entry["status"] = status
            job_entry["progress"] = progress
            if error:
                job_entry["error"] = error

        async def run_worker():
            try:
                res = await render_job_async(
                    html=html,
                    output_dir=job_dir,
                    fps=fps,
                    duration=duration,
                    width=width,
                    height=height,
                    status_callback=update_job_status
                )
                job_entry["result"] = res
            except Exception as e:
                update_job_status("failed", 0, str(e))

        asyncio.create_task(run_worker())

        return web.json_response({
            "jobId": job_id,
            "status": "queued",
            "estimatedDuration": duration
        })

    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def handle_get_job(request: web.Request) -> web.Response:
    job_id = request.match_info.get("id")
    job = jobs.get(job_id)
    if not job:
        return web.json_response({"error": "Job not found"}, status=404)
    return web.json_response(job)

async def handle_get_video(request: web.Request) -> web.Response:
    job_id = request.match_info.get("id")
    job = jobs.get(job_id)
    if not job:
        return web.Response(text="Job not found", status=404)

    video_path = os.path.join(job["dir"], "out.mp4")
    if not os.path.exists(video_path):
        return web.Response(text="Video not ready or render failed", status=404)

    file_size = os.path.getsize(video_path)
    range_header = request.headers.get("Range")

    if range_header:
        # Simple single range parsing
        parts = range_header.replace("bytes=", "").split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        length = end - start + 1
        with open(video_path, "rb") as f:
            f.seek(start)
            data = f.read(length)
        return web.Response(
            body=data,
            status=206,
            headers={
                "Content-Type": "video/mp4",
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(length),
                "Accept-Ranges": "bytes"
            }
        )

    return web.FileResponse(video_path, headers={"Accept-Ranges": "bytes", "Content-Type": "video/mp4"})

async def handle_get_preview(request: web.Request) -> web.Response:
    job_id = request.match_info.get("id")
    job = jobs.get(job_id)
    if not job:
        return web.Response(text="Job not found", status=404)

    t = float(request.query.get("t", "1.0"))
    preview_file = os.path.join(job["dir"], f"preview_{t:.1f}.jpg")

    if os.path.exists(preview_file):
        return web.FileResponse(preview_file, headers={"Content-Type": "image/jpeg"})

    video_path = os.path.join(job["dir"], "out.mp4")
    if os.path.exists(video_path):
        cmd = ["ffmpeg", "-y", "-ss", str(t), "-i", video_path, "-vframes", "1", "-q:v", "3", preview_file]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(preview_file):
            return web.FileResponse(preview_file, headers={"Content-Type": "image/jpeg"})

    return web.Response(text="Preview not available yet", status=404)

async def handle_get_contact(request: web.Request) -> web.Response:
    job_id = request.match_info.get("id")
    job = jobs.get(job_id)
    if not job:
        return web.Response(text="Job not found", status=404)
    contact_file = os.path.join(job["dir"], "contact.jpg")
    if os.path.exists(contact_file):
        return web.FileResponse(contact_file, headers={"Content-Type": "image/jpeg"})
    return web.Response(text="Contact sheet not ready", status=404)

async def handle_get_sample(request: web.Request) -> web.Response:
    sample_name = request.match_info.get("name")
    sample_path = os.path.join(BASE_DIR, "samples", sample_name)
    if os.path.exists(sample_path):
        return web.FileResponse(sample_path)
    # Check parent
    parent_path = os.path.join(BASE_DIR, "..", sample_name)
    if os.path.exists(parent_path):
        return web.FileResponse(parent_path)
    return web.Response(text="Sample not found", status=404)

def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/", handle_index)
    app.router.add_post("/lint", handle_lint)
    app.router.add_post("/render", handle_render)
    app.router.add_get("/jobs/{id}", handle_get_job)
    app.router.add_get("/jobs/{id}/video.mp4", handle_get_video)
    app.router.add_get("/jobs/{id}/preview", handle_get_preview)
    app.router.add_get("/jobs/{id}/contact.jpg", handle_get_contact)
    app.router.add_get("/samples/{name}", handle_get_sample)
    return app

if __name__ == "__main__":
    port = int(os.environ.get("RENDER_PORT", 5050))
    print(f"🎬 Starting Ollastar Video Render Backend on http://0.0.0.0:{port}")
    app = create_app()
    web.run_app(app, host="0.0.0.0", port=port)
