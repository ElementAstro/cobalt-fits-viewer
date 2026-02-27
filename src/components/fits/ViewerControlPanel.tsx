import { View, Text, TouchableOpacity } from "react-native";
import { Accordion, Chip } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { HistogramLevels } from "./HistogramLevels";
import { ImageInfoMetricsCard } from "./ImageInfoMetricsCard";
import { ViewerControls } from "./ViewerControls";
import { AstrometryResultView } from "../astrometry/AstrometryResultView";
import type {
  StretchType,
  ColormapType,
  FitsMetadata,
  ViewerCurvePreset,
  HistogramMode,
  HistogramData,
  HistogramDiagnostics,
  ChannelHistogramData,
} from "../../lib/fits/types";
import type { AstrometryJob, AstrometryAnnotationType } from "../../lib/astrometry/types";
import {
  AnnotationLayerControls,
  type AnnotationLayerVisibility,
} from "../astrometry/AnnotationLayerControls";

interface ViewerStats {
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
  snr: number;
}

interface ViewerImageDimensions {
  width: number;
  height: number;
  depth?: number;
  isDataCube?: boolean;
}

interface ViewerControlPanelProps {
  file: FitsMetadata;

  // Histogram
  histogram: HistogramData | null;
  rgbHistogram: ChannelHistogramData | null;
  regionHistogram: HistogramData | null;
  stats?: ViewerStats | null;
  regionStats?: ViewerStats | null;
  imageDimensions?: ViewerImageDimensions | null;
  regionSelection?: { x: number; y: number; w: number; h: number } | null;
  histogramDiagnostics?: HistogramDiagnostics | null;
  histogramInputRange?: { min: number; max: number } | null;
  blackPoint: number;
  whitePoint: number;
  midtone: number;
  outputBlack: number;
  outputWhite: number;
  histogramHeight?: number;
  defaultHistogramMode?: HistogramMode;
  onBlackPointChange: (value: number) => void;
  onWhitePointChange: (value: number) => void;
  onMidtoneChange: (value: number) => void;
  onOutputBlackChange: (value: number) => void;
  onOutputWhiteChange: (value: number) => void;
  onAutoStretch: () => void;
  onResetLevels: () => void;
  onToggleRegionSelect: () => void;
  isRegionSelectActive: boolean;

  // ViewerControls
  stretch: StretchType;
  colormap: ColormapType;
  brightness: number;
  contrast: number;
  mtfMidtone: number;
  curvePreset: ViewerCurvePreset;
  showGrid: boolean;
  showCrosshair: boolean;
  showPixelInfo: boolean;
  showMinimap: boolean;
  currentHDU: number;
  hduList: Array<{ index: number; type: string | null; hasData: boolean }>;
  currentFrame: number;
  totalFrames: number;
  isDataCube: boolean;
  onStretchChange: (stretch: StretchType) => void;
  onColormapChange: (colormap: ColormapType) => void;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onMtfMidtoneChange: (value: number) => void;
  onCurvePresetChange: (value: ViewerCurvePreset) => void;
  onToggleGrid: () => void;
  onToggleCrosshair: () => void;
  onTogglePixelInfo: () => void;
  onToggleMinimap: () => void;
  onHDUChange: (hdu: number) => void;
  onFrameChange: (frame: number) => void;
  onResetView: () => void;
  onSavePreset: () => void;
  onResetToSaved: () => void;
  onApplyQuickPreset?: (preset: "auto" | "linearReset" | "deepSky" | "moonPlanet") => void;

  // Astrometry
  showAstrometryResult: boolean;
  latestSolvedJob?: AstrometryJob;
  showAnnotations: boolean;
  onToggleAnnotations: () => void;
  annotationLayerVisibility?: AnnotationLayerVisibility;
  onToggleAnnotationType?: (type: AstrometryAnnotationType) => void;
  showCoordinateGrid?: boolean;
  onToggleCoordinateGrid?: () => void;
  showConstellations?: boolean;
  onToggleConstellations?: () => void;
  onExportWCS?: () => void;
  onNavigateToAstrometryResult?: (jobId: string) => void;

  // Layout
  showControls: boolean;
}

export function ViewerControlPanel({
  file,
  histogram,
  rgbHistogram,
  regionHistogram,
  stats,
  regionStats,
  imageDimensions,
  regionSelection,
  histogramDiagnostics,
  histogramInputRange,
  blackPoint,
  whitePoint,
  midtone,
  outputBlack,
  outputWhite,
  histogramHeight,
  defaultHistogramMode,
  onBlackPointChange,
  onWhitePointChange,
  onMidtoneChange,
  onOutputBlackChange,
  onOutputWhiteChange,
  onAutoStretch,
  onResetLevels,
  onToggleRegionSelect,
  isRegionSelectActive,
  stretch,
  colormap,
  brightness,
  contrast,
  mtfMidtone,
  curvePreset,
  showGrid,
  showCrosshair,
  showPixelInfo,
  showMinimap,
  currentHDU,
  hduList,
  currentFrame,
  totalFrames,
  isDataCube,
  onStretchChange,
  onColormapChange,
  onBrightnessChange,
  onContrastChange,
  onMtfMidtoneChange,
  onCurvePresetChange,
  onToggleGrid,
  onToggleCrosshair,
  onTogglePixelInfo,
  onToggleMinimap,
  onHDUChange,
  onFrameChange,
  onResetView,
  onSavePreset,
  onResetToSaved,
  onApplyQuickPreset,
  showAstrometryResult,
  latestSolvedJob,
  showAnnotations,
  onToggleAnnotations,
  annotationLayerVisibility,
  onToggleAnnotationType,
  showCoordinateGrid,
  onToggleCoordinateGrid,
  showConstellations,
  onToggleConstellations,
  onExportWCS,
  onNavigateToAstrometryResult,
  showControls,
}: ViewerControlPanelProps) {
  const { t } = useI18n();

  return (
    <Accordion selectionMode="multiple" variant="surface" defaultValue={["levels", "controls"]}>
      {/* File Info & Stats */}
      <Accordion.Item value="info">
        <Accordion.Trigger>
          <Text className="flex-1 text-[10px] font-semibold uppercase text-muted">
            {t("viewer.info")}
          </Text>
          <Accordion.Indicator />
        </Accordion.Trigger>
        <Accordion.Content>
          <View className="flex-row flex-wrap gap-1 px-3 py-2">
            {file.object && (
              <Chip size="sm" variant="primary">
                <Chip.Label className="text-[9px]">{file.object}</Chip.Label>
              </Chip>
            )}
            {file.filter && (
              <Chip size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">{file.filter}</Chip.Label>
              </Chip>
            )}
            {file.exptime != null && (
              <Chip size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">{file.exptime}s</Chip.Label>
              </Chip>
            )}
            {file.telescope && (
              <Chip size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">{file.telescope}</Chip.Label>
              </Chip>
            )}
            {file.instrument && (
              <Chip size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">{file.instrument}</Chip.Label>
              </Chip>
            )}
            {file.dateObs && (
              <Chip size="sm" variant="secondary">
                <Chip.Label className="text-[9px]">{file.dateObs}</Chip.Label>
              </Chip>
            )}
          </View>
          {showControls && (
            <View className="px-3 py-1">
              <ImageInfoMetricsCard
                stats={stats}
                regionStats={regionStats}
                imageDimensions={imageDimensions}
                regionSelection={regionSelection}
                histogramDiagnostics={histogramDiagnostics}
                bitpix={file.bitpix}
                currentHDU={currentHDU}
                currentFrame={currentFrame}
                totalFrames={totalFrames}
              />
            </View>
          )}
        </Accordion.Content>
      </Accordion.Item>

      {/* Histogram Levels */}
      {histogram && showControls && (
        <Accordion.Item value="levels">
          <Accordion.Trigger>
            <Text className="flex-1 text-[10px] font-semibold uppercase text-muted">
              {t("viewer.levels")}
            </Text>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>
            <View className="px-3 py-2">
              <HistogramLevels
                counts={histogram.counts}
                edges={histogram.edges}
                regionCounts={regionHistogram?.counts}
                rgbHistogram={rgbHistogram}
                diagnostics={histogramDiagnostics}
                inputRange={histogramInputRange}
                blackPoint={blackPoint}
                whitePoint={whitePoint}
                midtone={midtone}
                outputBlack={outputBlack}
                outputWhite={outputWhite}
                height={histogramHeight}
                initialMode={defaultHistogramMode}
                onBlackPointChange={onBlackPointChange}
                onWhitePointChange={onWhitePointChange}
                onMidtoneChange={onMidtoneChange}
                onOutputBlackChange={onOutputBlackChange}
                onOutputWhiteChange={onOutputWhiteChange}
                onAutoStretch={onAutoStretch}
                onResetLevels={onResetLevels}
                onToggleRegionSelect={onToggleRegionSelect}
                isRegionSelectActive={isRegionSelectActive}
              />
            </View>
          </Accordion.Content>
        </Accordion.Item>
      )}

      {/* Viewer Controls */}
      {showControls && (
        <Accordion.Item value="controls">
          <Accordion.Trigger>
            <Text className="flex-1 text-[10px] font-semibold uppercase text-muted">
              {t("viewer.view")}
            </Text>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>
            <ViewerControls
              stretch={stretch}
              colormap={colormap}
              brightness={brightness}
              contrast={contrast}
              mtfMidtone={mtfMidtone}
              curvePreset={curvePreset}
              showGrid={showGrid}
              showCrosshair={showCrosshair}
              showPixelInfo={showPixelInfo}
              showMinimap={showMinimap}
              currentHDU={currentHDU}
              hduList={hduList}
              currentFrame={currentFrame}
              totalFrames={totalFrames}
              isDataCube={isDataCube}
              onStretchChange={onStretchChange}
              onColormapChange={onColormapChange}
              onBrightnessChange={onBrightnessChange}
              onContrastChange={onContrastChange}
              onMtfMidtoneChange={onMtfMidtoneChange}
              onCurvePresetChange={onCurvePresetChange}
              onToggleGrid={onToggleGrid}
              onToggleCrosshair={onToggleCrosshair}
              onTogglePixelInfo={onTogglePixelInfo}
              onToggleMinimap={onToggleMinimap}
              onHDUChange={onHDUChange}
              onFrameChange={onFrameChange}
              onAutoStretch={onAutoStretch}
              onResetView={onResetView}
              onSavePreset={onSavePreset}
              onResetToSaved={onResetToSaved}
              onApplyQuickPreset={onApplyQuickPreset}
            />
          </Accordion.Content>
        </Accordion.Item>
      )}

      {/* Astrometry Result Panel */}
      {showAstrometryResult && latestSolvedJob?.result && (
        <Accordion.Item value="astrometry">
          <Accordion.Trigger>
            <View className="flex-row items-center flex-1 gap-2">
              <Ionicons name="locate-outline" size={12} color="#22c55e" />
              <Text className="flex-1 text-[10px] font-semibold uppercase text-muted">
                {t("viewer.astrometrySection")}
              </Text>
            </View>
            <Accordion.Indicator />
          </Accordion.Trigger>
          <Accordion.Content>
            <View className="flex-row items-center justify-between px-3 py-1.5 border-b-[0.5px] border-muted/20">
              <View className="flex-row items-center gap-2">
                <Text className="text-[10px] font-mono text-foreground">
                  {(latestSolvedJob.result.calibration.ra / 15).toFixed(3)}h{" "}
                  {latestSolvedJob.result.calibration.dec >= 0 ? "+" : ""}
                  {latestSolvedJob.result.calibration.dec.toFixed(3)}°
                </Text>
                <Text className="text-[9px] text-muted">
                  {latestSolvedJob.result.calibration.pixscale.toFixed(2)}″/px
                </Text>
                {latestSolvedJob.result.annotations.length > 0 && (
                  <Chip size="sm" variant="soft" color="success">
                    <Chip.Label className="text-[8px]">
                      {latestSolvedJob.result.annotations.length} obj
                    </Chip.Label>
                  </Chip>
                )}
              </View>
              {onNavigateToAstrometryResult && (
                <TouchableOpacity onPress={() => onNavigateToAstrometryResult(latestSolvedJob.id)}>
                  <Text className="text-[10px] text-accent font-medium">
                    {t("astrometry.viewResult")} →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {showAnnotations &&
              annotationLayerVisibility &&
              onToggleAnnotationType &&
              latestSolvedJob.result.annotations.length > 0 && (
                <AnnotationLayerControls
                  annotations={latestSolvedJob.result.annotations}
                  visibility={annotationLayerVisibility}
                  onToggleType={onToggleAnnotationType}
                  showCoordinateGrid={showCoordinateGrid}
                  onToggleCoordinateGrid={onToggleCoordinateGrid}
                  showConstellations={showConstellations}
                  onToggleConstellations={onToggleConstellations}
                />
              )}
            <View className="px-3 py-2">
              <AstrometryResultView
                result={latestSolvedJob.result}
                showAnnotations={showAnnotations}
                onToggleAnnotations={onToggleAnnotations}
                onExportWCS={onExportWCS}
              />
            </View>
          </Accordion.Content>
        </Accordion.Item>
      )}
    </Accordion>
  );
}
