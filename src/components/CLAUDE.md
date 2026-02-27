[Root](../../CLAUDE.md) > [src](..) > **components**

# Components Module (UI)

> Reusable UI components organized by domain, 13 subdirectories, 100+ components

## Module Responsibility

This module contains all reusable UI components for the application, organized by feature domain. Components consume data from Zustand stores and hooks, and are styled with Uniwind (TailwindCSS) + HeroUI Native.

## Subdirectory Index

| Directory     | Components | Tests | Description                                      | Has `index.ts` |
| ------------- | ---------- | ----- | ------------------------------------------------ | -------------- |
| `common/`     | 27         | 27    | Shared UI (dialogs, settings rows, export opts)  | No             |
| `fits/`       | 17         | 18    | FITS viewer (canvas, histogram, controls, tools) | No             |
| `files/`      | 11         | 12    | File manager (list, filter, sort, import sheets) | Yes            |
| `gallery/`    | 29         | 26    | Gallery (albums, thumbnails, filters, batch ops) | No             |
| `targets/`    | 22         | 8     | Targets (cards, sheets, stats, equipment)        | No             |
| `sessions/`   | 19         | 8     | Sessions (cards, calendar, plans, live banner)   | Yes            |
| `editor/`     | 4+5        | 4     | Image editor (toolbar, params) + toolparams/     | No             |
| `astrometry/` | 10         | 10    | Plate solving (overlays, job cards, settings)    | Yes            |
| `backup/`     | 9          | 9     | Cloud backup (providers, LAN, progress)          | Yes            |
| `converter/`  | 3          | 3     | Format converter (batch, format selector)        | No             |
| `settings/`   | 4+9        | 4     | Settings (hub, sections) + processing/           | Yes            |
| `video/`      | 7          | 7     | Video player (controls, processing, tasks)       | No             |
| `map/`        | 2          | 1     | Map view (filter bar, stats panel)               | No             |

## Key Components by Domain

### common/ — Shared Components

| Component                | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `ExportDialog`           | Universal export dialog with format options  |
| `FitsExportOptions`      | FITS-specific export options panel           |
| `TiffExportOptions`      | TIFF export options (bit depth, compression) |
| `SerExportOptions`       | SER video export options                     |
| `XisfExportOptions`      | XISF export options                          |
| `OnboardingScreen`       | First-time user onboarding flow              |
| `AnimatedSplashScreen`   | Animated splash → app transition             |
| `FontProvider`           | Custom font loading (Inter, JetBrains Mono)  |
| `LogViewer`              | App log viewer with filtering                |
| `QuickLookModal`         | Quick file preview modal                     |
| `LoadingOverlay`         | Full-screen loading indicator                |
| `EmptyState`             | Empty state placeholder with icon + message  |
| `SearchBar`              | Reusable search input bar                    |
| `UpdateBanner`           | App update notification banner               |
| `SettingsRow`            | Standard settings row (label + value)        |
| `SettingsToggleRow`      | Settings row with toggle switch              |
| `SettingsSliderRow`      | Settings row with slider                     |
| `SimpleSlider`           | Basic slider control                         |
| `PromptDialog`           | Text input dialog                            |
| `OptionPickerModal`      | Option picker with search                    |
| `OperationSummaryDialog` | Post-operation summary display               |
| `GuideTarget`            | Tooltip guide target wrapper                 |
| `SystemInfoCard`         | Device/system info display card              |
| `InfoRow`                | Simple label-value row                       |
| `AnimatedProgressBar`    | Animated progress bar                        |

### fits/ — FITS Viewer Components

| Component               | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `FitsCanvas`            | Main Skia-based FITS image renderer (GPU)      |
| `FitsHistogram`         | Histogram display for pixel data               |
| `HistogramLevels`       | Interactive black/white point + gamma controls |
| `ViewerControls`        | Stretch, colormap, and display controls        |
| `ViewerControlPanel`    | Expandable control panel sidebar               |
| `ViewerToolbar`         | Top toolbar (zoom, rotate, annotate, export)   |
| `ViewerBottomSheet`     | Bottom sheet with image info/controls          |
| `ZoomControls`          | Zoom in/out/fit controls                       |
| `HeaderTable`           | FITS header keyword table display              |
| `PixelInspector`        | Pixel value readout at cursor position         |
| `Minimap`               | Overview minimap for panning                   |
| `CropOverlay`           | Crop selection overlay                         |
| `RegionSelectOverlay`   | Region of interest selection overlay           |
| `StarAnnotationOverlay` | Star detection annotation overlay              |
| `StatsOverlay`          | Image statistics overlay                       |
| `ImageInfoMetricsCard`  | Image quality metrics card                     |
| `AstrometryBadge`       | Badge showing plate-solve status               |

### gallery/ — Gallery Components

Key components: `ThumbnailGrid` (main grid view), `FileListItem` (list row), `GalleryHeader` (filter/sort bar), `AlbumCard`, `AlbumsTabContent`, `SmartAlbumModal`, `CreateAlbumModal`, `AlbumPickerSheet`, `BatchRenameSheet`, `BatchTagSheet`, `DuplicateImagesSheet`, `TrashSheet`, `LocationMapView` (platform-split: `.native.tsx` / `.web.tsx`).

### targets/ — Target Components

Key components: `TargetCard`, `TargetListHeader` (with sort/filter/search), `AddTargetSheet`, `EditTargetSheet`, `StatisticsDashboard`, `ExposureProgress`, `FilterExposurePlan`, `BestImageSelector`, `EquipmentRecommendations`, `GroupManagerSheet`, `ImageRatingSheet`, `AdvancedSearchSheet`.

### sessions/ — Session Components

Key components: `SessionCard`, `CreateSessionSheet`, `EditSessionSheet`, `ActiveSessionBanner`, `LiveSessionMetaSheet`, `ObservationCalendar`, `PlanObservationSheet`, `PlanCard`, `SessionStatsCard`, `SessionDateSummary`, `MonthlyActivityChart`.

### editor/ — Editor Components

- `EditorHeader`, `EditorToolBar`, `EditorToolParamPanel`, `StarAnnotationPanel`
- `toolparams/` subdirectory: `ToolParamsAdjust`, `ToolParamsGeometry`, `ToolParamsMask`, `ToolParamsProcess`

### settings/ — Settings Components

- Top-level: `SettingsHubScreen`, `SettingsCategoryCard`, `SettingsHeader`, `SettingsSection`
- `processing/` subdirectory: 9 section components (`ProcessingStackingSection`, `ProcessingComposeSection`, `ProcessingEditorSection`, `ProcessingExportSection`, `ProcessingFrameClassSection`, `ProcessingPerformanceSection`, `ProcessingVideoSection`, `AddRuleForm`, `ClassificationRuleCard`)

## Platform-Specific Components

| Component                 | Pattern                    | Purpose                                       |
| ------------------------- | -------------------------- | --------------------------------------------- |
| `gallery/LocationMapView` | `.native.tsx` / `.web.tsx` | Native uses expo-maps, web uses react-leaflet |

The `.types.ts` file defines shared props, and React Native's platform resolution picks the correct implementation at build time.

## Key Dependencies

| Package                        | Usage                                   |
| ------------------------------ | --------------------------------------- |
| `heroui-native`                | Base UI components (Button, Card, etc.) |
| `@shopify/react-native-skia`   | GPU rendering for FitsCanvas            |
| `@gorhom/bottom-sheet`         | Bottom sheet modals throughout          |
| `@shopify/flash-list`          | Performant lists (gallery, files)       |
| `@expo/vector-icons`           | Ionicons for icons                      |
| `react-native-reanimated`      | Animations in overlays and transitions  |
| `react-native-gesture-handler` | Gesture support for viewer interactions |
| `react-native-svg`             | SVG overlays (histogram, annotations)   |
| `expo-maps` / `react-leaflet`  | Map components (native / web)           |

## Conventions

- **Naming**: `PascalCase.tsx` for components, `camelCase.ts` for utilities/helpers
- **Barrel exports**: Some subdirectories (`files/`, `sessions/`, `astrometry/`, `backup/`, `settings/`) have `index.ts` barrel files; others import directly by file path
- **Sheets vs Modals**: Bottom sheets (`*Sheet.tsx`) for slide-up panels using `@gorhom/bottom-sheet`; modals (`*Modal.tsx`) for centered dialogs
- **Styling**: Uniwind `className` prop for all styling; HeroUI Native component primitives for base elements
- **i18n**: All user-facing text uses `useI18n()` hook — `t("key.path")`
- **Tests**: Colocated in `__tests__/` within each subdirectory; use `@testing-library/react-native`
- **Platform split**: Use `.native.tsx` / `.web.tsx` suffix when native and web implementations differ significantly

## Testing & Quality

| Aspect     | Status | Files                                   |
| ---------- | ------ | --------------------------------------- |
| Unit Tests | Good   | 47 test files across all subdirectories |

Best-covered: `common/` (27 tests), `astrometry/` (10), `backup/` (9).
Lower coverage: `targets/` (8), `sessions/` (8), `editor/` (4), `map/` (1).

## FAQ

**Q: How do I add a new component?**

1. Create `ComponentName.tsx` in the appropriate subdirectory
2. If the subdirectory has `index.ts`, add the export there
3. Use `useI18n()` for all text; style with Uniwind `className`
4. Add a test in `__tests__/ComponentName.test.tsx`

**Q: How do I choose between Sheet and Modal?**

- Use `*Sheet.tsx` (bottom sheet) for: settings panels, action menus, form inputs, multi-step flows
- Use `*Modal.tsx` (dialog) for: confirmations, simple prompts, option pickers

**Q: Where do I put shared/cross-domain components?**

Put them in `common/`. If a component is only used by one domain, keep it in that domain's directory.

**Q: How do I add a platform-specific component?**

Create `.native.tsx` and `.web.tsx` files with the same export. Create a `.types.ts` for shared prop types. Metro/webpack will resolve the correct file per platform.

## Related Files

```
src/components/
|-- common/             # 27 shared components + 27 tests
|-- fits/               # 17 FITS viewer components + 18 tests
|-- files/              # 11 file manager components + 12 tests (index.ts)
|-- gallery/            # 29 gallery components + 26 tests
|-- targets/            # 22 target components + 8 tests
|-- sessions/           # 19 session components + 8 tests (index.ts)
|-- editor/             # 4 editor + 5 toolparams + 8 tests
|   `-- toolparams/     # Tool parameter panels (index.ts)
|-- astrometry/         # 10 astrometry components + 10 tests (index.ts)
|-- backup/             # 9 backup components + 9 tests (index.ts)
|-- converter/          # 3 converter components + 3 tests
|-- settings/           # 4 settings + 9 processing + 6 tests (index.ts)
|   `-- processing/     # Processing settings sections (index.ts)
|-- video/              # 7 video components + 7 tests
`-- map/                # 2 map components + 1 test
```

## Gotchas

- **FitsCanvas requires Skia**: `@shopify/react-native-skia` needs native modules — won't render in Expo Go or on web. Use development builds for testing.
- **Bottom sheet nesting**: `@gorhom/bottom-sheet` requires `GestureHandlerRootView` at root. Nested sheets need careful z-index and portal management.
- **LocationMapView platform split**: The web version uses Leaflet (requires CSS import in `global.css`); the native version uses `expo-maps`. Props are shared via `.types.ts`.
- **Large components**: `HistogramLevels` (~29KB), `VideoProcessingSheet` (~36KB), `LogViewer` (~26KB), `PlanObservationSheet` (~26KB) are complex — modify with care.
- **No global barrel export**: There is no root `index.ts` for all components. Import from subdirectory paths directly (e.g., `from "../components/fits/FitsCanvas"`).
- **testHelpers**: `backup/testHelpers.tsx` contains shared test utilities for backup component tests — not a real component.

## Changelog

| Date       | Changes                          |
| ---------- | -------------------------------- |
| 2026-02-27 | AI context documentation created |
