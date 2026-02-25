import { hexWithAlpha } from "../colorUtils";

describe("hexWithAlpha", () => {
  it("appends alpha to a 7-char hex color", () => {
    expect(hexWithAlpha("#1a1a2e", 0.95)).toBe("#1a1a2ef2");
  });

  it("returns full opacity for alpha=1", () => {
    expect(hexWithAlpha("#1a1a2e", 1)).toBe("#1a1a2eff");
  });

  it("returns zero opacity for alpha=0", () => {
    expect(hexWithAlpha("#1a1a2e", 0)).toBe("#1a1a2e00");
  });

  it("strips existing alpha from 9-char hex and applies new one", () => {
    expect(hexWithAlpha("#1a1a2eFF", 0.95)).toBe("#1a1a2ef2");
  });

  it("handles 50% alpha", () => {
    expect(hexWithAlpha("#ffffff", 0.5)).toBe("#ffffff80");
  });
});
