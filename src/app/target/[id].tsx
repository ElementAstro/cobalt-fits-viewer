import { useState } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useTargets } from "../../hooks/useTargets";
import { useFitsStore } from "../../stores/useFitsStore";
import { useGalleryStore } from "../../stores/useGalleryStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { ExposureProgress } from "../../components/targets/ExposureProgress";
import { EditTargetSheet } from "../../components/targets/EditTargetSheet";
import { ObservationTimeline } from "../../components/targets/ObservationTimeline";
import { PlanObservationSheet } from "../../components/sessions/PlanObservationSheet";
import { ThumbnailGrid } from "../../components/gallery/ThumbnailGrid";
import { EmptyState } from "../../components/common/EmptyState";
import { ImageRatingSheet } from "../../components/targets/ImageRatingSheet";
import { BestImageSelector } from "../../components/targets/BestImageSelector";
import {
  EquipmentCard,
  EquipmentRecommendations,
} from "../../components/targets/EquipmentRecommendations";
import { ChangeHistorySheet } from "../../components/targets/ChangeHistorySheet";
import { FavoriteButton, PinButton } from "../../components/targets/FavoriteButton";
import { formatCoordinates } from "../../lib/targets/coordinates";
import { getTargetIcon } from "../../lib/targets/targetIcons";
import { shareTarget } from "../../lib/targets/targetExport";
import { calculateTargetExposure } from "../../lib/targets/targetManager";
import { resolveTargetInteractionUi } from "../../lib/targets/targetInteractionUi";
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
  const { fontScale } = useWindowDimensions();
  const { contentPaddingTop, horizontalPadding, isLandscapeTablet } = useResponsiveLayout();

  const {
    targets,
    getTargetStats,
    updateTarget,
    removeTargetCascade,
    renameTargetCascade,
    setStatus,
    toggleFavorite,
    togglePinned,
    rateImage,
    clearImageRating,
    setBestImage,
    updateEquipment,
    allCategories,
    allTags,
  } = useTargets();
  const target = targets.find((tgt) => tgt.id === id);
  const files = useFitsStore((s) => s.files);
  const setFilterTargetId = useGalleryStore((s) => s.setFilterTargetId);
  const timelineGrouping = useSettingsStore((s) => s.timelineGrouping);
  const targetActionControlMode = useSettingsStore((s) => s.targetActionControlMode);
  const targetActionSizePreset = useSettingsStore((s) => s.targetActionSizePreset);
  const targetActionAutoScaleFromFont = useSettingsStore((s) => s.targetActionAutoScaleFromFont);
  const interactionUi = resolveTargetInteractionUi({
    preset: targetActionSizePreset,
    autoScaleFromFont: targetActionAutoScaleFromFont,
    fontScale,
  });
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showPlanSheet, setShowPlanSheet] = useState(false);
  const [showRatingSheet, setShowRatingSheet] = useState(false);
  const [showBestSelector, setShowBestSelector] = useState(false);
  const [showEquipmentSheet, setShowEquipmentSheet] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);

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
  const controlGapClassName = targetActionControlMode === "checkbox" ? "gap-1.5" : "gap-2";
  const toolbarButtonSize = interactionUi.buttonSize;
  const chipSize = interactionUi.chipSize;
  const iconSize = interactionUi.iconSize;
  const compactIconSize = interactionUi.compactIconSize;
  const miniIconSize = interactionUi.miniIconSize;
  const smallLabelClassName =
    interactionUi.effectivePreset === "accessible" ? "text-xs" : "text-[10px]";
  const tinyLabelClassName =
    interactionUi.effectivePreset === "accessible" ? "text-[11px]" : "text-[9px]";
  const aliasTextClassName =
    interactionUi.effectivePreset === "accessible"
      ? "ml-6 text-xs text-muted"
      : "ml-6 text-[10px] text-muted";
  const statsValueClassName =
    interactionUi.effectivePreset === "accessible"
      ? "text-2xl font-bold text-foreground"
      : "text-xl font-bold text-foreground";
  const statsLabelClassName =
    interactionUi.effectivePreset === "accessible"
      ? "text-xs text-muted"
      : "text-[10px] text-muted";
  const statusLabelClassName =
    interactionUi.effectivePreset === "accessible" ? "text-[10px]" : "text-[9px]";
  const statusDotSize = interactionUi.effectivePreset === "accessible" ? 10 : 8;
  const statusButtonPaddingClassName =
    interactionUi.effectivePreset === "accessible" ? "py-3" : "py-2";

  const handleFilePress = (file: FitsMetadata) => {
    router.push(`/viewer/${file.id}`);
  };

  const handleSave = (updates: Partial<Target>) => {
    const { name, ...rest } = updates;
    if (typeof name === "string" && name.trim() && name.trim() !== target.name) {
      renameTargetCascade(target.id, name.trim());
    }
    if (Object.keys(rest).length > 0) {
      updateTarget(target.id, rest);
    }
    setShowEditSheet(false);
  };

  const handleDelete = () => {
    removeTargetCascade(target.id);
    setShowEditSheet(false);
    router.back();
  };

  return (
    <>
      <ScrollView
        testID="e2e-screen-target__param_id"
        className="flex-1 bg-background"
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: 24,
        }}
      >
        <View className="mb-4 gap-3">
          <View className="flex-row items-center gap-3">
            <Button
              size={toolbarButtonSize}
              isIconOnly
              variant="outline"
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={iconSize} color={mutedColor} />
            </Button>
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={getTargetIcon(target.type).name as keyof typeof Ionicons.glyphMap}
                  size={iconSize}
                  color={getTargetIcon(target.type).color}
                />
                <Text className="flex-1 text-lg font-bold text-foreground" numberOfLines={1}>
                  {target.name}
                </Text>
              </View>
              {target.aliases.length > 0 && (
                <Text className={aliasTextClassName} numberOfLines={1}>
                  {target.aliases.join(", ")}
                </Text>
              )}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className={`flex-row items-center ${controlGapClassName} pr-1`}>
              <Chip size={chipSize} variant="secondary">
                <Chip.Label className={tinyLabelClassName}>
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
              <Button
                testID="e2e-action-target__param_id-open-plan"
                size={toolbarButtonSize}
                isIconOnly
                variant="outline"
                onPress={() => setShowPlanSheet(true)}
              >
                <Ionicons name="calendar-outline" size={iconSize} color={mutedColor} />
              </Button>
              <FavoriteButton
                testID="e2e-action-target__param_id-toggle-favorite"
                isFavorite={target.isFavorite}
                onToggleFavorite={() => toggleFavorite(target.id)}
                mode={targetActionControlMode}
                interactionUi={interactionUi}
                label={t("targets.favorites")}
              />
              <PinButton
                testID="target-detail-pin"
                isPinned={target.isPinned}
                onTogglePinned={() => togglePinned(target.id)}
                mode={targetActionControlMode}
                interactionUi={interactionUi}
                label={t("targets.pin")}
              />
              <Button
                size={toolbarButtonSize}
                isIconOnly
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
                <Ionicons name="share-outline" size={iconSize} color={mutedColor} />
              </Button>
              <Button
                size={toolbarButtonSize}
                isIconOnly
                variant="outline"
                onPress={() => setShowEditSheet(true)}
              >
                <Ionicons name="create-outline" size={iconSize} color={mutedColor} />
              </Button>
            </View>
          </ScrollView>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-4">
          <Button
            size={toolbarButtonSize}
            variant="outline"
            onPress={() => setShowRatingSheet(true)}
          >
            <Ionicons name="star-outline" size={compactIconSize} color={mutedColor} />
            <Button.Label className={smallLabelClassName}>
              {t("targets.ratings.title")}
            </Button.Label>
          </Button>
          <Button
            size={toolbarButtonSize}
            variant="outline"
            onPress={() => setShowBestSelector(true)}
          >
            <Ionicons name="images-outline" size={compactIconSize} color={mutedColor} />
            <Button.Label className={smallLabelClassName}>
              {t("targets.ratings.selectBest")}
            </Button.Label>
          </Button>
          <Button
            size={toolbarButtonSize}
            variant="outline"
            onPress={() => setShowEquipmentSheet(true)}
          >
            <Ionicons name="construct-outline" size={compactIconSize} color={mutedColor} />
            <Button.Label className={smallLabelClassName}>
              {t("targets.equipment.title")}
            </Button.Label>
          </Button>
          <Button
            size={toolbarButtonSize}
            variant="outline"
            onPress={() => setShowHistorySheet(true)}
          >
            <Ionicons name="time-outline" size={compactIconSize} color={mutedColor} />
            <Button.Label className={smallLabelClassName}>
              {t("targets.changeLog.title")}
            </Button.Label>
          </Button>
        </View>

        <View className="flex-row gap-1.5 mb-4">
          {STATUS_FLOW.map((status) => (
            <Button
              key={status}
              variant={target.status === status ? "secondary" : "ghost"}
              className={`flex-1 items-center rounded-lg ${statusButtonPaddingClassName} ${
                target.status === status ? "bg-primary/15" : "bg-surface-secondary"
              }`}
              onPress={() => setStatus(target.id, status)}
            >
              <View
                className="rounded-full mb-1"
                style={{
                  backgroundColor: STATUS_COLORS[status],
                  width: statusDotSize,
                  height: statusDotSize,
                }}
              />
              <Button.Label
                className={`${statusLabelClassName} ${
                  target.status === status ? "font-bold text-primary" : "text-muted"
                }`}
              >
                {t(
                  `targets.${status}` as
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

        <View className="flex-row gap-2 mb-4">
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-3">
              <Text className={statsValueClassName}>{targetFiles.length}</Text>
              <Text className={statsLabelClassName}>{t("targets.frameCount")}</Text>
            </Card.Body>
          </Card>
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-3">
              <Text className={statsValueClassName}>{Math.round(totalExposure / 60)}m</Text>
              <Text className={statsLabelClassName}>{t("targets.totalExposure")}</Text>
            </Card.Body>
          </Card>
          <Card variant="secondary" className="flex-1">
            <Card.Body className="items-center p-3">
              <Text className={statsValueClassName}>
                {stats ? Object.keys(stats.completion.byFilter).length : 0}
              </Text>
              <Text className={statsLabelClassName}>{t("targets.byFilter")}</Text>
            </Card.Body>
          </Card>
        </View>

        {(target.ra !== undefined || target.dec !== undefined) && (
          <View className="mb-4 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
            <Ionicons name="navigate-outline" size={compactIconSize} color={mutedColor} />
            <Text className="text-xs text-foreground font-mono">
              {formatCoordinates(target.ra, target.dec)}
            </Text>
          </View>
        )}

        {(target.category || target.tags.length > 0) && (
          <View className="mb-4">
            {target.category && (
              <View className="mb-2 flex-row items-start gap-2">
                <Ionicons
                  name="folder-outline"
                  size={miniIconSize}
                  color={mutedColor}
                  style={{ marginTop: 2 }}
                />
                <Text className="w-12 text-xs text-muted">{t("targets.category")}</Text>
                <View className="flex-1 flex-row flex-wrap gap-1">
                  <Chip size={chipSize} variant="secondary">
                    <Chip.Label className={tinyLabelClassName}>{target.category}</Chip.Label>
                  </Chip>
                </View>
              </View>
            )}
            {target.tags.length > 0 && (
              <View className="flex-row items-start gap-2">
                <Ionicons
                  name="pricetag-outline"
                  size={miniIconSize}
                  color={mutedColor}
                  style={{ marginTop: 2 }}
                />
                <Text className="w-12 text-xs text-muted">{t("targets.tags")}</Text>
                <View className="flex-1 flex-row flex-wrap gap-1">
                  {target.tags.map((tag) => (
                    <Chip key={tag} size={chipSize} variant="secondary">
                      <Chip.Label className={tinyLabelClassName}>{tag}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        <EquipmentCard
          equipment={target.recommendedEquipment}
          onEdit={() => setShowEquipmentSheet(true)}
        />

        {filterProgressData.length > 0 && (
          <View className="mb-4">
            <ExposureProgress
              filters={filterProgressData}
              overallPercent={stats?.completion.overall ?? 0}
            />
          </View>
        )}

        <Separator className="my-4" />

        {targetFiles.length > 0 && (
          <View className="mb-4">
            <ObservationTimeline files={targetFiles} grouping={timelineGrouping} />
          </View>
        )}

        <Separator className="my-4" />

        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase text-muted">
            {t("gallery.allImages")} ({targetFiles.length})
          </Text>
          {targetFiles.length > 0 && (
            <Button
              size={toolbarButtonSize}
              variant="ghost"
              onPress={() => {
                setFilterTargetId(target.id);
                router.push("/(tabs)/gallery");
              }}
            >
              <Ionicons name="grid-outline" size={miniIconSize} color={mutedColor} />
              <Button.Label className={smallLabelClassName}>{t("gallery.title")}</Button.Label>
            </Button>
          )}
        </View>

        {targetFiles.length === 0 ? (
          <EmptyState icon="images-outline" title={t("gallery.noImages")} />
        ) : (
          <>
            {target.bestImageId && (
              <View className="mb-3 flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
                <Ionicons name="star" size={miniIconSize} color="#f59e0b" />
                <Text className="text-xs text-foreground">{t("targets.ratings.bestImage")}</Text>
                <Text className="text-xs text-muted">
                  ({targetFiles.find((file) => file.id === target.bestImageId)?.filename})
                </Text>
              </View>
            )}
            <ThumbnailGrid
              files={targetFiles}
              columns={isLandscapeTablet ? 4 : 3}
              onPress={handleFilePress}
            />
          </>
        )}

        {target.notes && (
          <>
            <Separator className="my-4" />
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("targets.notes")}
            </Text>
            <Text className="text-sm text-foreground">{target.notes}</Text>
          </>
        )}
      </ScrollView>

      <EditTargetSheet
        visible={showEditSheet}
        target={target}
        allCategories={allCategories}
        allTags={allTags}
        onClose={() => setShowEditSheet(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <PlanObservationSheet
        visible={showPlanSheet}
        onClose={() => setShowPlanSheet(false)}
        initialTargetName={target.name}
      />

      <ImageRatingSheet
        visible={showRatingSheet}
        images={targetFiles}
        imageRatings={target.imageRatings}
        bestImageId={target.bestImageId}
        onClose={() => setShowRatingSheet(false)}
        onRate={(imageId, rating) => {
          if (rating <= 0) {
            clearImageRating(target.id, imageId);
          } else {
            rateImage(target.id, imageId, rating);
          }
        }}
        onSetBest={(imageId) => {
          setBestImage(target.id, imageId);
        }}
      />

      <BestImageSelector
        visible={showBestSelector}
        images={targetFiles}
        currentBestId={target.bestImageId}
        imageRatings={target.imageRatings}
        onClose={() => setShowBestSelector(false)}
        onSelect={(imageId) => {
          setBestImage(target.id, imageId || undefined);
        }}
        onRateImage={(imageId, rating) => {
          if (rating <= 0) {
            clearImageRating(target.id, imageId);
          } else {
            rateImage(target.id, imageId, rating);
          }
        }}
      />

      <EquipmentRecommendations
        visible={showEquipmentSheet}
        equipment={target.recommendedEquipment}
        onClose={() => setShowEquipmentSheet(false)}
        onSave={(equipment) => updateEquipment(target.id, equipment)}
      />

      <ChangeHistorySheet
        visible={showHistorySheet}
        target={target}
        onClose={() => setShowHistorySheet(false)}
      />
    </>
  );
}
