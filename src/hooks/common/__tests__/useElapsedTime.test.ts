/**
 * useElapsedTime Hook 测试
 */

import { renderHook, act } from "@testing-library/react-native";
import { useElapsedTime } from "../useElapsedTime";

jest.mock("../../../lib/astrometry/formatUtils", () => ({
  formatDuration: (ms: number) => `${Math.floor(ms / 1000)}s`,
}));

describe("useElapsedTime", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns '0s' when not active", () => {
    const { result } = renderHook(() => useElapsedTime(Date.now(), false));
    expect(result.current).toBe("0s");
  });

  it("returns elapsed time when active", () => {
    const startTime = Date.now() - 5000;
    const { result } = renderHook(() => useElapsedTime(startTime, true));
    expect(result.current).toBe("5s");
  });

  it("increments elapsed when active", () => {
    const startTime = Date.now();
    const { result } = renderHook(() => useElapsedTime(startTime, true));
    expect(result.current).toBe("0s");

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current).toBe("3s");
  });

  it("stops updating when isActive becomes false", () => {
    const startTime = Date.now();
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useElapsedTime(startTime, active),
      { initialProps: { active: true } },
    );

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current).toBe("2s");

    rerender({ active: false });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // Should still show 2s since timer stopped
    expect(result.current).toBe("2s");
  });

  it("uses custom format function when provided", () => {
    const startTime = Date.now() - 5000;
    const customFormat = (ms: number) => `${ms}ms`;
    const { result } = renderHook(() => useElapsedTime(startTime, true, customFormat));
    expect(result.current).toBe("5000ms");
  });
});
