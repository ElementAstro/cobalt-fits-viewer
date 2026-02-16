import { memo } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useMemo } from "react";
import { Card, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useFitsStore } from "../../stores/useFitsStore";
import { useI18n } from "../../i18n/useI18n";
import type { Album } from "../../lib/fits/types";

interface AlbumCardProps {
  album: Album;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Compact layout for landscape mode */
  compact?: boolean;
}

export const AlbumCard = memo(function AlbumCard({
  album,
  onPress,
  onLongPress,
  compact = false,
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
    return getFileById(coverId)?.thumbnailUri;
  }, [album.coverImageId, album.imageIds, getFileById]);

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
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
    </Pressable>
  );
});
