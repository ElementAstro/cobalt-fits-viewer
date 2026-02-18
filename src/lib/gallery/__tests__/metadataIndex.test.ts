import type { FitsMetadata } from "../../fits/types";
import {
  buildMetadataIndex,
  groupByDate,
  groupByLocation,
  groupByObject,
  searchFiles,
} from "../metadataIndex";

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id: "f1",
    filename: "m42_light.fits",
    filepath: "/tmp/m42_light.fits",
    fileSize: 1024,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  }) as FitsMetadata;

describe("metadataIndex", () => {
  it("builds sorted index values and ranges", () => {
    const files = [
      makeFile({
        id: "a",
        object: "M42",
        filter: "Ha",
        sourceFormat: "fits",
        instrument: "ASI2600",
        telescope: "RC8",
        tags: ["nebula", "winter"],
        location: { latitude: 1, longitude: 2, city: "Shanghai" },
        dateObs: "2024-01-03T01:00:00Z",
        exptime: 300,
      }),
      makeFile({
        id: "b",
        frameType: "dark",
        object: "M31",
        filter: "OIII",
        sourceFormat: "png",
        instrument: "ASI294",
        telescope: "RedCat",
        tags: ["galaxy"],
        location: { latitude: 1, longitude: 2, placeName: "Mountain Site" },
        dateObs: "2024-01-01T01:00:00Z",
        exptime: 120,
      }),
    ];

    const index = buildMetadataIndex(files);
    expect(index.objects).toEqual(["M31", "M42"]);
    expect(index.filters).toEqual(["Ha", "OIII"]);
    expect(index.frameTypes).toEqual(["dark", "light"]);
    expect(index.sourceFormats).toEqual(["fits", "png"]);
    expect(index.locations).toEqual(["Mountain Site", "Shanghai"]);
    expect(index.dateRange).toEqual(["2024-01-01T01:00:00Z", "2024-01-03T01:00:00Z"]);
    expect(index.exptimeRange).toEqual([120, 300]);
  });

  it("returns empty ranges when date/exposure are absent", () => {
    const index = buildMetadataIndex([makeFile({ dateObs: undefined, exptime: undefined })]);
    expect(index.dateRange).toBeNull();
    expect(index.exptimeRange).toBeNull();
  });

  it("searches files by multiple metadata fields and notes", () => {
    const files = [
      makeFile({
        id: "m42",
        filename: "m42_ha.fits",
        object: "M42",
        filter: "Ha",
        instrument: "ASI2600",
        telescope: "RC8",
        tags: ["nebula"],
        location: { latitude: 1, longitude: 2, city: "Beijing" },
        notes: "great seeing",
      }),
      makeFile({ id: "m31", filename: "m31.fits", object: "M31", tags: ["galaxy"] }),
    ];

    expect(searchFiles(files, "beijing").map((f) => f.id)).toEqual(["m42"]);
    expect(searchFiles(files, "nebula").map((f) => f.id)).toEqual(["m42"]);
    expect(searchFiles(files, "great").map((f) => f.id)).toEqual(["m42"]);
    expect(searchFiles(files, " ").map((f) => f.id)).toEqual(["m42", "m31"]);
  });

  it("groups files by location/date/object with unknown fallbacks", () => {
    const files = [
      makeFile({
        id: "a",
        location: { latitude: 1, longitude: 2, city: "Tokyo" },
        dateObs: "2024-01-01T10:00:00Z",
        object: "M42",
      }),
      makeFile({
        id: "b",
        location: { latitude: 1, longitude: 2, region: "Kanto" },
        dateObs: undefined,
        object: undefined,
      }),
    ];

    expect(groupByLocation(files).Tokyo.map((f) => f.id)).toEqual(["a"]);
    expect(groupByLocation(files).Kanto.map((f) => f.id)).toEqual(["b"]);
    expect(groupByDate(files)["2024-01-01"].map((f) => f.id)).toEqual(["a"]);
    expect(groupByDate(files).Unknown.map((f) => f.id)).toEqual(["b"]);
    expect(groupByObject(files).M42.map((f) => f.id)).toEqual(["a"]);
    expect(groupByObject(files).Unknown.map((f) => f.id)).toEqual(["b"]);
  });
});
