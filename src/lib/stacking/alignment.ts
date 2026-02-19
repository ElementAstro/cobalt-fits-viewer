/**
 * 图像对齐/配准模块
 * 支持两种对齐模式:
 * 1. Translation-only: 基于星点平移聚类
 * 2. Full (rotation+scale+translation): 基于三角形星群匹配 (Astroalign 风格)
 */

import {
  detectStars,
  detectStarsAsync,
  type DetectedStar,
  type StarDetectionOptions,
  type StarDetectionRuntime,
} from "./starDetection";
import { buildManualTransform, type ManualRegistrationMode } from "./starAnnotationLinkage";

export type AlignmentMode = "none" | "translation" | "full";

export interface AlignmentTransform {
  /** 仿射变换矩阵 [a, b, tx, c, d, ty] => x' = a*x + b*y + tx, y' = c*x + d*y + ty */
  matrix: [number, number, number, number, number, number];
  /** 匹配的星点对数 */
  matchedStars: number;
  /** 配准误差 (均方根像素距离) */
  rmsError: number;
  /** 检测统计信息 */
  detectionCounts?: { ref: number; target: number };
  /** 回退路径 */
  fallbackUsed?:
    | "none"
    | "translation"
    | "identity"
    | "manual-1star"
    | "manual-2star"
    | "manual-3star"
    | "annotated-stars";
}

export interface ManualControlPoint {
  x: number;
  y: number;
}

export interface AlignmentOptions {
  detectionOptions?: StarDetectionOptions;
  detectionRuntime?: StarDetectionRuntime;
  searchRadius?: number;
  toleranceRatio?: number;
  inlierThreshold?: number;
  maxRansacIterations?: number;
  fallbackToTranslation?: boolean;
  refStarsOverride?: DetectedStar[];
  targetStarsOverride?: DetectedStar[];
  manualControlPoints?: {
    ref: ManualControlPoint[];
    target: ManualControlPoint[];
    mode: ManualRegistrationMode;
  };
}

function identityTransform(
  detectionCounts?: { ref: number; target: number },
  fallbackUsed: AlignmentTransform["fallbackUsed"] = "identity",
): AlignmentTransform {
  return {
    matrix: [1, 0, 0, 0, 1, 0],
    matchedStars: 0,
    rmsError: Infinity,
    detectionCounts,
    fallbackUsed,
  };
}

function toAnchorPoints(points: ManualControlPoint[], maxCount: number = 3) {
  return points
    .slice(0, maxCount)
    .map((point, index) => ({
      id: `anchor_${index + 1}`,
      x: point.x,
      y: point.y,
      anchorIndex: (index + 1) as 1 | 2 | 3,
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function manualModeToFallback(mode: ManualRegistrationMode): AlignmentTransform["fallbackUsed"] {
  if (mode === "oneStar") return "manual-1star";
  if (mode === "twoStar") return "manual-2star";
  return "manual-3star";
}

function resolveStarsSync(
  refPixels: Float32Array,
  targetPixels: Float32Array,
  width: number,
  height: number,
  options: AlignmentOptions,
): { refStars: DetectedStar[]; targetStars: DetectedStar[]; fromOverride: boolean } {
  const refStarsOverride = options.refStarsOverride;
  const targetStarsOverride = options.targetStarsOverride;
  if (
    refStarsOverride &&
    targetStarsOverride &&
    refStarsOverride.length >= 3 &&
    targetStarsOverride.length >= 3
  ) {
    return {
      refStars: refStarsOverride,
      targetStars: targetStarsOverride,
      fromOverride: true,
    };
  }
  return {
    refStars: detectStars(refPixels, width, height, options.detectionOptions),
    targetStars: detectStars(targetPixels, width, height, options.detectionOptions),
    fromOverride: false,
  };
}

async function resolveStarsAsync(
  refPixels: Float32Array,
  targetPixels: Float32Array,
  width: number,
  height: number,
  options: AlignmentOptions,
): Promise<{ refStars: DetectedStar[]; targetStars: DetectedStar[]; fromOverride: boolean }> {
  const refStarsOverride = options.refStarsOverride;
  const targetStarsOverride = options.targetStarsOverride;
  if (
    refStarsOverride &&
    targetStarsOverride &&
    refStarsOverride.length >= 3 &&
    targetStarsOverride.length >= 3
  ) {
    return {
      refStars: refStarsOverride,
      targetStars: targetStarsOverride,
      fromOverride: true,
    };
  }

  const runtime = options.detectionRuntime;
  runtime?.onProgress?.(0.01, "detect-ref");
  const refStars = await detectStarsAsync(
    refPixels,
    width,
    height,
    options.detectionOptions ?? { profile: "balanced" },
    runtime,
  );
  runtime?.onProgress?.(0.35, "detect-target");
  const targetStars = await detectStarsAsync(
    targetPixels,
    width,
    height,
    options.detectionOptions ?? { profile: "balanced" },
    runtime,
  );
  return { refStars, targetStars, fromOverride: false };
}

/**
 * 计算两帧之间的平移偏移 (Translation-only)
 * 使用星点质心匹配的最近邻方法
 */
export function computeTranslation(
  refStars: DetectedStar[],
  targetStars: DetectedStar[],
  searchRadius: number = 20,
): AlignmentTransform {
  if (refStars.length < 3 || targetStars.length < 3) {
    return { matrix: [1, 0, 0, 0, 1, 0], matchedStars: 0, rmsError: Infinity };
  }

  const votes: Array<{ dx: number; dy: number }> = [];
  const topRef = refStars.slice(0, 50);
  const topTarget = targetStars.slice(0, 50);

  for (const rs of topRef) {
    for (const ts of topTarget) {
      const dx = ts.cx - rs.cx;
      const dy = ts.cy - rs.cy;
      if (Math.abs(dx) < searchRadius * 10 && Math.abs(dy) < searchRadius * 10) {
        votes.push({ dx, dy });
      }
    }
  }

  if (votes.length === 0) {
    return { matrix: [1, 0, 0, 0, 1, 0], matchedStars: 0, rmsError: Infinity };
  }

  let bestDx = 0;
  let bestDy = 0;
  let bestCount = 0;

  for (const vote of votes) {
    let count = 0;
    for (const other of votes) {
      if (Math.abs(other.dx - vote.dx) < 2 && Math.abs(other.dy - vote.dy) < 2) {
        count++;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestDx = vote.dx;
      bestDy = vote.dy;
    }
  }

  let sumDx = 0;
  let sumDy = 0;
  let clusterCount = 0;
  for (const vote of votes) {
    if (Math.abs(vote.dx - bestDx) < 2 && Math.abs(vote.dy - bestDy) < 2) {
      sumDx += vote.dx;
      sumDy += vote.dy;
      clusterCount++;
    }
  }

  const tx = clusterCount > 0 ? sumDx / clusterCount : 0;
  const ty = clusterCount > 0 ? sumDy / clusterCount : 0;

  let sumErr = 0;
  let matchCount = 0;
  for (const rs of topRef) {
    const shifted = { cx: rs.cx + tx, cy: rs.cy + ty };
    let minDist = Infinity;
    for (const ts of topTarget) {
      const d = Math.hypot(ts.cx - shifted.cx, ts.cy - shifted.cy);
      if (d < minDist) minDist = d;
    }
    if (minDist < searchRadius) {
      sumErr += minDist * minDist;
      matchCount++;
    }
  }

  const rms = matchCount > 0 ? Math.sqrt(sumErr / matchCount) : Infinity;

  return {
    matrix: [1, 0, tx, 0, 1, ty],
    matchedStars: matchCount,
    rmsError: rms,
  };
}

interface TriangleDescriptor {
  indices: [number, number, number];
  ratios: [number, number];
  maxSide: number;
}

function buildTriangles(stars: DetectedStar[], maxTriangles: number = 500): TriangleDescriptor[] {
  const n = Math.min(stars.length, 30);
  const triangles: TriangleDescriptor[] = [];

  for (let i = 0; i < n && triangles.length < maxTriangles; i++) {
    for (let j = i + 1; j < n && triangles.length < maxTriangles; j++) {
      for (let k = j + 1; k < n && triangles.length < maxTriangles; k++) {
        const d01 = Math.hypot(stars[i].cx - stars[j].cx, stars[i].cy - stars[j].cy);
        const d02 = Math.hypot(stars[i].cx - stars[k].cx, stars[i].cy - stars[k].cy);
        const d12 = Math.hypot(stars[j].cx - stars[k].cx, stars[j].cy - stars[k].cy);

        const sides = [d01, d02, d12].sort((a, b) => a - b);
        if (sides[2] < 10) continue;

        triangles.push({
          indices: [i, j, k],
          ratios: [sides[0] / sides[2], sides[1] / sides[2]],
          maxSide: sides[2],
        });
      }
    }
  }

  return triangles;
}

function computeAffineTransform(
  srcPoints: Array<[number, number]>,
  dstPoints: Array<[number, number]>,
): [number, number, number, number, number, number] {
  const n = srcPoints.length;
  if (n < 3) return [1, 0, 0, 0, 1, 0];

  let sxx = 0;
  let sxy = 0;
  let sx = 0;
  let syy = 0;
  let sy = 0;
  const sn = n;
  let sxXp = 0;
  let syXp = 0;
  let sXp = 0;
  let sxYp = 0;
  let syYp = 0;
  let sYp = 0;

  for (let i = 0; i < n; i++) {
    const [x, y] = srcPoints[i];
    const [xp, yp] = dstPoints[i];
    sxx += x * x;
    sxy += x * y;
    sx += x;
    syy += y * y;
    sy += y;
    sxXp += x * xp;
    syXp += y * xp;
    sXp += xp;
    sxYp += x * yp;
    syYp += y * yp;
    sYp += yp;
  }

  const det = sxx * (syy * sn - sy * sy) - sxy * (sxy * sn - sy * sx) + sx * (sxy * sy - syy * sx);
  if (Math.abs(det) < 1e-10) return [1, 0, 0, 0, 1, 0];

  const invDet = 1 / det;
  const c00 = syy * sn - sy * sy;
  const c01 = -(sxy * sn - sy * sx);
  const c02 = sxy * sy - syy * sx;
  const c10 = -(sxy * sn - sx * sy);
  const c11 = sxx * sn - sx * sx;
  const c12 = -(sxx * sy - sxy * sx);
  const c20 = sxy * sy - sx * syy;
  const c21 = -(sxx * sy - sx * sxy);
  const c22 = sxx * syy - sxy * sxy;

  const a = (c00 * sxXp + c01 * syXp + c02 * sXp) * invDet;
  const b = (c10 * sxXp + c11 * syXp + c12 * sXp) * invDet;
  const tx = (c20 * sxXp + c21 * syXp + c22 * sXp) * invDet;

  const c = (c00 * sxYp + c01 * syYp + c02 * sYp) * invDet;
  const d = (c10 * sxYp + c11 * syYp + c12 * sYp) * invDet;
  const ty = (c20 * sxYp + c21 * syYp + c22 * sYp) * invDet;

  return [a, b, tx, c, d, ty];
}

/**
 * 完整对齐: 三角形星群匹配 + 仿射变换
 */
export function computeFullAlignment(
  refStars: DetectedStar[],
  targetStars: DetectedStar[],
  toleranceRatio: number = 0.01,
  inlierThreshold: number = 3,
  maxRansacIterations: number = 100,
): AlignmentTransform {
  if (refStars.length < 3 || targetStars.length < 3) {
    return { matrix: [1, 0, 0, 0, 1, 0], matchedStars: 0, rmsError: Infinity };
  }

  const refTriangles = buildTriangles(refStars);
  const targetTriangles = buildTriangles(targetStars);

  type TriMatch = {
    refTri: TriangleDescriptor;
    targetTri: TriangleDescriptor;
    diff: number;
  };
  const matches: TriMatch[] = [];

  for (const rt of refTriangles) {
    for (const tt of targetTriangles) {
      const diff = Math.abs(rt.ratios[0] - tt.ratios[0]) + Math.abs(rt.ratios[1] - tt.ratios[1]);
      if (diff < toleranceRatio) {
        matches.push({ refTri: rt, targetTri: tt, diff });
      }
    }
  }

  if (matches.length === 0) {
    return { matrix: [1, 0, 0, 0, 1, 0], matchedStars: 0, rmsError: Infinity };
  }

  matches.sort((a, b) => a.diff - b.diff);

  let bestTransform: [number, number, number, number, number, number] = [1, 0, 0, 0, 1, 0];
  let bestInliers = 0;
  let bestRms = Infinity;
  const maxIterations = Math.min(matches.length, maxRansacIterations);

  for (let iter = 0; iter < maxIterations; iter++) {
    const match = matches[iter];
    const ri = match.refTri.indices;
    const ti = match.targetTri.indices;

    const refPts = ri.map((idx) => [refStars[idx].cx, refStars[idx].cy] as [number, number]);
    const targetPts = ti.map(
      (idx) => [targetStars[idx].cx, targetStars[idx].cy] as [number, number],
    );

    const sortByAngle = (pts: [number, number][]) => {
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
      const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      const angles = pts.map((p, i) => ({ i, a: Math.atan2(p[1] - cy, p[0] - cx) }));
      angles.sort((a, b) => a.a - b.a);
      return angles.map((a) => pts[a.i]);
    };

    const transform = computeAffineTransform(sortByAngle(refPts), sortByAngle(targetPts));

    let inliers = 0;
    let sumErr = 0;
    for (const rs of refStars.slice(0, 50)) {
      const tx = transform[0] * rs.cx + transform[1] * rs.cy + transform[2];
      const ty = transform[3] * rs.cx + transform[4] * rs.cy + transform[5];

      let minDist = Infinity;
      for (const ts of targetStars.slice(0, 50)) {
        const d = Math.hypot(ts.cx - tx, ts.cy - ty);
        if (d < minDist) minDist = d;
      }
      if (minDist < inlierThreshold) {
        inliers++;
        sumErr += minDist * minDist;
      }
    }

    if (inliers > bestInliers || (inliers === bestInliers && sumErr < bestRms * inliers)) {
      bestInliers = inliers;
      bestTransform = transform;
      bestRms = inliers > 0 ? Math.sqrt(sumErr / inliers) : Infinity;
    }
  }

  if (bestInliers >= 3) {
    const srcPts: [number, number][] = [];
    const dstPts: [number, number][] = [];

    for (const rs of refStars.slice(0, 50)) {
      const tx = bestTransform[0] * rs.cx + bestTransform[1] * rs.cy + bestTransform[2];
      const ty = bestTransform[3] * rs.cx + bestTransform[4] * rs.cy + bestTransform[5];

      let minDist = Infinity;
      let bestMatch: DetectedStar | null = null;
      for (const ts of targetStars.slice(0, 50)) {
        const d = Math.hypot(ts.cx - tx, ts.cy - ty);
        if (d < minDist) {
          minDist = d;
          bestMatch = ts;
        }
      }

      if (minDist < inlierThreshold && bestMatch) {
        srcPts.push([rs.cx, rs.cy]);
        dstPts.push([bestMatch.cx, bestMatch.cy]);
      }
    }

    if (srcPts.length >= 3) {
      bestTransform = computeAffineTransform(srcPts, dstPts);

      let sumErr = 0;
      for (let i = 0; i < srcPts.length; i++) {
        const tx =
          bestTransform[0] * srcPts[i][0] + bestTransform[1] * srcPts[i][1] + bestTransform[2];
        const ty =
          bestTransform[3] * srcPts[i][0] + bestTransform[4] * srcPts[i][1] + bestTransform[5];
        sumErr += Math.hypot(dstPts[i][0] - tx, dstPts[i][1] - ty) ** 2;
      }
      bestRms = Math.sqrt(sumErr / srcPts.length);
      bestInliers = srcPts.length;
    }
  }

  return {
    matrix: bestTransform,
    matchedStars: bestInliers,
    rmsError: bestRms,
  };
}

/**
 * 应用仿射变换到图像 (双线性插值)
 * 将 target 图像变换到 reference 坐标系
 */
export function applyTransform(
  pixels: Float32Array,
  width: number,
  height: number,
  transform: AlignmentTransform,
): Float32Array {
  const [a, b, tx, c, d, ty] = transform.matrix;
  const result = new Float32Array(width * height);

  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) {
    result.set(pixels);
    return result;
  }

  const invDet = 1 / det;
  const ia = d * invDet;
  const ib = -b * invDet;
  const itx = (b * ty - d * tx) * invDet;
  const ic = -c * invDet;
  const id = a * invDet;
  const ity = (c * tx - a * ty) * invDet;

  for (let oy = 0; oy < height; oy++) {
    for (let ox = 0; ox < width; ox++) {
      const ix = ia * ox + ib * oy + itx;
      const iy = ic * ox + id * oy + ity;

      const x0 = Math.floor(ix);
      const y0 = Math.floor(iy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      if (x0 < 0 || x1 >= width || y0 < 0 || y1 >= height) {
        result[oy * width + ox] = 0;
        continue;
      }

      const fx = ix - x0;
      const fy = iy - y0;

      const v00 = pixels[y0 * width + x0];
      const v10 = pixels[y0 * width + x1];
      const v01 = pixels[y1 * width + x0];
      const v11 = pixels[y1 * width + x1];

      result[oy * width + ox] =
        v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
    }
  }

  return result;
}

/**
 * 同步对齐入口（兼容旧调用）
 */
export function alignFrame(
  refPixels: Float32Array,
  targetPixels: Float32Array,
  width: number,
  height: number,
  mode: AlignmentMode,
  options: AlignmentOptions = {},
): { aligned: Float32Array; transform: AlignmentTransform } {
  if (mode === "none") {
    return {
      aligned: targetPixels,
      transform: {
        matrix: [1, 0, 0, 0, 1, 0],
        matchedStars: 0,
        rmsError: 0,
        fallbackUsed: "none",
        detectionCounts: { ref: 0, target: 0 },
      },
    };
  }

  const manual = options.manualControlPoints;
  if (manual) {
    const refAnchors = toAnchorPoints(manual.ref);
    const targetAnchors = toAnchorPoints(manual.target);
    const matrix = buildManualTransform(refAnchors, targetAnchors, manual.mode);
    const detectionCounts = { ref: refAnchors.length, target: targetAnchors.length };
    if (matrix) {
      const manualTransform: AlignmentTransform = {
        matrix,
        matchedStars: Math.min(refAnchors.length, targetAnchors.length),
        rmsError: 0,
        detectionCounts,
        fallbackUsed: manualModeToFallback(manual.mode),
      };
      return {
        aligned: applyTransform(targetPixels, width, height, manualTransform),
        transform: manualTransform,
      };
    }
  }

  const { refStars, targetStars, fromOverride } = resolveStarsSync(
    refPixels,
    targetPixels,
    width,
    height,
    options,
  );
  const detectionCounts = { ref: refStars.length, target: targetStars.length };

  const searchRadius = options.searchRadius ?? 20;
  const toleranceRatio = options.toleranceRatio ?? 0.01;
  const inlierThreshold = options.inlierThreshold ?? 3;
  const maxRansacIterations = options.maxRansacIterations ?? 100;
  const fallbackToTranslation = options.fallbackToTranslation ?? true;

  let transform: AlignmentTransform;

  if (mode === "translation") {
    transform = computeTranslation(refStars, targetStars, searchRadius);
    transform.fallbackUsed = fromOverride ? "annotated-stars" : "none";
  } else {
    transform = computeFullAlignment(
      refStars,
      targetStars,
      toleranceRatio,
      inlierThreshold,
      maxRansacIterations,
    );
    transform.fallbackUsed = "none";

    if (transform.matchedStars < 3 && fallbackToTranslation) {
      const translation = computeTranslation(refStars, targetStars, searchRadius);
      if (translation.matchedStars >= 3) {
        transform = { ...translation, fallbackUsed: "translation" };
      }
    }

    if (transform.fallbackUsed === "none" && fromOverride) {
      transform.fallbackUsed = "annotated-stars";
    }
  }

  transform.detectionCounts = detectionCounts;

  if (transform.matchedStars < 3) {
    return {
      aligned: targetPixels,
      transform: identityTransform(detectionCounts, transform.fallbackUsed ?? "identity"),
    };
  }

  const aligned = applyTransform(targetPixels, width, height, transform);
  return { aligned, transform };
}

/**
 * 异步对齐入口（用于堆叠链路）
 */
export async function alignFrameAsync(
  refPixels: Float32Array,
  targetPixels: Float32Array,
  width: number,
  height: number,
  mode: AlignmentMode,
  options: AlignmentOptions = {},
): Promise<{ aligned: Float32Array; transform: AlignmentTransform }> {
  if (mode === "none") {
    return {
      aligned: targetPixels,
      transform: {
        matrix: [1, 0, 0, 0, 1, 0],
        matchedStars: 0,
        rmsError: 0,
        fallbackUsed: "none",
        detectionCounts: { ref: 0, target: 0 },
      },
    };
  }

  const runtime = options.detectionRuntime;
  const manual = options.manualControlPoints;
  if (manual) {
    const refAnchors = toAnchorPoints(manual.ref);
    const targetAnchors = toAnchorPoints(manual.target);
    const matrix = buildManualTransform(refAnchors, targetAnchors, manual.mode);
    const detectionCounts = { ref: refAnchors.length, target: targetAnchors.length };
    if (matrix) {
      runtime?.onProgress?.(0.7, "solve-transform");
      const manualTransform: AlignmentTransform = {
        matrix,
        matchedStars: Math.min(refAnchors.length, targetAnchors.length),
        rmsError: 0,
        detectionCounts,
        fallbackUsed: manualModeToFallback(manual.mode),
      };
      runtime?.onProgress?.(0.88, "warp");
      const aligned = applyTransform(targetPixels, width, height, manualTransform);
      runtime?.onProgress?.(1, "done");
      return { aligned, transform: manualTransform };
    }
  }

  const { refStars, targetStars, fromOverride } = await resolveStarsAsync(
    refPixels,
    targetPixels,
    width,
    height,
    options,
  );
  const detectionCounts = { ref: refStars.length, target: targetStars.length };

  const searchRadius = options.searchRadius ?? 20;
  const toleranceRatio = options.toleranceRatio ?? 0.01;
  const inlierThreshold = options.inlierThreshold ?? 3;
  const maxRansacIterations = options.maxRansacIterations ?? 100;
  const fallbackToTranslation = options.fallbackToTranslation ?? true;

  runtime?.onProgress?.(0.7, "solve-transform");

  let transform: AlignmentTransform;
  if (mode === "translation") {
    transform = computeTranslation(refStars, targetStars, searchRadius);
    transform.fallbackUsed = fromOverride ? "annotated-stars" : "none";
  } else {
    transform = computeFullAlignment(
      refStars,
      targetStars,
      toleranceRatio,
      inlierThreshold,
      maxRansacIterations,
    );
    transform.fallbackUsed = "none";

    if (transform.matchedStars < 3 && fallbackToTranslation) {
      const translation = computeTranslation(refStars, targetStars, searchRadius);
      if (translation.matchedStars >= 3) {
        transform = { ...translation, fallbackUsed: "translation" };
      }
    }

    if (transform.fallbackUsed === "none" && fromOverride) {
      transform.fallbackUsed = "annotated-stars";
    }
  }

  transform.detectionCounts = detectionCounts;

  if (transform.matchedStars < 3) {
    runtime?.onProgress?.(1, "failed");
    return {
      aligned: targetPixels,
      transform: identityTransform(detectionCounts, transform.fallbackUsed ?? "identity"),
    };
  }

  runtime?.onProgress?.(0.88, "warp");
  const aligned = applyTransform(targetPixels, width, height, transform);
  runtime?.onProgress?.(1, "done");
  return { aligned, transform };
}
