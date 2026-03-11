# observation-target-detection-recognition Specification

## Purpose

TBD - created by archiving change optimize-observation-target-detection-recognition. Update Purpose after archive.

## Requirements

### Requirement: Unified Resolution Workflow Across Detection Entry Points

The system MUST execute a single shared target-resolution workflow for file import auto-linking, batch target scanning, and astrometry result synchronization.

#### Scenario: Same metadata yields consistent resolution

- **WHEN** equivalent target metadata is processed through import, `scanAndAutoDetect`, and astrometry sync entry points
- **THEN** the system MUST produce the same resolution outcome type and resolve to the same target entity (or same non-link result) across all three paths

#### Scenario: Entry point receives insufficient metadata

- **WHEN** an entry point processes input without resolvable object identity and without usable coordinates
- **THEN** the system MUST return a non-link result without creating or mutating targets

### Requirement: Catalog Name Normalization And Alias Expansion

The system MUST normalize catalog-style names and apply known alias expansion before target matching.

#### Scenario: Catalog format variants normalize to one identity

- **WHEN** metadata contains equivalent catalog variants such as `M31` and `M 31`, or `NGC224` and `NGC 224`
- **THEN** the matching pipeline MUST treat these variants as the same canonical object identity

#### Scenario: Known alias resolves to existing target

- **WHEN** incoming metadata uses an alias known to map to an existing target name or alias
- **THEN** the system MUST match the existing target instead of creating a duplicate target

### Requirement: Multi-Signal Matching With Explicit Ambiguity Boundary

The system MUST combine name/alias evidence and coordinate evidence to determine whether to auto-link, and MUST avoid automatic writes when the best candidate is ambiguous.

#### Scenario: Unique high-confidence candidate

- **WHEN** exactly one target candidate satisfies the auto-link confidence criteria from normalized name/alias and coordinate checks
- **THEN** the system MUST automatically link to that existing target

#### Scenario: Multiple equivalent candidates

- **WHEN** two or more candidates meet matching criteria without a unique best candidate
- **THEN** the system MUST return an `ambiguous` result and MUST NOT auto-link to any candidate

#### Scenario: No existing candidate but resolvable object

- **WHEN** no existing target satisfies matching criteria and input includes resolvable object identity
- **THEN** the system MUST create a new target and link the source file to that new target

### Requirement: Existing Target Updates Must Be Non-Destructive

The system MUST update matched targets using non-destructive merge rules that preserve existing user-managed fields unless explicitly safe to enrich.

#### Scenario: Enrich missing coordinates

- **WHEN** a matched target lacks RA/DEC and incoming metadata provides valid RA/DEC
- **THEN** the system MUST enrich the target with those coordinates

#### Scenario: Preserve established target identity fields

- **WHEN** a matched target already has primary identity fields (name, aliases, type) and incoming metadata conflicts with those fields
- **THEN** the system MUST preserve existing identity fields and only append non-conflicting enrichment data

### Requirement: Resolution Outcomes Must Be Traceable And Actionable

The system MUST expose structured resolution outcomes and aggregate counters so users and tests can distinguish created, updated, ambiguous, and skipped cases.

#### Scenario: Batch scan returns actionable summary

- **WHEN** `scanAndAutoDetect` completes a batch run
- **THEN** it MUST return summary fields that distinguish at least scanned, created, updated, ambiguous, and skipped results

#### Scenario: Single-entry sync surfaces result reason

- **WHEN** import auto-linking or astrometry sync resolves a target operation
- **THEN** the result payload MUST include an outcome type and reason code suitable for user-facing feedback and automated assertions
