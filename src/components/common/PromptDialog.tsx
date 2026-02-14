/**
 * 跨平台文本输入对话框 — 替代 iOS 专属的 Alert.prompt
 */

import { useState, useEffect } from "react";
import { View } from "react-native";
import { Button, Dialog, Input } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

interface PromptDialogProps {
  visible: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({
  visible,
  title,
  placeholder,
  defaultValue = "",
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
    }
  }, [visible, defaultValue]);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  return (
    <Dialog
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>{title}</Dialog.Title>
          <View className="mt-3">
            <Input
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              autoFocus
              onSubmitEditing={handleConfirm}
            />
          </View>
          <View className="mt-4 flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onPress={onCancel}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button variant="primary" size="sm" onPress={handleConfirm} isDisabled={!value.trim()}>
              <Button.Label>{t("common.confirm")}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
