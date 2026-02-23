/**
 * AstrometryAnnotationOverlay 组件测试
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { AstrometryAnnotationOverlay } from "../AstrometryAnnotationOverlay";
import type { AstrometryAnnotation, AstrometryAnnotationType } from "../../../lib/astrometry/types";
import type { CanvasTransform } from "../../fits/FitsCanvas";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

jest.mock("@shopify/react-native-skia", () => {
  const ReactLocal = require("react");
  const { View: RNView, Text: RNText } = require("react-native");

  const Canvas = (props: { children?: React.ReactNode; [k: string]: unknown }) =>
    ReactLocal.createElement(RNView, { testID: "skia-canvas", ...props }, props.children);
  const Group = (props: { children?: React.ReactNode }) =>
    ReactLocal.createElement(RNView, { testID: "skia-group" }, props.children);
  const Circle = (props: Record<string, unknown>) =>
    ReactLocal.createElement(RNView, { testID: "skia-circle", ...props });
  const SkiaLine = (props: Record<string, unknown>) =>
    ReactLocal.createElement(RNView, { testID: "skia-line", ...props });
  const SkiaText = (props: { text?: string; [k: string]: unknown }) =>
    ReactLocal.createElement(RNText, { testID: "skia-text" }, props.text);
  const DashPathEffect = () => null;

  return {
    Canvas,
    Group,
    Circle,
    Line: SkiaLine,
    Text: SkiaText,
    DashPathEffect,
    useFont: () => ({ measureText: () => ({ width: 50 }) }),
    vec: (x: number, y: number) => ({ x, y }),
  };
});

jest.mock("../../../lib/viewer/transform", () => ({
  imageToScreenPoint: jest.fn(
    (pt: { x: number; y: number }, _transform: CanvasTransform, _rw: number, _rh: number) => pt,
  ),
  remapPointBetweenSpaces: jest.fn(
    (pt: { x: number; y: number }, _sw: number, _sh: number, _rw: number, _rh: number) => pt,
  ),
}));

const baseTransform: CanvasTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  canvasWidth: 800,
  canvasHeight: 600,
};

const makeAnnotation = (overrides: Partial<AstrometryAnnotation> = {}): AstrometryAnnotation => ({
  type: "messier",
  names: ["M42"],
  pixelx: 100,
  pixely: 100,
  radius: 20,
  ...overrides,
});

describe("AstrometryAnnotationOverlay", () => {
  const baseProps = {
    renderWidth: 800,
    renderHeight: 600,
    sourceWidth: 800,
    sourceHeight: 600,
    transform: baseTransform,
    visible: true,
  };

  it("renders null when visible is false", () => {
    const { toJSON } = render(
      <AstrometryAnnotationOverlay {...baseProps} visible={false} annotations={[]} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders null when annotations is empty", () => {
    const { toJSON } = render(<AstrometryAnnotationOverlay {...baseProps} annotations={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("renders null when scale is below MIN_VISIBLE_SCALE", () => {
    const { toJSON } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        annotations={[makeAnnotation()]}
        transform={{ ...baseTransform, scale: 0.1 }}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders Skia canvas when visible with annotations", () => {
    const { getByTestId } = render(
      <AstrometryAnnotationOverlay {...baseProps} annotations={[makeAnnotation()]} />,
    );
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("renders label text for messier annotation at sufficient scale", () => {
    const { getByText } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        annotations={[makeAnnotation({ type: "messier", names: ["M42"] })]}
        transform={{ ...baseTransform, scale: 1.0 }}
      />,
    );
    expect(getByText("M42")).toBeTruthy();
  });

  it("filters by visibleTypes when provided", () => {
    const annotations = [
      makeAnnotation({ type: "messier", names: ["M42"], pixelx: 100, pixely: 100 }),
      makeAnnotation({ type: "ngc", names: ["NGC 1976"], pixelx: 200, pixely: 200 }),
    ];
    const visibleTypes: AstrometryAnnotationType[] = ["messier"];

    const { queryByText } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        annotations={annotations}
        visibleTypes={visibleTypes}
        transform={{ ...baseTransform, scale: 2.0 }}
      />,
    );
    expect(queryByText("M42")).toBeTruthy();
    expect(queryByText("NGC 1976")).toBeNull();
  });

  it("hides hd/star annotations when scale < 0.5", () => {
    const { toJSON } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        annotations={[makeAnnotation({ type: "hd", names: ["HD 12345"] })]}
        transform={{ ...baseTransform, scale: 0.4 }}
      />,
    );
    // scale < MIN_VISIBLE_SCALE (0.3) would return null,
    // but scale 0.4 => hd shouldShowAtScale returns false => items empty => null
    expect(toJSON()).toBeNull();
  });

  it("renders hd annotations when scale >= 0.5", () => {
    const { getByTestId } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        annotations={[makeAnnotation({ type: "hd", names: ["HD 12345"] })]}
        transform={{ ...baseTransform, scale: 0.6 }}
      />,
    );
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("renders null when renderWidth or renderHeight is zero", () => {
    const { toJSON } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        renderWidth={0}
        annotations={[makeAnnotation()]}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("does not render annotations that are off-screen", () => {
    const offScreenAnnotation = makeAnnotation({ pixelx: -200, pixely: -200 });
    const { toJSON } = render(
      <AstrometryAnnotationOverlay {...baseProps} annotations={[offScreenAnnotation]} />,
    );
    // Off-screen annotations get filtered out => empty items => null
    expect(toJSON()).toBeNull();
  });

  it("uses empty label for annotations with no names", () => {
    const noName = makeAnnotation({ names: [], type: "messier" });
    const { queryByText, getByTestId } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        annotations={[noName]}
        transform={{ ...baseTransform, scale: 2.0 }}
      />,
    );
    expect(getByTestId("skia-canvas")).toBeTruthy();
    // No label text should be rendered
    expect(queryByText("M42")).toBeNull();
  });
});
