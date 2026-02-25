/**
 * Shared expo-image mock factory for astrometry component tests
 */

import React from "react";
import { View as RNView } from "react-native";

export function createExpoImageMock() {
  return {
    Image: (props: Record<string, unknown>) =>
      React.createElement(RNView, { testID: "expo-image", ...props }),
  };
}
