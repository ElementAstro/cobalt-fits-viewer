import { Text, View } from "react-native";
import { Button, Card, Chip, useThemeColor } from "heroui-native";
import type { VideoTaskRecord } from "../../stores/useVideoTaskStore";
import type { VideoProcessingCapabilities } from "../../lib/video/engine";
import { translateEngineError, taskStatusColor, translateTaskStatus } from "../../lib/video/format";
import { AnimatedProgressBar } from "../common/AnimatedProgressBar";
import { useI18n } from "../../i18n/useI18n";

interface VideoTasksTabProps {
  fileTasks: VideoTaskRecord[];
  isEngineAvailable: boolean;
  engineCapabilities: VideoProcessingCapabilities | null;
  onOpenOutput: (fileId: string) => void;
}

export function VideoTasksTab({
  fileTasks,
  isEngineAvailable,
  engineCapabilities,
  onOpenOutput,
}: VideoTasksTabProps) {
  const { t } = useI18n();
  const successColor = useThemeColor("success");

  return (
    <View className="mt-3 gap-2">
      {!isEngineAvailable && (
        <Card variant="secondary">
          <Card.Body className="p-3">
            <Text className="text-xs text-muted">
              {t("settings.videoEngineUnavailable")}:{" "}
              {engineCapabilities?.unavailableReason ?? "ffmpeg_executor_unavailable"}.
            </Text>
          </Card.Body>
        </Card>
      )}
      {fileTasks.length === 0 && (
        <Card variant="secondary">
          <Card.Body className="p-3">
            <Text className="text-xs text-muted">{t("settings.videoNoTasks")}</Text>
          </Card.Body>
        </Card>
      )}
      {fileTasks.map((task) => (
        <Card key={task.id} variant="secondary">
          <Card.Body className="gap-2 p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-foreground">
                {task.request.operation.toUpperCase()}
              </Text>
              <Chip size="sm" variant="soft" color={taskStatusColor(task.status)}>
                <Chip.Label>{translateTaskStatus(task.status, t)}</Chip.Label>
              </Chip>
            </View>
            <Text className="text-xs text-muted">{Math.round(task.progress * 100)}%</Text>
            {(task.status === "running" || task.status === "completed") && (
              <AnimatedProgressBar
                progress={task.progress * 100}
                color={task.status === "completed" ? successColor : undefined}
              />
            )}
            {!!task.error && (
              <Text className="text-xs text-danger">{translateEngineError(task.error, t)}</Text>
            )}
            {!!task.engineErrorCode && (
              <Text className="text-[10px] text-muted">
                {t("settings.videoErrorCodeLabel", { code: task.engineErrorCode })}
              </Text>
            )}
            {task.status === "completed" && (task.outputFileIds?.length ?? 0) > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {task.outputFileIds?.map((fileId, index) => (
                  <Button
                    key={`${task.id}_${fileId}`}
                    size="sm"
                    variant="outline"
                    onPress={() => onOpenOutput(fileId)}
                  >
                    <Button.Label>
                      {t("settings.videoOpenOutput", { index: index + 1 })}
                    </Button.Label>
                  </Button>
                ))}
              </View>
            )}
          </Card.Body>
        </Card>
      ))}
    </View>
  );
}
