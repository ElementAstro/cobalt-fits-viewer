/**
 * Astrometry.net 任务管理主页面
 */

import { useState, useCallback } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  Button,
  Chip,
  Dialog,
  Input,
  PressableFeedback,
  Separator,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useAstrometry } from "../../hooks/useAstrometry";
import { useFitsStore } from "../../stores/useFitsStore";
import { AstrometryJobCard } from "../../components/astrometry/AstrometryJobCard";
import { AstrometrySettings } from "../../components/astrometry/AstrometrySettings";
import { FilePickerSheet } from "../../components/astrometry/FilePickerSheet";
import { EmptyState } from "../../components/common/EmptyState";
import type { AstrometryJob } from "../../lib/astrometry/types";
import type { FitsMetadata } from "../../lib/fits/types";

type TabKey = "all" | "active" | "completed" | "failed";

export default function AstrometryScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [borderColor, mutedColor] = useThemeColor(["separator", "muted"]);
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const {
    config,
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    submitFile,
    submitUrl,
    submitBatch,
    cancelJob,
    cancelAllJobs,
    retryJob,
    removeJob,
    clearCompletedJobs,
    isProcessing,
  } = useAstrometry();

  const files = useFitsStore((s) => s.files);

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [showSettings, setShowSettings] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  // 筛选的任务列表
  const filteredJobs = (() => {
    switch (activeTab) {
      case "active":
        return activeJobs;
      case "completed":
        return completedJobs;
      case "failed":
        return failedJobs;
      default:
        return jobs;
    }
  })();

  // 打开文件选择器
  const handleOpenFilePicker = useCallback(() => {
    if (!config.apiKey) {
      Alert.alert(t("common.error"), t("astrometry.noApiKey"));
      return;
    }
    setShowFilePicker(true);
  }, [config.apiKey, t]);

  // 选择文件后提交
  const handleFileSelected = useCallback(
    (file: FitsMetadata) => {
      setShowFilePicker(false);
      submitFile(file.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [submitFile],
  );

  // 打开 URL 输入 Dialog
  const handleOpenUrlDialog = useCallback(() => {
    if (!config.apiKey) {
      Alert.alert(t("common.error"), t("astrometry.noApiKey"));
      return;
    }
    setUrlInput("");
    setShowUrlDialog(true);
  }, [config.apiKey, t]);

  // 提交 URL
  const handleSubmitUrl = useCallback(() => {
    if (!urlInput.trim()) return;
    const fileName = urlInput.split("/").pop() ?? "url_image";
    submitUrl(urlInput.trim(), fileName);
    setUrlInput("");
    setShowUrlDialog(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [urlInput, submitUrl]);

  // 清除历史
  const handleClearHistory = useCallback(() => {
    Alert.alert(t("astrometry.clearHistory"), t("astrometry.confirmClear"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: clearCompletedJobs,
      },
    ]);
  }, [clearCompletedJobs, t]);

  // 查看结果 - 导航到详情页
  const handleViewResult = useCallback(
    (job: AstrometryJob) => {
      router.push(`/astrometry/result/${job.id}`);
    },
    [router],
  );

  // 如果显示设置
  if (showSettings) {
    return (
      <View className="flex-1 bg-background">
        <View
          className="flex-row items-center pb-3"
          style={{
            borderBottomWidth: 0.5,
            borderBottomColor: borderColor,
            paddingHorizontal: horizontalPadding,
            paddingTop: contentPaddingTop,
          }}
        >
          <PressableFeedback onPress={() => setShowSettings(false)} className="mr-3">
            <Ionicons name="arrow-back" size={22} color={mutedColor} />
          </PressableFeedback>
          <Text className="text-lg font-bold text-foreground">{t("astrometry.settings")}</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingVertical: 16 }}
        >
          <AstrometrySettings />
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="pb-3"
        style={{
          borderBottomWidth: 0.5,
          borderBottomColor: borderColor,
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <PressableFeedback onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color={mutedColor} />
            </PressableFeedback>
            <View>
              <Text className="text-lg font-bold text-foreground">{t("astrometry.title")}</Text>
              <Text className="text-xs text-muted">{t("astrometry.subtitle")}</Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <Chip size="sm" variant="soft" color={config.apiKey ? "success" : "default"}>
              <Chip.Label className="text-[9px]">
                {config.apiKey ? t("astrometry.connected") : t("astrometry.disconnected")}
              </Chip.Label>
            </Chip>
            <PressableFeedback onPress={() => setShowSettings(true)}>
              <Ionicons name="settings-outline" size={20} color={mutedColor} />
            </PressableFeedback>
          </View>
        </View>

        {/* 操作栏 */}
        <View className="flex-row gap-2 mt-3">
          <Button variant="primary" size="sm" className="flex-1" onPress={handleOpenFilePicker}>
            <Button.Label className="text-xs">
              <Ionicons name="document-outline" size={14} /> {t("astrometry.selectFile")}
            </Button.Label>
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" onPress={handleOpenUrlDialog}>
            <Button.Label className="text-xs">
              <Ionicons name="link-outline" size={14} /> {t("astrometry.submitUrl")}
            </Button.Label>
          </Button>
        </View>

        {/* Tabs */}
        <View className="flex-row gap-1 mt-3">
          {(["all", "active", "completed", "failed"] as TabKey[]).map((tab) => {
            const count = {
              all: jobs.length,
              active: activeJobs.length,
              completed: completedJobs.length,
              failed: failedJobs.length,
            }[tab];

            return (
              <Chip
                key={tab}
                size="sm"
                variant={activeTab === tab ? "primary" : "secondary"}
                onPress={() => setActiveTab(tab)}
                className="flex-1"
              >
                <Chip.Label className="text-[10px]">
                  {t(`astrometry.${tab}`)} {count > 0 ? `(${count})` : ""}
                </Chip.Label>
              </Chip>
            );
          })}
        </View>
      </View>

      {/* 任务列表 */}
      <View className="flex-1 py-2" style={{ paddingHorizontal: horizontalPadding }}>
        {filteredJobs.length === 0 ? (
          <EmptyState
            icon="planet-outline"
            title={t("astrometry.noJobs")}
            description={t("astrometry.noJobsHint")}
          />
        ) : (
          <FlashList
            data={filteredJobs}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderItem={({ item }) => (
              <AstrometryJobCard
                job={item}
                onCancel={() => cancelJob(item.id)}
                onRetry={() => retryJob(item.id)}
                onDelete={() => removeJob(item.id)}
                onViewResult={
                  item.status === "success" && item.result
                    ? () => handleViewResult(item)
                    : undefined
                }
              />
            )}
          />
        )}
      </View>

      {/* 底部清理按钮 */}
      {(completedJobs.length > 0 || failedJobs.length > 0 || isProcessing) && (
        <View
          className="flex-row items-center justify-between py-3"
          style={{
            paddingHorizontal: horizontalPadding,
            borderTopWidth: 0.5,
            borderTopColor: borderColor,
          }}
        >
          {isProcessing && (
            <Button variant="ghost" size="sm" onPress={cancelAllJobs}>
              <Button.Label className="text-xs text-danger">
                <Ionicons name="stop-circle-outline" size={14} /> {t("astrometry.cancel")} (
                {activeJobs.length})
              </Button.Label>
            </Button>
          )}
          {!isProcessing && <View />}
          {(completedJobs.length > 0 || failedJobs.length > 0) && (
            <Button variant="ghost" size="sm" onPress={handleClearHistory}>
              <Button.Label className="text-xs text-muted">
                <Ionicons name="trash-outline" size={14} /> {t("astrometry.clearHistory")}
              </Button.Label>
            </Button>
          )}
        </View>
      )}

      {/* File Picker Dialog */}
      <FilePickerSheet
        visible={showFilePicker}
        files={files}
        onSelect={handleFileSelected}
        onSelectBatch={(selectedFiles) => {
          setShowFilePicker(false);
          submitBatch(selectedFiles.map((f) => f.id));
        }}
        onClose={() => setShowFilePicker(false)}
      />

      {/* URL Input Dialog */}
      <Dialog isOpen={showUrlDialog} onOpenChange={(open) => !open && setShowUrlDialog(false)}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <View className="flex-row items-center justify-between mb-3">
              <Dialog.Title>{t("astrometry.submitUrl")}</Dialog.Title>
              <Dialog.Close />
            </View>
            <Dialog.Description>{t("astrometry.enterUrlHint")}</Dialog.Description>
            <View className="mt-3">
              <TextField>
                <Input
                  value={urlInput}
                  onChangeText={setUrlInput}
                  placeholder="https://example.com/image.fits"
                  autoCorrect={false}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </TextField>
            </View>
            <Separator className="my-3" />
            <View className="flex-row justify-end gap-2">
              <Button variant="ghost" size="sm" onPress={() => setShowUrlDialog(false)}>
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onPress={handleSubmitUrl}
                isDisabled={!urlInput.trim()}
              >
                <Button.Label>{t("astrometry.submit")}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
