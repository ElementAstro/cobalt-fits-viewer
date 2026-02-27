import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Share, View, Text, ScrollView } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Accordion,
  Button,
  Card,
  Chip,
  Input,
  PressableFeedback,
  Separator,
  Switch,
  useThemeColor,
} from "heroui-native";
import { SettingsHeader } from "../../components/settings";
import { SettingsToggleRow } from "../../components/common/SettingsToggleRow";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useSavedThemesStore, MAX_SAVED_THEMES } from "../../stores/useSavedThemesStore";
import { useFontFamily } from "../../components/common/FontProvider";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { useSettingsPicker } from "../../hooks/useSettingsPicker";
import {
  ACCENT_PRESETS,
  ACCENT_COLOR_KEYS,
  BORDER_WIDTH_PRESETS,
  BORDER_WIDTH_PRESET_KEYS,
  CUSTOM_THEME_TEMPLATES,
  CUSTOM_THEME_TEMPLATE_KEYS,
  DISABLED_OPACITY_PRESETS,
  DISABLED_OPACITY_PRESET_KEYS,
  RADIUS_PRESETS,
  RADIUS_PRESET_KEYS,
  STYLE_PRESETS,
  STYLE_PRESET_KEYS,
  THEME_ADVANCED_EDITABLE_TOKENS,
  THEME_EDITABLE_TOKENS,
  normalizeHexColor,
  type AccentColorKey,
  type BorderWidthPresetKey,
  type DisabledOpacityPresetKey,
  type RadiusPresetKey,
  type StylePresetKey,
  type ThemeAdvancedToken,
  type ThemeColorMode,
  type ThemeCustomColors,
  type ThemeEditableToken,
} from "../../lib/theme/presets";
import {
  FONT_FAMILY_PRESETS,
  FONT_FAMILY_KEYS,
  MONO_FONT_PRESETS,
  MONO_FONT_KEYS,
} from "../../lib/theme/fonts";

const CUSTOM_BASE_TOKEN_KEYS: Array<{ token: ThemeEditableToken; labelKey: string }> = [
  { token: "background", labelKey: "settings.customThemeBackground" },
  { token: "surface", labelKey: "settings.customThemeSurface" },
];

const CUSTOM_SEMANTIC_TOKEN_KEYS: Array<{ token: ThemeEditableToken; labelKey: string }> = [
  { token: "accent", labelKey: "settings.customThemeAccent" },
  { token: "success", labelKey: "settings.customThemeSuccess" },
  { token: "warning", labelKey: "settings.customThemeWarning" },
  { token: "danger", labelKey: "settings.customThemeDanger" },
];

const CUSTOM_ADVANCED_TOKEN_KEYS: Array<{ token: ThemeAdvancedToken; labelKey: string }> = [
  { token: "secondary", labelKey: "settings.customThemeSecondary" },
  { token: "info", labelKey: "settings.customThemeInfo" },
  { token: "foreground", labelKey: "settings.customThemeForeground" },
  { token: "card", labelKey: "settings.customThemeCard" },
  { token: "border", labelKey: "settings.customThemeBorder" },
  { token: "focus", labelKey: "settings.customThemeFocus" },
  { token: "muted", labelKey: "settings.customThemeMuted" },
];

const OPTIONAL_CUSTOM_TOKENS = new Set<ThemeEditableToken | ThemeAdvancedToken>([
  "background",
  "surface",
  "secondary",
  "info",
  "foreground",
  "card",
  "border",
  "focus",
  "muted",
]);

const QUICK_SEMANTIC_SWATCHES = [
  "#4F6BED",
  "#8B5CF6",
  "#22C55E",
  "#06B6D4",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#F97316",
];

const QUICK_BASE_SWATCHES = [
  "#FFFFFF",
  "#F9FAFB",
  "#E5E7EB",
  "#9CA3AF",
  "#374151",
  "#1F2937",
  "#111827",
  "#030712",
  "#0C1222",
  "#1A0A0A",
  "#0A1628",
  "#0D1B2A",
];

function cloneDraft(colors: ThemeCustomColors) {
  return {
    light: { ...colors.light },
    dark: { ...colors.dark },
  };
}

export default function AppearanceSettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  // Display settings
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const orientationLock = useSettingsStore((s) => s.orientationLock);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setOrientationLock = useSettingsStore((s) => s.setOrientationLock);

  // Saved themes
  const savedThemes = useSavedThemesStore((s) => s.themes);
  const saveTheme = useSavedThemesStore((s) => s.saveTheme);
  const deleteSavedTheme = useSavedThemesStore((s) => s.deleteTheme);
  const [savedThemeName, setSavedThemeName] = useState("");

  // Theme customization
  const themeColorMode = useSettingsStore((s) => s.themeColorMode);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const activePreset = useSettingsStore((s) => s.activePreset);
  const customThemeColors = useSettingsStore((s) => s.customThemeColors);
  const setThemeColorMode = useSettingsStore((s) => s.setThemeColorMode);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const setActivePreset = useSettingsStore((s) => s.setActivePreset);
  const setCustomThemeLinked = useSettingsStore((s) => s.setCustomThemeLinked);
  const setCustomThemeToken = useSettingsStore((s) => s.setCustomThemeToken);
  const resetStyle = useSettingsStore((s) => s.resetStyle);
  const radiusPreset = useSettingsStore((s) => s.radiusPreset);
  const setRadiusPreset = useSettingsStore((s) => s.setRadiusPreset);
  const borderWidthPreset = useSettingsStore((s) => s.borderWidthPreset);
  const setBorderWidthPreset = useSettingsStore((s) => s.setBorderWidthPreset);
  const fieldBorderWidthPreset = useSettingsStore((s) => s.fieldBorderWidthPreset);
  const setFieldBorderWidthPreset = useSettingsStore((s) => s.setFieldBorderWidthPreset);
  const disabledOpacityPreset = useSettingsStore((s) => s.disabledOpacityPreset);
  const setDisabledOpacityPreset = useSettingsStore((s) => s.setDisabledOpacityPreset);

  // Font settings
  const fontFamilySetting = useSettingsStore((s) => s.fontFamily);
  const monoFontSetting = useSettingsStore((s) => s.monoFontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const setMonoFontFamily = useSettingsStore((s) => s.setMonoFontFamily);

  const [
    backgroundPreview,
    foregroundPreview,
    surfacePreview,
    surfaceForegroundPreview,
    accentPreview,
    successPreview,
    warningPreview,
    dangerPreview,
    mutedColor,
  ] = useThemeColor([
    "background",
    "foreground",
    "surface",
    "surface-foreground",
    "accent",
    "success",
    "warning",
    "danger",
    "muted",
  ]);
  const lang = language === "zh" ? "zh" : "en";
  const { getFontFamily } = useFontFamily();
  const [customDraft, setCustomDraft] = useState(() => cloneDraft(customThemeColors));

  useEffect(() => {
    setCustomDraft(cloneDraft(customThemeColors));
  }, [customThemeColors]);

  const themeLabel =
    theme === "dark"
      ? t("settings.darkMode")
      : theme === "light"
        ? t("settings.lightMode")
        : t("settings.systemMode");

  const themeColorModeLabel =
    themeColorMode === "accent"
      ? t("settings.themeModeAccent")
      : themeColorMode === "custom"
        ? t("settings.themeModeCustom")
        : t("settings.themeModePreset");

  const themeOptions = [
    { label: t("settings.darkMode"), value: "dark" as const },
    { label: t("settings.lightMode"), value: "light" as const },
    { label: t("settings.systemMode"), value: "system" as const },
  ];
  const themeColorModeOptions = [
    { label: t("settings.themeModePreset"), value: "preset" as const },
    { label: t("settings.themeModeAccent"), value: "accent" as const },
    { label: t("settings.themeModeCustom"), value: "custom" as const },
  ];
  const languageOptions = [
    { label: t("settings.languageEnglish"), value: "en" as const },
    { label: t("settings.languageChinese"), value: "zh" as const },
  ];
  const fontFamilyOptions = FONT_FAMILY_KEYS.map((key) => ({
    label: FONT_FAMILY_PRESETS[key].label[lang],
    value: key,
  }));
  const monoFontOptions = MONO_FONT_KEYS.map((key) => ({
    label: MONO_FONT_PRESETS[key].label[lang],
    value: key,
  }));

  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateCustomDraft = (
    mode: "light" | "dark",
    token: ThemeEditableToken | ThemeAdvancedToken,
    value: string,
  ) => {
    setCustomDraft((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [token]: value.toUpperCase(),
      },
    }));
  };

  const previewCustomToken = useCallback(
    (mode: "light" | "dark", token: ThemeEditableToken | ThemeAdvancedToken, rawValue: string) => {
      updateCustomDraft(mode, token, rawValue);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewTimerRef.current = setTimeout(() => {
        const normalized = normalizeHexColor(rawValue);
        if (!normalized && rawValue.trim().length > 0 && !OPTIONAL_CUSTOM_TOKENS.has(token)) return;
        const tempColors: ThemeCustomColors = {
          linked: customThemeColors.linked,
          light: { ...customThemeColors.light },
          dark: { ...customThemeColors.dark },
        };
        (tempColors[mode] as unknown as Record<string, string>)[token] = normalized ?? "";
        if (tempColors.linked)
          (tempColors.dark as unknown as Record<string, string>)[token] = normalized ?? "";
        // Color preview is no longer applied at runtime (using HeroUI defaults)
      }, 300);
    },
    [customThemeColors],
  );

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const applyCustomToken = (
    mode: "light" | "dark",
    token: ThemeEditableToken | ThemeAdvancedToken,
  ) => {
    const raw = (customDraft[mode] as unknown as Record<string, string>)[token] ?? "";
    if (OPTIONAL_CUSTOM_TOKENS.has(token) && raw.trim().length === 0) {
      haptics.selection();
      setCustomThemeToken(token, "", mode);
      return;
    }
    const normalized = normalizeHexColor(raw);
    if (!normalized) {
      haptics.notify(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    haptics.selection();
    setCustomThemeToken(token, normalized, mode);
  };

  const applyCustomSwatch = (
    mode: "light" | "dark",
    token: ThemeEditableToken | ThemeAdvancedToken,
    color: string,
  ) => {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;
    updateCustomDraft(mode, token, normalized);
    haptics.selection();
    setCustomThemeToken(token, normalized, mode);
  };

  const renderTokenEditors = (
    mode: "light" | "dark",
    tokens: Array<{ token: ThemeEditableToken | ThemeAdvancedToken; labelKey: string }>,
  ) =>
    tokens.map(({ token, labelKey }, index) => {
      const value = (customDraft[mode] as unknown as Record<string, string>)[token] ?? "";
      const normalized = normalizeHexColor(value);
      const isOptional = OPTIONAL_CUSTOM_TOKENS.has(token);
      const canApply = isOptional ? value.trim().length === 0 || !!normalized : !!normalized;
      return (
        <View key={`${mode}-${token}`}>
          <View className="mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  backgroundColor: normalized ?? "#6b7280",
                }}
              />
              <Text className="text-sm text-foreground">{t(labelKey)}</Text>
            </View>
            <Text className="text-xs text-muted">{value}</Text>
          </View>
          <View className="mb-2 flex-row items-center gap-2">
            <Input
              className="flex-1"
              placeholder={isOptional ? "#111827 / (auto)" : "#4F6BED"}
              value={value}
              onChangeText={(nextValue) => previewCustomToken(mode, token, nextValue)}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Button
              size="sm"
              variant="secondary"
              onPress={() => applyCustomToken(mode, token)}
              isDisabled={!canApply}
            >
              <Button.Label>{t("common.confirm")}</Button.Label>
            </Button>
          </View>
          <View className="mb-2 flex-row flex-wrap gap-2">
            {(isOptional ? QUICK_BASE_SWATCHES : QUICK_SEMANTIC_SWATCHES).map((color) => {
              const isSelected = normalized === color;
              return (
                <PressableFeedback
                  key={`${mode}-${token}-${color}`}
                  accessibilityRole="button"
                  accessibilityLabel={color}
                  onPress={() => applyCustomSwatch(mode, token, color)}
                  style={{ borderRadius: 999 }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: color,
                      borderWidth: isSelected ? 2.5 : 1,
                      borderColor: isSelected ? accentPreview : mutedColor,
                    }}
                  />
                </PressableFeedback>
              );
            })}
          </View>
          {!normalized && value.length > 0 && (
            <Text className="mb-2 text-xs text-danger">{t("settings.invalidHexHint")}</Text>
          )}
          {index !== tokens.length - 1 && <Separator className="my-2" />}
        </View>
      );
    });

  return (
    <View testID="e2e-screen-settings__appearance" className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <SettingsHeader title={t("settings.categories.appearance")} />

        {/* Display Settings */}
        <SettingsSection title={t("settings.display")}>
          <SettingsRow
            testID="e2e-action-settings__appearance-open-language"
            icon="language-outline"
            label={t("settings.language")}
            value={
              language === "zh" ? t("settings.languageChinese") : t("settings.languageEnglish")
            }
            onPress={() => openPicker("language")}
          />
          <Separator />
          <SettingsRow
            testID="e2e-action-settings__appearance-open-theme"
            icon="moon-outline"
            label={t("settings.theme")}
            value={themeLabel}
            onPress={() => openPicker("theme")}
          />
          <Separator />
          <SettingsRow
            icon="text-outline"
            label={t("settings.fontFamily")}
            value={FONT_FAMILY_PRESETS[fontFamilySetting].label[lang]}
            onPress={() => openPicker("fontFamily")}
          />
          <Separator />
          <SettingsRow
            icon="code-outline"
            label={t("settings.monoFont")}
            value={MONO_FONT_PRESETS[monoFontSetting].label[lang]}
            onPress={() => openPicker("monoFont")}
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
            onPress={() => openPicker("orientation")}
          />
        </SettingsSection>

        {/* Font Preview */}
        {fontFamilySetting !== "system" && (
          <View className="mb-4 rounded-lg bg-surface-secondary px-4 py-3">
            <Text
              className="text-sm text-foreground"
              style={{ fontFamily: getFontFamily("regular") }}
            >
              {t("settings.fontPreview")}
            </Text>
          </View>
        )}

        {/* Theme Mode */}
        <SettingsSection title={t("settings.themeColorMode")}>
          <SettingsRow
            icon="color-palette-outline"
            label={t("settings.themeColorMode")}
            value={themeColorModeLabel}
            onPress={() => openPicker("themeColorMode")}
          />
          <Separator />
          <View className="px-4 py-3">
            <Button
              variant="secondary"
              className="w-full"
              onPress={() => {
                haptics.selection();
                resetStyle();
              }}
            >
              <Button.Label>{t("settings.resetStyle")}</Button.Label>
            </Button>
          </View>
        </SettingsSection>

        {/* Radius Preset */}
        <SettingsSection title={t("settings.radiusPreset")}>
          <Card variant="secondary">
            <Card.Body className="px-4 py-3">
              <View className="flex-row flex-wrap gap-3">
                {RADIUS_PRESET_KEYS.map((key: RadiusPresetKey) => {
                  const preset = RADIUS_PRESETS[key];
                  const isActive = radiusPreset === key;
                  return (
                    <PressableFeedback
                      key={key}
                      onPress={() => {
                        haptics.selection();
                        setRadiusPreset(key);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isActive }}
                      accessibilityLabel={preset.label[lang]}
                    >
                      <View className="items-center gap-1">
                        <View
                          className="items-center justify-center"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: key === "none" ? 0 : key === "pill" ? 22 : 8,
                            backgroundColor: isActive ? accentPreview : "transparent",
                            borderWidth: isActive ? 0 : 1,
                            borderColor: mutedColor,
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: isActive ? foregroundPreview : mutedColor }}
                          >
                            {preset.value.replace("rem", "")}
                          </Text>
                        </View>
                        <Text className="text-[10px] text-muted">{preset.label[lang]}</Text>
                      </View>
                    </PressableFeedback>
                  );
                })}
              </View>
            </Card.Body>
          </Card>
        </SettingsSection>

        {/* Component Style */}
        <SettingsSection title={t("settings.componentStyle")}>
          <Card variant="secondary" className="mb-3">
            <Card.Body className="px-4 py-3">
              <Text className="mb-2 text-xs font-semibold text-muted">
                {t("settings.borderWidth")}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {BORDER_WIDTH_PRESET_KEYS.map((key: BorderWidthPresetKey) => {
                  const preset = BORDER_WIDTH_PRESETS[key];
                  const isActive = borderWidthPreset === key;
                  return (
                    <PressableFeedback
                      key={key}
                      onPress={() => {
                        haptics.selection();
                        setBorderWidthPreset(key);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isActive }}
                      accessibilityLabel={preset.label[lang]}
                    >
                      <View className="items-center gap-1">
                        <View
                          className="items-center justify-center"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            backgroundColor: isActive ? accentPreview : "transparent",
                            borderWidth: isActive ? 0 : 1,
                            borderColor: mutedColor,
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: isActive ? foregroundPreview : mutedColor }}
                          >
                            {preset.value}
                          </Text>
                        </View>
                        <Text className="text-[10px] text-muted">{preset.label[lang]}</Text>
                      </View>
                    </PressableFeedback>
                  );
                })}
              </View>
            </Card.Body>
          </Card>
          <Card variant="secondary" className="mb-3">
            <Card.Body className="px-4 py-3">
              <Text className="mb-2 text-xs font-semibold text-muted">
                {t("settings.fieldBorderWidth")}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {BORDER_WIDTH_PRESET_KEYS.map((key: BorderWidthPresetKey) => {
                  const preset = BORDER_WIDTH_PRESETS[key];
                  const isActive = fieldBorderWidthPreset === key;
                  return (
                    <PressableFeedback
                      key={key}
                      onPress={() => {
                        haptics.selection();
                        setFieldBorderWidthPreset(key);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isActive }}
                      accessibilityLabel={preset.label[lang]}
                    >
                      <View className="items-center gap-1">
                        <View
                          className="items-center justify-center"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            backgroundColor: isActive ? accentPreview : "transparent",
                            borderWidth: isActive ? 0 : 1,
                            borderColor: mutedColor,
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: isActive ? foregroundPreview : mutedColor }}
                          >
                            {preset.value}
                          </Text>
                        </View>
                        <Text className="text-[10px] text-muted">{preset.label[lang]}</Text>
                      </View>
                    </PressableFeedback>
                  );
                })}
              </View>
            </Card.Body>
          </Card>
          <Card variant="secondary">
            <Card.Body className="px-4 py-3">
              <Text className="mb-2 text-xs font-semibold text-muted">
                {t("settings.disabledOpacity")}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {DISABLED_OPACITY_PRESET_KEYS.map((key: DisabledOpacityPresetKey) => {
                  const preset = DISABLED_OPACITY_PRESETS[key];
                  const isActive = disabledOpacityPreset === key;
                  return (
                    <PressableFeedback
                      key={key}
                      onPress={() => {
                        haptics.selection();
                        setDisabledOpacityPreset(key);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isActive }}
                      accessibilityLabel={preset.label[lang]}
                    >
                      <View className="items-center gap-1">
                        <View
                          className="items-center justify-center"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            backgroundColor: isActive ? accentPreview : "transparent",
                            borderWidth: isActive ? 0 : 1,
                            borderColor: mutedColor,
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{ color: isActive ? foregroundPreview : mutedColor }}
                          >
                            {preset.value}
                          </Text>
                        </View>
                        <Text className="text-[10px] text-muted">{preset.label[lang]}</Text>
                      </View>
                    </PressableFeedback>
                  );
                })}
              </View>
            </Card.Body>
          </Card>
        </SettingsSection>

        {/* Accent Color */}
        {themeColorMode === "accent" && (
          <SettingsSection title={t("settings.accentColor")}>
            <Card variant="secondary">
              <Card.Body className="px-4 py-3">
                <View className="flex-row flex-wrap gap-3">
                  {ACCENT_COLOR_KEYS.map((key: AccentColorKey) => {
                    const preset = ACCENT_PRESETS[key];
                    const isActive = accentColor === key;
                    return (
                      <PressableFeedback
                        key={key}
                        onPress={() => {
                          haptics.selection();
                          setAccentColor(isActive ? null : key);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isActive }}
                        accessibilityLabel={preset.label[lang]}
                        style={{ borderRadius: 999 }}
                      >
                        <View className="items-center gap-1">
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: preset.swatch,
                              borderWidth: isActive ? 3 : 0,
                              borderColor: isActive ? foregroundPreview : "transparent",
                            }}
                          >
                            {isActive && (
                              <View className="flex-1 items-center justify-center">
                                <Ionicons name="checkmark" size={20} color="#fff" />
                              </View>
                            )}
                          </View>
                          <Text className="text-[10px] text-muted">{preset.label[lang]}</Text>
                        </View>
                      </PressableFeedback>
                    );
                  })}
                </View>
              </Card.Body>
            </Card>
          </SettingsSection>
        )}

        {/* Style Presets */}
        {themeColorMode === "preset" && (
          <SettingsSection title={t("settings.stylePreset")}>
            <Card variant="secondary">
              <Card.Body className="px-4 py-3">
                <View className="flex-row flex-wrap gap-3">
                  {STYLE_PRESET_KEYS.map((key: StylePresetKey) => {
                    const preset = STYLE_PRESETS[key];
                    const isActive = activePreset === key;
                    return (
                      <PressableFeedback
                        key={key}
                        onPress={() => {
                          haptics.selection();
                          setActivePreset(key);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isActive }}
                        accessibilityLabel={preset.label[lang]}
                        style={{ borderRadius: 999 }}
                      >
                        <View className="items-center gap-1">
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: preset.swatch,
                              borderWidth: isActive ? 3 : 0,
                              borderColor: isActive ? foregroundPreview : "transparent",
                            }}
                          >
                            {isActive && (
                              <View className="flex-1 items-center justify-center">
                                <Ionicons name="checkmark" size={20} color="#fff" />
                              </View>
                            )}
                          </View>
                          <Text className="text-[10px] text-muted">{preset.label[lang]}</Text>
                        </View>
                      </PressableFeedback>
                    );
                  })}
                </View>
              </Card.Body>
            </Card>
          </SettingsSection>
        )}

        {/* Custom Theme */}
        {themeColorMode === "custom" && (
          <SettingsSection title={t("settings.customTheme")}>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {CUSTOM_THEME_TEMPLATE_KEYS.map((key) => {
                const tmpl = CUSTOM_THEME_TEMPLATES[key];
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      haptics.selection();
                      for (const token of THEME_EDITABLE_TOKENS) {
                        setCustomThemeToken(token, tmpl.colors.light[token], "light");
                        if (!tmpl.colors.linked) {
                          setCustomThemeToken(token, tmpl.colors.dark[token], "dark");
                        }
                      }
                      setCustomThemeLinked(tmpl.colors.linked);
                    }}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: tmpl.swatch,
                      }}
                    />
                    <Button.Label>{tmpl.label[lang]}</Button.Label>
                  </Button>
                );
              })}
            </View>

            <Card variant="secondary" className="mb-3">
              <Card.Body className="px-4 py-3">
                <SettingsToggleRow
                  icon="link-outline"
                  label={t("settings.customThemeLinked")}
                  isSelected={customThemeColors.linked}
                  onSelectedChange={setCustomThemeLinked}
                />
              </Card.Body>
            </Card>

            {(["light", "dark"] as const)
              .filter((mode) => mode === "light" || !customThemeColors.linked)
              .map((mode) => (
                <Card key={mode} variant="secondary" className="mb-3">
                  <Card.Body className="px-4 py-3">
                    <Text className="mb-2 text-xs font-semibold uppercase text-muted">
                      {mode === "light"
                        ? t("settings.customThemeLight")
                        : t("settings.customThemeDark")}
                    </Text>
                    <Text className="mb-2 text-xs text-muted">{t("settings.customThemeBase")}</Text>
                    <Text className="mb-2 text-xs text-muted">
                      {t("settings.customThemeOptionalHint")}
                    </Text>
                    {renderTokenEditors(mode, CUSTOM_BASE_TOKEN_KEYS)}
                    <Separator className="my-2" />
                    {renderTokenEditors(mode, CUSTOM_SEMANTIC_TOKEN_KEYS)}
                    <Separator className="my-2" />
                    <Accordion selectionMode="single" variant="surface">
                      <Accordion.Item value="advanced">
                        <Accordion.Trigger>
                          <View className="flex-1 flex-row items-center gap-2">
                            <Ionicons name="color-palette-outline" size={14} color={mutedColor} />
                            <Text className="flex-1 text-sm text-foreground">
                              {t("settings.customThemeAdvanced")}
                            </Text>
                          </View>
                          <Accordion.Indicator />
                        </Accordion.Trigger>
                        <Accordion.Content>
                          <Text className="mb-2 text-xs text-muted">
                            {t("settings.customThemeOptionalHint")}
                          </Text>
                          {renderTokenEditors(mode, CUSTOM_ADVANCED_TOKEN_KEYS)}
                        </Accordion.Content>
                      </Accordion.Item>
                    </Accordion>
                  </Card.Body>
                </Card>
              ))}

            <View className="flex-row gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onPress={() => {
                  const exportData = { version: 2, colors: customThemeColors };
                  const json = JSON.stringify(exportData, null, 2);
                  Share.share({ message: json, title: t("settings.customTheme") });
                }}
              >
                <Ionicons name="share-outline" size={14} color={mutedColor} />
                <Button.Label>{t("common.export")}</Button.Label>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onPress={async () => {
                  try {
                    const text = await Clipboard.getStringAsync();
                    const parsed = JSON.parse(text);
                    if (!parsed || typeof parsed !== "object") throw new Error("invalid");

                    // v2 format: { version: 2, colors: ThemeCustomColors }
                    // v1 (legacy): ThemeCustomColors directly (has light/dark at top level)
                    const colors =
                      parsed.version === 2 && parsed.colors
                        ? parsed.colors
                        : parsed.light && parsed.dark
                          ? parsed
                          : null;
                    if (!colors) throw new Error("invalid");

                    const allTokens = [
                      ...THEME_EDITABLE_TOKENS,
                      ...THEME_ADVANCED_EDITABLE_TOKENS,
                    ] as const;
                    for (const token of allTokens) {
                      if (typeof colors.light?.[token] === "string") {
                        setCustomThemeToken(token, colors.light[token], "light");
                      }
                      if (typeof colors.dark?.[token] === "string") {
                        setCustomThemeToken(token, colors.dark[token], "dark");
                      }
                    }
                    if (typeof colors.linked === "boolean") {
                      setCustomThemeLinked(colors.linked);
                    }
                    haptics.notify(Haptics.NotificationFeedbackType.Success);
                  } catch {
                    haptics.notify(Haptics.NotificationFeedbackType.Warning);
                    Alert.alert(t("common.error"), t("settings.invalidHexHint"));
                  }
                }}
              >
                <Ionicons name="clipboard-outline" size={14} color={mutedColor} />
                <Button.Label>{t("common.import")}</Button.Label>
              </Button>
            </View>
          </SettingsSection>
        )}

        {/* Saved Themes */}
        {themeColorMode === "custom" && (
          <SettingsSection title={t("settings.savedThemes")}>
            <Card variant="secondary" className="mb-3">
              <Card.Body className="gap-3 px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <Input
                    placeholder={t("settings.savedThemeNamePlaceholder")}
                    value={savedThemeName}
                    onChangeText={setSavedThemeName}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onPress={() => {
                      if (!savedThemeName.trim()) return;
                      const ok = saveTheme(savedThemeName.trim(), customThemeColors);
                      if (ok) {
                        haptics.selection();
                        setSavedThemeName("");
                      } else {
                        haptics.notify(Haptics.NotificationFeedbackType.Warning);
                        Alert.alert(t("common.error"), t("settings.savedThemeFull"));
                      }
                    }}
                    isDisabled={!savedThemeName.trim() || savedThemes.length >= MAX_SAVED_THEMES}
                  >
                    <Button.Label>{t("settings.savedThemeSave")}</Button.Label>
                  </Button>
                </View>
                {savedThemes.length === 0 ? (
                  <Text className="text-center text-xs text-muted">
                    {t("settings.savedThemeEmpty")}
                  </Text>
                ) : (
                  savedThemes.map((saved) => (
                    <View key={saved.name} className="flex-row items-center gap-2">
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          backgroundColor: saved.colors.light.accent || "#6b7280",
                        }}
                      />
                      <Text className="flex-1 text-sm text-foreground">{saved.name}</Text>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          haptics.selection();
                          for (const token of [
                            ...THEME_EDITABLE_TOKENS,
                            ...THEME_ADVANCED_EDITABLE_TOKENS,
                          ] as const) {
                            const lv = (saved.colors.light as unknown as Record<string, string>)[
                              token
                            ];
                            if (lv !== undefined) setCustomThemeToken(token, lv, "light");
                            if (!saved.colors.linked) {
                              const dv = (saved.colors.dark as unknown as Record<string, string>)[
                                token
                              ];
                              if (dv !== undefined) setCustomThemeToken(token, dv, "dark");
                            }
                          }
                          setCustomThemeLinked(saved.colors.linked);
                        }}
                      >
                        <Button.Label>{t("settings.savedThemeLoad")}</Button.Label>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          haptics.selection();
                          deleteSavedTheme(saved.name);
                        }}
                      >
                        <Ionicons name="trash-outline" size={14} color={dangerPreview} />
                      </Button>
                    </View>
                  ))
                )}
              </Card.Body>
            </Card>
          </SettingsSection>
        )}

        {/* Theme Preview */}
        <SettingsSection title={t("settings.themePreview")}>
          <Card variant="secondary">
            <Card.Body className="gap-3 px-4 py-3">
              {themeColorMode === "custom" && (
                <>
                  <View
                    className="rounded-xl px-3 py-2"
                    style={{ backgroundColor: backgroundPreview }}
                  >
                    <Text className="text-xs font-medium" style={{ color: foregroundPreview }}>
                      {t("settings.customThemeBackground")}
                    </Text>
                  </View>
                  <View
                    className="rounded-xl px-3 py-2"
                    style={{ backgroundColor: surfacePreview }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: surfaceForegroundPreview }}
                    >
                      {t("settings.customThemeSurface")}
                    </Text>
                  </View>
                </>
              )}
              <View className="flex-row flex-wrap gap-2">
                {[
                  { color: accentPreview, label: t("settings.customThemeAccent") },
                  { color: successPreview, label: t("settings.customThemeSuccess") },
                  { color: warningPreview, label: t("settings.customThemeWarning") },
                  { color: dangerPreview, label: t("settings.customThemeDanger") },
                ].map((item) => (
                  <View
                    key={item.label}
                    className="rounded-full px-3 py-1"
                    style={{ backgroundColor: `${item.color}22` }}
                  >
                    <Text className="text-xs" style={{ color: item.color }}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
              <Separator className="my-1" />
              <View className="flex-row flex-wrap gap-2">
                <Button size="sm">
                  <Button.Label>Primary</Button.Label>
                </Button>
                <Button size="sm" variant="secondary">
                  <Button.Label>Secondary</Button.Label>
                </Button>
                <Button size="sm" variant="ghost">
                  <Button.Label>Ghost</Button.Label>
                </Button>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <Chip size="sm" variant="primary" color="accent">
                  Accent
                </Chip>
                <Chip size="sm" variant="soft" color="success">
                  Success
                </Chip>
                <Chip size="sm" variant="soft" color="warning">
                  Warning
                </Chip>
                <Chip size="sm" variant="soft" color="danger">
                  Danger
                </Chip>
                <Chip size="sm" variant="secondary">
                  Secondary
                </Chip>
              </View>
              <View className="flex-row items-center gap-3">
                <Input placeholder="Input preview" className="flex-1" />
                <Switch isSelected onSelectedChange={() => {}} />
              </View>
              <Text className="text-sm text-foreground">
                {themeColorModeLabel}
                {" · "}
                {themeLabel}
              </Text>
            </Card.Body>
          </Card>
        </SettingsSection>

        {/* Picker Modals */}
        <OptionPickerModal
          visible={activePicker === "theme"}
          title={t("settings.theme")}
          options={themeOptions}
          selectedValue={theme}
          onSelect={setTheme}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "themeColorMode"}
          title={t("settings.themeColorMode")}
          options={themeColorModeOptions}
          selectedValue={themeColorMode}
          onSelect={(mode) => setThemeColorMode(mode as ThemeColorMode)}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "language"}
          title={t("settings.language")}
          options={languageOptions}
          selectedValue={language}
          onSelect={setLanguage}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "fontFamily"}
          title={t("settings.fontFamily")}
          options={fontFamilyOptions}
          selectedValue={fontFamilySetting}
          onSelect={setFontFamily}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "monoFont"}
          title={t("settings.monoFont")}
          options={monoFontOptions}
          selectedValue={monoFontSetting}
          onSelect={setMonoFontFamily}
          onClose={closePicker}
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
          onClose={closePicker}
        />
      </ScrollView>
    </View>
  );
}
