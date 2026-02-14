/**
 * RGB 合成工作流 Hook
 * 管理通道加载、合成和预览
 */

import { useState, useCallback } from "react";
import { readFileAsArrayBuffer } from "../lib/utils/fileManager";
import { loadFitsFromBuffer, getImagePixels, getImageDimensions } from "../lib/fits/parser";
import { composeRGB, type ChannelData } from "../lib/utils/rgbCompose";

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

export function useCompose() {
  const [red, setRed] = useState<ChannelState>({
    fileId: null,
    filepath: null,
    filename: null,
    pixels: null,
    weight: 1.0,
  });
  const [green, setGreen] = useState<ChannelState>({
    fileId: null,
    filepath: null,
    filename: null,
    pixels: null,
    weight: 1.0,
  });
  const [blue, setBlue] = useState<ChannelState>({
    fileId: null,
    filepath: null,
    filename: null,
    pixels: null,
    weight: 1.0,
  });
  const [luminance, setLuminance] = useState<ChannelState>({
    fileId: null,
    filepath: null,
    filename: null,
    pixels: null,
    weight: 1.0,
  });

  const [linkedStretch, setLinkedStretch] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [result, setResult] = useState<ComposeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refDimensions, setRefDimensions] = useState<{ width: number; height: number } | null>(
    null,
  );

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
        const fits = loadFitsFromBuffer(buffer);
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

        const state: ChannelState = {
          fileId,
          filepath,
          filename,
          pixels,
          weight: 1.0,
        };

        switch (channel) {
          case "red":
            setRed(state);
            break;
          case "green":
            setGreen(state);
            break;
          case "blue":
            setBlue(state);
            break;
          case "luminance":
            setLuminance(state);
            break;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load channel");
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

  const clearChannel = useCallback((channel: "red" | "green" | "blue" | "luminance") => {
    const empty: ChannelState = {
      fileId: null,
      filepath: null,
      filename: null,
      pixels: null,
      weight: 1.0,
    };
    switch (channel) {
      case "red":
        setRed(empty);
        break;
      case "green":
        setGreen(empty);
        break;
      case "blue":
        setBlue(empty);
        break;
      case "luminance":
        setLuminance(empty);
        break;
    }
  }, []);

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

      setResult({
        rgbaData,
        width: refDimensions.width,
        height: refDimensions.height,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Composition failed");
    } finally {
      setIsComposing(false);
    }
  }, [red, green, blue, luminance, linkedStretch, refDimensions]);

  const reset = useCallback(() => {
    const empty: ChannelState = {
      fileId: null,
      filepath: null,
      filename: null,
      pixels: null,
      weight: 1.0,
    };
    setRed(empty);
    setGreen(empty);
    setBlue(empty);
    setLuminance(empty);
    setResult(null);
    setError(null);
    setRefDimensions(null);
  }, []);

  return {
    channels: { red, green, blue, luminance },
    isLoading,
    isComposing,
    result,
    error,
    linkedStretch,
    setLinkedStretch,
    assignedCount: [red, green, blue].filter((c) => c.pixels !== null).length,
    hasLuminance: luminance.pixels !== null,
    loadChannel,
    setChannelWeight,
    clearChannel,
    compose,
    reset,
  };
}
