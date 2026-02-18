import { useCallback, useMemo, useState } from "react";
import { Alert, View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Button, Chip, Dialog, Input, Separator, Switch, TextField } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useFileManager } from "../../hooks/useFileManager";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { useSettingsPicker } from "../../hooks/useSettingsPicker";
import type {
  ExportFormat,
  FrameClassificationRule,
  FrameClassificationRuleHeaderField,
  FrameClassificationRuleMatchType,
  FrameClassificationRuleTarget,
} from "../../lib/fits/types";
import { classifyWithDetail, getFrameTypeDefinitions } from "../../lib/gallery/frameClassifier";

const STACK_METHOD_VALUES = [
  "average",
  "median",
  "sigma",
  "min",
  "max",
  "winsorized",
  "weighted",
] as const;
const ALIGNMENT_MODE_VALUES = ["none", "translation", "full"] as const;
const STACKING_DETECTION_PROFILE_VALUES = ["fast", "balanced", "accurate"] as const;
const DEBOUNCE_OPTIONS = [
  { label: "50ms", value: 50 },
  { label: "100ms", value: 100 },
  { label: "150ms", value: 150 },
  { label: "200ms", value: 200 },
  { label: "300ms", value: 300 },
  { label: "500ms", value: 500 },
];
const EDITOR_MAX_UNDO_OPTIONS = [
  { label: "5", value: 5 },
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
];
const CONVERTER_FORMAT_OPTIONS = [
  { label: "PNG", value: "png" as const },
  { label: "JPEG", value: "jpeg" as const },
  { label: "TIFF", value: "tiff" as const },
  { label: "WebP", value: "webp" as const },
  { label: "BMP", value: "bmp" as const },
  { label: "FITS", value: "fits" as const },
];
const BATCH_NAMING_VALUES = ["original", "prefix", "suffix", "sequence"] as const;
const COMPOSE_PRESET_VALUES = ["rgb", "sho", "hoo", "lrgb", "custom"] as const;
const EXPORT_FORMAT_OPTIONS: Array<{ label: string; value: ExportFormat }> = [
  { label: "PNG", value: "png" },
  { label: "JPEG", value: "jpeg" },
  { label: "WebP", value: "webp" },
  { label: "TIFF", value: "tiff" },
  { label: "BMP", value: "bmp" },
  { label: "FITS", value: "fits" },
];
const RULE_TARGET_OPTIONS: FrameClassificationRuleTarget[] = ["header", "filename"];
const RULE_MATCH_OPTIONS: FrameClassificationRuleMatchType[] = ["exact", "contains", "regex"];
const RULE_HEADER_OPTIONS: FrameClassificationRuleHeaderField[] = ["IMAGETYP", "FRAME", "ANY"];

export default function ProcessingSettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  // Editor defaults
  const defaultBlurSigma = useSettingsStore((s) => s.defaultBlurSigma);
  const defaultSharpenAmount = useSettingsStore((s) => s.defaultSharpenAmount);
  const defaultDenoiseRadius = useSettingsStore((s) => s.defaultDenoiseRadius);
  const editorMaxUndo = useSettingsStore((s) => s.editorMaxUndo);
  const setDefaultBlurSigma = useSettingsStore((s) => s.setDefaultBlurSigma);
  const setDefaultSharpenAmount = useSettingsStore((s) => s.setDefaultSharpenAmount);
  const setDefaultDenoiseRadius = useSettingsStore((s) => s.setDefaultDenoiseRadius);
  const setEditorMaxUndo = useSettingsStore((s) => s.setEditorMaxUndo);

  // Stacking defaults
  const defaultStackMethod = useSettingsStore((s) => s.defaultStackMethod);
  const defaultSigmaValue = useSettingsStore((s) => s.defaultSigmaValue);
  const defaultAlignmentMode = useSettingsStore((s) => s.defaultAlignmentMode);
  const defaultEnableQuality = useSettingsStore((s) => s.defaultEnableQuality);
  const stackingDetectionProfile = useSettingsStore((s) => s.stackingDetectionProfile);
  const stackingDetectSigmaThreshold = useSettingsStore((s) => s.stackingDetectSigmaThreshold);
  const stackingDetectMaxStars = useSettingsStore((s) => s.stackingDetectMaxStars);
  const stackingDetectMinArea = useSettingsStore((s) => s.stackingDetectMinArea);
  const stackingDetectMaxArea = useSettingsStore((s) => s.stackingDetectMaxArea);
  const stackingDetectBorderMargin = useSettingsStore((s) => s.stackingDetectBorderMargin);
  const stackingBackgroundMeshSize = useSettingsStore((s) => s.stackingBackgroundMeshSize);
  const stackingDeblendNLevels = useSettingsStore((s) => s.stackingDeblendNLevels);
  const stackingDeblendMinContrast = useSettingsStore((s) => s.stackingDeblendMinContrast);
  const stackingFilterFwhm = useSettingsStore((s) => s.stackingFilterFwhm);
  const stackingMaxFwhm = useSettingsStore((s) => s.stackingMaxFwhm);
  const stackingMaxEllipticity = useSettingsStore((s) => s.stackingMaxEllipticity);
  const stackingRansacMaxIterations = useSettingsStore((s) => s.stackingRansacMaxIterations);
  const stackingAlignmentInlierThreshold = useSettingsStore(
    (s) => s.stackingAlignmentInlierThreshold,
  );
  const setDefaultStackMethod = useSettingsStore((s) => s.setDefaultStackMethod);
  const setDefaultSigmaValue = useSettingsStore((s) => s.setDefaultSigmaValue);
  const setDefaultAlignmentMode = useSettingsStore((s) => s.setDefaultAlignmentMode);
  const setDefaultEnableQuality = useSettingsStore((s) => s.setDefaultEnableQuality);
  const setStackingDetectionProfile = useSettingsStore((s) => s.setStackingDetectionProfile);
  const setStackingDetectSigmaThreshold = useSettingsStore(
    (s) => s.setStackingDetectSigmaThreshold,
  );
  const setStackingDetectMaxStars = useSettingsStore((s) => s.setStackingDetectMaxStars);
  const setStackingDetectMinArea = useSettingsStore((s) => s.setStackingDetectMinArea);
  const setStackingDetectMaxArea = useSettingsStore((s) => s.setStackingDetectMaxArea);
  const setStackingDetectBorderMargin = useSettingsStore((s) => s.setStackingDetectBorderMargin);
  const setStackingBackgroundMeshSize = useSettingsStore((s) => s.setStackingBackgroundMeshSize);
  const setStackingDeblendNLevels = useSettingsStore((s) => s.setStackingDeblendNLevels);
  const setStackingDeblendMinContrast = useSettingsStore((s) => s.setStackingDeblendMinContrast);
  const setStackingFilterFwhm = useSettingsStore((s) => s.setStackingFilterFwhm);
  const setStackingMaxFwhm = useSettingsStore((s) => s.setStackingMaxFwhm);
  const setStackingMaxEllipticity = useSettingsStore((s) => s.setStackingMaxEllipticity);
  const setStackingRansacMaxIterations = useSettingsStore((s) => s.setStackingRansacMaxIterations);
  const setStackingAlignmentInlierThreshold = useSettingsStore(
    (s) => s.setStackingAlignmentInlierThreshold,
  );

  // Converter defaults
  const defaultConverterFormat = useSettingsStore((s) => s.defaultConverterFormat);
  const defaultConverterQuality = useSettingsStore((s) => s.defaultConverterQuality);
  const batchNamingRule = useSettingsStore((s) => s.batchNamingRule);
  const setDefaultConverterFormat = useSettingsStore((s) => s.setDefaultConverterFormat);
  const setDefaultConverterQuality = useSettingsStore((s) => s.setDefaultConverterQuality);
  const setBatchNamingRule = useSettingsStore((s) => s.setBatchNamingRule);

  // Export defaults
  const defaultExportFormat = useSettingsStore((s) => s.defaultExportFormat);
  const setDefaultExportFormat = useSettingsStore((s) => s.setDefaultExportFormat);

  // Compose defaults
  const defaultComposePreset = useSettingsStore((s) => s.defaultComposePreset);
  const composeRedWeight = useSettingsStore((s) => s.composeRedWeight);
  const composeGreenWeight = useSettingsStore((s) => s.composeGreenWeight);
  const composeBlueWeight = useSettingsStore((s) => s.composeBlueWeight);
  const setDefaultComposePreset = useSettingsStore((s) => s.setDefaultComposePreset);
  const setComposeRedWeight = useSettingsStore((s) => s.setComposeRedWeight);
  const setComposeGreenWeight = useSettingsStore((s) => s.setComposeGreenWeight);
  const setComposeBlueWeight = useSettingsStore((s) => s.setComposeBlueWeight);

  // Performance
  const imageProcessingDebounce = useSettingsStore((s) => s.imageProcessingDebounce);
  const useHighQualityPreview = useSettingsStore((s) => s.useHighQualityPreview);
  const setImageProcessingDebounce = useSettingsStore((s) => s.setImageProcessingDebounce);
  const setUseHighQualityPreview = useSettingsStore((s) => s.setUseHighQualityPreview);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);
  const reportFrameTypes = useSettingsStore((s) => s.reportFrameTypes);
  const setFrameClassificationConfig = useSettingsStore((s) => s.setFrameClassificationConfig);
  const setReportFrameTypes = useSettingsStore((s) => s.setReportFrameTypes);
  const resetFrameClassificationConfig = useSettingsStore((s) => s.resetFrameClassificationConfig);
  const files = useFitsStore((s) => s.files);
  const updateFile = useFitsStore((s) => s.updateFile);

  const { reclassifyAllFrames } = useFileManager();

  const [customTypeKey, setCustomTypeKey] = useState("");
  const [customTypeLabel, setCustomTypeLabel] = useState("");
  const [newRuleTarget, setNewRuleTarget] = useState<FrameClassificationRuleTarget>("filename");
  const [newRuleMatchType, setNewRuleMatchType] =
    useState<FrameClassificationRuleMatchType>("contains");
  const [newRuleHeaderField, setNewRuleHeaderField] =
    useState<FrameClassificationRuleHeaderField>("ANY");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleFrameType, setNewRuleFrameType] = useState("light");
  const [newRulePriority, setNewRulePriority] = useState("100");
  const [newRuleCaseSensitive, setNewRuleCaseSensitive] = useState(false);
  const [ruleTestValues, setRuleTestValues] = useState<Record<string, string>>({});
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [deleteTypeDialogKey, setDeleteTypeDialogKey] = useState<string | null>(null);
  const [deleteTypeTarget, setDeleteTypeTarget] = useState("unknown");

  const frameTypeDefinitions = useMemo(
    () => getFrameTypeDefinitions(frameClassificationConfig),
    [frameClassificationConfig],
  );
  const frameTypeDefinitionMap = useMemo(() => {
    const map = new Map<string, { key: string; label: string; builtin?: boolean }>();
    for (const definition of frameTypeDefinitions) {
      map.set(definition.key, definition);
    }
    return map;
  }, [frameTypeDefinitions]);
  const frameTypeLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const definition of frameTypeDefinitions) {
      map.set(
        definition.key,
        definition.builtin
          ? (t(`gallery.frameTypes.${definition.key}`) ?? definition.label)
          : definition.label || definition.key,
      );
    }
    return map;
  }, [frameTypeDefinitions, t]);

  const frameUsageCount = useMemo(() => {
    const count = new Map<string, number>();
    for (const file of files) {
      count.set(file.frameType, (count.get(file.frameType) ?? 0) + 1);
    }
    return count;
  }, [files]);

  const toggleReportFrameType = useCallback(
    (value: string) => {
      if (reportFrameTypes.includes(value)) {
        const next = reportFrameTypes.filter((item) => item !== value);
        if (next.length === 0) return;
        setReportFrameTypes(next);
        return;
      }
      setReportFrameTypes([...reportFrameTypes, value]);
    },
    [reportFrameTypes, setReportFrameTypes],
  );

  const updateRule = useCallback(
    (id: string, updates: Partial<FrameClassificationRule>) => {
      const nextRules = frameClassificationConfig.rules.map((rule) =>
        rule.id === id ? { ...rule, ...updates } : rule,
      );
      setFrameClassificationConfig({
        ...frameClassificationConfig,
        rules: nextRules,
      });
    },
    [frameClassificationConfig, setFrameClassificationConfig],
  );

  const removeRule = useCallback(
    (id: string) => {
      setFrameClassificationConfig({
        ...frameClassificationConfig,
        rules: frameClassificationConfig.rules.filter((rule) => rule.id !== id),
      });
    },
    [frameClassificationConfig, setFrameClassificationConfig],
  );

  const addCustomFrameType = useCallback(() => {
    const key = customTypeKey.trim().toLowerCase();
    if (!key) return;
    if (!/^[a-z0-9_-]+$/.test(key)) {
      Alert.alert(t("common.error"), t("settings.frameTypeKeyInvalid"));
      return;
    }
    if (frameTypeDefinitionMap.has(key)) {
      Alert.alert(t("common.error"), t("settings.frameTypeKeyExists"));
      return;
    }
    setFrameClassificationConfig({
      ...frameClassificationConfig,
      frameTypes: [
        ...frameClassificationConfig.frameTypes,
        {
          key,
          label: customTypeLabel.trim() || key,
          builtin: false,
        },
      ],
    });
    setCustomTypeKey("");
    setCustomTypeLabel("");
  }, [
    customTypeKey,
    customTypeLabel,
    frameClassificationConfig,
    frameTypeDefinitionMap,
    setFrameClassificationConfig,
    t,
  ]);

  const updateFrameTypeLabel = useCallback(
    (key: string, label: string) => {
      const next = frameClassificationConfig.frameTypes.map((definition) =>
        definition.key === key && !definition.builtin
          ? { ...definition, label: label.trim() || key }
          : definition,
      );
      setFrameClassificationConfig({
        ...frameClassificationConfig,
        frameTypes: next,
      });
    },
    [frameClassificationConfig, setFrameClassificationConfig],
  );

  const openDeleteTypeDialog = useCallback(
    (key: string) => {
      const candidate =
        frameTypeDefinitions.find((item) => item.key !== key)?.key ??
        frameTypeDefinitions[0]?.key ??
        "unknown";
      setDeleteTypeTarget(candidate);
      setDeleteTypeDialogKey(key);
    },
    [frameTypeDefinitions],
  );

  const confirmDeleteFrameType = useCallback(() => {
    if (!deleteTypeDialogKey) return;
    const deleteKey = deleteTypeDialogKey;
    const migrateTo = deleteTypeTarget;

    const nextFrameTypes = frameClassificationConfig.frameTypes.filter(
      (definition) => definition.key !== deleteKey,
    );
    const nextRules = frameClassificationConfig.rules.map((rule) =>
      rule.frameType === deleteKey ? { ...rule, frameType: migrateTo } : rule,
    );
    setFrameClassificationConfig({
      frameTypes: nextFrameTypes,
      rules: nextRules,
    });

    for (const file of files) {
      if (file.frameType !== deleteKey) continue;
      updateFile(file.id, {
        frameType: migrateTo,
        frameTypeSource: "manual",
      });
    }

    setDeleteTypeDialogKey(null);
  }, [
    deleteTypeDialogKey,
    deleteTypeTarget,
    files,
    frameClassificationConfig,
    setFrameClassificationConfig,
    updateFile,
  ]);

  const addRule = useCallback(() => {
    const pattern = newRulePattern.trim();
    if (!pattern) return;
    const priority = Number(newRulePriority);
    setFrameClassificationConfig({
      ...frameClassificationConfig,
      rules: [
        ...frameClassificationConfig.rules,
        {
          id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          enabled: true,
          priority: Number.isFinite(priority) ? priority : 0,
          target: newRuleTarget,
          headerField: newRuleTarget === "header" ? newRuleHeaderField : undefined,
          matchType: newRuleMatchType,
          pattern,
          caseSensitive: newRuleCaseSensitive,
          frameType: newRuleFrameType,
        },
      ],
    });
    setNewRulePattern("");
  }, [
    frameClassificationConfig,
    newRuleCaseSensitive,
    newRuleFrameType,
    newRuleHeaderField,
    newRuleMatchType,
    newRulePattern,
    newRulePriority,
    newRuleTarget,
    setFrameClassificationConfig,
  ]);

  const evaluateRuleMatch = useCallback(
    (ruleId: string) => {
      const rule = frameClassificationConfig.rules.find((item) => item.id === ruleId);
      if (!rule) return null;
      const sample = ruleTestValues[ruleId]?.trim();
      if (!sample) return null;

      const result = classifyWithDetail(
        rule.target === "header" ? sample : undefined,
        rule.target === "header" ? sample : undefined,
        rule.target === "filename" ? sample : "sample.fits",
        {
          frameTypes: frameClassificationConfig.frameTypes,
          rules: [{ ...rule, enabled: true }],
        },
      );
      if (result.source === "rule" && result.matchedRuleId === rule.id) {
        return result.type;
      }
      return null;
    },
    [frameClassificationConfig.frameTypes, frameClassificationConfig.rules, ruleTestValues],
  );

  const runReclassify = useCallback(async () => {
    try {
      setIsReclassifying(true);
      const result = await reclassifyAllFrames();
      const failedPreview = result.failedEntries
        .slice(0, 5)
        .map((entry) => `${entry.filename}: ${entry.reason}`)
        .join("\n");
      const message = [
        `${t("settings.reclassifyTotal")}: ${result.total}`,
        `${t("settings.reclassifyUpdated")}: ${result.updated}`,
        `${t("settings.reclassifyFailed")}: ${result.failed}`,
        failedPreview ? `\n${failedPreview}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      Alert.alert(t("settings.reclassifyDone"), message);
    } catch (error) {
      Alert.alert(t("common.error"), error instanceof Error ? error.message : "reclassify_failed");
    } finally {
      setIsReclassifying(false);
    }
  }, [reclassifyAllFrames, t]);

  const stackMethodLabel = (value: (typeof STACK_METHOD_VALUES)[number]) =>
    t(
      value === "average"
        ? "editor.average"
        : value === "median"
          ? "editor.median"
          : value === "sigma"
            ? "editor.sigmaClip"
            : value === "min"
              ? "editor.min"
              : value === "max"
                ? "editor.max"
                : value === "winsorized"
                  ? "editor.winsorized"
                  : "editor.weighted",
    );

  const alignmentModeLabel = (value: (typeof ALIGNMENT_MODE_VALUES)[number]) =>
    t(
      value === "none"
        ? "editor.alignNone"
        : value === "translation"
          ? "editor.alignTranslation"
          : "editor.alignFull",
    );

  const stackingDetectionProfileLabel = (
    value: (typeof STACKING_DETECTION_PROFILE_VALUES)[number],
  ) =>
    t(
      value === "fast"
        ? "settings.stackingProfileFast"
        : value === "accurate"
          ? "settings.stackingProfileAccurate"
          : "settings.stackingProfileBalanced",
    );

  const composePresetLabel = (value: (typeof COMPOSE_PRESET_VALUES)[number]) =>
    value === "custom" ? t("settings.composePresetCustom") : value.toUpperCase();

  const stackMethodOptions = STACK_METHOD_VALUES.map((value) => ({
    label: stackMethodLabel(value),
    value,
  }));

  const alignmentModeOptions = ALIGNMENT_MODE_VALUES.map((value) => ({
    label: alignmentModeLabel(value),
    value,
  }));

  const stackingDetectionProfileOptions = STACKING_DETECTION_PROFILE_VALUES.map((value) => ({
    label: stackingDetectionProfileLabel(value),
    value,
  }));

  const batchNamingOptions = BATCH_NAMING_VALUES.map((value) => ({
    label:
      value === "original"
        ? t("settings.namingOriginal")
        : value === "prefix"
          ? t("settings.namingPrefix")
          : value === "suffix"
            ? t("settings.namingSuffix")
            : t("settings.namingSequence"),
    value,
  }));

  const composePresetOptions = COMPOSE_PRESET_VALUES.map((value) => ({
    label: composePresetLabel(value),
    value,
  }));

  return (
    <View className="flex-1 bg-background">
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
            {t("settings.categories.processing")}
          </Text>
        </View>

        {/* Editor Defaults */}
        <SettingsSection title={t("settings.editorDefaults")}>
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
            onPress={() => openPicker("editorMaxUndo")}
          />
        </SettingsSection>

        {/* Stacking Defaults */}
        <SettingsSection title={t("settings.stackingDefaults")}>
          <SettingsRow
            icon="layers-outline"
            label={t("settings.defaultStackMethod")}
            value={stackMethodLabel(defaultStackMethod)}
            onPress={() => openPicker("stackMethod")}
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
            value={alignmentModeLabel(defaultAlignmentMode)}
            onPress={() => openPicker("alignmentMode")}
          />
          <Separator />
          <SettingsRow
            icon="checkmark-circle-outline"
            label={t("settings.defaultEnableQuality")}
            rightElement={
              <Switch
                isSelected={defaultEnableQuality}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setDefaultEnableQuality(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="sparkles-outline"
            label={t("settings.stackingDetectionProfile")}
            value={stackingDetectionProfileLabel(stackingDetectionProfile)}
            onPress={() => openPicker("stackingDetectionProfile")}
          />
          <Separator />
          <SettingsRow
            icon="pulse-outline"
            label={t("settings.stackingDetectSigmaThreshold")}
            value={stackingDetectSigmaThreshold.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingDetectSigmaThreshold}
              min={1.0}
              max={10.0}
              step={0.1}
              onValueChange={setStackingDetectSigmaThreshold}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="star-outline"
            label={t("settings.stackingDetectMaxStars")}
            value={`${stackingDetectMaxStars}`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingDetectMaxStars}
              min={50}
              max={800}
              step={10}
              onValueChange={setStackingDetectMaxStars}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="scan-outline"
            label={t("settings.stackingDetectMinArea")}
            value={`${stackingDetectMinArea}`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingDetectMinArea}
              min={1}
              max={20}
              step={1}
              onValueChange={setStackingDetectMinArea}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="expand-outline"
            label={t("settings.stackingDetectMaxArea")}
            value={`${stackingDetectMaxArea}`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingDetectMaxArea}
              min={50}
              max={3000}
              step={10}
              onValueChange={setStackingDetectMaxArea}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="crop-outline"
            label={t("settings.stackingDetectBorderMargin")}
            value={`${stackingDetectBorderMargin}`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingDetectBorderMargin}
              min={0}
              max={64}
              step={1}
              onValueChange={setStackingDetectBorderMargin}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="grid-outline"
            label={t("settings.stackingBackgroundMeshSize")}
            value={`${stackingBackgroundMeshSize}`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingBackgroundMeshSize}
              min={16}
              max={256}
              step={8}
              onValueChange={setStackingBackgroundMeshSize}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="git-branch-outline"
            label={t("settings.stackingDeblendNLevels")}
            value={`${stackingDeblendNLevels}`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingDeblendNLevels}
              min={1}
              max={32}
              step={1}
              onValueChange={setStackingDeblendNLevels}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="options-outline"
            label={t("settings.stackingDeblendMinContrast")}
            value={stackingDeblendMinContrast.toFixed(2)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingDeblendMinContrast}
              min={0.01}
              max={0.5}
              step={0.01}
              onValueChange={setStackingDeblendMinContrast}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="funnel-outline"
            label={t("settings.stackingFilterFwhm")}
            value={stackingFilterFwhm.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingFilterFwhm}
              min={0.5}
              max={8}
              step={0.1}
              onValueChange={setStackingFilterFwhm}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="ellipse-outline"
            label={t("settings.stackingMaxFwhm")}
            value={stackingMaxFwhm.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingMaxFwhm}
              min={1}
              max={20}
              step={0.1}
              onValueChange={setStackingMaxFwhm}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="radio-button-on-outline"
            label={t("settings.stackingMaxEllipticity")}
            value={stackingMaxEllipticity.toFixed(2)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingMaxEllipticity}
              min={0}
              max={1}
              step={0.01}
              onValueChange={setStackingMaxEllipticity}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="repeat-outline"
            label={t("settings.stackingRansacMaxIterations")}
            value={`${stackingRansacMaxIterations}`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingRansacMaxIterations}
              min={20}
              max={400}
              step={10}
              onValueChange={setStackingRansacMaxIterations}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="resize-outline"
            label={t("settings.stackingAlignmentInlierThreshold")}
            value={stackingAlignmentInlierThreshold.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={stackingAlignmentInlierThreshold}
              min={0.5}
              max={10}
              step={0.1}
              onValueChange={setStackingAlignmentInlierThreshold}
            />
          </View>
        </SettingsSection>

        {/* Export Defaults */}
        <SettingsSection title={t("settings.export")}>
          <SettingsRow
            icon="download-outline"
            label={t("settings.defaultExportFormat")}
            value={defaultExportFormat.toUpperCase()}
            onPress={() => openPicker("exportFormat")}
          />
        </SettingsSection>

        {/* Converter Defaults */}
        <SettingsSection title={t("settings.converterDefaults")}>
          <SettingsRow
            icon="image-outline"
            label={t("settings.defaultConverterFormat")}
            value={defaultConverterFormat.toUpperCase()}
            onPress={() => openPicker("converterFormat")}
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
            onPress={() => openPicker("batchNamingRule")}
          />
        </SettingsSection>

        {/* Compose Defaults */}
        <SettingsSection title={t("settings.composeDefaults")}>
          <SettingsRow
            icon="color-palette-outline"
            label={t("settings.defaultComposePreset")}
            value={composePresetLabel(defaultComposePreset)}
            onPress={() => openPicker("composePreset")}
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
        </SettingsSection>

        {/* Performance */}
        <SettingsSection title={t("settings.performance")}>
          <SettingsRow
            icon="speedometer-outline"
            label={t("settings.imageProcessingDebounce")}
            value={`${imageProcessingDebounce}ms`}
            onPress={() => openPicker("debounce")}
          />
          <Separator />
          <SettingsRow
            icon="eye-outline"
            label={t("settings.useHighQualityPreview")}
            rightElement={
              <Switch
                isSelected={useHighQualityPreview}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setUseHighQualityPreview(v);
                }}
              />
            }
          />
        </SettingsSection>

        <SettingsSection title={t("settings.frameClassificationTitle")}>
          <Text className="px-2 pb-2 text-xs text-muted">{t("settings.frameTypes")}</Text>
          {frameTypeDefinitions.map((definition) => (
            <View key={definition.key} className="px-2 pb-2">
              <View className="mb-1 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs font-semibold text-foreground">{definition.key}</Text>
                  {definition.builtin && (
                    <Chip size="sm" variant="secondary">
                      <Chip.Label className="text-[10px]">{t("settings.builtinType")}</Chip.Label>
                    </Chip>
                  )}
                  {!definition.builtin && (
                    <Chip size="sm" variant="secondary">
                      <Chip.Label className="text-[10px]">
                        {t("settings.referencedFrames").replace(
                          "{count}",
                          String(frameUsageCount.get(definition.key) ?? 0),
                        )}
                      </Chip.Label>
                    </Chip>
                  )}
                </View>
                {!definition.builtin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => openDeleteTypeDialog(definition.key)}
                  >
                    <Button.Label>{t("common.delete")}</Button.Label>
                  </Button>
                )}
              </View>
              {definition.builtin ? (
                <Text className="text-xs text-muted">
                  {frameTypeLabels.get(definition.key) ?? definition.key}
                </Text>
              ) : (
                <TextField>
                  <Input
                    value={definition.label}
                    onChangeText={(value) => updateFrameTypeLabel(definition.key, value)}
                    placeholder={t("settings.customTypeLabel")}
                    autoCorrect={false}
                  />
                </TextField>
              )}
            </View>
          ))}

          <Separator />
          <View className="px-2 py-2">
            <Text className="mb-2 text-xs text-muted">{t("settings.addCustomType")}</Text>
            <TextField>
              <Input
                placeholder={t("settings.customTypeKey")}
                value={customTypeKey}
                onChangeText={setCustomTypeKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField>
            <View className="mt-2" />
            <TextField>
              <Input
                placeholder={t("settings.customTypeLabel")}
                value={customTypeLabel}
                onChangeText={setCustomTypeLabel}
                autoCorrect={false}
              />
            </TextField>
            <Button className="mt-2" variant="outline" onPress={addCustomFrameType}>
              <Button.Label>{t("settings.addCustomType")}</Button.Label>
            </Button>
          </View>

          <Separator />
          <Text className="px-2 pt-2 text-xs text-muted">{t("settings.classificationRules")}</Text>
          {[...frameClassificationConfig.rules]
            .sort((a, b) => b.priority - a.priority)
            .map((rule) => {
              const matchedType = evaluateRuleMatch(rule.id);
              return (
                <View key={rule.id} className="mx-2 my-2 rounded-lg border border-separator p-2">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-xs text-muted">{rule.id}</Text>
                    <View className="flex-row items-center gap-2">
                      <Switch
                        isSelected={rule.enabled}
                        onSelectedChange={(value: boolean) =>
                          updateRule(rule.id, { enabled: value })
                        }
                      />
                      <Button size="sm" variant="ghost" onPress={() => removeRule(rule.id)}>
                        <Button.Label>{t("common.delete")}</Button.Label>
                      </Button>
                    </View>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="mb-2 flex-row gap-1">
                      {RULE_TARGET_OPTIONS.map((target) => (
                        <Chip
                          key={`${rule.id}-target-${target}`}
                          size="sm"
                          variant={rule.target === target ? "primary" : "secondary"}
                          onPress={() => updateRule(rule.id, { target })}
                        >
                          <Chip.Label className="text-[10px]">{target}</Chip.Label>
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>

                  {rule.target === "header" && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="mb-2 flex-row gap-1">
                        {RULE_HEADER_OPTIONS.map((field) => (
                          <Chip
                            key={`${rule.id}-header-${field}`}
                            size="sm"
                            variant={
                              (rule.headerField ?? "ANY") === field ? "primary" : "secondary"
                            }
                            onPress={() => updateRule(rule.id, { headerField: field })}
                          >
                            <Chip.Label className="text-[10px]">{field}</Chip.Label>
                          </Chip>
                        ))}
                      </View>
                    </ScrollView>
                  )}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="mb-2 flex-row gap-1">
                      {RULE_MATCH_OPTIONS.map((matchType) => (
                        <Chip
                          key={`${rule.id}-match-${matchType}`}
                          size="sm"
                          variant={rule.matchType === matchType ? "primary" : "secondary"}
                          onPress={() => updateRule(rule.id, { matchType })}
                        >
                          <Chip.Label className="text-[10px]">{matchType}</Chip.Label>
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="mb-2 flex-row gap-1">
                      {frameTypeDefinitions.map((definition) => (
                        <Chip
                          key={`${rule.id}-type-${definition.key}`}
                          size="sm"
                          variant={rule.frameType === definition.key ? "primary" : "secondary"}
                          onPress={() => updateRule(rule.id, { frameType: definition.key })}
                        >
                          <Chip.Label className="text-[10px]">
                            {frameTypeLabels.get(definition.key) ?? definition.key}
                          </Chip.Label>
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>

                  <TextField>
                    <Input
                      value={rule.pattern}
                      onChangeText={(value) => updateRule(rule.id, { pattern: value })}
                      placeholder={t("settings.rulePattern")}
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                  </TextField>
                  <View className="mt-2 flex-row items-center gap-2">
                    <TextField className="flex-1">
                      <Input
                        value={String(rule.priority)}
                        onChangeText={(value) =>
                          updateRule(rule.id, { priority: Number(value) || 0 })
                        }
                        keyboardType="numeric"
                        placeholder={t("settings.rulePriority")}
                      />
                    </TextField>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-muted">{t("settings.caseSensitive")}</Text>
                      <Switch
                        isSelected={rule.caseSensitive === true}
                        onSelectedChange={(value: boolean) =>
                          updateRule(rule.id, { caseSensitive: value })
                        }
                      />
                    </View>
                  </View>
                  <TextField className="mt-2">
                    <Input
                      value={ruleTestValues[rule.id] ?? ""}
                      onChangeText={(value) =>
                        setRuleTestValues((prev) => ({
                          ...prev,
                          [rule.id]: value,
                        }))
                      }
                      placeholder={
                        rule.target === "filename"
                          ? t("settings.ruleTestFilename")
                          : t("settings.ruleTestHeader")
                      }
                    />
                  </TextField>
                  <Text className="mt-1 text-xs text-muted">
                    {matchedType
                      ? t("settings.ruleMatched").replace(
                          "{type}",
                          frameTypeLabels.get(matchedType) ?? matchedType,
                        )
                      : t("settings.ruleNoMatch")}
                  </Text>
                </View>
              );
            })}

          <View className="mx-2 my-2 rounded-lg border border-dashed border-separator p-2">
            <Text className="mb-2 text-xs text-muted">{t("settings.addRule")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="mb-2 flex-row gap-1">
                {RULE_TARGET_OPTIONS.map((target) => (
                  <Chip
                    key={`new-target-${target}`}
                    size="sm"
                    variant={newRuleTarget === target ? "primary" : "secondary"}
                    onPress={() => setNewRuleTarget(target)}
                  >
                    <Chip.Label className="text-[10px]">{target}</Chip.Label>
                  </Chip>
                ))}
              </View>
            </ScrollView>
            {newRuleTarget === "header" && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="mb-2 flex-row gap-1">
                  {RULE_HEADER_OPTIONS.map((field) => (
                    <Chip
                      key={`new-header-${field}`}
                      size="sm"
                      variant={newRuleHeaderField === field ? "primary" : "secondary"}
                      onPress={() => setNewRuleHeaderField(field)}
                    >
                      <Chip.Label className="text-[10px]">{field}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </ScrollView>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="mb-2 flex-row gap-1">
                {RULE_MATCH_OPTIONS.map((matchType) => (
                  <Chip
                    key={`new-match-${matchType}`}
                    size="sm"
                    variant={newRuleMatchType === matchType ? "primary" : "secondary"}
                    onPress={() => setNewRuleMatchType(matchType)}
                  >
                    <Chip.Label className="text-[10px]">{matchType}</Chip.Label>
                  </Chip>
                ))}
              </View>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="mb-2 flex-row gap-1">
                {frameTypeDefinitions.map((definition) => (
                  <Chip
                    key={`new-type-${definition.key}`}
                    size="sm"
                    variant={newRuleFrameType === definition.key ? "primary" : "secondary"}
                    onPress={() => setNewRuleFrameType(definition.key)}
                  >
                    <Chip.Label className="text-[10px]">
                      {frameTypeLabels.get(definition.key) ?? definition.key}
                    </Chip.Label>
                  </Chip>
                ))}
              </View>
            </ScrollView>
            <TextField>
              <Input
                value={newRulePattern}
                onChangeText={setNewRulePattern}
                placeholder={t("settings.rulePattern")}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </TextField>
            <View className="mt-2 flex-row items-center gap-2">
              <TextField className="flex-1">
                <Input
                  value={newRulePriority}
                  onChangeText={setNewRulePriority}
                  keyboardType="numeric"
                  placeholder={t("settings.rulePriority")}
                />
              </TextField>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-muted">{t("settings.caseSensitive")}</Text>
                <Switch
                  isSelected={newRuleCaseSensitive}
                  onSelectedChange={(value: boolean) => setNewRuleCaseSensitive(value)}
                />
              </View>
            </View>
            <Button className="mt-2" variant="outline" onPress={addRule}>
              <Button.Label>{t("settings.addRule")}</Button.Label>
            </Button>
          </View>

          <Separator />
          <View className="px-2 py-2">
            <Text className="mb-2 text-xs text-muted">{t("settings.reportScope")}</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {frameTypeDefinitions.map((definition) => (
                <Chip
                  key={`report-${definition.key}`}
                  size="sm"
                  variant={reportFrameTypes.includes(definition.key) ? "primary" : "secondary"}
                  onPress={() => toggleReportFrameType(definition.key)}
                >
                  <Chip.Label className="text-[10px]">
                    {frameTypeLabels.get(definition.key) ?? definition.key}
                  </Chip.Label>
                </Chip>
              ))}
            </View>
          </View>

          <Separator />
          <View className="px-2 py-2">
            <Button variant="outline" onPress={runReclassify} isDisabled={isReclassifying}>
              <Button.Label>
                {isReclassifying ? t("settings.reclassifying") : t("settings.reclassifyNow")}
              </Button.Label>
            </Button>
            <Button
              className="mt-2"
              variant="ghost"
              onPress={resetFrameClassificationConfig}
              isDisabled={isReclassifying}
            >
              <Button.Label>{t("settings.resetFrameClassification")}</Button.Label>
            </Button>
          </View>
        </SettingsSection>

        <Dialog
          isOpen={Boolean(deleteTypeDialogKey)}
          onOpenChange={(open) => {
            if (!open) setDeleteTypeDialogKey(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content>
              <Dialog.Title>{t("settings.deleteTypeTitle")}</Dialog.Title>
              <Dialog.Description>
                {t("settings.deleteTypeDescription").replace("{type}", deleteTypeDialogKey ?? "")}
              </Dialog.Description>
              <Text className="mt-3 mb-2 text-xs text-muted">
                {t("settings.migrateTargetType")}
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {frameTypeDefinitions
                  .filter((definition) => definition.key !== deleteTypeDialogKey)
                  .map((definition) => (
                    <Chip
                      key={`migrate-${definition.key}`}
                      size="sm"
                      variant={deleteTypeTarget === definition.key ? "primary" : "secondary"}
                      onPress={() => setDeleteTypeTarget(definition.key)}
                    >
                      <Chip.Label className="text-[10px]">
                        {frameTypeLabels.get(definition.key) ?? definition.key}
                      </Chip.Label>
                    </Chip>
                  ))}
              </View>
              <View className="mt-4 flex-row justify-end gap-2">
                <Button variant="outline" onPress={() => setDeleteTypeDialogKey(null)}>
                  <Button.Label>{t("common.cancel")}</Button.Label>
                </Button>
                <Button variant="primary" onPress={confirmDeleteFrameType}>
                  <Button.Label>{t("common.confirm")}</Button.Label>
                </Button>
              </View>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>

        {/* Picker Modals */}
        <OptionPickerModal
          visible={activePicker === "editorMaxUndo"}
          title={t("settings.editorMaxUndo")}
          options={EDITOR_MAX_UNDO_OPTIONS}
          selectedValue={editorMaxUndo}
          onSelect={setEditorMaxUndo}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "stackMethod"}
          title={t("settings.defaultStackMethod")}
          options={stackMethodOptions}
          selectedValue={defaultStackMethod}
          onSelect={setDefaultStackMethod}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "alignmentMode"}
          title={t("settings.defaultAlignmentMode")}
          options={alignmentModeOptions}
          selectedValue={defaultAlignmentMode}
          onSelect={setDefaultAlignmentMode}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "stackingDetectionProfile"}
          title={t("settings.stackingDetectionProfile")}
          options={stackingDetectionProfileOptions}
          selectedValue={stackingDetectionProfile}
          onSelect={setStackingDetectionProfile}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "exportFormat"}
          title={t("settings.defaultExportFormat")}
          options={EXPORT_FORMAT_OPTIONS}
          selectedValue={defaultExportFormat}
          onSelect={setDefaultExportFormat}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "converterFormat"}
          title={t("settings.defaultConverterFormat")}
          options={CONVERTER_FORMAT_OPTIONS}
          selectedValue={defaultConverterFormat}
          onSelect={setDefaultConverterFormat}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "batchNamingRule"}
          title={t("settings.batchNamingRule")}
          options={batchNamingOptions}
          selectedValue={batchNamingRule}
          onSelect={setBatchNamingRule}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "composePreset"}
          title={t("settings.defaultComposePreset")}
          options={composePresetOptions}
          selectedValue={defaultComposePreset}
          onSelect={setDefaultComposePreset}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "debounce"}
          title={t("settings.imageProcessingDebounce")}
          options={DEBOUNCE_OPTIONS}
          selectedValue={imageProcessingDebounce}
          onSelect={setImageProcessingDebounce}
          onClose={closePicker}
        />
      </ScrollView>
    </View>
  );
}
