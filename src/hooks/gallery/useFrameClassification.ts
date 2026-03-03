import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../i18n/useI18n";
import { useFileManager } from "../files/useFileManager";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useFitsStore } from "../stores/useFitsStore";
import type {
  FrameClassificationRule,
  FrameClassificationRuleHeaderField,
  FrameClassificationRuleMatchType,
  FrameClassificationRuleTarget,
} from "../lib/fits/types";
import { classifyWithDetail, getFrameTypeDefinitions } from "../lib/gallery/frameClassifier";

export function useFrameClassification() {
  const { t } = useI18n();

  const {
    frameClassificationConfig,
    reportFrameTypes,
    setFrameClassificationConfig,
    setReportFrameTypes,
    resetFrameClassificationConfig,
  } = useSettingsStore(
    useShallow((s) => ({
      frameClassificationConfig: s.frameClassificationConfig,
      reportFrameTypes: s.reportFrameTypes,
      setFrameClassificationConfig: s.setFrameClassificationConfig,
      setReportFrameTypes: s.setReportFrameTypes,
      resetFrameClassificationConfig: s.resetFrameClassificationConfig,
    })),
  );
  const { files, batchUpdateFiles } = useFitsStore(
    useShallow((s) => ({
      files: s.files,
      batchUpdateFiles: s.batchUpdateFiles,
    })),
  );

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

    const affectedIds = files.filter((f) => f.frameType === deleteKey).map((f) => f.id);
    if (affectedIds.length > 0) {
      batchUpdateFiles(affectedIds, {
        frameType: migrateTo,
        frameTypeSource: "manual",
      });
    }

    setDeleteTypeDialogKey(null);
  }, [
    deleteTypeDialogKey,
    deleteTypeTarget,
    batchUpdateFiles,
    files,
    frameClassificationConfig,
    setFrameClassificationConfig,
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

  return {
    // Derived data
    frameClassificationConfig,
    frameTypeDefinitions,
    frameTypeLabels,
    frameUsageCount,
    reportFrameTypes,

    // Custom type form state
    customTypeKey,
    customTypeLabel,
    setCustomTypeKey,
    setCustomTypeLabel,

    // New rule form state
    newRuleTarget,
    newRuleMatchType,
    newRuleHeaderField,
    newRulePattern,
    newRuleFrameType,
    newRulePriority,
    newRuleCaseSensitive,
    setNewRuleTarget,
    setNewRuleMatchType,
    setNewRuleHeaderField,
    setNewRulePattern,
    setNewRuleFrameType,
    setNewRulePriority,
    setNewRuleCaseSensitive,

    // Rule test state
    ruleTestValues,
    setRuleTestValues,

    // Delete type dialog state
    deleteTypeDialogKey,
    deleteTypeTarget,
    setDeleteTypeDialogKey,
    setDeleteTypeTarget,

    // Reclassify state
    isReclassifying,

    // Actions
    addCustomFrameType,
    updateFrameTypeLabel,
    openDeleteTypeDialog,
    confirmDeleteFrameType,
    toggleReportFrameType,
    updateRule,
    removeRule,
    addRule,
    evaluateRuleMatch,
    runReclassify,
    resetFrameClassificationConfig,
  };
}
