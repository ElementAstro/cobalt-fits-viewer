# Infrastructure Overview

## 1. Identity

- **What it is:** The foundational layer of Cobalt FITS Viewer comprising state management (Zustand stores), navigation (Expo Router), and internationalization (i18n-js).
- **Purpose:** Provides reactive state, file-based routing, and multi-language support for the entire application.

## 2. High-Level Description

The Infrastructure module is the backbone of the application, enabling all other features to function. It consists of three interconnected systems:

- **State Management (18 Zustand stores):** Manages application state with 14 persisted stores using AsyncStorage (via zustandMMKVStorage adapter) and 4 in-memory stores for ephemeral UI state.
- **Routing (Expo Router 6):** Implements file-based routing with nested layouts - root layout with providers, tab navigator for 5 main screens, and stack navigators for detail screens and settings.
- **Internationalization (i18n-js):** Provides English and Chinese locales with auto-detection, runtime switching, and comprehensive translation keys for all features.

These systems integrate at the root layout, where stores initialize, routing context is established, and i18n configuration loads. Every screen consumes stores for state, uses routing for navigation, and displays translated text via the useI18n hook.
