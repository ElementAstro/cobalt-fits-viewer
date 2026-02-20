import { registerCompositeLayers } from "../registrationAdapter";
import * as alignment from "../../stacking/alignment";

describe("composite registrationAdapter", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns identity for none mode", async () => {
    const layer1 = new Float32Array(16).fill(1);
    const layer2 = new Float32Array(16).fill(1);

    const result = await registerCompositeLayers({
      layers: [layer1, layer2],
      width: 4,
      height: 4,
      mode: "none",
      framing: "first",
    });

    expect(result.layers).toHaveLength(2);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.transforms[0].matrix[0]).toBe(1);
  });

  it("applies framing crop", async () => {
    const layer1 = new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0]);
    const layer2 = new Float32Array(layer1);

    const result = await registerCompositeLayers({
      layers: [layer1, layer2],
      width: 4,
      height: 4,
      mode: "none",
      framing: "min",
    });

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.layers[0][0]).toBe(1);
  });

  it("forwards manual control points to alignment", async () => {
    const layer1 = new Float32Array(16).fill(1);
    const layer2 = new Float32Array(16).fill(1);
    const spy = jest.spyOn(alignment, "alignFrameAsync").mockResolvedValue({
      aligned: layer2,
      transform: {
        matrix: [1, 0, 0, 0, 1, 0],
        matchedStars: 3,
        rmsError: 0,
        fallbackUsed: "manual-3star",
      },
    });

    await registerCompositeLayers({
      layers: [layer1, layer2],
      width: 4,
      height: 4,
      mode: "full",
      framing: "first",
      manualControlPoints: {
        mode: "threeStar",
        ref: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 1, y: 2 },
        ],
        target: [
          { x: 1.1, y: 1 },
          { x: 2.1, y: 1.1 },
          { x: 1, y: 2.1 },
        ],
      },
    });

    expect(spy).toHaveBeenCalledWith(
      layer1,
      layer2,
      4,
      4,
      "full",
      expect.objectContaining({
        manualControlPoints: expect.objectContaining({
          mode: "threeStar",
        }),
      }),
    );
  });
});
