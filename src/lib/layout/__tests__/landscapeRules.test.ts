import {
  FILES_STACK_ACTIONS_MAX_WIDTH,
  TARGETS_COMPACT_ACTIONS_MAX_WIDTH,
  isLandscapeLayoutMode,
  shouldUseCompactActionLayout,
  shouldUseLandscapeSplitPane,
} from "../landscapeRules";

describe("landscapeRules", () => {
  it("exposes expected compact width constants", () => {
    expect(FILES_STACK_ACTIONS_MAX_WIDTH).toBe(420);
    expect(TARGETS_COMPACT_ACTIONS_MAX_WIDTH).toBe(430);
  });

  it("detects landscape layout modes", () => {
    expect(isLandscapeLayoutMode("portrait")).toBe(false);
    expect(isLandscapeLayoutMode("landscape-phone")).toBe(true);
    expect(isLandscapeLayoutMode("landscape-tablet")).toBe(true);
  });

  it("only enables split pane for landscape-tablet", () => {
    expect(shouldUseLandscapeSplitPane("portrait")).toBe(false);
    expect(shouldUseLandscapeSplitPane("landscape-phone")).toBe(false);
    expect(shouldUseLandscapeSplitPane("landscape-tablet")).toBe(true);
  });

  it("uses compact action layout below threshold except landscape-tablet", () => {
    expect(shouldUseCompactActionLayout("portrait", 390, 430)).toBe(true);
    expect(shouldUseCompactActionLayout("landscape-phone", 410, 430)).toBe(true);
    expect(shouldUseCompactActionLayout("landscape-phone", 460, 430)).toBe(false);
    expect(shouldUseCompactActionLayout("landscape-tablet", 390, 430)).toBe(false);
  });
});
