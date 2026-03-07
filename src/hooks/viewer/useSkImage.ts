/**
 * 从 RGBA 数据创建 Skia Image 的复用 Hook
 */

import { useMemo } from "react";
import { Skia, AlphaType, ColorType, type SkImage } from "@shopify/react-native-skia";
import { Logger, LOG_TAGS } from "../../lib/logger";

export function useSkImage(
  rgbaData: Uint8ClampedArray | null,
  width: number,
  height: number,
): SkImage | null {
  return useMemo(() => {
    if (!rgbaData || width <= 0 || height <= 0) return null;
    if (rgbaData.byteLength !== width * height * 4) {
      Logger.warn(LOG_TAGS.Viewer, "useSkImage: rgbaData size mismatch", {
        expected: width * height * 4,
        actual: rgbaData.byteLength,
      });
      return null;
    }
    try {
      const data = Skia.Data.fromBytes(
        new Uint8Array(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength),
      );
      return Skia.Image.MakeImage(
        {
          width,
          height,
          alphaType: AlphaType.Unpremul,
          colorType: ColorType.RGBA_8888,
        },
        data,
        width * 4,
      );
    } catch (e) {
      Logger.error(LOG_TAGS.Viewer, "useSkImage: MakeImage failed", e);
      return null;
    }
  }, [rgbaData, width, height]);
}
