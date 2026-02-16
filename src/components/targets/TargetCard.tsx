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
}: TargetCardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const statusColor = {
    planned: "#6b7280",
    acquiring: "#f59e0b",
    completed: "#22c55e",
    processed: "#3b82f6",
  }[target.status];

  return (
    <PressableFeedback onPress={onPress}>
      <PressableFeedback.Highlight />
      <Card variant="secondary">
        <Card.Body className="gap-2 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
              <Ionicons
                name={getTargetIcon(target.type).name as keyof typeof Ionicons.glyphMap}
                size={16}
                color={getTargetIcon(target.type).color}
              />
              <Card.Title className="flex-shrink" numberOfLines={1}>
                {target.name}
              </Card.Title>
            </View>
            <View className="flex-row items-center gap-2">
              {/* Pin Button */}
              {showPinned && onTogglePinned && (
                <PinButton isPinned={target.isPinned} size={16} onTogglePinned={onTogglePinned} />
              )}
              {/* Favorite Button */}
              {showFavorite && onToggleFavorite && (
                <FavoriteButton
                  isFavorite={target.isFavorite}
                  size={16}
                  onToggleFavorite={onToggleFavorite}
                />
              )}
              {/* Status */}
              <View className="flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
                <Card.Description className="text-[10px]">
                  {t(
                    `targets.${target.status}` as
                      | "targets.planned"
                      | "targets.acquiring"
                      | "targets.completed"
                      | "targets.processed",
                  )}
                </Card.Description>
              </View>
            </View>
          </View>

          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Ionicons name="images-outline" size={12} color={mutedColor} />
              <Text className="text-[10px] text-muted">
                {frameCount} {t("targets.frameCount")}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Ionicons name="timer-outline" size={12} color={mutedColor} />
              <Text className="text-[10px] text-muted">{totalExposureMinutes}min</Text>
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
              <Text className="mt-0.5 text-right text-[9px] text-muted">{completionPercent}%</Text>
            </View>
          )}

          {/* Category & Tags */}
          {(target.category || target.tags.length > 0) && (
            <View className="flex-row flex-wrap gap-1 mt-1">
              {target.category && (
                <Chip size="sm" variant="primary">
                  <Chip.Label className="text-[9px]">{target.category}</Chip.Label>
                </Chip>
              )}
              {target.tags.slice(0, 3).map((tag) => (
                <Chip key={tag} size="sm" variant="secondary">
                  <Chip.Label className="text-[9px]">{tag}</Chip.Label>
                </Chip>
              ))}
              {target.tags.length > 3 && (
                <Chip size="sm" variant="secondary">
                  <Chip.Label className="text-[9px]">+{target.tags.length - 3}</Chip.Label>
                </Chip>
              )}
            </View>
          )}

          {/* Aliases */}
          {target.aliases.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1">
              {target.aliases.slice(0, 3).map((alias) => (
                <Chip key={alias} size="sm" variant="secondary">
                  <Chip.Label className="text-[9px] text-muted">{alias}</Chip.Label>
                </Chip>
              ))}
              {target.aliases.length > 3 && (
                <Chip size="sm" variant="secondary">
                  <Chip.Label className="text-[9px] text-muted">
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
