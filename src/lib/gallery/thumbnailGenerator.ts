/**
 * 单文件缩略图重新生成 — 纯函数，不依赖 React hooks
 * 读取设置从 useSettingsStore.getState()，可在任何上下文中调用
 */

import { File } from "expo-file-system";
import { generateAndSaveThumbnail, generateVideoThumbnailToCache } from "./thumbnailCache";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { loadScientificFitsFromBuffer, getImageDimensions, getImagePixels } from "../fits/parser";
import { fitsToRGBA } from "../converter/formatConverter";
import { parseRasterFromBufferAsync } from "../image/rasterParser";
import type { FitsMetadata } from "../fits/types";

/**
 * 为单个文件重新生成缩略图。
 * 自动从 useSettingsStore 读取所需设置（thumbnailSize、thumbnailQuality 等）。
 * @returns { fileId, uri } — uri 为 null 表示跳过或失败
 */
export async function regenerateFileThumbnail(
  file: FitsMetadata,
): Promise<{ fileId: string; uri: string | null }> {
  const {
    thumbnailSize,
    thumbnailQuality,
    videoThumbnailTimeMs,
    defaultStretch,
    defaultColormap,
    defaultBlackPoint,
    defaultWhitePoint,
    defaultGamma,
  } = useSettingsStore.getState();

  try {
    const source = new File(file.filepath);
    if (!source.exists) {
      return { fileId: file.id, uri: null };
    }

    const buffer = await source.arrayBuffer();
    let uri: string | null = null;

    const tryFits = async () => {
      const fitsObj = await loadScientificFitsFromBuffer(buffer, {
        filename: file.filename,
      });
      const dims = getImageDimensions(fitsObj);
      const pixels = await getImagePixels(fitsObj);
      if (!dims || !pixels) return null;

      const rgba = fitsToRGBA(pixels, dims.width, dims.height, {
        stretch: defaultStretch,
        colormap: defaultColormap,
        blackPoint: defaultBlackPoint,
        whitePoint: defaultWhitePoint,
        gamma: defaultGamma,
      });

      return generateAndSaveThumbnail(
        file.id,
        rgba,
        dims.width,
        dims.height,
        thumbnailSize,
        thumbnailQuality,
      );
    };

    const tryRaster = async () => {
      const parsed = await parseRasterFromBufferAsync(buffer, {
        frameIndex: 0,
        cacheSize: 1,
        preferTiffDecoder: true,
        sourceUri: file.filepath,
        filename: file.filename,
      });
      const rgba = new Uint8ClampedArray(
        parsed.rgba.buffer,
        parsed.rgba.byteOffset,
        parsed.rgba.byteLength,
      );

      return generateAndSaveThumbnail(
        file.id,
        rgba,
        parsed.width,
        parsed.height,
        thumbnailSize,
        thumbnailQuality,
      );
    };

    const tryVideo = async () => {
      return generateVideoThumbnailToCache(
        file.id,
        file.filepath,
        file.thumbnailAtMs ?? videoThumbnailTimeMs,
        thumbnailQuality,
      );
    };

    if (file.sourceType === "fits") {
      try {
        uri = await tryFits();
      } catch {
        uri = await tryRaster().catch(() => null);
      }
    } else if (file.sourceType === "video") {
      try {
        uri = await tryVideo();
      } catch {
        uri = null;
      }
    } else if (file.sourceType === "audio") {
      uri = null;
    } else {
      try {
        uri = await tryRaster();
      } catch {
        uri = await tryFits().catch(() => null);
      }
    }

    return { fileId: file.id, uri };
  } catch {
    return { fileId: file.id, uri: null };
  }
}
