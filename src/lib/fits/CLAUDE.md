[Root](../../../CLAUDE.md) > [src](../../..) > [lib](../..) > **fits**

# FITS Module (File Parsing & Types)

> FITS file parsing, metadata extraction, and type definitions

## Module Responsibility

This module provides core functionality for working with FITS (Flexible Image Transport System) files:

- FITS file loading from various sources (buffer, blob, URL)
- Header keyword parsing and extraction
- Image pixel data extraction
- Metadata extraction from FITS headers
- Type definitions for the entire application

## Entry & Startup

| File             | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `parser.ts`      | FITS loading/parsing (`.fits`, auto `.fits.gz`)        |
| `writer.ts`      | FITS writer (header cards, END, 2880 padding, data BE) |
| `compression.ts` | FITS gzip helpers (`gzip` / `gunzip`)                  |
| `types.ts`       | Central types for FITS/converter/export pipelines      |

**Initialization:**

```typescript
import { loadFitsFromBufferAuto, extractMetadata, getImagePixels } from "./parser";
import { writeFitsImage } from "./writer";
import type { FitsMetadata, StretchType, ColormapType } from "./types";
```

## Public Interfaces

### Loading Functions (parser.ts)

```typescript
// Load FITS from different sources
loadFitsFromBuffer(buffer: ArrayBuffer): FITS
loadFitsFromBufferAuto(buffer: ArrayBuffer): FITS
loadFitsFromBlob(blob: Blob): Promise<FITS>
loadFitsFromURL(url: string): Promise<FITS>

// Header operations
getHeaderKeywords(fits: FITS, hduIndex?: number): HeaderKeyword[]
getHeaderValue(fits: FITS, key: string, hduIndex?: number): string | number | boolean | null
getHDUDataType(fits: FITS, hduIndex?: number): HDUDataType
getHDUList(fits: FITS): Array<{ index: number; type: HDUDataType; hasData: boolean }>

// Image data
getImagePixels(fits: FITS, hduIndex?: number, frame?: number): Promise<Float32Array>
getImageDimensions(fits: FITS): { width: number; height: number; depth: number; isDataCube: boolean }
isRgbCube(fits: FITS, hduIndex?: number): { isRgb: boolean; width: number; height: number }
getImageChannels(fits: FITS, hduIndex?: number): Promise<{ r; g; b; width; height } | null>

// Metadata
extractMetadata(fits: FITS, file: { filename, filepath, fileSize }): Partial<FitsMetadata>
getCommentsAndHistory(fits: FITS, hduIndex?: number): { comments: string[]; history: string[] }
```

### Writer & Compression

```typescript
// FITS writing
writeFitsImage(options: FitsWriteOptions): Uint8Array

// Compression helpers
gzipFitsBytes(bytes: Uint8Array): Uint8Array
gunzipFitsBytes(bytes: ArrayBuffer | Uint8Array): Uint8Array
isGzipFitsBytes(bytes: ArrayBuffer | Uint8Array): boolean
normalizeFitsCompression(source: ArrayBuffer | Uint8Array, target: "none" | "gzip"): Uint8Array
```

### Key Types (types.ts)

#### Stretch Algorithms

| Type          | Values                                                                      |
| ------------- | --------------------------------------------------------------------------- |
| `StretchType` | `linear`, `sqrt`, `log`, `asinh`, `power`, `zscale`, `minmax`, `percentile` |

#### Colormaps

| Type           | Values                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ColormapType` | `grayscale`, `inverted`, `heat`, `cool`, `thermal`, `rainbow`, `jet`, `viridis`, `plasma`, `magma`, `inferno`, `cividis`, `cubehelix`, `red`, `green`, `blue` |

#### Frame Types

| Type               | Values                                                 |
| ------------------ | ------------------------------------------------------ |
| `BuiltinFrameType` | `light`, `dark`, `flat`, `bias`, `darkflat`, `unknown` |
| `FrameType`        | `string` (built-in + custom)                           |

#### Core Data Models

```typescript
// FITS file metadata
interface FitsMetadata {
  id: string;
  filename: string;
  filepath: string;
  fileSize: number;
  importDate: number;
  lastViewed?: number;

  // Image dimensions
  bitpix?: number;
  naxis?: number;
  naxis1?: number;
  naxis2?: number;
  naxis3?: number;

  // Frame classification
  frameType: FrameType;
  frameTypeSource?: "header" | "filename" | "rule" | "manual" | "fallback";
  imageTypeRaw?: string;
  frameHeaderRaw?: string;

  // Observation info from header
  object?: string;
  dateObs?: string;
  exptime?: number;
  filter?: string;
  instrument?: string;
  telescope?: string;
  ra?: number;
  dec?: number;
  airmass?: number;

  // Device info
  detector?: string;
  gain?: number;
  ccdTemp?: number;

  // Management
  isFavorite: boolean;
  tags: string[];
  albumIds: string[];
  targetId?: string;
  sessionId?: string;
  thumbnailUri?: string;
  hash?: string;
  qualityScore?: number;
  notes?: string;
  location?: GeoLocation;
}

// Target management
interface Target {
  id: string;
  name: string;
  aliases: string[];
  type: TargetType;
  category?: string;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  groupId?: string;
  ra?: number;
  dec?: number;
  imageIds: string[];
  status: TargetStatus;
  plannedFilters: string[];
  plannedExposure: Record<string, number>;
  notes?: string;
  recommendedEquipment?: RecommendedEquipment;
  bestImageId?: string;
  imageRatings: Record<string, number>;
  changeLog: TargetChangeLogEntry[];
  createdAt: number;
  updatedAt: number;
}

// Observation session
interface ObservationSession {
  id: string;
  date: string;
  startTime: number;
  endTime: number;
  duration: number;
  targets: string[];
  imageIds: string[];
  equipment: SessionEquipment;
  location?: GeoLocation;
  weather?: string;
  seeing?: string;
  notes?: string;
  createdAt: number;
  calendarEventId?: string;
  rating?: number;
  bortle?: number;
  tags?: string[];
}

// Album management
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

// Viewer state
interface ViewerState {
  stretch: StretchType;
  colormap: ColormapType;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  currentHDU: number;
  currentFrame: number;
  showGrid: boolean;
  showCrosshair: boolean;
  showPixelInfo: boolean;
}
```

## Key Dependencies

| Package     | Usage                                        |
| ----------- | -------------------------------------------- |
| `fitsjs-ng` | Core FITS file parsing library               |
| `pako`      | GZIP decompression for compressed FITS files |

## Data Models

### Header Groups

Headers are organized into logical groups for display:

| Group         | Key Headers                                          |
| ------------- | ---------------------------------------------------- |
| `observation` | DATE-OBS, EXPTIME, OBJECT, RA, DEC, AIRMASS, EQUINOX |
| `instrument`  | INSTRUME, TELESCOP, FILTER, DETECTOR, GAIN, CCD-TEMP |
| `image`       | BITPIX, NAXIS, NAXIS1, NAXIS2, NAXIS3, BSCALE, BZERO |
| `wcs`         | CRVAL1/2, CRPIX1/2, CDELT1/2, CTYPE1/2, CD1_1, CD2_2 |
| `processing`  | COMMENT, HISTORY                                     |

### Convert Options

```typescript
interface ConvertOptions {
  format: ExportFormat; // png, jpeg, webp, tiff, bmp, fits
  quality: number; // 1-100 for JPEG/WebP
  bitDepth: 8 | 16 | 32; // for TIFF
  dpi: number;
  fits: FitsTargetOptions; // mode/compression/bitpix/color layout
  stretch: StretchType;
  colormap: ColormapType;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  outputBlack: number;
  outputWhite: number;
  includeAnnotations: boolean;
  includeWatermark: boolean;
}
```

### Default Convert Presets

| Preset  | Format      | Use Case                     |
| ------- | ----------- | ---------------------------- |
| `web`   | JPEG 85%    | Web publishing, sharing      |
| `print` | PNG 300 DPI | High-quality printing        |
| `astro` | TIFF 16-bit | Post-processing preservation |

## Testing & Quality

| Aspect     | Status   | Files                                                                                   |
| ---------- | -------- | --------------------------------------------------------------------------------------- |
| Unit Tests | Expanded | `__tests__/parser.test.ts`, `__tests__/writer.test.ts`, `__tests__/compression.test.ts` |

## FAQ

**Q: How do I load a FITS file?**

```typescript
import { loadFitsFromBufferAuto, extractMetadata, getImagePixels } from "./parser";

const buffer = await readFileAsArrayBuffer(filepath);
const fits = loadFitsFromBufferAuto(buffer); // supports .fits.gz transparently
const metadata = extractMetadata(fits, { filename, filepath, fileSize });
const pixels = await getImagePixels(fits);
```

**Q: How do I get specific header values?**

```typescript
import { getHeaderValue, getHeaderKeywords } from "./parser";

const object = getHeaderValue(fits, "OBJECT");
const exptime = getHeaderValue(fits, "EXPTIME");
const allHeaders = getHeaderKeywords(fits);
```

**Q: How do I add a new data model type?**

Add the type definition to `types.ts` and ensure it's exported. Most application-wide types are defined in this central file.

## Related Files

```
src/lib/fits/
|-- parser.ts           # FITS loading and parsing
|-- writer.ts           # FITS writing
|-- compression.ts      # .fits.gz helpers
|-- types.ts            # Type definitions (also used by other modules)
`-- __tests__/
    |-- parser.test.ts
    |-- writer.test.ts
    `-- compression.test.ts
```

## Changelog

| Date       | Changes                          |
| ---------- | -------------------------------- |
| 2026-02-15 | AI context documentation created |
