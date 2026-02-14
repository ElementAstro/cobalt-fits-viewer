[Root](../../CLAUDE.md) > [src](..) > **app**

# App Module (Routing)

> File-based routing with Expo Router 6

## Module Responsibility

This module handles all application routing using Expo Router's file-based convention. It includes:

- Root layout with global providers
- Tab navigation (Home, Explore)
- 404 fallback handling
- Entry point redirection

## Entry & Startup

| File          | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `_layout.tsx` | Root layout wrapping app with GestureHandlerRootView and HeroUINativeProvider |
| `index.tsx`   | Entry point, redirects to `/(tabs)` route                                     |

**Startup Flow:**

```
index.tsx (redirect) -> (tabs)/_layout.tsx -> (tabs)/index.tsx (Home)
```

## Public Interfaces

### Routes

| Route             | Component            | Description            |
| ----------------- | -------------------- | ---------------------- |
| `/`               | `index.tsx`          | Redirects to `/(tabs)` |
| `/(tabs)`         | `(tabs)/_layout.tsx` | Tab navigator          |
| `/(tabs)/`        | `(tabs)/index.tsx`   | Home screen            |
| `/(tabs)/explore` | `(tabs)/explore.tsx` | Explore screen         |
| `/*`              | `[...missing].tsx`   | 404 fallback           |

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

No data models in this module. Components use:

- Local state (none currently)
- Theme colors via `useThemeColor` hook
- i18n via `useI18n` hook from `../i18n`

## Testing & Quality

| Aspect     | Status         |
| ---------- | -------------- |
| Unit Tests | Not configured |
| E2E Tests  | Not configured |

## FAQ

**Q: How do I add a new tab?**

Add a new `.tsx` file in `(tabs)/` directory and register it in `(tabs)/_layout.tsx` with `Tabs.Screen`.

**Q: How do I add a modal/stack screen?**

Create a new file outside `(tabs)/` and use `Stack.Screen` in `_layout.tsx` to configure it.

**Q: How do I navigate programmatically?**

```tsx
import { useRouter } from "expo-router";
const router = useRouter();
router.push("/path");
router.replace("/path");
router.back();
```

## Related Files

```
src/app/
|-- _layout.tsx           # Root layout
|-- index.tsx             # Entry redirect
|-- [...missing].tsx      # 404 page
`-- (tabs)/
    |-- _layout.tsx       # Tab navigator config
    |-- index.tsx         # Home screen
    `-- explore.tsx       # Explore screen
```

## Changelog

| Date       | Changes                          |
| ---------- | -------------------------------- |
| 2026-02-14 | AI context documentation created |
