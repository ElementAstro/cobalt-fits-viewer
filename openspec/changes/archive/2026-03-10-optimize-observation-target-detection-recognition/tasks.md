## 1. Shared Target Resolution Core

- [x] 1.1 Add a unified target-resolution module under `src/lib/targets/` with typed input/output contracts for `linked-existing`, `created-new`, `updated-existing`, `ambiguous`, and `skipped` outcomes.
- [x] 1.2 Implement canonical catalog-name normalization and alias expansion helpers reused by all detection entry points.
- [x] 1.3 Implement multi-signal candidate scoring (name/alias + coordinates) with explicit ambiguity and non-link boundaries.
- [x] 1.4 Centralize coordinate matching utility and migrate existing ad-hoc coordinate checks to this shared utility.

## 2. Integrate Resolution Core Into Target Write Path

- [x] 2.1 Refactor `upsertAndLinkFileTarget` in `src/hooks/targets/useTargets.ts` to delegate matching decisions to the shared resolution core.
- [x] 2.2 Apply non-destructive update rules for matched targets (safe enrichment only) and preserve existing identity fields on conflicts.
- [x] 2.3 Ensure resolution results include machine-readable reason codes for downstream UI/logging.

## 3. Wire Import, Scan, And Astrometry Flows

- [x] 3.1 Update import auto-link path in `src/hooks/files/useFileManager.ts` to consume standardized resolution outcomes.
- [x] 3.2 Update `scanAndAutoDetect` to expose expanded summary counters including ambiguous and skipped buckets.
- [x] 3.3 Update astrometry sync action in `src/app/astrometry/result/[id].tsx` to handle non-link/ambiguous outcomes with explicit user feedback.
- [x] 3.4 Add/update i18n keys used by target-detection feedback messages in targets and astrometry flows.

## 4. Regression And Consistency Test Coverage

- [x] 4.1 Add unit tests for normalization, alias expansion, scoring, and ambiguity handling in the new resolution core module.
- [x] 4.2 Extend `src/hooks/targets/__tests__/useTargets.test.ts` for new summary fields and non-destructive update behavior.
- [x] 4.3 Add or update tests for import and astrometry entry points to verify they follow the same resolution outcomes for equivalent inputs.
- [x] 4.4 Add a cross-entry consistency test that validates equivalent metadata resolves identically across import, scan, and astrometry sync.

## 5. Validation And Readiness

- [x] 5.1 Run `pnpm typecheck && pnpm lint && pnpm test` and fix regressions introduced by this change.
- [x] 5.2 Run `openspec validate --change \"optimize-observation-target-detection-recognition\"` and ensure the change is apply-ready.
