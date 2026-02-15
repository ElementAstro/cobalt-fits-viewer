import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useI18n } from "../../i18n/useI18n";
import { SimpleSlider } from "../common/SimpleSlider";
import type { StretchType, ColormapType } from "../../lib/fits/types";

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
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  showGrid: boolean;
  showCrosshair: boolean;
  showPixelInfo: boolean;
  showMinimap: boolean;
  currentFrame: number;
  totalFrames: number;
  isDataCube: boolean;
  onStretchChange: (stretch: StretchType) => void;
  onColormapChange: (colormap: ColormapType) => void;
  onBlackPointChange: (value: number) => void;
  onWhitePointChange: (value: number) => void;
  onGammaChange: (value: number) => void;
  onToggleGrid: () => void;
  onToggleCrosshair: () => void;
  onTogglePixelInfo: () => void;
  onToggleMinimap: () => void;
  onFrameChange: (frame: number) => void;
  onAutoStretch?: () => void;
}

export function ViewerControls({
  stretch,
  colormap,
  blackPoint,
  whitePoint,
  gamma,
  showGrid,
  showCrosshair,
  showPixelInfo,
  showMinimap,
  currentFrame,
  totalFrames,
  isDataCube,
  onStretchChange,
  onColormapChange,
  onBlackPointChange,
  onWhitePointChange,
  onGammaChange,
  onToggleGrid,
  onToggleCrosshair,
  onTogglePixelInfo,
  onToggleMinimap,
  onFrameChange,
  onAutoStretch,
}: ViewerControlsProps) {
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  return (
    <ScrollView className="border-t border-separator bg-background max-h-64">
      <View className="px-3 py-2">
        {/* Stretch */}
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-[9px] font-semibold uppercase text-muted">
            {t("viewer.stretch")}
          </Text>
          {onAutoStretch && (
            <Button
              size="sm"
              variant="ghost"
              onPress={onAutoStretch}
              className="flex-row items-center bg-primary/20 rounded-md px-2 py-0.5"
            >
              <Ionicons name="flash-outline" size={10} color={successColor} />
              <Button.Label className="text-[9px] font-semibold text-primary ml-0.5">
                {t("viewer.autoStretch")}
              </Button.Label>
            </Button>
          )}
        </View>
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

        {/* Colormap */}
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

        {/* Black/White Point & Gamma Sliders */}
        <View className="mb-2">
          <SimpleSlider
            label={t("viewer.blackPoint")}
            value={blackPoint}
            min={0}
            max={1}
            step={0.01}
            onValueChange={onBlackPointChange}
          />
          <SimpleSlider
            label={t("viewer.whitePoint")}
            value={whitePoint}
            min={0}
            max={1}
            step={0.01}
            onValueChange={onWhitePointChange}
          />
          <SimpleSlider
            label={t("viewer.gamma")}
            value={gamma}
            min={0.1}
            max={5}
            step={0.1}
            onValueChange={onGammaChange}
          />
        </View>

        {/* Frame Navigation (Data Cube) */}
        {isDataCube && totalFrames > 1 && (
          <FrameNavigation
            currentFrame={currentFrame}
            totalFrames={totalFrames}
            onFrameChange={onFrameChange}
            mutedColor={mutedColor}
            successColor={successColor}
          />
        )}

        {/* Overlay Toggles */}
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

// --- Frame Navigation with play/pause ---
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

  // Keep frameRef in sync
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
