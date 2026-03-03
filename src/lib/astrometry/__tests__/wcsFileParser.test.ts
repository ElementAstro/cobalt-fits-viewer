import { parseWCSFile } from "../wcsFileParser";

function textToBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

/** Build a minimal FITS header-only buffer with 2880-byte block padding */
function buildFitsHeaderBuffer(cards: string[]): ArrayBuffer {
  const allCards = [...cards, "END".padEnd(80)];
  // Pad to 2880-byte block boundary
  const totalCards = Math.ceil(allCards.length / 36) * 36;
  const block = new Uint8Array(totalCards * 80);
  block.fill(32); // space fill
  for (let i = 0; i < allCards.length; i++) {
    const card = allCards[i].padEnd(80).substring(0, 80);
    for (let j = 0; j < 80; j++) {
      block[i * 80 + j] = card.charCodeAt(j);
    }
  }
  return block.buffer;
}

function fitsCard(key: string, value: string | number): string {
  const k = key.padEnd(8);
  if (typeof value === "string") {
    return `${k}= '${value}'`.padEnd(80);
  }
  const vStr = String(value);
  return `${k}= ${vStr.padStart(20)}`.padEnd(80);
}

describe("parseWCSFile", () => {
  describe("FITS format", () => {
    it("parses a valid FITS WCS header-only file", () => {
      const buffer = buildFitsHeaderBuffer([
        fitsCard("SIMPLE", "T"),
        fitsCard("BITPIX", 8),
        fitsCard("NAXIS", 0),
        fitsCard("CTYPE1", "RA---TAN"),
        fitsCard("CTYPE2", "DEC--TAN"),
        fitsCard("CRVAL1", 83.63),
        fitsCard("CRVAL2", -5.39),
        fitsCard("CRPIX1", 1024),
        fitsCard("CRPIX2", 768),
        fitsCard("CD1_1", -0.000416667),
        fitsCard("CD1_2", 0),
        fitsCard("CD2_1", 0),
        fitsCard("CD2_2", 0.000416667),
        fitsCard("NAXIS1", 2048),
        fitsCard("NAXIS2", 1536),
      ]);

      const cal = parseWCSFile(buffer);
      expect(cal).not.toBeNull();
      expect(cal!.ra).toBeCloseTo(83.63, 1);
      expect(cal!.dec).toBeCloseTo(-5.39, 1);
      expect(cal!.pixscale).toBeGreaterThan(0);
    });

    it("returns null for FITS file without WCS keywords", () => {
      const buffer = buildFitsHeaderBuffer([
        fitsCard("SIMPLE", "T"),
        fitsCard("BITPIX", 16),
        fitsCard("NAXIS", 2),
        fitsCard("NAXIS1", 100),
        fitsCard("NAXIS2", 100),
      ]);
      expect(parseWCSFile(buffer)).toBeNull();
    });
  });

  describe("text format", () => {
    it("parses key=value text WCS file", () => {
      const text = [
        "# WCS Solution",
        "CTYPE1 = 'RA---TAN'",
        "CTYPE2 = 'DEC--TAN'",
        "CRVAL1 = 120.5",
        "CRVAL2 = 30.0",
        "CRPIX1 = 500",
        "CRPIX2 = 500",
        "CD1_1 = -0.0005",
        "CD1_2 = 0",
        "CD2_1 = 0",
        "CD2_2 = 0.0005",
        "NAXIS1 = 1000",
        "NAXIS2 = 1000",
      ].join("\n");

      const cal = parseWCSFile(textToBuffer(text));
      expect(cal).not.toBeNull();
      expect(cal!.ra).toBe(120.5);
      expect(cal!.dec).toBe(30.0);
    });

    it("handles inline comments after /", () => {
      const text = [
        "CRVAL1 = 83.0 / RA at reference pixel",
        "CRVAL2 = -5.0 / DEC at reference pixel",
        "CRPIX1 = 512 / Reference pixel X",
        "CRPIX2 = 512 / Reference pixel Y",
        "CD1_1 = -0.001",
        "CD2_2 = 0.001",
      ].join("\n");

      const cal = parseWCSFile(textToBuffer(text));
      expect(cal).not.toBeNull();
      expect(cal!.ra).toBe(83.0);
    });

    it("skips comment lines starting with #", () => {
      const text = [
        "# This is a comment",
        "// This is also a comment",
        "CRVAL1 = 83.0",
        "CRVAL2 = -5.0",
        "CRPIX1 = 512",
        "CRPIX2 = 512",
        "CD1_1 = -0.001",
        "CD2_2 = 0.001",
      ].join("\n");

      const cal = parseWCSFile(textToBuffer(text));
      expect(cal).not.toBeNull();
    });

    it("returns null for text without WCS content", () => {
      const text = "This is just a plain text file\nNo WCS data here\n";
      expect(parseWCSFile(textToBuffer(text))).toBeNull();
    });
  });

  it("returns null for empty buffer", () => {
    expect(parseWCSFile(new ArrayBuffer(0))).toBeNull();
  });
});
