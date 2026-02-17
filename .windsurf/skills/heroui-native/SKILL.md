---
name: heroui-native
description: "HeroUI Native component library skill for React Native + Uniwind. Use when implementing or reviewing HeroUI Native components, fetching Native component/docs/theme references, validating Native-only patterns, or setting up theming and provider integration. Keywords: HeroUI Native, heroui-native, React Native UI, Uniwind, native docs, component API."
---

# HeroUI Native Development Guide

Use this skill for HeroUI Native only. Do not apply HeroUI React (web) assumptions.

## Core Rules

- Use `heroui-native`, not `@heroui/react`.
- Use React Native interaction props (`onPress`), not web props (`onClick`).
- Prefer semantic variants (`primary`, `secondary`, `tertiary`, `danger`, etc.).
- Follow compound component anatomy from docs (`Card.Header`, `Button.Label`, etc.).
- Fetch docs before implementation when behavior is uncertain.

## Scripts (Single Source of Truth)

Run from this skill directory:

```bash
node scripts/list_components.mjs
node scripts/get_component_docs.mjs Button
node scripts/get_docs.mjs /docs/native/getting-started/theming
node scripts/get_theme.mjs
```

### Shared CLI Options

All scripts support:

```bash
--format <text|json>   # default: text
--json                 # alias of --format json
--timeout <ms>         # default: 30000
--api-base <url>       # override API base
--fallback <auto|never|only>  # default: auto
--verbose
```

### Output Contract

- `text` mode: human-readable output to `stdout`; diagnostics to `stderr`.
- `json` mode: machine envelope to `stdout`:
  - `ok`: boolean
  - `source`: `api` or `fallback`
  - `data`: payload
  - `error` (only on failure): `{ code, message, detail? }`
  - `meta`: extra metadata

### Recommended Script Workflow

1. Discover valid components:

```bash
node scripts/list_components.mjs --json
```

2. Fetch one or more component docs:

```bash
node scripts/get_component_docs.mjs Button Card --json
```

3. Fetch non-component handbook/release docs:

```bash
node scripts/get_docs.mjs /docs/native/getting-started/styling --json
```

4. Fetch theme tokens:

```bash
node scripts/get_theme.mjs --json
```

### Maintenance Checks (for this skill repo copy)

```bash
pnpm run skill:heroui:validate
pnpm run skill:heroui:test
pnpm run skill:heroui:check
```

## Native Installation Essentials

HeroUI Native (RC/Beta stream) requires peer dependencies and provider wiring.

```bash
npm i heroui-native uniwind tailwindcss
npm i react-native-reanimated react-native-gesture-handler react-native-safe-area-context @gorhom/bottom-sheet react-native-svg react-native-worklets tailwind-merge tailwind-variants
```

`global.css` baseline:

```css
@import "tailwindcss";
@import "uniwind";
@import "heroui-native/styles";

@source "./node_modules/heroui-native/lib";
```

Root layout baseline:

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HeroUINativeProvider } from "heroui-native";
import "./global.css";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>{/* app */}</HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
```

## Theming Guidance

HeroUI Native theme tokens in current docs are primarily OKLCH-based, while custom overrides may still use HSL/OKLCH depending on project setup.

- Prefer semantic variables (`--accent`, `--accent-foreground`, etc.).
- Keep light/dark token sets aligned.
- Use `node scripts/get_theme.mjs --json` for current token inspection.

Programmatic theme color access:

```tsx
import { useThemeColor } from "heroui-native";

const accent = useThemeColor("accent");
```

Theme switching with Uniwind:

```tsx
import { Uniwind, useUniwind } from "uniwind";

const { theme } = useUniwind();
Uniwind.setTheme(theme === "light" ? "dark" : "light");
```

## Native-Only Safety Checks

Before finalizing implementation:

- Verify API/anatomy from Native docs.
- Confirm no web-only props or CSS assumptions are introduced.
- Confirm component variants and accessibility props come from Native API.
- Confirm output compiles under React Native + Uniwind conventions.
