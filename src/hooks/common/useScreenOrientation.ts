import { useState, useEffect, useCallback } from "react";
import { useWindowDimensions } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";

export type OrientationLockType = "default" | "portrait" | "landscape";

interface ScreenOrientationState {
  /** Whether the screen is currently in landscape orientation */
  isLandscape: boolean;
  /** Whether the screen is currently in portrait orientation */
  isPortrait: boolean;
  /** Raw orientation enum from expo-screen-orientation */
  orientation: ScreenOrientation.Orientation;
  /** Current screen width (updates on rotation) */
  screenWidth: number;
  /** Current screen height (updates on rotation) */
  screenHeight: number;
  /** Lock to a specific orientation */
  lockOrientation: (lock: OrientationLockType) => Promise<void>;
  /** Unlock orientation (revert to default) */
  unlockOrientation: () => Promise<void>;
}

const ORIENTATION_LOCK_MAP: Record<OrientationLockType, ScreenOrientation.OrientationLock> = {
  default: ScreenOrientation.OrientationLock.DEFAULT,
  portrait: ScreenOrientation.OrientationLock.PORTRAIT,
  landscape: ScreenOrientation.OrientationLock.LANDSCAPE,
};

export function useScreenOrientation(): ScreenOrientationState {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [orientation, setOrientation] = useState<ScreenOrientation.Orientation>(
    ScreenOrientation.Orientation.UNKNOWN,
  );

  useEffect(() => {
    let mounted = true;

    ScreenOrientation.getOrientationAsync().then((current) => {
      if (mounted) setOrientation(current);
    });

    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      if (mounted) setOrientation(event.orientationInfo.orientation);
    });

    return () => {
      mounted = false;
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

  const isLandscape =
    orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
    orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT ||
    (orientation === ScreenOrientation.Orientation.UNKNOWN && screenWidth > screenHeight);

  const isPortrait = !isLandscape;

  const lockOrientation = useCallback(async (lock: OrientationLockType) => {
    await ScreenOrientation.lockAsync(ORIENTATION_LOCK_MAP[lock]);
  }, []);

  const unlockOrientation = useCallback(async () => {
    await ScreenOrientation.unlockAsync();
  }, []);

  return {
    isLandscape,
    isPortrait,
    orientation,
    screenWidth,
    screenHeight,
    lockOrientation,
    unlockOrientation,
  };
}
