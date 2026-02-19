import { useState, useCallback, useEffect, useMemo } from "react";
import { View, Text, Alert } from "react-native";
import {
  BottomSheet,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Separator,
  TextArea,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useCalendar } from "../../hooks/useCalendar";
import { LocationService } from "../../hooks/useLocation";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useTargetStore } from "../../stores/useTargetStore";
import type { ObservationPlan } from "../../lib/fits/types";
import { resolveTargetId, resolveTargetName } from "../../lib/targets/targetRefs";

interface PlanObservationSheetProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialTargetName?: string;
  existingPlan?: ObservationPlan;
}

const REMINDER_OPTIONS = [
  { value: 0, labelKey: "none" as const },
  { value: 15, labelKey: "min15" as const },
  { value: 30, labelKey: "min30" as const },
  { value: 60, labelKey: "hour1" as const },
  { value: 120, labelKey: "hour2" as const },
];

export function PlanObservationSheet({
  visible,
  onClose,
  initialDate,
  initialTargetName,
  existingPlan,
}: PlanObservationSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { createObservationPlan, updateObservationPlan, syncing } = useCalendar();
  const defaultReminderMinutes = useSettingsStore((s) => s.defaultReminderMinutes);
  const targetCatalog = useTargetStore((s) => s.targets);
  const isEditMode = !!existingPlan;

  const makeDefaultStart = useCallback((base?: Date) => {
    const d = base ? new Date(base) : new Date();
    d.setHours(20, 0, 0, 0);
    return d;
  }, []);

  const makeDefaultEnd = useCallback((start: Date) => {
    const d = new Date(start);
    d.setHours(23, 59, 0, 0);
    return d;
  }, []);

  const [targetName, setTargetName] = useState(existingPlan?.targetName ?? initialTargetName ?? "");
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(
    existingPlan?.targetId,
  );
  const [title, setTitle] = useState(existingPlan?.title ?? "");
  const [notes, setNotes] = useState(existingPlan?.notes ?? "");
  const [status, setStatus] = useState<"planned" | "completed" | "cancelled">(
    existingPlan?.status ?? "planned",
  );
  const [reminderMinutes, setReminderMinutes] = useState(
    existingPlan?.reminderMinutes ?? defaultReminderMinutes,
  );
  const [startDate, setStartDate] = useState(() =>
    existingPlan ? new Date(existingPlan.startDate) : makeDefaultStart(initialDate),
  );
  const [endDate, setEndDate] = useState(() =>
    existingPlan ? new Date(existingPlan.endDate) : makeDefaultEnd(makeDefaultStart(initialDate)),
  );
  const [telescope, setTelescope] = useState(existingPlan?.equipment?.telescope ?? "");
  const [camera, setCamera] = useState(existingPlan?.equipment?.camera ?? "");
  const [mount, setMount] = useState(existingPlan?.equipment?.mount ?? "");
  const [filters, setFilters] = useState<string[]>(existingPlan?.equipment?.filters ?? []);
  const [filterInput, setFilterInput] = useState("");
  const [locationName, setLocationName] = useState(existingPlan?.location?.placeName ?? "");
  const [latitudeInput, setLatitudeInput] = useState(
    existingPlan?.location?.latitude != null ? String(existingPlan.location.latitude) : "",
  );
  const [longitudeInput, setLongitudeInput] = useState(
    existingPlan?.location?.longitude != null ? String(existingPlan.location.longitude) : "",
  );

  useEffect(() => {
    if (existingPlan) {
      setTargetName(existingPlan.targetName);
      setSelectedTargetId(existingPlan.targetId);
      setTitle(existingPlan.title);
      setNotes(existingPlan.notes ?? "");
      setStatus(existingPlan.status ?? "planned");
      setReminderMinutes(existingPlan.reminderMinutes);
      setStartDate(new Date(existingPlan.startDate));
      setEndDate(new Date(existingPlan.endDate));
      setTelescope(existingPlan.equipment?.telescope ?? "");
      setCamera(existingPlan.equipment?.camera ?? "");
      setMount(existingPlan.equipment?.mount ?? "");
      setFilters(existingPlan.equipment?.filters ?? []);
      setFilterInput("");
      setLocationName(existingPlan.location?.placeName ?? "");
      setLatitudeInput(
        existingPlan.location?.latitude != null ? String(existingPlan.location.latitude) : "",
      );
      setLongitudeInput(
        existingPlan.location?.longitude != null ? String(existingPlan.location.longitude) : "",
      );
    } else {
      const s = makeDefaultStart(initialDate);
      setTargetName(initialTargetName ?? "");
      setSelectedTargetId(undefined);
      setTitle("");
      setNotes("");
      setStatus("planned");
      setReminderMinutes(defaultReminderMinutes);
      setStartDate(s);
      setEndDate(makeDefaultEnd(s));
      setTelescope("");
      setCamera("");
      setMount("");
      setFilters([]);
      setFilterInput("");
      setLocationName("");
      setLatitudeInput("");
      setLongitudeInput("");
    }
  }, [
    initialDate,
    initialTargetName,
    existingPlan,
    makeDefaultStart,
    makeDefaultEnd,
    defaultReminderMinutes,
  ]);

  const adjustTime = useCallback(
    (target: "start" | "end", field: "hour" | "minute", delta: number) => {
      const setter = target === "start" ? setStartDate : setEndDate;
      setter((prev) => {
        const d = new Date(prev);
        if (field === "hour") d.setHours(d.getHours() + delta);
        else d.setMinutes(d.getMinutes() + delta);
        return d;
      });
    },
    [],
  );

  const addChipItem = useCallback(
    (
      value: string,
      list: string[],
      setter: (next: string[]) => void,
      inputSetter: (next: string) => void,
    ) => {
      const trimmed = value.trim();
      if (trimmed && !list.includes(trimmed)) {
        setter([...list, trimmed]);
      }
      inputSetter("");
    },
    [],
  );

  const removeChipItem = useCallback(
    (value: string, list: string[], setter: (next: string[]) => void) => {
      setter(list.filter((item) => item !== value));
    },
    [],
  );

  const resetForm = () => {
    setTargetName("");
    setSelectedTargetId(undefined);
    setTitle("");
    setNotes("");
    setStatus("planned");
    setReminderMinutes(defaultReminderMinutes);
    const s = makeDefaultStart(initialDate);
    setStartDate(s);
    setEndDate(makeDefaultEnd(s));
    setTelescope("");
    setCamera("");
    setMount("");
    setFilters([]);
    setFilterInput("");
    setLocationName("");
    setLatitudeInput("");
    setLongitudeInput("");
  };

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

  const handleCreate = async () => {
    if (!targetName.trim()) {
      Alert.alert(t("common.error"), t("sessions.targetName"));
      return;
    }
    if (endDate.getTime() <= startDate.getTime()) {
      Alert.alert(t("common.error"), t("sessions.invalidTimeRange"));
      return;
    }

    const parseCoordinate = (
      rawValue: string,
      range: { min: number; max: number },
    ): number | undefined | null => {
      const trimmed = rawValue.trim();
      if (!trimmed) return undefined;
      const value = Number(trimmed);
      if (!Number.isFinite(value)) return null;
      if (value < range.min || value > range.max) return null;
      return value;
    };

    const latitude = parseCoordinate(latitudeInput, { min: -90, max: 90 });
    if (latitude === null) {
      Alert.alert(t("common.error"), t("sessions.invalidLatitude"));
      return;
    }
    const longitude = parseCoordinate(longitudeInput, { min: -180, max: 180 });
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

    const normalizedFilters = [
      ...new Set([...filters, filterInput].map((item) => item.trim()).filter(Boolean)),
    ];
    const equipment = {
      ...(telescope.trim() ? { telescope: telescope.trim() } : {}),
      ...(camera.trim() ? { camera: camera.trim() } : {}),
      ...(mount.trim() ? { mount: mount.trim() } : {}),
      ...(normalizedFilters.length > 0 ? { filters: normalizedFilters } : {}),
    };
    const location =
      normalizedLocationName && latitude != null && longitude != null
        ? {
            latitude,
            longitude,
            placeName: normalizedLocationName,
          }
        : undefined;

    const resolvedTargetId =
      selectedTargetId ??
      resolveTargetId(
        {
          name: targetName.trim(),
        },
        targetCatalog,
      );
    const resolvedTargetName = resolveTargetName(
      { targetId: resolvedTargetId, name: targetName.trim() },
      targetCatalog,
    );

    if (isEditMode && existingPlan) {
      const success = await updateObservationPlan(existingPlan.id, {
        title: title.trim() || resolvedTargetName,
        targetId: resolvedTargetId,
        targetName: resolvedTargetName,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        notes: notes.trim() || undefined,
        status,
        reminderMinutes,
        equipment: Object.keys(equipment).length > 0 ? equipment : undefined,
        location,
      });
      if (success) {
        Alert.alert(t("common.success"), t("sessions.planUpdated"));
        onClose();
      }
      return;
    }

    const success = await createObservationPlan({
      title: title.trim() || resolvedTargetName,
      targetId: resolvedTargetId,
      targetName: resolvedTargetName,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      notes: notes.trim() || undefined,
      status,
      reminderMinutes,
      equipment: Object.keys(equipment).length > 0 ? equipment : undefined,
      location,
    });

    if (success) {
      Alert.alert(t("common.success"), t("sessions.planCreated"));
      resetForm();
      onClose();
    }
  };

  const formatDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const formatTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  const targetSuggestions = useMemo(() => {
    const q = targetName.trim().toLowerCase();
    if (!q) return targetCatalog.slice(0, 5);
    return targetCatalog
      .filter(
        (target) =>
          target.name.toLowerCase().includes(q) ||
          target.aliases.some((alias) => alias.toLowerCase().includes(q)),
      )
      .slice(0, 5);
  }, [targetCatalog, targetName]);

  const selectedTargetName = selectedTargetId
    ? targetCatalog.find((target) => target.id === selectedTargetId)?.name
    : undefined;

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
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <BottomSheet.Title>
              {isEditMode ? t("sessions.editPlan") : t("sessions.planObservation")}
            </BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          {/* Target Name */}
          <TextField isRequired className="mb-3">
            <Label>{t("sessions.targetName")}</Label>
            <Input
              value={targetName}
              onChangeText={(value) => {
                setTargetName(value);
                if (
                  selectedTargetId &&
                  selectedTargetName &&
                  selectedTargetName.toLowerCase() !== value.trim().toLowerCase()
                ) {
                  setSelectedTargetId(undefined);
                }
              }}
              placeholder="e.g. M42, NGC 7000..."
            />
          </TextField>
          {targetSuggestions.length > 0 && (
            <View className="mb-3 flex-row flex-wrap gap-2">
              {targetSuggestions.map((target) => (
                <Chip
                  key={target.id}
                  size="sm"
                  variant={selectedTargetId === target.id ? "primary" : "secondary"}
                  onPress={() => {
                    setSelectedTargetId(target.id);
                    setTargetName(target.name);
                  }}
                >
                  <Chip.Label className="text-[9px]">{target.name}</Chip.Label>
                </Chip>
              ))}
            </View>
          )}

          {/* Title (optional) */}
          <TextField className="mb-3">
            <Label>{t("sessions.planTitle")}</Label>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder={targetName || t("sessions.planTitle")}
            />
          </TextField>

          {/* Date & Time Info */}
          <Card variant="secondary" className="mb-3">
            <Card.Body className="px-3 py-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={14} color={mutedColor} />
                  <Text className="text-xs text-muted">{t("sessions.plannedDate")}</Text>
                </View>
                <Text className="text-xs font-medium text-foreground">{formatDate(startDate)}</Text>
              </View>
              <Separator className="my-1.5" />
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="time-outline" size={14} color={mutedColor} />
                  <Text className="text-xs text-muted">{t("sessions.startTime")}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("start", "hour", -1)}
                  >
                    <Ionicons name="remove" size={12} color={mutedColor} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("start", "minute", -5)}
                  >
                    <Ionicons name="play-back-outline" size={11} color={mutedColor} />
                  </Button>
                  <Text className="text-xs font-medium text-foreground w-12 text-center">
                    {formatTime(startDate)}
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("start", "minute", 5)}
                  >
                    <Ionicons name="play-forward-outline" size={11} color={mutedColor} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("start", "hour", 1)}
                  >
                    <Ionicons name="add" size={12} color={mutedColor} />
                  </Button>
                </View>
              </View>
              <Separator className="my-1.5" />
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="time-outline" size={14} color={mutedColor} />
                  <Text className="text-xs text-muted">{t("sessions.endTime")}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("end", "hour", -1)}
                  >
                    <Ionicons name="remove" size={12} color={mutedColor} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("end", "minute", -5)}
                  >
                    <Ionicons name="play-back-outline" size={11} color={mutedColor} />
                  </Button>
                  <Text className="text-xs font-medium text-foreground w-12 text-center">
                    {formatTime(endDate)}
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("end", "minute", 5)}
                  >
                    <Ionicons name="play-forward-outline" size={11} color={mutedColor} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("end", "hour", 1)}
                  >
                    <Ionicons name="add" size={12} color={mutedColor} />
                  </Button>
                </View>
              </View>
            </Card.Body>
          </Card>

          {/* Equipment */}
          <Card variant="secondary" className="mb-3">
            <Card.Body className="gap-3 p-3">
              <Text className="text-xs font-semibold text-foreground">
                {t("sessions.equipment")}
              </Text>
              <TextField>
                <Label>{t("sessions.telescope")}</Label>
                <Input
                  value={telescope}
                  onChangeText={setTelescope}
                  placeholder={t("sessions.telescopePlaceholder")}
                />
              </TextField>
              <TextField>
                <Label>{t("sessions.camera")}</Label>
                <Input
                  value={camera}
                  onChangeText={setCamera}
                  placeholder={t("sessions.cameraPlaceholder")}
                />
              </TextField>
              <TextField>
                <Label>{t("sessions.mount")}</Label>
                <Input
                  value={mount}
                  onChangeText={setMount}
                  placeholder={t("sessions.mountPlaceholder")}
                />
              </TextField>
              <View>
                <Text className="mb-1 text-[11px] font-medium text-muted">
                  {t("sessions.filters")}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Input
                    className="flex-1"
                    value={filterInput}
                    onChangeText={setFilterInput}
                    onSubmitEditing={() =>
                      addChipItem(filterInput, filters, setFilters, setFilterInput)
                    }
                    placeholder={t("sessions.filterPlaceholder")}
                    returnKeyType="done"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => addChipItem(filterInput, filters, setFilters, setFilterInput)}
                  >
                    <Button.Label>{t("sessions.addFilter")}</Button.Label>
                  </Button>
                </View>
                {filters.length > 0 && (
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {filters.map((item) => (
                      <Chip
                        key={item}
                        size="sm"
                        variant="secondary"
                        onPress={() => removeChipItem(item, filters, setFilters)}
                      >
                        <Chip.Label>{item}</Chip.Label>
                      </Chip>
                    ))}
                  </View>
                )}
              </View>
            </Card.Body>
          </Card>

          {/* Location */}
          <Card variant="secondary" className="mb-3">
            <Card.Body className="gap-3 p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-foreground">
                  {t("sessions.location")}
                </Text>
                <Button size="sm" variant="ghost" onPress={handleUseCurrentLocation}>
                  <Ionicons name="locate-outline" size={14} color={mutedColor} />
                  <Button.Label>{t("sessions.useCurrentLocation")}</Button.Label>
                </Button>
              </View>
              <TextField>
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
                    placeholder="e.g. 39.9042"
                    keyboardType="decimal-pad"
                  />
                </TextField>
                <TextField className="flex-1">
                  <Label>{t("sessions.longitude")}</Label>
                  <Input
                    value={longitudeInput}
                    onChangeText={setLongitudeInput}
                    placeholder="e.g. 116.4074"
                    keyboardType="decimal-pad"
                  />
                </TextField>
              </View>
            </Card.Body>
          </Card>

          {/* Reminder */}
          <Text className="mb-1.5 text-xs font-medium text-muted">
            {t("sessions.reminderTime")}
          </Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {REMINDER_OPTIONS.map((opt) => {
              const isActive = reminderMinutes === opt.value;
              return (
                <Chip
                  key={opt.value}
                  size="sm"
                  variant={isActive ? "primary" : "secondary"}
                  color={isActive ? "accent" : "default"}
                  onPress={() => setReminderMinutes(opt.value)}
                >
                  <Chip.Label>{t(`sessions.reminderOptions.${opt.labelKey}`)}</Chip.Label>
                </Chip>
              );
            })}
          </View>

          {/* Status */}
          <Text className="mb-1.5 text-xs font-medium text-muted">{t("sessions.planStatus")}</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {(["planned", "completed", "cancelled"] as const).map((s) => {
              const isActive = status === s;
              return (
                <Chip
                  key={s}
                  size="sm"
                  variant={isActive ? "primary" : "secondary"}
                  onPress={() => setStatus(s)}
                >
                  <Chip.Label>{t(`sessions.status.${s}`)}</Chip.Label>
                </Chip>
              );
            })}
          </View>

          {/* Notes */}
          <TextField className="mb-4">
            <Label>{t("sessions.notes")}</Label>
            <TextArea
              value={notes}
              onChangeText={setNotes}
              placeholder={t("sessions.notes")}
              numberOfLines={2}
            />
          </TextField>

          {/* Create Button */}
          <Button
            onPress={handleCreate}
            isDisabled={syncing || !targetName.trim()}
            className="w-full"
          >
            <Ionicons name="calendar" size={16} color="#fff" />
            <Button.Label>
              {syncing
                ? t("common.loading")
                : isEditMode
                  ? t("common.save")
                  : t("sessions.createEvent")}
            </Button.Label>
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
