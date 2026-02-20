import type {
  ColormapType,
  ProcessingAlgorithmProfile,
  ProcessingNode,
  ProcessingPipelineSnapshot,
  StretchType,
  ViewerCurvePreset,
} from "../fits/types";
import { downsamplePixels, fitsToRGBA } from "../converter/formatConverter";
import { normalizeProcessingPipelineSnapshot } from "./recipe";
import { getProcessingOperation } from "./registry";
import type {
  ProcessingExecutionOptions,
  ProcessingImageState,
  ProcessingRGBAState,
} from "./types";

export interface ProcessingRenderOptions {
  stretch: StretchType;
  colormap: ColormapType;
  blackPoint?: number;
  whitePoint?: number;
  gamma?: number;
  outputBlack?: number;
  outputWhite?: number;
  brightness?: number;
  contrast?: number;
  mtfMidtone?: number;
  curvePreset?: ViewerCurvePreset;
  profile?: ProcessingAlgorithmProfile;
}

export interface ProcessingPipelineExecutionResult {
  profile: ProcessingAlgorithmProfile;
  mode: ProcessingExecutionOptions["mode"];
  durationMs: number;
  usedDownsample: boolean;
  scientificOutput: ProcessingImageState;
  colorOutput: ProcessingRGBAState;
  scientificIntermediates: ProcessingImageState[];
  colorIntermediates: ProcessingRGBAState[];
  executedScientificNodeIds: string[];
  executedColorNodeIds: string[];
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function splitNodesByStage(nodes: ProcessingNode[]): {
  scientificNodes: ProcessingNode[];
  colorNodes: ProcessingNode[];
} {
  const scientificNodes: ProcessingNode[] = [];
  const colorNodes: ProcessingNode[] = [];
  for (const node of nodes) {
    const schema = getProcessingOperation(node.operationId);
    if (schema?.stage === "color") colorNodes.push(node);
    else scientificNodes.push(node);
  }
  return { scientificNodes, colorNodes };
}

export function executeProcessingPipeline(params: {
  input: ProcessingImageState;
  snapshot: ProcessingPipelineSnapshot | null | undefined;
  renderOptions: ProcessingRenderOptions;
  options: ProcessingExecutionOptions;
}): ProcessingPipelineExecutionResult {
  const start = Date.now();
  const normalized = normalizeProcessingPipelineSnapshot(
    params.snapshot,
    params.renderOptions.profile,
  );
  const effectiveProfile = params.renderOptions.profile ?? normalized.profile;

  const stageFixedScientific = splitNodesByStage(normalized.scientificNodes);
  const stageFixedColor = splitNodesByStage(normalized.colorNodes);
  const scientificNodes = [
    ...stageFixedScientific.scientificNodes,
    ...stageFixedColor.scientificNodes,
  ];
  const colorNodes = [...stageFixedScientific.colorNodes, ...stageFixedColor.colorNodes];

  let workingInput: ProcessingImageState = params.input;
  let usedDownsample = false;

  if (params.options.mode === "preview" && params.options.previewMaxDimension) {
    const downsampled = downsamplePixels(
      params.input.pixels,
      params.input.width,
      params.input.height,
      params.options.previewMaxDimension,
    );
    workingInput = downsampled;
    usedDownsample =
      downsampled.width !== params.input.width || downsampled.height !== params.input.height;
  }

  const scientificIntermediates: ProcessingImageState[] = [];
  const executedScientificNodeIds: string[] = [];

  let scientificState = workingInput;
  const startNodeIndex = Math.max(0, Math.floor(params.options.startNodeIndex ?? 0));
  if (
    startNodeIndex > 0 &&
    Array.isArray(params.options.previousIntermediates) &&
    params.options.previousIntermediates.length >= startNodeIndex
  ) {
    scientificState = params.options.previousIntermediates[startNodeIndex - 1];
    scientificIntermediates.push(...params.options.previousIntermediates.slice(0, startNodeIndex));
    for (let i = 0; i < startNodeIndex; i++) {
      const node = scientificNodes[i];
      if (node?.enabled !== false) executedScientificNodeIds.push(node.id);
    }
  }

  for (let i = startNodeIndex; i < scientificNodes.length; i++) {
    throwIfAborted(params.options.signal);
    const node = scientificNodes[i];
    if (!node || node.enabled === false) continue;
    const schema = getProcessingOperation(node.operationId);
    if (!schema || schema.stage !== "scientific") continue;
    if (params.options.mode === "preview" && !schema.supportsPreview) continue;
    scientificState = schema.execute(scientificState, node.params) as ProcessingImageState;
    scientificIntermediates.push(scientificState);
    executedScientificNodeIds.push(node.id);
  }

  throwIfAborted(params.options.signal);
  let colorState: ProcessingRGBAState = {
    rgbaData: fitsToRGBA(scientificState.pixels, scientificState.width, scientificState.height, {
      stretch: params.renderOptions.stretch,
      colormap: params.renderOptions.colormap,
      blackPoint: params.renderOptions.blackPoint ?? 0,
      whitePoint: params.renderOptions.whitePoint ?? 1,
      gamma: params.renderOptions.gamma ?? 1,
      outputBlack: params.renderOptions.outputBlack ?? 0,
      outputWhite: params.renderOptions.outputWhite ?? 1,
      brightness: params.renderOptions.brightness ?? 0,
      contrast: params.renderOptions.contrast ?? 1,
      mtfMidtone: params.renderOptions.mtfMidtone ?? 0.5,
      curvePreset: params.renderOptions.curvePreset ?? "linear",
      profile: effectiveProfile,
    }),
    width: scientificState.width,
    height: scientificState.height,
  };

  const colorIntermediates: ProcessingRGBAState[] = [];
  const executedColorNodeIds: string[] = [];

  for (const node of colorNodes) {
    throwIfAborted(params.options.signal);
    if (!node || node.enabled === false) continue;
    const schema = getProcessingOperation(node.operationId);
    if (!schema || schema.stage !== "color") continue;
    if (params.options.mode === "preview" && !schema.supportsPreview) continue;
    colorState = schema.execute(colorState, node.params) as ProcessingRGBAState;
    colorIntermediates.push(colorState);
    executedColorNodeIds.push(node.id);
  }

  return {
    profile: effectiveProfile,
    mode: params.options.mode,
    durationMs: Date.now() - start,
    usedDownsample,
    scientificOutput: scientificState,
    colorOutput: colorState,
    scientificIntermediates,
    colorIntermediates,
    executedScientificNodeIds,
    executedColorNodeIds,
  };
}
