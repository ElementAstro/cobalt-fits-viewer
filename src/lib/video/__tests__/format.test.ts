import {
  formatVideoDuration,
  formatVideoDurationWithMs,
  formatVideoResolution,
  translateEngineError,
  estimateOutputSizeBytes,
  taskStatusColor,
  translateTaskStatus,
} from "../format";

describe("formatVideoDuration", () => {
  it("returns 00:00 for null/undefined/zero", () => {
    expect(formatVideoDuration(null)).toBe("00:00");
    expect(formatVideoDuration(undefined)).toBe("00:00");
    expect(formatVideoDuration(0)).toBe("00:00");
    expect(formatVideoDuration(-100)).toBe("00:00");
  });

  it("formats seconds correctly", () => {
    expect(formatVideoDuration(5000)).toBe("00:05");
    expect(formatVideoDuration(65000)).toBe("01:05");
  });

  it("includes hours when >= 1h", () => {
    expect(formatVideoDuration(3661000)).toBe("01:01:01");
  });
});

describe("formatVideoDurationWithMs", () => {
  it("returns 00:00.0 for null/undefined/zero", () => {
    expect(formatVideoDurationWithMs(null)).toBe("00:00.0");
    expect(formatVideoDurationWithMs(undefined)).toBe("00:00.0");
    expect(formatVideoDurationWithMs(0)).toBe("00:00.0");
    expect(formatVideoDurationWithMs(-50)).toBe("00:00.0");
  });

  it("formats with tenths of a second", () => {
    expect(formatVideoDurationWithMs(1500)).toBe("00:01.5");
    expect(formatVideoDurationWithMs(12300)).toBe("00:12.3");
    expect(formatVideoDurationWithMs(60000)).toBe("01:00.0");
  });

  it("includes hours when >= 1h", () => {
    expect(formatVideoDurationWithMs(3661200)).toBe("01:01:01.2");
  });

  it("truncates sub-100ms correctly", () => {
    expect(formatVideoDurationWithMs(1050)).toBe("00:01.0");
    expect(formatVideoDurationWithMs(1950)).toBe("00:01.9");
  });
});

describe("formatVideoResolution", () => {
  it("returns empty string for missing values", () => {
    expect(formatVideoResolution(null, null)).toBe("");
    expect(formatVideoResolution(1920, null)).toBe("");
    expect(formatVideoResolution(null, 1080)).toBe("");
  });

  it("formats width x height", () => {
    expect(formatVideoResolution(1920, 1080)).toBe("1920×1080");
    expect(formatVideoResolution(3840, 2160)).toBe("3840×2160");
  });
});

describe("translateEngineError", () => {
  const mockT = (key: string) => {
    const map: Record<string, string> = {
      "settings.videoErrHevcUnavailable": "HEVC encoder is not available.",
      "settings.videoErrProcessingFailed": "Video processing failed.",
      "settings.videoErrSplitSegmentFailed": "Split segment failed.",
    };
    return map[key] ?? key;
  };

  it("returns empty string for undefined code", () => {
    expect(translateEngineError(undefined, mockT)).toBe("");
  });

  it("translates known prefix", () => {
    expect(translateEngineError("encoder_hevc_unavailable", mockT)).toBe(
      "HEVC encoder is not available.",
    );
  });

  it("translates prefix match for ffmpeg_failed_split_segment_3", () => {
    expect(translateEngineError("ffmpeg_failed_split_segment_3", mockT)).toBe(
      "Split segment failed.",
    );
  });

  it("returns raw code when no prefix matches", () => {
    expect(translateEngineError("unknown_error_xyz", mockT)).toBe("unknown_error_xyz");
  });

  it("returns raw code when t returns the key itself (no translation)", () => {
    const identityT = (key: string) => key;
    expect(translateEngineError("encoder_hevc_unavailable", identityT)).toBe(
      "encoder_hevc_unavailable",
    );
  });
});

describe("taskStatusColor", () => {
  it("maps completed to success", () => {
    expect(taskStatusColor("completed")).toBe("success");
  });

  it("maps failed to danger", () => {
    expect(taskStatusColor("failed")).toBe("danger");
  });

  it("maps running to warning", () => {
    expect(taskStatusColor("running")).toBe("warning");
  });

  it("maps pending and unknown to default", () => {
    expect(taskStatusColor("pending")).toBe("default");
    expect(taskStatusColor("cancelled")).toBe("default");
    expect(taskStatusColor("whatever")).toBe("default");
  });
});

describe("translateTaskStatus", () => {
  it("returns translated value when t returns a translation", () => {
    const mockT = (key: string) => {
      const map: Record<string, string> = {
        "settings.videoTaskStatus_pending": "等待中",
        "settings.videoTaskStatus_running": "处理中",
        "settings.videoTaskStatus_completed": "已完成",
        "settings.videoTaskStatus_failed": "失败",
        "settings.videoTaskStatus_cancelled": "已取消",
      };
      return map[key] ?? key;
    };

    expect(translateTaskStatus("pending", mockT)).toBe("等待中");
    expect(translateTaskStatus("running", mockT)).toBe("处理中");
    expect(translateTaskStatus("completed", mockT)).toBe("已完成");
    expect(translateTaskStatus("failed", mockT)).toBe("失败");
    expect(translateTaskStatus("cancelled", mockT)).toBe("已取消");
  });

  it("falls back to raw status when no translation exists", () => {
    const identityT = (key: string) => key;
    expect(translateTaskStatus("pending", identityT)).toBe("pending");
    expect(translateTaskStatus("unknown_status", identityT)).toBe("unknown_status");
  });
});

describe("estimateOutputSizeBytes", () => {
  it("returns null for missing or zero values", () => {
    expect(estimateOutputSizeBytes(undefined, undefined)).toBeNull();
    expect(estimateOutputSizeBytes(0, 4000)).toBeNull();
    expect(estimateOutputSizeBytes(10000, 0)).toBeNull();
    expect(estimateOutputSizeBytes(-1, 4000)).toBeNull();
    expect(estimateOutputSizeBytes(10000, -1)).toBeNull();
  });

  it("estimates correctly for 10s at 4000kbps", () => {
    const result = estimateOutputSizeBytes(10_000, 4000);
    expect(result).toBe(5_000_000);
  });

  it("estimates correctly for 60s at 1000kbps", () => {
    const result = estimateOutputSizeBytes(60_000, 1000);
    expect(result).toBe(7_500_000);
  });
});
