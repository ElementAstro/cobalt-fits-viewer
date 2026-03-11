import type { LayoutMode } from "./breakpoints";

export const FILES_STACK_ACTIONS_MAX_WIDTH = 420;
export const TARGETS_COMPACT_ACTIONS_MAX_WIDTH = 430;

export function isLandscapeLayoutMode(layoutMode: LayoutMode): boolean {
  return layoutMode !== "portrait";
}

export function shouldUseLandscapeSplitPane(layoutMode: LayoutMode): boolean {
  return layoutMode === "landscape-tablet";
}

export function shouldUseCompactActionLayout(
  layoutMode: LayoutMode,
  screenWidth: number,
  maxWidth: number,
): boolean {
  return layoutMode !== "landscape-tablet" && screenWidth < maxWidth;
}
