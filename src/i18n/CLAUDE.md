[Root](../../CLAUDE.md) > [src](..) > **i18n**

# i18n Module (Internationalization)

> Internationalization with i18n-js and expo-localization

## Module Responsibility

This module provides internationalization support for the application:

- Auto-detects device language
- Provides `useI18n` hook for reactive translations
- Supports English (en) and Chinese (zh) locales
- Allows runtime locale switching

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
common.goHome
tabs.home / tabs.explore
home.title / home.subtitle / home.readyToBuild / ...
explore.title / explore.subtitle / explore.features.* / ...
notFound.title / notFound.description
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
{
  common: { goHome: string };
  tabs: { home: string; explore: string };
  home: { title: string; subtitle: string; ... };
  explore: { title: string; features: { ... } };
  notFound: { title: string; description: string };
}
```

## Testing & Quality

| Aspect      | Status                             |
| ----------- | ---------------------------------- |
| Unit Tests  | Not configured                     |
| Type Safety | `as const` for translation objects |

## FAQ

**Q: How do I add a new translation key?**

1. Add key to `locales/en.ts`
2. Add corresponding translation to `locales/zh.ts`
3. Use in component: `t("your.new.key")`

**Q: How do I add a new language?**

1. Create `locales/<lang>.ts` with same structure
2. Export in `locales/index.ts`
3. Import and add to i18n config in `index.ts`

**Q: Why use `useSyncExternalStore`?**

This ensures React re-renders when locale changes, making translations reactive without external state management.

## Related Files

```
src/i18n/
|-- index.ts           # i18n instance configuration
|-- useI18n.ts         # React hook for translations
`-- locales/
    |-- index.ts       # Locale exports
    |-- en.ts          # English translations
    `-- zh.ts          # Chinese translations
```

## Changelog

| Date       | Changes                          |
| ---------- | -------------------------------- |
| 2026-02-14 | AI context documentation created |
