## ADDED Requirements

### Requirement: Planned Items Past Their Schedule Are Surfaced As Overdue

The system MUST derive an overdue state for observation plans whose status is `planned` and whose end time is earlier than the current time, and MUST expose that state in plan-facing summaries without mutating the persisted plan status.

#### Scenario: Planned item becomes overdue

- **WHEN** a plan remains in `planned` status after its `endDate` has passed
- **THEN** the system MUST show an overdue indicator in plan list or date-summary UI for that plan

#### Scenario: Non-planned item is not treated as overdue

- **WHEN** a completed or cancelled plan has an `endDate` earlier than the current time
- **THEN** the system MUST NOT classify that plan as overdue

### Requirement: Plan List Supports Maintenance-Oriented Queue Filters

The system MUST allow users to filter observation plans by derived maintenance queues, including overdue plans, unsynced plans, and conflict-risk plans, while preserving existing date, search, and status filtering behavior.

#### Scenario: User narrows the list to overdue plans

- **WHEN** a user applies the overdue maintenance filter
- **THEN** the plan list MUST show only plans currently classified as overdue within the active date, search, and status constraints

#### Scenario: User narrows the list to unsynced plans

- **WHEN** a user applies the unsynced maintenance filter
- **THEN** the plan list MUST show only plans that do not currently have a calendar event link

### Requirement: Plans Can Be Maintained In Batch

The system MUST allow users to select multiple observation plans from the plan list and perform batch maintenance actions from a single workflow, including status updates, deletion, and calendar sync maintenance.

#### Scenario: User updates the status of multiple plans

- **WHEN** a user selects multiple plans and applies a batch status change
- **THEN** the system MUST update each selected plan to the requested status in one workflow

#### Scenario: User runs a batch calendar maintenance action

- **WHEN** a user batch-syncs or batch-unsyncs selected plans
- **THEN** the system MUST present a summary of how many plans succeeded, were skipped, or failed

### Requirement: Batch Reschedule Preserves Relative Schedule And Warns On Conflicts

The system MUST support rescheduling multiple selected plans by a fixed local-day offset while preserving each plan's relative start and end times, and MUST warn the user before applying a batch reschedule that creates time overlaps.

#### Scenario: User reschedules multiple plans by a day offset

- **WHEN** a user applies a batch reschedule with a supported day offset
- **THEN** the system MUST shift each selected plan's `startDate` and `endDate` by that local-day offset while preserving each plan's original duration

#### Scenario: Batch reschedule introduces a conflict

- **WHEN** the proposed batch reschedule would cause at least one selected plan to overlap with another active plan
- **THEN** the system MUST show a conflict warning and require explicit user confirmation before saving the batch update
