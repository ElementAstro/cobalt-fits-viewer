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
        <Label>{t("sessions.telescope")}</Label>
        <Input
          value={telescope}
          onChangeText={onTelescopeChange}
          placeholder={t("sessions.telescopePlaceholder")}
        />
      </TextField>
      <TextField className="mb-3">
        <Label>{t("sessions.camera")}</Label>
        <Input
          value={camera}
          onChangeText={onCameraChange}
          placeholder={t("sessions.cameraPlaceholder")}
        />
      </TextField>
      <TextField className="mb-3">
        <Label>{t("sessions.mount")}</Label>
        <Input
          value={mount}
          onChangeText={onMountChange}
          placeholder={t("sessions.mountPlaceholder")}
        />
      </TextField>
    </>
  );
});
