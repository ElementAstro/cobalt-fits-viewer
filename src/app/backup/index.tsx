/**
 * 备份管理页面
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Alert, Button, Card, Chip, Dialog, Separator, Switch, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useBackupSummary } from "../../hooks/useBackupSummary";
import { formatFileSize } from "../../lib/utils/fileManager";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useBackup } from "../../hooks/useBackup";
import { useBackupStore } from "../../stores/useBackupStore";
import { ProviderCard } from "../../components/backup/ProviderCard";
import { BackupProgressSheet } from "../../components/backup/BackupProgressSheet";
import { AddProviderSheet } from "../../components/backup/AddProviderSheet";
import { WebDAVConfigSheet } from "../../components/backup/WebDAVConfigSheet";
import { SFTPConfigSheet } from "../../components/backup/SFTPConfigSheet";
import { LANSendSheet } from "../../components/backup/LANSendSheet";
import { LANReceiveSheet } from "../../components/backup/LANReceiveSheet";
import { useLANTransfer } from "../../hooks/useLANTransfer";
import {
  BackupOptionsSheet,
  type BackupOptionsSheetMode,
} from "../../components/backup/BackupOptionsSheet";
import type { CloudProvider, BackupOptions, BackupInfo } from "../../lib/backup/types";
import type { LocalBackupPreview } from "../../lib/backup/localBackup";

export default function BackupScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const mutedColor = useThemeColor("muted");
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const isWeb = Platform.OS === "web";

  const {
    sendStatus,
    sendInfo,
    sendError,
    startSending,
    stopSending,
    receiveStatus,
    receiveProgress,
    receiveError,
    startReceiving,
    resetReceive,
  } = useLANTransfer();
  const [showLANSend, setShowLANSend] = useState(false);
  const [showLANReceive, setShowLANReceive] = useState(false);

  const {
    connections,
    activeProvider,
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
    previewLocalImport,
    getBackupInfo,
    quickBackup,
    quickLocalExport,
  } = useBackup();

  const lastError = useBackupStore((s) => s.lastError);
  const autoBackupEnabled = useBackupStore((s) => s.autoBackupEnabled);
  const autoBackupIntervalHours = useBackupStore((s) => s.autoBackupIntervalHours);
  const autoBackupNetwork = useBackupStore((s) => s.autoBackupNetwork);
  const setAutoBackupEnabled = useBackupStore((s) => s.setAutoBackupEnabled);
  const setAutoBackupIntervalHours = useBackupStore((s) => s.setAutoBackupIntervalHours);
  const setAutoBackupNetwork = useBackupStore((s) => s.setAutoBackupNetwork);
  const lastAutoBackupAttempt = useBackupStore((s) => s.lastAutoBackupAttempt);
  const lastAutoBackupResult = useBackupStore((s) => s.lastAutoBackupResult);
  const lastAutoBackupError = useBackupStore((s) => s.lastAutoBackupError);
  const history = useBackupStore((s) => s.history);
  const clearHistory = useBackupStore((s) => s.clearHistory);
  const setLastUsedBackupOptions = useBackupStore((s) => s.setLastUsedBackupOptions);
  const summary = useBackupSummary();
  const [backupInfoMap, setBackupInfoMap] = useState<Record<string, BackupInfo | null>>({});
  const fetchedProviders = useRef(new Set<string>());

  useEffect(() => {
    for (const conn of connections) {
      if (conn.connected && !fetchedProviders.current.has(conn.provider)) {
        fetchedProviders.current.add(conn.provider);
        void getBackupInfo(conn.provider).then((info) => {
          if (info) {
            setBackupInfoMap((prev) => ({ ...prev, [conn.provider]: info }));
          }
        });
      }
    }
  }, [connections, getBackupInfo]);

  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showWebDAVConfig, setShowWebDAVConfig] = useState(false);
  const [showSFTPConfig, setShowSFTPConfig] = useState(false);
  const [optionsSheet, setOptionsSheet] = useState<{
    visible: boolean;
    mode: BackupOptionsSheetMode;
    provider: CloudProvider | null;
    localPreview: LocalBackupPreview | null;
  }>({ visible: false, mode: "cloud-backup", provider: null, localPreview: null });
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

      if (provider === "sftp") {
        setShowSFTPConfig(true);
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

  const handleSFTPConnect = useCallback(
    async (
      host: string,
      port: number,
      username: string,
      password: string,
      remotePath: string,
    ): Promise<boolean> => {
      const success = await connectProvider("sftp", {
        provider: "sftp",
        sftpHost: host,
        sftpPort: port,
        sftpUsername: username,
        sftpPassword: password,
        sftpRemotePath: remotePath,
      });
      return success;
    },
    [connectProvider],
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
    setOptionsSheet({ visible: true, mode: "cloud-backup", provider, localPreview: null });
  }, []);

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
          setOptionsSheet({ visible: true, mode: "cloud-restore", provider, localPreview: null });
        },
      });
    },
    [getBackupInfo, t, showConfirm, closeConfirm],
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

  const handleLocalExport = useCallback(() => {
    setOptionsSheet({ visible: true, mode: "local-export", provider: null, localPreview: null });
  }, []);

  const handleLocalImport = useCallback(async () => {
    const previewResult = await previewLocalImport();
    if (!previewResult.success) {
      if (!previewResult.cancelled && previewResult.error) {
        showConfirm({
          title: t("backup.importFailed"),
          description: previewResult.error,
          onConfirm: closeConfirm,
        });
      }
      return;
    }

    const preview = previewResult.preview!;
    const summaryDesc =
      `${t("backup.optionFiles")}: ${preview.summary.fileCount}\n` +
      `${t("backup.optionThumbnails")}: ${preview.summary.thumbnailCount}\n` +
      `${t("backup.optionAlbums")}: ${preview.summary.albumCount}\n` +
      `${t("backup.optionTargets")}: ${preview.summary.targetCount}\n` +
      `${t("backup.optionSessions")}: ${preview.summary.sessionCount}\n` +
      `${t("backup.optionSettings")}: ${preview.summary.hasSettings ? t("backup.valueYes") : t("backup.valueNo")}\n` +
      `${t("backup.localEncryption")}: ${preview.encrypted ? t("backup.valueYes") : t("backup.valueNo")}\n` +
      `${preview.summary.deviceName} (${preview.summary.appVersion})\n` +
      `${new Date(preview.summary.createdAt).toLocaleString()}\n\n` +
      t("backup.confirmImport");

    showConfirm({
      title: t("backup.importNow"),
      description: summaryDesc,
      destructive: true,
      onConfirm: () => {
        closeConfirm();
        setOptionsSheet({
          visible: true,
          mode: "local-import",
          provider: null,
          localPreview: preview,
        });
      },
    });
  }, [previewLocalImport, t, showConfirm, closeConfirm]);

  const handleQuickBackup = useCallback(async () => {
    const result = await quickBackup();
    showConfirm({
      title: result.success ? t("backup.backupComplete") : t("backup.backupFailed"),
      description: result.success ? "" : (result.error ?? ""),
      onConfirm: closeConfirm,
    });
  }, [quickBackup, t, showConfirm, closeConfirm]);

  const handleQuickLocalExport = useCallback(async () => {
    const result = await quickLocalExport();
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
  }, [quickLocalExport, t, showConfirm, closeConfirm]);

  const handleRunWithOptions = useCallback(
    async (options: BackupOptions) => {
      if (optionsSheet.mode === "cloud-backup") {
        const provider = optionsSheet.provider;
        if (!provider) return;
        const result = await backup(provider, options);
        if (result.success) setLastUsedBackupOptions(options);
        showConfirm({
          title: result.success ? t("backup.backupComplete") : t("backup.backupFailed"),
          description: result.success ? "" : (result.error ?? ""),
          onConfirm: closeConfirm,
        });
        return;
      }

      if (optionsSheet.mode === "cloud-restore") {
        const provider = optionsSheet.provider;
        if (!provider) return;
        const result = await restore(provider, options);
        showConfirm({
          title: result.success ? t("backup.restoreComplete") : t("backup.restoreFailed"),
          description: result.success ? "" : (result.error ?? ""),
          onConfirm: closeConfirm,
        });
        return;
      }

      if (optionsSheet.mode === "local-export") {
        const result = await localExport(options);
        if (result.success) {
          setLastUsedBackupOptions(options);
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
        return;
      }

      if (optionsSheet.mode === "local-import") {
        const preview = optionsSheet.localPreview;
        if (!preview) return;
        const result = await localImport(options, preview);
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
      }
    },
    [
      optionsSheet.mode,
      optionsSheet.provider,
      optionsSheet.localPreview,
      backup,
      restore,
      localExport,
      localImport,
      showConfirm,
      closeConfirm,
      setLastUsedBackupOptions,
      t,
    ],
  );

  const isOperating = backupInProgress || restoreInProgress;

  return (
    <View testID="e2e-screen-backup__index" className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center gap-3 pb-2"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
      >
        <Button variant="ghost" size="sm" isIconOnly onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={mutedColor} />
        </Button>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">{t("backup.title")}</Text>
          <Text className="text-xs text-muted">{t("backup.subtitle")}</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick backup */}
        <View className="mt-4">
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("backup.quickBackup")}
          </Text>
          <Card>
            <Card.Body>
              <Text className="mb-3 text-xs text-muted">{t("backup.quickBackupDesc")}</Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    testID="e2e-action-backup__index-quick-cloud"
                    variant="primary"
                    size="sm"
                    onPress={handleQuickBackup}
                    isDisabled={isOperating || !activeProvider || isWeb}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                    <Button.Label>{t("backup.quickCloudBackup")}</Button.Label>
                  </Button>
                </View>
                <View className="flex-1">
                  <Button
                    testID="e2e-action-backup__index-quick-local"
                    variant="outline"
                    size="sm"
                    onPress={handleQuickLocalExport}
                    isDisabled={isOperating}
                  >
                    <Ionicons name="save-outline" size={16} color={mutedColor} />
                    <Button.Label>{t("backup.quickLocalExport")}</Button.Label>
                  </Button>
                </View>
              </View>
              {!activeProvider && !isWeb && (
                <Text className="mt-2 text-xs text-muted">{t("backup.noProviderHint")}</Text>
              )}
            </Card.Body>
          </Card>
        </View>

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
                isActive={activeProvider === conn.provider}
                backupInfo={backupInfoMap[conn.provider]}
                onBackup={() => handleBackup(conn.provider)}
                onRestore={() => handleRestore(conn.provider)}
                onDisconnect={() => handleDisconnect(conn.provider)}
                disabled={isOperating}
              />
            ))}
          </View>
        )}

        {/* LAN transfer section */}
        {!isWeb && (
          <View className="mt-4">
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("backup.lanTransfer")}
            </Text>
            <Card>
              <Card.Body>
                <Text className="mb-3 text-xs text-muted">{t("backup.lanTransferDesc")}</Text>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button
                      testID="e2e-action-backup__index-lan-send"
                      variant="primary"
                      size="sm"
                      onPress={async () => {
                        setShowLANSend(true);
                        await startSending();
                      }}
                      isDisabled={isOperating}
                    >
                      <Ionicons name="push-outline" size={16} color="#fff" />
                      <Button.Label>{t("backup.lanSend")}</Button.Label>
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button
                      testID="e2e-action-backup__index-lan-receive"
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        resetReceive();
                        setShowLANReceive(true);
                      }}
                      isDisabled={isOperating}
                    >
                      <Ionicons name="download-outline" size={16} color={mutedColor} />
                      <Button.Label>{t("backup.lanReceive")}</Button.Label>
                    </Button>
                  </View>
                </View>
              </Card.Body>
            </Card>
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
                    testID="e2e-action-backup__index-local-export"
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
                    testID="e2e-action-backup__index-local-import"
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
          isDisabled={isOperating || isWeb}
        >
          <Ionicons name="add-circle-outline" size={18} color={mutedColor} />
          <Button.Label>{t("backup.addProvider")}</Button.Label>
        </Button>
        {isWeb && <Text className="mt-2 text-xs text-muted">{t("backup.webProviderLimited")}</Text>}

        {/* Data overview */}
        <View className="mt-6">
          <Text className="mb-2 text-xs font-semibold uppercase text-muted">
            {t("backup.summaryTitle")}
          </Text>
          <Card>
            <Card.Body>
              <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                <View>
                  <Text className="text-lg font-bold text-foreground">{summary.fileCount}</Text>
                  <Text className="text-xs text-muted">{t("backup.summaryFiles")}</Text>
                </View>
                <View>
                  <Text className="text-lg font-bold text-foreground">{summary.albumCount}</Text>
                  <Text className="text-xs text-muted">{t("backup.summaryAlbums")}</Text>
                </View>
                <View>
                  <Text className="text-lg font-bold text-foreground">{summary.targetCount}</Text>
                  <Text className="text-xs text-muted">{t("backup.summaryTargets")}</Text>
                </View>
                <View>
                  <Text className="text-lg font-bold text-foreground">{summary.sessionCount}</Text>
                  <Text className="text-xs text-muted">{t("backup.summarySessions")}</Text>
                </View>
                <View>
                  <Text className="text-lg font-bold text-foreground">{summary.planCount}</Text>
                  <Text className="text-xs text-muted">{t("backup.summaryPlans")}</Text>
                </View>
              </View>
              {summary.estimatedBytes > 0 && (
                <View className="mt-3 border-t border-separator pt-3">
                  <Text className="text-xs text-muted">
                    {t("backup.summaryEstimatedSize")}: {formatFileSize(summary.estimatedBytes)}
                  </Text>
                </View>
              )}
            </Card.Body>
          </Card>
        </View>

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
                  testID="e2e-action-backup__index-toggle-auto-backup"
                  isSelected={autoBackupEnabled}
                  onSelectedChange={setAutoBackupEnabled}
                  isDisabled={connections.length === 0}
                >
                  <Switch.Thumb />
                </Switch>
              </View>

              {autoBackupEnabled && (
                <View className="mt-3 gap-3">
                  <View>
                    <Text className="mb-2 text-xs font-semibold uppercase text-muted">
                      {t("backup.autoBackupInterval")}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {[6, 12, 24, 48].map((hours) => (
                        <Chip
                          key={hours}
                          size="sm"
                          variant={autoBackupIntervalHours === hours ? "primary" : "secondary"}
                          onPress={() => setAutoBackupIntervalHours(hours)}
                        >
                          <Chip.Label>
                            {t("backup.everyHours").replace("{hours}", String(hours))}
                          </Chip.Label>
                        </Chip>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text className="mb-2 text-xs font-semibold uppercase text-muted">
                      {t("backup.autoBackupNetwork")}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      <Chip
                        testID="e2e-action-backup__index-network-wifi"
                        size="sm"
                        variant={autoBackupNetwork === "wifi" ? "primary" : "secondary"}
                        onPress={() => setAutoBackupNetwork("wifi")}
                      >
                        <Chip.Label>{t("backup.networkWifiOnly")}</Chip.Label>
                      </Chip>
                      <Chip
                        testID="e2e-action-backup__index-network-any"
                        size="sm"
                        variant={autoBackupNetwork === "any" ? "primary" : "secondary"}
                        onPress={() => setAutoBackupNetwork("any")}
                      >
                        <Chip.Label>{t("backup.networkAny")}</Chip.Label>
                      </Chip>
                    </View>
                  </View>

                  {/* Auto-backup status */}
                  {lastAutoBackupAttempt > 0 && (
                    <View className="mt-2 rounded-lg bg-secondary/50 px-3 py-2">
                      <View className="flex-row items-center gap-2">
                        <Ionicons
                          name={
                            lastAutoBackupResult === "success"
                              ? "checkmark-circle"
                              : lastAutoBackupResult === "failed"
                                ? "alert-circle"
                                : "time-outline"
                          }
                          size={14}
                          color={
                            lastAutoBackupResult === "success"
                              ? "#22c55e"
                              : lastAutoBackupResult === "failed"
                                ? "#ef4444"
                                : mutedColor
                          }
                        />
                        <Text className="text-xs text-muted">
                          {t("backup.lastAutoBackup")}:{" "}
                          {new Date(lastAutoBackupAttempt).toLocaleString()}
                        </Text>
                      </View>
                      {lastAutoBackupResult === "failed" && lastAutoBackupError && (
                        <Text className="mt-1 text-xs text-danger" numberOfLines={2}>
                          {lastAutoBackupError}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </Card.Body>
          </Card>
        </View>

        {/* Backup history */}
        {history.length > 0 && (
          <View className="mt-6">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase text-muted">
                {t("backup.historyTitle")}
              </Text>
              <Button variant="ghost" size="sm" onPress={clearHistory}>
                <Button.Label className="text-xs text-muted">
                  {t("backup.historyClearAll")}
                </Button.Label>
              </Button>
            </View>
            <Card>
              <Card.Body className="gap-2">
                {history.slice(0, 10).map((entry) => (
                  <View key={entry.id} className="flex-row items-center gap-3 py-1">
                    <Ionicons
                      name={entry.result === "success" ? "checkmark-circle" : "alert-circle"}
                      size={16}
                      color={entry.result === "success" ? "#22c55e" : "#ef4444"}
                    />
                    <View className="flex-1">
                      <Text className="text-sm text-foreground">
                        {entry.type === "backup"
                          ? t("backup.historyTypeBackup")
                          : entry.type === "restore"
                            ? t("backup.historyTypeRestore")
                            : entry.type === "local-export"
                              ? t("backup.historyTypeLocalExport")
                              : t("backup.historyTypeLocalImport")}
                      </Text>
                      <Text className="text-xs text-muted">
                        {new Date(entry.timestamp).toLocaleString()}
                        {entry.error ? ` · ${entry.error}` : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card.Body>
            </Card>
          </View>
        )}

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

      {/* SFTP config sheet */}
      <SFTPConfigSheet
        visible={showSFTPConfig}
        onConnect={handleSFTPConnect}
        onClose={() => setShowSFTPConfig(false)}
      />

      {/* LAN Send sheet */}
      <LANSendSheet
        visible={showLANSend}
        status={sendStatus}
        info={sendInfo}
        error={sendError}
        onStop={stopSending}
        onClose={() => setShowLANSend(false)}
      />

      {/* LAN Receive sheet */}
      <LANReceiveSheet
        visible={showLANReceive}
        status={receiveStatus}
        progress={receiveProgress}
        error={receiveError}
        onConnect={(host, port, pin) => startReceiving(host, port, pin)}
        onClose={() => {
          resetReceive();
          setShowLANReceive(false);
        }}
      />

      {/* Backup/Restore options sheet */}
      <BackupOptionsSheet
        visible={optionsSheet.visible}
        mode={optionsSheet.mode}
        localPreview={optionsSheet.localPreview}
        onConfirm={handleRunWithOptions}
        onClose={() =>
          setOptionsSheet((prev) => ({
            ...prev,
            visible: false,
            provider: null,
            localPreview: null,
          }))
        }
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
