import { memo } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Image } from "expo-image";
import { Button, Card, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { formatFileSize } from "../../lib/utils/fileManager";
import type { FitsMetadata } from "../../lib/fits/types";

interface FileListItemProps {
  file: FitsMetadata;
  onPress?: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  selected?: boolean;
}

function formatImportDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const FileListItem = memo(function FileListItem({
  file,
  onPress,
  onLongPress,
  onDelete,
  onToggleFavorite,
  selected = false,
}: FileListItemProps) {
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-120, 0],
      outputRange: [0, 120],
      extrapolate: "clamp",
    });

    return (
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX }] }}>
        {onToggleFavorite && (
          <Button
            onPress={onToggleFavorite}
            variant="ghost"
            className="w-16 h-full items-center justify-center bg-amber-500 rounded-none rounded-l-xl"
          >
            <Ionicons name={file.isFavorite ? "heart-dislike" : "heart"} size={20} color="#fff" />
          </Button>
        )}
        {onDelete && (
          <Button
            onPress={onDelete}
            variant="ghost"
            className="w-16 h-full items-center justify-center bg-red-500 rounded-none rounded-r-xl"
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </Button>
        )}
      </Animated.View>
    );
  };

  const hasSwipeActions = onDelete || onToggleFavorite;

  const content = (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <Card variant="secondary" className={selected ? "border border-success" : ""}>
        <Card.Body className="flex-row items-center gap-3 p-3">
          <View className="h-16 w-16 items-center justify-center rounded-xl bg-success/10 overflow-hidden">
            {file.thumbnailUri ? (
              <Image
                source={{ uri: file.thumbnailUri }}
                className="h-full w-full"
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={file.id}
                transition={150}
              />
            ) : (
              <Ionicons name="image-outline" size={28} color={successColor} />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {file.filename}
            </Text>
            <View className="mt-1 flex-row items-center gap-2 flex-wrap">
              <Text className="text-[10px] text-muted">{formatFileSize(file.fileSize)}</Text>
              {file.object && (
                <Chip size="sm" variant="secondary">
                  <Chip.Label className="text-[10px]">{file.object}</Chip.Label>
                </Chip>
              )}
              {file.filter && (
                <Chip size="sm" variant="secondary">
                  <Chip.Label className="text-[10px]">{file.filter}</Chip.Label>
                </Chip>
              )}
              {file.exptime && <Text className="text-[10px] text-muted">{file.exptime}s</Text>}
            </View>
            <Text className="mt-0.5 text-[9px] text-muted">
              {formatImportDate(file.importDate)}
            </Text>
          </View>
          {file.isFavorite && <Ionicons name="heart" size={16} color={successColor} />}
          <Ionicons name="chevron-forward" size={16} color={mutedColor} />
        </Card.Body>
      </Card>
    </Pressable>
  );

  if (!hasSwipeActions) return content;

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false} friction={2}>
      {content}
    </Swipeable>
  );
});
