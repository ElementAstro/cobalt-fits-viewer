/**
 * 高级搜索 Sheet
 */

import { useState } from "react";
import { View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  BottomSheet,
  Button,
  Chip,
  Input,
  Label,
  Separator,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import type { TargetType, TargetStatus } from "../../lib/fits/types";
import type { SearchConditions } from "../../lib/targets/targetSearch";

interface AdvancedSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (conditions: SearchConditions) => void;
  initialConditions?: SearchConditions;
  allCategories?: string[];
  allTags?: string[];
}

const TARGET_TYPES: TargetType[] = [
  "galaxy",
  "nebula",
  "cluster",
  "planet",
  "moon",
  "sun",
  "comet",
  "other",
];

const TARGET_STATUSES: TargetStatus[] = ["planned", "acquiring", "completed", "processed"];

export function AdvancedSearchSheet({
  visible,
  onClose,
  onSearch,
  initialConditions,
  allCategories = [],
  allTags = [],
}: AdvancedSearchSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const insets = useSafeAreaInsets();

  // 搜索条件状态
  const [query, setQuery] = useState(initialConditions?.query ?? "");
  const [raMin, setRaMin] = useState(initialConditions?.raMin?.toString() ?? "");
  const [raMax, setRaMax] = useState(initialConditions?.raMax?.toString() ?? "");
  const [decMin, setDecMin] = useState(initialConditions?.decMin?.toString() ?? "");
  const [decMax, setDecMax] = useState(initialConditions?.decMax?.toString() ?? "");
  const [selectedTypes, setSelectedTypes] = useState<TargetType[]>(
    (initialConditions?.types as TargetType[]) ?? [],
  );
  const [selectedStatuses, setSelectedStatuses] = useState<TargetStatus[]>(
    (initialConditions?.statuses as TargetStatus[]) ?? [],
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialConditions?.categories ?? [],
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(initialConditions?.tags ?? []);
  const [isFavorite, setIsFavorite] = useState<boolean | undefined>(initialConditions?.isFavorite);
  const [hasCoordinates, setHasCoordinates] = useState<boolean | undefined>(
    initialConditions?.hasCoordinates,
  );
  const [hasImages, setHasImages] = useState<boolean | undefined>(initialConditions?.hasImages);
  const [notesQuery, setNotesQuery] = useState(initialConditions?.notes ?? "");

  const toggleType = (type: TargetType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const toggleStatus = (status: TargetStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSearch = () => {
    const conditions: SearchConditions = {
      query: query.trim() || undefined,
      raMin: raMin ? parseFloat(raMin) : undefined,
      raMax: raMax ? parseFloat(raMax) : undefined,
      decMin: decMin ? parseFloat(decMin) : undefined,
      decMax: decMax ? parseFloat(decMax) : undefined,
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      isFavorite,
      hasCoordinates,
      hasImages,
      notes: notesQuery.trim() || undefined,
    };

    onSearch(conditions);
    onClose();
  };

  const handleReset = () => {
    setQuery("");
    setRaMin("");
    setRaMax("");
    setDecMin("");
    setDecMax("");
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSelectedCategories([]);
    setSelectedTags([]);
    setIsFavorite(undefined);
    setHasCoordinates(undefined);
    setHasImages(undefined);
    setNotesQuery("");
  };

  const hasFilters =
    query ||
    raMin ||
    raMax ||
    decMin ||
    decMax ||
    selectedTypes.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedCategories.length > 0 ||
    selectedTags.length > 0 ||
    isFavorite !== undefined ||
    hasCoordinates !== undefined ||
    hasImages !== undefined ||
    notesQuery;

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          detached
          bottomInset={insets.bottom + 8}
          snapPoints={["92%"]}
          className="mx-4"
          backgroundClassName="rounded-[28px] bg-background"
        >
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 20,
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <BottomSheet.Title>{t("targets.search.title")}</BottomSheet.Title>
              <BottomSheet.Close />
            </View>

            {/* 文本搜索 */}
            <TextField>
              <Label>{t("common.search")}</Label>
              <Input
                placeholder={t("targets.searchPlaceholder")}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />
            </TextField>

            {/* 备注搜索 */}
            <TextField className="mt-4">
              <Label>{t("targets.search.notesSearch")}</Label>
              <Input
                placeholder={t("targets.notes")}
                value={notesQuery}
                onChangeText={setNotesQuery}
                autoCorrect={false}
              />
            </TextField>

            <Separator className="my-4" />

            {/* 坐标范围 */}
            <Label className="mb-2">{t("targets.search.coordinateRange")}</Label>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <TextField>
                  <Label className="text-xs">{t("targets.search.raMin")}</Label>
                  <Input
                    placeholder="0"
                    value={raMin}
                    onChangeText={setRaMin}
                    keyboardType="decimal-pad"
                  />
                </TextField>
              </View>
              <View className="flex-1">
                <TextField>
                  <Label className="text-xs">{t("targets.search.raMax")}</Label>
                  <Input
                    placeholder="360"
                    value={raMax}
                    onChangeText={setRaMax}
                    keyboardType="decimal-pad"
                  />
                </TextField>
              </View>
            </View>
            <View className="flex-row gap-2 mt-2">
              <View className="flex-1">
                <TextField>
                  <Label className="text-xs">{t("targets.search.decMin")}</Label>
                  <Input
                    placeholder="-90"
                    value={decMin}
                    onChangeText={setDecMin}
                    keyboardType="decimal-pad"
                  />
                </TextField>
              </View>
              <View className="flex-1">
                <TextField>
                  <Label className="text-xs">{t("targets.search.decMax")}</Label>
                  <Input
                    placeholder="90"
                    value={decMax}
                    onChangeText={setDecMax}
                    keyboardType="decimal-pad"
                  />
                </TextField>
              </View>
            </View>

            <Separator className="my-4" />

            {/* 类型筛选 */}
            <Label className="mb-2">{t("targets.type")}</Label>
            <View className="flex-row flex-wrap gap-1.5 mb-4">
              {TARGET_TYPES.map((tt) => (
                <Chip
                  key={tt}
                  size="sm"
                  variant={selectedTypes.includes(tt) ? "primary" : "secondary"}
                  onPress={() => toggleType(tt)}
                >
                  <Chip.Label className="text-[10px]">
                    {t(
                      `targets.types.${tt}` as
                        | "targets.types.galaxy"
                        | "targets.types.nebula"
                        | "targets.types.cluster"
                        | "targets.types.planet"
                        | "targets.types.moon"
                        | "targets.types.sun"
                        | "targets.types.comet"
                        | "targets.types.other",
                    )}
                  </Chip.Label>
                </Chip>
              ))}
            </View>

            {/* 状态筛选 */}
            <Label className="mb-2">{t("targets.status")}</Label>
            <View className="flex-row flex-wrap gap-1.5 mb-4">
              {TARGET_STATUSES.map((s) => (
                <Chip
                  key={s}
                  size="sm"
                  variant={selectedStatuses.includes(s) ? "primary" : "secondary"}
                  onPress={() => toggleStatus(s)}
                >
                  <Chip.Label className="text-[10px]">
                    {t(
                      `targets.${s}` as
                        | "targets.planned"
                        | "targets.acquiring"
                        | "targets.completed"
                        | "targets.processed",
                    )}
                  </Chip.Label>
                </Chip>
              ))}
            </View>

            {/* 分类筛选 */}
            {allCategories.length > 0 && (
              <>
                <Label className="mb-2">{t("targets.category")}</Label>
                <View className="flex-row flex-wrap gap-1.5 mb-4">
                  {allCategories.map((cat) => (
                    <Chip
                      key={cat}
                      size="sm"
                      variant={selectedCategories.includes(cat) ? "primary" : "secondary"}
                      onPress={() => toggleCategory(cat)}
                    >
                      <Chip.Label className="text-[10px]">{cat}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </>
            )}

            {/* 标签筛选 */}
            {allTags.length > 0 && (
              <>
                <Label className="mb-2">{t("targets.tags")}</Label>
                <View className="flex-row flex-wrap gap-1.5 mb-4">
                  {allTags.slice(0, 8).map((tag) => (
                    <Chip
                      key={tag}
                      size="sm"
                      variant={selectedTags.includes(tag) ? "primary" : "secondary"}
                      onPress={() => toggleTag(tag)}
                    >
                      <Chip.Label className="text-[10px]">{tag}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </>
            )}

            <Separator className="my-4" />

            {/* 快捷筛选 */}
            <Label className="mb-2">{t("gallery.filterBy")}</Label>
            <View className="flex-row flex-wrap gap-2">
              <Button
                size="sm"
                variant={isFavorite === true ? "primary" : "outline"}
                onPress={() => setIsFavorite(isFavorite === true ? undefined : true)}
              >
                <Ionicons name="star" size={12} color={isFavorite === true ? "#fff" : mutedColor} />
                <Button.Label>{t("targets.favorites")}</Button.Label>
              </Button>
              <Button
                size="sm"
                variant={hasCoordinates === true ? "primary" : "outline"}
                onPress={() => setHasCoordinates(hasCoordinates === true ? undefined : true)}
              >
                <Ionicons
                  name="navigate"
                  size={12}
                  color={hasCoordinates === true ? "#fff" : mutedColor}
                />
                <Button.Label>{t("targets.coordinates")}</Button.Label>
              </Button>
              <Button
                size="sm"
                variant={hasImages === true ? "primary" : "outline"}
                onPress={() => setHasImages(hasImages === true ? undefined : true)}
              >
                <Ionicons
                  name="images"
                  size={12}
                  color={hasImages === true ? "#fff" : mutedColor}
                />
                <Button.Label>{t("targets.frameCount")}</Button.Label>
              </Button>
            </View>

            <Separator className="my-4" />

            {/* 操作按钮 */}
            <View className="flex-row justify-between">
              <Button variant="ghost" onPress={handleReset} isDisabled={!hasFilters}>
                <Button.Label>{t("targets.clearFilters")}</Button.Label>
              </Button>
              <View className="flex-row gap-2">
                <Button variant="outline" onPress={onClose}>
                  <Button.Label>{t("common.cancel")}</Button.Label>
                </Button>
                <Button variant="primary" onPress={handleSearch}>
                  <Button.Label>{t("common.search")}</Button.Label>
                </Button>
              </View>
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
