import { View, Text, ScrollView, Alert } from "react-native";
import { useState, useCallback } from "react";
import {
  Button,
  Card,
  Chip,
  PressableFeedback,
  Separator,
  Spinner,
  Switch,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";
import { useCompose } from "../../hooks/useCompose";
import { useExport } from "../../hooks/useExport";
import { FitsCanvas } from "../../components/fits/FitsCanvas";
import { SimpleSlider } from "../../components/common/SimpleSlider";

type ComposePreset = "rgb" | "sho" | "hoo" | "lrgb" | "custom";

const CHANNEL_CONFIG = [
  {
    key: "red" as const,
    label: "R",
    color: "bg-red-500/20",
    textColor: "text-red-400",
    desc: "Red channel",
  },
  {
    key: "green" as const,
    label: "G",
    color: "bg-green-500/20",
    textColor: "text-green-400",
    desc: "Green channel",
  },
  {
    key: "blue" as const,
    label: "B",
    color: "bg-blue-500/20",
    textColor: "text-blue-400",
    desc: "Blue channel",
  },
] as const;

const LUMINANCE_CONFIG = {
  key: "luminance" as const,
  label: "L",
  color: "bg-gray-500/20",
  textColor: "text-gray-300",
  desc: "Luminance channel",
};

const PRESETS: {
  key: ComposePreset;
  label: string;
  desc: string;
  mapping: Record<string, string>;
}[] = [
  {
    key: "rgb",
    label: "RGB",
    desc: "Standard R/G/B mapping",
    mapping: { red: "R", green: "G", blue: "B" },
  },
  {
    key: "lrgb",
    label: "LRGB",
    desc: "Luminance + RGB",
    mapping: { red: "R", green: "G", blue: "B", luminance: "L" },
  },
  {
    key: "sho",
    label: "SHO (Hubble)",
    desc: "SII→R, Hα→G, OIII→B",
    mapping: { red: "SII", green: "Ha", blue: "OIII" },
  },
  {
    key: "hoo",
    label: "HOO",
    desc: "Hα→R, OIII→G, OIII→B",
    mapping: { red: "Ha", green: "OIII", blue: "OIII" },
  },
  { key: "custom", label: "Custom", desc: "Manual assignment", mapping: {} },
];

export default function ComposeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const files = useFitsStore((s) => s.files);
  const composer = useCompose();
  const exporter = useExport();

  const [preset, setPreset] = useState<ComposePreset>("rgb");
  const [selectingChannel, setSelectingChannel] = useState<
    "red" | "green" | "blue" | "luminance" | null
  >(null);
  const [showWeights, setShowWeights] = useState(false);

  const assignFile = useCallback(
    async (
      channel: "red" | "green" | "blue" | "luminance",
      fileId: string,
      filepath: string,
      filename: string,
    ) => {
      setSelectingChannel(null);
      await composer.loadChannel(channel, fileId, filepath, filename);
    },
    [composer],
  );

  const autoAssign = useCallback(
    async (presetKey: ComposePreset) => {
      setPreset(presetKey);
      if (presetKey === "custom") return;

      const presetConfig = PRESETS.find((p) => p.key === presetKey);
      if (!presetConfig) return;

      composer.reset();

      for (const [channel, filterName] of Object.entries(presetConfig.mapping)) {
        const match = files.find((f) => f.filter?.toUpperCase().includes(filterName.toUpperCase()));
        if (match) {
          await composer.loadChannel(
            channel as "red" | "green" | "blue",
            match.id,
            match.filepath,
            match.filename,
          );
        }
      }
    },
    [files, composer],
  );

  const handleCompose = useCallback(() => {
    if (composer.assignedCount < 2) {
      Alert.alert(t("common.error"), t("compose.assignAtLeast2"));
      return;
    }
    composer.compose();
  }, [composer, t]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-14">
      <View className="flex-row items-center gap-3 mb-4">
        <Button size="sm" variant="outline" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">{t("editor.compose")}</Text>
          <Text className="text-[10px] text-muted">
            {t("compose.channelsAssigned", { count: composer.assignedCount })}
          </Text>
        </View>
        {composer.result && (
          <View className="flex-row gap-2">
            <Button
              size="sm"
              variant="outline"
              onPress={async () => {
                if (!composer.result) return;
                const uri = await exporter.saveImage(
                  composer.result.rgbaData,
                  composer.result.width,
                  composer.result.height,
                  `composed_${preset}`,
                  "png",
                );
                if (uri) {
                  Alert.alert(t("common.success"), t("compose.imageSaved"));
                }
              }}
            >
              <Ionicons name="download-outline" size={14} color={mutedColor} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={async () => {
                if (!composer.result) return;
                try {
                  await exporter.shareImage(
                    composer.result.rgbaData,
                    composer.result.width,
                    composer.result.height,
                    `composed_${preset}`,
                    "png",
                  );
                } catch {
                  Alert.alert(t("common.error"), t("share.failed"));
                }
              }}
            >
              <Ionicons name="share-outline" size={14} color={mutedColor} />
            </Button>
            <Button size="sm" variant="outline" onPress={composer.reset}>
              <Ionicons name="refresh-outline" size={14} color={mutedColor} />
            </Button>
          </View>
        )}
      </View>

      <Separator className="mb-4" />

      {/* Result Preview */}
      {composer.result && (
        <>
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("compose.rgbPreview")}
          </Text>
          <View className="h-56 mb-3 rounded-lg overflow-hidden bg-black">
            <FitsCanvas
              rgbaData={composer.result.rgbaData}
              width={composer.result.width}
              height={composer.result.height}
              showGrid={false}
              showCrosshair={false}
              cursorX={-1}
              cursorY={-1}
            />
          </View>
          <Text className="text-[9px] text-muted text-center mb-3">
            {composer.result.width} × {composer.result.height} px
          </Text>
          <Separator className="mb-4" />
        </>
      )}

      {/* Error */}
      {composer.error && (
        <View className="mb-4 rounded-lg bg-danger/10 p-3">
          <Text className="text-xs text-danger">{composer.error}</Text>
        </View>
      )}

      {/* Linked Stretch Toggle */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs text-muted">{t("compose.linkedStretch")}</Text>
        <Switch
          isSelected={composer.linkedStretch}
          onSelectedChange={(v) => composer.setLinkedStretch(v)}
        >
          <Switch.Thumb />
        </Switch>
      </View>

      {/* Preset Selection */}
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">{t("compose.preset")}</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <PressableFeedback key={p.key} onPress={() => autoAssign(p.key)}>
            <Card variant="secondary" className={preset === p.key ? "border border-success" : ""}>
              <Card.Body className="p-2.5">
                <Text
                  className={`text-xs font-semibold ${preset === p.key ? "text-success" : "text-foreground"}`}
                >
                  {p.label}
                </Text>
                <Text className="text-[9px] text-muted">{p.desc}</Text>
              </Card.Body>
            </Card>
          </PressableFeedback>
        ))}
      </View>

      <Separator className="mb-4" />

      {/* Channel Assignment */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-semibold uppercase text-muted">{t("compose.channels")}</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-[9px] text-muted">{t("compose.weights")}</Text>
          <Switch isSelected={showWeights} onSelectedChange={setShowWeights}>
            <Switch.Thumb />
          </Switch>
        </View>
      </View>
      <View className="gap-2 mb-4">
        {CHANNEL_CONFIG.map((ch) => {
          const channelState = composer.channels[ch.key];
          return (
            <View key={ch.key}>
              <PressableFeedback
                onPress={() => setSelectingChannel(selectingChannel === ch.key ? null : ch.key)}
              >
                <Card
                  variant="secondary"
                  className={channelState.pixels ? "border border-success" : ""}
                >
                  <Card.Body className="flex-row items-center gap-3 p-3">
                    <View className={`h-8 w-8 items-center justify-center rounded-lg ${ch.color}`}>
                      <Text className={`text-sm font-bold ${ch.textColor}`}>{ch.label}</Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      {channelState.filename ? (
                        <>
                          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                            {channelState.filename}
                          </Text>
                          <Text className="text-[9px] text-success">{t("compose.loaded")}</Text>
                        </>
                      ) : (
                        <Text className="text-xs text-muted">
                          {ch.desc} - {t("compose.tapToSelect")}
                        </Text>
                      )}
                    </View>
                    {composer.isLoading && selectingChannel === ch.key ? (
                      <Spinner size="sm" color={successColor} />
                    ) : channelState.pixels ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        onPress={() => composer.clearChannel(ch.key)}
                      >
                        <Ionicons name="close-circle" size={18} color={mutedColor} />
                      </Button>
                    ) : (
                      <Ionicons name="add-circle-outline" size={18} color={mutedColor} />
                    )}
                  </Card.Body>
                </Card>
              </PressableFeedback>

              {/* Weight slider */}
              {showWeights && channelState.pixels && (
                <View className="px-3 py-1">
                  <SimpleSlider
                    label={`${ch.label} Weight`}
                    value={channelState.weight}
                    min={0}
                    max={2}
                    step={0.05}
                    onValueChange={(v) => composer.setChannelWeight(ch.key, v)}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Luminance Channel */}
      <View className="flex-row items-center justify-between mb-2 mt-2">
        <Text className="text-xs font-semibold uppercase text-muted">
          {t("compose.luminanceOptional")}
        </Text>
      </View>
      <View className="gap-2 mb-4">
        <PressableFeedback
          onPress={() => setSelectingChannel(selectingChannel === "luminance" ? null : "luminance")}
        >
          <Card
            variant="secondary"
            className={composer.channels.luminance.pixels ? "border border-success" : ""}
          >
            <Card.Body className="flex-row items-center gap-3 p-3">
              <View
                className={`h-8 w-8 items-center justify-center rounded-lg ${LUMINANCE_CONFIG.color}`}
              >
                <Text className={`text-sm font-bold ${LUMINANCE_CONFIG.textColor}`}>
                  {LUMINANCE_CONFIG.label}
                </Text>
              </View>
              <View className="flex-1 min-w-0">
                {composer.channels.luminance.filename ? (
                  <>
                    <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                      {composer.channels.luminance.filename}
                    </Text>
                    <Text className="text-[9px] text-success">{t("compose.loaded")}</Text>
                  </>
                ) : (
                  <Text className="text-xs text-muted">
                    {LUMINANCE_CONFIG.desc} - {t("compose.tapToSelect")}
                  </Text>
                )}
              </View>
              {composer.isLoading && selectingChannel === "luminance" ? (
                <Spinner size="sm" color={successColor} />
              ) : composer.channels.luminance.pixels ? (
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  onPress={() => composer.clearChannel("luminance")}
                >
                  <Ionicons name="close-circle" size={18} color={mutedColor} />
                </Button>
              ) : (
                <Ionicons name="add-circle-outline" size={18} color={mutedColor} />
              )}
            </Card.Body>
          </Card>
        </PressableFeedback>
        {showWeights && composer.channels.luminance.pixels && (
          <View className="px-3 py-1">
            <SimpleSlider
              label="L Weight"
              value={composer.channels.luminance.weight}
              min={0}
              max={2}
              step={0.05}
              onValueChange={(v) => composer.setChannelWeight("luminance", v)}
            />
          </View>
        )}
      </View>

      {/* File picker for selected channel */}
      {selectingChannel && (
        <>
          <Separator className="mb-3" />
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("compose.selectFileFor", { channel: selectingChannel.toUpperCase() })}
          </Text>
          <View className="gap-1 mb-4">
            {files.map((file) => (
              <PressableFeedback
                key={file.id}
                onPress={() => assignFile(selectingChannel, file.id, file.filepath, file.filename)}
              >
                <Card variant="secondary">
                  <Card.Body className="flex-row items-center gap-2 p-2">
                    <Text className="text-xs text-foreground flex-1" numberOfLines={1}>
                      {file.filename}
                    </Text>
                    <Chip size="sm" variant="secondary">
                      <Chip.Label className="text-[8px]">{file.filter ?? "-"}</Chip.Label>
                    </Chip>
                  </Card.Body>
                </Card>
              </PressableFeedback>
            ))}
            {files.length === 0 && (
              <Text className="text-xs text-muted text-center py-4">
                {t("compose.noFilesAvailable")}
              </Text>
            )}
          </View>
        </>
      )}

      {/* Compose Button */}
      <Button
        variant="primary"
        className="mt-2"
        onPress={handleCompose}
        isDisabled={composer.assignedCount < 2 || composer.isComposing || composer.isLoading}
      >
        {composer.isComposing ? (
          <Spinner size="sm" color="#fff" />
        ) : (
          <Ionicons name="color-palette-outline" size={16} color="#fff" />
        )}
        <Button.Label>{t("editor.compose")}</Button.Label>
      </Button>
    </ScrollView>
  );
}
