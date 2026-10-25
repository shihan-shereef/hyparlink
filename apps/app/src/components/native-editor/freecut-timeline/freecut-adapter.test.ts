import { describe, expect, it } from "bun:test";
import {
  secToFrame,
  frameToSec,
  formatSMPTETimecode,
  formatClockTime,
  adaptOllastarToFreeCut,
  adaptFreeCutToOllastarScenes,
  findSnapPoint,
} from "./freecut-adapter";
import type { CompositionScene, TimelineClip } from "../types";

describe("FreeCut Timeline Adapter", () => {
  it("converts seconds to frames and back accurately", () => {
    const fps = 30;
    expect(secToFrame(0, fps)).toBe(0);
    expect(secToFrame(1.5, fps)).toBe(45);
    expect(secToFrame(5, fps)).toBe(150);

    expect(frameToSec(45, fps)).toBe(1.5);
    expect(frameToSec(150, fps)).toBe(5);
  });

  it("formats SMPTE timecode (HH:MM:SS:FF) correctly", () => {
    expect(formatSMPTETimecode(0, 30)).toBe("00:00:00:00");
    expect(formatSMPTETimecode(1.5, 30)).toBe("00:00:01:15");
    expect(formatSMPTETimecode(65, 30)).toBe("00:01:05:00");
  });

  it("formats clock time (MM:SS.d) correctly", () => {
    expect(formatClockTime(0)).toBe("00:00.0");
    expect(formatClockTime(65.4)).toBe("01:05.4");
  });

  it("adapts Ollastar scenes into FreeCut multitrack layout", () => {
    const sampleScenes: CompositionScene[] = [
      {
        id: "scene-1",
        name: "Intro Hook",
        file: "index.html",
        start: 0,
        duration: 3,
        mediaOffset: 0,
        headline: "Master Hyperlink Editing",
        subtitle: "High impact typography",
      },
      {
        id: "scene-2",
        name: "Feature Breakdown",
        file: "compositions/scene_02.html",
        start: 3,
        duration: 4.5,
        mediaOffset: 3,
      },
    ];

    const sampleClips: TimelineClip[] = [
      {
        id: "clip-audio-1",
        trackId: "track-audio",
        trackType: "audio",
        type: "audio",
        name: "Ambient Bed.mp3",
        start: 0,
        duration: 7.5,
        sourceUrl: "https://example.com/audio.mp3",
      },
    ];

    const tracks = adaptOllastarToFreeCut(sampleScenes, sampleClips, 30);

    expect(tracks.length).toBe(3);
    const sceneTrack = tracks.find((t) => t.id === "track-scenes");
    expect(sceneTrack).toBeDefined();
    expect(sceneTrack?.items.length).toBe(2);

    const firstItem = sceneTrack?.items[0];
    expect(firstItem?.id).toBe("scene-1");
    expect(firstItem?.from).toBe(0);
    expect(firstItem?.durationInFrames).toBe(90);
    expect(firstItem?.headline).toBe("Master Hyperlink Editing");

    const secondItem = sceneTrack?.items[1];
    expect(secondItem?.id).toBe("scene-2");
    expect(secondItem?.from).toBe(90);
    expect(secondItem?.durationInFrames).toBe(135);

    const audioTrack = tracks.find((t) => t.id === "track-audio");
    expect(audioTrack).toBeDefined();
    expect(audioTrack?.items.length).toBe(1);
    expect(audioTrack?.items[0]?.src).toBe("https://example.com/audio.mp3");
  });

  it("adapts FreeCut edited items back to Ollastar scenes preserving metadata", () => {
    const originalScenes: CompositionScene[] = [
      {
        id: "scene-1",
        name: "Intro Hook",
        file: "index.html",
        start: 0,
        duration: 3,
        mediaOffset: 0,
        headline: "Original Headline",
      },
      {
        id: "scene-2",
        name: "Feature Demo",
        file: "compositions/scene_02.html",
        start: 3,
        duration: 4,
        mediaOffset: 3,
      },
    ];

    const tracks = adaptOllastarToFreeCut(originalScenes, [], 30);
    const sceneItems = tracks.find((t) => t.id === "track-scenes")!.items;

    // Simulate user trimming scene-1 to 2.5s and moving scene-2 to start at 2.5s
    sceneItems[0].durationSec = 2.5;
    sceneItems[0].durationInFrames = 75;

    sceneItems[1].startSec = 2.5;
    sceneItems[1].from = 75;
    sceneItems[1].durationSec = 5;
    sceneItems[1].durationInFrames = 150;
    sceneItems[1].speed = 1.25;

    const updatedScenes = adaptFreeCutToOllastarScenes(
      sceneItems,
      originalScenes,
      30,
    );

    expect(updatedScenes.length).toBe(2);
    expect(updatedScenes[0].id).toBe("scene-1");
    expect(updatedScenes[0].duration).toBe(2.5);
    expect(updatedScenes[0].headline).toBe("Original Headline");

    expect(updatedScenes[1].id).toBe("scene-2");
    expect(updatedScenes[1].start).toBe(2.5);
    expect(updatedScenes[1].duration).toBe(5);
    expect(updatedScenes[1].speed).toBe(1.25);
  });

  it("detects magnetic snapping correctly within threshold", () => {
    const zoomPxPerSec = 50; // 50px per second
    const snapCandidates = [0, 3, 5, 10]; // in seconds

    // Target 3.08s -> distance = 0.08 * 50 = 4px (within 10px threshold)
    const snapResult1 = findSnapPoint(3.08, snapCandidates, zoomPxPerSec, 10);
    expect(snapResult1.didSnap).toBe(true);
    expect(snapResult1.snappedTimeSec).toBe(3);
    expect(snapResult1.snapGuideX).toBe(150);

    // Target 3.5s -> distance = 0.5 * 50 = 25px (outside 10px threshold)
    const snapResult2 = findSnapPoint(3.5, snapCandidates, zoomPxPerSec, 10);
    expect(snapResult2.didSnap).toBe(false);
    expect(snapResult2.snapGuideX).toBeNull();
  });
});
