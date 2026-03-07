import { ScrollView, Text, View } from "react-native";
import { Accordion, Button, Card, Chip, Dialog, Spinner, useThemeColor } from "heroui-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import type { VideoTaskRecord } from "../../stores/processing/useVideoTaskStore";
import { MAX_VIDEO_RETRIES } from "../../stores/processing/useVideoTaskStore";
import { translateEngineError, taskStatusColor, translateTaskStatus } from "../../lib/video/format";
import { formatEta } from "../../lib/utils/formatTime";
import { AnimatedProgressBar } from "../common/AnimatedProgressBar";
import { useI18n } from "../../i18n/useI18n";

interface TaskQueueSheetProps {
  visible: boolean;
  tasks: VideoTaskRecord[];
  onClose: () => void;
  onCancelTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onRemoveTask: (taskId: string) => void;
  onClearFinished: () => void;
  onOpenOutputFile?: (fileId: string) => void;
}

function progressLabel(task: VideoTaskRecord): string {
  if (task.status === "running") {
    const pct = `${Math.round(task.progress * 100)}%`;
    if (task.startedAt && task.progress > 0.01) {
      const elapsed = Date.now() - task.startedAt;
      const remaining = (elapsed / task.progress - elapsed) / 1000;
      if (remaining > 0 && Number.isFinite(remaining)) {
        return `${pct} · ~${formatEta(remaining)}`;
      }
    }
    return pct;
  }
  if (task.status === "completed") return "100%";
  return "0%";
}

export function TaskQueueSheet({
  visible,
  tasks,
  onClose,
  onCancelTask,
  onRetryTask,
  onRemoveTask,
  onClearFinished,
  onOpenOutputFile,
}: TaskQueueSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="max-w-[460px]">
          <Dialog.Title>{t("settings.videoTaskQueueTitle")}</Dialog.Title>
          <Dialog.Description>{t("settings.videoTaskQueueDesc")}</Dialog.Description>

          <ScrollView className="mt-3 max-h-[420px]">
            <View className="gap-2">
              {tasks.length === 0 && (
                <View className="rounded-lg border border-separator bg-surface-secondary p-3">
                  <Text className="text-sm text-muted">{t("settings.videoNoQueuedTasks")}</Text>
                </View>
              )}
              {tasks.map((task) => (
                <Card key={task.id} variant="secondary">
                  <Card.Body className="gap-2 p-3">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-sm font-semibold text-foreground">
                        {task.request.operation.toUpperCase()} · {task.request.sourceFilename}
                      </Text>
                      <Chip size="sm" variant="soft" color={taskStatusColor(task.status)}>
                        <Chip.Label className="text-[10px]">
                          {translateTaskStatus(task.status, t)}
                        </Chip.Label>
                      </Chip>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">{progressLabel(task)}</Text>
                      {task.status === "running" && <Spinner size="sm" />}
                    </View>
                    {(task.status === "running" || task.status === "completed") && (
                      <AnimatedProgressBar
                        progress={task.progress * 100}
                        color={task.status === "completed" ? successColor : undefined}
                      />
                    )}
                    {!!task.error && (
                      <Text className="text-xs text-danger">
                        {translateEngineError(task.error, t)}
                      </Text>
                    )}
                    {task.logLines.length > 0 && (
                      <Accordion>
                        <Accordion.Item value="logs">
                          <Accordion.Trigger>
                            <Text className="flex-1 text-[10px] text-muted">
                              {t("settings.videoFfmpegLog", { count: task.logLines.length })}
                            </Text>
                            <Accordion.Indicator />
                          </Accordion.Trigger>
                          <Accordion.Content>
                            <View className="mb-1 flex-row justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onPress={() => {
                                  void Clipboard.setStringAsync(task.logLines.join("\n"));
                                }}
                                accessibilityLabel={t("settings.videoCopyLog")}
                              >
                                <Ionicons name="copy-outline" size={12} color={mutedColor} />
                                <Button.Label className="text-[10px]">
                                  {t("settings.videoCopyLog")}
                                </Button.Label>
                              </Button>
                            </View>
                            <ScrollView className="max-h-40">
                              <Text
                                className="text-[9px] text-muted"
                                style={{ fontFamily: "monospace" }}
                                selectable
                              >
                                {task.logLines.slice(-50).join("\n")}
                              </Text>
                            </ScrollView>
                          </Accordion.Content>
                        </Accordion.Item>
                      </Accordion>
                    )}
                    <View className="flex-row flex-wrap items-center gap-2">
                      {task.status === "completed" &&
                        (task.outputFileIds?.length ?? 0) > 0 &&
                        task.outputFileIds?.map((fileId, index) => (
                          <Button
                            key={`${task.id}_${fileId}`}
                            size="sm"
                            variant="outline"
                            onPress={() => onOpenOutputFile?.(fileId)}
                          >
                            <Button.Label>
                              {t("settings.videoOpenOutput", { index: index + 1 })}
                            </Button.Label>
                          </Button>
                        ))}
                      {task.status === "running" && (
                        <Button size="sm" variant="outline" onPress={() => onCancelTask(task.id)}>
                          <Button.Label>{t("settings.videoCancel")}</Button.Label>
                        </Button>
                      )}
                      {task.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          isDisabled={task.retries >= MAX_VIDEO_RETRIES}
                          onPress={() => onRetryTask(task.id)}
                        >
                          <Button.Label>{t("settings.videoRetry")}</Button.Label>
                        </Button>
                      )}
                      {task.status !== "running" && (
                        <Button size="sm" variant="ghost" onPress={() => onRemoveTask(task.id)}>
                          <Button.Label>{t("settings.videoRemoveTask")}</Button.Label>
                        </Button>
                      )}
                    </View>
                  </Card.Body>
                </Card>
              ))}
            </View>
          </ScrollView>

          <View className="mt-4 flex-row justify-end gap-2">
            <Button variant="outline" onPress={onClearFinished}>
              <Button.Label>{t("settings.videoClearFinished")}</Button.Label>
            </Button>
            <Button variant="primary" onPress={onClose}>
              <Button.Label>{t("settings.videoDone")}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
