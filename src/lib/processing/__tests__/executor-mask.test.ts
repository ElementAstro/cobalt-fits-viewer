import { executeProcessingPipeline } from "../executor";
import { normalizeProcessingPipelineSnapshot } from "../recipe";
import type { ProcessingPipelineSnapshot } from "../../fits/types";

function makeInput(width: number, height: number) {
  const pixels = new Float32Array(width * height);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = i / Math.max(1, pixels.length - 1);
  }
  return { pixels, width, height };
}

function makeSnapshot(patch: Partial<ProcessingPipelineSnapshot> = {}): ProcessingPipelineSnapshot {
  return normalizeProcessingPipelineSnapshot(
    {
      version: 2,
      savedAt: Date.now(),
      profile: "standard",
      scientificNodes: [],
      colorNodes: [],
      ...patch,
    },
    "standard",
  );
}

describe("executeProcessingPipeline mask blending", () => {
  it("applies maskConfig to blend processed result with original", () => {
    const input = makeInput(8, 8);
    // Node 1: starMask (produces a mask-like output)
    // Node 2: invert with maskConfig referencing node 1
    const snapshot = makeSnapshot({
      scientificNodes: [
        {
          id: "mask-gen",
          operationId: "starMask",
          enabled: true,
          params: { scale: 1.5, invert: false },
        },
        {
          id: "invert-masked",
          operationId: "invert",
          enabled: true,
          params: {},
          maskConfig: {
            sourceNodeId: "mask-gen",
            invert: false,
            blendStrength: 1.0,
          },
        },
      ],
    });

    const result = executeProcessingPipeline({
      input,
      snapshot,
      renderOptions: { stretch: "linear", colormap: "grayscale", profile: "standard" },
      options: { mode: "full" },
    });

    expect(result.executedScientificNodeIds).toContain("mask-gen");
    expect(result.executedScientificNodeIds).toContain("invert-masked");
    expect(result.scientificOutput.width).toBe(8);
    expect(result.scientificOutput.height).toBe(8);
  });

  it("maskConfig with blendStrength=0 preserves original pixels", () => {
    const input = makeInput(8, 8);
    // Invert with mask strength=0 should give same as no invert
    const snapshotMasked = makeSnapshot({
      scientificNodes: [
        {
          id: "mask-gen",
          operationId: "binarize",
          enabled: true,
          params: { threshold: 0.5 },
        },
        {
          id: "invert-masked",
          operationId: "invert",
          enabled: true,
          params: {},
          maskConfig: {
            sourceNodeId: "mask-gen",
            invert: false,
            blendStrength: 0,
          },
        },
      ],
    });

    const snapshotNoInvert = makeSnapshot({
      scientificNodes: [
        {
          id: "mask-gen",
          operationId: "binarize",
          enabled: true,
          params: { threshold: 0.5 },
        },
      ],
    });

    const resultMasked = executeProcessingPipeline({
      input,
      snapshot: snapshotMasked,
      renderOptions: { stretch: "linear", colormap: "grayscale", profile: "standard" },
      options: { mode: "full" },
    });

    const resultNoInvert = executeProcessingPipeline({
      input,
      snapshot: snapshotNoInvert,
      renderOptions: { stretch: "linear", colormap: "grayscale", profile: "standard" },
      options: { mode: "full" },
    });

    // With blendStrength=0, the invert should have no effect on the scientific output
    const maskedPixels = resultMasked.scientificOutput.pixels;
    const noInvertPixels = resultNoInvert.scientificOutput.pixels;
    for (let i = 0; i < maskedPixels.length; i++) {
      expect(maskedPixels[i]).toBeCloseTo(noInvertPixels[i], 3);
    }
  });

  it("maskConfig with invert=true inverts mask values", () => {
    const input = makeInput(8, 8);
    const snapshotNormal = makeSnapshot({
      scientificNodes: [
        {
          id: "mask-gen",
          operationId: "binarize",
          enabled: true,
          params: { threshold: 0.5 },
        },
        {
          id: "op",
          operationId: "invert",
          enabled: true,
          params: {},
          maskConfig: {
            sourceNodeId: "mask-gen",
            invert: false,
            blendStrength: 1.0,
          },
        },
      ],
    });

    const snapshotInverted = makeSnapshot({
      scientificNodes: [
        {
          id: "mask-gen",
          operationId: "binarize",
          enabled: true,
          params: { threshold: 0.5 },
        },
        {
          id: "op",
          operationId: "invert",
          enabled: true,
          params: {},
          maskConfig: {
            sourceNodeId: "mask-gen",
            invert: true,
            blendStrength: 1.0,
          },
        },
      ],
    });

    const resultNormal = executeProcessingPipeline({
      input,
      snapshot: snapshotNormal,
      renderOptions: { stretch: "linear", colormap: "grayscale", profile: "standard" },
      options: { mode: "full" },
    });

    const resultInverted = executeProcessingPipeline({
      input,
      snapshot: snapshotInverted,
      renderOptions: { stretch: "linear", colormap: "grayscale", profile: "standard" },
      options: { mode: "full" },
    });

    // Normal and inverted masks should produce different results
    let diff = 0;
    for (let i = 0; i < resultNormal.scientificOutput.pixels.length; i++) {
      diff += Math.abs(
        resultNormal.scientificOutput.pixels[i] - resultInverted.scientificOutput.pixels[i],
      );
    }
    expect(diff).toBeGreaterThan(0);
  });

  it("ignores maskConfig when sourceNodeId does not exist", () => {
    const input = makeInput(8, 8);
    const snapshot = makeSnapshot({
      scientificNodes: [
        {
          id: "op",
          operationId: "invert",
          enabled: true,
          params: {},
          maskConfig: {
            sourceNodeId: "nonexistent",
            invert: false,
            blendStrength: 1.0,
          },
        },
      ],
    });

    // Should not throw
    const result = executeProcessingPipeline({
      input,
      snapshot,
      renderOptions: { stretch: "linear", colormap: "grayscale", profile: "standard" },
      options: { mode: "full" },
    });

    expect(result.executedScientificNodeIds).toContain("op");
  });
});
