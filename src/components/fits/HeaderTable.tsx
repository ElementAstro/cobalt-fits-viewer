import { View, Text } from "react-native";
import { Card, Input, Separator, TextField } from "heroui-native";
import { useState, useMemo } from "react";
import type { HeaderKeyword } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";
import { useFontFamily } from "../common/FontProvider";

interface HeaderTableProps {
  keywords: HeaderKeyword[];
}

export function HeaderTable({ keywords }: HeaderTableProps) {
  const { t } = useI18n();
  const { getMonoFontFamily } = useFontFamily();
  const monoFont = getMonoFontFamily("regular");
  const monoBoldFont = getMonoFontFamily("semibold");
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
          {filtered.map((kw, index) => (
            <View key={`${kw.key}_${index}`}>
              {index > 0 && <Separator />}
              <View className="px-4 py-2.5">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="font-mono text-xs font-semibold text-foreground"
                    style={monoBoldFont ? { fontFamily: monoBoldFont } : undefined}
                  >
                    {kw.key}
                  </Text>
                  <Text
                    className="font-mono text-xs text-muted"
                    numberOfLines={1}
                    style={monoFont ? { fontFamily: monoFont } : undefined}
                  >
                    {String(kw.value)}
                  </Text>
                </View>
                {kw.comment && (
                  <Text className="mt-0.5 text-[9px] text-muted" numberOfLines={1}>
                    {kw.comment}
                  </Text>
                )}
              </View>
            </View>
          ))}
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
