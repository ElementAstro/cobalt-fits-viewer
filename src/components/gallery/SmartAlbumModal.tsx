import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import {
  Button,
  Chip,
  CloseButton,
  Dialog,
  Input,
  Separator,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { SmartAlbumRule } from "../../lib/fits/types";

const FIELDS: SmartAlbumRule["field"][] = [
  "object",
  "filter",
  "dateObs",
  "exptime",
  "instrument",
  "telescope",
  "tag",
  "location",
  "frameType",
];

const OPERATORS: SmartAlbumRule["operator"][] = [
  "equals",
  "contains",
  "gt",
  "lt",
  "between",
  "in",
  "notEquals",
  "notContains",
  "notIn",
];

interface SmartAlbumModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (name: string, rules: SmartAlbumRule[], description?: string) => void;
  suggestions?: Array<{ name: string; rules: SmartAlbumRule[] }>;
  frameTypeOptions?: Array<{ key: string; label: string }>;
}

export function SmartAlbumModal({
  visible,
  onClose,
  onConfirm,
  suggestions = [],
  frameTypeOptions = [],
}: SmartAlbumModalProps) {
  const { t } = useI18n();
  const [successColor] = useThemeColor(["success"]);

  const [name, setName] = useState("");
  const [rules, setRules] = useState<SmartAlbumRule[]>([
    { field: "object", operator: "equals", value: "" },
  ]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const updateRule = (index: number, updates: Partial<SmartAlbumRule>) => {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...updates } : r)));
  };

  const addRule = () => {
    setRules((prev) => [...prev, { field: "object", operator: "equals", value: "" }]);
  };

  const removeRule = (index: number) => {
    if (rules.length <= 1) return;
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const validRules = rules.filter((r) => r.value !== "" && r.value !== undefined);
    if (validRules.length === 0) return;
    onConfirm(trimmedName, validRules);
    resetForm();
  };

  const handleSuggestionPress = (suggestion: { name: string; rules: SmartAlbumRule[] }) => {
    onConfirm(suggestion.name, suggestion.rules);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setRules([{ field: "object", operator: "equals", value: "" }]);
    setShowSuggestions(true);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isValid =
    name.trim().length > 0 && rules.some((r) => r.value !== "" && r.value !== undefined);

  return (
    <Dialog
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-4 w-full max-w-md max-h-[80%]">
          <ScrollView className="p-6">
            <View className="flex-row items-center gap-2 mb-4">
              <Ionicons name="sparkles" size={18} color={successColor} />
              <Dialog.Title>{t("gallery.smartAlbum")}</Dialog.Title>
            </View>

            {/* Suggestions */}
            {suggestions.length > 0 && showSuggestions && (
              <View className="mb-4">
                <Text className="text-xs font-semibold text-muted mb-2">
                  {t("album.suggestions")}
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {suggestions.map((s, i) => (
                    <Pressable key={i} onPress={() => handleSuggestionPress(s)}>
                      <Chip size="sm" variant="secondary">
                        <Ionicons name="add-circle-outline" size={10} color={successColor} />
                        <Chip.Label className="text-[10px]">{s.name}</Chip.Label>
                      </Chip>
                    </Pressable>
                  ))}
                </View>
                <Separator className="mt-3" />
              </View>
            )}

            {/* Album Name */}
            <TextField>
              <Input
                placeholder={t("gallery.albumName")}
                value={name}
                onChangeText={setName}
                autoCorrect={false}
              />
            </TextField>

            {/* Rules */}
            <Text className="mt-4 mb-2 text-xs font-semibold text-muted">{t("album.rules")}</Text>
            {rules.map((rule, index) => (
              <View
                key={index}
                className="mb-2 rounded-xl border border-separator bg-background p-2"
              >
                {/* Field picker + remove button */}
                <View className="flex-row items-center gap-1.5">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
                    <View className="flex-row gap-1">
                      {FIELDS.map((field) => (
                        <Pressable key={field} onPress={() => updateRule(index, { field })}>
                          <Chip size="sm" variant={rule.field === field ? "primary" : "secondary"}>
                            <Chip.Label className="text-[9px]">{field}</Chip.Label>
                          </Chip>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>

                  {rules.length > 1 && <CloseButton size="sm" onPress={() => removeRule(index)} />}
                </View>

                {/* Operator + Value row */}
                <View className="w-full flex-row items-center gap-1.5 mt-1.5">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-1">
                      {OPERATORS.map((op) => (
                        <Pressable key={op} onPress={() => updateRule(index, { operator: op })}>
                          <Chip size="sm" variant={rule.operator === op ? "primary" : "secondary"}>
                            <Chip.Label className="text-[9px]">{op}</Chip.Label>
                          </Chip>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {rule.field === "frameType" && frameTypeOptions.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-1.5">
                    <View className="flex-row gap-1">
                      {frameTypeOptions.map((option) => (
                        <Pressable
                          key={option.key}
                          onPress={() => updateRule(index, { value: option.key })}
                        >
                          <Chip
                            size="sm"
                            variant={String(rule.value) === option.key ? "primary" : "secondary"}
                          >
                            <Chip.Label className="text-[9px]">{option.label}</Chip.Label>
                          </Chip>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                )}

                <TextField className="flex-1 mt-1.5">
                  <Input
                    className="text-xs"
                    placeholder={t("album.ruleValue")}
                    value={rule.value == null ? "" : String(rule.value)}
                    onChangeText={(v) => updateRule(index, { value: v })}
                    autoCorrect={false}
                  />
                </TextField>
              </View>
            ))}

            <Pressable onPress={addRule} className="flex-row items-center gap-1 mt-1">
              <Ionicons name="add-outline" size={14} color={successColor} />
              <Text className="text-xs text-success">{t("album.addRule")}</Text>
            </Pressable>
          </ScrollView>

          {/* Bottom buttons */}
          <Separator />
          <View className="flex-row justify-end gap-2 px-6 py-4">
            <Button variant="outline" onPress={handleClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button variant="primary" onPress={handleConfirm} isDisabled={!isValid}>
              <Button.Label>{t("common.confirm")}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
