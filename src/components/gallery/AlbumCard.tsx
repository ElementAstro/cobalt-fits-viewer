import { memo, useMemo } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Button, Card, Chip, PressableFeedback, Surface, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { useI18n } from "../../i18n/useI18n";
import { resolveAlbumCoverUri } from "../../lib/gallery/thumbnailCache";
import type { Album } from "../../lib/fits/types";

interface AlbumCardProps {
  album: Album;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Compact layout for landscape mode */
  compact?: boolean;
  /** Card layout: 'horizontal' for fixed-width scrollable, 'grid' for fill-width grid cells */
  layout?: "horizontal" | "grid";
  onActionPress?: () => void;
}

export const AlbumCard = memo(function AlbumCard({
  album,
  onPress,
  onLongPress,
  compact = false,
  layout = "horizontal",
  onActionPress,
}: AlbumCardProps) {
  const { t } = useI18n();
  const [mutedColor] = useThemeColor(["muted"]);
  const { width: screenWidth } = useWindowDimensions();
  const isGrid = layout === "grid";
  const cardWidth = isGrid
    ? undefined
    : compact
      ? Math.max(110, Math.min(140, (screenWidth - 48) / 4))
      : Math.max(140, Math.min(180, (screenWidth - 48) / 2.5));
  const coverHeight = isGrid ? 120 : compact ? 72 : 112;
  const getFileById = useFitsStore((s) => s.getFileById);

  const coverUri = useMemo(() => resolveAlbumCoverUri(album, getFileById), [album, getFileById]);

  return (
    <Pressable onLongPress={onLongPress}>
      <PressableFeedback onPress={onPress}>
        <PressableFeedback.Highlight />
        <Card variant="secondary" style={cardWidth != null ? { width: cardWidth } : undefined}>
          <Card.Header className="p-0">
            <View
              className="w-full items-center justify-center rounded-t-lg overflow-hidden"
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
                <Surface variant="tertiary" className="h-full w-full items-center justify-center">
                  <Ionicons name="albums-outline" size={40} color={mutedColor} />
                </Surface>
              )}
              {/* Smart album indicator */}
              {album.isSmart && (
                <View className="absolute top-1.5 right-1.5">
                  <Chip size="sm" color="success" variant="primary" className="h-5 px-1">
                    <Ionicons name="sparkles" size={10} color="#fff" />
                  </Chip>
                </View>
              )}
              {/* Pinned indicator */}
              {album.isPinned && (
                <View className="absolute top-1.5 left-1.5">
                  <Chip size="sm" color="accent" variant="primary" className="h-5 px-1">
                    <Ionicons name="pin" size={10} color="#fff" />
                  </Chip>
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
          </Card.Header>
          <Card.Body className={compact ? "p-1.5" : "px-2.5 py-2"}>
            <Text
              className={`${compact ? "text-[10px]" : "text-xs"} font-semibold text-foreground`}
              numberOfLines={1}
            >
              {album.name}
            </Text>
          </Card.Body>
          <Card.Footer className={compact ? "px-1.5 pb-1.5" : "px-2.5 pb-2"}>
            <Text className={`${compact ? "text-[8px]" : "text-[10px]"} text-muted`}>
              {album.imageIds.length} {t("album.images")}
            </Text>
          </Card.Footer>
        </Card>
      </PressableFeedback>
    </Pressable>
  );
});
