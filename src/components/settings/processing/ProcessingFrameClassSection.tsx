import { View, Text } from "react-native";
import { Button, Chip, Dialog, Input, Separator, TextField } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import { SettingsSection } from "../SettingsSection";
import { ClassificationRuleCard } from "./ClassificationRuleCard";
import { AddRuleForm } from "./AddRuleForm";
import { useFrameClassification } from "../../../hooks/useFrameClassification";

export function ProcessingFrameClassSection() {
  const { t } = useI18n();
  const {
    frameClassificationConfig,
    frameTypeDefinitions,
    frameTypeLabels,
    frameUsageCount,
    reportFrameTypes,
    customTypeKey,
    customTypeLabel,
    setCustomTypeKey,
    setCustomTypeLabel,
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
    ruleTestValues,
    setRuleTestValues,
    deleteTypeDialogKey,
    deleteTypeTarget,
    setDeleteTypeDialogKey,
    setDeleteTypeTarget,
    isReclassifying,
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
  } = useFrameClassification();

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
                      {t("settings.referencedFrames", {
                        count: frameUsageCount.get(definition.key) ?? 0,
                      })}
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
              {t("settings.deleteTypeDescription", { type: deleteTypeDialogKey ?? "" })}
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
