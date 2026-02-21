import {
  computeFitGeometry,
  remapPointBetweenSpaces,
  screenToImagePoint,
  type ViewerTransform,
} from "./transform";

interface ImageDimensions {
  width: number;
  height: number;
}

export interface CompareTransformSyncInput {
  sourceTransform: ViewerTransform;
  targetTransform: ViewerTransform;
  sourceImage: ImageDimensions;
  targetImage: ImageDimensions;
}

export interface CompareSyncedTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hasReadyViewport(transform: ViewerTransform, image: ImageDimensions) {
  return (
    transform.canvasWidth > 0 &&
    transform.canvasHeight > 0 &&
    image.width > 0 &&
    image.height > 0 &&
    Number.isFinite(transform.scale) &&
    transform.scale > 0
  );
}

function fallbackFromSource(sourceTransform: ViewerTransform): CompareSyncedTransform {
  return {
    scale: sourceTransform.scale,
    translateX: sourceTransform.translateX,
    translateY: sourceTransform.translateY,
  };
}

export function syncCompareTransform({
  sourceTransform,
  targetTransform,
  sourceImage,
  targetImage,
}: CompareTransformSyncInput): CompareSyncedTransform {
  if (
    !hasReadyViewport(sourceTransform, sourceImage) ||
    !hasReadyViewport(targetTransform, targetImage)
  ) {
    return fallbackFromSource(sourceTransform);
  }

  const sourceCenterScreen = {
    x: sourceTransform.canvasWidth / 2,
    y: sourceTransform.canvasHeight / 2,
  };
  const sourceCenterImage = screenToImagePoint(
    sourceCenterScreen,
    sourceTransform,
    sourceImage.width,
    sourceImage.height,
  );

  const clampedSourceCenter = {
    x: clamp(sourceCenterImage.x, 0, sourceImage.width),
    y: clamp(sourceCenterImage.y, 0, sourceImage.height),
  };

  const targetCenterImage = remapPointBetweenSpaces(
    clampedSourceCenter,
    sourceImage.width,
    sourceImage.height,
    targetImage.width,
    targetImage.height,
  );

  const sourceFit = computeFitGeometry(
    sourceImage.width,
    sourceImage.height,
    sourceTransform.canvasWidth,
    sourceTransform.canvasHeight,
  );
  const targetFit = computeFitGeometry(
    targetImage.width,
    targetImage.height,
    targetTransform.canvasWidth,
    targetTransform.canvasHeight,
  );

  if (sourceFit.fitScale <= 0 || targetFit.fitScale <= 0) {
    return fallbackFromSource(sourceTransform);
  }

  const targetScale = (sourceTransform.scale * sourceFit.fitScale) / targetFit.fitScale;
  const targetCenterScreen = {
    x: targetTransform.canvasWidth / 2,
    y: targetTransform.canvasHeight / 2,
  };
  const targetLocalX = targetFit.offsetX + targetCenterImage.x * targetFit.fitScale;
  const targetLocalY = targetFit.offsetY + targetCenterImage.y * targetFit.fitScale;

  return {
    scale: targetScale,
    translateX: targetCenterScreen.x - targetLocalX * targetScale,
    translateY: targetCenterScreen.y - targetLocalY * targetScale,
  };
}
