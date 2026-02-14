/**
 * RGB 合成核心函数
 * 将多个单通道 FITS 图像合成为 RGB 彩色图像
 */

import { applyStretch } from "../converter/formatConverter";

export interface ChannelData {
  pixels: Float32Array;
  weight: number;
}

export interface ComposeOptions {
  red?: ChannelData;
  green?: ChannelData;
  blue?: ChannelData;
  luminance?: ChannelData;
  width: number;
  height: number;
  linkedStretch: boolean;
}

/**
 * 将 R/G/B 通道合成为 RGBA 数据
 * 每个通道独立归一化到 [0, 1] 后应用权重，再映射到 [0, 255]
 */
export function composeRGB(options: ComposeOptions): Uint8ClampedArray {
  const { red, green, blue, luminance, width, height, linkedStretch } = options;
  const totalPixels = width * height;
  const rgba = new Uint8ClampedArray(totalPixels * 4);

  // 计算全局范围（linked 模式）或独立归一化（unlinked 模式）
  let linkedMin: number | undefined;
  let linkedMax: number | undefined;
  if (linkedStretch) {
    const extent = getGlobalExtent([red?.pixels, green?.pixels, blue?.pixels]);
    linkedMin = extent.min;
    linkedMax = extent.max;
  }

  const rStretched = red
    ? applyWeightedStretch(red.pixels, red.weight, linkedMin, linkedMax)
    : null;
  const gStretched = green
    ? applyWeightedStretch(green.pixels, green.weight, linkedMin, linkedMax)
    : null;
  const bStretched = blue
    ? applyWeightedStretch(blue.pixels, blue.weight, linkedMin, linkedMax)
    : null;

  // LRGB: 用 luminance 通道替换亮度信息
  const lStretched = luminance ? applyWeightedStretch(luminance.pixels, luminance.weight) : null;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    let r = rStretched ? rStretched[i] : 0;
    let g = gStretched ? gStretched[i] : 0;
    let b = bStretched ? bStretched[i] : 0;

    if (lStretched) {
      // LRGB: 在 HSL 空间用 L 通道替换亮度
      const rgbMax = Math.max(r, g, b);
      const rgbMin = Math.min(r, g, b);
      const currentL = (rgbMax + rgbMin) / 2;
      const targetL = lStretched[i];

      if (currentL > 0 && currentL < 1) {
        // 缩放 RGB 以匹配目标亮度，保持色度
        const scale = targetL / currentL;
        r = Math.min(1, r * scale);
        g = Math.min(1, g * scale);
        b = Math.min(1, b * scale);
      } else {
        // 灰度情况
        r = g = b = targetL;
      }
    }

    rgba[idx] = Math.round(r * 255);
    rgba[idx + 1] = Math.round(g * 255);
    rgba[idx + 2] = Math.round(b * 255);
    rgba[idx + 3] = 255;
  }

  return rgba;
}

/**
 * 调整 RGBA 图像的饱和度
 * factor > 1 增加饱和度, < 1 减少饱和度
 */
export function adjustSaturation(rgba: Uint8ClampedArray, factor: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i] / 255;
    const g = rgba[i + 1] / 255;
    const b = rgba[i + 2] / 255;

    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    result[i] = Math.round(Math.max(0, Math.min(1, gray + (r - gray) * factor)) * 255);
    result[i + 1] = Math.round(Math.max(0, Math.min(1, gray + (g - gray) * factor)) * 255);
    result[i + 2] = Math.round(Math.max(0, Math.min(1, gray + (b - gray) * factor)) * 255);
    result[i + 3] = rgba[i + 3];
  }
  return result;
}

/**
 * 调整 RGBA 图像的色彩平衡（独立通道增益）
 */
export function adjustColorBalance(
  rgba: Uint8ClampedArray,
  rGain: number,
  gGain: number,
  bGain: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    result[i] = Math.min(255, Math.round(rgba[i] * rGain));
    result[i + 1] = Math.min(255, Math.round(rgba[i + 1] * gGain));
    result[i + 2] = Math.min(255, Math.round(rgba[i + 2] * bGain));
    result[i + 3] = rgba[i + 3];
  }
  return result;
}

/**
 * 对单通道像素数据应用拉伸和权重
 * linkedMin/linkedMax: 当 linkedStretch 为 true 时使用全局范围归一化
 */
function applyWeightedStretch(
  pixels: Float32Array,
  weight: number,
  linkedMin?: number,
  linkedMax?: number,
): Float32Array {
  let stretched: Float32Array;

  if (linkedMin !== undefined && linkedMax !== undefined) {
    // 使用全局 min/max 归一化（linked 模式）
    const range = linkedMax - linkedMin;
    if (range === 0) {
      stretched = new Float32Array(pixels.length).fill(0.5);
    } else {
      stretched = new Float32Array(pixels.length);
      for (let i = 0; i < pixels.length; i++) {
        stretched[i] = Math.max(0, Math.min(1, (pixels[i] - linkedMin) / range));
      }
    }
  } else {
    // 各通道独立归一化（unlinked 模式）
    stretched = applyStretch(pixels, "linear", 0, 1, 1);
  }

  if (weight !== 1.0) {
    const result = new Float32Array(stretched.length);
    for (let i = 0; i < stretched.length; i++) {
      result[i] = Math.min(1, stretched[i] * weight);
    }
    return result;
  }

  return stretched;
}

/**
 * 计算多个通道像素数据的全局 min/max
 */
function getGlobalExtent(channels: (Float32Array | undefined)[]): { min: number; max: number } {
  let gMin = Infinity,
    gMax = -Infinity;
  for (const ch of channels) {
    if (!ch) continue;
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i];
      if (!isNaN(v)) {
        if (v < gMin) gMin = v;
        if (v > gMax) gMax = v;
      }
    }
  }
  return { min: gMin, max: gMax };
}

/**
 * 预设通道映射
 */
export const CHANNEL_PRESETS: Record<string, { r: string; g: string; b: string; label: string }> = {
  RGB: { r: "R", g: "G", b: "B", label: "Natural RGB" },
  SHO: { r: "SII", g: "Ha", b: "OIII", label: "Hubble Palette (SHO)" },
  HOO: { r: "Ha", g: "OIII", b: "OIII", label: "HOO Bicolor" },
  HOS: { r: "Ha", g: "OIII", b: "SII", label: "HOS Palette" },
};

/**
 * 根据滤镜名自动匹配通道
 */
export function autoAssignChannels(
  files: Array<{ id: string; filter?: string }>,
  preset: string,
): { red?: string; green?: string; blue?: string } {
  const mapping = CHANNEL_PRESETS[preset];
  if (!mapping) return {};

  const findFile = (filterName: string): string | undefined => {
    return files.find((f) => {
      const filter = (f.filter ?? "").toUpperCase().trim();
      return filter === filterName.toUpperCase() || filter.includes(filterName.toUpperCase());
    })?.id;
  };

  return {
    red: findFile(mapping.r),
    green: findFile(mapping.g),
    blue: findFile(mapping.b),
  };
}
