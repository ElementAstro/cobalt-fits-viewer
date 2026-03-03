jest.mock("../../utils/imageOperations", () => {
  const actual = jest.requireActual("../../utils/imageOperations");
  return {
    ...actual,
    applyStarMask: jest.fn(() => new Float32Array([0.1, 0.2, 0.3, 0.4])),
  };
});

import { getProcessingOperation } from "../registry";
import { applyStarMask } from "../../utils/imageOperations";

describe("processing registry starMask execution", () => {
  it("forwards growth and softness params to applyStarMask", () => {
    const schema = getProcessingOperation("starMask");
    expect(schema).toBeDefined();

    const input = {
      pixels: new Float32Array([1, 1, 1, 1]),
      width: 2,
      height: 2,
    };
    schema!.execute(input, {
      scale: 2,
      invert: true,
      growth: 3,
      softness: 1.5,
    });

    expect(applyStarMask as jest.Mock).toHaveBeenCalledWith(input.pixels, 2, 2, 2, true, 3, 1.5);
  });
});
