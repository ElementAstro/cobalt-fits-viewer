import { renderHook } from "@testing-library/react-native";
import { useFontLoader } from "../useFontLoader";
import { useFonts } from "expo-font";

jest.mock("expo-font", () => ({
  useFonts: jest.fn(),
}));

const useFontsMock = useFonts as jest.Mock;

describe("useFontLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns fonts loading result from expo-font", () => {
    const error = new Error("font load failed");
    useFontsMock.mockReturnValue([false, error]);

    const { result } = renderHook(() => useFontLoader());

    expect(result.current.fontsLoaded).toBe(false);
    expect(result.current.fontError).toBe(error);
  });

  it("returns loaded state when fonts are ready", () => {
    useFontsMock.mockReturnValue([true, null]);

    const { result } = renderHook(() => useFontLoader());

    expect(result.current.fontsLoaded).toBe(true);
    expect(result.current.fontError).toBeNull();
  });
});
