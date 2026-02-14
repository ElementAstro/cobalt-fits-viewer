import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { ExportFormat } from "../../lib/fits/types";
import { supportsQuality } from "../../lib/converter/convertPresets";
import { estimateFileSize } from "../../lib/converter/formatConverter";

interface ExportDialogProps {
  visible: boolean;
  filename: string;
  format: ExportFormat;
  width?: number;
  height?: number;
  onFormatChange: (format: ExportFormat) => void;
  onExport: (quality: number) => void;
  onShare: (quality: number) => void;
  onSaveToDevice: (quality: number) => void;
  onPrint?: () => void;
  onPrintToPdf?: () => void;
  onClose: () => void;
}

const FORMATS: ExportFormat[] = ["png", "jpeg", "webp"];
const QUALITY_PRESETS = [60, 75, 85, 95, 100];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  onClose,
}: ExportDialogProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const [quality, setQuality] = useState(85);

  const showQuality = supportsQuality(format);

  useEffect(() => {
    if (format === "jpeg") setQuality(85);
    else if (format === "webp") setQuality(80);
    else setQuality(100);
  }, [format]);

  const estimatedSize =
    width && height
      ? estimateFileSize(width, height, {
          format,
          quality,
          bitDepth: 8,
          dpi: 72,
          stretch: "linear",
          colormap: "grayscale",
          blackPoint: 0,
          whitePoint: 1,
          gamma: 1,
          includeAnnotations: false,
          includeWatermark: false,
        })
      : null;

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/60">
      <View className="mx-6 w-full max-w-sm rounded-2xl bg-background p-5">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-base font-bold text-foreground">{t("converter.title")}</Text>
          <Button size="sm" variant="outline" onPress={onClose}>
            <Ionicons name="close" size={16} color={mutedColor} />
          </Button>
        </View>

        <Text className="text-xs text-muted mb-3" numberOfLines={1}>
          {filename}
        </Text>

        <Separator className="mb-3" />

        <Text className="text-xs font-semibold text-muted mb-2">{t("converter.targetFormat")}</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {FORMATS.map((fmt) => (
            <Chip
              key={fmt}
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
                <TouchableOpacity key={q} onPress={() => setQuality(q)}>
                  <Chip size="sm" variant={quality === q ? "primary" : "secondary"}>
                    <Chip.Label className="text-[9px]">{q}%</Chip.Label>
                  </Chip>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {estimatedSize != null && (
          <Text className="text-[10px] text-muted mb-3">≈ {formatBytes(estimatedSize)}</Text>
        )}

        <View className="gap-2">
          <Button variant="primary" onPress={() => onExport(quality)}>
            <Ionicons name="download-outline" size={16} color="#fff" />
            <Button.Label>{t("converter.convert")}</Button.Label>
          </Button>
          <Button variant="outline" onPress={() => onSaveToDevice(quality)}>
            <Ionicons name="phone-portrait-outline" size={16} color={mutedColor} />
            <Button.Label>{t("common.save")}</Button.Label>
          </Button>
          <Button variant="outline" onPress={() => onShare(quality)}>
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
      </View>
    </View>
  );
}
