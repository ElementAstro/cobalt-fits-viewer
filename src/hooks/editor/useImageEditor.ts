/**
 * 图像编辑器 Hook
 * 基于非破坏式 recipe（scientific + color）管理编辑状态与撤销/重做
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { InteractionManager } from "react-native";
import type {
  ColormapType,
  ProcessingAlgorithmProfile,
  ProcessingMaskConfig,
  ProcessingNode,
  ProcessingPipelineSnapshot,
  ProcessingParamValue,
  StretchType,
} from "../lib/fits/types";
import { executeProcessingPipeline } from "../lib/processing/executor";
import { fitsToRGBA } from "../lib/converter/formatConverter";
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
  originalRgbaData: Uint8ClampedArray | null;
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

const INTERACTION_FALLBACK_DELAY_MS = 180;

function cloneNode(node: ProcessingNode): ProcessingNode {
  return {
    id: node.id,
    operationId: node.operationId,
    enabled: node.enabled !== false,
    params: { ...node.params },
    ...(node.maskConfig ? { maskConfig: { ...node.maskConfig } } : {}),
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
  const [originalRgbaData, setOriginalRgbaData] = useState<Uint8ClampedArray | null>(null);
  const [recipe, setRecipe] = useState<ProcessingPipelineSnapshot | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyRef = useRef<ProcessingPipelineSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const originalRef = useRef<ImageState | null>(null);
  const intermediatesRef = useRef<{ pixels: Float32Array; width: number; height: number }[]>([]);
  const lastRecipeScientificCountRef = useRef(0);

  const [historyLength, setHistoryLength] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const stretchRef = useRef<StretchType>("linear");
  const colormapRef = useRef<ColormapType>("grayscale");
  const profileRef = useRef<ProcessingAlgorithmProfile>(options.profile ?? "standard");
  const pendingTask = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(
    null,
  );
  const pendingFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOperationEventRef = useRef<PendingOperationEvent | null>(null);
  const previewBackupRef = useRef<{
    current: ImageState | null;
    rgbaData: Uint8ClampedArray | null;
    recipe: ProcessingPipelineSnapshot | null;
  } | null>(null);

  const clearPendingExecution = useCallback(() => {
    if (pendingTask.current) {
      pendingTask.current.cancel();
      pendingTask.current = null;
    }
    if (pendingFallbackTimer.current) {
      clearTimeout(pendingFallbackTimer.current);
      pendingFallbackTimer.current = null;
    }
  }, []);

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

      const hadPendingExecution = !!pendingTask.current || !!pendingFallbackTimer.current;
      if (hadPendingExecution) {
        clearPendingExecution();
        pendingOperationEventRef.current = null;
      }

      setIsProcessing(true);
      setError(null);

      let hasExecuted = false;
      const runExecution = () => {
        if (hasExecuted) return;
        hasExecuted = true;
        try {
          const normalized = normalizeProcessingPipelineSnapshot(nextRecipe, profileRef.current);
          const prevCount = lastRecipeScientificCountRef.current;
          const nextCount = normalized.scientificNodes.length;
          const cachedIntermediates = intermediatesRef.current;
          const canReuse =
            opts?.pushHistory && nextCount > prevCount && cachedIntermediates.length >= prevCount;
          const startNodeIndex = canReuse ? prevCount : 0;
          const previousIntermediates = canReuse
            ? cachedIntermediates.slice(0, prevCount)
            : undefined;

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
            options: {
              mode: "full",
              startNodeIndex,
              previousIntermediates,
            },
          });
          intermediatesRef.current = result.scientificIntermediates ?? [];
          lastRecipeScientificCountRef.current = nextCount;
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
          clearPendingExecution();
        }
      };

      pendingTask.current = InteractionManager.runAfterInteractions(runExecution);
      pendingFallbackTimer.current = setTimeout(() => {
        runExecution();
      }, INTERACTION_FALLBACK_DELAY_MS);
    },
    [clearPendingExecution, commitRecipeToHistory, options],
  );

  useEffect(() => {
    return () => {
      clearPendingExecution();
      pendingOperationEventRef.current = null;
    };
  }, [clearPendingExecution]);

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
      intermediatesRef.current = [];
      lastRecipeScientificCountRef.current = 0;
      stretchRef.current = stretch;
      colormapRef.current = colormap;
      setOriginalRgbaData(
        fitsToRGBA(pixels, width, height, {
          stretch,
          colormap,
          blackPoint: 0,
          whitePoint: 1,
          gamma: 1,
          profile: profileRef.current,
        }),
      );

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
    intermediatesRef.current = [];
    lastRecipeScientificCountRef.current = 0;
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
    intermediatesRef.current = [];
    lastRecipeScientificCountRef.current = 0;
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

  const previewEdit = useCallback(
    (operation: ImageEditOperation) => {
      const currentRecipe = recipe ?? historyRef.current[historyIndexRef.current];
      const original = originalRef.current;
      if (!currentRecipe || !original) return;

      const node = buildNodeFromOperation(operation);
      const schema = getProcessingOperation(node.operationId);
      if (!schema) return;

      // Respect registry-level preview capability.
      if (!schema.supportsPreview) return;

      // Backup current state on first preview call
      if (!previewBackupRef.current) {
        previewBackupRef.current = {
          current,
          rgbaData,
          recipe: currentRecipe,
        };
      }

      const nextRecipe = cloneRecipe(currentRecipe);
      nextRecipe.profile = profileRef.current;
      if (schema.stage === "color") nextRecipe.colorNodes.push(node);
      else nextRecipe.scientificNodes.push(node);

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
          options: {
            mode: "preview",
            previewMaxDimension: 512,
          },
        });
        setCurrent(result.scientificOutput);
        setRgbaData(result.colorOutput.rgbaData);
      } catch {
        // Silently fail preview — user can still Apply for full execution
      }
    },
    [current, rgbaData, recipe],
  );

  const cancelPreview = useCallback(() => {
    const backup = previewBackupRef.current;
    if (!backup) return;
    setCurrent(backup.current);
    setRgbaData(backup.rgbaData);
    previewBackupRef.current = null;
  }, []);

  const commitPreview = useCallback(
    (operation: ImageEditOperation) => {
      previewBackupRef.current = null;
      applyEdit(operation);
    },
    [applyEdit],
  );

  const isPreviewActive = previewBackupRef.current !== null;

  const toggleNode = useCallback(
    (nodeId: string) => {
      const currentRecipe = recipe ?? historyRef.current[historyIndexRef.current];
      if (!currentRecipe) return;
      const nextRecipe = cloneRecipe(currentRecipe);
      nextRecipe.savedAt = Date.now();
      const sci = nextRecipe.scientificNodes.find((n) => n.id === nodeId);
      const col = nextRecipe.colorNodes.find((n) => n.id === nodeId);
      if (sci) sci.enabled = !sci.enabled;
      else if (col) col.enabled = !col.enabled;
      else return;
      intermediatesRef.current = [];
      lastRecipeScientificCountRef.current = 0;
      executeRecipe(nextRecipe, { pushHistory: true });
    },
    [executeRecipe, recipe],
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      const currentRecipe = recipe ?? historyRef.current[historyIndexRef.current];
      if (!currentRecipe) return;
      const nextRecipe = cloneRecipe(currentRecipe);
      nextRecipe.savedAt = Date.now();
      nextRecipe.scientificNodes = nextRecipe.scientificNodes.filter((n) => n.id !== nodeId);
      nextRecipe.colorNodes = nextRecipe.colorNodes.filter((n) => n.id !== nodeId);
      intermediatesRef.current = [];
      lastRecipeScientificCountRef.current = 0;
      executeRecipe(nextRecipe, { pushHistory: true });
    },
    [executeRecipe, recipe],
  );

  const setNodeMaskConfig = useCallback(
    (nodeId: string, maskConfig: ProcessingMaskConfig | null) => {
      const currentRecipe = recipe ?? historyRef.current[historyIndexRef.current];
      if (!currentRecipe) return;

      const nextRecipe = cloneRecipe(currentRecipe);
      nextRecipe.savedAt = Date.now();
      const targetIndex = nextRecipe.scientificNodes.findIndex((node) => node.id === nodeId);
      if (targetIndex <= 0) return;
      const targetNode = nextRecipe.scientificNodes[targetIndex];
      if (!targetNode) return;

      if (!maskConfig) {
        if (!targetNode.maskConfig) return;
        delete targetNode.maskConfig;
      } else {
        const sourceIndex = nextRecipe.scientificNodes.findIndex(
          (node) => node.id === maskConfig.sourceNodeId,
        );
        if (sourceIndex < 0 || sourceIndex >= targetIndex) return;
        targetNode.maskConfig = {
          sourceNodeId: maskConfig.sourceNodeId,
          invert: !!maskConfig.invert,
          blendStrength: Math.max(0, Math.min(1, maskConfig.blendStrength)),
        };
      }

      intermediatesRef.current = [];
      lastRecipeScientificCountRef.current = 0;
      executeRecipe(nextRecipe, { pushHistory: true });
    },
    [executeRecipe, recipe],
  );

  const clearNodeMaskConfig = useCallback(
    (nodeId: string) => {
      setNodeMaskConfig(nodeId, null);
    },
    [setNodeMaskConfig],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const state: EditorState = {
    current,
    rgbaData,
    originalRgbaData,
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
    clearError,
    previewEdit,
    cancelPreview,
    commitPreview,
    isPreviewActive,
    toggleNode,
    removeNode,
    setNodeMaskConfig,
    clearNodeMaskConfig,
  };
}
