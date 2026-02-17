import { act, renderHook } from "@testing-library/react-native";
import { InteractionManager } from "react-native";
import { useImageEditor } from "../useImageEditor";

jest.mock("../../lib/utils/imageOperations", () => ({
  applyOperation: jest.fn(),
}));
jest.mock("../../lib/converter/formatConverter", () => ({
  fitsToRGBA: jest.fn(() => new Uint8ClampedArray([1, 2, 3, 4])),
}));
jest.mock("../../lib/logger", () => ({
  LOG_TAGS: {
    ImageEditor: "ImageEditor",
  },
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const opLib = jest.requireMock("../../lib/utils/imageOperations") as {
  applyOperation: jest.Mock;
};
const converterLib = jest.requireMock("../../lib/converter/formatConverter") as {
  fitsToRGBA: jest.Mock;
};

describe("useImageEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(InteractionManager, "runAfterInteractions").mockImplementation((cb: () => void) => {
      cb();
      return { cancel: jest.fn() } as never;
    });
    opLib.applyOperation.mockImplementation((pixels: Float32Array) => ({
      pixels: new Float32Array(pixels.length).fill(0.5),
      width: 2,
      height: 2,
    }));
  });

  it("initializes and applies edit with undo/redo", () => {
    const { result } = renderHook(() => useImageEditor());
    const px = new Float32Array([0, 1, 2, 3]);

    act(() => {
      result.current.initialize(px, 2, 2, "linear", "grayscale");
    });
    expect(result.current.historyLength).toBe(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.rgbaData).toEqual(new Uint8ClampedArray([1, 2, 3, 4]));

    act(() => {
      result.current.applyEdit({ type: "flipHorizontal" } as never);
    });
    expect(result.current.historyLength).toBe(2);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.canUndo).toBe(true);
  });

  it("caps history length at max and updates display", () => {
    const { result } = renderHook(() => useImageEditor({ maxHistory: 5 }));
    const px = new Float32Array([0, 1, 2, 3]);
    act(() => {
      result.current.initialize(px, 2, 2);
    });

    for (let i = 0; i < 12; i++) {
      act(() => {
        result.current.applyEdit({ type: "flipHorizontal" } as never);
      });
    }
    expect(result.current.historyLength).toBe(5);

    converterLib.fitsToRGBA.mockClear();
    act(() => {
      result.current.updateDisplay("asinh", "viridis");
    });
    expect(converterLib.fitsToRGBA).toHaveBeenCalled();
  });

  it("handles operation failure", () => {
    opLib.applyOperation.mockImplementationOnce(() => {
      throw new Error("op failed");
    });
    const { result } = renderHook(() => useImageEditor());
    act(() => {
      result.current.initialize(new Float32Array([0, 1, 2, 3]), 2, 2);
    });
    act(() => {
      result.current.applyEdit({ type: "flipHorizontal" } as never);
    });

    expect(result.current.error).toBe("op failed");
    expect(result.current.isProcessing).toBe(false);
  });
});
