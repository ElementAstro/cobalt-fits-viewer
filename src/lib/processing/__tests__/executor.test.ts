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

describe("executeProcessingPipeline", () => {
  it("runs scientific stage before color stage", () => {
    const snapshot = makeSnapshot({
      scientificNodes: [
        {
          id: "sci-1",
          operationId: "invert",
          enabled: true,
          params: {},
        },
      ],
      colorNodes: [
        {
          id: "color-1",
          operationId: "colorBalance",
          enabled: true,
          params: { redGain: 2, greenGain: 1, blueGain: 1 },
        },
      ],
    });
    const input = makeInput(4, 4);
    const result = executeProcessingPipeline({
      input,
      snapshot,
      renderOptions: {
        stretch: "linear",
        colormap: "grayscale",
        profile: "standard",
      },
      options: { mode: "full" },
    });

    expect(result.executedScientificNodeIds).toEqual(["sci-1"]);
    expect(result.executedColorNodeIds).toEqual(["color-1"]);
    expect(result.scientificOutput.width).toBe(4);
    expect(result.colorOutput.width).toBe(4);
    // colorBalance redGain=2 should make R channel >= G channel for grayscale input
    expect(result.colorOutput.rgbaData[0]).toBeGreaterThanOrEqual(result.colorOutput.rgbaData[1]);
  });

  it("supports preview mode downsampling and full mode at source size", () => {
    const input = makeInput(64, 64);
    const snapshot = makeSnapshot();
    const preview = executeProcessingPipeline({
      input,
      snapshot,
      renderOptions: { stretch: "linear", colormap: "grayscale", profile: "standard" },
      options: { mode: "preview", previewMaxDimension: 16 },
    });
    const full = executeProcessingPipeline({
      input,
      snapshot,
      renderOptions: { stretch: "linear", colormap: "grayscale", profile: "standard" },
      options: { mode: "full" },
    });

    expect(preview.usedDownsample).toBe(true);
    expect(preview.colorOutput.width).toBeLessThan(full.colorOutput.width);
    expect(full.colorOutput.width).toBe(64);
    expect(full.colorOutput.height).toBe(64);
  });

  it("aborts when signal is already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    const input = makeInput(8, 8);
    const snapshot = makeSnapshot({
      scientificNodes: [{ id: "sci-1", operationId: "invert", enabled: true, params: {} }],
    });

    expect(() =>
      executeProcessingPipeline({
        input,
        snapshot,
        renderOptions: { stretch: "linear", colormap: "grayscale", profile: "standard" },
        options: { mode: "full", signal: controller.signal },
      }),
    ).toThrow();
  });

  it("produces profile-specific rendering differences for listed colormaps", () => {
    const input = makeInput(8, 8);
    const snapshot = makeSnapshot();
    const standard = executeProcessingPipeline({
      input,
      snapshot,
      renderOptions: { stretch: "linear", colormap: "viridis", profile: "standard" },
      options: { mode: "full" },
    });
    const legacy = executeProcessingPipeline({
      input,
      snapshot,
      renderOptions: { stretch: "linear", colormap: "viridis", profile: "legacy" },
      options: { mode: "full" },
    });

    expect(standard.profile).toBe("standard");
    expect(legacy.profile).toBe("legacy");
    expect(Array.from(standard.colorOutput.rgbaData.slice(0, 8))).not.toEqual(
      Array.from(legacy.colorOutput.rgbaData.slice(0, 8)),
    );
  });
});
