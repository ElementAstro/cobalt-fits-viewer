import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useState, useCallback, useMemo } from "react";
import { Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";
import { calculateStats } from "../../lib/utils/pixelMath";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { EmptyState } from "../../components/common/EmptyState";
import { FitsCanvas } from "../../components/fits/FitsCanvas";
import {
  useStacking,
  type StackMethod,
  type CalibrationFrames,
  type AlignmentMode,
} from "../../hooks/useStacking";
import { useExport } from "../../hooks/useExport";
import type { ExportFormat } from "../../lib/fits/types";

const METHODS: { key: StackMethod; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { key: "average", icon: "calculator-outline", labelKey: "editor.average" },
  { key: "median", icon: "analytics-outline", labelKey: "editor.median" },
  { key: "sigma", icon: "cut-outline", labelKey: "editor.sigmaClip" },
  { key: "min", icon: "arrow-down-outline", labelKey: "editor.min" },
  { key: "max", icon: "arrow-up-outline", labelKey: "editor.max" },
  { key: "winsorized", icon: "shield-outline", labelKey: "editor.winsorized" },
  { key: "weighted", icon: "scale-outline", labelKey: "editor.weighted" },
];

const ALIGNMENT_MODES: {
  key: AlignmentMode;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
}[] = [
  { key: "none", icon: "close-outline", labelKey: "editor.alignNone" },
  { key: "translation", icon: "move-outline", labelKey: "editor.alignTranslation" },
  { key: "full", icon: "sync-outline", labelKey: "editor.alignFull" },
];

export default function StackingScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const files = useFitsStore((s) => s.files);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(files.map((f) => f.id));
  }, [files]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const [method, setMethod] = useState<StackMethod>("average");
  const [sigmaValue, setSigmaValue] = useState(2.5);
  const [calibration, setCalibration] = useState<CalibrationFrames>({});
  const [showCalibration, setShowCalibration] = useState(false);
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>("none");
  const [enableQuality, setEnableQuality] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);

  const stacking = useStacking();
  const { saveImage, shareImage } = useExport();

  const selectedFiles = files.filter((f) => selectedIds.includes(f.id));

  // Group files by filter for quick selection
  const filterGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const f of files) {
      const key = f.filter ?? "Unknown";
      groups[key] = (groups[key] ?? 0) + 1;
    }
    return groups;
  }, [files]);

  // Filtered display list
  const displayFiles = useMemo(() => {
    if (!filterGroup) return files;
    return files.filter((f) => (f.filter ?? "Unknown") === filterGroup);
  }, [files, filterGroup]);

  const handleStack = useCallback(async () => {
    if (selectedFiles.length < 2) {
      Alert.alert(t("common.error"), t("editor.selectAtLeast2" as any));
      return;
    }

    const fileInfos = selectedFiles.map((f) => ({
      filepath: f.filepath,
      filename: f.filename,
    }));

    const hasCalibration =
      calibration.darkFilepath ||
      calibration.flatFilepath ||
      calibration.biasFilepath ||
      (calibration.darkFilepaths && calibration.darkFilepaths.length > 0) ||
      (calibration.flatFilepaths && calibration.flatFilepaths.length > 0);

    await stacking.stackFiles(
      fileInfos,
      method,
      sigmaValue,
      hasCalibration ? calibration : undefined,
      alignmentMode,
      enableQuality || method === "weighted",
    );
  }, [selectedFiles, method, sigmaValue, calibration, alignmentMode, enableQuality, t, stacking]);

  const handleExport = useCallback(async () => {
    if (!stacking.result) return;
    try {
      const path = await saveImage(
        stacking.result.rgbaData,
        stacking.result.width,
        stacking.result.height,
        `stacked_${stacking.result.method}_${stacking.result.frameCount}f`,
        exportFormat,
      );
      if (path) {
        Alert.alert(t("common.success"), t("viewer.exportSuccess" as any));
      } else {
        Alert.alert(t("common.error"), t("viewer.exportFailed" as any));
      }
    } catch {
      Alert.alert(t("common.error"), t("viewer.exportFailed" as any));
    }
  }, [stacking.result, saveImage, exportFormat, t]);

  const handleShareResult = useCallback(async () => {
    if (!stacking.result) return;
    try {
      await shareImage(
        stacking.result.rgbaData,
        stacking.result.width,
        stacking.result.height,
        `stacked_${stacking.result.method}_${stacking.result.frameCount}f`,
        exportFormat,
      );
    } catch {
      Alert.alert(t("common.error"), t("share.failed"));
    }
  }, [stacking.result, shareImage, exportFormat, t]);

  const handleSelectByFilter = useCallback(
    (filter: string) => {
      clearSelection();
      for (const f of files) {
        if ((f.filter ?? "Unknown") === filter) {
          toggleSelection(f.id);
        }
      }
    },
    [files, clearSelection, toggleSelection],
  );

  const resultStats = useMemo(
    () => (stacking.result ? calculateStats(stacking.result.pixels) : null),
    [stacking.result],
  );

  const progressPercent = useMemo(() => {
    if (!stacking.progress || stacking.progress.total === 0) return undefined;
    return Math.round((stacking.progress.current / stacking.progress.total) * 100);
  }, [stacking.progress]);

  const handleSelectCalibrationFrame = useCallback(
    (type: "dark" | "flat" | "bias") => {
      // Find files that could serve as calibration frames
      const available = files.filter((f) => !selectedIds.includes(f.id));
      if (available.length === 0) {
        Alert.alert(t("common.error"), "No unselected files available for calibration");
        return;
      }

      const options = available.slice(0, 10).map((f) => ({
        text: f.filename,
        onPress: () => {
          setCalibration((prev) => ({
            ...prev,
            [`${type}Filepath`]: f.filepath,
          }));
        },
      }));

      Alert.alert(t(`editor.${type}Frame` as any), undefined, [
        ...options,
        { text: t("common.cancel"), style: "cancel" },
      ]);
    },
    [files, selectedIds, t],
  );

  return (
    <View className="flex-1 bg-background">
      <LoadingOverlay
        visible={stacking.isStacking}
        message={stacking.progress?.message ?? `${t("editor.stacking")}...`}
        percent={progressPercent}
        current={stacking.progress?.current}
        total={stacking.progress?.total}
        onCancel={stacking.cancel}
      />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-14">
        <View className="flex-row items-center gap-3 mb-4">
          <Button size="sm" variant="outline" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={mutedColor} />
          </Button>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{t("editor.stacking")}</Text>
            <Text className="text-[10px] text-muted">
              {selectedFiles.length} / {files.length} frames selected
            </Text>
          </View>
          {stacking.result && (
            <Button size="sm" variant="outline" onPress={stacking.reset}>
              <Ionicons name="refresh-outline" size={14} color={mutedColor} />
            </Button>
          )}
        </View>

        <Separator className="mb-4" />

        {/* Method Selection */}
        <Text className="mb-2 text-xs font-semibold uppercase text-muted">
          {t("editor.algorithm" as any)}
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {METHODS.map((m) => (
            <TouchableOpacity key={m.key} onPress={() => setMethod(m.key)}>
              <Card
                variant="secondary"
                className={`min-w-[70px] ${method === m.key ? "border border-success" : ""}`}
              >
                <Card.Body className="items-center p-2.5">
                  <Ionicons
                    name={m.icon}
                    size={18}
                    color={method === m.key ? successColor : mutedColor}
                  />
                  <Text
                    className={`mt-1 text-[9px] ${method === m.key ? "text-success font-semibold" : "text-muted"}`}
                  >
                    {t(m.labelKey as any)}
                  </Text>
                </Card.Body>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sigma parameter (for sigma/winsorized methods) */}
        {(method === "sigma" || method === "winsorized") && (
          <View className="mb-4">
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("editor.sigma" as any)}: {sigmaValue}
            </Text>
            <View className="flex-row gap-2">
              {[1.5, 2.0, 2.5, 3.0, 3.5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setSigmaValue(s)}>
                  <Chip size="sm" variant={sigmaValue === s ? "primary" : "secondary"}>
                    <Chip.Label className="text-[9px]">{s}σ</Chip.Label>
                  </Chip>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Alignment Mode */}
        <Text className="mb-2 text-xs font-semibold uppercase text-muted">
          {t("editor.alignment" as any)}
        </Text>
        <View className="flex-row gap-2 mb-4">
          {ALIGNMENT_MODES.map((am) => (
            <TouchableOpacity
              key={am.key}
              onPress={() => setAlignmentMode(am.key)}
              className="flex-1"
            >
              <Card
                variant="secondary"
                className={alignmentMode === am.key ? "border border-success" : ""}
              >
                <Card.Body className="items-center p-2.5">
                  <Ionicons
                    name={am.icon}
                    size={18}
                    color={alignmentMode === am.key ? successColor : mutedColor}
                  />
                  <Text
                    className={`mt-1 text-[9px] ${alignmentMode === am.key ? "text-success font-semibold" : "text-muted"}`}
                  >
                    {t(am.labelKey as any)}
                  </Text>
                </Card.Body>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* Advanced Options */}
        <TouchableOpacity
          onPress={() => setShowAdvanced((v) => !v)}
          className="flex-row items-center justify-between mb-2"
        >
          <Text className="text-xs font-semibold uppercase text-muted">
            {t("editor.advancedOptions" as any)}
          </Text>
          <Ionicons
            name={showAdvanced ? "chevron-up" : "chevron-down"}
            size={14}
            color={mutedColor}
          />
        </TouchableOpacity>

        {showAdvanced && (
          <View className="mb-4 gap-2">
            {/* Quality Evaluation Toggle */}
            <TouchableOpacity
              onPress={() => setEnableQuality((v) => !v)}
              className="flex-row items-center gap-2"
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded ${enableQuality ? "bg-success" : "bg-surface-secondary border border-separator"}`}
              >
                {enableQuality && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text className="text-xs text-foreground">
                {t("editor.enableQualityEval" as any)}
              </Text>
            </TouchableOpacity>

            {/* Export Format */}
            <View className="flex-row items-center gap-2">
              <Text className="text-[10px] text-muted">{t("editor.exportFormat" as any)}:</Text>
              {(["png", "jpeg", "tiff"] as ExportFormat[]).map((fmt) => (
                <TouchableOpacity key={fmt} onPress={() => setExportFormat(fmt)}>
                  <Chip size="sm" variant={exportFormat === fmt ? "primary" : "secondary"}>
                    <Chip.Label className="text-[9px]">{fmt.toUpperCase()}</Chip.Label>
                  </Chip>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Separator className="mb-4" />

        {/* Calibration Frames */}
        <TouchableOpacity
          onPress={() => setShowCalibration((v) => !v)}
          className="flex-row items-center justify-between mb-2"
        >
          <Text className="text-xs font-semibold uppercase text-muted">
            {t("editor.calibrationFrames" as any)}
          </Text>
          <View className="flex-row items-center gap-1">
            {(calibration.darkFilepath || calibration.flatFilepath || calibration.biasFilepath) && (
              <View className="h-1.5 w-1.5 rounded-full bg-success" />
            )}
            <Ionicons
              name={showCalibration ? "chevron-up" : "chevron-down"}
              size={14}
              color={mutedColor}
            />
          </View>
        </TouchableOpacity>

        {showCalibration && (
          <View className="mb-4 gap-1.5">
            {(["dark", "flat", "bias"] as const).map((type) => {
              const key = `${type}Filepath` as "darkFilepath" | "flatFilepath" | "biasFilepath";
              const filepath = calibration[key];
              const labelKey = `editor.${type}Frame` as any;
              const filename = filepath?.split("/").pop();
              return (
                <View key={type} className="flex-row items-center gap-2">
                  <TouchableOpacity
                    className="flex-1"
                    onPress={() => handleSelectCalibrationFrame(type)}
                  >
                    <Card variant="secondary">
                      <Card.Body className="flex-row items-center gap-2 p-2.5">
                        <Ionicons
                          name="flask-outline"
                          size={14}
                          color={filepath ? successColor : mutedColor}
                        />
                        <View className="flex-1 min-w-0">
                          <Text className="text-[10px] font-semibold text-muted">
                            {t(labelKey)}
                          </Text>
                          {filename ? (
                            <Text className="text-xs text-foreground" numberOfLines={1}>
                              {filename}
                            </Text>
                          ) : (
                            <Text className="text-[10px] text-muted italic">
                              {t(
                                `editor.select${type.charAt(0).toUpperCase() + type.slice(1)}` as any,
                              )}
                            </Text>
                          )}
                        </View>
                        {filepath && (
                          <TouchableOpacity
                            onPress={() =>
                              setCalibration((prev) => ({
                                ...prev,
                                [key]: undefined,
                              }))
                            }
                          >
                            <Ionicons name="close-circle" size={16} color={mutedColor} />
                          </TouchableOpacity>
                        )}
                      </Card.Body>
                    </Card>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <Separator className="mb-4" />

        {/* Error */}
        {stacking.error && (
          <View className="mb-4 rounded-lg bg-danger/10 p-3">
            <Text className="text-xs text-danger">{stacking.error}</Text>
          </View>
        )}

        {/* Result Preview */}
        {stacking.result && (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("editor.resultPreview" as any)}
            </Text>
            <View className="h-48 mb-3 rounded-lg overflow-hidden bg-black">
              <FitsCanvas
                rgbaData={stacking.result.rgbaData}
                width={stacking.result.width}
                height={stacking.result.height}
                showGrid={false}
                showCrosshair={false}
                cursorX={-1}
                cursorY={-1}
              />
            </View>

            {/* Stats Card */}
            {resultStats && (
              <Card variant="secondary" className="mb-2">
                <Card.Body className="gap-1 p-3">
                  <Text className="text-[10px] font-semibold text-muted mb-1">
                    {stacking.result.frameCount} {t("editor.frames" as any)} ·{" "}
                    {t(`editor.${stacking.result.method}` as any)} ·{" "}
                    {(stacking.result.duration / 1000).toFixed(1)}s
                    {stacking.result.alignmentMode !== "none" &&
                      ` · ${t(`editor.align${stacking.result.alignmentMode.charAt(0).toUpperCase() + stacking.result.alignmentMode.slice(1)}` as any)}`}
                  </Text>
                  <Text className="text-xs text-foreground">
                    {t("editor.statMean" as any)}: {resultStats.mean.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-foreground">
                    {t("editor.statMedian" as any)}: {resultStats.median.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-foreground">
                    {t("editor.statStdDev" as any)}: {resultStats.stddev.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-foreground">
                    {t("editor.statSNR" as any)}: {resultStats.snr.toFixed(2)}
                  </Text>
                </Card.Body>
              </Card>
            )}

            {/* Alignment Results */}
            {stacking.result.alignmentResults && stacking.result.alignmentResults.length > 0 && (
              <Card variant="secondary" className="mb-2">
                <Card.Body className="gap-1 p-3">
                  <Text className="text-[10px] font-semibold text-muted mb-1">
                    {t("editor.alignmentResults" as any)}
                  </Text>
                  {stacking.result.alignmentResults.map((ar, idx) => (
                    <View key={idx} className="flex-row items-center gap-2">
                      <Text className="text-[9px] text-foreground flex-1" numberOfLines={1}>
                        {ar.filename}
                      </Text>
                      <Text className="text-[9px] text-muted">
                        {ar.matchedStars === -1
                          ? t("editor.referenceFrame" as any)
                          : `${ar.matchedStars} ${t("editor.stars" as any)} · RMS ${ar.rmsError.toFixed(2)}px`}
                      </Text>
                    </View>
                  ))}
                </Card.Body>
              </Card>
            )}

            {/* Quality Metrics */}
            {stacking.result.qualityMetrics && stacking.result.qualityMetrics.length > 0 && (
              <Card variant="secondary" className="mb-2">
                <Card.Body className="gap-1 p-3">
                  <Text className="text-[10px] font-semibold text-muted mb-1">
                    {t("editor.qualityMetrics" as any)}
                  </Text>
                  {stacking.result.qualityMetrics.map((qm, idx) => (
                    <View key={idx} className="flex-row items-center gap-2">
                      <View
                        className={`h-2 w-2 rounded-full ${qm.score >= 70 ? "bg-success" : qm.score >= 40 ? "bg-warning" : "bg-danger"}`}
                      />
                      <Text className="text-[9px] text-foreground flex-1" numberOfLines={1}>
                        {selectedFiles[idx]?.filename ?? `Frame ${idx + 1}`}
                      </Text>
                      <Text className="text-[9px] text-muted">
                        {t("editor.qualityScore" as any)}: {qm.score} · FWHM{" "}
                        {qm.medianFwhm.toFixed(1)} · {qm.starCount} {t("editor.stars" as any)}
                      </Text>
                    </View>
                  ))}
                </Card.Body>
              </Card>
            )}

            <View className="flex-row gap-2 mb-4">
              <Button variant="outline" size="sm" onPress={handleExport} className="flex-1">
                <Ionicons name="download-outline" size={14} color={successColor} />
                <Button.Label>
                  {t("editor.exportResult" as any)} ({exportFormat.toUpperCase()})
                </Button.Label>
              </Button>
              <Button variant="outline" size="sm" onPress={handleShareResult}>
                <Ionicons name="share-outline" size={14} color={successColor} />
              </Button>
            </View>
            <Separator className="mb-4" />
          </>
        )}

        {/* Frame Selection Header */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-semibold uppercase text-muted">
            {t("editor.frames" as any)} ({selectedFiles.length}/{files.length})
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={selectAll}>
              <Text className="text-[10px] text-success">{t("editor.selectAll" as any)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearSelection}>
              <Text className="text-[10px] text-muted">{t("editor.deselectAll" as any)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Group Chips */}
        {Object.keys(filterGroups).length > 1 && (
          <View className="flex-row flex-wrap gap-1.5 mb-3">
            <TouchableOpacity onPress={() => setFilterGroup(null)}>
              <Chip size="sm" variant={filterGroup === null ? "primary" : "secondary"}>
                <Chip.Label className="text-[9px]">{t("editor.allFilters" as any)}</Chip.Label>
              </Chip>
            </TouchableOpacity>
            {Object.entries(filterGroups).map(([filter, count]) => (
              <TouchableOpacity
                key={filter}
                onPress={() => {
                  setFilterGroup(filter);
                  handleSelectByFilter(filter);
                }}
              >
                <Chip size="sm" variant={filterGroup === filter ? "primary" : "secondary"}>
                  <Chip.Label className="text-[9px]">
                    {filter} ({count})
                  </Chip.Label>
                </Chip>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {displayFiles.length === 0 ? (
          <EmptyState icon="images-outline" title={t("editor.noFitsAvailable" as any)} />
        ) : (
          <View className="gap-1.5">
            {displayFiles.map((file) => {
              const isSelected = selectedIds.includes(file.id);
              return (
                <TouchableOpacity key={file.id} onPress={() => toggleSelection(file.id)}>
                  <Card variant="secondary" className={isSelected ? "border border-success" : ""}>
                    <Card.Body className="flex-row items-center gap-3 p-2.5">
                      <View
                        className={`h-5 w-5 items-center justify-center rounded ${isSelected ? "bg-success" : "bg-surface-secondary border border-separator"}`}
                      >
                        {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                          {file.filename}
                        </Text>
                        <Text className="text-[9px] text-muted">
                          {file.object ?? "-"} · {file.filter ?? "-"} · {file.exptime ?? 0}s
                        </Text>
                      </View>
                      {file.naxis1 && file.naxis2 && (
                        <Text className="text-[9px] text-muted">
                          {file.naxis1}×{file.naxis2}
                        </Text>
                      )}
                    </Card.Body>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Stack Button */}
        <View className="mt-6">
          <Button
            variant="primary"
            onPress={handleStack}
            isDisabled={selectedFiles.length < 2 || stacking.isStacking}
          >
            <Ionicons name="layers-outline" size={16} color="#fff" />
            <Button.Label>
              {t("editor.stackButton" as any)} ({selectedFiles.length} {t("editor.frames" as any)})
            </Button.Label>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
