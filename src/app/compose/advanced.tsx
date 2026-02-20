import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Accordion,
  Button,
  Card,
  Dialog,
  FieldError,
  Input,
  Select,
  Separator,
  Switch,
  Tabs,
  TextArea,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { FitsCanvas } from "../../components/fits/FitsCanvas";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useAdvancedCompose } from "../../hooks/useAdvancedCompose";
import type {
  CompositeBlendMode,
  CompositeColorSpace,
  CompositePreset,
} from "../../lib/composite/types";

const PRESET_OPTIONS: Array<{ value: CompositePreset; label: string }> = [
  { value: "rgb", label: "RGB" },
  { value: "lrgb", label: "LRGB" },
  { value: "sho", label: "SHO" },
  { value: "hoo", label: "HOO" },
  { value: "hos", label: "HOS" },
  { value: "custom", label: "Custom" },
];

const BLEND_MODE_OPTIONS: Array<{ value: CompositeBlendMode; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

const COLOR_SPACE_OPTIONS: Array<{ value: CompositeColorSpace; label: string }> = [
  { value: "hsl", label: "HSL" },
  { value: "hsv", label: "HSV/HSB" },
  { value: "lab", label: "CIE L*a*b*" },
];

export default function AdvancedComposeScreen() {
  useKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{ sourceId?: string }>();
  const { t } = useI18n();
  const [successColor] = useThemeColor(["success"]);
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const haptics = useHapticFeedback();

  const files = useFitsStore((s) => s.files).filter(
    (file) => file.mediaKind !== "video" && file.mediaKind !== "audio",
  );

  const compose = useAdvancedCompose();

  const [activeTab, setActiveTab] = useState("layers");
  const [pickerLayerId, setPickerLayerId] = useState<string | null>(null);
  const [exportFormats, setExportFormats] = useState<{ png: boolean; tiff: boolean }>({
    png: true,
    tiff: false,
  });

  const displayResult = compose.fullResult ?? compose.previewResult;
  const pixelMathError = compose.pixelMathError;
  const pixelMathErrorText = useMemo(() => {
    if (!pixelMathError) return null;
    const position =
      typeof pixelMathError.row === "number" && typeof pixelMathError.column === "number"
        ? ` (row ${pixelMathError.row}, col ${pixelMathError.column})`
        : "";
    return `${pixelMathError.message}${position}`;
  }, [pixelMathError]);

  useEffect(() => {
    if (!params.sourceId) return;
    const sourceFile = files.find((file) => file.id === params.sourceId);
    const firstLayer = compose.project.layers[0];
    if (!sourceFile || !firstLayer || firstLayer.fileId) return;
    void compose.loadLayerFile(
      firstLayer.id,
      sourceFile.id,
      sourceFile.filepath,
      sourceFile.filename,
    );
  }, [compose, files, params.sourceId]);

  const handleRender = useCallback(async () => {
    await compose.renderTwoPass();
    haptics.impact();
  }, [compose, haptics]);

  const handleSave = useCallback(async () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extraFormats = (["png", "tiff"] as const).filter((format) => exportFormats[format]);
    const saved = await compose.saveComposite(`compose_advanced_${stamp}`, [...extraFormats]);
    if (saved?.id) {
      haptics.notify(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.success"), t("compose.imageSaved"), [
        {
          text: t("common.confirm"),
          onPress: () => router.push(`/viewer/${saved.id}`),
        },
      ]);
      return;
    }
    haptics.notify(Haptics.NotificationFeedbackType.Warning);
  }, [compose, exportFormats, haptics, router, t]);

  const previewModeValue = useMemo(
    () => ({
      value: compose.project.options.previewMode,
      label: compose.project.options.previewMode,
    }),
    [compose.project.options.previewMode],
  );

  return (
    <View testID="e2e-screen-compose__advanced" className="flex-1 bg-background">
      <View
        className="flex-row items-center justify-between border-b border-separator px-4 pb-2"
        style={{ paddingTop: contentPaddingTop }}
      >
        <Button variant="ghost" onPress={() => router.back()}>
          <Button.Label>{t("common.back")}</Button.Label>
        </Button>
        <Text className="text-base font-semibold text-foreground">
          {t("composeAdvanced.title")}
        </Text>
        <View className="flex-row gap-2">
          <Button
            testID="e2e-action-compose__advanced-render"
            variant="secondary"
            onPress={handleRender}
          >
            <Button.Label>{t("composeAdvanced.render")}</Button.Label>
          </Button>
          <Button testID="e2e-action-compose__advanced-save" variant="primary" onPress={handleSave}>
            <Button.Label>{t("composeAdvanced.save")}</Button.Label>
          </Button>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="px-4 pt-3" style={{ paddingHorizontal: horizontalPadding }}>
          <Card variant="secondary" className="mb-3 overflow-hidden">
            <View className="h-72 bg-black">
              {displayResult ? (
                <FitsCanvas
                  rgbaData={displayResult.rgbaData}
                  width={displayResult.width}
                  height={displayResult.height}
                  showGrid={false}
                  showCrosshair={false}
                  cursorX={0}
                  cursorY={0}
                  interactionEnabled={true}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-sm text-muted">{t("compose.rgbPreview")}</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center justify-between px-3 py-2">
              <Text className="text-xs text-muted">
                {compose.assignedCount}/8 {t("composeAdvanced.layersAssigned")}
              </Text>
              <Select
                value={previewModeValue}
                onValueChange={(value) => {
                  if (!value) return;
                  compose.updateOptions({
                    previewMode: value.value as typeof compose.project.options.previewMode,
                  });
                }}
              >
                <Select.Trigger className="min-w-[130px]">
                  <Select.Value placeholder="Mode" />
                  <Select.TriggerIndicator />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Overlay />
                  <Select.Content presentation="popover">
                    {["composite", "r", "g", "b", "l", "split"].map((mode) => (
                      <Select.Item key={mode} value={mode} label={mode.toUpperCase()}>
                        <Select.ItemLabel />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select>
            </View>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} variant="primary">
            <Tabs.List>
              <Tabs.ScrollView>
                <Tabs.Indicator />
                <Tabs.Trigger value="layers">
                  <Tabs.Label>{t("composeAdvanced.layers")}</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger value="registration">
                  <Tabs.Label>{t("composeAdvanced.registration")}</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger value="pixelmath">
                  <Tabs.Label>PixelMath</Tabs.Label>
                </Tabs.Trigger>
                <Tabs.Trigger value="output">
                  <Tabs.Label>{t("composeAdvanced.output")}</Tabs.Label>
                </Tabs.Trigger>
              </Tabs.ScrollView>
            </Tabs.List>

            <Tabs.Content value="layers">
              <View className="mt-3 gap-3">
                <Card variant="secondary" className="p-3">
                  <Text className="mb-2 text-xs text-muted">{t("compose.preset")}</Text>
                  <Select
                    value={{
                      value: compose.project.preset,
                      label: compose.project.preset.toUpperCase(),
                    }}
                    onValueChange={(value) => {
                      if (!value) return;
                      compose.setPreset(value.value as CompositePreset);
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Preset" />
                      <Select.TriggerIndicator />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Overlay />
                      <Select.Content presentation="popover">
                        {PRESET_OPTIONS.map((preset) => (
                          <Select.Item key={preset.value} value={preset.value} label={preset.label}>
                            <Select.ItemLabel />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Portal>
                  </Select>
                </Card>

                <Button
                  testID="e2e-action-compose__advanced-add-layer"
                  variant="outline"
                  onPress={compose.addLayer}
                >
                  <Button.Label>{t("composeAdvanced.addLayer")}</Button.Label>
                </Button>

                <Accordion
                  selectionMode="multiple"
                  variant="surface"
                  defaultValue={compose.project.layers.map((l) => l.id)}
                >
                  {compose.project.layers.map((layer, index) => (
                    <Accordion.Item key={layer.id} value={layer.id}>
                      <Accordion.Trigger>
                        <View className="flex-row items-center gap-2">
                          <Ionicons
                            name={layer.fileId ? "checkmark-circle" : "ellipse-outline"}
                            size={16}
                            color={layer.fileId ? successColor : "#888"}
                          />
                          <Text className="text-sm font-medium text-foreground">
                            L{index + 1} {layer.filename ? `· ${layer.filename}` : ""}
                          </Text>
                        </View>
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                      <Accordion.Content>
                        <View className="gap-2 pb-2">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-xs text-muted">
                              {t("composeAdvanced.enabled")}
                            </Text>
                            <Switch
                              isSelected={layer.enabled}
                              onSelectedChange={(value: boolean) =>
                                compose.updateLayer(layer.id, { enabled: value })
                              }
                            />
                          </View>
                          <View className="flex-row items-center justify-between">
                            <Text className="text-xs text-muted">
                              {t("composeAdvanced.luminance")}
                            </Text>
                            <Switch
                              isSelected={layer.isLuminance}
                              onSelectedChange={(value: boolean) =>
                                compose.updateLayer(layer.id, { isLuminance: value })
                              }
                            />
                          </View>
                          <View className="flex-row items-center justify-between">
                            <Text className="text-xs text-muted">
                              {t("composeAdvanced.useForLinearMatch")}
                            </Text>
                            <Switch
                              isSelected={layer.useForLinearMatch}
                              onSelectedChange={(value: boolean) =>
                                compose.updateLayer(layer.id, { useForLinearMatch: value })
                              }
                            />
                          </View>
                          <View className="flex-row items-center justify-between">
                            <Text className="text-xs text-muted">
                              {t("composeAdvanced.useForBrightnessBalance")}
                            </Text>
                            <Switch
                              isSelected={layer.useForBrightnessBalance}
                              onSelectedChange={(value: boolean) =>
                                compose.updateLayer(layer.id, { useForBrightnessBalance: value })
                              }
                            />
                          </View>

                          <Button variant="secondary" onPress={() => setPickerLayerId(layer.id)}>
                            <Button.Label>
                              {layer.fileId
                                ? t("composeAdvanced.replaceFile")
                                : t("composeAdvanced.selectFile")}
                            </Button.Label>
                          </Button>

                          <Text className="text-xs text-muted">
                            {t("composeAdvanced.blendMode")}
                          </Text>
                          <Select
                            value={{ value: layer.blendMode, label: layer.blendMode }}
                            onValueChange={(value) => {
                              if (!value) return;
                              compose.updateLayer(layer.id, {
                                blendMode: value.value as CompositeBlendMode,
                              });
                            }}
                          >
                            <Select.Trigger>
                              <Select.Value placeholder="Blend mode" />
                              <Select.TriggerIndicator />
                            </Select.Trigger>
                            <Select.Portal>
                              <Select.Overlay />
                              <Select.Content presentation="popover">
                                {BLEND_MODE_OPTIONS.map((mode) => (
                                  <Select.Item
                                    key={mode.value}
                                    value={mode.value}
                                    label={mode.label}
                                  >
                                    <Select.ItemLabel />
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select.Portal>
                          </Select>

                          <SimpleSlider
                            label="Opacity"
                            value={layer.opacity}
                            min={0}
                            max={1}
                            step={0.05}
                            onValueChange={(value) =>
                              compose.updateLayer(layer.id, { opacity: clamp(value) })
                            }
                          />

                          <SimpleSlider
                            label="Tint R"
                            value={layer.tint.r}
                            min={0}
                            max={1}
                            step={0.05}
                            onValueChange={(value) =>
                              compose.updateLayer(layer.id, {
                                tint: { ...layer.tint, r: clamp(value) },
                              })
                            }
                          />
                          <SimpleSlider
                            label="Tint G"
                            value={layer.tint.g}
                            min={0}
                            max={1}
                            step={0.05}
                            onValueChange={(value) =>
                              compose.updateLayer(layer.id, {
                                tint: { ...layer.tint, g: clamp(value) },
                              })
                            }
                          />
                          <SimpleSlider
                            label="Tint B"
                            value={layer.tint.b}
                            min={0}
                            max={1}
                            step={0.05}
                            onValueChange={(value) =>
                              compose.updateLayer(layer.id, {
                                tint: { ...layer.tint, b: clamp(value) },
                              })
                            }
                          />

                          <View className="flex-row justify-end">
                            <Button variant="ghost" onPress={() => compose.removeLayer(layer.id)}>
                              <Button.Label>{t("common.delete")}</Button.Label>
                            </Button>
                          </View>
                        </View>
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </View>
            </Tabs.Content>

            <Tabs.Content value="registration">
              <Card variant="secondary" className="mt-3 p-3">
                <Text className="mb-2 text-xs text-muted">{t("composeAdvanced.registration")}</Text>
                <View className="mb-2 flex-row gap-2">
                  {["none", "translation", "full"].map((mode) => (
                    <Button
                      key={mode}
                      variant={compose.project.registration.mode === mode ? "primary" : "outline"}
                      onPress={() =>
                        compose.updateRegistration({
                          mode: mode as typeof compose.project.registration.mode,
                        })
                      }
                    >
                      <Button.Label>{mode}</Button.Label>
                    </Button>
                  ))}
                </View>
                <Text className="mb-2 text-xs text-muted">{t("composeAdvanced.framing")}</Text>
                <View className="mb-2 flex-row gap-2">
                  {["first", "min", "cog"].map((mode) => (
                    <Button
                      key={mode}
                      variant={
                        compose.project.registration.framing === mode ? "primary" : "outline"
                      }
                      onPress={() =>
                        compose.updateRegistration({
                          framing: mode as typeof compose.project.registration.framing,
                        })
                      }
                    >
                      <Button.Label>{mode.toUpperCase()}</Button.Label>
                    </Button>
                  ))}
                </View>
                <Separator className="my-2" />
                <Button variant="secondary" onPress={compose.runRegistration}>
                  <Button.Label>{t("composeAdvanced.runRegistration")}</Button.Label>
                </Button>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="pixelmath">
              <Card variant="secondary" className="mt-3 p-3">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-foreground">PixelMath</Text>
                  <Switch
                    isSelected={compose.project.options.applyPixelMath}
                    onSelectedChange={(value: boolean) =>
                      compose.updateOptions({ applyPixelMath: value })
                    }
                  />
                </View>
                <TextField className="mb-2">
                  <Input
                    value={compose.project.options.pixelMath.r}
                    onChangeText={(value) =>
                      compose.updateOptions({
                        pixelMath: { ...compose.project.options.pixelMath, r: value },
                      })
                    }
                    placeholder="R expression"
                  />
                </TextField>
                <TextField className="mb-2">
                  <Input
                    value={compose.project.options.pixelMath.g}
                    onChangeText={(value) =>
                      compose.updateOptions({
                        pixelMath: { ...compose.project.options.pixelMath, g: value },
                      })
                    }
                    placeholder="G expression"
                  />
                </TextField>
                <TextField>
                  <TextArea
                    value={compose.project.options.pixelMath.b}
                    onChangeText={(value) =>
                      compose.updateOptions({
                        pixelMath: { ...compose.project.options.pixelMath, b: value },
                      })
                    }
                    placeholder="B expression"
                    numberOfLines={3}
                  />
                  {pixelMathErrorText ? <FieldError>{pixelMathErrorText}</FieldError> : null}
                </TextField>
              </Card>
            </Tabs.Content>

            <Tabs.Content value="output">
              <Card variant="secondary" className="mt-3 p-3">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs text-muted">{t("composeAdvanced.autoLinearMatch")}</Text>
                  <Switch
                    isSelected={compose.project.options.autoLinearMatch}
                    onSelectedChange={(value: boolean) =>
                      compose.updateOptions({ autoLinearMatch: value })
                    }
                  />
                </View>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs text-muted">
                    {t("composeAdvanced.autoBrightnessBalance")}
                  </Text>
                  <Switch
                    isSelected={compose.project.options.autoBrightnessBalance}
                    onSelectedChange={(value: boolean) =>
                      compose.updateOptions({ autoBrightnessBalance: value })
                    }
                  />
                </View>
                <SimpleSlider
                  label="Preview Scale"
                  value={compose.project.options.previewScale}
                  min={0.1}
                  max={1}
                  step={0.05}
                  onValueChange={(value) => compose.updateOptions({ previewScale: clamp(value) })}
                />
                <SimpleSlider
                  label="Split"
                  value={compose.project.options.splitPosition}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(value) => compose.updateOptions({ splitPosition: clamp(value) })}
                />
                <Separator className="my-2" />
                <Text className="mb-2 text-xs text-muted">{t("composeAdvanced.colorSpace")}</Text>
                <Select
                  value={{
                    value: compose.project.options.colorSpace,
                    label: compose.project.options.colorSpace.toUpperCase(),
                  }}
                  onValueChange={(value) => {
                    if (!value) return;
                    compose.updateOptions({ colorSpace: value.value as CompositeColorSpace });
                  }}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Color space" />
                    <Select.TriggerIndicator />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Overlay />
                    <Select.Content presentation="popover">
                      {COLOR_SPACE_OPTIONS.map((space) => (
                        <Select.Item key={space.value} value={space.value} label={space.label}>
                          <Select.ItemLabel />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Portal>
                </Select>
                <Separator className="my-2" />
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs text-muted">{t("composeAdvanced.exportPng")}</Text>
                  <Switch
                    isSelected={exportFormats.png}
                    onSelectedChange={(value: boolean) =>
                      setExportFormats((prev) => ({ ...prev, png: value }))
                    }
                  />
                </View>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs text-muted">{t("composeAdvanced.exportTiff")}</Text>
                  <Switch
                    isSelected={exportFormats.tiff}
                    onSelectedChange={(value: boolean) =>
                      setExportFormats((prev) => ({ ...prev, tiff: value }))
                    }
                  />
                </View>
                <Separator className="my-2" />
                <Button
                  variant="outline"
                  onPress={() => compose.shareComposite("compose_advanced")}
                >
                  <Button.Label>{t("composeAdvanced.share")}</Button.Label>
                </Button>
              </Card>
            </Tabs.Content>
          </Tabs>

          {compose.error ? <Text className="mt-3 text-sm text-danger">{compose.error}</Text> : null}
        </View>
      </ScrollView>

      <Dialog isOpen={!!pickerLayerId} onOpenChange={(open) => !open && setPickerLayerId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Title>{t("composeAdvanced.selectFile")}</Dialog.Title>
            <ScrollView className="max-h-80">
              {files.map((file) => (
                <Button
                  key={file.id}
                  variant="ghost"
                  className="mb-1 justify-start"
                  onPress={async () => {
                    if (!pickerLayerId) return;
                    await compose.loadLayerFile(
                      pickerLayerId,
                      file.id,
                      file.filepath,
                      file.filename,
                    );
                    setPickerLayerId(null);
                  }}
                >
                  <Button.Label>{file.filename}</Button.Label>
                </Button>
              ))}
            </ScrollView>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
