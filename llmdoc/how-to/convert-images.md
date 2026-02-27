# How to Convert Images

A step-by-step guide for converting FITS images to various export formats in the Cobalt FITS Viewer.

1. **Open the FITS Viewer:** Navigate to a FITS image via the Files tab and tap to open it in the viewer.
2. **Access Export Dialog:** Tap the share/export icon in the viewer toolbar to open `src/components/common/ExportDialog.tsx`.
3. **Select Output Format:** Choose from available formats (PNG, JPEG, WebP, TIFF, BMP, FITS, XISF, SER). Reference `src/lib/converter/convertPresets.ts` for format-specific defaults.
4. **Configure Stretch Settings:** Select a stretch algorithm (linear, sqrt, log, asinh, power, zscale, percentile, adaptive, GHS) and adjust black/white points. See `src/lib/converter/stretchAlgorithms.ts` for algorithm details.
5. **Optional: Apply Colormap:** Choose from 16 colormaps if generating false-color output. See `src/lib/converter/colormaps.ts`.
6. **Choose Export Mode:** Select scientific (preserve original bitpix/WCS) or rendered (8-bit output) mode. Reference `src/lib/converter/exportCore.ts` for mode handling.
7. **Export:** Initiate conversion. The system uses chunked processing (`src/lib/converter/formatConverter.ts:fitsToRGBAChunked`) to prevent UI blocking.
8. **Verify:** Check the export directory for the converted file.

**For Batch Conversion:**

1. Navigate to Convert tab (`src/app/convert/index.tsx`).
2. Select multiple FITS files.
3. Configure naming rule (original, prefix, suffix, or sequence) via `src/lib/converter/batchProcessor.ts`.
4. Execute batch via `executeBatchConvert` function.
5. Monitor progress through callback API.

**Verify Task Completion:** Check export progress indicator and verify output files exist in the designated export directory.
