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

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.max(min, Math.min(max, value));
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
