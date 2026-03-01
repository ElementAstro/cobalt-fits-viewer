import {
  MAX_LATITUDE,
  longitudeToWorldX,
  latitudeToWorldY,
  worldXToLongitude,
  worldYToLatitude,
  cameraToViewport,
} from "../coordinates";

describe("longitudeToWorldX", () => {
  it("maps -180 to 0", () => {
    expect(longitudeToWorldX(-180, 256)).toBe(0);
  });

  it("maps 0 to half world size", () => {
    expect(longitudeToWorldX(0, 256)).toBe(128);
  });

  it("maps 180 to world size", () => {
    expect(longitudeToWorldX(180, 256)).toBe(256);
  });
});

describe("latitudeToWorldY", () => {
  it("maps equator to half world size", () => {
    expect(latitudeToWorldY(0, 256)).toBe(128);
  });

  it("clamps extreme latitudes", () => {
    const y1 = latitudeToWorldY(90, 256);
    const y2 = latitudeToWorldY(MAX_LATITUDE, 256);
    expect(y1).toBeCloseTo(y2, 5);
  });
});

describe("worldXToLongitude", () => {
  it("round-trips with longitudeToWorldX", () => {
    const worldSize = 256;
    for (const lon of [-180, -90, 0, 45, 180]) {
      const x = longitudeToWorldX(lon, worldSize);
      expect(worldXToLongitude(x, worldSize)).toBeCloseTo(lon, 8);
    }
  });
});

describe("worldYToLatitude", () => {
  it("round-trips with latitudeToWorldY", () => {
    const worldSize = 256;
    for (const lat of [-60, -30, 0, 30, 60]) {
      const y = latitudeToWorldY(lat, worldSize);
      expect(worldYToLatitude(y, worldSize)).toBeCloseTo(lat, 6);
    }
  });
});

describe("cameraToViewport", () => {
  it("returns full viewport when coordinates are undefined", () => {
    const result = cameraToViewport({ coordinates: {}, zoom: 5 }, { width: 400, height: 300 });
    expect(result.west).toBe(-180);
    expect(result.east).toBe(180);
    expect(result.zoom).toBe(5);
  });

  it("clamps zoom to [0, 20]", () => {
    const result = cameraToViewport({ coordinates: {}, zoom: 25 }, { width: 400, height: 300 });
    expect(result.zoom).toBe(20);
  });

  it("returns bounded viewport for valid camera", () => {
    const result = cameraToViewport(
      { coordinates: { latitude: 0, longitude: 0 }, zoom: 10 },
      { width: 400, height: 300 },
    );
    expect(result.west).toBeLessThan(0);
    expect(result.east).toBeGreaterThan(0);
    expect(result.south).toBeLessThan(0);
    expect(result.north).toBeGreaterThan(0);
    expect(result.zoom).toBe(10);
  });
});
