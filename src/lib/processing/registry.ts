import type { ProcessingOperationId, ProcessingParamValue } from "../fits/types";
import type {
  ProcessingImageState,
  ProcessingOperationSchema,
  ProcessingParamSchema,
} from "./types";
import {
  rotate90CW,
  rotate90CCW,
  rotate180,
  flipHorizontal,
  flipVertical,
  invertPixels,
  gaussianBlur,
  sharpen,
  medianFilter,
  histogramEqualize,
  cropImage,
  adjustBrightness,
  adjustContrast,
  adjustGamma,
  applyLevels,
  rotateArbitrary,
  extractBackground,
  applyMTF,
  applyStarMask,
  binarize,
  rescalePixels,
  clahe,
  applyCurves,
  morphologicalOp,
  hdrMultiscaleTransform,
  applyRangeMask,
  evaluatePixelExpression,
  richardsonLucy,
  dynamicBackgroundExtract,
  multiscaleDenoise,
  localContrastEnhancement,
  starReduction,
  deconvolutionAuto,
  type ImageEditOperation,
} from "../utils/imageOperations";

function asNumber(params: Record<string, ProcessingParamValue>, key: string, fallback: number) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(params: Record<string, ProcessingParamValue>, key: string, fallback: boolean) {
  const value = params[key];
  return typeof value === "boolean" ? value : fallback;
}

function asString(params: Record<string, ProcessingParamValue>, key: string, fallback: string) {
  const value = params[key];
  return typeof value === "string" ? value : fallback;
}

function asPointList(
  params: Record<string, ProcessingParamValue>,
  key: string,
  fallback: Array<{ x: number; y: number }>,
) {
  const value = params[key];
  if (!Array.isArray(value)) return fallback;
  const points = value.filter(
    (item): item is { x: number; y: number } =>
      typeof item === "object" &&
      item !== null &&
      "x" in item &&
      "y" in item &&
      typeof item.x === "number" &&
      typeof item.y === "number",
  );
  return points.length >= 2 ? points : fallback;
}

function levelParams(): ProcessingParamSchema[] {
  return [
    {
      key: "inputBlack",
      label: "Input Black",
      control: { kind: "slider", min: 0, max: 0.99, step: 0.01 },
      defaultValue: 0,
    },
    {
      key: "inputWhite",
      label: "Input White",
      control: { kind: "slider", min: 0.01, max: 1, step: 0.01 },
      defaultValue: 1,
    },
    {
      key: "gamma",
      label: "Gamma",
      control: { kind: "slider", min: 0.1, max: 5, step: 0.1 },
      defaultValue: 1,
    },
    {
      key: "outputBlack",
      label: "Output Black",
      control: { kind: "slider", min: 0, max: 0.99, step: 0.01 },
      defaultValue: 0,
    },
    {
      key: "outputWhite",
      label: "Output White",
      control: { kind: "slider", min: 0.01, max: 1, step: 0.01 },
      defaultValue: 1,
    },
  ];
}

function applyLegacyOperation(
  input: ProcessingImageState,
  op: ImageEditOperation,
): ProcessingImageState {
  const withPixels = (pixels: Float32Array): ProcessingImageState => ({ ...input, pixels });

  switch (op.type) {
    case "rotate90cw":
      return rotate90CW(input.pixels, input.width, input.height);
    case "rotate90ccw":
      return rotate90CCW(input.pixels, input.width, input.height);
    case "rotate180":
      return rotate180(input.pixels, input.width, input.height);
    case "flipH":
      return withPixels(flipHorizontal(input.pixels, input.width, input.height));
    case "flipV":
      return withPixels(flipVertical(input.pixels, input.width, input.height));
    case "invert":
      return withPixels(invertPixels(input.pixels));
    case "blur":
      return withPixels(gaussianBlur(input.pixels, input.width, input.height, op.sigma));
    case "sharpen":
      return withPixels(sharpen(input.pixels, input.width, input.height, op.amount, op.sigma));
    case "denoise":
      return withPixels(medianFilter(input.pixels, input.width, input.height, op.radius));
    case "histogramEq":
      return withPixels(histogramEqualize(input.pixels));
    case "crop":
      return cropImage(input.pixels, input.width, op.x, op.y, op.width, op.height);
    case "brightness":
      return withPixels(adjustBrightness(input.pixels, op.amount));
    case "contrast":
      return withPixels(adjustContrast(input.pixels, op.factor));
    case "gamma":
      return withPixels(adjustGamma(input.pixels, op.gamma));
    case "levels":
      return withPixels(
        applyLevels(
          input.pixels,
          op.inputBlack,
          op.inputWhite,
          op.gamma,
          op.outputBlack,
          op.outputWhite,
        ),
      );
    case "rotateArbitrary":
      return rotateArbitrary(input.pixels, input.width, input.height, op.angle);
    case "backgroundExtract":
      return withPixels(extractBackground(input.pixels, input.width, input.height, op.gridSize));
    case "mtf":
      return withPixels(applyMTF(input.pixels, op.midtone, op.shadowsClip, op.highlightsClip));
    case "starMask":
      return withPixels(
        applyStarMask(input.pixels, input.width, input.height, op.scale, op.invert),
      );
    case "binarize":
      return withPixels(binarize(input.pixels, op.threshold));
    case "rescale":
      return withPixels(rescalePixels(input.pixels));
    case "clahe":
      return withPixels(clahe(input.pixels, input.width, input.height, op.tileSize, op.clipLimit));
    case "curves":
      return withPixels(applyCurves(input.pixels, op.points));
    case "morphology":
      return withPixels(
        morphologicalOp(input.pixels, input.width, input.height, op.operation, op.radius),
      );
    case "hdr":
      return withPixels(
        hdrMultiscaleTransform(input.pixels, input.width, input.height, op.layers, op.amount),
      );
    case "rangeMask":
      return withPixels(applyRangeMask(input.pixels, op.low, op.high, op.fuzziness));
    case "pixelMath":
      return withPixels(evaluatePixelExpression(input.pixels, op.expression));
    case "deconvolution":
      return withPixels(
        richardsonLucy(
          input.pixels,
          input.width,
          input.height,
          op.psfSigma,
          op.iterations,
          op.regularization,
        ),
      );
    case "dbe":
      return withPixels(
        dynamicBackgroundExtract(
          input.pixels,
          input.width,
          input.height,
          op.samplesX,
          op.samplesY,
          op.sigma,
        ),
      );
    case "multiscaleDenoise":
      return withPixels(
        multiscaleDenoise(input.pixels, input.width, input.height, op.layers, op.threshold),
      );
    case "localContrast":
      return withPixels(
        localContrastEnhancement(input.pixels, input.width, input.height, op.sigma, op.amount),
      );
    case "starReduction":
      return withPixels(
        starReduction(input.pixels, input.width, input.height, op.scale, op.strength),
      );
    case "deconvolutionAuto":
      return withPixels(
        deconvolutionAuto(
          input.pixels,
          input.width,
          input.height,
          op.iterations,
          op.regularization,
        ),
      );
  }
}

const CURVE_FALLBACK = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

const legacyOps: Array<{
  id: ProcessingOperationId;
  label: string;
  category: ProcessingOperationSchema["category"];
  complexity: ProcessingOperationSchema["complexity"];
  supportsPreview: boolean;
  params: ProcessingParamSchema[];
  build: (
    params: Record<string, ProcessingParamValue>,
    input: ProcessingImageState,
  ) => ImageEditOperation;
}> = [
  {
    id: "rotate90cw",
    label: "Rotate 90° CW",
    category: "geometry",
    complexity: "light",
    supportsPreview: true,
    params: [],
    build: () => ({ type: "rotate90cw" }),
  },
  {
    id: "rotate90ccw",
    label: "Rotate 90° CCW",
    category: "geometry",
    complexity: "light",
    supportsPreview: true,
    params: [],
    build: () => ({ type: "rotate90ccw" }),
  },
  {
    id: "rotate180",
    label: "Rotate 180°",
    category: "geometry",
    complexity: "light",
    supportsPreview: true,
    params: [],
    build: () => ({ type: "rotate180" }),
  },
  {
    id: "flipH",
    label: "Flip Horizontal",
    category: "geometry",
    complexity: "light",
    supportsPreview: true,
    params: [],
    build: () => ({ type: "flipH" }),
  },
  {
    id: "flipV",
    label: "Flip Vertical",
    category: "geometry",
    complexity: "light",
    supportsPreview: true,
    params: [],
    build: () => ({ type: "flipV" }),
  },
  {
    id: "invert",
    label: "Invert",
    category: "adjust",
    complexity: "light",
    supportsPreview: true,
    params: [],
    build: () => ({ type: "invert" }),
  },
  {
    id: "blur",
    label: "Gaussian Blur",
    category: "process",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "sigma",
        label: "Sigma",
        control: { kind: "slider", min: 0.5, max: 10, step: 0.1 },
        defaultValue: 2,
      },
    ],
    build: (p) => ({ type: "blur", sigma: asNumber(p, "sigma", 2) }),
  },
  {
    id: "sharpen",
    label: "Sharpen",
    category: "process",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "amount",
        label: "Amount",
        control: { kind: "slider", min: 0.1, max: 5, step: 0.1 },
        defaultValue: 1.5,
      },
      {
        key: "sigma",
        label: "Sigma",
        control: { kind: "slider", min: 0.5, max: 5, step: 0.1 },
        defaultValue: 1,
      },
    ],
    build: (p) => ({
      type: "sharpen",
      amount: asNumber(p, "amount", 1.5),
      sigma: asNumber(p, "sigma", 1),
    }),
  },
  {
    id: "denoise",
    label: "Median Denoise",
    category: "process",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "radius",
        label: "Radius",
        control: { kind: "slider", min: 1, max: 7, step: 1 },
        defaultValue: 1,
      },
    ],
    build: (p) => ({ type: "denoise", radius: Math.round(asNumber(p, "radius", 1)) }),
  },
  {
    id: "histogramEq",
    label: "Histogram Equalization",
    category: "adjust",
    complexity: "light",
    supportsPreview: true,
    params: [],
    build: () => ({ type: "histogramEq" }),
  },
  {
    id: "crop",
    label: "Crop",
    category: "geometry",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "x",
        label: "X",
        control: { kind: "slider", min: 0, max: 1, step: 0.01 },
        defaultValue: 0,
      },
      {
        key: "y",
        label: "Y",
        control: { kind: "slider", min: 0, max: 1, step: 0.01 },
        defaultValue: 0,
      },
      {
        key: "width",
        label: "Width",
        control: { kind: "slider", min: 0.1, max: 1, step: 0.01 },
        defaultValue: 1,
      },
      {
        key: "height",
        label: "Height",
        control: { kind: "slider", min: 0.1, max: 1, step: 0.01 },
        defaultValue: 1,
      },
    ],
    build: (p, input) => {
      const x = Math.round(asNumber(p, "x", 0) * (input.width - 1));
      const y = Math.round(asNumber(p, "y", 0) * (input.height - 1));
      const w = Math.max(1, Math.round(asNumber(p, "width", 1) * input.width));
      const h = Math.max(1, Math.round(asNumber(p, "height", 1) * input.height));
      return {
        type: "crop",
        x: Math.min(input.width - 1, x),
        y: Math.min(input.height - 1, y),
        width: Math.min(input.width - x, w),
        height: Math.min(input.height - y, h),
      };
    },
  },
  {
    id: "brightness",
    label: "Brightness",
    category: "adjust",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "amount",
        label: "Amount",
        control: { kind: "slider", min: -0.5, max: 0.5, step: 0.01 },
        defaultValue: 0,
      },
    ],
    build: (p) => ({ type: "brightness", amount: asNumber(p, "amount", 0) }),
  },
  {
    id: "contrast",
    label: "Contrast",
    category: "adjust",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "factor",
        label: "Factor",
        control: { kind: "slider", min: 0.2, max: 3, step: 0.05 },
        defaultValue: 1,
      },
    ],
    build: (p) => ({ type: "contrast", factor: asNumber(p, "factor", 1) }),
  },
  {
    id: "gamma",
    label: "Gamma",
    category: "adjust",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "gamma",
        label: "Gamma",
        control: { kind: "slider", min: 0.1, max: 5, step: 0.1 },
        defaultValue: 1,
      },
    ],
    build: (p) => ({ type: "gamma", gamma: asNumber(p, "gamma", 1) }),
  },
  {
    id: "levels",
    label: "Levels",
    category: "adjust",
    complexity: "light",
    supportsPreview: true,
    params: levelParams(),
    build: (p) => ({
      type: "levels",
      inputBlack: asNumber(p, "inputBlack", 0),
      inputWhite: asNumber(p, "inputWhite", 1),
      gamma: asNumber(p, "gamma", 1),
      outputBlack: asNumber(p, "outputBlack", 0),
      outputWhite: asNumber(p, "outputWhite", 1),
    }),
  },
  {
    id: "rotateArbitrary",
    label: "Rotate",
    category: "geometry",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "angle",
        label: "Angle",
        control: { kind: "slider", min: -180, max: 180, step: 0.5 },
        defaultValue: 0,
      },
    ],
    build: (p) => ({ type: "rotateArbitrary", angle: asNumber(p, "angle", 0) }),
  },
  {
    id: "backgroundExtract",
    label: "Background Extract (ABE)",
    category: "process",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "gridSize",
        label: "Grid Size",
        control: { kind: "slider", min: 4, max: 20, step: 1 },
        defaultValue: 8,
      },
    ],
    build: (p) => ({ type: "backgroundExtract", gridSize: Math.round(asNumber(p, "gridSize", 8)) }),
  },
  {
    id: "mtf",
    label: "MTF",
    category: "adjust",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "midtone",
        label: "Midtone",
        control: { kind: "slider", min: 0.01, max: 0.99, step: 0.01 },
        defaultValue: 0.25,
      },
      {
        key: "shadowsClip",
        label: "Shadows",
        control: { kind: "slider", min: 0, max: 0.5, step: 0.01 },
        defaultValue: 0,
      },
      {
        key: "highlightsClip",
        label: "Highlights",
        control: { kind: "slider", min: 0.5, max: 1, step: 0.01 },
        defaultValue: 1,
      },
    ],
    build: (p) => ({
      type: "mtf",
      midtone: asNumber(p, "midtone", 0.25),
      shadowsClip: asNumber(p, "shadowsClip", 0),
      highlightsClip: asNumber(p, "highlightsClip", 1),
    }),
  },
  {
    id: "starMask",
    label: "Star Mask",
    category: "mask",
    complexity: "heavy",
    supportsPreview: true,
    params: [
      {
        key: "scale",
        label: "Scale",
        control: { kind: "slider", min: 0.5, max: 4, step: 0.1 },
        defaultValue: 1.5,
      },
      { key: "invert", label: "Invert", control: { kind: "toggle" }, defaultValue: false },
    ],
    build: (p) => ({
      type: "starMask",
      scale: asNumber(p, "scale", 1.5),
      invert: asBoolean(p, "invert", false),
    }),
  },
  {
    id: "binarize",
    label: "Binarize",
    category: "mask",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "threshold",
        label: "Threshold",
        control: { kind: "slider", min: 0, max: 1, step: 0.01 },
        defaultValue: 0.5,
      },
    ],
    build: (p) => ({ type: "binarize", threshold: asNumber(p, "threshold", 0.5) }),
  },
  {
    id: "rescale",
    label: "Rescale",
    category: "adjust",
    complexity: "light",
    supportsPreview: true,
    params: [],
    build: () => ({ type: "rescale" }),
  },
  {
    id: "clahe",
    label: "CLAHE",
    category: "process",
    complexity: "heavy",
    supportsPreview: true,
    params: [
      {
        key: "tileSize",
        label: "Tile",
        control: { kind: "slider", min: 4, max: 32, step: 1 },
        defaultValue: 8,
      },
      {
        key: "clipLimit",
        label: "Clip",
        control: { kind: "slider", min: 1, max: 10, step: 0.5 },
        defaultValue: 3,
      },
    ],
    build: (p) => ({
      type: "clahe",
      tileSize: Math.round(asNumber(p, "tileSize", 8)),
      clipLimit: asNumber(p, "clipLimit", 3),
    }),
  },
  {
    id: "curves",
    label: "Curves",
    category: "adjust",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "points",
        label: "Points",
        control: { kind: "point-list", minPoints: 2, maxPoints: 16 },
        defaultValue: CURVE_FALLBACK,
      },
    ],
    build: (p) => ({ type: "curves", points: asPointList(p, "points", CURVE_FALLBACK) }),
  },
  {
    id: "morphology",
    label: "Morphology",
    category: "process",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "operation",
        label: "Operation",
        control: {
          kind: "select",
          options: [
            { label: "Erode", value: "erode" },
            { label: "Dilate", value: "dilate" },
            { label: "Open", value: "open" },
            { label: "Close", value: "close" },
          ],
        },
        defaultValue: "dilate",
      },
      {
        key: "radius",
        label: "Radius",
        control: { kind: "slider", min: 1, max: 7, step: 1 },
        defaultValue: 1,
      },
    ],
    build: (p) => ({
      type: "morphology",
      operation: (() => {
        const raw = asString(p, "operation", "dilate");
        return raw === "erode" || raw === "open" || raw === "close" ? raw : "dilate";
      })(),
      radius: Math.round(asNumber(p, "radius", 1)),
    }),
  },
  {
    id: "hdr",
    label: "HDR Multiscale",
    category: "process",
    complexity: "heavy",
    supportsPreview: true,
    params: [
      {
        key: "layers",
        label: "Layers",
        control: { kind: "slider", min: 1, max: 8, step: 1 },
        defaultValue: 5,
      },
      {
        key: "amount",
        label: "Amount",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0.7,
      },
    ],
    build: (p) => ({
      type: "hdr",
      layers: Math.round(asNumber(p, "layers", 5)),
      amount: asNumber(p, "amount", 0.7),
    }),
  },
  {
    id: "rangeMask",
    label: "Range Mask",
    category: "mask",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "low",
        label: "Low",
        control: { kind: "slider", min: 0, max: 1, step: 0.01 },
        defaultValue: 0,
      },
      {
        key: "high",
        label: "High",
        control: { kind: "slider", min: 0, max: 1, step: 0.01 },
        defaultValue: 1,
      },
      {
        key: "fuzziness",
        label: "Fuzz",
        control: { kind: "slider", min: 0, max: 0.5, step: 0.01 },
        defaultValue: 0.1,
      },
    ],
    build: (p) => ({
      type: "rangeMask",
      low: asNumber(p, "low", 0),
      high: asNumber(p, "high", 1),
      fuzziness: asNumber(p, "fuzziness", 0.1),
    }),
  },
  {
    id: "pixelMath",
    label: "PixelMath",
    category: "advanced",
    complexity: "medium",
    supportsPreview: true,
    params: [
      { key: "expression", label: "Expression", control: { kind: "text" }, defaultValue: "$T" },
    ],
    build: (p) => ({ type: "pixelMath", expression: asString(p, "expression", "$T") }),
  },
  {
    id: "deconvolution",
    label: "Deconvolution",
    category: "process",
    complexity: "heavy",
    supportsPreview: false,
    params: [
      {
        key: "psfSigma",
        label: "PSF Sigma",
        control: { kind: "slider", min: 0.5, max: 5, step: 0.1 },
        defaultValue: 2,
      },
      {
        key: "iterations",
        label: "Iterations",
        control: { kind: "slider", min: 1, max: 80, step: 1 },
        defaultValue: 20,
      },
      {
        key: "regularization",
        label: "Regularization",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0.1,
      },
    ],
    build: (p) => ({
      type: "deconvolution",
      psfSigma: asNumber(p, "psfSigma", 2),
      iterations: Math.round(asNumber(p, "iterations", 20)),
      regularization: asNumber(p, "regularization", 0.1),
    }),
  },
  {
    id: "dbe",
    label: "DBE",
    category: "process",
    complexity: "heavy",
    supportsPreview: true,
    params: [
      {
        key: "samplesX",
        label: "Samples X",
        control: { kind: "slider", min: 4, max: 24, step: 1 },
        defaultValue: 12,
      },
      {
        key: "samplesY",
        label: "Samples Y",
        control: { kind: "slider", min: 4, max: 16, step: 1 },
        defaultValue: 8,
      },
      {
        key: "sigma",
        label: "Sigma",
        control: { kind: "slider", min: 1, max: 5, step: 0.1 },
        defaultValue: 2.5,
      },
    ],
    build: (p) => ({
      type: "dbe",
      samplesX: Math.round(asNumber(p, "samplesX", 12)),
      samplesY: Math.round(asNumber(p, "samplesY", 8)),
      sigma: asNumber(p, "sigma", 2.5),
    }),
  },
  {
    id: "multiscaleDenoise",
    label: "Multiscale Denoise",
    category: "process",
    complexity: "heavy",
    supportsPreview: true,
    params: [
      {
        key: "layers",
        label: "Layers",
        control: { kind: "slider", min: 1, max: 8, step: 1 },
        defaultValue: 4,
      },
      {
        key: "threshold",
        label: "Threshold",
        control: { kind: "slider", min: 0.5, max: 6, step: 0.1 },
        defaultValue: 2.5,
      },
    ],
    build: (p) => ({
      type: "multiscaleDenoise",
      layers: Math.round(asNumber(p, "layers", 4)),
      threshold: asNumber(p, "threshold", 2.5),
    }),
  },
  {
    id: "localContrast",
    label: "Local Contrast",
    category: "process",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "sigma",
        label: "Sigma",
        control: { kind: "slider", min: 1, max: 20, step: 0.5 },
        defaultValue: 8,
      },
      {
        key: "amount",
        label: "Amount",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0.35,
      },
    ],
    build: (p) => ({
      type: "localContrast",
      sigma: asNumber(p, "sigma", 8),
      amount: asNumber(p, "amount", 0.35),
    }),
  },
  {
    id: "starReduction",
    label: "Star Reduction",
    category: "process",
    complexity: "heavy",
    supportsPreview: true,
    params: [
      {
        key: "scale",
        label: "Scale",
        control: { kind: "slider", min: 0.5, max: 4, step: 0.1 },
        defaultValue: 1.2,
      },
      {
        key: "strength",
        label: "Strength",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0.6,
      },
    ],
    build: (p) => ({
      type: "starReduction",
      scale: asNumber(p, "scale", 1.2),
      strength: asNumber(p, "strength", 0.6),
    }),
  },
  {
    id: "deconvolutionAuto",
    label: "Auto Deconvolution",
    category: "process",
    complexity: "heavy",
    supportsPreview: false,
    params: [
      {
        key: "iterations",
        label: "Iterations",
        control: { kind: "slider", min: 1, max: 80, step: 1 },
        defaultValue: 20,
      },
      {
        key: "regularization",
        label: "Regularization",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0.1,
      },
    ],
    build: (p) => ({
      type: "deconvolutionAuto",
      iterations: Math.round(asNumber(p, "iterations", 20)),
      regularization: asNumber(p, "regularization", 0.1),
    }),
  },
];

const registry = new Map<ProcessingOperationId, ProcessingOperationSchema>();

for (const entry of legacyOps) {
  registry.set(entry.id, {
    id: entry.id,
    label: entry.label,
    category: entry.category,
    complexity: entry.complexity,
    supportsPreview: entry.supportsPreview,
    params: entry.params,
    execute: (input, params) => applyLegacyOperation(input, entry.build(params, input)),
  });
}

export function getProcessingOperation(operationId: ProcessingOperationId) {
  return registry.get(operationId);
}

export function listProcessingOperations() {
  return Array.from(registry.values());
}

export function createDefaultParams(operationId: ProcessingOperationId) {
  const op = registry.get(operationId);
  if (!op) return {} as Record<string, ProcessingParamValue>;
  return op.params.reduce<Record<string, ProcessingParamValue>>((acc, param) => {
    acc[param.key] = param.defaultValue;
    return acc;
  }, {});
}
