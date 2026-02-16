import { useState, useCallback, useEffect } from "react";
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
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { ObservationPlan } from "../../lib/fits/types";

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

  useEffect(() => {
    if (existingPlan) {
      setTargetName(existingPlan.targetName);
      setTitle(existingPlan.title);
      setNotes(existingPlan.notes ?? "");
      setStatus(existingPlan.status ?? "planned");
      setReminderMinutes(existingPlan.reminderMinutes);
      setStartDate(new Date(existingPlan.startDate));
      setEndDate(new Date(existingPlan.endDate));
    } else {
      const s = makeDefaultStart(initialDate);
      setTargetName(initialTargetName ?? "");
      setTitle("");
      setNotes("");
      setStatus("planned");
      setReminderMinutes(defaultReminderMinutes);
      setStartDate(s);
      setEndDate(makeDefaultEnd(s));
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

  const resetForm = () => {
    setTargetName("");
    setTitle("");
    setNotes("");
    setStatus("planned");
    setReminderMinutes(defaultReminderMinutes);
    const s = makeDefaultStart(initialDate);
    setStartDate(s);
    setEndDate(makeDefaultEnd(s));
  };

  const handleCreate = async () => {
    if (!targetName.trim()) {
      Alert.alert(t("common.error"), t("sessions.targetName"));
      return;
    }
    if (endDate.getTime() <= startDate.getTime()) {
      Alert.alert(t("common.error"), t("sessions.invalidTimeRange"));
      return;
    }

    if (isEditMode && existingPlan) {
      const success = await updateObservationPlan(existingPlan.id, {
        title: title.trim() || targetName.trim(),
        targetName: targetName.trim(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        notes: notes.trim() || undefined,
        status,
        reminderMinutes,
      });
      if (success) {
        Alert.alert(t("common.success"), t("sessions.planUpdated"));
        onClose();
      }
      return;
    }

    const success = await createObservationPlan({
      title: title.trim() || targetName.trim(),
      targetName: targetName.trim(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      notes: notes.trim() || undefined,
      status,
      reminderMinutes,
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
              onChangeText={setTargetName}
              placeholder="e.g. M42, NGC 7000..."
            />
          </TextField>

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
