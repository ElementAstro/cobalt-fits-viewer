import { writeFitsImage } from "../writer";

const CARD = 80;

function readHeaderText(bytes: Uint8Array): string {
  // First FITS block is enough for test cases here.
  return new TextDecoder("utf-8").decode(bytes.slice(0, 2880));
}

function hasCard(header: string, key: string): boolean {
  for (let i = 0; i < header.length; i += CARD) {
    const card = header.slice(i, i + CARD);
    if (card.startsWith(key.padEnd(8, " "))) return true;
  }
  return false;
}

describe("fits writer", () => {
  it("writes mono 2D float FITS with aligned blocks", () => {
    const bytes = writeFitsImage({
      image: {
        kind: "mono2d",
        width: 2,
        height: 2,
        pixels: new Float32Array([0.1, 0.2, 0.3, 0.4]),
      },
      bitpix: -32,
      sourceFormat: "fits",
      targetFormat: "fits",
    });

    expect(bytes.length % 2880).toBe(0);
    const header = readHeaderText(bytes);
    expect(hasCard(header, "SIMPLE")).toBe(true);
    expect(hasCard(header, "BITPIX")).toBe(true);
    expect(hasCard(header, "NAXIS1")).toBe(true);
    expect(hasCard(header, "NAXIS2")).toBe(true);
    expect(hasCard(header, "END")).toBe(true);
  });

  it("writes RGB cube with NAXIS3=3", () => {
    const bytes = writeFitsImage({
      image: {
        kind: "rgbCube3d",
        width: 2,
        height: 1,
        r: new Float32Array([0.1, 0.2]),
        g: new Float32Array([0.3, 0.4]),
        b: new Float32Array([0.5, 0.6]),
      },
      bitpix: -32,
      sourceFormat: "png",
      targetFormat: "fits",
    });

    const header = readHeaderText(bytes);
    expect(hasCard(header, "NAXIS3")).toBe(true);
  });

  it("adds BSCALE/BZERO when integer BITPIX requires scaling", () => {
    const bytes = writeFitsImage({
      image: {
        kind: "mono2d",
        width: 2,
        height: 1,
        pixels: new Float32Array([-1000, 1000]),
      },
      bitpix: 8,
      sourceFormat: "fits",
      targetFormat: "fits",
    });

    const header = readHeaderText(bytes);
    expect(hasCard(header, "BSCALE")).toBe(true);
    expect(hasCard(header, "BZERO")).toBe(true);
  });
});
