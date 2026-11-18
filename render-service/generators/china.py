"""
China Travel 60-second Cinematic Ad Generator
Outputs self-contained chinooo-ad.html
"""

import os
from build import BASE_CSS, generate_speech_bubble, generate_svg_character

def build_china_ad() -> str:
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080">
  <title>Explore China — 60s Cinematic Travel Ad</title>
  <style>
    {BASE_CSS}
    :root {{
      --sky-top: #0f172a;
      --sky-mid: #334155;
      --lantern: #ef4444;
      --gold: #f59e0b;
      --wall: #78716c;
      --roof: #dc2626;
      --text-glow: #fde047;
    }}

    /* Camera Pan & Parallax */
    @keyframes cameraPan {{
      0% {{ transform: translate(0px, 0px) scale(1.05); }}
      25% {{ transform: translate(-300px, -20px) scale(1.08); }}
      50% {{ transform: translate(-600px, 0px) scale(1.12); }}
      75% {{ transform: translate(-900px, -30px) scale(1.08); }}
      100% {{ transform: translate(-1200px, 0px) scale(1.05); }}
    }}

    .camera-track {{
      position: absolute;
      width: 3840px;
      height: 1080px;
      animation: cameraPan 60s linear infinite;
    }}

    /* Title Animations */
    @keyframes titleFade {{
      0%, 5% {{ opacity: 0; transform: translateY(30px); }}
      10%, 90% {{ opacity: 1; transform: translateY(0); }}
      95%, 100% {{ opacity: 0; transform: translateY(-30px); }}
    }}

    .hero-title {{
      position: absolute;
      left: 120px;
      top: 180px;
      font-size: 72px;
      font-weight: 800;
      color: #fff;
      text-shadow: 0 4px 24px rgba(245, 158, 11, 0.6);
      animation: titleFade 15s ease-in-out infinite;
    }}

    .badge-gold {{
      background: var(--gold);
      color: #000;
      padding: 6px 18px;
      border-radius: 999px;
      font-size: 24px;
      font-weight: 700;
      display: inline-block;
      margin-bottom: 12px;
    }}

    /* Character Walking Animation */
    @keyframes charWalk {{
      0%, 100% {{ transform: translateY(0px) rotate(0deg); }}
      50% {{ transform: translateY(-12px) rotate(2deg); }}
    }}

    .traveler {{
      position: absolute;
      bottom: 180px;
      left: 450px;
      animation: charWalk 1.2s ease-in-out infinite;
    }}
  </style>
</head>
<body>
  <div id="stage">
    <!-- 110px Letterbox Top & Bottom (Content kept between y=110 and y=970) -->
    <div class="letterbox-top"></div>
    <div class="letterbox-bot"></div>

    <div class="camera-track">
      <!-- Sky and Mountains Parallax -->
      <svg width="3840" height="1080" style="position: absolute; top:0; left:0;">
        <defs>
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="50%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#334155" />
          </linearGradient>
        </defs>
        <rect width="3840" height="1080" fill="url(#skyGrad)" />
        <!-- Distant Mountains -->
        <path d="M0 650 Q400 400 800 650 T1600 650 T2400 650 T3200 650 T3840 650 L3840 1080 L0 1080 Z" fill="#1e293b" opacity="0.6" />
        <path d="M0 720 Q500 500 1000 720 T2000 720 T3000 720 T3840 720 L3840 1080 L0 1080 Z" fill="#0f172a" />
        <!-- Great Wall Silhouette Battlement -->
        <path d="M0 820 L400 790 L800 830 L1200 780 L1600 810 L2000 770 L2400 800 L2800 760 L3200 790 L3840 760 L3840 1080 L0 1080 Z" fill="#44403c" />
        <!-- Traditional Pagoda Tower -->
        <rect x="700" y="580" width="120" height="180" fill="#7f1d1d" />
        <path d="M660 580 L760 520 L860 580 Z" fill="#b91c1c" />
        <path d="M680 640 L760 600 L840 640 Z" fill="#b91c1c" />
        <rect x="2200" y="560" width="140" height="200" fill="#7f1d1d" />
        <path d="M2160 560 L2270 490 L2380 560 Z" fill="#b91c1c" />
      </svg>

      <!-- Animated Character -->
      <div class="traveler">
        <svg width="150" height="220" viewBox="0 0 100 160">
          {generate_svg_character("traveler-1", skin_color="#fcd34d", shirt_color="#dc2626", pants_color="#1e293b", shoes_color="#fbbf24", scale=1.2)}
        </svg>
      </div>

      <!-- Scene Speech Bubbles -->
      {generate_speech_bubble("Welcome to China! Discover 5,000 years of wonder.", 520, 680, 2.0, 6.0, "Guide")}
      {generate_speech_bubble("From ancient dynasties to futuristic skylines.", 780, 680, 10.0, 7.0, "Guide")}
      {generate_speech_bubble("Taste the authentic regional cuisines of Sichuan and Canton.", 1200, 680, 20.0, 8.0, "Foodie")}
      {generate_speech_bubble("Your journey begins today.", 1600, 680, 32.0, 10.0, "Explorer")}
    </div>

    <!-- Fixed Hero Typography -->
    <div class="hero-title">
      <div class="badge-gold">CHINA 2026</div>
      <div>DISCOVER THE EXTRAORDINARY</div>
    </div>
  </div>

  <script>
    // Deterministic seekTo controller
    window.seekTo = function(t) {{
      document.getAnimations().forEach(a => {{
        try {{ a.pause(); a.currentTime = t * 1000; }} catch (e) {{}}
      }});
    }};
  </script>
</body>
</html>
"""
    return html

if __name__ == "__main__":
    out_file = os.path.join(os.path.dirname(__file__), "..", "samples", "chinooo-ad.html")
    # Also write to root for convenience
    root_out = os.path.join(os.path.dirname(__file__), "..", "..", "chinooo-ad.html")
    content = build_china_ad()
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(content)
    with open(root_out, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated {out_file} and {root_out} successfully! (60s ad)")
