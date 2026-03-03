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
  | "cosmeticCorrection"
  | "mmt"
  | "integerBin"
  | "resample"
  | "scnr"
  | "colorCalibration"
  | "backgroundNeutralize"
  | "photometricCC"
  | "perHueSaturation"
  | "selectiveColor"
  | "saturation"
  | "colorBalance"
  | "pixelMath"
  | "ghs"
  | "waveletSharpen"
  | "tgvDenoise"
  | "bilateralFilter"
  | "wienerDeconvolution"
  | "edgeMask"
  | "mlt"
  | null;

export type EditorToolGroup = "geometry" | "adjust" | "process" | "mask";

export type CurvesPreset = "linear" | "sCurve" | "brighten" | "darken" | "highContrast";
export type RotateMode = "rotate90cw" | "rotate90ccw" | "rotate180";
export type FlipMode = "flipH" | "flipV";

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
  rotateMode: RotateMode;
  setRotateMode: (v: RotateMode) => void;
  flipMode: FlipMode;
  setFlipMode: (v: FlipMode) => void;
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
  claheAmount: number;
  setClaheAmount: (v: number) => void;
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
  starMaskGrowth: number;
  setStarMaskGrowth: (v: number) => void;
  starMaskSoftness: number;
  setStarMaskSoftness: (v: number) => void;
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
  cosmeticHotSigma: number;
  setCosmeticHotSigma: (v: number) => void;
  cosmeticColdSigma: number;
  setCosmeticColdSigma: (v: number) => void;
  cosmeticUseMedian: boolean;
  setCosmeticUseMedian: (v: boolean) => void;
  mmtLayers: number;
  setMmtLayers: (v: number) => void;
  mmtNoiseThreshold: number;
  setMmtNoiseThreshold: (v: number) => void;
  mmtNoiseReduction: number;
  setMmtNoiseReduction: (v: number) => void;
  mmtBias: number;
  setMmtBias: (v: number) => void;
  integerBinFactor: number;
  setIntegerBinFactor: (v: number) => void;
  integerBinMode: "average" | "sum" | "median";
  setIntegerBinMode: (v: "average" | "sum" | "median") => void;
  resampleTargetScale: number;
  setResampleTargetScale: (v: number) => void;
  resampleMethod: "bilinear" | "bicubic" | "lanczos3";
  setResampleMethod: (v: "bilinear" | "bicubic" | "lanczos3") => void;
  scnrMethod: "averageNeutral" | "maximumNeutral";
  setScnrMethod: (v: "averageNeutral" | "maximumNeutral") => void;
  scnrAmount: number;
  setScnrAmount: (v: number) => void;
  colorCalibrationPercentile: number;
  setColorCalibrationPercentile: (v: number) => void;
  backgroundNeutralizeUpperLimit: number;
  setBackgroundNeutralizeUpperLimit: (v: number) => void;
  backgroundNeutralizeShadowsClip: number;
  setBackgroundNeutralizeShadowsClip: (v: number) => void;
  photometricMinStars: number;
  setPhotometricMinStars: (v: number) => void;
  photometricPercentileLow: number;
  setPhotometricPercentileLow: (v: number) => void;
  photometricPercentileHigh: number;
  setPhotometricPercentileHigh: (v: number) => void;
  perHueSaturationAmount: number;
  setPerHueSaturationAmount: (v: number) => void;
  selectiveColorTargetHue: number;
  setSelectiveColorTargetHue: (v: number) => void;
  selectiveColorHueRange: number;
  setSelectiveColorHueRange: (v: number) => void;
  selectiveColorHueShift: number;
  setSelectiveColorHueShift: (v: number) => void;
  selectiveColorSatShift: number;
  setSelectiveColorSatShift: (v: number) => void;
  selectiveColorLumShift: number;
  setSelectiveColorLumShift: (v: number) => void;
  selectiveColorFeather: number;
  setSelectiveColorFeather: (v: number) => void;
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
  ghsD: number;
  setGhsD: (v: number) => void;
  ghsB: number;
  setGhsB: (v: number) => void;
  ghsSP: number;
  setGhsSP: (v: number) => void;
  ghsHP: number;
  setGhsHP: (v: number) => void;
  ghsLP: number;
  setGhsLP: (v: number) => void;
  waveletSharpenLayers: number;
  setWaveletSharpenLayers: (v: number) => void;
  waveletSharpenAmount: number;
  setWaveletSharpenAmount: (v: number) => void;
  waveletSharpenProtectStars: boolean;
  setWaveletSharpenProtectStars: (v: boolean) => void;
  tgvStrength: number;
  setTgvStrength: (v: number) => void;
  tgvSmoothness: number;
  setTgvSmoothness: (v: number) => void;
  tgvIterations: number;
  setTgvIterations: (v: number) => void;
  tgvEdgeProtection: number;
  setTgvEdgeProtection: (v: number) => void;
  bilateralSpatialSigma: number;
  setBilateralSpatialSigma: (v: number) => void;
  bilateralRangeSigma: number;
  setBilateralRangeSigma: (v: number) => void;
  wienerPsfSigma: number;
  setWienerPsfSigma: (v: number) => void;
  wienerNoiseRatio: number;
  setWienerNoiseRatio: (v: number) => void;
  edgeMaskPreBlur: number;
  setEdgeMaskPreBlur: (v: number) => void;
  edgeMaskThreshold: number;
  setEdgeMaskThreshold: (v: number) => void;
  edgeMaskPostBlur: number;
  setEdgeMaskPostBlur: (v: number) => void;
  mltLayers: number;
  setMltLayers: (v: number) => void;
  mltNoiseThreshold: number;
  setMltNoiseThreshold: (v: number) => void;
  mltNoiseReduction: number;
  setMltNoiseReduction: (v: number) => void;
  mltBias: number;
  setMltBias: (v: number) => void;
  mltUseLinearMask: boolean;
  setMltUseLinearMask: (v: boolean) => void;
  mltLinearMaskAmplification: number;
  setMltLinearMaskAmplification: (v: number) => void;
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
  const [rotateMode, setRotateMode] = useState<RotateMode>("rotate90cw");
  const [flipMode, setFlipMode] = useState<FlipMode>("flipH");

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
  const [claheAmount, setClaheAmount] = useState(1.0);
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
  const [cosmeticHotSigma, setCosmeticHotSigma] = useState(5);
  const [cosmeticColdSigma, setCosmeticColdSigma] = useState(5);
  const [cosmeticUseMedian, setCosmeticUseMedian] = useState(true);
  const [mmtLayers, setMmtLayers] = useState(4);
  const [mmtNoiseThreshold, setMmtNoiseThreshold] = useState(3);
  const [mmtNoiseReduction, setMmtNoiseReduction] = useState(0.5);
  const [mmtBias, setMmtBias] = useState(0);
  const [integerBinFactor, setIntegerBinFactor] = useState(2);
  const [integerBinMode, setIntegerBinMode] = useState<"average" | "sum" | "median">("average");
  const [resampleTargetScale, setResampleTargetScale] = useState(1);
  const [resampleMethod, setResampleMethod] = useState<"bilinear" | "bicubic" | "lanczos3">(
    "lanczos3",
  );

  // Mask params
  const [starMaskScale, setStarMaskScale] = useState(1.5);
  const [starMaskInvert, setStarMaskInvert] = useState(false);
  const [starMaskGrowth, setStarMaskGrowth] = useState(0);
  const [starMaskSoftness, setStarMaskSoftness] = useState(0);
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
  const [backgroundNeutralizeUpperLimit, setBackgroundNeutralizeUpperLimit] = useState(0.2);
  const [backgroundNeutralizeShadowsClip, setBackgroundNeutralizeShadowsClip] = useState(0.01);
  const [photometricMinStars, setPhotometricMinStars] = useState(20);
  const [photometricPercentileLow, setPhotometricPercentileLow] = useState(0.25);
  const [photometricPercentileHigh, setPhotometricPercentileHigh] = useState(0.75);
  const [perHueSaturationAmount, setPerHueSaturationAmount] = useState(1);
  const [selectiveColorTargetHue, setSelectiveColorTargetHue] = useState(120);
  const [selectiveColorHueRange, setSelectiveColorHueRange] = useState(60);
  const [selectiveColorHueShift, setSelectiveColorHueShift] = useState(0);
  const [selectiveColorSatShift, setSelectiveColorSatShift] = useState(0);
  const [selectiveColorLumShift, setSelectiveColorLumShift] = useState(0);
  const [selectiveColorFeather, setSelectiveColorFeather] = useState(0.3);
  const [saturationAmount, setSaturationAmount] = useState(0);
  const [colorBalanceRedGain, setColorBalanceRedGain] = useState(1);
  const [colorBalanceGreenGain, setColorBalanceGreenGain] = useState(1);
  const [colorBalanceBlueGain, setColorBalanceBlueGain] = useState(1);

  // GHS params
  const [ghsD, setGhsD] = useState(1);
  const [ghsB, setGhsB] = useState(0.25);
  const [ghsSP, setGhsSP] = useState(0);
  const [ghsHP, setGhsHP] = useState(0);
  const [ghsLP, setGhsLP] = useState(0);

  // Wavelet Sharpen params
  const [waveletSharpenLayers, setWaveletSharpenLayers] = useState(3);
  const [waveletSharpenAmount, setWaveletSharpenAmount] = useState(1.5);
  const [waveletSharpenProtectStars, setWaveletSharpenProtectStars] = useState(false);

  // TGV Denoise params
  const [tgvStrength, setTgvStrength] = useState(2);
  const [tgvSmoothness, setTgvSmoothness] = useState(2);
  const [tgvIterations, setTgvIterations] = useState(200);
  const [tgvEdgeProtection, setTgvEdgeProtection] = useState(0.5);

  // Bilateral Filter params
  const [bilateralSpatialSigma, setBilateralSpatialSigma] = useState(2);
  const [bilateralRangeSigma, setBilateralRangeSigma] = useState(0.1);

  // Wiener Deconvolution params
  const [wienerPsfSigma, setWienerPsfSigma] = useState(2);
  const [wienerNoiseRatio, setWienerNoiseRatio] = useState(0.01);

  // Edge Mask params
  const [edgeMaskPreBlur, setEdgeMaskPreBlur] = useState(1);
  const [edgeMaskThreshold, setEdgeMaskThreshold] = useState(0.1);
  const [edgeMaskPostBlur, setEdgeMaskPostBlur] = useState(1);

  // MLT params
  const [mltLayers, setMltLayers] = useState(4);
  const [mltNoiseThreshold, setMltNoiseThreshold] = useState(3);
  const [mltNoiseReduction, setMltNoiseReduction] = useState(0.5);
  const [mltBias, setMltBias] = useState(0);
  const [mltUseLinearMask, setMltUseLinearMask] = useState(true);
  const [mltLinearMaskAmplification, setMltLinearMaskAmplification] = useState(200);

  const buildOperation = useCallback((): ImageEditOperation | null => {
    if (!activeTool) return null;

    switch (activeTool) {
      case "rotate":
        return { type: rotateMode };
      case "flip":
        return { type: flipMode };
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
        return {
          type: "clahe",
          tileSize: claheTileSize,
          clipLimit: claheClipLimit,
          amount: claheAmount,
        };
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
        return {
          type: "starMask",
          scale: starMaskScale,
          invert: starMaskInvert,
          growth: starMaskGrowth,
          softness: starMaskSoftness,
        };
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
      case "cosmeticCorrection":
        return {
          type: "cosmeticCorrection",
          hotSigma: cosmeticHotSigma,
          coldSigma: cosmeticColdSigma,
          useMedian: cosmeticUseMedian,
        };
      case "mmt":
        return {
          type: "mmt",
          layers: mmtLayers,
          noiseThreshold: mmtNoiseThreshold,
          noiseReduction: mmtNoiseReduction,
          bias: mmtBias,
        };
      case "integerBin":
        return {
          type: "integerBin",
          factor: integerBinFactor,
          mode: integerBinMode,
        };
      case "resample":
        return {
          type: "resample",
          targetScale: resampleTargetScale,
          method: resampleMethod,
        };
      case "scnr":
        return { type: "scnr", method: scnrMethod, amount: scnrAmount };
      case "colorCalibration":
        return { type: "colorCalibration", percentile: colorCalibrationPercentile };
      case "backgroundNeutralize":
        return {
          type: "backgroundNeutralize",
          upperLimit: backgroundNeutralizeUpperLimit,
          shadowsClip: backgroundNeutralizeShadowsClip,
        } as ImageEditOperation;
      case "photometricCC":
        return {
          type: "photometricCC",
          minStars: photometricMinStars,
          percentileLow: photometricPercentileLow,
          percentileHigh: photometricPercentileHigh,
        } as ImageEditOperation;
      case "perHueSaturation":
        return { type: "perHueSaturation", amount: perHueSaturationAmount } as ImageEditOperation;
      case "selectiveColor":
        return {
          type: "selectiveColor",
          targetHue: selectiveColorTargetHue,
          hueRange: selectiveColorHueRange,
          hueShift: selectiveColorHueShift,
          satShift: selectiveColorSatShift,
          lumShift: selectiveColorLumShift,
          feather: selectiveColorFeather,
        } as ImageEditOperation;
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
      case "ghs":
        return { type: "ghs", D: ghsD, b: ghsB, SP: ghsSP, HP: ghsHP, LP: ghsLP };
      case "waveletSharpen":
        return {
          type: "waveletSharpen",
          layers: waveletSharpenLayers,
          amount: waveletSharpenAmount,
          protectStars: waveletSharpenProtectStars,
        };
      case "tgvDenoise":
        return {
          type: "tgvDenoise",
          strength: tgvStrength,
          smoothness: tgvSmoothness,
          iterations: tgvIterations,
          edgeProtection: tgvEdgeProtection,
        };
      case "bilateralFilter":
        return {
          type: "bilateralFilter",
          spatialSigma: bilateralSpatialSigma,
          rangeSigma: bilateralRangeSigma,
        };
      case "wienerDeconvolution":
        return {
          type: "wienerDeconvolution",
          psfSigma: wienerPsfSigma,
          noiseRatio: wienerNoiseRatio,
        };
      case "edgeMask":
        return {
          type: "edgeMask",
          preBlurSigma: edgeMaskPreBlur,
          threshold: edgeMaskThreshold,
          postBlurSigma: edgeMaskPostBlur,
        };
      case "mlt":
        return {
          type: "mlt",
          layers: mltLayers,
          noiseThreshold: mltNoiseThreshold,
          noiseReduction: mltNoiseReduction,
          bias: mltBias,
          useLinearMask: mltUseLinearMask,
          linearMaskAmplification: mltLinearMaskAmplification,
        };
      default:
        return null;
    }
  }, [
    activeTool,
    rotateMode,
    flipMode,
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
    claheAmount,
    hdrLayers,
    hdrAmount,
    morphOp,
    morphRadius,
    starMaskScale,
    starMaskInvert,
    starMaskGrowth,
    starMaskSoftness,
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
    cosmeticHotSigma,
    cosmeticColdSigma,
    cosmeticUseMedian,
    mmtLayers,
    mmtNoiseThreshold,
    mmtNoiseReduction,
    mmtBias,
    integerBinFactor,
    integerBinMode,
    resampleTargetScale,
    resampleMethod,
    scnrMethod,
    scnrAmount,
    colorCalibrationPercentile,
    backgroundNeutralizeUpperLimit,
    backgroundNeutralizeShadowsClip,
    photometricMinStars,
    photometricPercentileLow,
    photometricPercentileHigh,
    perHueSaturationAmount,
    selectiveColorTargetHue,
    selectiveColorHueRange,
    selectiveColorHueShift,
    selectiveColorSatShift,
    selectiveColorLumShift,
    selectiveColorFeather,
    saturationAmount,
    colorBalanceRedGain,
    colorBalanceGreenGain,
    colorBalanceBlueGain,
    pixelMathExpr,
    curvesPreset,
    ghsD,
    ghsB,
    ghsSP,
    ghsHP,
    ghsLP,
    waveletSharpenLayers,
    waveletSharpenAmount,
    waveletSharpenProtectStars,
    tgvStrength,
    tgvSmoothness,
    tgvIterations,
    tgvEdgeProtection,
    bilateralSpatialSigma,
    bilateralRangeSigma,
    wienerPsfSigma,
    wienerNoiseRatio,
    edgeMaskPreBlur,
    edgeMaskThreshold,
    edgeMaskPostBlur,
    mltLayers,
    mltNoiseThreshold,
    mltNoiseReduction,
    mltBias,
    mltUseLinearMask,
    mltLinearMaskAmplification,
  ]);

  const params: EditorToolParams = {
    rotateMode,
    setRotateMode,
    flipMode,
    setFlipMode,
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
    claheAmount,
    setClaheAmount,
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
    starMaskGrowth,
    setStarMaskGrowth,
    starMaskSoftness,
    setStarMaskSoftness,
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
    cosmeticHotSigma,
    setCosmeticHotSigma,
    cosmeticColdSigma,
    setCosmeticColdSigma,
    cosmeticUseMedian,
    setCosmeticUseMedian,
    mmtLayers,
    setMmtLayers,
    mmtNoiseThreshold,
    setMmtNoiseThreshold,
    mmtNoiseReduction,
    setMmtNoiseReduction,
    mmtBias,
    setMmtBias,
    integerBinFactor,
    setIntegerBinFactor,
    integerBinMode,
    setIntegerBinMode,
    resampleTargetScale,
    setResampleTargetScale,
    resampleMethod,
    setResampleMethod,
    scnrMethod,
    setScnrMethod,
    scnrAmount,
    setScnrAmount,
    colorCalibrationPercentile,
    setColorCalibrationPercentile,
    backgroundNeutralizeUpperLimit,
    setBackgroundNeutralizeUpperLimit,
    backgroundNeutralizeShadowsClip,
    setBackgroundNeutralizeShadowsClip,
    photometricMinStars,
    setPhotometricMinStars,
    photometricPercentileLow,
    setPhotometricPercentileLow,
    photometricPercentileHigh,
    setPhotometricPercentileHigh,
    perHueSaturationAmount,
    setPerHueSaturationAmount,
    selectiveColorTargetHue,
    setSelectiveColorTargetHue,
    selectiveColorHueRange,
    setSelectiveColorHueRange,
    selectiveColorHueShift,
    setSelectiveColorHueShift,
    selectiveColorSatShift,
    setSelectiveColorSatShift,
    selectiveColorLumShift,
    setSelectiveColorLumShift,
    selectiveColorFeather,
    setSelectiveColorFeather,
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
    ghsD,
    setGhsD,
    ghsB,
    setGhsB,
    ghsSP,
    setGhsSP,
    ghsHP,
    setGhsHP,
    ghsLP,
    setGhsLP,
    waveletSharpenLayers,
    setWaveletSharpenLayers,
    waveletSharpenAmount,
    setWaveletSharpenAmount,
    waveletSharpenProtectStars,
    setWaveletSharpenProtectStars,
    tgvStrength,
    setTgvStrength,
    tgvSmoothness,
    setTgvSmoothness,
    tgvIterations,
    setTgvIterations,
    tgvEdgeProtection,
    setTgvEdgeProtection,
    bilateralSpatialSigma,
    setBilateralSpatialSigma,
    bilateralRangeSigma,
    setBilateralRangeSigma,
    wienerPsfSigma,
    setWienerPsfSigma,
    wienerNoiseRatio,
    setWienerNoiseRatio,
    edgeMaskPreBlur,
    setEdgeMaskPreBlur,
    edgeMaskThreshold,
    setEdgeMaskThreshold,
    edgeMaskPostBlur,
    setEdgeMaskPostBlur,
    mltLayers,
    setMltLayers,
    mltNoiseThreshold,
    setMltNoiseThreshold,
    mltNoiseReduction,
    setMltNoiseReduction,
    mltBias,
    setMltBias,
    mltUseLinearMask,
    setMltUseLinearMask,
    mltLinearMaskAmplification,
    setMltLinearMaskAmplification,
  };

  const resetToolParams = useCallback(() => {
    setRotateAngle(0);
    setBgGridSize(8);
    setRotateMode("rotate90cw");
    setFlipMode("flipH");
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
    setClaheAmount(1.0);
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
    setCosmeticHotSigma(5);
    setCosmeticColdSigma(5);
    setCosmeticUseMedian(true);
    setMmtLayers(4);
    setMmtNoiseThreshold(3);
    setMmtNoiseReduction(0.5);
    setMmtBias(0);
    setIntegerBinFactor(2);
    setIntegerBinMode("average");
    setResampleTargetScale(1);
    setResampleMethod("lanczos3");
    setStarMaskScale(1.5);
    setStarMaskInvert(false);
    setStarMaskGrowth(0);
    setStarMaskSoftness(0);
    setRangeMaskLow(0);
    setRangeMaskHigh(1);
    setRangeMaskFuzz(0.1);
    setBinarizeThreshold(0.5);
    setPixelMathExpr("$T");
    setScnrMethod("averageNeutral");
    setScnrAmount(0.5);
    setColorCalibrationPercentile(0.92);
    setBackgroundNeutralizeUpperLimit(0.2);
    setBackgroundNeutralizeShadowsClip(0.01);
    setPhotometricMinStars(20);
    setPhotometricPercentileLow(0.25);
    setPhotometricPercentileHigh(0.75);
    setPerHueSaturationAmount(1);
    setSelectiveColorTargetHue(120);
    setSelectiveColorHueRange(60);
    setSelectiveColorHueShift(0);
    setSelectiveColorSatShift(0);
    setSelectiveColorLumShift(0);
    setSelectiveColorFeather(0.3);
    setSaturationAmount(0);
    setColorBalanceRedGain(1);
    setColorBalanceGreenGain(1);
    setColorBalanceBlueGain(1);
    setGhsD(1);
    setGhsB(0.25);
    setGhsSP(0);
    setGhsHP(0);
    setGhsLP(0);
    setWaveletSharpenLayers(3);
    setWaveletSharpenAmount(1.5);
    setWaveletSharpenProtectStars(false);
    setTgvStrength(2);
    setTgvSmoothness(2);
    setTgvIterations(200);
    setTgvEdgeProtection(0.5);
    setBilateralSpatialSigma(2);
    setBilateralRangeSigma(0.1);
    setWienerPsfSigma(2);
    setWienerNoiseRatio(0.01);
    setEdgeMaskPreBlur(1);
    setEdgeMaskThreshold(0.1);
    setEdgeMaskPostBlur(1);
    setMltLayers(4);
    setMltNoiseThreshold(3);
    setMltNoiseReduction(0.5);
    setMltBias(0);
    setMltUseLinearMask(true);
    setMltLinearMaskAmplification(200);
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
