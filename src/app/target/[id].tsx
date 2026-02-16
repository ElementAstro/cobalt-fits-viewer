import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useTargets } from "../../hooks/useTargets";
import { useFitsStore } from "../../stores/useFitsStore";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { ExposureProgress } from "../../components/targets/ExposureProgress";
import { EditTargetSheet } from "../../components/targets/EditTargetSheet";
import { ObservationTimeline } from "../../components/targets/ObservationTimeline";
import { PlanObservationSheet } from "../../components/sessions/PlanObservationSheet";
import { ThumbnailGrid } from "../../components/gallery/ThumbnailGrid";
import { EmptyState } from "../../components/common/EmptyState";
import { formatCoordinates } from "../../lib/targets/coordinates";
import { getTargetIcon } from "../../lib/targets/targetIcons";
import { shareTarget } from "../../lib/targets/targetExport";
import { calculateTargetExposure } from "../../lib/targets/targetManager";
import type { FitsMetadata, Target, TargetStatus } from "../../lib/fits/types";

const STATUS_FLOW: TargetStatus[] = ["planned", "acquiring", "completed", "processed"];
const STATUS_COLORS: Record<TargetStatus, string> = {
  planned: "#6b7280",
  acquiring: "#f59e0b",
  completed: "#22c55e",
  processed: "#3b82f6",
};

export default function TargetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [_successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const {
    targets,
    getTargetStats,
    updateTarget,
    removeTarget,
    setStatus,
    toggleFavorite,
    togglePinned,
  } = useTargets();
  const target = targets.find((tgt) => tgt.id === id);
  const files = useFitsStore((s) => s.files);
  const setFilterTargetId = useGalleryStore((s) => s.setFilterTargetId);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showPlanSheet, setShowPlanSheet] = useState(false);

  if (!target) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Ionicons name="alert-circle-outline" size={48} color={mutedColor} />
        <Text className="mt-4 text-sm text-muted">{t("common.noData")}</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>{t("common.goHome")}</Button.Label>
        </Button>
      </View>
    );
  }

  const targetFiles = files.filter((f) => target.imageIds.includes(f.id));
  const stats = getTargetStats(target.id);
  const totalExposure = stats?.exposureStats.totalExposure ?? 0;

  const filterProgressData = stats
    ? Object.entries(stats.completion.byFilter).map(([filter, data]) => ({
        filter,
        planned: data.planned,
        acquired: data.acquired,
        percent: data.percent,
      }))
    : [];

  const handleFilePress = (file: FitsMetadata) => {
    router.push(`/viewer/${file.id}`);
  };

  const handleSave = (updates: Partial<Target>) => {
    updateTarget(target.id, updates);
    setShowEditSheet(false);
  };

  const handleDelete = () => {
    removeTarget(target.id);
    setShowEditSheet(false);
    router.back();
  };

  return (
    <>
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-14">
        {/* Top Bar */}
        <View className="flex-row items-center gap-3 mb-4">
          <Button size="sm" variant="outline" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={mutedColor} />
          </Button>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={getTargetIcon(target.type).name as keyof typeof Ionicons.glyphMap}
                size={18}
                color={getTargetIcon(target.type).color}
              />
              <Text className="text-lg font-bold text-foreground">{target.name}</Text>
            </View>
            {target.aliases.length > 0 && (
              <Text className="text-[10px] text-muted ml-6">{target.aliases.join(", ")}</Text>
            )}
          </View>
          <Chip size="sm" variant="secondary">
            <Chip.Label className="text-[9px]">
              {t(
                `targets.types.${target.type}` as
                  | "targets.types.galaxy"
                  | "targets.types.nebula"
                  | "targets.types.cluster"
                  | "targets.types.planet"
                  | "targets.types.moon"
                  | "targets.types.sun"
                  | "targets.types.comet"
                  | "targets.types.other",
              )}
            </Chip.Label>
          </Chip>
          <Button size="sm" variant="outline" onPress={() => setShowPlanSheet(true)}>
            <Ionicons name="calendar-outline" size={16} color={mutedColor} />
          </Button>
          <Button size="sm" variant="outline" onPress={() => toggleFavorite(target.id)}>
            <Ionicons
              name={target.isFavorite ? "heart" : "heart-outline"}
              size={16}
              color={target.isFavorite ? "#ef4444" : mutedColor}
            />
          </Button>
          <Button size="sm" variant="outline" onPress={() => togglePinned(target.id)}>
            <Ionicons
              name={target.isPinned ? "pin" : "pin-outline"}
              size={16}
              color={target.isPinned ? "#f59e0b" : mutedColor}
            />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              const filterBreakdown = calculateTargetExposure(target, files);
              shareTarget(target, {
                frameCount: targetFiles.length,
                totalExposure: totalExposure,
                filterBreakdown,
              });
            }}
          >
            <Ionicons name="share-outline" size={16} color={mutedColor} />
          </Button>
          <Button size="sm" variant="outline" onPress={() => setShowEditSheet(true)}>
            <Ionicons name="create-outline" size={16} color={mutedColor} />
          </Button>
        </View>

        {/* Quick Status Switch */}
        <View className="flex-row gap-1.5 mb-4">
          {STATUS_FLOW.map((s) => (
            <Button
              key={s}
              variant={target.status === s ? "secondary" : "ghost"}
              className={`flex-1 items-center rounded-lg py-2 ${
                target.status === s ? "bg-primary/15" : "bg-surface-secondary"
              }`}
              onPress={() => setStatus(target.id, s)}
            >
              <View
                className="h-2 w-2 rounded-full mb-1"
                style={{ backgroundColor: STATUS_COLORS[s] }}
              />
              <Button.Label
                className={`text-[9px] ${
                  target.status === s ? "font-bold text-primary" : "text-muted"
                }`}
              >
                {t(
                  `targets.${s}` as
                    | "targets.planned"
                    | "targets.acquiring"
                    | "targets.completed"
                    | "targets.processed",
                )}
              </Button.Label>
            </Button>
          ))}
        </View>

        <Separator className="mb-4" />

        {/* Stats Row */}
        <View className="flex-row gap-2 mb-4">
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-3">
              <Text className="text-xl font-bold text-foreground">{targetFiles.length}</Text>
              <Text className="text-[10px] text-muted">{t("targets.frameCount")}</Text>
            </Card.Body>
          </Card>
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-3">
              <Text className="text-xl font-bold text-foreground">
                {Math.round(totalExposure / 60)}m
              </Text>
              <Text className="text-[10px] text-muted">{t("targets.totalExposure")}</Text>
            </Card.Body>
          </Card>
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-3">
              <Text className="text-xl font-bold text-foreground">
                {stats ? Object.keys(stats.completion.byFilter).length : 0}
              </Text>
              <Text className="text-[10px] text-muted">{t("targets.byFilter")}</Text>
            </Card.Body>
          </Card>
        </View>

        {/* Coordinates */}
        {(target.ra !== undefined || target.dec !== undefined) && (
          <View className="mb-4 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
            <Ionicons name="navigate-outline" size={14} color={mutedColor} />
            <Text className="text-xs text-foreground font-mono">
              {formatCoordinates(target.ra, target.dec)}
            </Text>
          </View>
        )}

        {/* Category & Tags */}
        {(target.category || target.tags.length > 0) && (
          <View className="mb-4">
            {target.category && (
              <View className="mb-2 flex-row items-center gap-2">
                <Ionicons name="folder-outline" size={12} color={mutedColor} />
                <Text className="text-xs text-muted">{t("targets.category")}</Text>
                <Chip size="sm" variant="secondary">
                  <Chip.Label className="text-[9px]">{target.category}</Chip.Label>
                </Chip>
              </View>
            )}
            {target.tags.length > 0 && (
              <View className="flex-row items-center gap-2">
                <Ionicons name="pricetag-outline" size={12} color={mutedColor} />
                <Text className="text-xs text-muted">{t("targets.tags")}</Text>
                <View className="flex-row flex-wrap gap-1">
                  {target.tags.map((tag) => (
                    <Chip key={tag} size="sm" variant="secondary">
                      <Chip.Label className="text-[9px]">{tag}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Recommended Equipment */}
        {target.recommendedEquipment && (
          <View className="mb-4">
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("targets.equipment.title")}
            </Text>
            <View className="rounded-lg bg-surface-secondary p-3">
              {target.recommendedEquipment.telescope && (
                <View className="mb-1.5 flex-row items-center gap-2">
                  <Ionicons name="telescope-outline" size={12} color={mutedColor} />
                  <Text className="text-xs text-foreground">
                    {target.recommendedEquipment.telescope}
                  </Text>
                </View>
              )}
              {target.recommendedEquipment.camera && (
                <View className="mb-1.5 flex-row items-center gap-2">
                  <Ionicons name="camera-outline" size={12} color={mutedColor} />
                  <Text className="text-xs text-foreground">
                    {target.recommendedEquipment.camera}
                  </Text>
                </View>
              )}
              {target.recommendedEquipment.filters &&
                target.recommendedEquipment.filters.length > 0 && (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="filter-outline" size={12} color={mutedColor} />
                    <Text className="text-xs text-foreground">
                      {target.recommendedEquipment.filters.join(", ")}
                    </Text>
                  </View>
                )}
              {target.recommendedEquipment.notes && (
                <Text className="text-xs text-muted mt-2">{target.recommendedEquipment.notes}</Text>
              )}
            </View>
          </View>
        )}

        {/* Exposure Progress */}
        {filterProgressData.length > 0 && (
          <View className="mb-4">
            <ExposureProgress
              filters={filterProgressData}
              overallPercent={stats?.completion.overall ?? 0}
            />
          </View>
        )}

        <Separator className="my-4" />

        {/* Observation Timeline */}
        {targetFiles.length > 0 && (
          <View className="mb-4">
            <ObservationTimeline files={targetFiles} />
          </View>
        )}

        <Separator className="my-4" />

        {/* Image Grid */}
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase text-muted">
            {t("gallery.allImages")} ({targetFiles.length})
          </Text>
          {targetFiles.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setFilterTargetId(target.id);
                router.push("/(tabs)/gallery");
              }}
            >
              <Ionicons name="grid-outline" size={12} color={mutedColor} />
              <Button.Label className="text-[10px] text-muted">{t("gallery.title")}</Button.Label>
            </Button>
          )}
        </View>

        {targetFiles.length === 0 ? (
          <EmptyState icon="images-outline" title={t("gallery.noImages")} />
        ) : (
          <>
            {target.bestImageId && (
              <View className="mb-3 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text className="text-xs text-foreground">{t("targets.ratings.bestImage")}</Text>
                <Text className="text-xs text-muted">
                  ({targetFiles.find((f) => f.id === target.bestImageId)?.filename})
                </Text>
              </View>
            )}
            <ThumbnailGrid files={targetFiles} columns={3} onPress={handleFilePress} />
          </>
        )}

        {/* Notes */}
        {target.notes && (
          <>
            <Separator className="my-4" />
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("targets.notes")}
            </Text>
            <Text className="text-sm text-foreground">{target.notes}</Text>
          </>
        )}

        {/* Change History */}
        {target.changeLog.length > 0 && (
          <>
            <Separator className="my-4" />
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("targets.changeLog.title")}
            </Text>
            <View className="space-y-2">
              {target.changeLog
                .slice(-5)
                .reverse()
                .map((entry) => (
                  <View key={entry.id} className="flex-row items-start gap-2">
                    <Text className="text-[10px] text-muted">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </Text>
                    <View className="flex-1">
                      <Text className="text-xs text-foreground">
                        {t(`targets.changeLog.${entry.action}`)}
                        {entry.field && (
                          <Text className="text-xs text-muted"> ({entry.field})</Text>
                        )}
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          </>
        )}
      </ScrollView>

      <EditTargetSheet
        visible={showEditSheet}
        target={target}
        onClose={() => setShowEditSheet(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      <PlanObservationSheet
        visible={showPlanSheet}
        onClose={() => setShowPlanSheet(false)}
        initialTargetName={target.name}
      />
    </>
  );
}
