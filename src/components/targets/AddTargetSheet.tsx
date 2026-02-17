/**
 * 添加目标 Sheet
 */

import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import {
  BottomSheet,
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  TextArea,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { parseRA, parseDec, formatRA, formatDec } from "../../lib/targets/coordinates";
import { CategorySelector } from "./CategorySelector";
import { TagInput } from "./TagInput";
import type { TargetType } from "../../lib/fits/types";

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

interface AddTargetSheetProps {
  visible: boolean;
  allCategories?: string[];
  allTags?: string[];
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    type: TargetType;
    ra?: string;
    dec?: string;
    notes?: string;
    category?: string;
    tags?: string[];
    isFavorite?: boolean;
  }) => void;
}

export function AddTargetSheet({
  visible,
  allCategories = [],
  allTags = [],
  onClose,
  onConfirm,
}: AddTargetSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [type, setType] = useState<TargetType>("other");
  const [ra, setRa] = useState("");
  const [dec, setDec] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);

  const raValid = ra.trim() ? parseRA(ra.trim()) !== null : true;
  const decValid = dec.trim() ? parseDec(dec.trim()) !== null : true;

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedRA = ra.trim() ? parseRA(ra.trim()) : undefined;
    const parsedDec = dec.trim() ? parseDec(dec.trim()) : undefined;
    onConfirm({
      name: trimmed,
      type,
      ra: parsedRA !== null && parsedRA !== undefined ? String(parsedRA) : undefined,
      dec: parsedDec !== null && parsedDec !== undefined ? String(parsedDec) : undefined,
      notes: notes.trim() || undefined,
      category,
      tags: tags.length > 0 ? tags : undefined,
      isFavorite,
    });
    resetForm();
  };

  const handleRABlur = () => {
    const parsed = parseRA(ra.trim());
    if (parsed !== null) setRa(formatRA(parsed));
  };

  const handleDecBlur = () => {
    const parsed = parseDec(dec.trim());
    if (parsed !== null) setDec(formatDec(parsed));
  };

  const resetForm = () => {
    setName("");
    setType("other");
    setRa("");
    setDec("");
    setNotes("");
    setCategory(undefined);
    setTags([]);
    setIsFavorite(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          className="border-t border-separator bg-background px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" onPress={handleClose}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
            <Button variant="primary" onPress={handleConfirm} isDisabled={!name.trim()}>
              <Button.Label>{t("common.confirm")}</Button.Label>
            </Button>
          </View>
        </View>
      </BottomSheetFooter>
    ),
    [handleClose, handleConfirm, insets.bottom, name, t],
  );

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["72%", "96%"]}
          index={1}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enableContentPanningGesture={false}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
          backgroundClassName="rounded-t-[28px] bg-background"
          contentContainerClassName="h-full px-0 pb-0"
          footerComponent={renderFooter}
        >
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 110,
            }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <BottomSheet.Title>{t("targets.addTarget")}</BottomSheet.Title>
              <BottomSheet.Close />
            </View>

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

            {/* Favorite toggle */}
            <Button
              variant={isFavorite ? "primary" : "outline"}
              size="sm"
              className="mt-4"
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

            {/* RA / Dec */}
            <View className="mt-4 flex-row gap-2">
              <View className="flex-1">
                <TextField isInvalid={!raValid}>
                  <Label>RA</Label>
                  <Input
                    placeholder="RA (e.g. 05h 34m 31s)"
                    value={ra}
                    onChangeText={setRa}
                    onBlur={handleRABlur}
                    autoCorrect={false}
                  />
                  {!raValid && <FieldError>{t("targets.invalidRA")}</FieldError>}
                </TextField>
              </View>
              <View className="flex-1">
                <TextField isInvalid={!decValid}>
                  <Label>Dec</Label>
                  <Input
                    placeholder="Dec (e.g. +22° 00′ 52″)"
                    value={dec}
                    onChangeText={setDec}
                    onBlur={handleDecBlur}
                    autoCorrect={false}
                  />
                  {!decValid && <FieldError>{t("targets.invalidDec")}</FieldError>}
                </TextField>
              </View>
            </View>

            {/* Notes */}
            <TextField className="mt-3">
              <Label>{t("targets.notes")}</Label>
              <TextArea
                placeholder={t("targets.notes")}
                value={notes}
                onChangeText={setNotes}
                numberOfLines={2}
                autoCorrect={false}
              />
            </TextField>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
