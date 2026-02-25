import { View, Text, ScrollView } from "react-native";
import { Button, Chip, Input, Switch, TextField } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import type {
  FrameClassificationRuleHeaderField,
  FrameClassificationRuleMatchType,
  FrameClassificationRuleTarget,
} from "../../../lib/fits/types";
import {
  RULE_TARGET_OPTIONS,
  RULE_MATCH_OPTIONS,
  RULE_HEADER_OPTIONS,
} from "./frameClassConstants";

interface AddRuleFormProps {
  frameTypeDefinitions: Array<{ key: string; label: string; builtin?: boolean }>;
  frameTypeLabels: Map<string, string>;
  newRuleTarget: FrameClassificationRuleTarget;
  newRuleMatchType: FrameClassificationRuleMatchType;
  newRuleHeaderField: FrameClassificationRuleHeaderField;
  newRulePattern: string;
  newRuleFrameType: string;
  newRulePriority: string;
  newRuleCaseSensitive: boolean;
  onTargetChange: (target: FrameClassificationRuleTarget) => void;
  onMatchTypeChange: (matchType: FrameClassificationRuleMatchType) => void;
  onHeaderFieldChange: (field: FrameClassificationRuleHeaderField) => void;
  onPatternChange: (pattern: string) => void;
  onFrameTypeChange: (frameType: string) => void;
  onPriorityChange: (priority: string) => void;
  onCaseSensitiveChange: (caseSensitive: boolean) => void;
  onAddRule: () => void;
}

export function AddRuleForm({
  frameTypeDefinitions,
  frameTypeLabels,
  newRuleTarget,
  newRuleMatchType,
  newRuleHeaderField,
  newRulePattern,
  newRuleFrameType,
  newRulePriority,
  newRuleCaseSensitive,
  onTargetChange,
  onMatchTypeChange,
  onHeaderFieldChange,
  onPatternChange,
  onFrameTypeChange,
  onPriorityChange,
  onCaseSensitiveChange,
  onAddRule,
}: AddRuleFormProps) {
  const { t } = useI18n();

  return (
    <View className="mx-2 my-2 rounded-lg border border-dashed border-separator p-2">
      <Text className="mb-2 text-xs text-muted">{t("settings.addRule")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="mb-2 flex-row gap-1">
          {RULE_TARGET_OPTIONS.map((target) => (
            <Chip
              key={`new-target-${target}`}
              size="sm"
              variant={newRuleTarget === target ? "primary" : "secondary"}
              onPress={() => onTargetChange(target)}
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
                onPress={() => onHeaderFieldChange(field)}
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
              onPress={() => onMatchTypeChange(matchType)}
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
              onPress={() => onFrameTypeChange(definition.key)}
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
          onChangeText={onPatternChange}
          placeholder={t("settings.rulePattern")}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </TextField>
      <View className="mt-2 flex-row items-center gap-2">
        <TextField className="flex-1">
          <Input
            value={newRulePriority}
            onChangeText={onPriorityChange}
            keyboardType="numeric"
            placeholder={t("settings.rulePriority")}
          />
        </TextField>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted">{t("settings.caseSensitive")}</Text>
          <Switch
            isSelected={newRuleCaseSensitive}
            onSelectedChange={(value: boolean) => onCaseSensitiveChange(value)}
          />
        </View>
      </View>
      <Button className="mt-2" variant="outline" onPress={onAddRule}>
        <Button.Label>{t("settings.addRule")}</Button.Label>
      </Button>
    </View>
  );
}
