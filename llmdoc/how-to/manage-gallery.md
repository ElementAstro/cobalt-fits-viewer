# How to Manage Gallery

A step-by-step guide to organizing astronomical images using albums, filtering, and batch operations.

## 1. Browse Gallery

Navigate to Gallery tab (`src/app/(tabs)/gallery.tsx`):

- View mode toggle: grid, list, or timeline
- Filter chips: object, filter type, frame type
- Search bar: full-text search across metadata

Reference: `src/hooks/useGallery.ts` (useGallery)

## 2. Create Manual Album

1. Tap "Create Album" button
2. Enter album name (required)
3. Add description (optional)
4. Confirm creation

The album is created via `useAlbums` hook calling `createAlbum` in `src/lib/gallery/albumManager.ts`.

Reference: `src/hooks/useAlbums.ts:10-20` (createNewAlbum)

## 3. Create Smart Album

1. Tap "Create Album" and select "Smart Album"
2. Add rules using field/operator/value selections
   - Fields: object, filter, dateObs, exptime, instrument, telescope, tag, location, frameType
   - Operators: equals, contains, gt, lt, between, in
3. Add multiple rules (AND logic)
4. Preview matching images
5. Confirm creation

Smart albums auto-evaluate rules against current files. Refresh via `refreshSmartAlbums`.

Reference: `src/lib/gallery/albumManager.ts:10-40` (evaluateSmartRules)

## 4. Add Images to Album

**Single image:**

- Long-press image in gallery
- Select "Add to Album"
- Choose target album

**Batch add:**

- Enter selection mode (long-press any image)
- Select multiple images
- Tap "Add to Album" in toolbar

Reference: `src/components/gallery/AlbumPickerSheet.tsx`, `src/stores/useAlbumStore.ts`

## 5. Filter Gallery

Apply filters using the filter chips or search:

- Object: filter by target object name
- Filter: filter by astronomical filter (Ha, OIII, SII, etc.)
- Frame Type: light, dark, flat, bias
- Date Range: specific observation dates
- Favorites: starred images only

Reference: `src/stores/useGalleryStore.ts:20-45`

## 6. Batch Tag Images

1. Enter selection mode
2. Select images
3. Tap "Tag" in toolbar
4. Select existing tags or create new ones
5. Confirm

Reference: `src/components/gallery/BatchTagSheet.tsx`

## 7. Batch Rename

1. Enter selection mode
2. Select images
3. Tap "Rename" in toolbar
4. Use template variables: `{object}`, `{date}`, `{filter}`, `{exptime}`, `{frameType}`, `{telescope}`, `{seq}`
5. Preview changes (up to 20 shown)
6. Confirm rename

Reference: `src/lib/gallery/fileRenamer.ts` (previewRenames)

## 8. Generate Integration Report

1. Tap menu in gallery toolbar
2. Select "Integration Report"
3. View exposure statistics grouped by target/filter
4. Shows: total lights, total exposure time, frame count per filter
5. Tap "Copy Markdown" to export

Reference: `src/components/gallery/IntegrationReportSheet.tsx`, `src/lib/gallery/integrationReport.ts`

## 9. Delete Images

1. Enter selection mode
2. Select images
3. Tap delete (trash icon)
4. Confirm deletion

Files are removed from the file system and all albums.

## Verification

Run gallery tests:

```bash
pnpm test -- --testPathPattern="gallery|album"
```
