import { View, Text, TouchableOpacity, Image } from "react-native";
import { Card, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type { FitsMetadata } from "../../lib/fits/types";

interface FileListItemProps {
  file: FitsMetadata;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}

export function FileListItem({ file, onPress, onLongPress, selected = false }: FileListItemProps) {
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress}>
      <Card variant="secondary" className={selected ? "border border-success" : ""}>
        <Card.Body className="flex-row items-center gap-3 p-3">
          <View className="h-12 w-12 items-center justify-center rounded-lg bg-success/10 overflow-hidden">
            {file.thumbnailUri ? (
              <Image
                source={{ uri: file.thumbnailUri }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="image-outline" size={24} color={successColor} />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {file.filename}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              <Text className="text-[10px] text-muted">{formatSize(file.fileSize)}</Text>
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
          </View>
          {file.isFavorite && <Ionicons name="heart" size={16} color={successColor} />}
          <Ionicons name="chevron-forward" size={16} color={mutedColor} />
        </Card.Body>
      </Card>
    </TouchableOpacity>
  );
}
