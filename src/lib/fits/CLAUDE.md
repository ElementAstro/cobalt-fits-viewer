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

| File              | Purpose                               |
| ----------------- | ------------------------------------- |
| `parser.ts`       | FITS file loading and data extraction |
| `types.ts`        | Central type definitions for the app  |
| `headerWriter.ts` | FITS header modification utilities    |

**Initialization:**

```typescript
import { loadFitsFromBuffer, extractMetadata, getImagePixels } from "./parser";
import type { FitsMetadata, StretchType, ColormapType } from "./types";
```

## Public Interfaces

### Loading Functions (parser.ts)

```typescript
// Load FITS from different sources
loadFitsFromBuffer(buffer: ArrayBuffer): FITS
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

// Metadata
extractMetadata(fits: FITS, file: { filename, filepath, fileSize }): Partial<FitsMetadata>
```

### Header Writer (headerWriter.ts)

```typescript
// Modify FITS headers
writeHeaderKeyword(fits: FITS, key: string, value: unknown, comment?: string): void
updateHeaderKeywords(fits: FITS, keywords: HeaderKeyword[]): void
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

| Type        | Values                                     |
| ----------- | ------------------------------------------ |
| `FrameType` | `light`, `dark`, `flat`, `bias`, `unknown` |

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
  format: ExportFormat; // png, jpeg, webp, tiff, bmp
  quality: number; // 1-100 for JPEG/WebP
  bitDepth: 8 | 16 | 32; // for TIFF
  dpi: number;
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

| Aspect     | Status  | Files                            |
| ---------- | ------- | -------------------------------- |
| Unit Tests | Partial | `__tests__/headerWriter.test.ts` |

## FAQ

**Q: How do I load a FITS file?**

```typescript
import { loadFitsFromBuffer, extractMetadata, getImagePixels } from "./parser";

const buffer = await readFileAsArrayBuffer(filepath);
const fits = loadFitsFromBuffer(buffer);
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
|-- types.ts            # Type definitions (also used by other modules)
|-- headerWriter.ts     # Header modification utilities
`-- __tests__/
    `-- headerWriter.test.ts
```

## Changelog

| Date       | Changes                          |
| ---------- | -------------------------------- |
| 2026-02-15 | AI context documentation created |
