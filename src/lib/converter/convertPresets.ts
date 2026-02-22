/**
 * 转换预设模板管理
 */

import type { ConvertPreset, ConvertOptions } from "../fits/types";
import {
  DEFAULT_CONVERT_PRESETS,
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_TIFF_TARGET_OPTIONS,
  DEFAULT_XISF_TARGET_OPTIONS,
  DEFAULT_SER_TARGET_OPTIONS,
} from "../fits/types";

/**
 * 获取所有预设（内置 + 用户自定义）
 */
export function getAllPresets(userPresets: ConvertPreset[]): ConvertPreset[] {
  return [...DEFAULT_CONVERT_PRESETS, ...userPresets];
}

/**
 * 创建用户自定义预设
 */
export function createPreset(
  name: string,
  description: string,
  options: ConvertOptions,
): ConvertPreset {
  return {
    id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    description,
    options: { ...options },
  };
}

/**
 * 获取格式的默认选项
 */
export function getDefaultOptionsForFormat(
  format: ConvertOptions["format"],
): Partial<ConvertOptions> {
  const baseDefaults: Partial<ConvertOptions> = {
    stretch: "asinh",
    colormap: "grayscale",
    blackPoint: 0,
    whitePoint: 1,
    gamma: 1,
    brightness: 0,
    contrast: 1,
    mtfMidtone: 0.25,
    curvePreset: "linear",
    outputBlack: 0,
    outputWhite: 1,
    includeAnnotations: false,
    includeWatermark: false,
    dpi: 72,
    tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
    fits: DEFAULT_FITS_TARGET_OPTIONS,
    xisf: DEFAULT_XISF_TARGET_OPTIONS,
    ser: DEFAULT_SER_TARGET_OPTIONS,
  };
  switch (format) {
    case "png":
      return { ...baseDefaults, quality: 100, bitDepth: 8 };
    case "jpeg":
      return { ...baseDefaults, quality: 85, bitDepth: 8 };
    case "webp":
      return { ...baseDefaults, quality: 80, bitDepth: 8 };
    case "tiff":
      return { ...baseDefaults, quality: 100, bitDepth: 16 };
    case "bmp":
      return { ...baseDefaults, quality: 100, bitDepth: 8 };
    case "fits":
    case "xisf":
      return { ...baseDefaults, quality: 100, bitDepth: 32 };
    case "ser":
      return { ...baseDefaults, quality: 100, bitDepth: 16 };
    default:
      return { ...baseDefaults, quality: 90, bitDepth: 8 };
  }
}

/**
 * 格式支持的位深
 */
export function getSupportedBitDepths(format: ConvertOptions["format"]): number[] {
  switch (format) {
    case "tiff":
      return [8, 16, 32];
    case "png":
      return [8, 16];
    case "fits":
    case "xisf":
      return [8, 16, 32];
    case "ser":
      return [8, 16];
    default:
      return [8];
  }
}

/**
 * 格式是否支持质量参数
 */
export function supportsQuality(format: ConvertOptions["format"]): boolean {
  return format === "jpeg" || format === "webp";
}
