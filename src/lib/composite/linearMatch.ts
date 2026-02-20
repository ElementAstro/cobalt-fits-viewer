function clampFinite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const idx = Math.max(0, Math.min(values.length - 1, Math.round((values.length - 1) * p)));
  return values[idx];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    return (values[mid - 1] + values[mid]) * 0.5;
  }
  return values[mid];
}

export interface LinearMatchResult {
  scale: number;
  offset: number;
}

export function estimateLinearMatch(
  source: Float32Array,
  reference: Float32Array,
  sampleStep: number = 1,
): LinearMatchResult {
  const src: number[] = [];
  const ref: number[] = [];

  const step = Math.max(1, Math.round(sampleStep));
  const limit = Math.min(source.length, reference.length);

  for (let i = 0; i < limit; i += step) {
    const s = source[i];
    const r = reference[i];
    if (!Number.isFinite(s) || !Number.isFinite(r)) continue;
    src.push(s);
    ref.push(r);
  }

  if (src.length < 2) {
    return { scale: 1, offset: 0 };
  }

  src.sort((a, b) => a - b);
  ref.sort((a, b) => a - b);

  const srcQ1 = percentile(src, 0.1);
  const srcQ2 = percentile(src, 0.9);
  const refQ1 = percentile(ref, 0.1);
  const refQ2 = percentile(ref, 0.9);

  let scale = 1;
  if (Math.abs(srcQ2 - srcQ1) > 1e-12) {
    scale = (refQ2 - refQ1) / (srcQ2 - srcQ1);
  } else {
    const srcMed = median(src);
    const refMed = median(ref);
    scale = Math.abs(srcMed) > 1e-12 ? refMed / srcMed : 1;
  }

  const offset = refQ1 - scale * srcQ1;
  return {
    scale: clampFinite(scale, 1),
    offset: clampFinite(offset, 0),
  };
}

export function applyLinearMatch(
  source: Float32Array,
  params: LinearMatchResult,
  clampToPositive: boolean = false,
): Float32Array {
  const output = new Float32Array(source.length);
  for (let i = 0; i < source.length; i++) {
    let v = source[i] * params.scale + params.offset;
    if (clampToPositive && v < 0) v = 0;
    output[i] = v;
  }
  return output;
}

export function linearMatchToReference(
  source: Float32Array,
  reference: Float32Array,
  sampleStep: number = 1,
  clampToPositive: boolean = false,
): { matched: Float32Array; params: LinearMatchResult } {
  const params = estimateLinearMatch(source, reference, sampleStep);
  return {
    matched: applyLinearMatch(source, params, clampToPositive),
    params,
  };
}
