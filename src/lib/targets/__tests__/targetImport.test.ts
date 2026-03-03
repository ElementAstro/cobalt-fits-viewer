import type { Target } from "../../fits/types";
import { parseTargetsJSON, parseTargetsCSV, executeImport } from "../targetImport";

const makeTarget = (overrides: Partial<Target> = {}): Target => {
  const now = Date.now();
  return {
    id: "t1",
    name: "M42",
    aliases: ["Orion Nebula"],
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

describe("parseTargetsJSON", () => {
  it("parses a single target object", () => {
    const json = JSON.stringify({ name: "M31", type: "galaxy", ra: 10.68, dec: 41.27 });
    const items = parseTargetsJSON(json, []);
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe("create");
    expect(items[0].target.name).toBe("M31");
    expect(items[0].target.type).toBe("galaxy");
    expect(items[0].target.ra).toBe(10.68);
  });

  it("parses an array of targets", () => {
    const json = JSON.stringify([
      { name: "M42", type: "nebula" },
      { name: "M31", type: "galaxy" },
    ]);
    const items = parseTargetsJSON(json, []);
    expect(items).toHaveLength(2);
    expect(items[0].target.name).toBe("M42");
    expect(items[1].target.name).toBe("M31");
  });

  it("marks existing targets as update", () => {
    const existing = [makeTarget({ id: "t1", name: "M42", aliases: ["Orion Nebula"] })];
    const json = JSON.stringify({ name: "M42", ra: 83.82, dec: -5.39 });
    const items = parseTargetsJSON(json, existing);
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe("update");
    expect(items[0].matchedExisting?.id).toBe("t1");
  });

  it("matches by alias", () => {
    const existing = [makeTarget({ id: "t1", name: "M42", aliases: ["Orion Nebula"] })];
    const json = JSON.stringify({ name: "Orion Nebula" });
    const items = parseTargetsJSON(json, existing);
    expect(items).toHaveLength(1);
    expect(items[0].action).toBe("update");
  });

  it("returns empty for invalid JSON", () => {
    expect(parseTargetsJSON("not-json", [])).toEqual([]);
  });

  it("skips entries without name", () => {
    const json = JSON.stringify([{ type: "galaxy" }, { name: "M31" }]);
    const items = parseTargetsJSON(json, []);
    expect(items).toHaveLength(1);
    expect(items[0].target.name).toBe("M31");
  });
});

describe("parseTargetsCSV", () => {
  it("parses CSV with headers", () => {
    const csv =
      "name,type,status,ra,dec\nM42,nebula,planned,83.82,-5.39\nM31,galaxy,completed,10.68,41.27";
    const items = parseTargetsCSV(csv, []);
    expect(items).toHaveLength(2);
    expect(items[0].target.name).toBe("M42");
    expect(items[0].target.type).toBe("nebula");
    expect(items[0].target.ra).toBe(83.82);
    expect(items[1].target.name).toBe("M31");
    expect(items[1].target.status).toBe("completed");
  });

  it("handles quoted fields with commas", () => {
    const csv = 'name,tags,notes\nM42,"Ha; OIII","Great target, very bright"';
    const items = parseTargetsCSV(csv, []);
    expect(items).toHaveLength(1);
    expect(items[0].target.tags).toEqual(["Ha", "OIII"]);
    expect(items[0].target.notes).toBe("Great target, very bright");
  });

  it("returns empty for CSV without name column", () => {
    const csv = "type,ra,dec\nnebula,83.82,-5.39";
    expect(parseTargetsCSV(csv, [])).toEqual([]);
  });

  it("returns empty for single-line CSV", () => {
    expect(parseTargetsCSV("name,type", [])).toEqual([]);
  });
});

describe("executeImport", () => {
  it("creates new targets", () => {
    const items = [
      { target: { name: "M42", type: "nebula" as const }, action: "create" as const },
      { target: { name: "M31", type: "galaxy" as const }, action: "create" as const },
    ];
    const added: Target[] = [];
    const result = executeImport(
      items,
      (t) => added.push(t),
      () => {},
    );
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(added).toHaveLength(2);
    expect(added[0].name).toBe("M42");
  });

  it("updates existing targets with new data", () => {
    const existing = makeTarget({ id: "t1", name: "M42", ra: undefined, tags: ["deep-sky"] });
    const items = [
      {
        target: { name: "M42", ra: 83.82, tags: ["nebula"] },
        action: "update" as const,
        matchedExisting: existing,
      },
    ];
    const updates: Array<{ id: string; updates: Partial<Target> }> = [];
    const result = executeImport(
      items,
      () => {},
      (id, u) => updates.push({ id, updates: u }),
    );
    expect(result.updated).toBe(1);
    expect(updates[0].id).toBe("t1");
    expect(updates[0].updates.ra).toBe(83.82);
    expect(updates[0].updates.tags).toEqual(["deep-sky", "nebula"]);
  });

  it("skips items marked as skip", () => {
    const items = [{ target: { name: "M42" }, action: "skip" as const }];
    const result = executeImport(
      items,
      () => {},
      () => {},
    );
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
  });
});
