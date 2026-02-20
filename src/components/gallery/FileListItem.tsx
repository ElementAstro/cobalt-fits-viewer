import { memo, useMemo } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Image } from "expo-image";
import { Button, Card, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { formatFileSize } from "../../lib/utils/fileManager";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";
import { formatVideoDuration, formatVideoResolution } from "../../lib/video/format";
import type { FitsMetadata } from "../../lib/fits/types";

type FileItemLayout = "grid" | "list" | "compact";

interface FileListItemProps {
  file: FitsMetadata;
  onPress?: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  selected?: boolean;
  layout?: FileItemLayout;
  showFilename?: boolean;
  showObject?: boolean;
  showFilter?: boolean;
  showExposure?: boolean;
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
  layout = "list",
  showFilename = true,
  showObject = false,
  showFilter = true,
  showExposure = false,
}: FileListItemProps) {
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const thumbSize = layout === "compact" ? 42 : 64;
  const thumbnailUri = useMemo(
    () => resolveThumbnailUri(file.id, file.thumbnailUri),
    [file.id, file.thumbnailUri],
  );

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
            className="h-full w-16 items-center justify-center rounded-none rounded-l-xl bg-amber-500"
          >
            <Ionicons name={file.isFavorite ? "heart-dislike" : "heart"} size={20} color="#fff" />
          </Button>
        )}
        {onDelete && (
          <Button
            onPress={onDelete}
            variant="ghost"
            className="h-full w-16 items-center justify-center rounded-none rounded-r-xl bg-red-500"
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
          </Button>
        )}
      </Animated.View>
    );
  };

  const hasSwipeActions = (onDelete || onToggleFavorite) && layout !== "grid";
  const isVideo = file.mediaKind === "video" || file.sourceType === "video";
  const isAudio = file.mediaKind === "audio" || file.sourceType === "audio";
  const videoResolution = formatVideoResolution(file.videoWidth, file.videoHeight);
  const mediaDuration = formatVideoDuration(file.durationMs);

  const metaSummary = [
    file.sourceFormat?.toUpperCase(),
    showObject && file.object,
    showFilter && file.filter,
    showExposure && file.exptime != null && `${file.exptime}s`,
  ].filter(Boolean);

  const content =
    layout === "grid" ? (
      <Pressable onPress={onPress} onLongPress={onLongPress} style={{ flex: 1 }}>
        <Card variant="secondary" className={selected ? "border border-success" : ""}>
          <Card.Body className="p-2">
            <View className="aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-success/10">
              {thumbnailUri ? (
                <Image
                  source={{ uri: thumbnailUri }}
                  className="h-full w-full"
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={file.id}
                  transition={150}
                />
              ) : (
                <Ionicons
                  name={isAudio ? "musical-notes-outline" : "image-outline"}
                  size={24}
                  color={successColor}
                />
              )}
              {isVideo && (
                <>
                  <View className="absolute left-1 bottom-1 rounded-md bg-black/70 px-1 py-0.5">
                    <Text className="text-[8px] font-semibold text-white">{mediaDuration}</Text>
                  </View>
                  <View className="absolute bottom-1 right-1 rounded-full bg-black/60 p-1">
                    <Ionicons name="play" size={10} color="#fff" />
                  </View>
                </>
              )}
              {isAudio && (
                <>
                  <View className="absolute left-1 bottom-1 rounded-md bg-black/70 px-1 py-0.5">
                    <Text className="text-[8px] font-semibold text-white">{mediaDuration}</Text>
                  </View>
                  <View className="absolute bottom-1 right-1 rounded-full bg-black/60 p-1">
                    <Ionicons name="musical-note" size={10} color="#fff" />
                  </View>
                </>
              )}
              {selected && (
                <View className="absolute left-1 top-1 rounded-full bg-background/70 p-0.5">
                  <Ionicons name="checkmark-circle" size={16} color={successColor} />
                </View>
              )}
              {file.isFavorite && (
                <View className="absolute right-1 top-1">
                  <Ionicons name="heart" size={14} color={successColor} />
                </View>
              )}
            </View>
            {showFilename && (
              <Text className="mt-1 text-[10px] font-semibold text-foreground" numberOfLines={1}>
                {file.filename}
              </Text>
            )}
            {metaSummary.length > 0 && (
              <Text className="mt-0.5 text-[9px] text-muted" numberOfLines={1}>
                {metaSummary.join(" · ")}
              </Text>
            )}
            {(isVideo || isAudio) && (
              <View className="mt-1 flex-row items-center gap-1.5">
                <Chip size="sm" variant="secondary">
                  <Chip.Label className="text-[9px] font-semibold">
                    {isVideo ? "VIDEO" : "AUDIO"}
                  </Chip.Label>
                </Chip>
                {isVideo && !!videoResolution && (
                  <Text className="text-[9px] text-muted">{videoResolution}</Text>
                )}
                <Text className="text-[9px] text-muted">{mediaDuration}</Text>
              </View>
            )}
          </Card.Body>
        </Card>
      </Pressable>
    ) : (
      <Pressable onPress={onPress} onLongPress={onLongPress}>
        <Card variant="secondary" className={selected ? "border border-success" : ""}>
          <Card.Body
            className={`flex-row items-center gap-3 ${layout === "compact" ? "p-2" : "p-3"}`}
          >
            <View
              className="items-center justify-center overflow-hidden rounded-xl bg-success/10"
              style={{ width: thumbSize, height: thumbSize }}
            >
              {thumbnailUri ? (
                <Image
                  source={{ uri: thumbnailUri }}
                  className="h-full w-full"
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={file.id}
                  transition={150}
                />
              ) : (
                <Ionicons
                  name={isAudio ? "musical-notes-outline" : "image-outline"}
                  size={layout === "compact" ? 20 : 28}
                  color={successColor}
                />
              )}
              {isVideo && (
                <View className="absolute bottom-1 right-1 rounded-full bg-black/60 p-1">
                  <Ionicons name="play" size={10} color="#fff" />
                </View>
              )}
              {isAudio && (
                <View className="absolute bottom-1 right-1 rounded-full bg-black/60 p-1">
                  <Ionicons name="musical-note" size={10} color="#fff" />
                </View>
              )}
            </View>
            <View className="min-w-0 flex-1">
              {showFilename && (
                <Text
                  className={
                    layout === "compact"
                      ? "text-xs font-semibold text-foreground"
                      : "text-sm font-semibold text-foreground"
                  }
                  numberOfLines={1}
                >
                  {file.filename}
                </Text>
              )}
              <View className="mt-1 flex-row flex-wrap items-center gap-2">
                <Text className="text-[10px] text-muted">{formatFileSize(file.fileSize)}</Text>
                {showObject && file.object && (
                  <Chip size="sm" variant="secondary">
                    <Chip.Label className="text-[10px]">{file.object}</Chip.Label>
                  </Chip>
                )}
                {showFilter && file.filter && (
                  <Chip size="sm" variant="secondary">
                    <Chip.Label className="text-[10px]">{file.filter}</Chip.Label>
                  </Chip>
                )}
                {file.sourceFormat && (
                  <Chip size="sm" variant="secondary">
                    <Chip.Label className="text-[10px]">
                      {file.sourceFormat.toUpperCase()}
                    </Chip.Label>
                  </Chip>
                )}
                {(isVideo || isAudio) && (
                  <Chip size="sm" variant="secondary">
                    <Chip.Label className="text-[10px] font-semibold">
                      {isVideo ? "VIDEO" : "AUDIO"}
                    </Chip.Label>
                  </Chip>
                )}
                {showExposure && file.exptime != null && (
                  <Text className="text-[10px] text-muted">{file.exptime}s</Text>
                )}
              </View>
              {(isVideo || isAudio) && (
                <View className="mt-1 flex-row items-center gap-2">
                  {isVideo && !!videoResolution && (
                    <Text className="text-[9px] text-muted">{videoResolution}</Text>
                  )}
                  <Text className="text-[9px] text-muted">{mediaDuration}</Text>
                </View>
              )}
              {layout !== "compact" && (
                <Text className="mt-0.5 text-[9px] text-muted">
                  {formatImportDate(file.importDate)}
                </Text>
              )}
            </View>
            {selected && <Ionicons name="checkmark-circle" size={16} color={successColor} />}
            {!selected && file.isFavorite && (
              <Ionicons name="heart" size={16} color={successColor} />
            )}
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
