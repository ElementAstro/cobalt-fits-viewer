import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as ExpoLocation from "expo-location";
import { LocationService, useLocation } from "../useLocation";

jest.mock("expo-location", () => ({
  Accuracy: {
    Balanced: "balanced",
  },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

jest.mock("../../lib/logger", () => {
  const actual = jest.requireActual("../../lib/logger") as typeof import("../../lib/logger");
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

const getForegroundPermissionsAsync = ExpoLocation.getForegroundPermissionsAsync as jest.Mock;
const requestForegroundPermissionsAsync =
  ExpoLocation.requestForegroundPermissionsAsync as jest.Mock;
const reverseGeocodeAsync = ExpoLocation.reverseGeocodeAsync as jest.Mock;
const getCurrentPositionAsync = ExpoLocation.getCurrentPositionAsync as jest.Mock;
const getLastKnownPositionAsync = ExpoLocation.getLastKnownPositionAsync as jest.Mock;

describe("LocationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    LocationService.clearCache();

    getForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    reverseGeocodeAsync.mockResolvedValue([{ name: "My Place", city: "My City" }]);
    getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 10,
        longitude: 20,
        altitude: 100,
      },
    });
    getLastKnownPositionAsync.mockResolvedValue({
      coords: {
        latitude: 11,
        longitude: 21,
        altitude: 101,
      },
    });
  });

  it("checkPermission returns true when status is granted", async () => {
    await expect(LocationService.checkPermission()).resolves.toBe(true);
  });

  it("ensurePermission requests permission when check is denied", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });

    await expect(LocationService.ensurePermission()).resolves.toBe(true);
    expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("ensurePermission does not request permission when already granted", async () => {
    await expect(LocationService.ensurePermission()).resolves.toBe(true);
    expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("getCurrentLocation returns location and caches it", async () => {
    const first = await LocationService.getCurrentLocation();
    const second = await LocationService.getCurrentLocation();

    expect(first).toEqual({
      latitude: 10,
      longitude: 20,
      altitude: 100,
      placeName: "My Place",
      city: "My City",
    });
    expect(second).toBe(first);
    expect(getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(reverseGeocodeAsync).toHaveBeenCalledTimes(1);
  });

  it("falls back to last known location when GPS fetch fails", async () => {
    getCurrentPositionAsync.mockRejectedValue(new Error("gps timeout"));
    getLastKnownPositionAsync.mockResolvedValue({
      coords: {
        latitude: 30,
        longitude: 40,
        altitude: 50,
      },
    });

    const loc = await LocationService.getCurrentLocation();
    expect(loc).toEqual({
      latitude: 30,
      longitude: 40,
      altitude: 50,
      placeName: "My Place",
      city: "My City",
    });
    expect(getLastKnownPositionAsync).toHaveBeenCalledTimes(1);
  });

  it("returns null when both GPS and last known location fail", async () => {
    getCurrentPositionAsync.mockRejectedValue(new Error("gps timeout"));
    getLastKnownPositionAsync.mockRejectedValue(new Error("no cache"));

    await expect(LocationService.getCurrentLocation()).resolves.toBeNull();
  });

  it("reverseGeocode returns empty object on failure", async () => {
    reverseGeocodeAsync.mockRejectedValue(new Error("service unavailable"));
    await expect(LocationService.reverseGeocode(1, 2)).resolves.toEqual({});
  });

  it("formatLocation uses fallback priority", () => {
    expect(LocationService.formatLocation(null)).toBe("");
    expect(
      LocationService.formatLocation({
        latitude: 1.123456,
        longitude: 2.123456,
        placeName: "Place",
        city: "City",
      }),
    ).toBe("Place");
    expect(
      LocationService.formatLocation({
        latitude: 1.123456,
        longitude: 2.123456,
        city: "City",
      }),
    ).toBe("City");
    expect(
      LocationService.formatLocation({
        latitude: 1.123456,
        longitude: 2.123456,
        region: "Region",
      }),
    ).toBe("Region");
    expect(
      LocationService.formatLocation({
        latitude: 1.123456,
        longitude: 2.123456,
      }),
    ).toBe("1.1235, 2.1235");
  });
});

describe("useLocation hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    LocationService.clearCache();

    getForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    reverseGeocodeAsync.mockResolvedValue([{ name: "Hook Place", city: "Hook City" }]);
    getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 10,
        longitude: 20,
        altitude: 100,
      },
    });
    getLastKnownPositionAsync.mockResolvedValue(null);
  });

  it("checks permission on mount", async () => {
    const { result } = renderHook(() => useLocation());

    await waitFor(() => {
      expect(result.current.permissionGranted).toBe(true);
    });
  });

  it("sets error when getCurrentLocation returns null", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });

    const { result } = renderHook(() => useLocation());

    await act(async () => {
      const loc = await result.current.getCurrentLocation();
      expect(loc).toBeNull();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Location permission denied or unavailable");
  });

  it("requestPermission updates permissionGranted when denied", async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });

    const { result } = renderHook(() => useLocation());

    await act(async () => {
      const granted = await result.current.requestPermission();
      expect(granted).toBe(false);
    });

    expect(result.current.permissionGranted).toBe(false);
  });
});
