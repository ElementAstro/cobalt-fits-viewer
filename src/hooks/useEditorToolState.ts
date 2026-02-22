import { useState, useCallback } from "react";
import type { ImageEditOperation } from "../lib/utils/imageOperations";

export type EditorTool =
  | "crop"
  | "rotate"
  | "flip"
  | "invert"
  | "blur"
  | "sharpen"
  | "denoise"
  | "histogram"
  | "brightness"
  | "contrast"
  | "gamma"
  | "levels"
  | "background"
  | "rotateCustom"
  | "mtf"
  | "curves"
  | "clahe"
  | "hdr"
  | "morphology"
  | "starMask"
  | "rangeMask"
  | "binarize"
  | "rescale"
  | "deconvolution"
  | "dbe"
  | "multiscaleDenoise"
  | "localContrast"
  | "starReduction"
  | "deconvolutionAuto"
  | "scnr"
  | "colorCalibration"
  | "saturation"
  | "colorBalance"
  | "pixelMath"
  | null;

export type EditorToolGroup = "geometry" | "adjust" | "process" | "mask";

export type CurvesPreset = "linear" | "sCurve" | "brighten" | "darken" | "highContrast";

const CURVE_PRESETS: Record<string, { x: number; y: number }[]> = {
  linear: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
  sCurve: [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.15 },
    { x: 0.5, y: 0.5 },
    { x: 0.75, y: 0.85 },
    { x: 1, y: 1 },
  ],
  brighten: [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.35 },
    { x: 0.5, y: 0.65 },
    { x: 0.75, y: 0.85 },
    { x: 1, y: 1 },
  ],
  darken: [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.15 },
    { x: 0.5, y: 0.35 },
    { x: 0.75, y: 0.65 },
    { x: 1, y: 1 },
  ],
  highContrast: [
    { x: 0, y: 0 },
    { x: 0.2, y: 0.05 },
    { x: 0.5, y: 0.5 },
    { x: 0.8, y: 0.95 },
    { x: 1, y: 1 },
  ],
};

export interface EditorToolDefaults {
  blurSigma?: number;
  sharpenAmount?: number;
  denoiseRadius?: number;
}

export interface EditorToolParams {
  blurSigma: number;
  setBlurSigma: (v: number) => void;
  sharpenAmount: number;
  setSharpenAmount: (v: number) => void;
  sharpenSigma: number;
  setSharpenSigma: (v: number) => void;
  denoiseRadius: number;
  setDenoiseRadius: (v: number) => void;
  brightnessAmount: number;
  setBrightnessAmount: (v: number) => void;
  contrastFactor: number;
  setContrastFactor: (v: number) => void;
  gammaValue: number;
  setGammaValue: (v: number) => void;
  levelsInputBlack: number;
  setLevelsInputBlack: (v: number) => void;
  levelsInputWhite: number;
  setLevelsInputWhite: (v: number) => void;
  levelsGamma: number;
  setLevelsGamma: (v: number) => void;
  bgGridSize: number;
  setBgGridSize: (v: number) => void;
  rotateAngle: number;
  setRotateAngle: (v: number) => void;
  mtfMidtone: number;
  setMtfMidtone: (v: number) => void;
  mtfShadows: number;
  setMtfShadows: (v: number) => void;
  mtfHighlights: number;
  setMtfHighlights: (v: number) => void;
  claheTileSize: number;
  setClaheTileSize: (v: number) => void;
  claheClipLimit: number;
  setClaheClipLimit: (v: number) => void;
  hdrLayers: number;
  setHdrLayers: (v: number) => void;
  hdrAmount: number;
  setHdrAmount: (v: number) => void;
  morphOp: "erode" | "dilate" | "open" | "close";
  setMorphOp: (v: "erode" | "dilate" | "open" | "close") => void;
  morphRadius: number;
  setMorphRadius: (v: number) => void;
  starMaskScale: number;
  setStarMaskScale: (v: number) => void;
  starMaskInvert: boolean;
  setStarMaskInvert: (v: boolean) => void;
  rangeMaskLow: number;
  setRangeMaskLow: (v: number) => void;
  rangeMaskHigh: number;
  setRangeMaskHigh: (v: number) => void;
  rangeMaskFuzz: number;
  setRangeMaskFuzz: (v: number) => void;
  binarizeThreshold: number;
  setBinarizeThreshold: (v: number) => void;
  deconvPsfSigma: number;
  setDeconvPsfSigma: (v: number) => void;
  deconvIterations: number;
  setDeconvIterations: (v: number) => void;
  deconvRegularization: number;
  setDeconvRegularization: (v: number) => void;
  dbeSamplesX: number;
  setDbeSamplesX: (v: number) => void;
  dbeSamplesY: number;
  setDbeSamplesY: (v: number) => void;
  dbeSigma: number;
  setDbeSigma: (v: number) => void;
  multiscaleLayers: number;
  setMultiscaleLayers: (v: number) => void;
  multiscaleThreshold: number;
  setMultiscaleThreshold: (v: number) => void;
  localContrastSigma: number;
  setLocalContrastSigma: (v: number) => void;
  localContrastAmount: number;
  setLocalContrastAmount: (v: number) => void;
  starReductionScale: number;
  setStarReductionScale: (v: number) => void;
  starReductionStrength: number;
  setStarReductionStrength: (v: number) => void;
  deconvAutoIterations: number;
  setDeconvAutoIterations: (v: number) => void;
  deconvAutoRegularization: number;
  setDeconvAutoRegularization: (v: number) => void;
  scnrMethod: "averageNeutral" | "maximumNeutral";
  setScnrMethod: (v: "averageNeutral" | "maximumNeutral") => void;
  scnrAmount: number;
  setScnrAmount: (v: number) => void;
  colorCalibrationPercentile: number;
  setColorCalibrationPercentile: (v: number) => void;
  saturationAmount: number;
  setSaturationAmount: (v: number) => void;
  colorBalanceRedGain: number;
  setColorBalanceRedGain: (v: number) => void;
  colorBalanceGreenGain: number;
  setColorBalanceGreenGain: (v: number) => void;
  colorBalanceBlueGain: number;
  setColorBalanceBlueGain: (v: number) => void;
  pixelMathExpr: string;
  setPixelMathExpr: (v: string) => void;
  curvesPreset: CurvesPreset;
  setCurvesPreset: (v: CurvesPreset) => void;
}

export interface UseEditorToolStateReturn {
  activeTool: EditorTool;
  setActiveTool: (tool: EditorTool) => void;
  activeToolGroup: EditorToolGroup;
  setActiveToolGroup: (group: EditorToolGroup) => void;
  showCrop: boolean;
  setShowCrop: (v: boolean) => void;
  params: EditorToolParams;
  buildOperation: () => ImageEditOperation | null;
  resetToolParams: () => void;
}

export function useEditorToolState(defaults: EditorToolDefaults = {}): UseEditorToolStateReturn {
  const [activeTool, setActiveTool] = useState<EditorTool>(null);
  const [activeToolGroup, setActiveToolGroup] = useState<EditorToolGroup>("adjust");
  const [showCrop, setShowCrop] = useState(false);

  // Geometry params
  const [rotateAngle, setRotateAngle] = useState(0);
  const [bgGridSize, setBgGridSize] = useState(8);

  // Basic adjust params
  const [blurSigma, setBlurSigma] = useState(defaults.blurSigma ?? 2);
  const [sharpenAmount, setSharpenAmount] = useState(defaults.sharpenAmount ?? 1.5);
  const [sharpenSigma, setSharpenSigma] = useState(1.0);
  const [denoiseRadius, setDenoiseRadius] = useState(defaults.denoiseRadius ?? 1);
  const [brightnessAmount, setBrightnessAmount] = useState(0);
  const [contrastFactor, setContrastFactor] = useState(1.0);
  const [gammaValue, setGammaValue] = useState(1.0);
  const [levelsInputBlack, setLevelsInputBlack] = useState(0);
  const [levelsInputWhite, setLevelsInputWhite] = useState(1);
  const [levelsGamma, setLevelsGamma] = useState(1.0);

  // Advanced adjust params
  const [mtfMidtone, setMtfMidtone] = useState(0.25);
  const [mtfShadows, setMtfShadows] = useState(0);
  const [mtfHighlights, setMtfHighlights] = useState(1);
  const [curvesPreset, setCurvesPreset] = useState<CurvesPreset>("sCurve");

  // Process params
  const [claheTileSize, setClaheTileSize] = useState(8);
  const [claheClipLimit, setClaheClipLimit] = useState(3.0);
  const [hdrLayers, setHdrLayers] = useState(5);
  const [hdrAmount, setHdrAmount] = useState(0.7);
  const [morphOp, setMorphOp] = useState<"erode" | "dilate" | "open" | "close">("dilate");
  const [morphRadius, setMorphRadius] = useState(1);
  const [deconvPsfSigma, setDeconvPsfSigma] = useState(2.0);
  const [deconvIterations, setDeconvIterations] = useState(20);
  const [deconvRegularization, setDeconvRegularization] = useState(0.1);
  const [dbeSamplesX, setDbeSamplesX] = useState(12);
  const [dbeSamplesY, setDbeSamplesY] = useState(8);
  const [dbeSigma, setDbeSigma] = useState(2.5);
  const [multiscaleLayers, setMultiscaleLayers] = useState(4);
  const [multiscaleThreshold, setMultiscaleThreshold] = useState(2.5);
  const [localContrastSigma, setLocalContrastSigma] = useState(8);
  const [localContrastAmount, setLocalContrastAmount] = useState(0.35);
  const [starReductionScale, setStarReductionScale] = useState(1.2);
  const [starReductionStrength, setStarReductionStrength] = useState(0.6);
  const [deconvAutoIterations, setDeconvAutoIterations] = useState(20);
  const [deconvAutoRegularization, setDeconvAutoRegularization] = useState(0.1);

  // Mask params
  const [starMaskScale, setStarMaskScale] = useState(1.5);
  const [starMaskInvert, setStarMaskInvert] = useState(false);
  const [rangeMaskLow, setRangeMaskLow] = useState(0);
  const [rangeMaskHigh, setRangeMaskHigh] = useState(1);
  const [rangeMaskFuzz, setRangeMaskFuzz] = useState(0.1);
  const [binarizeThreshold, setBinarizeThreshold] = useState(0.5);
  const [pixelMathExpr, setPixelMathExpr] = useState("$T");

  // Color params
  const [scnrMethod, setScnrMethod] = useState<"averageNeutral" | "maximumNeutral">(
    "averageNeutral",
  );
  const [scnrAmount, setScnrAmount] = useState(0.5);
  const [colorCalibrationPercentile, setColorCalibrationPercentile] = useState(0.92);
  const [saturationAmount, setSaturationAmount] = useState(0);
  const [colorBalanceRedGain, setColorBalanceRedGain] = useState(1);
  const [colorBalanceGreenGain, setColorBalanceGreenGain] = useState(1);
  const [colorBalanceBlueGain, setColorBalanceBlueGain] = useState(1);

  const buildOperation = useCallback((): ImageEditOperation | null => {
    if (!activeTool) return null;

    switch (activeTool) {
      case "rotate":
        return { type: "rotate90cw" };
      case "flip":
        return { type: "flipH" };
      case "invert":
        return { type: "invert" };
      case "blur":
        return { type: "blur", sigma: blurSigma };
      case "sharpen":
        return { type: "sharpen", amount: sharpenAmount, sigma: sharpenSigma };
      case "denoise":
        return { type: "denoise", radius: denoiseRadius };
      case "histogram":
        return { type: "histogramEq" };
      case "brightness":
        return { type: "brightness", amount: brightnessAmount };
      case "contrast":
        return { type: "contrast", factor: contrastFactor };
      case "gamma":
        return { type: "gamma", gamma: gammaValue };
      case "levels":
        return {
          type: "levels",
          inputBlack: levelsInputBlack,
          inputWhite: levelsInputWhite,
          gamma: levelsGamma,
          outputBlack: 0,
          outputWhite: 1,
        };
      case "background":
        return { type: "backgroundExtract", gridSize: bgGridSize };
      case "rotateCustom":
        return { type: "rotateArbitrary", angle: rotateAngle };
      case "crop":
        return null;
      case "mtf":
        return {
          type: "mtf",
          midtone: mtfMidtone,
          shadowsClip: mtfShadows,
          highlightsClip: mtfHighlights,
        };
      case "clahe":
        return { type: "clahe", tileSize: claheTileSize, clipLimit: claheClipLimit };
      case "curves":
        return {
          type: "curves",
          points: CURVE_PRESETS[curvesPreset] ?? CURVE_PRESETS.sCurve,
        };
      case "hdr":
        return { type: "hdr", layers: hdrLayers, amount: hdrAmount };
      case "morphology":
        return { type: "morphology", operation: morphOp, radius: morphRadius };
      case "starMask":
        return { type: "starMask", scale: starMaskScale, invert: starMaskInvert };
      case "rangeMask":
        return {
          type: "rangeMask",
          low: rangeMaskLow,
          high: rangeMaskHigh,
          fuzziness: rangeMaskFuzz,
        };
      case "binarize":
        return { type: "binarize", threshold: binarizeThreshold };
      case "rescale":
        return { type: "rescale" };
      case "deconvolution":
        return {
          type: "deconvolution",
          psfSigma: deconvPsfSigma,
          iterations: deconvIterations,
          regularization: deconvRegularization,
        };
      case "dbe":
        return { type: "dbe", samplesX: dbeSamplesX, samplesY: dbeSamplesY, sigma: dbeSigma };
      case "multiscaleDenoise":
        return {
          type: "multiscaleDenoise",
          layers: multiscaleLayers,
          threshold: multiscaleThreshold,
        };
      case "localContrast":
        return { type: "localContrast", sigma: localContrastSigma, amount: localContrastAmount };
      case "starReduction":
        return {
          type: "starReduction",
          scale: starReductionScale,
          strength: starReductionStrength,
        };
      case "deconvolutionAuto":
        return {
          type: "deconvolutionAuto",
          iterations: deconvAutoIterations,
          regularization: deconvAutoRegularization,
        };
      case "scnr":
        return { type: "scnr", method: scnrMethod, amount: scnrAmount };
      case "colorCalibration":
        return { type: "colorCalibration", percentile: colorCalibrationPercentile };
      case "saturation":
        return { type: "saturation", amount: saturationAmount };
      case "colorBalance":
        return {
          type: "colorBalance",
          redGain: colorBalanceRedGain,
          greenGain: colorBalanceGreenGain,
          blueGain: colorBalanceBlueGain,
        };
      case "pixelMath":
        return { type: "pixelMath", expression: pixelMathExpr };
      default:
        return null;
    }
  }, [
    activeTool,
    blurSigma,
    sharpenAmount,
    sharpenSigma,
    denoiseRadius,
    brightnessAmount,
    contrastFactor,
    gammaValue,
    levelsInputBlack,
    levelsInputWhite,
    levelsGamma,
    bgGridSize,
    rotateAngle,
    mtfMidtone,
    mtfShadows,
    mtfHighlights,
    claheTileSize,
    claheClipLimit,
    hdrLayers,
    hdrAmount,
    morphOp,
    morphRadius,
    starMaskScale,
    starMaskInvert,
    rangeMaskLow,
    rangeMaskHigh,
    rangeMaskFuzz,
    binarizeThreshold,
    deconvPsfSigma,
    deconvIterations,
    deconvRegularization,
    dbeSamplesX,
    dbeSamplesY,
    dbeSigma,
    multiscaleLayers,
    multiscaleThreshold,
    localContrastSigma,
    localContrastAmount,
    starReductionScale,
    starReductionStrength,
    deconvAutoIterations,
    deconvAutoRegularization,
    scnrMethod,
    scnrAmount,
    colorCalibrationPercentile,
    saturationAmount,
    colorBalanceRedGain,
    colorBalanceGreenGain,
    colorBalanceBlueGain,
    pixelMathExpr,
    curvesPreset,
  ]);

  const params: EditorToolParams = {
    blurSigma,
    setBlurSigma,
    sharpenAmount,
    setSharpenAmount,
    sharpenSigma,
    setSharpenSigma,
    denoiseRadius,
    setDenoiseRadius,
    brightnessAmount,
    setBrightnessAmount,
    contrastFactor,
    setContrastFactor,
    gammaValue,
    setGammaValue,
    levelsInputBlack,
    setLevelsInputBlack,
    levelsInputWhite,
    setLevelsInputWhite,
    levelsGamma,
    setLevelsGamma,
    bgGridSize,
    setBgGridSize,
    rotateAngle,
    setRotateAngle,
    mtfMidtone,
    setMtfMidtone,
    mtfShadows,
    setMtfShadows,
    mtfHighlights,
    setMtfHighlights,
    claheTileSize,
    setClaheTileSize,
    claheClipLimit,
    setClaheClipLimit,
    hdrLayers,
    setHdrLayers,
    hdrAmount,
    setHdrAmount,
    morphOp,
    setMorphOp,
    morphRadius,
    setMorphRadius,
    starMaskScale,
    setStarMaskScale,
    starMaskInvert,
    setStarMaskInvert,
    rangeMaskLow,
    setRangeMaskLow,
    rangeMaskHigh,
    setRangeMaskHigh,
    rangeMaskFuzz,
    setRangeMaskFuzz,
    binarizeThreshold,
    setBinarizeThreshold,
    deconvPsfSigma,
    setDeconvPsfSigma,
    deconvIterations,
    setDeconvIterations,
    deconvRegularization,
    setDeconvRegularization,
    dbeSamplesX,
    setDbeSamplesX,
    dbeSamplesY,
    setDbeSamplesY,
    dbeSigma,
    setDbeSigma,
    multiscaleLayers,
    setMultiscaleLayers,
    multiscaleThreshold,
    setMultiscaleThreshold,
    localContrastSigma,
    setLocalContrastSigma,
    localContrastAmount,
    setLocalContrastAmount,
    starReductionScale,
    setStarReductionScale,
    starReductionStrength,
    setStarReductionStrength,
    deconvAutoIterations,
    setDeconvAutoIterations,
    deconvAutoRegularization,
    setDeconvAutoRegularization,
    scnrMethod,
    setScnrMethod,
    scnrAmount,
    setScnrAmount,
    colorCalibrationPercentile,
    setColorCalibrationPercentile,
    saturationAmount,
    setSaturationAmount,
    colorBalanceRedGain,
    setColorBalanceRedGain,
    colorBalanceGreenGain,
    setColorBalanceGreenGain,
    colorBalanceBlueGain,
    setColorBalanceBlueGain,
    pixelMathExpr,
    setPixelMathExpr,
    curvesPreset,
    setCurvesPreset,
  };

  const resetToolParams = useCallback(() => {
    setRotateAngle(0);
    setBgGridSize(8);
    setBlurSigma(defaults.blurSigma ?? 2);
    setSharpenAmount(defaults.sharpenAmount ?? 1.5);
    setSharpenSigma(1.0);
    setDenoiseRadius(defaults.denoiseRadius ?? 1);
    setBrightnessAmount(0);
    setContrastFactor(1.0);
    setGammaValue(1.0);
    setLevelsInputBlack(0);
    setLevelsInputWhite(1);
    setLevelsGamma(1.0);
    setMtfMidtone(0.25);
    setMtfShadows(0);
    setMtfHighlights(1);
    setCurvesPreset("sCurve");
    setClaheTileSize(8);
    setClaheClipLimit(3.0);
    setHdrLayers(5);
    setHdrAmount(0.7);
    setMorphOp("dilate");
    setMorphRadius(1);
    setDeconvPsfSigma(2.0);
    setDeconvIterations(20);
    setDeconvRegularization(0.1);
    setDbeSamplesX(12);
    setDbeSamplesY(8);
    setDbeSigma(2.5);
    setMultiscaleLayers(4);
    setMultiscaleThreshold(2.5);
    setLocalContrastSigma(8);
    setLocalContrastAmount(0.35);
    setStarReductionScale(1.2);
    setStarReductionStrength(0.6);
    setDeconvAutoIterations(20);
    setDeconvAutoRegularization(0.1);
    setStarMaskScale(1.5);
    setStarMaskInvert(false);
    setRangeMaskLow(0);
    setRangeMaskHigh(1);
    setRangeMaskFuzz(0.1);
    setBinarizeThreshold(0.5);
    setPixelMathExpr("$T");
    setScnrMethod("averageNeutral");
    setScnrAmount(0.5);
    setColorCalibrationPercentile(0.92);
    setSaturationAmount(0);
    setColorBalanceRedGain(1);
    setColorBalanceGreenGain(1);
    setColorBalanceBlueGain(1);
  }, [defaults.blurSigma, defaults.sharpenAmount, defaults.denoiseRadius]);

  return {
    activeTool,
    setActiveTool,
    activeToolGroup,
    setActiveToolGroup,
    showCrop,
    setShowCrop,
    params,
    buildOperation,
    resetToolParams,
  };
}
