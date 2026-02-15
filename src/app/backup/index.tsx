/**
 * 备份管理页面
 */

import { useState, useCallback } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Alert, Button, Card, Dialog, Separator, Switch, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useBackup } from "../../hooks/useBackup";
import { useBackupStore } from "../../stores/useBackupStore";
import { ProviderCard } from "../../components/backup/ProviderCard";
import { BackupProgressSheet } from "../../components/backup/BackupProgressSheet";
import { AddProviderSheet } from "../../components/backup/AddProviderSheet";
import { WebDAVConfigSheet } from "../../components/backup/WebDAVConfigSheet";
import { BackupOptionsSheet } from "../../components/backup/BackupOptionsSheet";
import type { CloudProvider, BackupOptions } from "../../lib/backup/types";

export default function BackupScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const mutedColor = useThemeColor("muted");
  const { isLandscape } = useScreenOrientation();

  const {
    connections,
    backupInProgress,
    restoreInProgress,
    progress,
    connectProvider,
    disconnectProvider,
    backup,
    restore,
    cancelOperation,
    localExport,
    localImport,
    getBackupInfo,
  } = useBackup();

  const lastError = useBackupStore((s) => s.lastError);
  const autoBackupEnabled = useBackupStore((s) => s.autoBackupEnabled);
  const setAutoBackupEnabled = useBackupStore((s) => s.setAutoBackupEnabled);

  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showWebDAVConfig, setShowWebDAVConfig] = useState(false);
  const [optionsSheet, setOptionsSheet] = useState<{
    visible: boolean;
    isBackup: boolean;
    provider: CloudProvider | null;
  }>({ visible: false, isBackup: true, provider: null });
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    description: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>({ visible: false, title: "", description: "", onConfirm: () => {} });

  const showConfirm = useCallback(
    (opts: {
      title: string;
      description: string;
      destructive?: boolean;
      onConfirm: () => void;
    }) => {
      setConfirmDialog({ visible: true, ...opts });
    },
    [],
  );

  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleSelectProvider = useCallback(
    async (provider: CloudProvider) => {
      setShowAddProvider(false);

      if (provider === "webdav") {
        setShowWebDAVConfig(true);
        return;
      }

      // For OAuth providers, initiate connection
      const success = await connectProvider(provider);
      if (!success) {
        showConfirm({
          title: t("backup.connectionFailed"),
          description: lastError ?? t("backup.connectionFailed"),
          onConfirm: closeConfirm,
        });
      }
    },
    [connectProvider, lastError, t, showConfirm, closeConfirm],
  );

  const handleWebDAVConnect = useCallback(
    async (url: string, username: string, password: string): Promise<boolean> => {
      const success = await connectProvider("webdav", {
        provider: "webdav",
        webdavUrl: url,
        webdavUsername: username,
        webdavPassword: password,
      });
      return success;
    },
    [connectProvider],
  );

  const handleBackup = useCallback((provider: CloudProvider) => {
    setOptionsSheet({ visible: true, isBackup: true, provider });
  }, []);

  const handleBackupWithOptions = useCallback(
    async (options: BackupOptions) => {
      const provider = optionsSheet.provider;
      if (!provider) return;
      const result = await backup(provider, options);
      if (result.success) {
        showConfirm({
          title: t("backup.backupComplete"),
          description: "",
          onConfirm: closeConfirm,
        });
      } else {
        showConfirm({
          title: t("backup.backupFailed"),
          description: result.error ?? "",
          onConfirm: closeConfirm,
        });
      }
    },
    [backup, optionsSheet.provider, t, showConfirm, closeConfirm],
  );

  const handleRestore = useCallback(
    async (provider: CloudProvider) => {
      // Fetch backup info for preview before restoring
      const info = await getBackupInfo(provider);
      const previewDesc = info
        ? `${t("backup.lastBackup")}: ${new Date(info.manifestDate).toLocaleString()}\n` +
          `${t("backup.optionFiles")}: ${info.fileCount}\n` +
          `${info.deviceName} (${info.appVersion})\n\n` +
          t("backup.confirmRestore")
        : t("backup.confirmRestore");

      showConfirm({
        title: t("backup.restoreNow"),
        description: previewDesc,
        destructive: true,
        onConfirm: () => {
          closeConfirm();
          setOptionsSheet({ visible: true, isBackup: false, provider });
        },
      });
    },
    [getBackupInfo, t, showConfirm, closeConfirm],
  );

  const handleRestoreWithOptions = useCallback(
    async (options: BackupOptions) => {
      const provider = optionsSheet.provider;
      if (!provider) return;
      const result = await restore(provider, options);
      if (result.success) {
        showConfirm({
          title: t("backup.restoreComplete"),
          description: "",
          onConfirm: closeConfirm,
        });
      } else {
        showConfirm({
          title: t("backup.restoreFailed"),
          description: result.error ?? "",
          onConfirm: closeConfirm,
        });
      }
    },
    [restore, optionsSheet.provider, t, showConfirm, closeConfirm],
  );

  const handleDisconnect = useCallback(
    (provider: CloudProvider) => {
      showConfirm({
        title: t("backup.disconnect"),
        description: t("backup.confirmDisconnect"),
        destructive: true,
        onConfirm: () => {
          closeConfirm();
          disconnectProvider(provider);
        },
      });
    },
    [disconnectProvider, t, showConfirm, closeConfirm],
  );

  const handleLocalExport = useCallback(async () => {
    const result = await localExport();
    if (result.success) {
      showConfirm({
        title: t("backup.exportComplete"),
        description: "",
        onConfirm: closeConfirm,
      });
    } else if (result.error !== "No file selected") {
      showConfirm({
        title: t("backup.exportFailed"),
        description: result.error ?? "",
        onConfirm: closeConfirm,
      });
    }
  }, [localExport, t, showConfirm, closeConfirm]);

  const handleLocalImport = useCallback(() => {
    showConfirm({
      title: t("backup.importNow"),
      description: t("backup.confirmImport"),
      destructive: true,
      onConfirm: async () => {
        closeConfirm();
        const result = await localImport();
        if (result.success) {
          showConfirm({
            title: t("backup.importComplete"),
            description: "",
            onConfirm: closeConfirm,
          });
        } else if (result.error !== "No file selected") {
          showConfirm({
            title: t("backup.importFailed"),
            description: result.error ?? "",
            onConfirm: closeConfirm,
          });
        }
      },
    });
  }, [localImport, t, showConfirm, closeConfirm]);

  const isOperating = backupInProgress || restoreInProgress;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className={`flex-row items-center gap-3 px-4 pb-2 ${isLandscape ? "pt-2" : "pt-14"}`}>
        <Button variant="ghost" size="sm" isIconOnly onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={mutedColor} />
        </Button>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">{t("backup.title")}</Text>
          <Text className="text-xs text-muted">{t("backup.subtitle")}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Connected providers */}
        {connections.length > 0 && (
          <View className="mt-4">
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("backup.connectedServices")}
            </Text>
            {connections.map((conn) => (
              <ProviderCard
                key={conn.provider}
                connection={conn}
                onBackup={() => handleBackup(conn.provider)}
                onRestore={() => handleRestore(conn.provider)}
                onDisconnect={() => handleDisconnect(conn.provider)}
                disabled={isOperating}
              />
            ))}
          </View>
        )}

        {/* Local backup section */}
        <View className="mt-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("backup.localBackup")}
          </Text>
          <Card>
            <Card.Body>
              <Text className="mb-3 text-xs text-muted">{t("backup.localBackupDesc")}</Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={handleLocalExport}
                    isDisabled={isOperating}
                  >
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Button.Label>{t("backup.exportFile")}</Button.Label>
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={handleLocalImport}
                    isDisabled={isOperating}
                  >
                    <Ionicons name="push-outline" size={16} color={mutedColor} />
                    <Button.Label>{t("backup.importFile")}</Button.Label>
                  </Button>
                </View>
              </View>
            </Card.Body>
          </Card>
        </View>

        <Separator className="my-4" />

        {/* Add provider button */}
        <Button
          variant="secondary"
          onPress={() => setShowAddProvider(true)}
          isDisabled={isOperating}
        >
          <Ionicons name="add-circle-outline" size={18} color={mutedColor} />
          <Button.Label>{t("backup.addProvider")}</Button.Label>
        </Button>

        {/* Auto backup setting */}
        <View className="mt-6">
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("backup.settingsTitle")}
          </Text>
          <Card>
            <Card.Body>
              <View className="flex-row items-center justify-between py-1">
                <View className="flex-row items-center gap-3">
                  <Ionicons name="sync-outline" size={18} color={mutedColor} />
                  <Text className="text-sm text-foreground">{t("backup.autoBackup")}</Text>
                </View>
                <Switch
                  isSelected={autoBackupEnabled}
                  onSelectedChange={setAutoBackupEnabled}
                  isDisabled={connections.length === 0}
                >
                  <Switch.Thumb />
                </Switch>
              </View>
            </Card.Body>
          </Card>
        </View>

        {/* Error display */}
        {lastError && (
          <Alert status="danger" className="mt-4">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{lastError}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <View className="h-20" />
      </ScrollView>

      {/* Progress overlay */}
      <BackupProgressSheet
        visible={isOperating}
        isBackup={backupInProgress}
        progress={progress}
        onCancel={cancelOperation}
      />

      {/* Add provider sheet */}
      <AddProviderSheet
        visible={showAddProvider}
        existingProviders={connections.map((c) => c.provider)}
        onSelect={handleSelectProvider}
        onClose={() => setShowAddProvider(false)}
      />

      {/* WebDAV config sheet */}
      <WebDAVConfigSheet
        visible={showWebDAVConfig}
        onConnect={handleWebDAVConnect}
        onClose={() => setShowWebDAVConfig(false)}
      />

      {/* Backup/Restore options sheet */}
      <BackupOptionsSheet
        visible={optionsSheet.visible}
        isBackup={optionsSheet.isBackup}
        onConfirm={optionsSheet.isBackup ? handleBackupWithOptions : handleRestoreWithOptions}
        onClose={() => setOptionsSheet((prev) => ({ ...prev, visible: false }))}
      />

      {/* Confirm dialog */}
      <Dialog
        isOpen={confirmDialog.visible}
        onOpenChange={(open) => {
          if (!open) closeConfirm();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Title>{confirmDialog.title}</Dialog.Title>
            {confirmDialog.description ? (
              <Dialog.Description className="mt-1">{confirmDialog.description}</Dialog.Description>
            ) : null}
            <View className="mt-4 flex-row justify-end gap-2">
              <Button variant="outline" size="sm" onPress={closeConfirm}>
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
              <Button
                variant={confirmDialog.destructive ? "danger" : "primary"}
                size="sm"
                onPress={confirmDialog.onConfirm}
              >
                <Button.Label>{t("common.confirm")}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
