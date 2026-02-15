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
