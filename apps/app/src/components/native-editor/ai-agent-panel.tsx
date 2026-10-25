"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Sparkles,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Crosshair,
  Sliders,
  Type,
  Palette,
  Play,
  Zap,
  ChevronDown,
  Layers,
  FileCode,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/useWorkspace";
import type { SelectedElement, CompositionScene } from "./types";

interface AgentEditHistoryItem {
  id: string;
  timestamp: string;
  instruction: string;
  targetId: string | null;
  summary: string;
  diffSummary: string;
  previousCode: string;
  appliedCode: string;
  file: string;
}

interface AIAgentPanelProps {
  selectedElement: SelectedElement | null;
  onClearSelectedElement?: () => void;
  selectedFile: string;
  files: Record<string, string>;
  onCodeChange: (newCode: string) => void;
  onSaveCode?: () => void;
  scenes?: CompositionScene[];
  activeSceneId?: string;
  projectId?: string;
}

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({
  selectedElement,
  onClearSelectedElement,
  selectedFile,
  files,
  onCodeChange,
  onSaveCode,
  scenes = [],
  activeSceneId,
  projectId,
}) => {
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editHistory, setEditHistory] = useState<AgentEditHistoryItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "checking" | "error">("checking");
  const [modelName, setModelName] = useState("gemini-3-flash");
  const [showSettings, setShowSettings] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [customModel, setCustomModel] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check Ollama AI connection on mount
  useEffect(() => {
    let isMounted = true;
    async function checkHealth() {
      try {
        const res = await fetch("/api/ai/status");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.status === "connected" || data.success) {
              setConnectionStatus("connected");
              if (data.model) setModelName(data.model);
            } else {
              setConnectionStatus("error");
            }
          }
        } else {
          if (isMounted) setConnectionStatus("connected"); // fallback connected on dev
        }
      } catch (err) {
        if (isMounted) setConnectionStatus("connected");
      }
    }
    checkHealth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Quick preset suggestions based on whether an element is selected
  const quickElementSuggestions = selectedElement
    ? [
        `Change text to "${selectedElement.text ? selectedElement.text + " 🔥" : "Ollastar Racing"}"`,
        `Make color glowing neon crimson (#ff1a40) with subtle drop-shadow`,
        `Change font to ultra-bold uppercase and add 2px letter-spacing`,
        `Add smooth GSAP entrance: fade in with subtle 1.1x scale-down`,
        `Make background dark glassmorphic: rgba(10,15,30,0.85) with border`,
      ]
    : [
        "Darken background with a sleek midnight & crimson gradient",
        "Make all headings ultra-bold modern typography with golden accents",
        "Add smooth cinematic camera entrance animation",
        "Add glowing CTA banner badge in the lower section",
        "Add dynamic particle or badge accents",
      ];

  const handleApplyPreset = (text: string) => {
    setInstruction(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const { current: workspaceId } = useWorkspace();

  const handleExecuteEdit = async () => {
    if (!instruction.trim()) {
      toast.error("Please enter instructions for the agent.");
      return;
    }

    const targetScene = scenes?.find((s) => s.id === activeSceneId);
    const fileToEdit = (selectedFile && selectedFile !== "index.html")
      ? selectedFile
      : (targetScene?.file || selectedFile || "index.html");

    const currentFileCode = files[fileToEdit] || files[selectedFile] || files["index.html"] || "";
    if (!currentFileCode) {
      toast.error(`Cannot find source code for ${fileToEdit}`);
      return;
    }

    setIsLoading(true);
    const targetId = selectedElement?.id || null;

    try {
      const response = await fetch("/api/agent/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
        },
        body: JSON.stringify({
          projectId,
          workspaceId: workspaceId || undefined,
          instruction: instruction.trim(),
          selectedElement: selectedElement
            ? {
                id: selectedElement.id,
                tag: selectedElement.tag,
                type: selectedElement.type,
                text: selectedElement.text,
                styles: selectedElement.styles,
                attributes: selectedElement.attributes,
              }
            : null,
          currentCode: currentFileCode,
          selectedFile: fileToEdit,
          model: customModel || modelName || "gemini-3-flash",
          endpoint: customEndpoint || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Ollama agent failed to process the request.");
      }

      if (projectId && data.savedToFile === false) {
        throw new Error(data.error || `Edit generated, but failed to write to ${fileToEdit}`);
      }

      const updatedCode = data.updatedCode;
      if (!updatedCode) {
        throw new Error("No updated code returned by the agent.");
      }

      // Record edit into history for 1-click Undo
      const historyItem: AgentEditHistoryItem = {
        id: `edit-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        instruction: instruction.trim(),
        targetId,
        summary: data.summary || "Agent updated composition code",
        diffSummary: data.diffSummary || "Modified styles & markup",
        previousCode: currentFileCode,
        appliedCode: updatedCode,
        file: fileToEdit,
      };

      setEditHistory((prev) => [historyItem, ...prev]);

      // Apply updated code directly to project state and save
      onCodeChange(updatedCode);
      if (onSaveCode) {
        onSaveCode();
      }

      toast.success(data.summary || "Agent edit applied and saved successfully!");
      setInstruction("");
    } catch (err: any) {
      console.error("[AIAgentPanel] Edit failed:", err);
      toast.error(err.message || "Failed to execute agent edit.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = (item: AgentEditHistoryItem) => {
    onCodeChange(item.previousCode);
    if (onSaveCode) {
      setTimeout(() => onSaveCode(), 400);
    }
    setEditHistory((prev) => prev.filter((h) => h.id !== item.id));
    toast.info(`Reverted changes from: "${item.summary}"`);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden text-gray-800">
      {/* Header with Connection Pill & Model Settings */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50/60 via-indigo-50/40 to-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-gray-900">Ollama AI Agent</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
              <span>Model:</span>
              <span className="text-purple-700 font-medium">{customModel || modelName}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          title="Agent Model Settings"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Settings Modal / Drawer */}
      {showSettings && (
        <div className="p-3 bg-purple-50/80 border-b border-purple-200 text-xs flex flex-col gap-2 shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center justify-between font-semibold text-purple-900">
            <span>Ollama Agent Configuration</span>
            <button onClick={() => setShowSettings(false)} className="text-purple-400 hover:text-purple-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Model Identifier</label>
            <input
              type="text"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g. gemini-3-flash, qwen2.5-coder, llama3.2"
              className="w-full px-2 py-1 bg-white border border-purple-200 rounded text-xs font-mono focus:outline-purple-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Ollama API Base URL (optional)</label>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="Default: https://api.ollima.com/v1 or http://localhost:11434"
              className="w-full px-2 py-1 bg-white border border-purple-200 rounded text-xs font-mono focus:outline-purple-500"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setShowSettings(false);
                toast.success("Ollama configuration updated!");
              }}
              className="px-2.5 py-1 bg-purple-600 text-white rounded text-[11px] font-medium hover:bg-purple-700 transition"
            >
              Apply Settings
            </button>
          </div>
        </div>
      )}

      {/* Main Agent Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        {/* TARGET ELEMENT BINDING AREA */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5 transition">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
              <Crosshair className="w-3.5 h-3.5 text-indigo-600" />
              <span>Target Context</span>
            </div>
            {selectedElement && onClearSelectedElement && (
              <button
                type="button"
                onClick={onClearSelectedElement}
                className="text-[10px] text-gray-400 hover:text-gray-700 font-medium flex items-center gap-0.5 hover:underline"
                title="Target whole scene instead"
              >
                Clear Target
              </button>
            )}
          </div>

          {selectedElement ? (
            <div className="bg-white rounded-lg p-2 border border-indigo-200 shadow-2xs flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-600">
                  &lt;{selectedElement.tag} id="#{selectedElement.id}"&gt;
                </span>
                <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-[10px] font-semibold text-indigo-700 border border-indigo-200 uppercase">
                  {selectedElement.type || "Layer"}
                </span>
              </div>

              {selectedElement.text && (
                <div className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate italic">
                  "{selectedElement.text}"
                </div>
              )}

              {/* Element metadata pills */}
              <div className="flex flex-wrap gap-1 mt-0.5 pt-1 border-t border-gray-100">
                {selectedElement.styles?.color && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded">
                    <span
                      className="w-2 h-2 rounded-full border border-gray-300"
                      style={{ backgroundColor: selectedElement.styles.color }}
                    />
                    {selectedElement.styles.color}
                  </span>
                )}
                {selectedElement.styles?.fontSize && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded">
                    {selectedElement.styles.fontSize}
                  </span>
                )}
                {selectedElement.styles?.fontFamily && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded truncate max-w-[120px]">
                    {selectedElement.styles.fontFamily.split(",")[0]}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white/80 rounded-lg p-2 border border-dashed border-indigo-200 text-xs text-gray-500 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-gray-400" />
                <span>
                  Entire Composition (<span className="font-mono text-indigo-600">{selectedFile || "index.html"}</span>)
                </span>
              </div>
              <span className="text-[10px] text-gray-400 italic">Click element in canvas to target</span>
            </div>
          )}
        </div>

        {/* QUICK PROMPT PRESETS */}
        <div>
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Quick Suggestions</span>
            <span className="text-[10px] text-purple-600 font-normal">Click to apply</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {quickElementSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(suggestion)}
                className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-purple-50/80 border border-gray-200 hover:border-purple-200 text-gray-700 hover:text-purple-800 transition flex items-center justify-between group"
              >
                <span className="truncate pr-1">{suggestion}</span>
                <Sparkles className="w-3 h-3 text-gray-300 group-hover:text-purple-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* EDIT HISTORY & REVERT */}
        {editHistory.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Agent Edit History ({editHistory.length})</span>
            </div>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
              {editHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>{item.timestamp}</span>
                    {item.targetId && (
                      <span className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded">
                        #{item.targetId}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-gray-800 text-[11px] leading-tight">
                    {item.summary}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 mt-0.5">
                    <span className="text-[10px] text-gray-500 truncate max-w-[180px]">
                      {item.diffSummary}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUndo(item)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 transition"
                      title="Revert this edit"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Revert
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PROMPT INPUT & SUBMIT AREA */}
      <div className="p-3 border-t border-gray-200 bg-gray-50/70 shrink-0 flex flex-col gap-2">
        {selectedElement && (
          <div className="flex items-center justify-between text-[11px] text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-md border border-indigo-200">
            <span className="truncate flex items-center gap-1">
              <Zap className="w-3 h-3 text-indigo-500" /> Attached:{" "}
              <strong className="font-mono">#{selectedElement.id}</strong>
            </span>
            <button
              type="button"
              onClick={onClearSelectedElement}
              className="text-gray-400 hover:text-gray-600 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleExecuteEdit();
              }
            }}
            placeholder={
              selectedElement
                ? `Tell the agent how to edit #${selectedElement.id}...`
                : "Tell the agent what to modify in this video..."
            }
            disabled={isLoading}
            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none shadow-xs disabled:opacity-60"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            Press <kbd className="font-mono bg-white px-1 py-0.5 rounded border text-gray-600">⌘+Enter</kbd> to run
          </span>

          <button
            type="button"
            onClick={handleExecuteEdit}
            disabled={isLoading || !instruction.trim()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-purple-900/10 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Ollama Editing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply with Agent</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
