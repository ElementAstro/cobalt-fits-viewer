import type { FitsMetadata, FileGroup } from "../../fits/types";
import { analyzeStorage } from "../storageAnalytics";

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id: "f1",
    filename: "test.fits",
    filepath: "/tmp/test.fits",
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "light",
    sourceType: "fits",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  }) as FitsMetadata;

describe("analyzeStorage", () => {
  it("computes total files and size", () => {
    const files = [makeFile({ id: "a", fileSize: 100 }), makeFile({ id: "b", fileSize: 200 })];
    const result = analyzeStorage(files, {}, []);
    expect(result.totalFiles).toBe(2);
    expect(result.totalSize).toBe(300);
  });

  it("breaks down by media type", () => {
    const files = [
      makeFile({ id: "a", sourceType: "fits", fileSize: 500 }),
      makeFile({ id: "b", sourceType: "video", fileSize: 300 }),
      makeFile({ id: "c", sourceType: "fits", fileSize: 200 }),
    ];
    const result = analyzeStorage(files, {}, []);
    const fits = result.byMediaType.find((m) => m.type === "fits");
    const video = result.byMediaType.find((m) => m.type === "video");
    expect(fits?.count).toBe(2);
    expect(fits?.size).toBe(700);
    expect(video?.count).toBe(1);
    expect(video?.size).toBe(300);
  });

  it("breaks down by frame type", () => {
    const files = [
      makeFile({ id: "a", frameType: "light", fileSize: 100 }),
      makeFile({ id: "b", frameType: "dark", fileSize: 200 }),
      makeFile({ id: "c", frameType: "light", fileSize: 150 }),
    ];
    const result = analyzeStorage(files, {}, []);
    const light = result.byFrameType.find((f) => f.type === "light");
    const dark = result.byFrameType.find((f) => f.type === "dark");
    expect(light?.count).toBe(2);
    expect(light?.size).toBe(250);
    expect(dark?.count).toBe(1);
  });

  it("breaks down by month from importDate", () => {
    const jan = new Date("2024-01-15").getTime();
    const feb = new Date("2024-02-10").getTime();
    const files = [
      makeFile({ id: "a", importDate: jan, fileSize: 100 }),
      makeFile({ id: "b", importDate: jan, fileSize: 200 }),
      makeFile({ id: "c", importDate: feb, fileSize: 300 }),
    ];
    const result = analyzeStorage(files, {}, []);
    const janEntry = result.byMonth.find((m) => m.month === "2024-01");
    const febEntry = result.byMonth.find((m) => m.month === "2024-02");
    expect(janEntry?.count).toBe(2);
    expect(janEntry?.size).toBe(300);
    expect(febEntry?.count).toBe(1);
    expect(febEntry?.size).toBe(300);
  });

  it("breaks down by group with ungrouped count", () => {
    const groups: FileGroup[] = [{ id: "g1", name: "Stars", createdAt: 1, updatedAt: 1 }];
    const fileGroupMap: Record<string, string[]> = { a: ["g1"], b: ["g1"] };
    const files = [
      makeFile({ id: "a", fileSize: 100 }),
      makeFile({ id: "b", fileSize: 200 }),
      makeFile({ id: "c", fileSize: 50 }),
    ];
    const result = analyzeStorage(files, fileGroupMap, groups);
    expect(result.byGroup).toHaveLength(1);
    expect(result.byGroup[0].name).toBe("Stars");
    expect(result.byGroup[0].count).toBe(2);
    expect(result.byGroup[0].size).toBe(300);
    expect(result.ungroupedCount).toBe(1);
    expect(result.ungroupedSize).toBe(50);
  });

  it("returns zeroes for empty input", () => {
    const result = analyzeStorage([], {}, []);
    expect(result.totalFiles).toBe(0);
    expect(result.totalSize).toBe(0);
    expect(result.byMediaType).toHaveLength(0);
    expect(result.byFrameType).toHaveLength(0);
    expect(result.byMonth).toHaveLength(0);
    expect(result.byGroup).toHaveLength(0);
    expect(result.ungroupedCount).toBe(0);
  });
});
