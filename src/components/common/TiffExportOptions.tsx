import { View, Text } from "react-native";
import { Chip } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { TiffCompression, TiffMultipageMode } from "../../lib/fits/types";

const TIFF_COMPRESSION_PRESETS: TiffCompression[] = ["lzw", "deflate", "none"];
const TIFF_COMPRESSION_LABEL_KEYS: Record<TiffCompression, string> = {
  lzw: "converter.tiffCompressionLzw",
  deflate: "converter.tiffCompressionDeflate",
  none: "converter.tiffCompressionNone",
};

interface TiffExportOptionsProps {
  tiffCompression: TiffCompression;
  tiffMultipage: TiffMultipageMode;
  onTiffCompressionChange: (comp: TiffCompression) => void;
  onTiffMultipageChange: (mode: TiffMultipageMode) => void;
}

export function TiffExportOptions({
  tiffCompression,
  tiffMultipage,
  onTiffCompressionChange,
  onTiffMultipageChange,
}: TiffExportOptionsProps) {
  const { t } = useI18n();

  return (
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
              onPress={() => onTiffCompressionChange(comp)}
            >
              <Chip.Label className="text-[9px] uppercase">
                {t(TIFF_COMPRESSION_LABEL_KEYS[comp])}
              </Chip.Label>
            </Chip>
          ))}
        </View>
      </View>

      <View>
        <Text className="text-xs font-semibold text-muted mb-2">{t("converter.multipage")}</Text>
        <View className="flex-row gap-2">
          {(["preserve", "firstFrame"] as const).map((mode) => (
            <Chip
              key={mode}
              size="sm"
              variant={tiffMultipage === mode ? "primary" : "secondary"}
              onPress={() => onTiffMultipageChange(mode)}
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
  );
}
