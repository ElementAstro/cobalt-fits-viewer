/**
 * 备份/恢复选项选择器组件
 */

import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Platform } from "react-native";
import { BottomSheet, Button, Chip, Switch } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { BackupOptions, RestoreConflictStrategy } from "../../lib/backup/types";
import { DEFAULT_BACKUP_OPTIONS } from "../../lib/backup/types";
import type { LocalBackupPreview } from "../../lib/backup/localBackup";

export type BackupOptionsSheetMode =
  | "cloud-backup"
  | "cloud-restore"
  | "local-export"
  | "local-import";

interface BackupOptionsSheetProps {
  visible: boolean;
  mode: BackupOptionsSheetMode;
  localPreview?: LocalBackupPreview | null;
  onConfirm: (options: BackupOptions) => void;
  onClose: () => void;
}

const LOCAL_EXPORT_DEFAULT_OPTIONS: BackupOptions = {
  ...DEFAULT_BACKUP_OPTIONS,
  localPayloadMode: "full",
};
const IS_WEB = Platform.OS === "web";

function getDefaultOptionsForMode(mode: BackupOptionsSheetMode): BackupOptions {
  if (mode === "local-export") {
    if (IS_WEB) {
      return {
        ...LOCAL_EXPORT_DEFAULT_OPTIONS,
        localPayloadMode: "metadata-only",
        localEncryption: { enabled: false },
      };
    }
    return { ...LOCAL_EXPORT_DEFAULT_OPTIONS };
  }
  return { ...DEFAULT_BACKUP_OPTIONS };
}

const DATA_OPTION_KEYS = [
  "includeFiles",
  "includeAlbums",
  "includeTargets",
  "includeSessions",
  "includeSettings",
] as const;

type DataOptionKey = (typeof DATA_OPTION_KEYS)[number];

export function BackupOptionsSheet({
  visible,
  mode,
  localPreview,
  onConfirm,
  onClose,
}: BackupOptionsSheetProps) {
  const { t } = useI18n();

  const [options, setOptions] = useState<BackupOptions>(() => getDefaultOptionsForMode(mode));
  const [password, setPassword] = useState("");

  const isRestore = mode === "cloud-restore" || mode === "local-import";
  const isLocalExport = mode === "local-export";
  const requiresImportPassword = mode === "local-import" && localPreview?.encrypted === true;
  const webImportUnsupported =
    IS_WEB &&
    mode === "local-import" &&
    localPreview != null &&
    localPreview.sourceType !== "manifest-json";

  useEffect(() => {
    if (visible) {
      const next = getDefaultOptionsForMode(mode);
      if (requiresImportPassword) {
        next.localEncryption = { enabled: true };
      }
      setOptions(next);
      setPassword("");
    }
  }, [visible, mode, requiresImportPassword]);

  const toggleOption = (key: DataOptionKey) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedDataCount = useMemo(
    () => DATA_OPTION_KEYS.filter((key) => options[key]).length,
    [options],
  );

  const canConfirm = selectedDataCount > 0 && !webImportUnsupported;
  const hasRequiredPassword =
    (isLocalExport && options.localEncryption.enabled && !IS_WEB) || requiresImportPassword
      ? password.trim().length > 0
      : true;

  const handleConfirm = () => {
    if (!canConfirm || !hasRequiredPassword || webImportUnsupported) return;
    const payload: BackupOptions = {
      ...options,
      localEncryption:
        requiresImportPassword || (options.localEncryption.enabled && !IS_WEB)
          ? { enabled: true, password: password.trim() }
          : { enabled: false },
    };
    onConfirm(payload);
    onClose();
  };

  const handleClose = () => {
    setOptions(getDefaultOptionsForMode(mode));
    setPassword("");
    onClose();
  };

  const optionItems: { key: DataOptionKey; icon: string; label: string }[] = [
    { key: "includeFiles", icon: "document-outline", label: t("backup.optionFiles") },
    { key: "includeAlbums", icon: "albums-outline", label: t("backup.optionAlbums") },
    { key: "includeTargets", icon: "telescope-outline", label: t("backup.optionTargets") },
    { key: "includeSessions", icon: "time-outline", label: t("backup.optionSessions") },
    { key: "includeSettings", icon: "settings-outline", label: t("backup.optionSettings") },
  ];

  const strategyItems: Array<{ value: RestoreConflictStrategy; label: string }> = [
    { value: "skip-existing", label: t("backup.conflictSkip") },
    { value: "overwrite-existing", label: t("backup.conflictOverwrite") },
    { value: "merge", label: t("backup.conflictMerge") },
  ];

  const title =
    mode === "cloud-backup" || mode === "local-export"
      ? t("backup.selectBackupOptions")
      : t("backup.selectRestoreOptions");
  const description =
    mode === "cloud-backup" || mode === "local-export"
      ? t("backup.selectBackupOptionsDesc")
      : t("backup.selectRestoreOptionsDesc");
  const confirmLabel =
    mode === "cloud-backup" || mode === "local-export"
      ? t("backup.startBackup")
      : t("backup.startRestore");

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="flex-row items-center justify-between mb-2">
            <BottomSheet.Title>{title}</BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          <BottomSheet.Description className="mb-3">{description}</BottomSheet.Description>

          {optionItems.map((item) => (
            <View key={item.key} className="flex-row items-center justify-between py-2">
              <Text className="text-sm text-foreground">{item.label}</Text>
              <Switch
                testID={`backup-option-${item.key}`}
                isSelected={options[item.key]}
                onSelectedChange={() => toggleOption(item.key)}
              >
                <Switch.Thumb />
              </Switch>
            </View>
          ))}

          <View className="flex-row items-center justify-between py-2">
            <Text className="text-sm text-foreground">{t("backup.optionThumbnails")}</Text>
            <Switch
              testID="backup-option-includeThumbnails"
              isSelected={options.includeThumbnails}
              onSelectedChange={() =>
                setOptions((prev) => ({ ...prev, includeThumbnails: !prev.includeThumbnails }))
              }
            >
              <Switch.Thumb />
            </Switch>
          </View>

          {isLocalExport && (
            <View className="mt-3">
              <Text className="mb-2 text-xs font-semibold uppercase text-muted">
                {t("backup.localPayloadMode")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  testID="backup-payload-full"
                  size="sm"
                  variant={options.localPayloadMode === "full" ? "primary" : "secondary"}
                  disabled={IS_WEB}
                  onPress={() => setOptions((prev) => ({ ...prev, localPayloadMode: "full" }))}
                >
                  <Chip.Label>{t("backup.localPayloadFull")}</Chip.Label>
                </Chip>
                <Chip
                  testID="backup-payload-metadata"
                  size="sm"
                  variant={options.localPayloadMode === "metadata-only" ? "primary" : "secondary"}
                  onPress={() =>
                    setOptions((prev) => ({ ...prev, localPayloadMode: "metadata-only" }))
                  }
                >
                  <Chip.Label>{t("backup.localPayloadMetadataOnly")}</Chip.Label>
                </Chip>
              </View>
            </View>
          )}

          {(isLocalExport || requiresImportPassword) && (
            <View className="mt-3">
              <View className="flex-row items-center justify-between py-2">
                <Text className="text-sm text-foreground">{t("backup.localEncryption")}</Text>
                <Switch
                  testID="backup-option-local-encryption"
                  isSelected={requiresImportPassword ? true : options.localEncryption.enabled}
                  onSelectedChange={() =>
                    setOptions((prev) => ({
                      ...prev,
                      localEncryption: {
                        ...prev.localEncryption,
                        enabled: requiresImportPassword ? true : !prev.localEncryption.enabled,
                      },
                    }))
                  }
                  isDisabled={requiresImportPassword || IS_WEB}
                >
                  <Switch.Thumb />
                </Switch>
              </View>

              {(requiresImportPassword || options.localEncryption.enabled) && (
                <View className="mt-2">
                  <Text className="mb-1 text-xs text-muted">
                    {t("backup.localEncryptionPassword")}
                  </Text>
                  <TextInput
                    testID="backup-option-password"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t("backup.localEncryptionPasswordPlaceholder")}
                    className="rounded-md border border-outline px-3 py-2 text-sm text-foreground"
                  />
                </View>
              )}
            </View>
          )}

          {isRestore && (
            <View className="mt-3">
              <Text className="mb-2 text-xs font-semibold uppercase text-muted">
                {t("backup.conflictTitle")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {strategyItems.map((item) => (
                  <Chip
                    key={item.value}
                    testID={`backup-conflict-${item.value}`}
                    size="sm"
                    variant={
                      (options.restoreConflictStrategy ?? "skip-existing") === item.value
                        ? "primary"
                        : "secondary"
                    }
                    onPress={() =>
                      setOptions((prev) => ({ ...prev, restoreConflictStrategy: item.value }))
                    }
                  >
                    <Chip.Label>{item.label}</Chip.Label>
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {!canConfirm && (
            <Text className="mt-3 text-xs text-danger">{t("backup.optionSelectAtLeastOne")}</Text>
          )}
          {IS_WEB && isLocalExport && (
            <Text className="mt-2 text-xs text-warning">{t("backup.webLocalExportLimited")}</Text>
          )}
          {webImportUnsupported && (
            <Text className="mt-2 text-xs text-warning">{t("backup.webLocalImportLimited")}</Text>
          )}
          {canConfirm && !hasRequiredPassword && (
            <Text className="mt-3 text-xs text-danger">
              {t("backup.localEncryptionPasswordRequired")}
            </Text>
          )}

          <Button
            testID="backup-options-confirm"
            variant="primary"
            className="mt-4"
            onPress={handleConfirm}
            isDisabled={!canConfirm || !hasRequiredPassword}
          >
            <Button.Label>{confirmLabel}</Button.Label>
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
