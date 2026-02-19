import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Separator, Switch } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { useSettingsPicker } from "../../hooks/useSettingsPicker";
import type { StretchType, ColormapType } from "../../lib/fits/types";

const STRETCHES: StretchType[] = ["linear", "log", "sqrt", "asinh", "zscale"];
const COLORMAPS: ColormapType[] = ["grayscale", "heat", "cool", "viridis", "plasma", "inferno"];
const HISTOGRAM_MODE_VALUES = ["linear", "log", "cdf"] as const;
const HISTOGRAM_HEIGHT_OPTIONS = [
  { label: "80px", value: 80 },
  { label: "100px", value: 100 },
  { label: "120px", value: 120 },
  { label: "150px", value: 150 },
  { label: "200px", value: 200 },
];
const PIXEL_DECIMAL_OPTIONS = [
  { label: "0", value: 0 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "6", value: 6 },
];
const COLOR_OPTIONS = [
  { label: "#64c8ff", value: "#64c8ff" },
  { label: "#4ade80", value: "#4ade80" },
  { label: "#f59e0b", value: "#f59e0b" },
  { label: "#f97316", value: "#f97316" },
  { label: "#ef4444", value: "#ef4444" },
  { label: "#ffffff", value: "#ffffff" },
];

export default function ViewerSettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  // Viewer defaults
  const defaultStretch = useSettingsStore((s) => s.defaultStretch);
  const defaultColormap = useSettingsStore((s) => s.defaultColormap);
  const setDefaultStretch = useSettingsStore((s) => s.setDefaultStretch);
  const setDefaultColormap = useSettingsStore((s) => s.setDefaultColormap);

  // Overlay defaults
  const defaultShowGrid = useSettingsStore((s) => s.defaultShowGrid);
  const defaultShowCrosshair = useSettingsStore((s) => s.defaultShowCrosshair);
  const defaultShowPixelInfo = useSettingsStore((s) => s.defaultShowPixelInfo);
  const defaultShowMinimap = useSettingsStore((s) => s.defaultShowMinimap);
  const setDefaultShowGrid = useSettingsStore((s) => s.setDefaultShowGrid);
  const setDefaultShowCrosshair = useSettingsStore((s) => s.setDefaultShowCrosshair);
  const setDefaultShowPixelInfo = useSettingsStore((s) => s.setDefaultShowPixelInfo);
  const setDefaultShowMinimap = useSettingsStore((s) => s.setDefaultShowMinimap);

  // Display params
  const defaultBlackPoint = useSettingsStore((s) => s.defaultBlackPoint);
  const defaultWhitePoint = useSettingsStore((s) => s.defaultWhitePoint);
  const defaultGamma = useSettingsStore((s) => s.defaultGamma);
  const setDefaultBlackPoint = useSettingsStore((s) => s.setDefaultBlackPoint);
  const setDefaultWhitePoint = useSettingsStore((s) => s.setDefaultWhitePoint);
  const setDefaultGamma = useSettingsStore((s) => s.setDefaultGamma);

  // Grid & Crosshair style
  const gridColor = useSettingsStore((s) => s.gridColor);
  const gridOpacity = useSettingsStore((s) => s.gridOpacity);
  const crosshairColor = useSettingsStore((s) => s.crosshairColor);
  const crosshairOpacity = useSettingsStore((s) => s.crosshairOpacity);
  const setGridColor = useSettingsStore((s) => s.setGridColor);
  const setGridOpacity = useSettingsStore((s) => s.setGridOpacity);
  const setCrosshairColor = useSettingsStore((s) => s.setCrosshairColor);
  const setCrosshairOpacity = useSettingsStore((s) => s.setCrosshairOpacity);

  // Canvas zoom
  const canvasMinScale = useSettingsStore((s) => s.canvasMinScale);
  const canvasMaxScale = useSettingsStore((s) => s.canvasMaxScale);
  const canvasDoubleTapScale = useSettingsStore((s) => s.canvasDoubleTapScale);
  const canvasPinchSensitivity = useSettingsStore((s) => s.canvasPinchSensitivity);
  const canvasPinchOverzoomFactor = useSettingsStore((s) => s.canvasPinchOverzoomFactor);
  const canvasPanRubberBandFactor = useSettingsStore((s) => s.canvasPanRubberBandFactor);
  const canvasWheelZoomSensitivity = useSettingsStore((s) => s.canvasWheelZoomSensitivity);
  const setCanvasMinScale = useSettingsStore((s) => s.setCanvasMinScale);
  const setCanvasMaxScale = useSettingsStore((s) => s.setCanvasMaxScale);
  const setCanvasDoubleTapScale = useSettingsStore((s) => s.setCanvasDoubleTapScale);
  const setCanvasPinchSensitivity = useSettingsStore((s) => s.setCanvasPinchSensitivity);
  const setCanvasPinchOverzoomFactor = useSettingsStore((s) => s.setCanvasPinchOverzoomFactor);
  const setCanvasPanRubberBandFactor = useSettingsStore((s) => s.setCanvasPanRubberBandFactor);
  const setCanvasWheelZoomSensitivity = useSettingsStore((s) => s.setCanvasWheelZoomSensitivity);

  // Histogram & Pixel info
  const defaultHistogramMode = useSettingsStore((s) => s.defaultHistogramMode);
  const histogramHeight = useSettingsStore((s) => s.histogramHeight);
  const pixelInfoDecimalPlaces = useSettingsStore((s) => s.pixelInfoDecimalPlaces);
  const setDefaultHistogramMode = useSettingsStore((s) => s.setDefaultHistogramMode);
  const setHistogramHeight = useSettingsStore((s) => s.setHistogramHeight);
  const setPixelInfoDecimalPlaces = useSettingsStore((s) => s.setPixelInfoDecimalPlaces);

  const getStretchLabel = (value: StretchType) =>
    t(
      value === "linear"
        ? "viewer.stretchLinear"
        : value === "log"
          ? "viewer.stretchLog"
          : value === "sqrt"
            ? "viewer.stretchSqrt"
            : value === "asinh"
              ? "viewer.stretchAsinh"
              : "viewer.stretchZscale",
    );

  const getColormapLabel = (value: ColormapType) =>
    t(
      value === "grayscale"
        ? "viewer.colormapGrayscale"
        : value === "heat"
          ? "viewer.colormapHeat"
          : value === "cool"
            ? "viewer.colormapCool"
            : value === "viridis"
              ? "viewer.colormapViridis"
              : value === "plasma"
                ? "viewer.colormapPlasma"
                : "viewer.colormapInferno",
    );

  const getHistogramModeLabel = (value: (typeof HISTOGRAM_MODE_VALUES)[number]) =>
    t(
      value === "linear"
        ? "settings.histogramModeLinear"
        : value === "log"
          ? "settings.histogramModeLog"
          : "settings.histogramModeCdf",
    );

  const stretchOptions = STRETCHES.map((value) => ({ label: getStretchLabel(value), value }));
  const colormapOptions = COLORMAPS.map((value) => ({ label: getColormapLabel(value), value }));
  const histogramModeOptions = HISTOGRAM_MODE_VALUES.map((value) => ({
    label: getHistogramModeLabel(value),
    value,
  }));

  return (
    <View testID="e2e-screen-settings__viewer" className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-4">
          <Ionicons name="arrow-back" size={24} color="#888" onPress={() => router.back()} />
          <Text className="text-xl font-bold text-foreground">
            {t("settings.categories.viewer")}
          </Text>
        </View>

        {/* Basic Defaults */}
        <SettingsSection title={t("settings.viewer")}>
          <SettingsRow
            testID="e2e-action-settings__viewer-open-stretch"
            icon="resize-outline"
            label={t("viewer.stretch")}
            value={getStretchLabel(defaultStretch)}
            onPress={() => openPicker("stretch")}
          />
          <Separator />
          <SettingsRow
            testID="e2e-action-settings__viewer-open-colormap"
            icon="color-palette-outline"
            label={t("viewer.colormap")}
            value={getColormapLabel(defaultColormap)}
            onPress={() => openPicker("colormap")}
          />
        </SettingsSection>

        {/* Overlay Defaults */}
        <SettingsSection title={t("settings.viewerOverlays")}>
          <SettingsRow
            icon="grid-outline"
            label={t("settings.defaultShowGrid")}
            rightElement={
              <Switch
                isSelected={defaultShowGrid}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setDefaultShowGrid(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="add-outline"
            label={t("settings.defaultShowCrosshair")}
            rightElement={
              <Switch
                isSelected={defaultShowCrosshair}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setDefaultShowCrosshair(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="information-circle-outline"
            label={t("settings.defaultShowPixelInfo")}
            rightElement={
              <Switch
                isSelected={defaultShowPixelInfo}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setDefaultShowPixelInfo(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="map-outline"
            label={t("settings.defaultShowMinimap")}
            rightElement={
              <Switch
                isSelected={defaultShowMinimap}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setDefaultShowMinimap(v);
                }}
              />
            }
          />
        </SettingsSection>

        {/* Display Params */}
        <SettingsSection title={t("settings.viewerDisplayParams")}>
          <SettingsRow
            icon="contrast-outline"
            label={t("settings.defaultBlackPoint")}
            value={defaultBlackPoint.toFixed(2)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultBlackPoint}
              min={0}
              max={0.5}
              step={0.01}
              onValueChange={setDefaultBlackPoint}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="sunny-outline"
            label={t("settings.defaultWhitePoint")}
            value={defaultWhitePoint.toFixed(2)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultWhitePoint}
              min={0.5}
              max={1}
              step={0.01}
              onValueChange={setDefaultWhitePoint}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="pulse-outline"
            label={t("settings.defaultGamma")}
            value={defaultGamma.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={defaultGamma}
              min={0.1}
              max={5.0}
              step={0.1}
              onValueChange={setDefaultGamma}
            />
          </View>
        </SettingsSection>

        {/* Grid & Crosshair Style */}
        <SettingsSection title={`${t("settings.gridStyle")} & ${t("settings.crosshairStyle")}`}>
          <SettingsRow
            icon="color-fill-outline"
            label={t("settings.gridColor")}
            value={gridColor}
            onPress={() => openPicker("gridColor")}
          />
          <Separator />
          <SettingsRow
            icon="options-outline"
            label={t("settings.gridOpacity")}
            value={gridOpacity.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={gridOpacity}
              min={0.1}
              max={1.0}
              step={0.1}
              onValueChange={setGridOpacity}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="color-fill-outline"
            label={t("settings.crosshairColor")}
            value={crosshairColor}
            onPress={() => openPicker("crosshairColor")}
          />
          <Separator />
          <SettingsRow
            icon="options-outline"
            label={t("settings.crosshairOpacity")}
            value={crosshairOpacity.toFixed(1)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={crosshairOpacity}
              min={0.1}
              max={1.0}
              step={0.1}
              onValueChange={setCrosshairOpacity}
            />
          </View>
        </SettingsSection>

        {/* Canvas Zoom */}
        <SettingsSection title={t("settings.canvasZoom")}>
          <SettingsRow
            icon="remove-circle-outline"
            label={t("settings.canvasMinScale")}
            value={`${canvasMinScale}x`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasMinScale}
              min={0.1}
              max={1.0}
              step={0.1}
              onValueChange={setCanvasMinScale}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="add-circle-outline"
            label={t("settings.canvasMaxScale")}
            value={`${canvasMaxScale}x`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasMaxScale}
              min={5}
              max={30}
              step={1}
              onValueChange={setCanvasMaxScale}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="hand-left-outline"
            label={t("settings.canvasDoubleTapScale")}
            value={`${canvasDoubleTapScale}x`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasDoubleTapScale}
              min={2}
              max={10}
              step={1}
              onValueChange={setCanvasDoubleTapScale}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="resize-outline"
            label={t("settings.canvasPinchSensitivity")}
            value={`${canvasPinchSensitivity.toFixed(2)}`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasPinchSensitivity}
              min={0.6}
              max={1.8}
              step={0.05}
              onValueChange={setCanvasPinchSensitivity}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="expand-outline"
            label={t("settings.canvasPinchOverzoom")}
            value={`+${Math.round((canvasPinchOverzoomFactor - 1) * 100)}%`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasPinchOverzoomFactor}
              min={1}
              max={1.6}
              step={0.05}
              onValueChange={setCanvasPinchOverzoomFactor}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="move-outline"
            label={t("settings.canvasPanElasticity")}
            value={`${Math.round(canvasPanRubberBandFactor * 100)}%`}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasPanRubberBandFactor}
              min={0}
              max={0.9}
              step={0.05}
              onValueChange={setCanvasPanRubberBandFactor}
            />
          </View>
          <Separator />
          <SettingsRow
            icon="options-outline"
            label={t("settings.canvasWheelZoomSensitivity")}
            value={canvasWheelZoomSensitivity.toFixed(4)}
          />
          <View className="px-2 pb-2">
            <SimpleSlider
              label=""
              value={canvasWheelZoomSensitivity}
              min={0.0005}
              max={0.004}
              step={0.0001}
              onValueChange={setCanvasWheelZoomSensitivity}
            />
          </View>
        </SettingsSection>

        {/* Histogram & Pixel Info */}
        <SettingsSection
          title={`${t("settings.histogramConfig")} & ${t("settings.pixelInfoConfig")}`}
        >
          <SettingsRow
            icon="bar-chart-outline"
            label={t("settings.defaultHistogramMode")}
            value={getHistogramModeLabel(defaultHistogramMode)}
            onPress={() => openPicker("histogramMode")}
          />
          <Separator />
          <SettingsRow
            icon="resize-outline"
            label={t("settings.histogramHeight")}
            value={`${histogramHeight}px`}
            onPress={() => openPicker("histogramHeight")}
          />
          <Separator />
          <SettingsRow
            icon="calculator-outline"
            label={t("settings.pixelInfoDecimalPlaces")}
            value={`${pixelInfoDecimalPlaces}`}
            onPress={() => openPicker("pixelDecimals")}
          />
        </SettingsSection>

        {/* Picker Modals */}
        <OptionPickerModal
          visible={activePicker === "stretch"}
          title={t("viewer.stretch")}
          options={stretchOptions}
          selectedValue={defaultStretch}
          onSelect={setDefaultStretch}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "colormap"}
          title={t("viewer.colormap")}
          options={colormapOptions}
          selectedValue={defaultColormap}
          onSelect={setDefaultColormap}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "gridColor"}
          title={t("settings.gridColor")}
          options={COLOR_OPTIONS}
          selectedValue={gridColor}
          onSelect={setGridColor}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "crosshairColor"}
          title={t("settings.crosshairColor")}
          options={COLOR_OPTIONS}
          selectedValue={crosshairColor}
          onSelect={setCrosshairColor}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "histogramMode"}
          title={t("settings.defaultHistogramMode")}
          options={histogramModeOptions}
          selectedValue={defaultHistogramMode}
          onSelect={setDefaultHistogramMode}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "histogramHeight"}
          title={t("settings.histogramHeight")}
          options={HISTOGRAM_HEIGHT_OPTIONS}
          selectedValue={histogramHeight}
          onSelect={setHistogramHeight}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "pixelDecimals"}
          title={t("settings.pixelInfoDecimalPlaces")}
          options={PIXEL_DECIMAL_OPTIONS}
          selectedValue={pixelInfoDecimalPlaces}
          onSelect={setPixelInfoDecimalPlaces}
          onClose={closePicker}
        />
      </ScrollView>
    </View>
  );
}
