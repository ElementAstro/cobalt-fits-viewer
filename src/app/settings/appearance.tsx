import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Button, Card, Input, Separator, Switch, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useFontFamily } from "../../components/common/FontProvider";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { useSettingsPicker } from "../../hooks/useSettingsPicker";
import {
  ACCENT_PRESETS,
  ACCENT_COLOR_KEYS,
  STYLE_PRESETS,
  STYLE_PRESET_KEYS,
  normalizeHexColor,
  type AccentColorKey,
  type StylePresetKey,
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

const CUSTOM_TOKEN_KEYS: Array<{ token: ThemeEditableToken; labelKey: string }> = [
  { token: "accent", labelKey: "settings.customThemeAccent" },
  { token: "success", labelKey: "settings.customThemeSuccess" },
  { token: "warning", labelKey: "settings.customThemeWarning" },
  { token: "danger", labelKey: "settings.customThemeDanger" },
];

const QUICK_COLOR_SWATCHES = [
  "#4F6BED",
  "#8B5CF6",
  "#22C55E",
  "#06B6D4",
  "#F59E0B",
  "#EF4444",
  "#FFFFFF",
  "#111827",
];

function cloneDraft(colors: ThemeCustomColors) {
  return {
    light: { ...colors.light },
    dark: { ...colors.dark },
  };
}

export default function AppearanceSettingsScreen() {
  const { t } = useI18n();
  const { isLandscape } = useScreenOrientation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  // Display settings
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const orientationLock = useSettingsStore((s) => s.orientationLock);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setOrientationLock = useSettingsStore((s) => s.setOrientationLock);

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

  // Font settings
  const fontFamilySetting = useSettingsStore((s) => s.fontFamily);
  const monoFontSetting = useSettingsStore((s) => s.monoFontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const setMonoFontFamily = useSettingsStore((s) => s.setMonoFontFamily);

  const [accentPreview, successPreview, warningPreview, dangerPreview] = useThemeColor([
    "accent",
    "success",
    "warning",
    "danger",
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

  const updateCustomDraft = (mode: "light" | "dark", token: ThemeEditableToken, value: string) => {
    setCustomDraft((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [token]: value.toUpperCase(),
      },
    }));
  };

  const applyCustomToken = (mode: "light" | "dark", token: ThemeEditableToken) => {
    const raw = customDraft[mode][token];
    const normalized = normalizeHexColor(raw);
    if (!normalized) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.selectionAsync();
    setCustomThemeToken(token, normalized, mode);
  };

  const applyCustomSwatch = (mode: "light" | "dark", token: ThemeEditableToken, color: string) => {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;
    updateCustomDraft(mode, token, normalized);
    Haptics.selectionAsync();
    setCustomThemeToken(token, normalized, mode);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: isLandscape ? 8 : insets.top + 8,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-4 flex-row items-center gap-3">
          <Ionicons name="arrow-back" size={24} color="#888" onPress={() => router.back()} />
          <Text className="text-xl font-bold text-foreground">
            {t("settings.categories.appearance")}
          </Text>
        </View>

        {/* Display Settings */}
        <SettingsSection title={t("settings.display")}>
          <SettingsRow
            icon="language-outline"
            label={t("settings.language")}
            value={
              language === "zh" ? t("settings.languageChinese") : t("settings.languageEnglish")
            }
            onPress={() => openPicker("language")}
          />
          <Separator />
          <SettingsRow
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
                Haptics.selectionAsync();
                resetStyle();
              }}
            >
              <Button.Label>{t("settings.resetStyle")}</Button.Label>
            </Button>
          </View>
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
          </SettingsSection>
        )}

        {/* Custom Theme */}
        {themeColorMode === "custom" && (
          <SettingsSection title={t("settings.customTheme")}>
            <Card variant="secondary" className="mb-3">
              <Card.Body className="px-4 py-3">
                <SettingsRow
                  icon="link-outline"
                  label={t("settings.customThemeLinked")}
                  rightElement={
                    <Switch
                      isSelected={customThemeColors.linked}
                      onSelectedChange={(value: boolean) => {
                        Haptics.selectionAsync();
                        setCustomThemeLinked(value);
                      }}
                    />
                  }
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
                    {CUSTOM_TOKEN_KEYS.map(({ token, labelKey }, index) => {
                      const value = customDraft[mode][token];
                      const normalized = normalizeHexColor(value);
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
                              placeholder="#4F6BED"
                              value={value}
                              onChangeText={(nextValue) =>
                                updateCustomDraft(mode, token, nextValue)
                              }
                              autoCapitalize="characters"
                              autoCorrect={false}
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => applyCustomToken(mode, token)}
                              isDisabled={!normalized}
                            >
                              <Button.Label>{t("common.confirm")}</Button.Label>
                            </Button>
                          </View>
                          <View className="mb-2 flex-row flex-wrap gap-2">
                            {QUICK_COLOR_SWATCHES.map((color) => {
                              const isSelected = normalized === color;
                              return (
                                <TouchableOpacity
                                  key={`${mode}-${token}-${color}`}
                                  accessibilityRole="button"
                                  accessibilityLabel={color}
                                  onPress={() => applyCustomSwatch(mode, token, color)}
                                >
                                  <View
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 999,
                                      backgroundColor: color,
                                      borderWidth: isSelected ? 2 : 1,
                                      borderColor: isSelected ? "#ffffff" : "#6b7280",
                                    }}
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          {!normalized && value.length > 0 && (
                            <Text className="mb-2 text-xs text-danger">
                              {t("settings.invalidHexHint")}
                            </Text>
                          )}
                          {index !== CUSTOM_TOKEN_KEYS.length - 1 && <Separator className="my-2" />}
                        </View>
                      );
                    })}
                  </Card.Body>
                </Card>
              ))}
          </SettingsSection>
        )}

        {/* Theme Preview */}
        <SettingsSection title={t("settings.themePreview")}>
          <Card variant="secondary">
            <Card.Body className="gap-3 px-4 py-3">
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
