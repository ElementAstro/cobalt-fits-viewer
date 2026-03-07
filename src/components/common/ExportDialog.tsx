import { View, Text } from "react-native";
import { Button, Chip, Dialog, Input, Separator, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { ExportFormat } from "../../lib/fits/types";
import { formatBytes } from "../../lib/utils/format";
import type { ExportActionOptions } from "../../lib/converter/exportActionOptions";
import { isTargetSizeAllowed } from "../../lib/converter/compressionPolicy";
import { useExportDialogState } from "../../hooks/export/useExportDialogState";
import { FitsExportOptions } from "./FitsExportOptions";
import { TiffExportOptions } from "./TiffExportOptions";
import { SimpleSlider } from "./SimpleSlider";

interface ExportDialogProps {
  visible: boolean;
  filename: string;
  format: ExportFormat;
  width?: number;
  height?: number;
  onFormatChange: (format: ExportFormat) => void;
  onExport: (quality: number, options?: ExportActionOptions) => void;
  onShare: (quality: number, options?: ExportActionOptions) => void;
  onSaveToDevice: (quality: number, options?: ExportActionOptions) => void;
  onCopyToClipboard?: () => void;
  onPrint?: () => void;
  onPrintToPdf?: () => void;
  fitsScientificAvailable?: boolean;
  onClose: () => void;
}

const FORMATS: ExportFormat[] = ["png", "jpeg", "webp", "tiff", "bmp", "fits"];
const QUALITY_PRESETS = [60, 75, 85, 95, 100];

export function ExportDialog({
  visible,
  filename,
  format,
  width,
  height,
  onFormatChange,
  onExport,
  onShare,
  onSaveToDevice,
  onCopyToClipboard,
  onPrint,
  onPrintToPdf,
  fitsScientificAvailable = true,
  onClose,
}: ExportDialogProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const {
    quality,
    fitsMode,
    fitsCompression,
    fitsBitpix,
    fitsColorLayout,
    fitsPreserveOriginalHeader,
    fitsPreserveWcs,
    tiffCompression,
    tiffMultipage,
    tiffBitDepth,
    tiffDpi,
    includeAnnotations,
    includeWatermark,
    watermarkText,
    outputMaxDim,
    compressionMode,
    targetFileSizeKB,
    webpLossless,
    customFilename,
    setQuality,
    setFitsMode,
    setFitsCompression,
    setFitsBitpix,
    setFitsColorLayout,
    setFitsPreserveOriginalHeader,
    setFitsPreserveWcs,
    setTiffCompression,
    setTiffMultipage,
    setTiffBitDepth,
    setTiffDpi,
    setIncludeAnnotations,
    setIncludeWatermark,
    setWatermarkText,
    setOutputMaxDim,
    setCompressionMode,
    setTargetFileSizeKB,
    setWebpLossless,
    setCustomFilename,
    showQuality,
    showFitsOptions,
    showTiffOptions,
    estimatedSize,
    buildActionOptions,
  } = useExportDialogState({
    filename,
    format,
    width,
    height,
    fitsScientificAvailable,
  });
  const targetSizeAllowed = isTargetSizeAllowed(format, webpLossless);

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-6 w-full max-w-sm rounded-2xl bg-background p-5">
          <View className="flex-row items-center justify-between mb-4">
            <Dialog.Title>{t("converter.title")}</Dialog.Title>
            <Dialog.Close />
          </View>

          <TextField className="mb-3">
            <Input
              testID="e2e-input-export-dialog-filename"
              value={customFilename}
              onChangeText={setCustomFilename}
              className="text-xs"
            />
          </TextField>

          <Separator className="mb-3" />

          <Text className="text-xs font-semibold text-muted mb-2">
            {t("converter.targetFormat")}
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {FORMATS.map((fmt) => (
              <Chip
                key={fmt}
                testID={`e2e-action-export-dialog-format-${fmt}`}
                size="sm"
                variant={format === fmt ? "primary" : "secondary"}
                onPress={() => onFormatChange(fmt)}
              >
                <Chip.Label className="text-[10px] uppercase">{fmt}</Chip.Label>
              </Chip>
            ))}
          </View>

          {showQuality && (
            <View className="mb-4">
              <Text className="text-xs font-semibold text-muted mb-2">
                {t("converter.quality")}: {quality}%
              </Text>
              <SimpleSlider
                label={t("converter.quality")}
                value={quality}
                min={10}
                max={100}
                step={1}
                onValueChange={setQuality}
              />
              <View className="flex-row gap-2 mt-2">
                {QUALITY_PRESETS.map((q) => (
                  <Chip
                    key={q}
                    size="sm"
                    variant={quality === q ? "primary" : "secondary"}
                    onPress={() => setQuality(q)}
                  >
                    <Chip.Label className="text-[9px]">{q}%</Chip.Label>
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {showFitsOptions && (
            <FitsExportOptions
              fitsMode={fitsMode}
              fitsCompression={fitsCompression}
              fitsBitpix={fitsBitpix}
              fitsColorLayout={fitsColorLayout}
              fitsPreserveOriginalHeader={fitsPreserveOriginalHeader}
              fitsPreserveWcs={fitsPreserveWcs}
              fitsScientificAvailable={fitsScientificAvailable}
              onFitsModeChange={setFitsMode}
              onFitsCompressionChange={setFitsCompression}
              onFitsBitpixChange={setFitsBitpix}
              onFitsColorLayoutChange={setFitsColorLayout}
              onFitsPreserveOriginalHeaderChange={setFitsPreserveOriginalHeader}
              onFitsPreserveWcsChange={setFitsPreserveWcs}
            />
          )}

          {showTiffOptions && (
            <TiffExportOptions
              tiffCompression={tiffCompression}
              tiffMultipage={tiffMultipage}
              tiffBitDepth={tiffBitDepth}
              tiffDpi={tiffDpi}
              onTiffCompressionChange={setTiffCompression}
              onTiffMultipageChange={setTiffMultipage}
              onTiffBitDepthChange={setTiffBitDepth}
              onTiffDpiChange={setTiffDpi}
            />
          )}

          {/* Output Size */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-muted mb-2">
              {t("converter.outputSize")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[undefined, 2048, 1920, 1080, 720].map((dim) => (
                <Chip
                  key={dim ?? "original"}
                  size="sm"
                  variant={outputMaxDim === dim ? "primary" : "secondary"}
                  onPress={() => setOutputMaxDim(dim)}
                >
                  <Chip.Label className="text-[9px]">
                    {dim ? `${dim}px` : t("converter.outputSizeOriginal")}
                  </Chip.Label>
                </Chip>
              ))}
            </View>
          </View>

          {/* Compression Mode (JPEG/WebP only) */}
          {(format === "jpeg" || format === "webp") && (
            <View className="mb-4">
              <Text className="text-xs font-semibold text-muted mb-2">
                {t("converter.compressionMode")}
              </Text>
              <View className="flex-row gap-2">
                <Chip
                  size="sm"
                  variant={compressionMode === "quality" ? "primary" : "secondary"}
                  onPress={() => setCompressionMode("quality")}
                >
                  <Chip.Label className="text-[9px]">{t("converter.qualityMode")}</Chip.Label>
                </Chip>
                <Chip
                  size="sm"
                  variant={compressionMode === "targetSize" ? "primary" : "secondary"}
                  className={targetSizeAllowed ? undefined : "opacity-50"}
                  onPress={targetSizeAllowed ? () => setCompressionMode("targetSize") : undefined}
                >
                  <Chip.Label className="text-[9px]">{t("converter.targetSizeMode")}</Chip.Label>
                </Chip>
              </View>
              {compressionMode === "targetSize" && targetSizeAllowed && (
                <View className="mt-2">
                  <TextField>
                    <Input
                      value={String(targetFileSizeKB)}
                      onChangeText={(v) => {
                        const num = parseInt(v, 10);
                        if (!isNaN(num) && num >= 50 && num <= 10000) setTargetFileSizeKB(num);
                      }}
                      keyboardType="numeric"
                      placeholder={t("converter.targetFileSizeKB")}
                      className="text-xs"
                    />
                  </TextField>
                </View>
              )}
            </View>
          )}

          {/* WebP Lossless */}
          {format === "webp" && (
            <View className="mb-4">
              <View className="flex-row gap-2">
                <Chip
                  size="sm"
                  variant={webpLossless ? "primary" : "secondary"}
                  onPress={() => setWebpLossless((prev) => !prev)}
                >
                  <Chip.Label className="text-[9px]">{t("converter.webpLossless")}</Chip.Label>
                </Chip>
              </View>
            </View>
          )}

          <View className="mb-4 gap-3">
            <View>
              <Text className="text-xs font-semibold text-muted mb-2">
                {t("converter.exportDecorations")}
              </Text>
              <View className="flex-row gap-2">
                <Chip
                  testID="e2e-action-export-dialog-toggle-annotations"
                  size="sm"
                  variant={includeAnnotations ? "primary" : "secondary"}
                  onPress={() => setIncludeAnnotations((prev) => !prev)}
                >
                  <Chip.Label className="text-[9px]">
                    {t("converter.includeAnnotations")}
                  </Chip.Label>
                </Chip>
                <Chip
                  testID="e2e-action-export-dialog-toggle-watermark"
                  size="sm"
                  variant={includeWatermark ? "primary" : "secondary"}
                  onPress={() => setIncludeWatermark((prev) => !prev)}
                >
                  <Chip.Label className="text-[9px]">{t("converter.includeWatermark")}</Chip.Label>
                </Chip>
              </View>

              {includeWatermark && (
                <View className="mt-3">
                  <Text className="text-xs font-semibold text-muted mb-2">
                    {t("converter.watermarkText")}
                  </Text>
                  <TextField>
                    <Input
                      testID="e2e-input-export-dialog-watermark-text"
                      value={watermarkText}
                      onChangeText={setWatermarkText}
                      placeholder={t("converter.watermarkTextPlaceholder")}
                      className="text-xs"
                    />
                  </TextField>
                </View>
              )}
            </View>
          </View>

          {estimatedSize != null && (
            <Text className="text-[10px] text-muted mb-3">≈ {formatBytes(estimatedSize)}</Text>
          )}

          <View className="gap-2">
            <Button
              testID="e2e-action-export-dialog-export"
              variant="primary"
              onPress={() => onExport(quality, buildActionOptions())}
            >
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Button.Label>{t("converter.convert")}</Button.Label>
            </Button>
            <Button variant="outline" onPress={() => onSaveToDevice(quality, buildActionOptions())}>
              <Ionicons name="phone-portrait-outline" size={16} color={mutedColor} />
              <Button.Label>{t("common.save")}</Button.Label>
            </Button>
            <Button variant="outline" onPress={() => onShare(quality, buildActionOptions())}>
              <Ionicons name="share-outline" size={16} color={mutedColor} />
              <Button.Label>{t("common.share")}</Button.Label>
            </Button>
            {onCopyToClipboard && (
              <Button variant="outline" onPress={onCopyToClipboard}>
                <Ionicons name="copy-outline" size={16} color={mutedColor} />
                <Button.Label>{t("common.copy")}</Button.Label>
              </Button>
            )}
            {onPrint && (
              <Button variant="outline" onPress={onPrint}>
                <Ionicons name="print-outline" size={16} color={mutedColor} />
                <Button.Label>{t("viewer.print")}</Button.Label>
              </Button>
            )}
            {onPrintToPdf && (
              <Button variant="outline" onPress={onPrintToPdf}>
                <Ionicons name="document-outline" size={16} color={mutedColor} />
                <Button.Label>{t("viewer.printToPdf")}</Button.Label>
              </Button>
            )}
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
