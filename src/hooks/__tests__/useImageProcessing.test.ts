import { act, renderHook } from "@testing-library/react-native";
import { InteractionManager } from "react-native";
import { useImageProcessing } from "../useImageProcessing";
import { createDeferred, flushPromises } from "./helpers/testUtils";
import type { ProcessingPipelineSnapshot } from "../../lib/fits/types";

jest.mock("../../lib/converter/formatConverter", () => ({
  fitsToRGBA: jest.fn(),
  fitsToRGBAChunked: jest.fn(),
  downsamplePixels: jest.fn(),
}));
jest.mock("../../lib/utils/pixelMath", () => ({
  calculateStats: jest.fn(),
  calculateHistogram: jest.fn(),
  calculateRegionHistogram: jest.fn(),
}));
jest.mock("../../lib/processing/executor", () => ({
  executeProcessingPipeline: jest.fn(),
}));
jest.mock("../../lib/processing/recipe", () => ({
  normalizeProcessingPipelineSnapshot: jest.fn(),
}));

const converterLib = jest.requireMock("../../lib/converter/formatConverter") as {
  fitsToRGBA: jest.Mock;
  fitsToRGBAChunked: jest.Mock;
  downsamplePixels: jest.Mock;
};
const pixelMathLib = jest.requireMock("../../lib/utils/pixelMath") as {
  calculateStats: jest.Mock;
  calculateHistogram: jest.Mock;
  calculateRegionHistogram: jest.Mock;
};
const executorLib = jest.requireMock("../../lib/processing/executor") as {
  executeProcessingPipeline: jest.Mock;
};
const recipeLib = jest.requireMock("../../lib/processing/recipe") as {
  normalizeProcessingPipelineSnapshot: jest.Mock;
};
type InteractionTask = Parameters<typeof InteractionManager.runAfterInteractions>[0];

function createInteractionHandle(cancel: jest.Mock = jest.fn()) {
  return {
    then: (onfulfilled?: () => any) =>
      Promise.resolve().then(() => (onfulfilled ? onfulfilled() : undefined)),
    done: (...args: any[]) => (typeof args[0] === "function" ? args[0]() : undefined),
    cancel,
  } as ReturnType<typeof InteractionManager.runAfterInteractions>;
}

describe("useImageProcessing", () => {
  const tasks: Array<{ cb: () => void; cancel: jest.Mock }> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    tasks.length = 0;
    jest
      .spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation((task?: InteractionTask) => {
        const handle = { cancel: jest.fn() };
        if (typeof task === "function") {
          tasks.push({ cb: task, cancel: handle.cancel });
        }
        return createInteractionHandle(handle.cancel);
      });
    converterLib.fitsToRGBA.mockReturnValue(new Uint8ClampedArray([1, 2, 3, 4]));
    converterLib.downsamplePixels.mockReturnValue({
      pixels: new Float32Array([0, 1, 2, 3]),
      width: 2,
      height: 2,
    });
    pixelMathLib.calculateStats.mockReturnValue({ min: 0, max: 10, mean: 5 });
    pixelMathLib.calculateHistogram.mockReturnValue({ bins: [1, 2] });
    pixelMathLib.calculateRegionHistogram.mockReturnValue({ bins: [9, 9] });
    recipeLib.normalizeProcessingPipelineSnapshot.mockImplementation((recipe, profile) => ({
      version: 2,
      savedAt: Date.now(),
      profile: profile ?? "standard",
      scientificNodes: recipe?.scientificNodes ?? [],
      colorNodes: recipe?.colorNodes ?? [],
    }));
    executorLib.executeProcessingPipeline.mockReturnValue({
      scientificOutput: { pixels: new Float32Array([0]), width: 2, height: 2 },
      colorOutput: { rgbaData: new Uint8ClampedArray([7, 8, 9, 255]), width: 2, height: 2 },
    });
  });

  it("processes small image synchronously and updates dimensions", () => {
    const { result } = renderHook(() => useImageProcessing());

    act(() => {
      result.current.processImage(new Float32Array([0, 1, 2, 3]), 2, 2, "linear", "grayscale");
    });

    expect(converterLib.fitsToRGBA).toHaveBeenCalled();
    expect(result.current.rgbaData).toEqual(new Uint8ClampedArray([1, 2, 3, 4]));
    expect(result.current.displayWidth).toBe(2);
    expect(result.current.displayHeight).toBe(2);
    expect(result.current.isProcessing).toBe(false);
  });

  it("processes large image in chunks and aborts previous chunk task", async () => {
    const d1 = createDeferred<Uint8ClampedArray>();
    const d2 = createDeferred<Uint8ClampedArray>();
    const signals: AbortSignal[] = [];
    converterLib.fitsToRGBAChunked
      .mockImplementationOnce(
        (_p: unknown, _w: unknown, _h: unknown, _o: unknown, signal: AbortSignal) => {
          signals.push(signal);
          return d1.promise;
        },
      )
      .mockImplementationOnce(
        (_p: unknown, _w: unknown, _h: unknown, _o: unknown, signal: AbortSignal) => {
          signals.push(signal);
          return d2.promise;
        },
      );
    const { result } = renderHook(() => useImageProcessing());

    act(() => {
      result.current.processImage(new Float32Array(1_200_000), 1200, 1000, "linear", "grayscale");
      result.current.processImage(new Float32Array(1_200_000), 1200, 1000, "linear", "grayscale");
    });

    expect(signals[0].aborted).toBe(true);
    d2.resolve(new Uint8ClampedArray([9, 8, 7, 6]));
    await flushPromises();

    expect(result.current.rgbaData).toEqual(new Uint8ClampedArray([9, 8, 7, 6]));
    expect(result.current.isProcessing).toBe(false);
  });

  it("uses dual-stage executor when recipe nodes exist", () => {
    const { result } = renderHook(() => useImageProcessing());
    const recipe: ProcessingPipelineSnapshot = {
      version: 2,
      savedAt: Date.now(),
      profile: "standard" as const,
      scientificNodes: [{ id: "n1", operationId: "invert", enabled: true, params: {} }],
      colorNodes: [],
    };

    act(() => {
      result.current.processImage(
        new Float32Array([0, 1, 2, 3]),
        2,
        2,
        "linear",
        "grayscale",
        0,
        1,
        1,
        0,
        1,
        0,
        1,
        0.5,
        "linear",
        { profile: "standard", recipe },
      );
    });

    expect(executorLib.executeProcessingPipeline).toHaveBeenCalled();
    expect(converterLib.fitsToRGBA).not.toHaveBeenCalled();
    expect(result.current.rgbaData).toEqual(new Uint8ClampedArray([7, 8, 9, 255]));
  });

  it("runs preview-first path and keeps error state on chunk failure", async () => {
    converterLib.fitsToRGBAChunked.mockRejectedValue(new Error("chunk fail"));
    const { result } = renderHook(() => useImageProcessing());

    act(() => {
      result.current.processImagePreview(
        new Float32Array(1_200_000),
        1200,
        1000,
        "linear",
        "grayscale",
      );
    });
    await flushPromises();

    expect(converterLib.downsamplePixels).toHaveBeenCalled();
    expect(result.current.displayWidth).toBe(2);
    expect(result.current.processingError).toBe("chunk fail");
    expect(result.current.isProcessing).toBe(false);
  });

  it("computes histogram/stats and cancels prior deferred stats task", () => {
    const { result } = renderHook(() => useImageProcessing());
    const pixels = new Float32Array([0, 1, 2, 3]);

    act(() => {
      result.current.getHistogram(pixels, 4);
      result.current.getStats(pixels);
    });
    expect(result.current.histogram).toEqual({ bins: [1, 2] });
    expect(result.current.stats).toEqual({ min: 0, max: 10, mean: 5 });

    act(() => {
      result.current.getStatsAndHistogram(pixels, 16);
      result.current.getStatsAndHistogram(pixels, 32);
    });
    expect(tasks[0].cancel).toHaveBeenCalledTimes(1);

    act(() => {
      tasks[1].cb();
    });
    expect(pixelMathLib.calculateHistogram).toHaveBeenCalledWith(pixels, 32, { min: 0, max: 10 });

    act(() => {
      result.current.getRegionHistogram(pixels, 2, { x: 0, y: 0, w: 1, h: 1 }, 8);
    });
    expect(pixelMathLib.calculateRegionHistogram).toHaveBeenCalled();

    act(() => {
      result.current.clearRegionHistogram();
    });
    expect(result.current.regionHistogram).toBeNull();
  });
});
