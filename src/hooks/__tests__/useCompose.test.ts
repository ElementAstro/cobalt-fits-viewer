import { act, renderHook } from "@testing-library/react-native";
import { useCompose } from "../useCompose";

jest.mock("../../lib/utils/fileManager", () => ({
  readFileAsArrayBuffer: jest.fn(),
}));
jest.mock("../../lib/fits/parser", () => ({
  loadScientificFitsFromBuffer: jest.fn(),
  getImagePixels: jest.fn(),
  getImageDimensions: jest.fn(),
}));
jest.mock("../../lib/utils/rgbCompose", () => ({
  composeRGB: jest.fn(),
}));
jest.mock("../../lib/processing/color", () => ({
  applySCNRRGBA: jest.fn((rgba: Uint8ClampedArray) => rgba),
  applyColorCalibrationRGBA: jest.fn((rgba: Uint8ClampedArray) => rgba),
  applySaturationRGBA: jest.fn((rgba: Uint8ClampedArray) => rgba),
  applyColorBalanceRGBA: jest.fn((rgba: Uint8ClampedArray) => rgba),
}));
jest.mock("../../lib/logger", () => ({
  LOG_TAGS: {
    Compose: "Compose",
  },
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const fileLib = jest.requireMock("../../lib/utils/fileManager") as {
  readFileAsArrayBuffer: jest.Mock;
};
const parserLib = jest.requireMock("../../lib/fits/parser") as {
  loadScientificFitsFromBuffer: jest.Mock;
  getImagePixels: jest.Mock;
  getImageDimensions: jest.Mock;
};
const rgbLib = jest.requireMock("../../lib/utils/rgbCompose") as {
  composeRGB: jest.Mock;
};
const colorLib = jest.requireMock("../../lib/processing/color") as {
  applySCNRRGBA: jest.Mock;
  applyColorCalibrationRGBA: jest.Mock;
  applySaturationRGBA: jest.Mock;
  applyColorBalanceRGBA: jest.Mock;
};

describe("useCompose", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileLib.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    parserLib.loadScientificFitsFromBuffer.mockResolvedValue({ id: "fits" });
    parserLib.getImageDimensions.mockReturnValue({ width: 2, height: 2 });
    parserLib.getImagePixels.mockResolvedValue(new Float32Array([0, 1, 2, 3]));
    rgbLib.composeRGB.mockReturnValue(new Uint8ClampedArray([255, 0, 0, 255]));
    colorLib.applySCNRRGBA.mockImplementation((rgba: Uint8ClampedArray) => rgba);
    colorLib.applyColorCalibrationRGBA.mockImplementation((rgba: Uint8ClampedArray) => rgba);
    colorLib.applySaturationRGBA.mockImplementation((rgba: Uint8ClampedArray) => rgba);
    colorLib.applyColorBalanceRGBA.mockImplementation((rgba: Uint8ClampedArray) => rgba);
  });

  it("loads channels and composes image", async () => {
    const { result } = renderHook(() => useCompose());

    await act(async () => {
      await result.current.loadChannel("red", "r1", "/tmp/r.fits", "r.fits");
      await result.current.loadChannel("green", "g1", "/tmp/g.fits", "g.fits");
      await result.current.loadChannel("luminance", "l1", "/tmp/l.fits", "l.fits");
    });
    expect(result.current.assignedCount).toBe(2);
    expect(result.current.hasLuminance).toBe(true);

    act(() => {
      result.current.setChannelWeight("red", 0.7);
      result.current.compose();
    });

    expect(rgbLib.composeRGB).toHaveBeenCalled();
    expect(result.current.result).toEqual({
      rgbaData: new Uint8ClampedArray([255, 0, 0, 255]),
      width: 2,
      height: 2,
    });
  });

  it("handles dimension mismatch and channel preconditions", async () => {
    const { result } = renderHook(() => useCompose());
    parserLib.getImageDimensions.mockReturnValueOnce({ width: 2, height: 2 });
    parserLib.getImageDimensions.mockReturnValueOnce({ width: 4, height: 4 });

    await act(async () => {
      await result.current.loadChannel("red", "r1", "/tmp/r.fits", "r.fits");
    });
    await act(async () => {
      await result.current.loadChannel("green", "g1", "/tmp/g.fits", "g.fits");
    });

    expect(result.current.error).toContain("doesn't match reference");

    act(() => {
      result.current.clearChannel("red");
      result.current.compose();
    });
    expect(result.current.error).toBe("Assign at least 2 channels");
  });

  it("resets all states", async () => {
    const { result } = renderHook(() => useCompose());
    await act(async () => {
      await result.current.loadChannel("red", "r1", "/tmp/r.fits", "r.fits");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.assignedCount).toBe(0);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("accepts initial preset and channel weights", () => {
    const { result } = renderHook(() =>
      useCompose({
        initialPreset: "sho",
        initialWeights: { red: 1.5, green: 0.8, blue: 1.2 },
      }),
    );

    expect(result.current.initialPreset).toBe("sho");
    expect(result.current.channels.red.weight).toBe(1.5);
    expect(result.current.channels.green.weight).toBe(0.8);
    expect(result.current.channels.blue.weight).toBe(1.2);
  });

  it("applies compose color post-processing options", async () => {
    const { result } = renderHook(() => useCompose());
    const composed = new Uint8ClampedArray([100, 80, 60, 255]);
    const saturated = new Uint8ClampedArray([120, 70, 50, 255]);
    rgbLib.composeRGB.mockReturnValue(composed);
    colorLib.applySaturationRGBA.mockReturnValue(saturated);

    await act(async () => {
      await result.current.loadChannel("red", "r1", "/tmp/r.fits", "r.fits");
      await result.current.loadChannel("green", "g1", "/tmp/g.fits", "g.fits");
    });

    act(() => {
      result.current.setColorProcessing((prev) => ({ ...prev, saturationAmount: 0.4 }));
    });

    act(() => {
      result.current.compose();
    });

    expect(colorLib.applySaturationRGBA).toHaveBeenCalled();
    expect(result.current.result?.rgbaData).toEqual(saturated);
  });
});
