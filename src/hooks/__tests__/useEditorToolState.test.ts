import { act, renderHook } from "@testing-library/react-native";
import { useEditorToolState } from "../useEditorToolState";

describe("useEditorToolState", () => {
  it("initializes with null activeTool and default params", () => {
    const { result } = renderHook(() => useEditorToolState());
    expect(result.current.activeTool).toBeNull();
    expect(result.current.activeToolGroup).toBe("adjust");
    expect(result.current.showCrop).toBe(false);
    expect(result.current.params.blurSigma).toBe(2);
  });

  it("accepts custom default values", () => {
    const { result } = renderHook(() =>
      useEditorToolState({ blurSigma: 5, sharpenAmount: 3, denoiseRadius: 4 }),
    );
    expect(result.current.params.blurSigma).toBe(5);
    expect(result.current.params.sharpenAmount).toBe(3);
    expect(result.current.params.denoiseRadius).toBe(4);
  });

  it("setActiveTool changes the active tool", () => {
    const { result } = renderHook(() => useEditorToolState());
    act(() => {
      result.current.setActiveTool("blur");
    });
    expect(result.current.activeTool).toBe("blur");
  });

  it("buildOperation returns null when no tool is active", () => {
    const { result } = renderHook(() => useEditorToolState());
    expect(result.current.buildOperation()).toBeNull();
  });

  it("buildOperation returns correct op for blur tool", () => {
    const { result } = renderHook(() => useEditorToolState());
    act(() => {
      result.current.setActiveTool("blur");
    });
    const op = result.current.buildOperation();
    expect(op).toEqual({ type: "blur", sigma: 2 });
  });

  it("buildOperation returns correct op for sharpen tool", () => {
    const { result } = renderHook(() => useEditorToolState({ sharpenAmount: 2 }));
    act(() => {
      result.current.setActiveTool("sharpen");
    });
    const op = result.current.buildOperation();
    expect(op).toEqual({ type: "sharpen", amount: 2, sigma: 1 });
  });

  it("buildOperation returns correct op for simple tools (rotate, flip, invert)", () => {
    const { result } = renderHook(() => useEditorToolState());

    act(() => result.current.setActiveTool("rotate"));
    expect(result.current.buildOperation()).toEqual({ type: "rotate90cw" });

    act(() => result.current.setActiveTool("flip"));
    expect(result.current.buildOperation()).toEqual({ type: "flipH" });

    act(() => result.current.setActiveTool("invert"));
    expect(result.current.buildOperation()).toEqual({ type: "invert" });

    act(() => result.current.setActiveTool("histogram"));
    expect(result.current.buildOperation()).toEqual({ type: "histogramEq" });

    act(() => result.current.setActiveTool("rescale"));
    expect(result.current.buildOperation()).toEqual({ type: "rescale" });
  });

  it("buildOperation returns null for crop tool (handled separately)", () => {
    const { result } = renderHook(() => useEditorToolState());
    act(() => result.current.setActiveTool("crop"));
    expect(result.current.buildOperation()).toBeNull();
  });

  it("buildOperation returns correct op for levels tool", () => {
    const { result } = renderHook(() => useEditorToolState());
    act(() => result.current.setActiveTool("levels"));
    const op = result.current.buildOperation();
    expect(op).toEqual({
      type: "levels",
      inputBlack: 0,
      inputWhite: 1,
      gamma: 1,
      outputBlack: 0,
      outputWhite: 1,
    });
  });

  it("buildOperation returns correct op for color tools", () => {
    const { result } = renderHook(() => useEditorToolState());

    act(() => result.current.setActiveTool("scnr"));
    expect(result.current.buildOperation()).toEqual({
      type: "scnr",
      method: "averageNeutral",
      amount: 0.5,
    });

    act(() => result.current.setActiveTool("saturation"));
    expect(result.current.buildOperation()).toEqual({
      type: "saturation",
      amount: 0,
    });
  });

  it("param setters update values and buildOperation reflects changes", () => {
    const { result } = renderHook(() => useEditorToolState());
    act(() => {
      result.current.setActiveTool("blur");
      result.current.params.setBlurSigma(7);
    });
    const op = result.current.buildOperation();
    expect(op).toEqual({ type: "blur", sigma: 7 });
  });

  it("setShowCrop toggles crop overlay state", () => {
    const { result } = renderHook(() => useEditorToolState());
    expect(result.current.showCrop).toBe(false);
    act(() => result.current.setShowCrop(true));
    expect(result.current.showCrop).toBe(true);
  });

  it("setActiveToolGroup changes the active tool group", () => {
    const { result } = renderHook(() => useEditorToolState());
    expect(result.current.activeToolGroup).toBe("adjust");
    act(() => result.current.setActiveToolGroup("process"));
    expect(result.current.activeToolGroup).toBe("process");
  });

  it("resetToolParams restores all params to defaults", () => {
    const { result } = renderHook(() => useEditorToolState({ blurSigma: 5 }));
    // Change several params
    act(() => {
      result.current.params.setBlurSigma(8);
      result.current.params.setBrightnessAmount(0.3);
      result.current.params.setContrastFactor(2.0);
      result.current.params.setGammaValue(2.5);
      result.current.params.setDeconvIterations(50);
    });
    expect(result.current.params.blurSigma).toBe(8);
    expect(result.current.params.brightnessAmount).toBe(0.3);
    expect(result.current.params.contrastFactor).toBe(2.0);
    expect(result.current.params.gammaValue).toBe(2.5);
    expect(result.current.params.deconvIterations).toBe(50);

    // Reset
    act(() => result.current.resetToolParams());

    // Should restore to defaults (blurSigma uses custom default 5)
    expect(result.current.params.blurSigma).toBe(5);
    expect(result.current.params.brightnessAmount).toBe(0);
    expect(result.current.params.contrastFactor).toBe(1.0);
    expect(result.current.params.gammaValue).toBe(1.0);
    expect(result.current.params.deconvIterations).toBe(20);
  });
});
