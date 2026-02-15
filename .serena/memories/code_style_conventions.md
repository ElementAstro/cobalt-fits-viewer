# Code Style and Conventions

## TypeScript

- Strict mode enabled (`strict: true`)
- No explicit `any` (warning level)
- Unused vars prefixed with `_` are ignored
- React imports not required in JSX scope

## Prettier Configuration

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

## EditorConfig

- UTF-8 encoding
- LF line endings
- 2-space indentation
- Final newline inserted

## Naming Conventions

- Components: PascalCase (e.g., `FitsViewer.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useFitsStore.ts`)
- Stores: camelCase with `use` prefix (e.g., `useFitsStore.ts`)
- Utilities: camelCase
- Types: PascalCase

## File Organization

- Types co-located in `src/lib/*/types.ts`
- Components organized by feature (fits, gallery, sessions, etc.)
- Hooks for each major feature
- Zustand stores for state management

## Styling

- Use Uniwind classes via `className` prop
- Reference HeroUI Native components
- Dark mode support included

## Internationalization

- Add translations to both `en.ts` and `zh.ts`
- Use `useI18n()` hook in components
- Access via `t("key.path")`

## Commit Convention

Format: `type: description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Example: `feat: add sigma clipping stacking algorithm`
