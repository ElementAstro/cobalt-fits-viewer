import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Button, Card, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useConverter } from "../../hooks/useConverter";
import { useExport } from "../../hooks/useExport";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageProcessing } from "../../hooks/useImageProcessing";
import { useFitsStore } from "../../stores/useFitsStore";
import { FormatSelector } from "../../components/converter/FormatSelector";
import { FitsCanvas } from "../../components/fits/FitsCanvas";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import type { ExportFormat, StretchType, ColormapType } from "../../lib/fits/types";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ConvertScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const files = useFitsStore((s) => s.files);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const selectedFile = files.find((f) => f.id === selectedFileId);

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
    pixels,
    dimensions,
    isLoading: isFitsLoading,
    loadFromPath,
    reset: resetFits,
  } = useFitsFile();
  const { rgbaData, processImage } = useImageProcessing();
  const { isExporting, exportImage } = useExport();

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
  ]);

  const estimatedSize = dimensions ? getEstimatedSize(dimensions.width, dimensions.height) : null;

  const handleConvert = useCallback(async () => {
    if (!rgbaData || !dimensions || !selectedFile) {
      Alert.alert(t("common.error"), t("viewer.noImageData"));
      return;
    }
    const path = await exportImage(
      rgbaData,
      dimensions.width,
      dimensions.height,
      selectedFile.filename,
      currentOptions.format,
      currentOptions.quality,
    );
    if (path) {
      Alert.alert(t("common.success"), t("viewer.exportSuccess"));
    } else {
      Alert.alert(t("common.error"), t("viewer.exportFailed"));
    }
  }, [rgbaData, dimensions, selectedFile, exportImage, currentOptions, t]);

  return (
    <View className="flex-1 bg-background">
      <LoadingOverlay visible={isFitsLoading || isExporting} message={t("common.loading")} />

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-14">
        <View className="flex-row items-center gap-3 mb-4">
          <Button size="sm" variant="outline" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={mutedColor} />
          </Button>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{t("converter.title")}</Text>
          </View>
        </View>

        <Separator className="mb-4" />

        {/* Mode Tabs */}
        <View className="flex-row gap-2 mb-4">
          <Chip size="sm" variant="primary">
            <Chip.Label className="text-[10px]">{t("converter.singleConvert")}</Chip.Label>
          </Chip>
          <TouchableOpacity onPress={() => router.push("/convert/batch")}>
            <Chip size="sm" variant="secondary">
              <Chip.Label className="text-[10px]">{t("converter.batchConvert")}</Chip.Label>
            </Chip>
          </TouchableOpacity>
        </View>

        {/* Source File Selection */}
        <Text className="mb-2 text-xs font-semibold uppercase text-muted">
          {t("converter.sourceFormat")}
        </Text>
        {files.length === 0 ? (
          <Card variant="secondary" className="mb-4">
            <Card.Body className="items-center p-4">
              <Ionicons name="document-outline" size={24} color={mutedColor} />
              <Text className="text-xs text-muted mt-1">{t("common.noData")}</Text>
            </Card.Body>
          </Card>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {files.map((f) => (
                <TouchableOpacity key={f.id} onPress={() => setSelectedFileId(f.id)}>
                  <Card
                    variant="secondary"
                    className={selectedFileId === f.id ? "border border-success" : ""}
                  >
                    <Card.Body className="p-2.5 min-w-[100px]">
                      <Text className="text-[10px] font-semibold text-foreground" numberOfLines={1}>
                        {f.filename}
                      </Text>
                      {f.object && (
                        <Text className="text-[9px] text-muted" numberOfLines={1}>
                          {f.object}
                        </Text>
                      )}
                    </Card.Body>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Preview */}
        {rgbaData && dimensions && (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("converter.preview")}
            </Text>
            <View className="h-48 mb-3 rounded-lg overflow-hidden bg-black">
              <FitsCanvas
                rgbaData={rgbaData}
                width={dimensions.width}
                height={dimensions.height}
                showGrid={false}
                showCrosshair={false}
                cursorX={-1}
                cursorY={-1}
              />
            </View>
            <View className="flex-row gap-2 mb-3">
              <Text className="text-[10px] text-muted">
                {dimensions.width}×{dimensions.height}
              </Text>
              {estimatedSize != null && (
                <Text className="text-[10px] text-muted">≈ {formatBytes(estimatedSize)}</Text>
              )}
            </View>
            <Separator className="mb-4" />
          </>
        )}

        {/* Target Format Selection */}
        <Text className="mb-2 text-xs font-semibold uppercase text-muted">
          {t("converter.targetFormat")}
        </Text>
        <FormatSelector
          selected={currentOptions.format}
          onSelect={(fmt: ExportFormat) => setFormat(fmt)}
        />

        <Separator className="my-4" />

        {/* Quality */}
        {showQuality && (
          <View className="mb-4">
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("converter.quality")}: {currentOptions.quality}%
            </Text>
            <View className="flex-row gap-2">
              {[60, 75, 85, 95, 100].map((q) => (
                <TouchableOpacity key={q} onPress={() => setQuality(q)}>
                  <Chip size="sm" variant={currentOptions.quality === q ? "primary" : "secondary"}>
                    <Chip.Label className="text-[9px]">{q}%</Chip.Label>
                  </Chip>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Bit Depth */}
        {bitDepths.length > 1 && (
          <View className="mb-4">
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("converter.bitDepth")}
            </Text>
            <View className="flex-row gap-2">
              {bitDepths.map((d) => (
                <TouchableOpacity key={d} onPress={() => setBitDepth(d as 8 | 16 | 32)}>
                  <Chip size="sm" variant={currentOptions.bitDepth === d ? "primary" : "secondary"}>
                    <Chip.Label className="text-[9px]">{d}-bit</Chip.Label>
                  </Chip>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Stretch */}
        <View className="mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">Stretch</Text>
          <View className="flex-row flex-wrap gap-2">
            {STRETCH_OPTIONS.map((s) => (
              <TouchableOpacity key={s.key} onPress={() => setOptions({ stretch: s.key })}>
                <Chip
                  size="sm"
                  variant={currentOptions.stretch === s.key ? "primary" : "secondary"}
                >
                  <Chip.Label className="text-[9px]">{s.label}</Chip.Label>
                </Chip>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Colormap */}
        <View className="mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">Colormap</Text>
          <View className="flex-row flex-wrap gap-2">
            {COLORMAP_OPTIONS.map((c) => (
              <TouchableOpacity key={c.key} onPress={() => setOptions({ colormap: c.key })}>
                <Chip
                  size="sm"
                  variant={currentOptions.colormap === c.key ? "primary" : "secondary"}
                >
                  <Chip.Label className="text-[9px]">{c.label}</Chip.Label>
                </Chip>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* DPI */}
        <View className="mb-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("converter.dpi")}
          </Text>
          <View className="flex-row gap-2">
            {DPI_OPTIONS.map((d) => (
              <TouchableOpacity key={d} onPress={() => setDpi(d)}>
                <Chip size="sm" variant={currentOptions.dpi === d ? "primary" : "secondary"}>
                  <Chip.Label className="text-[9px]">{d}</Chip.Label>
                </Chip>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Separator className="mb-4" />

        {/* Presets */}
        <Text className="mb-2 text-xs font-semibold uppercase text-muted">
          {t("converter.presets")}
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {allPresets.map((preset) => (
            <TouchableOpacity key={preset.id} onPress={() => applyPreset(preset.id)}>
              <Card variant="secondary">
                <Card.Body className="p-2.5">
                  <Text className="text-xs font-semibold text-foreground">{preset.name}</Text>
                  <Text className="text-[9px] text-muted">{preset.description}</Text>
                </Card.Body>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* Convert Button */}
        <Button
          variant="primary"
          className="mt-2"
          onPress={handleConvert}
          isDisabled={!selectedFile || !rgbaData || isExporting}
        >
          <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
          <Button.Label>{t("converter.convert")}</Button.Label>
        </Button>
      </ScrollView>
    </View>
  );
}
