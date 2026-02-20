# Repository Guidelines

## Project Structure & Module Organization

- `src/app/`: Expo Router routes and layouts (for example `(tabs)/`, `viewer/[id].tsx`, `[...missing].tsx`).
- `src/components/`: Reusable UI by domain (`fits/`, `gallery/`, `targets/`, `sessions/`, `common/`).
- `src/hooks/`: Custom React hooks (`useX.ts`); `src/stores/`: Zustand stores (`useXStore.ts`).
- `src/lib/`: Core logic (FITS parsing, stacking, converter, gallery, targets, sessions, backup, etc.).
- `src/i18n/`: Localization setup and locale dictionaries; `assets/`: static images/icons.
- Tests are colocated in `__tests__/` folders. Utility scripts live in `scripts/`; E2E docs are in `docs/testing/`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies (Node 20 + pnpm required).
- `pnpm start`: start Expo dev server; use `pnpm ios`, `pnpm android`, or `pnpm web` for platform runs.
- `pnpm typecheck`: run TypeScript checks (`tsc --noEmit`).
- `pnpm lint` / `pnpm lint:fix`: run ESLint (or auto-fix).
- `pnpm format:check` / `pnpm format`: verify or apply Prettier formatting.
- `pnpm test` / `pnpm test:coverage`: run Jest tests and coverage output.
- `pnpm build`: export web build (`expo export --platform web`).
- `pnpm e2e:parity`, `pnpm e2e:android`: validate route-flow parity and run Maestro Android E2E.

## Coding Style & Naming Conventions

- Formatting is enforced by `.editorconfig` + Prettier: 2 spaces, LF, UTF-8, semicolons, double quotes, trailing commas, max width 100.
- Prefer TypeScript for new code and keep modules domain-focused.
- Naming: components `PascalCase.tsx`, hooks `useX.ts`, stores `useXStore.ts`, tests `*.test.ts`/`*.test.tsx`.
- Follow Expo Router file naming for dynamic and catch-all routes (`[id].tsx`, `[...slug].tsx`).

## Testing Guidelines

- Stack: `jest` + `jest-expo` + `@testing-library/react-native`.
- Place tests near the feature in `__tests__/`; cover behavior in hooks, stores, lib utilities, and route screens.
- Run before PR: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`.
- For route changes, also run `pnpm e2e:parity`; run Maestro flows for Android-facing navigation changes.

## Commit & Pull Request Guidelines

- Conventional Commits are enforced via Husky + Commitlint (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, etc.); optional scopes are used (example: `feat(app): add backup sheet`).
- Keep commits focused and passing local checks.
- PRs should include: clear summary, linked issue (if any), testing notes, and screenshots/video for UI changes.
- Update `README.md` or docs when behavior, scripts, routes, or public workflows change.

<!-- HEROUI-NATIVE-AGENTS-MD-START -->

[HeroUI Native Docs Index]|root: ./.heroui-docs/native|STOP. What you remember about HeroUI Native is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: heroui agents-md --native --output AGENTS.md|.:{components\(buttons)\button.mdx,components\(buttons)\close-button.mdx,components\(data-display)\chip.mdx,components\(feedback)\alert.mdx,components\(feedback)\skeleton-group.mdx,components\(feedback)\skeleton.mdx,components\(feedback)\spinner.mdx,components\(forms)\checkbox.mdx,components\(forms)\control-field.mdx,components\(forms)\description.mdx,components\(forms)\field-error.mdx,components\(forms)\input-otp.mdx,components\(forms)\input.mdx,components\(forms)\label.mdx,components\(forms)\radio-group.mdx,components\(forms)\select.mdx,components\(forms)\switch.mdx,components\(forms)\text-area.mdx,components\(forms)\text-field.mdx,components\(layout)\card.mdx,components\(layout)\separator.mdx,components\(layout)\surface.mdx,components\(media)\avatar.mdx,components\(navigation)\accordion.mdx,components\(navigation)\tabs.mdx,components\(overlays)\bottom-sheet.mdx,components\(overlays)\dialog.mdx,components\(overlays)\popover.mdx,components\(overlays)\toast.mdx,components\(utilities)\pressable-feedback.mdx,components\(utilities)\scroll-shadow.mdx,components\index.mdx,getting-started\(handbook)\animation.mdx,getting-started\(handbook)\colors.mdx,getting-started\(handbook)\composition.mdx,getting-started\(handbook)\portal.mdx,getting-started\(handbook)\provider.mdx,getting-started\(handbook)\styling.mdx,getting-started\(handbook)\theming.mdx,getting-started\(overview)\design-principles.mdx,getting-started\(overview)\quick-start.mdx,getting-started\(ui-for-agents)\agent-skills.mdx,getting-started\(ui-for-agents)\agents-md.mdx,getting-started\(ui-for-agents)\llms-txt.mdx,getting-started\(ui-for-agents)\mcp-server.mdx,getting-started\index.mdx,releases\beta-10.mdx,releases\beta-11.mdx,releases\beta-12.mdx,releases\beta-13.mdx,releases\index.mdx,releases\rc-1.mdx}

<!-- HEROUI-NATIVE-AGENTS-MD-END -->
