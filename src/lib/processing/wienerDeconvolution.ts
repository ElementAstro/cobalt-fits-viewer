/**
 * Wiener 反卷积
 * 频域操作，基于信噪比的正则化
 * 与 Richardson-Lucy 的区别: 单次完成，速度更快，假设高斯噪声
 *
 * 复用: estimatePSFSigma() from imageOperations.ts 做自动 PSF 估计
 */

export interface WienerDeconvolutionOptions {
  /** PSF 高斯宽度 (默认 2) */
  psfSigma: number;
  /** 噪信比 K (正则化参数, 0.001-0.1, 默认 0.01) */
  noiseRatio: number;
}

/**
 * 纯 JS Radix-2 FFT (一维, in-place)
 */
function fft1d(real: Float64Array, imag: Float64Array, inverse: boolean): void {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  // Cooley-Tukey
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len *= 2) {
    const halfLen = len / 2;
    const angle = (sign * 2 * Math.PI) / len;
    const wR = Math.cos(angle);
    const wI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let curR = 1;
      let curI = 0;
      for (let k = 0; k < halfLen; k++) {
        const evenIdx = i + k;
        const oddIdx = i + k + halfLen;
        const tR = curR * real[oddIdx] - curI * imag[oddIdx];
        const tI = curR * imag[oddIdx] + curI * real[oddIdx];
        real[oddIdx] = real[evenIdx] - tR;
        imag[oddIdx] = imag[evenIdx] - tI;
        real[evenIdx] += tR;
        imag[evenIdx] += tI;
        const newCurR = curR * wR - curI * wI;
        curI = curR * wI + curI * wR;
        curR = newCurR;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

/**
 * 2D FFT (行列分离)
 */
function fft2d(
  real: Float64Array,
  imag: Float64Array,
  width: number,
  height: number,
  inverse: boolean,
): void {
  // 逐行 FFT
  const rowR = new Float64Array(width);
  const rowI = new Float64Array(width);
  for (let y = 0; y < height; y++) {
    const offset = y * width;
    for (let x = 0; x < width; x++) {
      rowR[x] = real[offset + x];
      rowI[x] = imag[offset + x];
    }
    fft1d(rowR, rowI, inverse);
    for (let x = 0; x < width; x++) {
      real[offset + x] = rowR[x];
      imag[offset + x] = rowI[x];
    }
  }

  // 逐列 FFT
  const colR = new Float64Array(height);
  const colI = new Float64Array(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      colR[y] = real[y * width + x];
      colI[y] = imag[y * width + x];
    }
    fft1d(colR, colI, inverse);
    for (let y = 0; y < height; y++) {
      real[y * width + x] = colR[y];
      imag[y * width + x] = colI[y];
    }
  }
}

/**
 * 将尺寸扩展到最近的 2 的幂
 */
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Wiener 反卷积主函数
 *
 * 公式: F_restored = (H* / (|H|² + K)) * F_observed
 * - H: PSF 的傅里叶变换
 * - K: 噪信比 (正则化)
 * - F_observed: 观测图像的傅里叶变换
 */
export function wienerDeconvolution(
  pixels: Float32Array,
  width: number,
  height: number,
  options?: Partial<WienerDeconvolutionOptions>,
): Float32Array {
  const psfSigma = Math.max(0.3, Math.min(10, options?.psfSigma ?? 2));
  const K = Math.max(1e-6, Math.min(1, options?.noiseRatio ?? 0.01));

  // 扩展到 2 的幂
  const fftW = nextPow2(width);
  const fftH = nextPow2(height);
  const fftN = fftW * fftH;

  // 将图像数据填充到 FFT 尺寸 (零填充)
  const imgReal = new Float64Array(fftN);
  const imgImag = new Float64Array(fftN);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      imgReal[y * fftW + x] = pixels[y * width + x];
    }
  }

  // 构建 PSF (高斯核, 中心在 [0,0])
  const psfReal = new Float64Array(fftN);
  const psfImag = new Float64Array(fftN);
  const s2 = 2 * psfSigma * psfSigma;
  const psfRadius = Math.min(Math.ceil(psfSigma * 4), Math.min(fftW, fftH) / 2 - 1);
  let psfSum = 0;

  for (let dy = -psfRadius; dy <= psfRadius; dy++) {
    for (let dx = -psfRadius; dx <= psfRadius; dx++) {
      const val = Math.exp(-(dx * dx + dy * dy) / s2);
      // 环绕到 FFT 坐标 (PSF 中心在 [0,0])
      const fy = ((dy % fftH) + fftH) % fftH;
      const fx = ((dx % fftW) + fftW) % fftW;
      psfReal[fy * fftW + fx] += val;
      psfSum += val;
    }
  }

  // 归一化 PSF
  if (psfSum > 0) {
    for (let i = 0; i < fftN; i++) {
      psfReal[i] /= psfSum;
    }
  }

  // FFT
  fft2d(imgReal, imgImag, fftW, fftH, false);
  fft2d(psfReal, psfImag, fftW, fftH, false);

  // Wiener 滤波: F_restored = (H* * F_obs) / (|H|² + K)
  const outReal = new Float64Array(fftN);
  const outImag = new Float64Array(fftN);

  for (let i = 0; i < fftN; i++) {
    const hr = psfReal[i];
    const hi = psfImag[i];
    const hMag2 = hr * hr + hi * hi;
    const denom = hMag2 + K;

    // H* * F_obs
    const conjHR = hr;
    const conjHI = -hi;
    const prodR = conjHR * imgReal[i] - conjHI * imgImag[i];
    const prodI = conjHR * imgImag[i] + conjHI * imgReal[i];

    outReal[i] = prodR / denom;
    outImag[i] = prodI / denom;
  }

  // 逆 FFT
  fft2d(outReal, outImag, fftW, fftH, true);

  // 提取结果 (去除零填充)
  const result = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      result[y * width + x] = outReal[y * fftW + x];
    }
  }

  return result;
}
