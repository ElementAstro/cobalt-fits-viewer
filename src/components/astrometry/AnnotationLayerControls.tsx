/**
 * 标注分层过滤控制
 * 提供按天体类型的独立显隐开关
 */

import { View } from "react-native";
import { Chip } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { AstrometryAnnotation, AstrometryAnnotationType } from "../../lib/astrometry/types";
import {
  ANNOTATION_TYPE_COLORS,
  ANNOTATION_TYPE_LABELS,
  ANNOTATION_TYPES_ORDERED,
  OVERLAY_COLORS,
} from "../../lib/astrometry/annotationConstants";

/** 每种标注类型的可见性状态 */
export type AnnotationLayerVisibility = Record<AstrometryAnnotationType, boolean>;

/** 创建默认可见性 (全部显示) */
export function createDefaultLayerVisibility(): AnnotationLayerVisibility {
  return {
    messier: true,
    ngc: true,
    ic: true,
    hd: true,
    bright_star: true,
    star: true,
    other: true,
  };
}

/** 从 visibility 状态获取可见类型列表 */
export function getVisibleTypes(visibility: AnnotationLayerVisibility): AstrometryAnnotationType[] {
  return ANNOTATION_TYPES_ORDERED.filter((t) => visibility[t]);
}

interface AnnotationLayerControlsProps {
  annotations: AstrometryAnnotation[];
  visibility: AnnotationLayerVisibility;
  onToggleType: (type: AstrometryAnnotationType) => void;
  showCoordinateGrid?: boolean;
  onToggleCoordinateGrid?: () => void;
  showConstellations?: boolean;
  onToggleConstellations?: () => void;
}

export function AnnotationLayerControls({
  annotations,
  visibility,
  onToggleType,
  showCoordinateGrid,
  onToggleCoordinateGrid,
  showConstellations,
  onToggleConstellations,
}: AnnotationLayerControlsProps) {
  const { t } = useI18n();

  // Count annotations per type
  const typeCounts = ANNOTATION_TYPES_ORDERED.reduce(
    (acc, type) => {
      acc[type] = annotations.filter((a) => a.type === type).length;
      return acc;
    },
    {} as Record<AstrometryAnnotationType, number>,
  );

  // Only show types that have annotations
  const activeTypes = ANNOTATION_TYPES_ORDERED.filter((t) => typeCounts[t] > 0);

  return (
    <View className="flex-row flex-wrap gap-1 px-1 py-1">
      {activeTypes.map((type) => (
        <Chip
          key={type}
          size="sm"
          variant={visibility[type] ? "primary" : "secondary"}
          style={
            visibility[type] ? { backgroundColor: ANNOTATION_TYPE_COLORS[type] + "30" } : undefined
          }
          onPress={() => onToggleType(type)}
        >
          <Chip.Label
            className="text-[8px]"
            style={visibility[type] ? { color: ANNOTATION_TYPE_COLORS[type] } : undefined}
          >
            {ANNOTATION_TYPE_LABELS[type]} ({typeCounts[type]})
          </Chip.Label>
        </Chip>
      ))}

      {onToggleCoordinateGrid != null && (
        <Chip
          size="sm"
          variant={showCoordinateGrid ? "primary" : "secondary"}
          style={
            showCoordinateGrid
              ? { backgroundColor: OVERLAY_COLORS.coordinateGrid + "30" }
              : undefined
          }
          onPress={onToggleCoordinateGrid}
        >
          <Chip.Label
            className="text-[8px]"
            style={showCoordinateGrid ? { color: OVERLAY_COLORS.coordinateGrid } : undefined}
          >
            {t("astrometry.coordinateGrid")}
          </Chip.Label>
        </Chip>
      )}

      {onToggleConstellations != null && (
        <Chip
          size="sm"
          variant={showConstellations ? "primary" : "secondary"}
          style={
            showConstellations
              ? { backgroundColor: OVERLAY_COLORS.constellationLines + "30" }
              : undefined
          }
          onPress={onToggleConstellations}
        >
          <Chip.Label
            className="text-[8px]"
            style={showConstellations ? { color: OVERLAY_COLORS.constellationLines } : undefined}
          >
            {t("astrometry.constellationLines")}
          </Chip.Label>
        </Chip>
      )}
    </View>
  );
}
