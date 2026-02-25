/**
 * Shared Skia mock factory for astrometry component tests
 */

import React from "react";
import { View as RNView, Text as RNText } from "react-native";

export function createSkiaMock() {
  const Canvas = (props: { children?: React.ReactNode; [k: string]: unknown }) =>
    React.createElement(RNView, { testID: "skia-canvas", ...props }, props.children);
  const Group = (props: { children?: React.ReactNode }) =>
    React.createElement(RNView, { testID: "skia-group" }, props.children);
  const Circle = (props: Record<string, unknown>) =>
    React.createElement(RNView, { testID: "skia-circle", ...props });
  const SkiaLine = (props: Record<string, unknown>) =>
    React.createElement(RNView, { testID: "skia-line", ...props });
  const SkiaText = (props: { text?: string; [k: string]: unknown }) =>
    React.createElement(RNText, { testID: "skia-text" }, props.text);
  const SkiaPath = (props: Record<string, unknown>) =>
    React.createElement(RNView, { testID: "skia-path", ...props });
  const DashPathEffect = () => null;

  const mockPath = {
    moveTo: jest.fn(),
    lineTo: jest.fn(),
  };

  return {
    Canvas,
    Group,
    Circle,
    Line: SkiaLine,
    Text: SkiaText,
    Path: SkiaPath,
    DashPathEffect,
    Skia: {
      Path: {
        Make: () => ({ ...mockPath }),
      },
    },
    useFont: () => ({ measureText: () => ({ width: 50 }) }),
    vec: (x: number, y: number) => ({ x, y }),
  };
}
