import { useState } from "react";
import { View } from "react-native";
import { Button, Dialog, Input, TextArea, TextField } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

interface CreateAlbumModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (name: string, description?: string) => void;
}

export function CreateAlbumModal({ visible, onClose, onConfirm }: CreateAlbumModalProps) {
  const { t } = useI18n();
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
    <Dialog
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>{t("gallery.createAlbum")}</Dialog.Title>

          <View className="mt-4 gap-3">
            <TextField>
              <Input
                placeholder={t("gallery.albumName")}
                value={name}
                onChangeText={setName}
                autoFocus
                autoCorrect={false}
              />
            </TextField>

            <TextField>
              <TextArea
                placeholder={t("gallery.albumDescription")}
                value={description}
                onChangeText={setDescription}
                numberOfLines={2}
                autoCorrect={false}
              />
            </TextField>
          </View>

          <View className="mt-4 flex-row justify-end gap-2">
            <Button variant="outline" onPress={handleClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button variant="primary" onPress={handleConfirm} isDisabled={!name.trim()}>
              <Button.Label>{t("common.confirm")}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
