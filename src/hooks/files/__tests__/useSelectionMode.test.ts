import { act, renderHook } from "@testing-library/react-native";
import { useSelectionMode } from "../useSelectionMode";

describe("useSelectionMode", () => {
  it("toggles selection by id", () => {
    const { result } = renderHook(() => useSelectionMode());

    act(() => {
      result.current.toggleSelection("a");
    });
    expect(result.current.selectedIds).toEqual(["a"]);
    expect(result.current.isSelectionMode).toBe(true);

    act(() => {
      result.current.toggleSelection("a");
    });
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isSelectionMode).toBe(false);
  });

  it("enters and exits selection mode", () => {
    const { result } = renderHook(() => useSelectionMode());

    act(() => {
      result.current.enterSelectionMode("f1");
    });
    expect(result.current.isSelectionMode).toBe(true);
    expect(result.current.selectedIds).toEqual(["f1"]);

    act(() => {
      result.current.exitSelectionMode();
    });
    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedIds).toEqual([]);
  });

  it("selects all ids", () => {
    const { result } = renderHook(() => useSelectionMode());

    act(() => {
      result.current.selectAll(["a", "b", "a", "c", "b"]);
    });
    expect(result.current.selectedIds).toEqual(["a", "b", "c"]);
    expect(result.current.isSelectionMode).toBe(true);
  });

  it("reconciles selection with visible ids", () => {
    const { result } = renderHook(() => useSelectionMode());

    act(() => {
      result.current.selectAll(["a", "b", "c"]);
    });
    expect(result.current.selectedIds).toEqual(["a", "b", "c"]);

    act(() => {
      result.current.reconcileSelection(["a", "c", "d"]);
    });
    expect(result.current.selectedIds).toEqual(["a", "c"]);
    expect(result.current.isSelectionMode).toBe(true);

    act(() => {
      result.current.reconcileSelection(["x", "y"]);
    });
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isSelectionMode).toBe(false);
  });
});
