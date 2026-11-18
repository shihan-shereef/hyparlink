"""
Ollastar Character & Parallax Animation Generator Core
Builds SVG characters, two-bone IK for limbs, and parallax tiles.
Reads style.css at import time.
"""

import os
import math

CUR_DIR = os.path.dirname(os.path.abspath(__file__))
STYLE_CSS_PATH = os.path.join(CUR_DIR, "style.css")
BASE_CSS = ""
if os.path.exists(STYLE_CSS_PATH):
    with open(STYLE_CSS_PATH, "r", encoding="utf-8") as f:
        BASE_CSS = f.read()

def solve_two_bone_ik(l1: float, l2: float, target_x: float, target_y: float, flip: bool = False):
    """Solves analytical 2-bone IK for legs and arms."""
    dist = math.sqrt(target_x**2 + target_y**2)
    dist = max(0.001, min(dist, (l1 + l2) * 0.999))
    cos_angle2 = (dist**2 - l1**2 - l2**2) / (2 * l1 * l2)
    angle2 = math.acos(max(-1.0, min(1.0, cos_angle2)))
    if flip:
        angle2 = -angle2
        
    angle1 = math.atan2(target_y, target_x) - math.atan2(l2 * math.sin(angle2), l1 + l2 * math.cos(angle2))
    return math.degrees(angle1), math.degrees(angle2)

def generate_speech_bubble(text: str, x: float, y: float, start_t: float, dur_t: float, speaker_name: str = "") -> str:
    escaped_text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    speaker_tag = f'<div class="who">{speaker_name}</div>' if speaker_name else ""
    return f"""
    <div class="bubble vis-window" style="--start:{start_t}s; --dur:{dur_t}s; left:{x}px; top:{y}px;">
      {speaker_tag}
      <div class="msg">{escaped_text}</div>
    </div>
    """

def generate_svg_character(
    char_id: str,
    skin_color: str = "#f1c7a0",
    shirt_color: str = "#ff5533",
    pants_color: str = "#243049",
    shoes_color: str = "#b8ff3d",
    scale: float = 1.0
) -> str:
    """Generates clean SVG character rig with wrapper <g> tags for transform safety."""
    return f"""
    <g id="{char_id}" class="char-wrapper" transform="scale({scale})">
      <!-- Head and torso -->
      <circle cx="50" cy="30" r="18" fill="{skin_color}" />
      <path d="M35 48 Q50 45 65 48 L68 95 L32 95 Z" fill="{shirt_color}" />
      <!-- Left Arm wrapper -->
      <g id="{char_id}-arm-l" class="arm-wrapper">
        <rect x="26" y="50" width="8" height="38" rx="4" fill="{skin_color}" />
      </g>
      <!-- Right Arm wrapper -->
      <g id="{char_id}-arm-r" class="arm-wrapper">
        <rect x="66" y="50" width="8" height="38" rx="4" fill="{skin_color}" />
      </g>
      <!-- Left Leg wrapper -->
      <g id="{char_id}-leg-l" class="leg-wrapper">
        <rect x="36" y="95" width="10" height="45" rx="4" fill="{pants_color}" />
        <ellipse cx="41" cy="142" rx="9" ry="5" fill="{shoes_color}" />
      </g>
      <!-- Right Leg wrapper -->
      <g id="{char_id}-leg-r" class="leg-wrapper">
        <rect x="54" y="95" width="10" height="45" rx="4" fill="{pants_color}" />
        <ellipse cx="59" cy="142" rx="9" ry="5" fill="{shoes_color}" />
      </g>
    </g>
    """
