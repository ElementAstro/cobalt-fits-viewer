import { useState, useCallback, useEffect, useMemo } from "react";
import { View, Text, Alert } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/common/useScreenOrientation";
import { formatTimeHHMM } from "../../lib/sessions/format";
import { findOverlappingPlans, toLocalDateKey } from "../../lib/sessions/planUtils";
import { useCalendar } from "../../hooks/sessions/useCalendar";
import { useEquipmentFields } from "../../hooks/sessions/useEquipmentFields";
import { useLocationFields } from "../../hooks/sessions/useLocationFields";
import { useSettingsStore } from "../../stores/app/useSettingsStore";
import { useTargetStore } from "../../stores/observation/useTargetStore";
import type { ObservationPlan } from "../../lib/fits/types";
import { resolveTargetId, resolveTargetName } from "../../lib/targets/targetRefs";
import { ChipInputField } from "./ChipInputField";
import { EquipmentFields } from "./EquipmentFields";

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

const DURATION_PRESETS = [
  { value: 60, labelKey: "h1" as const },
  { value: 120, labelKey: "h2" as const },
  { value: 180, labelKey: "h3" as const },
  { value: 240, labelKey: "h4" as const },
];

export function PlanObservationSheet({
  visible,
  onClose,
  initialDate,
  initialTargetName,
  existingPlan,
}: PlanObservationSheetProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const mutedColor = useThemeColor("muted");
  const { isLandscape } = useScreenOrientation();
  const compact = isLandscape;
  const { createObservationPlan, updateObservationPlan, plans, syncing } = useCalendar();
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
  const equip = useEquipmentFields({
    telescope: existingPlan?.equipment?.telescope,
    camera: existingPlan?.equipment?.camera,
    mount: existingPlan?.equipment?.mount,
    filters: existingPlan?.equipment?.filters,
  });
  const loc = useLocationFields(existingPlan?.location);
  const { resetEquipment } = equip;
  const { resetLocation, useCurrentLocation: applyCurrentLocation, validateAndBuild } = loc;

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
      resetEquipment({
        telescope: existingPlan.equipment?.telescope,
        camera: existingPlan.equipment?.camera,
        mount: existingPlan.equipment?.mount,
        filters: existingPlan.equipment?.filters,
      });
      resetLocation(existingPlan.location);
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
      resetEquipment();
      resetLocation();
    }
  }, [
    initialDate,
    initialTargetName,
    existingPlan,
    makeDefaultStart,
    makeDefaultEnd,
    defaultReminderMinutes,
    resetEquipment,
    resetLocation,
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

  const shiftPlanDays = useCallback((deltaDays: number) => {
    setStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaDays);
      return next;
    });
    setEndDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaDays);
      return next;
    });
  }, []);

  const applyDurationPreset = useCallback(
    (durationMinutes: number) => {
      setEndDate((prev) => {
        const next = new Date(startDate);
        next.setMinutes(next.getMinutes() + durationMinutes);
        if (next.getTime() <= startDate.getTime()) {
          return prev;
        }
        return next;
      });
    },
    [startDate],
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
    resetEquipment();
    resetLocation();
  };

  const handleUseCurrentLocation = useCallback(() => {
    applyCurrentLocation(t);
  }, [applyCurrentLocation, t]);

  const handleCreate = async () => {
    if (!targetName.trim()) {
      Alert.alert(t("common.error"), t("sessions.targetName"));
      return;
    }
    if (endDate.getTime() <= startDate.getTime()) {
      Alert.alert(t("common.error"), t("sessions.invalidTimeRange"));
      return;
    }

    const location = validateAndBuild(t);
    if (location === null) return;

    const equipment = equip.buildEquipmentObject();

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

    const draftPlanId = existingPlan?.id ?? "__draft__";
    const pendingConflicts = findOverlappingPlans(
      {
        id: draftPlanId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status,
      },
      plans,
    );
    const savePlan = async () => {
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
          location: location || undefined,
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
        location: location || undefined,
      });

      if (success) {
        Alert.alert(t("common.success"), t("sessions.planCreated"));
        resetForm();
        onClose();
      }
    };

    if (pendingConflicts.length === 0) {
      await savePlan();
      return;
    }
    const conflictNames = pendingConflicts
      .slice(0, 3)
      .map((conflict) => conflict.title || conflict.targetName)
      .join(", ");
    const moreCount = Math.max(0, pendingConflicts.length - 3);
    const summary = moreCount > 0 ? `${conflictNames} +${moreCount}` : conflictNames;
    Alert.alert(
      t("sessions.planConflictTitle"),
      `${t("sessions.planConflictSavePrompt")} (${summary})`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("sessions.planConflictSaveAnyway"),
          style: "destructive",
          onPress: () => {
            void savePlan();
          },
        },
      ],
    );
  };

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
  const draftConflicts = useMemo(
    () =>
      findOverlappingPlans(
        {
          id: existingPlan?.id ?? "__draft__",
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          status,
        },
        plans,
      ),
    [existingPlan?.id, plans, startDate, endDate, status],
  );

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={compact ? ["95%"] : ["82%", "96%"]}
          index={compact ? 0 : 1}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enableContentPanningGesture={false}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          contentContainerClassName="h-full"
        >
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <BottomSheet.Title>
              {isEditMode ? t("sessions.editPlan") : t("sessions.planObservation")}
            </BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          <BottomSheetScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + (compact ? 8 : 16) }}
          >
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
                  <View className="flex-row items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      onPress={() => shiftPlanDays(-1)}
                      accessibilityLabel={t("sessions.shiftDayBackward")}
                    >
                      <Ionicons name="chevron-back-outline" size={12} color={mutedColor} />
                    </Button>
                    <Text className="text-xs font-medium text-foreground">
                      {toLocalDateKey(startDate)}
                    </Text>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      onPress={() => shiftPlanDays(1)}
                      accessibilityLabel={t("sessions.shiftDayForward")}
                    >
                      <Ionicons name="chevron-forward-outline" size={12} color={mutedColor} />
                    </Button>
                  </View>
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
                      {formatTimeHHMM(startDate)}
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
                      {formatTimeHHMM(endDate)}
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
                <Separator className="my-1.5" />
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="text-xs text-muted">{t("sessions.quickDuration")}</Text>
                  <View className="flex-row flex-wrap justify-end gap-1.5">
                    {DURATION_PRESETS.map((preset) => (
                      <Chip
                        key={preset.value}
                        size="sm"
                        variant="secondary"
                        onPress={() => applyDurationPreset(preset.value)}
                      >
                        <Chip.Label className="text-[9px]">
                          {t(`sessions.durationPresets.${preset.labelKey}`)}
                        </Chip.Label>
                      </Chip>
                    ))}
                  </View>
                </View>
              </Card.Body>
            </Card>
            {draftConflicts.length > 0 && (
              <Card variant="secondary" className="mb-3 border border-danger/40">
                <Card.Body className="flex-row items-center gap-2 px-3 py-2">
                  <Ionicons name="warning-outline" size={14} color="#ef4444" />
                  <Text className="text-xs text-danger">
                    {t("sessions.planConflictDetected")} ({draftConflicts.length})
                  </Text>
                </Card.Body>
              </Card>
            )}

            {/* Equipment & Location */}
            <View className={compact ? "flex-row gap-3 mb-3" : ""}>
              <Card variant="secondary" className={compact ? "flex-1" : "mb-3"}>
                <Card.Body className={compact ? "gap-2 p-2" : "gap-3 p-3"}>
                  <Text className="text-xs font-semibold text-foreground">
                    {t("sessions.equipment")}
                  </Text>
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
                </Card.Body>
              </Card>

              <Card variant="secondary" className={compact ? "flex-1" : "mb-3"}>
                <Card.Body className={compact ? "gap-2 p-2" : "gap-3 p-3"}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-semibold text-foreground">
                      {t("sessions.location")}
                    </Text>
                    <Button size="sm" variant="ghost" onPress={handleUseCurrentLocation}>
                      <Ionicons name="locate-outline" size={14} color={mutedColor} />
                      {!compact && <Button.Label>{t("sessions.useCurrentLocation")}</Button.Label>}
                    </Button>
                  </View>
                  <TextField>
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
                        placeholder="e.g. 39.9042"
                        keyboardType="decimal-pad"
                      />
                    </TextField>
                    <TextField className="flex-1">
                      <Label>{t("sessions.longitude")}</Label>
                      <Input
                        value={loc.longitudeInput}
                        onChangeText={loc.setLongitudeInput}
                        placeholder="e.g. 116.4074"
                        keyboardType="decimal-pad"
                      />
                    </TextField>
                  </View>
                </Card.Body>
              </Card>
            </View>

            {/* Reminder & Status */}
            <View className={compact ? "flex-row gap-4 mb-3" : ""}>
              <View className={compact ? "flex-1" : ""}>
                <Text className="mb-1.5 text-xs font-medium text-muted">
                  {t("sessions.reminderTime")}
                </Text>
                <View className={`${compact ? "mb-0" : "mb-3"} flex-row flex-wrap gap-2`}>
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
              </View>

              <View className={compact ? "flex-1" : ""}>
                <Text className="mb-1.5 text-xs font-medium text-muted">
                  {t("sessions.planStatus")}
                </Text>
                <View className={`${compact ? "mb-0" : "mb-3"} flex-row flex-wrap gap-2`}>
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
              </View>
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
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
