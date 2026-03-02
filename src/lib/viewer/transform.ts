export interface FitGeometry {
  fitScale: number;
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
}

export interface ViewerTransform {
  scale: number;
  translateX: number;
  translateY: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ImageRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TranslationRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.max(min, Math.min(max, value));
}

function safeDimension(value: number) {
  "worklet";
  return Math.max(1, value);
}

export function computeFitGeometry(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): FitGeometry {
  "worklet";
  const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const displayWidth = imageWidth * fitScale;
  const displayHeight = imageHeight * fitScale;
  const offsetX = (canvasWidth - displayWidth) / 2;
  const offsetY = (canvasHeight - displayHeight) / 2;
  return { fitScale, displayWidth, displayHeight, offsetX, offsetY };
}

export function computeTranslateBounds(
  scale: number,
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): { maxX: number; maxY: number } {
  "worklet";
  const { displayWidth, displayHeight } = computeFitGeometry(
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
  );
  const scaledW = displayWidth * scale;
  const scaledH = displayHeight * scale;
  const excessW = Math.max(0, scaledW - canvasWidth);
  const excessH = Math.max(0, scaledH - canvasHeight);
  return { maxX: excessW / 2, maxY: excessH / 2 };
}

export function computeTranslationRange(
  scale: number,
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): TranslationRange {
  "worklet";
  const { maxX, maxY } = computeTranslateBounds(
    scale,
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
  );
  // The visible image is fit-centered first, then the whole scene is scaled around (0,0).
  // Keep clamping around the true centered baseline for the current scale.
  const centeredX = ((1 - scale) * canvasWidth) / 2;
  const centeredY = ((1 - scale) * canvasHeight) / 2;
  return {
    minX: centeredX - maxX,
    maxX: centeredX + maxX,
    minY: centeredY - maxY,
    maxY: centeredY + maxY,
  };
}

export function clampScale(scale: number, minScale: number, maxScale: number) {
  "worklet";
  const safeMin = Math.min(minScale, maxScale);
  const safeMax = Math.max(minScale, maxScale);
  return clamp(scale, safeMin, safeMax);
}

export function zoomAroundPoint(
  focalPointX: number,
  focalPointY: number,
  currentScale: number,
  targetScale: number,
  currentTranslateX: number,
  currentTranslateY: number,
): Point {
  "worklet";
  const safeCurrentScale = currentScale <= 0 ? 1 : currentScale;
  const scaleFactor = targetScale / safeCurrentScale;
  return {
    x: focalPointX - (focalPointX - currentTranslateX) * scaleFactor,
    y: focalPointY - (focalPointY - currentTranslateY) * scaleFactor,
  };
}

export function zoomAroundCenter(
  currentScale: number,
  targetScale: number,
  currentTranslateX: number,
  currentTranslateY: number,
  canvasWidth: number,
  canvasHeight: number,
): Point {
  "worklet";
  return zoomAroundPoint(
    canvasWidth / 2,
    canvasHeight / 2,
    currentScale,
    targetScale,
    currentTranslateX,
    currentTranslateY,
  );
}

export function computePinchTranslationFromStart(
  startFocalPointX: number,
  startFocalPointY: number,
  currentFocalPointX: number,
  currentFocalPointY: number,
  startScale: number,
  targetScale: number,
  startTranslateX: number,
  startTranslateY: number,
): Point {
  "worklet";
  const zoomed = zoomAroundPoint(
    startFocalPointX,
    startFocalPointY,
    startScale,
    targetScale,
    startTranslateX,
    startTranslateY,
  );
  return {
    x: zoomed.x + (currentFocalPointX - startFocalPointX),
    y: zoomed.y + (currentFocalPointY - startFocalPointY),
  };
}

export function computeIncrementalPinchTranslation(
  focalPointX: number,
  focalPointY: number,
  prevFocalPointX: number,
  prevFocalPointY: number,
  currentScale: number,
  targetScale: number,
  currentTranslateX: number,
  currentTranslateY: number,
): Point {
  "worklet";
  const zoomed = zoomAroundPoint(
    focalPointX,
    focalPointY,
    currentScale,
    targetScale,
    currentTranslateX,
    currentTranslateY,
  );
  return {
    x: zoomed.x + (focalPointX - prevFocalPointX),
    y: zoomed.y + (focalPointY - prevFocalPointY),
  };
}

export function clampTranslation(
  tx: number,
  ty: number,
  scale: number,
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  "worklet";
  const { minX, maxX, minY, maxY } = computeTranslationRange(
    scale,
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
  );
  return {
    x: clamp(tx, minX, maxX),
    y: clamp(ty, minY, maxY),
  };
}

export function computeOneToOneScale(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  "worklet";
  const { fitScale } = computeFitGeometry(imageWidth, imageHeight, canvasWidth, canvasHeight);
  const safeFitScale = fitScale > 0 ? fitScale : 1;
  return 1 / safeFitScale;
}

export function imageToScreenPoint(
  point: Point,
  transform: ViewerTransform,
  imageWidth: number,
  imageHeight: number,
): Point {
  "worklet";
  const { fitScale, offsetX, offsetY } = computeFitGeometry(
    imageWidth,
    imageHeight,
    transform.canvasWidth,
    transform.canvasHeight,
  );
  const localX = offsetX + point.x * fitScale;
  const localY = offsetY + point.y * fitScale;
  return {
    x: localX * transform.scale + transform.translateX,
    y: localY * transform.scale + transform.translateY,
  };
}

export function screenToImagePoint(
  point: Point,
  transform: ViewerTransform,
  imageWidth: number,
  imageHeight: number,
): Point {
  "worklet";
  const { fitScale, offsetX, offsetY } = computeFitGeometry(
    imageWidth,
    imageHeight,
    transform.canvasWidth,
    transform.canvasHeight,
  );
  const localX = (point.x - transform.translateX) / transform.scale;
  const localY = (point.y - transform.translateY) / transform.scale;
  return {
    x: (localX - offsetX) / fitScale,
    y: (localY - offsetY) / fitScale,
  };
}

export function clampImagePoint(point: Point, imageWidth: number, imageHeight: number): Point {
  "worklet";
  return {
    x: clamp(point.x, 0, imageWidth),
    y: clamp(point.y, 0, imageHeight),
  };
}

export function remapPointBetweenSpaces(
  point: Point,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
): Point {
  "worklet";
  const safeFromW = safeDimension(fromWidth);
  const safeFromH = safeDimension(fromHeight);
  return {
    x: (point.x / safeFromW) * toWidth,
    y: (point.y / safeFromH) * toHeight,
  };
}

export function remapRegionBetweenSpaces(
  region: ImageRegion,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
): ImageRegion {
  "worklet";
  const p0 = remapPointBetweenSpaces(
    { x: region.x, y: region.y },
    fromWidth,
    fromHeight,
    toWidth,
    toHeight,
  );
  const p1 = remapPointBetweenSpaces(
    { x: region.x + region.w, y: region.y + region.h },
    fromWidth,
    fromHeight,
    toWidth,
    toHeight,
  );
  return {
    x: p0.x,
    y: p0.y,
    w: Math.max(0, p1.x - p0.x),
    h: Math.max(0, p1.y - p0.y),
  };
}

export function screenToSourcePixel(
  screenX: number,
  screenY: number,
  transform: ViewerTransform,
  imageWidth: number,
  imageHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): Point | null {
  "worklet";
  const { fitScale, offsetX, offsetY } = computeFitGeometry(
    imageWidth,
    imageHeight,
    transform.canvasWidth,
    transform.canvasHeight,
  );
  if (fitScale <= 0) return null;

  const localX = (screenX - transform.translateX) / transform.scale;
  const localY = (screenY - transform.translateY) / transform.scale;
  const pixelX = Math.floor((localX - offsetX) / fitScale);
  const pixelY = Math.floor((localY - offsetY) / fitScale);

  if (pixelX < 0 || pixelX >= imageWidth || pixelY < 0 || pixelY >= imageHeight) return null;

  const mapped = remapPointBetweenSpaces(
    { x: pixelX + 0.5, y: pixelY + 0.5 },
    imageWidth,
    imageHeight,
    sourceWidth,
    sourceHeight,
  );
  return {
    x: clamp(Math.floor(mapped.x), 0, sourceWidth - 1),
    y: clamp(Math.floor(mapped.y), 0, sourceHeight - 1),
  };
}
