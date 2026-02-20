import {
  alignFrameAsync,
  type AlignmentOptions,
  type AlignmentTransform,
} from "../stacking/alignment";
import type { ManualRegistrationMode } from "../stacking/starAnnotationLinkage";
import type { CompositeFramingMode, CompositeRegistrationMode } from "./types";

export interface RegistrationAdapterRequest {
  layers: Float32Array[];
  width: number;
  height: number;
  mode: CompositeRegistrationMode;
  framing: CompositeFramingMode;
  manualControlPoints?: {
    ref: Array<{ x: number; y: number }>;
    target: Array<{ x: number; y: number }>;
    mode: ManualRegistrationMode;
  };
  alignmentOptions?: Omit<AlignmentOptions, "detectionRuntime">;
}

export interface RegistrationAdapterResult {
  layers: Float32Array[];
  width: number;
  height: number;
  transforms: AlignmentTransform[];
  crop: { x: number; y: number; width: number; height: number };
}

function getCommonMaskCrop(layers: Float32Array[], width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let valid = true;
      for (let l = 0; l < layers.length; l++) {
        const v = layers[l][idx];
        if (!Number.isFinite(v) || v <= 0) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width, height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function getCogCrop(layers: Float32Array[], width: number, height: number) {
  const threshold = Math.max(1, Math.ceil(layers.length * 0.6));

  let sumX = 0;
  let sumY = 0;
  let weight = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let count = 0;
      for (let l = 0; l < layers.length; l++) {
        const v = layers[l][idx];
        if (Number.isFinite(v) && v > 0) count++;
      }
      if (count < threshold) continue;
      sumX += x * count;
      sumY += y * count;
      weight += count;
    }
  }

  if (weight === 0) return getCommonMaskCrop(layers, width, height);

  const centerX = Math.round(sumX / weight);
  const centerY = Math.round(sumY / weight);
  const minCrop = getCommonMaskCrop(layers, width, height);

  const targetWidth = Math.max(16, minCrop.width);
  const targetHeight = Math.max(16, minCrop.height);

  let x = centerX - Math.floor(targetWidth / 2);
  let y = centerY - Math.floor(targetHeight / 2);

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + targetWidth > width) x = width - targetWidth;
  if (y + targetHeight > height) y = height - targetHeight;

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.min(targetWidth, width),
    height: Math.min(targetHeight, height),
  };
}

function cropLayer(
  layer: Float32Array,
  width: number,
  crop: { x: number; y: number; width: number; height: number },
): Float32Array {
  if (crop.x === 0 && crop.y === 0 && crop.width === width) {
    return layer;
  }

  const out = new Float32Array(crop.width * crop.height);
  for (let y = 0; y < crop.height; y++) {
    const srcOffset = (crop.y + y) * width + crop.x;
    const dstOffset = y * crop.width;
    out.set(layer.subarray(srcOffset, srcOffset + crop.width), dstOffset);
  }
  return out;
}

function applyFraming(
  layers: Float32Array[],
  width: number,
  height: number,
  framing: CompositeFramingMode,
) {
  let crop = { x: 0, y: 0, width, height };

  if (framing === "min") {
    crop = getCommonMaskCrop(layers, width, height);
  } else if (framing === "cog") {
    crop = getCogCrop(layers, width, height);
  }

  if (crop.width <= 0 || crop.height <= 0) {
    crop = { x: 0, y: 0, width, height };
  }

  return {
    layers: layers.map((layer) => cropLayer(layer, width, crop)),
    width: crop.width,
    height: crop.height,
    crop,
  };
}

export async function registerCompositeLayers(
  request: RegistrationAdapterRequest,
): Promise<RegistrationAdapterResult> {
  const { layers, width, height, mode, framing, alignmentOptions, manualControlPoints } = request;

  if (layers.length === 0) {
    return {
      layers: [],
      width,
      height,
      transforms: [],
      crop: { x: 0, y: 0, width, height },
    };
  }

  if (mode === "none" || layers.length === 1) {
    const framed = applyFraming(layers, width, height, framing);
    return {
      layers: framed.layers,
      width: framed.width,
      height: framed.height,
      transforms: [
        {
          matrix: [1, 0, 0, 0, 1, 0],
          matchedStars: 0,
          rmsError: 0,
          fallbackUsed: "none",
        },
      ],
      crop: framed.crop,
    };
  }

  const reference = layers[0];
  const alignedLayers: Float32Array[] = [reference];
  const transforms: AlignmentTransform[] = [
    {
      matrix: [1, 0, 0, 0, 1, 0],
      matchedStars: 0,
      rmsError: 0,
      fallbackUsed: "none",
    },
  ];

  for (let i = 1; i < layers.length; i++) {
    const result = await alignFrameAsync(reference, layers[i], width, height, mode, {
      fallbackToTranslation: true,
      ...(manualControlPoints ? { manualControlPoints } : {}),
      ...(alignmentOptions ?? {}),
    });
    alignedLayers.push(result.aligned);
    transforms.push(result.transform);
  }

  const framed = applyFraming(alignedLayers, width, height, framing);

  return {
    layers: framed.layers,
    width: framed.width,
    height: framed.height,
    transforms,
    crop: framed.crop,
  };
}
