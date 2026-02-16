[Root](../../CLAUDE.md) > [src](..) > **i18n**

# i18n Module (Internationalization)

> Internationalization with i18n-js and expo-localization

## Module Responsibility

This module provides internationalization support for the application:

- Auto-detects device language
- Provides `useI18n` hook for reactive translations
- Supports English (en) and Chinese (zh) locales
- Allows runtime locale switching
- Comprehensive translation keys for all features

## Entry & Startup

| File       | Purpose                                                    |
| ---------- | ---------------------------------------------------------- |
| `index.ts` | Creates and configures i18n instance with locale detection |

**Initialization:**

```typescript
import i18n from "./i18n"; // Auto-configures based on device locale
```

## Public Interfaces

### `useI18n()` Hook

```typescript
const { t, locale, setLocale } = useI18n();

// Translate text
t("home.title"); // -> "Quick Starter"

// Get current locale
locale; // -> "en" | "zh"

// Change locale
setLocale("zh");
```

### Available Locales

| Code | Language             | File            |
| ---- | -------------------- | --------------- |
| `en` | English              | `locales/en.ts` |
| `zh` | Chinese (Simplified) | `locales/zh.ts` |

### Translation Keys Structure

```
common.*                  # Shared strings (cancel, confirm, delete, save, etc.)
tabs.*                    # Tab labels (files, gallery, targets, sessions, settings)
files.*                   # FITS file manager (import, sort, search, batch ops)
gallery.*                 # Gallery (views, albums, filters, batch export)
targets.*                 # Observation targets (types, status, filters, coordinates)
sessions.*                # Observation sessions (calendar, timeline, log, stats)
viewer.*                  # FITS viewer (stretch, colormap, histogram, pixel info)
header.*                  # FITS header inspector
editor.*                  # Image editor (crop, rotate, calibration, stacking)
converter.*               # Format converter (formats, presets, batch)
settings.*                # App settings (viewer, gallery, export, display, storage)
album.*                   # Album management
systemInfo.*              # System info display
logs.*                    # App logs
share.*                   # Sharing
location.*                # Location & map
splash.*                  # Splash screen (appName, tagline)
notFound.*                # 404 page
onboarding.*              # Onboarding screens
astrometry.*              # Plate solving features
backup.*                  # Cloud backup features
compare.*                 # Image comparison
```

### Sample Translation Keys

```typescript
// From locales/en.ts
{
  common: {
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    save: "Save",
    edit: "Edit",
    close: "Close",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    // ... more common keys
  },
  tabs: {
    files: "Files",
    gallery: "Gallery",
    targets: "Targets",
    sessions: "Sessions",
    settings: "Settings",
  },
  viewer: {
    stretch: "Stretch",
    colormap: "Colormap",
    histogram: "Histogram",
    blackPoint: "Black Point",
    whitePoint: "White Point",
    gamma: "Gamma",
    // ... more viewer keys
  },
  // ... more namespaces
}
```

## Key Dependencies

| Package             | Usage                                         |
| ------------------- | --------------------------------------------- |
| `i18n-js`           | Core i18n library with translation management |
| `expo-localization` | Device locale detection via `getLocales()`    |

## Data Models

Translation files are typed as `const` objects with nested structure:

```typescript
// locales/en.ts structure
export default {
  common: {
    /* ... */
  },
  tabs: {
    /* ... */
  },
  files: {
    /* ... */
  },
  gallery: {
    /* ... */
  },
  targets: {
    /* ... */
  },
  sessions: {
    /* ... */
  },
  viewer: {
    /* ... */
  },
  header: {
    /* ... */
  },
  editor: {
    /* ... */
  },
  converter: {
    /* ... */
  },
  settings: {
    /* ... */
  },
  // ... more namespaces
} as const;
```

## Testing & Quality

| Aspect      | Status                             | Files                               |
| ----------- | ---------------------------------- | ----------------------------------- |
| Unit Tests  | Configured                         | `__tests__/useI18n.test.ts`         |
|             |                                    | `__tests__/orientationI18n.test.ts` |
| Type Safety | `as const` for translation objects | -                                   |

## FAQ

**Q: How do I add a new translation key?**

1. Add key to `locales/en.ts`
2. Add corresponding translation to `locales/zh.ts`
3. Use in component: `t("your.new.key")`

**Q: How do I add a new language?**

1. Create `locales/<lang>.ts` with same structure as existing locales
2. Export in `locales/index.ts`
3. Import and add to i18n config in `index.ts`
4. Update the `locales` object with the new translations

**Q: Why use `useSyncExternalStore`?**

This ensures React re-renders when locale changes, making translations reactive without external state management.

**Q: How do I handle pluralization?**

```typescript
// In locale file
{
  files: {
    count_one: "{{count}} file",
    count_other: "{{count}} files",
  }
}

// In component
t("files.count", { count: 5 });
```

## Related Files

```
src/i18n/
|-- index.ts           # i18n instance configuration
|-- useI18n.ts         # React hook for translations
|-- locales/
|   |-- index.ts       # Locale exports
|   |-- en.ts          # English translations (comprehensive)
|   `-- zh.ts          # Chinese translations (comprehensive)
`-- __tests__/
    |-- useI18n.test.ts
    `-- orientationI18n.test.ts
```

## Changelog

| Date       | Changes                                     |
| ---------- | ------------------------------------------- |
| 2026-02-14 | AI context documentation created            |
| 2026-02-15 | Updated with comprehensive translation keys |
