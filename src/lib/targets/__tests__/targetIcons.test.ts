import { TARGET_TYPE_COLORS, TARGET_TYPE_ICONS, getTargetIcon } from "../targetIcons";

describe("targetIcons", () => {
  it("defines icon and color mappings for all target types", () => {
    expect(Object.keys(TARGET_TYPE_ICONS).sort()).toEqual(
      ["cluster", "comet", "galaxy", "moon", "nebula", "other", "planet", "sun"].sort(),
    );
    expect(Object.keys(TARGET_TYPE_COLORS).sort()).toEqual(
      ["cluster", "comet", "galaxy", "moon", "nebula", "other", "planet", "sun"].sort(),
    );
  });

  it("returns icon descriptor for each target type", () => {
    for (const type of Object.keys(TARGET_TYPE_ICONS) as Array<keyof typeof TARGET_TYPE_ICONS>) {
      expect(getTargetIcon(type)).toEqual({
        name: TARGET_TYPE_ICONS[type],
        color: TARGET_TYPE_COLORS[type],
      });
    }
  });
});
