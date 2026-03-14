import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface PlanSelectionBarProps {
  selectedCount: number;
  calendarSyncEnabled: boolean;
  syncing: boolean;
  isLandscape: boolean;
  onClose: () => void;
  onToggleSelectAll: () => void;
  onShiftOneDay: () => void;
  onShiftOneWeek: () => void;
  onMarkPlanned: () => void;
  onMarkCompleted: () => void;
  onMarkCancelled: () => void;
  onBatchSync: () => void;
  onBatchUnsync: () => void;
  onBatchDelete: () => void;
}

export function PlanSelectionBar({
  selectedCount,
  calendarSyncEnabled,
  syncing,
  isLandscape,
  onClose,
  onToggleSelectAll,
  onShiftOneDay,
  onShiftOneWeek,
  onMarkPlanned,
  onMarkCompleted,
  onMarkCancelled,
  onBatchSync,
  onBatchUnsync,
  onBatchDelete,
}: PlanSelectionBarProps) {
  const { t } = useI18n();
  const [mutedColor, dangerColor, warningColor, successColor] = useThemeColor([
    "muted",
    "danger",
    "warning",
    "success",
  ]);

  return (
    <View className="gap-2 bg-surface-secondary px-4 py-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Button
            testID="e2e-action-tabs__plans-selection-close"
            size="sm"
            variant="ghost"
            onPress={onClose}
          >
            <Ionicons name="close" size={16} color={mutedColor} />
          </Button>
          <Text className="text-sm font-medium text-foreground">
            {selectedCount} {t("common.selected")}
          </Text>
        </View>
        <Button
          testID="e2e-action-tabs__plans-selection-select-all"
          size="sm"
          variant="ghost"
          onPress={onToggleSelectAll}
        >
          <Ionicons name="checkmark-done" size={16} color={mutedColor} />
          {!isLandscape && (
            <Button.Label className="text-[10px]">{t("sessions.planSelectAll")}</Button.Label>
          )}
        </Button>
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          testID="e2e-action-tabs__plans-selection-shift-day"
          size="sm"
          variant="ghost"
          isDisabled={selectedCount === 0}
          onPress={onShiftOneDay}
        >
          <Ionicons name="return-up-forward-outline" size={16} color={warningColor} />
          {!isLandscape && (
            <Button.Label className="text-[10px]">{t("sessions.planShiftOneDay")}</Button.Label>
          )}
        </Button>
        <Button
          testID="e2e-action-tabs__plans-selection-shift-week"
          size="sm"
          variant="ghost"
          isDisabled={selectedCount === 0}
          onPress={onShiftOneWeek}
        >
          <Ionicons name="calendar-outline" size={16} color={warningColor} />
          {!isLandscape && (
            <Button.Label className="text-[10px]">{t("sessions.planShiftOneWeek")}</Button.Label>
          )}
        </Button>
        <Button
          testID="e2e-action-tabs__plans-selection-status-planned"
          size="sm"
          variant="ghost"
          isDisabled={selectedCount === 0}
          onPress={onMarkPlanned}
        >
          <Ionicons name="refresh-outline" size={16} color={mutedColor} />
          {!isLandscape && (
            <Button.Label className="text-[10px]">{t("sessions.status.planned")}</Button.Label>
          )}
        </Button>
        <Button
          testID="e2e-action-tabs__plans-selection-status-completed"
          size="sm"
          variant="ghost"
          isDisabled={selectedCount === 0}
          onPress={onMarkCompleted}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={successColor} />
          {!isLandscape && (
            <Button.Label className="text-[10px]">{t("sessions.status.completed")}</Button.Label>
          )}
        </Button>
        <Button
          testID="e2e-action-tabs__plans-selection-status-cancelled"
          size="sm"
          variant="ghost"
          isDisabled={selectedCount === 0}
          onPress={onMarkCancelled}
        >
          <Ionicons name="close-circle-outline" size={16} color={dangerColor} />
          {!isLandscape && (
            <Button.Label className="text-[10px]">{t("sessions.status.cancelled")}</Button.Label>
          )}
        </Button>
        {calendarSyncEnabled && (
          <>
            <Button
              testID="e2e-action-tabs__plans-selection-batch-sync"
              size="sm"
              variant="ghost"
              isDisabled={selectedCount === 0 || syncing}
              onPress={onBatchSync}
            >
              <Ionicons name="sync-outline" size={16} color={mutedColor} />
              {!isLandscape && (
                <Button.Label className="text-[10px]">{t("sessions.batchSync")}</Button.Label>
              )}
            </Button>
            <Button
              testID="e2e-action-tabs__plans-selection-batch-unsync"
              size="sm"
              variant="ghost"
              isDisabled={selectedCount === 0 || syncing}
              onPress={onBatchUnsync}
            >
              <Ionicons name="link-outline" size={16} color={mutedColor} />
              {!isLandscape && (
                <Button.Label className="text-[10px]">{t("sessions.batchUnsync")}</Button.Label>
              )}
            </Button>
          </>
        )}
        <Button
          testID="e2e-action-tabs__plans-selection-delete"
          size="sm"
          variant="ghost"
          isDisabled={selectedCount === 0}
          onPress={onBatchDelete}
        >
          <Ionicons name="trash-outline" size={16} color={dangerColor} />
          {!isLandscape && (
            <Button.Label className="text-[10px]">{t("common.delete")}</Button.Label>
          )}
        </Button>
      </View>
    </View>
  );
}
