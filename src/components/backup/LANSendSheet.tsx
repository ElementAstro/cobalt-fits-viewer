/**
 * 局域网传输 - 发送端 UI
 * 显示 IP:Port + PIN + 连接状态
 */

import { View, Text } from "react-native";
import { Button, Dialog, Spinner } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { LANSendStatus } from "../../hooks/useLANTransfer";
import type { LANServerInfo } from "../../lib/backup/lanTransfer";

interface LANSendSheetProps {
  visible: boolean;
  status: LANSendStatus;
  info: LANServerInfo | null;
  error: string | null;
  onStop: () => void;
  onClose: () => void;
}

export function LANSendSheet({ visible, status, info, error, onStop, onClose }: LANSendSheetProps) {
  const { t } = useI18n();

  const handleClose = () => {
    onStop();
    onClose();
  };

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <View className="mb-4 flex-row items-center justify-between">
            <Dialog.Title>{t("backup.lanSend")}</Dialog.Title>
            <Dialog.Close />
          </View>

          {status === "preparing" && (
            <View className="items-center gap-4 py-6">
              <Spinner size="lg" />
              <Text className="text-sm text-muted">{t("backup.lanPreparing")}</Text>
            </View>
          )}

          {status === "ready" && info && (
            <View className="gap-4">
              <Text className="text-center text-xs text-muted">
                {t("backup.lanSendInstructions")}
              </Text>

              {/* Connection info card */}
              <View className="items-center gap-3 rounded-xl bg-secondary/50 px-4 py-5">
                <Ionicons name="wifi" size={32} color="#2ECC71" />
                <Text className="text-lg font-bold text-foreground">
                  {info.ip}:{info.port}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-muted">PIN:</Text>
                  <Text className="text-2xl font-bold tracking-widest text-accent">{info.pin}</Text>
                </View>
              </View>

              {/* Info summary */}
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-sm font-bold text-foreground">{info.fileCount}</Text>
                  <Text className="text-xs text-muted">{t("backup.summaryFiles")}</Text>
                </View>
                <View className="items-center">
                  <Text className="text-sm font-bold text-foreground">
                    {Math.round(info.estimatedSize / 1024 / 1024)}MB
                  </Text>
                  <Text className="text-xs text-muted">{t("backup.summaryEstimatedSize")}</Text>
                </View>
              </View>

              <Text className="text-center text-xs text-muted">{t("backup.lanWaiting")}</Text>
            </View>
          )}

          {status === "error" && (
            <View className="items-center gap-3 py-4">
              <Ionicons name="alert-circle" size={32} color="#ef4444" />
              <Text className="text-center text-sm text-danger">{error}</Text>
            </View>
          )}

          <Button variant="outline" className="mt-4" onPress={handleClose}>
            <Button.Label>
              {status === "ready" ? t("backup.lanStopServer") : t("common.cancel")}
            </Button.Label>
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
