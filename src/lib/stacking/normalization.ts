/**
 * 帧归一化模块
 * 复用 composite/linearMatch 和 composite/brightnessBalance 的核心逻辑
 * 支持 Additive、Multiplicative、Additive+Multiplicative 三种归一化模式
 */

import { estimateLinearMatch, applyLinearMatch } from "../composite/linearMatch";
import { estimateBrightnessGain, applyBrightnessGain } from "../composite/brightnessBalance";
import { robustMedianFloat32 } from "./robustStats";

export type NormalizationMode = "none" | "additive" | "multiplicative" | "additive+multiplicative";

export interface NormalizationResult {
  mode: NormalizationMode;
  /** Additive offset applied (pixel_i += offset) */
  offset: number;
  /** Multiplicative scale applied (pixel_i *= scale) */
  scale: number;
}

export interface NormalizeFramesResult {
  normalized: Float32Array[];
  results: NormalizationResult[];
}

/**
 * 对一组帧进行归一化，使其亮度/对比度与参考帧一致
 *
 * - additive: 移位使中位数对齐 (适合背景差异)
 * - multiplicative: 缩放使尺度对齐 (适合透明度/云层差异)
 * - additive+multiplicative: 同时移位+缩放 (最全面)
 */
export function normalizeFrames(
  frames: Float32Array[],
  referenceIndex: number = 0,
  mode: NormalizationMode,
): NormalizeFramesResult {
  if (frames.length === 0 || mode === "none") {
    return {
      normalized: frames,
      results: frames.map(() => ({ mode: "none" as const, offset: 0, scale: 1 })),
    };
  }

  const safeRefIndex = Math.max(0, Math.min(referenceIndex, frames.length - 1));
  const reference = frames[safeRefIndex];

  if (mode === "additive") {
    return normalizeAdditive(frames, reference, safeRefIndex);
  }

  if (mode === "multiplicative") {
    return normalizeMultiplicative(frames, reference, safeRefIndex);
  }

  // additive+multiplicative: use linearMatch which estimates both scale and offset
  return normalizeLinear(frames, reference, safeRefIndex);
}

function normalizeAdditive(
  frames: Float32Array[],
  reference: Float32Array,
  refIndex: number,
): NormalizeFramesResult {
  const refMedian = robustMedianFloat32(reference);

  const normalized: Float32Array[] = [];
  const results: NormalizationResult[] = [];

  for (let i = 0; i < frames.length; i++) {
    if (i === refIndex) {
      normalized.push(frames[i]);
      results.push({ mode: "additive", offset: 0, scale: 1 });
      continue;
    }

    const frameMedian = robustMedianFloat32(frames[i]);
    const offset = refMedian - frameMedian;
    const matched = applyLinearMatch(frames[i], { scale: 1, offset }, true);
    normalized.push(matched);
    results.push({ mode: "additive", offset, scale: 1 });
  }

  return { normalized, results };
}

function normalizeMultiplicative(
  frames: Float32Array[],
  reference: Float32Array,
  refIndex: number,
): NormalizeFramesResult {
  const normalized: Float32Array[] = [];
  const results: NormalizationResult[] = [];

  for (let i = 0; i < frames.length; i++) {
    if (i === refIndex) {
      normalized.push(frames[i]);
      results.push({ mode: "multiplicative", offset: 0, scale: 1 });
      continue;
    }

    const { gain } = estimateBrightnessGain(frames[i], reference);
    const matched = applyBrightnessGain(frames[i], gain, true);
    normalized.push(matched);
    results.push({ mode: "multiplicative", offset: 0, scale: gain });
  }

  return { normalized, results };
}

function normalizeLinear(
  frames: Float32Array[],
  reference: Float32Array,
  refIndex: number,
): NormalizeFramesResult {
  const normalized: Float32Array[] = [];
  const results: NormalizationResult[] = [];

  for (let i = 0; i < frames.length; i++) {
    if (i === refIndex) {
      normalized.push(frames[i]);
      results.push({ mode: "additive+multiplicative", offset: 0, scale: 1 });
      continue;
    }

    const params = estimateLinearMatch(frames[i], reference);
    const matched = applyLinearMatch(frames[i], params, true);
    normalized.push(matched);
    results.push({ mode: "additive+multiplicative", offset: params.offset, scale: params.scale });
  }

  return { normalized, results };
}
