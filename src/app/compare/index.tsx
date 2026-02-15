import { useCallback, useMemo } from "react";
import { View, Text, Image, Pressable, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";
import { useImageComparison, type CompareMode } from "../../hooks/useImageComparison";
import { SimpleSlider } from "../../components/common/SimpleSlider";

const MODES: { key: CompareMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "blink", label: "Blink", icon: "eye-outline" },
  { key: "side-by-side", label: "Side by Side", icon: "git-compare-outline" },
  { key: "overlay", label: "Overlay", icon: "layers-outline" },
];

export default function CompareScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ ids?: string }>();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  const initialIds = useMemo(() => (params.ids ? params.ids.split(",") : []), [params.ids]);

  const {
    imageIds,
    mode,
    activeIndex,
    blinkSpeed,
    overlayOpacity,
    isBlinkPlaying,
    setMode,
    setActiveIndex,
    setBlinkSpeed,
    setOverlayOpacity,
    removeImage,
    nextImage,
    prevImage,
    toggleBlinkPlay,
  } = useImageComparison({ initialIds });

  const files = useFitsStore((s) => s.files);
  const imageFiles = useMemo(
    () =>
      imageIds
        .map((id) => files.find((f) => f.id === id))
        .filter((f): f is NonNullable<typeof f> => f != null),
    [imageIds, files],
  );

  const activeFile = imageFiles[activeIndex];
  const secondFile = imageFiles.length > 1 ? imageFiles[1] : undefined;

  const renderImageView = useCallback(
    (file: (typeof imageFiles)[number] | undefined, style?: object) => {
      if (!file) {
        return (
          <View className="flex-1 items-center justify-center bg-card rounded-lg">
            <Ionicons name="image-outline" size={48} color={mutedColor} />
            <Text className="text-xs text-muted mt-2">{t("gallery.noImage")}</Text>
          </View>
        );
      }
      return (
        <View className="flex-1 rounded-lg overflow-hidden bg-black" style={style}>
          {file.thumbnailUri ? (
            <Image
              source={{ uri: file.thumbnailUri }}
              className="w-full h-full"
              resizeMode="contain"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="image-outline" size={48} color={mutedColor} />
            </View>
          )}
          {/* Info overlay */}
          <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
            <Text className="text-[10px] text-white" numberOfLines={1}>
              {file.filename}
            </Text>
            <Text className="text-[9px] text-white/70">
              {file.filter ?? ""} · {file.exptime ?? 0}s
              {file.qualityScore != null && ` · Q:${file.qualityScore.toFixed(0)}`}
            </Text>
          </View>
        </View>
      );
    },
    [mutedColor, t],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-2 px-4 py-2">
        <Button size="sm" variant="outline" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <Text className="flex-1 text-base font-semibold text-foreground">
          {t("gallery.compare")} ({imageIds.length})
        </Text>
      </View>

      {/* Mode selector */}
      <View className="px-4 pb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-1.5">
            {MODES.map((m) => (
              <Chip
                key={m.key}
                size="sm"
                variant={mode === m.key ? "primary" : "secondary"}
                onPress={() => setMode(m.key)}
              >
                <Ionicons
                  name={m.icon}
                  size={10}
                  color={mode === m.key ? successColor : mutedColor}
                />
                <Chip.Label className="text-[10px]">{m.label}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Main comparison area */}
      <View className="flex-1 px-4">
        {mode === "blink" && <View className="flex-1">{renderImageView(activeFile)}</View>}

        {mode === "side-by-side" && (
          <View className="flex-1 flex-row gap-2">
            {renderImageView(activeFile)}
            {renderImageView(secondFile)}
          </View>
        )}

        {mode === "overlay" && (
          <View className="flex-1">
            <View className="flex-1 relative">
              {renderImageView(imageFiles[0])}
              {imageFiles.length > 1 && imageFiles[1]?.thumbnailUri && (
                <View className="absolute inset-0" style={{ opacity: overlayOpacity }}>
                  <Image
                    source={{ uri: imageFiles[1].thumbnailUri }}
                    className="w-full h-full"
                    resizeMode="contain"
                  />
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      <Separator className="my-1" />

      {/* Controls */}
      <View className="px-4 py-2">
        {mode === "blink" && (
          <View className="gap-2">
            {/* Playback controls */}
            <View className="flex-row items-center justify-center gap-3">
              <Pressable onPress={prevImage}>
                <Ionicons name="play-skip-back" size={20} color={mutedColor} />
              </Pressable>
              <Pressable onPress={toggleBlinkPlay}>
                <Ionicons
                  name={isBlinkPlaying ? "pause-circle" : "play-circle"}
                  size={36}
                  color={successColor}
                />
              </Pressable>
              <Pressable onPress={nextImage}>
                <Ionicons name="play-skip-forward" size={20} color={mutedColor} />
              </Pressable>
            </View>
            {/* Speed slider */}
            <View className="flex-row items-center gap-2">
              <Text className="text-[10px] text-muted w-10">{blinkSpeed.toFixed(1)}s</Text>
              <View className="flex-1">
                <SimpleSlider
                  label=""
                  value={blinkSpeed}
                  onValueChange={setBlinkSpeed}
                  min={0.3}
                  max={5}
                  step={0.1}
                />
              </View>
            </View>
          </View>
        )}

        {mode === "overlay" && (
          <View className="flex-row items-center gap-2">
            <Text className="text-[10px] text-muted w-14">
              {t("gallery.opacity")}: {(overlayOpacity * 100).toFixed(0)}%
            </Text>
            <View className="flex-1">
              <SimpleSlider
                label=""
                value={overlayOpacity}
                onValueChange={setOverlayOpacity}
                min={0}
                max={1}
                step={0.05}
              />
            </View>
          </View>
        )}

        {mode === "side-by-side" && (
          <View className="flex-row items-center justify-center">
            <Text className="text-[10px] text-muted">{t("gallery.sideBySideHint")}</Text>
          </View>
        )}
      </View>

      {/* Image selector strip */}
      <View className="px-4 pb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-1.5">
            {imageFiles.map((file, idx) => (
              <Pressable
                key={file?.id ?? idx}
                onPress={() => setActiveIndex(idx)}
                onLongPress={() => file && removeImage(file.id)}
                className={`rounded-lg overflow-hidden border-2 ${
                  idx === activeIndex ? "border-success" : "border-transparent"
                }`}
              >
                {file?.thumbnailUri ? (
                  <Image
                    source={{ uri: file.thumbnailUri }}
                    style={{ width: 48, height: 48 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    className="items-center justify-center bg-card"
                    style={{ width: 48, height: 48 }}
                  >
                    <Ionicons name="image-outline" size={20} color={mutedColor} />
                  </View>
                )}
                <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-0.5">
                  <Text className="text-[7px] text-white text-center" numberOfLines={1}>
                    {idx + 1}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
