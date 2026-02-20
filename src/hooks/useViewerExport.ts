import { useCallback } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useI18n } from "../i18n/useI18n";
import { useExport } from "./useExport";
import { useHapticFeedback } from "./useHapticFeedback";
import type { ExportFormat, FitsTargetOptions, TiffTargetOptions } from "../lib/fits/types";
import type { ExportSourceContext } from "./useExport";
import type { ExportRenderOptions } from "../lib/converter/exportDecorations";

type ViewerExportOptions = {
  fits?: Partial<FitsTargetOptions>;
  tiff?: Partial<TiffTargetOptions>;
  render?: ExportRenderOptions;
};

interface UseViewerExportParams {
  rgbaData: Uint8ClampedArray | null;
  width: number | undefined;
  height: number | undefined;
  filename: string;
  format: ExportFormat;
  source?: ExportSourceContext;
  onDone: () => void;
}

export function useViewerExport({
  rgbaData,
  width,
  height,
  filename,
  format,
  source,
  onDone,
}: UseViewerExportParams) {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { isExporting, exportImageDetailed, shareImage, saveImage, printImage, printToPdf } =
    useExport();

  const handleExport = useCallback(
    async (quality: number, options?: ViewerExportOptions) => {
      if (!rgbaData || !width || !height) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const detailed = await exportImageDetailed({
        rgbaData,
        width,
        height,
        filename,
        format,
        quality,
        fits: options?.fits,
        tiff: options?.tiff,
        renderOptions: options?.render,
        source,
      });
      if (detailed.path) {
        haptics.notify(Haptics.NotificationFeedbackType.Success);
        const fallbackMessage =
          detailed.diagnostics.fallbackApplied && detailed.diagnostics.fallbackReasonMessageKey
            ? `\n${t(detailed.diagnostics.fallbackReasonMessageKey)}`
            : "";
        Alert.alert(t("common.success"), `${t("viewer.exportSuccess")}${fallbackMessage}`);
      } else {
        haptics.notify(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      onDone();
    },
    [rgbaData, width, height, exportImageDetailed, filename, format, source, haptics, t, onDone],
  );

  const handleShare = useCallback(
    async (quality: number, options?: ViewerExportOptions) => {
      if (!rgbaData || !width || !height) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      try {
        await shareImage({
          rgbaData,
          width,
          height,
          filename,
          format,
          quality,
          fits: options?.fits,
          tiff: options?.tiff,
          renderOptions: options?.render,
          source,
        });
      } catch {
        Alert.alert(t("common.error"), t("share.failed"));
      }
      onDone();
    },
    [rgbaData, width, height, shareImage, filename, format, source, t, onDone],
  );

  const handleSaveToDevice = useCallback(
    async (quality: number, options?: ViewerExportOptions) => {
      if (!rgbaData || !width || !height) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const uri = await saveImage({
        rgbaData,
        width,
        height,
        filename,
        format,
        quality,
        fits: options?.fits,
        tiff: options?.tiff,
        renderOptions: options?.render,
        source,
      });
      if (uri) {
        haptics.notify(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("common.success"), t("viewer.savedToDevice"));
      } else {
        haptics.notify(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      onDone();
    },
    [rgbaData, width, height, saveImage, filename, format, source, haptics, t, onDone],
  );

  const handlePrint = useCallback(async () => {
    if (!rgbaData || !width || !height) {
      Alert.alert(t("common.error"), t("viewer.noImageData"));
      return;
    }
    try {
      await printImage(rgbaData, width, height, filename);
    } catch {
      Alert.alert(t("common.error"), t("viewer.printFailed"));
    }
    onDone();
  }, [rgbaData, width, height, printImage, filename, t, onDone]);

  const handlePrintToPdf = useCallback(async () => {
    if (!rgbaData || !width || !height) {
      Alert.alert(t("common.error"), t("viewer.noImageData"));
      return;
    }
    try {
      await printToPdf(rgbaData, width, height, filename);
    } catch {
      Alert.alert(t("common.error"), t("viewer.printFailed"));
    }
    onDone();
  }, [rgbaData, width, height, printToPdf, filename, t, onDone]);

  return {
    isExporting,
    handleExport,
    handleShare,
    handleSaveToDevice,
    handlePrint,
    handlePrintToPdf,
  };
}
