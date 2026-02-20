import { applyPixelMathProgram, validatePixelMathProgram } from "../pixelMath";

describe("composite pixelMath", () => {
  it("validates expressions", () => {
    const errors = validatePixelMathProgram(
      {
        r: "R + G",
        g: "G",
        b: "unknown + B",
      },
      2,
    );
    expect(errors.length).toBe(1);
    expect(errors[0].channel).toBe("b");
  });

  it("applies expressions on channels", () => {
    const r = new Float32Array([0.1, 0.2, 0.3]);
    const g = new Float32Array([0.2, 0.3, 0.4]);
    const b = new Float32Array([0.3, 0.4, 0.5]);

    const result = applyPixelMathProgram(
      {
        width: 3,
        height: 1,
        base: { r, g, b },
      },
      {
        r: "clamp(R+0.1)",
        g: "G",
        b: "B",
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.r[0]).toBeCloseTo(0.2, 4);
    expect(result.g[1]).toBeCloseTo(0.3, 4);
  });
});
