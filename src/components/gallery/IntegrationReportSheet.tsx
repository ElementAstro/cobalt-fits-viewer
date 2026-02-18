import { useMemo } from "react";
import { View, Text, FlatList } from "react-native";
import { BottomSheet, Button, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { getFrameTypeDefinitions } from "../../lib/gallery/frameClassifier";
import {
  generateIntegrationReport,
  formatExposureTime,
  exportReportAsMarkdown,
  type TargetReport,
} from "../../lib/gallery/integrationReport";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

interface IntegrationReportSheetProps {
  visible: boolean;
  onClose: () => void;
}

function QualityBadge({ score }: { score: number | null }) {
  const [successColor, warningColor, dangerColor, _mutedColor] = useThemeColor([
    "success",
    "warning",
    "danger",
    "muted",
  ]);

  if (score == null) {
    return <Text className="text-[10px] text-muted">—</Text>;
  }

  const color = score >= 70 ? successColor : score >= 40 ? warningColor : dangerColor;
  return <Text style={{ color, fontSize: 10, fontWeight: "600" }}>{score.toFixed(0)}</Text>;
}

export function IntegrationReportSheet({ visible, onClose }: IntegrationReportSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const haptics = useHapticFeedback();
  const files = useFitsStore((s) => s.files);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);
  const reportFrameTypes = useSettingsStore((s) => s.reportFrameTypes);

  const frameTypeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const definition of getFrameTypeDefinitions(frameClassificationConfig)) {
      map.set(
        definition.key,
        definition.builtin
          ? (t(`gallery.frameTypes.${definition.key}`) ?? definition.label)
          : definition.label || definition.key,
      );
    }
    return map;
  }, [frameClassificationConfig, t]);

  const report = useMemo(
    () =>
      generateIntegrationReport(files, {
        includedFrameTypes: reportFrameTypes,
      }),
    [files, reportFrameTypes],
  );
  const scopeLabel = useMemo(
    () => report.includedFrameTypes.map((type) => frameTypeLabelMap.get(type) ?? type).join(", "),
    [frameTypeLabelMap, report.includedFrameTypes],
  );

  const handleCopyMarkdown = async () => {
    const md = exportReportAsMarkdown(report);
    await Clipboard.setStringAsync(md);
    haptics.notify(Haptics.NotificationFeedbackType.Success);
  };

  const renderTarget = ({ item }: { item: TargetReport }) => (
    <View className="mb-4 px-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {item.target}
        </Text>
        <Text className="text-[10px] text-muted">
          {item.totalFrames}F · {formatExposureTime(item.totalExposure)}
        </Text>
      </View>

      {/* Filter rows */}
      <View className="rounded-lg bg-card/50 overflow-hidden">
        {/* Header */}
        <View className="flex-row px-3 py-1.5 bg-card">
          <Text className="flex-1 text-[9px] font-semibold text-muted">{t("gallery.filter")}</Text>
          <Text className="w-12 text-center text-[9px] font-semibold text-muted">
            {t("gallery.frames")}
          </Text>
          <Text className="w-16 text-right text-[9px] font-semibold text-muted">
            {t("gallery.totalExp")}
          </Text>
          <Text className="w-12 text-right text-[9px] font-semibold text-muted">
            {t("gallery.quality")}
          </Text>
        </View>

        {item.filters.map((f, i) => (
          <View
            key={f.name}
            className={`flex-row items-center px-3 py-1.5 ${i % 2 === 0 ? "" : "bg-card/30"}`}
          >
            <Text className="flex-1 text-[10px] text-foreground" numberOfLines={1}>
              {f.name}
            </Text>
            <Text className="w-12 text-center text-[10px] text-foreground">{f.frameCount}</Text>
            <Text className="w-16 text-right text-[10px] text-foreground">
              {formatExposureTime(f.totalExposure)}
            </Text>
            <View className="w-12 items-end">
              <QualityBadge score={f.avgQuality} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );

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
          <BottomSheet.Title className="text-center">
            {t("gallery.integrationReport")}
          </BottomSheet.Title>

          {/* Summary */}
          <View className="flex-row justify-around px-4 py-2">
            <View className="items-center">
              <Text className="text-lg font-bold text-foreground">{report.targets.length}</Text>
              <Text className="text-[9px] text-muted">{t("gallery.targets")}</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-foreground">{report.totalFrames}</Text>
              <Text className="text-[9px] text-muted">{t("gallery.includedFrames")}</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-foreground">
                {formatExposureTime(report.totalExposure)}
              </Text>
              <Text className="text-[9px] text-muted">{t("gallery.totalExp")}</Text>
            </View>
          </View>

          <Text className="text-center text-[10px] text-muted mb-1">
            {t("gallery.reportScope")}: {scopeLabel || "light"}
          </Text>

          {report.dateRange && (
            <Text className="text-center text-[10px] text-muted mb-1">
              {report.dateRange[0].split("T")[0]} — {report.dateRange[1].split("T")[0]}
            </Text>
          )}

          <Separator className="my-1" />

          {report.targets.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="telescope-outline" size={28} color={mutedColor} />
              <Text className="mt-2 text-xs text-muted">{t("gallery.noFramesInScope")}</Text>
            </View>
          ) : (
            <FlatList
              data={report.targets}
              keyExtractor={(item) => item.target}
              renderItem={renderTarget}
              style={{ maxHeight: 320 }}
            />
          )}

          <Separator className="my-1" />
          <View className="flex-row gap-2 px-4 py-2">
            <Button variant="outline" onPress={onClose} className="flex-1">
              <Button.Label>{t("common.close")}</Button.Label>
            </Button>
            <Button
              variant="outline"
              onPress={handleCopyMarkdown}
              className="flex-1"
              isDisabled={report.targets.length === 0}
            >
              <Ionicons name="copy-outline" size={14} color={successColor} />
              <Button.Label className="text-xs">{t("common.copy")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
