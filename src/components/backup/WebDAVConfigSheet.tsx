/**
 * WebDAV 配置表单组件
 */

import { useState, useCallback } from "react";
import { View } from "react-native";
import { Alert, Button, Dialog, FieldError, Input, Label, Spinner, TextField } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { useConnectionTest } from "../../hooks/useConnectionTest";

interface WebDAVConfigSheetProps {
  visible: boolean;
  onConnect: (url: string, username: string, password: string) => Promise<boolean>;
  onClose: () => void;
}

export function WebDAVConfigSheet({ visible, onConnect, onClose }: WebDAVConfigSheetProps) {
  const { t } = useI18n();

  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const {
    testing,
    testResult,
    runTest,
    handleClose: closeWithReset,
  } = useConnectionTest({
    onClose,
  });

  const resetFields = useCallback(() => {
    setUrl("");
    setUsername("");
    setPassword("");
  }, []);

  const handleConnect = async () => {
    if (!url || !username) return;
    await runTest(() => onConnect(url, username, password));
  };

  const handleClose = () => closeWithReset(resetFields);

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <View className="flex-row items-center justify-between mb-4">
            <Dialog.Title>WebDAV</Dialog.Title>
            <Dialog.Close />
          </View>

          {/* Server URL */}
          <TextField isRequired isInvalid={testResult === false && !url} className="mb-3">
            <Label>{t("backup.webdavUrl")}</Label>
            <Input
              value={url}
              onChangeText={setUrl}
              placeholder="https://cloud.example.com/remote.php/dav/files/user"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {testResult === false && !url && <FieldError>{t("backup.webdavUrl")}</FieldError>}
          </TextField>

          {/* Username */}
          <TextField isRequired isInvalid={testResult === false && !username} className="mb-3">
            <Label>{t("backup.webdavUsername")}</Label>
            <Input
              value={username}
              onChangeText={setUsername}
              placeholder={t("backup.webdavUsername")}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {testResult === false && !username && (
              <FieldError>{t("backup.webdavUsername")}</FieldError>
            )}
          </TextField>

          {/* Password */}
          <TextField className="mb-4">
            <Label>{t("backup.webdavPassword")}</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder={t("backup.webdavPassword")}
              secureTextEntry
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
            isDisabled={!url || !username || testing}
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
