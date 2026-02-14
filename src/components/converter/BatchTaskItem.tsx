import { View, Text, TouchableOpacity } from "react-native";
import { Card, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { BatchTask } from "../../lib/fits/types";

interface BatchTaskItemProps {
  task: BatchTask;
  onCancel?: () => void;
  onRetry?: () => void;
}

export function BatchTaskItem({ task, onCancel, onRetry }: BatchTaskItemProps) {
  const { t } = useI18n();
  const [successColor, mutedColor, dangerColor] = useThemeColor(["success", "muted", "danger"]);

  const statusIcon = {
    pending: "time-outline" as const,
    running: "sync-outline" as const,
    completed: "checkmark-circle-outline" as const,
    failed: "alert-circle-outline" as const,
    cancelled: "close-circle-outline" as const,
  }[task.status];

  const statusColor = {
    pending: mutedColor,
    running: successColor,
    completed: successColor,
    failed: dangerColor,
    cancelled: mutedColor,
  }[task.status];

  return (
    <Card variant="secondary">
      <Card.Body className="p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Ionicons name={statusIcon} size={16} color={statusColor} />
            <Text className="text-xs font-semibold text-foreground capitalize">{task.type}</Text>
          </View>
          <Text className="text-[10px] text-muted">
            {task.completed}/{task.total}
            {task.failed > 0 && ` (${task.failed} failed)`}
          </Text>
        </View>

        <View className="mt-2 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
          <View className="h-full rounded-full bg-success" style={{ width: `${task.progress}%` }} />
        </View>

        {(task.status === "running" || task.status === "failed") && (
          <View className="flex-row justify-end gap-2 mt-2">
            {task.status === "running" && onCancel && (
              <TouchableOpacity onPress={onCancel}>
                <Text className="text-[10px] text-danger">{t("common.cancel")}</Text>
              </TouchableOpacity>
            )}
            {task.status === "failed" && onRetry && (
              <TouchableOpacity onPress={onRetry}>
                <Text className="text-[10px] text-success">{t("common.retry")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card.Body>
    </Card>
  );
}
