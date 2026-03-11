## 1. Plan Utility Layer

- [x] 1.1 Add plan overlap detection helpers in `src/lib/sessions/planUtils.ts` (time-range overlap, conflict list, excluding cancelled/self plan).
- [x] 1.2 Add plan duplication/rollover helpers in `src/lib/sessions/planUtils.ts` to clone core fields and shift schedule by one day.
- [x] 1.3 Extend `src/lib/sessions/__tests__/planUtils.test.ts` to cover overlap detection, no-conflict cases, and rollover schedule behavior.

## 2. Plan Editor Workflow

- [x] 2.1 Update `src/components/sessions/PlanObservationSheet.tsx` to support faster schedule adjustment (day shift + duration presets) while retaining manual controls.
- [x] 2.2 Integrate conflict check in plan save flow and add explicit confirmation dialog before saving overlapping plans.
- [x] 2.3 Add i18n keys for new plan editor labels/messages in session locale files and keep key coverage tests passing.

## 3. Plan Actions And List Signals

- [x] 3.1 Extend `src/components/sessions/PlanActionSheet.tsx` with duplicate and rollover actions.
- [x] 3.2 Wire duplicate/rollover handlers in `src/app/(tabs)/sessions.tsx` using existing `createObservationPlan` flow.
- [x] 3.3 Update `src/components/sessions/PlanCard.tsx` (and related list plumbing) to show conflict indicators for overlapping plans.

## 4. Plan-To-Session Conversion Safety

- [x] 4.1 Add duplicate conversion detection in `src/app/(tabs)/sessions.tsx` by checking existing sessions derived from the same plan id.
- [x] 4.2 Add confirmation prompt before creating another session for an already converted plan.
- [x] 4.3 Keep successful conversion behavior consistent by setting plan status to `completed` after session creation.

## 5. Regression Coverage And Validation

- [x] 5.1 Add/extend component tests for plan editor conflict prompt, action-sheet duplicate/rollover options, and plan-card conflict indicator.
- [x] 5.2 Update sessions screen tests for conversion duplicate-guard flow.
- [x] 5.3 Run `pnpm typecheck && pnpm lint && pnpm test` and fix any regressions introduced by the change.
