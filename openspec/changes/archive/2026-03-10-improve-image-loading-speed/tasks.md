## 1. Thumbnail Scheduler Foundation

- [x] 1.1 Add a dedicated thumbnail scheduler module in `src/lib/gallery` with `visible/nearby/background` priority queues and a shared in-flight registry keyed by `fileId`.
- [x] 1.2 Implement configurable concurrency controls (global ceiling + heavy-source quota) and preserve failure cooldown state in the scheduler.
- [x] 1.3 Add unit tests for scheduler ordering, deduplication, cooldown suppression, and concurrency ceiling guarantees.

## 2. Gallery Integration

- [x] 2.1 Refactor `useThumbnailOnDemand` to enqueue through the scheduler and accept request priority instead of directly managing a local FIFO queue.
- [x] 2.2 Update `ThumbnailGrid` to emit priority-aware requests (visible first, nearby next, background last) based on list visibility signals.
- [x] 2.3 Ensure other thumbnail entry points (e.g., quick-look/regeneration triggers) reuse the same scheduler path to avoid cross-instance duplicate generation.

## 3. Observability and Safety

- [x] 3.1 Expose runtime metrics (active count, queued count, dedupe hit count) from the scheduler for debugging and regression assertions.
- [x] 3.2 Add structured thumbnail queue logs for enqueue/start/finish/failure events under existing thumbnail log tags.
- [x] 3.3 Verify failed files are skipped during cooldown and can be retried after cooldown expiration via automated tests.

## 4. Validation

- [x] 4.1 Add or update tests in `src/hooks/gallery/__tests__` and `src/components/gallery/__tests__` to cover prioritized loading behavior.
- [x] 4.2 Run `pnpm test` (and `pnpm typecheck` if types changed) to validate no regressions in thumbnail and gallery flows.
- [x] 4.3 Confirm `openspec status --change "improve-image-loading-speed"` reports all apply-required artifacts complete.
