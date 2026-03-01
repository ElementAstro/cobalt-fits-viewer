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
  const { createSkiaMock } = require("./helpers/mockSkia");
  return createSkiaMock();
});

jest.mock("../../../lib/viewer/transform", () => {
  const { createTransformMock } = require("./helpers/mockTransform");
  return createTransformMock();
});

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

  it("caps rendered annotations at MAX_RENDERED (200) with priority ordering", () => {
    // Create 250 annotations: 5 messier + 245 star
    const annotations: AstrometryAnnotation[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeAnnotation({ type: "messier", names: [`M${i + 1}`], pixelx: 50 + i * 10, pixely: 50 }),
      ),
      ...Array.from({ length: 245 }, (_, i) =>
        makeAnnotation({
          type: "star",
          names: [`Star${i}`],
          pixelx: 50 + i * 2,
          pixely: 100 + i * 2,
        }),
      ),
    ];
    const { getAllByTestId, getByTestId } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        annotations={annotations}
        transform={{ ...baseTransform, scale: 2.0 }}
      />,
    );
    expect(getByTestId("skia-canvas")).toBeTruthy();
    // Should render some groups but capped at 200 (not all 250)
    const groups = getAllByTestId("skia-group");
    // The outer Group + inner Groups per item. Items capped at 200.
    // With mock, each item renders as a Group. Total groups = 1 (outer) + 200 (items) = 201
    expect(groups.length).toBeLessThanOrEqual(201);
  });

  it("prioritizes messier over star annotations when capped", () => {
    // Create 210 annotations: 10 messier (priority 0) + 200 star (priority 5)
    const annotations: AstrometryAnnotation[] = [
      ...Array.from({ length: 200 }, (_, i) =>
        makeAnnotation({
          type: "star",
          names: [`Star${i}`],
          pixelx: 50 + i * 3,
          pixely: 50 + i * 2,
        }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeAnnotation({
          type: "messier",
          names: [`M${i + 1}`],
          pixelx: 100 + i * 10,
          pixely: 100,
        }),
      ),
    ];
    const { queryByText } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        annotations={annotations}
        transform={{ ...baseTransform, scale: 2.0 }}
      />,
    );
    // Messier has higher priority (0) than star (5), so all messier should survive the cap
    expect(queryByText("M1")).toBeTruthy();
    expect(queryByText("M10")).toBeTruthy();
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

  it("falls back to sourceToRenderScale=1 when sourceWidth is zero", () => {
    const { getByTestId } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        sourceWidth={0}
        sourceHeight={0}
        annotations={[makeAnnotation()]}
      />,
    );
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("renders 'other' type annotation with solid_circle style", () => {
    const other = makeAnnotation({ type: "other", names: ["Unknown Obj"] });
    const { getByTestId } = render(
      <AstrometryAnnotationOverlay
        {...baseProps}
        annotations={[other]}
        transform={{ ...baseTransform, scale: 1.5 }}
      />,
    );
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });
});
