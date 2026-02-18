import { encodeTiff } from "../encoders/tiff";

describe("tiff encoder", () => {
  it("writes classic little-endian TIFF header", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const bytes = encodeTiff(rgba, 2, 1, { bitDepth: 8, colorMode: "rgb" });
    expect(bytes[0]).toBe(0x49);
    expect(bytes[1]).toBe(0x49);
    expect(bytes[2]).toBe(0x2a);
    expect(bytes[3]).toBe(0x00);
    expect(bytes.length).toBeGreaterThan(32);
  });
});
