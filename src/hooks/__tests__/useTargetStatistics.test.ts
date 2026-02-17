import { renderHook } from "@testing-library/react-native";
import { useTargetStatistics } from "../useTargetStatistics";

jest.mock("../../stores/useTargetStore", () => ({
  useTargetStore: jest.fn(),
}));
jest.mock("../../stores/useFitsStore", () => ({
  useFitsStore: jest.fn(),
}));
jest.mock("../../lib/targets/targetStatistics", () => ({
  calculateTargetStatistics: jest.fn(),
  getMonthlyStatistics: jest.fn(),
  getProgressOverview: jest.fn(),
  formatExposureHours: jest.fn((v: number) => `${v}h`),
}));

const { useTargetStore } = jest.requireMock("../../stores/useTargetStore") as {
  useTargetStore: jest.Mock;
};
const { useFitsStore } = jest.requireMock("../../stores/useFitsStore") as {
  useFitsStore: jest.Mock;
};
const targetStatsLib = jest.requireMock("../../lib/targets/targetStatistics") as {
  calculateTargetStatistics: jest.Mock;
  getMonthlyStatistics: jest.Mock;
  getProgressOverview: jest.Mock;
  formatExposureHours: jest.Mock;
};

describe("useTargetStatistics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const targets = [
      { id: "t1", isFavorite: true, isPinned: false, imageIds: ["f1"] },
      { id: "t2", isFavorite: false, isPinned: true, imageIds: [] },
    ];
    const files = [{ id: "f1" }];
    useTargetStore.mockImplementation((selector: (s: { targets: unknown[] }) => unknown) =>
      selector({ targets }),
    );
    useFitsStore.mockImplementation((selector: (s: { files: unknown[] }) => unknown) =>
      selector({ files }),
    );
    targetStatsLib.calculateTargetStatistics.mockReturnValue({
      totalExposureSeconds: 7200,
      totalFrames: 20,
    });
    targetStatsLib.getMonthlyStatistics.mockReturnValue([{ month: "2025-01", frames: 10 }]);
    targetStatsLib.getProgressOverview.mockReturnValue({ completed: 1, total: 2 });
  });

  it("returns computed statistics and quick stats", () => {
    const { result } = renderHook(() => useTargetStatistics());

    expect(targetStatsLib.calculateTargetStatistics).toHaveBeenCalled();
    expect(targetStatsLib.getMonthlyStatistics).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      12,
    );
    expect(targetStatsLib.getProgressOverview).toHaveBeenCalled();
    expect(result.current.quickStats).toEqual({
      total: 2,
      favorites: 1,
      pinned: 1,
      withImages: 1,
      totalExposure: 7200,
      totalFrames: 20,
    });
  });

  it("exposes formatExposureHours helper", () => {
    const { result } = renderHook(() => useTargetStatistics());

    expect(result.current.formatExposureHours(2)).toBe("2h");
    expect(targetStatsLib.formatExposureHours).toHaveBeenCalledWith(2);
  });
});
