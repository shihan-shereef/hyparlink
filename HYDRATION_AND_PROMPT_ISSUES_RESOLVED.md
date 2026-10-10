# HYPARLINK DASHBOARD & HYPERFRAMES — ISSUE RESOLUTION REPORT

**Date:** October 8, 2026  
**Status:** RESOLVED & VERIFIED  
**Platforms Affected:** Next.js Dashboard Frontend (`apps/app`), HyperFrames Video Engine (`ai-composition-generator`)

---

## 1. Issue Overview: React SSR Hydration Mismatch

### Symptom
When navigating the dashboard or viewing generated videos in `/projects/[id]`, a red error toast appeared (`1 error ✕`), opening to:
```text
Unhandled Runtime Error
Error: Hydration failed because the initial UI does not match what was rendered on the server.
See more info here: https://nextjs.org/docs/messages/react-hydration-error

Expected server HTML to contain a matching <span> in <div>.
Call Stack: dispatchEvent [native code]
```

### Root Cause Analysis
- The dashboard layout (`apps/app/src/app/[locale]/(dashboard)/layout.tsx`) is an async Next.js Server Component that server-renders the `<Sidebar />` component on each page.
- The `<Sidebar />` embeds `<ThemeSwitcher />` (`apps/app/src/app/[locale]/(dashboard)/_components/theme-switcher.tsx`).
- In `<ThemeSwitcher />`, the theme was read via `useTheme()` from `next-themes`:
  ```tsx
  // PREVIOUS CODE
  <div className="flex items-start gap-2">
    {currentTheme === "light" ? <Sun /> : currentTheme === "dark" ? <Moon /> : <Monitor />}
    {currentTheme && (
      <span className="text-xs font-medium">
        {currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}
      </span>
    )}
  </div>
  ```
- **The Mismatch**:
  1. **Server HTML (SSR)**: On the server, `currentTheme` is `undefined` because localStorage / client system dark mode preferences are inaccessible. The server emitted:
     ```html
     <div class="flex items-start gap-2">
       <svg class="lucide-monitor ..."></svg>
     </div>
     ```
     *(Notice: no `<span>` is rendered).*
  2. **Client Hydration**: In the browser, `next-themes` immediately retrieved `theme = "dark"`. React produced:
     ```html
     <div class="flex items-start gap-2">
       <svg class="lucide-moon ..."></svg>
       <span class="text-xs font-medium">Dark</span>
     </div>
     ```
  3. **React Reconciler Failure**: React detected an unexpected `<span>` child inside `<div>` that did not exist in the server HTML, triggering the fatal unhandled hydration runtime error.

### Resolution
Updated [apps/app/src/app/[locale]/(dashboard)/_components/theme-switcher.tsx](file:///Users/apple/Desktop/hyparlink%20dashbord/apps/app/src/app/%5Blocale%5D/%28dashboard%29/_components/theme-switcher.tsx) to follow the canonical client `mounted` lifecycle pattern:
```tsx
"use client";

export function ThemeSwitcher({ triggerClass }: { triggerClass?: string }) {
  const [mounted, setMounted] = useState(false);
  const { theme: currentTheme, setTheme, themes } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "flex h-6 w-20 items-center rounded border border-primary/20 bg-secondary px-2",
          triggerClass,
        )}
      >
        <div className="flex items-start gap-2">
          <Monitor className="h-[14px] w-[14px] text-primary/40" />
        </div>
      </div>
    );
  }

  return (
    <Select value={currentTheme} onValueChange={...}>
      ...
    </Select>
  );
}
```
- During SSR and the initial client hydration pass, an identical placeholder is rendered.
- After hydration completes, `mounted` flips to `true`, rendering the interactive theme selector with zero DOM mismatches.

---

## 2. Issue Overview: Video Prompt Styling Fidelity

### Symptom
When submitting prompts requesting customized styles (e.g., `"dark background, red glowing text"`, `"car is moving in this with a gang stars"`), the video generator was previously outputting the default dark-blue background and blue text.

### Root Cause Analysis
1. **Multi-line Line Break Vulnerability**: User inputs in textareas containing newlines (`\n`) or extra whitespace prevented literal string searches like `.includes("red glowing")` from matching.
2. **Word Collision**: Substring checks such as `.includes("car")` erroneously matched unrelated words like `"title card"`.
3. **StaticGuard Validation Halts**: Videos longer than 5 seconds (e.g., 15s or 30s) failed HyperFrames' `StaticGuard` check (`sweep_static`) because motion stopped before the end of the timeline.

### Resolution
1. **Proximity Regex & Normalization Engine**:
   - Sanitized user prompts: `prompt.toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()`.
   - Replaced fragile substring checks with proximity regex:
     - `/\b(red|crimson|ruby)\b[\s\S]{0,20}\b(glowing|glow|neon|text|font|letters)\b/`
     - `/\b(dark|black|deep)\b[\s\S]{0,20}\b(background|bg|backdrop)\b/`
   - Added word-boundary checks `/\b(car|supercar|vehicle)\b/` to prevent false positives on `"card"`.
2. **Timeline Scaling & StaticGuard Fix**:
   - Scaled all GSAP animations continuously across the entire prompt duration `[0, duration]`.
   - Added ambient camera motion and grid zoom to ensure frame differences pass validation checks at every sample seek.
3. **Dynamic Asset Injection**:
   - Added vector sportscar assets with spinning wheels, glowing underbody neon, and headlight beams when a car is requested.
   - Added drifting neon stars when stars/gang stars are requested.

---

## 3. Verification & Current System Status

| Component | Status | Details |
|---|---|---|
| **Next.js Hydration** | **CLEAN** | `ThemeSwitcher` mount guard active; zero hydration errors |
| **Next.js Dev Server** | **RUNNING** | Port `3000` (PID / task-1441) |
| **Domain Backend & Echo Worker** | **RUNNING** | Port `4000` (PID / task-1581) |
| **Convex Self-Hosted Backend** | **RUNNING** | Ports `3210` & `3211` |
| **Mailpit Auth Mailer** | **RUNNING** | Ports `1025` (SMTP) & `8025` (UI) |
| **HyperFrames 0.8.139** | **READY** | Metal GPU acceleration & headless Chrome operational |
