import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { View, Text, FlatList, Alert, useWindowDimensions } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Input,
  PressableFeedback,
  Separator,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useFitsStore } from "../../stores/useFitsStore";
import { useFileManager } from "../../hooks/useFileManager";
import type { ImportResult } from "../../hooks/useFileManager";
import { FileListItem } from "../../components/gallery/FileListItem";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { QuickLookModal } from "../../components/common/QuickLookModal";
import { formatFileSize } from "../../lib/utils/fileManager";
import type { FitsMetadata } from "../../lib/fits/types";

const ListItemSeparator = () => <View className="h-2" />;

export default function FilesScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const { height: screenHeight } = useWindowDimensions();
  const { isLandscape } = useScreenOrientation();

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
  const [quickLookFile, setQuickLookFile] = useState<FitsMetadata | null>(null);

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

  const openImportSheet = useCallback(() => {
    bottomSheetRef.current?.expand();
  }, []);

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

  const handleBatchDelete = useCallback(() => {
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
  }, [selectedIds, t, handleDeleteFiles, clearSelection]);

  const handleSortToggle = useCallback(
    (key: "name" | "date" | "size") => {
      if (sortBy === key) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(key);
      }
    },
    [sortBy, sortOrder, setSortBy, setSortOrder],
  );

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
            setQuickLookFile(item);
          }
        }}
      />
    ),
    [selectedIds, isSelectionMode, toggleSelection, router],
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
        <TextField>
          <View className="w-full flex-row items-center">
            <Input
              className="flex-1 pl-9 pr-9"
              placeholder={t("files.searchPlaceholder")}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            <Ionicons
              name="search-outline"
              size={16}
              color={mutedColor}
              style={{ position: "absolute", left: 12 }}
            />
            {searchQuery.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={() => setSearchQuery("")}
                style={{ position: "absolute", right: 12 }}
              >
                <Ionicons name="close-circle" size={16} color={mutedColor} />
              </Button>
            )}
          </View>
        </TextField>

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
            <>
              <Button variant="outline" onPress={() => setSelectionMode(true)}>
                <Ionicons name="checkmark-circle-outline" size={16} color={mutedColor} />
              </Button>
              <Button variant="outline" onPress={() => router.push("/convert")}>
                <Ionicons name="swap-horizontal-outline" size={16} color={mutedColor} />
              </Button>
            </>
          )}
        </View>

        {/* Sort Chips */}
        <View className="flex-row items-center gap-2">
          {(["name", "date", "size"] as const).map((key) => (
            <Chip
              key={key}
              size="sm"
              variant={sortBy === key ? "primary" : "secondary"}
              onPress={() => handleSortToggle(key)}
            >
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
      setSelectionMode,
      router,
      openImportSheet,
      handleBatchDelete,
      handleSortToggle,
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
        <View className={`flex-1 px-4 ${isLandscape ? "pt-2" : "pt-14"}`}>
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
          contentContainerClassName={`px-4 ${isLandscape ? "py-2" : "py-14"}`}
          ItemSeparatorComponent={ListItemSeparator}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Import Options BottomSheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={[Math.min(320, screenHeight * 0.6)]}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: "rgba(30, 30, 30, 0.95)" }}
        handleIndicatorStyle={{ backgroundColor: mutedColor }}
      >
        <BottomSheetView className="px-6 pb-8">
          <Text className="mb-1 text-lg font-bold text-foreground">{t("files.importOptions")}</Text>
          <Text className="mb-4 text-xs text-muted">{t("files.selectImportMethod")}</Text>

          <View className="gap-2">
            <PressableFeedback
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
            </PressableFeedback>

            <PressableFeedback
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
            </PressableFeedback>

            <PressableFeedback
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
            </PressableFeedback>

            <PressableFeedback
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
            </PressableFeedback>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* URL Input Dialog */}
      <Dialog isOpen={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Close />
            <Dialog.Title>{t("files.enterUrl")}</Dialog.Title>
            <Dialog.Description>{t("files.enterUrlHint")}</Dialog.Description>
            <TextField className="mt-4">
              <Input
                placeholder="https://example.com/file.fits"
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </TextField>
            <View className="mt-4 flex-row justify-end gap-2">
              <Button variant="outline" onPress={() => setShowUrlDialog(false)}>
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
              <Button variant="primary" onPress={confirmUrlImport} isDisabled={!urlInput.trim()}>
                <Button.Label>{t("files.downloading")}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      {/* Quick Look Preview */}
      <QuickLookModal
        visible={!!quickLookFile}
        file={quickLookFile}
        onClose={() => setQuickLookFile(null)}
        onOpenViewer={(id) => router.push(`/viewer/${id}`)}
        onOpenEditor={(id) => router.push(`/editor/${id}`)}
      />
    </View>
  );
}
