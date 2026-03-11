## ADDED Requirements

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
