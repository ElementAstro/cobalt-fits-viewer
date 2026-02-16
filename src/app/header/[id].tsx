import { View, Text, ScrollView } from "react-native";
import { useState, useEffect, useMemo } from "react";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";
import { useFitsFile } from "../../hooks/useFitsFile";
import { HeaderTable } from "../../components/fits/HeaderTable";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { HEADER_GROUP_KEYS } from "../../lib/fits/types";
import type { HeaderGroup } from "../../lib/fits/types";

const GROUPS: { key: HeaderGroup | "all"; labelKey: string }[] = [
  { key: "all", labelKey: "header.allKeywords" },
  { key: "observation", labelKey: "header.observation" },
  { key: "instrument", labelKey: "header.instrumentGroup" },
  { key: "image", labelKey: "header.imageInfo" },
  { key: "wcs", labelKey: "header.wcs" },
  { key: "processing", labelKey: "header.processing" },
];

export default function HeaderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const file = useFitsStore((s) => s.getFileById(id ?? ""));

  const { headers, isLoading, loadFromPath } = useFitsFile();

  const [selectedGroup, setSelectedGroup] = useState<HeaderGroup | "all">("all");

  useEffect(() => {
    if (file) loadFromPath(file.filepath, file.filename, file.fileSize);
  }, [file, loadFromPath]);

  const filteredHeaders = useMemo(() => {
    if (selectedGroup === "all") return headers;
    const groupKeys = HEADER_GROUP_KEYS[selectedGroup] ?? [];
    return headers.filter((kw) => groupKeys.includes(kw.key));
  }, [headers, selectedGroup]);

  if (!file) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Ionicons name="alert-circle-outline" size={48} color={mutedColor} />
        <Text className="mt-4 text-sm text-muted">{t("common.noData")}</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>{t("common.goHome")}</Button.Label>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <LoadingOverlay visible={isLoading} />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-14">
        {/* Top Bar */}
        <View className="flex-row items-center gap-3 mb-4">
          <Button size="sm" variant="outline" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={mutedColor} />
          </Button>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{t("header.title")}</Text>
            <Text className="text-xs text-muted" numberOfLines={1}>
              {file.filename}
            </Text>
          </View>
          <Text className="text-[10px] text-muted">{headers.length} keywords</Text>
        </View>

        <Separator className="mb-4" />

        {/* Header Group Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {GROUPS.map((group) => (
              <Chip
                key={group.key}
                size="sm"
                variant={selectedGroup === group.key ? "primary" : "secondary"}
                onPress={() => setSelectedGroup(group.key)}
              >
                <Chip.Label className="text-[10px]">
                  {t(group.labelKey as Parameters<typeof t>[0])}
                </Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>

        {/* Header Table */}
        {file.sourceType === "raster" && headers.length === 0 ? (
          <View className="rounded-lg bg-surface-secondary px-3 py-4">
            <Text className="text-xs text-muted">{t("header.noHeaderForFormat")}</Text>
          </View>
        ) : (
          <HeaderTable keywords={filteredHeaders} />
        )}
      </ScrollView>
    </View>
  );
}
