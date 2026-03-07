import { renderHook, act } from "@testing-library/react-native";
import { useVideoProcessingForm } from "../useVideoProcessingForm";
import type { FitsMetadata } from "../../../lib/fits/types";

const mockT = (key: string) => key;

function makeFile(overrides?: Partial<FitsMetadata>): FitsMetadata {
  return {
    id: "file-1",
    filename: "test.mp4",
    filepath: "file:///test.mp4",
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "unknown",
    isFavorite: false,
    tags: [],
    albumIds: [],
    durationMs: 10000,
    ...overrides,
  };
}

describe("useVideoProcessingForm", () => {
  it("initializes with default operation 'trim'", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    expect(result.current.state.operationValue).toBe("trim");
    expect(result.current.state.profile).toBe("balanced");
    expect(result.current.state.targetPreset).toBe("1080p");
  });

  it("resets trim range when file changes", () => {
    const file = makeFile({ durationMs: 20000 });
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    expect(result.current.state.trimEndMs).toBe("20000");
  });

  it("buildRequest returns null when no file is provided", () => {
    const { result } = renderHook(() => useVideoProcessingForm(null, "balanced", "1080p", mockT));

    let request: unknown = undefined;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).toBeNull();
  });

  it("buildRequest creates valid trim request", () => {
    const file = makeFile({ durationMs: 10000 });
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setTrimStartMs("1000");
      result.current.setters.setTrimEndMs("5000");
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.operation).toBe("trim");
    expect(request!.trim).toEqual({ startMs: 1000, endMs: 5000, reencode: true });
    expect(request!.sourceId).toBe("file-1");
  });

  it("buildRequest rejects invalid trim range (start >= end)", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setTrimStartMs("5000");
      result.current.setters.setTrimEndMs("3000");
    });

    let request: unknown = undefined;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).toBeNull();
    expect(result.current.state.submitError).toBe("settings.videoErrorTrimRange");
  });

  it("buildRequest creates valid compress request", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "720p", mockT));

    act(() => {
      result.current.setters.setOperationValue("compress");
      result.current.setters.setTargetBitrateKbps("2000");
      result.current.setters.setCrf("28");
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.operation).toBe("compress");
    expect(request!.compress?.targetPreset).toBe("720p");
    expect(request!.compress?.targetBitrateKbps).toBe(2000);
    expect(request!.compress?.crf).toBe(28);
  });

  it("buildRequest creates valid merge request with multiple files", () => {
    const file = makeFile();
    const mergeFile1 = makeFile({ id: "m1", filepath: "file:///m1.mp4" });
    const mergeFile2 = makeFile({ id: "m2", filepath: "file:///m2.mp4" });
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("merge");
      result.current.setters.setMergeFiles([mergeFile1, mergeFile2]);
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.operation).toBe("merge");
    expect(request!.merge?.inputUris).toEqual(["file:///m1.mp4", "file:///m2.mp4"]);
  });

  it("buildRequest rejects merge with fewer than 2 files", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("merge");
    });

    let request: unknown = undefined;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).toBeNull();
    expect(result.current.state.submitError).toBe("settings.videoErrorMergeInputs");
  });

  it("buildRequest creates valid mute request", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("mute");
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.operation).toBe("mute");
  });

  it("buildRequest creates valid rotate request", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("rotate");
      result.current.setters.setRotationDeg("180");
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.rotateNormalize?.rotationDeg).toBe(180);
  });

  it("buildRequest rejects invalid rotation degree", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("rotate");
      result.current.setters.setRotationDeg("45");
    });

    let request: unknown = undefined;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).toBeNull();
    expect(result.current.state.submitError).toBe("settings.videoErrorRotation");
  });

  it("buildRequest creates valid speed request", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("speed");
      result.current.setters.setSpeedFactor("1.5");
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.speed?.factor).toBe(1.5);
  });

  it("buildRequest rejects out-of-range speed factor", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("speed");
      result.current.setters.setSpeedFactor("10");
    });

    let request: unknown = undefined;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).toBeNull();
    expect(result.current.state.submitError).toBe("settings.videoErrorSpeedFactor");
  });

  it("buildRequest creates valid watermark request", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("watermark");
      result.current.setters.setWatermarkText("Test Watermark");
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.watermark?.text).toBe("Test Watermark");
    expect(request!.watermark?.position).toBe("bottom-right");
  });

  it("buildRequest rejects empty watermark text", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("watermark");
      result.current.setters.setWatermarkText("   ");
    });

    let request: unknown = undefined;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).toBeNull();
    expect(result.current.state.submitError).toBe("settings.videoErrorWatermarkText");
  });

  it("buildRequest creates valid gif request", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("gif");
      result.current.setters.setGifStartMs("500");
      result.current.setters.setGifDurationMs("2000");
      result.current.setters.setGifWidth("320");
      result.current.setters.setGifFps("15");
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.gif).toEqual({ startMs: 500, durationMs: 2000, width: 320, fps: 15 });
  });

  it("buildRequest creates valid extract-audio request", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("extract-audio");
      result.current.setters.setExtractAudioCodec("mp3");
      result.current.setters.setExtractAudioBitrate("320");
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.extractAudio?.audioCodec).toBe("mp3");
    expect(request!.extractAudio?.bitrateKbps).toBe(320);
  });

  it("includes removeAudio when applicable", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    act(() => {
      result.current.setters.setOperationValue("trim");
      result.current.setters.setRemoveAudio(true);
    });

    let request: ReturnType<typeof result.current.buildRequest> = null;
    act(() => {
      request = result.current.buildRequest();
    });

    expect(request).not.toBeNull();
    expect(request!.removeAudio).toBe(true);
  });

  it("does not include removeAudio for non-applicable operations", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    // Set removeAudio while on trim (applicable)
    act(() => {
      result.current.setters.setRemoveAudio(true);
    });

    // Switch to mute (not in canApplyRemoveAudio list)
    act(() => {
      result.current.setters.setOperationValue("mute");
    });

    // removeAudio should be reset by the useEffect
    expect(result.current.state.removeAudio).toBe(false);
  });

  it("canApplyRemoveAudio is true for applicable operations", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    const applicable = ["trim", "split", "compress", "transcode", "rotate", "speed", "watermark"];
    for (const op of applicable) {
      act(() => {
        result.current.setters.setOperationValue(op as never);
      });
      expect(result.current.state.canApplyRemoveAudio).toBe(true);
    }
  });

  it("clears submitError when operation changes", () => {
    const file = makeFile();
    const { result } = renderHook(() => useVideoProcessingForm(file, "balanced", "1080p", mockT));

    // Trigger a validation error
    act(() => {
      result.current.setters.setTrimStartMs("9999");
      result.current.setters.setTrimEndMs("1");
    });
    act(() => {
      result.current.buildRequest();
    });
    expect(result.current.state.submitError).not.toBeNull();

    // Changing operation clears it
    act(() => {
      result.current.setters.setOperationValue("mute");
    });
    expect(result.current.state.submitError).toBeNull();
  });
});
