# React Native Quick Starter

> AI-friendly project documentation - Last updated: 2026-02-14

## Project Vision

A batteries-included React Native project template designed for rapid mobile app development with modern tooling, file-based routing, beautiful UI components, and utility-first styling.

## Architecture Overview

This is a single-module React Native application built with Expo SDK 54, featuring:

- **File-based routing** via Expo Router 6
- **Component library** via HeroUI Native
- **Styling** via Uniwind + TailwindCSS 4 with dark mode support
- **Animations** via React Native Reanimated
- **Internationalization** via i18n-js with auto-detection
- **Type safety** via TypeScript strict mode

## Module Structure

```mermaid
graph TD
    A["react-native-quick-starter"] --> B["src/"]
    B --> C["app/"]
    B --> D["i18n/"]
    B --> E["utils/"]
    C --> F["(tabs)/"]
    C --> G["_layout.tsx"]
    C --> H["index.tsx"]
    C -> I["[...missing].tsx"]
    D --> J["locales/"]
    D --> K["useI18n.ts"]
    F --> L["Home Tab"]
    F --> M["Explore Tab"]

    click C "./src/app/CLAUDE.md" "View app module docs"
    click D "./src/i18n/CLAUDE.md" "View i18n module docs"
    click E "./src/utils/CLAUDE.md" "View utils module docs"
```

## Module Index

| Path                               | Type      | Description                                                  | Tests |
| ---------------------------------- | --------- | ------------------------------------------------------------ | ----- |
| [src/app](./src/app/CLAUDE.md)     | Routing   | File-based routing with Expo Router, includes tab navigation | None  |
| [src/i18n](./src/i18n/CLAUDE.md)   | i18n      | Internationalization with i18n-js, supports en/zh locales    | None  |
| [src/utils](./src/utils/CLAUDE.md) | Utilities | Utility functions including className helper                 | None  |

## Run & Develop

### Prerequisites

- Node.js 20+
- pnpm (recommended)

### Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start

# Platform-specific
pnpm ios       # iOS simulator
pnpm android   # Android emulator
pnpm web       # Web browser

# Quality checks
pnpm lint          # ESLint
pnpm lint:fix      # ESLint with auto-fix
pnpm format        # Prettier format
pnpm format:check  # Prettier check
pnpm typecheck     # TypeScript check
```

### Project Structure

```
src/
|-- app/                  # File-based routes (Expo Router)
|   |-- _layout.tsx       # Root layout (Providers)
|   |-- index.tsx         # Entry redirect
|   |-- [...missing].tsx  # 404 page
|   `-- (tabs)/           # Tab navigation
|       |-- _layout.tsx   # Tab bar config
|       |-- index.tsx     # Home tab
|       `-- explore.tsx   # Explore tab
|-- i18n/
|   |-- index.ts          # i18n instance
|   |-- useI18n.ts        # React hook
|   `-- locales/          # Translation files
|-- utils/
|   `-- cn.ts             # className utility
|-- global.css            # TailwindCSS + Uniwind + HeroUI styles
`-- uniwind-types.d.ts    # Uniwind theme types
```

## Test Strategy

| Type        | Status         | Tools |
| ----------- | -------------- | ----- |
| Unit        | Not configured | -     |
| Integration | Not configured | -     |
| E2E         | Not configured | -     |

**Note:** Testing infrastructure is not yet set up. Consider adding Jest + React Native Testing Library.

## Coding Standards

### TypeScript

- Strict mode enabled (`strict: true`)
- No explicit `any` (warning)
- Unused vars prefixed with `_` are ignored

### Code Style (Prettier)

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

### Linting (ESLint)

- TypeScript ESLint recommended rules
- React Hooks rules enforced
- Prettier integration (no conflicting rules)

### EditorConfig

- UTF-8 encoding
- LF line endings
- 2-space indentation
- Final newline inserted

## Git Workflow

### Commit Convention (Conventional Commits)

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Example: `feat: add user authentication flow`

### Pre-commit Hooks (Husky + lint-staged)

- **pre-commit**: Runs ESLint fix + Prettier on staged `.ts/.tsx` files
- **commit-msg**: Validates commit message format via commitlint

### CI Pipeline (.github/workflows/ci.yml)

Triggers on push/PR to `main` branch:

1. **Type Check**: `pnpm typecheck`
2. **Lint & Format**: `pnpm lint` + `pnpm format:check`
3. **Build (Web)**: `pnpm exec expo export --platform web`

## AI Usage Guidelines

### When modifying this project

1. **Routing**: Add new screens in `src/app/` following Expo Router conventions
2. **Styling**: Use Uniwind classes via `className` prop, reference HeroUI Native components
3. **i18n**: Add translations to both `en.ts` and `zh.ts`, use `useI18n()` hook
4. **State**: For global state, consider adding Zustand or Jotai
5. **Types**: Keep types co-located or create `src/types/` if needed

### Common tasks

- **Add new screen**: Create file in `src/app/` with appropriate route pattern
- **Add new tab**: Add file in `src/app/(tabs)/` and update `_layout.tsx`
- **Add translation**: Add key to locale files, use `t("key.path")` in components
- **Style component**: Use Tailwind classes in `className` prop

### Dependencies overview

| Category   | Key Packages                                                            |
| ---------- | ----------------------------------------------------------------------- |
| Navigation | `expo-router`, `react-native-screens`, `react-native-safe-area-context` |
| UI         | `heroui-native`, `@expo/vector-icons`, `@gorhom/bottom-sheet`           |
| Styling    | `tailwindcss`, `uniwind`, `tailwind-merge`, `tailwind-variants`         |
| Animation  | `react-native-reanimated`, `react-native-gesture-handler`               |
| Storage    | `@react-native-async-storage/async-storage`, `expo-secure-store`        |
| i18n       | `i18n-js`, `expo-localization`                                          |
| Tooling    | `typescript`, `eslint`, `prettier`, `husky`, `commitlint`               |

## Changelog

| Date       | Version | Changes                                                                                       |
| ---------- | ------- | --------------------------------------------------------------------------------------------- |
| 2025-02-14 | 1.0.0   | Initial project setup with Expo SDK 54, Expo Router 6, HeroUI Native, TailwindCSS 4 + Uniwind |
| 2026-02-14 | -       | AI context documentation created                                                              |
