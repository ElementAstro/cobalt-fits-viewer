import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { HistogramLevels } from "./HistogramLevels";
import { ViewerControls } from "./ViewerControls";
import { AstrometryResultView } from "../astrometry/AstrometryResultView";
import type {
  StretchType,
  ColormapType,
  FitsMetadata,
  ViewerCurvePreset,
} from "../../lib/fits/types";
import type { AstrometryJob } from "../../lib/astrometry/types";

type HistogramMode = "linear" | "log" | "cdf";

interface HistogramData {
  counts: number[];
  edges: number[];
}

interface ViewerControlPanelProps {
  file: FitsMetadata;

  // Histogram
  histogram: HistogramData | null;
  regionHistogram: HistogramData | null;
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
  onExportWCS?: () => void;
  onNavigateToAstrometryResult?: (jobId: string) => void;

  // Layout
  showControls: boolean;
}

export function ViewerControlPanel({
  file,
  histogram,
  regionHistogram,
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
  onExportWCS,
  onNavigateToAstrometryResult,
  showControls,
}: ViewerControlPanelProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  return (
    <>
      {/* File Info Chips */}
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

      {/* Histogram Levels */}
      {histogram && showControls && (
        <View className="px-3 py-2">
          <HistogramLevels
            counts={histogram.counts}
            edges={histogram.edges}
            regionCounts={regionHistogram?.counts}
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
      )}

      {/* Viewer Controls */}
      {showControls && (
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
      )}

      {/* Astrometry Result Panel */}
      {showAstrometryResult && latestSolvedJob?.result && (
        <View>
          <View
            className="flex-row items-center justify-between px-3 py-1.5"
            style={{ borderBottomWidth: 0.5, borderBottomColor: mutedColor + "30" }}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="locate-outline" size={12} color="#22c55e" />
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
          <ScrollView className="max-h-52 px-3 py-2" nestedScrollEnabled>
            <AstrometryResultView
              result={latestSolvedJob.result}
              showAnnotations={showAnnotations}
              onToggleAnnotations={onToggleAnnotations}
              onExportWCS={onExportWCS}
            />
          </ScrollView>
        </View>
      )}
    </>
  );
}
