## 1. Plan Utility Layer

- [x] 1.1 Extend `src/lib/sessions/planUtils.ts` with overdue/maintenance-queue helpers, queue-aware filtering, and batch reschedule/conflict-preview helpers without changing `ObservationPlan`.
- [x] 1.2 Update `src/lib/sessions/__tests__/planUtils.test.ts` to cover overdue detection, maintenance filters, fixed day-offset rescheduling, and batch conflict warning inputs.

## 2. Calendar Batch Maintenance

- [x] 2.1 Add plan batch sync/unsync summary helpers in `src/hooks/sessions/useCalendar.ts`, reusing existing permission, haptic, and calendar event handling paths.
- [x] 2.2 Extend `src/hooks/sessions/__tests__/useCalendar.test.ts` to cover plan batch sync/unsync success, skip, and partial-failure summaries.

## 3. Plan Maintenance Workflow UI

- [x] 3.1 Update `src/app/(tabs)/sessions.tsx` to add plan selection mode, maintenance queue filters, batch action handlers, conflict-confirmed batch reschedule flow, and summary dialog reporting.
- [x] 3.2 Add a plan-specific selection bar in `src/components/sessions/` and introduce the i18n keys needed for batch reschedule, status, sync/unsync, overdue, and maintenance-filter labels/messages.
- [x] 3.3 Update `src/components/sessions/PlanCard.tsx`, `src/components/sessions/SessionDateSummary.tsx`, and `src/components/sessions/ObservationCalendar.tsx` as needed to surface overdue and maintenance-state cues consistently.

## 4. Regression Coverage And Validation

- [x] 4.1 Extend sessions screen/component tests to cover maintenance filters, plan multi-select, batch status changes, batch reschedule conflict confirmation, and batch calendar summaries.
- [x] 4.2 Update component tests for any new overdue indicators or calendar/date-summary legend changes.
- [x] 4.3 Run `pnpm typecheck && pnpm lint && pnpm test` and fix regressions introduced by the change.
