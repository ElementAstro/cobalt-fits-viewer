import { View, Text } from "react-native";
import { Button, Card } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { StarAnnotationStaleReason } from "../../lib/fits/types";

interface StarAnnotationPanelProps {
  successColor: string;
  detectedStarCount: number;
  manualStarCount: number;
  enabledStarCount: number;
  starAnnotationsStale: boolean;
  starAnnotationsStaleReason?: StarAnnotationStaleReason;
  isDetectingStars: boolean;
  starDetectionStage: string;
  starDetectionProgress: number;
  pendingAnchorIndex: 1 | 2 | 3 | null;
  onClose: () => void;
  onReDetect: () => void;
  onCancelDetection: () => void;
  onSetAnchor: (index: 1 | 2 | 3 | null) => void;
  onClearAnchors: () => void;
}

export function StarAnnotationPanel({
  successColor,
  detectedStarCount,
  manualStarCount,
  enabledStarCount,
  starAnnotationsStale,
  starAnnotationsStaleReason,
  isDetectingStars,
  starDetectionStage,
  starDetectionProgress,
  pendingAnchorIndex,
  onClose,
  onReDetect,
  onCancelDetection,
  onSetAnchor,
  onClearAnchors,
}: StarAnnotationPanelProps) {
  const { t } = useI18n();

  return (
    <View className="absolute top-4 left-4 right-4">
      <Card variant="secondary">
        <Card.Body className="p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="star-outline" size={14} color={successColor} />
              <Text className="text-xs font-semibold text-success">
                {t("editor.starAnnotationMode")}
              </Text>
            </View>
            <Button size="sm" variant="outline" onPress={onClose}>
              <Button.Label className="text-[10px]">{t("common.close")}</Button.Label>
            </Button>
          </View>

          <Text
            testID="e2e-text-editor__param_id-star-counts"
            className="mt-2 text-[10px] text-muted"
          >
            {t("editor.detectedStars")}: {detectedStarCount} · {t("editor.manualStars")}:{" "}
            {manualStarCount} · {t("editor.enabledStars")}: {enabledStarCount}
          </Text>

          {starAnnotationsStale && (
            <View className="mt-2 rounded-md bg-warning/15 px-2 py-1">
              <Text className="text-[9px] text-warning">
                {t("editor.annotationStale")}
                {starAnnotationsStaleReason ? ` (${starAnnotationsStaleReason})` : ""}
              </Text>
            </View>
          )}

          {isDetectingStars && (
            <View className="mt-2 rounded-md bg-success/10 px-2 py-1">
              <Text className="text-[9px] text-success">
                {t("editor.reDetectStars")} · {starDetectionStage} · {starDetectionProgress}%
              </Text>
            </View>
          )}

          <View className="mt-2 flex-row flex-wrap gap-1.5">
            <Button
              testID="e2e-action-editor__param_id-redetect-stars"
              size="sm"
              variant="outline"
              onPress={onReDetect}
              isDisabled={isDetectingStars}
            >
              <Button.Label className="text-[9px]">{t("editor.reDetectStars")}</Button.Label>
            </Button>
            {isDetectingStars && (
              <Button size="sm" variant="outline" onPress={onCancelDetection}>
                <Button.Label className="text-[9px]">{t("common.cancel")}</Button.Label>
              </Button>
            )}
            <Button
              size="sm"
              variant={pendingAnchorIndex === 1 ? "primary" : "outline"}
              onPress={() => onSetAnchor(pendingAnchorIndex === 1 ? null : 1)}
            >
              <Button.Label className="text-[9px]">{t("editor.setAnchor1")}</Button.Label>
            </Button>
            <Button
              size="sm"
              variant={pendingAnchorIndex === 2 ? "primary" : "outline"}
              onPress={() => onSetAnchor(pendingAnchorIndex === 2 ? null : 2)}
            >
              <Button.Label className="text-[9px]">{t("editor.setAnchor2")}</Button.Label>
            </Button>
            <Button
              size="sm"
              variant={pendingAnchorIndex === 3 ? "primary" : "outline"}
              onPress={() => onSetAnchor(pendingAnchorIndex === 3 ? null : 3)}
            >
              <Button.Label className="text-[9px]">{t("editor.setAnchor3")}</Button.Label>
            </Button>
            <Button size="sm" variant="outline" onPress={onClearAnchors}>
              <Button.Label className="text-[9px]">{t("editor.clearAnchors")}</Button.Label>
            </Button>
          </View>
        </Card.Body>
      </Card>
    </View>
  );
}
