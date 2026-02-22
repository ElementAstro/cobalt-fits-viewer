/**
 * 目标批量操作工具栏
 * 在选择模式下显示，提供批量删除、收藏、设置状态等操作
 */

import React from "react";
import { Alert, View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface TargetBatchActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchDelete: () => void;
  onBatchFavorite: () => void;
  onExitSelectionMode: () => void;
}

export const TargetBatchActionBar = React.memo(function TargetBatchActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBatchDelete,
  onBatchFavorite,
  onExitSelectionMode,
}: TargetBatchActionBarProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const dangerColor = useThemeColor("danger");

  const handleBatchDelete = () => {
    Alert.alert(
      t("targets.batch.deleteSelected"),
      t("targets.batch.deleteConfirm", { count: selectedCount }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: onBatchDelete,
        },
      ],
    );
  };

  const allSelected = selectedCount === totalCount;

  return (
    <View className="flex-row items-center justify-between bg-surface-secondary px-4 py-2">
      <View className="flex-row items-center gap-2">
        <Button size="sm" variant="ghost" onPress={onExitSelectionMode}>
          <Ionicons name="close" size={18} color={mutedColor} />
        </Button>
        <Text className="text-sm font-medium text-foreground">
          {selectedCount} {t("common.selected")}
        </Text>
        <Button size="sm" variant="ghost" onPress={allSelected ? onDeselectAll : onSelectAll}>
          <Button.Label className="text-xs text-primary">
            {allSelected ? t("common.deselectAll") : t("common.selectAll")}
          </Button.Label>
        </Button>
      </View>
      <View className="flex-row items-center gap-1">
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          onPress={onBatchFavorite}
          isDisabled={selectedCount === 0}
        >
          <Ionicons name="star-outline" size={18} color={mutedColor} />
        </Button>
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          onPress={handleBatchDelete}
          isDisabled={selectedCount === 0}
        >
          <Ionicons name="trash-outline" size={18} color={dangerColor} />
        </Button>
      </View>
    </View>
  );
});
