# Project Overview

## 1. Identity

- **What it is:** A cross-platform FITS (Flexible Image Transport System) file viewer and astronomical image processor built with React Native + Expo SDK 54.
- **Purpose:** Enables astronomers to view, analyze, stack, and convert FITS images on iOS, Android, and Web platforms.

## 2. High-Level Description

Cobalt FITS Viewer is a comprehensive astronomical imaging application that provides professional-grade FITS file handling with a modern mobile-first UI. The application supports the complete astronomical imaging workflow: from file import and viewing, through image processing and stacking, to format conversion and cloud backup.

The architecture follows a clean separation pattern: Expo Router handles navigation with a 5-tab bottom navigation (Files, Gallery, Targets, Sessions, Settings), Zustand manages state with MMKV persistence, and specialized modules handle FITS parsing, image rendering, astrometry, and backup operations. UI components leverage HeroUI Native with TailwindCSS 4 styling via Uniwind.

## 3. Technology Stack

| Category         | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Framework        | React Native + Expo SDK 54                      |
| Navigation       | Expo Router 6 (file-based routing)              |
| State Management | Zustand (18 stores, 14 with MMKV persistence)   |
| UI Library       | HeroUI Native                                   |
| Styling          | TailwindCSS 4 + Uniwind                         |
| Rendering        | @shopify/react-native-skia                      |
| FITS Parsing     | fitsjs-ng + pako                                |
| Persistence      | AsyncStorage (via zustand-mmkv-storage adapter) |
| i18n             | i18n-js (en/zh locales)                         |

## 4. Key Modules and Relationships

### Core Modules

- **FITS Module** (`src/lib/fits/`): Core FITS file parsing, metadata extraction, header manipulation. Supports FITS, FITS.GZ, XISF, SER formats.
- **Viewer Module** (`src/components/fits/`): GPU-rendered FITS display with stretch algorithms, colormaps, zoom/pan, histogram, overlays.
- **Stacking Module** (`src/lib/stacking/`): Image alignment, calibration, quality evaluation, multiple stacking algorithms (average, median, sigma clip, weighted).
- **Gallery Module** (`src/lib/gallery/`): Album management, smart albums with rule-based filtering, thumbnail caching, duplicate detection.
- **Target Management** (`src/lib/targets/`): Observation target tracking with auto-detection from FITS headers, exposure statistics, coordinate handling.
- **Sessions Module** (`src/lib/sessions/`): Observation session logging with auto-detection from time gaps, equipment tracking, calendar integration.
- **Converter Module** (`src/lib/converter/`): Format conversion (PNG, JPEG, TIFF, WebP, BMP, FITS, XISF, SER) with 8+ stretch algorithms.
- **Backup Module** (`src/lib/backup/`): Cloud backup with 5 providers (Google Drive, OneDrive, Dropbox, WebDAV, SFTP), incremental sync, manifest versioning.
- **Astrometry Module** (`src/lib/astrometry/`): Plate solving via Astrometry.net API, WCS export, coordinate grid overlay.

### Data Flow

```
FITS Files -> fitsParser (fitsjs-ng) -> FitsMetadata + Float32Array
                                              |
                                              v
                                        useImageProcessing (stretch + colormap)
                                              |
                                              v
                                        FitsCanvas (react-native-skia)
                                              |
                                              v
                                        Display + Overlays
```

### Navigation Structure

```
Root Layout (_layout.tsx)
  |-- Tab Navigator (5 tabs)
  |     |-- Files Tab (file manager)
  |     |-- Gallery Tab (image browser + albums)
  |     |-- Targets Tab (observation targets)
  |     |-- Sessions Tab (observation sessions)
  |     |-- Settings Tab (settings hub)
  |
  |-- Stack Navigator (detail screens)
        |-- viewer/[id] (FITS viewer)
        |-- editor/[id] (image editor)
        |-- stacking (image stacking)
        |-- compose (RGB compose)
        |-- convert (format converter)
        |-- backup (cloud backup)
        |-- astrometry (plate solving)
        |-- map (target map)
        |-- compare (image comparison)
        |-- settings/* (settings sub-screens)
```

## 5. Key Data Models

| Model                | Description                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `FitsMetadata`       | Core file metadata (filename, dimensions, observation info, coordinates, tags, albumIds, targetId, sessionId) |
| `Target`             | Observation target (name, aliases, type, coordinates, exposure stats, planned filters)                        |
| `ObservationSession` | Observation session (date, duration, equipment, weather, targets, imageIds)                                   |
| `Album`              | Image album (manual or smart rules) with cover image, sorting                                                 |
| `AstrometryJob`      | Plate solving job with status, calibration, annotations                                                       |
| `ViewerState`        | Viewer display settings (stretch, colormap, levels, overlays)                                                 |

## 6. Statistics

| Metric         | Value                          |
| -------------- | ------------------------------ |
| Components     | 65+                            |
| Custom Hooks   | 29                             |
| Zustand Stores | 18 (14 persisted, 4 in-memory) |
| i18n Locales   | 2 (en, zh)                     |
| Test Files     | 61                             |

## 7. Source of Truth

- **Project Config:** `package.json`, `jest.config.js`, `app.json`
- **Type Definitions:** `src/lib/fits/types.ts`
- **Routing:** `src/app/` (Expo Router file-based routing)
- **State Management:** `src/stores/` (Zustand stores)
- **Business Logic:** `src/lib/` (13 submodules)
- **UI Components:** `src/components/` (10 subdirectories)
- **Hooks:** `src/hooks/` (29 custom hooks)
- **Tests:** Distributed alongside source files in `__tests__/` directories
