import { resolveTargetInteractionUi } from "../targetInteractionUi";

describe("resolveTargetInteractionUi", () => {
  it("uses compact preset without auto scaling", () => {
    const ui = resolveTargetInteractionUi({
      preset: "compact",
      autoScaleFromFont: false,
      fontScale: 1.35,
    });
    expect(ui.effectivePreset).toBe("compact");
    expect(ui.buttonSize).toBe("sm");
    expect(ui.iconSize).toBe(14);
  });

  it("promotes one step when fontScale is >= 1.1 and < 1.3", () => {
    const ui = resolveTargetInteractionUi({
      preset: "compact",
      autoScaleFromFont: true,
      fontScale: 1.1,
    });
    expect(ui.effectivePreset).toBe("standard");
    expect(ui.buttonSize).toBe("md");
    expect(ui.chipSize).toBe("md");
  });

  it("promotes to accessible when fontScale is >= 1.3", () => {
    const ui = resolveTargetInteractionUi({
      preset: "standard",
      autoScaleFromFont: true,
      fontScale: 1.3,
    });
    expect(ui.effectivePreset).toBe("accessible");
    expect(ui.buttonSize).toBe("lg");
    expect(ui.iconSize).toBe(18);
  });

  it("keeps accessible as accessible under one-step promotion", () => {
    const ui = resolveTargetInteractionUi({
      preset: "accessible",
      autoScaleFromFont: true,
      fontScale: 1.2,
    });
    expect(ui.effectivePreset).toBe("accessible");
    expect(ui.chipSize).toBe("lg");
  });
});
