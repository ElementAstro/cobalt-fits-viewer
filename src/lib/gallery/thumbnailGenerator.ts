/**
 * 单文件缩略图重新生成 — 纯函数，不依赖 React hooks
 * 读取设置从 useSettingsStore.getState()，可在任何上下文中调用
 */

import { File } from "expo-file-system";
import {
  saveThumbnailFromRGBA,
  saveThumbnailFromVideo,
  type ThumbnailPolicyOverrides,
} from "./thumbnailWorkflow";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { fitsToRGBA } from "../converter/formatConverter";
import type { FitsMetadata } from "../fits/types";
import { parseImageBuffer } from "../import/imageParsePipeline";

/**
 * 为单个文件重新生成缩略图。
 * 自动从 useSettingsStore 读取所需设置（thumbnailSize、thumbnailQuality 等）。
 * @returns { fileId, uri } — uri 为 null 表示跳过或失败
 */
export async function regenerateFileThumbnail(
  file: FitsMetadata,
  policyOverrides: ThumbnailPolicyOverrides = {},
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

    const tryVideo = async () => {
      return saveThumbnailFromVideo(
        file.id,
        file.filepath,
        file.thumbnailAtMs ?? videoThumbnailTimeMs,
        {
          thumbnailSize,
          thumbnailQuality,
          videoThumbnailTimeMs,
          ...policyOverrides,
        },
      );
    };

    if (file.sourceType === "video") {
      try {
        const uri = await tryVideo();
        return { fileId: file.id, uri };
      } catch {
        return { fileId: file.id, uri: null };
      }
    }

    if (file.sourceType === "audio") {
      return { fileId: file.id, uri: null };
    }

    const buffer = await source.arrayBuffer();
    const parsed = await parseImageBuffer({
      buffer,
      filename: file.filename,
      filepath: file.filepath,
      fileSize: file.fileSize,
    });

    if (!parsed.dimensions || parsed.dimensions.width <= 0 || parsed.dimensions.height <= 0) {
      return { fileId: file.id, uri: null };
    }

    let uri: string | null = null;
    if (parsed.sourceType === "fits") {
      if (!parsed.pixels) {
        return { fileId: file.id, uri: null };
      }
      const rgba = fitsToRGBA(parsed.pixels, parsed.dimensions.width, parsed.dimensions.height, {
        stretch: defaultStretch,
        colormap: defaultColormap,
        blackPoint: defaultBlackPoint,
        whitePoint: defaultWhitePoint,
        gamma: defaultGamma,
      });
      uri = saveThumbnailFromRGBA(
        file.id,
        rgba,
        parsed.dimensions.width,
        parsed.dimensions.height,
        {
          thumbnailSize,
          thumbnailQuality,
          ...policyOverrides,
        },
      );
    } else if (parsed.rgba) {
      const rgba = new Uint8ClampedArray(
        parsed.rgba.buffer,
        parsed.rgba.byteOffset,
        parsed.rgba.byteLength,
      );
      uri = saveThumbnailFromRGBA(
        file.id,
        rgba,
        parsed.dimensions.width,
        parsed.dimensions.height,
        {
          thumbnailSize,
          thumbnailQuality,
          ...policyOverrides,
        },
      );
    }

    return { fileId: file.id, uri };
  } catch {
    return { fileId: file.id, uri: null };
  }
}
