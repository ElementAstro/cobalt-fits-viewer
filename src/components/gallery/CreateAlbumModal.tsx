import { useState } from "react";
import { View, Text, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

interface CreateAlbumModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (name: string, description?: string) => void;
}

export function CreateAlbumModal({ visible, onClose, onConfirm }: CreateAlbumModalProps) {
  const { t } = useI18n();
  const [mutedColor] = useThemeColor(["muted"]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, description.trim() || undefined);
    setName("");
    setDescription("");
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 items-center justify-center bg-black/60"
      >
        <View className="mx-6 w-full max-w-sm rounded-2xl bg-surface-secondary p-6">
          <Text className="text-lg font-bold text-foreground">{t("gallery.createAlbum")}</Text>

          <TextInput
            className="mt-4 rounded-xl border border-separator bg-background px-4 py-3 text-sm text-foreground"
            placeholder={t("gallery.albumName")}
            placeholderTextColor={mutedColor}
            value={name}
            onChangeText={setName}
            autoFocus
            autoCorrect={false}
          />

          <TextInput
            className="mt-3 rounded-xl border border-separator bg-background px-4 py-3 text-sm text-foreground"
            placeholder={t("gallery.albumDescription")}
            placeholderTextColor={mutedColor}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
            autoCorrect={false}
          />

          <View className="mt-4 flex-row justify-end gap-2">
            <Button variant="outline" onPress={handleClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button variant="primary" onPress={handleConfirm} isDisabled={!name.trim()}>
              <Button.Label>{t("common.confirm")}</Button.Label>
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
