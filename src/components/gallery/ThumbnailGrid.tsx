import { memo, useCallback, useMemo } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Skeleton, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";
import { formatVideoDuration, formatVideoResolution } from "../../lib/video/format";
import type { FitsMetadata } from "../../lib/fits/types";

interface ThumbnailGridProps {
  files: FitsMetadata[];
  columns?: number;
  selectionMode?: boolean;
  selectedIds?: string[];
  onPress?: (file: FitsMetadata) => void;
  onLongPress?: (file: FitsMetadata) => void;
  onSelect?: (fileId: string) => void;
  scrollEnabled?: boolean;
  ListHeaderComponent?: React.ReactElement | null;
  showFilename?: boolean;
  showObject?: boolean;
  showFilter?: boolean;
  showExposure?: boolean;
}

const ThumbnailItem = memo(function ThumbnailItem({
  file,
  size,
  isSelected,
  selectionMode,
  onPress,
  onLongPress,
  onSelect,
  successColor,
  mutedColor,
  showFilename = true,
  showObject = false,
  showFilter = true,
  showExposure = false,
}: {
  file: FitsMetadata;
  size: number;
  isSelected: boolean;
  selectionMode: boolean;
  onPress?: (file: FitsMetadata) => void;
  onLongPress?: (file: FitsMetadata) => void;
  onSelect?: (fileId: string) => void;
  successColor: string;
  mutedColor: string;
  showFilename?: boolean;
  showObject?: boolean;
  showFilter?: boolean;
  showExposure?: boolean;
}) {
  const thumbnailUri = useMemo(
    () => resolveThumbnailUri(file.id, file.thumbnailUri),
    [file.id, file.thumbnailUri],
  );
  const isVideo = file.mediaKind === "video" || file.sourceType === "video";
  const duration = formatVideoDuration(file.durationMs);
  const resolution = formatVideoResolution(file.videoWidth, file.videoHeight);

  return (
    <Pressable
      style={{ width: size, height: size, padding: 3 }}
      onPress={() => {
        if (selectionMode && onSelect) {
          onSelect(file.id);
        } else {
          onPress?.(file);
        }
      }}
      onLongPress={() => onLongPress?.(file)}
    >
      <View
        className={`h-full w-full items-center justify-center rounded-lg bg-surface-secondary overflow-hidden ${
          isSelected ? "border-2 border-success" : ""
        }`}
      >
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={file.id}
            transition={200}
          />
        ) : (
          <Skeleton className="h-full w-full rounded-lg">
            <View className="h-full w-full items-center justify-center">
              <Ionicons name="image-outline" size={28} color={mutedColor} />
            </View>
          </Skeleton>
        )}

        {isVideo && (
          <>
            <View className="absolute right-1 top-1 rounded-full bg-black/60 p-1">
              <Ionicons name="play" size={10} color="#fff" />
            </View>
            <View className="absolute left-1 bottom-1 rounded-md bg-black/70 px-1 py-0.5">
              <Text className="text-[8px] font-semibold text-white">{duration}</Text>
            </View>
          </>
        )}

        {/* Overlay info */}
        {(showFilename || showObject || showFilter || showExposure) && (
          <View className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1">
            {showFilename && (
              <Text className="text-[8px] text-white" numberOfLines={1}>
                {file.filename}
              </Text>
            )}
            {(showObject || showFilter || showExposure) && (
              <Text className="text-[7px] text-white/70" numberOfLines={1}>
                {[
                  showObject && file.object,
                  showFilter && file.filter,
                  showExposure && file.exptime != null && `${file.exptime}s`,
                  isVideo && "VIDEO",
                  isVideo && resolution,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            )}
          </View>
        )}

        {/* Favorite badge */}
        {file.isFavorite && (
          <View className="absolute top-1 right-1">
            <Ionicons name="heart" size={12} color={successColor} />
          </View>
        )}

        {/* Selection checkbox */}
        {selectionMode && (
          <View className="absolute top-1 left-1">
            <Ionicons
              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
              size={18}
              color={isSelected ? successColor : "white"}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
});

export function ThumbnailGrid({
  files,
  columns = 3,
  selectionMode = false,
  selectedIds = [],
  onPress,
  onLongPress,
  onSelect,
  scrollEnabled = true,
  ListHeaderComponent,
  showFilename = true,
  showObject = false,
  showFilter = true,
  showExposure = false,
}: ThumbnailGridProps) {
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscapeGrid = screenWidth > screenHeight;
  const gridPadding = isLandscapeGrid ? 16 : 32;
  const itemSize = Math.floor((screenWidth - gridPadding) / columns);

  const renderItem = useCallback(
    ({ item }: { item: FitsMetadata }) => (
      <ThumbnailItem
        file={item}
        size={itemSize}
        isSelected={selectedIds.includes(item.id)}
        selectionMode={selectionMode}
        onPress={onPress}
        onLongPress={onLongPress}
        onSelect={onSelect}
        successColor={successColor}
        mutedColor={mutedColor}
        showFilename={showFilename}
        showObject={showObject}
        showFilter={showFilter}
        showExposure={showExposure}
      />
    ),
    [
      itemSize,
      selectedIds,
      selectionMode,
      onPress,
      onLongPress,
      onSelect,
      successColor,
      mutedColor,
      showFilename,
      showObject,
      showFilter,
      showExposure,
    ],
  );

  const keyExtractor = useCallback((item: FitsMetadata) => item.id, []);

  return (
    <FlashList
      data={files}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={columns}
      drawDistance={itemSize * 3}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
      extraData={selectedIds}
    />
  );
}
