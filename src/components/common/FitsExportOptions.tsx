import { View, Text } from "react-native";
import { Chip } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type {
  FitsColorLayout,
  FitsCompression,
  FitsExportMode,
  FitsTargetOptions,
} from "../../lib/fits/types";

const FITS_BITPIX_PRESETS: Array<FitsTargetOptions["bitpix"]> = [8, 16, 32, -32, -64];
const FITS_COLOR_LAYOUT_PRESETS: Array<{ key: FitsColorLayout; labelKey: string }> = [
  { key: "rgbCube3d", labelKey: "converter.fitsColorLayoutRgbCube3d" },
  { key: "mono2d", labelKey: "converter.fitsColorLayoutMono2d" },
];

interface FitsExportOptionsProps {
  fitsMode: FitsExportMode;
  fitsCompression: FitsCompression;
  fitsBitpix: FitsTargetOptions["bitpix"];
  fitsColorLayout: FitsColorLayout;
  fitsPreserveOriginalHeader: boolean;
  fitsPreserveWcs: boolean;
  fitsScientificAvailable: boolean;
  fitsPreserveWcsDisabled?: boolean;
  onFitsModeChange: (mode: FitsExportMode) => void;
  onFitsCompressionChange: (comp: FitsCompression) => void;
  onFitsBitpixChange: (bp: FitsTargetOptions["bitpix"]) => void;
  onFitsColorLayoutChange: (layout: FitsColorLayout) => void;
  onFitsPreserveOriginalHeaderChange: (value: boolean) => void;
  onFitsPreserveWcsChange: (value: boolean) => void;
}

export function FitsExportOptions({
  fitsMode,
  fitsCompression,
  fitsBitpix,
  fitsColorLayout,
  fitsPreserveOriginalHeader,
  fitsPreserveWcs,
  fitsScientificAvailable,
  onFitsModeChange,
  onFitsCompressionChange,
  onFitsBitpixChange,
  onFitsColorLayoutChange,
  onFitsPreserveOriginalHeaderChange,
  onFitsPreserveWcsChange,
  fitsPreserveWcsDisabled,
}: FitsExportOptionsProps) {
  const { t } = useI18n();

  return (
    <View className="mb-4 gap-3">
      <View>
        <Text className="text-xs font-semibold text-muted mb-2">{t("converter.fitsMode")}</Text>
        <View className="flex-row gap-2">
          <Chip
            size="sm"
            variant={fitsMode === "scientific" ? "primary" : "secondary"}
            onPress={() => fitsScientificAvailable && onFitsModeChange("scientific")}
          >
            <Chip.Label className="text-[9px]">{t("converter.fitsModeScientific")}</Chip.Label>
          </Chip>
          <Chip
            size="sm"
            variant={fitsMode === "rendered" ? "primary" : "secondary"}
            onPress={() => onFitsModeChange("rendered")}
          >
            <Chip.Label className="text-[9px]">{t("converter.fitsModeRendered")}</Chip.Label>
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
              onPress={() => onFitsCompressionChange(comp)}
            >
              <Chip.Label className="text-[9px] uppercase">{comp}</Chip.Label>
            </Chip>
          ))}
        </View>
      </View>

      <View>
        <Text className="text-xs font-semibold text-muted mb-2">{t("converter.bitpix")}</Text>
        <View className="flex-row flex-wrap gap-2">
          {FITS_BITPIX_PRESETS.map((bp) => (
            <Chip
              key={bp}
              size="sm"
              variant={fitsBitpix === bp ? "primary" : "secondary"}
              onPress={() => onFitsBitpixChange(bp)}
            >
              <Chip.Label className="text-[9px]">{bp}</Chip.Label>
            </Chip>
          ))}
        </View>
      </View>

      <View>
        <Text className="text-xs font-semibold text-muted mb-2">
          {t("converter.fitsColorLayout")}
        </Text>
        <View className="flex-row gap-2">
          {FITS_COLOR_LAYOUT_PRESETS.map((layout) => (
            <Chip
              key={layout.key}
              testID={`e2e-action-export-dialog-fits-color-layout-${layout.key}`}
              size="sm"
              variant={fitsColorLayout === layout.key ? "primary" : "secondary"}
              onPress={() => onFitsColorLayoutChange(layout.key)}
            >
              <Chip.Label className="text-[9px]">{t(layout.labelKey)}</Chip.Label>
            </Chip>
          ))}
        </View>
      </View>

      <View>
        <Text className="text-xs font-semibold text-muted mb-2">{t("converter.fitsPreserve")}</Text>
        <View className="flex-row gap-2">
          <Chip
            testID="e2e-action-export-dialog-fits-preserve-header"
            size="sm"
            variant={fitsPreserveOriginalHeader ? "primary" : "secondary"}
            onPress={() => onFitsPreserveOriginalHeaderChange(!fitsPreserveOriginalHeader)}
          >
            <Chip.Label className="text-[9px]">{t("converter.fitsPreserveHeader")}</Chip.Label>
          </Chip>
          <Chip
            testID="e2e-action-export-dialog-fits-preserve-wcs"
            size="sm"
            disabled={fitsPreserveWcsDisabled}
            variant={fitsPreserveWcs ? "primary" : "secondary"}
            onPress={() => onFitsPreserveWcsChange(!fitsPreserveWcs)}
          >
            <Chip.Label className="text-[9px]">{t("converter.fitsPreserveWcs")}</Chip.Label>
          </Chip>
        </View>
      </View>
    </View>
  );
}
