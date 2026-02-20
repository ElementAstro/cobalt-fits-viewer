import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { File as FSFile } from "expo-file-system";
import {
  loadFitsFromBufferAuto,
  getImageDimensions,
  getImagePixels,
  extractMetadata,
} from "../lib/fits/parser";
import { generateFileId } from "../lib/utils/fileManager";
import { generateAndSaveThumbnail } from "../lib/gallery/thumbnailCache";
import { useExport } from "./useExport";
import { useFitsStore } from "../stores/useFitsStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { registerCompositeLayers } from "../lib/composite/registrationAdapter";
import { renderComposite } from "../lib/composite/renderer";
import type {
  CompositeLayer,
  PixelMathValidationError,
  CompositePreset,
  CompositeProgress,
  CompositeProject,
  CompositeRenderResult,
} from "../lib/composite/types";

const MAX_LAYERS = 8;

function createLayer(index: number): CompositeLayer {
  return {
    id: `layer-${Date.now()}-${index}`,
    fileId: null,
    filepath: null,
    filename: null,
    enabled: true,
    isLuminance: false,
    opacity: 1,
    blendMode: "normal",
    tint: { r: 1, g: 1, b: 1 },
    useForLinearMatch: true,
    useForBrightnessBalance: true,
  };
}

function applyPresetToLayers(layers: CompositeLayer[], preset: CompositePreset) {
  const next = layers.map((layer) => ({ ...layer, isLuminance: false }));

  const setTint = (index: number, tint: { r: number; g: number; b: number }) => {
    if (!next[index]) return;
    next[index] = {
      ...next[index],
      tint,
      enabled: true,
      blendMode: "normal",
      opacity: 1,
    };
  };

  if (preset === "rgb") {
    setTint(0, { r: 1, g: 0, b: 0 });
    setTint(1, { r: 0, g: 1, b: 0 });
    setTint(2, { r: 0, g: 0, b: 1 });
  } else if (preset === "lrgb") {
    if (next[0]) next[0] = { ...next[0], isLuminance: true, tint: { r: 1, g: 1, b: 1 } };
    setTint(1, { r: 1, g: 0, b: 0 });
    setTint(2, { r: 0, g: 1, b: 0 });
    setTint(3, { r: 0, g: 0, b: 1 });
  } else if (preset === "sho") {
    setTint(0, { r: 1, g: 0, b: 0 });
    setTint(1, { r: 0, g: 1, b: 0 });
    setTint(2, { r: 0, g: 0, b: 1 });
  } else if (preset === "hoo") {
    setTint(0, { r: 1, g: 0, b: 0 });
    setTint(1, { r: 0, g: 0.5, b: 0.5 });
  } else if (preset === "hos") {
    setTint(0, { r: 1, g: 0, b: 0 });
    setTint(1, { r: 0, g: 0.5, b: 0.5 });
    setTint(2, { r: 0, g: 0.2, b: 1 });
  }

  return next;
}

export function useAdvancedCompose() {
  const addFile = useFitsStore((s) => s.addFile);
  const getFileById = useFitsStore((s) => s.getFileById);
  const updateFile = useFitsStore((s) => s.updateFile);
  const thumbnailSize = useSettingsStore((s) => s.thumbnailSize);
  const thumbnailQuality = useSettingsStore((s) => s.thumbnailQuality);

  const advancedRegistrationMode = useSettingsStore((s) => s.advancedComposeRegistrationMode);
  const advancedFramingMode = useSettingsStore((s) => s.advancedComposeFramingMode);
  const advancedAutoLinearMatch = useSettingsStore((s) => s.advancedComposeAutoLinearMatch);
  const advancedAutoBrightnessBalance = useSettingsStore(
    (s) => s.advancedComposeAutoBrightnessBalance,
  );
  const advancedPreviewScale = useSettingsStore((s) => s.advancedComposePreviewScale);
  const advancedPixelMathR = useSettingsStore((s) => s.advancedComposePixelMathR);
  const advancedPixelMathG = useSettingsStore((s) => s.advancedComposePixelMathG);
  const advancedPixelMathB = useSettingsStore((s) => s.advancedComposePixelMathB);

  const { exportImage, shareImage } = useExport();

  const [project, setProject] = useState<CompositeProject>({
    preset: "rgb",
    layers: [createLayer(0), createLayer(1), createLayer(2)],
    registration: {
      mode: advancedRegistrationMode,
      framing: advancedFramingMode,
    },
    options: {
      linkedStretch: true,
      autoLinearMatch: advancedAutoLinearMatch,
      autoBrightnessBalance: advancedAutoBrightnessBalance,
      colorSpace: "hsl",
      applyPixelMath: false,
      pixelMath: {
        r: advancedPixelMathR,
        g: advancedPixelMathG,
        b: advancedPixelMathB,
      },
      splitPosition: 0.5,
      previewScale: advancedPreviewScale,
      previewMode: "composite",
    },
  });
  const [baseDimensions, setBaseDimensions] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [alignedDimensions, setAlignedDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [previewResult, setPreviewResult] = useState<CompositeRenderResult | null>(null);
  const [fullResult, setFullResult] = useState<CompositeRenderResult | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isRenderingFull, setIsRenderingFull] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pixelMathError, setPixelMathError] = useState<PixelMathValidationError | null>(null);
  const [progress, setProgress] = useState<CompositeProgress | null>(null);

  const baseDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const fullAbortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderWidth = alignedDimensions?.width ?? baseDimensions?.width ?? 0;
  const renderHeight = alignedDimensions?.height ?? baseDimensions?.height ?? 0;

  const assignedCount = useMemo(
    () =>
      project.layers.filter((layer) => layer.fileId && (layer.pixels || layer.alignedPixels))
        .length,
    [project.layers],
  );

  const setPreset = useCallback((preset: CompositePreset) => {
    setProject((prev) => ({
      ...prev,
      preset,
      layers: applyPresetToLayers(prev.layers, preset),
    }));
  }, []);

  const addLayer = useCallback(() => {
    setProject((prev) => {
      if (prev.layers.length >= MAX_LAYERS) return prev;
      return {
        ...prev,
        layers: [...prev.layers, createLayer(prev.layers.length)],
      };
    });
  }, []);

  const removeLayer = useCallback((layerId: string) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.filter((layer) => layer.id !== layerId),
    }));
  }, []);

  const updateLayer = useCallback((layerId: string, patch: Partial<CompositeLayer>) => {
    setProject((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
    }));
  }, []);

  const updateOptions = useCallback((patch: Partial<CompositeProject["options"]>) => {
    setProject((prev) => ({ ...prev, options: { ...prev.options, ...patch } }));
  }, []);

  const updateRegistration = useCallback((patch: Partial<CompositeProject["registration"]>) => {
    setProject((prev) => ({ ...prev, registration: { ...prev.registration, ...patch } }));
  }, []);

  const loadLayerFile = useCallback(
    async (layerId: string, fileId: string, filepath: string, filename: string) => {
      try {
        setProgress({
          phase: "loading",
          current: 1,
          total: 1,
          message: `Loading ${filename}`,
        });
        setError(null);

        const file = new FSFile(filepath);
        const buffer = await file.arrayBuffer();
        const fits = loadFitsFromBufferAuto(buffer);
        const dims = getImageDimensions(fits);
        const pixels = await getImagePixels(fits);

        if (!dims || !pixels) {
          throw new Error(`Failed to decode ${filename}`);
        }

        const currentBase = baseDimensionsRef.current;
        if (
          currentBase &&
          (currentBase.width !== dims.width || currentBase.height !== dims.height)
        ) {
          throw new Error(
            `${filename} dimensions mismatch: ${dims.width}x${dims.height}, expected ${currentBase.width}x${currentBase.height}`,
          );
        }
        if (!currentBase) {
          const nextBase = { width: dims.width, height: dims.height };
          baseDimensionsRef.current = nextBase;
          setBaseDimensions(nextBase);
        }

        setProject((prev) => ({
          ...prev,
          layers: prev.layers.map((layer) =>
            layer.id === layerId
              ? {
                  ...layer,
                  fileId,
                  filepath,
                  filename,
                  pixels,
                  alignedPixels: undefined,
                }
              : layer,
          ),
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load layer");
      } finally {
        setProgress(null);
      }
    },
    [],
  );

  const cancelRenders = useCallback(() => {
    previewAbortRef.current?.abort();
    fullAbortRef.current?.abort();
    previewAbortRef.current = null;
    fullAbortRef.current = null;
  }, []);

  const renderPreview = useCallback(async () => {
    if (!renderWidth || !renderHeight) return null;

    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;

    setIsRenderingPreview(true);
    setError(null);
    setPixelMathError(null);

    try {
      const result = await renderComposite({
        layers: project.layers,
        width: renderWidth,
        height: renderHeight,
        options: project.options,
        mode: "preview",
        signal: controller.signal,
      });
      setPreviewResult(result);
      setPixelMathError(result.pixelMathError ?? null);
      return result;
    } catch (e) {
      if ((e as Error).message !== "Aborted") {
        setError(e instanceof Error ? e.message : "Preview render failed");
      }
      return null;
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null;
      }
      setIsRenderingPreview(false);
    }
  }, [project.layers, project.options, renderHeight, renderWidth]);

  const renderFull = useCallback(async () => {
    if (!renderWidth || !renderHeight) return null;

    fullAbortRef.current?.abort();
    const controller = new AbortController();
    fullAbortRef.current = controller;

    setIsRenderingFull(true);
    setError(null);
    setPixelMathError(null);

    try {
      const result = await renderComposite({
        layers: project.layers,
        width: renderWidth,
        height: renderHeight,
        options: { ...project.options, previewScale: 1 },
        mode: "full",
        signal: controller.signal,
      });
      setFullResult(result);
      setPixelMathError(result.pixelMathError ?? null);
      return result;
    } catch (e) {
      if ((e as Error).message !== "Aborted") {
        setError(e instanceof Error ? e.message : "Full render failed");
      }
      return null;
    } finally {
      if (fullAbortRef.current === controller) {
        fullAbortRef.current = null;
      }
      setIsRenderingFull(false);
    }
  }, [project.layers, project.options, renderHeight, renderWidth]);

  const renderTwoPass = useCallback(async () => {
    await renderPreview();

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void renderFull();
    }, 220);
  }, [renderFull, renderPreview]);

  const runRegistration = useCallback(async () => {
    if (!baseDimensions) return;
    const loadedLayers = project.layers.filter((layer) => layer.enabled && layer.pixels) as Array<
      CompositeLayer & { pixels: Float32Array }
    >;
    if (loadedLayers.length < 2) return;

    try {
      setIsRegistering(true);
      setProgress({
        phase: "registering",
        current: 0,
        total: loadedLayers.length,
        message: "Registering layers",
      });
      setError(null);

      const result = await registerCompositeLayers({
        layers: loadedLayers.map((layer) => layer.pixels),
        width: baseDimensions.width,
        height: baseDimensions.height,
        mode: project.registration.mode,
        framing: project.registration.framing,
        manualControlPoints: project.registration.manualControlPoints,
        alignmentOptions: {
          fallbackToTranslation: true,
        },
      });

      setAlignedDimensions({ width: result.width, height: result.height });
      setProject((prev) => {
        let loadedIndex = 0;
        return {
          ...prev,
          layers: prev.layers.map((layer) => {
            if (!layer.enabled || !layer.pixels) return layer;
            const alignedPixels = result.layers[loadedIndex];
            loadedIndex++;
            return { ...layer, alignedPixels };
          }),
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setIsRegistering(false);
      setProgress(null);
    }
  }, [
    baseDimensions,
    project.layers,
    project.registration.framing,
    project.registration.manualControlPoints,
    project.registration.mode,
  ]);

  const saveComposite = useCallback(
    async (filename: string, extraFormats: Array<"png" | "tiff"> = []) => {
      const render = fullResult ?? (await renderFull());
      if (!render) return null;

      setProgress({ phase: "saving", current: 0, total: 1, message: "Saving composed image" });
      setError(null);

      try {
        const fitsUri = await exportImage({
          rgbaData: render.rgbaData,
          width: render.width,
          height: render.height,
          filename,
          format: "fits",
          fits: {
            mode: "rendered",
            compression: "none",
            bitpix: -32,
            colorLayout: "rgbCube3d",
            preserveOriginalHeader: false,
            preserveWcs: false,
          },
        });

        if (!fitsUri) {
          throw new Error("Failed to export FITS");
        }

        const outputFile = new FSFile(fitsUri);
        const outputBuffer = await outputFile.arrayBuffer();
        const parsed = loadFitsFromBufferAuto(outputBuffer);
        const partialMeta = extractMetadata(parsed, {
          filename: outputFile.name,
          filepath: outputFile.uri,
          fileSize: outputFile.size ?? outputBuffer.byteLength,
        });

        const referenceLayer = project.layers.find((layer) => layer.fileId && layer.enabled);
        const sourceMeta = referenceLayer?.fileId ? getFileById(referenceLayer.fileId) : undefined;

        const id = generateFileId();
        addFile({
          ...partialMeta,
          id,
          importDate: Date.now(),
          isFavorite: false,
          tags: [],
          albumIds: [],
          sourceType: "fits",
          sourceFormat: "fits",
          mediaKind: "image",
          derivedFromId: sourceMeta?.id,
          processingTag: "compose-advanced",
          targetId: sourceMeta?.targetId,
          sessionId: sourceMeta?.sessionId,
          location: sourceMeta?.location,
        });

        const thumbUri = generateAndSaveThumbnail(
          id,
          render.rgbaData,
          render.width,
          render.height,
          thumbnailSize,
          thumbnailQuality,
        );

        if (thumbUri) {
          updateFile(id, { thumbnailUri: thumbUri });
        }

        for (const format of extraFormats) {
          await exportImage({
            rgbaData: render.rgbaData,
            width: render.width,
            height: render.height,
            filename,
            format,
          });
        }

        return { id, filepath: outputFile.uri };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save composition");
        return null;
      } finally {
        setProgress(null);
      }
    },
    [
      addFile,
      exportImage,
      fullResult,
      getFileById,
      project.layers,
      renderFull,
      thumbnailQuality,
      thumbnailSize,
      updateFile,
    ],
  );

  const shareComposite = useCallback(
    async (filename: string, format: "png" | "jpeg" | "webp" = "png") => {
      const render = fullResult ?? (await renderFull());
      if (!render) return;
      await shareImage({
        rgbaData: render.rgbaData,
        width: render.width,
        height: render.height,
        filename,
        format,
      });
    },
    [fullResult, renderFull, shareImage],
  );

  const reset = useCallback(() => {
    cancelRenders();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setProject((prev) => ({
      ...prev,
      preset: "rgb",
      layers: [createLayer(0), createLayer(1), createLayer(2)],
    }));
    setBaseDimensions(null);
    baseDimensionsRef.current = null;
    setAlignedDimensions(null);
    setPreviewResult(null);
    setFullResult(null);
    setError(null);
    setPixelMathError(null);
    setProgress(null);
  }, [cancelRenders]);

  useEffect(() => {
    return () => {
      cancelRenders();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [cancelRenders]);

  useEffect(() => {
    if (!renderWidth || !renderHeight || assignedCount === 0) return;
    void renderTwoPass();
  }, [assignedCount, project.layers, project.options, renderHeight, renderTwoPass, renderWidth]);

  return {
    project,
    baseDimensions,
    alignedDimensions,
    renderWidth,
    renderHeight,
    assignedCount,
    previewResult,
    fullResult,
    isRegistering,
    isRenderingPreview,
    isRenderingFull,
    progress,
    error,
    pixelMathError,
    setPreset,
    addLayer,
    removeLayer,
    updateLayer,
    updateOptions,
    updateRegistration,
    loadLayerFile,
    runRegistration,
    renderPreview,
    renderFull,
    renderTwoPass,
    saveComposite,
    shareComposite,
    cancelRenders,
    reset,
  };
}
