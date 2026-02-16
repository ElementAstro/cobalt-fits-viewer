import { renderHook, act } from "@testing-library/react-native";
import { useImageComparison } from "../useImageComparison";

describe("useImageComparison", () => {
  it("normalizes legacy overlay mode to split", () => {
    const { result } = renderHook(() =>
      useImageComparison({ initialIds: ["a", "b", "c"], initialMode: "overlay" }),
    );
    expect(result.current.mode).toBe("split");
    expect(result.current.imageIds).toEqual(["a", "b"]);
  });

  it("limits ids to two and replaces second on add", () => {
    const { result } = renderHook(() => useImageComparison({ initialIds: ["a", "b"] }));
    act(() => {
      result.current.addImage("c");
    });
    expect(result.current.imageIds).toEqual(["a", "c"]);
  });

  it("blink playback changes active index", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useImageComparison({ initialIds: ["a", "b"] }));
    act(() => {
      result.current.toggleBlinkPlay();
    });
    act(() => {
      jest.advanceTimersByTime(1600);
    });
    expect(result.current.activeIndex).toBe(1);
    jest.useRealTimers();
  });
});
