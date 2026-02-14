import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Button, Chip, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";
import { useFileManager } from "../../hooks/useFileManager";
import type { ImportResult } from "../../hooks/useFileManager";
import { FileListItem } from "../../components/gallery/FileListItem";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { formatFileSize } from "../../lib/utils/fileManager";
import type { FitsMetadata } from "../../lib/fits/types";

const ListItemSeparator = () => <View className="h-2" />;

export default function FilesScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  const allFiles = useFitsStore((s) => s.files);
  const files = useFitsStore((s) => s.getFilteredFiles());
  const sortBy = useFitsStore((s) => s.sortBy);
  const sortOrder = useFitsStore((s) => s.sortOrder);
  const setSortBy = useFitsStore((s) => s.setSortBy);
  const setSortOrder = useFitsStore((s) => s.setSortOrder);
  const searchQuery = useFitsStore((s) => s.searchQuery);
  const setSearchQuery = useFitsStore((s) => s.setSearchQuery);
  const selectedIds = useFitsStore((s) => s.selectedIds);
  const isSelectionMode = useFitsStore((s) => s.isSelectionMode);
  const toggleSelection = useFitsStore((s) => s.toggleSelection);
  const clearSelection = useFitsStore((s) => s.clearSelection);
  const setSelectionMode = useFitsStore((s) => s.setSelectionMode);

  const {
    isImporting,
    importProgress,
    importError,
    lastImportResult,
    pickAndImportFile,
    pickAndImportFolder,
    pickAndImportZip,
    importFromUrl,
    cancelImport,
    handleDeleteFiles,
  } = useFileManager();

  const bottomSheetRef = useRef<BottomSheet>(null);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const storageStats = useMemo(() => {
    let totalSize = 0;
    for (const f of allFiles) {
      totalSize += f.fileSize;
    }
    return { fitsCount: allFiles.length, fitsSize: totalSize };
  }, [allFiles]);

  const showImportResult = useCallback(
    (result: ImportResult) => {
      if (result.failed === 0) {
        Alert.alert(
          t("files.importSuccess"),
          t("files.importSuccessMsg").replace("{count}", String(result.success)),
        );
      } else {
        Alert.alert(
          t("files.importSuccess"),
          t("files.importPartialMsg")
            .replace("{success}", String(result.success))
            .replace("{total}", String(result.total))
            .replace("{failed}", String(result.failed)),
        );
      }
    },
    [t],
  );

  useEffect(() => {
    if (lastImportResult && !isImporting) {
      showImportResult(lastImportResult);
    }
  }, [lastImportResult, isImporting, showImportResult]);

  useEffect(() => {
    if (importError && !isImporting) {
      const errorKey = importError as string;
      const message =
        errorKey === "noFitsInFolder"
          ? t("files.noFitsInFolder")
          : errorKey === "noFitsInZip"
            ? t("files.noFitsInZip")
            : importError;
      Alert.alert(t("files.importFailed"), message);
    }
  }, [importError, isImporting, t]);

  const openImportSheet = () => {
    bottomSheetRef.current?.expand();
  };

  const closeImportSheet = () => {
    bottomSheetRef.current?.close();
  };

  const handleImportFile = () => {
    closeImportSheet();
    pickAndImportFile();
  };

  const handleImportFolder = () => {
    closeImportSheet();
    pickAndImportFolder();
  };

  const handleImportZip = () => {
    closeImportSheet();
    pickAndImportZip();
  };

  const handleImportUrl = () => {
    closeImportSheet();
    setUrlInput("");
    setShowUrlDialog(true);
  };

  const confirmUrlImport = () => {
    const url = urlInput.trim();
    if (!url) return;
    setShowUrlDialog(false);
    importFromUrl(url);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(t("common.delete"), `${t("files.deleteConfirm")} (${selectedIds.length})`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          handleDeleteFiles(selectedIds);
          clearSelection();
        },
      },
    ]);
  };

  const handleSortToggle = (key: "name" | "date" | "size") => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
    }
  };

  const getPhaseLabel = (): string => {
    switch (importProgress.phase) {
      case "extracting":
        return t("files.extracting");
      case "scanning":
        return t("files.scanning");
      case "downloading":
        return t("files.downloading");
      default:
        return `${t("files.importing")}...`;
    }
  };

  const renderFileItem = useCallback(
    ({ item }: { item: FitsMetadata }) => (
      <FileListItem
        file={item}
        selected={selectedIds.includes(item.id)}
        onPress={() => {
          if (isSelectionMode) {
            toggleSelection(item.id);
          } else {
            router.push(`/viewer/${item.id}`);
          }
        }}
        onLongPress={() => {
          if (!isSelectionMode) {
            setSelectionMode(true);
            toggleSelection(item.id);
          }
        }}
      />
    ),
    [selectedIds, isSelectionMode, toggleSelection, setSelectionMode, router],
  );

  const keyExtractor = useCallback((item: FitsMetadata) => item.id, []);

  const ListHeader = useMemo(
    () => (
      <View className="gap-3">
        {/* Title */}
        <View>
          <Text className="text-2xl font-bold text-foreground">{t("files.title")}</Text>
          <Text className="mt-1 text-sm text-muted">
            {t("files.subtitle")} ({files.length})
          </Text>
        </View>

        {/* Storage Stats */}
        {storageStats.fitsCount > 0 && (
          <View className="flex-row items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
            <Ionicons name="server-outline" size={14} color={mutedColor} />
            <Text className="text-xs text-muted">
              {t("files.storageUsed")}: {formatFileSize(storageStats.fitsSize)} ·{" "}
              {t("files.filesCount").replace("{count}", String(storageStats.fitsCount))}
            </Text>
          </View>
        )}

        <Separator />

        {/* Search Bar */}
        <View className="flex-row items-center gap-2 rounded-xl border border-separator bg-surface-secondary px-3 py-2">
          <Ionicons name="search-outline" size={16} color={mutedColor} />
          <TextInput
            className="flex-1 text-sm text-foreground"
            placeholder={t("files.searchPlaceholder")}
            placeholderTextColor={mutedColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={mutedColor} />
            </TouchableOpacity>
          )}
        </View>

        {/* Import Actions */}
        <View className="flex-row gap-2">
          <Button variant="primary" className="flex-1" onPress={openImportSheet}>
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Button.Label>{t("files.importOptions")}</Button.Label>
          </Button>
          {isSelectionMode ? (
            <View className="flex-row gap-1">
              <Button variant="outline" onPress={handleBatchDelete}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </Button>
              <Button variant="outline" onPress={clearSelection}>
                <Ionicons name="close-outline" size={16} color={mutedColor} />
              </Button>
            </View>
          ) : (
            <Button variant="outline" onPress={() => router.push("/convert")}>
              <Ionicons name="swap-horizontal-outline" size={16} color={mutedColor} />
            </Button>
          )}
        </View>

        {/* Sort Chips */}
        <View className="flex-row items-center gap-2">
          {(["name", "date", "size"] as const).map((key) => (
            <TouchableOpacity key={key} onPress={() => handleSortToggle(key)}>
              <Chip size="sm" variant={sortBy === key ? "primary" : "secondary"}>
                <Chip.Label className="text-xs">
                  {t(
                    `files.sortBy${key.charAt(0).toUpperCase() + key.slice(1)}` as
                      | "files.sortByName"
                      | "files.sortByDate"
                      | "files.sortBySize",
                  )}
                  {sortBy === key && (sortOrder === "asc" ? " ↑" : " ↓")}
                </Chip.Label>
              </Chip>
            </TouchableOpacity>
          ))}
        </View>

        <Separator />
      </View>
    ),
    [
      t,
      files.length,
      storageStats,
      mutedColor,
      searchQuery,
      setSearchQuery,
      isSelectionMode,
      sortBy,
      sortOrder,
      clearSelection,
      router,
      openImportSheet,
      handleBatchDelete,
      handleSortToggle,
      successColor,
    ],
  );

  return (
    <View className="flex-1 bg-background">
      <LoadingOverlay
        visible={isImporting}
        message={getPhaseLabel()}
        percent={importProgress.percent}
        currentFile={importProgress.currentFile}
        current={importProgress.current}
        total={importProgress.total}
        onCancel={cancelImport}
      />

      {files.length === 0 && !searchQuery ? (
        <View className="flex-1 px-4 pt-14">
          {ListHeader}
          <EmptyState
            icon="telescope-outline"
            title={t("files.emptyState")}
            description={t("files.emptyHint")}
            actionLabel={t("files.importFile")}
            onAction={openImportSheet}
          />
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderFileItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<EmptyState icon="search-outline" title={t("files.noFitsFound")} />}
          contentContainerClassName="px-4 py-14"
          ItemSeparatorComponent={ListItemSeparator}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Import Options BottomSheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={[320]}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: "rgba(30, 30, 30, 0.95)" }}
        handleIndicatorStyle={{ backgroundColor: mutedColor }}
      >
        <BottomSheetView className="px-6 pb-8">
          <Text className="mb-1 text-lg font-bold text-foreground">{t("files.importOptions")}</Text>
          <Text className="mb-4 text-xs text-muted">{t("files.selectImportMethod")}</Text>

          <View className="gap-2">
            <TouchableOpacity
              onPress={handleImportFile}
              className="flex-row items-center gap-3 rounded-xl bg-surface-secondary p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <Ionicons name="document-outline" size={20} color={successColor} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {t("files.importFile")}
                </Text>
                <Text className="text-xs text-muted">FITS, FIT, FTS</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImportFolder}
              className="flex-row items-center gap-3 rounded-xl bg-surface-secondary p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <Ionicons name="folder-open-outline" size={20} color={successColor} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {t("files.importFolder")}
                </Text>
                <Text className="text-xs text-muted">{t("files.scanning")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImportZip}
              className="flex-row items-center gap-3 rounded-xl bg-surface-secondary p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <Ionicons name="archive-outline" size={20} color={successColor} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {t("files.importZip")}
                </Text>
                <Text className="text-xs text-muted">ZIP</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImportUrl}
              className="flex-row items-center gap-3 rounded-xl bg-surface-secondary p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <Ionicons name="cloud-download-outline" size={20} color={successColor} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {t("files.importFromUrl")}
                </Text>
                <Text className="text-xs text-muted">HTTP / HTTPS</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* URL Input Dialog */}
      <Modal
        visible={showUrlDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUrlDialog(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 items-center justify-center bg-black/60"
        >
          <View className="mx-6 w-full max-w-sm rounded-2xl bg-surface-secondary p-6">
            <Text className="text-lg font-bold text-foreground">{t("files.enterUrl")}</Text>
            <Text className="mt-1 text-xs text-muted">{t("files.enterUrlHint")}</Text>
            <TextInput
              className="mt-4 rounded-xl border border-separator bg-background px-4 py-3 text-sm text-foreground"
              placeholder="https://example.com/file.fits"
              placeholderTextColor={mutedColor}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View className="mt-4 flex-row justify-end gap-2">
              <Button variant="outline" onPress={() => setShowUrlDialog(false)}>
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
              <Button variant="primary" onPress={confirmUrlImport} isDisabled={!urlInput.trim()}>
                <Button.Label>{t("files.downloading")}</Button.Label>
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
