import { ScrollView, View, Text } from "react-native";
import { BottomSheet, Button, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { ImportResult } from "../../hooks/files/useFileManager";

export interface ImportFailureDisplayEntry {
  name: string;
  reason: string;
}

interface ImportResultSheetProps {
  visible: boolean;
  result: ImportResult | null;
  failedEntries: ImportFailureDisplayEntry[];
  isLandscape: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
}

export function ImportResultSheet({
  visible,
  result,
  failedEntries,
  isLandscape,
  onOpenChange,
  onCopy,
}: ImportResultSheetProps) {
  const { t } = useI18n();
  const [successColor, dangerColor, warningColor] = useThemeColor(["success", "danger", "warning"]);

  if (!visible || !result) return null;

  const compact = isLandscape;
  const hasFailures = failedEntries.length > 0;

  return (
    <BottomSheet isOpen={visible} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={[compact ? "66%" : "76%"]}>
          <View className={compact ? "px-4 pb-4" : "px-5 pb-6"}>
            <BottomSheet.Title>{t("files.importResultTitle")}</BottomSheet.Title>
            <Text className="text-xs text-muted mt-1">
              {t("files.importPartialMsg", {
                success: result.success,
                total: result.total,
                failed: result.failed,
              })}
            </Text>

            <View className="mt-3 flex-row flex-wrap items-center gap-2">
              <View className="rounded-lg bg-success/10 px-3 py-1">
                <Text className="text-xs font-semibold text-success">
                  {t("files.progressSuccess", { count: result.success })}
                </Text>
              </View>
              <View className="rounded-lg bg-danger/10 px-3 py-1">
                <Text className="text-xs font-semibold text-danger">
                  {t("files.progressFailed", { count: result.failed })}
                </Text>
              </View>
              <View className="rounded-lg bg-warning/10 px-3 py-1">
                <Text className="text-xs font-semibold" style={{ color: warningColor }}>
                  {t("files.importSkippedDuplicates", { count: result.skippedDuplicate })}
                </Text>
              </View>
              <View className="rounded-lg bg-muted/20 px-3 py-1">
                <Text className="text-xs font-semibold text-muted">
                  {t("files.importSkippedUnsupported", {
                    count: result.skippedUnsupported,
                  })}
                </Text>
              </View>
            </View>

            <Separator className="my-3" />

            <Text className="text-xs font-semibold text-foreground mb-2">
              {t("files.importResultFailedEntries")}
            </Text>

            {hasFailures ? (
              <ScrollView style={{ maxHeight: compact ? 190 : 250 }} showsVerticalScrollIndicator>
                <View className="gap-2">
                  {failedEntries.map((entry, index) => (
                    <View
                      key={`${entry.name}_${index}`}
                      className="rounded-lg border border-separator bg-surface-secondary px-3 py-2"
                    >
                      <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                        {entry.name}
                      </Text>
                      <Text className="text-[11px] mt-0.5" style={{ color: dangerColor }}>
                        {entry.reason}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View className="rounded-lg bg-success/10 px-3 py-3 flex-row items-center gap-2">
                <Ionicons name="checkmark-done-outline" size={16} color={successColor} />
                <Text className="text-xs text-success">{t("files.importResultNoFailures")}</Text>
              </View>
            )}

            <Separator className="my-3" />

            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={() => onOpenChange(false)}>
                <Button.Label>{t("common.close")}</Button.Label>
              </Button>
              <Button
                testID="import-result-sheet-copy-button"
                variant="primary"
                className="flex-1"
                onPress={onCopy}
              >
                <Ionicons name="copy-outline" size={14} color="#fff" />
                <Button.Label>{t("common.copy")}</Button.Label>
              </Button>
            </View>

            <Text className="text-[10px] text-muted mt-2 text-right">
              {t("files.filesCount", { count: result.total })}
            </Text>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
