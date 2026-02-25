import { memo } from "react";
import { Input, Label, TextField } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

interface EquipmentFieldsProps {
  telescope: string;
  camera: string;
  mount: string;
  onTelescopeChange: (value: string) => void;
  onCameraChange: (value: string) => void;
  onMountChange: (value: string) => void;
}

export const EquipmentFields = memo(function EquipmentFields({
  telescope,
  camera,
  mount,
  onTelescopeChange,
  onCameraChange,
  onMountChange,
}: EquipmentFieldsProps) {
  const { t } = useI18n();

  return (
    <>
      <TextField className="mb-3">
        <Label>{t("sessions.equipment")}: Telescope</Label>
        <Input
          value={telescope}
          onChangeText={onTelescopeChange}
          placeholder="e.g. Sky-Watcher 200P"
        />
      </TextField>
      <TextField className="mb-3">
        <Label>{t("sessions.equipment")}: Camera</Label>
        <Input value={camera} onChangeText={onCameraChange} placeholder="e.g. ZWO ASI294MC Pro" />
      </TextField>
      <TextField className="mb-3">
        <Label>{t("sessions.equipment")}: Mount</Label>
        <Input value={mount} onChangeText={onMountChange} placeholder="e.g. EQ6-R Pro" />
      </TextField>
    </>
  );
});
