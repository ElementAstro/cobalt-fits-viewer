export const COMPOSITE_BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const;

export type CompositeBlendMode = (typeof COMPOSITE_BLEND_MODES)[number];

export type CompositeRegistrationMode = "none" | "translation" | "full";

export type CompositeFramingMode = "first" | "min" | "cog";

export type CompositeColorSpace = "hsl" | "hsv" | "lab";

export type CompositePreviewMode = "composite" | "r" | "g" | "b" | "l" | "split";

export type CompositePreset = "custom" | "rgb" | "lrgb" | "sho" | "hoo" | "hos";

export interface CompositeLayer {
  id: string;
  fileId: string | null;
  filepath: string | null;
  filename: string | null;
  enabled: boolean;
  isLuminance: boolean;
  opacity: number;
  blendMode: CompositeBlendMode;
  tint: { r: number; g: number; b: number };
  useForLinearMatch: boolean;
  useForBrightnessBalance: boolean;
  pixels?: Float32Array;
  alignedPixels?: Float32Array;
}

export interface CompositeRegistrationConfig {
  mode: CompositeRegistrationMode;
  framing: CompositeFramingMode;
  manualControlPoints?: {
    ref: Array<{ x: number; y: number }>;
    target: Array<{ x: number; y: number }>;
    mode: "oneStar" | "twoStar" | "threeStar";
  };
}

export interface CompositeRenderOptions {
  linkedStretch: boolean;
  autoLinearMatch: boolean;
  autoBrightnessBalance: boolean;
  colorSpace: CompositeColorSpace;
  applyPixelMath: boolean;
  pixelMath: {
    r: string;
    g: string;
    b: string;
  };
  splitPosition: number;
  previewScale: number;
  previewMode: CompositePreviewMode;
}

export interface CompositeProject {
  preset: CompositePreset;
  layers: CompositeLayer[];
  registration: CompositeRegistrationConfig;
  options: CompositeRenderOptions;
}

export interface PixelMathValidationError {
  channel: "r" | "g" | "b";
  message: string;
  expression: string;
  index: number;
  row?: number;
  column?: number;
}

export interface CompositeRenderResult {
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  pixelMathError?: PixelMathValidationError;
  channels: {
    r: Float32Array;
    g: Float32Array;
    b: Float32Array;
    l?: Float32Array;
  };
}

export interface CompositeLayerLoadResult {
  layer: CompositeLayer;
  width: number;
  height: number;
}

export interface CompositeProgress {
  phase: "loading" | "registering" | "matching" | "rendering" | "saving";
  current: number;
  total: number;
  message: string;
}
