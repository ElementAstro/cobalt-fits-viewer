/**
 * Astrometry 解析结果详情页
 */

import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Button, Card, Chip, PressableFeedback, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useState, useCallback, useMemo } from "react";
import { useI18n } from "../../../i18n/useI18n";
import { useAstrometryStore } from "../../../stores/useAstrometryStore";
import { useFitsStore } from "../../../stores/useFitsStore";
import { AstrometryResultView } from "../../../components/astrometry/AstrometryResultView";
import {
  shareWCS,
  writeWCSToFitsHeader,
  generateWCSKeywords,
  formatWCSAsText,
} from "../../../lib/astrometry/wcsExport";
import { formatDuration } from "../../../lib/astrometry/formatUtils";
import { findMatchingTarget, createTargetFromResult } from "../../../lib/astrometry/syncToTarget";
import { useTargetStore } from "../../../stores/useTargetStore";

export default function AstrometryResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [borderColor, mutedColor] = useThemeColor(["separator", "muted"]);

  const job = useAstrometryStore((s) => s.getJobById(id ?? ""));
  const getFileById = useFitsStore((s) => s.getFileById);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showWCSTable, setShowWCSTable] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExportWCS = useCallback(async () => {
    const currentJob = useAstrometryStore.getState().getJobById(id ?? "");
    if (!currentJob?.result) return;
    try {
      const shared = await shareWCS(currentJob.result, currentJob.fileName);
      if (shared) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(t("common.error"), "Sharing is not available on this device.");
      }
    } catch {
      Alert.alert(t("common.error"), "Failed to export WCS data.");
    }
  }, [id, t]);

  const handleWriteToHeader = useCallback(() => {
    const currentJob = useAstrometryStore.getState().getJobById(id ?? "");
    if (!currentJob?.result || !currentJob.fileId) return;
    const file = getFileById(currentJob.fileId);
    if (!file) {
      Alert.alert(t("common.error"), "FITS file not found.");
      return;
    }

    Alert.alert(t("astrometry.writeToHeader"), t("astrometry.confirmWriteHeader"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: async () => {
          try {
            const count = await writeWCSToFitsHeader(currentJob.result!, file.filepath);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(t("common.success"), `Wrote ${count} WCS keywords to FITS header.`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            Alert.alert(t("common.error"), `Failed to write header: ${msg}`);
          }
        },
      },
    ]);
  }, [id, getFileById, t]);

  const handleSyncToTarget = useCallback(() => {
    const currentJob = useAstrometryStore.getState().getJobById(id ?? "");
    if (!currentJob?.result) return;

    const targets = useTargetStore.getState().targets;
    const existing = findMatchingTarget(targets, currentJob.result);

    if (existing) {
      // Update existing target with new coordinates and link file
      const updates: Partial<{ ra: number; dec: number }> = {
        ra: currentJob.result.calibration.ra,
        dec: currentJob.result.calibration.dec,
      };
      useTargetStore.getState().updateTarget(existing.id, updates);
      if (currentJob.fileId) {
        useTargetStore.getState().addImageToTarget(existing.id, currentJob.fileId);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t("common.success"),
        `Updated target "${existing.name}" with plate solve coordinates.`,
      );
    } else {
      // Create new target
      const newTarget = createTargetFromResult(currentJob.result, currentJob.fileId);
      useTargetStore.getState().addTarget(newTarget);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), `Created new target "${newTarget.name}".`);
    }
  }, [id, t]);

  const wcsKeywords = useMemo(
    () => (job?.result ? generateWCSKeywords(job.result.calibration) : []),
    [job?.result],
  );

  const handleCopyWCS = useCallback(async () => {
    if (!job?.result) return;
    const text = formatWCSAsText(wcsKeywords);
    await Clipboard.setStringAsync(text);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }, [job?.result, wcsKeywords]);

  if (!job || !job.result) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Ionicons name="alert-circle-outline" size={48} color={mutedColor} />
        <Text className="mt-3 text-sm text-muted">Result not found</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>{t("common.back")}</Button.Label>
        </Button>
      </View>
    );
  }

  const { result } = job;
  const durationStr = formatDuration(job.updatedAt - job.createdAt);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center px-4 pt-14 pb-3"
        style={{ borderBottomWidth: 0.5, borderBottomColor: borderColor }}
      >
        <PressableFeedback onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={22} color={mutedColor} />
        </PressableFeedback>
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {job.fileName}
          </Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            <Chip size="sm" variant="soft" color="success">
              <Chip.Label className="text-[9px]">{t("astrometry.success")}</Chip.Label>
            </Chip>
            <Text className="text-[9px] text-muted">
              {new Date(job.updatedAt).toLocaleString()} · {durationStr}
            </Text>
          </View>
        </View>

        {/* Navigate to viewer if file exists */}
        {job.fileId && (
          <PressableFeedback onPress={() => router.push(`/viewer/${job.fileId}`)} className="ml-2">
            <Ionicons name="eye-outline" size={20} color={mutedColor} />
          </PressableFeedback>
        )}
      </View>

      {/* Result content */}
      <ScrollView className="flex-1 px-4 py-4">
        <AstrometryResultView
          result={result}
          showAnnotations={showAnnotations}
          onToggleAnnotations={() => setShowAnnotations(!showAnnotations)}
          onWriteToHeader={job.fileId ? handleWriteToHeader : undefined}
          onExportWCS={handleExportWCS}
          onSyncToTarget={handleSyncToTarget}
        />

        {/* WCS Keywords Table */}
        <Card variant="secondary" className="mt-4">
          <Card.Header>
            <View className="flex-row items-center justify-between w-full">
              <Card.Title className="text-xs">FITS WCS Keywords</Card.Title>
              <View className="flex-row gap-2">
                <PressableFeedback onPress={handleCopyWCS}>
                  <Ionicons
                    name={copied ? "checkmark-circle" : "copy-outline"}
                    size={16}
                    color={copied ? "#22c55e" : mutedColor}
                  />
                </PressableFeedback>
                <PressableFeedback onPress={() => setShowWCSTable(!showWCSTable)}>
                  <Ionicons
                    name={showWCSTable ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={mutedColor}
                  />
                </PressableFeedback>
              </View>
            </View>
          </Card.Header>
          {showWCSTable && (
            <Card.Body className="px-3 pb-3">
              {wcsKeywords.map((kw, i) => (
                <View key={kw.key}>
                  {i > 0 && <Separator />}
                  <View className="flex-row items-center py-1.5">
                    <Text className="text-[10px] font-mono font-bold text-foreground w-16">
                      {kw.key}
                    </Text>
                    <Text className="text-[10px] font-mono text-accent flex-1 text-right">
                      {typeof kw.value === "string" ? `'${kw.value}'` : kw.value}
                    </Text>
                  </View>
                  <Text className="text-[8px] text-muted -mt-1 mb-0.5">{kw.comment}</Text>
                </View>
              ))}
            </Card.Body>
          )}
        </Card>

        {/* Submission info */}
        <View className="mt-4 mb-8">
          <Text className="text-[10px] text-muted text-center">
            Submission #{job.submissionId} · Job #{job.jobId}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
