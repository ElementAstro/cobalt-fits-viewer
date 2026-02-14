import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Button, Chip, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { parseRA, parseDec, formatRA, formatDec } from "../../lib/targets/coordinates";
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
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    type: TargetType;
    ra?: string;
    dec?: string;
    notes?: string;
  }) => void;
}

export function AddTargetSheet({ visible, onClose, onConfirm }: AddTargetSheetProps) {
  const { t } = useI18n();
  const [mutedColor] = useThemeColor(["muted"]);
  const [name, setName] = useState("");
  const [type, setType] = useState<TargetType>("other");
  const [ra, setRa] = useState("");
  const [dec, setDec] = useState("");
  const [notes, setNotes] = useState("");

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
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 items-center justify-center bg-black/60"
      >
        <View className="mx-6 w-full max-w-sm rounded-2xl bg-surface-secondary p-6">
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-lg font-bold text-foreground">{t("targets.addTarget")}</Text>

            <TextInput
              className="mt-4 rounded-xl border border-separator bg-background px-4 py-3 text-sm text-foreground"
              placeholder={t("targets.targetName")}
              placeholderTextColor={mutedColor}
              value={name}
              onChangeText={setName}
              autoFocus
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

            {/* RA / Dec */}
            <View className="mt-4 flex-row gap-2">
              <View className="flex-1">
                <TextInput
                  className={`rounded-xl border bg-background px-4 py-3 text-sm text-foreground ${
                    !raValid ? "border-red-500" : "border-separator"
                  }`}
                  placeholder="RA (e.g. 05h 34m 31s)"
                  placeholderTextColor={mutedColor}
                  value={ra}
                  onChangeText={setRa}
                  onBlur={handleRABlur}
                  autoCorrect={false}
                />
                {!raValid && (
                  <Text className="mt-0.5 text-[9px] text-red-500">{t("targets.invalidRA")}</Text>
                )}
              </View>
              <View className="flex-1">
                <TextInput
                  className={`rounded-xl border bg-background px-4 py-3 text-sm text-foreground ${
                    !decValid ? "border-red-500" : "border-separator"
                  }`}
                  placeholder="Dec (e.g. +22° 00′ 52″)"
                  placeholderTextColor={mutedColor}
                  value={dec}
                  onChangeText={setDec}
                  onBlur={handleDecBlur}
                  autoCorrect={false}
                />
                {!decValid && (
                  <Text className="mt-0.5 text-[9px] text-red-500">{t("targets.invalidDec")}</Text>
                )}
              </View>
            </View>

            {/* Notes */}
            <TextInput
              className="mt-3 rounded-xl border border-separator bg-background px-4 py-3 text-sm text-foreground"
              placeholder={t("targets.notes")}
              placeholderTextColor={mutedColor}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              autoCorrect={false}
            />

            <View className="mt-4 flex-row justify-end gap-2">
              <Button variant="outline" onPress={handleClose}>
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
              <Button variant="primary" onPress={handleConfirm} isDisabled={!name.trim()}>
                <Button.Label>{t("common.confirm")}</Button.Label>
              </Button>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
