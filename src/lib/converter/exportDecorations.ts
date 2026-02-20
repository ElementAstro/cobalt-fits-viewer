import type { AstrometryAnnotation } from "../astrometry/types";
import type { ExportFormat, StarAnnotationPoint } from "../fits/types";

export interface ExportRenderOptions {
  includeAnnotations?: boolean;
  includeWatermark?: boolean;
  watermarkText?: string;
}

export interface ExportDecorationSource {
  starAnnotations?: StarAnnotationPoint[] | null;
  astrometryAnnotations?: AstrometryAnnotation[] | null;
}

export interface ApplyExportDecorationsInput {
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  filename: string;
  format: ExportFormat;
  options?: ExportRenderOptions;
  source?: ExportDecorationSource;
}

export interface ExportDecorationResult {
  rgbaData: Uint8ClampedArray;
  annotationsDrawn: number;
  watermarkApplied: boolean;
  warnings: string[];
}

interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const STAR_MANUAL_COLOR: RGBAColor = { r: 34, g: 197, b: 94, a: 0.95 };
const STAR_DETECTED_COLOR: RGBAColor = { r: 245, g: 158, b: 11, a: 0.95 };
const ASTRO_COLOR: RGBAColor = { r: 56, g: 189, b: 248, a: 0.9 };
const WATERMARK_BG: RGBAColor = { r: 17, g: 24, b: 39, a: 0.68 };
const WATERMARK_FG: RGBAColor = { r: 255, g: 255, b: 255, a: 0.9 };

const FONT_5X7: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "?": ["01110", "10001", "00010", "00100", "00100", "00000", "00100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  ":": ["00000", "00110", "00110", "00000", "00110", "00110", "00000"],
  "|": ["00100", "00100", "00100", "00100", "00100", "00100", "00100"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "10000", "10000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10001", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

function clampByte(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function blendPixel(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: RGBAColor,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const off = (y * width + x) * 4;
  const srcA = Math.max(0, Math.min(1, color.a));
  if (srcA <= 0) return;
  const dstA = (rgba[off + 3] ?? 255) / 255;
  const outA = srcA + dstA * (1 - srcA);
  const blend = (src: number, dst: number): number => {
    if (outA <= 1e-6) return 0;
    return ((src * srcA + dst * dstA * (1 - srcA)) / outA) * 255;
  };
  const dstR = (rgba[off] ?? 0) / 255;
  const dstG = (rgba[off + 1] ?? 0) / 255;
  const dstB = (rgba[off + 2] ?? 0) / 255;
  rgba[off] = clampByte(blend(color.r / 255, dstR));
  rgba[off + 1] = clampByte(blend(color.g / 255, dstG));
  rgba[off + 2] = clampByte(blend(color.b / 255, dstB));
  rgba[off + 3] = clampByte(outA * 255);
}

function drawRect(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RGBAColor,
): void {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      blendPixel(rgba, width, height, x0 + xx, y0 + yy, color);
    }
  }
}

function drawCircleStroke(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  strokeWidth: number,
  color: RGBAColor,
): void {
  const r = Math.max(1, radius);
  const t = Math.max(1, strokeWidth);
  const outer = r + t / 2;
  const inner = Math.max(0, r - t / 2);
  const x0 = Math.floor(cx - outer - 1);
  const x1 = Math.ceil(cx + outer + 1);
  const y0 = Math.floor(cy - outer - 1);
  const y1 = Math.ceil(cy + outer + 1);
  const outer2 = outer * outer;
  const inner2 = inner * inner;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= outer2 && d2 >= inner2) {
        blendPixel(rgba, width, height, x, y, color);
      }
    }
  }
}

function parseColor(input: string | undefined, fallback: RGBAColor): RGBAColor {
  if (!input) return fallback;
  const value = input.trim();
  if (!value) return fallback;

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: fallback.a,
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : fallback.a,
      };
    }
  }

  const rgbaMatch = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((v) => v.trim());
    if (parts.length >= 3) {
      return {
        r: clampByte(Number(parts[0])),
        g: clampByte(Number(parts[1])),
        b: clampByte(Number(parts[2])),
        a: parts.length > 3 ? Math.max(0, Math.min(1, Number(parts[3]))) : fallback.a,
      };
    }
  }

  return fallback;
}

function drawChar(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  ch: string,
  color: RGBAColor,
  scale: number,
): void {
  const glyph = FONT_5X7[ch] ?? FONT_5X7["?"];
  const s = Math.max(1, Math.floor(scale));
  for (let gy = 0; gy < glyph.length; gy++) {
    const row = glyph[gy];
    for (let gx = 0; gx < row.length; gx++) {
      if (row[gx] !== "1") continue;
      drawRect(rgba, width, height, x + gx * s, y + gy * s, s, s, color);
    }
  }
}

function drawText(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  text: string,
  color: RGBAColor,
  scale: number,
): void {
  const normalized = text
    .split("")
    .map((ch) => {
      const up = ch.toUpperCase();
      return FONT_5X7[up] ? up : FONT_5X7[ch] ? ch : "?";
    })
    .join("");
  const s = Math.max(1, Math.floor(scale));
  const advance = 6 * s;
  let cx = x;
  for (const ch of normalized) {
    drawChar(rgba, width, height, cx, y, ch, color, s);
    cx += advance;
    if (cx > width - advance) break;
  }
}

function defaultWatermarkText(filename: string, format: ExportFormat): string {
  const iso = new Date().toISOString().replace("T", " ").replace("Z", " UTC");
  return `${filename} | ${format.toUpperCase()} | ${iso}`;
}

export function applyExportDecorations(input: ApplyExportDecorationsInput): ExportDecorationResult {
  const output = new Uint8ClampedArray(input.rgbaData);
  const warnings: string[] = [];
  const opts = input.options ?? {};

  let annotationsDrawn = 0;
  if (opts.includeAnnotations) {
    const stars = input.source?.starAnnotations ?? [];
    for (const point of stars) {
      if (!point.enabled) continue;
      const color = parseColor(
        point.metrics?.peak ? "#22c55e" : undefined,
        point.source === "manual" ? STAR_MANUAL_COLOR : STAR_DETECTED_COLOR,
      );
      drawCircleStroke(
        output,
        input.width,
        input.height,
        point.x,
        point.y,
        point.source === "manual" ? 4 : 3,
        1.5,
        color,
      );
      if (point.anchorIndex != null) {
        drawText(
          output,
          input.width,
          input.height,
          Math.round(point.x + 5),
          Math.round(point.y - 4),
          String(point.anchorIndex),
          WATERMARK_FG,
          1,
        );
      }
      annotationsDrawn++;
    }

    const astrometry = input.source?.astrometryAnnotations ?? [];
    for (const ann of astrometry) {
      const radius = Number.isFinite(ann.radius) ? Math.max(3, Math.min(24, ann.radius ?? 5)) : 5;
      drawCircleStroke(
        output,
        input.width,
        input.height,
        ann.pixelx,
        ann.pixely,
        radius,
        1.2,
        ASTRO_COLOR,
      );
      const label = ann.names?.[0] ?? ann.type;
      if (label) {
        drawText(
          output,
          input.width,
          input.height,
          Math.round(ann.pixelx + radius + 3),
          Math.round(ann.pixely - 3),
          label.slice(0, 18),
          ASTRO_COLOR,
          1,
        );
      }
      annotationsDrawn++;
    }

    if (annotationsDrawn === 0) {
      warnings.push("No annotations available for export.");
    }
  }

  let watermarkApplied = false;
  if (opts.includeWatermark) {
    const text = (
      opts.watermarkText?.trim() || defaultWatermarkText(input.filename, input.format)
    ).slice(0, 120);
    const scale = 1;
    const charAdvance = 6 * scale;
    const textWidth = text.length * charAdvance;
    const padX = 6;
    const padY = 4;
    const boxW = Math.min(input.width - 2, textWidth + padX * 2);
    const boxH = 7 * scale + padY * 2;
    const x = Math.max(1, input.width - boxW - 6);
    const y = Math.max(1, input.height - boxH - 6);

    drawRect(output, input.width, input.height, x, y, boxW, boxH, WATERMARK_BG);
    drawText(output, input.width, input.height, x + padX, y + padY, text, WATERMARK_FG, scale);
    watermarkApplied = true;
  }

  return {
    rgbaData: output,
    annotationsDrawn,
    watermarkApplied,
    warnings,
  };
}
