# Cobalt FITS Viewer - Project Overview

## Purpose

A cross-platform FITS file viewer and astronomical image processor for astronomers. View, analyze, stack, and convert FITS images on iOS, Android, and Web.

## Tech Stack

- **Framework**: React Native + Expo SDK 54
- **Language**: TypeScript (strict mode)
- **Routing**: Expo Router 6 (file-based routing)
- **State Management**: Zustand (9 stores)
- **UI Library**: HeroUI Native
- **Styling**: TailwindCSS 4 + Uniwind (className-based)
- **Rendering**: @shopify/react-native-skia (GPU rendering for FITS)
- **FITS Parsing**: fitsjs-ng with pako decompression
- **Animation**: React Native Reanimated
- **i18n**: i18n-js (en/zh locales)
- **Package Manager**: pnpm

## Codebase Structure

```
src/
├── app/           # File-based routes (Expo Router)
│   ├── (tabs)/    # Tab navigation (5 tabs: Files, Gallery, Targets, Sessions, Settings)
│   ├── viewer/    # FITS image viewer
│   ├── editor/    # Image editor
│   ├── stacking/  # Image stacking
│   └── ...
├── components/    # Reusable UI components
│   ├── common/    # Shared components
│   ├── fits/      # FITS-specific components
│   ├── gallery/   # Gallery components
│   ├── sessions/  # Session components
│   └── ...
├── hooks/         # Custom React hooks (21 hooks)
├── stores/        # Zustand state stores (9 stores)
├── lib/           # Core business logic
│   ├── fits/      # FITS file parsing
│   ├── stacking/  # Image stacking algorithms
│   ├── converter/ # Format conversion
│   └── ...
├── i18n/          # Internationalization
└── utils/         # Utility functions
```

## Key Features

- FITS file viewing with GPU rendering
- Image stacking and processing
- Gallery with album management
- Observation session tracking
- Target management
- Format conversion
- Map integration for location data
