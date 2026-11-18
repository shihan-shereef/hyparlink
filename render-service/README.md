# Ollastar Deterministic Video Render Backend

High-performance, frame-by-frame deterministic rendering service for self-contained HTML/CSS/SVG animations, converting code-based ads directly into finished **1920x1080 @ 30 fps MP4** videos.

---

## 1. Why Deterministic Rendering?

Standard headless video capture tools rely on real-time screen recording, which often drops frames, skips complex CSS `@keyframes`, or halts SVG transforms.

This service utilizes a **seek-safe deterministic architecture**:
1. Spawns headless Chromium via Playwright at 1920x1080 viewport (`deviceScaleFactor: 1`).
2. Blocks non-deterministic external CDNs and WebFonts.
3. Injects or binds to `window.seekTo(t)`.
4. Distributes frames across parallel worker tasks (`i % N`).
5. Captures uncompressed JPEG frames at quality 92.
6. Encodes directly with FFmpeg (`libx264`, `crf 19`, `pix_fmt yuv420p`, `+faststart`).
7. Verifies output with `ffprobe` (dimensions, frame rate, duration) and deletes intermediate frames.

---

## 2. API Endpoints

### `POST /render`
Dispatches a new render job.
* **Payload (JSON):**
  ```json
  {
    "html": "<!DOCTYPE html><html>...</html>",
    "duration": 27.0,
    "fps": 30,
    "width": 1920,
    "height": 1080
  }
  ```
* **Response:**
  ```json
  {
    "jobId": "c9a4b3d1-4e78-4a92-bf39-7815cf19d45e",
    "status": "queued",
    "estimatedDuration": 27.0
  }
  ```

### `GET /jobs/:id`
Polls job status and progress.
* **Response:**
  ```json
  {
    "id": "c9a4b3d1-4e78-4a92-bf39-7815cf19d45e",
    "status": "rendering",
    "progress": 65,
    "duration": 27.0,
    "videoUrl": "/jobs/c9a4b3d1-4e78-4a92-bf39-7815cf19d45e/video.mp4"
  }
  ```

### `GET /jobs/:id/video.mp4`
Streams or downloads the finished MP4 video (supports HTTP range requests).

### `GET /jobs/:id/preview?t=12.5`
Extracts and returns a single JPEG frame at timestamp `t` in seconds.

### `GET /jobs/:id/contact.jpg`
Returns a tiled contact sheet montage of sample frames across the animation.

### `POST /lint`
Pre-validates HTML structure, detects transparent text fill, and checks for non-deterministic patterns (`Math.random`, `Date.now`, `setInterval`).

---

## 3. Quickstart & Usage

### Running Locally:
```bash
cd render-service
python3 server.py
# Server starts on http://localhost:5050
```

### Running with Docker:
```bash
docker build -t ollastar-render-backend .
docker run -p 5050:5050 ollastar-render-backend
```

### Example `curl` Command:
```bash
# 1. Start Render
JOB=$(curl -s -X POST http://localhost:5050/render \
  -H "Content-Type: application/json" \
  -d "{\"html\": $(jq -Rs . < shoe-ad.html), \"duration\": 27.0}" | jq -r .jobId)

# 2. Check Status
curl -s http://localhost:5050/jobs/$JOB

# 3. Download MP4 when done
curl -o final_ad.mp4 http://localhost:5050/jobs/$JOB/video.mp4
```

### Python Generator CLI:
```bash
python3 generator_cli.py run china.py
# Generates chinooo-ad.html (60s ad)
```
