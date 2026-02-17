import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import MapScreen from "../index";
import { useFitsStore } from "../../../stores/useFitsStore";
import type { FitsMetadata } from "../../../lib/fits/types";

const mockSettingsState = {
  mapPreset: "standard" as const,
  mapShowOverlays: false,
  setAutoTagLocation: jest.fn(),
  setMapPreset: jest.fn(),
  setMapShowOverlays: jest.fn(),
};

const mockEnsurePermission = jest.fn().mockResolvedValue(true);

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: typeof mockSettingsState) => unknown) =>
    selector(mockSettingsState),
}));

jest.mock("../../../hooks/useLocation", () => ({
  LocationService: {
    ensurePermission: (...args: unknown[]) => mockEnsurePermission(...args),
  },
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "common.goHome": "Go Home",
          "location.mapView": "Map View",
          "location.sites": "sites",
          "location.noLocationData": "No location data available",
          "location.emptyStateHint": "Import files with location data or enable auto-tagging",
          "location.enableAutoTag": "Enable Auto Tag",
          "location.goImport": "Import Files",
          "location.presetStandard": "Standard",
          "location.presetDark": "Astronomy Dark",
          "location.presetSatellite": "Satellite",
          "location.preset3D": "3D Terrain",
          "location.allDates": "All Dates",
          "location.last7Days": "Last 7 Days",
          "location.last30Days": "Last 30 Days",
          "location.last90Days": "Last 90 Days",
          "location.last1Year": "Last 1 Year",
          "location.allObjects": "All Objects",
          "location.allFilters": "All Filters",
          "sessions.imageCount": "images",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../components/gallery/LocationMapView", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    LocationMapView: ({ files }: { files: Array<{ id: string }> }) =>
      React.createElement(Text, { testID: "location-map-view" }, `map-files:${files.length}`),
  };
});

jest.mock("../../../components/gallery/LocationMarkerSheet", () => ({
  LocationMarkerSheet: () => null,
}));

jest.mock("../../../hooks/useScreenOrientation", () => ({
  useScreenOrientation: () => ({
    isLandscape: false,
    isPortrait: true,
    orientation: 1,
    screenWidth: 390,
    screenHeight: 844,
    lockOrientation: jest.fn(),
    unlockOrientation: jest.fn(),
  }),
}));

function makeFile(id: string, overrides: Partial<FitsMetadata> = {}): FitsMetadata {
  return {
    id,
    filename: `${id}.fits`,
    filepath: `file:///tmp/${id}.fits`,
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  };
}

function pressByText(text: string) {
  const node = screen.getByText(text);
  fireEvent.press(node.parent);
}

describe("MapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsState.mapPreset = "standard";
    mockSettingsState.mapShowOverlays = false;

    useFitsStore.setState({
      files: [],
      selectedIds: [],
      isSelectionMode: false,
      sortBy: "date",
      sortOrder: "desc",
      searchQuery: "",
      filterTags: [],
    });
  });

  it("renders empty state when no files have location", () => {
    useFitsStore.setState({
      files: [makeFile("f1"), makeFile("f2", { location: undefined })],
    });

    render(<MapScreen />);

    expect(screen.getByText("No location data available")).toBeTruthy();
    expect(screen.getByText("Enable Auto Tag")).toBeTruthy();
  });

  it("renders map view when location files exist", () => {
    useFitsStore.setState({
      files: [
        makeFile("f1", {
          location: { latitude: 10, longitude: 20 },
        }),
        makeFile("f2", {
          location: { latitude: 11, longitude: 21 },
        }),
      ],
    });

    render(<MapScreen />);

    expect(screen.getByTestId("location-map-view")).toBeTruthy();
    expect(screen.getByText("map-files:2")).toBeTruthy();
    expect(mockEnsurePermission).toHaveBeenCalled();
  });

  it("updates map file count when date filter changes", async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    useFitsStore.setState({
      files: [
        makeFile("old", {
          importDate: now - 40 * dayMs,
          dateObs: new Date(now - 40 * dayMs).toISOString(),
          location: { latitude: 10, longitude: 20 },
        }),
        makeFile("recent", {
          importDate: now - 2 * dayMs,
          dateObs: new Date(now - 2 * dayMs).toISOString(),
          location: { latitude: 11, longitude: 21 },
        }),
      ],
    });

    render(<MapScreen />);

    expect(screen.getByText("map-files:2")).toBeTruthy();

    pressByText("filter");
    pressByText("Last 7 Days");

    await waitFor(() => {
      expect(screen.getByText("map-files:1")).toBeTruthy();
    });
  });
});
