import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useToast } from "heroui-native";
import { useI18n } from "../i18n/useI18n";
import { useExport } from "./useExport";
import { useHapticFeedback } from "./useHapticFeedback";
import type { ExportFormat, FitsTargetOptions, TiffTargetOptions } from "../lib/fits/types";
import type { ExportSourceContext } from "./useExport";
import type { ExportRenderOptions } from "../lib/converter/exportDecorations";
import { ShareNotAvailableError, MediaPermissionDeniedError } from "../lib/utils/imageExport";

type ViewerExportOptions = {
  fits?: Partial<FitsTargetOptions>;
  tiff?: Partial<TiffTargetOptions>;
  render?: ExportRenderOptions;
  customFilename?: string;
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
  const { toast } = useToast();
  const haptics = useHapticFeedback();
  const {
    isExporting,
    exportPhase,
    exportImageDetailed,
    shareImage,
    saveImage,
    copyImageToClipboard,
    printImage,
    printToPdf,
  } = useExport();

  const handleExport = useCallback(
    async (quality: number, options?: ViewerExportOptions) => {
      if (!rgbaData || !width || !height) {
        toast.show({ variant: "warning", label: t("viewer.noImageData") });
        return;
      }
      const detailed = await exportImageDetailed({
        rgbaData,
        width,
        height,
        filename: options?.customFilename || filename,
        format,
        quality,
        fits: options?.fits,
        tiff: options?.tiff,
        renderOptions: options?.render,
        source,
      });
      if (detailed.path) {
        haptics.notify(Haptics.NotificationFeedbackType.Success);
        const fallbackDesc =
          detailed.diagnostics.fallbackApplied && detailed.diagnostics.fallbackReasonMessageKey
            ? t(detailed.diagnostics.fallbackReasonMessageKey)
            : undefined;
        toast.show({
          variant: "success",
          label: t("viewer.exportSuccess"),
          description: fallbackDesc,
        });
      } else {
        haptics.notify(Haptics.NotificationFeedbackType.Error);
        toast.show({ variant: "danger", label: t("viewer.exportFailed") });
      }
      onDone();
    },
    [
      rgbaData,
      width,
      height,
      exportImageDetailed,
      filename,
      format,
      source,
      haptics,
      toast,
      t,
      onDone,
    ],
  );

  const handleShare = useCallback(
    async (quality: number, options?: ViewerExportOptions) => {
      if (!rgbaData || !width || !height) {
        toast.show({ variant: "warning", label: t("viewer.noImageData") });
        return;
      }
      try {
        await shareImage({
          rgbaData,
          width,
          height,
          filename: options?.customFilename || filename,
          format,
          quality,
          fits: options?.fits,
          tiff: options?.tiff,
          renderOptions: options?.render,
          source,
        });
      } catch (error) {
        if (error instanceof ShareNotAvailableError) {
          toast.show({ variant: "danger", label: t("share.notAvailable") });
        } else {
          toast.show({ variant: "danger", label: t("share.failed") });
        }
      }
      onDone();
    },
    [rgbaData, width, height, shareImage, filename, format, source, toast, t, onDone],
  );

  const handleSaveToDevice = useCallback(
    async (quality: number, options?: ViewerExportOptions) => {
      if (!rgbaData || !width || !height) {
        toast.show({ variant: "warning", label: t("viewer.noImageData") });
        return;
      }
      try {
        const uri = await saveImage({
          rgbaData,
          width,
          height,
          filename: options?.customFilename || filename,
          format,
          quality,
          fits: options?.fits,
          tiff: options?.tiff,
          renderOptions: options?.render,
          source,
        });
        if (uri) {
          haptics.notify(Haptics.NotificationFeedbackType.Success);
          toast.show({ variant: "success", label: t("viewer.savedToDevice") });
        } else {
          haptics.notify(Haptics.NotificationFeedbackType.Error);
          toast.show({ variant: "danger", label: t("viewer.exportFailed") });
        }
      } catch (error) {
        haptics.notify(Haptics.NotificationFeedbackType.Error);
        if (error instanceof MediaPermissionDeniedError) {
          toast.show({ variant: "danger", label: t("share.permissionDenied") });
        } else {
          toast.show({ variant: "danger", label: t("viewer.exportFailed") });
        }
      }
      onDone();
    },
    [rgbaData, width, height, saveImage, filename, format, source, haptics, toast, t, onDone],
  );

  const handleCopyToClipboard = useCallback(async () => {
    if (!rgbaData || !width || !height) {
      toast.show({ variant: "warning", label: t("viewer.noImageData") });
      return;
    }
    const ok = await copyImageToClipboard(rgbaData, width, height);
    if (ok) {
      haptics.notify(Haptics.NotificationFeedbackType.Success);
      toast.show({ variant: "success", label: t("viewer.copiedToClipboard") });
    } else {
      haptics.notify(Haptics.NotificationFeedbackType.Error);
      toast.show({ variant: "danger", label: t("viewer.copyFailed") });
    }
    onDone();
  }, [rgbaData, width, height, copyImageToClipboard, haptics, toast, t, onDone]);

  const handlePrint = useCallback(async () => {
    if (!rgbaData || !width || !height) {
      toast.show({ variant: "warning", label: t("viewer.noImageData") });
      return;
    }
    try {
      await printImage(rgbaData, width, height, filename);
    } catch {
      toast.show({ variant: "danger", label: t("viewer.printFailed") });
    }
    onDone();
  }, [rgbaData, width, height, printImage, filename, toast, t, onDone]);

  const handlePrintToPdf = useCallback(async () => {
    if (!rgbaData || !width || !height) {
      toast.show({ variant: "warning", label: t("viewer.noImageData") });
      return;
    }
    try {
      await printToPdf(rgbaData, width, height, filename);
    } catch {
      toast.show({ variant: "danger", label: t("viewer.printFailed") });
    }
    onDone();
  }, [rgbaData, width, height, printToPdf, filename, toast, t, onDone]);

  return {
    isExporting,
    exportPhase,
    handleExport,
    handleShare,
    handleSaveToDevice,
    handleCopyToClipboard,
    handlePrint,
    handlePrintToPdf,
  };
}
