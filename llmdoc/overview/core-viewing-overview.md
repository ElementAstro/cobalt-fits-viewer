# Core Viewing Overview

## 1. Identity

- **What it is:** The Core Viewing module provides FITS file parsing, GPU-based image rendering, and gallery management for astronomical images.
- **Purpose:** Enables viewing, analyzing, and organizing astronomical FITS images with professional-grade stretch algorithms, colormaps, and album organization.

## 2. High-Level Description

The Core Viewing module consists of three integrated subsystems:

**FITS Module** (`src/lib/fits/`): Parses FITS/FITS.GZ, XISF, and SER formats using fitsjs-ng with pako decompression. Extracts metadata (object, dateObs, exptime, filter, telescope, coordinates) and provides pixel data as Float32Array for GPU rendering.

**Viewer Module** (`src/components/fits/` + `src/app/viewer/`): Renders FITS images using @shopify/react-native-skia with pan/zoom gestures, stretch algorithms (linear, sqrt, log, asinh, zscale), 16 colormaps, histogram levels, and overlay support (grid, crosshair, pixel info, minimap).

**Gallery Module** (`src/lib/gallery/` + `src/app/(tabs)/gallery.tsx`): Manages albums (manual and smart rules), filtering by object/filter/frame type/date, full-text search, batch operations (tag, rename, delete), and integration reports for exposure statistics.

## 3. Module Components

### FITS Parsing

- `src/lib/fits/parser.ts` - Main entry point for loading FITS files
- `src/lib/fits/writer.ts` - FITS file writing support
- `src/lib/fits/headerWriter.ts` - In-place header manipulation
- `src/lib/fits/compression.ts` - GZIP handling

### Viewer Rendering

- `src/app/viewer/[id].tsx` - Main viewer screen
- `src/components/fits/FitsCanvas.tsx` - GPU canvas with Skia
- `src/components/fits/ViewerControlPanel.tsx` - Settings panel
- `src/components/fits/HistogramLevels.tsx` - Interactive histogram
- `src/hooks/useImageProcessing.ts` - Pixel-to-RGBA conversion

### Gallery Management

- `src/lib/gallery/albumManager.ts` - Album CRUD and smart rules
- `src/lib/gallery/metadataIndex.ts` - Search and indexing
- `src/lib/gallery/frameClassifier.ts` - Auto frame type detection
- `src/stores/useAlbumStore.ts` - Album persistence
- `src/stores/useGalleryStore.ts` - Filter and view state

## 4. Integration Points

| From       | To         | Purpose                   |
| ---------- | ---------- | ------------------------- |
| fitsModule | viewer     | Pixel data for rendering  |
| viewer     | gallery    | Access files from gallery |
| gallery    | fitsModule | Metadata indexing         |
| gallery    | viewer     | Album image browsing      |

## 5. Source of Truth

- **FITS Types:** `src/lib/fits/types.ts` (StretchType, ColormapType, FitsMetadata, ViewerState)
- **Viewer Store:** `src/stores/useViewerStore.ts`
- **Album Store:** `src/stores/useAlbumStore.ts`
- **Gallery Store:** `src/stores/useGalleryStore.ts`
