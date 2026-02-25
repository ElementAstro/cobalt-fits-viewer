/**
 * 局域网传输 - 接收端 UI
 * 手动输入 IP:Port + PIN 连接并下载
 */

import { useState } from "react";
import { View, Text } from "react-native";
import {
  Button,
  Dialog,
  FieldError,
  Input,
  Label,
  Spinner,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { LANReceiveStatus } from "../../hooks/useLANTransfer";
import type { BackupProgress } from "../../lib/backup/types";
import { LAN_PORT_BASE } from "../../lib/backup/lanTransfer";
import { BackupProgressDisplay } from "./BackupProgressDisplay";

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
  const successColor = useThemeColor("success");
  const dangerColor = useThemeColor("danger");
  const foregroundColor = useThemeColor("foreground");

  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [pin, setPin] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!host.trim()) {
      errors.host = t("backup.lanHostRequired");
    } else if (!/^[\w.-]+$/.test(host.trim())) {
      errors.host = t("backup.lanHostInvalid");
    }
    if (port.trim()) {
      const portNum = parseInt(port, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        errors.port = t("backup.lanPortInvalid");
      }
    }
    if (!pin.trim()) {
      errors.pin = t("backup.lanPinRequired");
    } else if (!/^\d{4}$/.test(pin.trim())) {
      errors.pin = t("backup.lanPinInvalid");
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConnect = () => {
    if (!validate()) return;
    const portNum = parseInt(port, 10) || LAN_PORT_BASE;
    onConnect(host.trim(), portNum, pin.trim());
  };

  const handleClose = () => {
    setHost("");
    setPort("");
    setPin("");
    setValidationErrors({});
    onClose();
  };

  const isConnecting =
    status === "connecting" || status === "downloading" || status === "importing";

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

              <TextField isRequired isInvalid={!!validationErrors.host} className="mb-1">
                <Label>{t("backup.lanHost")}</Label>
                <Input
                  value={host}
                  onChangeText={setHost}
                  placeholder="192.168.1.100"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                {validationErrors.host && <FieldError>{validationErrors.host}</FieldError>}
              </TextField>

              <TextField isInvalid={!!validationErrors.port} className="mb-1">
                <Label>{t("backup.lanPort")}</Label>
                <Input
                  value={port}
                  onChangeText={setPort}
                  placeholder="18080"
                  keyboardType="number-pad"
                />
                {validationErrors.port && <FieldError>{validationErrors.port}</FieldError>}
              </TextField>

              <TextField isRequired isInvalid={!!validationErrors.pin} className="mb-1">
                <Label>PIN</Label>
                <Input
                  value={pin}
                  onChangeText={setPin}
                  placeholder="1234"
                  keyboardType="number-pad"
                  maxLength={4}
                />
                {validationErrors.pin && <FieldError>{validationErrors.pin}</FieldError>}
              </TextField>

              <Button
                variant="primary"
                className="mt-2"
                onPress={handleConnect}
                isDisabled={!host.trim() || !pin.trim()}
              >
                <Ionicons name="download-outline" size={16} color={foregroundColor} />
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

              <BackupProgressDisplay progress={progress} />
            </View>
          )}

          {status === "done" && (
            <View className="items-center gap-3 py-4">
              <Ionicons name="checkmark-circle" size={40} color={successColor} />
              <Text className="text-sm font-medium text-foreground">
                {t("backup.lanReceiveComplete")}
              </Text>
            </View>
          )}

          {status === "error" && (
            <View className="items-center gap-3 py-4">
              <Ionicons name="alert-circle" size={40} color={dangerColor} />
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
