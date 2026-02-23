/**
 * SFTP 配置表单组件
 */

import { useState } from "react";
import { View } from "react-native";
import { Alert, Button, Dialog, FieldError, Input, Label, Spinner, TextField } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

interface SFTPConfigSheetProps {
  visible: boolean;
  onConnect: (
    host: string,
    port: number,
    username: string,
    password: string,
    remotePath: string,
  ) => Promise<boolean>;
  onClose: () => void;
}

export function SFTPConfigSheet({ visible, onConnect, onClose }: SFTPConfigSheetProps) {
  const { t } = useI18n();

  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remotePath, setRemotePath] = useState("/");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const handleConnect = async () => {
    if (!host || !username) return;

    setTesting(true);
    setTestResult(null);

    try {
      const portNum = parseInt(port, 10) || 22;
      const success = await onConnect(host, portNum, username, password, remotePath);
      setTestResult(success);
      if (success) {
        setTimeout(onClose, 1000);
      }
    } catch {
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setHost("");
    setPort("22");
    setUsername("");
    setPassword("");
    setRemotePath("/");
    setTestResult(null);
    onClose();
  };

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <View className="mb-4 flex-row items-center justify-between">
            <Dialog.Title>SFTP</Dialog.Title>
            <Dialog.Close />
          </View>

          {/* Host */}
          <TextField isRequired isInvalid={testResult === false && !host} className="mb-3">
            <Label>{t("backup.sftpHost")}</Label>
            <Input
              value={host}
              onChangeText={setHost}
              placeholder="192.168.1.100 or nas.example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {testResult === false && !host && <FieldError>{t("backup.sftpHost")}</FieldError>}
          </TextField>

          {/* Port */}
          <TextField className="mb-3">
            <Label>{t("backup.sftpPort")}</Label>
            <Input value={port} onChangeText={setPort} placeholder="22" keyboardType="number-pad" />
          </TextField>

          {/* Username */}
          <TextField isRequired isInvalid={testResult === false && !username} className="mb-3">
            <Label>{t("backup.sftpUsername")}</Label>
            <Input
              value={username}
              onChangeText={setUsername}
              placeholder={t("backup.sftpUsername")}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {testResult === false && !username && (
              <FieldError>{t("backup.sftpUsername")}</FieldError>
            )}
          </TextField>

          {/* Password */}
          <TextField className="mb-3">
            <Label>{t("backup.sftpPassword")}</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder={t("backup.sftpPassword")}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </TextField>

          {/* Remote Path */}
          <TextField className="mb-4">
            <Label>{t("backup.sftpRemotePath")}</Label>
            <Input
              value={remotePath}
              onChangeText={setRemotePath}
              placeholder="/"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </TextField>

          {/* Test result */}
          {testResult !== null && (
            <Alert status={testResult ? "success" : "danger"} className="mb-3">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  {testResult ? t("backup.connectionSuccess") : t("backup.connectionFailed")}
                </Alert.Title>
              </Alert.Content>
            </Alert>
          )}

          {/* Connect button */}
          <Button
            variant="primary"
            onPress={handleConnect}
            isDisabled={!host || !username || testing}
          >
            {testing ? (
              <Spinner size="sm" />
            ) : (
              <Button.Label>{t("backup.testConnection")}</Button.Label>
            )}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
