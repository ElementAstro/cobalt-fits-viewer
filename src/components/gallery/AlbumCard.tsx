import { memo, useMemo } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Button, Card, PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useFitsStore } from "../../stores/useFitsStore";
import { useI18n } from "../../i18n/useI18n";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";
import type { Album } from "../../lib/fits/types";

interface AlbumCardProps {
  album: Album;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Compact layout for landscape mode */
  compact?: boolean;
  onActionPress?: () => void;
}

export const AlbumCard = memo(function AlbumCard({
  album,
  onPress,
  onLongPress,
  compact = false,
  onActionPress,
}: AlbumCardProps) {
  const { t } = useI18n();
  const [mutedColor] = useThemeColor(["muted"]);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = compact
    ? Math.max(110, Math.min(140, (screenWidth - 48) / 4))
    : Math.max(140, Math.min(180, (screenWidth - 48) / 2.5));
  const coverHeight = compact ? 72 : 112;
  const getFileById = useFitsStore((s) => s.getFileById);

  const coverUri = useMemo(() => {
    const coverId = album.coverImageId ?? album.imageIds[0];
    if (!coverId) return undefined;
    const coverFile = getFileById(coverId);
    if (!coverFile) return undefined;
    return resolveThumbnailUri(coverFile.id, coverFile.thumbnailUri) ?? undefined;
  }, [album.coverImageId, album.imageIds, getFileById]);

  return (
    <Pressable onLongPress={onLongPress}>
      <PressableFeedback onPress={onPress}>
        <PressableFeedback.Highlight />
        <Card variant="secondary" style={{ width: cardWidth }}>
          <Card.Body className="p-0">
            <View
              className="w-full items-center justify-center rounded-t-lg bg-surface-secondary overflow-hidden"
              style={{ height: coverHeight }}
            >
              {coverUri ? (
                <Image
                  source={{ uri: coverUri }}
                  className="h-full w-full"
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ) : (
                <Ionicons name="albums-outline" size={32} color={mutedColor} />
              )}
              {/* Smart album indicator */}
              {album.isSmart && (
                <View className="absolute top-1 right-1 rounded bg-success/80 px-1">
                  <Ionicons name="sparkles" size={10} color="#fff" />
                </View>
              )}
              {/* Pinned indicator */}
              {album.isPinned && (
                <View className="absolute top-1 left-1 rounded bg-primary/80 px-1">
                  <Ionicons name="pin" size={10} color="#fff" />
                </View>
              )}
              {onActionPress && (
                <View className="absolute right-1 bottom-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={onActionPress}
                    className="h-6 w-6 rounded-full bg-black/40"
                  >
                    <Ionicons name="ellipsis-vertical" size={12} color="#fff" />
                  </Button>
                </View>
              )}
            </View>
            <View className={compact ? "p-1.5" : "p-2"}>
              <View className="flex-row items-center gap-1">
                <Text
                  className={`${compact ? "text-[10px]" : "text-xs"} font-semibold text-foreground flex-1`}
                  numberOfLines={1}
                >
                  {album.name}
                </Text>
              </View>
              <Text className="text-[9px] text-muted">
                {album.imageIds.length} {t("album.images")}
              </Text>
            </View>
          </Card.Body>
        </Card>
      </PressableFeedback>
    </Pressable>
  );
});
