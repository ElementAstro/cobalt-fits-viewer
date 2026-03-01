/**
 * 文件快速预览模态框 — 轻量级预览文件缩略图和元数据
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Button, Dialog, Separator, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useI18n } from "../../i18n/useI18n";
import { formatBytes } from "../../lib/utils/format";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";
import { regenerateFileThumbnail } from "../../lib/gallery/thumbnailGenerator";
import { formatVideoDuration, formatVideoResolution } from "../../lib/video/format";
import { isVideoFile, isAudioFile, isMediaWorkspaceFile } from "../../lib/media/routing";
import { useFitsStore } from "../../stores/useFitsStore";
import type { FitsMetadata } from "../../lib/fits/types";
import { InfoRow } from "./InfoRow";

interface QuickLookModalProps {
  visible: boolean;
  file: FitsMetadata | null;
  onClose: () => void;
  onOpenViewer: (id: string) => void;
  onOpenEditor: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  onAddTag?: (id: string) => void;
}

export function QuickLookModal({
  visible,
  file,
  onClose,
  onOpenViewer,
  onOpenEditor,
  onToggleFavorite,
  onDelete,
  onRename,
  onAddTag,
}: QuickLookModalProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const dangerColor = useThemeColor("danger");
  const updateFile = useFitsStore((s) => s.updateFile);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const thumbnailUri = useMemo(
    () => (file ? resolveThumbnailUri(file.id, file.thumbnailUri) : null),
    [file],
  );
  const isVideo = file ? isVideoFile(file) : false;
  const isAudio = file ? isAudioFile(file) : false;
  const isMedia = file ? isMediaWorkspaceFile(file) : false;

  const handleRegenerateThumbnail = useCallback(async () => {
    if (!file || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const result = await regenerateFileThumbnail(file);
      if (result.uri) {
        updateFile(result.fileId, { thumbnailUri: result.uri });
      }
    } finally {
      setIsRegenerating(false);
    }
  }, [file, isRegenerating, updateFile]);
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
          ) : isAudio ? (
            <View className="mt-3 h-48 rounded-lg bg-black/70 items-center justify-center">
              <Ionicons name="musical-notes-outline" size={48} color={mutedColor} />
              <Text className="mt-2 text-xs text-muted">
                {formatVideoDuration(file.durationMs)}
              </Text>
            </View>
          ) : thumbnailUri ? (
            <View className="mt-3 h-48 rounded-lg overflow-hidden bg-black items-center justify-center">
              <Image
                source={{ uri: thumbnailUri }}
                className="w-full h-full"
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={200}
              />
            </View>
          ) : (
            <View className="mt-3 h-48 rounded-lg bg-black/50 items-center justify-center">
              {isRegenerating ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={48} color={mutedColor} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onPress={handleRegenerateThumbnail}
                  >
                    <Ionicons name="refresh-outline" size={12} color={mutedColor} />
                    <Button.Label>{t("settings.regenerateThumbnail")}</Button.Label>
                  </Button>
                </>
              )}
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
            {isAudio && (
              <>
                <InfoRow
                  label={t("common.duration")}
                  value={formatVideoDuration(file.durationMs)}
                />
                {!!file.audioCodec && <InfoRow label="Audio codec" value={file.audioCodec} />}
              </>
            )}
            {file.object && <InfoRow label={t("targets.object")} value={file.object} />}
            {file.filter && <InfoRow label={t("targets.filter")} value={file.filter} />}
            {!isMedia && file.exptime != null && (
              <InfoRow label={t("targets.exposure")} value={`${file.exptime}s`} />
            )}
            {!isMedia && file.naxis1 != null && file.naxis2 != null && (
              <InfoRow label={t("viewer.dimensions")} value={`${file.naxis1} × ${file.naxis2}`} />
            )}
          </View>

          {/* Quick Actions */}
          {(onToggleFavorite || onDelete || onRename || onAddTag) && (
            <View className="mt-3 flex-row justify-around rounded-lg bg-surface-secondary py-2">
              {onToggleFavorite && (
                <QuickAction
                  icon={file.isFavorite ? "heart" : "heart-outline"}
                  label={t("files.toggleFavorite")}
                  color={file.isFavorite ? dangerColor : mutedColor}
                  onPress={() => {
                    onToggleFavorite(file.id);
                  }}
                />
              )}
              {onRename && (
                <QuickAction
                  icon="create-outline"
                  label={t("common.rename")}
                  onPress={() => {
                    onClose();
                    onRename(file.id);
                  }}
                />
              )}
              {onAddTag && (
                <QuickAction
                  icon="pricetag-outline"
                  label={t("files.batchTag")}
                  onPress={() => {
                    onClose();
                    onAddTag(file.id);
                  }}
                />
              )}
              {onDelete && (
                <QuickAction
                  icon="trash-outline"
                  label={t("common.delete")}
                  color={dangerColor}
                  onPress={() => {
                    onClose();
                    onDelete(file.id);
                  }}
                />
              )}
            </View>
          )}

          <Separator className="my-3" />

          {/* Actions */}
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onPress={onClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            {!isMedia && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  onClose();
                  onOpenEditor(file.id);
                }}
              >
                <Ionicons name="create-outline" size={12} color={mutedColor} />
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

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  const defaultColor = useThemeColor("muted");
  return (
    <Button variant="ghost" size="sm" onPress={onPress} className="flex-col items-center gap-0.5">
      <Ionicons name={icon} size={18} color={color ?? defaultColor} />
      <Text className="text-[9px] text-muted" numberOfLines={1}>
        {label}
      </Text>
    </Button>
  );
}
