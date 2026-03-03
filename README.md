<div align="center">

# 🔭 Cobalt FITS Viewer

**A cross-platform FITS file viewer and astronomical image processor for astronomers.**

View, analyze, stack, and convert astronomical FITS images on **iOS**, **Android**, and **Web**.

[![CI](https://github.com/ElementAstro/cobalt-fits-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/ElementAstro/cobalt-fits-viewer/actions/workflows/ci.yml)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-54-blue?logo=expo)](https://docs.expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**English** | [中文](./README.zh-CN.md)

</div>

---

## ✨ Features

### 🌌 FITS & Astronomy

- **FITS File Management** — Import, browse, search, tag, and organize FITS files with batch operations
- **FITS Image Viewer** — 8 stretch algorithms, 16 colormaps, histogram, pixel inspector, HDU selector, grid overlay, crosshair, mini map, annotations
- **FITS Header Inspector** — View and edit FITS headers with full keyword search
- **Frame Classification Engine** — Built-in `light/dark/flat/bias/darkflat/unknown` + custom frame types/rules (`header`/`filename`, `exact/contains/regex`, priority), report scope control, and one-click historical reclassification
- **Image Stacking** — Average, median, sigma clipping, min/max, winsorized, weighted stacking with star-alignment and dark/flat calibration
- **Bidirectional Converter** — Full `FITS ↔ PNG/JPEG/WebP/TIFF/BMP`, plus FITS export (`.fits` / `.fits.gz`) with scientific/rendered modes; batch conversion support
- **Best-Effort RAW Import** — Detects common camera RAW extensions (e.g. `DNG/CR2/CR3/NEF/ARW/RAF/ORF/RW2`) and attempts decode via runtime fallback chain (`Skia` primary, `image-js` fallback)
- **RGB Compose** — Combine mono FITS into color images with basic and advanced composition modes
- **Image Editor** — Crop, rotate, flip, blur, sharpen, calibration, star annotation
- **Image Comparison** — Side-by-side comparison of processed images
- **Astrometry Integration** — Plate solving via [Astrometry.net](https://nova.astrometry.net) with WCS export and calibration results
- **Observation Targets** — Track galaxies, nebulae, clusters with exposure progress, filter planning, and statistics
- **Observation Sessions** — Calendar view, timeline, session log, statistics, calendar sync
- **Gallery** — Grid / list / timeline views, albums, smart albums, batch export, trash and recovery
- **Location Tagging** — Auto-tag observation sites with interactive map view and favorite sites
- **Video Support** — Record observation videos with camera, playback with picture-in-picture
- **Backup & Restore** — Cloud backup to Google Drive, OneDrive, Dropbox, and WebDAV
- **LAN Transfer** — Transfer FITS files between devices over local network

### 📱 App & Platform

- **[Expo SDK 54](https://docs.expo.dev/)** — Managed workflow with EAS for builds, updates, and hosting
- **[Expo Router 6](https://docs.expo.dev/router/introduction/)** — File-based routing with deep linking (`cobalt://` scheme)
- **[HeroUI Native](https://heroui.com/)** — Beautiful, themeable component library with dark mode
- **[TailwindCSS 4](https://tailwindcss.com/) + [Uniwind](https://docs.uniwind.dev/)** — Utility-first styling with automatic dark mode
- **[React Native Skia](https://shopify.github.io/react-native-skia/)** — GPU-accelerated 2D rendering for FITS images
- **[Zustand](https://zustand-demo.pmnd.rs/)** — 17 persisted state stores with MMKV
- **[i18n-js](https://github.com/fnando/i18n)** — Internationalization (English & Chinese built-in)
- **TypeScript 5.9** — Full type safety with strict mode
- **59 Custom Hooks** — Rich hook library covering every feature domain
- **100+ Components** — Organized by domain across 13 component directories
- **Code Quality** — ESLint 9 (flat config) + Prettier + Commitlint + Husky + lint-staged
- **CI/CD** — GitHub Actions pipeline (type check → lint → format → test → build)
- **E2E Testing** — Maestro flows for Android navigation testing + route parity validation

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    Expo Router 6                         │
│              (File-based routing, 5 tabs)                │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌───────────┐  ┌────────────────────┐   │
│  │ HeroUI   │  │  Skia     │  │  Reanimated        │   │
│  │ Native   │  │  Renderer │  │  + Gesture Handler  │   │
│  └──────────┘  └───────────┘  └────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌───────────┐  ┌────────────────────┐   │
│  │ 59 Hooks │  │ 17 Stores │  │  25 Lib Modules    │   │
│  └──────────┘  └───────────┘  └────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │         fitsjs-ng + pako (FITS parsing)          │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│     Expo APIs: Location, Calendar, Camera, FileSystem   │
│     Maps, MediaLibrary, Notifications, SecureStore      │
└─────────────────────────────────────────────────────────┘
```

## 📦 Tech Stack

| Category       | Packages                                                                        |
| -------------- | ------------------------------------------------------------------------------- |
| Framework      | `expo` 54, `react` 19, `react-native` 0.81                                      |
| Navigation     | `expo-router` 6, `react-native-screens`, `react-native-safe-area-context`       |
| UI             | `heroui-native`, `@expo/vector-icons`, `@gorhom/bottom-sheet`                   |
| Styling        | `tailwindcss` 4, `uniwind`, `tailwind-merge`, `tailwind-variants`               |
| Rendering      | `@shopify/react-native-skia`, `react-native-svg`                                |
| Animation      | `react-native-reanimated`, `react-native-gesture-handler`                       |
| State          | `zustand` 5 (17 stores with MMKV persistence)                                   |
| FITS           | `fitsjs-ng`, `pako`                                                             |
| Image          | `expo-image`, `expo-image-manipulator`, `image-js`, `geotiff`, `libheif-js`     |
| Video          | `expo-video`, `expo-video-thumbnails`, `ffmpeg-kit-react-native`                |
| Storage        | `@react-native-async-storage/async-storage`, `expo-secure-store`                |
| Location & Map | `expo-location`, `expo-maps`, `leaflet` + `react-leaflet` (web), `supercluster` |
| Calendar       | `expo-calendar`                                                                 |
| Auth           | `expo-auth-session`, `@react-native-google-signin/google-signin`                |
| i18n           | `i18n-js`, `expo-localization`                                                  |
| Fonts          | `@expo-google-fonts/inter`, `jetbrains-mono`, `space-grotesk`                   |
| Lists          | `@shopify/flash-list`                                                           |
| Code Quality   | `eslint` 9, `prettier`, `commitlint`, `husky`, `lint-staged`                    |
| Testing        | `jest` 29, `jest-expo`, `@testing-library/react-native`                         |

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 10 (recommended package manager)
- **iOS**: Xcode 15+ (for simulator / device builds)
- **Android**: Android Studio (for emulator / device builds)

> [!NOTE]
> FITS pixel rendering uses `@shopify/react-native-skia` which requires native modules. It won't work in Expo Go — use [development builds](https://docs.expo.dev/develop/development-builds/introduction/) instead.

### Installation

```sh
# Clone the repository
git clone https://github.com/ElementAstro/cobalt-fits-viewer.git
cd cobalt-fits-viewer

# Install dependencies
pnpm install

# Start the development server
pnpm start
```

Then press **`i`** for iOS, **`a`** for Android, or **`w`** for Web.

### Environment Variables

| Variable              | Required | Description                        |
| --------------------- | -------- | ---------------------------------- |
| `GOOGLE_MAPS_API_KEY` | Optional | Google Maps API key (Android maps) |

Create a `.env.local` file in the project root for local development.

## 📁 Project Structure

```text
src/
├── app/                       # File-based routes (Expo Router 6)
│   ├── _layout.tsx            # Root layout (Providers, Onboarding)
│   ├── index.tsx              # Entry redirect
│   ├── [...missing].tsx       # 404 catch-all page
│   ├── (tabs)/                # Tab navigation (5 tabs)
│   │   ├── index.tsx          # Files — FITS file manager
│   │   ├── gallery.tsx        # Gallery — image browser
│   │   ├── targets.tsx        # Targets — observation targets
│   │   ├── sessions.tsx       # Sessions — observation log
│   │   └── settings.tsx       # Settings
│   ├── viewer/[id].tsx        # FITS image viewer
│   ├── header/[id].tsx        # FITS header inspector
│   ├── editor/[id].tsx        # Image editor
│   ├── stacking/              # Image stacking
│   ├── compose/               # RGB compose (basic + advanced)
│   ├── convert/               # Format converter (single + batch)
│   ├── album/[id].tsx         # Album detail
│   ├── target/                # Target detail + statistics
│   ├── session/[id].tsx       # Session detail
│   ├── map/                   # Map view
│   ├── astrometry/            # Plate solving + results
│   ├── compare/               # Image comparison
│   ├── backup/                # Backup management
│   ├── video/[id].tsx         # Video player
│   └── settings/              # Settings sub-pages
│       ├── appearance.tsx     # Theme & display
│       ├── viewer.tsx         # Viewer defaults
│       ├── gallery.tsx        # Gallery preferences
│       ├── processing.tsx     # Processing settings
│       ├── observation.tsx    # Observation config
│       ├── storage.tsx        # Storage management
│       ├── licenses.tsx       # Open-source licenses
│       └── about.tsx          # About & version info
├── components/                # 100+ reusable UI components
│   ├── common/                # Shared (EmptyState, LoadingOverlay, ...)
│   ├── fits/                  # FITS viewer (SkiaCanvas, Histogram, ...)
│   ├── files/                 # File manager (FileList, ImportSheet, ...)
│   ├── gallery/               # Gallery (GridView, AlbumCard, ...)
│   ├── targets/               # Targets (TargetCard, ExposureProgress, ...)
│   ├── sessions/              # Sessions (SessionCard, Timeline, ...)
│   ├── converter/             # Converter (FormatPicker, BatchProgress, ...)
│   ├── editor/                # Editor (Toolbar, CropOverlay, ...)
│   ├── astrometry/            # Astrometry (JobStatus, ResultViewer, ...)
│   ├── backup/                # Backup (ProviderPicker, RestoreDialog, ...)
│   ├── video/                 # Video (Player, ThumbnailGrid, ...)
│   ├── map/                   # Map (MapView, SiteMarker, ...)
│   └── settings/              # Settings (ThemePicker, LanguageSwitch, ...)
├── hooks/                     # 59 custom React hooks
├── stores/                    # 17 Zustand stores (MMKV persistence)
├── lib/                       # Core business logic
│   ├── fits/                  # FITS parsing, metadata, writer
│   ├── stacking/              # Alignment, calibration, star detection
│   ├── converter/             # Format conversion, batch processing
│   ├── gallery/               # Albums, thumbnails, frame classifier
│   ├── targets/               # Target management, coordinate math
│   ├── sessions/              # Session detection, observation log
│   ├── astrometry/            # Astrometry.net client, WCS export
│   ├── backup/                # Cloud providers (GDrive, OneDrive, ...)
│   ├── calendar/              # Calendar integration
│   ├── viewer/                # Viewer logic
│   ├── image/                 # Image processing utilities
│   ├── video/                 # Video processing
│   ├── map/                   # Map overlays, clustering
│   ├── logger/                # Logging system with export
│   ├── theme/                 # Theme configuration, font presets
│   └── utils/                 # File manager, pixel math, image export
├── i18n/                      # Internationalization (en, zh)
├── utils/                     # General utilities (cn.ts, etc.)
├── global.css                 # TailwindCSS + Uniwind + HeroUI styles
└── uniwind-types.d.ts         # Uniwind theme type definitions
```

## 📜 Available Scripts

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `pnpm start`           | Start the Expo development server        |
| `pnpm ios`             | Run on iOS simulator                     |
| `pnpm android`         | Run on Android emulator                  |
| `pnpm web`             | Run in the web browser                   |
| `pnpm build`           | Export web build                         |
| `pnpm lint`            | Run ESLint checks                        |
| `pnpm lint:fix`        | Run ESLint and auto-fix issues           |
| `pnpm format`          | Format code with Prettier                |
| `pnpm format:check`    | Check code formatting                    |
| `pnpm test`            | Run unit tests                           |
| `pnpm test:watch`      | Run tests in watch mode                  |
| `pnpm test:coverage`   | Run tests with coverage report           |
| `pnpm test:app`        | Run tests for app routes only            |
| `pnpm test:app:parity` | Validate test files exist for all routes |
| `pnpm typecheck`       | Run TypeScript type checking             |
| `pnpm e2e:parity`      | Validate E2E route-flow parity           |
| `pnpm e2e:android`     | Run Maestro E2E flows on Android         |

## 🧪 Testing

### Unit Tests

Tests use **Jest** + **jest-expo** + **@testing-library/react-native**. Test files are co-located in `__tests__/` directories next to source files.

```sh
pnpm test              # Run all tests
pnpm test:coverage     # Run with coverage report
pnpm test:watch        # Watch mode
pnpm test:app          # App route tests only
```

### E2E Tests

E2E tests use [Maestro](https://maestro.mobile.dev/) for Android flows:

```sh
pnpm e2e:android       # Run Maestro test suites
pnpm e2e:parity        # Validate route-flow parity
```

Maestro flows are defined in `.maestro/flows/` and organized by suites in `.maestro/suites/`.

### Pre-commit Checks

Husky + lint-staged run automatically on every commit:

- **pre-commit** — ESLint fix + Prettier on staged `.ts/.tsx` files
- **commit-msg** — Validates [Conventional Commits](https://www.conventionalcommits.org/) format

## 🌍 Internationalization

Built-in i18n support powered by `i18n-js` and `expo-localization`. The app automatically detects the device language and falls back to English.

**Supported languages:** English (`en`), Chinese (`zh`)

**Adding a new language:**

1. Create a new locale file in `src/i18n/locales/` (e.g., `ja.ts`)
2. Export it from `src/i18n/locales/index.ts`
3. Register it in `src/i18n/index.ts`

**Using translations in components:**

```tsx
import { useI18n } from "../i18n/useI18n";

function MyComponent() {
  const { t, locale, setLocale } = useI18n();
  return <Text>{t("viewer.stretch")}</Text>;
}
```

## 🚢 Deployment

### EAS Build Profiles

The project uses [Expo Application Services (EAS)](https://expo.dev/eas) with pre-configured build profiles in `eas.json`:

| Profile       | Distribution | Description                                |
| ------------- | ------------ | ------------------------------------------ |
| `development` | Internal     | Dev client for local testing               |
| `e2e-test`    | Internal     | E2E testing builds (APK)                   |
| `preview`     | Internal     | Internal preview builds                    |
| `production`  | Store        | Production builds (auto-increment version) |

### Deploy Commands

| Platform      | Command              | Documentation                                                   |
| ------------- | -------------------- | --------------------------------------------------------------- |
| Web           | `npx eas-cli deploy` | [EAS Hosting](https://docs.expo.dev/eas/hosting/get-started/)   |
| iOS / Android | `npx eas-cli build`  | [EAS Build](https://docs.expo.dev/build/introduction/)          |
| OTA Updates   | `npx eas-cli update` | [EAS Update](https://docs.expo.dev/eas-update/getting-started/) |

OTA updates are enabled with `checkAutomatically: "ON_ERROR_RECOVERY"` policy and `appVersion` runtime versioning.

## ⚠️ Platform Notes

| Feature                     | iOS | Android | Web |
| --------------------------- | --- | ------- | --- |
| FITS Skia rendering         | ✅  | ✅      | ❌  |
| Camera / Video recording    | ✅  | ✅      | ❌  |
| Google Maps                 | ✅  | ✅      | 🔄  |
| Calendar sync               | ✅  | ✅      | ❌  |
| Location tagging            | ✅  | ✅      | 🔄  |
| Cloud backup (OAuth)        | ✅  | ✅      | ❌  |
| Haptic feedback             | ✅  | ✅      | ❌  |
| File system access          | ✅  | ✅      | 🔄  |
| Leaflet maps (web fallback) | ❌  | ❌      | ✅  |

> ✅ = Fully supported · 🔄 = Partial / fallback · ❌ = Not available

## ⚙️ Gotchas

- **fitsjs patching** — `pnpm postinstall` runs `scripts/patch-fitsjs.mjs` to patch fitsjs-ng. If you update fitsjs-ng, verify the patch still applies.
- **Skia native modules** — `@shopify/react-native-skia` requires development builds; FITS rendering won't work in Expo Go.
- **MMKV persistence** — Zustand stores use persist middleware. Changing store shape requires migration logic or users lose data.
- **i18n sync** — Both `en.ts` and `zh.ts` must have identical key structures — there's no build-time check for missing keys.
- **Astrometry API key** — Required for plate solving. Obtain from [nova.astrometry.net](https://nova.astrometry.net) and store via `expo-secure-store`.
- **Web vs Native** — Some features (Skia rendering, file system, camera) behave differently or are unavailable on web. See the Platform Notes table above.

## 📚 Documentation

Detailed documentation is available in the [`llmdoc/`](./llmdoc/) directory:

- **[Overview](./llmdoc/overview/)** — Project overview, core modules, infrastructure
- **[Architecture](./llmdoc/architecture/)** — Routing, state management, FITS module, stacking, gallery, astrometry
- **[How-To Guides](./llmdoc/guides/)** — Add screens, add translations, manage observations, stack images
- **[Reference](./llmdoc/reference/)** — Data models, export formats, i18n keys, coding conventions

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) before submitting a Pull Request.

### Quick Start for Contributors

```sh
git checkout -b feat/my-feature    # Create feature branch
pnpm typecheck && pnpm lint        # Verify before committing
pnpm test                          # Run tests
git commit -m "feat: add feature"  # Conventional Commits required
```

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

## 🙏 Acknowledgments

- **[fitsjs-ng](https://github.com/AsteroidOS/fitsjs-ng)** — FITS file parsing for JavaScript
- **[Shopify/react-native-skia](https://github.com/Shopify/react-native-skia)** — GPU-accelerated 2D rendering
- **[HeroUI](https://heroui.com/)** — React Native component library
- **[Expo](https://expo.dev/)** — Universal React Native platform
- **[Astrometry.net](https://nova.astrometry.net)** — Plate solving service
