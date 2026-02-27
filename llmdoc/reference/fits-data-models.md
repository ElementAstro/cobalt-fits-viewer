# FITS Data Models Reference

This document provides a summary of key data types for FITS viewing and gallery management. See `src/lib/fits/types.ts` for complete definitions.

## 1. Core FITS Types

### StretchType

Stretch algorithms for image display:

```typescript
type StretchType = "linear" | "sqrt" | "log" | "asinh" | "zscale" | "percentile" | "power";
```

### ColormapType

Colormap options for false-color rendering:

```typescript
type ColormapType =
  | "grayscale"
  | "inverted"
  | "heat"
  | "cool"
  | "thermal"
  | "rainbow"
  | "jet"
  | "viridis"
  | "plasma"
  | "magma"
  | "inferno"
  | "cividis"
  | "cubehelix"
  | "red"
  | "green"
  | "blue";
```

### FrameType

Classification of observation frame types:

```typescript
type FrameType = "light" | "dark" | "flat" | "bias" | "darkflat" | "unknown";
```

## 2. Viewer State

### ViewerState

Display parameters for FITS rendering:

- `stretch`: Selected stretch algorithm
- `colormap`: Applied colormap
- `blackPoint`, `whitePoint`: Histogram levels (0-1)
- `gamma`: Gamma correction value
- `brightness`, `contrast`: Adjustments
- `showGrid`, `showCrosshair`, `showPixelInfo`, `showMiniMap`: Overlay toggles

### ViewerCurvePreset

Sigmoid curve presets:

```typescript
type ViewerCurvePreset = "linear" | "sCurve" | "highContrast" | "lowContrast";
```

## 3. Metadata Types

### FitsMetadata

Complete metadata for a FITS file:

- **Identification**: `id`, `filename`, `fileSize`, `uri`
- **Dimensions**: `naxis`, `naxis1`, `naxis2`, `naxis3`
- **Observation**: `object`, `dateObs`, `exptime`, `filter`
- **Instrument**: `telescope`, `instrument`, `detector`, `gain`, `ccdTemp`
- **Coordinates**: `ra`, `dec`, `altitude`, `azimuth`, `airmass`
- **Organization**: `albumIds[]`, `targetId`, `sessionId`, `tags[]`
- **Classification**: `frameType`, `favorite`

### Annotation

Image annotation overlays:

```typescript
type AnnotationType = "circle" | "rect" | "text" | "arrow" | "star";
```

## 4. Gallery Types

### Album

Image album with optional smart rules:

```typescript
interface Album {
  id: string;
  name: string;
  description?: string;
  coverImageId?: string;
  createdAt: number;
  updatedAt: number;
  imageIds: string[];
  isSmart: boolean;
  smartRules?: SmartAlbumRule[];
  sortOrder?: number;
}
```

### SmartAlbumRule

Rule definition for smart albums:

- **Field**: `object` | `filter` | `dateObs` | `exptime` | `instrument` | `telescope` | `tag` | `location` | `frameType`
- **Operator**: `equals` | `contains` | `gt` | `lt` | `between` | `in`
- **Value**: string | number | string[] | [number, number]

### GalleryViewMode

Gallery display modes:

```typescript
type GalleryViewMode = "grid" | "list" | "timeline";
```

## 5. Source of Truth

- **All Types:** `src/lib/fits/types.ts` - Central type definitions
- **Viewer Store:** `src/stores/useViewerStore.ts` - Viewer state persistence
- **Album Store:** `src/stores/useAlbumStore.ts` - Album persistence
- **Gallery Store:** `src/stores/useGalleryStore.ts` - Filter/view state
- **Processing:** `src/lib/processing/recipe.ts` - Processing recipe types
