import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import Screen from "../targets";

const mockPush = jest.fn();
const mockAddTarget = jest.fn();
const mockAddTargetSheet = jest.fn((props: Record<string, unknown>) => {
  const ReactNative = require("react-native");
  const { Pressable, Text, View } = ReactNative;
  if (!props.visible) {
    return React.createElement(View, { testID: "mock-add-target-sheet-hidden" });
  }
  return React.createElement(
    Pressable,
    {
      testID: "mock-add-target-sheet-submit",
      onPress: () =>
        (props.onConfirm as (payload: Record<string, unknown>) => void)({
          name: "M42",
          type: "nebula",
          ra: 84,
          dec: 22.014,
          notes: "from test",
        }),
    },
    React.createElement(Text, null, "submit"),
  );
});

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isLandscapeTablet: true,
    contentPaddingTop: 0,
    horizontalPadding: 0,
    sidePanelWidth: 320,
  }),
}));

jest.mock("../../../hooks/useTargets", () => ({
  useTargets: () => ({
    targets: [],
    groups: [],
    addTarget: mockAddTarget,
    addGroup: jest.fn(),
    updateGroup: jest.fn(),
    removeGroup: jest.fn(),
    scanAndAutoDetect: jest.fn(() => ({ newCount: 0 })),
    getTargetStats: jest.fn(() => ({
      imageCount: 0,
      exposureStats: { totalExposure: 0 },
      completionPercent: 0,
    })),
    toggleFavorite: jest.fn(),
    togglePinned: jest.fn(),
    allTags: [],
    allCategories: [],
  }),
}));

jest.mock("../../../hooks/useTargetStatistics", () => ({
  useTargetStatistics: () => ({
    statistics: null,
    monthlyStats: [],
  }),
}));

jest.mock("../../../hooks/useTargetSearch", () => ({
  useTargetSearch: () => ({
    query: "",
    setQuery: jest.fn(),
    conditions: {},
    setConditions: jest.fn(),
    isAdvancedMode: false,
    setIsAdvancedMode: jest.fn(),
    results: [],
    clearAllConditions: jest.fn(),
  }),
  useDuplicateDetection: () => ({
    detectionResult: null,
    isDetecting: false,
    detect: jest.fn(),
    mergeDuplicates: jest.fn(),
    clearDetection: jest.fn(),
  }),
}));

jest.mock("../../../stores/useFitsStore", () => ({
  useFitsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      files: [],
    }),
}));

const mockSettingsStore = {
  targetSortBy: "name",
  targetSortOrder: "asc",
  targetActionControlMode: "icon",
  targetActionSizePreset: "standard",
  targetActionAutoScaleFromFont: true,
  setTargetSortBy: jest.fn(),
  setTargetSortOrder: jest.fn(),
};

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: typeof mockSettingsStore) => unknown) =>
    selector(mockSettingsStore),
}));

jest.mock("../../../components/targets/AddTargetSheet", () => ({
  AddTargetSheet: (props: Record<string, unknown>) => mockAddTargetSheet(props),
}));

jest.mock("../../../components/targets/TargetCard", () => ({
  TargetCard: () => null,
}));

jest.mock("../../../components/targets/StatisticsDashboard", () => ({
  StatisticsDashboard: () => null,
}));

jest.mock("../../../components/targets/AdvancedSearchSheet", () => ({
  AdvancedSearchSheet: () => null,
}));

jest.mock("../../../components/targets/DuplicateMergeSheet", () => ({
  DuplicateMergeSheet: () => null,
}));

jest.mock("../../../components/targets/GroupManagerSheet", () => ({
  GroupManagerSheet: () => null,
}));

jest.mock("../../../components/common/EmptyState", () => ({
  EmptyState: () => null,
}));

describe("(tabs)/targets.tsx", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens add sheet and submits typed coordinates payload", () => {
    render(<Screen />);

    fireEvent.press(screen.getByTestId("e2e-action-tabs__targets-open-add"));
    fireEvent.press(screen.getByTestId("mock-add-target-sheet-submit"));

    expect(mockAddTarget).toHaveBeenCalledWith(
      "M42",
      "nebula",
      expect.objectContaining({
        ra: 84,
        dec: 22.014,
        notes: "from test",
      }),
    );
    expect(mockAddTargetSheet).toHaveBeenCalled();
  });
});
