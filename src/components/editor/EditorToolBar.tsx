import { View, Text, ScrollView, Alert } from "react-native";
import { PressableFeedback } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useI18n, type TranslationKey } from "../../i18n/useI18n";
import type { EditorTool, EditorToolGroup } from "../../hooks/useEditorToolState";

const GEOMETRY_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "crop", icon: "crop-outline" },
  { key: "rotate", icon: "refresh-outline" },
  { key: "flip", icon: "swap-horizontal-outline" },
  { key: "rotateCustom", icon: "sync-outline" },
];

const ADJUST_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "brightness", icon: "sunny-outline" },
  { key: "contrast", icon: "options-outline" },
  { key: "gamma", icon: "pulse-outline" },
  { key: "levels", icon: "analytics-outline" },
  { key: "curves", icon: "trending-up-outline" },
  { key: "mtf", icon: "color-wand-outline" },
  { key: "saturation", icon: "color-fill-outline" },
  { key: "colorBalance", icon: "color-filter-outline" },
  { key: "colorCalibration", icon: "flask-outline" },
  { key: "scnr", icon: "leaf-outline" },
  { key: "invert", icon: "contrast-outline" },
  { key: "histogram", icon: "bar-chart-outline" },
];

const PROCESS_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "blur", icon: "water-outline" },
  { key: "sharpen", icon: "sparkles-outline" },
  { key: "denoise", icon: "layers-outline" },
  { key: "dbe", icon: "planet-outline" },
  { key: "multiscaleDenoise", icon: "layers-outline" },
  { key: "localContrast", icon: "contrast-outline" },
  { key: "starReduction", icon: "star-outline" },
  { key: "clahe", icon: "grid-outline" },
  { key: "hdr", icon: "aperture-outline" },
  { key: "deconvolution", icon: "flashlight-outline" },
  { key: "deconvolutionAuto", icon: "flash-outline" },
  { key: "morphology", icon: "shapes-outline" },
  { key: "background", icon: "globe-outline" },
];

const MASK_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "starMask", icon: "star-half-outline" },
  { key: "rangeMask", icon: "funnel-outline" },
  { key: "binarize", icon: "moon-outline" },
  { key: "rescale", icon: "resize-outline" },
  { key: "pixelMath", icon: "calculator-outline" },
];

const ADVANCED_TOOLS: { key: string; icon: keyof typeof Ionicons.glyphMap; route?: Href }[] = [
  { key: "calibration", icon: "flask-outline" },
  { key: "stacking", icon: "copy-outline", route: "/stacking" },
  { key: "compose", icon: "color-palette-outline", route: "/compose/advanced" },
  { key: "statistics", icon: "stats-chart-outline" },
  { key: "starDetect", icon: "star-outline" },
];
const COMING_SOON_ADVANCED_TOOLS = new Set(["calibration", "statistics"]);

const TOOL_GROUP_MAP: Record<
  EditorToolGroup,
  { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[]
> = {
  geometry: GEOMETRY_TOOLS,
  adjust: ADJUST_TOOLS,
  process: PROCESS_TOOLS,
  mask: MASK_TOOLS,
};

interface EditorToolBarProps {
  activeTool: EditorTool;
  activeToolGroup: EditorToolGroup;
  onToolPress: (tool: EditorTool & string) => void;
  onToolGroupChange: (group: EditorToolGroup) => void;
  successColor: string;
  mutedColor: string;
  // Advanced tool state
  fileId?: string;
  detectedStarsCount: number;
  isStarAnnotationMode: boolean;
  onStarDetectToggle: () => void;
}

export function EditorToolBar({
  activeTool,
  activeToolGroup,
  onToolPress,
  onToolGroupChange,
  successColor,
  mutedColor,
  fileId,
  detectedStarsCount,
  isStarAnnotationMode,
  onStarDetectToggle,
}: EditorToolBarProps) {
  const { t } = useI18n();
  const router = useRouter();

  const tools = TOOL_GROUP_MAP[activeToolGroup];

  return (
    <>
      {/* Tool Group Tabs */}
      <View className="border-t border-separator bg-background px-2 pt-1">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-1">
            {[
              { key: "geometry" as const, label: t("editor.geometry" as TranslationKey) },
              { key: "adjust" as const, label: t("editor.adjust" as TranslationKey) },
              { key: "process" as const, label: t("editor.process" as TranslationKey) },
              { key: "mask" as const, label: t("editor.maskTools" as TranslationKey) },
            ].map((tab) => (
              <PressableFeedback key={tab.key} onPress={() => onToolGroupChange(tab.key)}>
                <View
                  className={`px-3 py-1 rounded-full ${activeToolGroup === tab.key ? "bg-success/15" : ""}`}
                >
                  <Text
                    className={`text-[10px] font-semibold ${activeToolGroup === tab.key ? "text-success" : "text-muted"}`}
                  >
                    {tab.label}
                  </Text>
                </View>
              </PressableFeedback>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Tools Row */}
      <View className="border-t border-separator bg-background px-2 py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-0.5">
            {tools.map((tool) => {
              const isActive = activeTool === tool.key;
              return (
                <PressableFeedback
                  key={tool.key}
                  testID={`e2e-action-editor__param_id-tool-${tool.key}`}
                  onPress={() => onToolPress(tool.key)}
                >
                  <View
                    className={`items-center justify-center px-3 py-2 rounded-lg ${isActive ? "bg-success/10" : ""}`}
                  >
                    <Ionicons
                      name={tool.icon}
                      size={20}
                      color={isActive ? successColor : mutedColor}
                    />
                    <Text
                      className={`mt-1 text-[9px] ${isActive ? "text-success font-semibold" : "text-muted"}`}
                    >
                      {t(`editor.${tool.key}` as TranslationKey)}
                    </Text>
                  </View>
                </PressableFeedback>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Advanced Tools */}
      <View className="border-t border-separator bg-background px-2 py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-0.5">
            {ADVANCED_TOOLS.map((tool) => {
              const isComingSoonTool = COMING_SOON_ADVANCED_TOOLS.has(tool.key);
              const isStarDetectActive =
                tool.key === "starDetect" && (detectedStarsCount > 0 || isStarAnnotationMode);
              return (
                <PressableFeedback
                  key={tool.key}
                  testID={`e2e-action-editor__param_id-advanced-${tool.key}`}
                  onPress={() => {
                    if (isComingSoonTool) {
                      Alert.alert(t("common.comingSoon"));
                      return;
                    }
                    if (tool.route) {
                      if (tool.key === "compose" && fileId) {
                        router.push(`/compose/advanced?sourceId=${fileId}`);
                      } else {
                        router.push(tool.route);
                      }
                      return;
                    }
                    if (tool.key === "starDetect") {
                      onStarDetectToggle();
                      return;
                    }
                    Alert.alert(t("common.comingSoon"));
                  }}
                >
                  <View
                    className="items-center justify-center px-3 py-2"
                    style={isComingSoonTool ? { opacity: 0.5 } : undefined}
                  >
                    <Ionicons
                      name={tool.icon}
                      size={20}
                      color={isStarDetectActive ? successColor : mutedColor}
                    />
                    <Text
                      className={`mt-1 text-[9px] ${isStarDetectActive ? "text-success font-semibold" : "text-muted"}`}
                    >
                      {tool.key === "starDetect" && detectedStarsCount > 0
                        ? `${detectedStarsCount} ${t("editor.stars")}`
                        : t(`editor.${tool.key}` as TranslationKey)}
                    </Text>
                  </View>
                </PressableFeedback>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </>
  );
}
