/**
 * 相簿排序控制组件
 */

import { View, Text } from "react-native";
import { Button, Chip, Popover, PressableFeedback, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { AlbumSortBy } from "../../stores/gallery/useAlbumStore";

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

  const currentLabel = sortOptions.find((o) => o.key === sortBy)?.label ?? "";

  return (
    <View className="flex-row items-center gap-1.5">
      <Popover>
        <Popover.Trigger asChild>
          <Button size="sm" variant="outline">
            <Ionicons name="swap-vertical-outline" size={14} color={mutedColor} />
            {!compact && <Button.Label className="text-xs">{currentLabel}</Button.Label>}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Overlay />
          <Popover.Content presentation="popover" width={200} className="p-2">
            <Popover.Title className="text-xs mb-2">{t("album.sortBy")}</Popover.Title>
            <View className="gap-1">
              {sortOptions.map((opt) => (
                <PressableFeedback key={opt.key} onPress={() => onSortByChange(opt.key)}>
                  <View
                    className={`flex-row items-center gap-2.5 rounded-lg px-3 py-2.5 ${
                      sortBy === opt.key ? "bg-success/10" : ""
                    }`}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={sortBy === opt.key ? successColor : mutedColor}
                    />
                    <Text
                      className={`text-sm flex-1 ${
                        sortBy === opt.key ? "font-semibold text-foreground" : "text-muted"
                      }`}
                    >
                      {opt.label}
                    </Text>
                    {sortBy === opt.key && (
                      <Ionicons name="checkmark" size={16} color={successColor} />
                    )}
                  </View>
                </PressableFeedback>
              ))}
            </View>
            <Separator className="my-2" />
            <PressableFeedback
              onPress={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
            >
              <View className="flex-row items-center gap-2.5 rounded-lg px-3 py-2.5">
                <Ionicons
                  name={sortOrder === "asc" ? "arrow-up-outline" : "arrow-down-outline"}
                  size={16}
                  color={mutedColor}
                />
                <Text className="text-sm text-muted flex-1">
                  {sortOrder === "asc" ? t("album.sortAsc") : t("album.sortDesc")}
                </Text>
                <Chip size="sm" variant="secondary">
                  <Chip.Label className="text-[10px]">
                    {sortOrder === "asc" ? "A→Z" : "Z→A"}
                  </Chip.Label>
                </Chip>
              </View>
            </PressableFeedback>
          </Popover.Content>
        </Popover.Portal>
      </Popover>

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
