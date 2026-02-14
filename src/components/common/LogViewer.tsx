/**
 * 日志查看器组件
 */

import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Card, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useLogViewer } from "../../hooks/useLogger";
import type { LogLevel, LogEntry } from "../../lib/logger";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "#6b7280",
  info: "#3b82f6",
  warn: "#f59e0b",
  error: "#ef4444",
};

const LEVEL_ICONS: Record<LogLevel, keyof typeof Ionicons.glyphMap> = {
  debug: "code-outline",
  info: "information-circle-outline",
  warn: "warning-outline",
  error: "alert-circle-outline",
};

function LevelFilterButton({
  level,
  isActive,
  onPress,
}: {
  level: LogLevel | "all";
  isActive: boolean;
  onPress: () => void;
}) {
  const accentColor = useThemeColor("accent");
  const color = level === "all" ? accentColor : LEVEL_COLORS[level];

  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-md px-2.5 py-1"
      style={{
        backgroundColor: isActive ? `${color}20` : "transparent",
        borderWidth: 1,
        borderColor: isActive ? color : "transparent",
      }}
    >
      <Text
        className="text-[10px] font-semibold uppercase"
        style={{ color: isActive ? color : "#9ca3af" }}
      >
        {level}
      </Text>
    </TouchableOpacity>
  );
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = LEVEL_COLORS[entry.level];
  const icon = LEVEL_ICONS[entry.level];
  const time = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <TouchableOpacity onPress={() => setExpanded(!expanded)}>
      <View className="flex-row items-start gap-2 py-1.5">
        <Ionicons name={icon} size={12} color={color} style={{ marginTop: 2 }} />
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[9px] text-muted">{time}</Text>
            <Text className="text-[9px] font-semibold" style={{ color }}>
              [{entry.tag}]
            </Text>
          </View>
          <Text className="text-[10px] text-foreground" numberOfLines={expanded ? undefined : 2}>
            {entry.message}
          </Text>
          {expanded && entry.data !== undefined && (
            <Text className="mt-1 text-[9px] text-muted" selectable>
              {typeof entry.data === "object"
                ? JSON.stringify(entry.data, null, 2)
                : String(entry.data)}
            </Text>
          )}
          {expanded && entry.stackTrace && (
            <Text className="mt-1 text-[9px] text-danger" selectable numberOfLines={5}>
              {entry.stackTrace}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function LogViewer() {
  const { t } = useI18n();
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");

  const { entries, filterLevel, setFilterLevel, clearLogs, exportLogs, totalCount } =
    useLogViewer();

  const handleExport = async () => {
    const text = exportLogs("text");
    if (text) {
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t("logs.clearTitle"), t("logs.clearConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => {
          clearLogs();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const levels: Array<LogLevel | "all"> = ["all", "debug", "info", "warn", "error"];

  return (
    <Card variant="secondary">
      <Card.Body className="px-4 py-2">
        {/* Header */}
        <View className="flex-row items-center justify-between py-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name="terminal-outline" size={16} color={accentColor} />
            <Text className="text-xs font-semibold text-foreground">{t("logs.title")}</Text>
            <Text className="text-[10px] text-muted">({totalCount})</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={handleExport}>
              <Ionicons name="copy-outline" size={16} color={accentColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClear}>
              <Ionicons name="trash-outline" size={16} color={dangerColor} />
            </TouchableOpacity>
          </View>
        </View>

        <Separator className="mb-2" />

        {/* Level Filters */}
        <View className="flex-row gap-1.5 mb-2">
          {levels.map((level) => (
            <LevelFilterButton
              key={level}
              level={level}
              isActive={level === "all" ? filterLevel === null : filterLevel === level}
              onPress={() => setFilterLevel(level === "all" ? null : level)}
            />
          ))}
        </View>

        {/* Log Entries */}
        {entries.length > 0 ? (
          <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled showsVerticalScrollIndicator>
            {entries
              .slice()
              .reverse()
              .slice(0, 100)
              .map((entry) => (
                <LogEntryRow key={entry.id} entry={entry} />
              ))}
          </ScrollView>
        ) : (
          <View className="items-center py-6">
            <Ionicons name="document-text-outline" size={24} color="#6b7280" />
            <Text className="mt-1 text-xs text-muted">{t("logs.empty")}</Text>
          </View>
        )}
      </Card.Body>
    </Card>
  );
}
