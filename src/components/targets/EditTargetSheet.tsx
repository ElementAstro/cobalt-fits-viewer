import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { FilterExposurePlan } from "./FilterExposurePlan";
import type { Target, TargetType, TargetStatus } from "../../lib/fits/types";

const TARGET_TYPES: TargetType[] = [
  "galaxy",
  "nebula",
  "cluster",
  "planet",
  "moon",
  "sun",
  "comet",
  "other",
];

const TARGET_STATUSES: TargetStatus[] = ["planned", "acquiring", "completed", "processed"];

interface EditTargetSheetProps {
  visible: boolean;
  target: Target;
  onClose: () => void;
  onSave: (updates: Partial<Target>) => void;
  onDelete: () => void;
}

export function EditTargetSheet({
  visible,
  target,
  onClose,
  onSave,
  onDelete,
}: EditTargetSheetProps) {
  const { t } = useI18n();
  const [mutedColor] = useThemeColor(["muted"]);

  const [name, setName] = useState(target.name);
  const [type, setType] = useState<TargetType>(target.type);
  const [status, setStatus] = useState<TargetStatus>(target.status);
  const [aliases, setAliases] = useState<string[]>(target.aliases);
  const [newAlias, setNewAlias] = useState("");
  const [notes, setNotes] = useState(target.notes ?? "");
  const [filterEntries, setFilterEntries] = useState(
    target.plannedFilters.map((f) => ({
      filter: f,
      seconds: target.plannedExposure[f] ?? 0,
    })),
  );

  useEffect(() => {
    setName(target.name);
    setType(target.type);
    setStatus(target.status);
    setAliases([...target.aliases]);
    setNotes(target.notes ?? "");
    setFilterEntries(
      target.plannedFilters.map((f) => ({
        filter: f,
        seconds: target.plannedExposure[f] ?? 0,
      })),
    );
  }, [target]);

  const handleAddAlias = () => {
    const trimmed = newAlias.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases([...aliases, trimmed]);
      setNewAlias("");
    }
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const filters = filterEntries.map((e) => e.filter);
    const exposure: Record<string, number> = {};
    for (const entry of filterEntries) {
      if (entry.seconds > 0) exposure[entry.filter] = entry.seconds;
    }

    onSave({
      name: trimmedName,
      type,
      status,
      aliases,
      notes: notes.trim() || undefined,
      plannedFilters: filters,
      plannedExposure: exposure,
    });
  };

  const handleDelete = () => {
    Alert.alert(t("targets.deleteTarget"), t("targets.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("targets.deleteTarget"),
        style: "destructive",
        onPress: onDelete,
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 items-center justify-center bg-black/60"
      >
        <View className="mx-4 w-full max-w-md rounded-2xl bg-surface-secondary p-6 max-h-[85%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-lg font-bold text-foreground">{t("targets.editTarget")}</Text>

            {/* Name */}
            <TextInput
              className="mt-4 rounded-xl border border-separator bg-background px-4 py-3 text-sm text-foreground"
              placeholder={t("targets.targetName")}
              placeholderTextColor={mutedColor}
              value={name}
              onChangeText={setName}
              autoCorrect={false}
            />

            {/* Type selector */}
            <Text className="mt-4 mb-2 text-xs font-semibold text-muted">{t("targets.type")}</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {TARGET_TYPES.map((tt) => (
                <TouchableOpacity key={tt} onPress={() => setType(tt)}>
                  <Chip size="sm" variant={type === tt ? "primary" : "secondary"}>
                    <Chip.Label className="text-[10px]">
                      {t(
                        `targets.types.${tt}` as
                          | "targets.types.galaxy"
                          | "targets.types.nebula"
                          | "targets.types.cluster"
                          | "targets.types.planet"
                          | "targets.types.moon"
                          | "targets.types.sun"
                          | "targets.types.comet"
                          | "targets.types.other",
                      )}
                    </Chip.Label>
                  </Chip>
                </TouchableOpacity>
              ))}
            </View>

            {/* Status selector */}
            <Text className="mt-4 mb-2 text-xs font-semibold text-muted">
              {t("targets.status")}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {TARGET_STATUSES.map((s) => (
                <TouchableOpacity key={s} onPress={() => setStatus(s)}>
                  <Chip size="sm" variant={status === s ? "primary" : "secondary"}>
                    <Chip.Label className="text-[10px]">
                      {t(
                        `targets.${s}` as
                          | "targets.planned"
                          | "targets.acquiring"
                          | "targets.completed"
                          | "targets.processed",
                      )}
                    </Chip.Label>
                  </Chip>
                </TouchableOpacity>
              ))}
            </View>

            {/* Aliases */}
            <Text className="mt-4 mb-2 text-xs font-semibold text-muted">
              {t("targets.aliases")}
            </Text>
            <View className="flex-row flex-wrap gap-1 mb-2">
              {aliases.map((alias) => (
                <TouchableOpacity key={alias} onPress={() => handleRemoveAlias(alias)}>
                  <Chip size="sm" variant="secondary">
                    <Chip.Label className="text-[9px]">{alias} ×</Chip.Label>
                  </Chip>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 rounded-xl border border-separator bg-background px-4 py-2 text-sm text-foreground"
                placeholder={t("targets.addAlias")}
                placeholderTextColor={mutedColor}
                value={newAlias}
                onChangeText={setNewAlias}
                onSubmitEditing={handleAddAlias}
                autoCorrect={false}
              />
              <Button size="sm" variant="outline" onPress={handleAddAlias}>
                <Ionicons name="add" size={14} color={mutedColor} />
              </Button>
            </View>

            {/* Planned Filters & Exposure */}
            <Text className="mt-4 mb-2 text-xs font-semibold text-muted">
              {t("targets.plannedExposure")}
            </Text>
            <FilterExposurePlan entries={filterEntries} onChange={setFilterEntries} />

            {/* Notes */}
            <TextInput
              className="mt-3 rounded-xl border border-separator bg-background px-4 py-3 text-sm text-foreground"
              placeholder={t("targets.notes")}
              placeholderTextColor={mutedColor}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              autoCorrect={false}
            />

            <Separator className="my-4" />

            {/* Actions */}
            <View className="flex-row justify-between">
              <Button variant="outline" onPress={handleDelete}>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Button.Label className="text-red-500">{t("targets.deleteTarget")}</Button.Label>
              </Button>
              <View className="flex-row gap-2">
                <Button variant="outline" onPress={onClose}>
                  <Button.Label>{t("common.cancel")}</Button.Label>
                </Button>
                <Button variant="primary" onPress={handleSave} isDisabled={!name.trim()}>
                  <Button.Label>{t("common.save")}</Button.Label>
                </Button>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
