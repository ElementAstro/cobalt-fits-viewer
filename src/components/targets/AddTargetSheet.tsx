/**
 * 添加目标 Sheet
 */

import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
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
import {
  parseRA,
  parseDec,
  formatRA,
  formatDec,
  parseCoordinatePair,
} from "../../lib/targets/coordinates";
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
    ra?: number;
    dec?: number;
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
  const [coordinatesInput, setCoordinatesInput] = useState("");
  const [ra, setRa] = useState("");
  const [dec, setDec] = useState("");
  const [isRaManuallyEdited, setIsRaManuallyEdited] = useState(false);
  const [isDecManuallyEdited, setIsDecManuallyEdited] = useState(false);
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);

  const raValid = ra.trim() ? parseRA(ra.trim()) !== null : true;
  const decValid = dec.trim() ? parseDec(dec.trim()) !== null : true;
  const coordinatesValid = coordinatesInput.trim()
    ? parseCoordinatePair(coordinatesInput.trim()) !== null
    : true;

  const resetForm = useCallback(() => {
    setName("");
    setType("other");
    setCoordinatesInput("");
    setRa("");
    setDec("");
    setIsRaManuallyEdited(false);
    setIsDecManuallyEdited(false);
    setNotes("");
    setCategory(undefined);
    setTags([]);
    setIsFavorite(false);
  }, []);

  const handleCoordinatesInputChange = useCallback((value: string) => {
    setCoordinatesInput(value);
    setIsRaManuallyEdited(false);
    setIsDecManuallyEdited(false);
  }, []);

  const handleRAChange = useCallback((value: string) => {
    setRa(value);
    setIsRaManuallyEdited(true);
  }, []);

  const handleDecChange = useCallback((value: string) => {
    setDec(value);
    setIsDecManuallyEdited(true);
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const pair = coordinatesInput.trim() ? parseCoordinatePair(coordinatesInput.trim()) : null;
    const parsedRA = ra.trim() ? parseRA(ra.trim()) : undefined;
    const parsedDec = dec.trim() ? parseDec(dec.trim()) : undefined;
    if (
      (coordinatesInput.trim() && !pair) ||
      (ra.trim() && parsedRA === null) ||
      (dec.trim() && parsedDec === null)
    ) {
      return;
    }

    const effectiveRA = isRaManuallyEdited
      ? (parsedRA ?? undefined)
      : (pair?.ra ?? parsedRA ?? undefined);
    const effectiveDec = isDecManuallyEdited
      ? (parsedDec ?? undefined)
      : (pair?.dec ?? parsedDec ?? undefined);

    onConfirm({
      name: trimmed,
      type,
      ra: effectiveRA,
      dec: effectiveDec,
      notes: notes.trim() || undefined,
      category,
      tags: tags.length > 0 ? tags : undefined,
      isFavorite,
    });
    resetForm();
  }, [
    category,
    coordinatesInput,
    dec,
    isFavorite,
    isDecManuallyEdited,
    isRaManuallyEdited,
    name,
    notes,
    onConfirm,
    ra,
    resetForm,
    tags,
    type,
  ]);

  const handleCoordinatesBlur = useCallback(() => {
    const pair = parseCoordinatePair(coordinatesInput.trim());
    if (!pair) return;
    setRa(formatRA(pair.ra));
    setDec(formatDec(pair.dec));
    setIsRaManuallyEdited(false);
    setIsDecManuallyEdited(false);
  }, [coordinatesInput]);

  const handleRABlur = () => {
    const parsed = parseRA(ra.trim());
    if (parsed !== null) setRa(formatRA(parsed));
  };

  const handleDecBlur = () => {
    const parsed = parseDec(dec.trim());
    if (parsed !== null) setDec(formatDec(parsed));
  };

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

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
          contentContainerClassName="h-full px-0"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: insets.bottom + 24,
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

            <TextField className="mt-4" isInvalid={!coordinatesValid}>
              <Label>{t("targets.coordinates")}</Label>
              <Input
                placeholder="05:34:31 +22:00:52 / 83.633, 22.014"
                value={coordinatesInput}
                onChangeText={handleCoordinatesInputChange}
                onBlur={handleCoordinatesBlur}
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {!coordinatesValid && <FieldError>{t("targets.invalidCoordinates")}</FieldError>}
            </TextField>

            {/* RA / Dec */}
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1">
                <TextField isInvalid={!raValid}>
                  <Label>RA</Label>
                  <Input
                    placeholder="05h 34m 31s / 83.633"
                    value={ra}
                    onChangeText={handleRAChange}
                    onBlur={handleRABlur}
                    keyboardType="numbers-and-punctuation"
                    autoCorrect={false}
                  />
                  {!raValid && <FieldError>{t("targets.invalidRA")}</FieldError>}
                </TextField>
              </View>
              <View className="flex-1">
                <TextField isInvalid={!decValid}>
                  <Label>Dec</Label>
                  <Input
                    placeholder="+22° 00′ 52″ / 22.014"
                    value={dec}
                    onChangeText={handleDecChange}
                    onBlur={handleDecBlur}
                    keyboardType="numbers-and-punctuation"
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

            <View className="mt-4 flex-row justify-end gap-2">
              <Button variant="outline" onPress={handleClose}>
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
              <Button
                variant="primary"
                onPress={handleConfirm}
                isDisabled={!name.trim() || !raValid || !decValid || !coordinatesValid}
              >
                <Button.Label>{t("common.confirm")}</Button.Label>
              </Button>
            </View>
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
