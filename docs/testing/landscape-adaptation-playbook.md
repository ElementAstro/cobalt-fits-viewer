# Landscape Adaptation Playbook

## Checklist

Use this checklist for every landscape-sensitive screen/component:

- Visibility: Primary action buttons, title, and key summary metrics remain visible.
- Reachability: Tap targets are not clipped and remain reachable in one interaction layer.
- Scrollability: Main content and side content can both be scrolled without gesture conflicts.
- Hierarchy: Dense mode keeps action priority and text hierarchy clear.
- Safety Area: Horizontal safe-area insets are applied to immersive pages.
- Layout Mode: Branching uses shared `layoutMode` semantics (`portrait`, `landscape-phone`, `landscape-tablet`).

## Inventory Of Current Branches

### Route-level hotspots (`src/app/**`)

- `src/app/(tabs)/index.tsx`
  - Used ad-hoc width threshold for top action stacking (`screenWidth < 420`).
- `src/app/(tabs)/targets.tsx`
  - Used ad-hoc width threshold for compact header/filter (`screenWidth < 430`).
- `src/app/(tabs)/sessions.tsx`
  - Treated all landscape modes as split pane, causing narrow-width compression.
- `src/app/viewer/[id].tsx`
  - Treated all landscape modes as side-panel layout, which can reduce canvas area on phones.
- `src/app/video/[id].tsx`
  - Treated all landscape modes as side-panel layout, reducing player/control readability on phones.

### Shared component hotspots (`src/components/**`)

- `src/components/targets/TargetListHeader.tsx`
  - Header action group accepted `compact` but did not apply compact typography/spacing to title block.

## First-wave Scope And Ownership

Focus modules for this implementation wave:

- Files route and shared file controls
  - Owner module: `src/app/(tabs)/index.tsx`, `src/components/files/**`.
- Targets route and header/filter controls
  - Owner module: `src/app/(tabs)/targets.tsx`, `src/components/targets/**`.
- Sessions route container
  - Owner module: `src/app/(tabs)/sessions.tsx`.
- Viewer route container
  - Owner module: `src/app/viewer/[id].tsx`, `src/components/fits/**`.
- Video route container
  - Owner module: `src/app/video/[id].tsx`, `src/components/video/**`.

## Intentional Exceptions

- `landscape-phone` does not force split-pane side panels in viewer/video/sessions.
  - Reason: preserve readable primary content and avoid touch target compression.
- `landscape-tablet` keeps split-pane behavior with `sidePanelWidth`.
  - Reason: wide layouts can safely support simultaneous primary and secondary panels.
