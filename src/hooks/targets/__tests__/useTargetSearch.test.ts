import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useTargetSearch } from "../useTargetSearch";

jest.mock("../../stores/useTargetStore", () => ({
  useTargetStore: jest.fn(),
}));

jest.mock("../../lib/targets/targetSearch", () => ({
  searchTargets: jest.fn(),
}));

const { useTargetStore } = jest.requireMock("../../stores/useTargetStore") as {
  useTargetStore: jest.Mock;
};
const targetSearchLib = jest.requireMock("../../lib/targets/targetSearch") as {
  searchTargets: jest.Mock;
};

describe("useTargetSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const targets = [
      { id: "t1", name: "M31", aliases: [], tags: ["andromeda"], imageIds: [] },
      { id: "t2", name: "M42", aliases: [], tags: ["orion"], imageIds: [] },
    ];
    useTargetStore.mockImplementation((selector: (s: { targets: typeof targets }) => unknown) =>
      selector({ targets }),
    );
    targetSearchLib.searchTargets.mockReturnValue({
      targets: [targets[1]],
      matchCount: 1,
      conditions: { query: "m42" },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("runs quick search in basic mode with debounce", async () => {
    const { result } = renderHook(() => useTargetSearch());

    act(() => {
      result.current.setQuery("m3");
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(result.current.results).toEqual([
        { id: "t1", name: "M31", aliases: [], tags: ["andromeda"], imageIds: [] },
      ]);
      expect(result.current.matchCount).toBe(1);
    });
  });

  it("runs advanced search and supports condition operations", async () => {
    const { result } = renderHook(() => useTargetSearch());

    act(() => {
      result.current.setIsAdvancedMode(true);
      result.current.updateCondition("query", "m42");
      result.current.setQuery("m42");
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await waitFor(() => {
      expect(targetSearchLib.searchTargets).toHaveBeenCalled();
    });
    expect(result.current.matchCount).toBe(1);

    act(() => {
      result.current.clearCondition("query");
    });

    act(() => {
      result.current.clearAllConditions();
    });
    expect(result.current.query).toBe("");

    act(() => {
      result.current.reset();
    });
    expect(result.current.isAdvancedMode).toBe(false);
  });

  it("returns suggestions only when query length >= 2", async () => {
    const { result } = renderHook(() => useTargetSearch());

    act(() => {
      result.current.setQuery("m");
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(result.current.suggestions).toEqual([]);

    act(() => {
      result.current.setQuery("m3");
    });
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await waitFor(() => {
      expect(result.current.suggestions).toContain("M31");
    });
  });
});
