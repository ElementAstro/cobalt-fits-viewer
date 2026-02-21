import { act, renderHook } from "@testing-library/react-native";
import { useSettingsPicker } from "../useSettingsPicker";

describe("useSettingsPicker", () => {
  it("opens and closes picker", () => {
    const { result } = renderHook(() => useSettingsPicker());

    expect(result.current.activePicker).toBeNull();

    act(() => {
      result.current.openPicker("theme");
    });
    expect(result.current.activePicker).toBe("theme");
    expect(result.current.isActive("theme")).toBe(true);

    act(() => {
      result.current.closePicker();
    });
    expect(result.current.activePicker).toBeNull();
    expect(result.current.isActive("theme")).toBe(false);
  });

  it("supports target interaction pickers", () => {
    const { result } = renderHook(() => useSettingsPicker());

    act(() => {
      result.current.openPicker("targetActionControlMode");
    });
    expect(result.current.activePicker).toBe("targetActionControlMode");
    expect(result.current.isActive("targetActionControlMode")).toBe(true);

    act(() => {
      result.current.openPicker("targetActionSizePreset");
    });
    expect(result.current.activePicker).toBe("targetActionSizePreset");
    expect(result.current.isActive("targetActionSizePreset")).toBe(true);
  });
});
