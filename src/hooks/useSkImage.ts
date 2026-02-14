/**
 * 从 RGBA 数据创建 Skia Image 的复用 Hook
 */

import { useMemo } from "react";
import { Skia, AlphaType, ColorType, type SkImage } from "@shopify/react-native-skia";

export function useSkImage(
  rgbaData: Uint8ClampedArray | null,
  width: number,
  height: number,
): SkImage | null {
  return useMemo(() => {
    if (!rgbaData || width <= 0 || height <= 0) return null;
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
    } catch {
      return null;
    }
  }, [rgbaData, width, height]);
}
