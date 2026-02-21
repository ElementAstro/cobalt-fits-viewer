# Maestro E2E (Android)

## Scope

- Route-level E2E for all non-layout route files under `src/app`.
- One Maestro flow per route file in `.maestro/flows/pages` (34 flows).
- Cross-route user journey flows in `.maestro/flows/journeys` (5 flows).
- Common reusable subflows in `.maestro/flows/common`.
- Aggregated suite in `.maestro/suites/all-pages.yaml`.

## Prerequisites

- Expo account with EAS configured for this project.
- Android emulator/device available for local runs.
- Maestro CLI installed (`maestro --version`).

## Environment

- E2E mode is enabled with `EXPO_PUBLIC_E2E=1`.
- In E2E mode:
  - onboarding is skipped
  - deterministic seed data is injected (`src/e2e/seed/fullScenario.ts`)
  - `e2e-bootstrap-ready` sentinel is rendered

## Commands

- `pnpm e2e:parity`: validates route-to-flow 1:1 mapping.
- `pnpm e2e:android`: runs local Maestro suite.
- `pnpm e2e:android:ci`: CI-oriented Maestro output (JUnit).

## File Structure

```
.maestro/
├── flows/
│   ├── common/           # Reusable subflows
│   │   ├── bootstrap.yaml
│   │   ├── navigate-to-gallery.yaml
│   │   └── navigate-to-settings.yaml
│   ├── journeys/         # Cross-route user journey flows
│   │   ├── edit-workflow.yaml
│   │   ├── gallery-to-viewer.yaml
│   │   ├── session-workflow.yaml
│   │   ├── settings-navigation.yaml
│   │   └── target-workflow.yaml
│   └── pages/            # Per-route page flows (34 files)
│       ├── root__index.yaml
│       ├── tabs__*.yaml
│       └── ...
└── suites/
    └── all-pages.yaml    # Aggregated suite
```

## File Naming Rule

- Route `src/app/index.tsx` -> `root__index.yaml`
- Route `src/app/(tabs)/gallery.tsx` -> `tabs__gallery.yaml`
- Route `src/app/astrometry/result/[id].tsx` -> `astrometry__result__param_id.yaml`
- Route `src/app/[...missing].tsx` -> `notfound__splat_missing.yaml`

## testID Convention

All testIDs follow the `e2e-` prefix convention:

- `e2e-screen-{route}` — root View of each screen (e.g. `e2e-screen-tabs__gallery`)
- `e2e-action-{route}-{action}` — interactive elements (e.g. `e2e-action-tabs__gallery-open-map`)
- `e2e-text-{route}-{name}` — text content assertions (e.g. `e2e-text-editor__param_id-star-counts`)

## Flow Writing Guidelines

Each page flow should:

1. **Bootstrap**: `runFlow: ../common/bootstrap.yaml`
2. **Navigate**: `openLink: cobalt://{route}`
3. **Assert screen**: `assertVisible: { id: e2e-screen-{route} }`
4. **Assert seed data**: Verify key content from seed data is visible (filenames, target names, etc.)
5. **Assert controls**: Verify key UI elements exist before interacting
6. **Interact & verify**: Tap buttons and assert the resulting UI changes
7. **Back navigation**: Verify back navigation returns to expected screen
8. **Screenshots**: Use `takeScreenshot` for key screens (gallery, viewer, editor, map)

## CI

- EAS workflow: `.eas/workflows/e2e-android.yml`
- Trigger: pull request
- Steps:
  1. build Android APK using profile `e2e-test`
  2. run Maestro suite `.maestro/suites/all-pages.yaml`

## Troubleshooting

- If app is stuck before first screen, verify `e2e-bootstrap-ready` appears.
- If parity fails after route changes, add/remove corresponding flow file.
- If selectors are flaky, prioritize `testID`-based assertions and actions.
- Use `extendedWaitUntil` with timeout for async operations (star detection, batch conversion).
