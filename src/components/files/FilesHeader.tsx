import { View, Text } from "react-native";
import { Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { formatFileSize } from "../../lib/utils/fileManager";
import { SearchBar } from "../common/SearchBar";

interface FilesHeaderProps {
  displayCount: number;
  totalCount: number;
  storageSize: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLandscape: boolean;
}

export function FilesHeader({
  displayCount,
  totalCount,
  storageSize,
  searchQuery,
  onSearchChange,
  isLandscape,
}: FilesHeaderProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  return (
    <View className={isLandscape ? "gap-1.5" : "gap-3"}>
      <View className={isLandscape ? "flex-row items-baseline gap-2" : ""}>
        <Text
          className={
            isLandscape ? "text-lg font-bold text-foreground" : "text-2xl font-bold text-foreground"
          }
        >
          {t("files.title")}
        </Text>
        <Text className={isLandscape ? "text-xs text-muted" : "mt-1 text-sm text-muted"}>
          {isLandscape
            ? `(${displayCount}/${totalCount})`
            : `${t("files.subtitle")} (${displayCount}/${totalCount})`}
        </Text>
      </View>

      {totalCount > 0 && !isLandscape && (
        <View className="flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
          <Ionicons name="server-outline" size={14} color={mutedColor} />
          <Text className="text-xs text-muted">
            {t("files.storageUsed")}: {formatFileSize(storageSize)} ·{" "}
            {t("files.filesCount").replace("{count}", String(totalCount))}
          </Text>
        </View>
      )}

      <Separator />

      <SearchBar
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder={t("files.searchPlaceholder")}
        compact={isLandscape}
      />
    </View>
  );
}
