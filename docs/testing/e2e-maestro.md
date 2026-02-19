# Maestro E2E (Android)

## Scope

- Route-level E2E for all non-layout route files under `src/app`.
- One Maestro flow per route file in `.maestro/flows/pages`.
- Aggregated suite in `.maestro/suites/all-pages.yaml`.

## Prerequisites

- Expo account with EAS configured for this project.
- Android emulator/device available for local runs.
- Maestro CLI installed (`maestro --version`).

## Environment

- E2E mode is enabled with `EXPO_PUBLIC_E2E=1`.
- In E2E mode:
  - onboarding is skipped
  - deterministic seed data is injected
  - `e2e-bootstrap-ready` sentinel is rendered

## Commands

- `pnpm e2e:parity`: validates route-to-flow 1:1 mapping.
- `pnpm e2e:android`: runs local Maestro suite.
- `pnpm e2e:android:ci`: CI-oriented Maestro output (JUnit).

## File Naming Rule

- Route `src/app/index.tsx` -> `root__index.yaml`
- Route `src/app/(tabs)/gallery.tsx` -> `tabs__gallery.yaml`
- Route `src/app/astrometry/result/[id].tsx` -> `astrometry__result__param_id.yaml`
- Route `src/app/[...missing].tsx` -> `notfound__splat_missing.yaml`

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
