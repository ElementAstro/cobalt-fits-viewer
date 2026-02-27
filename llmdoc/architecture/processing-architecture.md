# Processing Architecture

## 1. Identity

- **What it is:** A layered architecture integrating four astronomical processing subsystems with shared data models and bidirectional relationships.
- **Purpose:** Enables complete observation workflow from target planning through image acquisition, processing, and astrometric calibration.

## 2. Core Components

### Target Management

- `src/lib/targets/targetManager.ts` (extractTargetName, createTarget, autoDetectTarget, guessTargetType): Core target operations with automatic detection from FITS OBJECT header.
- `src/lib/targets/targetMatcher.ts` (matchTargetByName, mergeTargets): Alias matching with 80+ built-in common aliases.
- `src/lib/targets/exposureStats.ts` (calculateExposureStats, calculateCompletionRate): Exposure statistics and completion tracking.
- `src/lib/targets/coordinates.ts` (parseRA, parseDec, formatRA, formatDec): RA/Dec coordinate parsing and formatting.
- `src/stores/useTargetStore.ts`: Zustand store with MMKV persistence for targets.
- `src/hooks/useTargets.ts`: High-level hook combining store and auto-detection.

### Observation Sessions

- `src/lib/sessions/sessionDetector.ts` (detectSessions, generateLogEntries): Auto-detects sessions from FITS timestamps using configurable time gaps.
- `src/lib/sessions/sessionLinking.ts` (deriveSessionMetadataFromFiles, buildMissingLogEntries): Derives targets, equipment, location from linked FITS files.
- `src/lib/sessions/sessionReconciliation.ts`: Synchronizes session data with file graph changes.
- `src/lib/sessions/statsCalculator.ts` (calculateObservationStats, getMonthlyTrend): Observation statistics.
- `src/stores/useSessionStore.ts`: Zustand store with live session recording support.
- `src/hooks/useSessions.ts`: Main hook for session operations.

### Image Stacking

- `src/lib/stacking/alignment.ts` (alignFrame, computeTranslation, computeFullAlignment): Star-based image registration with translation or full affine modes.
- `src/lib/stacking/starDetection.ts` (detectStars, detectStarsModernSync): Star detection with 4 profile presets (legacy, fast, balanced, accurate).
- `src/lib/stacking/calibration.ts` (calibrateFrame, createMasterDark, createMasterFlat): Dark/flat/bias calibration pipeline.
- `src/lib/stacking/frameQuality.ts` (evaluateFrameQuality, qualityToWeights): Frame quality evaluation for weighted stacking.
- `src/lib/stacking/drizzle.ts` (drizzleIntegrate): Drizzle algorithm for sub-pixel resolution.
- `src/hooks/useStacking.ts`: Orchestrates complete stacking workflow.

### Astrometry

- `src/lib/astrometry/astrometryClient.ts` (login, uploadFile, getJobStatus): REST API client for nova.astrometry.net.
- `src/lib/astrometry/astrometryService.ts` (solveFile, solveUrl): Orchestrates plate solving workflow with exponential backoff polling.
- `src/lib/astrometry/wcsExport.ts` (generateWCSKeywords, writeWCSToFitsHeader): WCS header generation and FITS header writing.
- `src/lib/astrometry/wcsProjection.ts` (pixelToRaDec, raDecToPixel): TAN gnomonic projection for coordinate transforms.
- `src/lib/astrometry/coordinateGrid.ts` (generateGridLines): RA/Dec grid overlay generation.
- `src/lib/astrometry/syncToTarget.ts` (createTargetFromResult, findMatchingTarget): Syncs astrometry results to target management.
- `src/stores/useAstrometryStore.ts`: Zustand store for astrometry jobs.
- `src/hooks/useAstrometry.ts`: Hook for plate solving operations.

## 3. Execution Flow

### Target Detection Flow

1. User imports FITS files via Files tab
2. `useTargets.ts` calls `autoDetectTarget()` in `targetManager.ts:50-95`
3. `targetManager.ts` extracts OBJECT from FITS header
4. `targetMatcher.ts` checks for existing target by name/alias
5. If new, `guessTargetType()` classifies object type from naming patterns
6. New target created in `useTargetStore.ts`

### Session Auto-Detection Flow

1. User triggers scan or imports new files
2. `sessionDetector.ts:detectSessions()` sorts files by `dateObs` timestamp
3. Groups files within `gapMinutes` (default 120) into sessions
4. Creates `ObservationSession` with derived metadata
5. `sessionLinking.ts` extracts equipment and location from headers

### Stacking Workflow

1. User selects frames in Stacking screen
2. `useStacking.ts` loads frames and applies calibration (`calibration.ts`)
3. Optional quality evaluation generates weights (`frameQuality.ts`)
4. Star detection identifies registration stars (`starDetection.ts`)
5. Alignment computes transformation matrix (`alignment.ts`)
6. Stacking combines frames using selected method (`pixelMath.ts`)
7. Result rendered to FITSCanvas preview

### Astrometry Plate Solving

1. User submits FITS file via Astrometry screen
2. `astrometryClient.ts` uploads to nova.astrometry.net
3. `astrometryService.ts` polls for job completion
4. On success, fetches calibration (WCS) and annotations
5. User can write WCS to FITS header via `wcsExport.ts`
6. User can sync result to target via `syncToTarget.ts`

## 4. Data Relationships

```
Targets <--targetRefs--> Sessions <--sessionId--> FITS Files
                         ^                           |
                         |_________imageIds_________|
                                              |
                                              v
                                        Stacking
                                              |
                                              v
                                         Astrometry --> Targets (sync)
```

- `FitsMetadata.sessionId`: Links file to observation session
- `FitsMetadata.targetId`: Links file to target
- `ObservationSession.targetRefs[]`: References to targets
- `ObservationSession.imageIds[]`: References to FITS files
- Astrometry results sync to targets via `syncToTarget.ts`
