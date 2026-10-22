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
  Sparkles
} from "lucide-react";
import { SelectedElement, AssetItem } from "./types";

interface InteractiveCanvasProps {
  previewSrc: string;
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
}

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  previewSrc,
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoverRect, setHoverRect] = useState<{ top: number; left: number; width: number; height: number; tag: string } | null>(null);

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

  // Send seek commands to the iframe's internal GSAP timelines
  const syncIframeTime = useCallback((time: number) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "HYPERLINK_SEEK",
          time: time,
        },
        "*"
      );
    } catch (e) {
      // Cross-origin fallback handled gracefully
    }
  }, []);

  useEffect(() => {
    syncIframeTime(currentTime);
  }, [currentTime, syncIframeTime]);

  // Listen to postMessage from the injected inspector script in iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "HYPERLINK_ELEMENT_CLICKED") {
        const elData: SelectedElement = event.data.payload;
        onSelectElement(elData);
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
  }, [onSelectElement, onLayersLoaded]);

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
                var foundAny = false;
                if (window.__timelines) {
                  Object.keys(window.__timelines).forEach(function(k) {
                    try {
                      if (window.__timelines[k] && typeof window.__timelines[k].pause === 'function') {
                        window.__timelines[k].pause(t);
                        foundAny = true;
                      }
                    } catch(err) {}
                  });
                }
                ['master', 'timeline', 'mainTimeline', 'tl', 'londonAdTimeline', 'keralaTourismTimeline'].forEach(function(name) {
                  try {
                    if (window[name] && typeof window[name].pause === 'function') {
                      window[name].pause(t);
                      foundAny = true;
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

              // Collect all elements under the click point to prioritize text over background
              var pointElements = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [];
              var textTarget = pointElements.find(function(el) {
                if (!el || el === document.body || el === document.documentElement) return false;
                var isBg = el.classList && (el.classList.contains('scene-background') || el.classList.contains('scene-overlay'));
                if (isBg) return false;
                var t = el.tagName.toLowerCase();
                var isTextTag = ['h1','h2','h3','h4','h5','h6','p','span','a','button','label','em','strong','b','i'].indexOf(t) !== -1;
                var hasText = el.innerText && el.innerText.trim().length > 0;
                return isTextTag && hasText;
              });

              var nonBgTarget = !textTarget ? pointElements.find(function(el) {
                if (!el || el === document.body || el === document.documentElement) return false;
                var isBg = el.classList && (el.classList.contains('scene-background') || el.classList.contains('scene-overlay'));
                return !isBg;
              }) : null;

              var target = textTarget || nonBgTarget || e.target;
              if (!target || target === document.body || target === document.documentElement) return;
              
              var computed = window.getComputedStyle(target);
              var rect = target.getBoundingClientRect();
              var classNameStr = typeof target.className === 'string' ? target.className.trim() : '';
              var firstClass = classNameStr ? classNameStr.split(/\s+/)[0] : '';
              var id = target.id || target.getAttribute('data-hf-id') || target.getAttribute('data-hf-layer-id') || firstClass || 'el-' + Math.random().toString(36).substr(2, 6);
              
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
                  text: target.innerText || '',
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

          {/* Scaled 1920x1080 internal canvas wrapper */}
          <div
            style={{
              width: "1920px",
              height: "1080px",
              transform: `scale(${dimensions.scale})`,
              transformOrigin: "top left",
            }}
            className="absolute top-0 left-0"
          >
            {/* Active Composition Iframe */}
            <iframe
              ref={iframeRef}
              src={previewSrc}
              title="Native Video Canvas"
              onLoad={handleIframeLoad}
              className="w-full h-full border-0 pointer-events-auto"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          </div>

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
      </div>
    </div>
  );
};
