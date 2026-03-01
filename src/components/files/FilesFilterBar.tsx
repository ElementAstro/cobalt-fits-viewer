import { useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { FileGroup } from "../../lib/fits/types";

interface FilesFilterBarProps {
  favoriteOnly: boolean;
  filterObject: string;
  filterFilter: string;
  filterSourceFormat: string;
  filterFrameType: string;
  filterTag: string;
  filterGroupId: string;
  activeFilterCount: number;
  objects: string[];
  filters: string[];
  sourceFormats: string[];
  frameFilters: string[];
  frameTypeLabels: Map<string, string>;
  tags: string[];
  fileGroups: FileGroup[];
  isLandscape: boolean;
  onFavoriteToggle: () => void;
  onObjectChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onSourceFormatChange: (value: string) => void;
  onFrameTypeChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onGroupChange: (value: string) => void;
  onClearFilters: () => void;
}

export function FilesFilterBar({
  favoriteOnly,
  filterObject,
  filterFilter,
  filterSourceFormat,
  filterFrameType,
  filterTag,
  filterGroupId,
  activeFilterCount,
  objects,
  filters,
  sourceFormats,
  frameFilters,
  frameTypeLabels,
  tags,
  fileGroups,
  isLandscape,
  onFavoriteToggle,
  onObjectChange,
  onFilterChange,
  onSourceFormatChange,
  onFrameTypeChange,
  onTagChange,
  onGroupChange,
  onClearFilters,
}: FilesFilterBarProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasAdvancedFilters = filters.length > 0 || frameFilters.length > 0 || tags.length > 0;

  return (
    <View className={isLandscape ? "gap-1" : "gap-2"}>
      {/* Primary filters: Favorite + Objects + Formats + Groups */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row items-center gap-2">
          <Chip
            size="sm"
            variant={favoriteOnly ? "primary" : "secondary"}
            onPress={onFavoriteToggle}
          >
            <Ionicons name="heart-outline" size={12} color={favoriteOnly ? "#fff" : mutedColor} />
            <Chip.Label className="text-xs">{t("gallery.favoritesOnly")}</Chip.Label>
          </Chip>
          {objects.map((objectValue) => (
            <Chip
              key={`obj-${objectValue}`}
              size="sm"
              variant={filterObject === objectValue ? "primary" : "secondary"}
              onPress={() => onObjectChange(objectValue)}
            >
              <Chip.Label className="text-xs">{objectValue}</Chip.Label>
            </Chip>
          ))}
          {sourceFormats.map((fmt) => (
            <Chip
              key={`fmt-${fmt}`}
              size="sm"
              variant={filterSourceFormat === fmt ? "primary" : "secondary"}
              onPress={() => onSourceFormatChange(fmt)}
            >
              <Chip.Label className="text-xs">{fmt.toUpperCase()}</Chip.Label>
            </Chip>
          ))}
          {fileGroups.map((group) => (
            <Chip
              key={`group-${group.id}`}
              size="sm"
              variant={filterGroupId === group.id ? "primary" : "secondary"}
              onPress={() => onGroupChange(group.id)}
            >
              <Chip.Label className="text-xs">{group.name}</Chip.Label>
            </Chip>
          ))}

          {hasAdvancedFilters && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <Chip
                size="sm"
                variant={showAdvanced ? "primary" : "secondary"}
                onPress={() => setShowAdvanced((prev) => !prev)}
              >
                <Ionicons
                  name={showAdvanced ? "chevron-up" : "chevron-down"}
                  size={10}
                  color={showAdvanced ? "#fff" : mutedColor}
                />
                <Chip.Label className="text-xs">{t("common.more")}</Chip.Label>
              </Chip>
            </>
          )}
        </View>
      </ScrollView>

      {/* Advanced filters: Filters + Frame Types + Tags */}
      {showAdvanced && hasAdvancedFilters && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row items-center gap-2">
            {filters.map((filterValue) => (
              <Chip
                key={`filter-${filterValue}`}
                size="sm"
                variant={filterFilter === filterValue ? "primary" : "secondary"}
                onPress={() => onFilterChange(filterValue)}
              >
                <Chip.Label className="text-xs">{filterValue}</Chip.Label>
              </Chip>
            ))}
            {frameFilters.map((frameType) => (
              <Chip
                key={`frame-${frameType}`}
                size="sm"
                variant={filterFrameType === frameType ? "primary" : "secondary"}
                onPress={() => onFrameTypeChange(frameType)}
              >
                <Chip.Label className="text-xs">
                  {frameTypeLabels.get(frameType) ?? frameType}
                </Chip.Label>
              </Chip>
            ))}
            {tags.map((tagValue) => (
              <Chip
                key={`tag-${tagValue}`}
                size="sm"
                variant={filterTag === tagValue ? "primary" : "secondary"}
                onPress={() => onTagChange(tagValue)}
              >
                <Chip.Label className="text-xs">#{tagValue}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      )}

      {activeFilterCount > 0 && (
        <View className="flex-row items-center justify-between rounded-lg bg-surface-secondary px-3 py-2">
          <Text className="text-xs text-muted">
            {activeFilterCount} {t("common.selected")}
          </Text>
          <Button size="sm" variant="ghost" onPress={onClearFilters}>
            <Button.Label>{t("targets.clearFilters")}</Button.Label>
          </Button>
        </View>
      )}

      <Separator />
    </View>
  );
}
