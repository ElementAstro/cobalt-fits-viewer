import { Text, View } from "react-native";
import { Card, Chip } from "heroui-native";
import type { HistogramDiagnostics } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";

interface StatsLike {
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
  snr: number;
}

interface ImageDimensions {
  width: number;
  height: number;
  depth?: number;
  isDataCube?: boolean;
}

interface RegionSelection {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageInfoMetricsCardProps {
  stats?: StatsLike | null;
  regionStats?: StatsLike | null;
  imageDimensions?: ImageDimensions | null;
  regionSelection?: RegionSelection | null;
  histogramDiagnostics?: HistogramDiagnostics | null;
  bitpix?: number;
  currentHDU?: number;
  currentFrame?: number;
  totalFrames?: number;
}

function formatStatValue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e4 || (abs > 0 && abs < 1e-3)) return value.toExponential(2);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(3);
  return value.toFixed(5);
}

function formatClipPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.00%";
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

export function ImageInfoMetricsCard({
  stats,
  regionStats,
  imageDimensions,
  regionSelection,
  histogramDiagnostics,
  bitpix,
  currentHDU,
  currentFrame,
  totalFrames,
}: ImageInfoMetricsCardProps) {
  const { t } = useI18n();

  const geometryLabel = imageDimensions
    ? imageDimensions.isDataCube && imageDimensions.depth && imageDimensions.depth > 1
      ? `${imageDimensions.width}×${imageDimensions.height}×${imageDimensions.depth}`
      : `${imageDimensions.width}×${imageDimensions.height}`
    : null;

  const frameLabel =
    typeof totalFrames === "number" && totalFrames > 1 && typeof currentFrame === "number"
      ? `${t("viewer.frame")} ${currentFrame + 1}/${totalFrames}`
      : null;

  const hasMetrics = !!stats || !!regionStats || !!histogramDiagnostics;

  return (
    <Card variant="secondary">
      <Card.Body className="px-3 py-2 gap-1.5">
        <View className="flex-row flex-wrap gap-1 items-center">
          {geometryLabel && (
            <Chip size="sm" variant="secondary">
              <Chip.Label className="text-[8px]">{geometryLabel}</Chip.Label>
            </Chip>
          )}
          {typeof bitpix === "number" && (
            <Chip size="sm" variant="secondary">
              <Chip.Label className="text-[8px]">BITPIX {bitpix}</Chip.Label>
            </Chip>
          )}
          {typeof currentHDU === "number" && (
            <Chip size="sm" variant="secondary">
              <Chip.Label className="text-[8px]">
                {t("viewer.hdu")} {currentHDU + 1}
              </Chip.Label>
            </Chip>
          )}
          {frameLabel && (
            <Chip size="sm" variant="secondary">
              <Chip.Label className="text-[8px]">{frameLabel}</Chip.Label>
            </Chip>
          )}
          {histogramDiagnostics?.isApproximate && (
            <Chip size="sm" variant="secondary">
              <Chip.Label className="text-[8px]">~ {t("viewer.approximate")}</Chip.Label>
            </Chip>
          )}
        </View>

        {stats && (
          <View>
            <Text className="text-[9px] font-semibold text-foreground">
              {t("viewer.globalStats")}
            </Text>
            <Text className="text-[9px] text-muted">
              Min {formatStatValue(stats.min)} · Max {formatStatValue(stats.max)}
            </Text>
            <Text className="text-[9px] text-muted">
              Mean {formatStatValue(stats.mean)} · Median {formatStatValue(stats.median)} · Std{" "}
              {formatStatValue(stats.stddev)} · {t("viewer.snr")} {formatStatValue(stats.snr)}
            </Text>
          </View>
        )}

        {histogramDiagnostics && (
          <View>
            <Text className="text-[9px] font-semibold text-foreground">
              {t("viewer.histogram")}
            </Text>
            <Text className="text-[9px] text-muted">
              {t("viewer.histP1")} {formatStatValue(histogramDiagnostics.p1)} ·{" "}
              {t("viewer.histP50")} {formatStatValue(histogramDiagnostics.p50)} ·{" "}
              {t("viewer.histP99")} {formatStatValue(histogramDiagnostics.p99)} ·{" "}
              {t("viewer.histPeak")} {formatStatValue(histogramDiagnostics.peakValue)}
            </Text>
            <Text className="text-[9px] text-muted">
              {t("viewer.clipLow")} {formatClipPercent(histogramDiagnostics.clipLowPercent)} ·{" "}
              {t("viewer.clipHigh")} {formatClipPercent(histogramDiagnostics.clipHighPercent)}
              {histogramDiagnostics.isApproximate && ` · ~ ${t("viewer.approximate")}`}
            </Text>
          </View>
        )}

        {regionStats && (
          <View>
            <Text className="text-[9px] font-semibold text-foreground">
              {t("viewer.regionStats")}
              {regionSelection ? ` (${regionSelection.w}×${regionSelection.h})` : ""}
            </Text>
            <Text className="text-[9px] text-muted">
              Min {formatStatValue(regionStats.min)} · Max {formatStatValue(regionStats.max)}
            </Text>
            <Text className="text-[9px] text-muted">
              Mean {formatStatValue(regionStats.mean)} · Median{" "}
              {formatStatValue(regionStats.median)}
              {" · "}Std {formatStatValue(regionStats.stddev)} · {t("viewer.snr")}{" "}
              {formatStatValue(regionStats.snr)}
            </Text>
          </View>
        )}

        {!hasMetrics && <Text className="text-[9px] text-muted">—</Text>}
      </Card.Body>
    </Card>
  );
}
