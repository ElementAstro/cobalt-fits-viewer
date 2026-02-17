import { act, renderHook } from "@testing-library/react-native";
import { useDuplicateDetection } from "../useTargetSearch";

jest.mock("../../stores/useTargetStore", () => ({
  useTargetStore: jest.fn(),
}));

jest.mock("../useTargets", () => ({
  useTargets: jest.fn(),
}));

jest.mock("../../lib/targets/duplicateDetector", () => ({
  detectDuplicates: jest.fn(),
  findDuplicatesOf: jest.fn(),
}));

const { useTargetStore } = jest.requireMock("../../stores/useTargetStore") as {
  useTargetStore: jest.Mock;
};
const { useTargets } = jest.requireMock("../useTargets") as {
  useTargets: jest.Mock;
};
const duplicateLib = jest.requireMock("../../lib/targets/duplicateDetector") as {
  detectDuplicates: jest.Mock;
  findDuplicatesOf: jest.Mock;
};

describe("useDuplicateDetection", () => {
  const mergeTargetsCascade = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const targets = [
      { id: "t1", imageIds: ["f1", "f2"] },
      { id: "t2", imageIds: ["f3"] },
    ];
    useTargetStore.mockImplementation((selector: (s: { targets: typeof targets }) => unknown) =>
      selector({ targets }),
    );
    useTargets.mockReturnValue({ mergeTargetsCascade });
    duplicateLib.detectDuplicates.mockReturnValue({ groups: [] });
    duplicateLib.findDuplicatesOf.mockReturnValue([{ id: "t2" }]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("detects duplicates asynchronously", () => {
    const { result } = renderHook(() => useDuplicateDetection());

    act(() => {
      result.current.detect();
    });
    expect(result.current.isDetecting).toBe(true);

    act(() => {
      jest.runAllTimers();
    });
    expect(duplicateLib.detectDuplicates).toHaveBeenCalled();
    expect(result.current.isDetecting).toBe(false);
    expect(result.current.detectionResult).toEqual({ groups: [] });
  });

  it("finds and clears detection", () => {
    const { result } = renderHook(() => useDuplicateDetection());

    expect(result.current.findDuplicates("t1")).toEqual([{ id: "t2" }]);

    act(() => {
      result.current.clearDetection();
    });
    expect(result.current.detectionResult).toBeNull();
  });

  it("merges only when group has at least two targets and re-detects", () => {
    const { result } = renderHook(() => useDuplicateDetection());
    const single = { targets: [{ id: "t1", imageIds: ["f1"] }] };
    const pair = {
      targets: [
        { id: "t1", imageIds: ["f1", "f2"] },
        { id: "t2", imageIds: ["f3"] },
      ],
    };

    act(() => {
      result.current.mergeDuplicates(single as never);
    });
    expect(mergeTargetsCascade).not.toHaveBeenCalled();

    act(() => {
      result.current.mergeDuplicates(pair as never);
    });
    expect(mergeTargetsCascade).toHaveBeenCalledWith("t1", "t2");
    act(() => {
      jest.runAllTimers();
    });
    expect(duplicateLib.detectDuplicates).toHaveBeenCalled();
  });
});
