import type { ProcessingOperationId, ProcessingParamValue } from "../fits/types";
import type {
  ProcessingImageState,
  ProcessingOperationSchema,
  ProcessingParamSchema,
  ProcessingRGBAState,
} from "./types";
import { asNumber, asBoolean, asString, asPointList } from "./paramHelpers";
import { applyColorOperation } from "./color";
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
  type ScientificImageOperation,
} from "../utils/imageOperations";

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
  op: ScientificImageOperation,
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
    default: {
      const { applyOperation } = require("../utils/imageOperations");
      const result = applyOperation(input.pixels, input.width, input.height, op);
      return result as ProcessingImageState;
    }
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
  ) => ScientificImageOperation;
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
      {
        key: "growth",
        label: "Growth",
        control: { kind: "slider", min: 0, max: 5, step: 1 },
        defaultValue: 0,
      },
      {
        key: "softness",
        label: "Softness",
        control: { kind: "slider", min: 0, max: 5, step: 0.5 },
        defaultValue: 0,
      },
    ],
    build: (p) => ({
      type: "starMask",
      scale: asNumber(p, "scale", 1.5),
      invert: asBoolean(p, "invert", false),
      growth: Math.round(asNumber(p, "growth", 0)),
      softness: asNumber(p, "softness", 0),
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
      {
        key: "amount",
        label: "Amount",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 1,
      },
    ],
    build: (p) => ({
      type: "clahe",
      tileSize: Math.round(asNumber(p, "tileSize", 8)),
      clipLimit: asNumber(p, "clipLimit", 3),
      amount: asNumber(p, "amount", 1),
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
  {
    id: "cosmeticCorrection",
    label: "Cosmetic Correction",
    category: "process",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "hotSigma",
        label: "Hot σ",
        control: { kind: "slider", min: 2, max: 10, step: 0.5 },
        defaultValue: 5,
      },
      {
        key: "coldSigma",
        label: "Cold σ",
        control: { kind: "slider", min: 2, max: 10, step: 0.5 },
        defaultValue: 5,
      },
      {
        key: "useMedian",
        label: "Median Interpolation",
        control: { kind: "toggle" },
        defaultValue: true,
      },
    ],
    build: (p) => ({
      type: "cosmeticCorrection" as const,
      hotSigma: asNumber(p, "hotSigma", 5),
      coldSigma: asNumber(p, "coldSigma", 5),
      useMedian: asBoolean(p, "useMedian", true),
    }),
  },
  {
    id: "tgvDenoise",
    label: "TGV Denoise",
    category: "process",
    complexity: "heavy",
    supportsPreview: false,
    params: [
      {
        key: "strength",
        label: "Strength",
        control: { kind: "slider", min: 0.1, max: 10, step: 0.1 },
        defaultValue: 2,
      },
      {
        key: "smoothness",
        label: "Smoothness",
        control: { kind: "slider", min: 1, max: 5, step: 0.5 },
        defaultValue: 2,
      },
      {
        key: "iterations",
        label: "Iterations",
        control: { kind: "slider", min: 50, max: 500, step: 10 },
        defaultValue: 200,
      },
      {
        key: "edgeProtection",
        label: "Edge Protection",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0.5,
      },
    ],
    build: (p) => ({
      type: "tgvDenoise" as const,
      strength: asNumber(p, "strength", 2),
      smoothness: asNumber(p, "smoothness", 2),
      iterations: Math.round(asNumber(p, "iterations", 200)),
      edgeProtection: asNumber(p, "edgeProtection", 0.5),
    }),
  },
  {
    id: "mmt",
    label: "Multiscale Median Transform",
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
        key: "noiseThreshold",
        label: "Noise Threshold",
        control: { kind: "slider", min: 0.5, max: 10, step: 0.5 },
        defaultValue: 3,
      },
      {
        key: "noiseReduction",
        label: "Noise Reduction",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0.5,
      },
      {
        key: "bias",
        label: "Bias",
        control: { kind: "slider", min: -1, max: 1, step: 0.05 },
        defaultValue: 0,
      },
    ],
    build: (p) => ({
      type: "mmt" as const,
      layers: Math.round(asNumber(p, "layers", 4)),
      noiseThreshold: asNumber(p, "noiseThreshold", 3),
      noiseReduction: asNumber(p, "noiseReduction", 0.5),
      bias: asNumber(p, "bias", 0),
    }),
  },
  {
    id: "bilateralFilter",
    label: "Bilateral Filter",
    category: "process",
    complexity: "heavy",
    supportsPreview: true,
    params: [
      {
        key: "spatialSigma",
        label: "Spatial σ",
        control: { kind: "slider", min: 0.5, max: 10, step: 0.5 },
        defaultValue: 2,
      },
      {
        key: "rangeSigma",
        label: "Range σ",
        control: { kind: "slider", min: 0.01, max: 0.5, step: 0.01 },
        defaultValue: 0.1,
      },
    ],
    build: (p) => ({
      type: "bilateralFilter" as const,
      spatialSigma: asNumber(p, "spatialSigma", 2),
      rangeSigma: asNumber(p, "rangeSigma", 0.1),
    }),
  },
  {
    id: "waveletSharpen",
    label: "Wavelet Sharpen",
    category: "process",
    complexity: "heavy",
    supportsPreview: true,
    params: [
      {
        key: "layers",
        label: "Layers",
        control: { kind: "slider", min: 1, max: 6, step: 1 },
        defaultValue: 3,
      },
      {
        key: "amount",
        label: "Amount",
        control: { kind: "slider", min: 0, max: 3, step: 0.1 },
        defaultValue: 1.5,
      },
      {
        key: "protectStars",
        label: "Protect Stars",
        control: { kind: "toggle" },
        defaultValue: false,
      },
    ],
    build: (p) => ({
      type: "waveletSharpen" as const,
      layers: Math.round(asNumber(p, "layers", 3)),
      amount: asNumber(p, "amount", 1.5),
      protectStars: asBoolean(p, "protectStars", false),
    }),
  },
  {
    id: "wienerDeconvolution",
    label: "Wiener Deconvolution",
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
        key: "noiseRatio",
        label: "Noise Ratio",
        control: { kind: "slider", min: 0.001, max: 0.1, step: 0.001 },
        defaultValue: 0.01,
      },
    ],
    build: (p) => ({
      type: "wienerDeconvolution" as const,
      psfSigma: asNumber(p, "psfSigma", 2),
      noiseRatio: asNumber(p, "noiseRatio", 0.01),
    }),
  },
  {
    id: "integerBin",
    label: "Integer Bin",
    category: "geometry",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "factor",
        label: "Factor",
        control: { kind: "slider", min: 2, max: 4, step: 1 },
        defaultValue: 2,
      },
      {
        key: "mode",
        label: "Mode",
        control: {
          kind: "select",
          options: [
            { label: "Average", value: "average" },
            { label: "Sum", value: "sum" },
            { label: "Median", value: "median" },
          ],
        },
        defaultValue: "average",
      },
    ],
    build: (p) => ({
      type: "integerBin" as const,
      factor: Math.round(asNumber(p, "factor", 2)),
      mode: (() => {
        const m = asString(p, "mode", "average");
        return m === "sum" || m === "median" ? m : "average";
      })(),
    }),
  },
  {
    id: "resample",
    label: "Resample",
    category: "geometry",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "targetScale",
        label: "Scale",
        control: { kind: "slider", min: 0.25, max: 4, step: 0.25 },
        defaultValue: 1,
      },
      {
        key: "method",
        label: "Method",
        control: {
          kind: "select",
          options: [
            { label: "Bilinear", value: "bilinear" },
            { label: "Bicubic", value: "bicubic" },
            { label: "Lanczos-3", value: "lanczos3" },
          ],
        },
        defaultValue: "lanczos3",
      },
    ],
    build: (p) => ({
      type: "resample" as const,
      targetScale: asNumber(p, "targetScale", 1),
      method: (() => {
        const m = asString(p, "method", "lanczos3");
        return m === "bilinear" || m === "bicubic" ? m : "lanczos3";
      })(),
    }),
  },
  {
    id: "edgeMask",
    label: "Edge Mask",
    category: "mask",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "preBlurSigma",
        label: "Pre-Blur",
        control: { kind: "slider", min: 0, max: 5, step: 0.5 },
        defaultValue: 1,
      },
      {
        key: "threshold",
        label: "Threshold",
        control: { kind: "slider", min: 0, max: 1, step: 0.01 },
        defaultValue: 0.1,
      },
      {
        key: "postBlurSigma",
        label: "Post-Blur",
        control: { kind: "slider", min: 0, max: 5, step: 0.5 },
        defaultValue: 1,
      },
    ],
    build: (p) => ({
      type: "edgeMask" as const,
      preBlurSigma: asNumber(p, "preBlurSigma", 1),
      threshold: asNumber(p, "threshold", 0.1),
      postBlurSigma: asNumber(p, "postBlurSigma", 1),
    }),
  },
  {
    id: "mlt",
    label: "MLT Denoise",
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
        key: "noiseThreshold",
        label: "Noise Threshold",
        control: { kind: "slider", min: 0.5, max: 10, step: 0.5 },
        defaultValue: 3,
      },
      {
        key: "noiseReduction",
        label: "Noise Reduction",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0.5,
      },
      {
        key: "bias",
        label: "Bias",
        control: { kind: "slider", min: -1, max: 1, step: 0.05 },
        defaultValue: 0,
      },
      {
        key: "useLinearMask",
        label: "Linear Mask",
        control: { kind: "toggle" },
        defaultValue: true,
      },
      {
        key: "linearMaskAmplification",
        label: "Mask Amplification",
        control: { kind: "slider", min: 10, max: 1000, step: 10 },
        defaultValue: 200,
      },
    ],
    build: (p) => ({
      type: "mlt" as const,
      layers: Math.round(asNumber(p, "layers", 4)),
      noiseThreshold: asNumber(p, "noiseThreshold", 3),
      noiseReduction: asNumber(p, "noiseReduction", 0.5),
      bias: asNumber(p, "bias", 0),
      useLinearMask: asBoolean(p, "useLinearMask", true),
      linearMaskAmplification: asNumber(p, "linearMaskAmplification", 200),
    }),
  },
  {
    id: "ghs",
    label: "Generalized Hyperbolic Stretch",
    category: "adjust",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "D",
        label: "Stretch Factor",
        control: { kind: "slider", min: 0, max: 10, step: 0.1 },
        defaultValue: 1,
      },
      {
        key: "b",
        label: "Symmetry Point",
        control: { kind: "slider", min: 0, max: 1, step: 0.01 },
        defaultValue: 0.25,
      },
      {
        key: "SP",
        label: "Shape",
        control: { kind: "slider", min: -5, max: 5, step: 0.1 },
        defaultValue: 0,
      },
      {
        key: "HP",
        label: "Highlight Protection",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0,
      },
      {
        key: "LP",
        label: "Shadow Protection",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0,
      },
    ],
    build: (p) => ({
      type: "ghs" as const,
      D: asNumber(p, "D", 1),
      b: asNumber(p, "b", 0.25),
      SP: asNumber(p, "SP", 0),
      HP: asNumber(p, "HP", 0),
      LP: asNumber(p, "LP", 0),
    }),
  },
];

const registry = new Map<ProcessingOperationId, ProcessingOperationSchema>();

for (const entry of legacyOps) {
  registry.set(entry.id, {
    id: entry.id,
    stage: "scientific",
    label: entry.label,
    category: entry.category,
    complexity: entry.complexity,
    supportsPreview: entry.supportsPreview,
    params: entry.params,
    execute: (input, params) =>
      applyLegacyOperation(
        input as ProcessingImageState,
        entry.build(params, input as ProcessingImageState),
      ),
  });
}

type ColorRegistryOperationId = Extract<
  ProcessingOperationId,
  | "scnr"
  | "colorCalibration"
  | "saturation"
  | "colorBalance"
  | "backgroundNeutralize"
  | "photometricCC"
  | "perHueSaturation"
  | "selectiveColor"
>;

const colorOps: Array<{
  id: ColorRegistryOperationId;
  label: string;
  category: ProcessingOperationSchema["category"];
  complexity: ProcessingOperationSchema["complexity"];
  supportsPreview: boolean;
  params: ProcessingParamSchema[];
}> = [
  {
    id: "scnr",
    label: "SCNR",
    category: "color",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "method",
        label: "Method",
        control: {
          kind: "select",
          options: [
            { label: "Average Neutral", value: "averageNeutral" },
            { label: "Maximum Neutral", value: "maximumNeutral" },
          ],
        },
        defaultValue: "averageNeutral",
      },
      {
        key: "amount",
        label: "Amount",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 1,
      },
    ],
  },
  {
    id: "colorCalibration",
    label: "Color Calibration",
    category: "color",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "percentile",
        label: "White Reference Percentile",
        control: { kind: "slider", min: 0.5, max: 0.99, step: 0.01 },
        defaultValue: 0.92,
      },
    ],
  },
  {
    id: "saturation",
    label: "Saturation",
    category: "color",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "amount",
        label: "Amount",
        control: { kind: "slider", min: -1, max: 2, step: 0.05 },
        defaultValue: 0,
      },
    ],
  },
  {
    id: "colorBalance",
    label: "Color Balance",
    category: "color",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "redGain",
        label: "Red Gain",
        control: { kind: "slider", min: 0, max: 4, step: 0.05 },
        defaultValue: 1,
      },
      {
        key: "greenGain",
        label: "Green Gain",
        control: { kind: "slider", min: 0, max: 4, step: 0.05 },
        defaultValue: 1,
      },
      {
        key: "blueGain",
        label: "Blue Gain",
        control: { kind: "slider", min: 0, max: 4, step: 0.05 },
        defaultValue: 1,
      },
    ],
  },
  {
    id: "backgroundNeutralize",
    label: "Background Neutralization",
    category: "color",
    complexity: "medium",
    supportsPreview: true,
    params: [
      {
        key: "upperLimit",
        label: "Upper Limit",
        control: { kind: "slider", min: 0.05, max: 0.5, step: 0.01 },
        defaultValue: 0.2,
      },
      {
        key: "shadowsClip",
        label: "Shadows Clip",
        control: { kind: "slider", min: 0, max: 0.1, step: 0.005 },
        defaultValue: 0.01,
      },
    ],
  },
  {
    id: "photometricCC",
    label: "Photometric Color Calibration",
    category: "color",
    complexity: "heavy",
    supportsPreview: false,
    params: [
      {
        key: "minStars",
        label: "Min Stars",
        control: { kind: "slider", min: 5, max: 100, step: 5 },
        defaultValue: 20,
      },
      {
        key: "percentileLow",
        label: "Low Percentile",
        control: { kind: "slider", min: 0, max: 0.5, step: 0.05 },
        defaultValue: 0.25,
      },
      {
        key: "percentileHigh",
        label: "High Percentile",
        control: { kind: "slider", min: 0.5, max: 1, step: 0.05 },
        defaultValue: 0.75,
      },
    ],
  },
  {
    id: "perHueSaturation",
    label: "Per-Hue Saturation",
    category: "color",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "amount",
        label: "Amount",
        control: { kind: "slider", min: 0, max: 3, step: 0.05 },
        defaultValue: 1,
      },
    ],
  },
  {
    id: "selectiveColor",
    label: "Selective Color",
    category: "color",
    complexity: "light",
    supportsPreview: true,
    params: [
      {
        key: "targetHue",
        label: "Target Hue",
        control: { kind: "slider", min: 0, max: 360, step: 5 },
        defaultValue: 120,
      },
      {
        key: "hueRange",
        label: "Hue Range",
        control: { kind: "slider", min: 10, max: 180, step: 5 },
        defaultValue: 60,
      },
      {
        key: "hueShift",
        label: "Hue Shift",
        control: { kind: "slider", min: -180, max: 180, step: 5 },
        defaultValue: 0,
      },
      {
        key: "satShift",
        label: "Saturation",
        control: { kind: "slider", min: -1, max: 1, step: 0.05 },
        defaultValue: 0,
      },
      {
        key: "lumShift",
        label: "Luminance",
        control: { kind: "slider", min: -1, max: 1, step: 0.05 },
        defaultValue: 0,
      },
      {
        key: "feather",
        label: "Feather",
        control: { kind: "slider", min: 0, max: 1, step: 0.05 },
        defaultValue: 0.3,
      },
    ],
  },
];

for (const entry of colorOps) {
  registry.set(entry.id, {
    id: entry.id,
    stage: "color",
    label: entry.label,
    category: entry.category,
    complexity: entry.complexity,
    supportsPreview: entry.supportsPreview,
    params: entry.params,
    execute: (input, params) => applyColorOperation(input as ProcessingRGBAState, entry.id, params),
  });
}

export const REQUIRED_PROCESSING_OPERATION_IDS: ProcessingOperationId[] = [
  "rotate90cw",
  "rotate90ccw",
  "rotate180",
  "flipH",
  "flipV",
  "invert",
  "blur",
  "sharpen",
  "denoise",
  "histogramEq",
  "crop",
  "brightness",
  "contrast",
  "gamma",
  "levels",
  "rotateArbitrary",
  "backgroundExtract",
  "mtf",
  "starMask",
  "binarize",
  "rescale",
  "clahe",
  "curves",
  "morphology",
  "hdr",
  "rangeMask",
  "pixelMath",
  "deconvolution",
  "dbe",
  "multiscaleDenoise",
  "localContrast",
  "starReduction",
  "deconvolutionAuto",
  "scnr",
  "colorCalibration",
  "saturation",
  "colorBalance",
  "cosmeticCorrection",
  "tgvDenoise",
  "mmt",
  "bilateralFilter",
  "backgroundNeutralize",
  "photometricCC",
  "perHueSaturation",
  "selectiveColor",
  "wienerDeconvolution",
  "waveletSharpen",
  "integerBin",
  "resample",
  "edgeMask",
  "mlt",
  "ghs",
];

export function assertProcessingRegistryCoverage() {
  const missing = REQUIRED_PROCESSING_OPERATION_IDS.filter((id) => !registry.has(id));
  if (missing.length > 0) {
    throw new Error(`Processing registry missing operations: ${missing.join(", ")}`);
  }
}

assertProcessingRegistryCoverage();

export function getProcessingOperation(operationId: ProcessingOperationId) {
  return registry.get(operationId);
}

export function listProcessingOperations(stage?: ProcessingOperationSchema["stage"]) {
  const values = Array.from(registry.values());
  if (!stage) return values;
  return values.filter((item) => item.stage === stage);
}

export function createDefaultParams(operationId: ProcessingOperationId) {
  const op = registry.get(operationId);
  if (!op) return {} as Record<string, ProcessingParamValue>;
  return op.params.reduce<Record<string, ProcessingParamValue>>((acc, param) => {
    acc[param.key] = param.defaultValue;
    return acc;
  }, {});
}
