import en from "../locales/en";
import zh from "../locales/zh";

const REQUIRED_KEYS = [
  "targets.changeLog.status_changed",
  "targets.changeLog.image_added",
  "targets.changeLog.image_removed",
  "targets.ratings.totalImages",
  "targets.ratings.rated",
  "targets.ratings.average",
  "targets.ratings.unrated",
  "targets.ratings.excellent",
  "targets.ratings.good",
  "targets.ratings.fair",
  "targets.ratings.poor",
  "targets.ratings.selectBest",
  "targets.ratings.setRating",
  "targets.ratings.clearBest",
  "targets.equipment.telescopePlaceholder",
  "targets.equipment.cameraPlaceholder",
  "targets.equipment.filtersPlaceholder",
  "targets.equipment.filtersHint",
  "targets.equipment.notesPlaceholder",
  "targets.equipment.noEquipment",
  "targets.addTag",
  "settings.targetSortFrames",
  "settings.targetSortExposure",
  "settings.targetSortFavorite",
  "settings.targetActionControlMode",
  "settings.targetActionControlModeIcon",
  "settings.targetActionControlModeCheckbox",
  "settings.targetActionSizePreset",
  "settings.targetActionSizeCompact",
  "settings.targetActionSizeStandard",
  "settings.targetActionSizeAccessible",
  "settings.targetActionAutoScaleFromFont",
] as const;

function getByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

describe("targets locale keys", () => {
  it.each(REQUIRED_KEYS)("exists in en locale: %s", (key) => {
    expect(typeof getByPath(en as unknown as Record<string, unknown>, key)).toBe("string");
  });

  it.each(REQUIRED_KEYS)("exists in zh locale: %s", (key) => {
    expect(typeof getByPath(zh as unknown as Record<string, unknown>, key)).toBe("string");
  });
});
