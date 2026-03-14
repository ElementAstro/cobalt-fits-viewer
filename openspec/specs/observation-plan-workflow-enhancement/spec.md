# observation-plan-workflow-enhancement Specification

## Purpose

TBD - created by syncing change enhance-observation-plan. Update Purpose after archive.

## Requirements

### Requirement: Plan Editor Supports Efficient Time Adjustment

The system MUST provide efficient date/time adjustment controls when creating or editing an observation plan, including quick day shift and common duration presets, while preserving manual fine-tuning.

#### Scenario: User adjusts plan schedule quickly

- **WHEN** a user opens the plan editor for a new or existing plan
- **THEN** the editor MUST allow changing the date and time without requiring repeated minute-by-minute adjustments

#### Scenario: User applies duration preset

- **WHEN** a user selects a duration preset in the plan editor
- **THEN** the system MUST update the plan end time relative to the current start time using the selected duration

### Requirement: Plan Time Conflicts Are Detectable Before Save

The system MUST detect time-overlap conflicts between the draft plan and existing non-cancelled plans and present conflict details before the plan is saved.

#### Scenario: Draft plan overlaps existing plan

- **WHEN** a user attempts to save a plan whose time range overlaps with another non-cancelled plan
- **THEN** the system MUST show a conflict warning that identifies at least one conflicting plan and requires explicit user confirmation to continue

#### Scenario: Draft plan has no conflicts

- **WHEN** a user saves a plan that does not overlap with other non-cancelled plans
- **THEN** the system MUST save directly without showing conflict confirmation

### Requirement: Plan List Exposes Conflict Risk State

The system MUST expose plan conflict risk in list/calendar-facing plan summaries so users can identify problematic plans without opening each plan editor.

#### Scenario: Plan has conflict with another plan

- **WHEN** a plan overlaps with at least one other non-cancelled plan
- **THEN** the plan summary UI MUST display a visible conflict indicator

### Requirement: Existing Plan Can Be Duplicated And Rolled Over

The system MUST allow users to duplicate an existing plan into a new plan draft, with an option to roll the schedule forward by one day while preserving core plan content.

#### Scenario: User duplicates plan

- **WHEN** a user selects duplicate from plan actions
- **THEN** the system MUST create a new plan draft prefilled from the source plan and keep target, equipment, location, notes, reminder, and status defaults defined by product rules

#### Scenario: User rolls plan to next day

- **WHEN** a user selects rollover to next day from plan actions
- **THEN** the system MUST create a new plan with start and end times shifted by exactly one local calendar day from the source plan

### Requirement: Converting Plan To Session Prevents Silent Duplicates

The system MUST detect whether a plan has already been converted into a session and prevent silent duplicate conversions.

#### Scenario: Plan already converted

- **WHEN** a user triggers "convert to session" for a plan that already has at least one converted session
- **THEN** the system MUST warn the user and require explicit confirmation before creating another session

#### Scenario: Plan conversion succeeds

- **WHEN** a user confirms conversion for a valid plan time range
- **THEN** the system MUST create a new session from the plan and set the plan status to completed

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
