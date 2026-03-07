import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import Screen from "../targets";

const mockPush = jest.fn();
const mockAddTarget = jest.fn();
const mockScanAndAutoDetect = jest.fn(() => ({
  scannedCount: 12,
  newCount: 3,
  updatedCount: 4,
  skippedCount: 5,
}));
const mockSummaryDialogProps = jest.fn();
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

jest.mock("../../../hooks/common/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isLandscapeTablet: true,
    contentPaddingTop: 0,
    horizontalPadding: 0,
    sidePanelWidth: 320,
  }),
}));

jest.mock("../../../hooks/targets/useTargets", () => ({
  useTargets: () => ({
    targets: [],
    groups: [],
    addTarget: mockAddTarget,
    addGroup: jest.fn(),
    updateGroup: jest.fn(),
    removeGroup: jest.fn(),
    removeTarget: jest.fn(),
    scanAndAutoDetect: mockScanAndAutoDetect,
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

jest.mock("../../../hooks/targets/useTargetStatistics", () => ({
  useTargetStatistics: () => ({
    statistics: null,
    monthlyStats: [],
  }),
}));

jest.mock("../../../hooks/targets/useTargetSearch", () => ({
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

jest.mock("../../../stores/files/useFitsStore", () => ({
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

jest.mock("../../../stores/app/useSettingsStore", () => ({
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

jest.mock("../../../components/targets/TargetListHeader", () => {
  const R = require("react");
  const RN = require("react-native");
  const { View, Pressable, Text } = RN;
  return {
    TargetListHeader: (props: Record<string, unknown>) =>
      R.createElement(
        View,
        { testID: "mock-target-list-header" },
        R.createElement(
          Pressable,
          { testID: "e2e-action-tabs__targets-scan", onPress: props.onScanTargets as () => void },
          R.createElement(Text, null, "scan"),
        ),
        R.createElement(
          Pressable,
          {
            testID: "e2e-action-tabs__targets-open-add",
            onPress: props.onShowAddSheet as () => void,
          },
          R.createElement(Text, null, "add"),
        ),
      ),
    TargetSearchBar: () => R.createElement(View, { testID: "mock-search-bar" }),
  };
});

jest.mock("../../../components/targets/TargetBatchActionBar", () => ({
  TargetBatchActionBar: () => null,
}));

jest.mock("../../../components/common/EmptyState", () => ({
  EmptyState: () => null,
}));

jest.mock("../../../components/common/OperationSummaryDialog", () => ({
  OperationSummaryDialog: (props: Record<string, unknown>) => {
    mockSummaryDialogProps(props);
    if (!props.visible) return null;
    const ReactLocal = require("react");
    const { View, Text } = require("react-native");
    return ReactLocal.createElement(
      View,
      { testID: "operation-summary-dialog" },
      ReactLocal.createElement(Text, { testID: "summary-dialog-title" }, props.title),
    );
  },
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

  it("shows full scan summary dialog", () => {
    render(<Screen />);
    fireEvent.press(screen.getByTestId("e2e-action-tabs__targets-scan"));

    expect(mockScanAndAutoDetect).toHaveBeenCalled();
    expect(screen.getByTestId("operation-summary-dialog")).toBeTruthy();
    expect(screen.getByTestId("summary-dialog-title").props.children).toBe(
      "targets.scanSummaryTitle",
    );
    const lastCall = mockSummaryDialogProps.mock.calls.at(-1)?.[0];
    expect(lastCall?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "targets.scanSummaryScanned", value: 12 }),
        expect.objectContaining({ label: "targets.scanSummaryAdded", value: 3 }),
        expect.objectContaining({ label: "targets.scanSummaryUpdated", value: 4 }),
        expect.objectContaining({ label: "targets.scanSummarySkipped", value: 5 }),
      ]),
    );
  });
});
