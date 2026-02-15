import {
  formatHeaderRecord,
  formatNumber,
  parseHeaderPositions,
  readAscii,
  writeAscii,
  expandHeaderAndInsert,
} from "../headerWriter";

const RECORD_LEN = 80;
const BLOCK_SIZE = 2880;

// ===== Helper: build a minimal FITS header buffer =====

function buildFitsHeader(records: string[]): Uint8Array {
  // Each record is 80 bytes, padded to 2880-byte block
  const allRecords = [...records, "END".padEnd(RECORD_LEN)];
  const totalRecords = allRecords.length;
  const blocks = Math.ceil((totalRecords * RECORD_LEN) / BLOCK_SIZE);
  const data = new Uint8Array(blocks * BLOCK_SIZE);
  // Fill with spaces (0x20)
  data.fill(0x20);
  let offset = 0;
  for (const rec of allRecords) {
    const padded = rec.padEnd(RECORD_LEN);
    for (let i = 0; i < RECORD_LEN; i++) {
      data[offset + i] = padded.charCodeAt(i);
    }
    offset += RECORD_LEN;
  }
  return data;
}

// ===== readAscii / writeAscii =====

describe("readAscii", () => {
  it("reads ASCII string from Uint8Array", () => {
    const data = new Uint8Array([72, 69, 76, 76, 79]); // HELLO
    expect(readAscii(data, 0, 5)).toBe("HELLO");
  });

  it("reads with offset", () => {
    const data = new Uint8Array([65, 66, 67, 68, 69]); // ABCDE
    expect(readAscii(data, 2, 3)).toBe("CDE");
  });

  it("does not read beyond data length", () => {
    const data = new Uint8Array([65, 66]);
    expect(readAscii(data, 0, 10)).toBe("AB");
  });
});

describe("writeAscii", () => {
  it("writes ASCII string to Uint8Array", () => {
    const data = new Uint8Array(5);
    writeAscii(data, 0, "HELLO");
    expect(readAscii(data, 0, 5)).toBe("HELLO");
  });

  it("writes with offset", () => {
    const data = new Uint8Array(10);
    data.fill(0x20);
    writeAscii(data, 3, "ABC");
    expect(readAscii(data, 3, 3)).toBe("ABC");
  });

  it("does not write beyond data length", () => {
    const data = new Uint8Array(3);
    writeAscii(data, 0, "ABCDEF");
    expect(readAscii(data, 0, 3)).toBe("ABC");
  });
});

// ===== formatNumber =====

describe("formatNumber", () => {
  it("formats integers without decimal point", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(-10)).toBe("-10");
  });

  it("formats floats with precision", () => {
    const result = formatNumber(3.14);
    expect(parseFloat(result)).toBeCloseTo(3.14, 10);
  });

  it("strips trailing zeros", () => {
    const result = formatNumber(1.5);
    expect(result).toBe("1.5");
    expect(result).not.toMatch(/0$/);
  });

  it("handles very small numbers", () => {
    const result = formatNumber(0.000001);
    expect(parseFloat(result)).toBeCloseTo(0.000001, 10);
  });

  it("handles large integers", () => {
    expect(formatNumber(2000)).toBe("2000");
  });
});

// ===== formatHeaderRecord =====

describe("formatHeaderRecord", () => {
  it("produces exactly 80-char records", () => {
    const record = formatHeaderRecord({ key: "CRVAL1", value: 83.633 });
    expect(record.length).toBe(RECORD_LEN);
  });

  it("pads key to 8 characters", () => {
    const record = formatHeaderRecord({ key: "RA", value: 10.0 });
    expect(record.substring(0, 8)).toBe("RA      ");
  });

  it("truncates keys longer than 8 characters", () => {
    const record = formatHeaderRecord({ key: "LONGKEYNAME", value: 1 });
    expect(record.substring(0, 8)).toBe("LONGKEYN");
  });

  it("formats string values with single quotes", () => {
    const record = formatHeaderRecord({ key: "CTYPE1", value: "RA---TAN" });
    expect(record).toContain("'RA---TAN'");
  });

  it("right-aligns numeric values", () => {
    const record = formatHeaderRecord({ key: "NAXIS", value: 2 });
    // "= " then right-aligned 20-char field
    const valField = record.substring(10, 30);
    expect(valField.trim()).toBe("2");
    expect(valField.endsWith("2")).toBe(true);
  });

  it("formats boolean true as T", () => {
    const record = formatHeaderRecord({ key: "SIMPLE", value: true });
    expect(record).toContain("T");
  });

  it("formats boolean false as F", () => {
    const record = formatHeaderRecord({ key: "EXTEND", value: false });
    expect(record).toContain("F");
  });

  it("includes comment after /", () => {
    const record = formatHeaderRecord({ key: "A", value: 1, comment: "test comment" });
    expect(record).toContain("/ test comment");
  });

  it("works without comment", () => {
    const record = formatHeaderRecord({ key: "A", value: 1 });
    expect(record).not.toContain("/");
    expect(record.length).toBe(RECORD_LEN);
  });

  it("truncates records longer than 80 chars", () => {
    const record = formatHeaderRecord({
      key: "A",
      value: "short",
      comment: "a".repeat(100),
    });
    expect(record.length).toBe(RECORD_LEN);
  });
});

// ===== parseHeaderPositions =====

describe("parseHeaderPositions", () => {
  it("finds END keyword offset", () => {
    const data = buildFitsHeader([
      "SIMPLE  =                    T".padEnd(RECORD_LEN),
      "BITPIX  =                   16".padEnd(RECORD_LEN),
    ]);
    const { endOffset } = parseHeaderPositions(data);
    // SIMPLE + BITPIX = 2 records, so END is at offset 160
    expect(endOffset).toBe(2 * RECORD_LEN);
  });

  it("tracks existing keys with = sign", () => {
    const data = buildFitsHeader([
      "SIMPLE  =                    T".padEnd(RECORD_LEN),
      "BITPIX  =                   16".padEnd(RECORD_LEN),
      "NAXIS   =                    2".padEnd(RECORD_LEN),
    ]);
    const { existingKeys } = parseHeaderPositions(data);
    expect(existingKeys.has("SIMPLE")).toBe(true);
    expect(existingKeys.has("BITPIX")).toBe(true);
    expect(existingKeys.has("NAXIS")).toBe(true);
    expect(existingKeys.get("SIMPLE")).toBe(0);
    expect(existingKeys.get("BITPIX")).toBe(RECORD_LEN);
    expect(existingKeys.get("NAXIS")).toBe(2 * RECORD_LEN);
  });

  it("ignores COMMENT and HISTORY records", () => {
    const data = buildFitsHeader([
      "SIMPLE  =                    T".padEnd(RECORD_LEN),
      "COMMENT This is a comment".padEnd(RECORD_LEN),
      "HISTORY Some history".padEnd(RECORD_LEN),
    ]);
    const { existingKeys } = parseHeaderPositions(data);
    expect(existingKeys.has("COMMENT")).toBe(false);
    expect(existingKeys.has("HISTORY")).toBe(false);
    expect(existingKeys.has("SIMPLE")).toBe(true);
  });

  it("computes headerEnd as aligned to 2880 bytes", () => {
    const data = buildFitsHeader(["SIMPLE  =                    T".padEnd(RECORD_LEN)]);
    const { headerEnd } = parseHeaderPositions(data);
    expect(headerEnd % BLOCK_SIZE).toBe(0);
    expect(headerEnd).toBe(BLOCK_SIZE);
  });

  it("returns endOffset=-1 when END is missing", () => {
    // Fill with non-END records, no END keyword
    const data = new Uint8Array(BLOCK_SIZE);
    data.fill(0x20);
    // Write a long stream of blanks that looks like empty records — no END
    // parseHeaderPositions should bail at safety limit or end of data
    const { endOffset } = parseHeaderPositions(data);
    expect(endOffset).toBe(-1);
  });
});

// ===== expandHeaderAndInsert =====

describe("expandHeaderAndInsert", () => {
  it("inserts new records before END", async () => {
    const original = buildFitsHeader([
      "SIMPLE  =                    T".padEnd(RECORD_LEN),
      "BITPIX  =                   16".padEnd(RECORD_LEN),
    ]);
    const endOffset = 2 * RECORD_LEN;
    const headerEnd = BLOCK_SIZE;
    const newRecord = formatHeaderRecord({ key: "CRVAL1", value: 83.633, comment: "RA" });

    const result = await expandHeaderAndInsert(original, endOffset, headerEnd, [newRecord]);

    // Verify the new record is present
    const content = readAscii(result, endOffset, RECORD_LEN);
    expect(content).toContain("CRVAL1");
    expect(content).toContain("83.633");

    // Verify END follows after
    const endContent = readAscii(result, endOffset + RECORD_LEN, 3);
    expect(endContent).toBe("END");
  });

  it("preserves data after header", async () => {
    // Build header + fake pixel data
    const headerData = buildFitsHeader(["SIMPLE  =                    T".padEnd(RECORD_LEN)]);
    const pixelData = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const original = new Uint8Array(headerData.length + pixelData.length);
    original.set(headerData);
    original.set(pixelData, headerData.length);

    const endOffset = 1 * RECORD_LEN;
    const headerEnd = BLOCK_SIZE;

    // Add enough records to force header expansion
    const records: string[] = [];
    for (let i = 0; i < 36; i++) {
      records.push(formatHeaderRecord({ key: `KEY${i}`, value: i }));
    }

    const result = await expandHeaderAndInsert(original, endOffset, headerEnd, records);

    // Result should be larger than original
    expect(result.length).toBeGreaterThan(original.length);

    // The pixel data should still be present at the end
    const pixelStart = result.length - pixelData.length;
    expect(result[pixelStart]).toBe(0xde);
    expect(result[pixelStart + 1]).toBe(0xad);
    expect(result[pixelStart + 2]).toBe(0xbe);
    expect(result[pixelStart + 3]).toBe(0xef);
  });

  it("result size is block-aligned", async () => {
    const original = buildFitsHeader(["SIMPLE  =                    T".padEnd(RECORD_LEN)]);
    const endOffset = RECORD_LEN;
    const headerEnd = BLOCK_SIZE;
    const records = [formatHeaderRecord({ key: "TEST", value: 1 })];

    const result = await expandHeaderAndInsert(original, endOffset, headerEnd, records);
    expect(result.length % BLOCK_SIZE).toBe(0);
  });
});
