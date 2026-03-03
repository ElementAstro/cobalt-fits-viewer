import type { ExportRenderOptions } from "./exportDecorations";
import type { ExportOutputSize, FitsTargetOptions, TiffTargetOptions } from "../fits/types";

export interface ExportActionOptions {
  fits?: Partial<FitsTargetOptions>;
  tiff?: Partial<TiffTargetOptions>;
  render?: ExportRenderOptions;
  customFilename?: string;
  outputSize?: ExportOutputSize;
  targetFileSize?: number;
  webpLossless?: boolean;
}
