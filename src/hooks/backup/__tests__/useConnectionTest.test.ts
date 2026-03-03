/**
 * useConnectionTest hook 测试
 */

import { renderHook, act } from "@testing-library/react-native";
import { useConnectionTest } from "../useConnectionTest";

describe("useConnectionTest", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts with testing=false and testResult=null", () => {
    const { result } = renderHook(() => useConnectionTest({ onClose }));
    expect(result.current.testing).toBe(false);
    expect(result.current.testResult).toBeNull();
  });

  it("sets testing=true during runTest execution", async () => {
    let resolveFn: (v: boolean) => void;
    const asyncFn = () =>
      new Promise<boolean>((resolve) => {
        resolveFn = resolve;
      });

    const { result } = renderHook(() => useConnectionTest({ onClose }));

    let promise: Promise<void>;
    act(() => {
      promise = result.current.runTest(asyncFn);
    });

    expect(result.current.testing).toBe(true);

    await act(async () => {
      resolveFn!(true);
      await promise!;
    });

    expect(result.current.testing).toBe(false);
  });

  it("sets testResult=true on success", async () => {
    const asyncFn = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useConnectionTest({ onClose }));

    await act(async () => {
      await result.current.runTest(asyncFn);
    });

    expect(result.current.testResult).toBe(true);
  });

  it("sets testResult=false on failure", async () => {
    const asyncFn = jest.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useConnectionTest({ onClose }));

    await act(async () => {
      await result.current.runTest(asyncFn);
    });

    expect(result.current.testResult).toBe(false);
  });

  it("sets testResult=false when async function throws", async () => {
    const asyncFn = jest.fn().mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useConnectionTest({ onClose }));

    await act(async () => {
      await result.current.runTest(asyncFn);
    });

    expect(result.current.testResult).toBe(false);
  });

  it("auto-closes after delay on success", async () => {
    const asyncFn = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useConnectionTest({ onClose }));

    await act(async () => {
      await result.current.runTest(asyncFn);
    });

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not auto-close on failure", async () => {
    const asyncFn = jest.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useConnectionTest({ onClose }));

    await act(async () => {
      await result.current.runTest(asyncFn);
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("handleClose resets testResult and calls onClose", async () => {
    const asyncFn = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useConnectionTest({ onClose }));

    await act(async () => {
      await result.current.runTest(asyncFn);
    });

    expect(result.current.testResult).toBe(true);

    const resetFields = jest.fn();
    act(() => {
      result.current.handleClose(resetFields);
    });

    expect(resetFields).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.testResult).toBeNull();
  });

  it("resetTest clears testResult without closing", async () => {
    const asyncFn = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useConnectionTest({ onClose }));

    await act(async () => {
      await result.current.runTest(asyncFn);
    });

    expect(result.current.testResult).toBe(true);

    act(() => {
      result.current.resetTest();
    });

    expect(result.current.testResult).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses custom autoCloseDelayMs", async () => {
    const asyncFn = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useConnectionTest({ onClose, autoCloseDelayMs: 500 }));

    await act(async () => {
      await result.current.runTest(asyncFn);
    });

    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
