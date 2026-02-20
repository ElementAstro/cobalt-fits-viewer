import { blendScanline } from "./blendModes";
import { linearMatchToReference } from "./linearMatch";
import { balanceLayerBrightness } from "./brightnessBalance";
import { applyPixelMathProgram, type PixelMathProgram } from "./pixelMath";
import type {
  CompositeLayer,
  CompositeColorSpace,
  CompositePreviewMode,
  CompositeRenderResult,
  CompositeRenderOptions,
} from "./types";

interface RenderLayerWorkingSet {
  layer: CompositeLayer;
  mono: Float32Array;
}

export interface RenderCompositeRequest {
  layers: CompositeLayer[];
  width: number;
  height: number;
  options: CompositeRenderOptions;
  mode: "preview" | "full";
  signal?: AbortSignal;
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new Error("Aborted");
  }
}

function computeExtent(buffers: Float32Array[]) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const buffer of buffers) {
    for (let i = 0; i < buffer.length; i++) {
      const value = buffer[i];
      if (!Number.isFinite(value)) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { min: 0, max: 1 };
  }

  return { min, max };
}

function normalizeToUnit(pixels: Float32Array, min: number, max: number): Float32Array {
  const out = new Float32Array(pixels.length);
  const range = max - min;
  if (range <= 0) return out;

  for (let i = 0; i < pixels.length; i++) {
    const value = (pixels[i] - min) / range;
    out[i] = value <= 0 ? 0 : value >= 1 ? 1 : value;
  }
  return out;
}

function toRgba(r: Float32Array, g: Float32Array, b: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(r.length * 4);
  for (let i = 0; i < r.length; i++) {
    const offset = i * 4;
    rgba[offset] = Math.round(Math.max(0, Math.min(1, r[i])) * 255);
    rgba[offset + 1] = Math.round(Math.max(0, Math.min(1, g[i])) * 255);
    rgba[offset + 2] = Math.round(Math.max(0, Math.min(1, b[i])) * 255);
    rgba[offset + 3] = 255;
  }
  return rgba;
}

function applyLuminance(
  r: Float32Array,
  g: Float32Array,
  b: Float32Array,
  luminance: Float32Array,
  opacity: number,
  colorSpace: CompositeColorSpace,
) {
  const outR = new Float32Array(r.length);
  const outG = new Float32Array(g.length);
  const outB = new Float32Array(b.length);
  const alpha = Math.max(0, Math.min(1, opacity));

  const computeCurrentLightness = (index: number) => {
    if (colorSpace === "hsv") {
      return Math.max(r[index], g[index], b[index]);
    }
    return 0.2126 * r[index] + 0.7152 * g[index] + 0.0722 * b[index];
  };

  const computeTargetLightness = (target: number) => {
    if (colorSpace !== "lab") return target;
    const lStar = Math.max(0, Math.min(1, target)) * 100;
    if (lStar <= 8) {
      return lStar / 903.3;
    }
    return Math.pow((lStar + 16) / 116, 3);
  };

  for (let i = 0; i < r.length; i++) {
    const targetL = computeTargetLightness(luminance[i]);
    const currentL = computeCurrentLightness(i);
    const scale = currentL > 1e-6 ? targetL / currentL : 1;
    outR[i] = Math.max(0, Math.min(1, r[i] * (1 - alpha + alpha * scale)));
    outG[i] = Math.max(0, Math.min(1, g[i] * (1 - alpha + alpha * scale)));
    outB[i] = Math.max(0, Math.min(1, b[i] * (1 - alpha + alpha * scale)));
  }

  return { r: outR, g: outG, b: outB };
}

function downsampleMono(
  pixels: Float32Array,
  width: number,
  height: number,
  scale: number,
): { pixels: Float32Array; width: number; height: number } {
  if (scale >= 0.999) {
    return { pixels, width, height };
  }

  const targetWidth = Math.max(1, Math.floor(width * scale));
  const targetHeight = Math.max(1, Math.floor(height * scale));
  const out = new Float32Array(targetWidth * targetHeight);

  for (let y = 0; y < targetHeight; y++) {
    const srcY = Math.min(height - 1, Math.floor((y / targetHeight) * height));
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.min(width - 1, Math.floor((x / targetWidth) * width));
      out[y * targetWidth + x] = pixels[srcY * width + srcX];
    }
  }

  return { pixels: out, width: targetWidth, height: targetHeight };
}

function applyPreviewMode(
  mode: CompositePreviewMode,
  splitPosition: number,
  composite: { r: Float32Array; g: Float32Array; b: Float32Array; l?: Float32Array },
  width: number,
  height: number,
) {
  if (mode === "composite") return composite;

  const { r, g, b, l } = composite;

  if (mode === "r") {
    return { r, g: r, b: r, l };
  }
  if (mode === "g") {
    return { r: g, g, b: g, l };
  }
  if (mode === "b") {
    return { r: b, g: b, b, l };
  }
  if (mode === "l" && l) {
    return { r: l, g: l, b: l, l };
  }

  if (mode === "split" && l) {
    const outR = new Float32Array(r.length);
    const outG = new Float32Array(g.length);
    const outB = new Float32Array(b.length);
    const splitX = Math.max(0, Math.min(width, Math.round(width * splitPosition)));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (x <= splitX) {
          outR[idx] = r[idx];
          outG[idx] = g[idx];
          outB[idx] = b[idx];
        } else {
          outR[idx] = l[idx];
          outG[idx] = l[idx];
          outB[idx] = l[idx];
        }
      }
    }

    return { r: outR, g: outG, b: outB, l };
  }

  return composite;
}

function ensureWorkingLayers(
  layers: CompositeLayer[],
  width: number,
  height: number,
): RenderLayerWorkingSet[] {
  const out: RenderLayerWorkingSet[] = [];

  for (const layer of layers) {
    const pixels = layer.alignedPixels ?? layer.pixels;
    if (!layer.enabled || !pixels || pixels.length !== width * height) continue;
    out.push({ layer, mono: pixels });
  }

  return out;
}

function applyMatching(
  layers: RenderLayerWorkingSet[],
  autoLinearMatch: boolean,
  autoBrightnessBalance: boolean,
): RenderLayerWorkingSet[] {
  if (layers.length <= 1) return layers;

  let next = layers.map((item) => ({ ...item, mono: item.mono }));
  const reference = next[0].mono;

  if (autoLinearMatch) {
    next = next.map((item, index) => {
      if (index === 0 || !item.layer.useForLinearMatch) return item;
      const { matched } = linearMatchToReference(item.mono, reference, 8, true);
      return { ...item, mono: matched };
    });
  }

  if (autoBrightnessBalance) {
    const buffers = next.map((item) => item.mono);
    const { balanced } = balanceLayerBrightness(buffers, 0, 8);
    next = next.map((item, index) => {
      if (index === 0 || !item.layer.useForBrightnessBalance) return item;
      return { ...item, mono: balanced[index] };
    });
  }

  return next;
}

function composeLayers(
  layers: RenderLayerWorkingSet[],
  width: number,
  height: number,
  options: CompositeRenderOptions,
) {
  const layerBuffers = layers.map((item) => item.mono);
  const extent = options.linkedStretch ? computeExtent(layerBuffers) : { min: 0, max: 0 }; // placeholder

  let outR: Float32Array | null = null;
  let outG: Float32Array | null = null;
  let outB: Float32Array | null = null;
  let luminance: Float32Array | undefined;
  let pixelMathError: CompositeRenderResult["pixelMathError"];

  const layerRgbs: Array<{ r: Float32Array; g: Float32Array; b: Float32Array }> = [];
  const layerMonos: Float32Array[] = [];

  for (const item of layers) {
    const itemExtent = options.linkedStretch ? extent : computeExtent([item.mono]);
    const normalized = options.linkedStretch
      ? normalizeToUnit(item.mono, extent.min, extent.max)
      : normalizeToUnit(item.mono, itemExtent.min, itemExtent.max);

    layerMonos.push(normalized);

    if (item.layer.isLuminance) {
      luminance = normalized;
      continue;
    }

    const srcR = new Float32Array(normalized.length);
    const srcG = new Float32Array(normalized.length);
    const srcB = new Float32Array(normalized.length);

    const tint = item.layer.tint;
    for (let i = 0; i < normalized.length; i++) {
      const value = normalized[i];
      srcR[i] = value * tint.r;
      srcG[i] = value * tint.g;
      srcB[i] = value * tint.b;
    }

    layerRgbs.push({ r: srcR, g: srcG, b: srcB });

    if (!outR || !outG || !outB) {
      outR = srcR;
      outG = srcG;
      outB = srcB;
      continue;
    }

    blendScanline(outR, outG, outB, srcR, srcG, srcB, item.layer.blendMode, item.layer.opacity);
  }

  if (!outR || !outG || !outB) {
    outR = new Float32Array(width * height);
    outG = new Float32Array(width * height);
    outB = new Float32Array(width * height);
  }

  if (luminance) {
    const lrgb = applyLuminance(outR, outG, outB, luminance, 1, options.colorSpace);
    outR = lrgb.r;
    outG = lrgb.g;
    outB = lrgb.b;
  }

  if (options.applyPixelMath) {
    const pixelMathResult = applyPixelMathProgram(
      {
        width,
        height,
        base: { r: outR, g: outG, b: outB },
        layerMonos,
        layerRgbs,
      },
      options.pixelMath as PixelMathProgram,
    );
    pixelMathError = pixelMathResult.error;
    outR = pixelMathResult.r;
    outG = pixelMathResult.g;
    outB = pixelMathResult.b;
  }

  return { r: outR, g: outG, b: outB, l: luminance, pixelMathError };
}

export async function renderComposite(
  request: RenderCompositeRequest,
): Promise<CompositeRenderResult> {
  const { layers, options, signal, mode } = request;
  assertNotAborted(signal);

  const scale = mode === "preview" ? Math.max(0.1, Math.min(1, options.previewScale)) : 1;
  let workingWidth = request.width;
  let workingHeight = request.height;

  const baseLayers = ensureWorkingLayers(layers, request.width, request.height);

  let workingLayers = baseLayers;
  if (scale < 0.999) {
    workingLayers = baseLayers.map((item) => {
      const ds = downsampleMono(item.mono, request.width, request.height, scale);
      workingWidth = ds.width;
      workingHeight = ds.height;
      return { ...item, mono: ds.pixels };
    });
  }

  assertNotAborted(signal);

  workingLayers = applyMatching(
    workingLayers,
    options.autoLinearMatch,
    options.autoBrightnessBalance,
  );

  assertNotAborted(signal);

  const composed = composeLayers(workingLayers, workingWidth, workingHeight, options);
  const view = applyPreviewMode(
    options.previewMode,
    options.splitPosition,
    composed,
    workingWidth,
    workingHeight,
  );

  return {
    rgbaData: toRgba(view.r, view.g, view.b),
    width: workingWidth,
    height: workingHeight,
    pixelMathError: composed.pixelMathError,
    channels: {
      r: view.r,
      g: view.g,
      b: view.b,
      l: view.l,
    },
  };
}
