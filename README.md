<div align="center">

# Cobalt FITS Viewer

A cross-platform FITS file viewer and astronomical image processor for astronomers.

View, analyze, stack, and convert astronomical FITS images on **iOS**, **Android**, and **Web**.

[![CI](https://github.com/ElementAstro/cobalt-fits-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/ElementAstro/cobalt-fits-viewer/actions/workflows/ci.yml)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-54-blue?logo=expo)](https://docs.expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**English** | [中文](./README.zh-CN.md)

</div>

## ✨ Features

### FITS & Astronomy

- **FITS File Management** — Import, browse, search, tag, and organize FITS files
- **FITS Image Viewer** — Stretch, colormap, histogram, pixel info, HDU selection, grid overlay, crosshair, mini map
- **Frame Classification Engine** — Built-in `light/dark/flat/bias/darkflat/unknown` + custom frame types/rules (`header`/`filename`, `exact/contains/regex`, priority), report scope control, and one-click historical reclassification
- **Image Stacking** — Average, median, sigma clipping, min/max, winsorized, weighted stacking with alignment
- **Bidirectional Converter** — Full `FITS ↔ PNG/JPEG/WebP/TIFF/BMP`, plus FITS export (`.fits` / `.fits.gz`) with scientific/rendered modes
- **Best-Effort RAW Import** — Detects common camera RAW extensions (for example `DNG/CR2/CR3/NEF/ARW/RAF/ORF/RW2`) and attempts decode via runtime fallback chain (`Skia` primary, `image-js` fallback). Failed RAW/TIFF decodes are preserved as records with `decodeStatus=failed`.
- **RGB Compose** — Combine mono FITS into color images
- **Observation Targets** — Track galaxies, nebulae, clusters with exposure progress and filter planning
- **Observation Sessions** — Calendar view, timeline, session log, statistics, calendar sync
- **Gallery** — Grid / list / timeline views, albums, smart albums, batch export
- **Location Tagging** — Auto-tag observation sites with map view

### App & Platform

- **[Expo SDK 54](https://docs.expo.dev/)** — Managed workflow for rapid development
- **[Expo Router 6](https://docs.expo.dev/router/introduction/)** — File-based routing with deep linking
- **[HeroUI Native](https://heroui.com/)** — Beautiful, themeable component library
- **[TailwindCSS 4](https://tailwindcss.com/) + [Uniwind](https://docs.uniwind.dev/)** — Utility-first styling with automatic dark mode
- **[React Native Skia](https://shopify.github.io/react-native-skia/)** — GPU-accelerated 2D rendering for FITS images
- **[Zustand](https://zustand-demo.pmnd.rs/)** — Lightweight state management
- **[i18n-js](https://github.com/fnando/i18n)** — Internationalization (English & Chinese built-in)
- **TypeScript 5.9** — Full type safety with strict mode
- **Code Quality** — ESLint 9 (flat config) + Prettier + Commitlint + Husky + lint-staged
- **CI/CD** — GitHub Actions pipeline (type check → lint → test → build)

## 📦 Tech Stack

| Category       | Packages                                                                |
| -------------- | ----------------------------------------------------------------------- |
| Framework      | `expo` 54, `react` 19, `react-native` 0.81                              |
| Navigation     | `expo-router`, `react-native-screens`, `react-native-safe-area-context` |
| UI             | `heroui-native`, `@expo/vector-icons`, `@gorhom/bottom-sheet`           |
| Styling        | `tailwindcss` 4, `uniwind`, `tailwind-merge`, `tailwind-variants`       |
| Rendering      | `@shopify/react-native-skia`, `react-native-svg`                        |
| Animation      | `react-native-reanimated`, `react-native-gesture-handler`               |
| State          | `zustand`                                                               |
| FITS           | `fitsjs-ng`, `pako`                                                     |
| Storage        | `@react-native-async-storage/async-storage`, `expo-secure-store`        |
| Location & Map | `expo-location`, `expo-maps`                                            |
| Calendar       | `expo-calendar`                                                         |
| i18n           | `i18n-js`, `expo-localization`                                          |
| Code Quality   | `eslint` 9, `prettier`, `commitlint`, `husky`, `lint-staged`            |
| Testing        | `jest`, `jest-expo`, `@testing-library/react-native`                    |

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20
- **pnpm** (recommended package manager)
- **iOS**: Xcode (for simulator)
- **Android**: Android Studio (for emulator)

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

Then press `i` for iOS, `a` for Android, or `w` for Web.

## 📁 Project Structure

```text
src/
├── app/                  # File-based routes (Expo Router)
│   ├── _layout.tsx       # Root layout (Providers)
│   ├── index.tsx         # Entry redirect
│   ├── [...missing].tsx  # 404 catch-all page
│   ├── (tabs)/           # Tab navigation group
│   │   ├── index.tsx     # Files tab (FITS file manager)
│   │   ├── gallery.tsx   # Gallery tab (image browser)
│   │   ├── targets.tsx   # Targets tab (observation targets)
│   │   ├── sessions.tsx  # Sessions tab (observation log)
│   │   └── settings.tsx  # Settings tab
│   ├── viewer/           # FITS image viewer
│   ├── header/           # FITS header inspector
│   ├── editor/           # Image editor
│   ├── stacking/         # Image stacking
│   ├── compose/          # RGB compose
│   ├── convert/          # Format converter
│   ├── album/            # Album detail
│   ├── target/           # Target detail
│   ├── session/          # Session detail
│   └── map/              # Map view
├── components/           # Reusable UI components
│   ├── common/           # Shared components (EmptyState, LoadingOverlay, etc.)
│   ├── fits/             # FITS-specific components
│   ├── gallery/          # Gallery components
│   ├── targets/          # Target components
│   ├── sessions/         # Session components
│   └── converter/        # Converter components
├── hooks/                # Custom React hooks
├── stores/               # Zustand state stores
├── lib/                  # Core business logic
│   ├── fits/             # FITS file parsing
│   ├── stacking/         # Image stacking algorithms
│   ├── converter/        # Format conversion
│   ├── gallery/          # Gallery logic
│   ├── targets/          # Target management
│   ├── sessions/         # Session management
│   ├── calendar/         # Calendar integration
│   ├── logger/           # Logging system
│   ├── backup/           # Backup & restore
│   ├── theme/            # Theme configuration
│   └── utils/            # Utility functions
├── i18n/                 # Internationalization (en, zh)
├── utils/                # General utilities
├── global.css            # TailwindCSS + Uniwind + HeroUI styles
└── uniwind-types.d.ts    # Uniwind theme type definitions
```

## 📜 Available Scripts

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `pnpm start`         | Start the Expo development server |
| `pnpm ios`           | Run on iOS simulator              |
| `pnpm android`       | Run on Android emulator           |
| `pnpm web`           | Run in the web browser            |
| `pnpm lint`          | Run ESLint checks                 |
| `pnpm lint:fix`      | Run ESLint and auto-fix issues    |
| `pnpm format`        | Format code with Prettier         |
| `pnpm format:check`  | Check code formatting             |
| `pnpm test`          | Run unit tests                    |
| `pnpm test:watch`    | Run tests in watch mode           |
| `pnpm test:coverage` | Run tests with coverage report    |
| `pnpm typecheck`     | Run TypeScript type checking      |

## 🌍 Internationalization

Built-in i18n support powered by `i18n-js` and `expo-localization`. The app automatically detects the device language and falls back to English.

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

Deploy on all platforms with [Expo Application Services (EAS)](https://expo.dev/eas):

| Platform      | Command              | Documentation                                                   |
| ------------- | -------------------- | --------------------------------------------------------------- |
| Web           | `npx eas-cli deploy` | [EAS Hosting](https://docs.expo.dev/eas/hosting/get-started/)   |
| iOS / Android | `npx eas-cli build`  | [EAS Build](https://docs.expo.dev/build/introduction/)          |
| OTA Updates   | `npx eas-cli update` | [EAS Update](https://docs.expo.dev/eas-update/getting-started/) |

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](./CONTRIBUTING.md) before submitting a Pull Request.

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
