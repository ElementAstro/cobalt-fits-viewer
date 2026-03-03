/**
 * 编辑器导出逻辑 Hook
 * 从 editor/[id].tsx 提取，管理导出、分享、保存操作
 */

import { useState, useCallback } from "react";
import { useToast } from "heroui-native";
import { useI18n } from "../i18n/useI18n";
import { useExport } from "../export/useExport";
import { useSettingsStore } from "../stores/useSettingsStore";
import type {
  ExportFormat,
  ImageSourceType,
  ImageSourceFormat,
  StarAnnotationPoint,
} from "../lib/fits/types";
import type { ExportActionOptions } from "../lib/converter/exportActionOptions";

type EditorExportOptions = ExportActionOptions;

interface EditorImageData {
  rgbaData: Uint8ClampedArray;
  current: { width: number; height: number; pixels: Float32Array };
}

interface FileInfo {
  filename: string;
  id: string;
  sourceType?: ImageSourceType;
  sourceFormat?: ImageSourceFormat;
}

interface UseEditorExportOptions {
  editorData: EditorImageData | null;
  fileInfo: FileInfo | null;
  starPoints: StarAnnotationPoint[];
}

export interface UseEditorExportReturn {
  showExport: boolean;
  setShowExport: (v: boolean) => void;
  exportFormat: ExportFormat;
  setExportFormat: (f: ExportFormat) => void;
  isExporting: boolean;
  handleEditorExport: (quality: number, options?: EditorExportOptions) => Promise<void>;
  handleEditorShare: (quality: number, options?: EditorExportOptions) => Promise<void>;
  handleEditorSave: (quality: number, options?: EditorExportOptions) => Promise<void>;
}

export function useEditorExport({
  editorData,
  fileInfo,
  starPoints,
}: UseEditorExportOptions): UseEditorExportReturn {
  const { t } = useI18n();
  const { toast } = useToast();
  const defaultExportFormat = useSettingsStore((s) => s.defaultExportFormat);
  const { isExporting, exportImageDetailed, shareImage, saveImage } = useExport();

  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultExportFormat);

  const buildExportPayload = useCallback(
    (quality: number, options?: EditorExportOptions) => {
      if (!editorData?.rgbaData || !editorData?.current) return null;
      return {
        rgbaData: editorData.rgbaData,
        width: editorData.current.width,
        height: editorData.current.height,
        filename: fileInfo?.filename ?? "edited",
        format: exportFormat,
        quality,
        fits: { ...options?.fits, mode: "rendered" as const },
        tiff: options?.tiff,
        renderOptions: options?.render,
        outputSize: options?.outputSize,
        targetFileSize: options?.targetFileSize,
        webpLossless: options?.webpLossless,
        source: {
          sourceType: fileInfo?.sourceType,
          sourceFormat: fileInfo?.sourceFormat,
          sourceFileId: fileInfo?.id,
          starAnnotations: starPoints,
        },
      };
    },
    [editorData, fileInfo, exportFormat, starPoints],
  );

  const handleEditorExport = useCallback(
    async (quality: number, options?: EditorExportOptions) => {
      const payload = buildExportPayload(quality, options);
      if (!payload) {
        toast.show({ variant: "warning", label: t("viewer.noImageData") });
        return;
      }
      const detailed = await exportImageDetailed(payload);
      if (detailed.path) {
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
        toast.show({ variant: "danger", label: t("viewer.exportFailed") });
      }
      setShowExport(false);
    },
    [buildExportPayload, exportImageDetailed, toast, t],
  );

  const handleEditorShare = useCallback(
    async (quality: number, options?: EditorExportOptions) => {
      const payload = buildExportPayload(quality, options);
      if (!payload) {
        toast.show({ variant: "warning", label: t("viewer.noImageData") });
        return;
      }
      try {
        await shareImage(payload);
      } catch {
        toast.show({ variant: "danger", label: t("share.failed") });
      }
      setShowExport(false);
    },
    [buildExportPayload, shareImage, toast, t],
  );

  const handleEditorSave = useCallback(
    async (quality: number, options?: EditorExportOptions) => {
      const payload = buildExportPayload(quality, options);
      if (!payload) {
        toast.show({ variant: "warning", label: t("viewer.noImageData") });
        return;
      }
      const uri = await saveImage(payload);
      if (uri) {
        toast.show({ variant: "success", label: t("viewer.savedToDevice") });
      } else {
        toast.show({ variant: "danger", label: t("viewer.exportFailed") });
      }
      setShowExport(false);
    },
    [buildExportPayload, saveImage, toast, t],
  );

  return {
    showExport,
    setShowExport,
    exportFormat,
    setExportFormat,
    isExporting,
    handleEditorExport,
    handleEditorShare,
    handleEditorSave,
  };
}
