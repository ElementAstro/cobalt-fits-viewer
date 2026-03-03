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

  it("buildOperation uses selected rotate/flip modes", () => {
    const { result } = renderHook(() => useEditorToolState());

    act(() => {
      result.current.params.setRotateMode("rotate180");
      result.current.setActiveTool("rotate");
    });
    expect(result.current.buildOperation()).toEqual({ type: "rotate180" });

    act(() => {
      result.current.params.setFlipMode("flipV");
      result.current.setActiveTool("flip");
    });
    expect(result.current.buildOperation()).toEqual({ type: "flipV" });
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

  it("buildOperation covers newly wired registry operators", () => {
    const { result } = renderHook(() => useEditorToolState());

    act(() => {
      result.current.params.setCosmeticHotSigma(6);
      result.current.params.setCosmeticColdSigma(4.5);
      result.current.params.setCosmeticUseMedian(false);
      result.current.setActiveTool("cosmeticCorrection");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "cosmeticCorrection",
      hotSigma: 6,
      coldSigma: 4.5,
      useMedian: false,
    });

    act(() => {
      result.current.params.setMmtLayers(5);
      result.current.params.setMmtNoiseThreshold(2.5);
      result.current.params.setMmtNoiseReduction(0.3);
      result.current.params.setMmtBias(0.1);
      result.current.setActiveTool("mmt");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "mmt",
      layers: 5,
      noiseThreshold: 2.5,
      noiseReduction: 0.3,
      bias: 0.1,
    });

    act(() => {
      result.current.params.setIntegerBinFactor(3);
      result.current.params.setIntegerBinMode("median");
      result.current.setActiveTool("integerBin");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "integerBin",
      factor: 3,
      mode: "median",
    });

    act(() => {
      result.current.params.setResampleTargetScale(1.5);
      result.current.params.setResampleMethod("bicubic");
      result.current.setActiveTool("resample");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "resample",
      targetScale: 1.5,
      method: "bicubic",
    });

    act(() => {
      result.current.params.setBackgroundNeutralizeUpperLimit(0.22);
      result.current.params.setBackgroundNeutralizeShadowsClip(0.02);
      result.current.setActiveTool("backgroundNeutralize");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "backgroundNeutralize",
      upperLimit: 0.22,
      shadowsClip: 0.02,
    });

    act(() => {
      result.current.params.setPhotometricMinStars(35);
      result.current.params.setPhotometricPercentileLow(0.3);
      result.current.params.setPhotometricPercentileHigh(0.8);
      result.current.setActiveTool("photometricCC");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "photometricCC",
      minStars: 35,
      percentileLow: 0.3,
      percentileHigh: 0.8,
    });

    act(() => {
      result.current.params.setPerHueSaturationAmount(1.4);
      result.current.setActiveTool("perHueSaturation");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "perHueSaturation",
      amount: 1.4,
    });

    act(() => {
      result.current.params.setSelectiveColorTargetHue(180);
      result.current.params.setSelectiveColorHueRange(90);
      result.current.params.setSelectiveColorHueShift(-10);
      result.current.params.setSelectiveColorSatShift(0.2);
      result.current.params.setSelectiveColorLumShift(-0.1);
      result.current.params.setSelectiveColorFeather(0.45);
      result.current.setActiveTool("selectiveColor");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "selectiveColor",
      targetHue: 180,
      hueRange: 90,
      hueShift: -10,
      satShift: 0.2,
      lumShift: -0.1,
      feather: 0.45,
    });
  });

  it("buildOperation includes new clahe and starMask params", () => {
    const { result } = renderHook(() => useEditorToolState());

    act(() => {
      result.current.params.setClaheTileSize(12);
      result.current.params.setClaheClipLimit(4.5);
      result.current.params.setClaheAmount(0.65);
      result.current.setActiveTool("clahe");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "clahe",
      tileSize: 12,
      clipLimit: 4.5,
      amount: 0.65,
    });

    act(() => {
      result.current.params.setStarMaskScale(2.1);
      result.current.params.setStarMaskInvert(true);
      result.current.params.setStarMaskGrowth(3);
      result.current.params.setStarMaskSoftness(1.5);
      result.current.setActiveTool("starMask");
    });
    expect(result.current.buildOperation()).toEqual({
      type: "starMask",
      scale: 2.1,
      invert: true,
      growth: 3,
      softness: 1.5,
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
      result.current.params.setClaheAmount(0.4);
      result.current.params.setStarMaskGrowth(4);
      result.current.params.setStarMaskSoftness(2.5);
      result.current.params.setMltUseLinearMask(false);
      result.current.params.setCosmeticUseMedian(false);
      result.current.params.setIntegerBinMode("sum");
      result.current.params.setBackgroundNeutralizeUpperLimit(0.45);
      result.current.params.setSelectiveColorFeather(0.8);
    });
    expect(result.current.params.blurSigma).toBe(8);
    expect(result.current.params.brightnessAmount).toBe(0.3);
    expect(result.current.params.contrastFactor).toBe(2.0);
    expect(result.current.params.gammaValue).toBe(2.5);
    expect(result.current.params.deconvIterations).toBe(50);
    expect(result.current.params.claheAmount).toBe(0.4);
    expect(result.current.params.starMaskGrowth).toBe(4);
    expect(result.current.params.starMaskSoftness).toBe(2.5);
    expect(result.current.params.mltUseLinearMask).toBe(false);
    expect(result.current.params.cosmeticUseMedian).toBe(false);
    expect(result.current.params.integerBinMode).toBe("sum");
    expect(result.current.params.backgroundNeutralizeUpperLimit).toBe(0.45);
    expect(result.current.params.selectiveColorFeather).toBe(0.8);

    // Reset
    act(() => result.current.resetToolParams());

    // Should restore to defaults (blurSigma uses custom default 5)
    expect(result.current.params.blurSigma).toBe(5);
    expect(result.current.params.rotateMode).toBe("rotate90cw");
    expect(result.current.params.flipMode).toBe("flipH");
    expect(result.current.params.brightnessAmount).toBe(0);
    expect(result.current.params.contrastFactor).toBe(1.0);
    expect(result.current.params.gammaValue).toBe(1.0);
    expect(result.current.params.deconvIterations).toBe(20);
    expect(result.current.params.claheAmount).toBe(1.0);
    expect(result.current.params.starMaskGrowth).toBe(0);
    expect(result.current.params.starMaskSoftness).toBe(0);
    expect(result.current.params.mltUseLinearMask).toBe(true);
    expect(result.current.params.cosmeticUseMedian).toBe(true);
    expect(result.current.params.integerBinMode).toBe("average");
    expect(result.current.params.backgroundNeutralizeUpperLimit).toBe(0.2);
    expect(result.current.params.selectiveColorFeather).toBe(0.3);
  });
});
