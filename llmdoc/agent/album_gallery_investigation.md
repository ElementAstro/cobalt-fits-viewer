<!-- This entire block is your raw intelligence report for other agents. It is NOT a final document. -->

### Code Sections (The Evidence)

#### Library Files (src/lib/gallery/)

- `src/lib/gallery/albumManager.ts` (createAlbum): Creates new Album objects with unique ID, name, description, timestamps, imageIds array, isSmart flag, and optional smartRules.
- `src/lib/gallery/albumManager.ts` (evaluateSmartRules): Evaluates smart album rules against files, returns matching file IDs. Rules support operators: equals, contains, gt, lt, between, in. Fields: object, filter, dateObs, exptime, instrument, telescope, tag, location, frameType.
- `src/lib/gallery/albumManager.ts` (suggestSmartAlbums): Generates smart album suggestions based on file metadata - groups by object, filter, location, and includes Favorites album.
- `src/lib/gallery/metadataIndex.ts` (buildMetadataIndex): Builds searchable index of all files - objects, filters, instruments, telescopes, tags, locations, dateRange, exptimeRange.
- `src/lib/gallery/metadataIndex.ts` (searchFiles): Full-text search across filename, object, filter, instrument, telescope, tags, location, and notes.
- `src/lib/gallery/metadataIndex.ts` (groupByLocation, groupByDate, groupByObject): Grouping utilities for organizing files by location, date, or astronomical object.
- `src/lib/gallery/frameClassifier.ts` (classifyByHeader, classifyByFilename, classifyFrameType): Auto-classifies frame type (light/dark/flat/bias) from FITS header or filename patterns.
- `src/lib/gallery/duplicateDetector.ts` (computeQuickHash, findDuplicateGroups): Detects duplicate files using fast hash (first 64KB + file size).
- `src/lib/gallery/duplicateDetector.ts` (getDuplicateStats): Calculates duplicate statistics (groups count, duplicate files count, wasted bytes).
- `src/lib/gallery/fileRenamer.ts` (generateFilename, previewRenames): Batch rename engine with template variables {object}, {date}, {time}, {filter}, {exptime}, {frameType}, {telescope}, {camera}, {gain}, {seq}, {original}.
- `src/lib/gallery/integrationReport.ts` (generateIntegrationReport): Creates exposure integration report grouped by target and filter for light frames only.
- `src/lib/gallery/integrationReport.ts` (exportReportAsMarkdown): Exports integration report as Markdown text.
- `src/lib/gallery/thumbnailCache.ts`: Thumbnail caching system (file contents not fully read in this investigation).

#### Type Definitions (src/lib/fits/types.ts)

- `Album` interface: id, name, description?, coverImageId?, createdAt, updatedAt, imageIds[], isSmart, smartRules?, sortOrder?
- `SmartAlbumRule` interface: field (object/filter/dateObs/exptime/instrument/telescope/tag/location/frameType), operator (equals/contains/gt/lt/between/in), value (string|number|string[]|[number,number])
- `FrameType`: "light" | "dark" | "flat" | "bias" | "unknown"
- `GalleryViewMode`: "grid" | "list" | "timeline"
- `FitsMetadata`: Includes albumIds: string[] for tracking which albums contain each file.

#### Stores (src/stores/)

- `src/stores/useAlbumStore.ts` (addAlbum): Adds album to store. Persists via MMKV.
- `src/stores/useAlbumStore.ts` (removeAlbum): Removes album by ID from store.
- `src/stores/useAlbumStore.ts` (updateAlbum): Updates album fields, auto-updates updatedAt timestamp.
- `src/stores/useAlbumStore.ts` (addImageToAlbum): Adds single image to album (prevents duplicates).
- `src/stores/useAlbumStore.ts` (removeImageFromAlbum): Removes image from album.
- `src/stores/useAlbumStore.ts` (addImagesToAlbum): Batch adds images to album, filters out existing IDs.
- `src/stores/useAlbumStore.ts` (setCoverImage): Sets coverImageId for album.
- `src/stores/useAlbumStore.ts` (updateSmartRules): Updates smart album rules.
- `src/stores/useAlbumStore.ts` (reorderAlbums): Reorders albums with sortOrder based on orderedIds.
- `src/stores/useAlbumStore.ts` (getAlbumById): Retrieves album by ID.
- `src/stores/useAlbumStore.ts` (getAlbumsForImage): Returns all albums containing a specific image.
- `src/stores/useAlbumStore.ts` (getSortedAlbums): Returns albums sorted by sortOrder then updatedAt.
- `src/stores/useGalleryStore.ts` (setViewMode, setGridColumns): Controls gallery view (grid/list/timeline) and column count.
- `src/stores/useGalleryStore.ts` (setFilterObject, setFilterFilter, setFilterFrameType, setFilterTargetId, setFilterTag, setFilterFavoriteOnly, setFilterDateRange): Gallery filter state management.
- `src/stores/useGalleryStore.ts` (setSelectionMode, toggleSelection, selectAll, clearSelection): Selection mode state for multi-select operations.

#### Hooks (src/hooks/)

- `src/hooks/useAlbums.ts` (createNewAlbum): Wraps createAlbum + addAlbum store action.
- `src/hooks/useAlbums.ts` (createSmartAlbum): Creates smart album, evaluates rules against files, populates imageIds.
- `src/hooks/useAlbums.ts` (refreshSmartAlbums): Re-evaluates all smart albums to update imageIds based on current files.
- `src/hooks/useAlbums.ts` (getSuggestions): Returns smart album suggestions from albumManager.
- `src/hooks/useGallery.ts` (useGallery): Returns filtered files based on store filters, metadata index, grouped data (by date/object/location), search function.

#### UI Components (src/components/gallery/)

- `src/components/gallery/AlbumCard.tsx`: Album card component showing cover image, name, image count, smart album indicator (sparkles icon). Supports compact mode for landscape.
- `src/components/gallery/CreateAlbumModal.tsx`: Modal for creating regular albums - name input, description textarea.
- `src/components/gallery/SmartAlbumModal.tsx`: Modal for creating smart albums with rule builder. Supports multiple rules with field/operator/value selection. Shows suggestions as quick-add chips.
- `src/components/gallery/AlbumActionSheet.tsx`: Bottom sheet with album actions - view detail, rename, delete.
- `src/components/gallery/AlbumPickerSheet.tsx`: Bottom sheet for selecting album to add images to. Filters out smart albums (only manual albums shown).
- `src/components/gallery/ThumbnailGrid.tsx`: FlashList-based thumbnail grid with selection mode, overlay info (filename/object/filter/exposure), favorite badge, selection checkbox. Supports variable columns.
- `src/components/gallery/FileListItem.tsx`: List view item with thumbnail, filename, metadata chips, favorite heart. Swipeable actions for favorite toggle and delete.
- `src/components/gallery/BatchTagSheet.tsx`: Bottom sheet for batch tagging - shows all tags, allows selecting/deselecting, adding new tags. Shows partial application counts.
- `src/components/gallery/BatchRenameSheet.tsx`: Bottom sheet for batch rename with template variables. Shows preview of renames (up to 20 shown).
- `src/components/gallery/IntegrationReportSheet.tsx`: Bottom sheet showing exposure statistics by target/filter. Summarizes total lights, targets, total exposure, date range. Copy markdown export button.

#### Routes (src/app/)

- `src/app/(tabs)/gallery.tsx`: Main gallery screen. Displays albums horizontally scrollable, filter chips (object, frame type), search bar, view mode toggle, selection toolbar with batch actions (add to album, batch tag, batch rename, compare, delete).
- `src/app/album/[id].tsx`: Album detail screen. Shows album header (name, description, image count, smart rules chips), thumbnail grid of album images. Selection mode toolbar supports set cover and remove from album. Delete album button. Rename dialog.

#### i18n Translations (src/i18n/locales/)

- `src/i18n/locales/en.ts` (gallery): "title", "subtitle", "gridView", "listView", "timelineView", "albums", "allImages", "createAlbum", "albumName", "albumDescription", "smartAlbum", "addToAlbum", "removeFromAlbum", "setCover", "emptyAlbum", "noImages", "filterBy", "object", "filter", "dateRange", "exposure", "instrument", "telescope", "favoritesOnly", "batchExport", "batchStack", "searchPlaceholder", "allTypes", "compare", "opacity", "noImage", "batchRename", "renameTemplate", "renamePreview", "batchTag", "newTag", "noTags", "integrationReport", "targets", "lights", "totalExp", "frames", "quality", "noLights", "frameTypes" (light/dark/flat/bias/unknown).
- `src/i18n/locales/en.ts` (album): "images", "created", "updated", "selected", "rules", "ruleValue", "addRule", "suggestions", "rename", "deleteAlbum", "deleteConfirm", "removeConfirm", "viewDetail".
- `src/i18n/locales/zh.ts`: Same translation keys as en.ts with Chinese equivalents.

### Report (The Answers)

#### result

**Current Album Features:**

1. **Manual Albums**: Create albums with name and description. Users can manually add images to these albums. Albums maintain a list of imageIds.

2. **Smart Albums**: Create albums with automatic rules. Rules evaluate against file metadata (object, filter, dateObs, exptime, instrument, telescope, tag, location, frameType). Supported operators: equals, contains, gt (greater than), lt (less than), between, in (array membership). Smart album imageIds are computed dynamically based on current files.

3. **Album Management**: Rename albums, delete albums (images not deleted), set cover image, reorder albums.

4. **Album Operations**: Add single or multiple images to album, remove images from album. Smart albums exclude images from manual add (AlbumPickerSheet filters out isSmart albums).

5. **Album Discovery**: Smart album suggestions auto-generated based on existing file data - suggests albums by object, filter, location, and favorites.

6. **Smart Album Refresh**: Hook provides refreshSmartAlbums() function to re-evaluate all smart albums when files change.

7. **Album Display**: Album cards show cover image, name, image count. Smart albums indicated with sparkles icon. Compact layout for landscape mode.

8. **Gallery Views**: Three view modes - grid, list, timeline (grouped by date). Grid/list use ThumbnailGrid with variable columns. Timeline uses groupedByDate with sections.

9. **Filtering**: Gallery supports filtering by object, filter (astronomical filter), frame type (light/dark/flat/bias), date range, favorites only, tags, targetId.

10. **Search**: Full-text search across filename, object, filter, instrument, telescope, tags, location, notes.

11. **Batch Operations**: Add selected images to album, batch tag, batch rename with templates, compare images (requires 2+), batch delete.

12. **Selection Mode**: Multi-select images with long-press entry. Shows selection toolbar with action buttons. Selection state persisted in useGalleryStore.

13. **Metadata Index**: Automatic index build from all files - extracts unique objects, filters, instruments, telescopes, tags, locations, date/exptime ranges for filtering UI.

14. **Frame Classification**: Automatic classification of frame types from FITS header (IMAGETYP/FRAME values) or filename patterns (bias, dark, flat, light keywords).

15. **Duplicate Detection**: Fast hash-based duplicate detection using first 64KB + file size. Finds duplicate groups, calculates stats.

16. **Integration Report**: Exposure statistics report by target and filter for light frames. Shows frame count, total exposure, average quality per filter. Export as Markdown.

17. **Thumbnail Grid**: FlashList-based grid with selection checkbox, favorite badge, overlay info (filename/object/filter/exposure). Optimized with drawDistance.

18. **File List Item**: List view with swipe actions (favorite toggle, delete). Shows thumbnail, filename, file size, object/filter chips, import date.

**Data Model for Albums:**

- `Album` interface defined in `src/lib/fits/types.ts`
- Fields: id (string), name (string), description (string | undefined), coverImageId (string | undefined), createdAt (number), updatedAt (number), imageIds (string[]), isSmart (boolean), smartRules (SmartAlbumRule[] | undefined), sortOrder (number | undefined)
- `SmartAlbumRule` interface: field (enum of metadata fields), operator (enum of comparison operators), value (string | number | string[] | [number, number])
- `FitsMetadata` includes `albumIds: string[]` for reverse lookup

**UI Components:**

- `AlbumCard.tsx` - Album display card
- `CreateAlbumModal.tsx` - Manual album creation
- `SmartAlbumModal.tsx` - Smart album creation with rule builder
- `AlbumActionSheet.tsx` - Album context actions (rename, delete, view)
- `AlbumPickerSheet.tsx` - Album selection for adding images
- `ThumbnailGrid.tsx` - Main image grid component
- `FileListItem.tsx` - List view item with swipe actions
- `BatchTagSheet.tsx` - Batch tagging interface
- `BatchRenameSheet.tsx` - Batch rename with templates
- `IntegrationReportSheet.tsx` - Exposure statistics sheet
- `LocationMarkerSheet.tsx` - Location marker (not fully investigated)
- `LocationMapView.tsx` - Map view component (not fully investigated)

**User Operations:**

- Create manual albums (name + description)
- Create smart albums (name + rules)
- View album detail (images in album)
- Add images to album (single or batch)
- Remove images from album
- Set album cover image
- Rename album
- Delete album
- Reorder albums
- Refresh smart albums (re-evaluate rules)
- Filter gallery by object, filter type, frame type, date range, favorites, tags
- Search gallery full-text
- Switch view modes (grid/list/timeline)
- Batch tag images
- Batch rename images with templates
- Compare selected images
- Delete selected images
- Generate integration report
- Copy report as Markdown

**i18n Keys (album-related):**

`gallery.*`:

- title, subtitle, gridView, listView, timelineView, albums, allImages, createAlbum, albumName, albumDescription, smartAlbum, addToAlbum, removeFromAlbum, setCover, emptyAlbum, noImages, filterBy, object, filter, dateRange, exposure, instrument, telescope, favoritesOnly, batchExport, batchStack, searchPlaceholder, allTypes, compare, opacity, noImage, batchRename, renameTemplate, renamePreview, batchTag, newTag, noTags, integrationReport, targets, lights, totalExp, frames, quality, noLights, frameTypes (light, dark, flat, bias, unknown)

`album.*`:

- images, created, updated, selected, rules, ruleValue, addRule, suggestions, rename, deleteAlbum, deleteConfirm, removeConfirm, viewDetail

#### conclusions

- The gallery system supports both manual and smart albums. Smart albums are created with rule-based filtering and automatically populate imageIds based on current file metadata.
- Album data is persisted in Zustand store with MMKV storage middleware.
- Smart albums exclude images from manual add operations (AlbumPickerSheet filters out isSmart albums).
- Smart album rules support complex operators including range queries (between) and array membership (in).
- Gallery provides three view modes with configurable grid columns. Timeline mode groups by date.
- Selection mode enables batch operations (tag, rename, add to album, compare, delete).
- Frame type classification is automatic from FITS headers or filename patterns.
- Duplicate detection uses fast hash-based approach for efficiency.
- Integration report summarizes exposure data by target and filter for light frames.
- Batch rename supports comprehensive template variables from FITS metadata.
- The system is fully internationalized with English and Chinese translations.

#### relations

- `src/app/(tabs)/gallery.tsx` imports and uses `useAlbums` hook, `useGallery` hook, `useGalleryStore`, `useFitsStore`, and gallery components.
- `src/hooks/useAlbums.ts` imports `useAlbumStore` and `useFitsStore`, and functions from `albumManager.ts` (createAlbum, evaluateSmartRules, suggestSmartAlbums).
- `src/hooks/useGallery.ts` imports `useGalleryStore`, `useFitsStore`, and functions from `metadataIndex.ts` (buildMetadataIndex, searchFiles, groupByDate/Object/Location).
- `src/app/album/[id].tsx` imports `useAlbumStore`, `useFitsStore`, and `ThumbnailGrid`.
- `src/stores/useAlbumStore.ts` imports `Album` and `SmartAlbumRule` types from `src/lib/fits/types.ts`.
- `src/stores/useGalleryStore.ts` stores filter state that is consumed by `src/hooks/useGallery.ts` for filtering.
- `src/lib/gallery/albumManager.ts` functions are used by `src/hooks/useAlbums.ts` for album creation and smart rule evaluation.
- `src/components/gallery/SmartAlbumModal.tsx` uses `suggestSmartAlbums` from `albumManager.ts` to display quick-add suggestions.
- `src/components/gallery/BatchRenameSheet.tsx` uses `previewRenames` and `getTemplateVariables` from `fileRenamer.ts`.
- `src/components/gallery/IntegrationReportSheet.tsx` uses `generateIntegrationReport` and `exportReportAsMarkdown` from `integrationReport.ts`.
- All gallery components use `useI18n` hook for translations from `src/i18n/locales/en.ts` and `zh.ts`.
