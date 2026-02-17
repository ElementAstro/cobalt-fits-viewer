/**
 * Unit tests for useViewerStore — levels (midtone, outputBlack, outputWhite, resetLevels)
 */

import { useViewerStore } from "../useViewerStore";
import type { ColormapType } from "../../lib/fits/types";

// Mock useSettingsStore
jest.mock("../useSettingsStore", () => ({
  useSettingsStore: {
    getState: () => ({
      defaultStretch: "asinh",
      defaultColormap: "grayscale",
      defaultBlackPoint: 0,
      defaultWhitePoint: 1,
      defaultGamma: 1,
      defaultShowGrid: false,
      defaultShowCrosshair: false,
      defaultShowPixelInfo: true,
      defaultShowMinimap: false,
    }),
  },
}));

describe("useViewerStore — levels", () => {
  beforeEach(() => {
    // Reset to defaults before each test
    useViewerStore.setState({
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
      midtone: 0.5,
      outputBlack: 0,
      outputWhite: 1,
      regionSelection: null,
    });
  });

  // ===== Default values =====

  describe("default state", () => {
    it("has midtone = 0.5", () => {
      expect(useViewerStore.getState().midtone).toBe(0.5);
    });

    it("has outputBlack = 0", () => {
      expect(useViewerStore.getState().outputBlack).toBe(0);
    });

    it("has outputWhite = 1", () => {
      expect(useViewerStore.getState().outputWhite).toBe(1);
    });

    it("has regionSelection = null", () => {
      expect(useViewerStore.getState().regionSelection).toBeNull();
    });
  });

  // ===== Setters =====

  describe("setMidtone", () => {
    it("updates midtone value", () => {
      useViewerStore.getState().setMidtone(0.3);
      expect(useViewerStore.getState().midtone).toBe(0.3);
    });

    it("accepts boundary values", () => {
      useViewerStore.getState().setMidtone(0);
      expect(useViewerStore.getState().midtone).toBe(0);
      useViewerStore.getState().setMidtone(1);
      expect(useViewerStore.getState().midtone).toBe(1);
    });
  });

  describe("setOutputBlack", () => {
    it("updates outputBlack value", () => {
      useViewerStore.getState().setOutputBlack(0.2);
      expect(useViewerStore.getState().outputBlack).toBe(0.2);
    });
  });

  describe("setOutputWhite", () => {
    it("updates outputWhite value", () => {
      useViewerStore.getState().setOutputWhite(0.8);
      expect(useViewerStore.getState().outputWhite).toBe(0.8);
    });
  });

  describe("setRegionSelection", () => {
    it("sets a region", () => {
      const region = { x: 10, y: 20, w: 100, h: 50 };
      useViewerStore.getState().setRegionSelection(region);
      expect(useViewerStore.getState().regionSelection).toEqual(region);
    });

    it("clears region with null", () => {
      useViewerStore.getState().setRegionSelection({ x: 0, y: 0, w: 10, h: 10 });
      useViewerStore.getState().setRegionSelection(null);
      expect(useViewerStore.getState().regionSelection).toBeNull();
    });
  });

  // ===== resetLevels =====

  describe("resetLevels", () => {
    it("resets all levels to defaults", () => {
      // Set non-default values
      useViewerStore.getState().setBlackPoint(0.15);
      useViewerStore.getState().setWhitePoint(0.85);
      useViewerStore.getState().setGamma(2.2);
      useViewerStore.getState().setMidtone(0.3);
      useViewerStore.getState().setOutputBlack(0.1);
      useViewerStore.getState().setOutputWhite(0.9);

      // Verify non-default
      expect(useViewerStore.getState().blackPoint).toBe(0.15);
      expect(useViewerStore.getState().midtone).toBe(0.3);
      expect(useViewerStore.getState().outputBlack).toBe(0.1);

      // Reset
      useViewerStore.getState().resetLevels();

      // Verify defaults
      expect(useViewerStore.getState().blackPoint).toBe(0);
      expect(useViewerStore.getState().whitePoint).toBe(1);
      expect(useViewerStore.getState().gamma).toBe(1);
      expect(useViewerStore.getState().midtone).toBe(0.5);
      expect(useViewerStore.getState().outputBlack).toBe(0);
      expect(useViewerStore.getState().outputWhite).toBe(1);
    });

    it("does not affect other state", () => {
      useViewerStore.setState({ stretch: "sqrt", colormap: "heat" as unknown as ColormapType });
      useViewerStore.getState().setMidtone(0.3);
      useViewerStore.getState().resetLevels();

      // Levels are reset
      expect(useViewerStore.getState().midtone).toBe(0.5);
      // Other state is preserved
      expect(useViewerStore.getState().stretch).toBe("sqrt");
      expect(useViewerStore.getState().colormap).toBe("heat");
    });

    it("does not affect regionSelection", () => {
      const region = { x: 5, y: 5, w: 20, h: 20 };
      useViewerStore.getState().setRegionSelection(region);
      useViewerStore.getState().resetLevels();
      expect(useViewerStore.getState().regionSelection).toEqual(region);
    });
  });

  // ===== Combined scenarios =====

  describe("combined level adjustments", () => {
    it("all level params can be set independently", () => {
      useViewerStore.getState().setBlackPoint(0.1);
      useViewerStore.getState().setWhitePoint(0.9);
      useViewerStore.getState().setGamma(1.5);
      useViewerStore.getState().setMidtone(0.4);
      useViewerStore.getState().setOutputBlack(0.05);
      useViewerStore.getState().setOutputWhite(0.95);

      const state = useViewerStore.getState();
      expect(state.blackPoint).toBe(0.1);
      expect(state.whitePoint).toBe(0.9);
      expect(state.gamma).toBe(1.5);
      expect(state.midtone).toBe(0.4);
      expect(state.outputBlack).toBe(0.05);
      expect(state.outputWhite).toBe(0.95);
    });

    it("rapid sequential updates all apply", () => {
      for (let i = 0; i < 10; i++) {
        useViewerStore.getState().setMidtone(i / 10);
      }
      expect(useViewerStore.getState().midtone).toBeCloseTo(0.9, 5);
    });
  });

  describe("basic state actions", () => {
    it("setCurrentFile updates id and clears error", () => {
      useViewerStore.setState({ error: "old error", currentFileId: null });
      useViewerStore.getState().setCurrentFile("file-1");
      expect(useViewerStore.getState().currentFileId).toBe("file-1");
      expect(useViewerStore.getState().error).toBeNull();
    });

    it("setLoading and setError update flags", () => {
      useViewerStore.getState().setLoading(true);
      useViewerStore.getState().setError("boom");
      expect(useViewerStore.getState().isLoading).toBe(true);
      expect(useViewerStore.getState().error).toBe("boom");
    });
  });

  describe("display and frame setters", () => {
    it("updates display parameters", () => {
      const store = useViewerStore.getState();
      store.setStretch("sqrt");
      store.setColormap("heat" as unknown as ColormapType);
      store.setBrightness(0.25);
      store.setContrast(1.6);
      store.setMtfMidtone(0.42);
      store.setCurvePreset("s-curve");

      const s = useViewerStore.getState();
      expect(s.stretch).toBe("sqrt");
      expect(s.colormap).toBe("heat");
      expect(s.brightness).toBe(0.25);
      expect(s.contrast).toBe(1.6);
      expect(s.mtfMidtone).toBe(0.42);
      expect(s.curvePreset).toBe("s-curve");
    });

    it("updates HDU/frame metadata", () => {
      const store = useViewerStore.getState();
      store.setCurrentHDU(2);
      store.setCurrentFrame(8);
      store.setTotalFrames(12);

      const s = useViewerStore.getState();
      expect(s.currentHDU).toBe(2);
      expect(s.currentFrame).toBe(8);
      expect(s.totalFrames).toBe(12);
    });
  });

  describe("overlay toggles", () => {
    it("toggles grid/crosshair/pixelInfo/miniMap", () => {
      const store = useViewerStore.getState();
      const before = {
        showGrid: useViewerStore.getState().showGrid,
        showCrosshair: useViewerStore.getState().showCrosshair,
        showPixelInfo: useViewerStore.getState().showPixelInfo,
        showMiniMap: useViewerStore.getState().showMiniMap,
      };

      store.toggleGrid();
      store.toggleCrosshair();
      store.togglePixelInfo();
      store.toggleMiniMap();

      const s = useViewerStore.getState();
      expect(s.showGrid).toBe(!before.showGrid);
      expect(s.showCrosshair).toBe(!before.showCrosshair);
      expect(s.showPixelInfo).toBe(!before.showPixelInfo);
      expect(s.showMiniMap).toBe(!before.showMiniMap);
    });
  });

  describe("annotation actions", () => {
    beforeEach(() => {
      useViewerStore.setState({ annotations: [], activeAnnotationId: null });
    });

    it("adds, updates and removes annotations", () => {
      const store = useViewerStore.getState();
      store.addAnnotation({
        id: "a1",
        type: "circle",
        x: 10,
        y: 20,
        radius: 8,
        color: "#ff0000",
        strokeWidth: 2,
        visible: true,
      });

      expect(useViewerStore.getState().annotations).toHaveLength(1);

      store.updateAnnotation("a1", { color: "#00ff00", x: 11 });
      expect(useViewerStore.getState().annotations[0].color).toBe("#00ff00");
      expect(useViewerStore.getState().annotations[0].x).toBe(11);

      store.setActiveAnnotation("a1");
      expect(useViewerStore.getState().activeAnnotationId).toBe("a1");

      store.removeAnnotation("a1");
      expect(useViewerStore.getState().annotations).toEqual([]);
      expect(useViewerStore.getState().activeAnnotationId).toBeNull();
    });

    it("clearAnnotations removes all and resets active annotation", () => {
      const store = useViewerStore.getState();
      store.addAnnotation({
        id: "a1",
        type: "text",
        x: 1,
        y: 2,
        text: "note",
        color: "#ffffff",
        strokeWidth: 1,
        visible: true,
      });
      store.setActiveAnnotation("a1");
      store.clearAnnotations();

      expect(useViewerStore.getState().annotations).toEqual([]);
      expect(useViewerStore.getState().activeAnnotationId).toBeNull();
    });
  });

  describe("cursor updates", () => {
    it("setCursorPosition updates x/y/value", () => {
      useViewerStore.getState().setCursorPosition(123, 456, 789);
      expect(useViewerStore.getState().cursorX).toBe(123);
      expect(useViewerStore.getState().cursorY).toBe(456);
      expect(useViewerStore.getState().cursorValue).toBe(789);
    });
  });

  // ===== initFromSettings / resetViewerState =====

  describe("initFromSettings", () => {
    it("resets display params from settings store", () => {
      useViewerStore.getState().setBlackPoint(0.5);
      useViewerStore.getState().initFromSettings();
      expect(useViewerStore.getState().blackPoint).toBe(0);
      expect(useViewerStore.getState().stretch).toBe("asinh");
    });
  });

  describe("resetViewerState", () => {
    it("resets all state including levels", () => {
      useViewerStore.getState().setMidtone(0.3);
      useViewerStore.getState().setOutputBlack(0.2);
      useViewerStore.getState().setOutputWhite(0.8);
      useViewerStore.getState().setRegionSelection({ x: 0, y: 0, w: 10, h: 10 });

      useViewerStore.getState().resetViewerState();

      expect(useViewerStore.getState().midtone).toBe(0.5);
      expect(useViewerStore.getState().outputBlack).toBe(0);
      expect(useViewerStore.getState().outputWhite).toBe(1);
      expect(useViewerStore.getState().regionSelection).toBeNull();
    });
  });
});
