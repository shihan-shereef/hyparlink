"""
HTML/CSS/SVG Animation Linter
Validates code-based ads for deterministic headless rendering according to HyperFrames standards.
"""

import re
from typing import Dict, List, Any

def lint_html(html: str) -> Dict[str, Any]:
    errors: List[str] = []
    warnings: List[str] = []
    
    if not html or not isinstance(html, str):
        return {
            "valid": False,
            "errors": ["HTML content is empty or invalid"],
            "warnings": [],
            "stats": {}
        }
        
    html_lower = html.lower()
    
    # 1. Document Structure Verification
    if "<!doctype html" not in html_lower:
        errors.append("Document missing <!DOCTYPE html> declaration")
    if "<html" not in html_lower or "</html>" not in html_lower:
        errors.append("Document missing <html> or </html> tags")
    if "<head" not in html_lower or "</head>" not in html_lower:
        errors.append("Document missing <head> or </head> tags")
    if "<body" not in html_lower or "</body>" not in html_lower:
        errors.append("Document missing <body> or </body> tags")
        
    # 2. Transparent Text Check
    transparent_text_patterns = [
        r'fill\s*:\s*transparent',
        r'fill\s*:\s*rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)',
        r'color\s*:\s*transparent',
        r'color\s*:\s*rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)',
        r'-webkit-text-fill-color\s*:\s*transparent'
    ]
    for pattern in transparent_text_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            # Check if used for background-clip: text (which is valid gradient text)
            context_start = max(0, match.start() - 100)
            context_end = min(len(html), match.end() + 100)
            context = html[context_start:context_end].lower()
            if "background-clip" not in context and "-webkit-background-clip" not in context:
                warnings.append(f"Transparent text fill detected: '{match.group(0)}'. Ensure text remains visible.")
                
    # 3. Determinism & Non-Deterministic JavaScript Check
    if "math.random(" in html_lower:
        errors.append("Non-deterministic Math.random() call detected. Animations must be deterministic.")
    if "date.now(" in html_lower:
        errors.append("Non-deterministic Date.now() call detected. Use deterministic timeline clock instead.")
    if "new date(" in html_lower:
        warnings.append("new Date() detected. Verify it does not affect animation timing or frame state.")
    if "setinterval(" in html_lower:
        errors.append("setInterval() detected. Real-time intervals break frame-by-frame rendering; use requestAnimationFrame or seekTo.")
        
    # Check for potential infinite loops
    infinite_loop_patterns = [
        r'while\s*\(\s*true\s*\)',
        r'for\s*\(\s*;\s*;\s*\)',
        r'while\s*\(\s*1\s*\)'
    ]
    for pattern in infinite_loop_patterns:
        if re.search(pattern, html, re.IGNORECASE):
            errors.append(f"Potential infinite loop detected: '{pattern}'. Headless browser will stall.")

    # 4. window.seekTo Presence Check
    has_seek_to = bool(re.search(r'window\.seekTo\s*=|function\s+seekTo\b|window\[["\']seekTo["\']\]', html))
    if not has_seek_to:
        warnings.append("window.seekTo(t) not explicitly defined in HTML. The render engine will automatically inject the standard Web Animations API seekTo shim.")
        
    # 5. Extract Duration and Dimensions (heuristic extraction)
    duration_match = re.search(r'--dur\s*:\s*([0-9.]+)s|duration\s*:\s*([0-9.]+)|([0-9.]+)s\s*cinematic|Total length\s*=\s*([0-9.]+)s', html, re.IGNORECASE)
    estimated_duration = None
    if duration_match:
        for g in duration_match.groups():
            if g:
                try:
                    estimated_duration = float(g)
                    break
                except ValueError:
                    pass
                    
    width_match = re.search(r'width\s*=\s*["\']?([0-9]+)["\']?|width:\s*([0-9]+)px', html, re.IGNORECASE)
    height_match = re.search(r'height\s*=\s*["\']?([0-9]+)["\']?|height:\s*([0-9]+)px', html, re.IGNORECASE)
    
    estimated_width = int(width_match.group(1) or width_match.group(2)) if width_match else 1920
    estimated_height = int(height_match.group(1) or height_match.group(2)) if height_match else 1080

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "stats": {
            "hasSeekTo": has_seek_to,
            "estimatedDuration": estimated_duration or 27.0,
            "estimatedWidth": estimated_width,
            "estimatedHeight": estimated_height,
            "htmlSize": len(html)
        }
    }
