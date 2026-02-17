import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenOrientation } from "./useScreenOrientation";
import { getLayoutMode, type LayoutMode } from "../lib/layout/breakpoints";

export interface ResponsiveLayoutState {
  isLandscape: boolean;
  layoutMode: LayoutMode;
  isLandscapePhone: boolean;
  isLandscapeTablet: boolean;
  contentPaddingTop: number;
  horizontalPadding: number;
  sidePanelWidth: number;
}

export function useResponsiveLayout(): ResponsiveLayoutState {
  const { isLandscape, screenWidth, screenHeight } = useScreenOrientation();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const layoutMode = getLayoutMode(screenWidth, screenHeight);
    const isLandscapePhone = layoutMode === "landscape-phone";
    const isLandscapeTablet = layoutMode === "landscape-tablet";

    return {
      isLandscape,
      layoutMode,
      isLandscapePhone,
      isLandscapeTablet,
      contentPaddingTop: layoutMode === "portrait" ? insets.top + 8 : 8,
      horizontalPadding: isLandscapeTablet ? 20 : 16,
      sidePanelWidth: Math.min(Math.max(Math.round(screenWidth * 0.32), 260), 420),
    };
  }, [insets.top, isLandscape, screenHeight, screenWidth]);
}
