import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Separator, Switch } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { useSettingsPicker } from "../../hooks/useSettingsPicker";

const GRID_OPTIONS: Array<{ label: string; value: 2 | 3 | 4 }> = [
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
];
const THUMB_QUALITY_OPTIONS = [
  { label: "60%", value: 60 },
  { label: "80%", value: 80 },
  { label: "95%", value: 95 },
];
const THUMB_SIZE_OPTIONS = [
  { label: "128px", value: 128 },
  { label: "256px", value: 256 },
  { label: "512px", value: 512 },
];
const GALLERY_SORT_BY_VALUES = ["name", "date", "size", "object", "filter"] as const;
const GALLERY_SORT_ORDER_VALUES = ["asc", "desc"] as const;
const FILE_LIST_STYLE_VALUES = ["grid", "list", "compact"] as const;

export default function GallerySettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  // Gallery settings
  const gridColumns = useSettingsStore((s) => s.defaultGridColumns);
  const thumbnailQuality = useSettingsStore((s) => s.thumbnailQuality);
  const thumbnailSize = useSettingsStore((s) => s.thumbnailSize);
  const setGridColumns = useSettingsStore((s) => s.setDefaultGridColumns);
  const setThumbnailQuality = useSettingsStore((s) => s.setThumbnailQuality);
  const setThumbnailSize = useSettingsStore((s) => s.setThumbnailSize);

  // Sort settings
  const defaultGallerySortBy = useSettingsStore((s) => s.defaultGallerySortBy);
  const defaultGallerySortOrder = useSettingsStore((s) => s.defaultGallerySortOrder);
  const setDefaultGallerySortBy = useSettingsStore((s) => s.setDefaultGallerySortBy);
  const setDefaultGallerySortOrder = useSettingsStore((s) => s.setDefaultGallerySortOrder);

  // File list style
  const fileListStyle = useSettingsStore((s) => s.fileListStyle);
  const setFileListStyle = useSettingsStore((s) => s.setFileListStyle);

  // Thumbnail info display
  const thumbnailShowFilename = useSettingsStore((s) => s.thumbnailShowFilename);
  const thumbnailShowObject = useSettingsStore((s) => s.thumbnailShowObject);
  const thumbnailShowFilter = useSettingsStore((s) => s.thumbnailShowFilter);
  const thumbnailShowExposure = useSettingsStore((s) => s.thumbnailShowExposure);
  const setThumbnailShowFilename = useSettingsStore((s) => s.setThumbnailShowFilename);
  const setThumbnailShowObject = useSettingsStore((s) => s.setThumbnailShowObject);
  const setThumbnailShowFilter = useSettingsStore((s) => s.setThumbnailShowFilter);
  const setThumbnailShowExposure = useSettingsStore((s) => s.setThumbnailShowExposure);

  const gallerySortByLabel = (value: (typeof GALLERY_SORT_BY_VALUES)[number]) =>
    t(
      value === "name"
        ? "files.sortByName"
        : value === "date"
          ? "files.sortByDate"
          : value === "size"
            ? "files.sortBySize"
            : value === "object"
              ? "settings.sortByObject"
              : "settings.sortByFilter",
    );

  const gallerySortByOptions = GALLERY_SORT_BY_VALUES.map((value) => ({
    label: gallerySortByLabel(value),
    value,
  }));

  const gallerySortOrderOptions = GALLERY_SORT_ORDER_VALUES.map((value) => ({
    label: value === "asc" ? t("settings.sortAsc") : t("settings.sortDesc"),
    value,
  }));

  const fileListStyleOptions = FILE_LIST_STYLE_VALUES.map((value) => ({
    label:
      value === "grid"
        ? t("settings.fileListGrid")
        : value === "list"
          ? t("settings.fileListList")
          : t("settings.fileListCompact"),
    value,
  }));

  return (
    <View testID="e2e-screen-settings__gallery" className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-4">
          <Ionicons name="arrow-back" size={24} color="#888" onPress={() => router.back()} />
          <Text className="text-xl font-bold text-foreground">
            {t("settings.categories.gallery")}
          </Text>
        </View>

        {/* Grid & Thumbnails */}
        <SettingsSection title={t("settings.gallery")}>
          <SettingsRow
            testID="e2e-action-settings__gallery-open-grid-columns"
            icon="grid-outline"
            label={t("settings.gridColumns")}
            value={`${gridColumns}`}
            onPress={() => openPicker("gridColumns")}
          />
          <Separator />
          <SettingsRow
            icon="image-outline"
            label={t("settings.thumbnailQuality")}
            value={`${thumbnailQuality}%`}
            onPress={() => openPicker("thumbQuality")}
          />
          <Separator />
          <SettingsRow
            icon="resize-outline"
            label={t("settings.thumbnailSize")}
            value={`${thumbnailSize}px`}
            onPress={() => openPicker("thumbSize")}
          />
        </SettingsSection>

        {/* Sort Settings */}
        <SettingsSection title={t("settings.gallerySortConfig")}>
          <SettingsRow
            icon="swap-vertical-outline"
            label={t("settings.defaultGallerySortBy")}
            value={gallerySortByLabel(defaultGallerySortBy)}
            onPress={() => openPicker("gallerySortBy")}
          />
          <Separator />
          <SettingsRow
            icon="arrow-up-outline"
            label={t("settings.defaultGallerySortOrder")}
            value={
              defaultGallerySortOrder === "asc" ? t("settings.sortAsc") : t("settings.sortDesc")
            }
            onPress={() => openPicker("gallerySortOrder")}
          />
        </SettingsSection>

        {/* File List Style */}
        <SettingsSection title={t("settings.fileListStyle")}>
          <SettingsRow
            testID="e2e-action-settings__gallery-open-file-list-style"
            icon="list-outline"
            label={t("settings.fileListStyle")}
            value={
              fileListStyle === "grid"
                ? t("settings.fileListGrid")
                : fileListStyle === "list"
                  ? t("settings.fileListList")
                  : t("settings.fileListCompact")
            }
            onPress={() => openPicker("fileListStyle")}
          />
        </SettingsSection>

        {/* Thumbnail Info */}
        <SettingsSection title={t("settings.thumbnailInfo")}>
          <SettingsRow
            icon="document-text-outline"
            label={t("settings.thumbnailShowFilename")}
            rightElement={
              <Switch
                isSelected={thumbnailShowFilename}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setThumbnailShowFilename(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="telescope-outline"
            label={t("settings.thumbnailShowObject")}
            rightElement={
              <Switch
                isSelected={thumbnailShowObject}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setThumbnailShowObject(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="funnel-outline"
            label={t("settings.thumbnailShowFilter")}
            rightElement={
              <Switch
                isSelected={thumbnailShowFilter}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setThumbnailShowFilter(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="timer-outline"
            label={t("settings.thumbnailShowExposure")}
            rightElement={
              <Switch
                isSelected={thumbnailShowExposure}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setThumbnailShowExposure(v);
                }}
              />
            }
          />
        </SettingsSection>

        {/* Picker Modals */}
        <OptionPickerModal
          visible={activePicker === "gridColumns"}
          title={t("settings.gridColumns")}
          options={GRID_OPTIONS}
          selectedValue={gridColumns}
          onSelect={setGridColumns}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "thumbQuality"}
          title={t("settings.thumbnailQuality")}
          options={THUMB_QUALITY_OPTIONS}
          selectedValue={thumbnailQuality}
          onSelect={setThumbnailQuality}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "thumbSize"}
          title={t("settings.thumbnailSize")}
          options={THUMB_SIZE_OPTIONS}
          selectedValue={thumbnailSize}
          onSelect={setThumbnailSize}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "gallerySortBy"}
          title={t("settings.defaultGallerySortBy")}
          options={gallerySortByOptions}
          selectedValue={defaultGallerySortBy}
          onSelect={setDefaultGallerySortBy}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "gallerySortOrder"}
          title={t("settings.defaultGallerySortOrder")}
          options={gallerySortOrderOptions}
          selectedValue={defaultGallerySortOrder}
          onSelect={setDefaultGallerySortOrder}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "fileListStyle"}
          title={t("settings.fileListStyle")}
          options={fileListStyleOptions}
          selectedValue={fileListStyle}
          onSelect={setFileListStyle}
          onClose={closePicker}
        />
      </ScrollView>
    </View>
  );
}
