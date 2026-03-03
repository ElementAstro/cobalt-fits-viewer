import { act, renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useHapticFeedback } from "../useHapticFeedback";
import { flushPromises } from "./helpers/testUtils";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: "Light",
    Medium: "Medium",
  },
  NotificationFeedbackType: {
    Success: "Success",
    Error: "Error",
  },
}));

jest.mock("../../stores/useSettingsStore", () => ({
  useSettingsStore: jest.fn(),
}));

const { useSettingsStore } = jest.requireMock("../../stores/useSettingsStore") as {
  useSettingsStore: jest.Mock;
};
const selectionAsyncMock = Haptics.selectionAsync as jest.Mock;
const impactAsyncMock = Haptics.impactAsync as jest.Mock;
const notificationAsyncMock = Haptics.notificationAsync as jest.Mock;

describe("useHapticFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.mockImplementation(
      (selector: (state: { hapticsEnabled: boolean }) => unknown) =>
        selector({ hapticsEnabled: true }),
    );
    selectionAsyncMock.mockResolvedValue(undefined);
    impactAsyncMock.mockResolvedValue(undefined);
    notificationAsyncMock.mockResolvedValue(undefined);
  });

  it("does not trigger haptics when disabled", () => {
    useSettingsStore.mockImplementation(
      (selector: (state: { hapticsEnabled: boolean }) => unknown) =>
        selector({ hapticsEnabled: false }),
    );
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.selection();
      result.current.impact();
      result.current.notify();
    });

    expect(selectionAsyncMock).not.toHaveBeenCalled();
    expect(impactAsyncMock).not.toHaveBeenCalled();
    expect(notificationAsyncMock).not.toHaveBeenCalled();
  });

  it("triggers default and custom feedback types", async () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.selection();
      result.current.impact(Haptics.ImpactFeedbackStyle.Light);
      result.current.notify(Haptics.NotificationFeedbackType.Error);
    });
    await flushPromises();

    expect(selectionAsyncMock).toHaveBeenCalledTimes(1);
    expect(impactAsyncMock).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(notificationAsyncMock).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it("swallows async failures safely", async () => {
    selectionAsyncMock.mockRejectedValue(new Error("native error"));
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.selection();
    });
    await flushPromises();

    expect(selectionAsyncMock).toHaveBeenCalledTimes(1);
  });
});
