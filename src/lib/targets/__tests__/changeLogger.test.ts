import type { Target, TargetChangeLogEntry } from "../../fits/types";
import {
  addChangeLog,
  createLogEntry,
  formatRelativeTime,
  getChangeLogSummary,
  logFavorited,
  logImageAdded,
  logImageRemoved,
  logPinned,
  logStatusChanged,
  logTagAdded,
  logTagRemoved,
  logTargetCreated,
  logTargetUpdated,
  logUnfavorited,
  logUnpinned,
} from "../changeLogger";

const makeTarget = (overrides: Partial<Target> = {}): Target => {
  const now = Date.now();
  return {
    id: "t1",
    name: "M42",
    aliases: [],
    type: "nebula",
    tags: [],
    isFavorite: false,
    isPinned: false,
    imageIds: [],
    status: "planned",
    plannedFilters: [],
    plannedExposure: {},
    imageRatings: {},
    changeLog: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

describe("target changeLogger", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    jest.spyOn(Math, "random").mockReturnValue(0.123456789);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates log entries with generated ids and fields", () => {
    const entry = createLogEntry("updated", "status", "planned", "acquiring");
    expect(entry).toEqual({
      id: "1700000000000-4fzzzxj",
      timestamp: 1_700_000_000_000,
      action: "updated",
      field: "status",
      oldValue: "planned",
      newValue: "acquiring",
    });
  });

  it("provides convenience entry creators", () => {
    expect(logTargetCreated().action).toBe("created");
    expect(logTargetUpdated("name", "old", "new").field).toBe("name");
    expect(logStatusChanged("planned", "completed").newValue).toBe("completed");
    expect(logImageAdded("img-1").newValue).toBe("img-1");
    expect(logImageRemoved("img-2").oldValue).toBe("img-2");
    expect(logFavorited().action).toBe("favorited");
    expect(logUnfavorited().action).toBe("unfavorited");
    expect(logPinned().action).toBe("pinned");
    expect(logUnpinned().action).toBe("unpinned");
    expect(logTagAdded("Ha").newValue).toBe("Ha");
    expect(logTagRemoved("Ha").oldValue).toBe("Ha");
  });

  it("appends change log and updates timestamp", () => {
    const target = makeTarget();
    const entry = createLogEntry("created");
    const updated = addChangeLog(target, entry);
    expect(updated.changeLog).toHaveLength(1);
    expect(updated.changeLog[0]).toEqual(entry);
    expect(updated.updatedAt).toBe(1_700_000_000_000);
  });

  it("builds readable summary for all action kinds", () => {
    const entries: TargetChangeLogEntry[] = [
      { id: "1", timestamp: 1, action: "created" },
      { id: "2", timestamp: 2, action: "updated", field: "name", oldValue: "A", newValue: "B" },
      { id: "3", timestamp: 3, action: "status_changed", oldValue: "planned", newValue: "done" },
      { id: "4", timestamp: 4, action: "image_added", newValue: "img1" },
      { id: "5", timestamp: 5, action: "image_removed", oldValue: "img2" },
      { id: "6", timestamp: 6, action: "favorited" },
      { id: "7", timestamp: 7, action: "unfavorited" },
      { id: "8", timestamp: 8, action: "pinned" },
      { id: "9", timestamp: 9, action: "unpinned" },
      { id: "10", timestamp: 10, action: "tagged", newValue: "Ha" },
      { id: "11", timestamp: 11, action: "untagged", oldValue: "OIII" },
    ];
    const target = makeTarget({ changeLog: entries });
    const summaries = getChangeLogSummary(target);
    expect(summaries[0].description).toBe("Target created");
    expect(summaries[1].description).toContain("name changed");
    expect(summaries[2].description).toContain("Status:");
    expect(summaries[3].description).toContain("Image added");
    expect(summaries[4].description).toContain("Image removed");
    expect(summaries[5].description).toBe("Added to favorites");
    expect(summaries[6].description).toBe("Removed from favorites");
    expect(summaries[7].description).toBe("Pinned");
    expect(summaries[8].description).toBe("Unpinned");
    expect(summaries[9].description).toBe("Tag added: Ha");
    expect(summaries[10].description).toBe("Tag removed: OIII");
  });

  it("formats relative time strings by time windows", () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, "now").mockReturnValue(now);
    expect(formatRelativeTime(now - 10_000)).toBe("Just now");
    expect(formatRelativeTime(now - 5 * 60_000)).toBe("5m ago");
    expect(formatRelativeTime(now - 2 * 3_600_000)).toBe("2h ago");
    expect(formatRelativeTime(now - 3 * 86_400_000)).toBe("3d ago");
    expect(formatRelativeTime(now - 2 * 7 * 86_400_000)).toBe("2w ago");
    expect(formatRelativeTime(now - 60 * 86_400_000)).toBe("2mo ago");
  });
});
