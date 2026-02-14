/**
 * 添加云服务选择器组件
 */

import { View, Text } from "react-native";
import { BottomSheet, PressableFeedback, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { CloudProvider } from "../../lib/backup/types";
import { PROVIDER_DISPLAY } from "../../lib/backup/types";

const ALL_PROVIDERS: CloudProvider[] = ["google-drive", "onedrive", "dropbox", "webdav"];

interface AddProviderSheetProps {
  visible: boolean;
  existingProviders: CloudProvider[];
  onSelect: (provider: CloudProvider) => void;
  onClose: () => void;
}

export function AddProviderSheet({
  visible,
  existingProviders,
  onSelect,
  onClose,
}: AddProviderSheetProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const availableProviders = ALL_PROVIDERS.filter((p) => !existingProviders.includes(p));

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="flex-row items-center justify-between mb-2">
            <BottomSheet.Title>{t("backup.addProvider")}</BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          {availableProviders.length === 0 ? (
            <BottomSheet.Description className="py-4 text-center">
              {t("backup.allProvidersConnected")}
            </BottomSheet.Description>
          ) : (
            availableProviders.map((provider, index) => {
              const display = PROVIDER_DISPLAY[provider];
              return (
                <View key={provider}>
                  {index > 0 && <Separator className="my-1" />}
                  <PressableFeedback
                    className="flex-row items-center gap-3 rounded-lg py-3"
                    onPress={() => onSelect(provider)}
                  >
                    <PressableFeedback.Highlight />
                    <View
                      className="h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: display.color + "20" }}
                    >
                      <Ionicons
                        name={display.icon as keyof typeof Ionicons.glyphMap}
                        size={22}
                        color={display.color}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">{display.name}</Text>
                      <Text className="text-xs text-muted">
                        {t(`backup.${provider === "google-drive" ? "googleDrive" : provider}Desc`)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={mutedColor} />
                  </PressableFeedback>
                </View>
              );
            })
          )}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
