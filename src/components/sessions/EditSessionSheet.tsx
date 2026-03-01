import { useState, useEffect } from "react";
import { View, Text, Alert, ScrollView } from "react-native";
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
import { useTargetStore } from "../../stores/useTargetStore";
import { dedupeTargetRefs, toTargetRef } from "../../lib/targets/targetRefs";
import { useChipInput } from "../../hooks/useChipInput";
import { useEquipmentFields } from "../../hooks/useEquipmentFields";
import { ChipInputField } from "./ChipInputField";
import { EquipmentFields } from "./EquipmentFields";
import { RatingSelector } from "./RatingSelector";
import { BortleSelector } from "./BortleSelector";

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
  const [mutedColor, dangerColor] = useThemeColor(["muted", "danger"]);
  const targetCatalog = useTargetStore((s) => s.targets);

  const [notes, setNotes] = useState(session.notes ?? "");
  const [weather, setWeather] = useState(session.weather ?? "");
  const [seeing, setSeeing] = useState(session.seeing ?? "");
  const equip = useEquipmentFields({
    telescope: session.equipment.telescope,
    camera: session.equipment.camera,
    mount: session.equipment.mount,
    filters: session.equipment.filters,
  });
  const [targets, setTargets] = useState<string[]>(
    (session.targetRefs ?? []).map((ref) => ref.name),
  );
  const [targetInput, setTargetInput] = useState("");
  const [rating, setRating] = useState<number | undefined>(session.rating);
  const [bortle, setBortle] = useState<number | undefined>(session.bortle);
  const [tags, setTags] = useState<string[]>(session.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setNotes(session.notes ?? "");
    setWeather(session.weather ?? "");
    setSeeing(session.seeing ?? "");
    equip.resetEquipment({
      telescope: session.equipment.telescope,
      camera: session.equipment.camera,
      mount: session.equipment.mount,
      filters: session.equipment.filters,
    });
    setTargets((session.targetRefs ?? []).map((ref) => ref.name));
    setRating(session.rating);
    setBortle(session.bortle);
    setTags(session.tags ?? []);
    setTargetInput("");
    setTagInput("");
  }, [
    session.id,
    session.notes,
    session.weather,
    session.seeing,
    session.equipment.telescope,
    session.equipment.camera,
    session.equipment.mount,
    session.equipment.filters,
    session.targetRefs,
    session.rating,
    session.bortle,
    session.tags,
    equip.resetEquipment,
  ]);

  const { addItem: addChipItem, removeItem: removeChipItem } = useChipInput();

  const handleSave = () => {
    onSave({
      notes: notes.trim() || undefined,
      weather: weather.trim() || undefined,
      seeing: seeing.trim() || undefined,
      targetRefs: dedupeTargetRefs(
        targets.map((name) => toTargetRef(name, targetCatalog)),
        targetCatalog,
      ),
      rating,
      bortle,
      tags: tags.length > 0 ? tags : undefined,
      equipment: {
        ...session.equipment,
        ...equip.buildEquipmentObject(),
      },
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

          <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
            {/* Targets */}
            <ChipInputField
              label={t("targets.title")}
              items={targets}
              inputValue={targetInput}
              onInputChange={setTargetInput}
              onAdd={() => addChipItem(targetInput, targets, setTargets, setTargetInput)}
              onRemove={(tgt) => removeChipItem(tgt, targets, setTargets)}
              placeholder="e.g. M42, NGC 7000..."
            />

            {/* Rating */}
            <RatingSelector value={rating} onChange={setRating} />

            {/* Bortle Scale */}
            <BortleSelector value={bortle} onChange={setBortle} />

            <Separator className="mb-3" />

            {/* Equipment */}
            <EquipmentFields
              telescope={equip.telescope}
              camera={equip.camera}
              mount={equip.mount}
              onTelescopeChange={equip.setTelescope}
              onCameraChange={equip.setCamera}
              onMountChange={equip.setMount}
            />

            {/* Filters */}
            <ChipInputField
              label={t("sessions.filters")}
              items={equip.filters}
              inputValue={equip.filterInput}
              onInputChange={equip.setFilterInput}
              onAdd={equip.addFilter}
              onRemove={equip.removeFilter}
              placeholder="e.g. Ha, OIII, SII..."
            />

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

            {/* Tags */}
            <ChipInputField
              label={t("sessions.tags")}
              items={tags}
              inputValue={tagInput}
              onInputChange={setTagInput}
              onAdd={() => addChipItem(tagInput, tags, setTags, setTagInput)}
              onRemove={(tag) => removeChipItem(tag, tags, setTags)}
              placeholder="e.g. deep sky, planetary..."
            />

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
          </ScrollView>

          {/* Action Buttons */}
          <View className="gap-2">
            <Button onPress={handleSave} className="w-full">
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Button.Label>{t("common.save")}</Button.Label>
            </Button>

            <Button variant="outline" onPress={handleDelete} className="w-full">
              <Ionicons name="trash-outline" size={16} color={dangerColor} />
              <Button.Label className="text-red-500">{t("sessions.deleteSession")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
