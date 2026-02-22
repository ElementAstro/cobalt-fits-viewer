import { useCallback } from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useI18n } from "../../i18n/useI18n";
import { FileListItem } from "../gallery/FileListItem";
import { ThumbnailGrid } from "../gallery/ThumbnailGrid";
import { EmptyState } from "../common/EmptyState";
import type { FitsMetadata } from "../../lib/fits/types";
import type { ReactElement } from "react";

const ListItemSeparator = () => <View className="h-2" />;

interface FilesContentProps {
  displayFiles: FitsMetadata[];
  searchQuery: string;
  activeFilterCount: number;
  fileListStyle: "grid" | "list" | "compact";
  isGridStyle: boolean;
  listColumns: number;
  isSelectionMode: boolean;
  selectedIds: string[];
  selectedIdSet: Set<string>;
  horizontalPadding: number;
  contentPaddingTop: number;
  isLandscape: boolean;
  thumbShowFilename: boolean;
  thumbShowObject: boolean;
  thumbShowFilter: boolean;
  thumbShowExposure: boolean;
  ListHeader: ReactElement;
  onFilePress: (file: FitsMetadata) => void;
  onFileLongPress: (file: FitsMetadata) => void;
  onToggleSelection: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onSingleDelete: (id: string) => void;
  onImport: () => void;
  onClearFilters: () => void;
}

export function FilesContent({
  displayFiles,
  searchQuery,
  activeFilterCount,
  fileListStyle,
  isGridStyle,
  listColumns,
  isSelectionMode,
  selectedIds,
  selectedIdSet,
  horizontalPadding,
  contentPaddingTop,
  isLandscape,
  thumbShowFilename,
  thumbShowObject,
  thumbShowFilter,
  thumbShowExposure,
  ListHeader,
  onFilePress,
  onFileLongPress,
  onToggleSelection,
  onToggleFavorite,
  onSingleDelete,
  onImport,
  onClearFilters,
}: FilesContentProps) {
  const { t } = useI18n();

  const renderFileItem = useCallback(
    ({ item }: { item: FitsMetadata }) => {
      return (
        <FileListItem
          file={item}
          layout={fileListStyle}
          selected={selectedIdSet.has(item.id)}
          showFilename={thumbShowFilename}
          showObject={thumbShowObject}
          showFilter={thumbShowFilter}
          showExposure={thumbShowExposure}
          onPress={() => onFilePress(item)}
          onLongPress={() => onFileLongPress(item)}
          onToggleFavorite={() => onToggleFavorite(item.id)}
          onDelete={() => onSingleDelete(item.id)}
        />
      );
    },
    [
      fileListStyle,
      selectedIdSet,
      thumbShowFilename,
      thumbShowObject,
      thumbShowFilter,
      thumbShowExposure,
      onFilePress,
      onFileLongPress,
      onToggleFavorite,
      onSingleDelete,
    ],
  );

  const keyExtractor = useCallback((item: FitsMetadata) => item.id, []);

  if (displayFiles.length === 0 && !searchQuery && activeFilterCount === 0) {
    return (
      <View
        className="flex-1"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
      >
        {ListHeader}
        <EmptyState
          icon="telescope-outline"
          title={t("files.emptyState")}
          description={t("files.emptyHint")}
          actionLabel={t("files.importFile")}
          onAction={onImport}
        />
      </View>
    );
  }

  if (isGridStyle) {
    return (
      <View
        className="flex-1"
        style={{
          paddingHorizontal: horizontalPadding,
          paddingTop: isLandscape ? 8 : contentPaddingTop,
        }}
      >
        {displayFiles.length === 0 ? (
          <View className="flex-1">
            {ListHeader}
            <EmptyState
              icon="search-outline"
              title={t("files.noSupportedFound")}
              secondaryLabel={activeFilterCount > 0 ? t("targets.clearFilters") : undefined}
              onSecondaryAction={activeFilterCount > 0 ? onClearFilters : undefined}
            />
          </View>
        ) : (
          <ThumbnailGrid
            files={displayFiles}
            columns={listColumns}
            selectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onPress={onFilePress}
            onLongPress={onFileLongPress}
            onSelect={onToggleSelection}
            ListHeaderComponent={ListHeader}
            showFilename={thumbShowFilename}
            showObject={thumbShowObject}
            showFilter={thumbShowFilter}
            showExposure={thumbShowExposure}
          />
        )}
      </View>
    );
  }

  return (
    <FlashList
      data={displayFiles}
      renderItem={renderFileItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <EmptyState
          icon="search-outline"
          title={t("files.noSupportedFound")}
          secondaryLabel={activeFilterCount > 0 ? t("targets.clearFilters") : undefined}
          onSecondaryAction={activeFilterCount > 0 ? onClearFilters : undefined}
        />
      }
      contentContainerStyle={{
        paddingHorizontal: horizontalPadding,
        paddingTop: isLandscape ? 8 : contentPaddingTop,
        paddingBottom: 24,
      }}
      ItemSeparatorComponent={ListItemSeparator}
      showsVerticalScrollIndicator={false}
    />
  );
}
