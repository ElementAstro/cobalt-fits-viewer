/**
 * 局域网传输 - 接收端 UI
 * 手动输入 IP:Port + PIN 连接并下载
 */

import { useState } from "react";
import { View, Text } from "react-native";
import { Button, Dialog, Input, Label, Spinner, Surface, TextField } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { LANReceiveStatus } from "../../hooks/useLANTransfer";
import type { BackupProgress } from "../../lib/backup/types";
import { formatFileSize } from "../../lib/utils/fileManager";

interface LANReceiveSheetProps {
  visible: boolean;
  status: LANReceiveStatus;
  progress: BackupProgress;
  error: string | null;
  onConnect: (host: string, port: number, pin: string) => void;
  onClose: () => void;
}

export function LANReceiveSheet({
  visible,
  status,
  progress,
  error,
  onConnect,
  onClose,
}: LANReceiveSheetProps) {
  const { t } = useI18n();

  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [pin, setPin] = useState("");

  const handleConnect = () => {
    if (!host || !pin) return;
    const portNum = parseInt(port, 10) || 18080;
    onConnect(host, portNum, pin);
  };

  const handleClose = () => {
    setHost("");
    setPort("");
    setPin("");
    onClose();
  };

  const isConnecting =
    status === "connecting" || status === "downloading" || status === "importing";

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const hasByteProgress =
    progress.bytesTransferred != null && progress.bytesTotal != null && progress.bytesTotal > 0;
  const bytePercentage = hasByteProgress
    ? Math.round((progress.bytesTransferred! / progress.bytesTotal!) * 100)
    : percentage;

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <View className="mb-4 flex-row items-center justify-between">
            <Dialog.Title>{t("backup.lanReceive")}</Dialog.Title>
            <Dialog.Close />
          </View>

          {status === "idle" && (
            <View className="gap-3">
              <Text className="text-xs text-muted">{t("backup.lanReceiveInstructions")}</Text>

              <TextField isRequired className="mb-1">
                <Label>{t("backup.lanHost")}</Label>
                <Input
                  value={host}
                  onChangeText={setHost}
                  placeholder="192.168.1.100"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </TextField>

              <TextField className="mb-1">
                <Label>{t("backup.lanPort")}</Label>
                <Input
                  value={port}
                  onChangeText={setPort}
                  placeholder="18080"
                  keyboardType="number-pad"
                />
              </TextField>

              <TextField isRequired className="mb-1">
                <Label>PIN</Label>
                <Input
                  value={pin}
                  onChangeText={setPin}
                  placeholder="1234"
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </TextField>

              <Button
                variant="primary"
                className="mt-2"
                onPress={handleConnect}
                isDisabled={!host || !pin}
              >
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Button.Label>{t("backup.lanStartReceive")}</Button.Label>
              </Button>
            </View>
          )}

          {isConnecting && (
            <View className="items-center gap-4 py-4">
              <Spinner size="lg" />
              <Text className="text-sm text-muted">
                {status === "connecting"
                  ? t("backup.lanConnecting")
                  : status === "downloading"
                    ? t("backup.lanDownloading")
                    : t("backup.lanImporting")}
              </Text>

              {progress.total > 0 && (
                <>
                  <Surface variant="secondary" className="h-2 w-full overflow-hidden rounded-full">
                    <View
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${bytePercentage}%` }}
                    />
                  </Surface>
                  <Text className="text-xs text-muted">
                    {progress.current} / {progress.total} ({bytePercentage}%)
                  </Text>
                  {hasByteProgress && (
                    <Text className="text-xs text-muted">
                      {formatFileSize(progress.bytesTransferred!)} /{" "}
                      {formatFileSize(progress.bytesTotal!)}
                    </Text>
                  )}
                </>
              )}
            </View>
          )}

          {status === "done" && (
            <View className="items-center gap-3 py-4">
              <Ionicons name="checkmark-circle" size={40} color="#22c55e" />
              <Text className="text-sm font-medium text-foreground">
                {t("backup.lanReceiveComplete")}
              </Text>
            </View>
          )}

          {status === "error" && (
            <View className="items-center gap-3 py-4">
              <Ionicons name="alert-circle" size={40} color="#ef4444" />
              <Text className="text-center text-sm text-danger">{error}</Text>
              <Button variant="outline" size="sm" onPress={onClose}>
                <Button.Label>{t("common.close")}</Button.Label>
              </Button>
            </View>
          )}

          {(status === "done" || status === "idle") && (
            <Button variant="outline" className="mt-3" onPress={handleClose}>
              <Button.Label>{t("common.close")}</Button.Label>
            </Button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
