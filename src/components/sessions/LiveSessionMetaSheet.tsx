import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  BottomSheet,
  Button,
  Input,
  Label,
  Separator,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useChipInput, normalizeChipValues } from "../../hooks/common/useChipInput";
import { useEquipmentFields } from "../../hooks/sessions/useEquipmentFields";
import { useLocationFields } from "../../hooks/sessions/useLocationFields";
import { useSessionStore } from "../../stores/observation/useSessionStore";
import { ChipInputField } from "./ChipInputField";
import { EquipmentFields } from "./EquipmentFields";

interface LiveSessionMetaSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LiveSessionMetaSheet({ visible, onClose }: LiveSessionMetaSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const activeSession = useSessionStore((s) => s.activeSession);
  const updateActiveSessionDraft = useSessionStore((s) => s.updateActiveSessionDraft);
  const { addItem: addChipItem, removeItem: removeChipItem } = useChipInput();
  const equip = useEquipmentFields();
  const loc = useLocationFields();
  const { resetEquipment, buildEquipmentObject } = equip;
  const { resetLocation, useCurrentLocation: applyCurrentLocation, validateAndBuild } = loc;

  const [targets, setTargets] = useState<string[]>([]);
  const [targetInput, setTargetInput] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTargets(activeSession?.draftTargets ?? []);
    setTargetInput("");
    resetEquipment({
      telescope: activeSession?.draftEquipment?.telescope,
      camera: activeSession?.draftEquipment?.camera,
      mount: activeSession?.draftEquipment?.mount,
      filters: activeSession?.draftEquipment?.filters,
    });
    resetLocation(activeSession?.draftLocation);
  }, [visible, activeSession, resetEquipment, resetLocation]);

  const handleUseCurrentLocation = useCallback(() => {
    applyCurrentLocation(t);
  }, [applyCurrentLocation, t]);

  const handleSave = useCallback(() => {
    if (!activeSession) return;

    const draftLocation = validateAndBuild(t);
    if (draftLocation === null) return;

    const normalizedTargets = normalizeChipValues(targets, targetInput);
    const draftEquipment = buildEquipmentObject();

    updateActiveSessionDraft({
      draftTargets: normalizedTargets,
      draftEquipment,
      draftLocation,
    });
    onClose();
  }, [
    activeSession,
    targets,
    targetInput,
    validateAndBuild,
    buildEquipmentObject,
    updateActiveSessionDraft,
    onClose,
    t,
  ]);

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="mb-4 flex-row items-center justify-between">
            <BottomSheet.Title>{t("sessions.liveMeta")}</BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          <ScrollView className="max-h-[65vh]" showsVerticalScrollIndicator={false}>
            <ChipInputField
              label={t("targets.title")}
              items={targets}
              inputValue={targetInput}
              onInputChange={setTargetInput}
              onAdd={() => addChipItem(targetInput, targets, setTargets, setTargetInput)}
              onRemove={(target) => removeChipItem(target, targets, setTargets)}
              placeholder="e.g. M42, NGC 7000..."
            />

            <Separator className="mb-3" />

            <EquipmentFields
              telescope={equip.telescope}
              camera={equip.camera}
              mount={equip.mount}
              onTelescopeChange={equip.setTelescope}
              onCameraChange={equip.setCamera}
              onMountChange={equip.setMount}
            />

            <ChipInputField
              label={t("sessions.filters")}
              items={equip.filters}
              inputValue={equip.filterInput}
              onInputChange={equip.setFilterInput}
              onAdd={equip.addFilter}
              onRemove={equip.removeFilter}
              placeholder={t("sessions.filterPlaceholder")}
            />

            <Separator className="mb-3" />

            <View className="mb-4 rounded-lg bg-surface-secondary p-3">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-foreground">
                  {t("sessions.location")}
                </Text>
                <Button size="sm" variant="ghost" onPress={handleUseCurrentLocation}>
                  <Ionicons name="locate-outline" size={14} color={mutedColor} />
                  <Button.Label>{t("sessions.useCurrentLocation")}</Button.Label>
                </Button>
              </View>
              <TextField className="mb-3">
                <Label>{t("sessions.locationName")}</Label>
                <Input
                  value={loc.locationName}
                  onChangeText={loc.setLocationName}
                  placeholder={t("sessions.locationNamePlaceholder")}
                />
              </TextField>
              <View className="flex-row gap-2">
                <TextField className="flex-1">
                  <Label>{t("sessions.latitude")}</Label>
                  <Input
                    value={loc.latitudeInput}
                    onChangeText={loc.setLatitudeInput}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 39.9042"
                  />
                </TextField>
                <TextField className="flex-1">
                  <Label>{t("sessions.longitude")}</Label>
                  <Input
                    value={loc.longitudeInput}
                    onChangeText={loc.setLongitudeInput}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 116.4074"
                  />
                </TextField>
              </View>
            </View>
          </ScrollView>

          <View className="mt-2 flex-row items-center gap-2">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button className="flex-1" onPress={handleSave}>
              <Button.Label>{t("common.save")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
