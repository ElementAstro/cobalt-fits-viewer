<!-- This entire block is your raw intelligence report for other agents. It is NOT a final document. -->

### Code Sections (The Evidence)

#### Routing & Screens

- `D:\Project\cobalt-fits-viewer\src\app\(tabs)\targets.tsx` (TargetsScreen): Main targets list screen with search, filtering (by type/status), sorting, auto-detection scan, and stats summary. Uses FlatList for efficient rendering.
- `D:\Project\cobalt-fits-viewer\src\app\target\[id].tsx` (TargetDetailScreen): Individual target detail view showing status, coordinates, exposure progress, observation timeline, image grid, and notes. Supports status switching, sharing, and editing.

#### Components

- `D:\Project\cobalt-fits-viewer\src\components\targets\TargetCard.tsx` (TargetCard): Card component displaying target name, type icon, status, frame count, total exposure, completion percentage, and aliases.
- `D:\Project\cobalt-fits-viewer\src\components\targets\AddTargetSheet.tsx` (AddTargetSheet): Modal dialog for creating new targets with name, type selector, RA/Dec coordinates, and notes.
- `D:\Project\cobalt-fits-viewer\src\components\targets\EditTargetSheet.tsx` (EditTargetSheet): Full-featured edit modal with name, type, status, aliases management, planned filters with exposure times, and notes. Includes delete functionality.
- `D:\Project\cobalt-fits-viewer\src\components\targets\ExposureProgress.tsx` (ExposureProgress): Visual progress component showing overall and per-filter exposure completion with color-coded progress bars.
- `D:\Project\cobalt-fits-viewer\src\components\targets\ObservationTimeline.tsx` (ObservationTimeline): Timeline view grouping observations by date, showing frame counts, exposure time, and filter breakdown for each session.
- `D:\Project\cobalt-fits-viewer\src\components\targets\FilterExposurePlan.tsx` (FilterExposurePlan): Reusable component for managing planned filters with quick-add buttons for common filters (L, R, G, B, Ha, SII, OIII) and custom filter input.

#### State Management

- `D:\Project\cobalt-fits-viewer\src\stores\useTargetStore.ts` (useTargetStore): Zustand store with persist middleware managing targets array. Actions: addTarget, removeTarget, updateTarget, addImageToTarget, removeImageFromTarget, addAlias, removeAlias, setStatus, setPlannedExposure, mergeIntoTarget. Getters: getTargetById, getTargetByName, getTargetsByType, getTargetsByStatus.

#### Hooks

- `D:\Project\cobalt-fits-viewer\src\hooks\useTargets.ts` (useTargets): High-level hook combining useTargetStore and useFitsStore. Provides: targets array, CRUD operations, scanAndAutoDetect (scans FITS files to auto-create/link targets), getTargetStats (calculates exposure/completion), createNewTarget.

#### Business Logic

- `D:\Project\cobalt-fits-viewer\src\lib\targets\targetManager.ts` (targetManager): Core logic including extractTargetName (reads OBJECT from FITS), createTarget, autoDetectTarget (matches existing or creates new), findTargetByNameOrAlias, guessTargetType (analyzes name patterns for Messier, NGC/IC, Sharpless, planets, keywords), calculateTargetExposure. Includes built-in lookup tables for ~100 Messier objects and ~50 NGC/IC types.
- `D:\Project\cobalt-fits-viewer\src\lib\targets\targetMatcher.ts` (targetMatcher): Alias matching with COMMON_ALIASES dictionary (~80 entries for M objects, NGC/IC, Sharpless). Functions: normalizeName, findKnownAliases, matchTargetByName, mergeTargets (combines two targets).
- `D:\Project\cobalt-fits-viewer\src\lib\targets\exposureStats.ts` (exposureStats): Statistics calculation including calculateExposureStats (total exposure, per-filter stats, frame count, date range), calculateCompletionRate (planned vs acquired), formatExposureTime.
- `D:\Project\cobalt-fits-viewer\src\lib\targets\coordinates.ts` (coordinates): RA/Dec parsing and formatting. parseRA (supports HH:MM:SS, HHhMMmSSs, decimal), parseDec (supports DD:MM:SS, DD°MM′SS″, decimal), formatRA, formatDec, formatCoordinates.
- `D:\Project\cobalt-fits-viewer\src\lib\targets\targetIcons.ts` (targetIcons): Icon and color mappings for 8 target types (galaxy, nebula, cluster, planet, moon, sun, comet, other).
- `D:\Project\cobalt-fits-viewer\src\lib\targets\targetExport.ts` (targetExport): Export functionality including formatTargetAsText (readable summary with emoji), formatTargetAsJSON, shareTarget (uses React Native Share).

#### Type Definitions

- `D:\Project\cobalt-fits-viewer\src\lib\fits\types.ts` (Target, TargetType, TargetStatus, ExposureStats): Core types defining target data structure with id, name, aliases, type, category, ra, dec, imageIds, status, plannedFilters, plannedExposure, notes, timestamps.

#### Internationalization

- `D:\Project\cobalt-fits-viewer\src\i18n\locales\en.ts` (targets.\*): Complete English translations for title, subtitle, types (8), statuses (4), frameCount, totalExposure, byFilter, addTarget, editTarget, deleteTarget, notes, aliases, plannedExposure, exposureProgress, observationHistory, etc.
- `D:\Project\cobalt-fits-viewer\src\i18n\locales\zh.ts` (targets.\*): Complete Chinese translations matching English structure.

### Report (The Answers)

#### result

**Current Target Management Features:**

1. **Target List Screen** (`src/app/(tabs)/targets.tsx`)
   - Search targets by name or aliases
   - Filter by type (galaxy, nebula, cluster, planet) or status (planned, acquiring, completed, processed)
   - Sort by date, name, frames, or exposure
   - Auto-scan FITS files to detect and create targets automatically
   - Add new targets via modal
   - Stats summary showing counts by status

2. **Target Detail Screen** (`src/app/target/[id].tsx`)
   - Display target name, aliases, type, and status
   - Quick status switching (planned → acquiring → completed → processed)
   - Show RA/Dec coordinates (formatted)
   - Exposure progress visualization (overall and per-filter)
   - Observation timeline grouped by date
   - Image grid of all associated FITS files
   - Notes display
   - Share target information
   - Edit target (full editing dialog)
   - Delete target with confirmation

3. **Target Data Model** (`src/lib/fits/types.ts`)
   - 8 target types: galaxy, nebula, cluster, planet, moon, sun, comet, other
   - 4 status values: planned, acquiring, completed, processed
   - Planned filters with exposure time goals (per filter)
   - Aliases support for multiple names
   - Optional RA/Dec coordinates
   - Notes field
   - Timestamps (createdAt, updatedAt)
   - Associated image IDs

4. **Automatic Detection** (`src/lib/targets/targetManager.ts`)
   - Scans FITS headers for OBJECT field
   - Auto-creates new targets for unknown objects
   - Auto-links files to existing targets by name matching
   - Intelligent type guessing based on naming patterns:
     - Messier objects (M1-M110) with type classification
     - NGC/IC objects with type classification
     - Sharpless objects (SH2-\*)
     - Caldwell objects
     - Abell objects
     - Solar system planets
     - Keyword-based detection (nebula, galaxy, cluster, comet)
   - Extracts coordinates from FITS headers
   - Auto-adds known aliases from built-in database (~80 entries)

5. **Target Merging** (`src/lib/targets/targetMatcher.ts`)
   - Merge two targets into one
   - Combines aliases, image IDs, planned filters
   - Takes max planned exposure per filter

6. **Exposure Statistics** (`src/lib/targets/exposureStats.ts`)
   - Calculate total exposure time
   - Per-filter exposure breakdown
   - Frame count
   - Date range
   - Completion rate vs planned goals

7. **Alias Matching** (`src/lib/targets/targetMatcher.ts`)
   - Built-in alias database for ~80 famous objects
   - Case-insensitive matching
   - Name normalization (handles spaces, prefixes)
   - Match by direct name or alias

8. **Coordinate Handling** (`src/lib/targets/coordinates.ts`)
   - Parse RA (HH:MM:SS, HHhMMmSSs, decimal)
   - Parse Dec (DD:MM:SS, DD°MM′SS″, decimal)
   - Format to human-readable strings
   - Validation

9. **Export/Share** (`src/lib/targets/targetExport.ts`)
   - Format as readable text with emoji icons
   - Format as JSON
   - Native sharing via React Native Share

10. **i18n Support**
    - Full English and Chinese translations
    - All UI strings translated

**Gaps and Potential Improvements:**

1. **No Target Categorization/Tags**
   - Data model has `category?: string` field but no UI to manage it
   - Could organize targets by categories (Deep Sky, Solar System, etc.)

2. **Limited Integration with Other Modules**
   - No integration with Gallery view (can't filter gallery by target)
   - No integration with Map view (no visual plotting of targets)
   - No integration with Session module (sessions track targets but targets don't track sessions)

3. **No Target Planning/Scheduling**
   - No observation planning features (best viewing times, rising/setting times)
   - No integration with Calendar module for observation sessions
   - No visibility calculations based on location

4. **No Target Collections/Groups**
   - Can't organize targets into groups or projects
   - No way to track progress on a set of related targets

5. **Limited Auto-Detection Scope**
   - Only ~100 Messier and ~50 NGC/IC objects have type data
   - Could expand to include more catalog objects
   - No online catalog lookup for unknown objects

6. **No Target Rating/Quality Scoring**
   - No way to rate target difficulty or success
   - No tracking of best images per target

7. **No Target-Specific Notes Organization**
   - Single notes field, no structure
   - Could add sections for equipment recommendations, conditions, tips

8. **No Duplicate Detection/Merge UI**
   - Merge logic exists but no UI to surface duplicates
   - No bulk merge operations

9. **Limited Search Capabilities**
   - Search only matches name/aliases
   - Could search by coordinates, type, notes, etc.

10. **No Target Favorites/Pinning**
    - No way to mark important targets
    - No quick access to frequently used targets

11. **No Target History/Versioning**
    - No tracking of changes to target properties
    - No undo/redo functionality

12. **No Target Statistics Dashboard**
    - Stats shown per target but no aggregate view
    - Could show top targets by exposure, most observed, etc.

#### conclusions

- The target management system is well-architected with clear separation between UI, state, hooks, and business logic
- Supports 8 target types and 4 status states with complete CRUD operations
- Automatic detection from FITS headers is sophisticated with name matching, type guessing, and alias management
- Exposure planning and tracking is fully implemented with visual progress indicators
- Data model includes `category` field but it's unused - likely a planned feature
- Business logic is comprehensive: coordinate parsing, type guessing, alias matching, merging, statistics
- Full i18n support with English and Chinese translations
- Primary gaps: category/tagging UI, map integration, observation planning, target groups, duplicate detection UI, enhanced search

#### relations

- `src/app/(tabs)/targets.tsx` → `src/hooks/useTargets.ts` → `src/stores/useTargetStore.ts` (state management) and `src/stores/useFitsStore.ts` (file data)
- `src/app/target/[id].tsx` → `src/hooks/useTargets.ts` for target operations and statistics
- `src/components/targets/*` → `src/lib/targets/*` for business logic (icons, coordinates, exposureStats)
- `src/hooks/useTargets.ts` → `src/lib/targets/targetManager.ts` (autoDetect, createTarget), `src/lib/targets/targetMatcher.ts` (findKnownAliases), `src/lib/targets/exposureStats.ts` (calculateExposureStats, calculateCompletionRate)
- `src/lib/targets/targetManager.ts` → `src/lib/fits/types.ts` (Target, FitsMetadata types)
- `src/stores/useTargetStore.ts` → `src/lib/targets/targetMatcher.ts` (mergeTargets)
- `src/lib/targets/targetExport.ts` → `src/lib/targets/coordinates.ts`, `src/lib/targets/exposureStats.ts`
- All components → `src/i18n/useI18n.ts` for translations
- `src/lib/targets/targetManager.ts` → `src/lib/targets/targetMatcher.ts` (findTargetByNameOrAlias used by autoDetectTarget)
