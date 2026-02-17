import { detectStars, estimateBackground } from "../starDetection";

function makeImage(width: number, height: number, background: number = 0): Float32Array {
  return new Float32Array(width * height).fill(background);
}

function putSquareStar(
  pixels: Float32Array,
  width: number,
  cx: number,
  cy: number,
  size: number,
  value: number,
) {
  const half = Math.floor(size / 2);
  for (let y = cy - half; y <= cy + half; y++) {
    for (let x = cx - half; x <= cx + half; x++) {
      if (x >= 0 && y >= 0 && x < width && y * width + x < pixels.length) {
        pixels[y * width + x] = value;
      }
    }
  }
}

describe("stacking starDetection", () => {
  it("estimates constant background with fallback noise", () => {
    const width = 16;
    const height = 16;
    const pixels = makeImage(width, height, 12);
    const { background, noise } = estimateBackground(pixels, width, height, 8);
    expect(background).toHaveLength(width * height);
    expect(background[0]).toBeCloseTo(12, 5);
    expect(noise).toBe(1);
  });

  it("detects stars in center and filters by border margin", () => {
    const width = 40;
    const height = 40;
    const pixels = makeImage(width, height, 0);
    putSquareStar(pixels, width, 20, 20, 3, 20);
    putSquareStar(pixels, width, 2, 2, 3, 20); // near border should be ignored

    const stars = detectStars(pixels, width, height, {
      sigmaThreshold: 3,
      minArea: 3,
      maxArea: 50,
      borderMargin: 8,
    });

    expect(stars.length).toBe(1);
    expect(stars[0].cx).toBeCloseTo(20, 1);
    expect(stars[0].cy).toBeCloseTo(20, 1);
    expect(stars[0].area).toBeGreaterThanOrEqual(3);
    expect(stars[0].flux).toBeGreaterThan(0);
  });

  it("respects maxStars and returns empty when no candidate exists", () => {
    const width = 60;
    const height = 60;
    const pixels = makeImage(width, height, 0);
    putSquareStar(pixels, width, 20, 20, 3, 25);
    putSquareStar(pixels, width, 30, 30, 3, 30);
    putSquareStar(pixels, width, 40, 20, 3, 35);

    const limited = detectStars(pixels, width, height, {
      sigmaThreshold: 3,
      maxStars: 2,
      minArea: 3,
      borderMargin: 5,
    });
    expect(limited).toHaveLength(2);

    const none = detectStars(makeImage(30, 30, 0), 30, 30, { sigmaThreshold: 10 });
    expect(none).toEqual([]);
  });
});
