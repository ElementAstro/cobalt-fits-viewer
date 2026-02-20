import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { Button, Chip, Dialog, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import {
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_TIFF_TARGET_OPTIONS,
  type ExportFormat,
  type FitsCompression,
  type FitsExportMode,
  type FitsTargetOptions,
  type TiffCompression,
  type TiffMultipageMode,
  type TiffTargetOptions,
} from "../../lib/fits/types";
import { supportsQuality } from "../../lib/converter/convertPresets";
import { estimateFileSize } from "../../lib/converter/formatConverter";
import { formatBytes } from "../../lib/utils/format";
import type { ExportRenderOptions } from "../../lib/converter/exportDecorations";

export interface ExportDialogActionOptions {
  fits?: Partial<FitsTargetOptions>;
  tiff?: Partial<TiffTargetOptions>;
  render?: ExportRenderOptions;
}

interface ExportDialogProps {
  visible: boolean;
  filename: string;
  format: ExportFormat;
  width?: number;
  height?: number;
  onFormatChange: (format: ExportFormat) => void;
  onExport: (quality: number, options?: ExportDialogActionOptions) => void;
  onShare: (quality: number, options?: ExportDialogActionOptions) => void;
  onSaveToDevice: (quality: number, options?: ExportDialogActionOptions) => void;
  onPrint?: () => void;
  onPrintToPdf?: () => void;
  fitsScientificAvailable?: boolean;
  onClose: () => void;
}

const FORMATS: ExportFormat[] = ["png", "jpeg", "webp", "tiff", "bmp", "fits"];
const QUALITY_PRESETS = [60, 75, 85, 95, 100];
const FITS_BITPIX_PRESETS: Array<FitsTargetOptions["bitpix"]> = [8, 16, 32, -32, -64];
const TIFF_COMPRESSION_PRESETS: TiffCompression[] = ["lzw", "deflate", "none"];
const TIFF_COMPRESSION_LABEL_KEYS: Record<TiffCompression, string> = {
  lzw: "converter.tiffCompressionLzw",
  deflate: "converter.tiffCompressionDeflate",
  none: "converter.tiffCompressionNone",
};

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
  onPrint,
  onPrintToPdf,
  fitsScientificAvailable = true,
  onClose,
}: ExportDialogProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const [quality, setQuality] = useState(85);
  const [fitsMode, setFitsMode] = useState<FitsExportMode>(DEFAULT_FITS_TARGET_OPTIONS.mode);
  const [fitsCompression, setFitsCompression] = useState<FitsCompression>(
    DEFAULT_FITS_TARGET_OPTIONS.compression,
  );
  const [fitsBitpix, setFitsBitpix] = useState<FitsTargetOptions["bitpix"]>(
    DEFAULT_FITS_TARGET_OPTIONS.bitpix,
  );
  const [tiffCompression, setTiffCompression] = useState<TiffCompression>(
    DEFAULT_TIFF_TARGET_OPTIONS.compression,
  );
  const [tiffMultipage, setTiffMultipage] = useState<TiffMultipageMode>(
    DEFAULT_TIFF_TARGET_OPTIONS.multipage,
  );
  const [includeAnnotations, setIncludeAnnotations] = useState(false);
  const [includeWatermark, setIncludeWatermark] = useState(false);

  const showQuality = supportsQuality(format);
  const showFitsOptions = format === "fits";
  const showTiffOptions = format === "tiff";

  useEffect(() => {
    if (format === "jpeg") setQuality(85);
    else if (format === "webp") setQuality(80);
    else setQuality(100);
  }, [format]);

  useEffect(() => {
    if (!fitsScientificAvailable && fitsMode === "scientific") {
      setFitsMode("rendered");
    }
  }, [fitsScientificAvailable, fitsMode]);

  const fitsOptions: Partial<FitsTargetOptions> | undefined = showFitsOptions
    ? {
        mode: fitsMode,
        compression: fitsCompression,
        bitpix: fitsBitpix,
        colorLayout: DEFAULT_FITS_TARGET_OPTIONS.colorLayout,
      }
    : undefined;
  const tiffOptions: Partial<TiffTargetOptions> | undefined = showTiffOptions
    ? {
        compression: tiffCompression,
        multipage: tiffMultipage,
      }
    : undefined;
  const renderOptions: ExportRenderOptions | undefined =
    includeAnnotations || includeWatermark
      ? {
          includeAnnotations,
          includeWatermark,
        }
      : undefined;

  const estimatedSize =
    width && height
      ? estimateFileSize(width, height, {
          format,
          quality,
          bitDepth: 8,
          dpi: 72,
          tiff: {
            ...DEFAULT_TIFF_TARGET_OPTIONS,
            ...(tiffOptions ?? {}),
          },
          fits: {
            ...DEFAULT_FITS_TARGET_OPTIONS,
            ...(fitsOptions ?? {}),
          },
          stretch: "linear",
          colormap: "grayscale",
          blackPoint: 0,
          whitePoint: 1,
          gamma: 1,
          outputBlack: 0,
          outputWhite: 1,
          includeAnnotations: false,
          includeWatermark: false,
        })
      : null;

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-6 w-full max-w-sm rounded-2xl bg-background p-5">
          <View className="flex-row items-center justify-between mb-4">
            <Dialog.Title>{t("converter.title")}</Dialog.Title>
            <Dialog.Close />
          </View>

          <Text className="text-xs text-muted mb-3" numberOfLines={1}>
            {filename}
          </Text>

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
              <View className="flex-row gap-2">
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
            <View className="mb-4 gap-3">
              <View>
                <Text className="text-xs font-semibold text-muted mb-2">
                  {t("converter.fitsMode")}
                </Text>
                <View className="flex-row gap-2">
                  <Chip
                    size="sm"
                    variant={fitsMode === "scientific" ? "primary" : "secondary"}
                    onPress={() => fitsScientificAvailable && setFitsMode("scientific")}
                  >
                    <Chip.Label className="text-[9px]">
                      {t("converter.fitsModeScientific")}
                    </Chip.Label>
                  </Chip>
                  <Chip
                    size="sm"
                    variant={fitsMode === "rendered" ? "primary" : "secondary"}
                    onPress={() => setFitsMode("rendered")}
                  >
                    <Chip.Label className="text-[9px]">
                      {t("converter.fitsModeRendered")}
                    </Chip.Label>
                  </Chip>
                </View>
                {!fitsScientificAvailable && (
                  <Text
                    testID="e2e-text-export-dialog-fits-unavailable"
                    className="text-[10px] text-muted mt-1"
                  >
                    {t("converter.fitsScientificUnavailable")}
                  </Text>
                )}
              </View>

              <View>
                <Text className="text-xs font-semibold text-muted mb-2">
                  {t("converter.fitsCompression")}
                </Text>
                <View className="flex-row gap-2">
                  {(["none", "gzip"] as const).map((comp) => (
                    <Chip
                      key={comp}
                      size="sm"
                      variant={fitsCompression === comp ? "primary" : "secondary"}
                      onPress={() => setFitsCompression(comp)}
                    >
                      <Chip.Label className="text-[9px] uppercase">{comp}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-xs font-semibold text-muted mb-2">
                  {t("converter.bitpix")}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {FITS_BITPIX_PRESETS.map((bp) => (
                    <Chip
                      key={bp}
                      size="sm"
                      variant={fitsBitpix === bp ? "primary" : "secondary"}
                      onPress={() => setFitsBitpix(bp)}
                    >
                      <Chip.Label className="text-[9px]">{bp}</Chip.Label>
                    </Chip>
                  ))}
                </View>
              </View>
            </View>
          )}

          {showTiffOptions && (
            <View className="mb-4 gap-3">
              <View>
                <Text className="text-xs font-semibold text-muted mb-2">
                  {t("converter.tiffCompression")}
                </Text>
                <View className="flex-row gap-2">
                  {TIFF_COMPRESSION_PRESETS.map((comp) => (
                    <Chip
                      key={comp}
                      size="sm"
                      variant={tiffCompression === comp ? "primary" : "secondary"}
                      onPress={() => setTiffCompression(comp)}
                    >
                      <Chip.Label className="text-[9px] uppercase">
                        {t(TIFF_COMPRESSION_LABEL_KEYS[comp])}
                      </Chip.Label>
                    </Chip>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-xs font-semibold text-muted mb-2">
                  {t("converter.multipage")}
                </Text>
                <View className="flex-row gap-2">
                  {(["preserve", "firstFrame"] as const).map((mode) => (
                    <Chip
                      key={mode}
                      size="sm"
                      variant={tiffMultipage === mode ? "primary" : "secondary"}
                      onPress={() => setTiffMultipage(mode)}
                    >
                      <Chip.Label className="text-[9px]">
                        {mode === "preserve"
                          ? t("converter.multipagePreserve")
                          : t("converter.multipageFirstFrame")}
                      </Chip.Label>
                    </Chip>
                  ))}
                </View>
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
            </View>
          </View>

          {estimatedSize != null && (
            <Text className="text-[10px] text-muted mb-3">≈ {formatBytes(estimatedSize)}</Text>
          )}

          <View className="gap-2">
            <Button
              testID="e2e-action-export-dialog-export"
              variant="primary"
              onPress={() =>
                onExport(quality, { fits: fitsOptions, tiff: tiffOptions, render: renderOptions })
              }
            >
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Button.Label>{t("converter.convert")}</Button.Label>
            </Button>
            <Button
              variant="outline"
              onPress={() =>
                onSaveToDevice(quality, {
                  fits: fitsOptions,
                  tiff: tiffOptions,
                  render: renderOptions,
                })
              }
            >
              <Ionicons name="phone-portrait-outline" size={16} color={mutedColor} />
              <Button.Label>{t("common.save")}</Button.Label>
            </Button>
            <Button
              variant="outline"
              onPress={() =>
                onShare(quality, { fits: fitsOptions, tiff: tiffOptions, render: renderOptions })
              }
            >
              <Ionicons name="share-outline" size={16} color={mutedColor} />
              <Button.Label>{t("common.share")}</Button.Label>
            </Button>
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
