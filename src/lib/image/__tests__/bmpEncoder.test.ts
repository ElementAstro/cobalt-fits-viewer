import { encodeBmp24 } from "../encoders/bmp";

describe("bmp encoder", () => {
  it("writes 24-bit BMP header and pixel payload", () => {
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
    ]);
    const bytes = encodeBmp24(rgba, 2, 2);
    expect(bytes[0]).toBe(0x42);
    expect(bytes[1]).toBe(0x4d);
    expect(bytes.length).toBeGreaterThan(54);
  });
});
