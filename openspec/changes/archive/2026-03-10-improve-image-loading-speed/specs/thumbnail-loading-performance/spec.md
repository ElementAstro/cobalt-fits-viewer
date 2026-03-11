## ADDED Requirements

### Requirement: Viewport-priority thumbnail scheduling

The system SHALL schedule thumbnail generation by priority tiers and MUST process `visible` requests before `nearby` and `background` requests.

#### Scenario: Visible request preempts background work

- **WHEN** background thumbnail tasks are pending and a visible file is requested
- **THEN** the scheduler starts the visible file task before starting any new background task

#### Scenario: Nearby queue is processed before background queue

- **WHEN** the visible queue is empty and both nearby and background queues contain tasks
- **THEN** the scheduler dispatches nearby tasks before background tasks

### Requirement: Cross-instance in-flight deduplication

The system SHALL enforce at most one active thumbnail generation task per `fileId` across the app and MUST return the same in-flight result for duplicate requests.

#### Scenario: Duplicate request from multiple UI entry points

- **WHEN** the same `fileId` is requested concurrently from gallery grid and quick-look entry points
- **THEN** only one generation task is created and all callers receive that task result

### Requirement: Bounded and source-aware concurrency

The system SHALL enforce a configurable global concurrency ceiling and MUST prevent heavy sources (FITS/video) from occupying all worker slots.

#### Scenario: Global concurrency ceiling is respected

- **WHEN** more thumbnail requests are queued than the configured maximum concurrency
- **THEN** the number of active generation tasks never exceeds the configured ceiling

#### Scenario: Heavy task quota prevents starvation

- **WHEN** FITS/video tasks saturate the queue and lightweight raster tasks are pending
- **THEN** at least one worker slot remains available for non-heavy tasks according to configured quota rules

### Requirement: Failure cooldown and controlled retry

The system MUST suppress immediate repeated generation attempts for files that recently failed and SHALL allow retry after cooldown expiration.

#### Scenario: Retry is suppressed during cooldown

- **WHEN** a file generation fails and the same file is requested again before cooldown expires
- **THEN** the scheduler skips enqueueing a new generation task for that file

#### Scenario: Retry is allowed after cooldown

- **WHEN** a file generation previously failed and cooldown has elapsed
- **THEN** the scheduler accepts and executes a new generation request for that file

### Requirement: Loading performance metrics are observable

The system SHALL expose queue and execution metrics required for regression testing, including active task count, queued task count, and dedupe hit count.

#### Scenario: Metrics update during queue lifecycle

- **WHEN** thumbnail requests are enqueued, deduplicated, started, and completed
- **THEN** the exposed metrics reflect each state transition and can be asserted by automated tests
