import { renderComposite } from "../renderer";

function buildLayer(id: string, pixels: Float32Array, tint: { r: number; g: number; b: number }) {
  return {
    id,
    fileId: id,
    filepath: "",
    filename: id,
    enabled: true,
    isLuminance: false,
    opacity: 1,
    blendMode: "normal" as const,
    tint,
    useForLinearMatch: true,
    useForBrightnessBalance: true,
    pixels,
  };
}

describe("composite renderer", () => {
  it("renders preview and full", async () => {
    const width = 4;
    const height = 4;
    const l1 = buildLayer("a", new Float32Array(width * height).fill(0.2), { r: 1, g: 0, b: 0 });
    const l2 = buildLayer("b", new Float32Array(width * height).fill(0.8), { r: 0, g: 0, b: 1 });

    const options = {
      linkedStretch: false,
      autoLinearMatch: false,
      autoBrightnessBalance: false,
      colorSpace: "hsl" as const,
      applyPixelMath: false,
      pixelMath: { r: "R", g: "G", b: "B" },
      splitPosition: 0.5,
      previewScale: 0.5,
      previewMode: "composite" as const,
    };

    const preview = await renderComposite({
      layers: [l1, l2],
      width,
      height,
      options,
      mode: "preview",
    });
    expect(preview.width).toBe(2);
    expect(preview.height).toBe(2);

    const full = await renderComposite({
      layers: [l1, l2],
      width,
      height,
      options,
      mode: "full",
    });
    expect(full.width).toBe(4);
    expect(full.height).toBe(4);
    expect(full.rgbaData.length).toBe(4 * 4 * 4);
  });

  it("uses selected color space for luminance integration", async () => {
    const width = 3;
    const height = 1;
    const colorLayer = {
      ...buildLayer("color", new Float32Array([0.2, 0.5, 0.8]), { r: 1, g: 0.4, b: 0.1 }),
      isLuminance: false,
    };
    const lLayer = {
      ...buildLayer("l", new Float32Array([0.4, 0.6, 0.8]), { r: 1, g: 1, b: 1 }),
      isLuminance: true,
    };
    const baseOptions = {
      linkedStretch: false,
      autoLinearMatch: false,
      autoBrightnessBalance: false,
      applyPixelMath: false,
      pixelMath: { r: "R", g: "G", b: "B" },
      splitPosition: 0.5,
      previewScale: 1,
      previewMode: "composite" as const,
    };

    const hsl = await renderComposite({
      layers: [colorLayer, lLayer],
      width,
      height,
      options: { ...baseOptions, colorSpace: "hsl" as const },
      mode: "full",
    });
    const hsv = await renderComposite({
      layers: [colorLayer, lLayer],
      width,
      height,
      options: { ...baseOptions, colorSpace: "hsv" as const },
      mode: "full",
    });
    const lab = await renderComposite({
      layers: [colorLayer, lLayer],
      width,
      height,
      options: { ...baseOptions, colorSpace: "lab" as const },
      mode: "full",
    });

    expect(hsl.channels.r[1]).not.toBeCloseTo(hsv.channels.r[1], 4);
    expect(lab.channels.r[1]).not.toBeCloseTo(hsv.channels.r[1], 4);
  });
});
