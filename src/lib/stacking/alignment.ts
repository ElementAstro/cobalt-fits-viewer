/**
 * 图像对齐/配准模块
 * 支持两种对齐模式:
 * 1. Translation-only: 基于相位相关的平移检测
 * 2. Full (rotation+scale+translation): 基于三角形星群匹配 (Astroalign 风格)
 */

import { detectStars, type DetectedStar } from "./starDetection";

export type AlignmentMode = "none" | "translation" | "full";

export interface AlignmentTransform {
  /** 仿射变换矩阵 [a, b, tx, c, d, ty] => x' = a*x + b*y + tx, y' = c*x + d*y + ty */
  matrix: [number, number, number, number, number, number];
  /** 匹配的星点对数 */
  matchedStars: number;
  /** 配准误差 (均方根像素距离) */
  rmsError: number;
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

  // Vote for translation offsets using bright star pairs
  const votes: Array<{ dx: number; dy: number }> = [];
  const topRef = refStars.slice(0, 50);
  const topTarget = targetStars.slice(0, 50);

  for (const rs of topRef) {
    for (const ts of topTarget) {
      const dx = ts.cx - rs.cx;
      const dy = ts.cy - rs.cy;
      // Only consider reasonable offsets
      if (Math.abs(dx) < searchRadius * 10 && Math.abs(dy) < searchRadius * 10) {
        votes.push({ dx, dy });
      }
    }
  }

  if (votes.length === 0) {
    return { matrix: [1, 0, 0, 0, 1, 0], matchedStars: 0, rmsError: Infinity };
  }

  // Find the best offset by clustering
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

  // Refine: average all votes within cluster
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

  // Compute RMS error
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

/**
 * 三角形描述符，用于星群匹配
 */
interface TriangleDescriptor {
  /** 三个星点的索引 */
  indices: [number, number, number];
  /** 归一化边长比 [ratio1, ratio2] (最短边/最长边, 中间边/最长边) */
  ratios: [number, number];
  /** 最长边长度 */
  maxSide: number;
}

/**
 * 从星点列表构建三角形描述符
 */
function buildTriangles(stars: DetectedStar[], maxTriangles: number = 500): TriangleDescriptor[] {
  const n = Math.min(stars.length, 30); // Use top 30 brightest stars
  const triangles: TriangleDescriptor[] = [];

  for (let i = 0; i < n && triangles.length < maxTriangles; i++) {
    for (let j = i + 1; j < n && triangles.length < maxTriangles; j++) {
      for (let k = j + 1; k < n && triangles.length < maxTriangles; k++) {
        const d01 = Math.hypot(stars[i].cx - stars[j].cx, stars[i].cy - stars[j].cy);
        const d02 = Math.hypot(stars[i].cx - stars[k].cx, stars[i].cy - stars[k].cy);
        const d12 = Math.hypot(stars[j].cx - stars[k].cx, stars[j].cy - stars[k].cy);

        const sides = [d01, d02, d12].sort((a, b) => a - b);
        if (sides[2] < 10) continue; // Skip degenerate triangles

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

/**
 * 计算仿射变换矩阵 (最小二乘法)
 * 给定 >= 3 对匹配点，求解 x' = a*x + b*y + tx, y' = c*x + d*y + ty
 */
function computeAffineTransform(
  srcPoints: Array<[number, number]>,
  dstPoints: Array<[number, number]>,
): [number, number, number, number, number, number] {
  const n = srcPoints.length;
  if (n < 3) return [1, 0, 0, 0, 1, 0];

  // Solve using normal equations:
  // [sum(xi^2)+sum(yi^2)  0                    sum(xi)  sum(yi) ] [a ]   [sum(xi*xi') + sum(yi*yi')]
  // [0                    sum(xi^2)+sum(yi^2)   sum(yi) -sum(xi) ] [b ] = [sum(yi*xi') - sum(xi*yi')]
  // etc. — simplified for similarity transform first, then generalize

  // For general affine: solve two 3x3 systems
  // x' = a*x + b*y + tx  =>  [x y 1] * [a b tx]^T = x'
  // y' = c*x + d*y + ty  =>  [x y 1] * [c d ty]^T = y'

  let sxx = 0,
    sxy = 0,
    sx = 0,
    syy = 0,
    sy = 0;
  const sn = n;
  let sxXp = 0,
    syXp = 0,
    sXp = 0;
  let sxYp = 0,
    syYp = 0,
    sYp = 0;

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

  // Solve 3x3 system: A * [a,b,tx] = B for x', same for y'
  // A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, sn]]
  const det = sxx * (syy * sn - sy * sy) - sxy * (sxy * sn - sy * sx) + sx * (sxy * sy - syy * sx);

  if (Math.abs(det) < 1e-10) return [1, 0, 0, 0, 1, 0];

  const invDet = 1 / det;

  // Cofactors for row 0
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
 * 参考 Astroalign 算法: 构建三角形描述符 → 匹配相似三角形 → RANSAC 求变换
 */
export function computeFullAlignment(
  refStars: DetectedStar[],
  targetStars: DetectedStar[],
  toleranceRatio: number = 0.01,
): AlignmentTransform {
  if (refStars.length < 3 || targetStars.length < 3) {
    return { matrix: [1, 0, 0, 0, 1, 0], matchedStars: 0, rmsError: Infinity };
  }

  const refTriangles = buildTriangles(refStars);
  const targetTriangles = buildTriangles(targetStars);

  // Match triangles by ratio similarity
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

  // Sort by match quality
  matches.sort((a, b) => a.diff - b.diff);

  // RANSAC: try top matches to find best transform
  let bestTransform: [number, number, number, number, number, number] = [1, 0, 0, 0, 1, 0];
  let bestInliers = 0;
  let bestRms = Infinity;
  const inlierThreshold = 3; // pixels

  const maxIterations = Math.min(matches.length, 100);

  for (let iter = 0; iter < maxIterations; iter++) {
    const match = matches[iter];

    // Build point correspondences from this triangle match
    // Try all 3 possible vertex orderings (rotations)
    const ri = match.refTri.indices;
    const ti = match.targetTri.indices;

    // We need to figure out correct vertex correspondence
    // Try matching by sorting edges
    const refPts = ri.map((idx) => [refStars[idx].cx, refStars[idx].cy] as [number, number]);
    const targetPts = ti.map(
      (idx) => [targetStars[idx].cx, targetStars[idx].cy] as [number, number],
    );

    // Sort both triangles vertices by angle from centroid
    const sortByAngle = (pts: [number, number][]) => {
      const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
      const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
      const angles = pts.map((p, i) => ({ i, a: Math.atan2(p[1] - cy, p[0] - cx) }));
      angles.sort((a, b) => a.a - b.a);
      return angles.map((a) => pts[a.i]);
    };

    const sortedRef = sortByAngle(refPts);
    const sortedTarget = sortByAngle(targetPts);

    const transform = computeAffineTransform(sortedRef, sortedTarget);

    // Count inliers across all stars
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

  // Refine with all inliers
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

      // Recompute RMS
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

  // Compute inverse transform: map output (ref) coords to input (target) coords
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
      // Input coordinates
      const ix = ia * ox + ib * oy + itx;
      const iy = ic * ox + id * oy + ity;

      // Bilinear interpolation
      const x0 = Math.floor(ix);
      const y0 = Math.floor(iy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      if (x0 < 0 || x1 >= width || y0 < 0 || y1 >= height) {
        result[oy * width + ox] = 0; // Out of bounds
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
 * 对齐单帧到参考帧
 * 自动选择星点检测 → 匹配 → 变换
 */
export function alignFrame(
  refPixels: Float32Array,
  targetPixels: Float32Array,
  width: number,
  height: number,
  mode: AlignmentMode,
): { aligned: Float32Array; transform: AlignmentTransform } {
  if (mode === "none") {
    return {
      aligned: targetPixels,
      transform: { matrix: [1, 0, 0, 0, 1, 0], matchedStars: 0, rmsError: 0 },
    };
  }

  const refStars = detectStars(refPixels, width, height);
  const targetStars = detectStars(targetPixels, width, height);

  let transform: AlignmentTransform;

  if (mode === "translation") {
    transform = computeTranslation(refStars, targetStars);
  } else {
    transform = computeFullAlignment(refStars, targetStars);
  }

  // If alignment failed, return original
  if (transform.matchedStars < 3) {
    return {
      aligned: targetPixels,
      transform: { matrix: [1, 0, 0, 0, 1, 0], matchedStars: 0, rmsError: Infinity },
    };
  }

  const aligned = applyTransform(targetPixels, width, height, transform);
  return { aligned, transform };
}
