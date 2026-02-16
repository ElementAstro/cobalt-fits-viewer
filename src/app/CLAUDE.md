[Root](../../CLAUDE.md) > [src](..) > **app**

# App Module (Routing)

> File-based routing with Expo Router 6

## Module Responsibility

This module handles all application routing using Expo Router's file-based convention. It includes:

- Root layout with global providers (GestureHandler, HeroUI, Fonts, AutoSolve, AutoBackup)
- Onboarding gate for first-time users
- Tab navigation (Files, Gallery, Targets, Sessions, Settings)
- Detail screens (viewer, editor, stacking, converter, etc.)
- 404 fallback handling
- Entry point redirection

## Entry & Startup

| File          | Purpose                                                |
| ------------- | ------------------------------------------------------ |
| `_layout.tsx` | Root layout wrapping app with providers and onboarding |
| `index.tsx`   | Entry point, redirects to `/(tabs)` route              |

**Startup Flow:**

```
index.tsx (redirect) -> _layout.tsx (providers + onboarding) -> (tabs)/_layout.tsx -> (tabs)/index.tsx (Files)
```

**Provider Stack:**

```tsx
<GestureHandlerRootView>
  <HeroUINativeProvider>
    <FontProvider>
      <AutoSolveProvider>
        <AutoBackupProvider>
          <AnimatedSplashScreen>
            <OnboardingGate>
              <Stack />
              <UpdateBanner />
            </OnboardingGate>
          </AnimatedSplashScreen>
        </AutoBackupProvider>
      </AutoSolveProvider>
    </FontProvider>
  </HeroUINativeProvider>
</GestureHandlerRootView>
```

## Public Interfaces

### Routes

| Route                     | Component                    | Description                    |
| ------------------------- | ---------------------------- | ------------------------------ |
| `/`                       | `index.tsx`                  | Redirects to `/(tabs)`         |
| `/(tabs)`                 | `(tabs)/_layout.tsx`         | Tab navigator (5 tabs)         |
| `/(tabs)/`                | `(tabs)/index.tsx`           | Files screen (FITS manager)    |
| `/(tabs)/gallery`         | `(tabs)/gallery.tsx`         | Gallery screen (image browser) |
| `/(tabs)/targets`         | `(tabs)/targets.tsx`         | Targets screen                 |
| `/(tabs)/sessions`        | `(tabs)/sessions.tsx`        | Sessions screen                |
| `/(tabs)/settings`        | `(tabs)/settings.tsx`        | Settings screen                |
| `/viewer/[id]`            | `viewer/[id].tsx`            | FITS image viewer              |
| `/header/[id]`            | `header/[id].tsx`            | FITS header inspector          |
| `/editor/[id]`            | `editor/[id].tsx`            | Image editor                   |
| `/stacking`               | `stacking/index.tsx`         | Image stacking                 |
| `/compose`                | `compose/index.tsx`          | RGB compose                    |
| `/convert`                | `convert/index.tsx`          | Format converter (single)      |
| `/convert/batch`          | `convert/batch.tsx`          | Batch format converter         |
| `/album/[id]`             | `album/[id].tsx`             | Album detail                   |
| `/target/[id]`            | `target/[id].tsx`            | Target detail                  |
| `/session/[id]`           | `session/[id].tsx`           | Session detail                 |
| `/map`                    | `map/index.tsx`              | Map view                       |
| `/backup`                 | `backup/index.tsx`           | Backup management              |
| `/astrometry`             | `astrometry/index.tsx`       | Astrometry.net jobs            |
| `/astrometry/result/[id]` | `astrometry/result/[id].tsx` | Astrometry result              |
| `/compare`                | `compare/index.tsx`          | Image comparison               |
| `/settings/*`             | `settings/_layout.tsx`       | Settings sub-screens           |
| `/*`                      | `[...missing].tsx`           | 404 fallback                   |

### Providers (Root Layout)

| Provider                 | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `GestureHandlerRootView` | Required for @gorhom/bottom-sheet           |
| `HeroUINativeProvider`   | Theme and UI component provider             |
| `FontProvider`           | Custom font loading (Inter, JetBrains Mono) |
| `AutoSolveProvider`      | Auto astrometry solving for new images      |
| `AutoBackupProvider`     | Automatic backup scheduling                 |
| `AnimatedSplashScreen`   | Animated transition from splash             |
| `OnboardingGate`         | First-time user onboarding flow             |

## Key Dependencies

| Package                        | Usage                                                |
| ------------------------------ | ---------------------------------------------------- |
| `expo-router`                  | File-based routing, Stack, Tabs, useRouter, Redirect |
| `react-native-gesture-handler` | GestureHandlerRootView for bottom sheet support      |
| `heroui-native`                | HeroUINativeProvider, UI components, useThemeColor   |
| `@expo/vector-icons`           | Ionicons for tab icons                               |
| `expo-splash-screen`           | Splash screen control                                |
| `expo-screen-orientation`      | Orientation lock management                          |

## Data Models

Components consume data from Zustand stores:

| Store                 | Purpose                                 |
| --------------------- | --------------------------------------- |
| `useFitsStore`        | FITS file list, selection, search, sort |
| `useGalleryStore`     | Gallery view mode, filters              |
| `useViewerStore`      | Viewer state (stretch, colormap, etc.)  |
| `useTargetStore`      | Observation targets                     |
| `useTargetGroupStore` | Target groups/categories                |
| `useSessionStore`     | Observation sessions                    |
| `useSettingsStore`    | App settings (orientation lock, etc.)   |
| `useAlbumStore`       | Albums                                  |
| `useConverterStore`   | Converter settings                      |
| `useBackupStore`      | Backup state and progress               |
| `useAstrometryStore`  | Astrometry jobs                         |
| `useOnboardingStore`  | Onboarding completion state             |
| `useLogStore`         | App logs                                |

## Testing & Quality

| Aspect     | Status         | Files                             |
| ---------- | -------------- | --------------------------------- |
| Unit Tests | Partial        | `(tabs)/__tests__/index.test.tsx` |
| E2E Tests  | Not configured | -                                 |

## FAQ

**Q: How do I add a new tab?**

Add a new `.tsx` file in `(tabs)/` directory and register it in `(tabs)/_layout.tsx` with `Tabs.Screen`.

**Q: How do I add a modal/stack screen?**

Create a new directory outside `(tabs)/` and use `Stack.Screen` in `_layout.tsx` to configure it.

**Q: How do I navigate programmatically?**

```tsx
import { useRouter } from "expo-router";
const router = useRouter();
router.push("/viewer/file-id");
router.replace("/path");
router.back();
```

**Q: How do I access route params?**

```tsx
import { useLocalSearchParams } from "expo-router";
const { id } = useLocalSearchParams<{ id: string }>();
```

## Related Files

```
src/app/
|-- _layout.tsx           # Root layout with providers
|-- index.tsx             # Entry redirect
|-- [...missing].tsx      # 404 page
|-- (tabs)/
|   |-- _layout.tsx       # Tab navigator config (5 tabs)
|   |-- index.tsx         # Files tab
|   |-- gallery.tsx       # Gallery tab
|   |-- targets.tsx       # Targets tab
|   |-- sessions.tsx      # Sessions tab
|   |-- settings.tsx      # Settings tab
|   `-- __tests__/
|       `-- index.test.tsx
|-- viewer/
|   `-- [id].tsx          # FITS image viewer
|-- header/
|   `-- [id].tsx          # FITS header inspector
|-- editor/
|   `-- [id].tsx          # Image editor
|-- stacking/
|   `-- index.tsx         # Image stacking
|-- compose/
|   `-- index.tsx         # RGB compose
|-- convert/
|   |-- index.tsx         # Single file converter
|   `-- batch.tsx         # Batch converter
|-- album/
|   `-- [id].tsx          # Album detail
|-- target/
|   `-- [id].tsx          # Target detail
|-- session/
|   `-- [id].tsx          # Session detail
|-- map/
|   `-- index.tsx         # Map view
|-- backup/
|   `-- index.tsx         # Backup management
|-- astrometry/
|   |-- _layout.tsx       # Astrometry stack layout
|   |-- index.tsx         # Job list
|   `-- result/
|       `-- [id].tsx      # Job result
|-- compare/
|   `-- index.tsx         # Image comparison
`-- settings/
    |-- _layout.tsx       # Settings stack layout
    `-- (sub-screens)     # Various settings screens
```

## Changelog

| Date       | Changes                                         |
| ---------- | ----------------------------------------------- |
| 2026-02-14 | AI context documentation created                |
| 2026-02-14 | Updated for Cobalt FITS Viewer actual structure |
| 2026-02-15 | Added full route list, providers, and stores    |
