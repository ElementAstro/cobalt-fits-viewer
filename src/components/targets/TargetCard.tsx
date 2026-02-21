/**
 * 目标卡片组件
 */

import { View, Text } from "react-native";
import { Card, Chip, PressableFeedback, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type { Target } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";
import { getTargetIcon } from "../../lib/targets/targetIcons";
import { FavoriteButton, PinButton } from "./FavoriteButton";
import type {
  ResolvedTargetInteractionUi,
  TargetActionControlMode,
  TargetActionSizePreset,
} from "../../lib/targets/targetInteractionUi";
import { resolveTargetInteractionUi } from "../../lib/targets/targetInteractionUi";

interface TargetCardProps {
  target: Target;
  frameCount: number;
  totalExposureMinutes: number;
  completionPercent?: number;
  onPress?: () => void;
  onToggleFavorite?: () => void;
  onTogglePinned?: () => void;
  showFavorite?: boolean;
  showPinned?: boolean;
  actionControlMode?: TargetActionControlMode;
  actionSizePreset?: TargetActionSizePreset;
  actionAutoScaleFromFont?: boolean;
  fontScale?: number;
  interactionUi?: ResolvedTargetInteractionUi;
}

export function TargetCard({
  target,
  frameCount,
  totalExposureMinutes,
  completionPercent,
  onPress,
  onToggleFavorite,
  onTogglePinned,
  showFavorite = true,
  showPinned = true,
  actionControlMode = "icon",
  actionSizePreset = "standard",
  actionAutoScaleFromFont = true,
  fontScale = 1,
  interactionUi,
}: TargetCardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const resolvedInteractionUi =
    interactionUi ??
    resolveTargetInteractionUi({
      preset: actionSizePreset,
      autoScaleFromFont: actionAutoScaleFromFont,
      fontScale,
    });

  const statusColor = {
    planned: "#6b7280",
    acquiring: "#f59e0b",
    completed: "#22c55e",
    processed: "#3b82f6",
  }[target.status];

  const statusTextClassName =
    resolvedInteractionUi.effectivePreset === "accessible"
      ? "text-xs"
      : resolvedInteractionUi.effectivePreset === "standard"
        ? "text-[11px]"
        : "text-[10px]";
  const metricTextClassName =
    resolvedInteractionUi.effectivePreset === "accessible"
      ? "text-xs text-muted"
      : resolvedInteractionUi.effectivePreset === "standard"
        ? "text-[11px] text-muted"
        : "text-[10px] text-muted";
  const compactLabelClassName =
    resolvedInteractionUi.effectivePreset === "accessible"
      ? "text-[11px]"
      : resolvedInteractionUi.effectivePreset === "standard"
        ? "text-[10px]"
        : "text-[9px]";
  const completionTextClassName =
    resolvedInteractionUi.effectivePreset === "accessible"
      ? "mt-1 text-right text-[11px] text-muted"
      : resolvedInteractionUi.effectivePreset === "standard"
        ? "mt-0.5 text-right text-[10px] text-muted"
        : "mt-0.5 text-right text-[9px] text-muted";
  const statusDotSize = resolvedInteractionUi.effectivePreset === "accessible" ? 10 : 8;
  const showStatusInline = actionControlMode === "icon";

  return (
    <PressableFeedback onPress={onPress}>
      <PressableFeedback.Highlight />
      <Card variant="secondary">
        <Card.Body className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
              <Ionicons
                name={getTargetIcon(target.type).name as keyof typeof Ionicons.glyphMap}
                size={resolvedInteractionUi.iconSize}
                color={getTargetIcon(target.type).color}
              />
              <Card.Title className="flex-shrink" numberOfLines={1}>
                {target.name}
              </Card.Title>
            </View>
            <View
              className={`flex-row items-center ${actionControlMode === "checkbox" ? "gap-1" : "gap-2"}`}
            >
              {showPinned && onTogglePinned && (
                <PinButton
                  isPinned={target.isPinned}
                  onTogglePinned={onTogglePinned}
                  mode={actionControlMode}
                  interactionUi={resolvedInteractionUi}
                  label={t("targets.pin")}
                  testID="target-card-pin"
                />
              )}
              {showFavorite && onToggleFavorite && (
                <FavoriteButton
                  isFavorite={target.isFavorite}
                  onToggleFavorite={onToggleFavorite}
                  mode={actionControlMode}
                  interactionUi={resolvedInteractionUi}
                  label={t("targets.favorites")}
                  testID="target-card-favorite"
                />
              )}
              {showStatusInline && (
                <View className="flex-row items-center gap-1.5">
                  <View
                    className="rounded-full"
                    style={{
                      backgroundColor: statusColor,
                      width: statusDotSize,
                      height: statusDotSize,
                    }}
                  />
                  <Card.Description className={statusTextClassName}>
                    {t(
                      `targets.${target.status}` as
                        | "targets.planned"
                        | "targets.acquiring"
                        | "targets.completed"
                        | "targets.processed",
                    )}
                  </Card.Description>
                </View>
              )}
            </View>
          </View>

          {!showStatusInline && (
            <View className="flex-row items-center gap-1.5">
              <View
                className="rounded-full"
                style={{
                  backgroundColor: statusColor,
                  width: statusDotSize,
                  height: statusDotSize,
                }}
              />
              <Card.Description className={statusTextClassName}>
                {t(
                  `targets.${target.status}` as
                    | "targets.planned"
                    | "targets.acquiring"
                    | "targets.completed"
                    | "targets.processed",
                )}
              </Card.Description>
            </View>
          )}

          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Ionicons
                name="images-outline"
                size={resolvedInteractionUi.compactIconSize}
                color={mutedColor}
              />
              <Text className={metricTextClassName}>
                {frameCount} {t("targets.frameCount")}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons
                name="timer-outline"
                size={resolvedInteractionUi.compactIconSize}
                color={mutedColor}
              />
              <Text className={metricTextClassName}>{totalExposureMinutes}min</Text>
            </View>
          </View>

          {completionPercent !== undefined && (
            <View className="mt-1">
              <View className="h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                <View
                  className="h-full rounded-full bg-success"
                  style={{ width: `${completionPercent}%` }}
                />
              </View>
              <Text className={completionTextClassName}>{completionPercent}%</Text>
            </View>
          )}

          {(target.category || target.tags.length > 0) && (
            <View className="flex-row flex-wrap gap-1 mt-1">
              {target.category && (
                <Chip size={resolvedInteractionUi.chipSize} variant="primary">
                  <Chip.Label className={compactLabelClassName}>{target.category}</Chip.Label>
                </Chip>
              )}
              {target.tags.slice(0, 3).map((tag) => (
                <Chip key={tag} size={resolvedInteractionUi.chipSize} variant="secondary">
                  <Chip.Label className={compactLabelClassName}>{tag}</Chip.Label>
                </Chip>
              ))}
              {target.tags.length > 3 && (
                <Chip size={resolvedInteractionUi.chipSize} variant="secondary">
                  <Chip.Label className={compactLabelClassName}>
                    +{target.tags.length - 3}
                  </Chip.Label>
                </Chip>
              )}
            </View>
          )}

          {target.aliases.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1">
              {target.aliases.slice(0, 3).map((alias) => (
                <Chip key={alias} size={resolvedInteractionUi.chipSize} variant="secondary">
                  <Chip.Label className={`${compactLabelClassName} text-muted`}>{alias}</Chip.Label>
                </Chip>
              ))}
              {target.aliases.length > 3 && (
                <Chip size={resolvedInteractionUi.chipSize} variant="secondary">
                  <Chip.Label className={`${compactLabelClassName} text-muted`}>
                    +{target.aliases.length - 3}
                  </Chip.Label>
                </Chip>
              )}
            </View>
          )}
        </Card.Body>
      </Card>
    </PressableFeedback>
  );
}
