# Observation Data Models

This document provides a high-level summary of data models used in the Processing module. For detailed type definitions, see source files.

## 1. Core Summary

The Processing module uses four interconnected data models defined in `src/lib/fits/types.ts`: Target, ObservationSession, ObservationPlan, and FitsMetadata with session/target references. The astrometry module adds AstrometryJob and AstrometryCalibration in `src/lib/astrometry/types.ts`.

## 2. Source of Truth

### Target Models

- **Primary Code:** `src/lib/fits/types.ts:150-190` - Target, TargetType, TargetStatus, ExposureStats types
- **Store:** `src/stores/useTargetStore.ts` - Zustand store with MMKV persistence
- **Related Architecture:** `/llmdoc/architecture/target-management.md` - Target system details

Key fields:

- `id`: Unique identifier
- `name`: Primary name (e.g., "M31")
- `aliases[]`: Alternate names
- `type`: galaxy | nebula | cluster | planet | moon | sun | comet | other
- `status`: planned | acquiring | completed | processed
- `ra`, `dec`: Optional coordinates (decimal degrees)
- `imageIds[]`: Linked FITS file IDs
- `plannedFilters[]`: Filter exposure goals
- `notes`: Free-form notes

### Session Models

- **Primary Code:** `src/lib/fits/types.ts:200-280` - ObservationSession, ObservationPlan, ObservationLogEntry
- **Store:** `src/stores/useSessionStore.ts` - Zustand store with MMKV persistence
- **Related Architecture:** `/llmdoc/architecture/sessions-module.md` - Session system details

Key fields (ObservationSession):

- `id`, `date`: Session identifier and date (YYYY-MM-DD)
- `startTime`, `endTime`: Unix timestamps
- `duration`: Seconds
- `targetRefs[]`: Array of {targetId?, name}
- `imageIds[]`: Linked FITS file IDs
- `equipment`: {telescope?, camera?, mount?, filters[]?}
- `location?`: GeoLocation
- `weather?`, `seeing?`: Environmental conditions
- `rating`: 1-5
- `bortle`: 1-9
- `tags[]`: Custom tags

### Stacking Models

- **Primary Code:** `src/hooks/useStacking.ts:20-80` - StackingRecipe, StackMethod types
- **Algorithm:** `src/lib/utils/pixelMath.ts:100-200` - stackAverage, stackMedian, stackSigmaClip implementations
- **Related Architecture:** `/llmdoc/architecture/stacking-module.md` - Stacking system details

Key types:

- `StackingRecipe`: {frames[], method, alignmentMode, calibration, qualityEvaluation}
- `StackMethod`: average | median | sigma | min | max | winsorized | weighted
- `AlignmentMode`: none | translation | full
- `DetectionProfile`: legacy | fast | balanced | accurate

### Astrometry Models

- **Primary Code:** `src/lib/astrometry/types.ts:10-60` - AstrometryJob, AstrometryCalibration, AstrometryAnnotation
- **Store:** `src/stores/useAstrometryStore.ts` - Zustand store
- **API Client:** `src/lib/astrometry/astrometryClient.ts` - nova.astrometry.net integration
- **Related Architecture:** `/llmdoc/architecture/astrometry-module.md` - Astrometry system details

Key fields (AstrometryJob):

- `id`: Unique identifier
- `status`: pending | uploading | submitted | solving | success | failure
- `fileId`: Source FITS file ID
- `fileName`: Source filename
- `submittedAt`: Unix timestamp
- `completedAt?`: Completion timestamp

Key fields (AstrometryCalibration):

- `ra`, `dec`: Central coordinates (degrees)
- `pixscale`: Arcseconds per pixel
- `orientation`: Degrees (North through East)
- `parity`: +1 or -1
- `equinox`: e.g., "J2000"

### FITS File References

- **Primary Code:** `src/lib/fits/types.ts:240-250` - FitsMetadata.sessionId, FitsMetadata.targetId
- **Store:** `src/stores/useFitsStore.ts`
- **Related Architecture:** `/llmdoc/architecture/fits-module.md`

Key reference fields:

- `sessionId?: string`: Links to ObservationSession
- `targetId?: string`: Links to Target
