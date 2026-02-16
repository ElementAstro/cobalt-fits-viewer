/**
 * 变更历史查看组件
 */

import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Card, Dialog, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { Target, TargetChangeLogEntry } from "../../lib/fits/types";
import { formatRelativeTime } from "../../lib/targets/changeLogger";

interface ChangeHistorySheetProps {
  visible: boolean;
  target: Target;
  onClose: () => void;
  onClearHistory?: () => void;
}

const ACTION_ICONS: Record<TargetChangeLogEntry["action"], string> = {
  created: "add-circle-outline",
  updated: "create-outline",
  status_changed: "swap-horizontal-outline",
  image_added: "images-outline",
  image_removed: "trash-outline",
  favorited: "heart",
  unfavorited: "heart-outline",
  pinned: "pin",
  unpinned: "pin-outline",
  tagged: "pricetag-outline",
  untagged: "pricetag-outline",
};

const ACTION_COLORS: Record<TargetChangeLogEntry["action"], string> = {
  created: "#22c55e",
  updated: "#3b82f6",
  status_changed: "#f59e0b",
  image_added: "#22c55e",
  image_removed: "#ef4444",
  favorited: "#ef4444",
  unfavorited: "#6b7280",
  pinned: "#f59e0b",
  unpinned: "#6b7280",
  tagged: "#8b5cf6",
  untagged: "#6b7280",
};

export function ChangeHistorySheet({
  visible,
  target,
  onClose,
  onClearHistory,
}: ChangeHistorySheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  // Group changes by date
  const groupedChanges = useMemo(() => {
    const groups: Record<string, TargetChangeLogEntry[]> = {};

    const sorted = [...target.changeLog].sort((a, b) => b.timestamp - a.timestamp);

    for (const entry of sorted) {
      const date = new Date(entry.timestamp).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(entry);
    }

    return groups;
  }, [target.changeLog]);

  const getActionLabel = (entry: TargetChangeLogEntry): string => {
    switch (entry.action) {
      case "created":
        return t("targets.changeLog.created");
      case "updated":
        return t("targets.changeLog.updated") + (entry.field ? ` (${entry.field})` : "");
      case "status_changed":
        return `${t("targets.changeLog.status_changed")}: ${entry.oldValue} → ${entry.newValue}`;
      case "image_added":
        return t("targets.changeLog.image_added");
      case "image_removed":
        return t("targets.changeLog.image_removed");
      case "favorited":
        return t("targets.changeLog.favorited");
      case "unfavorited":
        return t("targets.changeLog.unfavorited");
      case "pinned":
        return t("targets.changeLog.pinned");
      case "unpinned":
        return t("targets.changeLog.unpinned");
      case "tagged":
        return `${t("targets.changeLog.tagged")}: ${entry.newValue}`;
      case "untagged":
        return `${t("targets.changeLog.untagged")}: ${entry.oldValue}`;
      default:
        return entry.action;
    }
  };

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-4 w-full max-w-md rounded-2xl bg-background p-6 max-h-[85%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between mb-4">
              <Dialog.Title>{t("targets.changeLog.title")}</Dialog.Title>
              <Dialog.Close />
            </View>

            {target.changeLog.length === 0 ? (
              <View className="items-center py-8">
                <Ionicons name="time-outline" size={48} color={mutedColor} />
                <Text className="mt-4 text-sm text-muted text-center">
                  {t("targets.changeLog.noHistory")}
                </Text>
              </View>
            ) : (
              <>
                {/* Summary */}
                <Card variant="secondary" className="mb-4">
                  <Card.Body className="p-3">
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="text-2xl font-bold text-foreground">
                          {target.changeLog.length}
                        </Text>
                        <Text className="text-xs text-muted">
                          {t("targets.changeLog.totalChanges")}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-sm text-foreground">
                          {formatRelativeTime(target.changeLog[0]?.timestamp ?? 0)}
                        </Text>
                        <Text className="text-xs text-muted">
                          {t("targets.changeLog.lastChange")}
                        </Text>
                      </View>
                    </View>
                  </Card.Body>
                </Card>

                <Separator className="mb-4" />

                {/* Timeline */}
                {Object.entries(groupedChanges).map(([date, entries]) => (
                  <View key={date} className="mb-4">
                    <Text className="text-xs font-semibold text-muted mb-2">{date}</Text>
                    <View className="gap-2">
                      {entries.map((entry) => (
                        <View
                          key={entry.id}
                          className="flex-row items-start gap-3 py-2 border-b border-surface-secondary"
                        >
                          <View
                            className="w-8 h-8 rounded-full items-center justify-center"
                            style={{
                              backgroundColor: ACTION_COLORS[entry.action] + "20",
                            }}
                          >
                            <Ionicons
                              name={ACTION_ICONS[entry.action] as keyof typeof Ionicons.glyphMap}
                              size={14}
                              color={ACTION_COLORS[entry.action]}
                            />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm text-foreground">{getActionLabel(entry)}</Text>
                            <Text className="text-[10px] text-muted mt-0.5">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}

                <Separator className="my-4" />

                {/* Actions */}
                <View className="flex-row justify-between">
                  {onClearHistory && (
                    <Button variant="ghost" onPress={onClearHistory}>
                      <Ionicons name="trash-outline" size={14} color="#ef4444" />
                      <Button.Label className="text-destructive">
                        {t("targets.changeLog.clearHistory")}
                      </Button.Label>
                    </Button>
                  )}
                  <Button variant="outline" onPress={onClose} className="ml-auto">
                    <Button.Label>{t("common.close")}</Button.Label>
                  </Button>
                </View>
              </>
            )}
          </ScrollView>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
