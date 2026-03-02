import { useState, useCallback } from "react";
import { View, Text, Alert, ScrollView, useWindowDimensions } from "react-native";
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
import { useSessionStore } from "../../stores/useSessionStore";
import { useTargetStore } from "../../stores/useTargetStore";
import type { ObservationSession } from "../../lib/fits/types";
import { dedupeTargetRefs, toTargetRef } from "../../lib/targets/targetRefs";
import { toLocalDateKey } from "../../lib/sessions/planUtils";
import { resolveManualSessionTimeRange } from "../../lib/sessions/sessionTimeRange";
import { useChipInput } from "../../hooks/useChipInput";
import { useEquipmentFields } from "../../hooks/useEquipmentFields";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { ChipInputField } from "./ChipInputField";
import { EquipmentFields } from "./EquipmentFields";
import { RatingSelector } from "./RatingSelector";
import { BortleSelector } from "./BortleSelector";

interface CreateSessionSheetProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: Date;
}

export function CreateSessionSheet({ visible, onClose, initialDate }: CreateSessionSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { isLandscape } = useScreenOrientation();
  const { height: screenHeight } = useWindowDimensions();
  const compact = isLandscape;
  const addSession = useSessionStore((s) => s.addSession);
  const targetCatalog = useTargetStore((s) => s.targets);

  const defaultDate = initialDate ?? new Date();

  const [dateStr, setDateStr] = useState(toLocalDateKey(defaultDate));
  const [startHour, setStartHour] = useState(20);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(23);
  const [endMinute, setEndMinute] = useState(59);
  const [targets, setTargets] = useState<string[]>([]);
  const [targetInput, setTargetInput] = useState("");
  const equip = useEquipmentFields();
  const [weather, setWeather] = useState("");
  const [seeing, setSeeing] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [bortle, setBortle] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const { addItem: addChipItem, removeItem: removeChipItem } = useChipInput();

  const adjustTime = useCallback(
    (target: "start" | "end", field: "hour" | "minute", delta: number) => {
      if (target === "start") {
        if (field === "hour") setStartHour((h) => Math.max(0, Math.min(23, h + delta)));
        else setStartMinute((m) => Math.max(0, Math.min(59, m + delta)));
      } else {
        if (field === "hour") setEndHour((h) => Math.max(0, Math.min(23, h + delta)));
        else setEndMinute((m) => Math.max(0, Math.min(59, m + delta)));
      }
    },
    [],
  );

  const resetForm = () => {
    const d = new Date();
    setDateStr(toLocalDateKey(d));
    setStartHour(20);
    setStartMinute(0);
    setEndHour(23);
    setEndMinute(59);
    setTargets([]);
    setTargetInput("");
    equip.resetEquipment();
    setWeather("");
    setSeeing("");
    setNotes("");
    setRating(undefined);
    setBortle(undefined);
    setTags([]);
    setTagInput("");
  };

  const handleCreate = () => {
    const timeRange = resolveManualSessionTimeRange(
      dateStr,
      startHour,
      startMinute,
      endHour,
      endMinute,
    );
    if (!timeRange) {
      Alert.alert(t("common.error"), t("sessions.invalidDate"));
      return;
    }
    const { startTime, endTime, duration } = timeRange;

    const session: ObservationSession = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      date: dateStr,
      startTime,
      endTime,
      duration,
      targetRefs: dedupeTargetRefs(
        targets.map((name) => toTargetRef(name, targetCatalog)),
        targetCatalog,
      ),
      imageIds: [],
      equipment: equip.buildEquipmentObject(),
      weather: weather.trim() || undefined,
      seeing: seeing.trim() || undefined,
      notes: notes.trim() || undefined,
      rating,
      bortle,
      tags: tags.length > 0 ? tags : undefined,
      createdAt: Date.now(),
    };

    addSession(session);
    Alert.alert(t("common.success"), t("sessions.sessionSaved"));
    resetForm();
    onClose();
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
        <BottomSheet.Content
          snapPoints={compact ? ["95%"] : undefined}
          enableDynamicSizing={!compact}
        >
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <BottomSheet.Title>{t("sessions.addSession")}</BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          <ScrollView
            style={{ maxHeight: screenHeight * (compact ? 0.82 : 0.7) }}
            showsVerticalScrollIndicator={false}
          >
            {/* Date */}
            <TextField className="mb-3">
              <Label>{t("sessions.calendar")}</Label>
              <Input value={dateStr} onChangeText={setDateStr} placeholder="YYYY-MM-DD" />
            </TextField>

            {/* Time */}
            <View className="mb-3 rounded-lg bg-surface-secondary px-3 py-2">
              <View className="flex-row items-center justify-between mb-1">
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
                  <Text className="text-xs font-bold text-foreground w-6 text-center">
                    {String(startHour).padStart(2, "0")}
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("start", "hour", 1)}
                  >
                    <Ionicons name="add" size={12} color={mutedColor} />
                  </Button>
                  <Text className="text-xs text-muted">:</Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("start", "minute", -5)}
                  >
                    <Ionicons name="remove" size={12} color={mutedColor} />
                  </Button>
                  <Text className="text-xs font-bold text-foreground w-6 text-center">
                    {String(startMinute).padStart(2, "0")}
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("start", "minute", 5)}
                  >
                    <Ionicons name="add" size={12} color={mutedColor} />
                  </Button>
                </View>
              </View>
              <Separator className="my-1" />
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
                  <Text className="text-xs font-bold text-foreground w-6 text-center">
                    {String(endHour).padStart(2, "0")}
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("end", "hour", 1)}
                  >
                    <Ionicons name="add" size={12} color={mutedColor} />
                  </Button>
                  <Text className="text-xs text-muted">:</Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("end", "minute", -5)}
                  >
                    <Ionicons name="remove" size={12} color={mutedColor} />
                  </Button>
                  <Text className="text-xs font-bold text-foreground w-6 text-center">
                    {String(endMinute).padStart(2, "0")}
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => adjustTime("end", "minute", 5)}
                  >
                    <Ionicons name="add" size={12} color={mutedColor} />
                  </Button>
                </View>
              </View>
            </View>
            <Text className="mt-2 text-[10px] text-muted">
              {t("sessions.crossMidnightAutoHint")}
            </Text>

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

            <Separator className="mb-3" />

            {/* Equipment & Conditions */}
            <View className={compact ? "flex-row gap-3" : ""}>
              <View className={compact ? "flex-1" : ""}>
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
                  placeholder="e.g. Ha, OIII, SII..."
                />
              </View>

              {!compact && <Separator className="mb-3" />}

              <View className={compact ? "flex-1" : ""}>
                <TextField className="mb-3">
                  <Label>{t("sessions.weather")}</Label>
                  <Input value={weather} onChangeText={setWeather} placeholder="e.g. Clear, 15°C" />
                </TextField>
                <TextField className="mb-3">
                  <Label>{t("sessions.seeing")}</Label>
                  <Input value={seeing} onChangeText={setSeeing} placeholder='e.g. 2.5", Good' />
                </TextField>

                <RatingSelector value={rating} onChange={setRating} />
                <BortleSelector value={bortle} onChange={setBortle} />
              </View>
            </View>

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
                numberOfLines={2}
              />
            </TextField>
          </ScrollView>

          {/* Create Button */}
          <Button onPress={handleCreate} className="w-full">
            <Ionicons name="add-circle" size={16} color="#fff" />
            <Button.Label>{t("sessions.addSession")}</Button.Label>
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
