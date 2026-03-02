/**
 * Header keyword 编辑/添加弹窗
 * keyword=null 时为添加模式，否则为编辑模式
 * 复用 PromptDialog 的 Dialog 结构 + EditTargetSheet 的表单布局
 */

import { useState, useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import { Button, Dialog, Input, Label, Switch, TextField } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { HeaderKeyword } from "../../lib/fits/types";
import {
  validateHeaderKey,
  validateHeaderValue,
  isProtectedKeyword,
  inferValueType,
} from "../../lib/fits/headerValidator";

type ValueType = "string" | "number" | "boolean";

interface HeaderEditSheetProps {
  visible: boolean;
  keyword: HeaderKeyword | null;
  onSave: (keyword: HeaderKeyword) => void;
  onClose: () => void;
}

export function HeaderEditSheet({ visible, keyword, onSave, onClose }: HeaderEditSheetProps) {
  const { t } = useI18n();
  const isAddMode = keyword === null;
  const isProtected = keyword ? isProtectedKeyword(keyword.key) : false;

  const [key, setKey] = useState("");
  const [rawValue, setRawValue] = useState("");
  const [boolValue, setBoolValue] = useState(false);
  const [comment, setComment] = useState("");
  const [valueType, setValueType] = useState<ValueType>("string");

  useEffect(() => {
    if (!visible) return;
    if (keyword) {
      setKey(keyword.key);
      const inferred = inferValueType(String(keyword.value ?? ""));
      setValueType(inferred.type);
      if (inferred.type === "boolean") {
        setBoolValue(inferred.value === true);
        setRawValue("");
      } else {
        setRawValue(String(keyword.value ?? ""));
        setBoolValue(false);
      }
      setComment(keyword.comment ?? "");
    } else {
      setKey("");
      setRawValue("");
      setBoolValue(false);
      setComment("");
      setValueType("string");
    }
  }, [visible, keyword]);

  const resolvedValue = useMemo((): string | number | boolean | null => {
    if (valueType === "boolean") return boolValue;
    if (valueType === "number") {
      const num = Number(rawValue);
      return Number.isNaN(num) ? null : num;
    }
    return rawValue;
  }, [valueType, rawValue, boolValue]);

  const keyError = useMemo(() => {
    if (!key && isAddMode) return null;
    if (!key) return null;
    return validateHeaderKey(key.toUpperCase());
  }, [key, isAddMode]);

  const valueError = useMemo(() => {
    if (resolvedValue === null && valueType === "number" && rawValue !== "") {
      return { field: "value" as const, message: "header.invalidValue" };
    }
    if (resolvedValue !== null) {
      return validateHeaderValue(resolvedValue);
    }
    return null;
  }, [resolvedValue, valueType, rawValue]);

  const canSave = useMemo(() => {
    const k = key.toUpperCase().trim();
    if (!k) return false;
    if (keyError) return false;
    if (valueError) return false;
    if (resolvedValue === null) return false;
    return true;
  }, [key, keyError, valueError, resolvedValue]);

  const handleSave = () => {
    if (!canSave || resolvedValue === null) return;
    onSave({
      key: key.toUpperCase().trim(),
      value: resolvedValue,
      comment: comment.trim() || undefined,
    });
  };

  const cycleType = () => {
    const types: ValueType[] = ["string", "number", "boolean"];
    const idx = types.indexOf(valueType);
    const next = types[(idx + 1) % types.length];
    setValueType(next);
    if (next === "boolean") {
      setBoolValue(rawValue === "true" || rawValue === "T" || rawValue === "1");
    } else if (next === "number") {
      // Keep rawValue as-is, validation will catch invalid
    }
  };

  const typeLabel =
    valueType === "string"
      ? t("header.typeString" as Parameters<typeof t>[0])
      : valueType === "number"
        ? t("header.typeNumber" as Parameters<typeof t>[0])
        : t("header.typeBoolean" as Parameters<typeof t>[0]);

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal className="items-center justify-center px-4">
        <Dialog.Overlay />
        <Dialog.Content className="w-full max-w-[420px] rounded-2xl bg-background p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Dialog.Title>
              {isAddMode
                ? t("header.addMode" as Parameters<typeof t>[0])
                : t("header.editMode" as Parameters<typeof t>[0])}
            </Dialog.Title>
            <Dialog.Close />
          </View>

          {/* Key */}
          <TextField className="mb-3" isRequired>
            <Label>{t("header.keyLabel" as Parameters<typeof t>[0])}</Label>
            <Input
              value={key}
              onChangeText={(v) => setKey(v.toUpperCase())}
              placeholder="e.g. OBJECT"
              autoCapitalize="characters"
              maxLength={8}
              editable={isAddMode || !isProtected}
              autoCorrect={false}
            />
          </TextField>
          {keyError && (
            <Text className="mb-2 text-xs text-danger">
              {t(keyError.message as Parameters<typeof t>[0])}
            </Text>
          )}

          {/* Value Type Toggle */}
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xs text-muted">
              {t("header.valueType" as Parameters<typeof t>[0])}
            </Text>
            <Button size="sm" variant="outline" onPress={cycleType}>
              <Button.Label className="text-xs">{typeLabel}</Button.Label>
            </Button>
          </View>

          {/* Value */}
          {valueType === "boolean" ? (
            <View className="mb-3 flex-row items-center justify-between rounded-lg bg-surface-secondary px-3 py-2.5">
              <Text className="text-sm text-foreground">
                {t("header.valueLabel" as Parameters<typeof t>[0])}
              </Text>
              <Switch isSelected={boolValue} onSelectedChange={setBoolValue}>
                <Switch.Thumb />
              </Switch>
            </View>
          ) : (
            <TextField className="mb-3" isRequired>
              <Label>{t("header.valueLabel" as Parameters<typeof t>[0])}</Label>
              <Input
                value={rawValue}
                onChangeText={setRawValue}
                placeholder={valueType === "number" ? "e.g. 300" : "e.g. M42"}
                keyboardType={valueType === "number" ? "numeric" : "default"}
                autoCorrect={false}
              />
            </TextField>
          )}
          {valueError && (
            <Text className="mb-2 text-xs text-danger">
              {t(valueError.message as Parameters<typeof t>[0])}
            </Text>
          )}

          {/* Comment */}
          <TextField className="mb-4">
            <Label>{t("header.commentLabel" as Parameters<typeof t>[0])}</Label>
            <Input
              value={comment}
              onChangeText={setComment}
              placeholder="optional comment"
              autoCorrect={false}
            />
          </TextField>

          {/* Actions */}
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onPress={onClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button variant="primary" size="sm" onPress={handleSave} isDisabled={!canSave}>
              <Button.Label>{t("common.save")}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
