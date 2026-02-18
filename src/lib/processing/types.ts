import type {
  ProcessingExecutionMode,
  ProcessingNode,
  ProcessingOperationId,
  ProcessingParamValue,
} from "../fits/types";

export type ProcessingComplexity = "light" | "medium" | "heavy";

export type ProcessingCategory = "geometry" | "adjust" | "process" | "mask" | "color" | "advanced";

export interface ProcessingImageState {
  pixels: Float32Array;
  width: number;
  height: number;
}

export interface ProcessingParamOption {
  label: string;
  value: string | number | boolean;
}

export type ProcessingParamControl =
  | { kind: "slider"; min: number; max: number; step: number }
  | { kind: "toggle" }
  | { kind: "select"; options: ProcessingParamOption[] }
  | { kind: "text" }
  | { kind: "point-list"; minPoints?: number; maxPoints?: number };

export interface ProcessingParamSchema {
  key: string;
  label: string;
  description?: string;
  control: ProcessingParamControl;
  defaultValue: ProcessingParamValue;
}

export interface ProcessingOperationSchema {
  id: ProcessingOperationId;
  label: string;
  category: ProcessingCategory;
  complexity: ProcessingComplexity;
  supportsPreview: boolean;
  params: ProcessingParamSchema[];
  execute: (
    input: ProcessingImageState,
    params: Record<string, ProcessingParamValue>,
  ) => ProcessingImageState;
}

export interface ProcessingExecutionOptions {
  mode: ProcessingExecutionMode;
  signal?: AbortSignal;
  previewMaxDimension?: number;
  heavyDownsampleThreshold?: number;
  previousIntermediates?: ProcessingImageState[];
  startNodeIndex?: number;
}

export interface ProcessingExecutionResult {
  output: ProcessingImageState;
  intermediates: ProcessingImageState[];
  executedNodeIds: string[];
  mode: ProcessingExecutionMode;
  durationMs: number;
  usedDownsample: boolean;
}

export interface ProcessingNodeMutation {
  nodeId: string;
  updates: Partial<Pick<ProcessingNode, "enabled">> & {
    params?: Partial<Record<string, ProcessingParamValue>>;
  };
}
