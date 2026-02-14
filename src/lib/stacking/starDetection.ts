/**
 * 星点检测模块
 * 使用阈值分割 + 连通区域标记检测星点，提取质心和亮度
 * 参考 SEP (Source Extractor as a Python library) 和 astrometry.net 的简化实现
 */

export interface DetectedStar {
  /** 质心 X 坐标 (亚像素精度) */
  cx: number;
  /** 质心 Y 坐标 (亚像素精度) */
  cy: number;
  /** 星点总通量 (所有像素之和减去背景) */
  flux: number;
  /** 星点峰值像素 */
  peak: number;
  /** 星点像素数 */
  area: number;
  /** 估算半高全宽 (FWHM) */
  fwhm: number;
}

/**
 * 估算图像背景和噪声水平
 * 将图像分为网格块，对每块取中值作为背景，MAD 作为噪声
 */
export function estimateBackground(
  pixels: Float32Array,
  width: number,
  height: number,
  meshSize: number = 64,
): { background: Float32Array; noise: number } {
  const n = pixels.length;
  const bg = new Float32Array(n);

  const nx = Math.max(1, Math.ceil(width / meshSize));
  const ny = Math.max(1, Math.ceil(height / meshSize));

  const meshValues: number[][] = Array.from({ length: nx * ny }, () => []);

  // Assign pixels to mesh cells
  for (let y = 0; y < height; y++) {
    const my = Math.min(Math.floor(y / meshSize), ny - 1);
    for (let x = 0; x < width; x++) {
      const mx = Math.min(Math.floor(x / meshSize), nx - 1);
      const v = pixels[y * width + x];
      if (!isNaN(v) && isFinite(v)) {
        meshValues[my * nx + mx].push(v);
      }
    }
  }

  // Compute median + MAD per cell
  const meshMedians = new Float32Array(nx * ny);
  const meshMADs = new Float32Array(nx * ny);

  for (let mi = 0; mi < nx * ny; mi++) {
    const vals = meshValues[mi];
    if (vals.length === 0) continue;
    vals.sort((a, b) => a - b);
    const med = vals[Math.floor(vals.length / 2)];
    meshMedians[mi] = med;

    let madSum = 0;
    for (const v of vals) madSum += Math.abs(v - med);
    meshMADs[mi] = (madSum / vals.length) * 1.4826;
  }

  // Bilinear interpolate background for each pixel
  for (let y = 0; y < height; y++) {
    const fy = (y + 0.5) / meshSize - 0.5;
    const my0 = Math.max(0, Math.min(ny - 1, Math.floor(fy)));
    const my1 = Math.min(ny - 1, my0 + 1);
    const ty = fy - my0;

    for (let x = 0; x < width; x++) {
      const fx = (x + 0.5) / meshSize - 0.5;
      const mx0 = Math.max(0, Math.min(nx - 1, Math.floor(fx)));
      const mx1 = Math.min(nx - 1, mx0 + 1);
      const tx = fx - mx0;

      const v00 = meshMedians[my0 * nx + mx0];
      const v10 = meshMedians[my0 * nx + mx1];
      const v01 = meshMedians[my1 * nx + mx0];
      const v11 = meshMedians[my1 * nx + mx1];

      bg[y * width + x] =
        v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
    }
  }

  // Global noise: median of all mesh MADs
  const allMADs = Array.from(meshMADs).filter((v) => v > 0);
  allMADs.sort((a, b) => a - b);
  const noise = allMADs.length > 0 ? allMADs[Math.floor(allMADs.length / 2)] : 1;

  return { background: bg, noise };
}

/**
 * 检测星点
 * 1. 估算背景并减除
 * 2. 阈值分割 (背景 + sigmaThreshold * noise)
 * 3. 连通区域标记 (4-connected flood fill)
 * 4. 计算质心、通量、FWHM
 */
export function detectStars(
  pixels: Float32Array,
  width: number,
  height: number,
  options: {
    /** 检测阈值，单位为背景噪声的倍数 */
    sigmaThreshold?: number;
    /** 最大返回星点数 */
    maxStars?: number;
    /** 最小星点面积 (像素) */
    minArea?: number;
    /** 最大星点面积 (像素)，排除扩展源 */
    maxArea?: number;
    /** 边缘排除距离 (像素) */
    borderMargin?: number;
  } = {},
): DetectedStar[] {
  const {
    sigmaThreshold = 5,
    maxStars = 200,
    minArea = 3,
    maxArea = 500,
    borderMargin = 10,
  } = options;

  const { background, noise } = estimateBackground(pixels, width, height);
  const n = width * height;

  // Background-subtracted image
  const bgsub = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    bgsub[i] = pixels[i] - background[i];
  }

  const threshold = sigmaThreshold * noise;

  // Label connected regions above threshold
  const labels = new Int32Array(n); // 0 = unvisited
  let nextLabel = 1;
  const stars: DetectedStar[] = [];

  // Flood-fill stack (reused)
  const stack: number[] = [];

  for (let y = borderMargin; y < height - borderMargin; y++) {
    for (let x = borderMargin; x < width - borderMargin; x++) {
      const idx = y * width + x;
      if (labels[idx] !== 0 || bgsub[idx] < threshold) continue;

      // BFS flood fill
      const label = nextLabel++;
      stack.length = 0;
      stack.push(idx);
      labels[idx] = label;

      let sumFlux = 0;
      let sumX = 0;
      let sumY = 0;
      let peak = 0;
      let area = 0;
      let sumR2 = 0; // for FWHM estimation

      while (stack.length > 0) {
        const ci = stack.pop()!;
        const cy = Math.floor(ci / width);
        const cx = ci % width;
        const val = bgsub[ci];

        sumFlux += val;
        sumX += cx * val;
        sumY += cy * val;
        if (val > peak) peak = val;
        area++;

        // 4-connected neighbors
        const neighbors = [
          cy > 0 ? ci - width : -1,
          cy < height - 1 ? ci + width : -1,
          cx > 0 ? ci - 1 : -1,
          cx < width - 1 ? ci + 1 : -1,
        ];

        for (const ni of neighbors) {
          if (ni >= 0 && labels[ni] === 0 && bgsub[ni] >= threshold) {
            labels[ni] = label;
            stack.push(ni);
          }
        }
      }

      if (area < minArea || area > maxArea) continue;

      const centroidX = sumFlux > 0 ? sumX / sumFlux : 0;
      const centroidY = sumFlux > 0 ? sumY / sumFlux : 0;

      // Estimate FWHM from second moment
      // Recompute r^2 weighted sum
      for (
        let py = Math.max(0, Math.floor(centroidY) - 10);
        py <= Math.min(height - 1, Math.ceil(centroidY) + 10);
        py++
      ) {
        for (
          let px = Math.max(0, Math.floor(centroidX) - 10);
          px <= Math.min(width - 1, Math.ceil(centroidX) + 10);
          px++
        ) {
          if (labels[py * width + px] === label) {
            const dx = px - centroidX;
            const dy = py - centroidY;
            sumR2 += (dx * dx + dy * dy) * bgsub[py * width + px];
          }
        }
      }

      const sigma2 = sumFlux > 0 ? sumR2 / sumFlux : 1;
      const fwhm = 2.3548 * Math.sqrt(Math.max(0.1, sigma2)); // 2*sqrt(2*ln(2)) * sigma

      // Reject elongated sources or too large FWHM
      if (fwhm > 20) continue;

      // Filter stars in border region by centroid
      if (
        centroidX < borderMargin ||
        centroidX >= width - borderMargin ||
        centroidY < borderMargin ||
        centroidY >= height - borderMargin
      ) {
        continue;
      }

      stars.push({
        cx: centroidX,
        cy: centroidY,
        flux: sumFlux,
        peak,
        area,
        fwhm,
      });
    }
  }

  // Sort by flux descending, take top N
  stars.sort((a, b) => b.flux - a.flux);
  return stars.slice(0, maxStars);
}
