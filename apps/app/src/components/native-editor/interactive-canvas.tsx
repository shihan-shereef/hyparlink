"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Move,
  MousePointer,
  Sparkles,
  Film,
  Code
} from "lucide-react";
import { SelectedElement, AssetItem, CompositionScene, TimelineClip, CompositionLayer } from "./types";

interface InteractiveCanvasProps {
  previewSrc: string;
  renderedVideoUrl?: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPauseToggle: () => void;
  selectedElement: SelectedElement | null;
  onSelectElement: (element: SelectedElement | null) => void;
  onUpdateElementStyle: (elementId: string, property: string, value: string) => void;
  onLayersLoaded?: (layers: any[]) => void;
  onDropAsset?: (asset: AssetItem, targetTime: number, trackType: "visual" | "audio" | "scene") => void;
  scenes?: CompositionScene[];
  visualClips?: TimelineClip[];
  projectTitle?: string;
  onOpenPropertiesTab?: (tab: "design" | "layers" | "renders" | "variables") => void;
  playbackSpeed?: number;
  onSpeedChange?: (speed: number) => void;
}

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  previewSrc,
  renderedVideoUrl,
  currentTime,
  duration,
  isPlaying,
  onTimeUpdate,
  onPlayPauseToggle,
  selectedElement,
  onSelectElement,
  onUpdateElementStyle,
  onLayersLoaded,
  onDropAsset,
  scenes = [],
  visualClips = [],
  projectTitle = "Project",
  onOpenPropertiesTab,
  playbackSpeed = 1,
  onSpeedChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoverRect, setHoverRect] = useState<{ top: number; left: number; width: number; height: number; tag: string } | null>(null);
  const [canvasMode, setCanvasMode] = useState<"video" | "interactive">("interactive");


  // Find active scene at current playhead time
  const activeScene = scenes.find(
    (s) => currentTime >= s.start && currentTime < (s.start + s.duration)
  );

  // Professional NLE Non-Linear Video Playback Engine:
  // Synchronize video element with the active scene slice, respecting cuts, trims, clip speeds, and empty gaps
  useEffect(() => {
    if (!videoRef.current || canvasMode !== "video") return;

    if (!activeScene) {
      // Playhead is in a cut gap between scenes: pause video
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
      return;
    }

    // Playhead is inside an active scene: map timeline clock to scene's media slice
    const elapsedInScene = Math.max(0, currentTime - activeScene.start);
    const mediaOffset = (activeScene as any).mediaOffset !== undefined
      ? (activeScene as any).mediaOffset
      : (scenes.indexOf(activeScene) === 0 ? 0 : activeScene.start);
    const clipSpeed = (activeScene as any).speed || 1;

    let targetVideoTime = mediaOffset + elapsedInScene * clipSpeed;
    if (videoRef.current.duration > 0 && targetVideoTime >= videoRef.current.duration) {
      targetVideoTime = targetVideoTime % videoRef.current.duration;
    }

    // Frame-accurate threshold when scrubbing/paused (0.02s < 1 frame at 30fps)
    // During active playback, avoid continuous seek thrashing which stutters video decoding
    if (!isPlaying) {
      if (Math.abs(videoRef.current.currentTime - targetVideoTime) > 0.02) {
        videoRef.current.currentTime = targetVideoTime;
      }
    } else {
      if (Math.abs(videoRef.current.currentTime - targetVideoTime) > 1.2) {
        videoRef.current.currentTime = targetVideoTime;
      }
    }

    const effectivePlaybackRate = Math.max(0.25, Math.min(4, (playbackSpeed || 1) * clipSpeed));
    if (videoRef.current.playbackRate !== effectivePlaybackRate) {
      videoRef.current.playbackRate = effectivePlaybackRate;
    }

    if (isPlaying) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    } else {
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [currentTime, isPlaying, activeScene, canvasMode, scenes, playbackSpeed]);

  const handleVideoEnded = () => {
    if (isPlaying) {
      onPlayPauseToggle();
    }
  };

  // Dynamic responsive canvas dimensions maintaining 16:9 (1920x1080)
  const [dimensions, setDimensions] = useState<{ width: number; height: number; scale: number }>({
    width: 960,
    height: 540,
    scale: 0.5,
  });

  const updateDimensions = useCallback(() => {
    if (!viewportRef.current) return;
    const { clientWidth, clientHeight } = viewportRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    // Leave generous margins around canvas for floating controls and aesthetic padding
    const paddingX = 48;
    const paddingY = 64;
    const availW = Math.max(320, clientWidth - paddingX);
    const availH = Math.max(180, clientHeight - paddingY);

    // Compute fit scale for 1920x1080
    const fitScale = Math.min(availW / 1920, availH / 1080);

    setDimensions({
      width: Math.round(1920 * fitScale),
      height: Math.round(1080 * fitScale),
      scale: fitScale,
    });
  }, []);

  useEffect(() => {
    updateDimensions();
    if (!viewportRef.current) return;
    const observer = new ResizeObserver(() => {
      updateDimensions();
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [updateDimensions]);

  // Send seek commands to the iframe's internal GSAP timelines and media elements
  const syncIframeTime = useCallback((time: number) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    try {
      let targetTime = time;
      let activeSceneData: CompositionScene | null = null;
      if (scenes && scenes.length > 0) {
        const active = scenes.find((s) => time >= s.start && time < (s.start + s.duration));
        if (active) {
          activeSceneData = active;
          const mediaOffset = (active as any).mediaOffset !== undefined
            ? (active as any).mediaOffset
            : active.start;
          const speed = (active as any).speed || 1;
          targetTime = mediaOffset + (time - active.start) * speed;
        } else {
          // Playhead is in a gap between cuts: seek to the end of the previous scene
          const prevScenes = scenes.filter((s) => (s.start + s.duration) <= time).sort((a, b) => b.start - a.start);
          const p = prevScenes[0];
          if (p) {
            const mediaOffset = (p as any).mediaOffset !== undefined ? (p as any).mediaOffset : p.start;
            targetTime = mediaOffset + p.duration;
          }
        }
      }

      iframeRef.current.contentWindow.postMessage(
        {
          type: "HYPERLINK_SEEK",
          time: targetTime,
          globalTime: time,
          isPlaying,
          activeSceneId: activeSceneData?.id,
          activeSceneStart: activeSceneData?.start || 0,
          activeSceneDuration: activeSceneData?.duration || 0,
          speed: (activeSceneData as any)?.speed || 1,
        },
        "*"
      );
    } catch (e) {
      // Cross-origin fallback handled gracefully
    }
  }, [scenes, isPlaying]);

  useEffect(() => {
    syncIframeTime(currentTime);
  }, [currentTime, syncIframeTime]);

  // Synchronize playback state (play / pause) with iframe GSAP timeline and video elements
  useEffect(() => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: isPlaying ? "HYPERLINK_PLAY" : "HYPERLINK_PAUSE",
        },
        "*"
      );
    } catch (_) {}
  }, [isPlaying]);

  // Listen to postMessage from the injected inspector script in iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "HYPERLINK_ELEMENT_CLICKED") {
        const elData: SelectedElement = event.data.payload;
        onSelectElement(elData);
        if (onOpenPropertiesTab) {
          onOpenPropertiesTab("design");
        }
      } else if (event.data.type === "HYPERLINK_ELEMENT_HOVERED") {
        setHoverRect(event.data.payload);
      } else if (event.data.type === "HYPERLINK_ELEMENT_UNHOVERED") {
        setHoverRect(null);
      } else if (event.data.type === "HYPERLINK_LAYERS_LOADED") {
        if (onLayersLoaded) {
          onLayersLoaded(event.data.payload);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSelectElement, onLayersLoaded, onOpenPropertiesTab]);

  // Inject Bridge Script upon iframe load
  const handleIframeLoad = () => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!doc) return;

      // Inject interactive bridge script into composition if not already present
      if (!doc.getElementById("hyperlink-editor-bridge")) {
        const script = doc.createElement("script");
        script.id = "hyperlink-editor-bridge";
        script.textContent = `
          (function() {
            window.addEventListener('message', function(e) {
              if (e.data && e.data.type === 'HYPERLINK_SEEK') {
                var t = e.data.time;
                var gTime = e.data.globalTime !== undefined ? e.data.globalTime : t;
                var isPl = !!e.data.isPlaying;
                var actId = e.data.activeSceneId;

                // 1. Sync scene container visibility
                var sceneEls = document.querySelectorAll('[data-composition-src], [data-scene-id], .scene-container, .scene');
                if (sceneEls.length > 0) {
                  sceneEls.forEach(function(sc, idx) {
                    var sStart = parseFloat(sc.getAttribute('data-start'));
                    var sDur = parseFloat(sc.getAttribute('data-duration'));
                    if (isNaN(sStart)) sStart = idx * 5;
                    if (isNaN(sDur)) sDur = 5;
                    var inRange = gTime >= sStart && gTime < (sStart + sDur);
                    sc.style.display = inRange ? '' : 'none';
                  });
                }

                // 2. Sync embedded video and audio elements
                var mediaEls = document.querySelectorAll('video, audio');
                mediaEls.forEach(function(m) {
                  var mStart = parseFloat(m.getAttribute('data-start')) || 0;
                  var mDur = parseFloat(m.getAttribute('data-duration')) || 999;
                  var inRange = gTime >= mStart && gTime < (mStart + mDur);
                  if (inRange) {
                    var localTarget = gTime - mStart;
                    if (Math.abs(m.currentTime - localTarget) > (isPl ? 0.25 : 0.03)) {
                      m.currentTime = localTarget;
                    }
                    if (isPl && m.paused) {
                      m.play().catch(function(){});
                    } else if (!isPl && !m.paused) {
                      m.pause();
                    }
                  } else {
                    if (!m.paused) m.pause();
                  }
                });

                // 3. Pause active scene GSAP timeline or global timelines
                if (window.__timelines) {
                  if (actId && window.__timelines[actId] && typeof window.__timelines[actId].pause === 'function') {
                    var localT = gTime - (e.data.activeSceneStart || 0);
                    window.__timelines[actId].pause(Math.max(0, localT * (e.data.speed || 1)));
                  }
                  if (window.__timelines['main'] && typeof window.__timelines['main'].pause === 'function') {
                    window.__timelines['main'].pause(t);
                    return;
                  }
                  Object.keys(window.__timelines).forEach(function(k) {
                    try {
                      if (window.__timelines[k] && typeof window.__timelines[k].pause === 'function') {
                        window.__timelines[k].pause(t);
                      }
                    } catch(err) {}
                  });
                }
                ['master', 'timeline', 'mainTimeline', 'tl', 'londonAdTimeline', 'keralaTourismTimeline'].forEach(function(name) {
                  try {
                    if (window[name] && typeof window[name].pause === 'function') {
                      window[name].pause(t);
                    }
                  } catch(err) {}
                });
                try {
                  if (typeof gsap !== 'undefined' && gsap.globalTimeline && typeof gsap.globalTimeline.pause === 'function') {
                    gsap.globalTimeline.pause(t);
                  }
                } catch(err) {}
              } else if (e.data && e.data.type === 'HYPERLINK_UPDATE_STYLE') {
                var findEl = function(id) {
                  if (!id) return null;
                  var el = document.getElementById(id) || 
                           document.querySelector('[data-hf-id="' + id + '"]') ||
                           document.querySelector('[data-hf-layer-id="' + id + '"]') ||
                           document.querySelector('.' + id);
                  if (!el && id.indexOf('layer-') === 0) {
                    var parts = id.split('-');
                    var idx = parseInt(parts[1], 10);
                    var candidates = document.querySelectorAll('h1, h2, h3, p, span, img, video, svg, .badge-pill, .scene-content');
                    if (!isNaN(idx) && candidates[idx]) el = candidates[idx];
                    if (!el && parts.length >= 3 && parts[2]) {
                      el = document.querySelector('.' + parts.slice(2).join('-'));
                    }
                  }
                  return el;
                };
                var el = findEl(e.data.elementId);
                if (el) {
                  el.style[e.data.property] = e.data.value;
                  if (e.data.property === 'fontFamily') {
                    var cleanFont = (e.data.value || '').replace(/['",]|sans-serif|serif|monospace/gi, '').trim();
                    if (cleanFont && !document.querySelector('link[data-font="' + cleanFont + '"]')) {
                      var link = document.createElement('link');
                      link.rel = 'stylesheet';
                      link.setAttribute('data-font', cleanFont);
                      link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(cleanFont).replace(/%20/g, '+') + ':wght@300;400;500;600;700;800;900&display=swap';
                      document.head.appendChild(link);
                    }
                  }
                }
              } else if (e.data && e.data.type === 'HYPERLINK_UPDATE_TEXT') {
                var findEl = function(id) {
                  if (!id) return null;
                  var el = document.getElementById(id) || 
                           document.querySelector('[data-hf-id="' + id + '"]') ||
                           document.querySelector('[data-hf-layer-id="' + id + '"]') ||
                           document.querySelector('.' + id);
                  if (!el && id.indexOf('layer-') === 0) {
                    var parts = id.split('-');
                    var idx = parseInt(parts[1], 10);
                    var candidates = document.querySelectorAll('h1, h2, h3, p, span, img, video, svg, .badge-pill, .scene-content');
                    if (!isNaN(idx) && candidates[idx]) el = candidates[idx];
                    if (!el && parts.length >= 3 && parts[2]) {
                      el = document.querySelector('.' + parts.slice(2).join('-'));
                    }
                  }
                  return el;
                };
                var el = findEl(e.data.elementId);
                if (el) {
                  el.innerText = e.data.text;
                }
              } else if (e.data && e.data.type === 'HYPERLINK_TOGGLE_LAYER') {
                var el = document.getElementById(e.data.elementId) || 
                         document.querySelector('[data-hf-id="' + e.data.elementId + '"]') ||
                         document.querySelector('.' + e.data.elementId);
                if (el) {
                  if (e.data.action === 'visibility') {
                    el.style.display = e.data.value ? '' : 'none';
                  } else if (e.data.action === 'lock') {
                    el.style.pointerEvents = e.data.value ? 'none' : 'auto';
                  }
                }
              } else if (e.data && e.data.type === 'HYPERLINK_UPDATE_VARIABLE') {
                document.documentElement.style.setProperty(e.data.variable, e.data.value);
              } else if (e.data && e.data.type === 'HYPERLINK_SELECT_LAYER') {
                var layerId = e.data.layerId;
                var target = document.querySelector('[data-hf-layer-id="' + layerId + '"]') ||
                             document.getElementById(layerId) ||
                             document.querySelector('[data-hf-id="' + layerId + '"]') ||
                             document.querySelector('.' + layerId);
                if (!target && layerId && layerId.indexOf('layer-') === 0) {
                  var parts = layerId.split('-');
                  var idx = parseInt(parts[1], 10);
                  var candidates = document.querySelectorAll('h1, h2, h3, p, span, img, video, svg, .badge-pill, .scene-content');
                  if (!isNaN(idx) && candidates[idx]) {
                    target = candidates[idx];
                  }
                }
                if (target) {
                  var computed = window.getComputedStyle(target);
                  var rect = target.getBoundingClientRect();
                  var tag = target.tagName.toLowerCase();
                  var elType = "unknown";
                  if (tag === 'h1' || tag === 'h2' || tag === 'h3') elType = 'heading';
                  else if (tag === 'p' || tag === 'span') elType = 'text';
                  else if (tag === 'img') elType = 'image';
                  else if (tag === 'video') elType = 'video';
                  else if (tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect') elType = 'shape';
                  else elType = 'container';

                  window.parent.postMessage({
                    type: 'HYPERLINK_ELEMENT_CLICKED',
                    payload: {
                      id: layerId,
                      tag: tag,
                      type: elType,
                      classes: Array.from(target.classList),
                      text: target.innerText || target.alt || target.title || '',
                      rect: {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                      },
                      styles: {
                        color: computed.color,
                        backgroundColor: computed.backgroundColor,
                        fontSize: computed.fontSize,
                        fontWeight: computed.fontWeight,
                        fontFamily: computed.fontFamily,
                        textAlign: computed.textAlign,
                        lineHeight: computed.lineHeight,
                        letterSpacing: computed.letterSpacing,
                        opacity: computed.opacity,
                        borderRadius: computed.borderRadius,
                        transform: computed.transform
                      },
                      attributes: {}
                    }
                  }, '*');
                }
              }
            });

            // Scan and report composition layers to parent with real bounding boxes
            function scanLayers() {
              var candidates = document.querySelectorAll('h1, h2, h3, p, span, img, video, svg, .badge-pill, .scene-content');
              var layers = [];
              candidates.forEach(function(el, i) {
                var uniqueId = 'layer-' + i + '-' + (el.id || el.className.split(' ')[0] || el.tagName.toLowerCase());
                el.setAttribute('data-hf-layer-id', uniqueId);
                var tag = el.tagName.toLowerCase();
                var type = 'container';
                if (tag === 'h1' || tag === 'h2' || tag === 'h3') type = 'heading';
                else if (tag === 'p' || tag === 'span') type = 'text';
                else if (tag === 'img') type = 'image';
                else if (tag === 'video') type = 'video';
                else if (tag === 'svg') type = 'shape';
                
                var rect = el.getBoundingClientRect();
                var computed = window.getComputedStyle(el);

                layers.push({
                  id: uniqueId,
                  name: el.id ? ('#' + el.id) : (el.className ? ('.' + el.className.split(' ')[0]) : (tag + (el.innerText ? (': ' + el.innerText.trim().slice(0, 18)) : ''))),
                  tag: tag,
                  type: type,
                  visible: el.style.display !== 'none' && computed.display !== 'none' && computed.visibility !== 'hidden',
                  locked: el.style.pointerEvents === 'none',
                  text: el.innerText || el.alt || el.title || '',
                  rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                  },
                  styles: {
                    color: computed.color,
                    backgroundColor: computed.backgroundColor,
                    fontSize: computed.fontSize,
                    fontWeight: computed.fontWeight,
                    fontFamily: computed.fontFamily,
                    textAlign: computed.textAlign,
                    lineHeight: computed.lineHeight,
                    letterSpacing: computed.letterSpacing,
                    opacity: computed.opacity,
                    borderRadius: computed.borderRadius,
                    transform: computed.transform
                  }
                });
              });

              window.parent.postMessage({
                type: 'HYPERLINK_LAYERS_LOADED',
                payload: layers.slice(0, 20)
              }, '*');
            }

            setTimeout(scanLayers, 300);

            // Hover and Click Highlighting
            document.addEventListener('mouseover', function(e) {
              var target = e.target;
              if (!target || target === document.body || target === document.documentElement) return;
              var rect = target.getBoundingClientRect();
              window.parent.postMessage({
                type: 'HYPERLINK_ELEMENT_HOVERED',
                payload: {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                  tag: target.tagName.toLowerCase()
                }
              }, '*');
            }, true);

            document.addEventListener('mouseout', function(e) {
              window.parent.postMessage({ type: 'HYPERLINK_ELEMENT_UNHOVERED' }, '*');
            }, true);

            document.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();

              var raw = e.target;
              var isBodyOrHtml = !raw || raw === document.body || raw === document.documentElement;
              var isOverlay = raw && raw.classList && (
                raw.classList.contains('scene-background') || 
                raw.classList.contains('scene-overlay') || 
                raw.classList.contains('film-grain') || 
                raw.classList.contains('progress-track') || 
                raw.classList.contains('progress-bar')
              );

              var target = null;

              if (!isBodyOrHtml && !isOverlay) {
                // If clicked directly inside or on a heading, select the heading so the whole headline can be edited
                var heading = raw.closest ? raw.closest('h1, h2, h3, h4, h5, h6') : null;
                var paragraph = raw.closest ? raw.closest('p.description, p.eyebrow, p') : null;
                var label = raw.closest ? raw.closest('.chapter-label, .corner-label, .badge-pill, .scene-number') : null;

                target = heading || paragraph || label || raw;
              }

              // If clicked on an overlay or empty background space, find element under click point
              if (!target || target === document.body || target === document.documentElement) {
                var pointElements = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [];
                for (var i = 0; i < pointElements.length; i++) {
                  var el = pointElements[i];
                  if (!el || el === document.body || el === document.documentElement) continue;
                  if (el.classList && (
                    el.classList.contains('scene-background') || 
                    el.classList.contains('scene-overlay') || 
                    el.classList.contains('film-grain') || 
                    el.classList.contains('progress-track') || 
                    el.classList.contains('progress-bar')
                  )) continue;

                  var h = el.closest ? el.closest('h1, h2, h3, h4, h5, h6') : null;
                  var p = el.closest ? el.closest('p.description, p.eyebrow, p') : null;
                  if (h) { target = h; break; }
                  if (p) { target = p; break; }

                  var t = el.tagName.toLowerCase();
                  if (['h1','h2','h3','h4','h5','h6','p','span','a','button','label','em','strong','b','i'].indexOf(t) !== -1) {
                    if (el.innerText && el.innerText.trim().length > 0) {
                      target = el;
                      break;
                    }
                  }
                }
              }

              if (!target || target === document.body || target === document.documentElement) return;

              // Ensure element has a stable data-hf-layer-id for live CSS & text updates
              if (!target.getAttribute('data-hf-layer-id')) {
                var assignedId = target.getAttribute('data-hf-id') || target.id || ('layer-' + target.tagName.toLowerCase() + '-' + Math.random().toString(36).substr(2, 6));
                target.setAttribute('data-hf-layer-id', assignedId);
              }

              var computed = window.getComputedStyle(target);
              var rect = target.getBoundingClientRect();
              var classNameStr = typeof target.className === 'string' ? target.className.trim() : '';
              var firstClass = classNameStr ? classNameStr.split(/\s+/)[0] : '';
              var id = target.getAttribute('data-hf-layer-id') || target.getAttribute('data-hf-id') || target.id || firstClass;

              var elType = "unknown";
              var tag = target.tagName.toLowerCase();
              if (tag === 'h1' || tag === 'h2' || tag === 'h3') elType = 'heading';
              else if (tag === 'p' || tag === 'span') elType = 'text';
              else if (tag === 'img') elType = 'image';
              else if (tag === 'video') elType = 'video';
              else if (tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect') elType = 'shape';
              else elType = 'container';

              window.parent.postMessage({
                type: 'HYPERLINK_ELEMENT_CLICKED',
                payload: {
                  id: id,
                  tag: tag,
                  type: elType,
                  classes: Array.from(target.classList || []),
                  text: (target.innerText || '').replace(/\s+/g, ' ').trim(),
                  rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                  },
                  styles: {
                    color: computed.color,
                    backgroundColor: computed.backgroundColor,
                    fontSize: computed.fontSize,
                    fontWeight: computed.fontWeight,
                    fontFamily: computed.fontFamily,
                    textAlign: computed.textAlign,
                    lineHeight: computed.lineHeight,
                    letterSpacing: computed.letterSpacing,
                    opacity: computed.opacity,
                    borderRadius: computed.borderRadius,
                    transform: computed.transform
                  },
                  attributes: {
                    'data-hf-id': target.getAttribute('data-hf-id') || '',
                    'data-hf-layer-id': target.getAttribute('data-hf-layer-id') || '',
                    'data-composition-id': target.getAttribute('data-composition-id') || ''
                  }
                }
              }, '*');
            }, true);
          })();
        `;
        doc.head.appendChild(script);
      }
    } catch (e) {
      console.warn("Could not inject bridge script directly (cross-origin sandbox)", e);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#f8fafc] relative select-none overflow-hidden"
    >
      {/* Top Canvas Bar Controls */}
      <div className="h-10 bg-white border-b border-gray-200 px-4 flex items-center justify-between text-xs text-gray-700 z-20 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono text-emerald-600 font-semibold tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            1920 &times; 1080 (16:9 HD)
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500 hidden sm:inline">
            Canvas {dimensions.width}&times;{dimensions.height}
          </span>
        </div>

        {/* View Mode Toggle when rendered video is present */}
        {renderedVideoUrl && (
          <div className="flex items-center bg-gray-100 p-0.5 rounded-md border border-gray-200">
            <button
              type="button"
              onClick={() => setCanvasMode("video")}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] rounded transition font-medium ${
                canvasMode === "video"
                  ? "bg-white text-purple-700 shadow-xs font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Watch and scrub rendered production video"
            >
              <Film className="w-3.5 h-3.5 text-purple-600" /> Production Video
            </button>
            <button
              type="button"
              onClick={() => setCanvasMode("interactive")}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] rounded transition font-medium ${
                canvasMode === "interactive"
                  ? "bg-white text-emerald-700 shadow-xs font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Interactive HTML/CSS composition stage"
            >
              <Code className="w-3.5 h-3.5 text-emerald-600" /> HTML Canvas
            </button>
          </div>
        )}

        {/* Zoom & View Actions */}
        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={() => setZoomLevel(prev => Math.max(0.25, Math.round((prev - 0.1) * 10) / 10))}
            className="p-1.5 hover:bg-gray-100 rounded transition text-gray-600 hover:text-gray-900"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-gray-800 font-medium w-12 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button 
            type="button"
            onClick={() => setZoomLevel(prev => Math.min(2.5, Math.round((prev + 0.1) * 10) / 10))}
            className="p-1.5 hover:bg-gray-100 rounded transition text-gray-600 hover:text-gray-900"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button 
            type="button"
            onClick={() => setZoomLevel(1)}
            className={`px-2 py-0.5 text-[10px] rounded transition font-medium ${
              zoomLevel === 1 
                ? "bg-purple-100 text-purple-800 border border-purple-300 font-semibold" 
                : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
            }`}
            title="Fit canvas to workspace"
          >
            Fit
          </button>
          <button 
            type="button"
            onClick={() => setZoomLevel(1 / Math.max(0.01, dimensions.scale))}
            className="px-2 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded text-gray-700 border border-gray-200 hidden md:inline"
            title="View at native 100% 1080p pixel size"
          >
            100%
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport with Interactive Stage */}
      <div 
        ref={viewportRef}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          try {
            const dataStr = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
            if (!dataStr) return;
            const asset: AssetItem = dataStr.startsWith("{") ? JSON.parse(dataStr) : {
              id: `drop-${Date.now()}`,
              name: dataStr.split("/").pop() || "Asset",
              type: dataStr.endsWith(".mp4") ? "video" : dataStr.endsWith(".mp3") ? "audio" : "image",
              url: dataStr
            };
            if (onDropAsset) {
              onDropAsset(asset, currentTime, asset.type === "audio" ? "audio" : "visual");
            }
          } catch (err) {}
        }}
        className="flex-1 min-h-0 min-w-0 flex items-center justify-center p-6 relative overflow-hidden bg-[#f1f5f9] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]"
      >
        {/* Render Frame with Scale */}
        <div 
          style={{ 
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            transform: `scale(${zoomLevel})`, 
            transformOrigin: "center center" 
          }}
          className="relative shadow-xl rounded-md border border-gray-300 bg-black overflow-hidden transition-transform duration-75 shrink-0"
        >
          {/* Drag Over Overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-50 bg-purple-900/40 backdrop-blur-xs border-4 border-dashed border-purple-400 rounded-md flex flex-col items-center justify-center text-white pointer-events-none">
              <Sparkles className="w-12 h-12 text-purple-300 animate-bounce mb-2" />
              <span className="text-base font-bold tracking-tight">Drop Media to Add to Scene Canvas</span>
              <span className="text-xs font-mono text-purple-200 mt-1">Inserts at {currentTime.toFixed(1)}s</span>
            </div>
          )}

          {/* Active Stage: Synced Production Video or Composition Iframe */}
          {renderedVideoUrl && canvasMode === "video" ? (
            <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden">
              {/* Continuously mounted Video Element to preserve media decoder buffer across cuts */}
              <video
                ref={videoRef}
                src={renderedVideoUrl || undefined}
                playsInline
                preload="auto"
                onEnded={handleVideoEnded}
                onClick={onPlayPauseToggle}
                className="w-full h-full object-contain cursor-pointer"
              />

              {/* Professional NLE Cut Gap: if playhead is in an empty gap between scenes, render clean black frame overlay */}
              {!activeScene && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-[#070b14] select-none z-20">
                  <Film className="w-10 h-10 mb-2 opacity-30 text-purple-400" />
                  <span className="font-mono text-xs uppercase tracking-widest text-slate-400">Timeline Cut / Empty Gap</span>
                  <span className="font-mono text-[11px] text-slate-500 mt-1">{currentTime.toFixed(2)}s (No active scene)</span>
                </div>
              )}

              {/* Synchronized status badge */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white/90 px-2.5 py-1 rounded-md text-[11px] font-mono flex items-center gap-2 pointer-events-none border border-white/10 shadow-sm z-30">
                <span className={`w-2 h-2 rounded-full ${activeScene ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <span className={`font-semibold ${activeScene ? "text-emerald-300" : "text-amber-300"}`}>
                  {activeScene ? `${activeScene.name || "Scene"} Active` : "Timeline Cut Gap"}
                </span>
                <span className="text-white/40">&bull;</span>
                <span>{currentTime.toFixed(1)}s / {duration.toFixed(1)}s</span>
              </div>

              {/* Render Dropped Visual Assets on Visual track */}
              {(visualClips || [])
                .filter((c) => (c.sourceUrl || (c as any).assetUrl) && currentTime >= c.start && currentTime < (c.start + c.duration))
                .map((c) => {
                  const isSelected = selectedElement?.id === c.id;
                  const assetSrc = c.sourceUrl || (c as any).assetUrl;
                  return (
                    <div
                      key={c.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectElement({
                          id: c.id,
                          tag: c.type === "video" ? "video" : "img",
                          type: c.type === "video" ? "video" : "image",
                          classes: ["visual-asset-overlay"],
                          text: c.name,
                          rect: { top: 120, left: 180, width: 480, height: 270 },
                          styles: { opacity: "1", borderRadius: "12px" },
                          attributes: { src: assetSrc },
                        });
                        if (onOpenPropertiesTab) onOpenPropertiesTab("design");
                      }}
                      style={{
                        position: "absolute",
                        top: "16%",
                        left: "18%",
                        width: "42%",
                        maxHeight: "55%",
                        zIndex: 25,
                      }}
                      className={`cursor-pointer rounded-xl overflow-hidden border-2 transition ${
                        isSelected
                          ? "border-emerald-500 shadow-2xl ring-4 ring-emerald-500/40"
                          : "border-white/30 hover:border-white shadow-xl"
                      }`}
                    >
                      {c.type === "video" ? (
                        <video
                          src={assetSrc}
                          autoPlay
                          muted
                          loop
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={assetSrc}
                          alt={c.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-white font-mono text-[10px] px-2 py-0.5 rounded shadow">
                        {c.name}
                      </div>
                    </div>
                  );
                })}

              {/* Render Active Text Overlays (Headlines & Subtitles) with interactive click-to-select */}
              {activeScene && (() => {
                const sIdx = scenes.indexOf(activeScene);
                const headId = `layer-text-head-${activeScene.id}`;
                const subId = `layer-text-sub-${activeScene.id}`;
                const isHeadSelected = selectedElement?.id === headId;
                const isSubSelected = selectedElement?.id === subId;

                const headStyle = isHeadSelected ? selectedElement?.styles || {} : {};
                const subStyle = isSubSelected ? selectedElement?.styles || {} : {};

                const headFont = headStyle.fontFamily || (activeScene as any).fontFamily || "'Playfair Display', Georgia, serif";
                const headSize = headStyle.fontSize || "38px";
                const headColor = headStyle.color || "#FFFFFF";
                const headWeight = headStyle.fontWeight || "800";

                const subFont = subStyle.fontFamily || "Inter, sans-serif";
                const subSize = subStyle.fontSize || "14px";
                const subColor = subStyle.color || "rgba(255, 255, 255, 0.85)";

                const headText = (isHeadSelected && selectedElement?.text) ||
                  activeScene.headline ||
                  "";

                const subText = (isSubSelected && selectedElement?.text) ||
                  activeScene.subtitle ||
                  "";

                const badgeText = (activeScene as any).badge || "";

                if (!headText && !subText && !badgeText) {
                  return null;
                }

                return (
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-center px-12 z-20">
                    {/* Badge */}
                    {badgeText ? (
                      <div className="mb-2">
                        <span className="font-mono text-[9px] font-bold tracking-widest text-emerald-400 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded border border-emerald-500/30">
                          {badgeText}
                        </span>
                      </div>
                    ) : null}

                    {/* Headline sentence - click to select & edit font */}
                    {headText ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectElement({
                            id: headId,
                            tag: "h1",
                            type: "heading",
                            classes: ["scene-headline"],
                            text: headText,
                            rect: { top: 180, left: 60, width: 600, height: 60 },
                            styles: {
                              color: headColor,
                              fontFamily: headFont,
                              fontSize: headSize,
                              fontWeight: headWeight,
                            },
                            attributes: {},
                          });
                          if (onOpenPropertiesTab) onOpenPropertiesTab("design");
                        }}
                        className={`pointer-events-auto cursor-pointer p-1 rounded transition max-w-xl ${
                          isHeadSelected
                            ? "ring-2 ring-emerald-500 bg-emerald-500/10"
                            : "hover:bg-white/10"
                        }`}
                        title="Click sentence to select & change font/text"
                      >
                        <h1
                          style={{
                            fontFamily: headFont,
                            fontSize: headSize,
                            color: headColor,
                            fontWeight: headWeight,
                            lineHeight: 1.15,
                            textShadow: "0 2px 14px rgba(0,0,0,0.85)",
                          }}
                          className="tracking-tight select-text"
                        >
                          {headText}
                        </h1>
                      </div>
                    ) : null}

                    {/* Subtitle sentence - click to select & edit font */}
                    {subText ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectElement({
                            id: subId,
                            tag: "p",
                            type: "text",
                            classes: ["scene-subtitle"],
                            text: subText,
                            rect: { top: 250, left: 60, width: 500, height: 40 },
                            styles: {
                              color: subColor,
                              fontFamily: subFont,
                              fontSize: subSize,
                              fontWeight: "400",
                            },
                            attributes: {},
                          });
                          if (onOpenPropertiesTab) onOpenPropertiesTab("design");
                        }}
                        className={`pointer-events-auto cursor-pointer p-1 rounded transition max-w-lg mt-1 ${
                          isSubSelected
                            ? "ring-2 ring-emerald-500 bg-emerald-500/10"
                            : "hover:bg-white/10"
                        }`}
                        title="Click sentence to select & change font/text"
                      >
                        <p
                          style={{
                            fontFamily: subFont,
                            fontSize: subSize,
                            color: subColor,
                            lineHeight: 1.35,
                            textShadow: "0 2px 10px rgba(0,0,0,0.85)",
                          }}
                          className="select-text"
                        >
                          {subText}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div
              style={{
                width: "1920px",
                height: "1080px",
                transform: `scale(${dimensions.scale})`,
                transformOrigin: "top left",
              }}
              className="absolute top-0 left-0 bg-black"
            >
              {/* Professional NLE Cut Gap: if playhead is in an empty gap between scenes, render clean black frame */}
              {!activeScene ? (
                <div className="absolute inset-0 z-30 bg-[#070b14] flex flex-col items-center justify-center text-slate-400 select-none">
                  <Film className="w-16 h-16 mb-3 opacity-30 text-purple-400" />
                  <span className="font-mono text-base uppercase tracking-widest text-slate-300 font-bold">
                    Timeline Cut / Empty Gap
                  </span>
                  <span className="font-mono text-xs text-slate-400 mt-1">
                    {currentTime.toFixed(2)}s &bull; No clip active (Content deleted)
                  </span>
                  <div className="mt-4 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-mono">
                    Close gap on timeline or shift clips left to continue sequence
                  </div>
                </div>
              ) : null}

              <iframe
                ref={iframeRef}
                src={previewSrc}
                title="Native Video Canvas"
                onLoad={handleIframeLoad}
                className="w-full h-full border-0 pointer-events-auto"
                allow="clipboard-read; clipboard-write; fullscreen"
              />
            </div>
          )}

          {/* Interactive Selection Highlight & Handles Overlay */}
          {selectedElement && (
            <div 
              style={{
                top: `${selectedElement.rect.top * dimensions.scale}px`,
                left: `${selectedElement.rect.left * dimensions.scale}px`,
                width: `${selectedElement.rect.width * dimensions.scale}px`,
                height: `${selectedElement.rect.height * dimensions.scale}px`,
              }}
              className="absolute pointer-events-none border-2 border-emerald-500 z-30 transition-all duration-75"
            >
              {/* Corner Handles */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-600 rounded-xs pointer-events-auto cursor-nwse-resize shadow-xs" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-600 rounded-xs pointer-events-auto cursor-nesw-resize shadow-xs" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-600 rounded-xs pointer-events-auto cursor-nesw-resize shadow-xs" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-600 rounded-xs pointer-events-auto cursor-nwse-resize shadow-xs" />

              {/* Tag Badge */}
              <div className="absolute -top-6 left-0 bg-emerald-600 text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                <span>{selectedElement.tag}</span>
                <span className="opacity-75">#{selectedElement.id}</span>
              </div>
            </div>
          )}

          {/* Hover Outline Preview */}
          {hoverRect && !selectedElement && (
            <div 
              style={{
                top: `${hoverRect.top * dimensions.scale}px`,
                left: `${hoverRect.left * dimensions.scale}px`,
                width: `${hoverRect.width * dimensions.scale}px`,
                height: `${hoverRect.height * dimensions.scale}px`,
              }}
              className="absolute pointer-events-none border border-emerald-500/60 bg-emerald-500/5 z-20 transition-all duration-75"
            />
          )}
        </div>
      </div>

      {/* Floating Canvas Quick Controls Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/95 border border-gray-200 px-4 py-2 rounded-full shadow-lg flex items-center gap-4 z-30 backdrop-blur-md">
        <button
          type="button"
          onClick={() => onTimeUpdate(0)}
          className="text-gray-500 hover:text-gray-900 transition p-1"
          title="Restart from Beginning"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onPlayPauseToggle}
          className="w-8 h-8 rounded-full bg-gray-900 hover:bg-black text-white flex items-center justify-center font-bold transition shadow-sm"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <div className="flex items-center gap-1 font-mono text-xs text-gray-800">
          <span className="text-emerald-600 font-bold">{currentTime.toFixed(1)}s</span>
          <span className="text-gray-300">/</span>
          <span className="text-gray-500">{duration.toFixed(1)}s</span>
        </div>

        {/* Playback Speed Pill */}
        {onSpeedChange && (
          <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-full border border-gray-200">
            {[0.5, 1, 1.5, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSpeedChange(spd)}
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold transition ${
                  playbackSpeed === spd
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                title={`Playback Speed ${spd}x`}
              >
                {spd}x
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
