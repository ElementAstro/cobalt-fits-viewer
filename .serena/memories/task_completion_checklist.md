# Task Completion Checklist

When completing a task, run the following checks:

## 1. Code Quality

```bash
pnpm lint           # Check for linting errors
pnpm lint:fix       # Auto-fix linting issues
```

## 2. Code Formatting

```bash
pnpm format:check   # Check formatting
pnpm format         # Auto-format code
```

## 3. Type Checking

```bash
pnpm typecheck      # TypeScript check
```

## 4. Testing

```bash
pnpm test           # Run tests
```

## 5. Commit

- Ensure commit message follows Conventional Commits format
- Pre-commit hooks will auto-run lint and format on staged files

## Common Task-Specific Checks

### Adding new screen

1. Create file in `src/app/` following Expo Router conventions
2. Add translations to both `en.ts` and `zh.ts`

### Adding new component

1. Place in appropriate `src/components/` subfolder
2. Use Uniwind classes for styling
3. Use i18n for any user-facing text

### Adding new store

1. Create in `src/stores/`
2. Follow Zustand patterns from existing stores

### Adding business logic

1. Place in `src/lib/` with clear module boundaries
2. Keep types in `types.ts` within the module
