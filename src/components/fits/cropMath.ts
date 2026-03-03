export interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CropResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function clampCropRegion(
  region: CropRegion,
  imageWidth: number,
  imageHeight: number,
  minCropSize: number,
): CropRegion {
  const safeWidth = Math.max(1, imageWidth);
  const safeHeight = Math.max(1, imageHeight);
  const minSize = clamp(minCropSize, 1, Math.min(safeWidth, safeHeight));
  const w = clamp(region.w, minSize, safeWidth);
  const h = clamp(region.h, minSize, safeHeight);
  const x = clamp(region.x, 0, Math.max(0, safeWidth - w));
  const y = clamp(region.y, 0, Math.max(0, safeHeight - h));
  return { x, y, w, h };
}

export function moveCropRegion(
  region: CropRegion,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number,
  minCropSize: number,
): CropRegion {
  return clampCropRegion(
    {
      x: region.x + dx,
      y: region.y + dy,
      w: region.w,
      h: region.h,
    },
    imageWidth,
    imageHeight,
    minCropSize,
  );
}

export type AspectRatioPreset = "free" | "1:1" | "4:3" | "3:2" | "16:9" | "original";

export function getAspectRatioValue(
  preset: AspectRatioPreset,
  imageWidth: number,
  imageHeight: number,
): number | null {
  switch (preset) {
    case "free":
      return null;
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "3:2":
      return 3 / 2;
    case "16:9":
      return 16 / 9;
    case "original":
      return imageHeight > 0 ? imageWidth / imageHeight : 1;
  }
}

export function applyAspectRatio(
  region: CropRegion,
  aspect: number | null,
  imageWidth: number,
  imageHeight: number,
  minCropSize: number,
): CropRegion {
  if (aspect == null || aspect <= 0) return region;
  const centerX = region.x + region.w / 2;
  const centerY = region.y + region.h / 2;
  let w = region.w;
  let h = Math.round(w / aspect);
  if (h > imageHeight) {
    h = imageHeight;
    w = Math.round(h * aspect);
  }
  if (w > imageWidth) {
    w = imageWidth;
    h = Math.round(w / aspect);
  }
  w = Math.max(minCropSize, w);
  h = Math.max(minCropSize, h);
  const x = Math.round(centerX - w / 2);
  const y = Math.round(centerY - h / 2);
  return clampCropRegion({ x, y, w, h }, imageWidth, imageHeight, minCropSize);
}

export function resizeCropRegionWithAspect(
  region: CropRegion,
  handle: CropResizeHandle,
  dx: number,
  dy: number,
  aspect: number | null,
  imageWidth: number,
  imageHeight: number,
  minCropSize: number,
): CropRegion {
  const resized = resizeCropRegion(region, handle, dx, dy, imageWidth, imageHeight, minCropSize);
  if (aspect == null) return resized;
  return applyAspectRatio(resized, aspect, imageWidth, imageHeight, minCropSize);
}

export function resizeCropRegion(
  region: CropRegion,
  handle: CropResizeHandle,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number,
  minCropSize: number,
): CropRegion {
  const minSize = clamp(
    minCropSize,
    1,
    Math.min(Math.max(1, imageWidth), Math.max(1, imageHeight)),
  );

  let left = region.x;
  let top = region.y;
  let right = region.x + region.w;
  let bottom = region.y + region.h;

  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;

  if (handle.includes("w")) left = Math.min(left, right - minSize);
  if (handle.includes("e")) right = Math.max(right, left + minSize);
  if (handle.includes("n")) top = Math.min(top, bottom - minSize);
  if (handle.includes("s")) bottom = Math.max(bottom, top + minSize);

  left = clamp(left, 0, Math.max(0, imageWidth));
  right = clamp(right, 0, Math.max(0, imageWidth));
  top = clamp(top, 0, Math.max(0, imageHeight));
  bottom = clamp(bottom, 0, Math.max(0, imageHeight));

  if (right - left < minSize) {
    if (handle.includes("w") && !handle.includes("e")) {
      left = Math.max(0, right - minSize);
    } else {
      right = Math.min(Math.max(1, imageWidth), left + minSize);
    }
  }

  if (bottom - top < minSize) {
    if (handle.includes("n") && !handle.includes("s")) {
      top = Math.max(0, bottom - minSize);
    } else {
      bottom = Math.min(Math.max(1, imageHeight), top + minSize);
    }
  }

  return clampCropRegion(
    {
      x: left,
      y: top,
      w: right - left,
      h: bottom - top,
    },
    imageWidth,
    imageHeight,
    minCropSize,
  );
}
