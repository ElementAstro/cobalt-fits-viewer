/**
 * 编辑目标 Sheet
 */

import { useState, useEffect } from "react";
import { View, ScrollView, Alert } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Input,
  Label,
  Separator,
  TextArea,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { FilterExposurePlan } from "./FilterExposurePlan";
import { CategorySelector } from "./CategorySelector";
import { TagInput } from "./TagInput";
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
  allCategories?: string[];
  allTags?: string[];
  onClose: () => void;
  onSave: (updates: Partial<Target>) => void;
  onDelete: () => void;
}

export function EditTargetSheet({
  visible,
  target,
  allCategories = [],
  allTags = [],
  onClose,
  onSave,
  onDelete,
}: EditTargetSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const dangerColor = useThemeColor("danger");

  const [name, setName] = useState(target.name);
  const [type, setType] = useState<TargetType>(target.type);
  const [status, setStatus] = useState<TargetStatus>(target.status);
  const [aliases, setAliases] = useState<string[]>(target.aliases);
  const [newAlias, setNewAlias] = useState("");
  const [notes, setNotes] = useState(target.notes ?? "");
  const [category, setCategory] = useState<string | undefined>(target.category);
  const [tags, setTags] = useState<string[]>(target.tags);
  const [isFavorite, setIsFavorite] = useState(target.isFavorite);
  const [isPinned, setIsPinned] = useState(target.isPinned);
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
    setCategory(target.category);
    setTags([...target.tags]);
    setIsFavorite(target.isFavorite);
    setIsPinned(target.isPinned);
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
      category,
      tags,
      isFavorite,
      isPinned,
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
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-4 w-full max-w-md rounded-2xl bg-background p-6 max-h-[85%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between mb-2">
              <Dialog.Title>{t("targets.editTarget")}</Dialog.Title>
              <Dialog.Close />
            </View>

            {/* Name */}
            <TextField isRequired>
              <Label>{t("targets.targetName")}</Label>
              <Input
                placeholder={t("targets.targetName")}
                value={name}
                onChangeText={setName}
                autoCorrect={false}
              />
            </TextField>

            {/* Type selector */}
            <Label className="mt-4 mb-2">{t("targets.type")}</Label>
            <View className="flex-row flex-wrap gap-1.5">
              {TARGET_TYPES.map((tt) => (
                <Chip
                  key={tt}
                  size="sm"
                  variant={type === tt ? "primary" : "secondary"}
                  onPress={() => setType(tt)}
                >
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
              ))}
            </View>

            {/* Status selector */}
            <Label className="mt-4 mb-2">{t("targets.status")}</Label>
            <View className="flex-row flex-wrap gap-1.5">
              {TARGET_STATUSES.map((s) => (
                <Chip
                  key={s}
                  size="sm"
                  variant={status === s ? "primary" : "secondary"}
                  onPress={() => setStatus(s)}
                >
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
              ))}
            </View>

            {/* Favorite & Pinned toggles */}
            <View className="flex-row gap-2 mt-4">
              <Button
                variant={isFavorite ? "primary" : "outline"}
                size="sm"
                className="flex-1"
                onPress={() => setIsFavorite(!isFavorite)}
              >
                <Ionicons
                  name={isFavorite ? "star" : "star-outline"}
                  size={14}
                  color={isFavorite ? "#fff" : mutedColor}
                />
                <Button.Label>
                  {isFavorite ? t("targets.favorited") : t("targets.addFavorite")}
                </Button.Label>
              </Button>
              <Button
                variant={isPinned ? "primary" : "outline"}
                size="sm"
                className="flex-1"
                onPress={() => setIsPinned(!isPinned)}
              >
                <Ionicons
                  name={isPinned ? "pin" : "pin-outline"}
                  size={14}
                  color={isPinned ? "#fff" : mutedColor}
                />
                <Button.Label>{isPinned ? t("targets.pinned") : t("targets.pin")}</Button.Label>
              </Button>
            </View>

            {/* Category selector */}
            <Label className="mt-4 mb-2">{t("targets.category")}</Label>
            <CategorySelector
              selectedCategory={category}
              allCategories={allCategories}
              onSelect={setCategory}
            />

            {/* Tags */}
            <Label className="mt-4 mb-2">{t("targets.tags")}</Label>
            <TagInput
              tags={tags}
              suggestions={allTags}
              onChange={setTags}
              placeholder={t("targets.addTag")}
            />

            {/* Aliases */}
            <Label className="mt-4 mb-2">{t("targets.aliases")}</Label>
            <View className="flex-row flex-wrap gap-1 mb-2">
              {aliases.map((alias) => (
                <Chip
                  key={alias}
                  size="sm"
                  variant="secondary"
                  onPress={() => handleRemoveAlias(alias)}
                >
                  <Chip.Label className="text-[9px]">{alias} ×</Chip.Label>
                </Chip>
              ))}
            </View>
            <View className="flex-row gap-2">
              <Input
                className="flex-1"
                placeholder={t("targets.addAlias")}
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
            <Label className="mt-4 mb-2">{t("targets.plannedExposure")}</Label>
            <FilterExposurePlan entries={filterEntries} onChange={setFilterEntries} />

            {/* Notes */}
            <TextField className="mt-3">
              <Label>{t("targets.notes")}</Label>
              <TextArea
                placeholder={t("targets.notes")}
                value={notes}
                onChangeText={setNotes}
                numberOfLines={3}
                autoCorrect={false}
              />
            </TextField>

            <Separator className="my-4" />

            {/* Actions */}
            <View className="flex-row justify-between">
              <Button variant="outline" onPress={handleDelete}>
                <Ionicons name="trash-outline" size={14} color={dangerColor} />
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
