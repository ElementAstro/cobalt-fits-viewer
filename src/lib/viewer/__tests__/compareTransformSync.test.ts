import { syncCompareTransform } from "../compareTransformSync";
import { remapPointBetweenSpaces, screenToImagePoint } from "../transform";

describe("compare transform sync", () => {
  it("keeps transform unchanged for same image and viewport geometry", () => {
    const sourceTransform = {
      scale: 1.8,
      translateX: 100,
      translateY: -50,
      canvasWidth: 320,
      canvasHeight: 200,
    };

    const synced = syncCompareTransform({
      sourceTransform,
      targetTransform: {
        scale: 1,
        translateX: 0,
        translateY: 0,
        canvasWidth: 320,
        canvasHeight: 200,
      },
      sourceImage: { width: 2000, height: 1000 },
      targetImage: { width: 2000, height: 1000 },
    });

    expect(synced.scale).toBeCloseTo(sourceTransform.scale, 6);
    expect(synced.translateX).toBeCloseTo(sourceTransform.translateX, 4);
    expect(synced.translateY).toBeCloseTo(sourceTransform.translateY, 4);
  });

  it("preserves normalized viewport center with mismatched image dimensions", () => {
    const sourceTransform = {
      scale: 2.2,
      translateX: -140,
      translateY: 80,
      canvasWidth: 360,
      canvasHeight: 240,
    };
    const sourceImage = { width: 4096, height: 3072 };
    const targetImage = { width: 2048, height: 1024 };

    const synced = syncCompareTransform({
      sourceTransform,
      targetTransform: {
        scale: 1,
        translateX: 0,
        translateY: 0,
        canvasWidth: 300,
        canvasHeight: 220,
      },
      sourceImage,
      targetImage,
    });

    expect(Number.isFinite(synced.scale)).toBe(true);
    expect(synced.scale).toBeGreaterThan(0);

    const sourceCenterImage = screenToImagePoint(
      { x: sourceTransform.canvasWidth / 2, y: sourceTransform.canvasHeight / 2 },
      sourceTransform,
      sourceImage.width,
      sourceImage.height,
    );
    const targetCenterImage = screenToImagePoint(
      { x: 150, y: 110 },
      {
        ...synced,
        canvasWidth: 300,
        canvasHeight: 220,
      },
      targetImage.width,
      targetImage.height,
    );
    const remappedCenter = remapPointBetweenSpaces(
      sourceCenterImage,
      sourceImage.width,
      sourceImage.height,
      targetImage.width,
      targetImage.height,
    );

    expect(targetCenterImage.x).toBeCloseTo(remappedCenter.x, 2);
    expect(targetCenterImage.y).toBeCloseTo(remappedCenter.y, 2);
  });

  it("falls back to source transform when target viewport is not ready", () => {
    const sourceTransform = {
      scale: 1.6,
      translateX: 20,
      translateY: -10,
      canvasWidth: 320,
      canvasHeight: 200,
    };

    const synced = syncCompareTransform({
      sourceTransform,
      targetTransform: {
        scale: 1,
        translateX: 0,
        translateY: 0,
        canvasWidth: 0,
        canvasHeight: 0,
      },
      sourceImage: { width: 2000, height: 1200 },
      targetImage: { width: 1000, height: 800 },
    });

    expect(synced).toEqual({
      scale: sourceTransform.scale,
      translateX: sourceTransform.translateX,
      translateY: sourceTransform.translateY,
    });
  });
});
