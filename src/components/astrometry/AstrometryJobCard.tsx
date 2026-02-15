/**
 * Astrometry 解析任务卡片
 * 参考 BatchTaskItem 的 Card + Chip + Button 模式
 */

import { useEffect, useState } from "react";
import { View, Text, Animated } from "react-native";
import { Button, Card, Chip, Spinner } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useI18n } from "../../i18n/useI18n";
import type { AstrometryJob, AstrometryJobStatus } from "../../lib/astrometry/types";
import { formatDuration } from "../../lib/astrometry/formatUtils";

interface AstrometryJobCardProps {
  job: AstrometryJob;
  onCancel?: () => void;
  onRetry?: () => void;
  onViewResult?: () => void;
  onDelete?: () => void;
}

const STATUS_CHIP_CONFIG: Record<
  AstrometryJobStatus,
  { variant: "primary" | "secondary" | "soft"; color: "default" | "accent" | "success" | "danger" }
> = {
  pending: { variant: "secondary", color: "default" },
  uploading: { variant: "primary", color: "accent" },
  submitted: { variant: "primary", color: "accent" },
  solving: { variant: "primary", color: "accent" },
  success: { variant: "soft", color: "success" },
  failure: { variant: "soft", color: "danger" },
  cancelled: { variant: "secondary", color: "default" },
};

function formatCoord(ra: number, dec: number): string {
  const raH = (ra / 15).toFixed(2);
  const decSign = dec >= 0 ? "+" : "";
  return `RA ${raH}h  DEC ${decSign}${dec.toFixed(2)}°`;
}

function formatFieldSize(w: number, h: number): string {
  if (w >= 1) return `${w.toFixed(1)}° × ${h.toFixed(1)}°`;
  const wm = w * 60;
  const hm = h * 60;
  return `${wm.toFixed(1)}' × ${hm.toFixed(1)}'`;
}

function AnimatedProgressBar({ progress }: { progress: number }) {
  const [animValue] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress, animValue]);

  const width = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  return (
    <View className="mt-2 h-1.5 rounded-full bg-surface-secondary overflow-hidden">
      <Animated.View className="h-full rounded-full bg-accent" style={{ width }} />
    </View>
  );
}

function useElapsedTime(startTime: number, isActive: boolean): string {
  const [elapsed, setElapsed] = useState(isActive ? Date.now() - startTime : 0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(interval);
  }, [startTime, isActive]);

  return formatDuration(elapsed);
}

export function AstrometryJobCard({
  job,
  onCancel,
  onRetry,
  onViewResult,
  onDelete,
}: AstrometryJobCardProps) {
  const { t } = useI18n();

  const statusKey = job.status as keyof typeof STATUS_CHIP_CONFIG;
  const chipConfig = STATUS_CHIP_CONFIG[statusKey];

  const statusLabel = {
    pending: t("astrometry.pending"),
    uploading: t("astrometry.uploading"),
    submitted: t("astrometry.submitted"),
    solving: t("astrometry.solving"),
    success: t("astrometry.success"),
    failure: t("astrometry.failure"),
    cancelled: t("astrometry.cancelled"),
  }[job.status];

  const isActive =
    job.status === "uploading" || job.status === "submitted" || job.status === "solving";

  const elapsedStr = useElapsedTime(job.createdAt, isActive);

  // Duration for completed/failed jobs
  const durationStr =
    !isActive && job.status !== "pending" ? formatDuration(job.updatedAt - job.createdAt) : null;

  return (
    <Card variant="secondary">
      <Card.Body className="p-3">
        {/* 顶部：缩略图 + 文件名 + 状态 */}
        <View className="flex-row items-center gap-3">
          {job.thumbnailUri ? (
            <Image
              source={{ uri: job.thumbnailUri }}
              style={{ width: 40, height: 40, borderRadius: 6 }}
              contentFit="cover"
            />
          ) : (
            <View className="w-10 h-10 rounded-md bg-surface-secondary items-center justify-center">
              <Ionicons name="image-outline" size={20} color="#666" />
            </View>
          )}

          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {job.fileName}
            </Text>
            <View className="flex-row items-center gap-2 mt-0.5">
              <Chip size="sm" variant={chipConfig.variant} color={chipConfig.color}>
                <Chip.Label className="text-[9px] capitalize">{statusLabel}</Chip.Label>
              </Chip>
              {isActive && <Spinner size="sm" />}
              {isActive && <Text className="text-[9px] text-muted">{elapsedStr}</Text>}
              {durationStr && !isActive && (
                <Text className="text-[9px] text-muted">{durationStr}</Text>
              )}
            </View>
          </View>

          {onDelete &&
            (job.status === "success" ||
              job.status === "failure" ||
              job.status === "cancelled") && (
              <Button size="sm" variant="ghost" onPress={onDelete}>
                <Button.Label className="text-[10px] text-muted">
                  <Ionicons name="close" size={14} />
                </Button.Label>
              </Button>
            )}
        </View>

        {/* 动画进度条 */}
        {isActive && <AnimatedProgressBar progress={job.progress} />}

        {/* 进度百分比 */}
        {isActive && job.progress > 0 && (
          <Text className="text-[9px] text-muted mt-0.5 text-right">{job.progress}%</Text>
        )}

        {/* 错误信息 */}
        {job.status === "failure" && job.error && (
          <View className="flex-row items-start gap-1.5 mt-1.5">
            <Ionicons name="warning-outline" size={12} color="#ef4444" style={{ marginTop: 1 }} />
            <Text className="text-[10px] text-danger flex-1" numberOfLines={2}>
              {job.error}
            </Text>
          </View>
        )}

        {/* 成功结果简要 */}
        {job.status === "success" && job.result && (
          <View className="mt-2 gap-0.5">
            <Text className="text-[10px] text-muted">
              {formatCoord(job.result.calibration.ra, job.result.calibration.dec)}
            </Text>
            <Text className="text-[10px] text-muted">
              {formatFieldSize(
                job.result.calibration.fieldWidth,
                job.result.calibration.fieldHeight,
              )}
              {" · "}
              {job.result.calibration.pixscale.toFixed(2)}″/px
            </Text>
            {job.result.annotations.length > 0 && (
              <Text className="text-[10px] text-success">
                <Ionicons name="star-outline" size={10} />{" "}
                {t("astrometry.objectsFound").replace(
                  "{count}",
                  String(job.result.annotations.length),
                )}
              </Text>
            )}
          </View>
        )}

        {/* 操作按钮 */}
        <View className="flex-row justify-end gap-2 mt-2">
          {isActive && onCancel && (
            <Button size="sm" variant="ghost" onPress={onCancel}>
              <Button.Label className="text-[10px] text-danger">
                <Ionicons name="stop-circle-outline" size={12} /> {t("astrometry.cancel")}
              </Button.Label>
            </Button>
          )}
          {job.status === "failure" && onRetry && (
            <Button size="sm" variant="ghost" onPress={onRetry}>
              <Button.Label className="text-[10px] text-success">
                <Ionicons name="refresh-outline" size={12} /> {t("astrometry.retry")}
              </Button.Label>
            </Button>
          )}
          {job.status === "success" && onViewResult && (
            <Button size="sm" variant="secondary" onPress={onViewResult}>
              <Button.Label className="text-[10px]">
                <Ionicons name="telescope-outline" size={12} /> {t("astrometry.viewResult")}
              </Button.Label>
            </Button>
          )}
        </View>
      </Card.Body>
    </Card>
  );
}
