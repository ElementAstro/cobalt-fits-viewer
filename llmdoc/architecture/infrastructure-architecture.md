# Infrastructure Architecture

## 1. Identity

- **What it is:** The architectural blueprint of the Infrastructure layer - detailing how stores, routing, and i18n interact to power the application.
- **Purpose:** Defines the patterns and execution flows that LLM agents follow when implementing features across state, navigation, and localization.

## 2. Core Components

- `src/stores/` (18 stores): Zustand stores for state management - 14 persisted (MMKV/AsyncStorage), 4 in-memory.
- `src/app/` (32+ routes): File-based Expo Router 6 routing with nested layouts.
- `src/i18n/` (locales, hooks): i18n-js configuration with useI18n hook.
- `src/lib/storage.ts` (zustandMMKVStorage): AsyncStorage adapter for Zustand persist middleware.

## 3. Execution Flow (LLM Retrieval Map)

### Store Initialization Flow

- **1. Entry:** App starts at `src/app/index.tsx` which redirects to `/(tabs)`.
- **2. Root Layout:** `src/app/_layout.tsx` imports and initializes persisted stores.
- **3. Provider Stack:** Root layout wraps with HeroUINativeProvider, FontProvider, AutoSolveProvider, AutoBackupProvider, TargetIntegrityProvider, OnboardingGate.
- **4. Tab Navigation:** `src/app/(tabs)/_layout.tsx` renders Tab navigator with 5 tabs.
- **5. Screen Render:** Tab screens consume stores directly (e.g., `useFitsStore`, `useGalleryStore`).

### Routing Flow

- **1. Root Stack:** `src/app/_layout.tsx` defines Stack navigator as root.
- **2. Tab Layout:** `(tabs)/_layout.tsx` defines Tab navigator nested in Stack.
- **3. Settings Stack:** `src/app/settings/_layout.tsx` defines Stack for settings sub-screens.
- **4. Astrometry Stack:** `src/app/astrometry/_layout.tsx` defines Stack for astrometry screens.
- **5. Dynamic Routes:** Detail screens use `[id]` dynamic segments (e.g., `viewer/[id].tsx`).

### i18n Flow

- **1. Initialization:** `src/i18n/index.ts` creates i18n instance with expo-localization detection.
- **2. Hook Usage:** Components call `useI18n()` which provides `t()`, `locale`, `setLocale`.
- **3. Translation Lookup:** `t("path.to.key")` resolves from `locales/en.ts` or `locales/zh.ts`.
- **4. Re-render:** useSyncExternalStore triggers re-render when locale changes.

### Store-Action-UI Flow

- **1. User Action:** Component calls store action (e.g., `useFitsStore.getState().addFile(file)`).
- **2. State Update:** Zustand updates state, triggers subscribers.
- **3. Re-render:** Connected components re-render with new state.
- **4. Persistence:** If persisted, AsyncStorage writes in background via zustandMMKVStorage.

## 4. Design Rationale

- **Nested Layouts:** Used to separate concerns - providers at root, tabs for main navigation, stacks for detail flows.
- **Persisted vs In-Memory:** Persisted stores for user data (files, targets, sessions); in-memory for UI state that should reset on navigation (viewer settings, gallery view mode).
- **partialize():** Persisted stores use partialize to only persist essential data, reducing storage footprint.
- **Provider Pattern:** Root layout uses provider stack pattern to avoid prop-drilling theming, localization, and auto-features.
