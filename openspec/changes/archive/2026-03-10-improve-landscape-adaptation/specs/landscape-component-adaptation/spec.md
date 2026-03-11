## ADDED Requirements

### Requirement: Unified Landscape Mode Contract

The system MUST apply landscape behavior using a shared layout contract based on `layoutMode` (`portrait`, `landscape-phone`, `landscape-tablet`) so that equivalent UI structures behave consistently across routes.

#### Scenario: Route uses shared landscape mode

- **WHEN** a route screen renders in landscape orientation
- **THEN** it MUST derive layout branching from the shared responsive layout mode instead of ad-hoc per-screen thresholds

### Requirement: Core Screen Landscape Usability

The system MUST ensure core screens remain usable in landscape, including visible primary actions, non-overlapping content, and reachable scrollable regions without clipping.

#### Scenario: Core screen remains operable in landscape

- **WHEN** a user opens a core screen (home tabs, gallery, sessions, targets, viewer, or video) in landscape
- **THEN** primary actions and key content MUST remain visible or reachable without layout overlap or blocked touch targets

### Requirement: Reusable Component Landscape Adaptation

Reusable UI components used by multiple screens MUST provide a defined landscape presentation (spacing, density, and optional compact mode) that aligns with the shared layout contract.

#### Scenario: Shared component exposes landscape behavior

- **WHEN** a shared component is rendered in landscape within supported screens
- **THEN** it MUST use a documented landscape variant or compact mode instead of relying on implicit default spacing

### Requirement: Landscape Regression Coverage

The system MUST include automated regression checks for landscape behavior on high-impact flows so future changes cannot silently break orientation-specific layouts.

#### Scenario: Landscape regression checks run in CI

- **WHEN** landscape-affecting code changes are introduced
- **THEN** automated tests MUST validate representative landscape scenarios for targeted screens/components and fail on regressions
