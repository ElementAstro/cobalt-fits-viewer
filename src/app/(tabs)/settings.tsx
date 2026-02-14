import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Separator, Switch, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { useThumbnail } from "../../hooks/useThumbnail";
import { readFileAsArrayBuffer } from "../../lib/utils/fileManager";
import { loadFitsFromBuffer, getImagePixels, getImageDimensions } from "../../lib/fits/parser";
import { fitsToRGBA } from "../../lib/converter/formatConverter";
import { generateAndSaveThumbnail } from "../../lib/gallery/thumbnailCache";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { SettingsRow } from "../../components/common/SettingsRow";
import { UpdateChecker } from "../../components/common/UpdateChecker";
import { SystemInfoCard } from "../../components/common/SystemInfoCard";
import { LogViewer } from "../../components/common/LogViewer";
import { formatBytes } from "../../lib/utils/format";
import type { StretchType, ColormapType, ExportFormat } from "../../lib/fits/types";
import {
  ACCENT_PRESETS,
  ACCENT_COLOR_KEYS,
  STYLE_PRESETS,
  STYLE_PRESET_KEYS,
  type AccentColorKey,
  type StylePresetKey,
} from "../../lib/theme/presets";
import {
  FONT_FAMILY_PRESETS,
  FONT_FAMILY_KEYS,
  MONO_FONT_PRESETS,
  MONO_FONT_KEYS,
} from "../../lib/theme/fonts";
import { useFontFamily } from "../../components/common/FontProvider";

const STRETCHES: StretchType[] = ["linear", "log", "sqrt", "asinh", "zscale"];
const COLORMAPS: ColormapType[] = ["grayscale", "heat", "cool", "viridis", "plasma", "inferno"];
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
const SESSION_GAP_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
  { label: "120 min", value: 120 },
  { label: "240 min", value: 240 },
  { label: "480 min", value: 480 },
];
const REMINDER_OPTIONS = [
  { label: "None", value: 0 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
  { label: "120 min", value: 120 },
];
const EXPORT_FORMAT_OPTIONS: Array<{ label: string; value: ExportFormat }> = [
  { label: "PNG", value: "png" },
  { label: "JPEG", value: "jpeg" },
  { label: "WebP", value: "webp" },
  { label: "TIFF", value: "tiff" },
  { label: "BMP", value: "bmp" },
];

type PickerType =
  | "stretch"
  | "colormap"
  | "gridColumns"
  | "thumbQuality"
  | "thumbSize"
  | "sessionGap"
  | "exportFormat"
  | "theme"
  | "language"
  | "fontFamily"
  | "monoFont"
  | "reminder"
  | null;

export default function SettingsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const _dangerColor = useThemeColor("danger");

  const [activePicker, setActivePicker] = useState<PickerType>(null);

  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const defaultStretch = useSettingsStore((s) => s.defaultStretch);
  const defaultColormap = useSettingsStore((s) => s.defaultColormap);
  const gridColumns = useSettingsStore((s) => s.defaultGridColumns);
  const thumbnailQuality = useSettingsStore((s) => s.thumbnailQuality);
  const thumbnailSize = useSettingsStore((s) => s.thumbnailSize);
  const defaultExportFormat = useSettingsStore((s) => s.defaultExportFormat);
  const autoGroupByObject = useSettingsStore((s) => s.autoGroupByObject);
  const sessionGapMinutes = useSettingsStore((s) => s.sessionGapMinutes);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const activePreset = useSettingsStore((s) => s.activePreset);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setDefaultStretch = useSettingsStore((s) => s.setDefaultStretch);
  const setDefaultColormap = useSettingsStore((s) => s.setDefaultColormap);
  const setGridColumns = useSettingsStore((s) => s.setDefaultGridColumns);
  const setThumbnailQuality = useSettingsStore((s) => s.setThumbnailQuality);
  const setThumbnailSize = useSettingsStore((s) => s.setThumbnailSize);
  const setDefaultExportFormat = useSettingsStore((s) => s.setDefaultExportFormat);
  const setAutoGroupByObject = useSettingsStore((s) => s.setAutoGroupByObject);
  const autoTagLocation = useSettingsStore((s) => s.autoTagLocation);
  const setAutoTagLocation = useSettingsStore((s) => s.setAutoTagLocation);
  const calendarSyncEnabled = useSettingsStore((s) => s.calendarSyncEnabled);
  const defaultReminderMinutes = useSettingsStore((s) => s.defaultReminderMinutes);
  const setCalendarSyncEnabled = useSettingsStore((s) => s.setCalendarSyncEnabled);
  const setDefaultReminderMinutes = useSettingsStore((s) => s.setDefaultReminderMinutes);
  const setSessionGapMinutes = useSettingsStore((s) => s.setSessionGapMinutes);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const setActivePreset = useSettingsStore((s) => s.setActivePreset);
  const fontFamilySetting = useSettingsStore((s) => s.fontFamily);
  const monoFontSetting = useSettingsStore((s) => s.monoFontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const setMonoFontFamily = useSettingsStore((s) => s.setMonoFontFamily);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);
  const lang = language === "zh" ? "zh" : "en";
  const { getFontFamily } = useFontFamily();

  const allFiles = useFitsStore((s) => s.files);
  const updateFile = useFitsStore((s) => s.updateFile);
  const filesCount = allFiles.length;
  const { clearCache, getCacheSize } = useThumbnail();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const formatCacheSize = useCallback(() => {
    return formatBytes(getCacheSize());
  }, [getCacheSize]);

  const handleClearCache = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t("settings.clearCache"), t("settings.clearCacheConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => {
          clearCache();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t("common.success"), t("settings.cacheCleared"));
        },
      },
    ]);
  };

  const handleRegenerateThumbnails = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t("settings.regenerateThumbnails"), t("settings.regenerateConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: async () => {
          setIsRegenerating(true);
          let success = 0;
          let skipped = 0;

          for (const file of allFiles) {
            try {
              const buffer = await readFileAsArrayBuffer(file.filepath);
              const fitsObj = loadFitsFromBuffer(buffer);
              const dims = getImageDimensions(fitsObj);
              if (!dims) {
                skipped++;
                continue;
              }
              const pixels = await getImagePixels(fitsObj);
              if (!pixels) {
                skipped++;
                continue;
              }
              const rgba = fitsToRGBA(pixels, dims.width, dims.height, {
                stretch: "asinh",
                colormap: "grayscale",
                blackPoint: 0,
                whitePoint: 1,
                gamma: 1,
              });
              const thumbUri = generateAndSaveThumbnail(
                file.id,
                rgba,
                dims.width,
                dims.height,
                thumbnailSize,
                thumbnailQuality,
              );
              if (thumbUri) {
                updateFile(file.id, { thumbnailUri: thumbUri });
                success++;
              } else {
                skipped++;
              }
            } catch {
              skipped++;
            }
          }

          setIsRegenerating(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            t("settings.regenerateDone"),
            t("settings.regenerateResult")
              .replace("{success}", String(success))
              .replace("{skipped}", String(skipped)),
          );
        },
      },
    ]);
  };

  const handleResetAll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t("settings.resetAll"), t("settings.resetAllConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => {
          resetToDefaults();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(t("common.success"), t("settings.resetAllDone"));
        },
      },
    ]);
  };

  const themeLabel =
    theme === "dark"
      ? t("settings.darkMode")
      : theme === "light"
        ? t("settings.lightMode")
        : t("settings.systemMode");

  const stretchOptions = STRETCHES.map((s) => ({ label: s, value: s }));
  const colormapOptions = COLORMAPS.map((c) => ({ label: c, value: c }));
  const themeOptions = [
    { label: t("settings.darkMode"), value: "dark" as const },
    { label: t("settings.lightMode"), value: "light" as const },
    { label: t("settings.systemMode"), value: "system" as const },
  ];
  const languageOptions = [
    { label: "English", value: "en" as const },
    { label: "中文", value: "zh" as const },
  ];
  const fontFamilyOptions = FONT_FAMILY_KEYS.map((key) => ({
    label: FONT_FAMILY_PRESETS[key].label[lang],
    value: key,
  }));
  const monoFontOptions = MONO_FONT_KEYS.map((key) => ({
    label: MONO_FONT_PRESETS[key].label[lang],
    value: key,
  }));

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-14">
      <Text className="text-2xl font-bold text-foreground">{t("settings.title")}</Text>

      <Separator className="my-4" />

      {/* Viewer Defaults */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.viewer")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="resize-outline"
            label={t("viewer.stretch")}
            value={defaultStretch}
            onPress={() => setActivePicker("stretch")}
          />
          <Separator />
          <SettingsRow
            icon="color-palette-outline"
            label={t("viewer.colormap")}
            value={defaultColormap}
            onPress={() => setActivePicker("colormap")}
          />
        </Card.Body>
      </Card>

      <Separator className="my-4" />

      {/* Gallery */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.gallery")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="grid-outline"
            label={t("settings.gridColumns")}
            value={`${gridColumns}`}
            onPress={() => setActivePicker("gridColumns")}
          />
          <Separator />
          <SettingsRow
            icon="image-outline"
            label={t("settings.thumbnailQuality")}
            value={`${thumbnailQuality}%`}
            onPress={() => setActivePicker("thumbQuality")}
          />
          <Separator />
          <SettingsRow
            icon="resize-outline"
            label={t("settings.thumbnailSize")}
            value={`${thumbnailSize}px`}
            onPress={() => setActivePicker("thumbSize")}
          />
        </Card.Body>
      </Card>

      <Separator className="my-4" />

      {/* Export & Convert */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.export")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="download-outline"
            label={t("settings.defaultExportFormat")}
            value={defaultExportFormat.toUpperCase()}
            onPress={() => setActivePicker("exportFormat")}
          />
        </Card.Body>
      </Card>

      <Separator className="my-4" />

      {/* Targets & Sessions */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.targets")} & {t("settings.sessions")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="telescope-outline"
            label={t("settings.autoGroupByObject")}
            rightElement={
              <Switch
                isSelected={autoGroupByObject}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setAutoGroupByObject(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="location-outline"
            label={t("location.autoTag")}
            rightElement={
              <Switch
                isSelected={autoTagLocation}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setAutoTagLocation(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="time-outline"
            label={t("settings.sessionGap")}
            value={`${sessionGapMinutes} min`}
            onPress={() => setActivePicker("sessionGap")}
          />
          <Separator />
          <SettingsRow
            icon="calendar-outline"
            label={t("settings.calendarSync")}
            rightElement={
              <Switch
                isSelected={calendarSyncEnabled}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setCalendarSyncEnabled(v);
                }}
              />
            }
          />
          {calendarSyncEnabled && (
            <>
              <Separator />
              <SettingsRow
                icon="notifications-outline"
                label={t("settings.defaultReminder")}
                value={
                  defaultReminderMinutes === 0
                    ? t("sessions.noReminder")
                    : `${defaultReminderMinutes} min`
                }
                onPress={() => setActivePicker("reminder")}
              />
            </>
          )}
        </Card.Body>
      </Card>

      <Separator className="my-4" />

      {/* Display */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.display")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="language-outline"
            label={t("settings.language")}
            value={language === "zh" ? "中文" : "English"}
            onPress={() => setActivePicker("language")}
          />
          <Separator />
          <SettingsRow
            icon="moon-outline"
            label={t("settings.theme")}
            value={themeLabel}
            onPress={() => setActivePicker("theme")}
          />
          <Separator />
          <SettingsRow
            icon="text-outline"
            label={t("settings.fontFamily")}
            value={FONT_FAMILY_PRESETS[fontFamilySetting].label[lang]}
            onPress={() => setActivePicker("fontFamily")}
          />
          <Separator />
          <SettingsRow
            icon="code-outline"
            label={t("settings.monoFont")}
            value={MONO_FONT_PRESETS[monoFontSetting].label[lang]}
            onPress={() => setActivePicker("monoFont")}
          />
        </Card.Body>
      </Card>

      {/* Font Preview */}
      {fontFamilySetting !== "system" && (
        <View className="mt-2 rounded-lg bg-surface-secondary px-4 py-3">
          <Text
            className="text-sm text-foreground"
            style={{ fontFamily: getFontFamily("regular") }}
          >
            {t("settings.fontPreview")}
          </Text>
        </View>
      )}

      <Separator className="my-4" />

      {/* Accent Color */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.accentColor")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-3">
          <View className="flex-row flex-wrap gap-3">
            {ACCENT_COLOR_KEYS.map((key: AccentColorKey) => {
              const preset = ACCENT_PRESETS[key];
              const isActive = accentColor === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAccentColor(isActive ? null : key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={preset.label[lang]}
                >
                  <View className="items-center gap-1">
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: preset.swatch,
                        borderWidth: isActive ? 3 : 0,
                        borderColor: isActive ? "#fff" : "transparent",
                      }}
                    >
                      {isActive && (
                        <View className="flex-1 items-center justify-center">
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text className="text-[10px] text-muted">{preset.label[lang]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card.Body>
      </Card>

      <Separator className="my-4" />

      {/* Style Presets */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.stylePreset")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-3">
          <View className="flex-row flex-wrap gap-3">
            {STYLE_PRESET_KEYS.map((key: StylePresetKey) => {
              const preset = STYLE_PRESETS[key];
              const isActive = activePreset === key && !accentColor;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActivePreset(key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isActive }}
                  accessibilityLabel={preset.label[lang]}
                >
                  <View className="items-center gap-1">
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: preset.swatch,
                        borderWidth: isActive ? 3 : 0,
                        borderColor: isActive ? "#fff" : "transparent",
                      }}
                    >
                      {isActive && (
                        <View className="flex-1 items-center justify-center">
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text className="text-[10px] text-muted">{preset.label[lang]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card.Body>
      </Card>

      <Separator className="my-4" />

      {/* Storage */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.storage")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="server-outline"
            label={t("settings.storageUsage")}
            value={`${filesCount} ${language === "zh" ? "个文件" : "files"}`}
          />
          <Separator />
          <SettingsRow
            icon="folder-outline"
            label={t("settings.cacheSize")}
            value={formatCacheSize()}
          />
          <Separator />
          <SettingsRow
            icon="trash-outline"
            label={t("settings.clearCache")}
            onPress={handleClearCache}
          />
          <Separator />
          <SettingsRow
            icon="refresh-outline"
            label={t("settings.regenerateThumbnails")}
            onPress={handleRegenerateThumbnails}
            disabled={isRegenerating || filesCount === 0}
          />
          <Separator />
          <SettingsRow
            icon="cloud-upload-outline"
            label={t("settings.backup")}
            onPress={() => router.push("/backup")}
          />
        </Card.Body>
      </Card>

      <Separator className="my-4" />

      {/* About & Updates */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">{t("settings.about")}</Text>
      <UpdateChecker />

      <Separator className="my-4" />

      {/* System Info */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("systemInfo.title")}
      </Text>
      <SystemInfoCard />

      <Separator className="my-4" />

      {/* App Logs */}
      <LogViewer />

      <Separator className="my-4" />

      {/* Reset */}
      <Button
        variant="danger-soft"
        className="rounded-xl"
        onPress={handleResetAll}
        accessibilityLabel={t("settings.resetAll")}
      >
        <Button.Label>{t("settings.resetAll")}</Button.Label>
      </Button>

      <View className="h-8" />

      {/* Option Picker Modals */}
      <OptionPickerModal
        visible={activePicker === "stretch"}
        title={t("viewer.stretch")}
        options={stretchOptions}
        selectedValue={defaultStretch}
        onSelect={setDefaultStretch}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "colormap"}
        title={t("viewer.colormap")}
        options={colormapOptions}
        selectedValue={defaultColormap}
        onSelect={setDefaultColormap}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "gridColumns"}
        title={t("settings.gridColumns")}
        options={GRID_OPTIONS}
        selectedValue={gridColumns}
        onSelect={setGridColumns}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "thumbQuality"}
        title={t("settings.thumbnailQuality")}
        options={THUMB_QUALITY_OPTIONS}
        selectedValue={thumbnailQuality}
        onSelect={setThumbnailQuality}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "thumbSize"}
        title={t("settings.thumbnailSize")}
        options={THUMB_SIZE_OPTIONS}
        selectedValue={thumbnailSize}
        onSelect={setThumbnailSize}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "sessionGap"}
        title={t("settings.sessionGap")}
        options={SESSION_GAP_OPTIONS}
        selectedValue={sessionGapMinutes}
        onSelect={setSessionGapMinutes}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "exportFormat"}
        title={t("settings.defaultExportFormat")}
        options={EXPORT_FORMAT_OPTIONS}
        selectedValue={defaultExportFormat}
        onSelect={setDefaultExportFormat}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "theme"}
        title={t("settings.theme")}
        options={themeOptions}
        selectedValue={theme}
        onSelect={setTheme}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "language"}
        title={t("settings.language")}
        options={languageOptions}
        selectedValue={language}
        onSelect={setLanguage}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "fontFamily"}
        title={t("settings.fontFamily")}
        options={fontFamilyOptions}
        selectedValue={fontFamilySetting}
        onSelect={setFontFamily}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "monoFont"}
        title={t("settings.monoFont")}
        options={monoFontOptions}
        selectedValue={monoFontSetting}
        onSelect={setMonoFontFamily}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "reminder"}
        title={t("settings.defaultReminder")}
        options={REMINDER_OPTIONS}
        selectedValue={defaultReminderMinutes}
        onSelect={setDefaultReminderMinutes}
        onClose={() => setActivePicker(null)}
      />
    </ScrollView>
  );
}
