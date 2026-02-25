import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface SessionSelectionBarProps {
  selectedCount: number;
  calendarSyncEnabled: boolean;
  syncing: boolean;
  onClose: () => void;
  onToggleSelectAll: () => void;
  onBatchSync: () => void;
  onBatchRefresh: () => void;
  onBatchUnsync: () => void;
  onBatchDelete: () => void;
}

export function SessionSelectionBar({
  selectedCount,
  calendarSyncEnabled,
  syncing,
  onClose,
  onToggleSelectAll,
  onBatchSync,
  onBatchRefresh,
  onBatchUnsync,
  onBatchDelete,
}: SessionSelectionBarProps) {
  const { t } = useI18n();
  const [mutedColor, dangerColor] = useThemeColor(["muted", "danger"]);

  return (
    <View className="flex-row items-center justify-between bg-surface-secondary px-4 py-2">
      <View className="flex-row items-center gap-2">
        <Button size="sm" variant="ghost" onPress={onClose}>
          <Ionicons name="close" size={16} color={mutedColor} />
        </Button>
        <Text className="text-sm font-medium text-foreground">
          {selectedCount} {t("common.selected")}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Button
          testID="e2e-action-tabs__sessions-selection-select-all"
          size="sm"
          variant="ghost"
          onPress={onToggleSelectAll}
        >
          <Ionicons name="checkmark-done" size={16} color={mutedColor} />
        </Button>
        {calendarSyncEnabled && (
          <>
            <Button
              testID="e2e-action-tabs__sessions-selection-batch-sync"
              size="sm"
              variant="ghost"
              isDisabled={selectedCount === 0 || syncing}
              onPress={onBatchSync}
            >
              <Ionicons name="sync-outline" size={16} color={mutedColor} />
              <Button.Label className="text-[10px]">{t("sessions.batchSync")}</Button.Label>
            </Button>
            <Button
              testID="e2e-action-tabs__sessions-selection-batch-refresh"
              size="sm"
              variant="ghost"
              isDisabled={selectedCount === 0 || syncing}
              onPress={onBatchRefresh}
            >
              <Ionicons name="refresh-outline" size={16} color={mutedColor} />
              <Button.Label className="text-[10px]">{t("sessions.batchRefresh")}</Button.Label>
            </Button>
            <Button
              testID="e2e-action-tabs__sessions-selection-batch-unsync"
              size="sm"
              variant="ghost"
              isDisabled={selectedCount === 0 || syncing}
              onPress={onBatchUnsync}
            >
              <Ionicons name="link-outline" size={16} color={mutedColor} />
              <Button.Label className="text-[10px]">{t("sessions.batchUnsync")}</Button.Label>
            </Button>
          </>
        )}
        <Button
          testID="e2e-action-tabs__sessions-selection-delete"
          size="sm"
          variant="ghost"
          isDisabled={selectedCount === 0}
          onPress={onBatchDelete}
        >
          <Ionicons name="trash-outline" size={16} color={dangerColor} />
        </Button>
      </View>
    </View>
  );
}
