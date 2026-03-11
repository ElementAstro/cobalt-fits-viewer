## 1. Baseline Audit And Scope

- [x] 1.1 Build a landscape adaptation checklist covering visibility, reachability, scrollability, and hierarchy for target screens/components.
- [x] 1.2 Inventory landscape branches in `src/app/**` and `src/components/**`, and mark inconsistent layout-mode usage.
- [x] 1.3 Define the first-wave target list (home tabs, gallery, sessions, targets, viewer, video) and map ownership by module.

## 2. Shared Layout Contract Alignment

- [x] 2.1 Normalize route-level landscape branching to use shared `layoutMode` semantics from `useResponsiveLayout`.
- [x] 2.2 Consolidate duplicated landscape threshold logic into shared helpers/constants where needed.
- [x] 2.3 Verify safe-area, horizontal padding, and side-panel width behavior remain consistent across portrait and both landscape modes.

## 3. Route Container Remediation

- [x] 3.1 Update high-impact route containers to prevent overlap/clipping in landscape and keep primary actions reachable.
- [x] 3.2 Standardize landscape two-column/side-panel composition for routes that support dense layouts.
- [x] 3.3 Validate scroll containers and sticky headers/toolbars for landscape interaction on phone and tablet widths.

## 4. Reusable Component Remediation

- [x] 4.1 Add or normalize explicit landscape/compact variants for shared headers, toolbars, filter bars, and list cards.
- [x] 4.2 Ensure component spacing and typography density in landscape follow shared rules instead of per-screen overrides.
- [x] 4.3 Document intentional exceptions where a component cannot follow default landscape behavior.

## 5. Regression Coverage And Verification

- [x] 5.1 Add/extend Jest tests for representative landscape scenarios of targeted routes and shared components.
- [x] 5.2 Update route-flow parity checks to cover landscape-sensitive paths introduced by this change.
- [x] 5.3 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm e2e:parity`; fix failures and record verification results.
