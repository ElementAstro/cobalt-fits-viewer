import { useCallback, useMemo, useState } from "react";
import { Alert, View, Text } from "react-native";
import { Button, Chip, Dialog, Input, Separator, TextField } from "heroui-native";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../../../i18n/useI18n";
import { useFileManager } from "../../../hooks/useFileManager";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useFitsStore } from "../../../stores/useFitsStore";
import { SettingsSection } from "../SettingsSection";
import { ClassificationRuleCard } from "./ClassificationRuleCard";
import { AddRuleForm } from "./AddRuleForm";
import type {
  FrameClassificationRule,
  FrameClassificationRuleHeaderField,
  FrameClassificationRuleMatchType,
  FrameClassificationRuleTarget,
} from "../../../lib/fits/types";
import { classifyWithDetail, getFrameTypeDefinitions } from "../../../lib/gallery/frameClassifier";

export function ProcessingFrameClassSection() {
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
  const { files, updateFile } = useFitsStore(
    useShallow((s) => ({
      files: s.files,
      updateFile: s.updateFile,
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

  return (
    <>
      <SettingsSection title={t("settings.frameClassificationTitle")} collapsible defaultCollapsed>
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
          .map((rule) => (
            <ClassificationRuleCard
              key={rule.id}
              rule={rule}
              frameTypeDefinitions={frameTypeDefinitions}
              frameTypeLabels={frameTypeLabels}
              matchedType={evaluateRuleMatch(rule.id)}
              testValue={ruleTestValues[rule.id] ?? ""}
              onUpdateRule={updateRule}
              onRemoveRule={removeRule}
              onTestValueChange={(ruleId, value) =>
                setRuleTestValues((prev) => ({ ...prev, [ruleId]: value }))
              }
            />
          ))}

        <AddRuleForm
          frameTypeDefinitions={frameTypeDefinitions}
          frameTypeLabels={frameTypeLabels}
          newRuleTarget={newRuleTarget}
          newRuleMatchType={newRuleMatchType}
          newRuleHeaderField={newRuleHeaderField}
          newRulePattern={newRulePattern}
          newRuleFrameType={newRuleFrameType}
          newRulePriority={newRulePriority}
          newRuleCaseSensitive={newRuleCaseSensitive}
          onTargetChange={setNewRuleTarget}
          onMatchTypeChange={setNewRuleMatchType}
          onHeaderFieldChange={setNewRuleHeaderField}
          onPatternChange={setNewRulePattern}
          onFrameTypeChange={setNewRuleFrameType}
          onPriorityChange={setNewRulePriority}
          onCaseSensitiveChange={setNewRuleCaseSensitive}
          onAddRule={addRule}
        />

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
            <Text className="mt-3 mb-2 text-xs text-muted">{t("settings.migrateTargetType")}</Text>
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
    </>
  );
}
