import { useState } from "react";
import { View, Text, Alert } from "react-native";
import {
  BottomSheet,
  Button,
  Input,
  Label,
  Separator,
  TextArea,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { ObservationSession } from "../../lib/fits/types";

interface EditSessionSheetProps {
  visible: boolean;
  session: ObservationSession;
  onClose: () => void;
  onSave: (updates: Partial<ObservationSession>) => void;
  onDelete: () => void;
}

export function EditSessionSheet({
  visible,
  session,
  onClose,
  onSave,
  onDelete,
}: EditSessionSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const [notes, setNotes] = useState(session.notes ?? "");
  const [weather, setWeather] = useState(session.weather ?? "");
  const [seeing, setSeeing] = useState(session.seeing ?? "");

  const handleSave = () => {
    onSave({
      notes: notes.trim() || undefined,
      weather: weather.trim() || undefined,
      seeing: seeing.trim() || undefined,
    });
  };

  const handleDelete = () => {
    Alert.alert(t("sessions.deleteSession"), t("sessions.deleteSessionConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: onDelete,
      },
    ]);
  };

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
            <BottomSheet.Title>{t("sessions.editSession")}</BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          {/* Session Info (read-only) */}
          <View className="mb-3 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
            <Ionicons name="calendar-outline" size={14} color={mutedColor} />
            <Text className="text-xs text-foreground">{session.date}</Text>
            <Text className="text-xs text-muted">·</Text>
            <Ionicons name="time-outline" size={14} color={mutedColor} />
            <Text className="text-xs text-foreground">
              {new Date(session.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" - "}
              {new Date(session.endTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          <Separator className="mb-3" />

          {/* Weather */}
          <TextField className="mb-3">
            <Label>{t("sessions.weather")}</Label>
            <Input
              value={weather}
              onChangeText={setWeather}
              placeholder="e.g. Clear, 15°C, 60% humidity"
            />
          </TextField>

          {/* Seeing */}
          <TextField className="mb-3">
            <Label>{t("sessions.seeing")}</Label>
            <Input value={seeing} onChangeText={setSeeing} placeholder='e.g. 2.5", Good' />
          </TextField>

          {/* Notes */}
          <TextField className="mb-4">
            <Label>{t("sessions.notes")}</Label>
            <TextArea
              value={notes}
              onChangeText={setNotes}
              placeholder={t("sessions.notes")}
              numberOfLines={3}
            />
          </TextField>

          {/* Action Buttons */}
          <View className="gap-2">
            <Button onPress={handleSave} className="w-full">
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Button.Label>{t("common.save")}</Button.Label>
            </Button>

            <Button variant="outline" onPress={handleDelete} className="w-full">
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Button.Label className="text-red-500">{t("sessions.deleteSession")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
