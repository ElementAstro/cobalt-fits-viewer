/**
 * 日志查看器组件
 */

import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { Button, Card, Chip, Separator, Spinner, Switch, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useLogViewer } from "../../hooks/useLogger";
import type { LogLevel, LogEntry, LogExportOptions } from "../../lib/logger";

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
  return (
    <Chip size="sm" variant={isActive ? "primary" : "secondary"} onPress={onPress}>
      <Chip.Label className="text-[10px] uppercase">{level}</Chip.Label>
    </Chip>
  );
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = LEVEL_COLORS[entry.level];
  const icon = LEVEL_ICONS[entry.level];
  const time = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <Pressable onPress={() => setExpanded(!expanded)}>
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
    </Pressable>
  );
}

export function LogViewer() {
  const { t } = useI18n();
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");

  const {
    entries,
    filterLevel,
    setFilterLevel,
    clearLogs,
    exportLogs,
    exportToFile,
    shareLogs,
    isExporting,
    totalCount,
  } = useLogViewer();

  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "text">("text");
  const [compressEnabled, setCompressEnabled] = useState(false);
  const [includeSystemInfo, setIncludeSystemInfo] = useState(true);

  const getExportOptions = (): LogExportOptions => ({
    format: exportFormat,
    compress: compressEnabled,
    includeSystemInfo,
  });

  const handleCopyToClipboard = async () => {
    const text = exportLogs("text");
    if (text) {
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), t("logs.copied"));
    }
  };

  const handleExportToFile = async () => {
    const uri = await exportToFile(getExportOptions());
    if (uri) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), t("logs.exportSuccess"));
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("common.error"), t("logs.exportFailed"));
    }
  };

  const handleShare = async () => {
    const ok = await shareLogs(getExportOptions());
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("common.error"), t("logs.shareFailed"));
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
          <View className="flex-row gap-1">
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              onPress={handleCopyToClipboard}
              isDisabled={isExporting}
            >
              <Ionicons name="copy-outline" size={16} color={accentColor} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              onPress={() => setShowExportPanel(!showExportPanel)}
              isDisabled={isExporting}
            >
              <Ionicons name="download-outline" size={16} color={accentColor} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              onPress={handleClear}
              isDisabled={isExporting}
            >
              <Ionicons name="trash-outline" size={16} color={dangerColor} />
            </Button>
          </View>
        </View>

        <Separator className="mb-2" />

        {/* Export Options Panel */}
        {showExportPanel && (
          <View className="mb-3 rounded-lg bg-background px-3 py-2">
            <Text className="text-[10px] font-semibold uppercase text-muted mb-2">
              {t("logs.exportOptions")}
            </Text>

            {/* Format Selector */}
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-[11px] text-foreground">{t("logs.exportFormat")}</Text>
              <View className="flex-row gap-1.5">
                <Chip
                  size="sm"
                  variant={exportFormat === "json" ? "primary" : "secondary"}
                  onPress={() => setExportFormat("json")}
                >
                  <Chip.Label className="text-[10px]">{t("logs.jsonFormat")}</Chip.Label>
                </Chip>
                <Chip
                  size="sm"
                  variant={exportFormat === "text" ? "primary" : "secondary"}
                  onPress={() => setExportFormat("text")}
                >
                  <Chip.Label className="text-[10px]">{t("logs.textFormat")}</Chip.Label>
                </Chip>
              </View>
            </View>

            {/* Compress Toggle */}
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-[11px] text-foreground">{t("logs.compress")}</Text>
              <Switch isSelected={compressEnabled} onSelectedChange={setCompressEnabled}>
                <Switch.Thumb />
              </Switch>
            </View>

            {/* Include System Info Toggle */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[11px] text-foreground">{t("logs.includeSystemInfo")}</Text>
              <Switch isSelected={includeSystemInfo} onSelectedChange={setIncludeSystemInfo}>
                <Switch.Thumb />
              </Switch>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                onPress={handleExportToFile}
                isDisabled={isExporting}
              >
                {isExporting ? (
                  <Spinner size="sm" color="default" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={14} color={accentColor} />
                    <Button.Label>{t("logs.export")}</Button.Label>
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                onPress={handleShare}
                isDisabled={isExporting}
              >
                {isExporting ? (
                  <Spinner size="sm" color="default" />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={14} color={accentColor} />
                    <Button.Label>{t("logs.share")}</Button.Label>
                  </>
                )}
              </Button>
            </View>
          </View>
        )}

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
