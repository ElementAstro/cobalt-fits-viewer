/**
 * 日志查看器组件
 */

import { useState, useCallback, useRef, useMemo, useEffect, memo } from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import {
  BottomSheet,
  Button,
  Card,
  Chip,
  Input,
  Separator,
  Spinner,
  Switch,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useLogViewer } from "../../hooks/common/useLogger";
import { useHapticFeedback } from "../../hooks/common/useHapticFeedback";
import type { LogLevel, LogEntry, LogExportOptions } from "../../lib/logger";

// Log-level colors are intentionally hardcoded as semantic constants (not theme-dependent)
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

function highlightText(text: string, query: string, baseClassName: string, color?: string) {
  if (!query) {
    return (
      <Text className={baseClassName} style={color ? { color } : undefined}>
        {text}
      </Text>
    );
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;

  let idx = lowerText.indexOf(lowerQuery, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: text.slice(lastIndex, idx), highlight: false });
    }
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true });
    lastIndex = idx + query.length;
    idx = lowerText.indexOf(lowerQuery, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  if (parts.length === 0) {
    return (
      <Text className={baseClassName} style={color ? { color } : undefined}>
        {text}
      </Text>
    );
  }

  return (
    <Text className={baseClassName} style={color ? { color } : undefined}>
      {parts.map((part, i) =>
        part.highlight ? (
          <Text key={i} style={{ backgroundColor: "rgba(59,130,246,0.25)" }}>
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}

function LevelFilterButton({
  level,
  isActive,
  count,
  onPress,
}: {
  level: LogLevel | "all";
  isActive: boolean;
  count?: number;
  onPress: () => void;
}) {
  const label = count !== undefined && level !== "all" ? `${level} (${count})` : level;
  return (
    <Chip
      size="sm"
      variant={isActive ? "primary" : "secondary"}
      onPress={onPress}
      accessibilityLabel={`Filter logs by ${level}`}
      accessibilityHint={count !== undefined ? `${count} entries` : undefined}
    >
      <Chip.Label className="text-[10px] uppercase">{label}</Chip.Label>
    </Chip>
  );
}

const LogEntryRow = memo(function LogEntryRow({
  entry,
  isExpanded,
  onToggleExpand,
  onShowDetail,
  searchQuery,
}: {
  entry: LogEntry;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onShowDetail: (entry: LogEntry) => void;
  searchQuery: string;
}) {
  const color = LEVEL_COLORS[entry.level];
  const icon = LEVEL_ICONS[entry.level];
  const time = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <Pressable onPress={() => onToggleExpand(entry.id)} onLongPress={() => onShowDetail(entry)}>
      <View className="flex-row items-start gap-2 py-1.5">
        <Ionicons name={icon} size={12} color={color} style={{ marginTop: 2 }} />
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[9px] text-muted">{time}</Text>
            {highlightText(`[${entry.tag}]`, searchQuery, "text-[9px] font-semibold", color)}
          </View>
          {searchQuery ? (
            <Text
              className="text-[10px] text-foreground"
              numberOfLines={isExpanded ? undefined : 2}
            >
              {highlightText(entry.message, searchQuery, "text-[10px] text-foreground")}
            </Text>
          ) : (
            <Text
              className="text-[10px] text-foreground"
              numberOfLines={isExpanded ? undefined : 2}
            >
              {entry.message}
            </Text>
          )}
          {isExpanded && entry.data !== undefined && (
            <Text className="mt-1 text-[9px] text-muted" selectable>
              {typeof entry.data === "object"
                ? JSON.stringify(entry.data, null, 2)
                : String(entry.data)}
            </Text>
          )}
          {isExpanded && entry.stackTrace && (
            <Text className="mt-1 text-[9px] text-danger" selectable numberOfLines={5}>
              {entry.stackTrace}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

function LogDetailSheet({
  entry,
  visible,
  onClose,
}: {
  entry: LogEntry | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const accentColor = useThemeColor("accent");
  const haptics = useHapticFeedback();

  if (!entry) return null;

  const color = LEVEL_COLORS[entry.level];
  const fullTime = new Date(entry.timestamp).toISOString();

  const handleCopyAll = async () => {
    const parts = [`[${fullTime}][${entry.level.toUpperCase()}][${entry.tag}]`, entry.message];
    if (entry.data !== undefined) {
      parts.push(
        `Data: ${typeof entry.data === "object" ? JSON.stringify(entry.data, null, 2) : String(entry.data)}`,
      );
    }
    if (entry.stackTrace) {
      parts.push(`Stack: ${entry.stackTrace}`);
    }
    await Clipboard.setStringAsync(parts.join("\n"));
    haptics.notify(Haptics.NotificationFeedbackType.Success);
  };

  const handleCopyStack = async () => {
    if (entry.stackTrace) {
      await Clipboard.setStringAsync(entry.stackTrace);
      haptics.notify(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <BottomSheet.Title>{t("logs.detailTitle")}</BottomSheet.Title>
          <ScrollView showsVerticalScrollIndicator>
            <View className="gap-3 pb-4">
              {/* Timestamp */}
              <View>
                <Text className="text-[10px] font-semibold uppercase text-muted mb-0.5">
                  {t("logs.detailTime")}
                </Text>
                <Text className="text-xs text-foreground" selectable>
                  {fullTime}
                </Text>
              </View>

              {/* Level & Tag */}
              <View className="flex-row gap-3">
                <View>
                  <Text className="text-[10px] font-semibold uppercase text-muted mb-0.5">
                    {t("logs.detailLevel")}
                  </Text>
                  <Text className="text-xs font-bold" style={{ color }}>
                    {entry.level.toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text className="text-[10px] font-semibold uppercase text-muted mb-0.5">
                    {t("logs.detailTag")}
                  </Text>
                  <Text className="text-xs text-foreground">{entry.tag}</Text>
                </View>
              </View>

              {/* Message */}
              <View>
                <Text className="text-[10px] font-semibold uppercase text-muted mb-0.5">
                  {t("logs.detailMessage")}
                </Text>
                <Text className="text-xs text-foreground" selectable>
                  {entry.message}
                </Text>
              </View>

              {/* Data */}
              {entry.data !== undefined && (
                <View>
                  <Text className="text-[10px] font-semibold uppercase text-muted mb-0.5">
                    {t("logs.detailData")}
                  </Text>
                  <View className="rounded-md bg-background p-2">
                    <Text
                      className="text-[10px] text-foreground"
                      style={{ fontFamily: "monospace" }}
                      selectable
                    >
                      {typeof entry.data === "object"
                        ? JSON.stringify(entry.data, null, 2)
                        : String(entry.data)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Stack Trace */}
              {entry.stackTrace && (
                <View>
                  <View className="flex-row items-center justify-between mb-0.5">
                    <Text className="text-[10px] font-semibold uppercase text-muted">
                      {t("logs.detailStack")}
                    </Text>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      onPress={handleCopyStack}
                      accessibilityLabel={t("logs.copyStack")}
                    >
                      <Ionicons name="copy-outline" size={12} color={accentColor} />
                    </Button>
                  </View>
                  <View className="rounded-md bg-background p-2">
                    <Text
                      className="text-[10px] text-danger"
                      style={{ fontFamily: "monospace" }}
                      selectable
                    >
                      {entry.stackTrace}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Actions */}
          <View className="flex-row gap-2 pt-2">
            <Button size="sm" variant="ghost" className="flex-1" onPress={handleCopyAll}>
              <Ionicons name="copy-outline" size={14} color={accentColor} />
              <Button.Label>{t("logs.copyAll")}</Button.Label>
            </Button>
            <Button size="sm" variant="ghost" className="flex-1" onPress={onClose}>
              <Button.Label>{t("common.close")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

function TagSelector({
  availableTags,
  selectedTag,
  onSelectTag,
}: {
  availableTags: string[];
  selectedTag: string;
  onSelectTag: (tag: string) => void;
}) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);

  if (availableTags.length === 0) return null;

  const displayTags = showAll ? availableTags : availableTags.slice(0, 8);
  const hasMore = availableTags.length > 8;

  return (
    <View className="mb-2">
      <Text className="text-[10px] font-semibold uppercase text-muted mb-1">
        {t("logs.tagPlaceholder")}
      </Text>
      <View className="flex-row flex-wrap gap-1">
        <Chip
          size="sm"
          variant={selectedTag === "" ? "primary" : "secondary"}
          onPress={() => onSelectTag("")}
        >
          <Chip.Label className="text-[10px]">{t("logs.allTags")}</Chip.Label>
        </Chip>
        {displayTags.map((tag) => (
          <Chip
            key={tag}
            size="sm"
            variant={selectedTag.toLowerCase() === tag.toLowerCase() ? "primary" : "secondary"}
            onPress={() => onSelectTag(selectedTag === tag ? "" : tag)}
          >
            <Chip.Label className="text-[10px]">{tag}</Chip.Label>
          </Chip>
        ))}
        {hasMore && (
          <Chip size="sm" variant="secondary" onPress={() => setShowAll(!showAll)}>
            <Chip.Label className="text-[10px]">
              {showAll ? t("logs.showLess") : `+${availableTags.length - 8}`}
            </Chip.Label>
          </Chip>
        )}
      </View>
    </View>
  );
}

export function LogViewer() {
  const { t } = useI18n();
  const accentColor = useThemeColor("accent");
  const dangerColor = useThemeColor("danger");
  const haptics = useHapticFeedback();

  const {
    entries,
    levelCounts,
    availableTags,
    filterLevel,
    filterTag,
    filterQuery,
    setFilterLevel,
    setFilterTag,
    setFilterQuery,
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
  const [filteredOnly, setFilteredOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailEntry, setDetailEntry] = useState<LogEntry | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [newLogCount, setNewLogCount] = useState(0);
  const flashListRef = useRef<FlashListRef<LogEntry>>(null);
  const prevEntryCountRef = useRef(0);

  const reversedEntries = useMemo(() => [...entries].reverse(), [entries]);

  // Auto-scroll: detect new entries and scroll to top (newest first)
  useEffect(() => {
    const currentEntryCount = reversedEntries.length;
    if (currentEntryCount > prevEntryCountRef.current && prevEntryCountRef.current > 0) {
      const diff = currentEntryCount - prevEntryCountRef.current;
      if (autoScroll) {
        setTimeout(() => flashListRef.current?.scrollToOffset({ offset: 0, animated: true }), 50);
      } else {
        setNewLogCount((prev) => prev + diff);
      }
    }
    prevEntryCountRef.current = currentEntryCount;
  }, [reversedEntries.length, autoScroll]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleShowDetail = useCallback((entry: LogEntry) => {
    setDetailEntry(entry);
  }, []);

  const handleScrollToTop = useCallback(() => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setAutoScroll(true);
    setNewLogCount(0);
  }, []);

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      if (y > 50 && autoScroll) {
        setAutoScroll(false);
      } else if (y <= 5 && !autoScroll) {
        setAutoScroll(true);
        setNewLogCount(0);
      }
    },
    [autoScroll],
  );

  const getExportOptions = (): LogExportOptions & { filteredOnly: boolean } => ({
    format: exportFormat,
    compress: compressEnabled,
    includeSystemInfo,
    filteredOnly,
  });

  const handleCopyToClipboard = async () => {
    const text = exportLogs("text", filteredOnly);
    if (text) {
      await Clipboard.setStringAsync(text);
      haptics.notify(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), t("logs.copied"));
    }
  };

  const handleExportToFile = async () => {
    const uri = await exportToFile(getExportOptions());
    if (uri) {
      haptics.notify(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), t("logs.exportSuccess"));
    } else {
      haptics.notify(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("common.error"), t("logs.exportFailed"));
    }
  };

  const handleShare = async () => {
    const ok = await shareLogs(getExportOptions());
    if (ok) {
      haptics.notify(Haptics.NotificationFeedbackType.Success);
    } else {
      haptics.notify(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("common.error"), t("logs.shareFailed"));
    }
  };

  const handleClear = () => {
    haptics.notify(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t("logs.clearTitle"), t("logs.clearConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => {
          clearLogs();
          setExpandedIds(new Set());
          haptics.notify(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const levels: Array<LogLevel | "all"> = ["all", "debug", "info", "warn", "error"];

  const renderItem = useCallback(
    ({ item }: { item: LogEntry }) => (
      <LogEntryRow
        entry={item}
        isExpanded={expandedIds.has(item.id)}
        onToggleExpand={handleToggleExpand}
        onShowDetail={handleShowDetail}
        searchQuery={filterQuery}
      />
    ),
    [expandedIds, handleToggleExpand, handleShowDetail, filterQuery],
  );

  const keyExtractor = useCallback((item: LogEntry) => item.id, []);

  return (
    <>
      <Card variant="secondary">
        <Card.Body className="px-4 py-2">
          {/* Header */}
          <View className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="terminal-outline" size={16} color={accentColor} />
              <Text className="text-xs font-semibold text-foreground">{t("logs.title")}</Text>
              <Text className="text-[10px] text-muted">
                ({entries.length}/{totalCount})
              </Text>
            </View>
            <View className="flex-row gap-1">
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={() => setAutoScroll(!autoScroll)}
                accessibilityLabel={autoScroll ? t("logs.pauseStream") : t("logs.resumeStream")}
              >
                <Ionicons
                  name={autoScroll ? "pause-outline" : "play-outline"}
                  size={16}
                  color={accentColor}
                />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={handleCopyToClipboard}
                isDisabled={isExporting}
                accessibilityLabel={t("logs.copyAll")}
              >
                <Ionicons name="copy-outline" size={16} color={accentColor} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={() => setShowExportPanel(!showExportPanel)}
                isDisabled={isExporting}
                accessibilityLabel={t("logs.exportOptions")}
              >
                <Ionicons name="download-outline" size={16} color={accentColor} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={handleClear}
                isDisabled={isExporting}
                accessibilityLabel={t("logs.clearTitle")}
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

              {/* Filtered-only Toggle */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[11px] text-foreground">{t("logs.exportFilteredOnly")}</Text>
                <Switch isSelected={filteredOnly} onSelectedChange={setFilteredOnly}>
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

          {/* Level Filters with Counts */}
          <View className="flex-row gap-1.5 mb-2">
            {levels.map((level) => (
              <LevelFilterButton
                key={level}
                level={level}
                isActive={level === "all" ? filterLevel === null : filterLevel === level}
                count={level === "all" ? undefined : levelCounts[level]}
                onPress={() => setFilterLevel(level === "all" ? null : level)}
              />
            ))}
          </View>

          {/* Tag Selector */}
          <TagSelector
            availableTags={availableTags}
            selectedTag={filterTag}
            onSelectTag={setFilterTag}
          />

          {/* Search Input */}
          <View className="mb-2">
            <Input
              value={filterQuery}
              onChangeText={setFilterQuery}
              placeholder={t("logs.searchPlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Log Entries (FlashList) */}
          {reversedEntries.length > 0 ? (
            <View style={{ height: 360 }}>
              <FlashList
                ref={flashListRef}
                data={reversedEntries}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                onScroll={handleScroll}
                scrollEventThrottle={100}
                showsVerticalScrollIndicator
              />
              {/* New logs floating button */}
              {!autoScroll && newLogCount > 0 && (
                <Pressable
                  onPress={handleScrollToTop}
                  className="absolute top-2 self-center"
                  style={{
                    backgroundColor: accentColor,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text className="text-[10px] font-semibold text-white">
                    ↑ {newLogCount} {t("logs.newEntries")}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View className="items-center py-6">
              <Ionicons name="document-text-outline" size={24} color="#6b7280" />
              <Text className="mt-1 text-xs text-muted">{t("logs.empty")}</Text>
            </View>
          )}
        </Card.Body>
      </Card>

      {/* Log Detail BottomSheet */}
      <LogDetailSheet
        entry={detailEntry}
        visible={detailEntry !== null}
        onClose={() => setDetailEntry(null)}
      />
    </>
  );
}
