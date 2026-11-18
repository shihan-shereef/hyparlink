"""
Deterministic Playwright + FFmpeg Video Render Worker
Renders self-contained HTML/CSS/SVG animations frame-by-frame using window.seekTo(t).
"""

import os
import sys
import math
import shutil
import asyncio
import subprocess
import json
from typing import Optional, Callable, Dict, Any
from playwright.async_api import async_playwright

SEEK_SHIM = """
if (!window.seekTo) {
  window.seekTo = function(t) {
    // 1. Web Animations API (CSS keyframes & transitions)
    const anims = document.getAnimations();
    anims.forEach(a => {
      try {
        a.pause();
        a.currentTime = t * 1000;
      } catch (e) {}
    });
    // 2. GSAP timeline support
    if (window.__timelines && Array.isArray(window.__timelines)) {
      window.__timelines.forEach(tl => {
        try {
          if (typeof tl.seek === 'function') tl.seek(t, false);
          else if (typeof tl.time === 'function') tl.time(t);
        } catch (e) {}
      });
    }
    // 3. Custom timeline object
    if (window.timeline && typeof window.timeline.seek === 'function') {
      try { window.timeline.seek(t); } catch(e) {}
    }
  };
}
"""

async def render_worker_slice(
    browser,
    html_file_url: str,
    width: int,
    height: int,
    fps: int,
    total_frames: int,
    worker_index: int,
    num_workers: int,
    frames_dir: str,
    progress_callback: Optional[Callable[[int], None]] = None
):
    page = await browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
    
    # Block external CDNs and fonts to guarantee offline, fast determinism
    await page.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    await page.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    await page.route("**/cdn.jsdelivr.net/**", lambda r: r.abort())
    await page.route("**/cdnjs.cloudflare.com/**", lambda r: r.abort())

    await page.goto(html_file_url, wait_until="domcontentloaded")
    await page.evaluate(SEEK_SHIM)
    await page.wait_for_timeout(800)

    for i in range(worker_index, total_frames, num_workers):
        t = i / float(fps)
        await page.evaluate(f"window.seekTo({t})")
        frame_path = os.path.join(frames_dir, f"f_{i:05d}.jpg")
        await page.screenshot(path=frame_path, type="jpeg", quality=92)
        if progress_callback:
            progress_callback(i)

    await page.close()

async def render_job_async(
    html: str,
    output_dir: str,
    fps: int = 30,
    duration: float = 27.0,
    width: int = 1920,
    height: int = 1080,
    status_callback: Optional[Callable[[str, int, Optional[str]], None]] = None
) -> Dict[str, Any]:
    os.makedirs(output_dir, exist_ok=True)
    frames_dir = os.path.join(output_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)
    
    html_path = os.path.join(output_dir, "index.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    # Dynamic duration detection if unspecified or invalid
    if duration is None or duration <= 0:
        import re
        m = re.search(r'Total\s*=\s*(\d+)s', html, re.I)
        if m:
            duration = float(m.group(1))
        else:
            # Check maximum --start + --dur
            dur_matches = re.findall(r'--start:\s*([0-9.]+)s.*?--dur:\s*([0-9.]+)s', html, re.S)
            if dur_matches:
                max_end = max(float(s) + float(d) for s, d in dur_matches)
                duration = max_end if max_end > 0 else 27.0
            else:
                duration = 27.0

    total_frames = int(math.ceil(duration * fps))
    num_workers = min(os.cpu_count() or 4, 4)
    rendered_frames_count = 0

    def on_frame_rendered(frame_idx: int):
        nonlocal rendered_frames_count
        rendered_frames_count += 1
        pct = int((rendered_frames_count / total_frames) * 85) # 0-85% for frame capture
        if status_callback:
            status_callback("rendering", pct, None)

    if status_callback:
        status_callback("rendering", 5, None)

    html_file_url = f"file://{os.path.abspath(html_path)}"

    # 1. Capture frames using Playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=[
                "--disable-gpu",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        
        workers = [
            render_worker_slice(
                browser,
                html_file_url,
                width,
                height,
                fps,
                total_frames,
                w_idx,
                num_workers,
                frames_dir,
                on_frame_rendered
            )
            for w_idx in range(num_workers)
        ]
        await asyncio.gather(*workers)
        await browser.close()

    # 2. Encode to MP4 using FFmpeg
    if status_callback:
        status_callback("encoding", 88, None)

    out_mp4 = os.path.join(output_dir, "out.mp4")
    out_tmp = os.path.join(output_dir, "out.tmp.mp4")
    if os.path.exists(out_mp4):
        os.remove(out_mp4)
    if os.path.exists(out_tmp):
        os.remove(out_tmp)

    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", os.path.join(frames_dir, "f_%05d.jpg"),
        "-vf", "format=yuv420p",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "19",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        out_tmp
    ]

    proc = await asyncio.create_subprocess_exec(
        *ffmpeg_cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="replace")
        if status_callback:
            status_callback("failed", 0, f"FFmpeg encoding error: {err_msg}")
        raise RuntimeError(f"FFmpeg failed with exit code {proc.returncode}: {err_msg}")

    os.rename(out_tmp, out_mp4)

    # 3. Generate Contact Sheet Montage
    contact_jpg = os.path.join(output_dir, "contact.jpg")
    try:
        sample_times = [1.0, 5.0, 10.0, 15.0, 20.0, 25.0]
        sample_indices = [min(int(t * fps), total_frames - 1) for t in sample_times if t < duration]
        sample_files = [os.path.join(frames_dir, f"f_{idx:05d}.jpg") for idx in sample_indices if os.path.exists(os.path.join(frames_dir, f"f_{idx:05d}.jpg"))]
        
        if sample_files:
            # Build filter_complex to tile 3x2 or 2x2
            n_samples = len(sample_files)
            inputs = []
            for sf in sample_files:
                inputs.extend(["-i", sf])
            cols = 3 if n_samples >= 3 else n_samples
            rows = math.ceil(n_samples / cols)
            filter_str = f"tile={cols}x{rows}:padding=10:margin=10:color=black"
            
            contact_cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", filter_str, "-q:v", "3", contact_jpg]
            cp = await asyncio.create_subprocess_exec(*contact_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await cp.communicate()
    except Exception as e:
        print(f"[Worker] Notice: contact sheet generation: {e}")

    # 4. Verify with ffprobe
    verify_cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration:stream=width,height,r_frame_rate",
        "-of", "json",
        out_mp4
    ]
    vp = await asyncio.create_subprocess_exec(*verify_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    vout, _ = await vp.communicate()
    
    probe_data = {}
    if vp.returncode == 0:
        try:
            probe_data = json.loads(vout.decode("utf-8"))
        except Exception:
            pass

    # 5. Clean up intermediate JPEG frames to save disk space
    try:
        shutil.rmtree(frames_dir, ignore_errors=True)
    except Exception:
        pass

    if status_callback:
        status_callback("done", 100, None)

    return {
        "status": "done",
        "videoPath": out_mp4,
        "contactPath": contact_jpg if os.path.exists(contact_jpg) else None,
        "sizeBytes": os.path.getsize(out_mp4),
        "totalFrames": total_frames,
        "duration": duration,
        "probe": probe_data
    }

def render_job_sync(html: str, output_dir: str, fps: int = 30, duration: float = 27.0, width: int = 1920, height: int = 1080) -> Dict[str, Any]:
    return asyncio.run(render_job_async(html, output_dir, fps, duration, width, height))

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python worker.py <input.html> <output_dir> [duration=27] [fps=30]")
        sys.exit(1)
    in_file = sys.argv[1]
    out_d = sys.argv[2]
    dur = float(sys.argv[3]) if len(sys.argv) > 3 else 27.0
    f_rate = int(sys.argv[4]) if len(sys.argv) > 4 else 30
    
    with open(in_file, "r", encoding="utf-8") as fp:
        raw_html = fp.read()
        
    print(f"Starting deterministic render for {in_file} ({dur}s @ {f_rate}fps)...")
    res = render_job_sync(raw_html, out_d, fps=f_rate, duration=dur)
    print("Render complete! Result:", res)
