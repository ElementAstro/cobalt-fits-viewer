/**
 * TGV 降噪 (Total Generalized Variation)
 * 模仿 PixInsight TGVDenoise 工具
 *
 * 基于二阶 TGV 正则化的 Chambolle-Pock 原始-对偶求解:
 *   minimize: ||u - f||² + α₁||∇u - w||₁ + α₀||Ew||₁
 *
 * 关键优势: 保留边缘和精细结构，避免阶梯伪影
 */

import { computeMAD } from "../utils/pixelMath";

export interface TGVDenoiseOptions {
  /** 整体降噪强度 0.1-10 (控制 α₁, 默认 2) */
  strength: number;
  /** α₀/α₁ 比率 1-5 (二阶平滑度, 默认 2) */
  smoothness: number;
  /** Chambolle-Pock 迭代次数 50-500 (默认 200) */
  iterations: number;
  /** 边缘保护 0-1 (局部方差加权, 默认 0.5) */
  edgeProtection: number;
}

/**
 * 计算图像梯度 (∇u)
 * 返回 [dx, dy] 两个分量
 */
function gradient(u: Float32Array, width: number, height: number): [Float32Array, Float32Array] {
  const n = width * height;
  const dx = new Float32Array(n);
  const dy = new Float32Array(n);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      dx[idx] = x < width - 1 ? u[idx + 1] - u[idx] : 0;
      dy[idx] = y < height - 1 ? u[idx + width] - u[idx] : 0;
    }
  }

  return [dx, dy];
}

/**
 * 计算负散度 (-div)
 * 梯度的伴随算子
 */
function negDivergence(
  px: Float32Array,
  py: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const n = width * height;
  const div = new Float32Array(n);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let dxVal = px[idx];
      if (x > 0) dxVal -= px[idx - 1];
      else dxVal = px[idx];

      let dyVal = py[idx];
      if (y > 0) dyVal -= py[idx - width];
      else dyVal = py[idx];

      if (x === 0) dxVal = px[idx];
      else if (x === width - 1) dxVal = -px[idx - 1];
      else dxVal = px[idx] - px[idx - 1];

      if (y === 0) dyVal = py[idx];
      else if (y === height - 1) dyVal = -py[idx - width];
      else dyVal = py[idx] - py[idx - width];

      div[idx] = -(dxVal + dyVal);
    }
  }

  return div;
}

/**
 * 对称梯度 E(w) 用于二阶项
 * 输入 w = [wx, wy], 输出 [Exx, Eyy, Exy]
 */
function symmetricGradient(
  wx: Float32Array,
  wy: Float32Array,
  width: number,
  height: number,
): [Float32Array, Float32Array, Float32Array] {
  const n = width * height;
  const exx = new Float32Array(n);
  const eyy = new Float32Array(n);
  const exy = new Float32Array(n);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      exx[idx] = x < width - 1 ? wx[idx + 1] - wx[idx] : 0;
      eyy[idx] = y < height - 1 ? wy[idx + width] - wy[idx] : 0;

      const dwxdy = y < height - 1 ? wx[idx + width] - wx[idx] : 0;
      const dwydx = x < width - 1 ? wy[idx + 1] - wy[idx] : 0;
      exy[idx] = 0.5 * (dwxdy + dwydx);
    }
  }

  return [exx, eyy, exy];
}

/**
 * 对称梯度的伴随 (-div_sym)
 */
function negSymDivergence(
  qxx: Float32Array,
  qyy: Float32Array,
  qxy: Float32Array,
  width: number,
  height: number,
): [Float32Array, Float32Array] {
  const n = width * height;
  const rx = new Float32Array(n);
  const ry = new Float32Array(n);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // -div of [qxx, 0.5*qxy; 0.5*qxy, qyy] applied to first component
      let dxx = 0;
      if (x === 0) dxx = qxx[idx];
      else if (x === width - 1) dxx = -qxx[idx - 1];
      else dxx = qxx[idx] - qxx[idx - 1];

      let dxy = 0;
      if (y === 0) dxy = 0.5 * qxy[idx];
      else if (y === height - 1) dxy = -0.5 * qxy[idx - width];
      else dxy = 0.5 * (qxy[idx] - qxy[idx - width]);

      rx[idx] = -(dxx + dxy);

      // Second component
      let dyy = 0;
      if (y === 0) dyy = qyy[idx];
      else if (y === height - 1) dyy = -qyy[idx - width];
      else dyy = qyy[idx] - qyy[idx - width];

      let dyx = 0;
      if (x === 0) dyx = 0.5 * qxy[idx];
      else if (x === width - 1) dyx = -0.5 * qxy[idx - 1];
      else dyx = 0.5 * (qxy[idx] - qxy[idx - 1]);

      ry[idx] = -(dyy + dyx);
    }
  }

  return [rx, ry];
}

/**
 * 投影到 L∞ 球 (用于对偶变量的近端步骤)
 */
function projectDual2(px: Float32Array, py: Float32Array, bound: number): void {
  const n = px.length;
  for (let i = 0; i < n; i++) {
    const norm = Math.sqrt(px[i] * px[i] + py[i] * py[i]);
    if (norm > bound) {
      const scale = bound / norm;
      px[i] *= scale;
      py[i] *= scale;
    }
  }
}

function projectDual3(
  qxx: Float32Array,
  qyy: Float32Array,
  qxy: Float32Array,
  bound: number,
): void {
  const n = qxx.length;
  for (let i = 0; i < n; i++) {
    const norm = Math.sqrt(qxx[i] * qxx[i] + qyy[i] * qyy[i] + 2 * qxy[i] * qxy[i]);
    if (norm > bound) {
      const scale = bound / norm;
      qxx[i] *= scale;
      qyy[i] *= scale;
      qxy[i] *= scale;
    }
  }
}

/**
 * TGV 降噪主函数
 * 使用 Chambolle-Pock 原始-对偶算法求解
 */
export function tgvDenoise(
  pixels: Float32Array,
  width: number,
  height: number,
  options?: Partial<TGVDenoiseOptions>,
): Float32Array {
  const strength = Math.max(0.1, Math.min(10, options?.strength ?? 2));
  const smoothness = Math.max(1, Math.min(5, options?.smoothness ?? 2));
  const iterations = Math.max(10, Math.min(500, Math.round(options?.iterations ?? 200)));
  const edgeProtection = Math.max(0, Math.min(1, options?.edgeProtection ?? 0.5));

  const n = width * height;

  // 噪声估计
  const { mad } = computeMAD(pixels);
  const sigma = mad > 0 ? mad / 0.6745 : 1e-6;

  // TGV 参数
  const alpha1 = strength * sigma;
  const alpha0 = alpha1 * smoothness;

  // 边缘保护权重图
  let edgeWeight: Float32Array | null = null;
  if (edgeProtection > 0) {
    edgeWeight = new Float32Array(n);
    const [gx, gy] = gradient(pixels, width, height);
    for (let i = 0; i < n; i++) {
      const gradMag = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
      // 较大梯度 → 较小权重 → 较少降噪 (保护边缘)
      edgeWeight[i] = 1 / (1 + (edgeProtection * gradMag) / (sigma + 1e-10));
    }
  }

  // 步长参数
  const tau = 0.02;
  const sigmaStep = 1 / (tau * 12);

  // 初始化原始变量
  const u = new Float32Array(pixels);
  const uBar = new Float32Array(pixels);
  const wx = new Float32Array(n);
  const wy = new Float32Array(n);
  const wxBar = new Float32Array(n);
  const wyBar = new Float32Array(n);

  // 初始化对偶变量
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  const qxx = new Float32Array(n);
  const qyy = new Float32Array(n);
  const qxy = new Float32Array(n);

  // Chambolle-Pock 迭代
  for (let iter = 0; iter < iterations; iter++) {
    // 1. 对偶步 (更新 p, q)
    const [guBarX, guBarY] = gradient(uBar, width, height);
    for (let i = 0; i < n; i++) {
      px[i] += sigmaStep * (guBarX[i] - wxBar[i]);
      py[i] += sigmaStep * (guBarY[i] - wyBar[i]);
    }
    projectDual2(px, py, alpha1);

    const [ewBarXX, ewBarYY, ewBarXY] = symmetricGradient(wxBar, wyBar, width, height);
    for (let i = 0; i < n; i++) {
      qxx[i] += sigmaStep * ewBarXX[i];
      qyy[i] += sigmaStep * ewBarYY[i];
      qxy[i] += sigmaStep * ewBarXY[i];
    }
    projectDual3(qxx, qyy, qxy, alpha0);

    // 2. 原始步 (更新 u, w)
    const divP = negDivergence(px, py, width, height);
    const uOld = new Float32Array(u);

    for (let i = 0; i < n; i++) {
      const localTau = edgeWeight ? tau * edgeWeight[i] : tau;
      const uNew = u[i] + localTau * divP[i];
      // 近端步: prox of data fidelity ||u - f||²
      u[i] = (uNew + localTau * pixels[i]) / (1 + localTau);
    }

    // 更新 w
    const [symDivX, symDivY] = negSymDivergence(qxx, qyy, qxy, width, height);
    const wxOld = new Float32Array(wx);
    const wyOld = new Float32Array(wy);

    for (let i = 0; i < n; i++) {
      wx[i] += tau * (px[i] + symDivX[i]);
      wy[i] += tau * (py[i] + symDivY[i]);
    }

    // 3. 过松弛 (extrapolation)
    const theta = 1.0;
    for (let i = 0; i < n; i++) {
      uBar[i] = u[i] + theta * (u[i] - uOld[i]);
      wxBar[i] = wx[i] + theta * (wx[i] - wxOld[i]);
      wyBar[i] = wy[i] + theta * (wy[i] - wyOld[i]);
    }
  }

  return u;
}
