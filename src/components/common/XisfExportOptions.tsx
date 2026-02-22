import { View, Text } from "react-native";
import { Chip } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { XisfCompression } from "../../lib/fits/types";

const XISF_COMPRESSION_PRESETS: XisfCompression[] = ["none", "zlib", "lz4"];

interface XisfExportOptionsProps {
  xisfCompression: XisfCompression;
  onXisfCompressionChange: (comp: XisfCompression) => void;
}

export function XisfExportOptions({
  xisfCompression,
  onXisfCompressionChange,
}: XisfExportOptionsProps) {
  const { t } = useI18n();

  return (
    <View className="mb-4 gap-3">
      <Text className="text-xs font-semibold text-muted mb-2">
        {t("converter.xisfCompression")}
      </Text>
      <View className="flex-row gap-2">
        {XISF_COMPRESSION_PRESETS.map((comp) => (
          <Chip
            key={comp}
            size="sm"
            variant={xisfCompression === comp ? "primary" : "secondary"}
            onPress={() => onXisfCompressionChange(comp)}
          >
            <Chip.Label className="text-[9px] uppercase">{comp}</Chip.Label>
          </Chip>
        ))}
      </View>
    </View>
  );
}
