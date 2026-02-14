[Root](../../CLAUDE.md) > [src](..) > **app**

# App Module (Routing)

> File-based routing with Expo Router 6

## Module Responsibility

This module handles all application routing using Expo Router's file-based convention. It includes:

- Root layout with global providers
- Tab navigation (Files, Gallery, Targets, Sessions, Settings)
- Detail screens (viewer, editor, stacking, converter, etc.)
- 404 fallback handling
- Entry point redirection

## Entry & Startup

| File          | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `_layout.tsx` | Root layout wrapping app with GestureHandlerRootView and HeroUINativeProvider |
| `index.tsx`   | Entry point, redirects to `/(tabs)` route                                     |

**Startup Flow:**

```
index.tsx (redirect) -> (tabs)/_layout.tsx -> (tabs)/index.tsx (Files)
```

## Public Interfaces

### Routes

| Route              | Component             | Description                    |
| ------------------ | --------------------- | ------------------------------ |
| `/`                | `index.tsx`           | Redirects to `/(tabs)`         |
| `/(tabs)`          | `(tabs)/_layout.tsx`  | Tab navigator (5 tabs)         |
| `/(tabs)/`         | `(tabs)/index.tsx`    | Files screen (FITS manager)    |
| `/(tabs)/gallery`  | `(tabs)/gallery.tsx`  | Gallery screen (image browser) |
| `/(tabs)/targets`  | `(tabs)/targets.tsx`  | Targets screen                 |
| `/(tabs)/sessions` | `(tabs)/sessions.tsx` | Sessions screen                |
| `/(tabs)/settings` | `(tabs)/settings.tsx` | Settings screen                |
| `/viewer/[id]`     | `viewer/[id].tsx`     | FITS image viewer              |
| `/header/[id]`     | `header/[id].tsx`     | FITS header inspector          |
| `/editor/[id]`     | `editor/[id].tsx`     | Image editor                   |
| `/stacking`        | `stacking/index.tsx`  | Image stacking                 |
| `/compose`         | `compose/index.tsx`   | RGB compose                    |
| `/convert/[id]`    | `convert/[id].tsx`    | Format converter               |
| `/album/[id]`      | `album/[id].tsx`      | Album detail                   |
| `/target/[id]`     | `target/[id].tsx`     | Target detail                  |
| `/session/[id]`    | `session/[id].tsx`    | Session detail                 |
| `/map`             | `map/index.tsx`       | Map view                       |
| `/*`               | `[...missing].tsx`    | 404 fallback                   |

### Providers (Root Layout)

```tsx
<GestureHandlerRootView>
  <HeroUINativeProvider>
    <Stack />
  </HeroUINativeProvider>
</GestureHandlerRootView>
```

## Key Dependencies

| Package                        | Usage                                                |
| ------------------------------ | ---------------------------------------------------- |
| `expo-router`                  | File-based routing, Stack, Tabs, useRouter, Redirect |
| `react-native-gesture-handler` | GestureHandlerRootView for bottom sheet support      |
| `heroui-native`                | HeroUINativeProvider, UI components, useThemeColor   |
| `@expo/vector-icons`           | Ionicons for tab icons                               |

## Data Models

Components consume data from Zustand stores:

- `useFitsStore` — FITS file list, selection, search, sort
- `useGalleryStore` — Gallery view mode, filters
- `useViewerStore` — Viewer state (stretch, colormap, etc.)
- `useTargetStore` — Observation targets
- `useSessionStore` — Observation sessions
- `useSettingsStore` — App settings
- `useAlbumStore` — Albums
- `useConverterStore` — Converter settings
- `useLogStore` — App logs

## Testing & Quality

| Aspect     | Status         |
| ---------- | -------------- |
| Unit Tests | Partial        |
| E2E Tests  | Not configured |

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

## Related Files

```
src/app/
|-- _layout.tsx           # Root layout
|-- index.tsx             # Entry redirect
|-- [...missing].tsx      # 404 page
|-- (tabs)/
|   |-- _layout.tsx       # Tab navigator config (5 tabs)
|   |-- index.tsx         # Files tab
|   |-- gallery.tsx       # Gallery tab
|   |-- targets.tsx       # Targets tab
|   |-- sessions.tsx      # Sessions tab
|   `-- settings.tsx      # Settings tab
|-- viewer/               # FITS image viewer
|-- header/               # FITS header inspector
|-- editor/               # Image editor
|-- stacking/             # Image stacking
|-- compose/              # RGB compose
|-- convert/              # Format converter
|-- album/                # Album detail
|-- target/               # Target detail
|-- session/              # Session detail
`-- map/                  # Map view
```

## Changelog

| Date       | Changes                                         |
| ---------- | ----------------------------------------------- |
| 2026-02-14 | AI context documentation created                |
| 2026-02-14 | Updated for Cobalt FITS Viewer actual structure |
