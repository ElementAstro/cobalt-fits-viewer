import {
  buildMapBBoxes,
  computeInitialCamera,
  isValidGeoLocation,
  normalizeGeoLocation,
} from "../geo";

describe("isValidGeoLocation", () => {
  it("validates finite coordinate ranges", () => {
    expect(isValidGeoLocation({ latitude: 45, longitude: 120 })).toBe(true);
    expect(isValidGeoLocation({ latitude: 91, longitude: 120 })).toBe(false);
    expect(isValidGeoLocation({ latitude: 45, longitude: -181 })).toBe(false);
    expect(isValidGeoLocation({ latitude: Number.NaN, longitude: 1 })).toBe(false);
  });
});

describe("normalizeGeoLocation", () => {
  it("normalizes longitude into [-180, 180]", () => {
    expect(normalizeGeoLocation({ latitude: 12, longitude: 190 })).toMatchObject({
      latitude: 12,
      longitude: -170,
    });
    expect(normalizeGeoLocation({ latitude: -10, longitude: -540 })).toMatchObject({
      latitude: -10,
      longitude: -180,
    });
  });

  it("returns null for invalid inputs", () => {
    expect(normalizeGeoLocation({ latitude: 100, longitude: 10 })).toBeNull();
    expect(normalizeGeoLocation(undefined)).toBeNull();
  });
});

describe("buildMapBBoxes", () => {
  it("splits antimeridian-crossing boxes into two queries", () => {
    const boxes = buildMapBBoxes({
      west: 170,
      south: -20,
      east: -170,
      north: 20,
    });

    expect(boxes).toEqual([
      { west: 170, south: -20, east: 180, north: 20 },
      { west: -180, south: -20, east: -170, north: 20 },
    ]);
  });
});

describe("computeInitialCamera", () => {
  it("computes antimeridian-aware center", () => {
    const camera = computeInitialCamera([
      { latitude: 10, longitude: 179 },
      { latitude: 11, longitude: -179 },
    ]);

    expect(camera).not.toBeNull();
    expect(Math.abs(camera!.coordinates.longitude)).toBeGreaterThan(170);
  });
});
