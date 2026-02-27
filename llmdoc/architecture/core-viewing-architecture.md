# Architecture of Core Viewing

## 1. Identity

- **What it is:** A three-layer architecture combining FITS parsing, GPU-based image rendering, and gallery management.
- **Purpose:** Provides the complete viewing pipeline from raw astronomical file to displayed image with organization capabilities.

## 2. Core Components

### FITS Layer (`src/lib/fits/`)

- `src/lib/fits/types.ts` (StretchType, ColormapType, ViewerState, FitsMetadata, Album): Central type definitions for all viewer and gallery data structures.
- `src/lib/fits/parser.ts` (loadFitsFromBufferAuto, loadScientificFitsFromBuffer, extractMetadata, getImagePixels): Main FITS parsing functions with auto-format detection.
- `src/lib/fits/writer.ts` (writeFitsImage, encodePlaneData): FITS file writing with mono2d, rgbCube3d, monoCube3d support.
- `src/lib/fits/headerWriter.ts` (writeHeaderKeywords): In-place header keyword injection.
- `src/lib/fits/compression.ts` (gzipFitsBytes, gunzipFitsBytes): GZIP wrapper using pako.

### Viewer Layer (`src/components/fits/`, `src/app/viewer/`)

- `src/app/viewer/[id].tsx` (ViewerDetailScreen): Main viewer orchestrator - handles file loading via useFitsFile, processing via useImageProcessing, coordinates all viewer components.
- `src/components/fits/FitsCanvas.tsx` (FitsCanvas): Core GPU canvas using @shopify/react-native-skia ImageShader. Implements pan, pinch-zoom, double-tap zoom, tap/long-press gestures via react-native-gesture-handler.
- `src/components/fits/ViewerToolbar.tsx` (ViewerToolbar): Top toolbar with navigation, filename, astrometry button, controls toggle, fullscreen.
- `src/components/fits/ZoomControls.tsx` (ZoomControls): On-screen zoom buttons (in, out, fit, 1:1).
- `src/components/fits/ViewerControlPanel.tsx` (ViewerControlPanel): Settings accordion with histogram/levels, stretch, colormap, brightness, contrast, overlays, HDU navigation.
- `src/components/fits/HistogramLevels.tsx` (HistogramLevels): Interactive histogram with draggable black/white handles.
- `src/components/fits/PixelInspector.tsx` (PixelInspector): Overlay showing x, y coordinates, pixel value, RA/Dec from WCS.
- `src/components/fits/Minimap.tsx` (Minimap): Thumbnail overview with viewport position.
- `src/components/fits/StatsOverlay.tsx` (StatsOverlay): Image statistics (min, max, mean, median, stddev).

### Gallery Layer (`src/lib/gallery/`, `src/components/gallery/`)

- `src/lib/gallery/albumManager.ts` (createAlbum, evaluateSmartRules, suggestSmartAlbums): Album creation, smart rule evaluation, auto-suggestions.
- `src/lib/gallery/metadataIndex.ts` (buildMetadataIndex, searchFiles, groupByLocation/Date/Object): Searchable index and grouping utilities.
- `src/lib/gallery/frameClassifier.ts` (classifyFrameType): Auto-classifies frame types from headers/filenames.
- `src/lib/gallery/duplicateDetector.ts` (computeQuickHash, findDuplicateGroups): Hash-based duplicate detection.
- `src/lib/gallery/fileRenamer.ts` (generateFilename, previewRenames): Batch rename with template variables.
- `src/lib/gallery/integrationReport.ts` (generateIntegrationReport, exportReportAsMarkdown): Exposure statistics.

### State Management (`src/stores/`)

- `src/stores/useViewerStore.ts` (useViewerStore): Viewer display parameters (stretch, colormap, blackPoint, whitePoint, gamma, overlays).
- `src/stores/useAlbumStore.ts` (addAlbum, removeAlbum, updateAlbum, addImageToAlbum): Album CRUD with MMKV persistence.
- `src/stores/useGalleryStore.ts` (setViewMode, setFilterObject, setSelectionMode): Gallery view and filter state.

### Key Hooks (`src/hooks/`)

- `src/hooks/useFitsFile.ts` (useFitsFile): FITS file loading - returns metadata, headers, pixels, dimensions, loading state.
- `src/hooks/useImageProcessing.ts` (useImageProcessing): Converts Float32Array to RGBA with stretch/colormap. Supports chunked processing for large images.
- `src/hooks/useViewerHotkeys.ts` (useViewerHotkeys): Web keyboard shortcuts (+/- zoom, g/c/m/p toggles, arrows pan).
- `src/hooks/useAlbums.ts` (createNewAlbum, createSmartAlbum, refreshSmartAlbums): Album management hooks.
- `src/hooks/useGallery.ts` (useGallery): Returns filtered files, grouped data, search function.

### Transform Utilities (`src/lib/viewer/`)

- `src/lib/viewer/transform.ts` (computeFitGeometry, zoomAroundPoint, screenToSourcePixel): Pan/zoom math with bounds checking.

## 3. Execution Flow (LLM Retrieval Map)

### FITS Viewing Pipeline

1. **File Selection:** User selects file from gallery or file browser.
2. **Loading:** `src/app/viewer/[id].tsx` calls `useFitsFile` hook.
3. **Parsing:** `src/hooks/useFitsFile.ts` invokes `loadScientificFitsFromBuffer` in `src/lib/fits/parser.ts:5-45`.
4. **Metadata Extraction:** `extractMetadata` parses headers for observation info.
5. **Pixel Extraction:** `getImagePixels` returns Float32Array.
6. **Processing:** Viewer screen passes pixels to `useImageProcessing` hook.
7. **Stretch Application:** `useImageProcessing` applies stretch algorithm via `lib/converter/formatConverter.ts`.
8. **RGBA Conversion:** Returns Uint8ClampedArray ready for Skia.
9. **Rendering:** `FitsCanvas` uses Skia ImageShader to display image.
10. **Interaction:** Gesture handlers in `FitsCanvas` call `lib/viewer/transform.ts` for zoom/pan calculations.

### Gallery Pipeline

1. **Index Build:** `useGallery` hook calls `buildMetadataIndex` on app load.
2. **Filter Application:** Store filters applied via `useGalleryStore`.
3. **Rendering:** `ThumbnailGrid` displays FlashList of filtered images.
4. **Album Selection:** User navigates to album detail.
5. **Smart Evaluation:** `evaluateSmartRules` computes matching imageIds dynamically.
6. **Batch Operations:** Selection mode enables batch tag/rename via `BatchTagSheet` / `BatchRenameSheet`.

## 4. Design Rationale

- **Separation of Concerns:** FITS parsing is decolved from rendering via hooks. useFitsFile handles loading, useImageProcessing handles transformation.
- **Progressive Rendering:** Viewer shows preview first (fast processing), then full quality (chunked for large images).
- **State Centralization:** All viewer parameters in Zustand store for consistency across components.
- **Smart Albums:** Rules evaluated on-the-fly rather than storing results, ensuring albums stay current with changing file metadata.
