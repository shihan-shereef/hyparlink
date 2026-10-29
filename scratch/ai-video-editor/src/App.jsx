import { applyProcessedSourceMedia, getSourceProcessingLane } from "./lib/sourceAudioProcessing.js";
import { getAudioProcessingCopy } from "./i18nAudioProcessing.js";
import { isTimedSegmentLaneLocked } from "./lib/timeline.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";

import { LanguageIntro } from "./components/panels.jsx";
import { PreviewStage } from "./components/PreviewStage.jsx";
import { VoicePanel } from "./components/VoicePanel.jsx";
import { Timeline } from "./components/Timeline.jsx";
import { Topbar } from "./components/Topbar.jsx";
import { HostServicePanel } from "./components/HostServicePanel.jsx";
import { AssetDragPreview, ExportProgressOverlay } from "./components/EditorOverlays.jsx";
import { EditorSidebar } from "./components/EditorSidebar.jsx";
import { FirstVisualGuide } from "./components/FirstVisualGuide.jsx";
import { MiganRepairDialog } from "./components/MiganRepairDialog.jsx";
import { DetailRestorationDialog } from "./components/DetailRestorationDialog.jsx";
import { SmartDenoiseDialog } from "./components/SmartDenoiseDialog.jsx";
import { WebMcpReview, WebMcpAiStatus } from "./components/WebMcpReview.jsx";
import ProjectImportOverlay from "./components/ProjectImportOverlay.jsx";
import {
  canShowFirstVisualGuide,
  FIRST_VISUAL_GUIDE_MOBILE_QUERY,
  hasSeenFirstVisualGuide,
  markFirstVisualGuideSeen,
} from "./lib/firstVisualGuide.js";
import { useExportElapsed } from "./hooks/useExportElapsed.js";
import { usePreviewFrameSize } from "./hooks/usePreviewFrameSize.js";
import { useEditorCatalog } from "./hooks/useEditorCatalog.js";
import { useToast } from "./hooks/useToast.js";
import { useProjectFiles } from "./hooks/useProjectFiles.js";
import { useCompleteProject } from "./hooks/useCompleteProject.js";
import { useAutosaveTimestamp } from "./hooks/useAutosaveTimestamp.js";
import { useVisionAnalysis } from "./hooks/useVisionAnalysis.js";
import { useSmartFrame } from "./hooks/useSmartFrame.js";
import { useFileUpload } from "./hooks/useFileUpload.js";
import { useMediaSync } from "./hooks/useMediaSync.js";
import { useVideoExport } from "./hooks/useVideoExport.js";
import { useVoiceRecorder } from "./hooks/useVoiceRecorder.js";
import { useVoiceGeneration } from "./hooks/useVoiceGeneration.js";
import { useVoiceProfiles } from "./hooks/useVoiceProfiles.js";
import { useAutoCaptions } from "./hooks/useAutoCaptions.js";
import { useAutoEdit } from "./hooks/useAutoEdit.js";
import { useSilenceRemoval } from "./hooks/useSilenceRemoval.js";
import { useWebMcpEditor } from "./hooks/useWebMcpEditor.js";
import { sampleEditorMedia } from "./lib/webMcpMediaSample.js";
import { browserProjectFingerprint, restoreBrowserProjectMedia } from "./lib/browserEditPlan.js";
import { useSourceAudioExtraction } from "./hooks/useSourceAudioExtraction.js";
import { useVocalSeparation } from "./hooks/useVocalSeparation.js";
import { useAvatarGeneration } from "./hooks/useAvatarGeneration.js";
import { useFaceSwapGeneration } from "./hooks/useFaceSwapGeneration.js";
import { useDepthOfFieldAnalysis } from "./hooks/useDepthOfFieldAnalysis.js";
import { useCaptionState } from "./hooks/useCaptionState.js";
import { useAudioTrackState } from "./hooks/useAudioTrackState.js";
import { useVisualTrackState } from "./hooks/useVisualTrackState.js";
import { useEditorUiState } from "./hooks/useEditorUiState.js";
import { useTimelineModel } from "./hooks/useTimelineModel.js";
import { usePreviewModel } from "./hooks/usePreviewModel.js";
import { useEditorRefs } from "./hooks/useEditorRefs.js";
import { useEditorLifecycle } from "./hooks/useEditorLifecycle.js";
import { useEditorHistory } from "./hooks/useEditorHistory.js";
import { createVisionControls } from "./lib/visionControls.js";
import { createAssetDragControls, resolveVisualDropIntent } from "./lib/assetDragControls.js";
import { createAssetLibraryActions } from "./lib/assetLibraryActions.js";
import { createPlaybackControls } from "./lib/playbackControls.js";
import { createTimelineReorderControls } from "./lib/timelineReorderControls.js";
import { createTimelineMoveControls } from "./lib/timelineMoveControls.js";
import { createImageResizeControl } from "./lib/imageResizeControl.js";
import { createTimelineClipboardActions } from "./lib/timelineClipboardActions.js";
import { appendImportedCaptions } from "./lib/subtitles.js";
import { createTimelineCutActions } from "./lib/timelineCutActions.js";
import { createTimelineSegmentCountActions } from "./lib/timelineSegmentCountActions.js";
import { createTimelineDurationActions } from "./lib/timelineDurationActions.js";
import { createAudioClipActions, updateAudioSegmentPlaybackRate } from "./lib/audioClipActions.js";
import { createCaptionEditingActions } from "./lib/captionEditingActions.js";
import { createAudioTrackActions } from "./lib/audioTrackActions.js";
import { createVisualTimelineActions } from "./lib/visualTimelineActions.js";
import { createStickerTimelineActions } from "./lib/stickerTimelineActions.js";
import { createAssetDropActions } from "./lib/assetDropActions.js";
import { createEditorCommandActions } from "./lib/editorCommandActions.js";
import { useTimelineViewModel } from "./lib/timelineViewModel.js";
import { createTranslator, getStoredLanguage, translateOptionName } from "./i18n.js";
import { decodeWaveform, downloadBlob } from "./lib/media.js";
import { useAiMusicGeneration } from "./hooks/useAiMusicGeneration.js";
import { useMiganRepair } from "./hooks/useMiganRepair.js";
import { useDetailRestoration } from "./hooks/useDetailRestoration.js";
import { useSmartDenoise } from "./hooks/useSmartDenoise.js";
import { useGenerationPlugins } from "./hooks/useGenerationPlugins.js";
import { createCaptionSegments, createVisualSegment, getVisualAssetPayload, getVisualSegmentTimeline, getImageThumbnailCount, getVisualSegmentsTotal, normalizeTimedSegmentIds } from "./lib/timeline.js";
import { getVisualSourceTime, normalizeVisualTransform, removeVisualPropertyKeyframe, updateVisualSegmentPlaybackRate, upsertVisualKeyframe, upsertVisualPropertyKeyframe } from "./lib/visualEffects.js";
import { getVisualSpeedCurveTimelineProgress, updateVisualSegmentSpeedCurve } from "./lib/visualSpeedCurve.js";
import { getLinkedSourceAudioEnd, getLinkedSourceAudioSegments, shouldMuteEmbeddedVideoAudio, sliceSourceAudioPeaks } from "./lib/sourceAudioSync.js";
import { getTimelineInitialContentZoom } from "./lib/timelineScale.js";
import { getVisionKey } from "./lib/vision.js";
import { DEFAULT_SUBJECT_EFFECT, normalizeSubjectEffect } from "./lib/subjectEffects.js";
import { normalizeClickRippleEffect } from "./lib/clickRippleEffect.js";
import { normalizeCinematicDepth, resolveDepthAnalysisAtTime } from "./lib/depthOfField.js";
import { normalizePhotoParallax } from "./lib/photoParallax.js";
import {
  getExportContentDuration,
  getExportDimensions,
  getEffectiveExportBitrate,
  loadExportSettings,
  saveExportSettings,
} from "./lib/exportSettings.js";
import { createVisualOverlaySegment, getVisualOverlayPreset, updateVisualOverlayTransform } from "./lib/visualOverlayTimeline.js";
import { getMobileClipPanelOrigin } from "./lib/mobileClipActions.js";
import { getVisualPropertyTabIds } from "./lib/visualPropertyTabs.js";
import { applyTimelineRipple } from "./lib/timelineRipple.js";
import { COMPACT_WORKSPACE_QUERY } from "./config/editor.js";

export function App({ hostSession = null }) {
  const [uiLanguage, setUiLanguage] = useState(() => getStoredLanguage() || "en");
  const [mobilePanel, setMobilePanel] = useState("");
  const [mobilePanelClosing, setMobilePanelClosing] = useState(false);
  const mobilePanelTimerRef = useRef(null);
  const [mobilePanelOrigin, setMobilePanelOrigin] = useState("");
  const [mobileInspectorSection, setMobileInspectorSection] = useState("");
  const [effectsPanelMode, setEffectsPanelMode] = useState("outline");
  const [isCompactViewport, setIsCompactViewport] = useState(() => (
    typeof window !== "undefined" && window.matchMedia?.(COMPACT_WORKSPACE_QUERY).matches
  ));
  useEffect(() => {
    const query = window.matchMedia?.(COMPACT_WORKSPACE_QUERY);
    if (!query) return undefined;
    const update = () => setIsCompactViewport(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportSettings, setExportSettings] = useState(() => loadExportSettings());
  useEffect(() => {
    saveExportSettings(exportSettings);
  }, [exportSettings]);
  const [captionVoiceFocusRequest, setCaptionVoiceFocusRequest] = useState(0);
  const [selectedSourceAudioSegmentId, setSelectedSourceAudioSegmentId] = useState("");
  const [selectedMusicSegmentId, setSelectedMusicSegmentId] = useState("");
  const [stickerTimelineDrag, setStickerTimelineDrag] = useState(null);
  const [canvasVisualTarget, setCanvasVisualTarget] = useState("");
  const [showFirstVisualGuide, setShowFirstVisualGuide] = useState(false);
  const firstVisualGuideShownRef = useRef(false);
  const timelineImportRestoreRef = useRef(false);
  const changeMobilePanel = (nextPanel) => {
    if (mobilePanelTimerRef.current) window.clearTimeout(mobilePanelTimerRef.current);
    if (!nextPanel && mobilePanel) {
      setMobilePanelClosing(true);
      mobilePanelTimerRef.current = window.setTimeout(() => {
        setMobilePanel("");
        setMobilePanelClosing(false);
        setMobilePanelOrigin("");
        setMobileInspectorSection("");
        mobilePanelTimerRef.current = null;
      }, 170);
      return;
    }
    setMobilePanelClosing(false);
    setMobilePanel(nextPanel);
  };
  const [introClosing, setIntroClosing] = useState(false);

  // Interactive Project Elements State (Headings, Text, Images, Buttons, Backgrounds)
  const [projectElements, setProjectElements] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [hoveredElementId, setHoveredElementId] = useState(null);
  const [projectScenes, setProjectScenes] = useState([]);
  const [compositionUrl, setCompositionUrl] = useState(null);
  const compositionIframeRef = useRef(null);
  const loadedProjectDataRef = useRef(null);
  const loadedProjectIdRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const {
    captionPlacement, captionPosition, captionSegments, captionSize, captionStyle,
    captionStylePresetId, captionStylePresets,
    captionsEnabled, script, selectedSegmentId, setCaptionPlacement,
    setCaptionPosition, setCaptionSegments, setCaptionSize, setCaptionStyle,
    setCaptionStylePresetId, setCaptionStylePresets,
    setCaptionsEnabled, setScript, setSelectedSegmentId,
  } = useCaptionState();
  const {
    audioSegments, audioSegmentsRef, favoriteVoiceIds, generatedVoiceEndRef, historyItems, musicBlob, musicDuration, musicName, musicSegments, musicStart,
    musicPeaks, musicUrl, musicVolume, recordedVoices, recordingElapsed, recordingState,
    selectedAudioSegmentId, selectedVoiceId, setAudioSegments, setFavoriteVoiceIds,
    setHistoryItems, setMusicBlob, setMusicDuration, setMusicName, setMusicPeaks, setMusicStart,
    setMusicSegments, setMusicUrl, setMusicVolume, setRecordedVoices, setRecordingElapsed,
    setRecordingState, setSelectedAudioSegmentId, setSelectedVoiceId, setSourceAudioBlob,
    setSourceAudioAssetId, setSourceAudioDuration, setSourceAudioLinked, setSourceAudioName, setSourceAudioPeaks, setSourceAudioStart,
    setSourceAudioUrl, setSourceAudioVolume, setSourceAudioSpatialEffect, setSourceAudioSpatialAmount, setSpeed, setTimelineHorizon, setVolume,
    sourceAudioAssetId, sourceAudioBlob, sourceAudioDuration, sourceAudioLinked, sourceAudioName, sourceAudioPeaks,
    sourceAudioStart, sourceAudioUrl, sourceAudioVolume, sourceAudioSpatialEffect, sourceAudioSpatialAmount, speed, timelineHorizon, volume,
  } = useAudioTrackState();
  const {
    fitMode, imageClipCount, imageDuration, imageMeta, imageName, imageSrc,
    selectedFilterId, selectedStickerId, selectedStickerSegmentId, selectedTransitionId,
    selectedVisualSegmentId, setFitMode, setImageClipCount, setImageDuration, setImageMeta,
    setImageName, setImageSrc, setSelectedFilterId, setSelectedStickerId,
    setSelectedStickerSegmentId, setSelectedTransitionId, setSelectedVisualSegmentId,
    setStickerSegments, setVisualSegments, setVisualType, stickerSegments, visualSegments,
    visualType, visualOverlaySegments, selectedVisualOverlayId,
    setVisualOverlaySegments, setSelectedVisualOverlayId,
  } = useVisualTrackState();
  const {
    activeTool, assetDragPreview, assetDropPosition, assetDropPulseTrack,
    assetDropTargetTrack, compactRail, currentTime, draggedAssetId, exporting, exportPhase,
    exportProgress, isDragging, isPlaying, mediaTab, progress, ratioId,
    selectedLibraryAssetId, selectedTrack, setActiveTool, setAssetDragPreview,
    setAssetDropPosition, setAssetDropPulseTrack, setAssetDropTargetTrack, setCompactRail,
    setCurrentTime, setDraggedAssetId, setExporting, setExportPhase, setExportProgress,
    setIsDragging, setIsPlaying, setMediaTab, setProgress, setRatioId,
    setSelectedLibraryAssetId, setSelectedTrack, setShowFileMenu, setShowRatioMenu,
    setShowSettings, setShowVoiceFilter, setSnapGuide, setStatus, setStatusText,
    rippleEditing, setRippleEditing, setTimelineClipDrag, setTimelineZoom, setTrackLocks, setTrackVisibility, setVoiceFilter,
    setVoiceTab, showFileMenu, showRatioMenu, showSettings, showVoiceFilter, snapGuide,
    status, statusText, timelineClipDrag, timelineZoom, trackLocks, trackVisibility,
    voiceFilter, voiceTab,
  } = useEditorUiState();
  const [exportError, setExportError] = useState(null);
  const [userAssets, setUserAssets] = useState([]);
  const [timelineMarkers, setTimelineMarkers] = useState([]);
  const timelineMarkerEnd = useMemo(() => timelineMarkers.reduce(
    (end, marker) => Math.max(end, marker.type === "range" ? marker.endTime : marker.time), 0,
  ), [timelineMarkers]);
  const { notify, toast } = useToast(2600, uiLanguage || "zh");
  const [previewVideoMediaTime, setPreviewVideoMediaTime] = useState(0);
  const [sourceAudioDragTargetLane, setSourceAudioDragTargetLane] = useState(null);
  const sourceVoiceColorOriginalRef = useRef(null);
  const [visionRecords, setVisionRecords] = useState({});
  const [depthRecords, setDepthRecords] = useState({});
  const [visionJob, setVisionJob] = useState({
    running: false,
    key: "",
    progress: 0,
    phase: "",
  });
  const [avatarPanelOpen, setAvatarPanelOpen] = useState(false);
  const [smartMode, setSmartMode] = useState("auto-edit");
  const [avatarJob, setAvatarJob] = useState({ running: false, progress: 0, phase: "" });
  const lastSaved = useAutosaveTimestamp([
    script, imageSrc, visualType, imageDuration, captionPlacement, selectedVoiceId, speed,
    volume, musicName, musicDuration, musicStart, musicVolume, sourceAudioName, sourceAudioDuration,
    sourceAudioStart, sourceAudioVolume, sourceAudioSpatialEffect, sourceAudioSpatialAmount, ratioId, fitMode, selectedFilterId, selectedStickerId,
    captionSegments, visualSegments, visualOverlaySegments, visionRecords, timelineZoom, timelineMarkers,
  ]);

  const {
    assetDropPulseTimerRef, audioRef, audioSegmentRefs, audioUrlRef, autoRatioSourceKeyRef,
    avatarMotionCacheRef, avatarMotionWorkerRef, avatarRenderWorkerRef,
    currentTimeRef, draggedAssetIdRef,
    exportAbortControllerRef, exportStartRef, fileInputRef, imageUrlRefs, musicRef, musicUrlRef, pointerAssetDragRef,
    previewCanvasRef, previewShellRef, previewVideoRef, projectFileInputRef, sourceAudioRef,
    sourceAudioUrlRef, suppressAssetClickRef, suppressTimelineClipClickRef,
    timelineClipDragRef, timelineDurationRef, trackScrollRef, visionAbortControllerRef,
    visionJobGenerationRef, visionObjectUrlsRef, visualPlaybackFrameRef,
    visualPlaybackLastUpdateRef, visualPlaybackStartedAtRef, visualPlaybackStartTimeRef,
    voiceRecorderChunksRef, voiceRecorderRef, voiceRecorderStartedAtRef,
    voiceRecorderStreamRef, voiceRecorderTimerRef,
  } = useEditorRefs();
  const activeLanguage = uiLanguage || "zh";
  const aiMusic = useAiMusicGeneration({
    activeLanguage,
    imageUrlRefs,
    setActiveTool,
    setMediaTab,
    setSelectedLibraryAssetId,
    setUserAssets,
  });
  const { redo, undo, checkpoint: checkpointHistory, signature: historySignature, reset: resetHistory } = useEditorHistory({
    autoRatioSourceKeyRef,
    timelineMarkers, setTimelineMarkers, ratioId, setRatioId,
    captionStylePresetId, captionStylePresets, setCaptionStylePresetId, setCaptionStylePresets,
    audioSegments, captionPlacement, captionPosition, captionSegments, captionSize,
    captionStyle, captionsEnabled, currentTime, fitMode, imageClipCount, imageDuration,
    imageMeta, imageName, imageSrc, imageUrlRefs, musicBlob, musicDuration, musicName, musicSegments, musicStart,
    musicPeaks, musicUrl, musicUrlRef, musicVolume, notify, selectedAudioSegmentId,
    selectedFilterId, selectedSegmentId, selectedStickerId, selectedStickerSegmentId,
    selectedTrack, selectedTransitionId, selectedVisualSegmentId, script, setAudioSegments,
    setCaptionPlacement, setCaptionPosition, setCaptionSegments, setCaptionSize,
    setCaptionStyle, setCaptionsEnabled, setCurrentTime, setFitMode, setImageClipCount,
    setImageDuration, setImageMeta, setImageName, setImageSrc, setIsPlaying, setMusicBlob,
    setMusicDuration, setMusicName, setMusicPeaks, setMusicSegments, setMusicStart, setMusicUrl, setMusicVolume, setScript,
    setSelectedAudioSegmentId, setSelectedFilterId, setSelectedSegmentId,
    setSelectedStickerId, setSelectedStickerSegmentId, setSelectedTrack,
    setSelectedTransitionId, setSelectedVisualSegmentId, setSourceAudioBlob,
    setSourceAudioAssetId, setSourceAudioDuration, setSourceAudioLinked, setSourceAudioName, setSourceAudioPeaks, setSourceAudioStart,
    setSourceAudioUrl, setSourceAudioVolume, setStickerSegments, setTimelineHorizon,
    setTrackLocks, setTrackVisibility, setUserAssets, setVisualSegments, setVisualType,
    sourceAudioAssetId, sourceAudioBlob, sourceAudioDuration, sourceAudioLinked, sourceAudioName, sourceAudioPeaks,
    sourceAudioStart, sourceAudioUrl, sourceAudioUrlRef, sourceAudioVolume, stickerSegments,
    timelineHorizon, trackLocks, trackVisibility, userAssets, visualSegments, visualType,
    visualOverlaySegments, selectedVisualOverlayId, setVisualOverlaySegments, setSelectedVisualOverlayId,
  });
  const t = useMemo(() => createTranslator(activeLanguage), [activeLanguage]);
  const {
    addVoiceProfile, removeVoiceProfile, selectedVoiceProfileId, setSelectedVoiceProfileId,
    toggleVoiceProfileFavorite, voiceProfiles,
  } = useVoiceProfiles({ favoriteVoiceIds, setFavoriteVoiceIds, notify, t });
  const selectedVoiceProfile = voiceProfiles.find((profile) => profile.id === selectedVoiceProfileId) ?? null;
  const handleCancelExport = () => {
    const controller = exportAbortControllerRef.current;
    if (!controller || controller.signal.aborted) return;
    setExportPhase(t("exportCanceling"));
    controller.abort();
  };
  const trOption = (name, option) => {
    if (option?.kind === "stickerCategory") {
      return activeLanguage !== "zh" && option.nameEn ? option.nameEn : name;
    }

    return activeLanguage !== "zh" && option?.nameEn ? option.nameEn : translateOptionName(activeLanguage, name);
  };
  const shouldShowLanguageIntro = !uiLanguage;
  const requestFirstVisualGuide = () => {
    const isMobile = window.matchMedia?.(FIRST_VISUAL_GUIDE_MOBILE_QUERY).matches ?? false;
    if (!canShowFirstVisualGuide({
      isMobile,
      hasSeen: hasSeenFirstVisualGuide(),
      shownThisSession: firstVisualGuideShownRef.current,
    })) return;
    firstVisualGuideShownRef.current = true;
    setShowFirstVisualGuide(true);
  };

  const linkedSourceAudioSegments = useMemo(
    () => sourceAudioLinked && sourceAudioBlob
      ? getLinkedSourceAudioSegments(visualSegments, sourceAudioAssetId, sourceAudioDuration)
      : [],
    [sourceAudioAssetId, sourceAudioBlob, sourceAudioDuration, sourceAudioLinked, visualSegments],
  );
  const sourceAudioTimelineEnd = sourceAudioLinked && linkedSourceAudioSegments.length
    ? getLinkedSourceAudioEnd(linkedSourceAudioSegments)
    : sourceAudioStart + sourceAudioDuration;
  const musicTimelineEnd = musicSegments.length
    ? musicSegments.reduce((end, segment) => Math.max(end, segment.start + segment.duration), 0)
    : musicStart + musicDuration;

  const rippleTimelineAfter = (boundary, delta) => applyTimelineRipple({
    rippleEditing, audioSegments, captionSegments, musicBlob, musicSegments, musicStart,
    sourceAudioBlob, sourceAudioLinked, sourceAudioStart, stickerSegments, trackLocks,
    visualOverlaySegments, setAudioSegments, setCaptionSegments, setMusicSegments,
    setMusicStart, setSourceAudioStart, setStickerSegments, setVisualOverlaySegments,
  }, boundary, delta);

  const {
    activePreviewFilter, audioBlob, audioDuration, audioUrl, canPreview, captionDuration,
    captionTargetDuration, captionTimeline, currentCaption, currentCaptions, currentCaptionSegment,
    currentSegmentIndex, currentStickerSegment, currentStickerSegmentIndex,
    currentVisualRange, currentVisualSegment, currentVisualSegmentIndex, estimatedDuration,
    focusedSegmentIndex, getStickerDragAsset, peaks, previewSticker, previewStickers, previewVisualOverlays, previewTransition,
    previewVisionBaseAnalysis, previewVisionKey, previewVisionRecord, previewVisualLocalTime,
    previewVisualRange, previewVisualSegment, previewVisualSegmentIndex,
    previewVisualSourceTime, previewVisualSrc, previewVisualType, ratio, segments,
    selectedAudioSegment, selectedCaptionSegment, selectedFilter, selectedSegmentIndex,
    selectedSticker, selectedStickerSegmentIndex, selectedVisualSegmentIndex, selectedVoice,
    stickerDuration, timelineDuration, visualTimeline, voiceTrackDuration,
  } = useTimelineModel({
    timelineMarkers,
    audioSegments, captionSegments, currentTime, imageDuration, imageSrc, musicBlob,
    musicDuration, musicTimelineEnd, musicUrl, ratioId, script, selectedAudioSegmentId, selectedFilterId,
    selectedSegmentId, selectedStickerId, selectedStickerSegmentId,
    selectedVisualSegmentId, selectedVoiceId, sourceAudioBlob, sourceAudioDuration,
    sourceAudioTimelineEnd,
    sourceAudioStart, sourceAudioUrl, stickerSegments, timelineDurationRef, timelineHorizon,
    timelineZoom,
    trackVisibility, visionRecords, visualSegments, visualType, visualOverlaySegments,
  });
  const previousTimelineContentDurationRef = useRef(estimatedDuration);
  useEffect(() => {
    const previousDuration = previousTimelineContentDurationRef.current;
    const becameNonEmpty = previousDuration <= 0 && estimatedDuration > 0;
    const becameEmpty = previousDuration > 0 && estimatedDuration <= 0;

    if (becameNonEmpty) {
      if (timelineImportRestoreRef.current) timelineImportRestoreRef.current = false;
      else setTimelineZoom(getTimelineInitialContentZoom(estimatedDuration));
      if (trackScrollRef.current) trackScrollRef.current.scrollLeft = 0;
    } else if (becameEmpty) {
      timelineImportRestoreRef.current = false;
      setTimelineHorizon(10);
      setTimelineZoom(getTimelineInitialContentZoom(0));
      setCurrentTime(0);
      if (trackScrollRef.current) trackScrollRef.current.scrollLeft = 0;
    }

    previousTimelineContentDurationRef.current = estimatedDuration;
  }, [estimatedDuration, setCurrentTime, setTimelineHorizon, setTimelineZoom, trackScrollRef]);
  const previewFrameSize = usePreviewFrameSize(previewShellRef, ratio, compactRail);
  const selectedVisualSegment = visualSegments[selectedVisualSegmentIndex] ?? previewVisualSegment ?? null;
  const selectedVisualOverlay = visualOverlaySegments.find((item) => item.id === selectedVisualOverlayId) ?? null;
  const selectedEffectSegment = selectedTrack === "overlay" && selectedVisualOverlay
    ? selectedVisualOverlay
    : selectedVisualSegment;
  const effectVisionKey = getVisionKey(selectedEffectSegment);
  const effectVisionRecord = effectVisionKey ? visionRecords[effectVisionKey] ?? null : null;
  const effectAnalysis = effectVisionRecord?.analysis ?? null;
  const effectRunning = visionJob.running && visionJob.key === effectVisionKey;
  const effectProgress = visionJob.key === effectVisionKey ? visionJob.progress : (effectAnalysis?.complete ? 100 : 0);
  const effectPhase = visionJob.key === effectVisionKey ? visionJob.phase : "";
  const selectedVisualRange = visualTimeline[selectedVisualSegmentIndex] ?? previewVisualRange;
  const [visualAnimationPreview, setVisualAnimationPreview] = useState(null);
  const [visualCanvasEditMode, setVisualCanvasEditMode] = useState("transform");
  useEffect(() => {
    if (!isCompactViewport || mobilePanel !== "inspector" || !mobileInspectorSection) return;
    if (!["visual-clip", "overlay-clip"].includes(mobilePanelOrigin)) return;
    const segment = mobilePanelOrigin === "overlay-clip" ? selectedVisualOverlay : selectedVisualSegment;
    if (!segment) return;
    const isVector = segment.kind === "vector"
      || Boolean(segment.vectorBody)
      || String(segment.assetId || "").startsWith("vector-");
    const supportedSections = getVisualPropertyTabIds({
      isVector,
      isVideo: segment.type === "video",
      isOverlay: mobilePanelOrigin === "overlay-clip",
      hasVectorEditor: isVector,
      isMobile: true,
    });
    if (segment.type === "video") supportedSections.push("audio", "spatial");
    if (mobileInspectorSection !== "effects" && !supportedSections.includes(mobileInspectorSection)) setMobileInspectorSection(supportedSections[0] || "transform");
  }, [
    isCompactViewport,
    mobileInspectorSection,
    mobilePanel,
    mobilePanelOrigin,
    selectedVisualOverlay,
    selectedVisualSegment,
  ]);
  useEffect(() => {
    const clearCanvasVisualTarget = (event) => {
      if (event.target instanceof Element && event.target.closest(".preview-frame")) return;
      setCanvasVisualTarget("");
    };
    document.addEventListener("pointerdown", clearCanvasVisualTarget);
    return () => document.removeEventListener("pointerdown", clearCanvasVisualTarget);
  }, []);
  const visualLocalTime = Math.max(0, Math.min(
    selectedVisualSegment?.duration ?? 0,
    currentTime - (selectedVisualRange?.start ?? 0),
  ));
  const updateSelectedVisualEffects = (change) => {
    if (!selectedVisualSegment?.id || trackLocks.image) return notify("请先选择未锁定的 Visuals 片段");
    setVisualSegments((items) => {
      const nextItems = items.map((item) => {
      if (item.id !== selectedVisualSegment.id) return item;
      if (Number.isFinite(change.playbackRate) && item.type === "video") return updateVisualSegmentPlaybackRate(item, change.playbackRate);
      if (change.speedCurve && item.type === "video") return updateVisualSegmentSpeedCurve(item, change.speedCurve);
      if (change.baseTransform) return {
        ...item,
        baseTransform: normalizeVisualTransform({ ...item.baseTransform, ...change.baseTransform }),
      };
      if (change.keyframe) return { ...item, keyframes: upsertVisualKeyframe(item.keyframes, change.keyframe.time, change.keyframe) };
      if (change.propertyKeyframe) return { ...item, keyframes: upsertVisualPropertyKeyframe(item.keyframes, change.propertyKeyframe.time, change.propertyKeyframe.key, change.propertyKeyframe.value) };
      if (change.removePropertyKeyframe) return { ...item, keyframes: removeVisualPropertyKeyframe(item.keyframes, change.removePropertyKeyframe.time, change.removePropertyKeyframe.key) };
      if (Number.isFinite(change.removeKeyframeAt)) return { ...item, keyframes: (item.keyframes ?? []).filter((frame) => Math.abs(frame.time - change.removeKeyframeAt) > 0.04) };
      if (change.mask) return { ...item, mask: change.mask };
      if (change.animation) return { ...item, animation: change.animation };
      if (typeof change.filterId === "string") return { ...item, filterId: change.filterId };
      if (change.colorGrade) return { ...item, colorGrade: change.colorGrade };
      if (change.subjectEffect) return { ...item, subjectEffect: normalizeSubjectEffect(change.subjectEffect) };
      if (change.clickRipple) return { ...item, clickRipple: normalizeClickRippleEffect(change.clickRipple) };
      if (change.cinematicDepth) return { ...item, cinematicDepth: normalizeCinematicDepth(change.cinematicDepth) };
      if (change.photoParallax) return { ...item, photoParallax: normalizePhotoParallax(change.photoParallax) };
      if (change.vectorPatch && (item.kind === "vector" || item.vectorBody)) return { ...item, ...change.vectorPatch };
      if (typeof change.enhancementEnabled === "boolean" && item.enhancement) {
        if (["remaster-drunet-full", "nanovsr-644k", "detail-enhancement", "smart-denoise-drunet"].includes(item.enhancement.mode)) {
          const source = change.enhancementEnabled ? item.enhancement.processed : item.enhancement.original;
          if (!source?.src) return item;
          return {
            ...item,
            src: source.src,
            blob: source.blob,
            width: source.width,
            height: source.height,
            sourceStart: source.sourceStart,
            sourceDuration: source.sourceDuration,
            trackFrames: source.trackFrames ?? [],
            enhancement: { ...item.enhancement, enabled: change.enhancementEnabled },
          };
        }
        if (item.enhancement.previewUrl) return { ...item, enhancement: { ...item.enhancement, enabled: change.enhancementEnabled } };
      }
      if (typeof change.repairEnabled === "boolean" && item.repair) {
        const source = change.repairEnabled ? item.repair.processed : item.repair.original;
        if (!source?.src) return item;
        return {
          ...item,
          src: source.src,
          blob: source.blob,
          width: source.width,
          height: source.height,
          sourceStart: source.sourceStart,
          sourceDuration: source.sourceDuration,
          trackFrames: source.trackFrames ?? [],
          repair: { ...item.repair, enabled: change.repairEnabled },
        };
      }
      return item;
      });
      if (Number.isFinite(change.playbackRate) || change.speedCurve) {
        const nextSegment = nextItems.find((item) => item.id === selectedVisualSegment.id);
        const nextDuration = getVisualSegmentsTotal(nextItems);
        setImageDuration(nextDuration);
        setImageClipCount(getImageThumbnailCount(nextDuration));
        const previousSourceStart = Math.max(0, Number(selectedVisualSegment.sourceStart) || 0);
        const previousSourceDuration = Math.max(0.1, Number(selectedVisualSegment.sourceDuration)
          || (Number(selectedVisualSegment.duration) || 0.1) * (Number(selectedVisualSegment.playbackRate) || 1));
        const sourceProgress = Math.max(0, Math.min(
          1,
          (getVisualSourceTime(selectedVisualSegment, visualLocalTime) - previousSourceStart) / previousSourceDuration,
        ));
        const nextLocalTime = nextSegment?.speedCurve?.enabled
          ? getVisualSpeedCurveTimelineProgress(nextSegment.speedCurve, sourceProgress) * (nextSegment.duration || 0)
          : sourceProgress * (nextSegment?.duration || 0);
        setCurrentTime(() => Math.max(
          selectedVisualRange?.start ?? 0,
          Math.min(
            (selectedVisualRange?.start ?? 0) + (nextSegment?.duration ?? 0),
            (selectedVisualRange?.start ?? 0) + nextLocalTime,
          ),
        ));
      }
      return nextItems;
    });
  };
  const updateSelectedSubjectEffect = (nextEffect) => {
    if (!selectedEffectSegment?.id) return void notify(t("effectSelectClip"));
    const effect = normalizeSubjectEffect(nextEffect);
    if (selectedTrack === "overlay" && selectedVisualOverlay) {
      if (trackLocks.overlay) return void notify(t("effectClipLocked"));
      setVisualOverlaySegments((items) => items.map((item) => item.id === selectedVisualOverlay.id
        ? { ...item, subjectEffect: effect }
        : item));
      return;
    }
    updateSelectedVisualEffects({ subjectEffect: effect });
  };
  const removeSelectedSubjectEffect = () => {
    updateSelectedSubjectEffect(DEFAULT_SUBJECT_EFFECT);
    notify(t("effectRemoved"));
  };
  const updateSelectedClickRipple = (nextEffect) => {
    if (!selectedEffectSegment?.id) return void notify(t("effectSelectClip"));
    const clickRipple = normalizeClickRippleEffect(nextEffect);
    if (selectedTrack === "overlay" && selectedVisualOverlay) {
      if (trackLocks.overlay) return void notify(t("effectClipLocked"));
      setVisualOverlaySegments((items) => items.map((item) => item.id === selectedVisualOverlay.id
        ? { ...item, clickRipple }
        : item));
      return;
    }
    updateSelectedVisualEffects({ clickRipple });
  };
  const miganRepair = useMiganRepair({
    selectedSegment: selectedVisualSegment,
    imageUrlRefs,
    setVisualSegments,
    setUserAssets,
    notify,
    t,
  });
  const hdRestoration = useDetailRestoration({
    selectedSegment: selectedVisualSegment,
    imageUrlRefs,
    setVisualSegments,
    setUserAssets,
    notify,
    t,
  });
  const smartDenoise = useSmartDenoise({
    selectedSegment: selectedVisualSegment,
    imageUrlRefs,
    setVisualSegments,
    setUserAssets,
    notify,
    t,
  });
  const setSmartFrameRatio = useCallback((nextRatioId) => {
    setRatioId(nextRatioId);
    if (nextRatioId !== ratioId) setFitMode("contain");
  }, [ratioId, setRatioId, setFitMode]);
  const smartFrame = useSmartFrame({
    selectedSegment: selectedVisualSegment,
    ratioId,
    setRatioId: setSmartFrameRatio,
    setVisualSegments,
    trackLocked: Boolean(trackLocks.image),
    notify,
  });
  const exportElapsedSeconds = useExportElapsed(exporting, exportStartRef);
  const {
    effectiveCaptionPlacement, previewSmartCropRect, previewVisionAnalysis,
    previewVisionMaskUrl, previewVisionOptions,
    previewSmartBackgroundPosition, previewVisualObjectFit, previewVisualObjectPosition,
    previewVisualRenderSrc,
  } = usePreviewModel({
    captionPlacement, captionSize, captionStyle, currentCaption, fitMode, previewFrameSize,
    previewVideoMediaTime, previewVisionBaseAnalysis, previewVisionRecord,
    previewVisualSourceTime, previewVisualSrc, previewVisualType, ratio,
    previewVisualSegment, previewSmartFrameOverride: smartFrame.previewOverride,
  });

  const { builtInAssets, filteredVoices, libraryType, libraryQuery, setLibraryQuery,
    selectLibraryType, libraryStatus, libraryError, libraryProvider, assetDownloadStates, prefetchLibraryAsset } = useEditorCatalog(voiceFilter);
  const generationPlugins = useGenerationPlugins({
    imageUrlRefs,
    notify,
    setActiveTool,
    setMediaTab,
    setSelectedLibraryAssetId,
    setUserAssets,
  });
  const handleGeneratedVector = (asset) => {
    setUserAssets((current) => [asset, ...current]);
    setSelectedLibraryAssetId(asset.id);
    setMediaTab("mine");
  };
  const depthReplacementLocksRef = useRef(trackLocks);
  useEffect(() => { depthReplacementLocksRef.current = trackLocks; }, [trackLocks]);
  const handleDepthMapAssetReady = (assetDraft, { sourceSegment } = {}) => {
    const id = crypto.randomUUID();
    const src = URL.createObjectURL(assetDraft.blob);
    imageUrlRefs.current.add(src);
    const asset = { ...assetDraft, id, src };
    setUserAssets((current) => [asset, ...current]);
    setSelectedLibraryAssetId(id);
    setActiveTool("media");
    setMediaTab("mine");
    if (sourceSegment) {
      const replace = (items) => items.map((item) => {
        // Never resurrect a deleted clip or overwrite a changed source range.
        if (item.id !== sourceSegment.id || item.src !== sourceSegment.src ||
            item.duration !== sourceSegment.duration || item.sourceStart !== sourceSegment.sourceStart ||
            item.sourceDuration !== sourceSegment.sourceDuration ||
            item.playbackRate !== sourceSegment.playbackRate ||
            JSON.stringify(item.speedCurve) !== JSON.stringify(sourceSegment.speedCurve)) return item;
        return {
          ...item, ...getVisualAssetPayload(asset), duration: item.duration,
          speedCurve: undefined, cinematicDepth: undefined, photoParallax: undefined,
          subjectEffect: undefined, repair: undefined, enhancement: undefined,
          volume: item.volume ?? 1, spatialEffect: item.spatialEffect, spatialAmount: item.spatialAmount,
          sourceAudioDisabled: item.sourceAudioDisabled === true, audioSeparated: item.audioSeparated === true,
          sourceAudioOriginAssetId: item.sourceAudioOriginAssetId || item.assetId,
          sourceAudioTiming: item.sourceAudioTiming || (Number.isFinite(item.sourceAudioOffset) || item.audioSeparated
            ? { sourceStart: item.sourceStart, sourceDuration: item.sourceDuration,
              playbackRate: item.playbackRate, speedCurve: item.speedCurve } : undefined),
          depthMapSourceAssetId: sourceSegment.assetId || "",
        };
      });
      if (!depthReplacementLocksRef.current.image) setVisualSegments(replace);
      // A picture-in-picture analysis replaces its own lane, never the main sequence.
      if (!depthReplacementLocksRef.current.overlay) setVisualOverlaySegments(replace);
      setIsPlaying(false);
    }
    return asset;
  };
  const handleOpticalFlowAssetReady = (assetDraft) => {
    const id = crypto.randomUUID();
    const src = URL.createObjectURL(assetDraft.blob);
    imageUrlRefs.current.add(src);
    const asset = { id, src, ...assetDraft };
    setUserAssets((current) => [asset, ...current]);
    setSelectedLibraryAssetId(id);
    setActiveTool("media");
    setMediaTab("mine");
    notify(t("effectFlowAddedToAssets"));
    return asset;
  };

  const {
    canDropAssetOnTrack, findAssetById, getActiveDraggedAsset, getDraggedAsset,
    getTimelineDropPercent, handleAssetClick, handleAssetDragEnd, handleAssetDragStart,
    confirmStickerSelection, handleAssetPointerDown, handleStickerClick, handleTrackAssetDragLeave,
    handleTrackAssetDragOver, triggerAssetDropPulse,
  } = createAssetDragControls({
    addStickerAssetToTimeline: (...args) => addStickerAssetToTimeline(...args), applyAssetToTrack: (...args) => applyAssetToTrack(...args), assetDropPulseTimerRef, builtInAssets, currentTime, draggedAssetId,
    draggedAssetIdRef, getStickerDragAsset, notify, pointerAssetDragRef, prefetchAsset: prefetchLibraryAsset,
    setAssetDragPreview, setAssetDropPosition, setAssetDropPulseTrack,
    setAssetDropTargetTrack, setDraggedAssetId, setSelectedLibraryAssetId,
    setSelectedStickerId, setSelectedStickerSegmentId, suppressAssetClickRef,
    t, timelineDuration, trackLocks, trackScrollRef, userAssets, visualSegments,
  });

  const analyzeCurrentVisual = useVisionAnalysis({
    activeTool,
    notify, previewVideoRef, previewVisionKey, previewVisualSegment, previewVisualSrc,
    previewVisualType, previewVisualRange, setCurrentTime, setPreviewVideoMediaTime,
    setVisionJob, setVisionRecords, visionAbortControllerRef,
    t, visionJob, visionJobGenerationRef, visionObjectUrlsRef,
  });
  const analyzeEffectVisual = useVisionAnalysis({
    activeTool: "effects",
    notify,
    previewVideoRef,
    previewVisionKey: effectVisionKey,
    previewVisualSegment: selectedEffectSegment,
    previewVisualSrc: selectedEffectSegment?.src || "",
    previewVisualType: selectedEffectSegment?.type || "image",
    previewVisualRange: selectedTrack === "overlay" && selectedVisualOverlay
      ? {
          start: selectedVisualOverlay.start || 0,
          end: (selectedVisualOverlay.start || 0) + (selectedVisualOverlay.duration || 0),
        }
      : selectedVisualRange,
    setCurrentTime,
    setPreviewVideoMediaTime,
    setVisionJob,
    setVisionRecords,
    t,
    visionAbortControllerRef,
    visionJob,
    visionJobGenerationRef,
    visionObjectUrlsRef,
  });

  const {
    removeVisionRecordsForAsset, setFitModeFromUser,
  } = createVisionControls({
    imageName, notify, previewVisionAnalysis, previewVisionBaseAnalysis, previewVisionKey,
    previewVisionOptions, previewVisionRecord, previewVisualSegment, previewVisualType,
    setFitMode, setVisionJob, setVisionRecords, visionAbortControllerRef,
    visionJob, visionJobGenerationRef, visionObjectUrlsRef,
  });

  const {
    alignAudioCaptions, alignCaptionToAudio, commitCaptionSegments, deleteCaptionSegment, handleCaptionPositionChange,
    linkAllCaptionAudio, linkAudioToCaption, linkCaptionAudio,
    startCaptionDrag, syncCaptionPositions, toggleCaptionSegmentHidden,
    unlinkAllCaptionAudio, unlinkAudioCaptions, unlinkCaptionAudio, updateCaptionSegmentText, updateScript,
  } = createCaptionEditingActions({
    audioSegments, captionPlacement, captionSegments, captionStyle, currentCaptionSegment, focusedSegmentIndex,
    notify, previewCanvasRef, previewVisionKey, previewVisionRecord, script,
    selectedSegmentId, setCaptionPlacement, setCaptionPosition, setCaptionSegments,
    setScript, setSelectedSegmentId, setSelectedTrack,
    setVisionRecords, t, trackLocks,
  });
  const captionVisualTarget = selectedCaptionSegment && getVisualSegmentTimeline(visualSegments).find(range => selectedCaptionSegment.start >= range.start - 0.000001 && selectedCaptionSegment.end <= range.end + 0.000001);
  const toggleCaptionVisualLink = () => {
    if (!selectedCaptionSegment || trackLocks.caption) return;
    const id=selectedCaptionSegment.id, owner=captionVisualTarget?.id;
    if (!selectedCaptionSegment.visualSegmentId && !owner) return;
    setCaptionSegments(items=>items.map(item=>{
      if(item.id!==id)return item;
      const {visualSegmentId:previous,...rest}=item;
      return previous ? rest : {...item,visualSegmentId:owner};
    }));
  };
  const makeTimedVisualAssociation = (segment, setter, locked) => {
    if (!segment) return null;
    const owner=getVisualSegmentTimeline(visualSegments).find(range=>segment.start>=range.start-0.000001 && segment.start+segment.duration<=range.end+0.000001);
    return {linked:Boolean(segment.visualSegmentId),disabled:Boolean(locked||(!segment.visualSegmentId&&!owner)),toggle:()=>{
      if(locked||(!segment.visualSegmentId&&!owner))return;
      setter(current=>current.map(item=>{if(item.id!==segment.id)return item;const {visualSegmentId:previous,...rest}=item;return previous?rest:{...item,visualSegmentId:owner.id};}));
    }};
  };
  const audioVisualAssociation = selectedTrack === "audio" ? makeTimedVisualAssociation(selectedAudioSegment,setAudioSegments,isTimedSegmentLaneLocked(audioSegments,selectedAudioSegment?.id,trackLocks)) : null;
  const importCaptionSegments = (importedSegments, mode, skipped = 0) => {
    const nextSegments = mode === "append"
      ? appendImportedCaptions(captionSegments, importedSegments)
      : importedSegments;
    const selectedIndex = nextSegments.findIndex((segment) => segment.id === importedSegments[0]?.id);
    commitCaptionSegments(
      nextSegments,
      t("srtImportComplete").replace("{count}", importedSegments.length).replace("{skipped}", skipped),
      Math.max(0, selectedIndex),
    );
    setCaptionsEnabled(true);
    setTrackVisibility((current) => ({ ...current, caption: true }));
  };
  const autoEdit = useAutoEdit({
    language: activeLanguage, visualSegments, captionSegments, commitCaptionSegments, setCaptionsEnabled,
    setTrackVisibility, setSelectedSegmentId, setSelectedTrack, notify, t,
  });
  const {
    clearAudioTrack, clearMusicTrack, clearSourceAudioTrack, commitAudio, commitAudioBatch,
    replaceAudio, replaceMusic, replaceSourceAudio,
  } = createAudioTrackActions({
    audioBlob, audioDuration, audioSegmentRefs, audioSegments, audioSegmentsRef, captionDuration, generatedVoiceEndRef,
    currentTimeRef, imageDuration, imageSrc, musicBlob, musicDuration, musicRef,
    musicUrlRef, notify, script, selectedVoice, selectedVoiceId, setActiveTool,
    setAudioSegments, setCaptionSegments, setCurrentTime, setHistoryItems,
    setIsPlaying, setMusicBlob, setMusicDuration, setMusicName, setMusicPeaks, setMusicSegments,
    setMusicStart, setMusicUrl, setProgress, setSelectedAudioSegmentId, setSelectedMusicSegmentId, setSelectedSegmentId,
    setSelectedTrack, setSourceAudioAssetId, setSourceAudioBlob, setSourceAudioDuration, setSourceAudioLinked, setSourceAudioName,
    setSourceAudioPeaks, setSourceAudioStart, setSourceAudioUrl, setSourceAudioVolume, setSourceAudioSpatialEffect, setSourceAudioSpatialAmount,
    setStatus, setStatusText, setTimelineHorizon, sourceAudioBlob, sourceAudioDuration,
    sourceAudioAssetId, sourceAudioRef, sourceAudioStart, sourceAudioUrlRef, t,
  });
  const moveSourceAudioToAudioLane = ({ segmentId = "source-audio", start = 0, lane = 0, processingPatch = null } = {}) => {
    if (trackLocks.source || trackLocks.audio || trackLocks[`audio-${lane}`] || trackLocks.image) return false;
    if (!(sourceAudioBlob instanceof Blob)) return false;
    const linkedPiece = sourceAudioLinked && segmentId !== "source-audio"
      ? linkedSourceAudioSegments.find((segment) => segment.id === segmentId) ?? null
      : null;
    const playbackRate = Math.max(0.25, Math.min(4, Number(linkedPiece?.playbackRate) || 1));
    const duration = Math.max(0, Number(linkedPiece?.duration ?? sourceAudioDuration) || 0);
    if (!(duration > 0)) return false;

    const nextId = crypto.randomUUID();
    const nextUrl = URL.createObjectURL(sourceAudioBlob);
    const sourceStart = Math.max(0, Number(linkedPiece?.sourceStart) || 0);
    const sourceDuration = Math.max(
      0,
      Number(linkedPiece?.sourceDuration) || Math.min(sourceAudioDuration - sourceStart, duration * playbackRate),
    );
    let nextSegment = {
      id: nextId,
      blob: sourceAudioBlob,
      url: nextUrl,
      start: Math.max(0, Number(start) || 0),
      duration,
      sourceStart,
      sourceDuration,
      playbackRate,
      peaks: linkedPiece
        ? sliceSourceAudioPeaks(sourceAudioPeaks, linkedPiece, sourceAudioDuration)
        : sourceAudioPeaks,
      volume: linkedPiece?.volume ?? sourceAudioVolume,
      ...(linkedPiece?.speedCurve ? { speedCurve: linkedPiece.speedCurve } : {}),
      fadeIn: 0,
      fadeOut: 0,
      reversed: false,
      spatialEffect: sourceAudioSpatialEffect,
      spatialAmount: sourceAudioSpatialAmount,
      lane: Math.max(0, Number(lane) || 0),
      name: sourceAudioName || t("sourceTrack"),
      sourceKind: "video-source",
      assetId: linkedPiece?.assetId || sourceAudioAssetId || "",
      sourceVisualSegmentId: linkedPiece?.id || "",
      sourceAudioWasLinked: Boolean(linkedPiece),
      ...(linkedPiece && Math.abs((Number(start) || 0) - linkedPiece.start) < 0.000001 ? { visualSegmentId: linkedPiece.id } : {}),
    };

    if (processingPatch) {
      nextSegment = applyProcessedSourceMedia(nextSegment, processingPatch);
      if (!nextSegment) { URL.revokeObjectURL(nextUrl); return false; }
      URL.revokeObjectURL(nextUrl);
      if (linkedPiece) nextSegment.visualSegmentId = linkedPiece.id;
    }
    imageUrlRefs.current.add(nextSegment.url);

    const hasExplicitSourceMappings = visualSegments.some((segment) => (
      segment.type === "video" && Number.isFinite(segment.sourceAudioOffset)
    ));
    const nextVisualSegments = visualSegments.map((segment) => {
      if (segment.type !== "video") return segment;
      const matchesPiece = linkedPiece
        ? segment.id === linkedPiece.id
        : hasExplicitSourceMappings
          ? Number.isFinite(segment.sourceAudioOffset)
          : Boolean(sourceAudioAssetId && segment.assetId === sourceAudioAssetId);
      return matchesPiece
        ? { ...segment, sourceAudioDisabled: true, sourceAudioRoutedToAudioSegmentId: nextId }
        : segment;
    });
    setVisualSegments(nextVisualSegments);
    setAudioSegments((segments) => [...segments, nextSegment]);
    if (processingPatch) {
      const oldId = linkedPiece?.id || "source-audio";
      setCaptionSegments(items => items.map(item => ({ ...item,
        ...(item.audioSegmentId === oldId ? { audioSegmentId: nextId } : {}),
        ...(item.detachedAudioSegmentId === oldId ? { detachedAudioSegmentId: nextId } : {}),
      })));
    }

    const remainingLinkedPieces = sourceAudioLinked
      ? getLinkedSourceAudioSegments(nextVisualSegments, sourceAudioAssetId, sourceAudioDuration)
      : [];
    if (!sourceAudioLinked || !remainingLinkedPieces.length) {
      sourceAudioRef.current?.pause?.();
      if (sourceAudioUrlRef.current) URL.revokeObjectURL(sourceAudioUrlRef.current);
      sourceAudioUrlRef.current = "";
      setSourceAudioBlob(null);
      setSourceAudioUrl("");
      setSourceAudioName("");
      setSourceAudioDuration(0);
      setSourceAudioPeaks([]);
      setSourceAudioStart(0);
      setSourceAudioAssetId("");
      setSourceAudioLinked(true);
      setSourceAudioSpatialEffect("original");
      setSourceAudioSpatialAmount(1);
      sourceVoiceColorOriginalRef.current = null;
    }

    setSelectedSourceAudioSegmentId("");
    setSelectedAudioSegmentId(nextId);
    setSelectedTrack("audio");
    setActiveTool("audio");
    setTimelineHorizon((value) => Math.max(value, nextSegment.start + nextSegment.duration));
    notify(t("sourceAudioMovedToAudioTrack"));
    return true;
  };
  const { separateAudioClipVocals, separateSourceVocals, vocalSeparationJob } = useVocalSeparation({
    sourceAudioBlob, sourceAudioName, replaceAudio, replaceSourceAudio, replaceMusic, notify, t,
  });
  const selectedSourceAudioPiece = linkedSourceAudioSegments.find((segment) => segment.id === selectedSourceAudioSegmentId) ?? null;
  const selectedMusicSegment = musicSegments.find((segment) => segment.id === selectedMusicSegmentId) ?? null;
  useEffect(() => {
    if (selectedMusicSegmentId && !selectedMusicSegment) setSelectedMusicSegmentId("");
  }, [selectedMusicSegment, selectedMusicSegmentId]);
  const selectedAudioToolTarget = selectedTrack === "audio" && selectedAudioSegmentId && selectedAudioSegment
    ? { ...selectedAudioSegment, segmentId: selectedAudioSegment.id, track: "audio", canChangeSpeed: true }
    : selectedTrack === "music" && musicBlob
      ? { ...(selectedMusicSegment ?? musicSegments[0] ?? { id: "music-audio", start: musicStart, duration: musicDuration, sourceStart: 0, sourceDuration: musicDuration, playbackRate: 1 }), blob: musicBlob, name: musicName || t("musicTrack"), segmentId: selectedMusicSegment?.id || musicSegments[0]?.id || "music-audio", track: "music", volume: selectedMusicSegment?.volume ?? musicSegments[0]?.volume ?? musicVolume, canChangeSpeed: true }
      : selectedTrack === "source" && sourceAudioBlob
        ? { ...(selectedSourceAudioPiece ?? {}), blob: sourceAudioBlob, url: sourceAudioUrl, peaks: selectedSourceAudioPiece ? sliceSourceAudioPeaks(sourceAudioPeaks, selectedSourceAudioPiece, sourceAudioDuration) : sourceAudioPeaks, name: sourceAudioName, start: selectedSourceAudioPiece?.start ?? sourceAudioStart, sourceStart: selectedSourceAudioPiece?.sourceStart ?? 0, duration: selectedSourceAudioPiece?.duration ?? sourceAudioDuration, sourceDuration: selectedSourceAudioPiece?.sourceDuration ?? sourceAudioDuration, playbackRate: selectedSourceAudioPiece?.playbackRate ?? 1, segmentId: selectedSourceAudioSegmentId || "source-audio", track: "source", volume: selectedSourceAudioPiece?.volume ?? sourceAudioVolume, spatialEffect: sourceAudioSpatialEffect, spatialAmount: sourceAudioSpatialAmount, canChangeStart: !sourceAudioLinked, canChangeSpeed: Boolean(sourceAudioLinked && selectedSourceAudioPiece), voiceColorOriginalBlob: sourceVoiceColorOriginalRef.current?.blob || null }
        : selectedTrack === "image" && selectedVisualSegment?.type === "video"
          ? { ...selectedVisualSegment, segmentId: selectedVisualSegment.id, track: "image", start: selectedVisualRange?.start ?? 0, canChangeStart: false, canChangeSpeed: false, embeddedVideo: true }
          : selectedTrack === "overlay" && selectedVisualOverlay?.type === "video"
            ? { ...selectedVisualOverlay, segmentId: selectedVisualOverlay.id, track: "overlay", canChangeStart: false, canChangeSpeed: false, embeddedVideo: true }
            : null;
  const separateSelectedAudioVocals = () => selectedAudioToolTarget?.track === "source"
    ? separateSourceVocals()
    : selectedAudioToolTarget && separateAudioClipVocals(selectedAudioToolTarget);

  const {
    chooseInterfaceLanguage, clearAllVisionState, selectTool, toggleTrackLock,
    toggleTrackVisibility, useHistoryItem,
  } = createEditorCommandActions({
    notify, replaceAudio, script, selectedTrack, selectedVisualSegment, selectedVisualOverlay, setActiveTool, setAvatarPanelOpen, setCaptionSegments,
    setIntroClosing, setScript, setSelectedSegmentId, setSelectedTrack,
    setSelectedVoiceId, setTrackLocks, setTrackVisibility, setUiLanguage,
    setVisionJob, setVisionRecords, setVoiceTab, visionAbortControllerRef,
    visionJobGenerationRef, visionObjectUrlsRef,
  });

  const {
    appendVisualAssetToTimeline, clearImageTrack, commitVisualSegments,
    getCurrentVisualAssetSnapshot, getVisualDurationForAsset, replaceVisualTimeline,
    setCurrentVisualAsset, updateVisualAssetInTimeline,
  } = createVisualTimelineActions({
    audioBlob, audioDuration, captionDuration, audioSegments, captionSegments, stickerSegments, setAudioSegments, setCaptionSegments, setStickerSegments, setScript,
    extractVideoSourceAudio: (...args) => extractVideoSourceAudio(...args),
    imageDuration, imageMeta, imageName, imageSrc, musicBlob, musicDuration, notify, rippleTimelineAfter,
    previewVisualSegment, script, seekTo: (...args) => seekTo(...args), setCurrentTime,
    setFitMode, setImageClipCount, setImageDuration, setImageMeta, setImageName,
    setImageSrc, setSelectedTrack, setSelectedVisualSegmentId, setVisualSegments,
    setTimelineZoom, setVisualType, sourceAudioBlob, sourceAudioDuration, sourceAudioStart, trackLocks,
    visualSegments, visualType,
  });

  const {
    addStickerAssetToTimeline, commitStickerSegments, getTimelineTimeFromDropPercent,
  } = createStickerTimelineActions({
    estimatedDuration, notify, seekTo: (...args) => seekTo(...args), setActiveTool,
    setSelectedStickerId, setSelectedStickerSegmentId, setSelectedTrack,
    setStickerSegments, stickerSegments, t, timelineDurationRef, trackLocks, visualSegments,
  });
  const selectedStickerSegment = stickerSegments.find((segment) => segment.id === selectedStickerSegmentId) ?? currentStickerSegment;
  const stickerVisualAssociation = makeTimedVisualAssociation(selectedStickerSegment,setStickerSegments,trackLocks.sticker);
  useEffect(() => {
    const normalized = normalizeTimedSegmentIds(stickerSegments, "sticker");
    if (normalized !== stickerSegments) setStickerSegments(normalized);
  }, [setStickerSegments, stickerSegments]);
  const updateSelectedStickerSegment = (change) => {
    if (!selectedStickerSegment?.id) return;
    setStickerSegments((segments) => segments.map((segment) => segment.id === selectedStickerSegment.id ? { ...segment, ...change } : segment));
  };
  const updateCanvasStickerSegment = (segmentId, change) => {
    if (!segmentId) return;
    setStickerSegments((segments) => segments.map((segment) => segment.id === segmentId ? { ...segment, ...change } : segment));
  };
  const selectCanvasStickerSegment = (segmentId) => {
    if (!segmentId) return;
    setSelectedStickerSegmentId(segmentId);
    setSelectedTrack("sticker");
  };
  const deleteSelectedStickerSegment = () => {
    if (!selectedStickerSegment?.id) return;
    commitStickerSegments(stickerSegments.filter((segment) => segment.id !== selectedStickerSegment.id), "已删除贴纸片段");
  };

  const { generateAvatarAcceptanceFrame, openAvatarPanel } = useAvatarGeneration({
    audioBlob, audioDuration, avatarJob, avatarMotionCacheRef, avatarMotionWorkerRef,
    avatarRenderWorkerRef, imageDuration, imageUrlRefs, notify, previewVisualSegment,
    previewVisualSrc, previewVisualType, replaceVisualTimeline, setAvatarJob,
    setAvatarPanelOpen, setCurrentTime, setUserAssets, t,
  });
  const faceSwap = useFaceSwapGeneration({
    downloadBlob, imageDuration, imageUrlRefs, notify, previewVisualSegment, previewVisualSrc,
    previewVisualType, setActiveTool, setMediaTab, setSelectedLibraryAssetId,
    setUserAssets, t,
  });

  const { startVoiceRecording, stopVoiceRecording } = useVoiceRecorder({
    notify, recordingState, setActiveTool, setProgress,
    setRecordedVoices, setRecordingElapsed, setRecordingState,
    setStatus, setStatusText, setVoiceTab, t, voiceRecorderChunksRef,
    voiceRecorderRef, voiceRecorderStartedAtRef, voiceRecorderStreamRef,
    voiceRecorderTimerRef,
  });

  const generateVoiceover = useVoiceGeneration({
    addVoiceProfile, commitAudio, commitAudioBatch, notify, script, selectedVoice, setProgress, setStatus,
    setStatusText, setVoiceTab, speed, status, t, selectedVoiceProfile, volume,
  });

  const { deleteAudioSegment, toggleAudioSegmentReverse, updateAudioSegment } = createAudioClipActions({
    audioSegmentRefs, audioSegments, notify, setAudioSegments, setCaptionSegments,
    setSelectedAudioSegmentId, setTimelineHorizon, t, trackLocks,
  });
  const handleVoiceColorAssetReady = async ({ blob, decoded, profileName, sourceName }) => {
    const id = crypto.randomUUID(); const src = URL.createObjectURL(blob); imageUrlRefs.current.add(src);
    const asset = { id, type: "audio", kind: "voiceover", name: `${sourceName || t("audioClip")} · ${profileName}`,
      meta: `${t("voiceColorTab", "音色")} · ${decoded.duration.toFixed(1)}s`, src, previewSrc: src, blob,
      duration: decoded.duration, peaks: decoded.peaks, generated: true, provider: "OpenVoice V2 · ONNX" };
    setUserAssets((items) => [asset, ...items]); setSelectedLibraryAssetId(id);
    notify(t("voiceColorSavedToAssets", "音色迁移结果已保存到我的素材")); return asset;
  };
  const applyVoiceColorToSelectedAudio = ({ blob, decoded, profileName, segment }) => {
    const url = URL.createObjectURL(blob); imageUrlRefs.current.add(url);
    const target = audioSegments.find((item) => item.id === segment.id);
    const targetTrack = segment.track || (target ? "audio" : selectedTrack);
    if (targetTrack === "audio") {
      if (!target) { URL.revokeObjectURL(url); imageUrlRefs.current.delete(url); notify(t("audioClipMissing")); return false; }
      audioSegmentRefs.current.get(segment.id)?.pause?.();
      if (target.voiceColorOriginalBlob && target.url && target.url !== target.voiceColorOriginalUrl) {
        URL.revokeObjectURL(target.url); imageUrlRefs.current.delete(target.url);
      }
      setAudioSegments((items) => items.map((item) => item.id === segment.id ? {
        ...item,
        voiceColorOriginalBlob: item.voiceColorOriginalBlob || item.blob,
        voiceColorOriginalUrl: item.voiceColorOriginalUrl || item.url,
        voiceColorOriginalPeaks: item.voiceColorOriginalPeaks || item.peaks,
        voiceColorOriginalName: item.voiceColorOriginalName || item.name,
        voiceColorOriginalSourceKind: item.voiceColorOriginalSourceKind || item.sourceKind,
        blob, url, peaks: decoded.peaks, name: `${item.voiceColorOriginalName || item.name} · ${profileName}`,
        voiceName: profileName, sourceKind: "cloned-voiceover", cloneVoiceProfileName: profileName,
      } : item));
    } else if (targetTrack === "source") {
      sourceAudioRef.current?.pause?.();
      if (!sourceVoiceColorOriginalRef.current) sourceVoiceColorOriginalRef.current = {
        blob: sourceAudioBlob, url: sourceAudioUrl, peaks: sourceAudioPeaks, name: sourceAudioName, duration: sourceAudioDuration,
      };
      else if (sourceAudioUrl && sourceAudioUrl !== sourceVoiceColorOriginalRef.current.url) {
        URL.revokeObjectURL(sourceAudioUrl); imageUrlRefs.current.delete(sourceAudioUrl);
      }
      sourceAudioUrlRef.current = url; setSourceAudioBlob(blob); setSourceAudioUrl(url); setSourceAudioPeaks(decoded.peaks);
      setSourceAudioName(`${sourceVoiceColorOriginalRef.current.name || t("sourceTrack")} · ${profileName}`);
    } else { URL.revokeObjectURL(url); imageUrlRefs.current.delete(url); return false; }
    notify(t("voiceColorClipReplaced", "已替换当前片段，可随时恢复原始声音"));
    return true;
  };
  const restoreSelectedAudioVoiceColor = (segment) => {
    const target = audioSegments.find((item) => item.id === segment.id);
    const targetTrack = segment.track || (target ? "audio" : selectedTrack);
    if (targetTrack === "audio") {
      if (!target?.voiceColorOriginalBlob) return false;
      audioSegmentRefs.current.get(segment.id)?.pause?.();
      if (target.url && target.url !== target.voiceColorOriginalUrl) {
        URL.revokeObjectURL(target.url); imageUrlRefs.current.delete(target.url);
      }
      setAudioSegments((items) => items.map((item) => {
        if (item.id !== segment.id) return item;
        const bindings = { ...item.projectMedia?.bindings };
        delete bindings.voiceColorOriginalBlob; delete bindings.voiceColorOriginalUrl;
        return {
          ...item, ...(item.projectMedia ? { projectMedia: { ...item.projectMedia, bindings } } : {}),
          blob: item.voiceColorOriginalBlob, url: item.voiceColorOriginalUrl,
          peaks: item.voiceColorOriginalPeaks, name: item.voiceColorOriginalName,
          sourceKind: item.voiceColorOriginalSourceKind, voiceColorOriginalBlob: null,
          voiceColorOriginalUrl: "", voiceColorOriginalPeaks: null, voiceColorOriginalName: "", voiceColorOriginalSourceKind: "",
        };
      }));
    } else if (targetTrack === "source" && sourceVoiceColorOriginalRef.current) {
      sourceAudioRef.current?.pause?.();
      const original = sourceVoiceColorOriginalRef.current; sourceAudioUrlRef.current = original.url;
      if (sourceAudioUrl && sourceAudioUrl !== original.url) { URL.revokeObjectURL(sourceAudioUrl); imageUrlRefs.current.delete(sourceAudioUrl); }
      setSourceAudioBlob(original.blob); setSourceAudioUrl(original.url); setSourceAudioPeaks(original.peaks);
      setSourceAudioName(original.name); setSourceAudioDuration(original.duration); sourceVoiceColorOriginalRef.current = null;
    } else return false;
    notify(t("voiceColorOriginalRestored", "已恢复原始声音"));
    return true;
  };
  const updateSelectedTrackAudioSegment = (id, patch) => {
    if (["image", "overlay"].includes(selectedTrack)) {
      const lock = selectedTrack === "image" ? trackLocks.image : trackLocks.overlay;
      if (lock) return;
      const audioPatch = {};
      if (Number.isFinite(patch.volume)) audioPatch.volume = Math.max(0, Math.min(4, patch.volume));
      if (typeof patch.spatialEffect === "string") audioPatch.spatialEffect = patch.spatialEffect;
      if (Number.isFinite(patch.spatialAmount)) audioPatch.spatialAmount = Math.max(0, Math.min(1, patch.spatialAmount));
      const update = selectedTrack === "image" ? setVisualSegments : setVisualOverlaySegments;
      update(items => items.map(item => item.id === id && item.type === "video" ? { ...item, ...audioPatch } : item));
      return;
    }
    if (selectedTrack === "audio") return updateAudioSegment(id, patch);
    if (selectedTrack === "music") {
      setMusicSegments((segments) => {
        const source = segments.length ? segments : [{ id: "music-audio", start: musicStart, duration: musicDuration, sourceStart: 0, sourceDuration: musicDuration, playbackRate: 1, peaks: musicPeaks }];
        const next = source.map((segment) => {
          if (segment.id !== id) return segment;
          const normalizedPatch = Number.isFinite(patch.volume)
            ? { ...patch, volume: Math.max(0, Math.min(4, patch.volume)) }
            : patch;
          return Number.isFinite(normalizedPatch.playbackRate)
            ? { ...updateAudioSegmentPlaybackRate(segment, normalizedPatch.playbackRate), ...normalizedPatch }
            : { ...segment, ...normalizedPatch };
        });
        const nextStart = Math.min(...next.map((segment) => segment.start));
        setMusicStart(nextStart);
        return next;
      });
      return;
    }
    if (selectedTrack === "source") {
      if (patch.blob instanceof Blob) {
        const lane = getSourceProcessingLane(audioSegments, trackLocks);
        if (lane === null) return false;
        const piece = linkedSourceAudioSegments.find(item => item.id === id);
        return moveSourceAudioToAudioLane({ segmentId: id, start: piece?.start ?? sourceAudioStart, lane, processingPatch: patch });
      }
      if (Number.isFinite(patch.volume)) {
        const volume = Math.max(0, Math.min(4, patch.volume));
        if (sourceAudioLinked && id !== "source-audio") setVisualSegments((items) => items.map((item) => item.id === id ? { ...item, sourceAudioVolume: volume } : item));
        else setSourceAudioVolume(volume);
      }
      if (typeof patch.spatialEffect === "string") setSourceAudioSpatialEffect(patch.spatialEffect);
      if (Number.isFinite(patch.spatialAmount)) setSourceAudioSpatialAmount(Math.max(0, Math.min(1, patch.spatialAmount)));
      if (!sourceAudioLinked && Number.isFinite(patch.start)) setSourceAudioStart(Math.max(0, patch.start));
      if (sourceAudioLinked && id !== "source-audio" && Number.isFinite(patch.playbackRate)) {
        setVisualSegments((segments) => {
          const next = segments.map((segment) => segment.id === id ? updateVisualSegmentPlaybackRate(segment, patch.playbackRate) : segment);
          const nextDuration = getVisualSegmentsTotal(next);
          setImageDuration(nextDuration);
          setImageClipCount(getImageThumbnailCount(nextDuration));
          return next;
        });
      }
    }
  };

  const { handleAddCaptionSegment, handleAddSegment, handleRemoveSegment } = createTimelineSegmentCountActions({
    captionSegments, clearImageTrack, commitCaptionSegments, commitStickerSegments,
    commitVisualSegments, currentStickerSegmentIndex, currentTime, captionStyle,
    currentVisualSegmentIndex, deleteCaptionSegment, focusedSegmentIndex,
    getCurrentVisualAssetSnapshot, getStickerDragAsset, imageClipCount,
    imageDuration, imageSrc, notify, rippleTimelineAfter, selectedSegmentId, selectedSegmentIndex,
    selectedSticker, selectedStickerSegmentId, selectedTrack,
    selectedVisualSegmentId, selectedVisualSegmentIndex, stickerSegments,
    t, trackLocks, visualSegments,
  });

  const adjustSelectedSegmentWeight = createTimelineDurationActions({
    uiLanguage,
    captionSegments, commitCaptionSegments, commitStickerSegments,
    commitVisualSegments, currentStickerSegmentIndex, currentVisualSegmentIndex,
    focusedSegmentIndex, getCurrentVisualAssetSnapshot, imageDuration, imageSrc,
    notify, selectedSegmentId, selectedSegmentIndex, selectedStickerSegmentId,
    selectedTrack, selectedVisualSegmentId, selectedVisualSegmentIndex,
    rippleTimelineAfter, stickerSegments, trackLocks, visualSegments,
  });

  const { handleDeleteTrack, handleDuplicateTrack } = createTimelineClipboardActions({
    audioBlob, audioSegments, captionSegments, clearImageTrack, clearMusicTrack, clearSourceAudioTrack,
    commitCaptionSegments, commitStickerSegments, commitVisualSegments,
    currentStickerSegmentIndex, currentVisualSegmentIndex, deleteAudioSegment,
    focusedSegmentIndex, getCurrentVisualAssetSnapshot, handleRemoveSegment,
    imageClipCount, imageDuration, imageMeta, imageName, imageSrc, musicBlob, musicDuration, musicName, musicPeaks, musicSegments, musicStart,
    notify, rippleTimelineAfter, selectedAudioSegment, selectedAudioSegmentId, selectedMusicSegmentId, selectedSegmentId,
    selectedSegmentIndex, selectedStickerSegmentId, selectedTrack,
    selectedVisualSegmentId, selectedVisualSegmentIndex, setAudioSegments,
    setCaptionSegments, setMusicSegments, setMusicStart, setSelectedAudioSegmentId, setSelectedMusicSegmentId, sourceAudioBlob,
    sourceAudioLinked, sourceAudioName, selectedSourceAudioSegmentId, linkedSourceAudioSegments,
    setSelectedSourceAudioSegmentId, stickerSegments, t, trackLocks, visualSegments, visualType,
    visualOverlaySegments, selectedVisualOverlayId, setVisualOverlaySegments, setSelectedVisualOverlayId,
  });

  useEditorLifecycle({
    activeLanguage, audioSegments, audioUrlRef, autoRatioSourceKeyRef,
    avatarMotionWorkerRef, avatarRenderWorkerRef, captionSegments, currentVisualSegment, handleDeleteTrack,
    imageUrlRefs, musicBlob, musicUrlRef, notify, ratioId, replaceAudio,
    replaceVisualTimeline, selectedAudioSegmentId, selectedSegmentId,
    selectedStickerSegmentId, selectedTrack, selectedVisualSegmentId, setCurrentVisualAsset,
    selectedVisualOverlayId, visualOverlaySegments,
    setFitMode, setRatioId, setSelectedSegmentId, setSelectedVisualSegmentId,
    setUserAssets, setVisualSegments, sourceAudioBlob, sourceAudioUrlRef, stickerSegments,
    setSelectedVisualOverlayId,
    visionAbortControllerRef, visionObjectUrlsRef, visualSegments,
    voiceRecorderStreamRef, voiceRecorderTimerRef,
  });

  const { handleCutTrack } = createTimelineCutActions({
    audioSegments, captionSegments, captionTargetDuration, commitCaptionSegments, commitStickerSegments, commitVisualSegments,
    currentStickerSegmentIndex, currentTime, focusedSegmentIndex,
    getCurrentVisualAssetSnapshot, imageDuration, imageSrc, notify,
    musicBlob, musicDuration, musicPeaks, musicSegments, musicStart,
    selectedAudioSegmentId, selectedMusicSegmentId, selectedSegmentId, selectedSegmentIndex, selectedStickerSegmentId,
    setAudioSegments, setCaptionSegments, setMusicSegments, setSelectedAudioSegmentId, setSelectedMusicSegmentId,
    selectedTrack, stickerSegments, t, trackLocks, visualSegments,
    visualOverlaySegments, selectedVisualOverlayId, setVisualOverlaySegments, setSelectedVisualOverlayId,
  });

  const { getTimelineTimeFromClientX, handlePlayToggle, pauseTimelineMedia, seekTo, startTimelineSeek } = createPlaybackControls({
    timelineMarkers, setSnapGuide,
    audioSegmentRefs, audioSegments, canPreview: canPreview || Boolean(compositionUrl), currentTimeRef, currentVisualRange,
    estimatedDuration, isPlaying, musicDuration, musicSegments, musicRef, musicStart, musicUrl, notify,
    linkedSourceAudioSegments, previewVideoRef, previewVisualType, setCurrentTime, setIsPlaying, setPreviewVideoMediaTime, sourceAudioDuration,
    sourceAudioLinked, compositionIframeRef, compositionUrl,
    sourceAudioRef, sourceAudioStart, sourceAudioUrl, sourceAudioVolume, sourceAudioSpatialEffect, sourceAudioSpatialAmount, timelineDuration,
    timelineDurationRef, trackScrollRef, trackVisibility, visualSegments, visualTimeline, previewVisualSegment,
    visualPlaybackLastUpdateRef, visualPlaybackStartedAtRef, visualPlaybackStartTimeRef,
  });
  const pauseForTimelineEdit = () => {
    if (!isPlaying) return;
    pauseTimelineMedia();
    setIsPlaying(false);
  };

  useMediaSync({
    audioRef, audioSegmentRefs, audioSegments, currentTime, currentTimeRef, estimatedDuration,
    isPlaying, musicDuration, musicSegments, musicRef, musicStart, musicUrl, musicVolume, pauseTimelineMedia, previewVideoRef,
    previewVisualSegment, previewVisualSourceTime, previewVisualSrc, previewVisualType,
    previewVisualRange,
    linkedSourceAudioSegments, setCurrentTime, setIsPlaying, setPreviewVideoMediaTime, sourceAudioDuration,
    sourceAudioLinked,
    sourceAudioRef, sourceAudioStart, sourceAudioUrl, sourceAudioVolume, sourceAudioSpatialEffect, sourceAudioSpatialAmount, timelineDuration,
    trackVisibility, visualPlaybackFrameRef, visualPlaybackLastUpdateRef,
    visualPlaybackStartedAtRef, visualPlaybackStartTimeRef,
  });

  const { startAudioSegmentMove, startMusicMove, startSourceAudioMove, startStickerSegmentMove, startStickerSegmentResize } = createTimelineMoveControls({
    timelineMarkers, timelineDuration,
    audioSegments, captionSegments, captionTargetDuration, estimatedDuration, notify, seekTo, setActiveTool,
    setAudioSegments, setCaptionSegments, setSelectedAudioSegmentId, setSelectedStickerId,
    setSelectedStickerSegmentId, setSelectedTrack, setStickerSegments, setTimelineHorizon,
    setMusicStart, setSelectedMusicSegmentId, setSelectedSourceAudioSegmentId, setSourceAudioLinked, setSourceAudioStart, musicDuration, musicSegments, musicStart, setMusicSegments,
    linkedSourceAudioSegments, sourceAudioDuration, sourceAudioLinked, sourceAudioStart, stickerSegments, suppressTimelineClipClickRef, t, timelineDurationRef,
    trackLocks, trackVisibility, trackScrollRef, pauseForTimelineEdit, visualSegments, setVisualSegments, visualOverlaySegments, currentTime, setSnapGuide, commitStickerSegments,
    setStickerTimelineDrag, moveSourceAudioToAudioLane, setSourceAudioDragTargetLane,
  });

  const startImageResize = createImageResizeControl({
    timelineMarkers,
    audioBlob, audioDuration, captionDuration, getCurrentVisualAssetSnapshot,
    imageDuration, imageSrc, musicBlob, musicDuration, musicStart, notify, rippleTimelineAfter, script,
    setCurrentTime, setImageClipCount, setImageDuration, setSelectedTrack,
    setSelectedVisualSegmentId, setSnapGuide, setVisualSegments, sourceAudioBlob,
    sourceAudioDuration, sourceAudioStart, timelineDuration, timelineDurationRef,
    setTimelineHorizon, t, trackLocks, trackScrollRef, visualSegments, pauseForTimelineEdit,
  });

  const extractVideoSourceAudio = useSourceAudioExtraction({
    clearSourceAudioTrack, notify, replaceSourceAudio, setProgress, setStatus, setStatusText,
    replaceAudio, setVisualOverlaySegments, setVisualSegments, sourceAudioBlob, sourceAudioDuration, t,
  });

  const generateCaptionsFromSourceAudio = useAutoCaptions({
    notify, script, seekTo, setActiveTool, setCaptionSegments, captionStyle,
    setCaptionsEnabled, setProgress, setScript, setSelectedSegmentId,
    setSelectedTrack, setStatus, setStatusText, setTrackVisibility, sourceAudioBlob,
    sourceAudioStart, status, t, trackLocks, uiLanguage,
  });

  const handleFiles = useFileUpload({
    appendVisualAssetToTimeline, imageUrlRefs, notify, setSelectedLibraryAssetId, setSelectedTrack, setUserAssets,
    updateVisualAssetInTimeline, visualSegments, t,
    onFirstVisualAutoAdded: requestFirstVisualGuide,
  });

  const { deleteUserAsset, selectAsset } = createAssetLibraryActions({
    clearImageTrack, clearMusicTrack, clearSourceAudioTrack, commitVisualSegments,
    extractVideoSourceAudio, getVisualDurationForAsset, imageSrc, imageUrlRefs,
    musicBlob, notify, removeVisionRecordsForAsset, replaceMusic, replaceVisualTimeline,
    selectedLibraryAssetId, setSelectedLibraryAssetId, setUserAssets, sourceAudioBlob,
    userAssets, visualSegments,
  });

  const { applyAssetToTrack, handleTrackAssetDrop, handleVisualStyleDrop } = createAssetDropActions({
    addStickerAssetToTimeline, addVisualOverlay: (...args) => addVisualOverlay(...args), appendVisualAssetToTimeline, canDropAssetOnTrack, clearImageTrack,
    draggedAssetIdRef, extractVideoSourceAudio, getDraggedAsset, getTimelineDropPercent, imageUrlRefs,
    notify, onFirstVisualDropped: requestFirstVisualGuide, replaceAudio, selectAsset, setActiveTool, setAssetDropPosition,
    setAssetDropTargetTrack, setDraggedAssetId, setSelectedFilterId,
    setSelectedLibraryAssetId, setSelectedTrack, setSelectedTransitionId,
    setSelectedVisualSegmentId, setVisualSegments, trackScrollRef, resolveVisualDropIntent, updateVisualAssetInTimeline,
    t, timelineDuration, triggerAssetDropPulse, visualSegments,
  });
  const addVisualOverlay = (asset, options = {}) => {
    if (!asset?.src || (asset.type !== "image" && asset.type !== "video")) return;
    const startTime = Number.isFinite(options.startTime)
      ? options.startTime
      : Number.isFinite(options.percent)
        ? options.percent / 100 * timelineDuration
        : currentTime;
    const targetLayer = Number.isFinite(Number(options.layer))
      ? Math.max(1, Number(options.layer))
      : visualOverlaySegments.length + 1;
    const overlay = createVisualOverlaySegment(asset, startTime, {
      layer: targetLayer,
      ...(Number.isFinite(Number(options.layer)) ? { lane: targetLayer - 1 } : {}),
    });
    setVisualOverlaySegments((items) => [...items, overlay]);
    setSelectedVisualOverlayId(overlay.id);
    setSelectedVisualSegmentId("");
    setSelectedTrack("overlay");
    notify("已添加为画中画，可在预览中拖动、缩放和旋转");
  };
  const updateVisualOverlayById = (overlayId, transform) => {
    if (!overlayId || trackLocks.overlay) return;
    setVisualOverlaySegments((items) => items.map((item) => {
      if (item.id !== overlayId) return item;
      const localTime = Math.max(0, currentTime - item.start);
      return item.keyframes?.length
        ? updateVisualOverlayTransform(item, localTime, transform)
        : { ...item, baseTransform: normalizeVisualTransform({ ...item.baseTransform, ...transform }) };
    }));
  };
  const updateSelectedVisualOverlay = (transform) => updateVisualOverlayById(selectedVisualOverlayId, transform);
  const updateSelectedVisualOverlayEffects = (change) => {
    const overlay = visualOverlaySegments.find((item) => item.id === selectedVisualOverlayId);
    if (!overlay || trackLocks.overlay) return;
    setVisualOverlaySegments((items) => items.map((item) => {
      if (item.id !== overlay.id) return item;
      if (Number.isFinite(change.playbackRate) && item.type === "video") return updateVisualSegmentPlaybackRate(item, change.playbackRate);
      if (change.baseTransform) return { ...item, baseTransform: normalizeVisualTransform({ ...item.baseTransform, ...change.baseTransform }) };
      if (change.keyframe) return { ...item, keyframes: upsertVisualKeyframe(item.keyframes, change.keyframe.time, change.keyframe) };
      if (change.propertyKeyframe) return { ...item, keyframes: upsertVisualPropertyKeyframe(item.keyframes, change.propertyKeyframe.time, change.propertyKeyframe.key, change.propertyKeyframe.value) };
      if (change.removePropertyKeyframe) return { ...item, keyframes: removeVisualPropertyKeyframe(item.keyframes, change.removePropertyKeyframe.time, change.removePropertyKeyframe.key) };
      if (Number.isFinite(change.removeKeyframeAt)) return { ...item, keyframes: (item.keyframes ?? []).filter((frame) => Math.abs(frame.time - change.removeKeyframeAt) > 0.04) };
      if (change.mask) return { ...item, mask: change.mask };
      if (change.animation) return { ...item, animation: change.animation };
      if (change.subjectEffect) return { ...item, subjectEffect: normalizeSubjectEffect(change.subjectEffect) };
      if (change.clickRipple) return { ...item, clickRipple: normalizeClickRippleEffect(change.clickRipple) };
      if (change.cinematicDepth) return { ...item, cinematicDepth: normalizeCinematicDepth(change.cinematicDepth) };
      if (change.photoParallax) return { ...item, photoParallax: normalizePhotoParallax(change.photoParallax) };
      if (change.timing) return { ...item, ...change.timing };
      if (typeof change.filterId === "string") return { ...item, filterId: change.filterId };
      return item;
    }));
  };

  const updateSelectedCinematicDepth = (nextEffect) => {
    const cinematicDepth = normalizeCinematicDepth(nextEffect);
    if (selectedTrack === "overlay" && selectedVisualOverlay) {
      updateSelectedVisualOverlayEffects({ cinematicDepth });
      return;
    }
    updateSelectedVisualEffects({ cinematicDepth });
  };
  const updateSelectedPhotoParallax = (nextEffect) => {
    const photoParallax = normalizePhotoParallax(nextEffect);
    if (selectedTrack === "overlay" && selectedVisualOverlay) {
      updateSelectedVisualOverlayEffects({ photoParallax });
      return;
    }
    updateSelectedVisualEffects({ photoParallax });
  };
  const depthTimelineStart = selectedTrack === "overlay" && selectedVisualOverlay
    ? selectedVisualOverlay.start || 0
    : selectedVisualRange?.start || 0;
  const cinematicDepth = useDepthOfFieldAnalysis({
    segment: selectedEffectSegment,
    depthRecords,
    setDepthRecords,
    updateEffect: updateSelectedCinematicDepth,
    onAssetReady: handleDepthMapAssetReady,
    isBlocked: () => { const blocked = webMcp.isAiRunning(); if (blocked) notify(webMcp.t("busy")); return blocked; },
    notify,
    setCurrentTime,
    timelineStart: depthTimelineStart,
    t,
  });
  const photoParallaxDepth = useDepthOfFieldAnalysis({
    segment: selectedEffectSegment,
    depthRecords,
    setDepthRecords,
    updateEffect: updateSelectedPhotoParallax,
    effectField: "photoParallax",
    isBlocked: () => { const blocked = webMcp.isAiRunning(); if (blocked) notify(webMcp.t("busy")); return blocked; },
    readyToastKey: "parallaxReadyToast",
    notify,
    setCurrentTime,
    timelineStart: depthTimelineStart,
    t,
  });
  const previewDepthRecord = previewVisionKey ? depthRecords[previewVisionKey] || null : null;
  const previewDepthAnalysis = resolveDepthAnalysisAtTime(previewDepthRecord, previewVisualSourceTime);
  const previewVisualOverlaysWithDepth = useMemo(() => previewVisualOverlays.map((overlay) => {
    const depthRecord = depthRecords[getVisionKey(overlay)];
    if (!depthRecord) return overlay;
    const localTime = Math.max(0, currentTime - (overlay.start || 0));
    const sourceTime = overlay.type === "video" ? getVisualSourceTime(overlay, localTime) : localTime;
    return { ...overlay, depthAnalysis: resolveDepthAnalysisAtTime(depthRecord, sourceTime) };
  }), [currentTime, depthRecords, previewVisualOverlays]);

  const { projectImportProgress, getProjectSnapshot, createCurrentArchive, handleExportProject, handleImportProject, handleNewProject, captureCompleteProject, prepareCompleteProject } = useProjectFiles({
    sourceVoiceColorOriginalRef,
    language: activeLanguage, pauseTimelineMedia, setIsPlaying,
    imageSrc, imageName, imageMeta, visualType, imageDuration, imageClipCount,
    audioUrl, musicUrl, sourceAudioUrl, userAssets, timelineHorizon, currentTime,
    selectedTrack, selectedSegmentId, selectedVisualSegmentId, selectedVisualOverlayId, selectedStickerSegmentId, selectedAudioSegmentId,
    captionStylePresetId, captionStylePresets,
    setCaptionStylePresetId, setCaptionStylePresets, setUserAssets, setSelectedTrack, setSelectedVisualSegmentId,
    setImageSrc, setImageName, setImageMeta, setVisualType, resetHistory, musicUrlRef, sourceAudioUrlRef,
    setMusicBlob, setMusicUrl, setMusicName, setMusicDuration, setMusicPeaks,
    setSourceAudioBlob, setSourceAudioUrl, setSourceAudioName, setSourceAudioDuration, setSourceAudioPeaks, setSourceAudioStart,
    timelineMarkers, setTimelineMarkers,
    audioBlob, audioDuration, audioSegments, captionPlacement, captionPosition, captionSegments, captionSize,
    captionStyle, captionsEnabled, captionStyleFallback: captionStyle, clearAllVisionState,
    clearAudioTrack, clearImageTrack, clearMusicTrack, clearSourceAudioTrack, fitMode,
    imageUrlRefs, musicBlob, musicDuration, musicName, musicSegments, musicStart, musicVolume, notify, projectFileInputRef,
    ratioId, replaceAudio, replaceMusic, replaceSourceAudio, script, selectedFilterId,
    selectedStickerId, selectedTransitionId, selectedVoiceId, setCaptionPlacement,
    setCaptionPosition, setCaptionSegments, setCaptionSize, setCaptionStyle, setCaptionsEnabled,
    setAudioSegments, setCurrentTime, setFitMode, setImageClipCount, setImageDuration, setMusicSegments, setMusicStart, setMusicVolume, setSelectedAudioSegmentId,
    setRatioId, setScript, setSelectedFilterId, setSelectedSegmentId, setSelectedStickerId,
    setSelectedStickerSegmentId, setSelectedTransitionId, setSelectedVoiceId, setShowFileMenu,
    setSourceAudioAssetId, setSourceAudioLinked, setSourceAudioVolume, setSourceAudioSpatialEffect, setSourceAudioSpatialAmount, setSpeed, setStickerSegments, setTimelineZoom, setTrackLocks, setTrackVisibility,
    setTimelineHorizon,
    setVisualSegments, setVisualOverlaySegments, setSelectedVisualOverlayId, setVolume, setCurrentVisualAsset, sourceAudioBlob, sourceAudioDuration,
    markTimelineViewRestored: (hasContent) => { timelineImportRestoreRef.current = hasContent; },
    sourceAudioAssetId, sourceAudioLinked, sourceAudioName, sourceAudioStart, sourceAudioVolume, sourceAudioSpatialEffect, sourceAudioSpatialAmount, speed, stickerSegments,
    timelineZoom, trackLocks, trackVisibility, visualSegments, visualOverlaySegments, volume,
  });
  const completeProject = useCompleteProject({ hostSession, language: activeLanguage, captureCompleteProject, prepareCompleteProject, handleNewProject, handleImportProject, projectFileInputRef, notify,
    isAnalysisBusy: () => isEditorBusy() || webMcp.isAiRunning() || (webMcp.execution.busy || webMcp.execution.hasPending) || generationPlugins.job.running,
    isEditorBusy: () => isEditorBusy() || webMcp.isAiRunning() || (webMcp.execution.busy || webMcp.execution.hasPending) || generationPlugins.job.running });

  const {
    activeTimelineClipDrag, audioClipPercent, displayedCaptionSegments,
    displayedCaptionTimeline, displayedVisualSegments, exportPercent, musicClipPercent, musicStartPercent,
    playheadPercent, previewFrameStyle, previewRatio, progressPercent,
    renderedVisualSegments, renderedVisualTimeline, showStickerTrack,
    sourceAudioClipPercent, sourceAudioStartPercent,
  } = useTimelineViewModel({
    assetDragPreview, assetDropTargetTrack, audioBlob, audioDuration, captionSegments,
    captionTargetDuration, captionTimeline, currentTime, draggedAssetId, exportProgress,
    findAssetById, getCurrentVisualAssetSnapshot, imageDuration, imageSrc, musicBlob,
    musicDuration, musicStart, previewFrameSize, progress, ratio, selectedTrack, sourceAudioBlob,
    linkedSourceAudioSegments, sourceAudioDuration, sourceAudioLinked, sourceAudioStart, stickerSegments, timelineClipDrag,
    timelineDuration, visualSegments,
  });
  const exportContentDuration = useMemo(() => getExportContentDuration({
    visualDuration: imageDuration,
    voiceDuration: voiceTrackDuration,
    captionDuration,
    sourceAudioDuration: sourceAudioBlob ? sourceAudioTimelineEnd : 0,
    musicDuration: musicBlob ? musicTimelineEnd : 0,
    stickerDuration,
    overlaySegments: visualOverlaySegments,
  }), [
    captionDuration, imageDuration, musicBlob, musicTimelineEnd, sourceAudioBlob,
    sourceAudioTimelineEnd, stickerDuration, visualOverlaySegments, voiceTrackDuration,
  ]);
  const videoCompositionContext = {
    audioSegments, captionDuration, captionPlacement, captionPosition, captionSegments, captionTargetDuration,
    captionSize, captionStyle, captionsEnabled, exporting, exportAbortControllerRef, exportStartRef, fitMode,
    imageDuration, imageSrc, musicBlob, musicDuration, musicSegments, musicStart, musicTimelineEnd, musicVolume, notify,
    previewFrameSize, ratio, renderedVisualSegments, script, selectedFilter,
    selectedSticker, selectedTransitionId, setExporting, setExportError, setExportPhase,
    setExportProgress, setStatus, setStatusText, sourceAudioBlob, sourceAudioDuration,
    linkedSourceAudioSegments, sourceAudioAssetId, sourceAudioLinked, sourceAudioStart, sourceAudioTimelineEnd, sourceAudioVolume, sourceAudioSpatialEffect, sourceAudioSpatialAmount, stickerDuration, stickerSegments,
    trackVisibility, visionRecords, depthRecords, visualType, voiceTrackDuration, volume, exportSettings: {
      ...exportSettings,
      ...getExportDimensions(ratio, Number(exportSettings.resolution)),
      videoBitsPerSecond: getEffectiveExportBitrate(exportSettings),
    },
    visualOverlaySegments, t, language: activeLanguage,
    compositionUrl, loadedProjectIdRef,
  };
  const handleExportVideo = useVideoExport(videoCompositionContext);
  const { startCaptionResize, startTimelineClipDrag } = createTimelineReorderControls({
    timelineMarkers,
    audioSegments, captionSegments, captionTargetDuration, commitCaptionSegments, commitVisualSegments, setAudioSegments,
    notify, renderedVisualSegments, seekTo, setSelectedSegmentId, setSelectedTrack,
    setSelectedVisualSegmentId, setTimelineClipDrag, suppressTimelineClipClickRef,
    timelineClipDragRef, timelineDuration, trackLocks, visualSegments, pauseForTimelineEdit,
    setTimelineHorizon,
    stickerSegments, sourceAudioDuration, sourceAudioStart, musicDuration, musicStart, musicSegments, currentTime, setSnapGuide,
    visualOverlaySegments, setVisualOverlaySegments, setSelectedVisualOverlayId, trackScrollRef,
  });

  // Browser agents use the live editor action and normal undo history.
  const getBrowserRuntimeProject = () => ({
    ...getProjectSnapshot(), visualSegments, visualOverlaySegments, audioSegments, musicSegments,
    musicBlob, musicUrl, musicPeaks, sourceAudioBlob, sourceAudioUrl, audioBlob, depthRecords,
  });
  const applyBrowserReview = (review, message) => {
    if (!review.hasChanges) throw Object.assign(new Error(), { code: "NO_CHANGES" });
    const snapshot = getProjectSnapshot();
    const runtime = getBrowserRuntimeProject();
    if (review.fingerprint !== browserProjectFingerprint(snapshot, rippleEditing, visualSegments, runtime)) {
      throw Object.assign(new Error(), { code: "BROWSER_EDIT_STALE_PLAN" });
    }
    const firstChanged = review.rows?.find((row) => row.changed);
    const next = restoreBrowserProjectMedia(review.project, runtime, review.mediaOrigins, userAssets);
    const nextVisuals = next.visualSegments;
    const visualsChanged = JSON.stringify(snapshot.visualSegments) !== JSON.stringify(review.project.visualSegments);
    checkpointHistory();
    // Reordering existing media keeps the reviewed canvas ratio. Auto-detection
    // remains available when the user uploads a new first source later.
    const ratioSource = nextVisuals.find((clip) => clip.width > 0 && clip.height > 0);
    if (ratioSource) autoRatioSourceKeyRef.current = `${ratioSource.assetId || ratioSource.id}:${ratioSource.width}x${ratioSource.height}`;
    pauseTimelineMedia();
    setIsPlaying(false);
    setScript(next.script);
    setAudioSegments(next.audioSegments);
    setCaptionSegments(next.captionSegments);
    setTimelineMarkers(next.timelineMarkers);
    setCaptionsEnabled(next.captionsEnabled);
    setCaptionStyle(next.captionStyle);
    setCaptionSize(next.captionSize);
    setCaptionStylePresetId(next.captionStylePresetId);
    setCaptionPlacement(next.captionPlacement);
    setCaptionPosition(next.captionPosition);
    setRatioId(next.ratioId);
    setFitMode(next.fitMode);
    setVisualOverlaySegments(next.visualOverlaySegments);
    setStickerSegments(next.stickerSegments);
    setMusicSegments(next.musicSegments);
    setMusicStart(next.musicStart);
    setMusicVolume(next.musicVolume);
    setMusicName(next.musicName || "");
    setMusicDuration(next.musicDuration || 0);
    if (next.musicBlob !== musicBlob) {
      const nextMusicUrl = next.musicUrl || (next.musicBlob ? URL.createObjectURL(next.musicBlob) : "");
      musicUrlRef.current = nextMusicUrl;
      setMusicBlob(next.musicBlob);
      setMusicUrl(nextMusicUrl);
      setMusicPeaks(next.musicPeaks || []);
    }
    setSourceAudioStart(next.sourceAudioStart);
    setTrackVisibility(next.trackVisibility);
    if (visualsChanged) {
      if (nextVisuals.length) commitVisualSegments(nextVisuals, message, firstChanged?.index ?? 0);
      else clearImageTrack(message);
    } else notify(message);
    const focusTime = Number.isFinite(review.focusTime) ? review.focusTime : firstChanged?.start ?? currentTime;
    const nextTime = Math.min(Math.max(0, focusTime), Math.max(0, review.duration));
    currentTimeRef.current = nextTime;
    setCurrentTime(nextTime);
  };
  const silenceRemoval = useSilenceRemoval({
    language: activeLanguage, selectedSegment: selectedVisualSegment, visualSegments, projectVersion: historySignature,
    locked: Boolean(trackLocks.image || sourceAudioBlob && sourceAudioLinked !== false && trackLocks.source),
    getSnapshot: getProjectSnapshot, getRuntime: getBrowserRuntimeProject,
    applyReview: applyBrowserReview, rippleEditing, setRippleEditing, seekTo, t,
  });
  const isEditorBusy = () => Boolean(projectImportProgress || exporting || timelineClipDragRef.current || pointerAssetDragRef.current ||
    isDragging || draggedAssetId || ["generating", "captioning"].includes(status) || visualSegments.some((clip) => clip.preparing) ||
    visualOverlaySegments.some((clip) => clip.preparing) || visionJob.running || avatarJob.running || autoEdit.job.running || cinematicDepth.job.running || photoParallaxDepth.job.running);
  const webMcp = useWebMcpEditor({
    language: activeLanguage, visualSegments, visualOverlaySegments, audioSegments, musicSegments,
    sourceAudioBlob, musicBlob, audioBlob, rippleEditing, getProjectSnapshot,
    assets: userAssets, getRuntimeProject: getBrowserRuntimeProject,
    scriptReview: completeProject?.scriptReview, completeProject,
    bindExecutionAsset: (id, mediaRef, projectId) => setUserAssets(items => items.map(item => item.id === id ? {
      ...item, assetId: mediaRef.entityId, projectMedia: { projectId, bindings: { blob: mediaRef } },
    } : item)),
    addExecutionAssets: items => {
      const assets = items.map(item => { const src = URL.createObjectURL(item.blob); imageUrlRefs.current.add(src); return { ...item, src, previewSrc: src }; });
      setUserAssets(current => [...assets, ...current]);
    },
    currentTime, duration: exportContentDuration, historySignature,
    createArchive: createCurrentArchive, download: downloadBlob, notify,
    exportVideo: handleExportVideo, exportSettings, exportContentDuration, ratio, exporting,
    applyReview: applyBrowserReview,
    sampleMedia: (input, options) => sampleEditorMedia(videoCompositionContext, input, options),
    runDepthTask: (request, execution) => cinematicDepth.analyze({
      output: request.kind === "depth-map" ? "depth-map" : "relight", quality: request.quality,
      inverted: request.inverted ?? false, reanalyze: request.reanalyze,
    }, { ...execution, onAssetReady: (draft) => {
      execution.validateSource();
      // Agent output stays in My assets until a separate reviewed insertion.
      const asset = handleDepthMapAssetReady(draft);
      return { id: asset.id, duration: asset.duration, width: asset.width, height: asset.height };
    } }),
    commitAiVoiceAssets: ({ items }, { signal } = {}) => {
      if (signal?.aborted) throw Object.assign(new Error("CANCELLED"), { name: "AbortError" });
      const assets = items.map((item) => {
        const id = crypto.randomUUID(); const src = URL.createObjectURL(item.blob);
        imageUrlRefs.current.add(src);
        return { id, type: "audio", kind: "voiceover", name: item.name, text: item.text,
          voiceId: item.voiceId, blob: item.blob, src, previewSrc: src, generated: true,
          duration: item.decoded.duration, peaks: item.decoded.peaks };
      });
      setUserAssets((current) => [...assets, ...current]);
      setActiveTool("media"); setMediaTab("mine");
      if (assets[0]) setSelectedLibraryAssetId(assets[0].id);
      return assets.map(({ id, duration }) => ({ id, duration }));
    },
    undo: () => { pauseTimelineMedia(); undo(); },
    seek: (time) => { pauseTimelineMedia(); setIsPlaying(false); seekTo(time, { immediate: true }); },
    isBusy: isEditorBusy,
  });

  const guardAgentAi = (action) => (...args) => {
    if (webMcp.isAiRunning()) { notify(webMcp.t("busy")); return; }
    return action(...args);
  };
  const generateVoiceoverWhenIdle = guardAgentAi(generateVoiceover);
  const generateCaptionsWhenIdle = guardAgentAi(generateCaptionsFromSourceAudio);

  // On-canvas typography and text editing callbacks
  const handleSelectCaptionSegment = useCallback((id) => {
    setSelectedSegmentId(id);
    setSelectedTrack("caption");
  }, [setSelectedSegmentId, setSelectedTrack]);

  const handleUpdateCaptionFont = useCallback((captionId, fontId) => {
    setCaptionSegments((items) =>
      items.map((item) => {
        if (item.id === captionId || captionId === "current") {
          return {
            ...item,
            fontId,
            style: {
              ...(item.style || {}),
              fontId,
            },
            styleOverrides: {
              ...(item.styleOverrides || {}),
              fontId,
            },
          };
        }
        return item;
      })
    );
    setCaptionStyle((prev) => ({ ...prev, fontId }));
    notify(`Font changed to ${fontId}`);
  }, [setCaptionSegments, setCaptionStyle, notify]);

  const handleUpdateCaptionSize = useCallback((captionId, deltaOrSize) => {
    setCaptionSegments((items) =>
      items.map((item) => {
        if (item.id === captionId || captionId === "current") {
          const currentSize = Number(item.size || item.captionSize || captionSize || 28);
          const newSize = typeof deltaOrSize === "number" && Math.abs(deltaOrSize) < 20
            ? Math.max(12, Math.min(140, currentSize + deltaOrSize))
            : Math.max(12, Math.min(140, Number(deltaOrSize) || currentSize));
          return {
            ...item,
            size: newSize,
            captionSize: newSize,
            styleOverrides: {
              ...(item.styleOverrides || {}),
              captionSize: newSize,
            },
          };
        }
        return item;
      })
    );
    if (typeof deltaOrSize === "number" && Math.abs(deltaOrSize) < 20) {
      setCaptionSize((prev) => Math.max(12, Math.min(140, (prev || 28) + deltaOrSize)));
    } else {
      setCaptionSize(Math.max(12, Math.min(140, Number(deltaOrSize) || 28)));
    }
  }, [captionSize, setCaptionSegments, setCaptionSize]);

  const handleUpdateCaptionColor = useCallback((captionId, color) => {
    setCaptionSegments((items) =>
      items.map((item) => {
        if (item.id === captionId || captionId === "current") {
          return {
            ...item,
            color,
            textColor: color,
            style: {
              ...(item.style || {}),
              textColor: color,
            },
            styleOverrides: {
              ...(item.styleOverrides || {}),
              textColor: color,
            },
          };
        }
        return item;
      })
    );
    setCaptionStyle((prev) => ({ ...prev, textColor: color }));
  }, [setCaptionSegments, setCaptionStyle]);

  const handleUpdateCaptionText = useCallback((captionId, newText) => {
    setCaptionSegments((items) =>
      items.map((item) => {
        if (item.id === captionId || captionId === "current") {
          return {
            ...item,
            text: newText,
          };
        }
        return item;
      })
    );
    notify("Text updated");
  }, [setCaptionSegments, notify]);

  const handleDeleteCaptionSegment = useCallback((captionId) => {
    setCaptionSegments((items) => items.filter((item) => item.id !== captionId));
    if (selectedSegmentId === captionId) {
      setSelectedSegmentId("");
    }
    notify("Text deleted");
  }, [selectedSegmentId, setCaptionSegments, setSelectedSegmentId, notify]);

  const handleAddTextSegment = useCallback((preset = {}) => {
    const newId = "text-" + Date.now();
    const start = Math.max(0, currentTime);
    const duration = 6;
    const newSegment = {
      id: newId,
      text: preset.text || "Heading",
      start,
      end: start + duration,
      duration,
      size: preset.size || 40,
      fontId: preset.fontId || "cinzel",
      color: preset.color || "#fff8e7",
      textColor: preset.color || "#fff8e7",
      style: {
        ...(captionStyle || {}),
        fontId: preset.fontId || "cinzel",
        textColor: preset.color || "#fff8e7",
        backgroundOpacity: 0,
      },
      styleOverrides: {
        fontId: preset.fontId || "cinzel",
        textColor: preset.color || "#fff8e7",
        captionSize: preset.size || 40,
      },
      placement: preset.placement || { x: 50, y: 50 },
    };
    setCaptionSegments((prev) => [...prev, newSegment]);
    setSelectedSegmentId(newId);
    setSelectedTrack("caption");
    setCaptionsEnabled(true);
    notify(`Added text with font: ${preset.fontId || "cinzel"}`);
  }, [currentTime, captionStyle, setCaptionSegments, setSelectedSegmentId, setSelectedTrack, setCaptionsEnabled, notify]);


  const saveProjectHtml = useCallback(async () => {
    const projectId = loadedProjectIdRef.current;
    const projectData = loadedProjectDataRef.current;
    if (!projectId || !projectData || !projectData.files) {
      notify("No HTML project loaded to save");
      return;
    }
    try {
      const res = await fetch(`/editor/project/${encodeURIComponent(projectId)}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: projectData.files,
        }),
      });
      if (res.ok) {
        notify("Project HTML saved successfully!");
      } else {
        notify("Failed to save project HTML");
      }
    } catch (err) {
      notify(`Save error: ${err.message}`);
    }
  }, [notify]);

  const updateElement = useCallback((id, changes) => {
    setProjectElements((prev) => {
      const target = prev.find((el) => el.id === id);
      if (target) {
        if (changes.placement) {
          changes.hasMoved = true;
        }
        if (changes.placement || changes.text !== undefined || changes.style) {
          changes.isModified = true;
        }

        // Live patch composition iframe via postMessage and direct DOM so text, styles, and placement update in real time
        if (compositionIframeRef.current?.contentWindow) {
          try {
            compositionIframeRef.current.contentWindow.postMessage({
              type: "HYPERLINK_ELEMENT_UPDATE",
              payload: {
                id: target.id,
                text: changes.text !== undefined ? changes.text : target.text,
                placement: changes.placement !== undefined ? changes.placement : target.placement,
                styles: changes.style ? {
                  fontFamily: changes.style.fontFamily || target.style?.fontFamily,
                  fontSize: changes.style.fontSize || target.style?.fontSize,
                  color: changes.style.color || target.style?.color,
                  textAlign: changes.style.textAlign || target.style?.textAlign,
                } : undefined,
              },
            }, "*");
          } catch(e) {}
        }

        if ((changes.text !== undefined || changes.placement !== undefined || changes.style !== undefined) && compositionIframeRef.current?.contentWindow) {
          try {
            const win = compositionIframeRef.current.contentWindow;
            const doc = win.document;
            let targetEl = null;

            // 1. Direct match by data-hf-id or id
            if (target.id) {
              targetEl = doc.querySelector(`[data-hf-id="${target.id}"], #${target.id}`);
              if (!targetEl) {
                const subIframes = doc.querySelectorAll("iframe");
                for (const sub of subIframes) {
                  try {
                    const subDoc = sub.contentDocument || sub.contentWindow?.document;
                    if (subDoc) {
                      targetEl = subDoc.querySelector(`[data-hf-id="${target.id}"], #${target.id}`);
                      if (targetEl) break;
                    }
                  } catch (e) {}
                }
              }
            }

            // 1b. Image match by src or tag
            if (!targetEl && (target.type === "image" || target.tag === "img")) {
              targetEl = doc.querySelector("img, .product-image, .feature-image, .scene-background");
            }

            if (!targetEl && target.sceneIndex !== undefined) {
              const sceneEl = doc.getElementById(`sc${target.sceneIndex}`) ||
                              doc.querySelector(`[data-scene="${target.sceneIndex + 1}"]`) ||
                              doc.getElementById(`scene${target.sceneIndex + 1}`) ||
                              doc.querySelectorAll(".scene, .ad-scene, section")[target.sceneIndex];
              if (sceneEl) {
                if (target.type === "image" || target.tag === "img") {
                  targetEl = sceneEl.querySelector("img, .product-image, .feature-image, .scene-background");
                } else if (target.field === "title" || target.tag === "h1" || target.tag === "h2" || target.tag === "h3" || target.type === "heading") {
                  targetEl = sceneEl.querySelector(".headline, .title.m, .mega.m, .big.m, .title, h1, h2, h3");
                } else if (target.field === "sub" || target.field === "subtitle" || target.field === "description" || target.tag === "p" || target.type === "text") {
                  targetEl = sceneEl.querySelector(".description, .sub.sb, .sub, p");
                } else if (target.field === "kicker" || target.field === "eyebrow") {
                  targetEl = sceneEl.querySelector(".eyebrow, .kicker.k, .kicker");
                } else if (target.field === "time" || target.field === "badge" || target.tag === "pill") {
                  targetEl = sceneEl.querySelector(".pill.k, .pill.k2, .pill, .scene-number, .date, .corner-mark, .bottom-label");
                } else if (target.field === "n" || target.tag === "num") {
                  targetEl = sceneEl.querySelector(".num.nm, .num, .scene-number");
                }
              }
            }

            // Fallback match by current text content
            if (!targetEl && (target.currentSavedText || target.text)) {
              const needle = (target.currentSavedText || target.text).trim().slice(0, 15);
              if (needle.length >= 2) {
                const candidates = doc.querySelectorAll(".headline, .title, .mega, .big, .description, .sub, .eyebrow, .kicker, .scene-number, .num, .corner-mark, .date, .bottom-label, .pill, h1, h2, h3, h4, p, span, button");
                for (const cand of candidates) {
                  if (cand.textContent && cand.textContent.includes(needle)) {
                    targetEl = cand;
                    break;
                  }
                }
              }
            }

            if (targetEl) {
              if (changes.placement) {
                const pl = changes.placement;
                targetEl.style.position = "absolute";
                if (pl.x !== undefined) targetEl.style.left = `${pl.x}%`;
                if (pl.y !== undefined) targetEl.style.top = `${pl.y}%`;
                targetEl.style.transform = pl.isTopLeft ? "none" : "translate(-50%, -50%)";
                if (pl.width) {
                  targetEl.style.width = typeof pl.width === "number" ? `${pl.width}px` : pl.width;
                }
                if (pl.height && target.tag !== "img") {
                  targetEl.style.height = typeof pl.height === "number" ? `${pl.height}px` : pl.height;
                }
              }
              if (changes.text !== undefined && target.tag !== "img") {
                if (target.field === "title" || target.tag === "h1") {
                  targetEl.innerHTML = typeof win.words === "function" ? win.words(changes.text) : (typeof win.split === "function" ? win.split(changes.text) : changes.text);
                } else {
                  targetEl.textContent = changes.text;
                }
              }
              if (changes.style) {
                if (changes.style.fontFamily) targetEl.style.fontFamily = changes.style.fontFamily;
                if (changes.style.color) targetEl.style.color = changes.style.color;
                if (changes.style.fontSize) targetEl.style.fontSize = typeof changes.style.fontSize === "number" ? changes.style.fontSize + "px" : changes.style.fontSize;
                if (changes.style.textAlign) targetEl.style.textAlign = changes.style.textAlign;
              }
            }
          } catch (e) {
            console.warn("Could not patch live composition iframe:", e);
          }
        }

        // Auto-save element placement/position modification to HTML file
        if (changes.placement && changes.hasMoved) {
          const projectData = loadedProjectDataRef.current;
          const projectId = loadedProjectIdRef.current;
          if (projectData && projectData.files && projectId) {
            try {
              let targetFile = target.file || "index.html";
              let fileContent = projectData.files[targetFile];
              if (!fileContent) {
                const candidate = Object.keys(projectData.files).find((f) => f.endsWith(".html"));
                if (candidate) {
                  targetFile = candidate;
                  fileContent = projectData.files[targetFile];
                }
              }
              if (fileContent && target.id) {
                const pl = changes.placement;
                const posStyles = `position: absolute; left: ${pl.x}%; top: ${pl.y}%;${pl.isTopLeft ? "" : " transform: translate(-50%, -50%);"}${pl.width ? ` width: ${pl.width}px;` : ""}`;
                const tagRegex = new RegExp(`(<[^>]+(?:data-hf-id|id)=["']${target.id}["'][^>]*)>`, "i");
                if (tagRegex.test(fileContent)) {
                  fileContent = fileContent.replace(tagRegex, (match, openTag) => {
                    if (openTag.includes('style="')) {
                      return openTag.replace(/style=["']([^"']*)["']/, `style="$1; ${posStyles}"`) + ">";
                    } else {
                      return `${openTag} style="${posStyles}">`;
                    }
                  });
                  projectData.files[targetFile] = fileContent;
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = setTimeout(() => {
                    fetch(`/editor/project/${encodeURIComponent(projectId)}/save`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        files: { [targetFile]: projectData.files[targetFile] },
                      }),
                    }).catch(() => {});
                  }, 600);
                }
              }
            } catch (err) {}
          }
        }

        // Auto-save modification to the project HTML file (index.html or compositions/scene_XX.html)
        if (changes.text !== undefined && changes.text !== target.text) {
          const projectData = loadedProjectDataRef.current;
          const projectId = loadedProjectIdRef.current;
          if (projectData && projectData.files && projectId) {
            try {
              const currentText = target.currentSavedText || target.text || target.originalText;
              const newText = changes.text;

              let targetFile = target.file || "index.html";
              let fileContent = projectData.files[targetFile];
              if (!fileContent) {
                const candidate = Object.keys(projectData.files).find((f) => f.endsWith(".html"));
                if (candidate) {
                  targetFile = candidate;
                  fileContent = projectData.files[targetFile];
                }
              }

              if (fileContent) {
                let replaced = false;

                // 1. Precise replacement by element data-hf-id or id
                if (target.id) {
                  const idRegex = new RegExp(`(<[^>]+(?:data-hf-id|id)=["']${target.id}["'][^>]*>)[\\s\\S]*?(<\\/[a-zA-Z0-9]+>)`, "i");
                  if (idRegex.test(fileContent)) {
                    fileContent = fileContent.replace(idRegex, `$1${newText}$2`);
                    replaced = true;
                  }
                }

                // 2. Direct string replacement
                if (!replaced && currentText && fileContent.includes(currentText)) {
                  fileContent = fileContent.replace(currentText, newText);
                  replaced = true;
                }

                // 3. Fuzzy match across <br> or tags
                if (!replaced && currentText) {
                  const words = currentText.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
                  if (words.length > 0) {
                    const fuzzyRegex = new RegExp(words.join("\\s*(?:<[^>]+>)?\\s*"), "i");
                    if (fuzzyRegex.test(fileContent)) {
                      fileContent = fileContent.replace(fuzzyRegex, newText);
                      replaced = true;
                    }
                  }
                }

                if (replaced) {
                  projectData.files[targetFile] = fileContent;
                  target.currentSavedText = newText;
                  target.file = targetFile;

                  // Debounce save request
                  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                  saveTimeoutRef.current = setTimeout(() => {
                    fetch(`/editor/project/${encodeURIComponent(projectId)}/save`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        files: {
                          [targetFile]: projectData.files[targetFile],
                        },
                      }),
                    })
                      .then((res) => {
                        if (res.ok) {
                          notify(`Saved to ${targetFile}: "${newText.slice(0, 24)}"`);
                        }
                      })
                      .catch((e) => console.warn("Save failed:", e));
                  }, 500);
                }
              }
            } catch (err) {
              console.warn("Failed to patch project HTML:", err);
            }
          }
        }
      }

      return prev.map((el) => {
        if (el.id !== id) return el;
        const updated = { ...el, ...changes };
        if (changes.style) updated.style = { ...el.style, ...changes.style };
        if (changes.placement) updated.placement = { ...el.placement, ...changes.placement };
        return updated;
      });
    });
  }, [notify]);

  const deleteElement = useCallback((id) => {
    setProjectElements((prev) => {
      const target = prev.find((el) => el.id === id);
      if (target) {
        // Clear text in composition iframe directly
        if (compositionIframeRef.current?.contentWindow) {
          try {
            const win = compositionIframeRef.current.contentWindow;
            const doc = win.document;
            let targetEl = null;

            if (target.sceneIndex !== undefined) {
              const sceneEl = doc.getElementById(`sc${target.sceneIndex}`) ||
                              doc.querySelector(`[data-scene="${target.sceneIndex + 1}"]`) ||
                              doc.getElementById(`scene${target.sceneIndex + 1}`) ||
                              doc.querySelectorAll(".scene")[target.sceneIndex];
              if (sceneEl) {
                if (target.field === "title" || target.tag === "h1" || target.type === "heading") {
                  targetEl = sceneEl.querySelector(".headline, .title.m, .mega.m, .big.m, .title, h1, h2, h3");
                } else if (target.field === "sub" || target.field === "subtitle" || target.field === "description" || target.tag === "p" || target.type === "text") {
                  targetEl = sceneEl.querySelector(".description, .sub.sb, .sub, p");
                } else if (target.field === "kicker" || target.field === "eyebrow") {
                  targetEl = sceneEl.querySelector(".eyebrow, .kicker.k, .kicker");
                } else if (target.field === "time" || target.field === "badge" || target.tag === "pill") {
                  targetEl = sceneEl.querySelector(".pill.k, .pill.k2, .pill, .scene-number, .date, .corner-mark, .bottom-label");
                } else if (target.field === "n" || target.tag === "num") {
                  targetEl = sceneEl.querySelector(".num.nm, .num, .scene-number");
                }
              }
            }

            if (!targetEl && (target.currentSavedText || target.text)) {
              const needle = (target.currentSavedText || target.text).trim().slice(0, 15);
              if (needle.length >= 2) {
                const candidates = doc.querySelectorAll(".headline, .title, .mega, .big, .description, .sub, .eyebrow, .kicker, .scene-number, .num, .corner-mark, .date, .bottom-label, .pill, h1, h2, h3, h4, p, span, button");
                for (const cand of candidates) {
                  if (cand.textContent && cand.textContent.includes(needle)) {
                    targetEl = cand;
                    break;
                  }
                }
              }
            }

            if (targetEl) {
              targetEl.innerHTML = "";
            }
          } catch (e) {
            console.warn("Could not patch live composition iframe on delete:", e);
          }
        }

        // Erase text from index.html if it's an in-video element
        const projectData = loadedProjectDataRef.current;
        const projectId = loadedProjectIdRef.current;
        if (projectData && projectData.files && projectData.files["index.html"] && projectId) {
          try {
            let indexHtml = projectData.files["index.html"];
            const currentText = target.currentSavedText || target.text || target.originalText;
            if (currentText && currentText.trim() && indexHtml.includes(currentText)) {
              indexHtml = indexHtml.replace(currentText, "");
              projectData.files["index.html"] = indexHtml;
              fetch(`/editor/project/${encodeURIComponent(projectId)}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  files: { "index.html": indexHtml },
                }),
              }).catch(() => {});
            }
          } catch (e) {}
        }
      }
      return prev.filter((el) => el.id !== id);
    });
    setSelectedElementId((curr) => (curr === id ? null : curr));
    notify("Deleted element");
  }, [notify]);

  // Keyboard Delete / Backspace shortcut for selected element
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = e.target instanceof HTMLElement && (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      );
      if (isInput) return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedElementId) {
        e.preventDefault();
        e.stopPropagation();
        deleteElement(selectedElementId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementId, deleteElement]);

  const duplicateElement = useCallback((id) => {
    setProjectElements((prev) => {
      const target = prev.find((el) => el.id === id);
      if (!target) return prev;
      const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const duplicated = {
        ...target,
        id: newId,
        name: `${target.name || "Element"} (Copy)`,
        placement: {
          ...target.placement,
          x: Math.min(90, (target.placement?.x || 50) + 4),
          y: Math.min(90, (target.placement?.y || 50) + 4),
        },
      };
      setSelectedElementId(newId);
      return [...prev, duplicated];
    });
  }, []);

  const addElement = useCallback((type = "heading", initialProps = {}) => {
    const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let newElement = {
      id: newId,
      sceneStart: 0,
      sceneDuration: 40,
      visible: true,
      ...initialProps,
    };

    if (type === "heading") {
      newElement = {
        ...newElement,
        tag: "h1",
        type: "heading",
        name: "H1: Headline",
        text: initialProps.text || "Heading Text",
        style: {
          fontFamily: initialProps.fontFamily || "Cinzel",
          fontSize: 48,
          color: initialProps.color || "#ffffff",
          textAlign: "center",
          opacity: 1,
        },
        placement: initialProps.placement || { x: 50, y: 35 },
      };
    } else if (type === "text") {
      newElement = {
        ...newElement,
        tag: "p",
        type: "text",
        name: "P: Subtitle",
        text: initialProps.text || "Subtitle Description",
        style: {
          fontFamily: initialProps.fontFamily || "Outfit",
          fontSize: 24,
          color: initialProps.color || "#cbd5e1",
          textAlign: "center",
          opacity: 0.9,
        },
        placement: initialProps.placement || { x: 50, y: 55 },
      };
    } else if (type === "image") {
      newElement = {
        ...newElement,
        tag: "img",
        type: "image",
        name: initialProps.name || "Graphic Image",
        src: initialProps.src || "/assets/sample-portrait.png",
        style: { opacity: 1, borderRadius: "8px" },
        placement: initialProps.placement || { x: 50, y: 50, width: 260, height: 260 },
      };
    } else if (type === "button") {
      newElement = {
        ...newElement,
        tag: "button",
        type: "button",
        name: "CTA Button",
        text: initialProps.text || "Get Started",
        style: {
          fontFamily: "Outfit",
          fontSize: 18,
          color: "#ffffff",
          backgroundColor: "#0ea5e9",
          textAlign: "center",
          opacity: 1,
        },
        placement: initialProps.placement || { x: 50, y: 75, width: 200, height: 50 },
      };
    }

    setProjectElements((prev) => [...prev, newElement]);
    setSelectedElementId(newId);
    setActiveTool("elements");
  }, [setActiveTool]);

  // Auto-connect project video and interactive elements from URL search params or postMessage
  const autoLoadedVideoRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;

    const extractElementsFromProject = (data, dur, fallbackTitle, fallbackPrompt) => {
      const extracted = [];
      const totalDur = Number(dur) || 40;
      const indexHtml = data?.files?.["index.html"] || "";

      // 1. Try parsing JavaScript SCENES array if present in index.html (e.g. London)
      const scriptMatch = indexHtml.match(/(?:const|let|var)\s+(?:SCENES|scenes)\s*=\s*(\[[\s\S]*?\]);/i);
      if (scriptMatch) {
        try {
          const scenesArrStr = scriptMatch[1];
          const constsMatch = indexHtml.match(/const\s+([A-Z_0-9,\s=.]+);/);
          const constsCode = constsMatch ? constsMatch[0] : "const DAY_CARD=3, STOP=3.6, INTRO=6, OVERVIEW=4, OUTRO=8.6;";
          const evalFn = new Function(constsCode + "; return " + scenesArrStr + ";");
          const parsed = evalFn();
          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && (parsed[0].title || parsed[0].kicker || parsed[0].sub || parsed[0].headline)) {
            let runningStart = 0;
            parsed.forEach((s, idx) => {
              const scDur = Number(s.dur) || Number(s.duration) || 3.5;
              const scStart = (typeof s.start === "number" && !isNaN(s.start)) ? s.start : runningStart;
              runningStart = scStart + scDur;
              const scId = `scene_${idx + 1}`;
              const isStop = s.type === "stop";
              const isIntro = s.type === "intro";
              const isDay = s.type === "day";

              // Kicker / Eyebrow (e.g. "Your next great escape", "Day one")
              if (s.kicker && s.kicker.trim()) {
                const kickerText = s.kicker.replace(/<[^>]+>/g, "").trim();
                extracted.push({
                  id: `el-${scId}-kicker`,
                  sceneId: scId,
                  sceneIndex: idx,
                  field: "kicker",
                  sceneStart: scStart,
                  sceneDuration: scDur,
                  tag: "kicker",
                  type: "badge",
                  name: `Kicker: ${kickerText}`,
                  text: kickerText,
                  originalText: kickerText,
                  isModified: false,
                  style: {
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 22,
                    color: "#e8c27a",
                    textAlign: (isStop || isDay) ? "left" : "center",
                    letterSpacing: "0.4em",
                  },
                  placement: (isStop || isDay)
                    ? { x: 7.3, y: 22, width: 350, height: 40, isTopLeft: true }
                    : { x: 50, y: 34, width: 500, height: 42, isTopLeft: false },
                  visible: true,
                });
              }

              // Time badge / pill (e.g. "9:00 AM", "6:30 PM")
              if (s.time && s.time.trim()) {
                const timeText = s.time.replace(/<[^>]+>/g, "").trim();
                extracted.push({
                  id: `el-${scId}-time`,
                  sceneId: scId,
                  sceneIndex: idx,
                  field: "time",
                  sceneStart: scStart,
                  sceneDuration: scDur,
                  tag: "pill",
                  type: "badge",
                  name: `Time: ${timeText}`,
                  text: timeText,
                  originalText: timeText,
                  isModified: false,
                  style: {
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 22,
                    color: "#e8c27a",
                    textAlign: "left",
                    letterSpacing: "0.2em",
                  },
                  placement: { x: 7.3, y: 44, width: 220, height: 50, isTopLeft: true },
                  visible: true,
                });
              }

              // Number badge (e.g. "01", "02", "1")
              if (s.n !== undefined && String(s.n).trim()) {
                const nText = String(s.n).replace(/<[^>]+>/g, "").trim();
                extracted.push({
                  id: `el-${scId}-num`,
                  sceneId: scId,
                  sceneIndex: idx,
                  field: "n",
                  sceneStart: scStart,
                  sceneDuration: scDur,
                  tag: "num",
                  type: "badge",
                  name: `Number: ${nText}`,
                  text: nText,
                  originalText: nText,
                  isModified: false,
                  style: {
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 140,
                    color: "rgba(246,239,227,0.28)",
                    textAlign: "right",
                  },
                  placement: { x: 88, y: 50, width: 180, height: 180, isTopLeft: false },
                  visible: true,
                });
              }

              // Title / Headline (e.g. "LONDON", "Westminster & Big Ben")
              if (s.title && s.title.trim()) {
                const titleText = s.title.replace(/<[^>]+>/g, "").trim();
                const titlePlacement = isIntro
                  ? { x: 50, y: 50, width: 850, height: 160, isTopLeft: false }
                  : isStop
                  ? { x: 7.3, y: 52, width: 750, height: 260, isTopLeft: true }
                  : isDay
                  ? { x: 7.3, y: 34, width: 650, height: 380, isTopLeft: true }
                  : { x: 50, y: 50, width: 750, height: 120, isTopLeft: false };
                extracted.push({
                  id: `el-${scId}-h1`,
                  sceneId: scId,
                  sceneIndex: idx,
                  field: "title",
                  sceneStart: scStart,
                  sceneDuration: scDur,
                  tag: "h1",
                  type: "heading",
                  name: `Title: ${titleText}`,
                  text: titleText,
                  originalText: titleText,
                  isModified: false,
                  style: {
                    fontFamily: isIntro ? "'Bebas Neue', sans-serif" : "'Playfair Display', serif",
                    fontSize: isIntro ? 100 : isStop ? 58 : 52,
                    color: "#f6efe3",
                    textAlign: (isStop || isDay) ? "left" : "center",
                    fontWeight: isIntro ? 400 : 700,
                  },
                  placement: titlePlacement,
                  visible: true,
                });
              }

              // Subtitle / Description (e.g. "3 Days · 2 Nights")
              if (s.sub && s.sub.trim()) {
                const subText = s.sub.replace(/<[^>]+>/g, "").trim();
                const subPlacement = isIntro
                  ? { x: 50, y: 66, width: 650, height: 50, isTopLeft: false }
                  : isStop
                  ? { x: 7.3, y: 80, width: 750, height: 60, isTopLeft: true }
                  : isDay
                  ? { x: 7.3, y: 78, width: 750, height: 60, isTopLeft: true }
                  : { x: 50, y: 68, width: 650, height: 50, isTopLeft: false };
                extracted.push({
                  id: `el-${scId}-p`,
                  sceneId: scId,
                  sceneIndex: idx,
                  field: "sub",
                  sceneStart: scStart,
                  sceneDuration: scDur,
                  tag: "p",
                  type: "text",
                  name: `P: ${subText.slice(0, 24)}...`,
                  text: subText,
                  originalText: subText,
                  isModified: false,
                  style: {
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 24,
                    color: "#f6efe3",
                    textAlign: (isStop || isDay) ? "left" : "center",
                    fontWeight: 300,
                  },
                  placement: subPlacement,
                  visible: true,
                });
              }

              // Outro CTA button
              if (s.type === "outro") {
                const ctaText = "Your adventure starts now";
                extracted.push({
                  id: `el-${scId}-cta`,
                  sceneId: scId,
                  sceneIndex: idx,
                  field: "cta",
                  sceneStart: scStart,
                  sceneDuration: scDur,
                  tag: "pill",
                  type: "button",
                  name: `CTA: ${ctaText}`,
                  text: ctaText,
                  originalText: ctaText,
                  isModified: false,
                  style: {
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 22,
                    color: "#e8c27a",
                    textAlign: "center",
                  },
                  placement: { x: 50, y: 82, width: 420, height: 50, isTopLeft: false },
                  visible: true,
                });
              }
            });

            // HUD overlay item (e.g. London, 3D · 2N)
            extracted.push({
              id: "el-hud-label",
              sceneId: "global-hud",
              sceneStart: 0,
              sceneDuration: totalDur,
              field: "hudLabel",
              tag: "hud",
              type: "badge",
              name: "HUD: London",
              text: "London",
              originalText: "London",
              isModified: false,
              style: {
                fontFamily: "'Inter', sans-serif",
                fontSize: 20,
                color: "#f6efe3",
                letterSpacing: "0.3em",
              },
              placement: { x: 10, y: 92, width: 140, height: 30, isTopLeft: true },
              visible: true,
            });

            return extracted;
          }
        } catch (e) {
          console.warn("Error parsing programmatic SCENES:", e);
        }
      }

      // 2. Parse HTML DOM elements (for Kerala, Delhi, Karnataka, and all semantic HyperFrames HTML)
      if (indexHtml) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(indexHtml, "text/html");
          const sceneSections = Array.from(doc.querySelectorAll("section.scene, .scene, .ad-scene, section[data-scene], section[data-start], div.scene"));

          if (sceneSections.length > 0) {
            const perSceneDur = totalDur / sceneSections.length;
            let runningStart = 0;

            sceneSections.forEach((sceneEl, idx) => {
              const scStart = Number(sceneEl.getAttribute("data-start")) || runningStart;
              const scDur = Number(sceneEl.getAttribute("data-duration")) || perSceneDur;
              runningStart = scStart + scDur;
              const scId = sceneEl.id || `scene-${idx + 1}`;

              // Query all image elements in this scene
              const imgNodes = sceneEl.querySelectorAll("img:not([hidden]), .product-image, .feature-image");
              imgNodes.forEach((imgNode, imgIdx) => {
                const src = imgNode.getAttribute("src");
                if (!src) return;
                const realId = imgNode.getAttribute("data-hf-id") || imgNode.id || `el-${scId}-img-${imgIdx}`;
                const alt = imgNode.getAttribute("alt") || src.split("/").pop()?.split("?")[0] || "Image";
                extracted.push({
                  id: realId,
                  sceneId: scId,
                  sceneIndex: idx,
                  field: "image",
                  tag: "img",
                  type: "image",
                  name: `Image: ${alt.slice(0, 20)}`,
                  text: alt,
                  src: src,
                  sceneStart: scStart,
                  sceneDuration: scDur,
                  isModified: false,
                  style: {
                    objectFit: "contain",
                  },
                  placement: { x: 50, y: 50, width: 400, height: 300, isTopLeft: false },
                  visible: true,
                });
              });

              // Query all textual elements in this scene
              const textNodes = sceneEl.querySelectorAll(
                "h1, h2, h3, h4, p, .headline, .title, .mega, .big, .description, .sub, .subtitle, .eyebrow, .kicker, .scene-number, .num, .corner-mark, .date, .bottom-label, .pill, button, a"
              );

              const seenTexts = new Set();
              textNodes.forEach((node, nodeIdx) => {
                // Avoid capturing parent elements whose text is already captured by children
                if (node.querySelector("h1, h2, h3, p, .headline, .description")) return;

                const rawText = node.textContent?.replace(/\s+/g, " ").trim();
                if (!rawText || seenTexts.has(rawText)) return;
                seenTexts.add(rawText);

                const tag = node.tagName.toLowerCase();
                const cls = (node.className || "").toLowerCase();

                let field = "text";
                let type = "text";
                let fontSize = 24;
                let fontWeight = 400;

                if (tag === "h1" || tag === "h2" || tag === "h3" || cls.includes("headline") || cls.includes("title") || cls.includes("mega") || cls.includes("big")) {
                  field = "title";
                  type = "heading";
                  fontSize = tag === "h1" ? 64 : 48;
                  fontWeight = 700;
                } else if (cls.includes("description") || cls.includes("sub") || tag === "p") {
                  field = "description";
                  type = "text";
                  fontSize = 24;
                  fontWeight = 300;
                } else if (cls.includes("eyebrow") || cls.includes("kicker")) {
                  field = "eyebrow";
                  type = "badge";
                  fontSize = 20;
                  fontWeight = 600;
                } else if (cls.includes("scene-number") || cls.includes("num") || cls.includes("number")) {
                  field = "number";
                  type = "badge";
                  fontSize = 18;
                } else if (cls.includes("corner-mark") || cls.includes("date") || cls.includes("bottom-label") || cls.includes("pill") || cls.includes("badge")) {
                  field = "badge";
                  type = "badge";
                  fontSize = 16;
                } else if (tag === "button" || cls.includes("cta") || cls.includes("btn")) {
                  field = "button";
                  type = "button";
                  fontSize = 18;
                }

                const realId = node.getAttribute("data-hf-id") || node.id || `el-${scId}-${field}-${nodeIdx}`;
                let placement = { x: 9, y: 50, width: 500, height: 60, isTopLeft: true };
                if (field === "eyebrow") {
                  placement = { x: 9, y: 48, width: 600, height: 40, isTopLeft: true };
                } else if (field === "title") {
                  placement = { x: 9, y: 56, width: 850, height: 160, isTopLeft: true };
                } else if (field === "description") {
                  placement = { x: 9, y: 76, width: 750, height: 80, isTopLeft: true };
                } else if (field === "number") {
                  placement = { x: 88, y: 88, width: 120, height: 40, isTopLeft: false };
                }

                extracted.push({
                  id: realId,
                  sceneId: scId,
                  sceneIndex: idx,
                  field,
                  tag,
                  type,
                  name: `${field.toUpperCase()}: ${rawText.slice(0, 20)}`,
                  text: rawText,
                  originalText: rawText,
                  sceneStart: scStart,
                  sceneDuration: scDur,
                  isModified: false,
                  style: {
                    fontFamily: (field === "title" || tag === "h1") ? "Georgia, 'Times New Roman', serif" : "'Inter', sans-serif",
                    fontSize,
                    fontWeight,
                    color: field === "eyebrow" ? "#d8bd72" : "#ffffff",
                    textAlign: "left",
                  },
                  placement,
                  visible: true,
                });
              });
            });

            if (extracted.length > 0) return extracted;
          }
        } catch (e) {
          console.warn("DOMParser failed for index.html:", e);
        }
      }

      // 2c. Fallback leaf regex extraction across index.html (guarantees all scenes are extracted)
      if (extracted.length === 0 && indexHtml) {
        const leafRegex = /<(h[1-6]|p|span|button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
        const leafMatches = [...indexHtml.matchAll(leafRegex)];
        const allScenes = (indexHtml.match(/<section[^>]*class=["'][^"']*scene/gi) || []);
        const numScenes = Math.max(1, allScenes.length);
        const perScene = totalDur / numScenes;

        leafMatches.forEach((m, idx) => {
          const tag = m[1].toLowerCase();
          const attrs = m[2];
          const inner = m[3];
          if (/<(?:h[1-6]|p|div|section)/i.test(inner)) return;
          const clean = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (!clean || clean.length < 2) return;

          const idM = attrs.match(/data-hf-id=["']([^"']+)["']/i) || attrs.match(/id=["']([^"']+)["']/i);
          const id = idM ? idM[1] : `leaf-${idx}`;
          const isH = tag.startsWith("h") || /headline|title/i.test(attrs);
          const isEyebrow = /eyebrow|kicker/i.test(attrs);
          const isNum = /scene-number|num/i.test(attrs);
          const scIdx = Math.min(numScenes - 1, Math.floor(idx / 4));

          extracted.push({
            id,
            sceneId: `scene-${scIdx + 1}`,
            sceneIndex: scIdx,
            tag,
            type: isH ? "heading" : (isEyebrow || isNum ? "badge" : "text"),
            name: (isH ? "Title: " : isEyebrow ? "Eyebrow: " : isNum ? "Number: " : "Text: ") + clean.slice(0, 24),
            text: clean,
            originalText: clean,
            sceneStart: scIdx * perScene,
            sceneDuration: perScene,
            isModified: false,
            style: {
              fontFamily: isH ? "Georgia, 'Times New Roman', serif" : "'Inter', sans-serif",
              fontSize: isH ? 64 : (isEyebrow ? 18 : 22),
              fontWeight: isH ? 700 : (isEyebrow ? 600 : 400),
              color: isEyebrow ? "#d8bd72" : "#ffffff",
              textAlign: "left",
            },
            placement: isH ? { x: 9, y: 56, width: 850, height: 160, isTopLeft: true }
              : isEyebrow ? { x: 9, y: 48, width: 600, height: 40, isTopLeft: true }
              : isNum ? { x: 88, y: 88, width: 120, height: 40, isTopLeft: false }
              : { x: 9, y: 76, width: 750, height: 80, isTopLeft: true },
            visible: true,
          });
        });

        if (extracted.length > 0) return extracted;
      }

      // 2b. Parse Subcomposition HTML files (e.g. compositions/scene_01.html, etc.)
      if (data?.files) {
        const compFileKeys = Object.keys(data.files).filter((f) => f.startsWith("compositions/") && f.endsWith(".html")).sort();
        if (compFileKeys.length > 0) {
          const perCompDur = totalDur / compFileKeys.length;
          let runningStart = 0;

          compFileKeys.forEach((relPath, idx) => {
            const compHtml = data.files[relPath];
            if (!compHtml) return;

            const matchingScene = Array.isArray(data?.scenes)
              ? data.scenes.find((s) => s.file === relPath || s.id === `scene-${idx + 1}` || s.id === `scene_${idx + 1}`)
              : null;

            const scStart = matchingScene ? Number(matchingScene.start) : runningStart;
            const scDur = matchingScene ? Number(matchingScene.duration) : perCompDur;
            runningStart = scStart + scDur;
            const scId = matchingScene?.id || `scene-${idx + 1}`;

            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(compHtml, "text/html");
              const textNodes = doc.querySelectorAll(
                "h1, h2, h3, h4, p, .headline, .hero-headline, .title, .mega, .big, .description, .hero-subtitle, .sub, .subtitle, .eyebrow, .kicker, .scene-number, .num, .corner-mark, .date, .bottom-label, .pill, .badge-pill, button, a"
              );

              const seenTexts = new Set();
              textNodes.forEach((node, nodeIdx) => {
                if (node.querySelector("h1, h2, h3, p, .headline, .description")) return;
                const rawText = node.textContent?.replace(/\s+/g, " ").trim();
                if (!rawText || seenTexts.has(rawText)) return;
                seenTexts.add(rawText);

                const tag = node.tagName.toLowerCase();
                const cls = (node.className || "").toLowerCase();

                let field = "text";
                let type = "text";
                let fontSize = 24;
                let fontWeight = 400;

                if (tag === "h1" || tag === "h2" || tag === "h3" || cls.includes("headline") || cls.includes("title") || cls.includes("mega") || cls.includes("big")) {
                  field = "title";
                  type = "heading";
                  fontSize = tag === "h1" ? 64 : 48;
                  fontWeight = 700;
                } else if (cls.includes("description") || cls.includes("sub") || tag === "p") {
                  field = "description";
                  type = "text";
                  fontSize = 24;
                  fontWeight = 300;
                } else if (cls.includes("eyebrow") || cls.includes("kicker")) {
                  field = "eyebrow";
                  type = "badge";
                  fontSize = 20;
                  fontWeight = 600;
                } else if (cls.includes("scene-number") || cls.includes("num") || cls.includes("number")) {
                  field = "number";
                  type = "badge";
                  fontSize = 18;
                } else if (cls.includes("corner-mark") || cls.includes("date") || cls.includes("bottom-label") || cls.includes("pill") || cls.includes("badge")) {
                  field = "badge";
                  type = "badge";
                  fontSize = 16;
                } else if (tag === "button" || cls.includes("cta") || cls.includes("btn")) {
                  field = "button";
                  type = "button";
                  fontSize = 18;
                }

                extracted.push({
                  id: `el-${scId}-${field}-${nodeIdx}`,
                  sceneId: scId,
                  sceneIndex: idx,
                  file: relPath,
                  field,
                  tag,
                  type,
                  name: `${field.toUpperCase()}: ${rawText.slice(0, 20)}`,
                  text: rawText,
                  originalText: rawText,
                  sceneStart: scStart,
                  sceneDuration: scDur,
                  isModified: false,
                  style: {
                    fontFamily: "'Inter', sans-serif",
                    fontSize,
                    fontWeight,
                    color: "#ffffff",
                    textAlign: "left",
                  },
                  placement: {
                    x: 10,
                    y: 20 + (nodeIdx * 12) % 65,
                    width: 500,
                    height: 60,
                    isTopLeft: true,
                  },
                  visible: true,
                });
              });
            } catch (err) {
              console.warn(`Failed to parse subcomposition ${relPath}:`, err);
            }
          });

          if (extracted.length > 0) return extracted;
        }
      }

      // 3. Fallback from data.scenes or editableProperties
      if (Array.isArray(data?.scenes) && data.scenes.length > 0) {
        data.scenes.forEach((sc, i) => {
          if (sc.headline && sc.headline.trim()) {
            extracted.push({
              id: `el-fallback-${i}-title`,
              sceneId: `scene-${i + 1}`,
              sceneIndex: i,
              sceneStart: Number(sc.start) || 0,
              sceneDuration: Number(sc.duration) || 4,
              tag: "h1",
              type: "heading",
              name: `Title: ${sc.headline.trim()}`,
              text: sc.headline.trim(),
              originalText: sc.headline.trim(),
              isModified: false,
              style: { fontFamily: "'Cinzel', serif", fontSize: 48, color: "#ffffff", textAlign: "center" },
              placement: { x: 50, y: 48, width: 700, height: 100 },
              visible: true,
            });
          }
        });
      }


      return extracted;
    };

    const loadProjectFromSource = (payload) => {
      let { videoUrl, title, duration, prompt, overlays, projectId } = payload;
      const targetProjId = projectId || payload.projectId || projectParam || "default_reference_video_2";
      const dur = Number(duration) && Number(duration) > 0 ? Number(duration) : 40;
      const projectTitle = title || "Project Video";
      const assetId = "video-source-" + (targetProjId || Date.now());

      // All projects in the editor are HyperFrames HTML compositions.
      // Always initialize in composition mode so the user can interactively select,
      // inspect, and edit every element on the live video canvas.
      const isKarnataka =
        targetProjId === "default_reference_video" ||
        targetProjId === "m57372k27qxvfy1z6zzrh37yrh8gs7aj" ||
        (projectTitle && projectTitle.toLowerCase().includes("karnataka"));
      const initialThumb = isKarnataka
        ? `/outputs/repaired_job-job_code_1792219404621_iizjt_1792381910438_thumb.jpg`
        : `/outputs/repaired_job-job_code_1792382768219_mbcw4_1792382812142_thumb.jpg`;
      const initialAssets = [
        `/editor/project/${encodeURIComponent(targetProjId)}/raw/assets/kerala-intro.jpg`,
        `/editor/project/${encodeURIComponent(targetProjId)}/raw/assets/kerala-coast.jpg`,
        `/editor/project/${encodeURIComponent(targetProjId)}/raw/assets/kerala-mountains.jpg`,
        `/editor/project/${encodeURIComponent(targetProjId)}/raw/assets/kerala-backwaters.jpg`,
        `/editor/project/${encodeURIComponent(targetProjId)}/raw/assets/kerala-culture.jpg`,
      ];
      const compAsset = {
        assetId,
        id: assetId,
        type: "composition",
        src: `/editor/project/${encodeURIComponent(targetProjId)}/raw/index.html`,
        thumbnail: initialThumb,
        thumbnails: initialAssets,
        assetImages: initialAssets,
        name: projectTitle,
        duration: dur,
        sourceDuration: dur,
        sourceStart: 0,
        playbackRate: 1,
        volume: 1,
        width: 1920,
        height: 1080,
      };
      const newSegment = {
        ...createVisualSegment(dur, compAsset),
        thumbnail: initialThumb,
        thumbnails: initialAssets,
        assetImages: initialAssets,
      };
      setVisualSegments([newSegment]);
      setSelectedVisualSegmentId(newSegment.id);
      setSelectedTrack("image");
      setCanvasVisualTarget(`visual:${newSegment.id}`);
      setVisualType("composition");
      setImageSrc("");

      setImageName(projectTitle);
      setImageDuration(dur);

      // User requested strict rule: DO NOT generate subtitles or text from our side!
      setCaptionSegments([]);
      setCaptionsEnabled(false);
      setVisualOverlaySegments(Array.isArray(overlays) ? overlays : []);

      // Fetch real project data to parse real elements and scenes
      loadedProjectIdRef.current = targetProjId;
      setCompositionUrl(`/editor/project/${encodeURIComponent(targetProjId)}/raw/index.html`);
      fetch(`/editor/project/${encodeURIComponent(targetProjId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          loadedProjectDataRef.current = data;
          if (data && data.scenes) {
            setProjectScenes(data.scenes);
          }
          const realElements = extractElementsFromProject(data, dur, projectTitle, prompt);
          setProjectElements(realElements);
          if (realElements.length > 0) {
            setSelectedElementId(realElements[0].id);
          }

          // Populate real video thumbnail and scene images on visual timeline segments
          const projectThumb = data?.thumbnailUrl ||
            (data?.renderedVideoUrl ? data.renderedVideoUrl.replace(/\.mp4$/i, "_thumb.jpg") : null) ||
            (data?.assets && data.assets.length > 0 ? (data.assets[0].url || data.assets[0]) : null) ||
            initialThumb;

          const assetImages = (data?.assets && Array.isArray(data.assets) && data.assets.length > 0)
            ? data.assets.map((a) => (typeof a === "string" ? a : a.url)).filter(Boolean)
            : initialAssets;

          setVisualSegments((prevSegments) =>
            prevSegments.map((seg) => ({
              ...seg,
              thumbnail: projectThumb,
              thumbnails: assetImages,
              assetImages: assetImages,
              assets: data?.assets || [],
            }))
          );
        })
        .catch(() => {
          const fallbackElements = extractElementsFromProject(null, dur, projectTitle, prompt);
          setProjectElements(fallbackElements);
          if (fallbackElements.length > 0) {
            setSelectedElementId(fallbackElements[0].id);
          }
        });

      setTimelineHorizon(Math.max(dur, 40));
      setCurrentTime(0);
      autoLoadedVideoRef.current = true;
      notify(`Loaded project: ${projectTitle}`);
    };

    // Check URL parameters
    const params = new URLSearchParams(window.location.search);
    let videoParam = params.get("video");
    const titleParam = params.get("title");
    const durationParam = params.get("duration");
    const promptParam = params.get("prompt");
    const projectParam = params.get("project");

    if (!videoParam && (projectParam === "default_reference_video_2" || !projectParam)) {
      videoParam = "";
    }

    if (!autoLoadedVideoRef.current && (projectParam || videoParam)) {
      loadProjectFromSource({
        videoUrl: "",
        title: titleParam || (projectParam === "default_reference_video_2" ? "London in 3 Days (Reference Video)" : "Project Video"),
        duration: durationParam || 40,
        prompt: promptParam || "",
        projectId: projectParam || "default_reference_video_2",
      });
    }

    // Listen for postMessage from parent dashboard window or composition iframe
    const onMessage = (event) => {
      if (!event.data) return;
      if (event.data.type === "LOAD_PROJECT_VIDEO") {
        loadProjectFromSource(event.data);
      } else if (event.data.type === "HYPERLINK_ELEMENTS_READY") {
        const liveElements = event.data.payload;
        if (Array.isArray(liveElements) && liveElements.length > 0) {
          setProjectElements((prev) => {
            if (prev.length === 0 || prev.some((el) => el.id === "el-main-title")) {
              return liveElements;
            }
            return prev.map((el) => {
              const live = liveElements.find((l) => l.id === el.id || (l.text && l.text.trim().toLowerCase() === (el.text || "").trim().toLowerCase()));
              if (live && live.placement) {
                return {
                  ...el,
                  id: live.id || el.id,
                  placement: el.hasMoved ? el.placement : live.placement,
                  style: { ...el.style, ...live.style },
                };
              }
              return el;
            });
          });
        }
      } else if (event.data.type === "HYPERLINK_ELEMENT_CLICKED") {
        const payload = event.data.payload;
        if (!payload) return;

        setProjectElements((prev) => {
          const targetText = (payload.text || "").trim().toLowerCase();
          let match = prev.find((el) => {
            if (payload.id && el.id === payload.id) return true;
            if (targetText && el.text && el.text.trim().toLowerCase() === targetText) return true;
            return false;
          });

          if (match) {
            setSelectedElementId(match.id);
            setActiveTool("elements");
            return prev;
          }

          const isHeading = payload.type === "heading" || payload.tag?.startsWith("h");
          const newEl = {
            id: payload.id || `el-canvas-${Date.now()}`,
            sceneId: payload.sceneId || (payload.sceneIndex !== undefined ? `scene-${payload.sceneIndex + 1}` : "scene-1"),
            sceneIndex: payload.sceneIndex !== undefined ? payload.sceneIndex : 0,
            file: payload.file || (payload.sceneIndex !== undefined ? `compositions/scene_${payload.sceneIndex + 1}.html` : "index.html"),
            tag: payload.tag || (isHeading ? "h1" : "p"),
            type: payload.type || (isHeading ? "heading" : "text"),
            name: `${payload.tag ? payload.tag.toUpperCase() : "EL"}: ${(payload.text || "Element").slice(0, 20)}`,
            text: payload.text || "",
            originalText: payload.text || "",
            isModified: false,
            style: {
              fontFamily: payload.styles?.fontFamily || "'Inter', sans-serif",
              fontSize: parseInt(payload.styles?.fontSize, 10) || (isHeading ? 48 : 24),
              fontWeight: payload.styles?.fontWeight || (isHeading ? 700 : 400),
              color: payload.styles?.color || "#ffffff",
              textAlign: payload.styles?.textAlign || "left",
            },
            placement: {
              x: payload.rect ? Math.max(0, Math.min(95, (payload.rect.left / 1920) * 100)) : 50,
              y: payload.rect ? Math.max(0, Math.min(95, (payload.rect.top / 1080) * 100)) : 50,
              width: payload.rect ? Math.max(80, payload.rect.width) : 400,
              height: payload.rect ? Math.max(30, payload.rect.height) : 60,
              isTopLeft: true,
            },
            visible: true,
          };
          setSelectedElementId(newEl.id);
          setActiveTool("elements");
          return [...prev, newEl];
        });
      } else if (event.data.type === "HYPERLINK_CANVAS_CLICKED") {
        setSelectedElementId(null);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    createVisualSegment, setVisualSegments, setSelectedVisualSegmentId,
    setSelectedTrack, setCanvasVisualTarget, setVisualType, setImageSrc, setImageName,
    setImageDuration, setCaptionSegments, setCaptionsEnabled, setVisualOverlaySegments,
    setTimelineHorizon, setCurrentTime, setUserAssets, notify, setActiveTool,
  ]);

  return (
    <main className={`app-shell ${isCompactViewport ? "is-compact-workspace" : ""} ${mobilePanel ? `mobile-panel-${mobilePanel}` : ""} ${isCompactViewport && mobileInspectorSection ? `mobile-section-${mobileInspectorSection}` : ""} ${isCompactViewport && mobileInspectorSection === "mask" && (selectedVisualOverlay || selectedVisualSegment)?.mask?.type && (selectedVisualOverlay || selectedVisualSegment).mask.type !== "none" ? "mobile-mask-active" : ""} ${mobilePanelClosing ? "is-mobile-panel-closing" : ""}`} lang={activeLanguage} onDragOver={(event) => {
      if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
    }} onDrop={async (event) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      const audioFile = files.find((file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name));
      const targetTrack = event.target.closest?.("[data-asset-drop-track]")?.dataset.assetDropTrack;
      if (audioFile && targetTrack === "music") {
        try {
          const decoded = await decodeWaveform(audioFile, 96);
          replaceMusic(audioFile, decoded.duration, decoded.peaks, audioFile.name, "音乐已安全加入时间线");
        } catch (error) {
          notify(error instanceof Error ? `无法读取该音频：${error.message}` : "无法读取该音频文件");
        }
        return;
      }
      handleFiles(files);
    }}>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,video/x-matroska,.mkv,.mka,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac,.ac3"
        multiple
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
          event.target.blur();
        }}
      />
      <Topbar
        completeProject={completeProject}
        hostService={hostSession ? <HostServicePanel client={hostSession} completeProject={completeProject} execution={webMcp.execution} language={activeLanguage}
          isBusy={() => isEditorBusy() || webMcp.isAiRunning() || webMcp.execution.busy || webMcp.execution.hasPending || generationPlugins.job.running || completeProject?.busy()} /> : null}
        t={t}
        compactRail={compactRail}
        setCompactRail={setCompactRail}
        lastSaved={lastSaved}
        undo={undo}
        redo={redo}
        ratio={ratio}
        ratioId={ratioId}
        showRatioMenu={showRatioMenu}
        setShowRatioMenu={setShowRatioMenu}
        setRatioId={(nextRatioId) => {
          setRatioId(nextRatioId);
          setFitModeFromUser("contain");
        }}
        notify={notify}
        isPlaying={isPlaying}
        handlePlayToggle={handlePlayToggle}
        imageSrc={imageSrc}
        exporting={exporting}
        handleExportVideo={handleExportVideo}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        exportSettings={exportSettings}
        setExportSettings={setExportSettings}
        timelineDuration={exportContentDuration}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        activeLanguage={activeLanguage}
        setUiLanguage={setUiLanguage}
        captionsEnabled={captionsEnabled}
        setCaptionsEnabled={setCaptionsEnabled}
        trackVisibility={trackVisibility}
        toggleTrackVisibility={toggleTrackVisibility}
        showFileMenu={showFileMenu}
        setShowFileMenu={setShowFileMenu}
        handleNewProject={completeProject ? () => { void completeProject.newProject(); } : handleNewProject}
        handleExportProject={handleExportProject}
        handleImportProject={completeProject ? completeProject.importPortable : handleImportProject}
        projectFileInputRef={projectFileInputRef}
        onSaveProject={saveProjectHtml}
      />

      <WebMcpReview agent={webMcp} language={activeLanguage} />
      <WebMcpAiStatus agent={webMcp} />
      <ProjectImportOverlay progress={projectImportProgress} language={activeLanguage} />
      <section className={`editor-grid ${compactRail ? "is-compact-rail" : ""}`}>
        <EditorSidebar model={{
          activeLanguage, activeTool, analyzeCurrentVisual, analyzeEffectVisual, audioBlob, audioDuration,
          builtInAssets, captionPosition, captionSegments, captionSize, captionStyle,
          captionStylePresetId, captionStylePresets,
          captionTargetDuration, captionsEnabled, clearMusicTrack, clearSourceAudioTrack,
          compactRail, currentSegmentIndex, deleteCaptionSegment,
          deleteUserAsset, downloadBlob, draggedAssetId,
          estimatedDuration, fileInputRef, generateCaptionsFromSourceAudio: generateCaptionsWhenIdle, handleAssetClick,
          handleAssetPointerDown, handleCaptionPositionChange, handleFiles, handleStickerClick, confirmStickerSelection,
          imageSrc, isDragging, mediaTab, musicBlob, musicDuration, musicName, musicVolume,
          libraryType, libraryQuery, setLibraryQuery, selectLibraryType, libraryStatus, libraryError, libraryProvider,
          assetDownloadStates, prefetchLibraryAsset,
          notify, openAvatarPanel, previewVisionAnalysis, previewVisionKey, smartMode, setSmartMode,
          previewVisionOptions, previewVisualSrc, previewVisualType, progress, script,
          seekTo, segments, selectTool, selectedCaptionSegment, selectedFilterId,
          selectedLibraryAssetId, selectedSegmentId, selectedStickerId, selectedTransitionId,
          selectedVoice: selectedVoiceProfile ? { ...selectedVoice, name: selectedVoiceProfile.name } : selectedVoice,
          setCaptionSegments, setCaptionSize, setCaptionStyle, setCaptionStylePresetId, setCaptionStylePresets, setCaptionsEnabled, setIsDragging,
          setMediaTab, setMusicVolume, setSelectedAudioSegmentId, setSelectedFilterId, setSelectedSegmentId,
          setSelectedStickerId, setSelectedTrack, setSelectedTransitionId, setSourceAudioVolume, setVoiceTab,
          sourceAudioBlob, sourceAudioDuration, sourceAudioLinked, sourceAudioName, sourceAudioVolume, status, t,
          selectedAudioToolTarget, separateSelectedAudioVocals, separateSourceVocals, vocalSeparationJob,
          syncCaptionPositions, toggleCaptionSegmentHidden, trOption, updateCaptionSegmentText,
          updateScript, userAssets, visionJob, aiMusic, smartFrame,
          selectedVisualSegment, selectedEffectSegment, effectAnalysis, effectRunning, effectProgress, effectPhase,
          effectsPanelMode, setEffectsPanelMode, cinematicDepth, photoParallaxDepth,
          visualLocalTime, updateSelectedVisualEffects, updateSelectedSubjectEffect, updateSelectedClickRipple, removeSelectedSubjectEffect, miganRepair, hdRestoration, smartDenoise,
          mobilePanel, setMobilePanel: changeMobilePanel, applyAssetToTrack, handleGeneratedVector, generationPlugins,
        }} />

        <PreviewStage
          t={t}
          previewShellRef={previewShellRef}
          previewCanvasRef={previewCanvasRef}
          previewVideoRef={previewVideoRef}
          onPreviewVideoTimeUpdate={previewVisionBaseAnalysis?.kind === "video-timeline" ? setPreviewVideoMediaTime : undefined}
          previewVisualSrc={previewVisualSrc}
          previewVisualSegment={previewVisualSegment}
          previewVisualRenderSrc={previewVisualRenderSrc}
          previewVisionMaskUrl={previewVisionMaskUrl}
          previewVisualType={previewVisualType}
          previewVisualMuted={shouldMuteEmbeddedVideoAudio(previewVisualSegment, {
            sourceAudioBlob,
            sourceAudioAssetId,
            sourceAudioLinked,
            linkedSegments: linkedSourceAudioSegments,
          })}
          previewTransition={previewTransition}
          visualEffects={visualAnimationPreview?.segmentId && visualAnimationPreview.segmentId === previewVisualSegment?.id
            ? { ...previewVisualSegment, animation: visualAnimationPreview.animation }
            : previewVisualSegment}
          subjectEffect={previewVisualSegment?.subjectEffect}
          subjectCutoutUrl={previewVisionAnalysis?.cutoutUrl || ""}
          cinematicDepth={previewVisualSegment?.cinematicDepth}
          photoParallax={previewVisualSegment?.photoParallax}
          depthAnalysis={previewDepthAnalysis}
          visualLocalTime={visualAnimationPreview?.segmentId && visualAnimationPreview.segmentId === previewVisualSegment?.id
            ? visualAnimationPreview.localTime
            : previewVisualLocalTime}
          visualMaskEditable={selectedTrack === "image" && Boolean(selectedVisualSegment) && visualCanvasEditMode === "mask"}
          onUpdateVisualMask={(mask) => updateSelectedVisualEffects({ mask })}
          visualTransformEditable={canvasVisualTarget === `visual:${previewVisualSegment?.id ?? ""}` && visualCanvasEditMode !== "mask" && !isPlaying}
          onSelectVisual={() => {
            if (!previewVisualSegment?.id) return;
            setSelectedVisualSegmentId(previewVisualSegment.id);
            setSelectedTrack("image");
            setCanvasVisualTarget(`visual:${previewVisualSegment.id}`);
          }}
          onDeselectVisuals={() => {
            setCanvasVisualTarget("");
          }}
          onUpdateVisualTransform={(transform) => updateSelectedVisualEffects({ baseTransform: transform })}
          previewRatio={previewRatio}
          previewFrameStyle={previewFrameStyle}
          previewFrameSize={previewFrameSize}
          trackVisibility={trackVisibility}
          fileInputRef={fileInputRef}
          selectedFilter={activePreviewFilter}
          fitMode={fitMode}
          ratioId={ratioId}
          setRatioId={(nextRatioId) => {
            setRatioId(nextRatioId);
            setFitModeFromUser("contain");
          }}
          visualObjectFit={previewVisualObjectFit}
          visualObjectPosition={previewVisualObjectPosition}
          backgroundRemoved={
            previewVisionOptions.removeBackground &&
            Boolean(previewVisionAnalysis?.cutoutUrl)
          }
          smartCropActive={Boolean(previewSmartCropRect)}
          smartFramePresentation={previewSmartCropRect?.presentation}
          smartFrameBackgroundPosition={previewSmartBackgroundPosition}
          setFitMode={setFitModeFromUser}
          captionsEnabled={captionsEnabled}
          currentCaption={currentCaption}
          currentCaptions={currentCaptions}
          captionSize={captionSize}
          captionStyle={captionStyle}
          captionPlacement={effectiveCaptionPlacement}
          startCaptionDrag={startCaptionDrag}
          selectedCaptionSegmentId={selectedSegmentId}
          onSelectCaptionSegment={handleSelectCaptionSegment}
          onUpdateCaptionFont={handleUpdateCaptionFont}
          onUpdateCaptionSize={handleUpdateCaptionSize}
          onUpdateCaptionColor={handleUpdateCaptionColor}
          onUpdateCaptionText={handleUpdateCaptionText}
          onDeleteCaptionSegment={handleDeleteCaptionSegment}
          onAddTextSegment={handleAddTextSegment}
          setActiveTool={setActiveTool}
          selectedSticker={previewSticker}
          stickers={previewStickers}
          selectedStickerId={selectedStickerSegment?.id ?? ""}
          stickerEditable
          onSelectSticker={selectCanvasStickerSegment}
          onUpdateSticker={updateCanvasStickerSegment}
          isPlaying={isPlaying}
          canPreview={canPreview || Boolean(compositionUrl)}
          handlePlayToggle={handlePlayToggle}
          estimatedDuration={estimatedDuration}
          currentTime={currentTime}
          seekTo={seekTo}
          notify={notify}
          getDraggedAsset={getDraggedAsset}
          applyAssetToTrack={applyAssetToTrack}
          addVisualOverlay={addVisualOverlay}
          visualOverlays={previewVisualOverlaysWithDepth}
          selectedVisualOverlayId={canvasVisualTarget === `overlay:${selectedVisualOverlayId}` ? selectedVisualOverlayId : ""}
          onSelectVisualOverlay={(id) => {
            setSelectedVisualOverlayId(id);
            setSelectedVisualSegmentId("");
            setSelectedTrack("overlay");
            setCanvasVisualTarget(`overlay:${id}`);
          }}
          onUpdateVisualOverlay={updateVisualOverlayById}
          visualOverlayMaskEditable={visualCanvasEditMode === "mask"}
          onUpdateVisualOverlayMask={(mask) => updateSelectedVisualOverlayEffects({ mask })}
          onReorderVisualOverlay={(id, direction) => setVisualOverlaySegments((items) => {
            const ordered = [...items].sort((a, b) => (a.layer || 1) - (b.layer || 1));
            const index = ordered.findIndex((item) => item.id === id);
            const target = Math.max(0, Math.min(ordered.length - 1, index + direction));
            if (index < 0 || index === target) return items;
            [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
            return ordered.map((item, layer) => ({ ...item, layer: layer + 1 }));
          })}
          projectElements={projectElements}
          compositionUrl={compositionUrl}
          compositionIframeRef={compositionIframeRef}
          selectedElementId={selectedElementId}
          hoveredElementId={hoveredElementId}
          onSelectElement={(id) => {
            setSelectedElementId(id);
            if (id) setActiveTool("elements");
          }}
          onHoverElement={setHoveredElementId}
          onUpdateElement={updateElement}
          onDeleteElement={deleteElement}
          onAddProjectElement={addElement}
        />

        <VoicePanel
          projectElements={projectElements}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
          onUpdateElement={updateElement}
          onDeleteElement={deleteElement}
          onDuplicateElement={duplicateElement}
          onAddElement={addElement}
          hoveredElementId={hoveredElementId}
          onHoverElement={setHoveredElementId}
          projectScenes={projectScenes}
          onSaveProject={saveProjectHtml}
          captionHighlightDisabled={trackLocks.caption}
          t={t}
          activeTool={activeTool}
          captionVoiceFocusRequest={captionVoiceFocusRequest}
          status={status}
          statusText={statusText}
          voiceTab={voiceTab}
          setVoiceTab={setVoiceTab}
          script={script}
          updateScript={updateScript}
          selectedVoiceId={selectedVoiceId}
          setSelectedVoiceId={setSelectedVoiceId}
          selectedVoice={selectedVoice}
          filteredVoices={filteredVoices}
          voiceFilter={voiceFilter}
          setVoiceFilter={setVoiceFilter}
          showVoiceFilter={showVoiceFilter}
          setShowVoiceFilter={setShowVoiceFilter}
          speed={speed}
          setSpeed={setSpeed}
          volume={volume}
          setVolume={setVolume}
          progressPercent={progressPercent}
          audioBlob={audioBlob}
          generateVoiceover={generateVoiceoverWhenIdle}
          downloadBlob={downloadBlob}
          favoriteVoiceIds={favoriteVoiceIds}
          setFavoriteVoiceIds={setFavoriteVoiceIds}
          voiceProfiles={voiceProfiles}
          addVoiceProfile={addVoiceProfile}
          removeVoiceProfile={removeVoiceProfile}
          toggleVoiceProfileFavorite={toggleVoiceProfileFavorite}
          selectedVoiceProfileId={selectedVoiceProfileId}
          setSelectedVoiceProfileId={setSelectedVoiceProfileId}
          recordedVoices={recordedVoices}
          recordingState={recordingState}
          recordingElapsed={recordingElapsed}
          startVoiceRecording={startVoiceRecording}
          stopVoiceRecording={stopVoiceRecording}
          historyItems={historyItems}
          useHistoryItem={useHistoryItem}
          setHistoryItems={setHistoryItems}
          notify={notify}
          audioUrl={audioUrl}
          audioRef={audioRef}
          audioSegments={audioSegments}
          audioSegmentRefs={audioSegmentRefs}
          sourceAudioRef={sourceAudioRef}
          musicRef={musicRef}
          sourceAudioUrl={sourceAudioUrl}
          musicUrl={musicUrl}
          captionSegments={captionSegments}
          selectedCaptionSegment={selectedCaptionSegment}
          captionVisualLinkDisabled={Boolean(trackLocks.caption || (!selectedCaptionSegment?.visualSegmentId && !captionVisualTarget))}
          toggleCaptionVisualLink={toggleCaptionVisualLink}
          audioVisualAssociation={audioVisualAssociation}
          stickerVisualAssociation={stickerVisualAssociation}
          selectedSegmentId={selectedSegmentId}
          setSelectedSegmentId={setSelectedSegmentId}
          currentSegmentIndex={currentSegmentIndex}
          captionTargetDuration={captionTargetDuration}
          updateCaptionSegmentText={updateCaptionSegmentText}
          alignCaptionToAudio={alignCaptionToAudio}
          linkCaptionAudio={linkCaptionAudio}
          unlinkCaptionAudio={unlinkCaptionAudio}
          toggleCaptionSegmentHidden={toggleCaptionSegmentHidden}
          deleteCaptionSegment={deleteCaptionSegment}
          importCaptionSegments={importCaptionSegments}
          addCaptionSegment={handleAddCaptionSegment}
          currentTime={currentTime}
          seekTo={seekTo}
          sourceAudioBlob={sourceAudioBlob}
          sourceAudioLinked={sourceAudioLinked}
          generateCaptionsFromSourceAudio={generateCaptionsWhenIdle}
          isGeneratingCaptions={status === "captioning"}
          automaticCaptionProgress={status === "captioning" ? progress : 0}
          avatarPanelOpen={avatarPanelOpen}
          smartMode={smartMode}
          aiMusic={aiMusic}
          autoEdit={autoEdit}
          silenceRemoval={silenceRemoval}
          uiLanguage={activeLanguage}
          captionStyle={captionStyle}
          setCaptionStyle={setCaptionStyle}
          setCaptionSegments={setCaptionSegments}
          smartFrame={smartFrame}
          analyzeCurrentVisual={analyzeCurrentVisual}
          analyzeEffectVisual={analyzeEffectVisual}
          hasVisual={Boolean(previewVisualSrc)}
          visualType={previewVisualType}
          audioDuration={audioDuration}
          avatarJob={avatarJob}
          generateAvatarAcceptanceFrame={generateAvatarAcceptanceFrame}
          faceSwap={faceSwap}
          selectedTrack={selectedTrack}
          selectedAudioSegment={selectedAudioSegment}
          selectedTrackAudioSegment={selectedAudioToolTarget}
          audioProcessingDisabled={selectedTrack === "source" ? Boolean(trackLocks.source || trackLocks.audio || trackLocks.image) : selectedTrack !== "audio" || isTimedSegmentLaneLocked(audioSegments, selectedAudioSegmentId, trackLocks)}
          registerAudioProcessingUrl={url => imageUrlRefs.current.add(url)}
          mobileInspectorOrigin={mobilePanel === "inspector" ? mobilePanelOrigin : ""}
          mobileInspectorSection={isCompactViewport && mobilePanel === "inspector" ? mobileInspectorSection : ""}
          onCloseMobileInspector={() => changeMobilePanel("")}
          updateSelectedTrackAudioSegment={updateSelectedTrackAudioSegment}
          deleteSelectedTrackAudioSegment={() => handleDeleteTrack()}
          updateAudioSegment={updateAudioSegment}
          toggleAudioSegmentReverse={toggleAudioSegmentReverse}
          deleteAudioSegment={deleteAudioSegment}
          onVoiceColorAssetReady={handleVoiceColorAssetReady}
          onApplyVoiceColor={applyVoiceColorToSelectedAudio}
          onRestoreVoiceColor={restoreSelectedAudioVoiceColor}
          selectedVisualSegment={selectedVisualSegment}
          selectedStickerSegment={selectedStickerSegment}
          updateStickerSegment={updateSelectedStickerSegment}
          deleteStickerSegment={deleteSelectedStickerSegment}
          visualLocalTime={visualLocalTime}
          visualTimelineStart={selectedVisualRange?.start ?? 0}
          updateSelectedVisualEffects={updateSelectedVisualEffects}
          miganRepair={miganRepair}
          hdRestoration={hdRestoration}
          smartDenoise={smartDenoise}
          onPreviewAnimation={setVisualAnimationPreview}
          selectedFilterId={selectedFilterId}
          setSelectedFilterId={setSelectedFilterId}
          trOption={trOption}
          selectedVisualOverlay={selectedVisualOverlay}
          updateVisualOverlaySegment={(patch) => setVisualOverlaySegments((items) => items.map((item) => item.id === selectedVisualOverlayId ? { ...item, ...patch } : item))}
          updateVisualOverlayEffects={updateSelectedVisualOverlayEffects}
          setVisualCanvasEditMode={setVisualCanvasEditMode}
          deleteVisualOverlay={() => handleDeleteTrack()}
          applyVisualOverlayPreset={(id) => {
            const preset = getVisualOverlayPreset(id);
            if (preset) updateSelectedVisualOverlay(preset);
          }}
          effectSegment={selectedEffectSegment}
          effectAnalysis={effectAnalysis}
          effectRunning={effectRunning}
          effectProgress={effectProgress}
          effectPhase={effectPhase}
          effectsPanelMode={effectsPanelMode}
          cinematicDepth={cinematicDepth}
          updateSelectedCinematicDepth={updateSelectedCinematicDepth}
          photoParallaxDepth={photoParallaxDepth}
          updateSelectedPhotoParallax={updateSelectedPhotoParallax}
          updateSelectedSubjectEffect={updateSelectedSubjectEffect}
          updateSelectedClickRipple={updateSelectedClickRipple}
          removeSelectedSubjectEffect={removeSelectedSubjectEffect}
          onOpticalFlowAssetReady={handleOpticalFlowAssetReady}
          generationPlugins={generationPlugins}
        />
      </section>

      <Timeline
        audioProcessingLabel={getAudioProcessingCopy(uiLanguage).processing}
        timelineMarkers={timelineMarkers}
        setTimelineMarkers={setTimelineMarkers}
        t={t}
        trOption={trOption}
        notify={notify}
        undo={undo}
        redo={redo}
        handleDeleteTrack={handleDeleteTrack}
        handleDuplicateTrack={handleDuplicateTrack}
        handleCutTrack={handleCutTrack}
        rippleEditing={rippleEditing}
        setRippleEditing={setRippleEditing}
        canPreview={canPreview || Boolean(compositionUrl)}
        handlePlayToggle={handlePlayToggle}
        isPlaying={isPlaying}
        handleAddSegment={handleAddSegment}
        handleRemoveSegment={handleRemoveSegment}
        adjustSelectedSegmentWeight={adjustSelectedSegmentWeight}
        timelineZoom={timelineZoom}
        setTimelineZoom={setTimelineZoom}
        selectedTrack={selectedTrack}
        setSelectedTrack={setSelectedTrack}
        setActiveTool={setActiveTool}
        openMobileInspector={(track, section = "") => {
          setMobilePanelOrigin(getMobileClipPanelOrigin(track));
          setMobileInspectorSection(section);
          changeMobilePanel("inspector");
        }}
        openMobileTools={() => changeMobilePanel("tools")}
        openMobileFilePicker={() => fileInputRef.current?.click()}
        requestCaptionVoiceFocus={() => setCaptionVoiceFocusRequest((request) => request + 1)}
        alignCaptionToAudio={alignCaptionToAudio}
        linkCaptionAudio={linkCaptionAudio}
        unlinkCaptionAudio={unlinkCaptionAudio}
        linkAllCaptionAudio={linkAllCaptionAudio}
        unlinkAllCaptionAudio={unlinkAllCaptionAudio}
        alignAudioCaptions={alignAudioCaptions}
        linkAudioToCaption={linkAudioToCaption}
        unlinkAudioCaptions={unlinkAudioCaptions}
        trackVisibility={trackVisibility}
        toggleTrackVisibility={toggleTrackVisibility}
        trackLocks={trackLocks}
        toggleTrackLock={toggleTrackLock}
        trackScrollRef={trackScrollRef}
        startTimelineSeek={startTimelineSeek}
        timelineDuration={timelineDuration}
        timelineContentDuration={Math.max(estimatedDuration, timelineHorizon, timelineMarkerEnd)}
        setTimelineHorizon={setTimelineHorizon}
        currentTime={currentTime}
        currentTimeRef={currentTimeRef}
        visualPlaybackStartTimeRef={visualPlaybackStartTimeRef}
        visualPlaybackStartedAtRef={visualPlaybackStartedAtRef}
        playbackDuration={estimatedDuration}
        previewVideoMediaTime={previewVideoMediaTime}
        playheadPercent={playheadPercent}
        snapGuide={snapGuide}
        setSnapGuide={setSnapGuide}
        assetDropTargetTrack={assetDropTargetTrack}
        assetDropPosition={assetDropPosition}
        assetDropPulseTrack={assetDropPulseTrack}
        assetDragPreview={assetDragPreview}
        draggedAssetType={getActiveDraggedAsset()?.type || assetDragPreview?.type || ""}
        draggedAssetDuration={getActiveDraggedAsset()?.duration || assetDragPreview?.duration || 0}
        handleTrackAssetDragOver={handleTrackAssetDragOver}
        handleTrackAssetDragLeave={handleTrackAssetDragLeave}
        handleTrackAssetDrop={handleTrackAssetDrop}
        handleVisualStyleDrop={handleVisualStyleDrop}
        activeTimelineClipDrag={activeTimelineClipDrag}
        showStickerTrack={showStickerTrack}
        stickerSegments={stickerSegments}
        setStickerSegments={setStickerSegments}
        currentStickerSegment={currentStickerSegment}
        selectedStickerSegmentId={selectedStickerSegmentId}
        setSelectedStickerSegmentId={setSelectedStickerSegmentId}
        stickerTimelineDrag={stickerTimelineDrag}
        imageSrc={imageSrc}
        displayedVisualSegments={displayedVisualSegments}
        setVisualSegments={setVisualSegments}
        renderedVisualTimeline={renderedVisualTimeline}
        visualType={visualType}
        currentVisualSegment={currentVisualSegment}
        selectedVisualSegmentId={selectedVisualSegmentId}
        currentVisualSegmentIndex={currentVisualSegmentIndex}
        visualOverlaySegments={visualOverlaySegments}
        selectedVisualOverlayId={selectedVisualOverlayId}
        setSelectedVisualOverlayId={setSelectedVisualOverlayId}
        setVisualOverlaySegments={setVisualOverlaySegments}
        builtInImageCaptionAvailable={autoEdit.support.availability === "available"}
        generateImageCaption={autoEdit.generateImageCaption}
        extractVideoSourceAudio={extractVideoSourceAudio}
        generateCaptionsFromAudioClip={generateCaptionsWhenIdle}
        separateAudioClipVocals={separateAudioClipVocals}
        audioProcessingBusy={vocalSeparationJob.running || status === "captioning"}
        setSelectedVisualSegmentId={setSelectedVisualSegmentId}
        seekTo={seekTo}
        suppressTimelineClipClickRef={suppressTimelineClipClickRef}
        startTimelineClipDrag={startTimelineClipDrag}
        startCaptionResize={startCaptionResize}
        startImageResize={startImageResize}
        startStickerSegmentMove={startStickerSegmentMove}
        startStickerSegmentResize={startStickerSegmentResize}
        displayedCaptionSegments={displayedCaptionSegments}
        displayedCaptionTimeline={displayedCaptionTimeline}
        setCaptionSegments={setCaptionSegments}
        currentCaptionSegment={currentCaptionSegment}
        selectedSegmentId={selectedSegmentId}
        setSelectedSegmentId={setSelectedSegmentId}
        captionTargetDuration={captionTargetDuration}
        sourceAudioVolume={sourceAudioVolume}
        setSourceAudioVolume={setSourceAudioVolume}
        musicVolume={musicVolume}
        setMusicVolume={setMusicVolume}
        sourceAudioLinked={sourceAudioLinked}
        linkedSourceAudioSegments={linkedSourceAudioSegments}
        sourceAudioBlob={sourceAudioBlob}
        sourceAudioPeaks={sourceAudioPeaks}
        sourceAudioClipPercent={sourceAudioClipPercent}
        sourceAudioStartPercent={sourceAudioStartPercent}
        sourceAudioDuration={sourceAudioDuration}
        sourceAudioDragTargetLane={sourceAudioDragTargetLane}
        setSourceAudioStart={setSourceAudioStart}
        selectedSourceAudioSegmentId={selectedSourceAudioSegmentId}
        setSelectedSourceAudioSegmentId={setSelectedSourceAudioSegmentId}
        audioBlob={audioBlob}
        peaks={peaks}
        audioClipPercent={audioClipPercent}
        audioDuration={audioDuration}
        audioSegments={audioSegments}
        setAudioSegments={setAudioSegments}
        selectedAudioSegmentId={selectedAudioSegmentId}
        setSelectedAudioSegmentId={setSelectedAudioSegmentId}
        startAudioSegmentMove={startAudioSegmentMove}
        startSourceAudioMove={startSourceAudioMove}
        musicBlob={musicBlob}
        musicSegments={musicSegments}
        setMusicSegments={setMusicSegments}
        setMusicStart={setMusicStart}
        selectedMusicSegmentId={selectedMusicSegmentId}
        setSelectedMusicSegmentId={setSelectedMusicSegmentId}
        musicPeaks={musicPeaks}
        musicStartPercent={musicStartPercent}
        musicDuration={musicDuration}
        startMusicMove={startMusicMove}
      />

      {mobilePanel && !(mobilePanel === "inspector" && isCompactViewport && mobileInspectorSection) ? (
        <header className="mobile-sheet-nav">
          <strong>{({
            transform: t("visualTabTransform"),
            mask: t("visualTabMask"),
            filters: t("visualTabEffects"),
            animation: t("visualTabAnimation"),
            speed: t("visualTabSpeed"),
            vector: t("vectorProperties", "矢量"),
            timing: t("overlayTiming", "层级与时长"),
            repair: t("repairTab"),
            effects: t("effects"),
            caption: t("caption"),
            voice: t("aiVoice"),
            audio: t("mobileClipAudio"),
            fade: t("mobileClipFade"),
            "voice-color": t("voiceColorTab", "音色"),
            processing: getAudioProcessingCopy(uiLanguage).processing,
            sticker: t("stickerProperties"),
          }[mobileInspectorSection]) || (mobilePanelOrigin === "audio-clip"
            ? t("audioClipProperties")
            : mobilePanelOrigin === "sticker-clip"
              ? t("stickerProperties")
              : mobilePanelOrigin === "visual-clip"
                ? t("visualPanelTitle")
                : mobilePanelOrigin === "overlay-clip"
                  ? t("pictureInPicture", "画中画")
                  : mobilePanelOrigin === "caption-clip"
                    ? t("caption")
                    : t(activeTool))}</strong>
          <div className="mobile-sheet-nav-actions">
            {!mobilePanelOrigin.endsWith("-clip") ? <div className="mobile-sheet-tabs" role="tablist" aria-label={t("mobilePanelView")}>
              <button className={mobilePanel === "tools" ? "is-active" : ""} type="button" role="tab" aria-selected={mobilePanel === "tools"} onClick={() => changeMobilePanel("tools")}>{t("mobileDrawerTools")}</button>
              <button className={mobilePanel === "inspector" ? "is-active" : ""} type="button" role="tab" aria-selected={mobilePanel === "inspector"} onClick={() => changeMobilePanel("inspector")}>{t("properties")}</button>
            </div> : null}
            <button className="mobile-sheet-close" type="button" aria-label={t("close", "关闭")} onClick={() => changeMobilePanel("")}><X size={20} /></button>
          </div>
        </header>
      ) : null}
      {mobilePanel ? <button className="mobile-sheet-backdrop" type="button" aria-label={t("close", "关闭")} onClick={() => changeMobilePanel("")} /> : null}

      <AssetDragPreview preview={assetDragPreview} t={t} />
      <MiganRepairDialog
        repair={miganRepair}
        segment={selectedVisualSegment}
        t={t}
        onApplied={() => changeMobilePanel("")}
      />
      <DetailRestorationDialog
        restoration={hdRestoration}
        segment={hdRestoration.sourceSegment || selectedVisualSegment}
        t={t}
        onApplied={() => changeMobilePanel("")}
      />
      <SmartDenoiseDialog
        denoise={smartDenoise}
        segment={smartDenoise.sourceSegment || selectedVisualSegment}
        t={t}
        onApplied={() => changeMobilePanel("")}
      />
      <ExportProgressOverlay
        exporting={exporting}
        error={exportError}
        language={activeLanguage}
        onClose={() => setExportError(null)}
        onRetry={() => { if (exportError?.settings) void handleExportVideo({ settings: exportError.settings }); }}
        percent={exportPercent}
        phase={exportPhase}
        elapsedSeconds={exportElapsedSeconds}
        onCancel={handleCancelExport}
        canceling={exportPhase === t("exportCanceling")}
        t={t}
      />
      {showFirstVisualGuide && !shouldShowLanguageIntro ? (
        <FirstVisualGuide
          language={activeLanguage}
          onClose={() => setShowFirstVisualGuide(false)}
          onComplete={() => {
            markFirstVisualGuideSeen();
            setShowFirstVisualGuide(false);
          }}
        />
      ) : null}
      {shouldShowLanguageIntro ? (
        <LanguageIntro t={t} closing={introClosing} onChoose={chooseInterfaceLanguage} />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
