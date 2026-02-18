import {
  generateIntegrationReport,
  formatExposureTime,
  exportReportAsMarkdown,
} from "../integrationReport";
import type { FitsMetadata } from "../../fits/types";

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id: `file-${Math.random().toString(36).slice(2, 8)}`,
    filename: "test.fits",
    filepath: "/path/test.fits",
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    object: "M42",
    filter: "Ha",
    exptime: 300,
    ...overrides,
  }) as FitsMetadata;

describe("integrationReport", () => {
  // ===== generateIntegrationReport =====

  describe("generateIntegrationReport", () => {
    it("returns empty report for no files", () => {
      const report = generateIntegrationReport([]);
      expect(report.targets).toHaveLength(0);
      expect(report.totalFrames).toBe(0);
      expect(report.totalExposure).toBe(0);
    });

    it("only counts light frames", () => {
      const files = [
        makeFile({ frameType: "light", exptime: 300 }),
        makeFile({ frameType: "dark", exptime: 300 }),
        makeFile({ frameType: "flat", exptime: 1 }),
        makeFile({ frameType: "bias", exptime: 0 }),
      ];
      const report = generateIntegrationReport(files);
      expect(report.totalFrames).toBe(1);
      expect(report.totalExposure).toBe(300);
    });

    it("supports configurable frame scope", () => {
      const files = [
        makeFile({ frameType: "light", exptime: 300 }),
        makeFile({ frameType: "darkflat", exptime: 2 }),
      ];
      const report = generateIntegrationReport(files, {
        includedFrameTypes: ["light", "darkflat"],
      });
      expect(report.totalFrames).toBe(2);
      expect(report.totalExposure).toBe(302);
      expect(report.includedFrameTypes).toEqual(["light", "darkflat"]);
    });

    it("normalizes frame scope by dropping blanks and deduping", () => {
      const files = [
        makeFile({ frameType: "light", exptime: 100 }),
        makeFile({ frameType: "darkflat", exptime: 10 }),
      ];
      const report = generateIntegrationReport(files, {
        includedFrameTypes: ["light", "", "darkflat", "light"],
      });
      expect(report.includedFrameTypes).toEqual(["light", "darkflat"]);
      expect(report.totalFrames).toBe(2);
    });

    it("groups by target", () => {
      const files = [
        makeFile({ object: "M42", filter: "Ha", exptime: 300 }),
        makeFile({ object: "M42", filter: "OIII", exptime: 300 }),
        makeFile({ object: "M31", filter: "L", exptime: 120 }),
      ];
      const report = generateIntegrationReport(files);
      expect(report.targets).toHaveLength(2);
      const m42 = report.targets.find((t) => t.target === "M42");
      expect(m42).toBeDefined();
      expect(m42!.totalFrames).toBe(2);
      expect(m42!.totalExposure).toBe(600);
    });

    it("groups filters within target", () => {
      const files = [
        makeFile({ object: "M42", filter: "Ha", exptime: 300 }),
        makeFile({ object: "M42", filter: "Ha", exptime: 300 }),
        makeFile({ object: "M42", filter: "OIII", exptime: 300 }),
      ];
      const report = generateIntegrationReport(files);
      const m42 = report.targets.find((t) => t.target === "M42")!;
      expect(m42.filters).toHaveLength(2);
      const ha = m42.filters.find((f) => f.name === "Ha")!;
      expect(ha.frameCount).toBe(2);
      expect(ha.totalExposure).toBe(600);
      expect(ha.avgExposure).toBe(300);
    });

    it("uses 'Unknown' for files without object", () => {
      const files = [makeFile({ object: undefined })];
      const report = generateIntegrationReport(files);
      expect(report.targets[0].target).toBe("Unknown");
    });

    it("uses 'No Filter' for files without filter", () => {
      const files = [makeFile({ filter: undefined })];
      const report = generateIntegrationReport(files);
      expect(report.targets[0].filters[0].name).toBe("No Filter");
    });

    it("calculates date range", () => {
      const files = [
        makeFile({ dateObs: "2024-01-15T22:00:00Z" }),
        makeFile({ dateObs: "2024-01-17T22:00:00Z" }),
        makeFile({ dateObs: "2024-01-16T22:00:00Z" }),
      ];
      const report = generateIntegrationReport(files);
      expect(report.dateRange).toEqual(["2024-01-15T22:00:00Z", "2024-01-17T22:00:00Z"]);
    });

    it("collects unique filters", () => {
      const files = [
        makeFile({ filter: "Ha" }),
        makeFile({ filter: "OIII" }),
        makeFile({ filter: "Ha" }),
        makeFile({ filter: "SII" }),
      ];
      const report = generateIntegrationReport(files);
      expect(report.uniqueFilters).toEqual(["Ha", "OIII", "SII"]);
    });

    it("calculates average quality when available", () => {
      const files = [
        makeFile({ object: "M42", filter: "Ha", qualityScore: 80 }),
        makeFile({ object: "M42", filter: "Ha", qualityScore: 60 }),
      ];
      const report = generateIntegrationReport(files);
      const ha = report.targets[0].filters.find((f) => f.name === "Ha")!;
      expect(ha.avgQuality).toBe(70);
    });

    it("returns null avgQuality when no scores", () => {
      const files = [makeFile({ qualityScore: undefined })];
      const report = generateIntegrationReport(files);
      expect(report.targets[0].filters[0].avgQuality).toBeNull();
    });

    it("sorts targets by total exposure descending", () => {
      const files = [
        makeFile({ object: "M31", exptime: 100 }),
        makeFile({ object: "M42", exptime: 300 }),
        makeFile({ object: "M42", exptime: 300 }),
      ];
      const report = generateIntegrationReport(files);
      expect(report.targets[0].target).toBe("M42");
      expect(report.targets[1].target).toBe("M31");
    });
  });

  // ===== formatExposureTime =====

  describe("formatExposureTime", () => {
    it("formats seconds", () => {
      expect(formatExposureTime(30)).toBe("30s");
    });

    it("formats minutes", () => {
      expect(formatExposureTime(150)).toBe("2.5m");
    });

    it("formats hours", () => {
      expect(formatExposureTime(7200)).toBe("2.0h");
    });

    it("handles zero", () => {
      expect(formatExposureTime(0)).toBe("0s");
    });
  });

  // ===== exportReportAsMarkdown =====

  describe("exportReportAsMarkdown", () => {
    it("produces valid markdown with headers", () => {
      const files = [
        makeFile({ object: "M42", filter: "Ha", exptime: 300 }),
        makeFile({ object: "M42", filter: "OIII", exptime: 300 }),
      ];
      const report = generateIntegrationReport(files);
      const md = exportReportAsMarkdown(report);

      expect(md).toContain("# Integration Report");
      expect(md).toContain("## M42");
      expect(md).toContain("| Ha |");
      expect(md).toContain("| OIII |");
      expect(md).toContain("**Total**");
    });

    it("includes date range when present", () => {
      const files = [
        makeFile({ dateObs: "2024-01-15T22:00:00Z" }),
        makeFile({ dateObs: "2024-01-17T22:00:00Z" }),
      ];
      const report = generateIntegrationReport(files);
      const md = exportReportAsMarkdown(report);
      expect(md).toContain("2024-01-15");
      expect(md).toContain("2024-01-17");
    });

    it("handles empty report", () => {
      const report = generateIntegrationReport([]);
      const md = exportReportAsMarkdown(report);
      expect(md).toContain("# Integration Report");
      expect(md).toContain("Total frames:** 0");
    });
  });
});
