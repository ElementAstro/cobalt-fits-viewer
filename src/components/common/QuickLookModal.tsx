/**
 * 文件快速预览模态框 — 轻量级预览文件缩略图和元数据
 */

import { useEffect, useMemo } from "react";
import { View, Text, Image } from "react-native";
import { Button, Dialog, Separator } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useI18n } from "../../i18n/useI18n";
import { formatBytes } from "../../lib/utils/format";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";
import { formatVideoDuration, formatVideoResolution } from "../../lib/video/format";
import type { FitsMetadata } from "../../lib/fits/types";

interface QuickLookModalProps {
  visible: boolean;
  file: FitsMetadata | null;
  onClose: () => void;
  onOpenViewer: (id: string) => void;
  onOpenEditor: (id: string) => void;
}

export function QuickLookModal({
  visible,
  file,
  onClose,
  onOpenViewer,
  onOpenEditor,
}: QuickLookModalProps) {
  const { t } = useI18n();
  const thumbnailUri = useMemo(
    () => (file ? resolveThumbnailUri(file.id, file.thumbnailUri) : null),
    [file],
  );
  const isVideo = file?.mediaKind === "video" || file?.sourceType === "video";
  const player = useVideoPlayer(isVideo && file ? { uri: file.filepath } : null, (instance) => {
    instance.muted = true;
    instance.loop = true;
  });
  useEffect(() => {
    if (!isVideo) return;
    if (visible) {
      player.play();
      return;
    }
    player.pause();
  }, [isVideo, player, visible]);
  if (!file) return null;

  return (
    <Dialog
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="max-w-[340px]">
          <Dialog.Title>{file.filename}</Dialog.Title>

          {/* Thumbnail / Video Preview */}
          {isVideo ? (
            <View className="mt-3 h-48 overflow-hidden rounded-lg bg-black">
              <VideoView
                player={player}
                className="h-full w-full"
                nativeControls
                contentFit="contain"
                allowsPictureInPicture={false}
              />
            </View>
          ) : thumbnailUri ? (
            <View className="mt-3 h-48 rounded-lg overflow-hidden bg-black items-center justify-center">
              <Image
                source={{ uri: thumbnailUri }}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>
          ) : (
            <View className="mt-3 h-48 rounded-lg bg-black/50 items-center justify-center">
              <Ionicons name="image-outline" size={48} color="#555" />
              <Text className="mt-2 text-xs text-muted">{t("common.noData")}</Text>
            </View>
          )}

          {/* File Info */}
          <View className="mt-3 gap-1.5">
            <InfoRow label={t("files.fileSize")} value={formatBytes(file.fileSize)} />
            {isVideo && (
              <>
                <InfoRow
                  label={t("common.duration")}
                  value={formatVideoDuration(file.durationMs)}
                />
                <InfoRow
                  label={t("viewer.dimensions")}
                  value={formatVideoResolution(file.videoWidth, file.videoHeight) || "--"}
                />
              </>
            )}
            {file.object && <InfoRow label={t("targets.object")} value={file.object} />}
            {file.filter && <InfoRow label={t("targets.filter")} value={file.filter} />}
            {!isVideo && file.exptime != null && (
              <InfoRow label={t("targets.exposure")} value={`${file.exptime}s`} />
            )}
            {!isVideo && file.naxis1 != null && file.naxis2 != null && (
              <InfoRow label={t("viewer.dimensions")} value={`${file.naxis1} × ${file.naxis2}`} />
            )}
          </View>

          <Separator className="my-3" />

          {/* Actions */}
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onPress={onClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            {!isVideo && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  onClose();
                  onOpenEditor(file.id);
                }}
              >
                <Ionicons name="create-outline" size={12} color="#888" />
                <Button.Label>{t("common.edit")}</Button.Label>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onPress={() => {
                onClose();
                onOpenViewer(file.id);
              }}
            >
              <Ionicons name="eye-outline" size={12} color="#fff" />
              <Button.Label>{t("viewer.view")}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[10px] text-muted">{label}</Text>
      <Text className="text-[10px] font-medium text-foreground">{value}</Text>
    </View>
  );
}
