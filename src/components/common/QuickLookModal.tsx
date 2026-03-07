/**
 * 文件快速预览模态框 — 轻量级预览文件缩略图和元数据
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { Accordion, Button, Chip, Dialog, Separator, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useI18n } from "../../i18n/useI18n";
import { formatBytes } from "../../lib/utils/format";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";
import { regenerateFileThumbnail } from "../../lib/gallery/thumbnailGenerator";
import { formatVideoDuration, formatVideoResolution } from "../../lib/video/format";
import { isVideoFile, isAudioFile, isMediaWorkspaceFile } from "../../lib/media/routing";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { useAlbumStore } from "../../stores/gallery/useAlbumStore";
import { useFileGroupStore } from "../../stores/files/useFileGroupStore";
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

          {/* Extended Details */}
          <FileDetailAccordion file={file} />

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

function FileDetailAccordion({ file }: { file: FitsMetadata }) {
  const { t } = useI18n();
  const albums = useAlbumStore((s) => s.albums);
  const fileGroupStore = useFileGroupStore((s) => s.groups);
  const getFileGroupIds = useFileGroupStore((s) => s.getFileGroupIds);

  const fileAlbums = useMemo(
    () => albums.filter((a) => a.imageIds.includes(file.id)),
    [albums, file.id],
  );
  const fileGroups = useMemo(() => {
    const ids = getFileGroupIds(file.id);
    return fileGroupStore.filter((g) => ids.includes(g.id));
  }, [file.id, fileGroupStore, getFileGroupIds]);

  const importDate = file.importDate ? new Date(file.importDate).toLocaleDateString() : undefined;
  const lastViewed = file.lastViewed ? new Date(file.lastViewed).toLocaleDateString() : undefined;

  const hasDetails =
    file.instrument ||
    file.telescope ||
    file.gain != null ||
    file.ccdTemp != null ||
    file.ra != null ||
    file.dec != null ||
    file.frameTypeSource ||
    file.sourceFormat;

  return (
    <Accordion className="mt-2" variant="surface">
      {hasDetails && (
        <Accordion.Item value="details">
          <Accordion.Trigger>
            <Text className="text-xs font-medium text-foreground flex-1">
              {t("files.fileDetails")}
            </Text>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>
            <View className="gap-1">
              {importDate && <InfoRow label={t("files.importedAt")} value={importDate} />}
              {lastViewed && <InfoRow label={t("files.lastViewed")} value={lastViewed} />}
              {file.sourceFormat && (
                <InfoRow label={t("files.sourceFormat")} value={file.sourceFormat.toUpperCase()} />
              )}
              {file.frameType && <InfoRow label={t("gallery.frameType")} value={file.frameType} />}
              {file.instrument && (
                <InfoRow label={t("targets.instrument")} value={file.instrument} />
              )}
              {file.telescope && <InfoRow label={t("targets.telescope")} value={file.telescope} />}
              {file.gain != null && <InfoRow label={t("targets.gain")} value={String(file.gain)} />}
              {file.ccdTemp != null && (
                <InfoRow label={t("targets.ccdTemp")} value={`${file.ccdTemp}°C`} />
              )}
              {file.ra != null && file.dec != null && (
                <InfoRow
                  label="RA / DEC"
                  value={`${file.ra.toFixed(4)}° / ${file.dec.toFixed(4)}°`}
                />
              )}
              {file.qualityScore != null && (
                <InfoRow label={t("gallery.quality")} value={`${file.qualityScore}/100`} />
              )}
              <InfoRow label={t("files.filePath")} value={file.filepath} size="xs" selectable />
            </View>
          </Accordion.Content>
        </Accordion.Item>
      )}

      {(fileAlbums.length > 0 || fileGroups.length > 0 || file.tags.length > 0) && (
        <Accordion.Item value="relations">
          <Accordion.Trigger>
            <Text className="text-xs font-medium text-foreground flex-1">
              {t("files.belongsTo")}
            </Text>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>
            <View className="gap-2">
              {fileAlbums.length > 0 && (
                <View className="gap-1">
                  <Text className="text-[10px] font-semibold text-muted">
                    {t("gallery.albumsTab")}
                  </Text>
                  <View className="flex-row flex-wrap gap-1">
                    {fileAlbums.map((album) => (
                      <Chip key={album.id} size="sm" variant="secondary">
                        <Chip.Label className="text-[10px]">{album.name}</Chip.Label>
                      </Chip>
                    ))}
                  </View>
                </View>
              )}
              {fileGroups.length > 0 && (
                <View className="gap-1">
                  <Text className="text-[10px] font-semibold text-muted">{t("files.folders")}</Text>
                  <View className="flex-row flex-wrap gap-1">
                    {fileGroups.map((group) => (
                      <Chip key={group.id} size="sm" variant="secondary">
                        <Chip.Label className="text-[10px]">{group.name}</Chip.Label>
                      </Chip>
                    ))}
                  </View>
                </View>
              )}
              {file.tags.length > 0 && (
                <View className="gap-1">
                  <Text className="text-[10px] font-semibold text-muted">{t("files.tags")}</Text>
                  <View className="flex-row flex-wrap gap-1">
                    {file.tags.map((tag) => (
                      <Chip key={tag} size="sm" variant="secondary">
                        <Chip.Label className="text-[10px]">#{tag}</Chip.Label>
                      </Chip>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </Accordion.Content>
        </Accordion.Item>
      )}
    </Accordion>
  );
}
