# Coding Conventions Reference

This document provides a high-level summary of coding conventions for the Cobalt FITS Viewer project.

## 1. Core Summary

The project follows strict TypeScript practices with ESLint and Prettier enforcement. Key conventions include strict type checking, React Hooks rules, and consistent code formatting.

## 2. Source of Truth

### TypeScript Configuration

- **Primary Config:** `tsconfig.json` - Extends `expo/tsconfig.base` with `strict: true` enabled
- **Type Safety:** Explicit `any` is discouraged (generates warning)

### ESLint Configuration

- **Primary Config:** `eslint.config.mjs`
- **Key Rules:**
  - React Hooks rules enforced (`react-hooks/rules-of-hooks: error`)
  - Exhaustive deps warning (`react-hooks/exhaustive-deps: warn`)
  - Unused vars allowed with `_` prefix (`@typescript-eslint/no-unused-vars`)
  - No explicit `any` allowed (`@typescript-eslint/no-explicit-any: warn`)

### Prettier Configuration

- **Primary Config:** `.prettierrc`
- **Key Settings:**
  - Semicolons required: `true`
  - Single quotes: `false` (double quotes)
  - Tab width: `2`
  - Trailing commas: `all`
  - Print width: `100`
  - Line endings: `lf`
  - Arrow function parens: `always`

### EditorConfig

- **Primary Config:** `.editorconfig`
- **Key Settings:**
  - Charset: `utf-8`
  - End of line: `lf`
  - Indent size: `2`
  - Indent style: `space`
  - Insert final newline: `true`
  - Trim trailing whitespace: `true` (except markdown)

## 3. Key Conventions Summary

| Category         | Convention             |
| ---------------- | ---------------------- |
| Quotes           | Double quotes          |
| Semicolons       | Required               |
| Indentation      | 2 spaces               |
| Line endings     | LF (Unix)              |
| Trailing commas  | All                    |
| TypeScript       | Strict mode enabled    |
| Unused variables | Prefix with `_`        |
| React Hooks      | Rules enforced (error) |

## 4. Related Documentation

- **Project Overview:** `/llmdoc/overview/project-overview.md`
- **Data Models:** `/llmdoc/reference/data-models.md`
- **Git Workflow:** Refer to `CLAUDE.md` section on "Git Workflow"
