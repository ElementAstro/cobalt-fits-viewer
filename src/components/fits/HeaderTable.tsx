import { View, Text, Alert } from "react-native";
import { Card, Input, PressableFeedback, Separator, TextField, useThemeColor } from "heroui-native";
import { useState, useMemo, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import type { HeaderKeyword } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";
import { useFontFamily } from "../common/FontProvider";
import { isProtectedKeyword } from "../../lib/fits/headerValidator";

interface HeaderTableProps {
  keywords: HeaderKeyword[];
  editable?: boolean;
  onEditKeyword?: (index: number) => void;
  onDeleteKeyword?: (index: number) => void;
}

export function HeaderTable({
  keywords,
  editable = false,
  onEditKeyword,
  onDeleteKeyword,
}: HeaderTableProps) {
  const { t } = useI18n();
  const { getMonoFontFamily } = useFontFamily();
  const monoFont = getMonoFontFamily("regular");
  const monoBoldFont = getMonoFontFamily("semibold");
  const mutedColor = useThemeColor("muted");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return keywords;
    const q = search.toLowerCase().trim();
    return keywords.filter(
      (kw) =>
        kw.key.toLowerCase().includes(q) ||
        String(kw.value).toLowerCase().includes(q) ||
        kw.comment?.toLowerCase().includes(q),
    );
  }, [keywords, search]);

  const handleLongPress = useCallback(
    (kw: HeaderKeyword, originalIndex: number) => {
      const actions: Array<{
        text: string;
        onPress: () => void;
        style?: "destructive" | "cancel";
      }> = [];

      // Copy value
      actions.push({
        text: t("header.copyValue"),
        onPress: async () => {
          await Clipboard.setStringAsync(String(kw.value ?? ""));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });

      // Copy row
      actions.push({
        text: t("header.copyRow" as Parameters<typeof t>[0]),
        onPress: async () => {
          const row = `${kw.key} = ${String(kw.value ?? "")}${kw.comment ? ` / ${kw.comment}` : ""}`;
          await Clipboard.setStringAsync(row);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });

      // Edit (if editable)
      if (editable && onEditKeyword) {
        actions.push({
          text: t("header.editKeyword" as Parameters<typeof t>[0]),
          onPress: () => onEditKeyword(originalIndex),
        });
      }

      // Delete (if editable and not protected)
      if (editable && onDeleteKeyword && !isProtectedKeyword(kw.key)) {
        actions.push({
          text: t("header.deleteKeyword" as Parameters<typeof t>[0]),
          style: "destructive",
          onPress: () => onDeleteKeyword(originalIndex),
        });
      }

      actions.push({ text: t("common.cancel"), onPress: () => {}, style: "cancel" });

      Alert.alert(kw.key, String(kw.value ?? ""), actions);
    },
    [editable, onEditKeyword, onDeleteKeyword, t],
  );

  const getOriginalIndex = useCallback(
    (kw: HeaderKeyword): number => {
      return keywords.indexOf(kw);
    },
    [keywords],
  );

  return (
    <View>
      <TextField className="mb-3">
        <Input
          placeholder={t("header.searchKeyword")}
          value={search}
          onChangeText={setSearch}
          className="text-xs"
        />
      </TextField>

      <Card variant="secondary">
        <Card.Body className="p-0">
          {filtered.map((kw, index) => {
            const originalIndex = getOriginalIndex(kw);
            return (
              <View key={`${kw.key}_${index}`}>
                {index > 0 && <Separator />}
                <PressableFeedback
                  onPress={
                    editable && onEditKeyword ? () => onEditKeyword(originalIndex) : undefined
                  }
                  onLongPress={() => handleLongPress(kw, originalIndex)}
                  className="px-4 py-2.5"
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="font-mono text-xs font-semibold text-foreground"
                      style={monoBoldFont ? { fontFamily: monoBoldFont } : undefined}
                    >
                      {kw.key}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <Text
                        className="font-mono text-xs text-muted"
                        numberOfLines={1}
                        style={monoFont ? { fontFamily: monoFont } : undefined}
                      >
                        {String(kw.value)}
                      </Text>
                      {editable && <Ionicons name="chevron-forward" size={12} color={mutedColor} />}
                    </View>
                  </View>
                  {kw.comment && (
                    <Text className="mt-0.5 text-[9px] text-muted" numberOfLines={1}>
                      {kw.comment}
                    </Text>
                  )}
                </PressableFeedback>
              </View>
            );
          })}
          {filtered.length === 0 && (
            <View className="items-center py-6">
              <Text className="text-xs text-muted">{t("common.noData")}</Text>
            </View>
          )}
        </Card.Body>
      </Card>
    </View>
  );
}
