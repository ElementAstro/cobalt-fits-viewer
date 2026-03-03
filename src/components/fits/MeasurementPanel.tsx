/**
 * 测量工具面板
 * 显示测量结果列表和操作按钮
 */

import React from "react";
import { View, Text } from "react-native";
import { Button, Card, Surface } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { MeasurementLine } from "../../hooks/useMeasurement";

interface MeasurementPanelProps {
  measurements: MeasurementLine[];
  isActive: boolean;
  onToggle: () => void;
  onRemoveLast: () => void;
  onClear: () => void;
}

export const MeasurementPanel = React.memo(function MeasurementPanel({
  measurements,
  isActive,
  onToggle,
  onRemoveLast,
  onClear,
}: MeasurementPanelProps) {
  const { t } = useI18n();

  return (
    <View className="absolute top-4 right-4" style={{ maxWidth: 220 }}>
      <Card variant="secondary">
        <Card.Body className="p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="resize-outline" size={14} color={isActive ? "#f97316" : "#9ca3af"} />
              <Text
                className="text-xs font-semibold"
                style={{ color: isActive ? "#f97316" : "#9ca3af" }}
              >
                {t("viewer.measure")}
              </Text>
            </View>
            <Button size="sm" variant={isActive ? "primary" : "outline"} onPress={onToggle}>
              <Button.Label className="text-[10px]">
                {isActive ? t("common.done") : t("viewer.measure")}
              </Button.Label>
            </Button>
          </View>

          {isActive && measurements.length === 0 && (
            <Text className="mt-2 text-[9px] text-muted">{t("viewer.measureHint")}</Text>
          )}

          {measurements.length > 0 && (
            <View className="mt-2 gap-1">
              {measurements.map((m, i) => (
                <Surface key={m.id} variant="secondary" className="rounded-md px-2 py-1">
                  <Text className="text-[9px] font-medium text-foreground">
                    #{i + 1}: {m.angularDistLabel ?? `${m.pixelDist.toFixed(1)}px`}
                  </Text>
                  {m.p1.ra && m.p1.dec && m.p2.ra && m.p2.dec && (
                    <Text className="text-[8px] text-muted">
                      {m.p1.ra} → {m.p2.ra}
                    </Text>
                  )}
                </Surface>
              ))}
            </View>
          )}

          {measurements.length > 0 && (
            <View className="mt-2 flex-row gap-1.5">
              <Button size="sm" variant="outline" onPress={onRemoveLast}>
                <Button.Label className="text-[9px]">{t("common.undo")}</Button.Label>
              </Button>
              <Button size="sm" variant="outline" onPress={onClear}>
                <Button.Label className="text-[9px]">{t("common.clearAll")}</Button.Label>
              </Button>
            </View>
          )}
        </Card.Body>
      </Card>
    </View>
  );
});
