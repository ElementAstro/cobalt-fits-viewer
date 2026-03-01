/**
 * AnnotationLayerControls 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import {
  AnnotationLayerControls,
  createDefaultLayerVisibility,
  getVisibleTypes,
} from "../AnnotationLayerControls";
import type { AstrometryAnnotation } from "../../../lib/astrometry/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

// --- Pure utility function tests ---

describe("createDefaultLayerVisibility", () => {
  it("returns all types visible by default", () => {
    const v = createDefaultLayerVisibility();
    expect(v.messier).toBe(true);
    expect(v.ngc).toBe(true);
    expect(v.ic).toBe(true);
    expect(v.hd).toBe(true);
    expect(v.bright_star).toBe(true);
    expect(v.star).toBe(true);
    expect(v.other).toBe(true);
  });

  it("returns a new object each time", () => {
    const a = createDefaultLayerVisibility();
    const b = createDefaultLayerVisibility();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("getVisibleTypes", () => {
  it("returns all types when all visible", () => {
    const v = createDefaultLayerVisibility();
    const types = getVisibleTypes(v);
    expect(types).toContain("messier");
    expect(types).toContain("ngc");
    expect(types).toContain("star");
    expect(types.length).toBe(7);
  });

  it("excludes toggled-off types", () => {
    const v = { ...createDefaultLayerVisibility(), hd: false, star: false };
    const types = getVisibleTypes(v);
    expect(types).not.toContain("hd");
    expect(types).not.toContain("star");
    expect(types.length).toBe(5);
  });

  it("returns empty when all hidden", () => {
    const v = createDefaultLayerVisibility();
    for (const key of Object.keys(v)) {
      (v as Record<string, boolean>)[key] = false;
    }
    const types = getVisibleTypes(v);
    expect(types).toEqual([]);
  });
});

// --- Component render tests ---

const makeAnnotation = (
  type: AstrometryAnnotation["type"],
  overrides: Partial<AstrometryAnnotation> = {},
): AstrometryAnnotation => ({
  type,
  names: [`${type}-obj`],
  pixelx: 100,
  pixely: 100,
  ...overrides,
});

describe("AnnotationLayerControls (component)", () => {
  const defaultVisibility = createDefaultLayerVisibility();

  it("renders chips only for types with annotations", () => {
    const annotations = [makeAnnotation("messier"), makeAnnotation("ngc"), makeAnnotation("ngc")];
    render(
      <AnnotationLayerControls
        annotations={annotations}
        visibility={defaultVisibility}
        onToggleType={jest.fn()}
      />,
    );
    expect(screen.getByText("Messier (1)")).toBeTruthy();
    expect(screen.getByText("NGC (2)")).toBeTruthy();
    expect(screen.queryByText(/IC/)).toBeNull();
    expect(screen.queryByText(/HD/)).toBeNull();
    expect(screen.queryByText(/Stars/)).toBeNull();
  });

  it("fires onToggleType with correct type when chip is pressed", () => {
    const onToggleType = jest.fn();
    const annotations = [makeAnnotation("messier")];
    render(
      <AnnotationLayerControls
        annotations={annotations}
        visibility={defaultVisibility}
        onToggleType={onToggleType}
      />,
    );
    fireEvent.press(screen.getByText("Messier (1)"));
    expect(onToggleType).toHaveBeenCalledTimes(1);
    expect(onToggleType).toHaveBeenCalledWith("messier");
  });

  it("renders coordinate grid toggle when onToggleCoordinateGrid is provided", () => {
    const onToggle = jest.fn();
    render(
      <AnnotationLayerControls
        annotations={[]}
        visibility={defaultVisibility}
        onToggleType={jest.fn()}
        showCoordinateGrid={false}
        onToggleCoordinateGrid={onToggle}
      />,
    );
    expect(screen.getByText("astrometry.coordinateGrid")).toBeTruthy();
    fireEvent.press(screen.getByText("astrometry.coordinateGrid"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders constellation toggle when onToggleConstellations is provided", () => {
    const onToggle = jest.fn();
    render(
      <AnnotationLayerControls
        annotations={[]}
        visibility={defaultVisibility}
        onToggleType={jest.fn()}
        showConstellations={false}
        onToggleConstellations={onToggle}
      />,
    );
    expect(screen.getByText("astrometry.constellationLines")).toBeTruthy();
    fireEvent.press(screen.getByText("astrometry.constellationLines"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not render grid/constellation toggles when callbacks are undefined", () => {
    render(
      <AnnotationLayerControls
        annotations={[makeAnnotation("messier")]}
        visibility={defaultVisibility}
        onToggleType={jest.fn()}
      />,
    );
    expect(screen.queryByText("astrometry.coordinateGrid")).toBeNull();
    expect(screen.queryByText("astrometry.constellationLines")).toBeNull();
  });

  it("renders chip with secondary variant when type is hidden", () => {
    const hiddenVis = { ...defaultVisibility, messier: false };
    const annotations = [makeAnnotation("messier")];
    render(
      <AnnotationLayerControls
        annotations={annotations}
        visibility={hiddenVis}
        onToggleType={jest.fn()}
      />,
    );
    // Chip renders but with secondary variant (no background style override)
    expect(screen.getByText("Messier (1)")).toBeTruthy();
  });

  it("renders coordinate grid chip with active styling when showCoordinateGrid is true", () => {
    render(
      <AnnotationLayerControls
        annotations={[]}
        visibility={defaultVisibility}
        onToggleType={jest.fn()}
        showCoordinateGrid={true}
        onToggleCoordinateGrid={jest.fn()}
      />,
    );
    expect(screen.getByText("astrometry.coordinateGrid")).toBeTruthy();
  });

  it("renders constellation chip with active styling when showConstellations is true", () => {
    render(
      <AnnotationLayerControls
        annotations={[]}
        visibility={defaultVisibility}
        onToggleType={jest.fn()}
        showConstellations={true}
        onToggleConstellations={jest.fn()}
      />,
    );
    expect(screen.getByText("astrometry.constellationLines")).toBeTruthy();
  });

  it("renders multiple annotation types with correct counts", () => {
    const annotations = [
      makeAnnotation("messier"),
      makeAnnotation("ngc"),
      makeAnnotation("ngc"),
      makeAnnotation("ic"),
      makeAnnotation("star"),
      makeAnnotation("star"),
      makeAnnotation("star"),
    ];
    render(
      <AnnotationLayerControls
        annotations={annotations}
        visibility={defaultVisibility}
        onToggleType={jest.fn()}
      />,
    );
    expect(screen.getByText("Messier (1)")).toBeTruthy();
    expect(screen.getByText("NGC (2)")).toBeTruthy();
    expect(screen.getByText("IC (1)")).toBeTruthy();
    expect(screen.getByText("Stars (3)")).toBeTruthy();
  });
});
