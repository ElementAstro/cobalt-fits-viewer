# Suggested Commands for Cobalt FITS Viewer

## Development Commands

```bash
# Start development server
pnpm start

# Platform-specific development
pnpm ios        # iOS simulator
pnpm android    # Android emulator
pnpm web        # Web browser
```

## Quality Checks

```bash
# Linting
pnpm lint           # Run ESLint
pnpm lint:fix       # Run ESLint with auto-fix

# Formatting
pnpm format         # Format with Prettier
pnpm format:check   # Check formatting

# Type checking
pnpm typecheck      # TypeScript check

# Testing
pnpm test           # Run Jest tests
pnpm test:watch     # Watch mode
pnpm test:coverage  # Run with coverage
```

## Git Commands (Windows)

```bash
git status
git add .
git commit -m "type: message"
git push
git pull
```

## System Commands (Windows)

```bash
dir                 # List directory (like ls)
type <file>         # View file content (like cat)
findstr <pattern>   # Search in files (like grep)
cd <path>           # Change directory
```

## Package Management

```bash
pnpm install        # Install dependencies
pnpm add <package>  # Add new dependency
pnpm add -D <pkg>   # Add dev dependency
```
