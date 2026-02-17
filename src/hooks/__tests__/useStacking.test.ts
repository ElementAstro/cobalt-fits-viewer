import { act, renderHook } from "@testing-library/react-native";
import { useStacking } from "../useStacking";

jest.mock("../../lib/utils/fileManager", () => ({
  readFileAsArrayBuffer: jest.fn(),
}));
jest.mock("../../lib/fits/parser", () => ({
  loadFitsFromBuffer: jest.fn(),
  getImagePixels: jest.fn(),
  getImageDimensions: jest.fn(),
}));
jest.mock("../../lib/utils/pixelMath", () => ({
  stackAverage: jest.fn(),
  stackMedian: jest.fn(),
  stackSigmaClip: jest.fn(),
  stackMin: jest.fn(),
  stackMax: jest.fn(),
  stackWinsorizedSigmaClip: jest.fn(),
  stackWeightedAverage: jest.fn(),
  computeAutoStretch: jest.fn(),
}));
jest.mock("../../lib/converter/formatConverter", () => ({
  fitsToRGBA: jest.fn(),
}));
jest.mock("../../lib/stacking/calibration", () => ({
  calibrateFrame: jest.fn((p: Float32Array) => p),
  createMasterDark: jest.fn((frames: Float32Array[]) => frames[0]),
  createMasterFlat: jest.fn((frames: Float32Array[]) => frames[0]),
}));
jest.mock("../../lib/stacking/alignment", () => ({
  alignFrame: jest.fn((ref: Float32Array, cur: Float32Array) => ({
    aligned: cur,
    transform: { matchedStars: 10, rmsError: 0.8 },
  })),
}));
jest.mock("../../lib/stacking/frameQuality", () => ({
  evaluateFrameQuality: jest.fn(() => ({ score: 0.9 })),
  qualityToWeights: jest.fn(() => [0.7, 0.3]),
}));
jest.mock("../../lib/logger", () => {
  const actual = jest.requireActual("../../lib/logger") as typeof import("../../lib/logger");
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

const fileLib = jest.requireMock("../../lib/utils/fileManager") as {
  readFileAsArrayBuffer: jest.Mock;
};
const parserLib = jest.requireMock("../../lib/fits/parser") as {
  loadFitsFromBuffer: jest.Mock;
  getImagePixels: jest.Mock;
  getImageDimensions: jest.Mock;
};
const mathLib = jest.requireMock("../../lib/utils/pixelMath") as {
  stackAverage: jest.Mock;
  stackWeightedAverage: jest.Mock;
  computeAutoStretch: jest.Mock;
  evaluateFrameQuality?: jest.Mock;
};
const converterLib = jest.requireMock("../../lib/converter/formatConverter") as {
  fitsToRGBA: jest.Mock;
};
const qualityLib = jest.requireMock("../../lib/stacking/frameQuality") as {
  evaluateFrameQuality: jest.Mock;
  qualityToWeights: jest.Mock;
};
const alignLib = jest.requireMock("../../lib/stacking/alignment") as {
  alignFrame: jest.Mock;
};

describe("useStacking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileLib.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    parserLib.loadFitsFromBuffer.mockReturnValue({ fits: true });
    parserLib.getImageDimensions.mockReturnValue({ width: 2, height: 2 });
    parserLib.getImagePixels
      .mockResolvedValueOnce(new Float32Array([1, 2, 3, 4]))
      .mockResolvedValueOnce(new Float32Array([5, 6, 7, 8]))
      .mockResolvedValue(new Float32Array([1, 1, 1, 1]));
    mathLib.stackAverage.mockReturnValue(new Float32Array([10, 10, 10, 10]));
    mathLib.stackWeightedAverage.mockReturnValue(new Float32Array([11, 11, 11, 11]));
    mathLib.computeAutoStretch.mockReturnValue({ blackPoint: 0.1, whitePoint: 0.9 });
    converterLib.fitsToRGBA.mockReturnValue(new Uint8ClampedArray([255, 255, 255, 255]));
  });

  it("guards against insufficient frames", async () => {
    const { result } = renderHook(() => useStacking());

    await act(async () => {
      await result.current.stackFiles([{ filepath: "/tmp/a.fits", filename: "a.fits" }], "average");
    });

    expect(result.current.error).toBe("At least 2 frames are required for stacking");
  });

  it("stacks average successfully and sets result/progress", async () => {
    const { result } = renderHook(() => useStacking());

    await act(async () => {
      await result.current.stackFiles(
        [
          { filepath: "/tmp/a.fits", filename: "a.fits" },
          { filepath: "/tmp/b.fits", filename: "b.fits" },
        ],
        "average",
      );
    });

    expect(mathLib.stackAverage).toHaveBeenCalled();
    expect(result.current.result).toEqual(
      expect.objectContaining({
        method: "average",
        frameCount: 2,
        width: 2,
        height: 2,
      }),
    );
    expect(result.current.progress).toEqual(
      expect.objectContaining({
        stage: "done",
      }),
    );
  });

  it("handles dimension mismatch as error", async () => {
    parserLib.getImageDimensions
      .mockReturnValueOnce({ width: 2, height: 2 })
      .mockReturnValueOnce({ width: 3, height: 3 });
    const { result } = renderHook(() => useStacking());

    await act(async () => {
      await result.current.stackFiles(
        [
          { filepath: "/tmp/a.fits", filename: "a.fits" },
          { filepath: "/tmp/b.fits", filename: "b.fits" },
        ],
        "average",
      );
    });

    expect(result.current.error).toContain("Dimension mismatch");
  });

  it("runs weighted/quality/alignment branches and supports cancel/reset", async () => {
    const { result } = renderHook(() => useStacking());

    await act(async () => {
      await result.current.stackFiles(
        [
          { filepath: "/tmp/a.fits", filename: "a.fits" },
          { filepath: "/tmp/b.fits", filename: "b.fits" },
        ],
        "weighted",
        2.5,
        undefined,
        "stars",
        true,
      );
    });

    expect(qualityLib.evaluateFrameQuality).toHaveBeenCalled();
    expect(qualityLib.qualityToWeights).toHaveBeenCalled();
    expect(alignLib.alignFrame).toHaveBeenCalled();
    expect(mathLib.stackWeightedAverage).toHaveBeenCalledWith(expect.any(Array), [0.7, 0.3]);

    act(() => {
      result.current.cancel();
    });
    expect(result.current.isStacking).toBe(false);
    expect(result.current.progress).toBeNull();

    act(() => {
      result.current.reset();
    });
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
