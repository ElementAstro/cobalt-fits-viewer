import { ScrollView, View } from "react-native";
import { Chip } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

const FILE_LIST_GRID_COLUMNS: Array<2 | 3 | 4> = [2, 3, 4];

interface FilesSortBarProps {
  sortBy: string;
  sortOrder: string;
  fileListStyle: string;
  fileListGridColumns: number;
  onSortToggle: (key: "name" | "date" | "size" | "quality") => void;
  onStyleChange: (style: "grid" | "list" | "compact") => void;
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
              {key === "quality"
                ? t("gallery.quality")
                : t(
                    `files.sortBy${key.charAt(0).toUpperCase() + key.slice(1)}` as
                      | "files.sortByName"
                      | "files.sortByDate"
                      | "files.sortBySize",
                  )}
              {sortBy === key && (sortOrder === "asc" ? " ↑" : " ↓")}
            </Chip.Label>
          </Chip>
        ))}

        <View className="h-4 w-px bg-separator" />

        {(["grid", "list", "compact"] as const).map((style) => (
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
                  : t("settings.fileListCompact")}
            </Chip.Label>
          </Chip>
        ))}

        {fileListStyle === "grid" && (
          <>
            <View className="h-4 w-px bg-separator" />
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
