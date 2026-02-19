/**
 * 转换预设模板管理
 */

import type { ConvertPreset, ConvertOptions } from "../fits/types";
import {
  DEFAULT_CONVERT_PRESETS,
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_TIFF_TARGET_OPTIONS,
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
  switch (format) {
    case "png":
      return {
        quality: 100,
        bitDepth: 8,
        dpi: 72,
        tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
        fits: DEFAULT_FITS_TARGET_OPTIONS,
      };
    case "jpeg":
      return {
        quality: 85,
        bitDepth: 8,
        dpi: 72,
        tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
        fits: DEFAULT_FITS_TARGET_OPTIONS,
      };
    case "webp":
      return {
        quality: 80,
        bitDepth: 8,
        dpi: 72,
        tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
        fits: DEFAULT_FITS_TARGET_OPTIONS,
      };
    case "tiff":
      return {
        quality: 100,
        bitDepth: 16,
        dpi: 72,
        tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
        fits: DEFAULT_FITS_TARGET_OPTIONS,
      };
    case "bmp":
      return {
        quality: 100,
        bitDepth: 8,
        dpi: 72,
        tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
        fits: DEFAULT_FITS_TARGET_OPTIONS,
      };
    case "fits":
      return {
        quality: 100,
        bitDepth: 32,
        dpi: 72,
        tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
        fits: DEFAULT_FITS_TARGET_OPTIONS,
      };
    default:
      return {
        quality: 90,
        bitDepth: 8,
        dpi: 72,
        tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
        fits: DEFAULT_FITS_TARGET_OPTIONS,
      };
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
      return [8, 16, 32];
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
