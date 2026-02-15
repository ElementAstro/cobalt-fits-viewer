import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Separator, Switch, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useOnboardingStore } from "../../stores/useOnboardingStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { useAstrometryStore } from "../../stores/useAstrometryStore";
import { useThumbnail } from "../../hooks/useThumbnail";
import { readFileAsArrayBuffer } from "../../lib/utils/fileManager";
import { loadFitsFromBuffer, getImagePixels, getImageDimensions } from "../../lib/fits/parser";
import { fitsToRGBA } from "../../lib/converter/formatConverter";
import { generateAndSaveThumbnail } from "../../lib/gallery/thumbnailCache";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { SettingsRow } from "../../components/common/SettingsRow";
import { SimpleSlider } from "../../components/common/SimpleSlider";
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
const HISTOGRAM_MODE_OPTIONS = [
  { label: "Linear", value: "linear" as const },
  { label: "Log", value: "log" as const },
  { label: "CDF", value: "cdf" as const },
];
const HISTOGRAM_HEIGHT_OPTIONS = [
  { label: "80px", value: 80 },
  { label: "100px", value: 100 },
  { label: "120px", value: 120 },
  { label: "150px", value: 150 },
  { label: "200px", value: 200 },
];
const PIXEL_DECIMAL_OPTIONS = [
  { label: "0", value: 0 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "6", value: 6 },
];
const GALLERY_SORT_BY_OPTIONS = [
  { label: "Name", value: "name" as const },
  { label: "Date", value: "date" as const },
  { label: "Size", value: "size" as const },
  { label: "Object", value: "object" as const },
  { label: "Filter", value: "filter" as const },
];
const GALLERY_SORT_ORDER_OPTIONS = [
  { label: "Ascending", value: "asc" as const },
  { label: "Descending", value: "desc" as const },
];
const STACK_METHOD_OPTIONS = [
  { label: "Average", value: "average" as const },
  { label: "Median", value: "median" as const },
  { label: "Sigma Clip", value: "sigma" as const },
  { label: "Min", value: "min" as const },
  { label: "Max", value: "max" as const },
  { label: "Winsorized", value: "winsorized" as const },
  { label: "Weighted", value: "weighted" as const },
];
const ALIGNMENT_MODE_OPTIONS = [
  { label: "None", value: "none" as const },
  { label: "Translation", value: "translation" as const },
  { label: "Full", value: "full" as const },
];
const DEBOUNCE_OPTIONS = [
  { label: "50ms", value: 50 },
  { label: "100ms", value: 100 },
  { label: "150ms", value: 150 },
  { label: "200ms", value: 200 },
  { label: "300ms", value: 300 },
  { label: "500ms", value: 500 },
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
  | "histogramMode"
  | "histogramHeight"
  | "pixelDecimals"
  | "gallerySortBy"
  | "gallerySortOrder"
  | "stackMethod"
  | "alignmentMode"
  | "debounce"
  | "fileListStyle"
  | "converterFormat"
  | "batchNamingRule"
  | "editorMaxUndo"
  | "timelineGrouping"
  | "targetSortBy"
  | "targetSortOrder"
  | "composePreset"
  | "orientation"
  | null;

const FILE_LIST_STYLE_OPTIONS = [
  { label: "Grid", value: "grid" as const },
  { label: "List", value: "list" as const },
  { label: "Compact", value: "compact" as const },
];

const CONVERTER_FORMAT_OPTIONS = [
  { label: "PNG", value: "png" as const },
  { label: "JPEG", value: "jpeg" as const },
  { label: "TIFF", value: "tiff" as const },
  { label: "WebP", value: "webp" as const },
];

const BATCH_NAMING_OPTIONS = [
  { label: "Original", value: "original" as const },
  { label: "Prefix", value: "prefix" as const },
  { label: "Suffix", value: "suffix" as const },
  { label: "Sequence", value: "sequence" as const },
];

const EDITOR_MAX_UNDO_OPTIONS = [
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
];

const TIMELINE_GROUPING_OPTIONS = [
  { label: "Day", value: "day" as const },
  { label: "Week", value: "week" as const },
  { label: "Month", value: "month" as const },
];

const TARGET_SORT_BY_OPTIONS = [
  { label: "Name", value: "name" as const },
  { label: "Date", value: "date" as const },
  { label: "Priority", value: "priority" as const },
];

const TARGET_SORT_ORDER_OPTIONS = [
  { label: "Ascending", value: "asc" as const },
  { label: "Descending", value: "desc" as const },
];

const COMPOSE_PRESET_OPTIONS = [
  { label: "RGB", value: "rgb" as const },
  { label: "SHO", value: "sho" as const },
  { label: "HOO", value: "hoo" as const },
  { label: "LRGB", value: "lrgb" as const },
  { label: "Custom", value: "custom" as const },
];

export default function SettingsScreen() {
  const { t } = useI18n();
  const { isLandscape } = useScreenOrientation();
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
  const orientationLock = useSettingsStore((s) => s.orientationLock);
  const setOrientationLock = useSettingsStore((s) => s.setOrientationLock);
  const fontFamilySetting = useSettingsStore((s) => s.fontFamily);
  const monoFontSetting = useSettingsStore((s) => s.monoFontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const setMonoFontFamily = useSettingsStore((s) => s.setMonoFontFamily);
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults);

  const defaultShowGrid = useSettingsStore((s) => s.defaultShowGrid);
  const defaultShowCrosshair = useSettingsStore((s) => s.defaultShowCrosshair);
  const defaultShowPixelInfo = useSettingsStore((s) => s.defaultShowPixelInfo);
  const defaultShowMinimap = useSettingsStore((s) => s.defaultShowMinimap);
  const setDefaultShowGrid = useSettingsStore((s) => s.setDefaultShowGrid);
  const setDefaultShowCrosshair = useSettingsStore((s) => s.setDefaultShowCrosshair);
  const setDefaultShowPixelInfo = useSettingsStore((s) => s.setDefaultShowPixelInfo);
  const setDefaultShowMinimap = useSettingsStore((s) => s.setDefaultShowMinimap);
  const defaultBlackPoint = useSettingsStore((s) => s.defaultBlackPoint);
  const defaultWhitePoint = useSettingsStore((s) => s.defaultWhitePoint);
  const defaultGamma = useSettingsStore((s) => s.defaultGamma);
  const setDefaultBlackPoint = useSettingsStore((s) => s.setDefaultBlackPoint);
  const setDefaultWhitePoint = useSettingsStore((s) => s.setDefaultWhitePoint);
  const setDefaultGamma = useSettingsStore((s) => s.setDefaultGamma);
  const defaultHistogramMode = useSettingsStore((s) => s.defaultHistogramMode);
  const histogramHeight = useSettingsStore((s) => s.histogramHeight);
  const setDefaultHistogramMode = useSettingsStore((s) => s.setDefaultHistogramMode);
  const setHistogramHeight = useSettingsStore((s) => s.setHistogramHeight);
  const pixelInfoDecimalPlaces = useSettingsStore((s) => s.pixelInfoDecimalPlaces);
  const setPixelInfoDecimalPlaces = useSettingsStore((s) => s.setPixelInfoDecimalPlaces);
  const defaultGallerySortBy = useSettingsStore((s) => s.defaultGallerySortBy);
  const defaultGallerySortOrder = useSettingsStore((s) => s.defaultGallerySortOrder);
  const setDefaultGallerySortBy = useSettingsStore((s) => s.setDefaultGallerySortBy);
  const setDefaultGallerySortOrder = useSettingsStore((s) => s.setDefaultGallerySortOrder);
  const defaultStackMethod = useSettingsStore((s) => s.defaultStackMethod);
  const defaultSigmaValue = useSettingsStore((s) => s.defaultSigmaValue);
  const defaultAlignmentMode = useSettingsStore((s) => s.defaultAlignmentMode);
  const defaultEnableQuality = useSettingsStore((s) => s.defaultEnableQuality);
  const setDefaultStackMethod = useSettingsStore((s) => s.setDefaultStackMethod);
  const setDefaultSigmaValue = useSettingsStore((s) => s.setDefaultSigmaValue);
  const setDefaultAlignmentMode = useSettingsStore((s) => s.setDefaultAlignmentMode);
  const setDefaultEnableQuality = useSettingsStore((s) => s.setDefaultEnableQuality);
  const imageProcessingDebounce = useSettingsStore((s) => s.imageProcessingDebounce);
  const useHighQualityPreview = useSettingsStore((s) => s.useHighQualityPreview);
  const setImageProcessingDebounce = useSettingsStore((s) => s.setImageProcessingDebounce);
  const setUseHighQualityPreview = useSettingsStore((s) => s.setUseHighQualityPreview);
  const gridColor = useSettingsStore((s) => s.gridColor);
  const gridOpacity = useSettingsStore((s) => s.gridOpacity);
  const crosshairColor = useSettingsStore((s) => s.crosshairColor);
  const crosshairOpacity = useSettingsStore((s) => s.crosshairOpacity);
  const setGridOpacity = useSettingsStore((s) => s.setGridOpacity);
  const setCrosshairOpacity = useSettingsStore((s) => s.setCrosshairOpacity);
  const canvasMinScale = useSettingsStore((s) => s.canvasMinScale);
  const canvasMaxScale = useSettingsStore((s) => s.canvasMaxScale);
  const canvasDoubleTapScale = useSettingsStore((s) => s.canvasDoubleTapScale);
  const setCanvasMinScale = useSettingsStore((s) => s.setCanvasMinScale);
  const setCanvasMaxScale = useSettingsStore((s) => s.setCanvasMaxScale);
  const setCanvasDoubleTapScale = useSettingsStore((s) => s.setCanvasDoubleTapScale);
  const thumbnailShowFilename = useSettingsStore((s) => s.thumbnailShowFilename);
  const thumbnailShowObject = useSettingsStore((s) => s.thumbnailShowObject);
  const thumbnailShowFilter = useSettingsStore((s) => s.thumbnailShowFilter);
  const thumbnailShowExposure = useSettingsStore((s) => s.thumbnailShowExposure);
  const setThumbnailShowFilename = useSettingsStore((s) => s.setThumbnailShowFilename);
  const setThumbnailShowObject = useSettingsStore((s) => s.setThumbnailShowObject);
  const setThumbnailShowFilter = useSettingsStore((s) => s.setThumbnailShowFilter);
  const setThumbnailShowExposure = useSettingsStore((s) => s.setThumbnailShowExposure);
  const fileListStyle = useSettingsStore((s) => s.fileListStyle);
  const setFileListStyle = useSettingsStore((s) => s.setFileListStyle);
  const defaultConverterFormat = useSettingsStore((s) => s.defaultConverterFormat);
  const defaultConverterQuality = useSettingsStore((s) => s.defaultConverterQuality);
  const batchNamingRule = useSettingsStore((s) => s.batchNamingRule);
  const setDefaultConverterFormat = useSettingsStore((s) => s.setDefaultConverterFormat);
  const setDefaultConverterQuality = useSettingsStore((s) => s.setDefaultConverterQuality);
  const setBatchNamingRule = useSettingsStore((s) => s.setBatchNamingRule);
  const defaultBlurSigma = useSettingsStore((s) => s.defaultBlurSigma);
  const defaultSharpenAmount = useSettingsStore((s) => s.defaultSharpenAmount);
  const defaultDenoiseRadius = useSettingsStore((s) => s.defaultDenoiseRadius);
  const editorMaxUndo = useSettingsStore((s) => s.editorMaxUndo);
  const setDefaultBlurSigma = useSettingsStore((s) => s.setDefaultBlurSigma);
  const setDefaultSharpenAmount = useSettingsStore((s) => s.setDefaultSharpenAmount);
  const setDefaultDenoiseRadius = useSettingsStore((s) => s.setDefaultDenoiseRadius);
  const setEditorMaxUndo = useSettingsStore((s) => s.setEditorMaxUndo);
  const timelineGrouping = useSettingsStore((s) => s.timelineGrouping);
  const setTimelineGrouping = useSettingsStore((s) => s.setTimelineGrouping);
  const sessionShowExposureCount = useSettingsStore((s) => s.sessionShowExposureCount);
  const sessionShowTotalExposure = useSettingsStore((s) => s.sessionShowTotalExposure);
  const sessionShowFilters = useSettingsStore((s) => s.sessionShowFilters);
  const setSessionShowExposureCount = useSettingsStore((s) => s.setSessionShowExposureCount);
  const setSessionShowTotalExposure = useSettingsStore((s) => s.setSessionShowTotalExposure);
  const setSessionShowFilters = useSettingsStore((s) => s.setSessionShowFilters);
  const targetSortBy = useSettingsStore((s) => s.targetSortBy);
  const targetSortOrder = useSettingsStore((s) => s.targetSortOrder);
  const setTargetSortBy = useSettingsStore((s) => s.setTargetSortBy);
  const setTargetSortOrder = useSettingsStore((s) => s.setTargetSortOrder);
  const defaultComposePreset = useSettingsStore((s) => s.defaultComposePreset);
  const composeRedWeight = useSettingsStore((s) => s.composeRedWeight);
  const composeGreenWeight = useSettingsStore((s) => s.composeGreenWeight);
  const composeBlueWeight = useSettingsStore((s) => s.composeBlueWeight);
  const setDefaultComposePreset = useSettingsStore((s) => s.setDefaultComposePreset);
  const setComposeRedWeight = useSettingsStore((s) => s.setComposeRedWeight);
  const setComposeGreenWeight = useSettingsStore((s) => s.setComposeGreenWeight);
  const setComposeBlueWeight = useSettingsStore((s) => s.setComposeBlueWeight);

  const lang = language === "zh" ? "zh" : "en";
  const { getFontFamily } = useFontFamily();

  const astrometryConfig = useAstrometryStore((s) => s.config);
  const astrometryJobs = useAstrometryStore((s) => s.jobs);
  const astrometryActiveJobs = astrometryJobs.filter(
    (j) =>
      j.status === "pending" ||
      j.status === "uploading" ||
      j.status === "submitted" ||
      j.status === "solving",
  );
  const astrometryStatusText =
    astrometryActiveJobs.length > 0
      ? `${astrometryActiveJobs.length} active`
      : astrometryConfig.apiKey
        ? t("astrometry.connected")
        : t("astrometry.disconnected");

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

  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);

  const handleRestartGuide = () => {
    Haptics.selectionAsync();
    Alert.alert(t("onboarding.restartGuide"), t("onboarding.restartGuideConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: () => {
          resetOnboarding();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName={`px-4 ${isLandscape ? "py-2" : "py-14"}`}
    >
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

      {/* Viewer Overlay Defaults */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.viewerOverlays")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="grid-outline"
            label={t("settings.defaultShowGrid")}
            rightElement={
              <Switch
                isSelected={defaultShowGrid}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setDefaultShowGrid(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="add-outline"
            label={t("settings.defaultShowCrosshair")}
            rightElement={
              <Switch
                isSelected={defaultShowCrosshair}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setDefaultShowCrosshair(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="information-circle-outline"
            label={t("settings.defaultShowPixelInfo")}
            rightElement={
              <Switch
                isSelected={defaultShowPixelInfo}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setDefaultShowPixelInfo(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="map-outline"
            label={t("settings.defaultShowMinimap")}
            rightElement={
              <Switch
                isSelected={defaultShowMinimap}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setDefaultShowMinimap(v);
                }}
              />
            }
          />
        </Card.Body>
      </Card>

      {/* Viewer Display Params */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.viewerDisplayParams")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="contrast-outline"
            label={t("settings.defaultBlackPoint")}
            value={defaultBlackPoint.toFixed(2)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultBlackPoint}
              min={0}
              max={0.5}
              step={0.01}
              onValueChange={setDefaultBlackPoint}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="sunny-outline"
            label={t("settings.defaultWhitePoint")}
            value={defaultWhitePoint.toFixed(2)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultWhitePoint}
              min={0.5}
              max={1}
              step={0.01}
              onValueChange={setDefaultWhitePoint}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="pulse-outline"
            label={t("settings.defaultGamma")}
            value={defaultGamma.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultGamma}
              min={0.1}
              max={5.0}
              step={0.1}
              onValueChange={setDefaultGamma}
            />
          </View>
        </Card.Body>
      </Card>

      {/* Grid & Crosshair Style */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.gridStyle")} & {t("settings.crosshairStyle")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="color-fill-outline"
            label={t("settings.gridColor")}
            value={gridColor}
          />
          <Separator />
          <SettingsRow
            icon="options-outline"
            label={t("settings.gridOpacity")}
            value={gridOpacity.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={gridOpacity}
              min={0.1}
              max={1.0}
              step={0.1}
              onValueChange={setGridOpacity}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="color-fill-outline"
            label={t("settings.crosshairColor")}
            value={crosshairColor}
          />
          <Separator />
          <SettingsRow
            icon="options-outline"
            label={t("settings.crosshairOpacity")}
            value={crosshairOpacity.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={crosshairOpacity}
              min={0.1}
              max={1.0}
              step={0.1}
              onValueChange={setCrosshairOpacity}
            />
          </View>
        </Card.Body>
      </Card>

      {/* Canvas Zoom */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.canvasZoom")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="remove-circle-outline"
            label={t("settings.canvasMinScale")}
            value={`${canvasMinScale}x`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasMinScale}
              min={0.1}
              max={1.0}
              step={0.1}
              onValueChange={setCanvasMinScale}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="add-circle-outline"
            label={t("settings.canvasMaxScale")}
            value={`${canvasMaxScale}x`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasMaxScale}
              min={5}
              max={30}
              step={1}
              onValueChange={setCanvasMaxScale}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="hand-left-outline"
            label={t("settings.canvasDoubleTapScale")}
            value={`${canvasDoubleTapScale}x`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasDoubleTapScale}
              min={2}
              max={10}
              step={1}
              onValueChange={setCanvasDoubleTapScale}
            />
          </View>
        </Card.Body>
      </Card>

      {/* Histogram & Pixel Info */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.histogramConfig")} & {t("settings.pixelInfoConfig")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="bar-chart-outline"
            label={t("settings.defaultHistogramMode")}
            value={defaultHistogramMode}
            onPress={() => setActivePicker("histogramMode")}
          />
          <Separator />
          <SettingsRow
            icon="resize-outline"
            label={t("settings.histogramHeight")}
            value={`${histogramHeight}px`}
            onPress={() => setActivePicker("histogramHeight")}
          />
          <Separator />
          <SettingsRow
            icon="calculator-outline"
            label={t("settings.pixelInfoDecimalPlaces")}
            value={`${pixelInfoDecimalPlaces}`}
            onPress={() => setActivePicker("pixelDecimals")}
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
          <Separator />
          <SettingsRow
            icon="swap-vertical-outline"
            label={t("settings.defaultGallerySortBy")}
            value={defaultGallerySortBy}
            onPress={() => setActivePicker("gallerySortBy")}
          />
          <Separator />
          <SettingsRow
            icon="arrow-up-outline"
            label={t("settings.defaultGallerySortOrder")}
            value={
              defaultGallerySortOrder === "asc" ? t("settings.sortAsc") : t("settings.sortDesc")
            }
            onPress={() => setActivePicker("gallerySortOrder")}
          />
          <Separator />
          <SettingsRow
            icon="list-outline"
            label={t("settings.fileListStyle")}
            value={
              fileListStyle === "grid"
                ? t("settings.fileListGrid")
                : fileListStyle === "list"
                  ? t("settings.fileListList")
                  : t("settings.fileListCompact")
            }
            onPress={() => setActivePicker("fileListStyle")}
          />
        </Card.Body>
      </Card>

      {/* Thumbnail Info */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.thumbnailInfo")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="document-text-outline"
            label={t("settings.thumbnailShowFilename")}
            rightElement={
              <Switch
                isSelected={thumbnailShowFilename}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
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
                  Haptics.selectionAsync();
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
                  Haptics.selectionAsync();
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
                  Haptics.selectionAsync();
                  setThumbnailShowExposure(v);
                }}
              />
            }
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

      {/* Converter Defaults */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.converterDefaults")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="image-outline"
            label={t("settings.defaultConverterFormat")}
            value={defaultConverterFormat.toUpperCase()}
            onPress={() => setActivePicker("converterFormat")}
          />
          <Separator />
          <SettingsRow
            icon="options-outline"
            label={t("settings.defaultConverterQuality")}
            value={`${defaultConverterQuality}%`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultConverterQuality}
              min={10}
              max={100}
              step={5}
              onValueChange={setDefaultConverterQuality}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="text-outline"
            label={t("settings.batchNamingRule")}
            value={
              batchNamingRule === "original"
                ? t("settings.namingOriginal")
                : batchNamingRule === "prefix"
                  ? t("settings.namingPrefix")
                  : batchNamingRule === "suffix"
                    ? t("settings.namingSuffix")
                    : t("settings.namingSequence")
            }
            onPress={() => setActivePicker("batchNamingRule")}
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

      {/* Editor Defaults */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.editorDefaults")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="water-outline"
            label={t("settings.defaultBlurSigma")}
            value={defaultBlurSigma.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultBlurSigma}
              min={0.5}
              max={10}
              step={0.5}
              onValueChange={setDefaultBlurSigma}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="sparkles-outline"
            label={t("settings.defaultSharpenAmount")}
            value={defaultSharpenAmount.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultSharpenAmount}
              min={0.5}
              max={5}
              step={0.5}
              onValueChange={setDefaultSharpenAmount}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="layers-outline"
            label={t("settings.defaultDenoiseRadius")}
            value={`${defaultDenoiseRadius}`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultDenoiseRadius}
              min={1}
              max={5}
              step={1}
              onValueChange={setDefaultDenoiseRadius}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="arrow-undo-outline"
            label={t("settings.editorMaxUndo")}
            value={`${editorMaxUndo}`}
            onPress={() => setActivePicker("editorMaxUndo")}
          />
        </Card.Body>
      </Card>

      {/* Timeline Grouping */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.timelineGrouping")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="time-outline"
            label={t("settings.timelineGrouping")}
            value={
              timelineGrouping === "day"
                ? t("settings.groupByDay")
                : timelineGrouping === "week"
                  ? t("settings.groupByWeek")
                  : t("settings.groupByMonth")
            }
            onPress={() => setActivePicker("timelineGrouping")}
          />
        </Card.Body>
      </Card>

      {/* Session Display Fields */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.sessionDisplayFields")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="camera-outline"
            label={t("settings.sessionShowExposureCount")}
            rightElement={
              <Switch
                isSelected={sessionShowExposureCount}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setSessionShowExposureCount(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="timer-outline"
            label={t("settings.sessionShowTotalExposure")}
            rightElement={
              <Switch
                isSelected={sessionShowTotalExposure}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setSessionShowTotalExposure(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="funnel-outline"
            label={t("settings.sessionShowFilters")}
            rightElement={
              <Switch
                isSelected={sessionShowFilters}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setSessionShowFilters(v);
                }}
              />
            }
          />
        </Card.Body>
      </Card>

      {/* Target Defaults */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.targetDefaults")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="swap-vertical-outline"
            label={t("settings.targetSortBy")}
            value={
              targetSortBy === "name"
                ? t("settings.targetSortName")
                : targetSortBy === "date"
                  ? t("settings.targetSortDate")
                  : t("settings.targetSortPriority")
            }
            onPress={() => setActivePicker("targetSortBy")}
          />
          <Separator />
          <SettingsRow
            icon="arrow-up-outline"
            label={t("settings.targetSortOrder")}
            value={targetSortOrder === "asc" ? t("settings.sortAsc") : t("settings.sortDesc")}
            onPress={() => setActivePicker("targetSortOrder")}
          />
        </Card.Body>
      </Card>

      {/* Compose Defaults */}
      <Text className="mt-3 mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.composeDefaults")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="color-palette-outline"
            label={t("settings.defaultComposePreset")}
            value={defaultComposePreset.toUpperCase()}
            onPress={() => setActivePicker("composePreset")}
          />
          <Separator />
          <SettingsRow
            icon="ellipse"
            label={t("settings.composeRedWeight")}
            value={composeRedWeight.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={composeRedWeight}
              min={0}
              max={2}
              step={0.1}
              onValueChange={setComposeRedWeight}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="ellipse"
            label={t("settings.composeGreenWeight")}
            value={composeGreenWeight.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={composeGreenWeight}
              min={0}
              max={2}
              step={0.1}
              onValueChange={setComposeGreenWeight}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="ellipse"
            label={t("settings.composeBlueWeight")}
            value={composeBlueWeight.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={composeBlueWeight}
              min={0}
              max={2}
              step={0.1}
              onValueChange={setComposeBlueWeight}
            />
          </View>
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
          <Separator />
          <SettingsRow
            icon="phone-landscape-outline"
            label={t("settings.orientation")}
            value={
              orientationLock === "portrait"
                ? t("settings.orientationPortrait")
                : orientationLock === "landscape"
                  ? t("settings.orientationLandscape")
                  : t("settings.orientationDefault")
            }
            onPress={() => setActivePicker("orientation")}
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

      {/* Stacking Defaults */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.stackingDefaults")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="layers-outline"
            label={t("settings.defaultStackMethod")}
            value={defaultStackMethod}
            onPress={() => setActivePicker("stackMethod")}
          />
          <Separator />
          <SettingsRow
            icon="cut-outline"
            label={t("settings.defaultSigmaValue")}
            value={defaultSigmaValue.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultSigmaValue}
              min={1.0}
              max={5.0}
              step={0.1}
              onValueChange={setDefaultSigmaValue}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="sync-outline"
            label={t("settings.defaultAlignmentMode")}
            value={defaultAlignmentMode}
            onPress={() => setActivePicker("alignmentMode")}
          />
          <Separator />
          <SettingsRow
            icon="checkmark-circle-outline"
            label={t("settings.defaultEnableQuality")}
            rightElement={
              <Switch
                isSelected={defaultEnableQuality}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setDefaultEnableQuality(v);
                }}
              />
            }
          />
        </Card.Body>
      </Card>

      <Separator className="my-4" />

      {/* Performance */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("settings.performance")}
      </Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          <SettingsRow
            icon="speedometer-outline"
            label={t("settings.imageProcessingDebounce")}
            value={`${imageProcessingDebounce}ms`}
            onPress={() => setActivePicker("debounce")}
          />
          <Separator />
          <SettingsRow
            icon="eye-outline"
            label={t("settings.useHighQualityPreview")}
            rightElement={
              <Switch
                isSelected={useHighQualityPreview}
                onSelectedChange={(v: boolean) => {
                  Haptics.selectionAsync();
                  setUseHighQualityPreview(v);
                }}
              />
            }
          />
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
          <Separator />
          <SettingsRow
            icon="planet-outline"
            label={t("astrometry.plateSolve")}
            value={astrometryStatusText}
            onPress={() => router.push("/astrometry")}
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

      {/* Restart Guide */}
      <Button
        variant="outline"
        className="rounded-xl"
        onPress={handleRestartGuide}
        accessibilityLabel={t("onboarding.restartGuide")}
      >
        <Ionicons name="book-outline" size={16} />
        <Button.Label>{t("onboarding.restartGuide")}</Button.Label>
      </Button>

      <View className="h-3" />

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
      <OptionPickerModal
        visible={activePicker === "histogramMode"}
        title={t("settings.defaultHistogramMode")}
        options={HISTOGRAM_MODE_OPTIONS}
        selectedValue={defaultHistogramMode}
        onSelect={setDefaultHistogramMode}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "histogramHeight"}
        title={t("settings.histogramHeight")}
        options={HISTOGRAM_HEIGHT_OPTIONS}
        selectedValue={histogramHeight}
        onSelect={setHistogramHeight}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "pixelDecimals"}
        title={t("settings.pixelInfoDecimalPlaces")}
        options={PIXEL_DECIMAL_OPTIONS}
        selectedValue={pixelInfoDecimalPlaces}
        onSelect={setPixelInfoDecimalPlaces}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "gallerySortBy"}
        title={t("settings.defaultGallerySortBy")}
        options={GALLERY_SORT_BY_OPTIONS}
        selectedValue={defaultGallerySortBy}
        onSelect={setDefaultGallerySortBy}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "gallerySortOrder"}
        title={t("settings.defaultGallerySortOrder")}
        options={GALLERY_SORT_ORDER_OPTIONS}
        selectedValue={defaultGallerySortOrder}
        onSelect={setDefaultGallerySortOrder}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "stackMethod"}
        title={t("settings.defaultStackMethod")}
        options={STACK_METHOD_OPTIONS}
        selectedValue={defaultStackMethod}
        onSelect={setDefaultStackMethod}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "alignmentMode"}
        title={t("settings.defaultAlignmentMode")}
        options={ALIGNMENT_MODE_OPTIONS}
        selectedValue={defaultAlignmentMode}
        onSelect={setDefaultAlignmentMode}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "debounce"}
        title={t("settings.imageProcessingDebounce")}
        options={DEBOUNCE_OPTIONS}
        selectedValue={imageProcessingDebounce}
        onSelect={setImageProcessingDebounce}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "fileListStyle"}
        title={t("settings.fileListStyle")}
        options={FILE_LIST_STYLE_OPTIONS}
        selectedValue={fileListStyle}
        onSelect={setFileListStyle}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "converterFormat"}
        title={t("settings.defaultConverterFormat")}
        options={CONVERTER_FORMAT_OPTIONS}
        selectedValue={defaultConverterFormat}
        onSelect={setDefaultConverterFormat}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "batchNamingRule"}
        title={t("settings.batchNamingRule")}
        options={BATCH_NAMING_OPTIONS}
        selectedValue={batchNamingRule}
        onSelect={setBatchNamingRule}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "editorMaxUndo"}
        title={t("settings.editorMaxUndo")}
        options={EDITOR_MAX_UNDO_OPTIONS}
        selectedValue={editorMaxUndo}
        onSelect={setEditorMaxUndo}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "timelineGrouping"}
        title={t("settings.timelineGrouping")}
        options={TIMELINE_GROUPING_OPTIONS}
        selectedValue={timelineGrouping}
        onSelect={setTimelineGrouping}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "targetSortBy"}
        title={t("settings.targetSortBy")}
        options={TARGET_SORT_BY_OPTIONS}
        selectedValue={targetSortBy}
        onSelect={setTargetSortBy}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "targetSortOrder"}
        title={t("settings.targetSortOrder")}
        options={TARGET_SORT_ORDER_OPTIONS}
        selectedValue={targetSortOrder}
        onSelect={setTargetSortOrder}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "composePreset"}
        title={t("settings.defaultComposePreset")}
        options={COMPOSE_PRESET_OPTIONS}
        selectedValue={defaultComposePreset}
        onSelect={setDefaultComposePreset}
        onClose={() => setActivePicker(null)}
      />
      <OptionPickerModal
        visible={activePicker === "orientation"}
        title={t("settings.orientation")}
        options={[
          { label: t("settings.orientationDefault"), value: "default" as const },
          { label: t("settings.orientationPortrait"), value: "portrait" as const },
          { label: t("settings.orientationLandscape"), value: "landscape" as const },
        ]}
        selectedValue={orientationLock}
        onSelect={setOrientationLock}
        onClose={() => setActivePicker(null)}
      />
    </ScrollView>
  );
}
