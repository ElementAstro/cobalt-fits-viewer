/**
 * RGB 合成工作流 Hook
 * 管理通道加载、合成和预览
 */

import { useState, useCallback } from "react";
import { readFileAsArrayBuffer } from "../lib/utils/fileManager";
import {
  loadScientificFitsFromBuffer,
  getImagePixels,
  getImageDimensions,
} from "../lib/fits/parser";
import { composeRGB, type ChannelData } from "../lib/utils/rgbCompose";
import {
  applyColorBalanceRGBA,
  applyColorCalibrationRGBA,
  applySaturationRGBA,
  applySCNRRGBA,
  type SCNRMethod,
} from "../lib/processing/color";
import { LOG_TAGS, Logger } from "../lib/logger";

interface ChannelState {
  fileId: string | null;
  filepath: string | null;
  filename: string | null;
  pixels: Float32Array | null;
  weight: number;
}

interface ComposeResult {
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
}

interface ComposeColorProcessingOptions {
  scnrMethod: SCNRMethod;
  scnrAmount: number;
  colorCalibrationPercentile: number;
  enableColorCalibration: boolean;
  saturationAmount: number;
  redGain: number;
  greenGain: number;
  blueGain: number;
}

interface UseComposeOptions {
  initialPreset?: "rgb" | "sho" | "hoo" | "lrgb" | "custom";
  initialWeights?: {
    red?: number;
    green?: number;
    blue?: number;
    luminance?: number;
  };
}

function clampWeight(value: number | undefined, fallback = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(4, value));
}

export function useCompose(options: UseComposeOptions = {}) {
  const initialRedWeight = clampWeight(options.initialWeights?.red, 1);
  const initialGreenWeight = clampWeight(options.initialWeights?.green, 1);
  const initialBlueWeight = clampWeight(options.initialWeights?.blue, 1);
  const initialLuminanceWeight = clampWeight(options.initialWeights?.luminance, 1);

  const [red, setRed] = useState<ChannelState>({
    fileId: null,
    filepath: null,
    filename: null,
    pixels: null,
    weight: initialRedWeight,
  });
  const [green, setGreen] = useState<ChannelState>({
    fileId: null,
    filepath: null,
    filename: null,
    pixels: null,
    weight: initialGreenWeight,
  });
  const [blue, setBlue] = useState<ChannelState>({
    fileId: null,
    filepath: null,
    filename: null,
    pixels: null,
    weight: initialBlueWeight,
  });
  const [luminance, setLuminance] = useState<ChannelState>({
    fileId: null,
    filepath: null,
    filename: null,
    pixels: null,
    weight: initialLuminanceWeight,
  });

  const [linkedStretch, setLinkedStretch] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [result, setResult] = useState<ComposeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refDimensions, setRefDimensions] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [colorProcessing, setColorProcessing] = useState<ComposeColorProcessingOptions>({
    scnrMethod: "averageNeutral",
    scnrAmount: 0,
    colorCalibrationPercentile: 0.92,
    enableColorCalibration: false,
    saturationAmount: 0,
    redGain: 1,
    greenGain: 1,
    blueGain: 1,
  });

  const loadChannel = useCallback(
    async (
      channel: "red" | "green" | "blue" | "luminance",
      fileId: string,
      filepath: string,
      filename: string,
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const buffer = await readFileAsArrayBuffer(filepath);
        const fits = await loadScientificFitsFromBuffer(buffer, { filename });
        const dims = getImageDimensions(fits);
        const pixels = await getImagePixels(fits);

        if (!dims || !pixels) {
          throw new Error(`Failed to read image data from ${filename}`);
        }

        // Validate dimensions against reference
        if (refDimensions) {
          if (dims.width !== refDimensions.width || dims.height !== refDimensions.height) {
            throw new Error(
              `${filename} (${dims.width}x${dims.height}) doesn't match reference (${refDimensions.width}x${refDimensions.height})`,
            );
          }
        } else {
          setRefDimensions({ width: dims.width, height: dims.height });
        }

        const buildState = (weight: number): ChannelState => ({
          fileId,
          filepath,
          filename,
          pixels,
          weight,
        });

        switch (channel) {
          case "red":
            setRed((prev) => buildState(prev.weight));
            break;
          case "green":
            setGreen((prev) => buildState(prev.weight));
            break;
          case "blue":
            setBlue((prev) => buildState(prev.weight));
            break;
          case "luminance":
            setLuminance((prev) => buildState(prev.weight));
            break;
        }
        Logger.info(LOG_TAGS.Compose, `Channel ${channel} loaded: ${filename}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load channel";
        Logger.error(LOG_TAGS.Compose, `Channel ${channel} load failed: ${filename}`, e);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [refDimensions],
  );

  const setChannelWeight = useCallback(
    (channel: "red" | "green" | "blue" | "luminance", weight: number) => {
      const update = (prev: ChannelState) => ({ ...prev, weight });
      switch (channel) {
        case "red":
          setRed(update);
          break;
        case "green":
          setGreen(update);
          break;
        case "blue":
          setBlue(update);
          break;
        case "luminance":
          setLuminance(update);
          break;
      }
    },
    [],
  );

  const clearChannel = useCallback(
    (channel: "red" | "green" | "blue" | "luminance") => {
      const getDefaultWeight = (target: typeof channel) => {
        if (target === "red") return initialRedWeight;
        if (target === "green") return initialGreenWeight;
        if (target === "blue") return initialBlueWeight;
        return initialLuminanceWeight;
      };
      const buildEmpty = (target: typeof channel): ChannelState => ({
        fileId: null,
        filepath: null,
        filename: null,
        pixels: null,
        weight: getDefaultWeight(target),
      });
      switch (channel) {
        case "red":
          setRed(buildEmpty("red"));
          break;
        case "green":
          setGreen(buildEmpty("green"));
          break;
        case "blue":
          setBlue(buildEmpty("blue"));
          break;
        case "luminance":
          setLuminance(buildEmpty("luminance"));
          break;
      }
    },
    [initialBlueWeight, initialGreenWeight, initialLuminanceWeight, initialRedWeight],
  );

  const compose = useCallback(() => {
    if (!refDimensions) {
      setError("No channels loaded");
      return;
    }

    const assignedCount = [red, green, blue].filter((c) => c.pixels !== null).length;
    if (assignedCount < 2) {
      setError("Assign at least 2 channels");
      return;
    }

    setIsComposing(true);
    setError(null);

    try {
      const redData: ChannelData | undefined = red.pixels
        ? { pixels: red.pixels, weight: red.weight }
        : undefined;
      const greenData: ChannelData | undefined = green.pixels
        ? { pixels: green.pixels, weight: green.weight }
        : undefined;
      const blueData: ChannelData | undefined = blue.pixels
        ? { pixels: blue.pixels, weight: blue.weight }
        : undefined;

      const lumData: ChannelData | undefined = luminance.pixels
        ? { pixels: luminance.pixels, weight: luminance.weight }
        : undefined;

      const rgbaData = composeRGB({
        red: redData,
        green: greenData,
        blue: blueData,
        luminance: lumData,
        width: refDimensions.width,
        height: refDimensions.height,
        linkedStretch,
      });

      let processed = rgbaData;
      if (colorProcessing.scnrAmount > 0) {
        processed = applySCNRRGBA(
          processed,
          colorProcessing.scnrMethod,
          Math.max(0, Math.min(1, colorProcessing.scnrAmount)),
        );
      }
      if (colorProcessing.enableColorCalibration) {
        processed = applyColorCalibrationRGBA(
          processed,
          Math.max(0.5, Math.min(0.99, colorProcessing.colorCalibrationPercentile)),
        );
      }
      if (Math.abs(colorProcessing.saturationAmount) > 1e-6) {
        processed = applySaturationRGBA(processed, colorProcessing.saturationAmount);
      }
      if (
        Math.abs(colorProcessing.redGain - 1) > 1e-6 ||
        Math.abs(colorProcessing.greenGain - 1) > 1e-6 ||
        Math.abs(colorProcessing.blueGain - 1) > 1e-6
      ) {
        processed = applyColorBalanceRGBA(
          processed,
          colorProcessing.redGain,
          colorProcessing.greenGain,
          colorProcessing.blueGain,
        );
      }

      setResult({
        rgbaData: processed,
        width: refDimensions.width,
        height: refDimensions.height,
      });
      Logger.info(LOG_TAGS.Compose, "RGB composition completed", {
        width: refDimensions.width,
        height: refDimensions.height,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Composition failed";
      Logger.error(LOG_TAGS.Compose, "Composition failed", e);
      setError(msg);
    } finally {
      setIsComposing(false);
    }
  }, [red, green, blue, luminance, linkedStretch, refDimensions, colorProcessing]);

  const reset = useCallback(() => {
    const empty = (weight: number): ChannelState => ({
      fileId: null,
      filepath: null,
      filename: null,
      pixels: null,
      weight,
    });
    setRed(empty(initialRedWeight));
    setGreen(empty(initialGreenWeight));
    setBlue(empty(initialBlueWeight));
    setLuminance(empty(initialLuminanceWeight));
    setResult(null);
    setError(null);
    setRefDimensions(null);
  }, [initialBlueWeight, initialGreenWeight, initialLuminanceWeight, initialRedWeight]);

  return {
    initialPreset: options.initialPreset ?? "rgb",
    channels: { red, green, blue, luminance },
    isLoading,
    isComposing,
    result,
    error,
    linkedStretch,
    setLinkedStretch,
    colorProcessing,
    setColorProcessing,
    assignedCount: [red, green, blue].filter((c) => c.pixels !== null).length,
    hasLuminance: luminance.pixels !== null,
    loadChannel,
    setChannelWeight,
    clearChannel,
    compose,
    reset,
  };
}
