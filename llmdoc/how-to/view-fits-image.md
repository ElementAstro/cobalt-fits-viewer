# How to View FITS Image

A step-by-step guide to displaying a FITS image in the viewer with custom stretch and colormap settings.

## 1. Open FITS File

Navigate to the viewer screen by selecting a file from the Files tab or Gallery:

- Files tab: Tap on any `.fits`, `.fits.gz`, `.xisf`, or `.ser` file
- Gallery: Tap on any thumbnail

The viewer screen loads via `src/app/viewer/[id].tsx`.

## 2. Load FITS Data

The viewer automatically loads the file using the `useFitsFile` hook:

- Parses FITS format automatically (supports .gz compression)
- Extracts metadata (object, date, exposure, filter, coordinates)
- Returns pixel data as Float32Array

Reference: `src/hooks/useFitsFile.ts` (useFitsFile)

## 3. Apply Stretch Algorithm

1. Open the control panel (tap controls icon in toolbar)
2. Navigate to the stretch section
3. Select algorithm: `linear`, `sqrt`, `log`, `asinh`, `zscale`, `percentile`, `power`

The stretch is applied via `useImageProcessing` hook which converts raw pixels to displayable RGBA.

Reference: `src/hooks/useImageProcessing.ts:30-95` (processImage)

## 4. Select Colormap

1. In control panel, go to colormap section
2. Choose from 16 options: `grayscale`, `heat`, `cool`, `viridis`, `plasma`, `inferno`, `magma`, `cividis`, `rainbow`, `jet`, etc.

Colormap is applied during RGBA conversion in `lib/converter/formatConverter.ts`.

## 5. Adjust Histogram Levels

1. View histogram at top of control panel
2. Drag black point handle to set minimum
3. Drag white point handle to set maximum
4. Or use auto-levels button for automatic detection

Reference: `src/components/fits/HistogramLevels.tsx`

## 6. Navigate Multi-Frame FITS

For data cubes or multi-HDU files:

1. Open HDU/frame selector in control panel
2. Navigate between frames using prev/next buttons

## 7. Enable Overlays

Toggle overlays from control panel or keyboard shortcuts (web):

- `g` - Grid overlay
- `c` - Crosshair
- `p` - Pixel info (coordinates + value)
- `m` - Minimap

Reference: `src/hooks/useViewerHotkeys.ts`

## 8. Zoom and Pan

- Pinch to zoom in/out
- Pan with one finger when zoomed
- Double-tap to toggle between fit and 3x zoom
- Use zoom controls (bottom right) for precise 1:1 or fit

Reference: `src/components/fits/ZoomControls.tsx`, `src/lib/viewer/transform.ts`

## Verification

Run the viewer tests:

```bash
pnpm test -- --testPathPattern="FitsCanvas|ViewerControlPanel|HistogramLevels"
```
