import { useState, useEffect } from "react";
import {
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_TIFF_TARGET_OPTIONS,
  DEFAULT_XISF_TARGET_OPTIONS,
  DEFAULT_SER_TARGET_OPTIONS,
  type ExportFormat,
  type ExportOutputSize,
  type FitsColorLayout,
  type FitsCompression,
  type FitsExportMode,
  type FitsTargetOptions,
  type TiffCompression,
  type TiffMultipageMode,
  type TiffTargetOptions,
} from "../lib/fits/types";
import { supportsQuality } from "../lib/converter/convertPresets";
import { estimateFileSize } from "../lib/converter/formatConverter";
import { isTargetSizeAllowed, normalizeTargetFileSize } from "../lib/converter/compressionPolicy";
import type { ExportRenderOptions } from "../lib/converter/exportDecorations";
import type { ExportActionOptions } from "../lib/converter/exportActionOptions";
import { useSettingsStore } from "../stores/useSettingsStore";

interface UseExportDialogStateArgs {
  filename: string;
  format: ExportFormat;
  width?: number;
  height?: number;
  fitsScientificAvailable: boolean;
}

export function useExportDialogState({
  filename,
  format,
  width,
  height,
  fitsScientificAvailable,
}: UseExportDialogStateArgs) {
  const savedQuality = useSettingsStore((s) => s.defaultExportQuality);
  const savedAnnotations = useSettingsStore((s) => s.includeAnnotationsByDefault);

  // --- State ---
  const [quality, setQuality] = useState(savedQuality);
  const [fitsMode, setFitsMode] = useState<FitsExportMode>(DEFAULT_FITS_TARGET_OPTIONS.mode);
  const [fitsCompression, setFitsCompression] = useState<FitsCompression>(
    DEFAULT_FITS_TARGET_OPTIONS.compression,
  );
  const [fitsBitpix, setFitsBitpix] = useState<FitsTargetOptions["bitpix"]>(
    DEFAULT_FITS_TARGET_OPTIONS.bitpix,
  );
  const [fitsColorLayout, setFitsColorLayout] = useState<FitsColorLayout>(
    DEFAULT_FITS_TARGET_OPTIONS.colorLayout,
  );
  const [fitsPreserveOriginalHeader, setFitsPreserveOriginalHeader] = useState(
    DEFAULT_FITS_TARGET_OPTIONS.preserveOriginalHeader,
  );
  const [fitsPreserveWcs, setFitsPreserveWcs] = useState(DEFAULT_FITS_TARGET_OPTIONS.preserveWcs);
  const [tiffCompression, setTiffCompression] = useState<TiffCompression>(
    DEFAULT_TIFF_TARGET_OPTIONS.compression,
  );
  const [tiffMultipage, setTiffMultipage] = useState<TiffMultipageMode>(
    DEFAULT_TIFF_TARGET_OPTIONS.multipage,
  );
  const [tiffBitDepth, setTiffBitDepth] = useState<8 | 16 | 32>(
    DEFAULT_TIFF_TARGET_OPTIONS.bitDepth ?? 16,
  );
  const [tiffDpi, setTiffDpi] = useState(DEFAULT_TIFF_TARGET_OPTIONS.dpi ?? 72);
  const [includeAnnotations, setIncludeAnnotations] = useState(savedAnnotations);
  const [includeWatermark, setIncludeWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [outputMaxDim, setOutputMaxDim] = useState<number | undefined>(undefined);
  const [compressionMode, setCompressionMode] = useState<"quality" | "targetSize">("quality");
  const [targetFileSizeKB, setTargetFileSizeKB] = useState(500);
  const [webpLossless, setWebpLossless] = useState(false);
  const [customFilename, setCustomFilename] = useState(() => filename.replace(/\.[^.]+$/, ""));

  // --- Effects ---
  useEffect(() => {
    setCustomFilename(filename.replace(/\.[^.]+$/, ""));
  }, [filename]);

  useEffect(() => {
    if (format === "jpeg") setQuality(85);
    else if (format === "webp") setQuality(80);
    else setQuality(100);
  }, [format]);

  useEffect(() => {
    if (!fitsScientificAvailable && fitsMode === "scientific") {
      setFitsMode("rendered");
    }
  }, [fitsScientificAvailable, fitsMode]);

  useEffect(() => {
    if (compressionMode !== "targetSize") return;
    if (isTargetSizeAllowed(format, webpLossless)) return;
    setCompressionMode("quality");
  }, [compressionMode, format, webpLossless]);

  // --- Derived values ---
  const showQuality = supportsQuality(format);
  const showFitsOptions = format === "fits";
  const showTiffOptions = format === "tiff";

  const fitsOptions: Partial<FitsTargetOptions> | undefined = showFitsOptions
    ? {
        mode: fitsMode,
        compression: fitsCompression,
        bitpix: fitsBitpix,
        colorLayout: fitsColorLayout,
        preserveOriginalHeader: fitsPreserveOriginalHeader,
        preserveWcs: fitsPreserveWcs,
      }
    : undefined;

  const tiffOptions: Partial<TiffTargetOptions> | undefined = showTiffOptions
    ? {
        compression: tiffCompression,
        multipage: tiffMultipage,
        bitDepth: tiffBitDepth,
        dpi: tiffDpi,
      }
    : undefined;

  const renderOptions: ExportRenderOptions | undefined =
    includeAnnotations || includeWatermark
      ? {
          includeAnnotations,
          includeWatermark,
          watermarkText: includeWatermark ? watermarkText : undefined,
        }
      : undefined;

  const resolvedOutputSize: ExportOutputSize | undefined = outputMaxDim
    ? { maxWidth: outputMaxDim, maxHeight: outputMaxDim }
    : undefined;

  const resolvedTargetFileSize = normalizeTargetFileSize(
    format,
    compressionMode,
    targetFileSizeKB * 1024,
    webpLossless,
  );

  const estimatedSize =
    width && height
      ? estimateFileSize(width, height, {
          format,
          quality,
          bitDepth: showTiffOptions ? tiffBitDepth : 8,
          dpi: showTiffOptions ? tiffDpi : 72,
          tiff: {
            ...DEFAULT_TIFF_TARGET_OPTIONS,
            ...(tiffOptions ?? {}),
          },
          fits: {
            ...DEFAULT_FITS_TARGET_OPTIONS,
            ...(fitsOptions ?? {}),
          },
          xisf: DEFAULT_XISF_TARGET_OPTIONS,
          ser: DEFAULT_SER_TARGET_OPTIONS,
          stretch: "linear",
          colormap: "grayscale",
          blackPoint: 0,
          whitePoint: 1,
          gamma: 1,
          outputBlack: 0,
          outputWhite: 1,
          includeAnnotations: false,
          includeWatermark: false,
          outputSize: resolvedOutputSize,
        })
      : null;

  const buildActionOptions = (): ExportActionOptions => ({
    fits: fitsOptions,
    tiff: tiffOptions,
    render: renderOptions,
    customFilename: customFilename.trim() || undefined,
    outputSize: resolvedOutputSize,
    targetFileSize: resolvedTargetFileSize,
    webpLossless: webpLossless || undefined,
  });

  return {
    // State values
    quality,
    fitsMode,
    fitsCompression,
    fitsBitpix,
    fitsColorLayout,
    fitsPreserveOriginalHeader,
    fitsPreserveWcs,
    tiffCompression,
    tiffMultipage,
    tiffBitDepth,
    tiffDpi,
    includeAnnotations,
    includeWatermark,
    watermarkText,
    outputMaxDim,
    compressionMode,
    targetFileSizeKB,
    webpLossless,
    customFilename,

    // Setters
    setQuality,
    setFitsMode,
    setFitsCompression,
    setFitsBitpix,
    setFitsColorLayout,
    setFitsPreserveOriginalHeader,
    setFitsPreserveWcs,
    setTiffCompression,
    setTiffMultipage,
    setTiffBitDepth,
    setTiffDpi,
    setIncludeAnnotations,
    setIncludeWatermark,
    setWatermarkText,
    setOutputMaxDim,
    setCompressionMode,
    setTargetFileSizeKB,
    setWebpLossless,
    setCustomFilename,

    // Derived
    showQuality,
    showFitsOptions,
    showTiffOptions,
    estimatedSize,

    // Action helper
    buildActionOptions,
  };
}
