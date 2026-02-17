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

export function clampScale(scale: number, minScale: number, maxScale: number) {
  "worklet";
  const safeMin = Math.min(minScale, maxScale);
  const safeMax = Math.max(minScale, maxScale);
  return clamp(scale, safeMin, safeMax);
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
  const { maxX, maxY } = computeTranslateBounds(
    scale,
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight,
  );
  return {
    x: clamp(tx, -maxX, maxX),
    y: clamp(ty, -maxY, maxY),
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
