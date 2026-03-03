/**
 * Unit tests for useScreenOrientation hook
 */

import { renderHook, act, waitFor } from "@testing-library/react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { useScreenOrientation } from "../useScreenOrientation";

// Track the listener callback so we can simulate orientation changes
let orientationChangeCallback:
  | ((event: { orientationInfo: { orientation: number } }) => void)
  | null = null;

const waitForOrientationResolved = async (result: {
  current: { orientation: ScreenOrientation.Orientation };
}) => {
  await waitFor(() => {
    expect(result.current.orientation).not.toBe(ScreenOrientation.Orientation.UNKNOWN);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  orientationChangeCallback = null;

  (ScreenOrientation.addOrientationChangeListener as jest.Mock).mockImplementation((cb) => {
    orientationChangeCallback = cb;
    return { remove: jest.fn() };
  });
  (ScreenOrientation.getOrientationAsync as jest.Mock).mockResolvedValue(
    ScreenOrientation.Orientation.PORTRAIT_UP,
  );
});

describe("useScreenOrientation", () => {
  // ===== Initial state =====

  describe("initial state", () => {
    it("defaults to portrait mode", async () => {
      const { result } = renderHook(() => useScreenOrientation());

      await waitForOrientationResolved(result);

      expect(result.current.isPortrait).toBe(true);
      expect(result.current.isLandscape).toBe(false);
    });

    it("provides screen dimensions", async () => {
      const { result } = renderHook(() => useScreenOrientation());
      await waitForOrientationResolved(result);

      expect(result.current.screenWidth).toBeGreaterThan(0);
      expect(result.current.screenHeight).toBeGreaterThan(0);
    });

    it("calls getOrientationAsync on mount", async () => {
      const { result } = renderHook(() => useScreenOrientation());
      expect(ScreenOrientation.getOrientationAsync).toHaveBeenCalledTimes(1);
      await waitForOrientationResolved(result);
    });

    it("registers an orientation change listener", async () => {
      const { result } = renderHook(() => useScreenOrientation());
      expect(ScreenOrientation.addOrientationChangeListener).toHaveBeenCalledTimes(1);
      await waitForOrientationResolved(result);
    });
  });

  // ===== Orientation detection =====

  describe("orientation detection", () => {
    it("detects LANDSCAPE_LEFT as landscape", async () => {
      (ScreenOrientation.getOrientationAsync as jest.Mock).mockResolvedValue(
        ScreenOrientation.Orientation.LANDSCAPE_LEFT,
      );
      const { result } = renderHook(() => useScreenOrientation());

      await waitForOrientationResolved(result);

      expect(result.current.isLandscape).toBe(true);
      expect(result.current.isPortrait).toBe(false);
    });

    it("detects LANDSCAPE_RIGHT as landscape", async () => {
      (ScreenOrientation.getOrientationAsync as jest.Mock).mockResolvedValue(
        ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
      );
      const { result } = renderHook(() => useScreenOrientation());

      await waitForOrientationResolved(result);

      expect(result.current.isLandscape).toBe(true);
      expect(result.current.isPortrait).toBe(false);
    });

    it("detects PORTRAIT_UP as portrait", async () => {
      const { result } = renderHook(() => useScreenOrientation());

      await waitForOrientationResolved(result);

      expect(result.current.isPortrait).toBe(true);
      expect(result.current.isLandscape).toBe(false);
    });

    it("detects PORTRAIT_DOWN as portrait", async () => {
      (ScreenOrientation.getOrientationAsync as jest.Mock).mockResolvedValue(
        ScreenOrientation.Orientation.PORTRAIT_DOWN,
      );
      const { result } = renderHook(() => useScreenOrientation());

      await waitForOrientationResolved(result);

      expect(result.current.isPortrait).toBe(true);
      expect(result.current.isLandscape).toBe(false);
    });
  });

  // ===== Orientation change listener =====

  describe("orientation change listener", () => {
    it("updates when orientation changes to landscape", async () => {
      const { result } = renderHook(() => useScreenOrientation());

      await waitForOrientationResolved(result);

      expect(result.current.isPortrait).toBe(true);

      // Simulate orientation change
      act(() => {
        orientationChangeCallback?.({
          orientationInfo: { orientation: ScreenOrientation.Orientation.LANDSCAPE_LEFT },
        });
      });

      expect(result.current.isLandscape).toBe(true);
      expect(result.current.isPortrait).toBe(false);
    });

    it("updates when orientation changes back to portrait", async () => {
      (ScreenOrientation.getOrientationAsync as jest.Mock).mockResolvedValue(
        ScreenOrientation.Orientation.LANDSCAPE_LEFT,
      );

      const { result } = renderHook(() => useScreenOrientation());

      await waitForOrientationResolved(result);

      expect(result.current.isLandscape).toBe(true);

      act(() => {
        orientationChangeCallback?.({
          orientationInfo: { orientation: ScreenOrientation.Orientation.PORTRAIT_UP },
        });
      });

      expect(result.current.isPortrait).toBe(true);
      expect(result.current.isLandscape).toBe(false);
    });
  });

  // ===== Cleanup =====

  describe("cleanup", () => {
    it("removes listener on unmount", () => {
      const { unmount } = renderHook(() => useScreenOrientation());
      unmount();
      expect(ScreenOrientation.removeOrientationChangeListener).toHaveBeenCalledTimes(1);
    });
  });

  // ===== Lock/unlock =====

  describe("lockOrientation", () => {
    it("locks to portrait", async () => {
      const { result } = renderHook(() => useScreenOrientation());

      await act(async () => {
        await result.current.lockOrientation("portrait");
      });

      expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
        ScreenOrientation.OrientationLock.PORTRAIT,
      );
    });

    it("locks to landscape", async () => {
      const { result } = renderHook(() => useScreenOrientation());

      await act(async () => {
        await result.current.lockOrientation("landscape");
      });

      expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      );
    });

    it("locks to default", async () => {
      const { result } = renderHook(() => useScreenOrientation());

      await act(async () => {
        await result.current.lockOrientation("default");
      });

      expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
        ScreenOrientation.OrientationLock.DEFAULT,
      );
    });
  });

  describe("unlockOrientation", () => {
    it("calls unlockAsync", async () => {
      const { result } = renderHook(() => useScreenOrientation());

      await act(async () => {
        await result.current.unlockOrientation();
      });

      expect(ScreenOrientation.unlockAsync).toHaveBeenCalledTimes(1);
    });
  });

  // ===== Raw orientation value =====

  describe("orientation enum", () => {
    it("exposes the raw orientation value", async () => {
      const { result } = renderHook(() => useScreenOrientation());

      await waitForOrientationResolved(result);

      expect(result.current.orientation).toBe(ScreenOrientation.Orientation.PORTRAIT_UP);
    });

    it("updates raw orientation on change", async () => {
      const { result } = renderHook(() => useScreenOrientation());

      await waitForOrientationResolved(result);

      act(() => {
        orientationChangeCallback?.({
          orientationInfo: { orientation: ScreenOrientation.Orientation.LANDSCAPE_RIGHT },
        });
      });

      expect(result.current.orientation).toBe(ScreenOrientation.Orientation.LANDSCAPE_RIGHT);
    });
  });

  describe("unknown orientation fallback", () => {
    it("derives UNKNOWN orientation from current dimensions", async () => {
      (ScreenOrientation.getOrientationAsync as jest.Mock).mockResolvedValue(
        ScreenOrientation.Orientation.UNKNOWN,
      );

      const { result } = renderHook(() => useScreenOrientation());
      await waitFor(() => {
        expect(result.current.orientation).toBe(ScreenOrientation.Orientation.UNKNOWN);
      });

      expect(result.current.isLandscape).toBe(
        result.current.screenWidth > result.current.screenHeight,
      );
      expect(result.current.isPortrait).toBe(
        !(result.current.screenWidth > result.current.screenHeight),
      );
    });
  });
});
