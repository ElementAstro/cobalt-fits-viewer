import { LANDSCAPE_PHONE_MIN, TABLET_MIN, getLayoutMode } from "../breakpoints";

describe("layout breakpoints", () => {
  it("exposes expected breakpoint constants", () => {
    expect(LANDSCAPE_PHONE_MIN).toBe(640);
    expect(TABLET_MIN).toBe(900);
  });

  it("returns portrait when width <= height", () => {
    expect(getLayoutMode(390, 844)).toBe("portrait");
    expect(getLayoutMode(900, 900)).toBe("portrait");
  });

  it("returns landscape-tablet when width >= TABLET_MIN and width > height", () => {
    expect(getLayoutMode(900, 700)).toBe("landscape-tablet");
    expect(getLayoutMode(1200, 700)).toBe("landscape-tablet");
  });

  it("returns landscape-phone when width is between phone and tablet thresholds", () => {
    expect(getLayoutMode(640, 500)).toBe("landscape-phone");
    expect(getLayoutMode(899, 500)).toBe("landscape-phone");
  });

  it("falls back to portrait for narrow landscape width", () => {
    expect(getLayoutMode(639, 500)).toBe("portrait");
  });
});
