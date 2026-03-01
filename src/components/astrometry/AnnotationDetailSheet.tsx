/**
 * 标注详情弹窗
 * 显示被点击标注的详细信息
 */

import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Surface } from "heroui-native";
import type { AstrometryAnnotation } from "../../lib/astrometry/types";
import {
  ANNOTATION_TYPE_COLORS,
  ANNOTATION_TYPE_LABELS,
} from "../../lib/astrometry/annotationConstants";
import {
  pixelToRaDec,
  formatRaFromDeg,
  formatDecFromDeg,
} from "../../lib/astrometry/wcsProjection";
import type { AstrometryCalibration } from "../../lib/astrometry/types";

interface AnnotationDetailSheetProps {
  annotation: AstrometryAnnotation;
  calibration: AstrometryCalibration;
  onClose: () => void;
}

export function AnnotationDetailSheet({
  annotation,
  calibration,
  onClose,
}: AnnotationDetailSheetProps) {
  const typeColor = ANNOTATION_TYPE_COLORS[annotation.type] ?? ANNOTATION_TYPE_COLORS.other;
  const typeLabel = ANNOTATION_TYPE_LABELS[annotation.type] ?? "Unknown";
  const radec = pixelToRaDec(annotation.pixelx, annotation.pixely, calibration);

  return (
    <Surface
      className="absolute bottom-16 left-3 right-3 rounded-xl p-3"
      // Intentionally hardcoded dark overlay — always shown on top of astronomy images
      style={{ backgroundColor: "rgba(20, 20, 30, 0.92)" }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2 flex-1">
          <View className="h-3 w-3 rounded-full" style={{ backgroundColor: typeColor }} />
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {annotation.names.length > 0 ? annotation.names[0] : typeLabel}
          </Text>
          <Text className="text-[10px] text-muted" style={{ color: typeColor }}>
            {typeLabel}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Ionicons name="close-circle" size={20} className="text-muted" />
        </TouchableOpacity>
      </View>

      {/* Names */}
      {annotation.names.length > 1 && (
        <View className="flex-row flex-wrap gap-1 mb-2">
          {annotation.names.map((name, i) => (
            <Text key={i} className="text-[10px] text-muted">
              {name}
              {i < annotation.names.length - 1 ? " · " : ""}
            </Text>
          ))}
        </View>
      )}

      {/* Data rows */}
      <View className="gap-1">
        {radec && (
          <View className="flex-row justify-between">
            <Text className="text-[10px] text-muted">RA / Dec</Text>
            <Text className="text-[10px] text-foreground font-mono">
              {formatRaFromDeg(radec.ra)} {formatDecFromDeg(radec.dec)}
            </Text>
          </View>
        )}

        <View className="flex-row justify-between">
          <Text className="text-[10px] text-muted">Pixel</Text>
          <Text className="text-[10px] text-foreground font-mono">
            ({Math.round(annotation.pixelx)}, {Math.round(annotation.pixely)})
          </Text>
        </View>

        {annotation.vmag != null && (
          <View className="flex-row justify-between">
            <Text className="text-[10px] text-muted">Magnitude</Text>
            <Text className="text-[10px] text-foreground font-mono">
              {annotation.vmag.toFixed(2)} mag
            </Text>
          </View>
        )}

        {annotation.radius != null && (
          <View className="flex-row justify-between">
            <Text className="text-[10px] text-muted">Radius</Text>
            <Text className="text-[10px] text-foreground font-mono">
              {annotation.radius.toFixed(1)} px
            </Text>
          </View>
        )}
      </View>
    </Surface>
  );
}
