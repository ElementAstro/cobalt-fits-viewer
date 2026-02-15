/**
 * Astrometry 解析结果详情组件
 * 显示 WCS 标定数据和检测到的天体列表
 */

import { View, Text, ScrollView } from "react-native";
import { Button, Card, Chip, Separator } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { AstrometryResult, AstrometryAnnotationType } from "../../lib/astrometry/types";
import { formatRA, formatDec, formatFieldSize } from "../../lib/astrometry/formatUtils";

interface AstrometryResultViewProps {
  result: AstrometryResult;
  onWriteToHeader?: () => void;
  onExportWCS?: () => void;
  onSyncToTarget?: () => void;
  onToggleAnnotations?: () => void;
  showAnnotations?: boolean;
}

const ANNOTATION_COLORS: Record<AstrometryAnnotationType, string> = {
  messier: "danger",
  ngc: "accent",
  ic: "accent",
  hd: "default",
  bright_star: "success",
  star: "default",
  other: "default",
};

export function AstrometryResultView({
  result,
  onWriteToHeader,
  onExportWCS,
  onSyncToTarget,
  onToggleAnnotations,
  showAnnotations,
}: AstrometryResultViewProps) {
  const { t } = useI18n();
  const { calibration, annotations, tags } = result;

  return (
    <View className="gap-4">
      {/* WCS 标定数据 */}
      <Card>
        <Card.Header>
          <Card.Title>{t("astrometry.calibrationData")}</Card.Title>
        </Card.Header>
        <Card.Body className="px-4 pb-4">
          <DataRow
            label={t("astrometry.center")}
            value={`${formatRA(calibration.ra)}  ${formatDec(calibration.dec)}`}
          />
          <Separator />
          <DataRow
            label={t("astrometry.fieldSize")}
            value={`${formatFieldSize(calibration.fieldWidth)} × ${formatFieldSize(calibration.fieldHeight)}`}
          />
          <Separator />
          <DataRow
            label={t("astrometry.pixelScale")}
            value={`${calibration.pixscale.toFixed(3)}″/px`}
          />
          <Separator />
          <DataRow
            label={t("astrometry.orientation")}
            value={`${calibration.orientation.toFixed(2)}°`}
          />
          <Separator />
          <DataRow
            label={t("astrometry.parity")}
            value={calibration.parity === 0 ? "Normal" : "Flipped"}
          />
        </Card.Body>
      </Card>

      {/* 操作按钮 */}
      <View className="flex-row flex-wrap gap-2">
        {onWriteToHeader && (
          <Button variant="primary" size="sm" className="flex-1" onPress={onWriteToHeader}>
            <Button.Label className="text-xs">
              <Ionicons name="code-slash-outline" size={14} /> {t("astrometry.writeToHeader")}
            </Button.Label>
          </Button>
        )}
        {onExportWCS && (
          <Button variant="secondary" size="sm" className="flex-1" onPress={onExportWCS}>
            <Button.Label className="text-xs">
              <Ionicons name="download-outline" size={14} /> {t("astrometry.exportWCS")}
            </Button.Label>
          </Button>
        )}
        {onSyncToTarget && (
          <Button variant="secondary" size="sm" className="flex-1" onPress={onSyncToTarget}>
            <Button.Label className="text-xs">{t("astrometry.syncToTarget")}</Button.Label>
          </Button>
        )}
      </View>

      {/* 天体标注 */}
      {annotations.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>
              {t("astrometry.detectedObjects")} ({annotations.length})
            </Card.Title>
          </Card.Header>
          <Card.Body className="px-4 pb-4">
            {onToggleAnnotations && (
              <Button
                variant="ghost"
                size="sm"
                onPress={onToggleAnnotations}
                className="mb-2 self-start"
              >
                <Button.Label className="text-xs">
                  <Ionicons name={showAnnotations ? "eye-off-outline" : "eye-outline"} size={14} />{" "}
                  {showAnnotations
                    ? t("astrometry.hideAnnotations")
                    : t("astrometry.showAnnotations")}
                </Button.Label>
              </Button>
            )}

            <ScrollView style={{ maxHeight: 300 }}>
              {annotations.map((ann, i) => (
                <View key={i} className="flex-row items-center gap-2 py-1.5">
                  <Chip
                    size="sm"
                    variant="soft"
                    color={
                      ANNOTATION_COLORS[ann.type] as "default" | "accent" | "success" | "danger"
                    }
                  >
                    <Chip.Label className="text-[8px] uppercase">{ann.type}</Chip.Label>
                  </Chip>
                  <Text className="text-xs text-foreground flex-1" numberOfLines={1}>
                    {ann.names.length > 0 ? ann.names.join(", ") : `Object ${i + 1}`}
                  </Text>
                  <Text className="text-[10px] text-muted">
                    ({Math.round(ann.pixelx)}, {Math.round(ann.pixely)})
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Card.Body>
        </Card>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <View className="flex-row flex-wrap gap-1">
          {tags.slice(0, 20).map((tag, i) => (
            <Chip key={i} size="sm" variant="secondary">
              <Chip.Label className="text-[9px]">{tag}</Chip.Label>
            </Chip>
          ))}
        </View>
      )}
    </View>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-xs font-mono text-foreground">{value}</Text>
    </View>
  );
}
