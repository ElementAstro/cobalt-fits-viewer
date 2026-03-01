/**
 * 设备推荐编辑组件
 */

import { useEffect, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Dialog, Input, Label, Separator, TextField } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { RecommendedEquipment } from "../../lib/fits/types";

interface EquipmentRecommendationsProps {
  visible: boolean;
  equipment?: RecommendedEquipment;
  onClose: () => void;
  onSave: (equipment: RecommendedEquipment) => void;
}

export function EquipmentRecommendations({
  visible,
  equipment,
  onClose,
  onSave,
}: EquipmentRecommendationsProps) {
  const { t } = useI18n();

  const [telescope, setTelescope] = useState(equipment?.telescope ?? "");
  const [camera, setCamera] = useState(equipment?.camera ?? "");
  const [filtersText, setFiltersText] = useState(equipment?.filters?.join(", ") ?? "");
  const [notes, setNotes] = useState(equipment?.notes ?? "");

  useEffect(() => {
    if (!visible) return;
    setTelescope(equipment?.telescope ?? "");
    setCamera(equipment?.camera ?? "");
    setFiltersText(equipment?.filters?.join(", ") ?? "");
    setNotes(equipment?.notes ?? "");
  }, [visible, equipment]);

  const handleSave = () => {
    const filters = filtersText
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    onSave({
      telescope: telescope.trim() || undefined,
      camera: camera.trim() || undefined,
      filters: filters.length > 0 ? filters : undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const handleReset = () => {
    setTelescope(equipment?.telescope ?? "");
    setCamera(equipment?.camera ?? "");
    setFiltersText(equipment?.filters?.join(", ") ?? "");
    setNotes(equipment?.notes ?? "");
  };

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-4 w-full max-w-md rounded-2xl bg-background p-6 max-h-[85%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between mb-4">
              <Dialog.Title>{t("targets.equipment.title")}</Dialog.Title>
              <Dialog.Close />
            </View>

            {/* Telescope */}
            <TextField>
              <Label>{t("targets.equipment.telescope")}</Label>
              <Input
                placeholder={t("targets.equipment.telescopePlaceholder")}
                value={telescope}
                onChangeText={setTelescope}
                autoCorrect={false}
              />
            </TextField>

            {/* Camera */}
            <TextField className="mt-4">
              <Label>{t("targets.equipment.camera")}</Label>
              <Input
                placeholder={t("targets.equipment.cameraPlaceholder")}
                value={camera}
                onChangeText={setCamera}
                autoCorrect={false}
              />
            </TextField>

            {/* Filters */}
            <TextField className="mt-4">
              <Label>{t("targets.equipment.filters")}</Label>
              <Input
                placeholder={t("targets.equipment.filtersPlaceholder")}
                value={filtersText}
                onChangeText={setFiltersText}
                autoCorrect={false}
              />
              <Text className="text-[10px] text-muted mt-1">
                {t("targets.equipment.filtersHint")}
              </Text>
            </TextField>

            {/* Notes */}
            <TextField className="mt-4">
              <Label>{t("targets.equipment.notes")}</Label>
              <Input
                placeholder={t("targets.equipment.notesPlaceholder")}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </TextField>

            <Separator className="my-4" />

            {/* Actions */}
            <View className="flex-row justify-between">
              <Button variant="ghost" onPress={handleReset}>
                <Button.Label>{t("common.reset")}</Button.Label>
              </Button>
              <View className="flex-row gap-2">
                <Button variant="outline" onPress={onClose}>
                  <Button.Label>{t("common.cancel")}</Button.Label>
                </Button>
                <Button variant="primary" onPress={handleSave}>
                  <Button.Label>{t("common.save")}</Button.Label>
                </Button>
              </View>
            </View>
          </ScrollView>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
