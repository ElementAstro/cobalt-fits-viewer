import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { Button, Card, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useCalendar } from "../../hooks/useCalendar";
import { useSettingsStore } from "../../stores/useSettingsStore";

interface PlanObservationSheetProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: Date;
}

const REMINDER_OPTIONS = [
  { value: 0, labelKey: "none" as const },
  { value: 15, labelKey: "min15" as const },
  { value: 30, labelKey: "min30" as const },
  { value: 60, labelKey: "hour1" as const },
  { value: 120, labelKey: "hour2" as const },
];

export function PlanObservationSheet({ visible, onClose, initialDate }: PlanObservationSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const { createObservationPlan, syncing } = useCalendar();
  const defaultReminderMinutes = useSettingsStore((s) => s.defaultReminderMinutes);

  const defaultStart = initialDate ?? new Date();
  defaultStart.setHours(20, 0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(23, 59, 0, 0);

  const [targetName, setTargetName] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState(defaultReminderMinutes);
  const [startDate] = useState(defaultStart);
  const [endDate] = useState(defaultEnd);

  const resetForm = () => {
    setTargetName("");
    setTitle("");
    setNotes("");
    setReminderMinutes(defaultReminderMinutes);
  };

  const handleCreate = async () => {
    if (!targetName.trim()) {
      Alert.alert(t("common.error"), t("sessions.targetName"));
      return;
    }

    const success = await createObservationPlan({
      title: title.trim() || targetName.trim(),
      targetName: targetName.trim(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      notes: notes.trim() || undefined,
      reminderMinutes,
    });

    if (success) {
      Alert.alert(t("common.success"), t("sessions.planCreated"));
      resetForm();
      onClose();
    }
  };

  if (!visible) return null;

  const formatDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const formatTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  return (
    <View className="absolute inset-0 z-50 bg-black/50">
      <View className="flex-1 justify-end">
        <View className="rounded-t-3xl bg-background px-4 pb-8 pt-4">
          {/* Handle */}
          <View className="mb-4 items-center">
            <View className="h-1 w-10 rounded-full bg-muted/40" />
          </View>

          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">
              {t("sessions.planObservation")}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={mutedColor} />
            </TouchableOpacity>
          </View>

          {/* Target Name */}
          <Text className="mb-1 text-xs font-medium text-muted">{t("sessions.targetName")} *</Text>
          <TextInput
            className="mb-3 rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-sm text-foreground"
            value={targetName}
            onChangeText={setTargetName}
            placeholder="e.g. M42, NGC 7000..."
            placeholderTextColor={mutedColor}
          />

          {/* Title (optional) */}
          <Text className="mb-1 text-xs font-medium text-muted">{t("sessions.planTitle")}</Text>
          <TextInput
            className="mb-3 rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-sm text-foreground"
            value={title}
            onChangeText={setTitle}
            placeholder={targetName || t("sessions.planTitle")}
            placeholderTextColor={mutedColor}
          />

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
                <Text className="text-xs font-medium text-foreground">{formatTime(startDate)}</Text>
              </View>
              <Separator className="my-1.5" />
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="time-outline" size={14} color={mutedColor} />
                  <Text className="text-xs text-muted">{t("sessions.endTime")}</Text>
                </View>
                <Text className="text-xs font-medium text-foreground">{formatTime(endDate)}</Text>
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
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setReminderMinutes(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 ${
                    isActive ? "border-primary bg-primary/10" : "border-border bg-surface-secondary"
                  }`}
                >
                  <Text
                    className={`text-xs ${isActive ? "font-semibold" : ""}`}
                    style={{ color: isActive ? accentColor : mutedColor }}
                  >
                    {t(`sessions.reminderOptions.${opt.labelKey}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notes */}
          <Text className="mb-1 text-xs font-medium text-muted">{t("sessions.notes")}</Text>
          <TextInput
            className="mb-4 rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-sm text-foreground"
            value={notes}
            onChangeText={setNotes}
            placeholder={t("sessions.notes")}
            placeholderTextColor={mutedColor}
            multiline
            numberOfLines={2}
          />

          {/* Create Button */}
          <Button
            onPress={handleCreate}
            isDisabled={syncing || !targetName.trim()}
            className="w-full"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="calendar" size={16} color="#fff" />
              <Text className="font-semibold text-white">
                {syncing ? t("common.loading") : t("sessions.createEvent")}
              </Text>
            </View>
          </Button>
        </View>
      </View>
    </View>
  );
}
