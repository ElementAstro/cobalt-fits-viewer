import { View, Text } from "react-native";
import { Button, Card, Chip } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { BatchTask } from "../../lib/fits/types";

interface BatchTaskItemProps {
  task: BatchTask;
  onCancel?: () => void;
  onRetry?: () => void;
}

const STATUS_CHIP_CONFIG: Record<
  BatchTask["status"],
  { variant: "primary" | "secondary" | "soft"; color: "default" | "accent" | "success" | "danger" }
> = {
  pending: { variant: "secondary", color: "default" },
  running: { variant: "primary", color: "accent" },
  completed: { variant: "soft", color: "success" },
  failed: { variant: "soft", color: "danger" },
  cancelled: { variant: "secondary", color: "default" },
};

export function BatchTaskItem({ task, onCancel, onRetry }: BatchTaskItemProps) {
  const { t } = useI18n();

  const statusLabel = {
    pending: t("common.pending"),
    running: t("common.running"),
    completed: t("common.completed"),
    failed: t("common.failed"),
    cancelled: t("common.cancelled"),
  }[task.status];

  return (
    <Card variant="secondary">
      <Card.Body className="p-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Chip
              size="sm"
              variant={STATUS_CHIP_CONFIG[task.status].variant}
              color={STATUS_CHIP_CONFIG[task.status].color}
            >
              <Chip.Label className="text-[9px] capitalize">{statusLabel}</Chip.Label>
            </Chip>
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
              <Button size="sm" variant="ghost" onPress={onCancel}>
                <Button.Label className="text-[10px] text-danger">
                  {t("common.cancel")}
                </Button.Label>
              </Button>
            )}
            {task.status === "failed" && onRetry && (
              <Button size="sm" variant="ghost" onPress={onRetry}>
                <Button.Label className="text-[10px] text-success">
                  {t("common.retry")}
                </Button.Label>
              </Button>
            )}
          </View>
        )}
      </Card.Body>
    </Card>
  );
}
