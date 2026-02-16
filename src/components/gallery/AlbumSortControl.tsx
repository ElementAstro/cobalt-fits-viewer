/**
 * 相簿排序控制组件
 */

import { View, ScrollView } from "react-native";
import { Button, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { AlbumSortBy } from "../../stores/useAlbumStore";

interface AlbumSortControlProps {
  sortBy: AlbumSortBy;
  sortOrder: "asc" | "desc";
  onSortByChange: (sortBy: AlbumSortBy) => void;
  onSortOrderChange: (order: "asc" | "desc") => void;
  compact?: boolean;
}

export function AlbumSortControl({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  compact = false,
}: AlbumSortControlProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  const sortOptions: { key: AlbumSortBy; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "date", label: t("album.sortByDate") ?? "Date", icon: "calendar-outline" },
    { key: "name", label: t("album.sortByName") ?? "Name", icon: "text-outline" },
    { key: "imageCount", label: t("album.sortByCount") ?? "Count", icon: "images-outline" },
  ];

  if (compact) {
    return (
      <View className="flex-row items-center gap-1">
        {sortOptions.map((opt) => (
          <Button
            key={opt.key}
            size="sm"
            variant={sortBy === opt.key ? "secondary" : "ghost"}
            className={sortBy === opt.key ? "bg-success/20" : ""}
            onPress={() => onSortByChange(opt.key)}
          >
            <Ionicons
              name={opt.icon}
              size={12}
              color={sortBy === opt.key ? successColor : mutedColor}
            />
          </Button>
        ))}
        <View className="w-px h-4 bg-separator mx-1" />
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
        >
          <Ionicons
            name={sortOrder === "asc" ? "arrow-up-outline" : "arrow-down-outline"}
            size={14}
            color={mutedColor}
          />
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
        <View className="flex-row gap-1">
          {sortOptions.map((opt) => (
            <Chip
              key={opt.key}
              size="sm"
              variant={sortBy === opt.key ? "primary" : "secondary"}
              onPress={() => onSortByChange(opt.key)}
            >
              <Ionicons
                name={opt.icon}
                size={10}
                color={sortBy === opt.key ? "#fff" : mutedColor}
              />
              <Chip.Label className="text-[10px]">{opt.label}</Chip.Label>
            </Chip>
          ))}
        </View>
      </ScrollView>

      <Button
        size="sm"
        variant="outline"
        isIconOnly
        onPress={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
      >
        <Ionicons
          name={sortOrder === "asc" ? "arrow-up-outline" : "arrow-down-outline"}
          size={14}
          color={mutedColor}
        />
      </Button>
    </View>
  );
}
