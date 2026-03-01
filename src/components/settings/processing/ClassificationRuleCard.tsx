import { View, Text, ScrollView } from "react-native";
import { Button, Chip, Input, Switch, TextField } from "heroui-native";
import { useI18n } from "../../../i18n/useI18n";
import type { FrameClassificationRule } from "../../../lib/fits/types";
import { RULE_TARGET_OPTIONS, RULE_MATCH_OPTIONS, RULE_HEADER_OPTIONS } from "./constants";

interface ClassificationRuleCardProps {
  rule: FrameClassificationRule;
  frameTypeDefinitions: Array<{ key: string; label: string; builtin?: boolean }>;
  frameTypeLabels: Map<string, string>;
  matchedType: string | null;
  testValue: string;
  onUpdateRule: (id: string, updates: Partial<FrameClassificationRule>) => void;
  onRemoveRule: (id: string) => void;
  onTestValueChange: (ruleId: string, value: string) => void;
}

export function ClassificationRuleCard({
  rule,
  frameTypeDefinitions,
  frameTypeLabels,
  matchedType,
  testValue,
  onUpdateRule,
  onRemoveRule,
  onTestValueChange,
}: ClassificationRuleCardProps) {
  const { t } = useI18n();

  return (
    <View className="mx-2 my-2 rounded-lg border border-separator p-2">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs text-muted">{rule.id}</Text>
        <View className="flex-row items-center gap-2">
          <Switch
            isSelected={rule.enabled}
            onSelectedChange={(value: boolean) => onUpdateRule(rule.id, { enabled: value })}
          />
          <Button size="sm" variant="ghost" onPress={() => onRemoveRule(rule.id)}>
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
              onPress={() => onUpdateRule(rule.id, { target })}
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
                variant={(rule.headerField ?? "ANY") === field ? "primary" : "secondary"}
                onPress={() => onUpdateRule(rule.id, { headerField: field })}
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
              onPress={() => onUpdateRule(rule.id, { matchType })}
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
              onPress={() => onUpdateRule(rule.id, { frameType: definition.key })}
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
          onChangeText={(value) => onUpdateRule(rule.id, { pattern: value })}
          placeholder={t("settings.rulePattern")}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </TextField>
      <View className="mt-2 flex-row items-center gap-2">
        <TextField className="flex-1">
          <Input
            value={String(rule.priority)}
            onChangeText={(value) => onUpdateRule(rule.id, { priority: Number(value) || 0 })}
            keyboardType="numeric"
            placeholder={t("settings.rulePriority")}
          />
        </TextField>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted">{t("settings.caseSensitive")}</Text>
          <Switch
            isSelected={rule.caseSensitive === true}
            onSelectedChange={(value: boolean) => onUpdateRule(rule.id, { caseSensitive: value })}
          />
        </View>
      </View>
      <TextField className="mt-2">
        <Input
          value={testValue}
          onChangeText={(value) => onTestValueChange(rule.id, value)}
          placeholder={
            rule.target === "filename"
              ? t("settings.ruleTestFilename")
              : t("settings.ruleTestHeader")
          }
        />
      </TextField>
      <Text className="mt-1 text-xs text-muted">
        {matchedType
          ? t("settings.ruleMatched", {
              type: frameTypeLabels.get(matchedType) ?? matchedType,
            })
          : t("settings.ruleNoMatch")}
      </Text>
    </View>
  );
}
