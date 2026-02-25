import {
  TARGET_TYPES,
  TARGET_STATUSES,
  STATUS_COLORS,
  GROUP_COLORS,
  DEFAULT_CATEGORIES,
  ACTION_ICONS,
  ACTION_COLORS,
  FILTER_COLORS,
  targetTypeI18nKey,
  targetStatusI18nKey,
} from "../targetConstants";

describe("targetConstants", () => {
  describe("TARGET_TYPES", () => {
    it("contains all expected target types", () => {
      expect(TARGET_TYPES).toEqual([
        "galaxy",
        "nebula",
        "cluster",
        "planet",
        "moon",
        "sun",
        "comet",
        "other",
      ]);
    });
  });

  describe("TARGET_STATUSES", () => {
    it("contains all expected statuses", () => {
      expect(TARGET_STATUSES).toEqual(["planned", "acquiring", "completed", "processed"]);
    });
  });

  describe("STATUS_COLORS", () => {
    it("has a color for every status", () => {
      for (const status of TARGET_STATUSES) {
        expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe("GROUP_COLORS", () => {
    it("has 8 colors", () => {
      expect(GROUP_COLORS).toHaveLength(8);
    });

    it("all are valid hex colors", () => {
      for (const color of GROUP_COLORS) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe("DEFAULT_CATEGORIES", () => {
    it("has expected categories", () => {
      expect(DEFAULT_CATEGORIES).toContain("Deep Sky");
      expect(DEFAULT_CATEGORIES).toContain("Solar System");
      expect(DEFAULT_CATEGORIES.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("ACTION_ICONS", () => {
    it("has an icon for every change log action", () => {
      const actions = [
        "created",
        "updated",
        "status_changed",
        "image_added",
        "image_removed",
        "favorited",
        "unfavorited",
        "pinned",
        "unpinned",
        "tagged",
        "untagged",
      ] as const;
      for (const action of actions) {
        expect(ACTION_ICONS[action]).toBeDefined();
        expect(typeof ACTION_ICONS[action]).toBe("string");
      }
    });
  });

  describe("ACTION_COLORS", () => {
    it("has a color for every change log action", () => {
      const actions = Object.keys(ACTION_ICONS);
      for (const action of actions) {
        expect(ACTION_COLORS[action as keyof typeof ACTION_COLORS]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });

  describe("FILTER_COLORS", () => {
    it("has colors for common astronomical filters", () => {
      expect(FILTER_COLORS["L"]).toBeDefined();
      expect(FILTER_COLORS["R"]).toBeDefined();
      expect(FILTER_COLORS["G"]).toBeDefined();
      expect(FILTER_COLORS["B"]).toBeDefined();
      expect(FILTER_COLORS["Ha"]).toBeDefined();
      expect(FILTER_COLORS["Unknown"]).toBeDefined();
    });
  });

  describe("targetTypeI18nKey", () => {
    it("returns correct i18n key for each type", () => {
      expect(targetTypeI18nKey("galaxy")).toBe("targets.types.galaxy");
      expect(targetTypeI18nKey("nebula")).toBe("targets.types.nebula");
      expect(targetTypeI18nKey("other")).toBe("targets.types.other");
    });

    it("returns valid key for all TARGET_TYPES", () => {
      for (const type of TARGET_TYPES) {
        const key = targetTypeI18nKey(type);
        expect(key).toBe(`targets.types.${type}`);
      }
    });
  });

  describe("targetStatusI18nKey", () => {
    it("returns correct i18n key for each status", () => {
      expect(targetStatusI18nKey("planned")).toBe("targets.planned");
      expect(targetStatusI18nKey("acquiring")).toBe("targets.acquiring");
      expect(targetStatusI18nKey("completed")).toBe("targets.completed");
      expect(targetStatusI18nKey("processed")).toBe("targets.processed");
    });

    it("returns valid key for all TARGET_STATUSES", () => {
      for (const status of TARGET_STATUSES) {
        const key = targetStatusI18nKey(status);
        expect(key).toBe(`targets.${status}`);
      }
    });
  });
});
