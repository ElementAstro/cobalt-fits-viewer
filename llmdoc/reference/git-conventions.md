# Git Conventions

## 1. Commit Message Format

The project uses Conventional Commits specification enforced via commitlint.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Allowed Types

| Type       | Description                         |
| ---------- | ----------------------------------- |
| `feat`     | New feature                         |
| `fix`      | Bug fix                             |
| `docs`     | Documentation only                  |
| `style`    | Code style (formatting, semicolons) |
| `refactor` | Code refactoring                    |
| `perf`     | Performance improvement             |
| `test`     | Adding/updating tests               |
| `build`    | Build system or dependencies        |
| `ci`       | CI configuration                    |
| `chore`    | Maintenance tasks                   |
| `revert`   | Revert previous commit              |

### Examples

```
feat(fits): add histogram stretch algorithm
fix(viewer): resolve zoom controls not responding
refactor(stores): extract session persistence logic
docs: update API changelog
test: add unit tests for pixel math utilities
```

### Notes

- Subject is lowercase (subject-case rule is disabled)
- Use imperative mood: "add" not "added" or "adds"
- No period at end of subject
- Reference issues in footer: `Closes #123`

## 2. Pre-commit Hooks

### Husky Configuration

Located in `.husky/`:

- `pre-commit`: Runs lint-staged on staged files
- `commit-msg`: Validates commit message format

### Lint-staged Rules

Defined in `.lintstagedrc`:

- `.ts/.tsx`: ESLint fix + Prettier write
- `.json/.md/.yml/.yaml`: Prettier write only

### Workflow

1. Developer creates commit
2. `pre-commit` hook runs ESLint + Prettier on staged files
3. If passes, `commit-msg` hook validates message format
4. Commit succeeds or fails with helpful error

## 3. Branch Strategy

### Main Branch

- **master**: Production-ready code, protected branch

### Development Flow

```
feature branch -> pull request -> master (via CI)
```

### CI Triggers

- Push to `master`
- Pull request targeting `master`

## 4. CI Pipeline

Defined in `.github/workflows/ci.yml`:

### Jobs (Sequential)

1. **Type Check**: `pnpm typecheck`
2. **Lint & Format**: `pnpm lint` + `pnpm format:check`
3. **Test**: `pnpm jest --ci --coverage`
4. **Build (Web)**: `pnpm exec expo export --platform web`

### Concurrency

- Cancels in-progress runs for same ref
- Uses pnpm with frozen lockfile

## 5. Source of Truth

- **Commitlint config**: `commitlint.config.js`
- **Lint-staged config**: `.lintstagedrc`
- **Husky hooks**: `.husky/`
- **CI workflow**: `.github/workflows/ci.yml`
- **Package manager**: pnpm (v10.28.1)
- **Node version**: 20
