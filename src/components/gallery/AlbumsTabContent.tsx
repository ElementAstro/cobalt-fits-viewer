import { memo, useCallback } from "react";
import { View, Text } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/common/useResponsiveLayout";
import { SearchBar } from "../common/SearchBar";
import { AlbumCard } from "./AlbumCard";
import { AlbumSortControl } from "./AlbumSortControl";
import { EmptyState } from "../common/EmptyState";
import type { Album } from "../../lib/fits/types";
import type { AlbumSortBy } from "../../stores/gallery/useAlbumStore";

interface AlbumsTabContentProps {
  albums: Album[];
  searchQuery: string;
  sortBy: AlbumSortBy;
  sortOrder: "asc" | "desc";
  onSearchChange: (query: string) => void;
  onSortByChange: (sortBy: AlbumSortBy) => void;
  onSortOrderChange: (order: "asc" | "desc") => void;
  onAlbumPress: (album: Album) => void;
  onAlbumAction: (album: Album) => void;
  onCreateAlbum: () => void;
  onCreateSmartAlbum: () => void;
  onFindDuplicates: () => void;
}

export const AlbumsTabContent = memo(function AlbumsTabContent({
  albums,
  searchQuery,
  sortBy,
  sortOrder,
  onSearchChange,
  onSortByChange,
  onSortOrderChange,
  onAlbumPress,
  onAlbumAction,
  onCreateAlbum,
  onCreateSmartAlbum,
  onFindDuplicates,
}: AlbumsTabContentProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const { isLandscape, isLandscapeTablet } = useResponsiveLayout();

  const albumGridColumns = isLandscapeTablet ? 4 : isLandscape ? 3 : 2;

  const renderAlbumItem = useCallback(
    ({ item }: { item: Album }) => (
      <View className="flex-1 p-1">
        <AlbumCard
          album={item}
          layout="grid"
          onPress={() => onAlbumPress(item)}
          onLongPress={() => onAlbumAction(item)}
          onActionPress={() => onAlbumAction(item)}
        />
      </View>
    ),
    [onAlbumPress, onAlbumAction],
  );

  const keyExtractor = useCallback((item: Album) => item.id, []);

  const listHeader = (
    <View className="gap-3 px-1 mb-2">
      <View className="flex-row items-center justify-between mb-1">
        <Text
          className={
            isLandscape
              ? "text-sm font-semibold text-foreground"
              : "text-base font-semibold text-foreground"
          }
        >
          {t("gallery.albums")} ({albums.length})
        </Text>
        <View className="flex-row gap-1.5">
          <Button size="sm" variant="ghost" isIconOnly onPress={onFindDuplicates}>
            <Ionicons name="copy-outline" size={14} color={mutedColor} />
          </Button>
          <Button size="sm" variant="outline" onPress={onCreateSmartAlbum}>
            <Ionicons name="sparkles-outline" size={14} color={successColor} />
          </Button>
          <Button
            testID="e2e-action-tabs__gallery-open-create-album"
            size="sm"
            variant="outline"
            onPress={onCreateAlbum}
          >
            <Ionicons name="add-outline" size={14} color={mutedColor} />
            {!isLandscape && (
              <Button.Label className="text-xs">{t("gallery.createAlbum")}</Button.Label>
            )}
          </Button>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <SearchBar value={searchQuery} onChangeText={onSearchChange} compact={isLandscape} />
        </View>
        <AlbumSortControl
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortByChange={(v) => onSortByChange(v as AlbumSortBy)}
          onSortOrderChange={onSortOrderChange}
          compact={isLandscape}
        />
      </View>
    </View>
  );

  const emptyComponent = (
    <EmptyState
      icon="albums-outline"
      title={t("album.noAlbums")}
      description={t("album.createFirst")}
      actionLabel={t("gallery.createAlbum")}
      onAction={onCreateAlbum}
    />
  );

  return (
    <FlashList
      data={albums}
      renderItem={renderAlbumItem}
      keyExtractor={keyExtractor}
      numColumns={albumGridColumns}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={emptyComponent}
      showsVerticalScrollIndicator={false}
    />
  );
});
