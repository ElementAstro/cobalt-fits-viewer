import { ScrollView, View } from "react-native";
import { Chip, Separator } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { FitsSortBy, FitsSortOrder } from "../../stores/useFitsStore";

const FILE_LIST_GRID_COLUMNS: Array<2 | 3 | 4> = [2, 3, 4];

const SORT_LABEL_KEYS: Record<FitsSortBy, string> = {
  name: "files.sortByName",
  date: "files.sortByDate",
  size: "files.sortBySize",
  quality: "gallery.quality",
};

interface FilesSortBarProps {
  sortBy: FitsSortBy;
  sortOrder: FitsSortOrder;
  fileListStyle: "grid" | "list" | "compact" | "folder";
  fileListGridColumns: 2 | 3 | 4;
  onSortToggle: (key: FitsSortBy) => void;
  onStyleChange: (style: "grid" | "list" | "compact" | "folder") => void;
  onGridColumnsChange: (cols: 2 | 3 | 4) => void;
}

export function FilesSortBar({
  sortBy,
  sortOrder,
  fileListStyle,
  fileListGridColumns,
  onSortToggle,
  onStyleChange,
  onGridColumnsChange,
}: FilesSortBarProps) {
  const { t } = useI18n();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row items-center gap-2">
        {(["name", "date", "size", "quality"] as const).map((key) => (
          <Chip
            key={key}
            size="sm"
            variant={sortBy === key ? "primary" : "secondary"}
            onPress={() => onSortToggle(key)}
          >
            <Chip.Label className="text-xs">
              {t(SORT_LABEL_KEYS[key])}
              {sortBy === key && (sortOrder === "asc" ? " ↑" : " ↓")}
            </Chip.Label>
          </Chip>
        ))}

        <Separator orientation="vertical" className="h-4" />

        {(["grid", "list", "compact", "folder"] as const).map((style) => (
          <Chip
            key={style}
            size="sm"
            variant={fileListStyle === style ? "primary" : "secondary"}
            onPress={() => onStyleChange(style)}
          >
            <Chip.Label className="text-xs">
              {style === "grid"
                ? t("settings.fileListGrid")
                : style === "list"
                  ? t("settings.fileListList")
                  : style === "compact"
                    ? t("settings.fileListCompact")
                    : t("files.folders")}
            </Chip.Label>
          </Chip>
        ))}

        {fileListStyle === "grid" && (
          <>
            <Separator orientation="vertical" className="h-4" />
            {FILE_LIST_GRID_COLUMNS.map((cols) => (
              <Chip
                key={`grid-cols-${cols}`}
                testID={`files-grid-columns-${cols}`}
                size="sm"
                variant={fileListGridColumns === cols ? "primary" : "secondary"}
                onPress={() => onGridColumnsChange(cols)}
              >
                <Chip.Label className="text-xs">{cols}</Chip.Label>
              </Chip>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}
