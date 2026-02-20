import { useState, useCallback, useEffect, useMemo } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import {
  Accordion,
  Button,
  Card,
  Chip,
  PressableFeedback,
  Separator,
  Tabs,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useConverter } from "../../hooks/useConverter";
import { useExport } from "../../hooks/useExport";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageProcessing } from "../../hooks/useImageProcessing";
import { useFitsStore } from "../../stores/useFitsStore";
import { useAstrometryStore } from "../../stores/useAstrometryStore";
import { FormatSelector } from "../../components/converter/FormatSelector";
import { BatchConvertContent } from "../../components/converter/BatchConvertContent";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import { FitsCanvas } from "../../components/fits/FitsCanvas";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { formatFileSize } from "../../lib/utils/fileManager";
import { formatBytes } from "../../lib/utils/format";
import {
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_TIFF_TARGET_OPTIONS,
  type ExportFormat,
  type StretchType,
  type ColormapType,
  type FitsCompression,
  type FitsExportMode,
  type FitsTargetOptions,
  type TiffCompression,
} from "../../lib/fits/types";
import { canUseScientificFitsExport } from "../../lib/converter/exportCore";

const STRETCH_OPTIONS: { key: StretchType; label: string }[] = [
  { key: "linear", label: "Linear" },
  { key: "sqrt", label: "Sqrt" },
  { key: "log", label: "Log" },
  { key: "asinh", label: "Asinh" },
  { key: "zscale", label: "ZScale" },
  { key: "percentile", label: "Percentile" },
];

const COLORMAP_OPTIONS: { key: ColormapType; label: string }[] = [
  { key: "grayscale", label: "Gray" },
  { key: "inverted", label: "Inverted" },
  { key: "heat", label: "Heat" },
  { key: "cool", label: "Cool" },
  { key: "viridis", label: "Viridis" },
  { key: "plasma", label: "Plasma" },
  { key: "jet", label: "Jet" },
  { key: "rainbow", label: "Rainbow" },
];

const DPI_OPTIONS = [72, 150, 300, 600];
const FITS_BITPIX_PRESETS: Array<FitsTargetOptions["bitpix"]> = [8, 16, 32, -32, -64];
const FITS_MODE_PRESETS: FitsExportMode[] = ["scientific", "rendered"];
const FITS_COMPRESSION_PRESETS: FitsCompression[] = ["none", "gzip"];
const TIFF_COMPRESSION_PRESETS: TiffCompression[] = ["lzw", "deflate", "none"];

export default function ConvertScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[]; ids?: string | string[] }>();
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const [activeTab, setActiveTab] = useState("single");

  const files = useFitsStore((s) => s.files);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const selectedFile = files.find((f) => f.id === selectedFileId);
  const astrometryJobs = useAstrometryStore((s) => s.jobs);
  const latestSolvedJob = useMemo(
    () =>
      astrometryJobs.find(
        (job) => job.fileId === selectedFileId && job.status === "success" && job.result,
      ),
    [astrometryJobs, selectedFileId],
  );

  useEffect(() => {
    const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (tabParam === "batch" || tabParam === "single") {
      setActiveTab(tabParam);
    }
  }, [params.tab]);

  useEffect(() => {
    const idsParam = Array.isArray(params.ids) ? params.ids.join(",") : params.ids;
    if (!idsParam || typeof idsParam !== "string") return;
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) return;

    const fileIds = new Set(files.map((file) => file.id));
    const validIds = Array.from(new Set(ids.filter((id) => fileIds.has(id))));
    if (validIds.length === 0) return;

    useFitsStore.setState({
      selectedIds: validIds,
      isSelectionMode: true,
    });
    setActiveTab("batch");
  }, [params.ids, files]);

  const {
    currentOptions,
    setFormat,
    setQuality,
    setBitDepth,
    setDpi,
    setOptions,
    allPresets,
    applyPreset,
    getEstimatedSize,
    supportsQuality: checkSupportsQuality,
    getSupportedBitDepths: checkBitDepths,
  } = useConverter();

  const {
    metadata,
    headers,
    comments,
    history,
    pixels,
    rgbChannels,
    sourceBuffer,
    dimensions,
    isLoading: isFitsLoading,
    loadFromPath,
    reset: resetFits,
  } = useFitsFile();
  const { rgbaData, processImage } = useImageProcessing();
  const { isExporting, exportImageDetailed } = useExport();

  const exportSource = useMemo(
    () => ({
      sourceType: metadata?.sourceType,
      sourceFormat: metadata?.sourceFormat,
      sourceFileId: selectedFile?.id,
      originalBuffer: sourceBuffer,
      scientificPixels: pixels,
      rgbChannels,
      metadata: metadata ?? undefined,
      headerKeywords: headers,
      comments,
      history,
      starAnnotations: selectedFile?.starAnnotations?.points ?? [],
      astrometryAnnotations: latestSolvedJob?.result?.annotations ?? [],
    }),
    [
      selectedFile?.id,
      selectedFile?.starAnnotations?.points,
      sourceBuffer,
      pixels,
      rgbChannels,
      metadata,
      headers,
      comments,
      history,
      latestSolvedJob?.result?.annotations,
    ],
  );
  const fitsScientificAvailable = canUseScientificFitsExport(exportSource);

  const showQuality = checkSupportsQuality(currentOptions.format);
  const bitDepths = checkBitDepths(currentOptions.format);

  // Load selected file
  useEffect(() => {
    if (selectedFile) {
      loadFromPath(selectedFile.filepath, selectedFile.filename, selectedFile.fileSize);
    } else {
      resetFits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFileId]);

  // Process image for preview when pixels or options change
  useEffect(() => {
    if (pixels && dimensions) {
      processImage(
        pixels,
        dimensions.width,
        dimensions.height,
        currentOptions.stretch,
        currentOptions.colormap,
        currentOptions.blackPoint,
        currentOptions.whitePoint,
        currentOptions.gamma,
        currentOptions.outputBlack,
        currentOptions.outputWhite,
        currentOptions.brightness,
        currentOptions.contrast,
        currentOptions.mtfMidtone,
        currentOptions.curvePreset,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pixels,
    dimensions,
    currentOptions.stretch,
    currentOptions.colormap,
    currentOptions.blackPoint,
    currentOptions.whitePoint,
    currentOptions.gamma,
    currentOptions.outputBlack,
    currentOptions.outputWhite,
    currentOptions.brightness,
    currentOptions.contrast,
    currentOptions.mtfMidtone,
    currentOptions.curvePreset,
  ]);

  const estimatedSize = dimensions ? getEstimatedSize(dimensions.width, dimensions.height) : null;

  const handleConvert = useCallback(async () => {
    if (!rgbaData || !dimensions || !selectedFile) {
      Alert.alert(t("common.error"), t("viewer.noImageData"));
      return;
    }
    const detailed = await exportImageDetailed({
      rgbaData,
      width: dimensions.width,
      height: dimensions.height,
      filename: selectedFile.filename,
      format: currentOptions.format,
      quality: currentOptions.quality,
      bitDepth: currentOptions.bitDepth,
      fits: currentOptions.fits,
      tiff: currentOptions.tiff,
      renderOptions: {
        includeAnnotations: currentOptions.includeAnnotations,
        includeWatermark: currentOptions.includeWatermark,
        watermarkText: currentOptions.watermarkText,
      },
      source: exportSource,
    });
    if (detailed.path) {
      const fallbackMessage =
        detailed.diagnostics.fallbackApplied && detailed.diagnostics.fallbackReasonMessageKey
          ? `\n${t(detailed.diagnostics.fallbackReasonMessageKey)}`
          : "";
      Alert.alert(t("common.success"), `${t("viewer.exportSuccess")}${fallbackMessage}`);
    } else {
      Alert.alert(t("common.error"), t("viewer.exportFailed"));
    }
  }, [rgbaData, dimensions, selectedFile, exportImageDetailed, currentOptions, exportSource, t]);

  return (
    <View testID="e2e-screen-convert__index" className="flex-1 bg-background">
      <LoadingOverlay visible={isFitsLoading || isExporting} message={t("common.loading")} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: 24,
        }}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-4">
          <Button
            testID="e2e-action-convert__index-back"
            size="sm"
            variant="outline"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={16} color={mutedColor} />
          </Button>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{t("converter.title")}</Text>
          </View>
        </View>

        <Separator className="mb-4" />

        {/* Mode Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="primary">
          <Tabs.List>
            <Tabs.Indicator />
            <Tabs.Trigger value="single">
              <Ionicons
                name="image-outline"
                size={14}
                color={activeTab === "single" ? successColor : mutedColor}
              />
              <Tabs.Label>{t("converter.singleConvert")}</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="batch">
              <Ionicons
                name="layers-outline"
                size={14}
                color={activeTab === "batch" ? successColor : mutedColor}
              />
              <Tabs.Label>{t("converter.batchConvert")}</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.List>

          {/* Single Convert Tab */}
          <Tabs.Content value="single">
            <View className="gap-4 mt-4">
              {/* Source File Selection */}
              <Text className="text-xs font-semibold uppercase text-muted">
                {t("converter.sourceFormat")}
              </Text>
              {files.length === 0 ? (
                <Card variant="secondary">
                  <Card.Body className="items-center p-4">
                    <Ionicons name="document-outline" size={24} color={mutedColor} />
                    <Text className="text-xs text-muted mt-1">{t("common.noData")}</Text>
                  </Card.Body>
                </Card>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {files.map((f) => (
                      <PressableFeedback
                        key={f.id}
                        testID={
                          f.id === "fits-001"
                            ? "e2e-action-convert__index-select-file-fits-001"
                            : `e2e-action-convert__index-select-file-${f.id}`
                        }
                        onPress={() => setSelectedFileId(f.id)}
                      >
                        <Card
                          variant="secondary"
                          className={selectedFileId === f.id ? "border border-success" : ""}
                        >
                          <Card.Body className="p-2.5 min-w-[100px]">
                            <Text
                              className="text-[10px] font-semibold text-foreground"
                              numberOfLines={1}
                            >
                              {f.filename}
                            </Text>
                            <View className="flex-row items-center gap-1 mt-0.5">
                              {f.object && (
                                <Text className="text-[9px] text-muted" numberOfLines={1}>
                                  {f.object}
                                </Text>
                              )}
                              <Text className="text-[9px] text-muted">
                                {formatFileSize(f.fileSize)}
                              </Text>
                            </View>
                          </Card.Body>
                        </Card>
                      </PressableFeedback>
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Preview */}
              {rgbaData && dimensions && (
                <Card variant="secondary">
                  <Card.Body className="p-0">
                    <View className="h-48 rounded-t-lg overflow-hidden bg-black">
                      <FitsCanvas
                        rgbaData={rgbaData}
                        width={dimensions.width}
                        height={dimensions.height}
                        showGrid={false}
                        showCrosshair={false}
                        cursorX={-1}
                        cursorY={-1}
                        interactionEnabled={false}
                      />
                    </View>
                    <View className="flex-row items-center gap-2 px-3 py-2">
                      <Chip size="sm" variant="secondary">
                        <Chip.Label className="text-[9px]">
                          {dimensions.width}×{dimensions.height}
                        </Chip.Label>
                      </Chip>
                      {estimatedSize != null && (
                        <Chip size="sm" variant="secondary">
                          <Chip.Label className="text-[9px]">
                            ≈ {formatBytes(estimatedSize)}
                          </Chip.Label>
                        </Chip>
                      )}
                    </View>
                  </Card.Body>
                </Card>
              )}

              {/* Target Format Selection */}
              <Text className="text-xs font-semibold uppercase text-muted">
                {t("converter.targetFormat")}
              </Text>
              <FormatSelector
                selected={currentOptions.format}
                onSelect={(fmt: ExportFormat) => setFormat(fmt)}
              />

              <Separator />

              {/* Output Settings — Accordion */}
              <Accordion selectionMode="multiple" variant="surface" defaultValue={["output"]}>
                {/* Output Settings */}
                <Accordion.Item value="output">
                  <Accordion.Trigger>
                    <View className="flex-row items-center flex-1 gap-3">
                      <Ionicons name="settings-outline" size={16} color={mutedColor} />
                      <Text className="text-sm text-foreground">
                        {t("converter.outputSettings")}
                      </Text>
                    </View>
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <View className="gap-4 px-1">
                      {/* Quality */}
                      {showQuality && (
                        <View>
                          <Text className="mb-2 text-xs font-semibold text-muted">
                            {t("converter.quality")}: {currentOptions.quality}%
                          </Text>
                          <SimpleSlider
                            label={t("converter.quality")}
                            value={currentOptions.quality}
                            min={10}
                            max={100}
                            step={1}
                            onValueChange={setQuality}
                          />
                          <View className="flex-row gap-1.5 mt-2">
                            {[60, 75, 85, 95, 100].map((q) => (
                              <Chip
                                key={q}
                                size="sm"
                                variant={currentOptions.quality === q ? "primary" : "secondary"}
                                onPress={() => setQuality(q)}
                              >
                                <Chip.Label className="text-[9px]">{q}%</Chip.Label>
                              </Chip>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Bit Depth */}
                      {bitDepths.length > 1 && (
                        <View>
                          <Text className="mb-2 text-xs font-semibold text-muted">
                            {t("converter.bitDepth")}
                          </Text>
                          <View className="flex-row gap-2">
                            {bitDepths.map((d) => (
                              <Chip
                                key={d}
                                size="sm"
                                variant={currentOptions.bitDepth === d ? "primary" : "secondary"}
                                onPress={() => setBitDepth(d as 8 | 16 | 32)}
                              >
                                <Chip.Label className="text-[9px]">{d}-bit</Chip.Label>
                              </Chip>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* DPI */}
                      <View>
                        <Text className="mb-2 text-xs font-semibold text-muted">
                          {t("converter.dpi")}
                        </Text>
                        <View className="flex-row gap-2">
                          {DPI_OPTIONS.map((d) => (
                            <Chip
                              key={d}
                              size="sm"
                              variant={currentOptions.dpi === d ? "primary" : "secondary"}
                              onPress={() => setDpi(d)}
                            >
                              <Chip.Label className="text-[9px]">{d}</Chip.Label>
                            </Chip>
                          ))}
                        </View>
                      </View>

                      {currentOptions.format === "fits" && (
                        <View className="gap-3">
                          <View>
                            <Text className="mb-2 text-xs font-semibold text-muted">
                              {t("converter.fitsMode")}
                            </Text>
                            <View className="flex-row gap-2">
                              {FITS_MODE_PRESETS.map((mode) => (
                                <Chip
                                  key={mode}
                                  testID={`e2e-action-convert__index-fits-mode-${mode}`}
                                  size="sm"
                                  variant={
                                    (currentOptions.fits?.mode ??
                                      DEFAULT_FITS_TARGET_OPTIONS.mode) === mode
                                      ? "primary"
                                      : "secondary"
                                  }
                                  onPress={() => {
                                    if (mode === "scientific" && !fitsScientificAvailable) return;
                                    setOptions({
                                      fits: {
                                        ...DEFAULT_FITS_TARGET_OPTIONS,
                                        ...(currentOptions.fits ?? {}),
                                        mode,
                                      },
                                    });
                                  }}
                                >
                                  <Chip.Label className="text-[9px]">
                                    {mode === "scientific"
                                      ? t("converter.fitsModeScientific")
                                      : t("converter.fitsModeRendered")}
                                  </Chip.Label>
                                </Chip>
                              ))}
                            </View>
                            {!fitsScientificAvailable && (
                              <Text className="mt-1 text-[10px] text-muted">
                                {t("converter.fitsScientificUnavailable")}
                              </Text>
                            )}
                          </View>

                          <View>
                            <Text className="mb-2 text-xs font-semibold text-muted">
                              {t("converter.fitsCompression")}
                            </Text>
                            <View className="flex-row gap-2">
                              {FITS_COMPRESSION_PRESETS.map((compression) => (
                                <Chip
                                  key={compression}
                                  size="sm"
                                  variant={
                                    (currentOptions.fits?.compression ??
                                      DEFAULT_FITS_TARGET_OPTIONS.compression) === compression
                                      ? "primary"
                                      : "secondary"
                                  }
                                  onPress={() =>
                                    setOptions({
                                      fits: {
                                        ...DEFAULT_FITS_TARGET_OPTIONS,
                                        ...(currentOptions.fits ?? {}),
                                        compression,
                                      },
                                    })
                                  }
                                >
                                  <Chip.Label className="text-[9px] uppercase">
                                    {compression}
                                  </Chip.Label>
                                </Chip>
                              ))}
                            </View>
                          </View>

                          <View>
                            <Text className="mb-2 text-xs font-semibold text-muted">
                              {t("converter.bitpix")}
                            </Text>
                            <View className="flex-row flex-wrap gap-1.5">
                              {FITS_BITPIX_PRESETS.map((bitpix) => (
                                <Chip
                                  key={bitpix}
                                  size="sm"
                                  variant={
                                    (currentOptions.fits?.bitpix ??
                                      DEFAULT_FITS_TARGET_OPTIONS.bitpix) === bitpix
                                      ? "primary"
                                      : "secondary"
                                  }
                                  onPress={() =>
                                    setOptions({
                                      fits: {
                                        ...DEFAULT_FITS_TARGET_OPTIONS,
                                        ...(currentOptions.fits ?? {}),
                                        bitpix,
                                      },
                                    })
                                  }
                                >
                                  <Chip.Label className="text-[9px]">{bitpix}</Chip.Label>
                                </Chip>
                              ))}
                            </View>
                          </View>
                        </View>
                      )}

                      {currentOptions.format === "tiff" && (
                        <View className="gap-3">
                          <View>
                            <Text className="mb-2 text-xs font-semibold text-muted">
                              {t("converter.tiffCompression")}
                            </Text>
                            <View className="flex-row gap-2">
                              {TIFF_COMPRESSION_PRESETS.map((compression) => (
                                <Chip
                                  key={compression}
                                  size="sm"
                                  variant={
                                    (currentOptions.tiff?.compression ??
                                      DEFAULT_TIFF_TARGET_OPTIONS.compression) === compression
                                      ? "primary"
                                      : "secondary"
                                  }
                                  onPress={() =>
                                    setOptions({
                                      tiff: {
                                        ...DEFAULT_TIFF_TARGET_OPTIONS,
                                        ...(currentOptions.tiff ?? {}),
                                        compression,
                                      },
                                    })
                                  }
                                >
                                  <Chip.Label className="text-[9px] uppercase">
                                    {compression}
                                  </Chip.Label>
                                </Chip>
                              ))}
                            </View>
                          </View>

                          <View>
                            <Text className="mb-2 text-xs font-semibold text-muted">
                              {t("converter.multipage")}
                            </Text>
                            <View className="flex-row gap-2">
                              {(["preserve", "firstFrame"] as const).map((multipage) => (
                                <Chip
                                  key={multipage}
                                  size="sm"
                                  variant={
                                    (currentOptions.tiff?.multipage ??
                                      DEFAULT_TIFF_TARGET_OPTIONS.multipage) === multipage
                                      ? "primary"
                                      : "secondary"
                                  }
                                  onPress={() =>
                                    setOptions({
                                      tiff: {
                                        ...DEFAULT_TIFF_TARGET_OPTIONS,
                                        ...(currentOptions.tiff ?? {}),
                                        multipage,
                                      },
                                    })
                                  }
                                >
                                  <Chip.Label className="text-[9px]">
                                    {multipage === "preserve"
                                      ? t("converter.multipagePreserve")
                                      : t("converter.multipageFirstFrame")}
                                  </Chip.Label>
                                </Chip>
                              ))}
                            </View>
                          </View>
                        </View>
                      )}

                      <View>
                        <Text className="mb-2 text-xs font-semibold text-muted">
                          {t("converter.exportDecorations")}
                        </Text>
                        <View className="flex-row gap-2">
                          <Chip
                            testID="e2e-action-convert__index-toggle-annotations"
                            size="sm"
                            variant={currentOptions.includeAnnotations ? "primary" : "secondary"}
                            onPress={() =>
                              setOptions({ includeAnnotations: !currentOptions.includeAnnotations })
                            }
                          >
                            <Chip.Label className="text-[9px]">
                              {t("converter.includeAnnotations")}
                            </Chip.Label>
                          </Chip>
                          <Chip
                            testID="e2e-action-convert__index-toggle-watermark"
                            size="sm"
                            variant={currentOptions.includeWatermark ? "primary" : "secondary"}
                            onPress={() =>
                              setOptions({ includeWatermark: !currentOptions.includeWatermark })
                            }
                          >
                            <Chip.Label className="text-[9px]">
                              {t("converter.includeWatermark")}
                            </Chip.Label>
                          </Chip>
                        </View>
                      </View>
                    </View>
                  </Accordion.Content>
                </Accordion.Item>

                {/* Image Processing */}
                <Accordion.Item value="processing">
                  <Accordion.Trigger>
                    <View className="flex-row items-center flex-1 gap-3">
                      <Ionicons name="color-wand-outline" size={16} color={mutedColor} />
                      <Text className="text-sm text-foreground">
                        {t("converter.imageProcessing")}
                      </Text>
                    </View>
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                  <Accordion.Content>
                    <View className="gap-4 px-1">
                      {/* Stretch */}
                      <View>
                        <Text className="mb-2 text-xs font-semibold text-muted">Stretch</Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {STRETCH_OPTIONS.map((s) => (
                            <Chip
                              key={s.key}
                              size="sm"
                              variant={currentOptions.stretch === s.key ? "primary" : "secondary"}
                              onPress={() => setOptions({ stretch: s.key })}
                            >
                              <Chip.Label className="text-[9px]">{s.label}</Chip.Label>
                            </Chip>
                          ))}
                        </View>
                      </View>

                      {/* Colormap */}
                      <View>
                        <Text className="mb-2 text-xs font-semibold text-muted">Colormap</Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {COLORMAP_OPTIONS.map((c) => (
                            <Chip
                              key={c.key}
                              size="sm"
                              variant={currentOptions.colormap === c.key ? "primary" : "secondary"}
                              onPress={() => setOptions({ colormap: c.key })}
                            >
                              <Chip.Label className="text-[9px]">{c.label}</Chip.Label>
                            </Chip>
                          ))}
                        </View>
                      </View>
                    </View>
                  </Accordion.Content>
                </Accordion.Item>
              </Accordion>

              <Separator />

              {/* Presets */}
              <Text className="text-xs font-semibold uppercase text-muted">
                {t("converter.presets")}
              </Text>
              <Card variant="secondary">
                <Card.Body className="p-3">
                  <View className="flex-row flex-wrap gap-2">
                    {allPresets.map((preset) => (
                      <PressableFeedback key={preset.id} onPress={() => applyPreset(preset.id)}>
                        <View className="rounded-lg bg-surface-secondary px-3 py-2">
                          <Text className="text-xs font-semibold text-foreground">
                            {preset.name}
                          </Text>
                          <Text className="text-[9px] text-muted">{preset.description}</Text>
                        </View>
                      </PressableFeedback>
                    ))}
                  </View>
                </Card.Body>
              </Card>

              {/* Convert Button */}
              <Button
                testID="e2e-action-convert__index-convert"
                variant="primary"
                className="mt-2"
                onPress={handleConvert}
                isDisabled={!selectedFile || !rgbaData || isExporting}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
                <Button.Label>{t("converter.convert")}</Button.Label>
              </Button>
            </View>
          </Tabs.Content>

          {/* Batch Convert Tab */}
          <Tabs.Content value="batch">
            <View className="mt-4">
              <BatchConvertContent />
            </View>
          </Tabs.Content>
        </Tabs>
      </ScrollView>
    </View>
  );
}
