# Architecture of Utilities Module

## 1. Identity

- **What it is:** A dual-subsystem module providing image conversion and cloud backup capabilities.
- **Purpose:** Enables format conversion for FITS images and reliable cloud backup/restore for application data with multi-provider support.

## 2. Core Components

### Converter Subsystem

- `src/lib/converter/formatConverter.ts` (`fitsToRGBA`, `fitsToRGBAChunked`, `estimateFileSize`): Core FITS to RGBA conversion pipeline with stretch algorithms, gamma correction, colormaps, and chunked processing for non-blocking operation.
- `src/lib/converter/exportCore.ts` (`encodeExportRequest`, `compressToTargetSize`, `encodeFits`): Main export orchestration handling PNG, JPEG, WebP, TIFF, BMP, FITS, XISF, and SER formats with scientific/rendered mode support.
- `src/lib/converter/batchProcessor.ts` (`executeBatchConvert`, `createBatchTask`): Batch conversion processor with naming rules and sequential file processing.
- `src/lib/converter/stretchAlgorithms.ts` (`getStretchFn`, `applyStretch`, `adaptiveStretch`, `generalizedHyperbolicStretch`): 8+ stretch algorithms including linear, sqrt, log, asinh, power, zscale, percentile, adaptive, and generalized hyperbolic stretch.
- `src/lib/converter/convertPresets.ts` (`getAllPresets`, `getDefaultOptionsForFormat`): Preset management providing format-specific defaults.
- `src/lib/converter/colormaps.ts` (`getColormapLUT`): 16 colormap lookup tables with standard and accessibility profiles.
- `src/lib/converter/exportDecorations.ts`: Annotation and watermark overlay for exports.

### Backup Subsystem

- `src/lib/backup/backupService.ts` (`performBackup`, `performRestore`, `verifyBackupIntegrity`): Core backup/restore orchestration with incremental sync, progress callbacks, and remote pruning.
- `src/lib/backup/manifest.ts` (`createManifest`, `parseManifest`): Backup manifest generation and parsing with cross-reference validation for 14 data domains.
- `src/lib/backup/types.ts`: Type definitions for cloud providers, backup manifest, progress tracking, and restore conflict strategies.
- `src/lib/backup/cloudProvider.ts` (`ICloudProvider`, `BaseCloudProvider`): Abstract interface defining connect, disconnect, uploadFile, downloadFile, deleteFile, listFiles operations.
- `src/lib/backup/providers/googleDrive.ts` (`GoogleDriveProvider`): Google Drive implementation using Drive REST API v3 with OAuth via @react-native-google-signin.
- `src/lib/backup/providers/onedrive.ts`, `src/lib/backup/providers/dropbox.ts`, `src/lib/backup/providers/webdav.ts`, `src/lib/backup/providers/sftp.ts`: Additional cloud provider implementations.
- `src/lib/backup/backupUtils.ts` (`withRetry`, `computeSha256Hex`, `restoreMetadataDomains`): Shared utilities with exponential backoff retry and SHA-256 hashing.
- `src/lib/backup/localBackup.ts`: Local backup package creation and import for offline transfers.
- `src/lib/backup/lanTransfer.ts`: LAN server for local network backup transfers.

## 3. Execution Flow (LLM Retrieval Map)

### Image Conversion Flow

1. **User Request:** User initiates export from viewer UI (`src/components/common/ExportDialog.tsx`).
2. **Preset Selection:** User selects format via `convertPresets.ts:getDefaultOptionsForFormat`.
3. **Conversion Pipeline:**
   - `exportCore.ts:encodeExportRequest` receives format and options.
   - `formatConverter.ts:fitsToRGBAChunked` applies stretch algorithm and colormap.
   - Chunked processing yields to main thread for UI responsiveness.
4. **Encoding:** Selected encoder (PNG/JPEG/WebP/TIFF/BMP) processes RGBA data.
5. **Output:** `expo-file-system` writes to export directory.

### Backup Flow

1. **User Request:** User triggers backup from settings (`src/app/backup/index.tsx`).
2. **Manifest Creation:** `manifest.ts:createManifest` captures all 14 data domains.
3. **Provider Connection:** `cloudProvider.ts` establishes OAuth/token-authenticated connection.
4. **Incremental Sync:** `backupService.ts:performBackup` compares SHA-256 hashes, uploads only changed files.
5. **Progress Tracking:** Bytes transferred callback provides UI feedback.
6. **Remote Pruning:** Stale remote files removed after successful upload.

### Restore Flow

1. **Manifest Download:** `backupService.ts:performRestore` downloads remote manifest.
2. **Conflict Resolution:** User selects strategy (skip/overwrite/merge).
3. **File Download:** Binary files downloaded with integrity verification.
4. **Metadata Restore:** `backupUtils.ts:restoreMetadataDomains` restores AsyncStorage domains.

## 4. Design Rationale

- **Provider Pattern:** Abstract `ICloudProvider` interface enables provider swap without modifying backup service logic.
- **Chunked Processing:** Large FITS files processed in 1M pixel chunks to maintain UI responsiveness.
- **Incremental Backup:** SHA-256 hash comparison minimizes bandwidth and storage costs.
- **Manifest Versioning:** JSON manifest with cross-reference validation ensures data integrity across 14 domains.
- **Scientific vs Rendered Modes:** Dual export paths preserve original FITS data for analysis while supporting visual output formats.
