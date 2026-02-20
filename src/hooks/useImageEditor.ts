/**
 * 图像编辑器 Hook
 * 基于非破坏式 recipe（scientific + color）管理编辑状态与撤销/重做
 */

import { useState, useCallback, useRef } from "react";
import { InteractionManager } from "react-native";
import type {
  ColormapType,
  ProcessingAlgorithmProfile,
  ProcessingNode,
  ProcessingPipelineSnapshot,
  ProcessingParamValue,
  StretchType,
} from "../lib/fits/types";
import { executeProcessingPipeline } from "../lib/processing/executor";
import { normalizeProcessingPipelineSnapshot } from "../lib/processing/recipe";
import { getProcessingOperation } from "../lib/processing/registry";
import type { ImageEditOperation } from "../lib/utils/imageOperations";
import { LOG_TAGS, Logger } from "../lib/logger";

interface ImageState {
  pixels: Float32Array;
  width: number;
  height: number;
}

interface EditorState {
  current: ImageState | null;
  rgbaData: Uint8ClampedArray | null;
  recipe: ProcessingPipelineSnapshot | null;
  isProcessing: boolean;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  historyIndex: number;
}

interface UseImageEditorOptions {
  maxHistory?: number;
  profile?: ProcessingAlgorithmProfile;
  onRecipeChange?: (recipe: ProcessingPipelineSnapshot) => void;
  onOperation?: (event: EditorOperationEvent) => void;
}

interface EditorImageSize {
  width: number;
  height: number;
}

export interface EditorOperationEvent {
  type: "apply" | "undo" | "redo";
  op?: ImageEditOperation;
  before: EditorImageSize;
  after: EditorImageSize;
  previousHistoryIndex: number;
  historyIndex: number;
  previousHistoryLength: number;
  historyLength: number;
}

interface PendingOperationEvent {
  type: EditorOperationEvent["type"];
  op?: ImageEditOperation;
  before: EditorImageSize;
  previousHistoryIndex: number;
  previousHistoryLength: number;
}

function resolveMaxHistory(maxHistory: number | undefined) {
  if (typeof maxHistory !== "number" || Number.isNaN(maxHistory)) return 10;
  return Math.max(1, Math.min(200, Math.round(maxHistory)));
}

function cloneNode(node: ProcessingNode): ProcessingNode {
  return {
    id: node.id,
    operationId: node.operationId,
    enabled: node.enabled !== false,
    params: { ...node.params },
  };
}

function cloneRecipe(recipe: ProcessingPipelineSnapshot): ProcessingPipelineSnapshot {
  return {
    version: recipe.version,
    savedAt: recipe.savedAt,
    profile: recipe.profile,
    scientificNodes: recipe.scientificNodes.map(cloneNode),
    colorNodes: recipe.colorNodes.map(cloneNode),
  };
}

function buildNodeFromOperation(operation: ImageEditOperation): ProcessingNode {
  const params = { ...operation } as Record<string, ProcessingParamValue | string>;
  delete params.type;
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    operationId: operation.type,
    enabled: true,
    params: params as Record<string, ProcessingParamValue>,
  };
}

export function useImageEditor(options: UseImageEditorOptions = {}) {
  const maxHistory = resolveMaxHistory(options.maxHistory);
  const onOperationRef = useRef(options.onOperation);
  onOperationRef.current = options.onOperation;
  const [current, setCurrent] = useState<ImageState | null>(null);
  const [rgbaData, setRgbaData] = useState<Uint8ClampedArray | null>(null);
  const [recipe, setRecipe] = useState<ProcessingPipelineSnapshot | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyRef = useRef<ProcessingPipelineSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const originalRef = useRef<ImageState | null>(null);

  const [historyLength, setHistoryLength] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const stretchRef = useRef<StretchType>("linear");
  const colormapRef = useRef<ColormapType>("grayscale");
  const profileRef = useRef<ProcessingAlgorithmProfile>(options.profile ?? "standard");
  const pendingTask = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(
    null,
  );
  const pendingOperationEventRef = useRef<PendingOperationEvent | null>(null);

  const queueOperationEvent = useCallback(
    (
      eventType: EditorOperationEvent["type"],
      op: ImageEditOperation | undefined,
      before: EditorImageSize,
      previousHistoryIndex: number,
      previousHistoryLength: number,
    ) => {
      pendingOperationEventRef.current = {
        type: eventType,
        op,
        before,
        previousHistoryIndex,
        previousHistoryLength,
      };
    },
    [],
  );

  const commitRecipeToHistory = useCallback(
    (nextRecipe: ProcessingPipelineSnapshot) => {
      const history = historyRef.current;
      const idx = historyIndexRef.current;

      const nextHistory = history.slice(0, idx + 1);
      nextHistory.push(cloneRecipe(nextRecipe));

      const trimmed =
        nextHistory.length > maxHistory
          ? nextHistory.slice(nextHistory.length - maxHistory)
          : nextHistory;

      historyRef.current = trimmed;
      historyIndexRef.current = trimmed.length - 1;
      setHistoryLength(trimmed.length);
      setHistoryIndex(historyIndexRef.current);
    },
    [maxHistory],
  );

  const executeRecipe = useCallback(
    (nextRecipe: ProcessingPipelineSnapshot, opts?: { pushHistory?: boolean }) => {
      const original = originalRef.current;
      if (!original) return;

      if (pendingTask.current) {
        pendingTask.current.cancel();
        pendingTask.current = null;
        pendingOperationEventRef.current = null;
      }

      setIsProcessing(true);
      setError(null);

      pendingTask.current = InteractionManager.runAfterInteractions(() => {
        try {
          const normalized = normalizeProcessingPipelineSnapshot(nextRecipe, profileRef.current);
          const result = executeProcessingPipeline({
            input: original,
            snapshot: normalized,
            renderOptions: {
              stretch: stretchRef.current,
              colormap: colormapRef.current,
              blackPoint: 0,
              whitePoint: 1,
              gamma: 1,
              profile: normalized.profile,
            },
            options: { mode: "full" },
          });
          setCurrent(result.scientificOutput);
          setRgbaData(result.colorOutput.rgbaData);
          setRecipe(normalized);
          profileRef.current = normalized.profile;
          if (opts?.pushHistory) {
            commitRecipeToHistory(normalized);
          }
          options.onRecipeChange?.(normalized);
          const pendingOperation = pendingOperationEventRef.current;
          if (pendingOperation) {
            onOperationRef.current?.({
              ...pendingOperation,
              after: {
                width: result.scientificOutput.width,
                height: result.scientificOutput.height,
              },
              historyIndex: historyIndexRef.current,
              historyLength: historyRef.current.length,
            });
            pendingOperationEventRef.current = null;
          }
        } catch (e) {
          Logger.error(LOG_TAGS.ImageEditor, "Recipe execution failed", e);
          setError(e instanceof Error ? e.message : "Recipe execution failed");
          pendingOperationEventRef.current = null;
        } finally {
          setIsProcessing(false);
          pendingTask.current = null;
        }
      });
    },
    [commitRecipeToHistory, options],
  );

  const initialize = useCallback(
    (
      pixels: Float32Array,
      width: number,
      height: number,
      stretch: StretchType = "linear",
      colormap: ColormapType = "grayscale",
      initialRecipe?: ProcessingPipelineSnapshot | null,
    ) => {
      originalRef.current = { pixels, width, height };
      stretchRef.current = stretch;
      colormapRef.current = colormap;

      const normalized = normalizeProcessingPipelineSnapshot(initialRecipe, profileRef.current);
      profileRef.current = normalized.profile;

      historyRef.current = [cloneRecipe(normalized)];
      historyIndexRef.current = 0;
      setHistoryLength(1);
      setHistoryIndex(0);
      setRecipe(normalized);

      executeRecipe(normalized);
      setError(null);
    },
    [executeRecipe],
  );

  const applyEdit = useCallback(
    (operation: ImageEditOperation) => {
      const currentRecipe = recipe ?? historyRef.current[historyIndexRef.current];
      const beforeState = current;
      if (!currentRecipe || !beforeState) return;
      const previousHistoryIndex = historyIndexRef.current;
      const previousHistoryLength = historyRef.current.length;
      const node = buildNodeFromOperation(operation);
      const schema = getProcessingOperation(node.operationId);
      if (!schema) {
        setError(`Unsupported operation: ${node.operationId}`);
        return;
      }
      const nextRecipe = cloneRecipe(currentRecipe);
      nextRecipe.savedAt = Date.now();
      nextRecipe.profile = profileRef.current;
      if (schema.stage === "color") nextRecipe.colorNodes.push(node);
      else nextRecipe.scientificNodes.push(node);
      queueOperationEvent(
        "apply",
        operation,
        { width: beforeState.width, height: beforeState.height },
        previousHistoryIndex,
        previousHistoryLength,
      );
      executeRecipe(nextRecipe, { pushHistory: true });
      Logger.debug(LOG_TAGS.ImageEditor, `Edit applied: ${operation.type}`);
    },
    [current, executeRecipe, queueOperationEvent, recipe],
  );

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    const beforeState = current;
    if (idx <= 0 || !beforeState) return;
    const previousHistoryLength = historyRef.current.length;
    const newIdx = idx - 1;
    historyIndexRef.current = newIdx;
    setHistoryIndex(newIdx);
    const target = historyRef.current[newIdx];
    if (!target) return;
    queueOperationEvent(
      "undo",
      undefined,
      { width: beforeState.width, height: beforeState.height },
      idx,
      previousHistoryLength,
    );
    executeRecipe(target);
  }, [current, executeRecipe, queueOperationEvent]);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    const beforeState = current;
    if (idx >= historyRef.current.length - 1 || !beforeState) return;
    const previousHistoryLength = historyRef.current.length;
    const newIdx = idx + 1;
    historyIndexRef.current = newIdx;
    setHistoryIndex(newIdx);
    const target = historyRef.current[newIdx];
    if (!target) return;
    queueOperationEvent(
      "redo",
      undefined,
      { width: beforeState.width, height: beforeState.height },
      idx,
      previousHistoryLength,
    );
    executeRecipe(target);
  }, [current, executeRecipe, queueOperationEvent]);

  const updateDisplay = useCallback(
    (stretch: StretchType, colormap: ColormapType) => {
      stretchRef.current = stretch;
      colormapRef.current = colormap;
      const activeRecipe = recipe ?? historyRef.current[historyIndexRef.current];
      if (activeRecipe) executeRecipe(activeRecipe);
    },
    [executeRecipe, recipe],
  );

  const setProfile = useCallback(
    (profile: ProcessingAlgorithmProfile) => {
      profileRef.current = profile;
      const activeRecipe = recipe ?? historyRef.current[historyIndexRef.current];
      if (!activeRecipe) return;
      const nextRecipe = cloneRecipe(activeRecipe);
      nextRecipe.profile = profile;
      nextRecipe.savedAt = Date.now();
      executeRecipe(nextRecipe);
      options.onRecipeChange?.(nextRecipe);
    },
    [executeRecipe, options, recipe],
  );

  const state: EditorState = {
    current,
    rgbaData,
    recipe,
    isProcessing,
    error,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < historyLength - 1,
    historyLength,
    historyIndex,
  };

  return {
    ...state,
    initialize,
    applyEdit,
    undo,
    redo,
    updateDisplay,
    setProfile,
  };
}
