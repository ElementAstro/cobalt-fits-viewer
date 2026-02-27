# Export Formats Reference

This document provides a high-level summary and pointers to source-of-truth information for image export formats supported by the Converter module.

## 1. Core Summary

The Converter module supports 8 export formats with varying capabilities: PNG, JPEG, WebP, TIFF, BMP, FITS, XISF, and SER. Each format has specific bit-depth support, compression options, and use cases ranging from scientific data preservation to web-ready visual output.

## 2. Source of Truth

### Format Specification

- **Primary Code:** `src/lib/converter/exportCore.ts` - Main export orchestration with format-specific encoding logic.
- **Format Presets:** `src/lib/converter/convertPresets.ts` - `getDefaultOptionsForFormat` provides format-specific defaults.
- **Stretch Algorithms:** `src/lib/converter/stretchAlgorithms.ts` - 8+ algorithms for image transformation before export.
- **Colormaps:** `src/lib/converter/colormaps.ts` - 16 colormap LUTs for false-color output.

### Format Details

| Format | Bit Depth | Compression           | Scientific Mode    | Key Use Case             |
| ------ | --------- | --------------------- | ------------------ | ------------------------ |
| PNG    | 8/16      | Lossless              | No                 | Web, lossless archiving  |
| JPEG   | 8         | Lossy (quality 10-95) | No                 | Web, thumbnails          |
| WebP   | 8         | Lossy/Lossless        | No                 | Modern web, transparency |
| TIFF   | 8/16/32   | LZW/Deflate           | Yes (float data)   | Printing, scientific     |
| BMP    | 8         | None                  | No                 | Legacy compatibility     |
| FITS   | 8/16/32   | Gzip                  | Yes (preserve WCS) | Scientific analysis      |
| XISF   | 8/16/32   | Optional              | Yes                | FITS successor format    |
| SER    | 8/16      | None                  | Yes                | Video camera raw         |

### Backup Integration

- **Backup Service:** `src/lib/backup/backupService.ts` - Core backup/restore with incremental sync.
- **Manifest Schema:** `src/lib/backup/manifest.ts` - Version 4 manifest with 14 data domains.
- **Cloud Providers:** `src/lib/backup/providers/*.ts` - Google Drive, OneDrive, Dropbox, WebDAV, SFTP implementations.

### Related Architecture

- `/llmdoc/architecture/utilities-architecture.md` - Full module architecture with execution flows.
- `/llmdoc/overview/utilities-overview.md` - High-level module overview.

### External Documentation

- FITS Standard: <https://fits.gsfc.nasa.gov/fits_standard.html>
- TIFF 6.0 Specification: <https://www.adobe.io/open/standards/TIFF.html>
- WebP Specification: <https://developers.google.com/speed/webp/docs/riff_container>
