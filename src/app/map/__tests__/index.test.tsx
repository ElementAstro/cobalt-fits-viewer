import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import MapScreen from "../index";
import { useFitsStore } from "../../../stores/useFitsStore";
import type { FitsMetadata } from "../../../lib/fits/types";
import type { MapClusterAction } from "../../../lib/map/types";

const mockSettingsState = {
  mapPreset: "standard" as const,
  mapShowOverlays: false,
  setAutoTagLocation: jest.fn(),
  setMapPreset: jest.fn(),
  setMapShowOverlays: jest.fn(),
};

const mockEnsurePermission = jest.fn().mockResolvedValue(true);
const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: typeof mockSettingsState) => unknown) =>
    selector(mockSettingsState),
}));

jest.mock("../../../hooks/useLocation", () => ({
  LocationService: {
    ensurePermission: (...args: unknown[]) => mockEnsurePermission(...args),
  },
}));

jest.mock("expo-constants", () => ({
  expoConfig: {
    android: {
      config: {
        googleMaps: {
          apiKey: "test-key",
        },
      },
    },
  },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
  }),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "common.goHome": "Go Home",
          "location.mapView": "Map View",
          "location.sites": "sites",
          "location.filesLabel": "files",
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
          "location.allTargets": "All Targets",
          "location.allSessions": "All Sessions",
          "location.clearAllFilters": "Clear All",
          "sessions.imageCount": "images",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../components/gallery/LocationMapView", () => {
  const React = require("react");
  const { Text, Pressable, View } = require("react-native");
  return {
    LocationMapView: ({
      files,
      onClusterAction,
    }: {
      files: Array<{ id: string }>;
      onClusterAction?: (action: MapClusterAction) => void;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, { testID: "location-map-view" }, `map-files:${files.length}`),
        React.createElement(
          Pressable,
          {
            testID: "mock-open-cluster",
            onPress: () => {
              if (files.length === 0 || !onClusterAction) return;
              onClusterAction({
                type: "open-cluster",
                zoom: 10,
                node: {
                  id: "cluster-1",
                  isCluster: true,
                  count: 1,
                  label: "cluster",
                  location: { latitude: 10, longitude: 20 },
                  files: files as FitsMetadata[],
                },
              });
            },
          },
          React.createElement(Text, null, "open-cluster"),
        ),
      ),
  };
});

jest.mock("../../../components/gallery/LocationMarkerSheet", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  return {
    LocationMarkerSheet: ({
      cluster,
      onFilePress,
      onSessionPress,
      onTargetPress,
    }: {
      cluster: { files: FitsMetadata[] } | null;
      onFilePress: (file: FitsMetadata) => void;
      onSessionPress: (sessionId: string) => void;
      onTargetPress: (targetId: string) => void;
    }) =>
      cluster
        ? React.createElement(
            View,
            null,
            React.createElement(
              Pressable,
              { testID: "mock-open-viewer", onPress: () => onFilePress(cluster.files[0]) },
              React.createElement(Text, null, "viewer"),
            ),
            React.createElement(
              Pressable,
              { testID: "mock-open-session", onPress: () => onSessionPress("session-a") },
              React.createElement(Text, null, "session"),
            ),
            React.createElement(
              Pressable,
              { testID: "mock-open-target", onPress: () => onTargetPress("target-a") },
              React.createElement(Text, null, "target"),
            ),
          )
        : null,
  };
});

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

  it("applies full filter chain (date -> object -> filter -> target -> session)", async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    useFitsStore.setState({
      files: [
        makeFile("old", {
          importDate: now - 40 * dayMs,
          dateObs: new Date(now - 40 * dayMs).toISOString(),
          object: "M31",
          filter: "Ha",
          targetId: "target-a",
          sessionId: "session-a",
          location: { latitude: 10, longitude: 20 },
        }),
        makeFile("recent1", {
          importDate: now - 2 * dayMs,
          dateObs: new Date(now - 2 * dayMs).toISOString(),
          object: "M31",
          filter: "Ha",
          targetId: "target-a",
          sessionId: "session-a",
          location: { latitude: 11, longitude: 21 },
        }),
        makeFile("recent2", {
          importDate: now - 2 * dayMs,
          dateObs: new Date(now - 2 * dayMs).toISOString(),
          object: "M42",
          filter: "OIII",
          targetId: "target-b",
          sessionId: "session-b",
          location: { latitude: 12, longitude: 22 },
        }),
      ],
    });

    render(<MapScreen />);
    expect(screen.getByText("map-files:3")).toBeTruthy();

    fireEvent.press(screen.getByTestId("e2e-action-map__index-toggle-filters"));
    fireEvent.press(screen.getByText("Last 7 Days").parent);
    fireEvent.press(screen.getByText("M31").parent);
    fireEvent.press(screen.getByText("Ha").parent);
    fireEvent.press(screen.getByText("target-a").parent);
    fireEvent.press(screen.getByText("session-a").parent);

    await waitFor(() => {
      expect(screen.getByText("map-files:1")).toBeTruthy();
    });
  });

  it("routes to viewer/session/target from marker detail actions", () => {
    useFitsStore.setState({
      files: [
        makeFile("f1", {
          targetId: "target-a",
          sessionId: "session-a",
          location: { latitude: 10, longitude: 20 },
        }),
      ],
    });

    render(<MapScreen />);

    fireEvent.press(screen.getByTestId("mock-open-cluster"));
    fireEvent.press(screen.getByTestId("mock-open-session"));

    fireEvent.press(screen.getByTestId("mock-open-cluster"));
    fireEvent.press(screen.getByTestId("mock-open-target"));

    fireEvent.press(screen.getByTestId("mock-open-cluster"));
    fireEvent.press(screen.getByTestId("mock-open-viewer"));

    expect(mockRouterPush).toHaveBeenNthCalledWith(1, "/session/session-a");
    expect(mockRouterPush).toHaveBeenNthCalledWith(2, "/target/target-a");
    expect(mockRouterPush).toHaveBeenNthCalledWith(3, "/viewer/f1");
  });
});
