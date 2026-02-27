import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
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
import { parseGeoCoordinate } from "../../lib/sessions/format";
import { useChipInput } from "../../hooks/useChipInput";
import { LocationService } from "../../hooks/useLocation";
import { useSessionStore } from "../../stores/useSessionStore";
import { ChipInputField } from "./ChipInputField";
import { EquipmentFields } from "./EquipmentFields";

interface LiveSessionMetaSheetProps {
  visible: boolean;
  onClose: () => void;
}

function dedupeValues(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}

export function LiveSessionMetaSheet({ visible, onClose }: LiveSessionMetaSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const activeSession = useSessionStore((s) => s.activeSession);
  const updateActiveSessionDraft = useSessionStore((s) => s.updateActiveSessionDraft);
  const { addItem: addChipItem, removeItem: removeChipItem } = useChipInput();

  const [targets, setTargets] = useState<string[]>([]);
  const [targetInput, setTargetInput] = useState("");
  const [telescope, setTelescope] = useState("");
  const [camera, setCamera] = useState("");
  const [mount, setMount] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [filterInput, setFilterInput] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTargets(activeSession?.draftTargets ?? []);
    setTargetInput("");
    setTelescope(activeSession?.draftEquipment?.telescope ?? "");
    setCamera(activeSession?.draftEquipment?.camera ?? "");
    setMount(activeSession?.draftEquipment?.mount ?? "");
    setFilters(activeSession?.draftEquipment?.filters ?? []);
    setFilterInput("");
    setLocationName(
      activeSession?.draftLocation?.placeName ??
        activeSession?.draftLocation?.city ??
        activeSession?.draftLocation?.region ??
        "",
    );
    setLatitudeInput(
      activeSession?.draftLocation?.latitude != null
        ? String(activeSession.draftLocation.latitude)
        : "",
    );
    setLongitudeInput(
      activeSession?.draftLocation?.longitude != null
        ? String(activeSession.draftLocation.longitude)
        : "",
    );
  }, [visible, activeSession]);

  const handleUseCurrentLocation = useCallback(async () => {
    const location = await LocationService.getCurrentLocation();
    if (!location) {
      Alert.alert(t("common.error"), t("sessions.locationPermissionFailed"));
      return;
    }

    setLocationName(location.placeName ?? location.city ?? location.region ?? "");
    setLatitudeInput(String(location.latitude));
    setLongitudeInput(String(location.longitude));
  }, [t]);

  const handleSave = useCallback(() => {
    if (!activeSession) return;

    const latitude = parseGeoCoordinate(latitudeInput, { min: -90, max: 90 });
    if (latitude === null) {
      Alert.alert(t("common.error"), t("sessions.invalidLatitude"));
      return;
    }
    const longitude = parseGeoCoordinate(longitudeInput, { min: -180, max: 180 });
    if (longitude === null) {
      Alert.alert(t("common.error"), t("sessions.invalidLongitude"));
      return;
    }

    const normalizedLocationName = locationName.trim();
    const hasAnyLocationField =
      normalizedLocationName.length > 0 || latitude !== undefined || longitude !== undefined;
    if (
      hasAnyLocationField &&
      (normalizedLocationName.length === 0 || latitude === undefined || longitude === undefined)
    ) {
      Alert.alert(t("common.error"), t("sessions.incompleteLocation"));
      return;
    }

    const normalizedTargets = dedupeValues([...targets, targetInput]);
    const normalizedFilters = dedupeValues([...filters, filterInput]);
    const draftEquipment = {
      ...(telescope.trim() ? { telescope: telescope.trim() } : {}),
      ...(camera.trim() ? { camera: camera.trim() } : {}),
      ...(mount.trim() ? { mount: mount.trim() } : {}),
      ...(normalizedFilters.length > 0 ? { filters: normalizedFilters } : {}),
    };
    const draftLocation =
      normalizedLocationName.length > 0 && latitude != null && longitude != null
        ? {
            latitude,
            longitude,
            placeName: normalizedLocationName,
          }
        : undefined;

    updateActiveSessionDraft({
      draftTargets: normalizedTargets,
      draftEquipment,
      draftLocation,
    });
    onClose();
  }, [
    activeSession,
    latitudeInput,
    longitudeInput,
    locationName,
    targets,
    targetInput,
    filters,
    filterInput,
    telescope,
    camera,
    mount,
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
              telescope={telescope}
              camera={camera}
              mount={mount}
              onTelescopeChange={setTelescope}
              onCameraChange={setCamera}
              onMountChange={setMount}
            />

            <ChipInputField
              label={t("sessions.filters")}
              items={filters}
              inputValue={filterInput}
              onInputChange={setFilterInput}
              onAdd={() => addChipItem(filterInput, filters, setFilters, setFilterInput)}
              onRemove={(filterName) => removeChipItem(filterName, filters, setFilters)}
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
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder={t("sessions.locationNamePlaceholder")}
                />
              </TextField>
              <View className="flex-row gap-2">
                <TextField className="flex-1">
                  <Label>{t("sessions.latitude")}</Label>
                  <Input
                    value={latitudeInput}
                    onChangeText={setLatitudeInput}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 39.9042"
                  />
                </TextField>
                <TextField className="flex-1">
                  <Label>{t("sessions.longitude")}</Label>
                  <Input
                    value={longitudeInput}
                    onChangeText={setLongitudeInput}
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
