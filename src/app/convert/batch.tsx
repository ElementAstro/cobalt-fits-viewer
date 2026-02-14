import { View, Text, ScrollView } from "react-native";
import { Button, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useConverter } from "../../hooks/useConverter";
import { useFitsStore } from "../../stores/useFitsStore";
import { BatchTaskItem } from "../../components/converter/BatchTaskItem";
import { EmptyState } from "../../components/common/EmptyState";

export default function BatchConvertScreen() {
  const router = useRouter();
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
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-14">
      <View className="flex-row items-center gap-3 mb-4">
        <Button size="sm" variant="outline" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">{t("converter.batchConvert")}</Text>
          <Text className="text-[10px] text-muted">
            {batchTasks.length} tasks · {files.length} files available
          </Text>
        </View>
      </View>

      <Separator className="mb-4" />

      {/* Actions */}
      <View className="flex-row gap-2 mb-4">
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

      {/* Queue */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">
        {t("converter.queue")} ({batchTasks.length})
      </Text>

      {batchTasks.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title={t("common.noData")}
          description="Select files and start a batch conversion"
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
    </ScrollView>
  );
}
