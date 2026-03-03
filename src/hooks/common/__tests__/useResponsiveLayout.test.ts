import { renderHook } from "@testing-library/react-native";
import { useResponsiveLayout } from "../useResponsiveLayout";
import { useScreenOrientation } from "../useScreenOrientation";

jest.mock("../useScreenOrientation");

const mockUseScreenOrientation = useScreenOrientation as jest.MockedFunction<
  typeof useScreenOrientation
>;

function setOrientationState(width: number, height: number) {
  mockUseScreenOrientation.mockReturnValue({
    isLandscape: width > height,
    isPortrait: width <= height,
    orientation: width > height ? 3 : 1,
    screenWidth: width,
    screenHeight: height,
    lockOrientation: jest.fn(),
    unlockOrientation: jest.fn(),
  });
}

describe("useResponsiveLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns portrait layout values", () => {
    setOrientationState(390, 844);

    const { result } = renderHook(() => useResponsiveLayout());

    expect(result.current.layoutMode).toBe("portrait");
    expect(result.current.isLandscape).toBe(false);
    expect(result.current.isLandscapePhone).toBe(false);
    expect(result.current.isLandscapeTablet).toBe(false);
    expect(result.current.contentPaddingTop).toBe(55);
    expect(result.current.horizontalPadding).toBe(16);
    expect(result.current.sidePanelWidth).toBe(260);
  });

  it("returns landscape-phone values", () => {
    setOrientationState(800, 390);

    const { result } = renderHook(() => useResponsiveLayout());

    expect(result.current.layoutMode).toBe("landscape-phone");
    expect(result.current.isLandscape).toBe(true);
    expect(result.current.isLandscapePhone).toBe(true);
    expect(result.current.isLandscapeTablet).toBe(false);
    expect(result.current.contentPaddingTop).toBe(8);
    expect(result.current.horizontalPadding).toBe(16);
    expect(result.current.sidePanelWidth).toBe(260);
  });

  it("returns landscape-tablet values", () => {
    setOrientationState(1200, 800);

    const { result } = renderHook(() => useResponsiveLayout());

    expect(result.current.layoutMode).toBe("landscape-tablet");
    expect(result.current.isLandscape).toBe(true);
    expect(result.current.isLandscapePhone).toBe(false);
    expect(result.current.isLandscapeTablet).toBe(true);
    expect(result.current.contentPaddingTop).toBe(8);
    expect(result.current.horizontalPadding).toBe(20);
    expect(result.current.sidePanelWidth).toBe(384);
  });

  it("updates layout mode on orientation changes", () => {
    setOrientationState(390, 844);

    const { result, rerender } = renderHook(() => useResponsiveLayout());
    expect(result.current.layoutMode).toBe("portrait");

    setOrientationState(800, 390);
    rerender({});
    expect(result.current.layoutMode).toBe("landscape-phone");

    setOrientationState(1280, 800);
    rerender({});
    expect(result.current.layoutMode).toBe("landscape-tablet");
  });

  it("caps side panel width on very wide screens", () => {
    setOrientationState(2000, 1000);

    const { result } = renderHook(() => useResponsiveLayout());

    expect(result.current.layoutMode).toBe("landscape-tablet");
    expect(result.current.sidePanelWidth).toBe(420);
  });
});
