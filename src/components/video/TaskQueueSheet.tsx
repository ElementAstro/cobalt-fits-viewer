import { ScrollView, Text, View } from "react-native";
import { Button, Card, Chip, Dialog, Spinner } from "heroui-native";
import type { VideoTaskRecord } from "../../stores/useVideoTaskStore";

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

function statusColor(
  status: VideoTaskRecord["status"],
): "default" | "success" | "danger" | "warning" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "running") return "warning";
  return "default";
}

function progressLabel(task: VideoTaskRecord): string {
  if (task.status === "running") {
    return `${Math.round(task.progress * 100)}%`;
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
  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="max-w-[460px]">
          <Dialog.Title>Video Task Queue</Dialog.Title>
          <Dialog.Description>
            Background tasks are non-destructive and produce derived media files.
          </Dialog.Description>

          <ScrollView className="mt-3 max-h-[420px]">
            <View className="gap-2">
              {tasks.length === 0 && (
                <View className="rounded-lg border border-separator bg-surface-secondary p-3">
                  <Text className="text-sm text-muted">No queued tasks.</Text>
                </View>
              )}
              {tasks.map((task) => (
                <Card key={task.id} variant="secondary">
                  <Card.Body className="gap-2 p-3">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-sm font-semibold text-foreground">
                        {task.request.operation.toUpperCase()} · {task.request.sourceFilename}
                      </Text>
                      <Chip size="sm" variant="soft" color={statusColor(task.status)}>
                        <Chip.Label className="text-[10px]">{task.status}</Chip.Label>
                      </Chip>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-muted">{progressLabel(task)}</Text>
                      {task.status === "running" && <Spinner size="sm" />}
                    </View>
                    {!!task.error && <Text className="text-xs text-danger">{task.error}</Text>}
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
                            <Button.Label>{`Open #${index + 1}`}</Button.Label>
                          </Button>
                        ))}
                      {task.status === "running" && (
                        <Button size="sm" variant="outline" onPress={() => onCancelTask(task.id)}>
                          <Button.Label>Cancel</Button.Label>
                        </Button>
                      )}
                      {task.status === "failed" && (
                        <Button size="sm" variant="outline" onPress={() => onRetryTask(task.id)}>
                          <Button.Label>Retry</Button.Label>
                        </Button>
                      )}
                      {task.status !== "running" && (
                        <Button size="sm" variant="ghost" onPress={() => onRemoveTask(task.id)}>
                          <Button.Label>Remove</Button.Label>
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
              <Button.Label>Clear Finished</Button.Label>
            </Button>
            <Button variant="primary" onPress={onClose}>
              <Button.Label>Done</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
