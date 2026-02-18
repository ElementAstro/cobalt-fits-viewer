import { useState, useEffect, useCallback } from "react";
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
import type { ObservationSession } from "../../lib/fits/types";
import { useTargetStore } from "../../stores/useTargetStore";
import { dedupeTargetRefs, toTargetRef } from "../../lib/targets/targetRefs";

interface EditSessionSheetProps {
  visible: boolean;
  session: ObservationSession;
  onClose: () => void;
  onSave: (updates: Partial<ObservationSession>) => void;
  onDelete: () => void;
}

const BORTLE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export function EditSessionSheet({
  visible,
  session,
  onClose,
  onSave,
  onDelete,
}: EditSessionSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const targetCatalog = useTargetStore((s) => s.targets);

  const [notes, setNotes] = useState(session.notes ?? "");
  const [weather, setWeather] = useState(session.weather ?? "");
  const [seeing, setSeeing] = useState(session.seeing ?? "");
  const [telescope, setTelescope] = useState(session.equipment.telescope ?? "");
  const [camera, setCamera] = useState(session.equipment.camera ?? "");
  const [mount, setMount] = useState(session.equipment.mount ?? "");
  const [targets, setTargets] = useState<string[]>(
    (session.targetRefs ?? []).map((ref) => ref.name),
  );
  const [targetInput, setTargetInput] = useState("");
  const [filters, setFilters] = useState<string[]>(session.equipment.filters ?? []);
  const [filterInput, setFilterInput] = useState("");
  const [rating, setRating] = useState<number | undefined>(session.rating);
  const [bortle, setBortle] = useState<number | undefined>(session.bortle);
  const [tags, setTags] = useState<string[]>(session.tags ?? []);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setNotes(session.notes ?? "");
    setWeather(session.weather ?? "");
    setSeeing(session.seeing ?? "");
    setTelescope(session.equipment.telescope ?? "");
    setCamera(session.equipment.camera ?? "");
    setMount(session.equipment.mount ?? "");
    setTargets((session.targetRefs ?? []).map((ref) => ref.name));
    setFilters(session.equipment.filters ?? []);
    setRating(session.rating);
    setBortle(session.bortle);
    setTags(session.tags ?? []);
    setTargetInput("");
    setFilterInput("");
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
  ]);

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
        telescope: telescope.trim() || undefined,
        camera: camera.trim() || undefined,
        mount: mount.trim() || undefined,
        filters: filters.length > 0 ? filters : undefined,
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

            {/* Bortle Scale */}
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
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Button.Label className="text-red-500">{t("sessions.deleteSession")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
