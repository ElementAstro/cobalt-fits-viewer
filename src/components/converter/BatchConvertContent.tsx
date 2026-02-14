import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useConverter } from "../../hooks/useConverter";
import { useFitsStore } from "../../stores/useFitsStore";
import { BatchTaskItem } from "./BatchTaskItem";
import { EmptyState } from "../common/EmptyState";

export function BatchConvertContent() {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const { batchTasks, startBatchConvert, cancelTask, retryTask, clearCompletedTasks } =
    useConverter();

  const files = useFitsStore((s) => s.files);
  const selectedIds = useFitsStore((s) => s.selectedIds);

  const handleAddSelected = () => {
    const filesToConvert =
      selectedIds.length > 0 ? files.filter((f) => selectedIds.includes(f.id)) : files;

    if (filesToConvert.length === 0) return;

    startBatchConvert(
      filesToConvert.map((f) => ({
        id: f.id,
        filepath: f.filepath,
        filename: f.filename,
      })),
    );
  };

  const completedCount = batchTasks.filter(
    (t) => t.status === "completed" || t.status === "failed",
  ).length;

  return (
    <View className="gap-4">
      {/* Actions */}
      <View className="flex-row gap-2">
        <Button variant="primary" className="flex-1" onPress={handleAddSelected}>
          <Ionicons name="add-circle-outline" size={16} color="#fff" />
          <Button.Label>
            {selectedIds.length > 0
              ? `${t("converter.convert")} (${selectedIds.length})`
              : t("converter.convert")}
          </Button.Label>
        </Button>
        {completedCount > 0 && (
          <Button variant="outline" onPress={clearCompletedTasks}>
            <Ionicons name="trash-outline" size={16} color={mutedColor} />
          </Button>
        )}
      </View>

      {/* Stats */}
      <View className="flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
        <Ionicons name="layers-outline" size={14} color={mutedColor} />
        <Text className="text-xs text-muted">
          {batchTasks.length} {t("converter.queue").toLowerCase()} ·{" "}
          {t("converter.filesAvailable").replace("{count}", String(files.length))}
        </Text>
      </View>

      {/* Queue */}
      <Text className="text-xs font-semibold uppercase text-muted">
        {t("converter.queue")} ({batchTasks.length})
      </Text>

      {batchTasks.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title={t("common.noData")}
          description={t("converter.batchEmptyHint")}
        />
      ) : (
        <View className="gap-2">
          {batchTasks.map((task) => (
            <BatchTaskItem
              key={task.id}
              task={task}
              onCancel={() => cancelTask(task.id)}
              onRetry={() => retryTask(task.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
