/**
 * Astrometry.net 配置面板
 * 参考 settings.tsx 的 SettingsRow + OptionPickerModal 模式
 */

import { useState, useCallback } from "react";
import { View, Text, Alert } from "react-native";
import {
  Button,
  Card,
  Input,
  Label,
  Separator,
  Switch,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useAstrometry } from "../../hooks/useAstrometry";
import { SettingsRow } from "../common/SettingsRow";
import { OptionPickerModal } from "../common/OptionPickerModal";

const CONCURRENT_OPTIONS = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "5", value: 5 },
];

const SCALE_UNIT_OPTIONS = [
  { label: "degwidth", value: "degwidth" as const },
  { label: "arcminwidth", value: "arcminwidth" as const },
  { label: "arcsecperpix", value: "arcsecperpix" as const },
];

export function AstrometrySettings() {
  const { t } = useI18n();
  const { config, setConfig, saveApiKey, testConnection } = useAstrometry();
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [serverInput, setServerInput] = useState(config.serverUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"none" | "success" | "failed">("none");
  const [pickerType, setPickerType] = useState<"concurrent" | "scaleUnits" | null>(null);

  const handleSaveApiKey = useCallback(async () => {
    if (!apiKeyInput.trim()) return;
    await saveApiKey(apiKeyInput.trim());
    setApiKeyInput("");
    Alert.alert(t("common.success"), "API Key saved");
  }, [apiKeyInput, saveApiKey, t]);

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    setConnectionStatus("none");
    try {
      const ok = await testConnection();
      setConnectionStatus(ok ? "success" : "failed");
    } catch {
      setConnectionStatus("failed");
    } finally {
      setIsTesting(false);
    }
  }, [testConnection]);

  const handleSaveServer = useCallback(() => {
    if (serverInput.trim()) {
      setConfig({ serverUrl: serverInput.trim() });
    }
  }, [serverInput, setConfig]);

  return (
    <View className="gap-4">
      {/* API Key */}
      <Card>
        <Card.Header>
          <Card.Title>{t("astrometry.apiKey")}</Card.Title>
          <Card.Description>{t("astrometry.apiKeyHint")}</Card.Description>
        </Card.Header>
        <Card.Body className="px-4 pb-4 gap-3">
          <TextField>
            <Label>{t("astrometry.apiKey")}</Label>
            <Input
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="Enter your API key..."
              secureTextEntry
              autoCorrect={false}
            />
          </TextField>
          <View className="flex-row gap-2">
            <Button
              variant="primary"
              size="sm"
              onPress={handleSaveApiKey}
              isDisabled={!apiKeyInput.trim()}
            >
              <Button.Label>{t("common.save")}</Button.Label>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onPress={handleTestConnection}
              isDisabled={isTesting}
            >
              <Button.Label>
                {isTesting ? t("common.loading") : t("astrometry.testConnection")}
              </Button.Label>
            </Button>
          </View>
          {connectionStatus !== "none" && (
            <View className="flex-row items-center gap-1">
              <Ionicons
                name={connectionStatus === "success" ? "checkmark-circle" : "close-circle"}
                size={14}
                color={connectionStatus === "success" ? successColor : dangerColor}
              />
              <Text
                className={`text-xs ${connectionStatus === "success" ? "text-success" : "text-danger"}`}
              >
                {connectionStatus === "success"
                  ? t("astrometry.connectionSuccess")
                  : t("astrometry.connectionFailed")}
              </Text>
            </View>
          )}
          <Text className="text-[10px] text-muted">
            {config.apiKey ? `✓ ${t("astrometry.connected")}` : t("astrometry.disconnected")}
          </Text>
        </Card.Body>
      </Card>

      {/* 服务器设置 */}
      <Card>
        <Card.Header>
          <Card.Title>{t("astrometry.serverUrl")}</Card.Title>
        </Card.Header>
        <Card.Body className="px-4 pb-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-foreground">{t("astrometry.customServer")}</Text>
            <Switch
              isSelected={config.useCustomServer}
              onSelectedChange={(val: boolean) => setConfig({ useCustomServer: val })}
            >
              <Switch.Thumb />
            </Switch>
          </View>
          {config.useCustomServer && (
            <TextField>
              <Input
                value={serverInput}
                onChangeText={setServerInput}
                placeholder="https://your-server.com"
                onBlur={handleSaveServer}
                autoCorrect={false}
              />
            </TextField>
          )}
          {!config.useCustomServer && (
            <Text className="text-xs text-muted">https://nova.astrometry.net</Text>
          )}
        </Card.Body>
      </Card>

      {/* 解析参数 */}
      <Card>
        <Card.Header>
          <Card.Title>{t("astrometry.settings")}</Card.Title>
        </Card.Header>
        <Card.Body className="px-4 pb-4">
          <SettingsRow
            icon="layers-outline"
            label={t("astrometry.maxConcurrent")}
            value={String(config.maxConcurrent)}
            onPress={() => setPickerType("concurrent")}
          />
          <Separator />
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-3">
              <Ionicons name="flash-outline" size={18} color="#888" />
              <Text className="text-sm text-foreground">{t("astrometry.autoSolve")}</Text>
            </View>
            <Switch
              isSelected={config.autoSolve}
              onSelectedChange={(val: boolean) => setConfig({ autoSolve: val })}
            >
              <Switch.Thumb />
            </Switch>
          </View>
          <Separator />
          <SettingsRow
            icon="resize-outline"
            label={t("astrometry.scaleUnits")}
            value={config.defaultScaleUnits}
            onPress={() => setPickerType("scaleUnits")}
          />
          <Separator />
          <Text className="text-xs text-muted mt-2 mb-1 px-1">{t("astrometry.scaleHint")}</Text>
          <View className="flex-row gap-3 px-1 pb-2">
            <View className="flex-1">
              <TextField>
                <Label className="text-[10px]">{t("astrometry.scaleLower")}</Label>
                <Input
                  value={config.defaultScaleLower != null ? String(config.defaultScaleLower) : ""}
                  onChangeText={(v: string) => {
                    const num = parseFloat(v);
                    setConfig({ defaultScaleLower: isNaN(num) ? undefined : num });
                  }}
                  placeholder="e.g. 0.5"
                  keyboardType="decimal-pad"
                />
              </TextField>
            </View>
            <View className="flex-1">
              <TextField>
                <Label className="text-[10px]">{t("astrometry.scaleUpper")}</Label>
                <Input
                  value={config.defaultScaleUpper != null ? String(config.defaultScaleUpper) : ""}
                  onChangeText={(v: string) => {
                    const num = parseFloat(v);
                    setConfig({ defaultScaleUpper: isNaN(num) ? undefined : num });
                  }}
                  placeholder="e.g. 2.0"
                  keyboardType="decimal-pad"
                />
              </TextField>
            </View>
          </View>
        </Card.Body>
      </Card>

      {/* Picker Modals */}
      <OptionPickerModal
        visible={pickerType === "concurrent"}
        title={t("astrometry.maxConcurrent")}
        options={CONCURRENT_OPTIONS}
        selectedValue={config.maxConcurrent}
        onSelect={(val) => {
          setConfig({ maxConcurrent: val as number });
          setPickerType(null);
        }}
        onClose={() => setPickerType(null)}
      />
      <OptionPickerModal
        visible={pickerType === "scaleUnits"}
        title={t("astrometry.scaleUnits")}
        options={SCALE_UNIT_OPTIONS}
        selectedValue={config.defaultScaleUnits}
        onSelect={(val) => {
          setConfig({ defaultScaleUnits: val as "degwidth" | "arcminwidth" | "arcsecperpix" });
          setPickerType(null);
        }}
        onClose={() => setPickerType(null)}
      />
    </View>
  );
}
