import { memo, useCallback } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Skeleton, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
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
        {file.thumbnailUri ? (
          <Image
            source={{ uri: file.thumbnailUri }}
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
