import { View, Text, TouchableOpacity, Image } from "react-native";
import { useMemo } from "react";
import { Card, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useFitsStore } from "../../stores/useFitsStore";
import type { Album } from "../../lib/fits/types";

interface AlbumCardProps {
  album: Album;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function AlbumCard({ album, onPress, onLongPress }: AlbumCardProps) {
  const [_successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const getFileById = useFitsStore((s) => s.getFileById);

  const coverUri = useMemo(() => {
    const coverId = album.coverImageId ?? album.imageIds[0];
    if (!coverId) return undefined;
    return getFileById(coverId)?.thumbnailUri;
  }, [album.coverImageId, album.imageIds, getFileById]);

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress}>
      <Card variant="secondary" className="w-36">
        <Card.Body className="p-0">
          <View className="h-28 w-full items-center justify-center rounded-t-lg bg-surface-secondary overflow-hidden">
            {coverUri ? (
              <Image source={{ uri: coverUri }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Ionicons name="albums-outline" size={32} color={mutedColor} />
            )}
            {album.isSmart && (
              <View className="absolute top-1 right-1 rounded bg-success/80 px-1">
                <Ionicons name="sparkles" size={10} color="#fff" />
              </View>
            )}
          </View>
          <View className="p-2">
            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
              {album.name}
            </Text>
            <Text className="text-[9px] text-muted">{album.imageIds.length} images</Text>
          </View>
        </Card.Body>
      </Card>
    </TouchableOpacity>
  );
}
