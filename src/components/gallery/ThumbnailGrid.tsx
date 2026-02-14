import { View, Text, TouchableOpacity, Image } from "react-native";
import { useThemeColor } from "heroui-native";
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
}

export function ThumbnailGrid({
  files,
  columns = 3,
  selectionMode = false,
  selectedIds = [],
  onPress,
  onLongPress,
  onSelect,
}: ThumbnailGridProps) {
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const itemWidth = `${Math.floor(100 / columns) - 2}%` as const;

  return (
    <View className="flex-row flex-wrap gap-2">
      {files.map((file) => {
        const isSelected = selectedIds.includes(file.id);
        return (
          <TouchableOpacity
            key={file.id}
            style={{ width: itemWidth, aspectRatio: 1 }}
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
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="image-outline" size={28} color={mutedColor} />
              )}

              {/* Overlay info */}
              <View className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1">
                <Text className="text-[8px] text-white" numberOfLines={1}>
                  {file.filename}
                </Text>
              </View>

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
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
