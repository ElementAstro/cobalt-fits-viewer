import { formatBytes, formatDate } from "../format";

describe("utils format", () => {
  it("formats bytes across unit boundaries", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.00 GB");
  });

  it("formats timestamps to YYYY-MM-DD", () => {
    const ts = Date.UTC(2024, 0, 2, 10, 30, 0);
    expect(formatDate(ts)).toBe("2024-01-02");
  });
});
