import { useCallback } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useI18n } from "../i18n/useI18n";
import { useExport } from "./useExport";
import type { ExportFormat } from "../lib/fits/types";

interface UseViewerExportParams {
  rgbaData: Uint8ClampedArray | null;
  width: number | undefined;
  height: number | undefined;
  filename: string;
  format: ExportFormat;
  onDone: () => void;
}

export function useViewerExport({
  rgbaData,
  width,
  height,
  filename,
  format,
  onDone,
}: UseViewerExportParams) {
  const { t } = useI18n();
  const { isExporting, exportImage, shareImage, saveImage, printImage, printToPdf } = useExport();

  const handleExport = useCallback(
    async (quality: number) => {
      if (!rgbaData || !width || !height) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const path = await exportImage(rgbaData, width, height, filename, format, quality);
      if (path) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("common.success"), t("viewer.exportSuccess"));
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      onDone();
    },
    [rgbaData, width, height, exportImage, filename, format, t, onDone],
  );

  const handleShare = useCallback(
    async (quality: number) => {
      if (!rgbaData || !width || !height) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      try {
        await shareImage(rgbaData, width, height, filename, format, quality);
      } catch {
        Alert.alert(t("common.error"), t("share.failed"));
      }
      onDone();
    },
    [rgbaData, width, height, shareImage, filename, format, t, onDone],
  );

  const handleSaveToDevice = useCallback(
    async (quality: number) => {
      if (!rgbaData || !width || !height) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const uri = await saveImage(rgbaData, width, height, filename, format, quality);
      if (uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("common.success"), t("viewer.savedToDevice"));
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      onDone();
    },
    [rgbaData, width, height, saveImage, filename, format, t, onDone],
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
