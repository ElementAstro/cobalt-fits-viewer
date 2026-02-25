/**
 * 高级搜索 Sheet
 */

import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
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
import {
  TARGET_TYPES,
  TARGET_STATUSES,
  targetTypeI18nKey,
  targetStatusI18nKey,
} from "../../lib/targets/targetConstants";

interface AdvancedSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (conditions: SearchConditions) => void;
  initialConditions?: SearchConditions;
  allCategories?: string[];
  allTags?: string[];
}

interface SearchFormState {
  query: string;
  raMin: string;
  raMax: string;
  decMin: string;
  decMax: string;
  selectedTypes: TargetType[];
  selectedStatuses: TargetStatus[];
  selectedCategories: string[];
  selectedTags: string[];
  isFavorite: boolean | undefined;
  hasCoordinates: boolean | undefined;
  hasImages: boolean | undefined;
  notesQuery: string;
}

const INITIAL_SEARCH_STATE: SearchFormState = {
  query: "",
  raMin: "",
  raMax: "",
  decMin: "",
  decMax: "",
  selectedTypes: [],
  selectedStatuses: [],
  selectedCategories: [],
  selectedTags: [],
  isFavorite: undefined,
  hasCoordinates: undefined,
  hasImages: undefined,
  notesQuery: "",
};

function buildFormFromConditions(c?: SearchConditions): SearchFormState {
  return {
    query: c?.query ?? "",
    raMin: c?.raMin?.toString() ?? "",
    raMax: c?.raMax?.toString() ?? "",
    decMin: c?.decMin?.toString() ?? "",
    decMax: c?.decMax?.toString() ?? "",
    selectedTypes: (c?.types as TargetType[]) ?? [],
    selectedStatuses: (c?.statuses as TargetStatus[]) ?? [],
    selectedCategories: c?.categories ?? [],
    selectedTags: c?.tags ?? [],
    isFavorite: c?.isFavorite,
    hasCoordinates: c?.hasCoordinates,
    hasImages: c?.hasImages,
    notesQuery: c?.notes ?? "",
  };
}

function toggleArrayItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

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

  const [form, setForm] = useState<SearchFormState>(() =>
    buildFormFromConditions(initialConditions),
  );

  const updateField = useCallback(
    <K extends keyof SearchFormState>(key: K, value: SearchFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  useEffect(() => {
    if (!visible) return;
    setForm(buildFormFromConditions(initialConditions));
  }, [visible, initialConditions]);

  const toggleType = (type: TargetType) =>
    updateField("selectedTypes", toggleArrayItem(form.selectedTypes, type));

  const toggleStatus = (status: TargetStatus) =>
    updateField("selectedStatuses", toggleArrayItem(form.selectedStatuses, status));

  const toggleCategory = (category: string) =>
    updateField("selectedCategories", toggleArrayItem(form.selectedCategories, category));

  const toggleTag = (tag: string) =>
    updateField("selectedTags", toggleArrayItem(form.selectedTags, tag));

  const handleSearch = useCallback(() => {
    const conditions: SearchConditions = {
      query: form.query.trim() || undefined,
      raMin: form.raMin ? parseFloat(form.raMin) : undefined,
      raMax: form.raMax ? parseFloat(form.raMax) : undefined,
      decMin: form.decMin ? parseFloat(form.decMin) : undefined,
      decMax: form.decMax ? parseFloat(form.decMax) : undefined,
      types: form.selectedTypes.length > 0 ? form.selectedTypes : undefined,
      statuses: form.selectedStatuses.length > 0 ? form.selectedStatuses : undefined,
      categories: form.selectedCategories.length > 0 ? form.selectedCategories : undefined,
      tags: form.selectedTags.length > 0 ? form.selectedTags : undefined,
      isFavorite: form.isFavorite,
      hasCoordinates: form.hasCoordinates,
      hasImages: form.hasImages,
      notes: form.notesQuery.trim() || undefined,
    };

    onSearch(conditions);
    onClose();
  }, [form, onClose, onSearch]);

  const handleReset = useCallback(() => {
    setForm(INITIAL_SEARCH_STATE);
  }, []);

  const hasFilters =
    form.query ||
    form.raMin ||
    form.raMax ||
    form.decMin ||
    form.decMax ||
    form.selectedTypes.length > 0 ||
    form.selectedStatuses.length > 0 ||
    form.selectedCategories.length > 0 ||
    form.selectedTags.length > 0 ||
    form.isFavorite !== undefined ||
    form.hasCoordinates !== undefined ||
    form.hasImages !== undefined ||
    form.notesQuery;

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          detached
          bottomInset={insets.bottom + 8}
          snapPoints={["78%", "96%"]}
          index={1}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enableContentPanningGesture={false}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          className="mx-4"
          backgroundClassName="rounded-[28px] bg-background"
          contentContainerClassName="h-full px-0"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 24,
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
                value={form.query}
                onChangeText={(v) => updateField("query", v)}
                autoCorrect={false}
              />
            </TextField>

            {/* 备注搜索 */}
            <TextField className="mt-4">
              <Label>{t("targets.search.notesSearch")}</Label>
              <Input
                placeholder={t("targets.notes")}
                value={form.notesQuery}
                onChangeText={(v) => updateField("notesQuery", v)}
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
                    value={form.raMin}
                    onChangeText={(v) => updateField("raMin", v)}
                    keyboardType="decimal-pad"
                  />
                </TextField>
              </View>
              <View className="flex-1">
                <TextField>
                  <Label className="text-xs">{t("targets.search.raMax")}</Label>
                  <Input
                    placeholder="360"
                    value={form.raMax}
                    onChangeText={(v) => updateField("raMax", v)}
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
                    value={form.decMin}
                    onChangeText={(v) => updateField("decMin", v)}
                    keyboardType="decimal-pad"
                  />
                </TextField>
              </View>
              <View className="flex-1">
                <TextField>
                  <Label className="text-xs">{t("targets.search.decMax")}</Label>
                  <Input
                    placeholder="90"
                    value={form.decMax}
                    onChangeText={(v) => updateField("decMax", v)}
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
                  variant={form.selectedTypes.includes(tt) ? "primary" : "secondary"}
                  onPress={() => toggleType(tt)}
                >
                  <Chip.Label className="text-[10px]">{t(targetTypeI18nKey(tt))}</Chip.Label>
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
                  variant={form.selectedStatuses.includes(s) ? "primary" : "secondary"}
                  onPress={() => toggleStatus(s)}
                >
                  <Chip.Label className="text-[10px]">{t(targetStatusI18nKey(s))}</Chip.Label>
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
                      variant={form.selectedCategories.includes(cat) ? "primary" : "secondary"}
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
                      variant={form.selectedTags.includes(tag) ? "primary" : "secondary"}
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
                variant={form.isFavorite === true ? "primary" : "outline"}
                onPress={() =>
                  updateField("isFavorite", form.isFavorite === true ? undefined : true)
                }
              >
                <Ionicons
                  name="star"
                  size={12}
                  color={form.isFavorite === true ? "#fff" : mutedColor}
                />
                <Button.Label>{t("targets.favorites")}</Button.Label>
              </Button>
              <Button
                size="sm"
                variant={form.hasCoordinates === true ? "primary" : "outline"}
                onPress={() =>
                  updateField("hasCoordinates", form.hasCoordinates === true ? undefined : true)
                }
              >
                <Ionicons
                  name="navigate"
                  size={12}
                  color={form.hasCoordinates === true ? "#fff" : mutedColor}
                />
                <Button.Label>{t("targets.coordinates")}</Button.Label>
              </Button>
              <Button
                size="sm"
                variant={form.hasImages === true ? "primary" : "outline"}
                onPress={() => updateField("hasImages", form.hasImages === true ? undefined : true)}
              >
                <Ionicons
                  name="images"
                  size={12}
                  color={form.hasImages === true ? "#fff" : mutedColor}
                />
                <Button.Label>{t("targets.frameCount")}</Button.Label>
              </Button>
            </View>

            <Separator className="my-4" />

            <View className="flex-row items-center justify-between gap-2">
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
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
