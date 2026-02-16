import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { SimpleSlider } from "../common/SimpleSlider";
import type { StretchType, ColormapType, ViewerCurvePreset } from "../../lib/fits/types";
import { VIEWER_CURVE_PRESETS } from "../../lib/viewer/presets";

const STRETCHES: StretchType[] = [
  "linear",
  "sqrt",
  "log",
  "asinh",
  "power",
  "zscale",
  "minmax",
  "percentile",
];
const COLORMAPS: ColormapType[] = [
  "grayscale",
  "inverted",
  "heat",
  "cool",
  "thermal",
  "rainbow",
  "jet",
  "viridis",
  "plasma",
  "magma",
  "inferno",
  "cividis",
  "cubehelix",
  "red",
  "green",
  "blue",
];

const STRETCH_I18N_KEYS: Record<StretchType, string> = {
  linear: "viewer.stretchLinear",
  sqrt: "viewer.stretchSqrt",
  log: "viewer.stretchLog",
  asinh: "viewer.stretchAsinh",
  power: "viewer.stretchPower",
  zscale: "viewer.stretchZscale",
  minmax: "viewer.stretchMinmax",
  percentile: "viewer.stretchPercentile",
};

const COLORMAP_I18N_KEYS: Record<ColormapType, string> = {
  grayscale: "viewer.colormapGrayscale",
  inverted: "viewer.colormapInverted",
  heat: "viewer.colormapHeat",
  cool: "viewer.colormapCool",
  thermal: "viewer.colormapThermal",
  rainbow: "viewer.colormapRainbow",
  jet: "viewer.colormapJet",
  viridis: "viewer.colormapViridis",
  plasma: "viewer.colormapPlasma",
  magma: "viewer.colormapMagma",
  inferno: "viewer.colormapInferno",
  cividis: "viewer.colormapCividis",
  cubehelix: "viewer.colormapCubehelix",
  red: "viewer.colormapRed",
  green: "viewer.colormapGreen",
  blue: "viewer.colormapBlue",
};

interface ViewerControlsProps {
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
  onAutoStretch?: () => void;
  onResetView?: () => void;
  onSavePreset?: () => void;
  onResetToSaved?: () => void;
  onApplyQuickPreset?: (preset: "auto" | "linearReset" | "deepSky" | "moonPlanet") => void;
}

function isImageHDUType(type: string | null) {
  return type === "Image" || type === "CompressedImage";
}

export function ViewerControls({
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
  onAutoStretch,
  onResetView,
  onSavePreset,
  onResetToSaved,
  onApplyQuickPreset,
}: ViewerControlsProps) {
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  return (
    <ScrollView className="border-t border-separator bg-background max-h-72">
      <View className="px-3 py-2">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-[9px] font-semibold uppercase text-muted">{t("viewer.view")}</Text>
          <View className="flex-row gap-1">
            {onAutoStretch && (
              <Button size="sm" variant="ghost" onPress={onAutoStretch} className="px-1.5 py-0.5">
                <Ionicons name="flash-outline" size={10} color={successColor} />
              </Button>
            )}
            {onResetView && (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={onResetView}
                className="h-6 w-6"
              >
                <Ionicons name="scan-outline" size={11} color={mutedColor} />
              </Button>
            )}
            {onResetToSaved && (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={onResetToSaved}
                className="h-6 w-6"
              >
                <Ionicons name="refresh-outline" size={11} color={mutedColor} />
              </Button>
            )}
            {onSavePreset && (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={onSavePreset}
                className="h-6 w-6"
              >
                <Ionicons name="save-outline" size={11} color={mutedColor} />
              </Button>
            )}
          </View>
        </View>

        {onApplyQuickPreset && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            <View className="flex-row gap-1">
              {[
                { key: "auto" as const, label: t("viewer.presetAuto") },
                { key: "linearReset" as const, label: t("viewer.presetLinearReset") },
                { key: "deepSky" as const, label: t("viewer.presetDeepSky") },
                { key: "moonPlanet" as const, label: t("viewer.presetMoonPlanet") },
              ].map((preset) => (
                <Chip
                  key={preset.key}
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    Haptics.selectionAsync();
                    onApplyQuickPreset(preset.key);
                  }}
                >
                  <Chip.Label className="text-[9px]">{preset.label}</Chip.Label>
                </Chip>
              ))}
            </View>
          </ScrollView>
        )}

        <Text className="text-[9px] font-semibold uppercase text-muted mb-1">
          {t("viewer.stretch")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          <View className="flex-row gap-1">
            {STRETCHES.map((s) => (
              <Chip
                key={s}
                size="sm"
                variant={stretch === s ? "primary" : "secondary"}
                onPress={() => {
                  Haptics.selectionAsync();
                  onStretchChange(s);
                }}
              >
                <Chip.Label className="text-[9px]">{t(STRETCH_I18N_KEYS[s])}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>

        <Text className="text-[9px] font-semibold uppercase text-muted mb-1">
          {t("viewer.colormap")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          <View className="flex-row gap-1">
            {COLORMAPS.map((c) => (
              <Chip
                key={c}
                size="sm"
                variant={colormap === c ? "primary" : "secondary"}
                onPress={() => {
                  Haptics.selectionAsync();
                  onColormapChange(c);
                }}
              >
                <Chip.Label className="text-[9px]">{t(COLORMAP_I18N_KEYS[c])}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>

        <View className="mb-2">
          <SimpleSlider
            label={t("editor.brightness")}
            value={brightness}
            min={-0.5}
            max={0.5}
            step={0.01}
            onValueChange={onBrightnessChange}
          />
          <SimpleSlider
            label={t("editor.contrast")}
            value={contrast}
            min={0.2}
            max={2.5}
            step={0.05}
            onValueChange={onContrastChange}
          />
          <SimpleSlider
            label={t("editor.mtf")}
            value={mtfMidtone}
            min={0.01}
            max={0.99}
            step={0.01}
            onValueChange={onMtfMidtoneChange}
          />
        </View>

        <Text className="text-[9px] font-semibold uppercase text-muted mb-1">
          {t("editor.curves")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          <View className="flex-row gap-1">
            {VIEWER_CURVE_PRESETS.map((preset) => (
              <Chip
                key={preset.key}
                size="sm"
                variant={curvePreset === preset.key ? "primary" : "secondary"}
                onPress={() => onCurvePresetChange(preset.key)}
              >
                <Chip.Label className="text-[9px]">{t(preset.labelKey)}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>

        {hduList.length > 0 && (
          <>
            <Text className="text-[9px] font-semibold uppercase text-muted mb-1">
              {t("viewer.hdu")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              <View className="flex-row gap-1">
                {hduList.map((hdu) => {
                  const selectable = hdu.hasData && isImageHDUType(hdu.type);
                  return (
                    <Chip
                      key={hdu.index}
                      size="sm"
                      variant={currentHDU === hdu.index ? "primary" : "secondary"}
                      disabled={!selectable}
                      onPress={() => selectable && onHDUChange(hdu.index)}
                    >
                      <Chip.Label className="text-[9px]">
                        #{hdu.index} {hdu.type ?? "Unknown"}
                      </Chip.Label>
                    </Chip>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}

        {isDataCube && totalFrames > 1 && (
          <FrameNavigation
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            onFrameChange={onFrameChange}
            mutedColor={mutedColor}
            successColor={successColor}
          />
        )}

        <View className="flex-row gap-2 mt-1">
          <Button
            size="sm"
            variant={showGrid ? "primary" : "ghost"}
            isIconOnly
            onPress={() => {
              Haptics.selectionAsync();
              onToggleGrid();
            }}
            className="h-7 w-7"
          >
            <Ionicons name="grid-outline" size={14} color={showGrid ? successColor : mutedColor} />
          </Button>
          <Button
            size="sm"
            variant={showCrosshair ? "primary" : "ghost"}
            isIconOnly
            onPress={() => {
              Haptics.selectionAsync();
              onToggleCrosshair();
            }}
            className="h-7 w-7"
          >
            <Ionicons
              name="add-outline"
              size={14}
              color={showCrosshair ? successColor : mutedColor}
            />
          </Button>
          <Button
            size="sm"
            variant={showPixelInfo ? "primary" : "ghost"}
            isIconOnly
            onPress={() => {
              Haptics.selectionAsync();
              onTogglePixelInfo();
            }}
            className="h-7 w-7"
          >
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={showPixelInfo ? successColor : mutedColor}
            />
          </Button>
          <Button
            size="sm"
            variant={showMinimap ? "primary" : "ghost"}
            isIconOnly
            onPress={() => {
              Haptics.selectionAsync();
              onToggleMinimap();
            }}
            className="h-7 w-7"
          >
            <Ionicons
              name="map-outline"
              size={14}
              color={showMinimap ? successColor : mutedColor}
            />
          </Button>
        </View>
      </View>
    </ScrollView>
  );
}

interface FrameNavigationProps {
  currentFrame: number;
  totalFrames: number;
  onFrameChange: (frame: number) => void;
  mutedColor: string;
  successColor: string;
}

function FrameNavigation({
  currentFrame,
  totalFrames,
  onFrameChange,
  mutedColor,
  successColor,
}: FrameNavigationProps) {
  const { t } = useI18n();
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef(currentFrame);

  useEffect(() => {
    frameRef.current = currentFrame;
  }, [currentFrame]);

  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(() => {
    stopPlayback();
    setIsPlaying(true);
    timerRef.current = setInterval(() => {
      const next = frameRef.current + 1;
      if (next >= totalFrames) {
        onFrameChange(0);
        frameRef.current = 0;
      } else {
        onFrameChange(next);
        frameRef.current = next;
      }
    }, 200);
  }, [totalFrames, onFrameChange, stopPlayback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <View className="flex-row items-center gap-2 mb-2">
      <Text className="text-[9px] font-semibold uppercase text-muted">{t("viewer.frame")}</Text>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        onPress={() => {
          Haptics.selectionAsync();
          if (isPlaying) stopPlayback();
          else startPlayback();
        }}
        className="h-6 w-6"
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={12}
          color={isPlaying ? successColor : mutedColor}
        />
      </Button>
      <Button
        size="sm"
        variant="outline"
        isDisabled={currentFrame <= 0 || isPlaying}
        onPress={() => onFrameChange(currentFrame - 1)}
      >
        <Ionicons name="chevron-back" size={12} color={mutedColor} />
      </Button>
      <Text className="text-[10px] text-foreground min-w-[40px] text-center">
        {currentFrame + 1} / {totalFrames}
      </Text>
      <Button
        size="sm"
        variant="outline"
        isDisabled={currentFrame >= totalFrames - 1 || isPlaying}
        onPress={() => onFrameChange(currentFrame + 1)}
      >
        <Ionicons name="chevron-forward" size={12} color={mutedColor} />
      </Button>
    </View>
  );
}
