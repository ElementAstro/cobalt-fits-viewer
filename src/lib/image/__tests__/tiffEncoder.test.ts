import { encodeTiff, encodeTiffDocument } from "../encoders/tiff";

interface ClassicIfdEntry {
  tag: number;
  type: number;
  count: number;
  valueOrOffset: number;
}

function readClassicIfd(
  bytes: Uint8Array,
  offset: number,
): {
  entries: ClassicIfdEntry[];
  nextOffset: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const count = view.getUint16(offset, true);
  const entries: ClassicIfdEntry[] = [];
  let cursor = offset + 2;
  for (let i = 0; i < count; i++) {
    entries.push({
      tag: view.getUint16(cursor, true),
      type: view.getUint16(cursor + 2, true),
      count: view.getUint32(cursor + 4, true),
      valueOrOffset: view.getUint32(cursor + 8, true),
    });
    cursor += 12;
  }
  return { entries, nextOffset: view.getUint32(cursor, true) };
}

function findTag(entries: ClassicIfdEntry[], tag: number): ClassicIfdEntry | undefined {
  return entries.find((entry) => entry.tag === tag);
}

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

  it("writes multipage IFD chain for TIFF document", () => {
    const pages = [
      {
        width: 2,
        height: 1,
        pixels: new Float32Array([0.1, 0.2]),
        bitDepth: 32 as const,
        sampleFormat: "float" as const,
        colorMode: "mono" as const,
      },
      {
        width: 2,
        height: 1,
        pixels: new Float32Array([0.3, 0.4]),
        bitDepth: 32 as const,
        sampleFormat: "float" as const,
        colorMode: "mono" as const,
      },
    ];
    const bytes = encodeTiffDocument(pages, {
      compression: "none",
      colorMode: "mono",
      bitDepth: 32,
    });

    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const firstIfdOffset = view.getUint32(4, true);
    const firstIfd = readClassicIfd(bytes, firstIfdOffset);
    expect(firstIfd.nextOffset).toBeGreaterThan(0);
    const secondIfd = readClassicIfd(bytes, firstIfd.nextOffset);
    expect(secondIfd.nextOffset).toBe(0);
  });

  it("writes compression, sample format and predictor tags", () => {
    const floatPage = encodeTiffDocument(
      [
        {
          width: 2,
          height: 1,
          pixels: new Float32Array([1.25, -0.5]),
          bitDepth: 32,
          sampleFormat: "float",
          colorMode: "mono",
        },
      ],
      {
        compression: "lzw",
        colorMode: "mono",
      },
    );
    const floatIfdOffset = new DataView(floatPage.buffer, floatPage.byteOffset).getUint32(4, true);
    const floatIfd = readClassicIfd(floatPage, floatIfdOffset);
    expect(findTag(floatIfd.entries, 259)?.valueOrOffset).toBe(5);
    expect(findTag(floatIfd.entries, 339)?.valueOrOffset).toBe(3);
    expect(findTag(floatIfd.entries, 317)).toBeUndefined();

    const intPage = encodeTiff(new Uint8ClampedArray([0, 10, 20, 255, 200, 210, 220, 255]), 2, 1, {
      bitDepth: 8,
      colorMode: "rgb",
      compression: "deflate",
    });
    const intIfdOffset = new DataView(intPage.buffer, intPage.byteOffset).getUint32(4, true);
    const intIfd = readClassicIfd(intPage, intIfdOffset);
    expect(findTag(intIfd.entries, 259)?.valueOrOffset).toBe(8);
    expect(findTag(intIfd.entries, 317)?.valueOrOffset).toBe(2);
  });

  it("switches to BigTIFF when threshold is exceeded", () => {
    const bytes = encodeTiffDocument(
      [
        {
          width: 1,
          height: 1,
          pixels: new Float32Array([0.5]),
          bitDepth: 32,
          sampleFormat: "float",
          colorMode: "mono",
        },
      ],
      {
        compression: "none",
        bigTiffThresholdBytes: 1,
      },
    );
    expect(bytes[0]).toBe(0x49);
    expect(bytes[1]).toBe(0x49);
    expect(bytes[2]).toBe(0x2b);
    expect(bytes[3]).toBe(0x00);
  });
});
