import { act, renderHook } from "@testing-library/react-native";
import { InteractionManager } from "react-native";
import { useImageProcessing } from "../useImageProcessing";
import { createDeferred, flushPromises } from "./helpers/testUtils";

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

describe("useImageProcessing", () => {
  const tasks: Array<{ cb: () => void; cancel: jest.Mock }> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    tasks.length = 0;
    jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation((cb: () => void) => {
      const task = { cb, cancel: jest.fn() };
      tasks.push(task);
      return { cancel: task.cancel } as never;
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
