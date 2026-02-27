# How to Manage Observations

A step-by-step guide for managing astronomical observations in Cobalt FITS Viewer.

## Prerequisites

- FITS files imported into the app
- Target management enabled via Targets tab

## Steps

### 1. Auto-Detect Targets from FITS Files

1. Navigate to **Targets** tab
2. Tap the scan/auto-detect button in the header
3. The system scans all FITS files for OBJECT header values
4. New targets are automatically created with type guessing (Messier, NGC/IC, Sharpless, planets)
5. Existing files are linked to matching targets by name/alias

Reference: `src/lib/targets/targetManager.ts:50-95` (autoDetectTarget)

### 2. Create Target Manually

1. Navigate to **Targets** tab
2. Tap **Add Target** button
3. Enter target name (e.g., "M31", "Andromeda Galaxy")
4. Select target type (galaxy, nebula, cluster, planet, moon, sun, comet, other)
5. Optionally enter RA/Dec coordinates (supports multiple formats)
6. Add aliases for alternate names
7. Set planned filters and exposure times
8. Tap **Save**

Reference: `src/components/targets/AddTargetSheet.tsx`

### 3. Track Exposure Progress

1. Open target detail view by tapping target card
2. View exposure progress bars showing completion per filter
3. Add planned filters via **Edit Target** -> **Planned Filters**
4. Progress updates automatically as new FITS files are linked

Reference: `src/components/targets/ExposureProgress.tsx`

### 4. Auto-Detect Observation Sessions

1. Navigate to **Sessions** tab
2. Tap scan/auto-detect button
3. Files are grouped by time gaps (default 120 minutes configurable in Settings)
4. Sessions are created with derived metadata (equipment, location, targets)
5. Log entries generated from individual file headers

Reference: `src/lib/sessions/sessionDetector.ts:30-85` (detectSessions)

### 5. Record Live Session

1. Navigate to **Sessions** tab
2. Tap **Start Live Session**
3. Add notes, draft targets, equipment during observation
4. Use pause/resume as needed
5. Tap **End Session** to finalize
6. All notes and metadata saved to session record

Reference: `src/stores/useSessionStore.ts:80-120` (live session actions)

### 6. View Observation Statistics

1. Navigate to **Sessions** tab
2. View stats card showing total time, sessions, images
3. Check monthly activity chart
4. View calendar with observation dates highlighted

Reference: `src/components/sessions/SessionStatsCard.tsx`, `src/components/sessions/MonthlyActivityChart.tsx`

## Verification

- Run: `pnpm test -- --testPathPattern="targets|sessions"` to verify target and session functionality
- Expected: All tests pass for target detection, session auto-creation, and exposure tracking
