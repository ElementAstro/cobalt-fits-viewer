import { act, renderHook } from "@testing-library/react-native";
import { useConverter } from "../useConverter";

jest.mock("../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({
      defaultConverterFormat: "png",
      defaultConverterQuality: 90,
      batchNamingRule: "original",
    }),
}));

jest.mock("../../stores/useConverterStore", () => ({
  useConverterStore: jest.fn(),
}));

jest.mock("../../lib/converter/formatConverter", () => ({
  fitsToRGBA: jest.fn(() => new Uint8ClampedArray([1, 2, 3, 4])),
  estimateFileSize: jest.fn(() => 1234),
}));

jest.mock("../../lib/converter/batchProcessor", () => ({
  createBatchTask: jest.fn(() => ({ id: "task-1" })),
  generateOutputFilename: jest.fn(() => "out.png"),
  executeBatchConvert: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../lib/converter/convertPresets", () => ({
  getAllPresets: jest.fn(() => ["p1"]),
  getDefaultOptionsForFormat: jest.fn(() => ({ format: "png", quality: 90 })),
  supportsQuality: jest.fn(() => true),
  getSupportedBitDepths: jest.fn(() => [8, 16]),
}));

jest.mock("../../lib/logger", () => ({
  LOG_TAGS: {
    Converter: "Converter",
  },
  Logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { useConverterStore } = jest.requireMock("../../stores/useConverterStore") as {
  useConverterStore: jest.Mock;
};
const formatLib = jest.requireMock("../../lib/converter/formatConverter") as {
  fitsToRGBA: jest.Mock;
  estimateFileSize: jest.Mock;
};
const batchLib = jest.requireMock("../../lib/converter/batchProcessor") as {
  createBatchTask: jest.Mock;
  generateOutputFilename: jest.Mock;
  executeBatchConvert: jest.Mock;
};
const presetLib = jest.requireMock("../../lib/converter/convertPresets") as {
  getAllPresets: jest.Mock;
  getDefaultOptionsForFormat: jest.Mock;
  supportsQuality: jest.Mock;
  getSupportedBitDepths: jest.Mock;
};

describe("useConverter", () => {
  const setFormat = jest.fn();
  const setQuality = jest.fn();
  const setBitDepth = jest.fn();
  const setDpi = jest.fn();
  const setOptions = jest.fn();
  const applyPreset = jest.fn();
  const addBatchTask = jest.fn();
  const updateBatchTask = jest.fn();
  const clearCompletedTasks = jest.fn();
  const state = {
    currentOptions: {
      format: "png",
      stretch: "linear",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
    },
    setFormat,
    setQuality,
    setBitDepth,
    setDpi,
    setOptions,
    applyPreset,
    presets: [{ id: "p1" }],
    batchTasks: [],
    addBatchTask,
    updateBatchTask,
    clearCompletedTasks,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useConverterStore.mockImplementation((selector: (s: typeof state) => unknown) =>
      selector(state),
    );
  });

  it("changes format and applies default options", () => {
    const { result } = renderHook(() => useConverter());

    act(() => {
      result.current.setFormat("jpeg");
    });

    expect(setFormat).toHaveBeenCalledWith("jpeg");
    expect(presetLib.getDefaultOptionsForFormat).toHaveBeenCalledWith("jpeg");
    expect(setOptions).toHaveBeenCalledWith({ format: "png", quality: 90 });
  });

  it("maps conversion and size estimation calls", () => {
    const { result } = renderHook(() => useConverter());
    const pixels = new Float32Array([0, 1]);

    const rgba = result.current.convertPixels(pixels, 1, 2);
    const size = result.current.getEstimatedSize(100, 200);

    expect(formatLib.fitsToRGBA).toHaveBeenCalled();
    expect(rgba).toEqual(new Uint8ClampedArray([1, 2, 3, 4]));
    expect(size).toBe(1234);
  });

  it("handles batch start/cancel/retry and helpers", async () => {
    let capturedSignal: AbortSignal | undefined;
    batchLib.executeBatchConvert.mockImplementation(
      (
        _taskId: string,
        _files: unknown[],
        _opts: unknown,
        _onUpdate: unknown,
        signal: AbortSignal,
      ) => {
        capturedSignal = signal;
        return Promise.resolve();
      },
    );
    const { result } = renderHook(() => useConverter());

    const taskId = result.current.startBatchConvert([
      { id: "f1", filepath: "/tmp/a", filename: "a.fits" },
    ]);

    expect(taskId).toBe("task-1");
    expect(batchLib.createBatchTask).toHaveBeenCalled();
    expect(addBatchTask).toHaveBeenCalled();
    expect(batchLib.executeBatchConvert).toHaveBeenCalled();
    expect(batchLib.executeBatchConvert.mock.calls[0][5]).toEqual({ rule: "original" });

    act(() => {
      result.current.cancelTask(taskId);
    });
    expect(updateBatchTask).toHaveBeenCalledWith(taskId, { status: "cancelled" });
    expect(capturedSignal?.aborted).toBe(true);

    act(() => {
      result.current.retryTask(taskId);
    });
    expect(updateBatchTask).toHaveBeenCalledWith(taskId, {
      status: "pending",
      progress: 0,
      completed: 0,
      failed: 0,
      error: undefined,
    });

    expect(result.current.getOutputFilename("a.fits")).toBe("out.png");
    expect(batchLib.generateOutputFilename).toHaveBeenCalledWith("a.fits", "png", "original");
    expect(result.current.allPresets).toEqual(["p1"]);
    expect(result.current.supportsQuality("png")).toBe(true);
    expect(result.current.getSupportedBitDepths("png")).toEqual([8, 16]);
    expect(clearCompletedTasks).toBe(result.current.clearCompletedTasks);
  });
});
