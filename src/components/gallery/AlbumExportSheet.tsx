/**
 * 相簿导出面板
 */

import { View, Text } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { BottomSheet, Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import {
  exportAlbum,
  shareAlbumExport,
  cleanupExport,
  type ExportProgress,
} from "../../lib/gallery/albumExporter";
import type { Album, FitsMetadata } from "../../lib/fits/types";

interface AlbumExportSheetProps {
  visible: boolean;
  album: Album | null;
  files: FitsMetadata[];
  onClose: () => void;
}

export function AlbumExportSheet({ visible, album, files, onClose }: AlbumExportSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor, dangerColor] = useThemeColor(["muted", "success", "danger"]);

  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const startExport = useCallback(async () => {
    if (!album) return;

    setIsExporting(true);
    setProgress(null);

    const path = await exportAlbum(album, files, setProgress);

    if (path) {
      setExportPath(path);
    }

    setIsExporting(false);
  }, [album, files]);

  useEffect(() => {
    if (visible && album && !isExporting && !exportPath) {
      startExport();
    }
  }, [visible, album, isExporting, exportPath, startExport]);

  const handleShare = async () => {
    if (exportPath) {
      const success = await shareAlbumExport(exportPath);
      if (!success) {
        // Sharing not available
        console.warn("Sharing not available");
      }
    }
  };

  const handleClose = async () => {
    if (exportPath) {
      await cleanupExport(exportPath);
    }
    setProgress(null);
    setExportPath(null);
    setIsExporting(false);
    onClose();
  };

  const getProgressPercent = () => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const getStatusText = () => {
    if (!progress) return "";
    switch (progress.status) {
      case "preparing":
        return t("album.exporting");
      case "copying":
        return `${t("album.exporting")} ${progress.current}/${progress.total}`;
      case "generating_manifest":
        return t("album.exporting");
      case "zipping":
        return t("album.exportingZip");
      case "complete":
        return t("album.exportSuccess");
      case "error":
        return progress.error || t("album.exportFailed");
      default:
        return "";
    }
  };

  if (!album) return null;

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["40%"]}>
          <View className="flex-1 bg-background px-4 pt-2">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="archive" size={20} color={successColor} />
                <BottomSheet.Title>{t("album.exportZip")}</BottomSheet.Title>
              </View>
              <Button size="sm" variant="ghost" isIconOnly onPress={handleClose}>
                <Ionicons name="close" size={20} color={mutedColor} />
              </Button>
            </View>

            {/* Album Info */}
            <View className="rounded-xl bg-surface-secondary p-3 mb-4">
              <Text className="text-base font-semibold text-foreground">{album.name}</Text>
              <Text className="text-sm text-muted mt-1">
                {album.imageIds.length} {t("album.images")}
              </Text>
            </View>

            {/* Progress */}
            {isExporting && progress && (
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm text-muted">{getStatusText()}</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {getProgressPercent()}%
                  </Text>
                </View>
                <View className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
                  <View
                    className="h-full rounded-full bg-success"
                    style={{ width: `${getProgressPercent()}%` }}
                  />
                </View>
              </View>
            )}

            {/* Error */}
            {progress?.status === "error" && (
              <View className="rounded-xl bg-danger/10 p-3 mb-4">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="alert-circle" size={20} color={dangerColor} />
                  <Text className="text-sm text-danger">{progress.error}</Text>
                </View>
              </View>
            )}

            {/* Complete */}
            {progress?.status === "complete" && exportPath && (
              <View className="rounded-xl bg-success/10 p-3 mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Ionicons name="checkmark-circle" size={20} color={successColor} />
                  <Text className="text-sm text-success">{t("album.exportSuccess")}</Text>
                </View>
              </View>
            )}

            {/* Actions */}
            <View className="flex-row gap-2 mt-auto">
              {exportPath && progress?.status === "complete" && (
                <Button className="flex-1" onPress={handleShare}>
                  <Ionicons name="share-outline" size={18} color="#fff" />
                  <Button.Label>{t("common.share")}</Button.Label>
                </Button>
              )}
              <Button variant="outline" className="flex-1" onPress={handleClose}>
                <Button.Label>{t("common.done")}</Button.Label>
              </Button>
            </View>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
