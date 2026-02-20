function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    return (values[mid - 1] + values[mid]) * 0.5;
  }
  return values[mid];
}

export interface BrightnessBalanceResult {
  gain: number;
  referenceMedian: number;
  layerMedian: number;
}

export function estimateBrightnessGain(
  layer: Float32Array,
  reference: Float32Array,
  sampleStep: number = 1,
): BrightnessBalanceResult {
  const layerSamples: number[] = [];
  const referenceSamples: number[] = [];

  const step = Math.max(1, Math.round(sampleStep));
  const limit = Math.min(layer.length, reference.length);

  for (let i = 0; i < limit; i += step) {
    const lv = layer[i];
    const rv = reference[i];
    if (!Number.isFinite(lv) || !Number.isFinite(rv)) continue;
    if (lv <= 0 || rv <= 0) continue;
    layerSamples.push(lv);
    referenceSamples.push(rv);
  }

  if (layerSamples.length < 32) {
    return { gain: 1, referenceMedian: 0, layerMedian: 0 };
  }

  const layerMedian = computeMedian(layerSamples);
  const referenceMedian = computeMedian(referenceSamples);

  if (layerMedian <= 1e-12) {
    return { gain: 1, referenceMedian, layerMedian };
  }

  return {
    gain: referenceMedian / layerMedian,
    referenceMedian,
    layerMedian,
  };
}

export function applyBrightnessGain(
  layer: Float32Array,
  gain: number,
  clampToPositive: boolean = true,
): Float32Array {
  const out = new Float32Array(layer.length);
  const safeGain = Number.isFinite(gain) ? gain : 1;
  for (let i = 0; i < layer.length; i++) {
    let value = layer[i] * safeGain;
    if (clampToPositive && value < 0) value = 0;
    out[i] = value;
  }
  return out;
}

export function balanceLayerBrightness(
  layers: Float32Array[],
  referenceIndex: number = 0,
  sampleStep: number = 1,
): { balanced: Float32Array[]; gains: number[] } {
  if (layers.length === 0) return { balanced: [], gains: [] };

  const safeReferenceIndex = Math.max(0, Math.min(referenceIndex, layers.length - 1));
  const reference = layers[safeReferenceIndex];

  const balanced = layers.map((layer, index) => {
    if (index === safeReferenceIndex) return layer;
    const { gain } = estimateBrightnessGain(layer, reference, sampleStep);
    return applyBrightnessGain(layer, gain, true);
  });

  const gains = layers.map((layer, index) => {
    if (index === safeReferenceIndex) return 1;
    return estimateBrightnessGain(layer, reference, sampleStep).gain;
  });

  return { balanced, gains };
}
