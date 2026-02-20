/**
 * 云服务商卡片组件
 */

import { View, Text } from "react-native";
import { Button, Card, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { ProviderConnectionState } from "../../lib/backup/types";
import { PROVIDER_DISPLAY } from "../../lib/backup/types";
import { formatFileSize } from "../../lib/utils/fileManager";

interface ProviderCardProps {
  connection: ProviderConnectionState;
  isActive?: boolean;
  onBackup: () => void;
  onRestore: () => void;
  onDisconnect: () => void;
  disabled?: boolean;
}

export function ProviderCard({
  connection,
  isActive = false,
  onBackup,
  onRestore,
  onDisconnect,
  disabled,
}: ProviderCardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const display = PROVIDER_DISPLAY[connection.provider];

  const lastBackupText = connection.lastBackupDate
    ? new Date(connection.lastBackupDate).toLocaleDateString()
    : t("backup.never");

  const quotaText =
    connection.quotaUsed != null && connection.quotaTotal != null
      ? `${formatFileSize(connection.quotaUsed)} / ${formatFileSize(connection.quotaTotal)}`
      : null;

  const isActionDisabled = disabled || !connection.connected;

  return (
    <Card className="mb-3">
      <Card.Header className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
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
          <View>
            <Card.Title className="text-sm">{display.name}</Card.Title>
            {connection.userName && (
              <Card.Description className="text-xs">{connection.userName}</Card.Description>
            )}
          </View>
        </View>
        <Chip size="sm" variant="soft" color={connection.connected ? "success" : "default"}>
          <Chip.Label>
            {connection.connected ? t("backup.connected") : t("backup.disconnected")}
          </Chip.Label>
        </Chip>
      </Card.Header>

      <Card.Body>
        {/* Info row */}
        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-muted">{t("backup.lastBackup")}</Text>
            <Text className="text-xs text-foreground">{lastBackupText}</Text>
          </View>
          {quotaText && (
            <View className="items-end">
              <Text className="text-xs text-muted">{t("backup.storageUsed")}</Text>
              <Text className="text-xs text-foreground">{quotaText}</Text>
            </View>
          )}
        </View>
        {isActive && (
          <View className="mt-2">
            <Chip size="sm" variant="primary">
              <Chip.Label>{t("backup.activeProvider")}</Chip.Label>
            </Chip>
          </View>
        )}
      </Card.Body>

      <Card.Footer className="flex-row gap-2">
        <View className="flex-1">
          <Button variant="primary" size="sm" onPress={onBackup} isDisabled={isActionDisabled}>
            <Button.Label>{t("backup.backupNow")}</Button.Label>
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="outline" size="sm" onPress={onRestore} isDisabled={isActionDisabled}>
            <Button.Label>{t("backup.restoreNow")}</Button.Label>
          </Button>
        </View>
        <Button variant="ghost" size="sm" isIconOnly onPress={onDisconnect}>
          <Ionicons name="log-out-outline" size={16} color={mutedColor} />
        </Button>
      </Card.Footer>
    </Card>
  );
}
