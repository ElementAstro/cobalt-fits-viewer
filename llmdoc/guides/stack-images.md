# How to Stack Images

A step-by-step guide for stacking astronomical images in Cobalt FITS Viewer.

## Prerequisites

- FITS files imported (light frames)
- Optional: calibration frames (dark, flat, bias)

## Steps

### 1. Select Frames for Stacking

1. Navigate to **Stacking** screen
2. In Frame Selection section, browse your FITS files
3. Filter by optical filter if needed
4. Select multiple frames by tapping checkboxes
5. View frame metadata (date, filter, exposure, temperature)

Reference: `src/app/stacking/index.tsx:1543-1680`

### 2. Configure Calibration (Optional)

1. Scroll to Calibration Frames section
2. Select dark frames (must match light exposure time)
3. Select flat frames
4. Select bias frames (optional)
5. Enable "Auto-create master frames" if needed

Reference: `src/lib/stacking/calibration.ts:84-113`

### 3. Choose Stacking Method

1. In Method Selection, choose from 7 options:
   - **Average**: Simple mean (good for SNR)
   - **Median**: Rejects outliers naturally
   - **Sigma Clip**: Rejects pixels beyond N sigma (recommended)
   - **Min**: For starless stacks
   - **Max**: For brightest object
   - **Winsorized**: Robust outlier rejection
   - **Weighted**: Uses quality scores (requires evaluation)

Reference: `src/hooks/useStacking.ts:55-62`

### 4. Configure Alignment

1. Select Alignment Mode:
   - **None**: No alignment (already aligned)
   - **Translation**: Shift-only (for drifted mounts)
   - **Full**: Rotation + scale + translation (recommended)

2. Choose Detection Profile:
   - **Fast**: Quick detection
   - **Balanced**: Default (recommended)
   - **Accurate**: High precision

Reference: `src/lib/stacking/alignment.ts:186-267` (translation), `src/lib/stacking/alignment.ts:365-495` (full)

### 5. Optional: Quality Evaluation

1. Enable "Evaluate Frame Quality"
2. System analyzes: background noise, SNR, star count, FWHM, roundness
3. Quality scores generated for each frame
4. Scores displayed in frame list
5. For weighted stacking, enables intelligent frame weighting

Reference: `src/lib/stacking/frameQuality.ts:20-80`

### 6. Run Stacking Process

1. Tap **Start Stacking** button
2. Progress shown per stage:
   - Calibration (if enabled)
   - Quality evaluation (if enabled)
   - Alignment per frame
   - Final stack combination
3. Preview generated in FITSCanvas
4. View statistics: mean, median, stddev, SNR

Reference: `src/hooks/useStacking.ts:298-778`

### 7. Export Result

1. Tap **Export** button
2. Choose format: PNG, JPEG, TIFF
3. Optionally apply stretch (auto-stretch recommended)
4. Save to device or share

Reference: `src/lib/converter/formatConverter.ts` (export rendering)

## Advanced: Manual Star Registration

If automatic alignment fails:

1. In Alignment section, enable "Use Manual Annotations"
2. Open each problematic frame in Editor
3. Add star annotations (1-3 stars)
4. Return to Stacking and retry

Reference: `src/lib/stacking/starAnnotationLinkage.ts:10-50` (buildManualTransform)

## Verification

- Run: `pnpm test -- --testPathPattern="stacking"` to verify stacking functionality
- Expected: Tests pass for alignment, calibration, and stacking algorithms
