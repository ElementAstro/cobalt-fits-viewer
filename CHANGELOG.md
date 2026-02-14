# Changelog

All notable changes to Cobalt FITS Viewer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- FITS file management with import, search, tags, and batch operations
- FITS image viewer with stretch, colormap, histogram, pixel info, HDU selection
- Image stacking (average, median, sigma clipping, min/max, winsorized, weighted)
- Format converter (FITS to PNG / JPEG / WebP) with presets
- RGB compose for combining mono FITS into color images
- Image editor with crop, rotate, flip, blur, sharpen, calibration
- Gallery with grid / list / timeline views, albums, and smart albums
- Observation targets tracking with exposure progress and filter planning
- Observation sessions with calendar view, timeline, log, and statistics
- Calendar sync via expo-calendar
- Location tagging with map view via expo-location and expo-maps
- GPU-accelerated rendering via @shopify/react-native-skia
- Zustand state management (9 stores)
- App logging system with export
- Backup & restore functionality
- OTA updates via expo-updates
- System info display

## [1.0.0] - 2025-02-14

### Added

- Initial project setup with Expo SDK 54
- File-based routing with Expo Router 6
- HeroUI Native component library integration
- TailwindCSS 4 + Uniwind styling
- React Native Reanimated animations
- Bottom sheet interactions with @gorhom/bottom-sheet
- Internationalization with i18n-js (English & Chinese)
- Async Storage and Secure Store for data persistence
- ESLint 9 + Prettier + Commitlint + Husky
- CI/CD with GitHub Actions
- TypeScript with strict mode
