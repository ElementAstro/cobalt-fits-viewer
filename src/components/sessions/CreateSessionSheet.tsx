import { useState, useCallback } from "react";
import { View, Text, Alert, ScrollView } from "react-native";
import {
  BottomSheet,
  Button,
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
import { useSessionStore } from "../../stores/useSessionStore";
import type { ObservationSession } from "../../lib/fits/types";

interface CreateSessionSheetProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: Date;
}

const BORTLE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export function CreateSessionSheet({ visible, onClose, initialDate }: CreateSessionSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const addSession = useSessionStore((s) => s.addSession);

  const defaultDate = initialDate ?? new Date();

  const [dateStr, setDateStr] = useState(
    `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, "0")}-${String(defaultDate.getDate()).padStart(2, "0")}`,
  );
  const [startHour, setStartHour] = useState(20);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(23);
  const [endMinute, setEndMinute] = useState(59);
  const [targets, setTargets] = useState<string[]>([]);
  const [targetInput, setTargetInput] = useState("");
  const [telescope, setTelescope] = useState("");
  const [camera, setCamera] = useState("");
  const [mount, setMount] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const [filterInput, setFilterInput] = useState("");
  const [weather, setWeather] = useState("");
  const [seeing, setSeeing] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [bortle, setBortle] = useState<number | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const addChipItem = useCallback(
    (
      value: string,
      list: string[],
      setter: (v: string[]) => void,
      inputSetter: (v: string) => void,
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
    (value: string, list: string[], setter: (v: string[]) => void) => {
      setter(list.filter((item) => item !== value));
    },
    [],
  );

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
    setDateStr(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    setStartHour(20);
    setStartMinute(0);
    setEndHour(23);
    setEndMinute(59);
    setTargets([]);
    setTargetInput("");
    setTelescope("");
    setCamera("");
    setMount("");
    setFilters([]);
    setFilterInput("");
    setWeather("");
    setSeeing("");
    setNotes("");
    setRating(undefined);
    setBortle(undefined);
    setTags([]);
    setTagInput("");
  };

  const handleCreate = () => {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      Alert.alert(t("common.error"), t("sessions.invalidDate"));
      return;
    }
    const [year, month, day] = parts;
    const startTime = new Date(year, month - 1, day, startHour, startMinute).getTime();
    const endTime = new Date(year, month - 1, day, endHour, endMinute).getTime();

    if (endTime <= startTime) {
      Alert.alert(t("common.error"), t("sessions.invalidTimeRange"));
      return;
    }

    const duration = Math.floor((endTime - startTime) / 1000);

    const session: ObservationSession = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      date: dateStr,
      startTime,
      endTime,
      duration,
      targets,
      imageIds: [],
      equipment: {
        telescope: telescope.trim() || undefined,
        camera: camera.trim() || undefined,
        mount: mount.trim() || undefined,
        filters: filters.length > 0 ? filters : undefined,
      },
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
        <BottomSheet.Content>
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between">
            <BottomSheet.Title>{t("sessions.addSession")}</BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
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

            {/* Targets */}
            <View className="mb-3">
              <Label className="mb-1">{t("targets.title")}</Label>
              {targets.length > 0 && (
                <View className="flex-row flex-wrap gap-1 mb-1.5">
                  {targets.map((tgt) => (
                    <Chip
                      key={tgt}
                      size="sm"
                      variant="secondary"
                      onPress={() => removeChipItem(tgt, targets, setTargets)}
                    >
                      <Chip.Label className="text-[9px]">{tgt} ×</Chip.Label>
                    </Chip>
                  ))}
                </View>
              )}
              <TextField>
                <Input
                  value={targetInput}
                  onChangeText={setTargetInput}
                  placeholder="e.g. M42, NGC 7000..."
                  onSubmitEditing={() =>
                    addChipItem(targetInput, targets, setTargets, setTargetInput)
                  }
                  returnKeyType="done"
                />
              </TextField>
            </View>

            <Separator className="mb-3" />

            {/* Equipment */}
            <TextField className="mb-3">
              <Label>{t("sessions.equipment")}: Telescope</Label>
              <Input
                value={telescope}
                onChangeText={setTelescope}
                placeholder="e.g. Sky-Watcher 200P"
              />
            </TextField>
            <TextField className="mb-3">
              <Label>{t("sessions.equipment")}: Camera</Label>
              <Input value={camera} onChangeText={setCamera} placeholder="e.g. ZWO ASI294MC Pro" />
            </TextField>
            <TextField className="mb-3">
              <Label>{t("sessions.equipment")}: Mount</Label>
              <Input value={mount} onChangeText={setMount} placeholder="e.g. EQ6-R Pro" />
            </TextField>

            {/* Filters */}
            <View className="mb-3">
              <Label className="mb-1">{t("sessions.filters")}</Label>
              {filters.length > 0 && (
                <View className="flex-row flex-wrap gap-1 mb-1.5">
                  {filters.map((f) => (
                    <Chip
                      key={f}
                      size="sm"
                      variant="secondary"
                      onPress={() => removeChipItem(f, filters, setFilters)}
                    >
                      <Chip.Label className="text-[9px]">{f} ×</Chip.Label>
                    </Chip>
                  ))}
                </View>
              )}
              <TextField>
                <Input
                  value={filterInput}
                  onChangeText={setFilterInput}
                  placeholder="e.g. Ha, OIII, SII..."
                  onSubmitEditing={() =>
                    addChipItem(filterInput, filters, setFilters, setFilterInput)
                  }
                  returnKeyType="done"
                />
              </TextField>
            </View>

            <Separator className="mb-3" />

            {/* Weather & Seeing */}
            <TextField className="mb-3">
              <Label>{t("sessions.weather")}</Label>
              <Input value={weather} onChangeText={setWeather} placeholder="e.g. Clear, 15°C" />
            </TextField>
            <TextField className="mb-3">
              <Label>{t("sessions.seeing")}</Label>
              <Input value={seeing} onChangeText={setSeeing} placeholder='e.g. 2.5", Good' />
            </TextField>

            {/* Rating */}
            <View className="mb-3">
              <Label className="mb-1">{t("sessions.rating")}</Label>
              <View className="flex-row gap-1">
                {RATING_OPTIONS.map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={rating === r ? "primary" : "outline"}
                    isIconOnly
                    onPress={() => setRating(rating === r ? undefined : r)}
                  >
                    <Ionicons
                      name={rating != null && rating >= r ? "star" : "star-outline"}
                      size={14}
                      color={rating != null && rating >= r ? "#f59e0b" : mutedColor}
                    />
                  </Button>
                ))}
              </View>
            </View>

            {/* Bortle */}
            <View className="mb-3">
              <Label className="mb-1">{t("sessions.bortle")}</Label>
              <View className="flex-row flex-wrap gap-1">
                {BORTLE_OPTIONS.map((b) => (
                  <Chip
                    key={b}
                    size="sm"
                    variant={bortle === b ? "primary" : "secondary"}
                    onPress={() => setBortle(bortle === b ? undefined : b)}
                  >
                    <Chip.Label className="text-[9px]">{b}</Chip.Label>
                  </Chip>
                ))}
              </View>
            </View>

            {/* Tags */}
            <View className="mb-3">
              <Label className="mb-1">{t("sessions.tags")}</Label>
              {tags.length > 0 && (
                <View className="flex-row flex-wrap gap-1 mb-1.5">
                  {tags.map((tag) => (
                    <Chip
                      key={tag}
                      size="sm"
                      variant="secondary"
                      onPress={() => removeChipItem(tag, tags, setTags)}
                    >
                      <Chip.Label className="text-[9px]">{tag} ×</Chip.Label>
                    </Chip>
                  ))}
                </View>
              )}
              <TextField>
                <Input
                  value={tagInput}
                  onChangeText={setTagInput}
                  placeholder="e.g. deep sky, planetary..."
                  onSubmitEditing={() => addChipItem(tagInput, tags, setTags, setTagInput)}
                  returnKeyType="done"
                />
              </TextField>
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
