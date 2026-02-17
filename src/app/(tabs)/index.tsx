import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { View, Text, FlatList, Alert, useWindowDimensions, ScrollView } from "react-native";
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
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { filterAndSortFiles, useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useTrashStore } from "../../stores/useTrashStore";
import { useFileGroupStore } from "../../stores/useFileGroupStore";
import { useFileManager } from "../../hooks/useFileManager";
import { useAlbums } from "../../hooks/useAlbums";
import type { ImportResult } from "../../hooks/useFileManager";
import { FileListItem } from "../../components/gallery/FileListItem";
import { AlbumPickerSheet } from "../../components/gallery/AlbumPickerSheet";
import { BatchTagSheet } from "../../components/gallery/BatchTagSheet";
import { BatchRenameSheet } from "../../components/gallery/BatchRenameSheet";
import { TrashSheet } from "../../components/gallery/TrashSheet";
import { FileGroupSheet } from "../../components/gallery/FileGroupSheet";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { QuickLookModal } from "../../components/common/QuickLookModal";
import { formatFileSize } from "../../lib/utils/fileManager";
import { buildMetadataIndex } from "../../lib/gallery/metadataIndex";
import type { FitsMetadata, FrameType } from "../../lib/fits/types";

const ListItemSeparator = () => <View className="h-2" />;

const FRAME_FILTERS: FrameType[] = ["light", "dark", "flat", "bias", "unknown"];

export default function FilesScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { isLandscape, isLandscapeTablet, contentPaddingTop, horizontalPadding } =
    useResponsiveLayout();

  const allFiles = useFitsStore((s) => s.files);
  const sortBy = useFitsStore((s) => s.sortBy);
  const sortOrder = useFitsStore((s) => s.sortOrder);
  const filterTags = useFitsStore((s) => s.filterTags);
  const setSortBy = useFitsStore((s) => s.setSortBy);
  const setSortOrder = useFitsStore((s) => s.setSortOrder);
  const searchQuery = useFitsStore((s) => s.searchQuery);
  const setSearchQuery = useFitsStore((s) => s.setSearchQuery);
  const selectedIds = useFitsStore((s) => s.selectedIds);
  const isSelectionMode = useFitsStore((s) => s.isSelectionMode);
  const toggleSelection = useFitsStore((s) => s.toggleSelection);
  const setSelectedIds = useFitsStore((s) => s.setSelectedIds);
  const toggleSelectionBatch = useFitsStore((s) => s.toggleSelectionBatch);
  const clearSelection = useFitsStore((s) => s.clearSelection);
  const setSelectionMode = useFitsStore((s) => s.setSelectionMode);
  const toggleFavorite = useFitsStore((s) => s.toggleFavorite);
  const updateFile = useFitsStore((s) => s.updateFile);

  const fileListStyle = useSettingsStore((s) => s.fileListStyle);
  const setFileListStyle = useSettingsStore((s) => s.setFileListStyle);
  const defaultGridColumns = useSettingsStore((s) => s.defaultGridColumns);
  const confirmDestructiveActions = useSettingsStore((s) => s.confirmDestructiveActions);
  const thumbShowFilename = useSettingsStore((s) => s.thumbnailShowFilename);
  const thumbShowObject = useSettingsStore((s) => s.thumbnailShowObject);
  const thumbShowFilter = useSettingsStore((s) => s.thumbnailShowFilter);
  const thumbShowExposure = useSettingsStore((s) => s.thumbnailShowExposure);
  const trashItems = useTrashStore((s) => s.items);
  const fileGroups = useFileGroupStore((s) => s.groups);
  const fileGroupMap = useFileGroupStore((s) => s.fileGroupMap);

  const { albums, addImagesToAlbum } = useAlbums();

  const {
    isImporting,
    importProgress,
    importError,
    lastImportResult,
    isZipImportAvailable,
    pickAndImportFile,
    pickAndImportFolder,
    pickAndImportZip,
    importFromUrl,
    importFromClipboard,
    cancelImport,
    handleDeleteFiles,
    undoLastDelete,
    restoreFromTrash,
    emptyTrash,
    exportFiles,
    groupFiles,
    handleRenameFiles,
  } = useFileManager();

  const bottomSheetRef = useRef<BottomSheet>(null);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [quickLookFile, setQuickLookFile] = useState<FitsMetadata | null>(null);
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const [showBatchTag, setShowBatchTag] = useState(false);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [showTrashSheet, setShowTrashSheet] = useState(false);
  const [showGroupSheet, setShowGroupSheet] = useState(false);
  const [pendingDeleteToken, setPendingDeleteToken] = useState<string | null>(null);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);

  const [filterObject, setFilterObject] = useState("");
  const [filterFilter, setFilterFilter] = useState("");
  const [filterSourceFormat, setFilterSourceFormat] = useState("");
  const [filterFrameType, setFilterFrameType] = useState<FrameType | "">("");
  const [filterTag, setFilterTag] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const files = useMemo(
    () => filterAndSortFiles(allFiles, searchQuery, filterTags, sortBy, sortOrder),
    [allFiles, filterTags, searchQuery, sortBy, sortOrder],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedFiles = useMemo(
    () => allFiles.filter((file) => selectedIdSet.has(file.id)),
    [allFiles, selectedIdSet],
  );

  const metadataIndex = useMemo(() => buildMetadataIndex(allFiles), [allFiles]);

  const displayFiles = useMemo(() => {
    return files.filter((file) => {
      if (filterObject && file.object !== filterObject) return false;
      if (filterFilter && file.filter !== filterFilter) return false;
      if (filterSourceFormat && file.sourceFormat !== filterSourceFormat) return false;
      if (filterFrameType && file.frameType !== filterFrameType) return false;
      if (filterTag && !file.tags.includes(filterTag)) return false;
      if (filterGroupId && !(fileGroupMap[file.id] ?? []).includes(filterGroupId)) return false;
      if (favoriteOnly && !file.isFavorite) return false;
      return true;
    });
  }, [
    files,
    filterObject,
    filterFilter,
    filterSourceFormat,
    filterFrameType,
    filterTag,
    filterGroupId,
    fileGroupMap,
    favoriteOnly,
  ]);

  const storageStats = useMemo(() => {
    let totalSize = 0;
    for (const f of allFiles) {
      totalSize += f.fileSize;
    }
    return { fitsCount: allFiles.length, fitsSize: totalSize };
  }, [allFiles]);

  const activeFilterCount = useMemo(() => {
    return (
      [filterObject, filterFilter, filterSourceFormat, filterFrameType, filterTag].filter(Boolean)
        .length +
      (filterGroupId ? 1 : 0) +
      (favoriteOnly ? 1 : 0)
    );
  }, [
    filterObject,
    filterFilter,
    filterSourceFormat,
    filterFrameType,
    filterTag,
    filterGroupId,
    favoriteOnly,
  ]);

  const isGridStyle = fileListStyle === "grid";
  const listColumns = isGridStyle
    ? isLandscapeTablet
      ? Math.min(defaultGridColumns + 2, 6)
      : isLandscape
        ? Math.min(defaultGridColumns + 1, 5)
        : defaultGridColumns
    : 1;
  const shouldStackTopActions = isSelectionMode || screenWidth < 420;

  const showImportResult = useCallback(
    (result: ImportResult) => {
      const base = t("files.importPartialMsg")
        .replace("{success}", String(result.success))
        .replace("{total}", String(result.total))
        .replace("{failed}", String(result.failed));
      const details: string[] = [base];
      if (result.skippedDuplicate > 0) {
        details.push(
          t("files.importSkippedDuplicates").replace("{count}", String(result.skippedDuplicate)),
        );
      }
      if (result.skippedUnsupported > 0) {
        details.push(
          t("files.importSkippedUnsupported").replace("{count}", String(result.skippedUnsupported)),
        );
      }
      Alert.alert(t("files.importSuccess"), details.join("\n"));
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
        errorKey === "noFitsInFolder" || errorKey === "noSupportedInFolder"
          ? t("files.noSupportedInFolder")
          : errorKey === "noFitsInZip" || errorKey === "noSupportedInZip"
            ? t("files.noSupportedInZip")
            : errorKey === "zipImportUnavailable"
              ? t("files.importZipUnavailable")
              : errorKey === "clipboardNoSupportedContent"
                ? t("files.clipboardNoSupportedContent")
                : importError;
      Alert.alert(t("files.importFailed"), message);
    }
  }, [importError, isImporting, t]);

  useEffect(() => {
    if (!pendingDeleteToken) return;
    const timer = setTimeout(() => {
      setPendingDeleteToken(null);
      setPendingDeleteCount(0);
    }, 6200);
    return () => clearTimeout(timer);
  }, [pendingDeleteToken]);

  const openImportSheet = useCallback(() => {
    bottomSheetRef.current?.expand();
  }, []);

  const closeImportSheet = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);

  const handleImportFile = useCallback(() => {
    closeImportSheet();
    pickAndImportFile();
  }, [closeImportSheet, pickAndImportFile]);

  const handleImportFolder = useCallback(() => {
    closeImportSheet();
    pickAndImportFolder();
  }, [closeImportSheet, pickAndImportFolder]);

  const handleImportZip = useCallback(() => {
    closeImportSheet();
    if (!isZipImportAvailable) {
      Alert.alert(t("files.importFailed"), t("files.importZipUnavailable"));
      return;
    }
    pickAndImportZip();
  }, [closeImportSheet, isZipImportAvailable, pickAndImportZip, t]);

  const handleImportUrl = useCallback(() => {
    closeImportSheet();
    setUrlInput("");
    setShowUrlDialog(true);
  }, [closeImportSheet]);

  const handleImportClipboard = useCallback(() => {
    closeImportSheet();
    importFromClipboard();
  }, [closeImportSheet, importFromClipboard]);

  const confirmUrlImport = useCallback(() => {
    const url = urlInput.trim();
    if (!url) return;
    setShowUrlDialog(false);
    importFromUrl(url);
  }, [urlInput, importFromUrl]);

  const handleSortToggle = useCallback(
    (key: "name" | "date" | "size" | "quality") => {
      if (sortBy === key) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(key);
      }
    },
    [sortBy, sortOrder, setSortBy, setSortOrder],
  );

  const applyDeleteFiles = useCallback(
    (fileIds: string[], clearAfterDelete: boolean) => {
      const result = handleDeleteFiles(fileIds);
      if (result.token) {
        setPendingDeleteToken(result.token);
        setPendingDeleteCount(result.success);
      }
      if (clearAfterDelete) {
        clearSelection();
      }
      return result;
    },
    [clearSelection, handleDeleteFiles],
  );

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    const executeDelete = () => {
      applyDeleteFiles(selectedIds, true);
    };

    if (!confirmDestructiveActions) {
      executeDelete();
      return;
    }

    Alert.alert(
      t("files.moveToTrash"),
      `${t("files.moveToTrashConfirm")} (${selectedIds.length})`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("files.moveToTrash"),
          style: "destructive",
          onPress: executeDelete,
        },
      ],
    );
  }, [applyDeleteFiles, confirmDestructiveActions, selectedIds, t]);

  const handleSingleDelete = useCallback(
    (fileId: string) => {
      const executeDelete = () => {
        applyDeleteFiles([fileId], false);
      };

      if (!confirmDestructiveActions) {
        executeDelete();
        return;
      }

      Alert.alert(t("files.moveToTrash"), t("files.moveToTrashConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("files.moveToTrash"),
          style: "destructive",
          onPress: executeDelete,
        },
      ]);
    },
    [applyDeleteFiles, confirmDestructiveActions, t],
  );

  const handleUndoDelete = useCallback(() => {
    if (!pendingDeleteToken) return;
    const result = undoLastDelete(pendingDeleteToken);
    setPendingDeleteToken(null);
    setPendingDeleteCount(0);
    if (!result.success) {
      Alert.alert(t("common.error"), t("files.undoFailed"));
    }
  }, [pendingDeleteToken, t, undoLastDelete]);

  const handleSelectAllVisible = useCallback(() => {
    if (displayFiles.length === 0) return;
    setSelectionMode(true);
    const displayIds = displayFiles.map((file) => file.id);
    const displayIdSet = new Set(displayIds);
    const allSelected = displayIds.every((id) => selectedIdSet.has(id));
    if (allSelected) {
      setSelectedIds(selectedIds.filter((id) => !displayIdSet.has(id)));
      return;
    }

    setSelectedIds([...selectedIds, ...displayIds]);
  }, [displayFiles, selectedIdSet, selectedIds, setSelectedIds, setSelectionMode]);

  const handleInvertSelection = useCallback(() => {
    if (displayFiles.length === 0) return;
    setSelectionMode(true);
    toggleSelectionBatch(displayFiles.map((file) => file.id));
  }, [displayFiles, setSelectionMode, toggleSelectionBatch]);

  const handleBatchFavorite = useCallback(() => {
    if (selectedIds.length === 0) return;
    const selectedFiles = allFiles.filter((file) => selectedIdSet.has(file.id));
    const shouldFavorite = selectedFiles.some((file) => !file.isFavorite);
    for (const file of selectedFiles) {
      updateFile(file.id, { isFavorite: shouldFavorite });
    }
  }, [allFiles, selectedIdSet, selectedIds.length, updateFile]);

  const handleBatchExport = useCallback(async () => {
    if (selectedIds.length === 0) return;
    const result = await exportFiles(selectedIds);
    if (result.success) {
      Alert.alert(
        t("common.success"),
        t("files.exportSuccess").replace("{count}", String(result.exported)),
      );
      return;
    }
    Alert.alert(t("common.error"), t("files.exportFailed"));
  }, [exportFiles, selectedIds, t]);

  const handleGroupApply = useCallback(
    (groupId: string) => {
      const result = groupFiles(selectedIds, groupId);
      if (result.success > 0) {
        clearSelection();
      }
      return result;
    },
    [groupFiles, selectedIds, clearSelection],
  );

  const handleRestoreTrash = useCallback(
    (trashIds: string[]) => {
      const result = restoreFromTrash(trashIds);
      if (result.success > 0 && result.failed === 0) {
        Alert.alert(
          t("common.success"),
          t("files.restoreSuccess").replace("{count}", String(result.success)),
        );
        return;
      }

      if (result.success > 0 && result.failed > 0) {
        const successMsg = t("files.restoreSuccess").replace("{count}", String(result.success));
        Alert.alert(t("common.error"), `${successMsg}\n${t("files.restoreFailed")}`);
        return;
      }

      if (result.failed > 0) {
        Alert.alert(t("common.error"), t("files.restoreFailed"));
      }
    },
    [restoreFromTrash, t],
  );

  const applyEmptyTrash = useCallback(
    (trashIds?: string[]) => {
      const result = emptyTrash(trashIds);
      if (result.deleted > 0 && result.failed === 0) {
        Alert.alert(
          t("common.success"),
          t("files.emptyTrashSuccess").replace("{count}", String(result.deleted)),
        );
        return;
      }

      if (result.deleted > 0 && result.failed > 0) {
        const successMsg = t("files.emptyTrashSuccess").replace("{count}", String(result.deleted));
        Alert.alert(t("common.error"), `${successMsg}\n${t("files.restoreFailed")}`);
        return;
      }

      if (result.failed > 0) {
        Alert.alert(t("common.error"), t("files.restoreFailed"));
      }
    },
    [emptyTrash, t],
  );

  const handleEmptyTrash = useCallback(
    (trashIds?: string[]) => {
      const targetCount = trashIds?.length ?? trashItems.length;
      if (targetCount === 0) return;

      if (!confirmDestructiveActions) {
        applyEmptyTrash(trashIds);
        return;
      }

      Alert.alert(t("files.emptyTrash"), t("files.emptyTrashConfirm"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("files.emptyTrash"),
          style: "destructive",
          onPress: () => applyEmptyTrash(trashIds),
        },
      ]);
    },
    [applyEmptyTrash, confirmDestructiveActions, t, trashItems.length],
  );

  const handleAddToAlbum = useCallback(
    (albumId: string) => {
      if (selectedIds.length === 0) return;
      addImagesToAlbum(albumId, selectedIds);
      setShowAlbumPicker(false);
      clearSelection();
    },
    [addImagesToAlbum, selectedIds, clearSelection],
  );

  const handleBatchRenameApply = useCallback(
    (operations: Array<{ fileId: string; filename: string }>) => {
      const result = handleRenameFiles(operations);
      if (result.success > 0) {
        clearSelection();
      }
      return result;
    },
    [clearSelection, handleRenameFiles],
  );

  const goToBatchConvert = useCallback(() => {
    const idsParam = selectedIds.join(",");
    if (!idsParam) {
      router.push("/convert?tab=batch");
      return;
    }
    router.push(`/convert?tab=batch&ids=${encodeURIComponent(idsParam)}`);
  }, [selectedIds, router]);

  const clearLocalFilters = useCallback(() => {
    setFilterObject("");
    setFilterFilter("");
    setFilterSourceFormat("");
    setFilterFrameType("");
    setFilterTag("");
    setFilterGroupId("");
    setFavoriteOnly(false);
  }, []);

  const getPhaseLabel = (): string => {
    switch (importProgress.phase) {
      case "extracting":
        return t("files.extracting");
      case "scanning":
        return t("files.scanning");
      case "downloading":
        return t("files.downloading");
      case "clipboard":
        return t("files.clipboardImporting");
      default:
        return `${t("files.importing")}...`;
    }
  };

  const renderFileItem = useCallback(
    ({ item }: { item: FitsMetadata }) => {
      const content = (
        <FileListItem
          file={item}
          layout={fileListStyle}
          selected={selectedIdSet.has(item.id)}
          showFilename={thumbShowFilename}
          showObject={thumbShowObject}
          showFilter={thumbShowFilter}
          showExposure={thumbShowExposure}
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
            } else {
              toggleSelection(item.id);
            }
          }}
          onToggleFavorite={() => toggleFavorite(item.id)}
          onDelete={() => handleSingleDelete(item.id)}
        />
      );

      if (!isGridStyle) return content;
      return <View className="flex-1 px-1 pb-2">{content}</View>;
    },
    [
      fileListStyle,
      selectedIdSet,
      thumbShowFilename,
      thumbShowObject,
      thumbShowFilter,
      thumbShowExposure,
      isSelectionMode,
      toggleSelection,
      router,
      toggleFavorite,
      handleSingleDelete,
      isGridStyle,
    ],
  );

  const keyExtractor = useCallback((item: FitsMetadata) => item.id, []);

  const ListHeader = useMemo(
    () => (
      <View className="gap-3">
        <View>
          <Text className="text-2xl font-bold text-foreground">{t("files.title")}</Text>
          <Text className="mt-1 text-sm text-muted">
            {t("files.subtitle")} ({displayFiles.length}/{allFiles.length})
          </Text>
        </View>

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

        <View className="flex-row flex-wrap items-center gap-2">
          <Button
            variant="primary"
            className={shouldStackTopActions ? "w-full" : "flex-1"}
            onPress={openImportSheet}
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" />
            <Button.Label>{t("files.importOptions")}</Button.Label>
          </Button>
          {!isSelectionMode ? (
            <>
              <Button
                testID="files-enter-selection-mode-button"
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => setSelectionMode(true)}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => router.push("/convert")}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                testID="files-open-trash-button"
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => setShowTrashSheet(true)}
              >
                <Ionicons
                  name={trashItems.length > 0 ? "trash-bin" : "trash-bin-outline"}
                  size={16}
                  color={mutedColor}
                />
              </Button>
            </>
          ) : (
            <>
              <Button
                testID="files-select-all-visible-button"
                size="sm"
                isIconOnly
                variant="outline"
                onPress={handleSelectAllVisible}
              >
                <Ionicons name="checkbox-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                testID="files-invert-selection-button"
                size="sm"
                isIconOnly
                variant="outline"
                onPress={handleInvertSelection}
                isDisabled={displayFiles.length === 0}
              >
                <Ionicons name="shuffle-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                size="sm"
                isIconOnly
                variant="outline"
                onPress={handleBatchFavorite}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="heart-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                testID="files-open-album-picker-button"
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => setShowAlbumPicker(true)}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="albums-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                testID="files-open-batch-tag-button"
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => setShowBatchTag(true)}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="pricetag-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                testID="files-open-batch-rename-button"
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => setShowBatchRename(true)}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="text-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                testID="files-open-group-sheet-button"
                size="sm"
                isIconOnly
                variant="outline"
                onPress={() => setShowGroupSheet(true)}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="folder-open-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                size="sm"
                isIconOnly
                variant="outline"
                onPress={handleBatchExport}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="share-social-outline" size={16} color={mutedColor} />
              </Button>
              <Button
                testID="files-batch-delete-button"
                size="sm"
                isIconOnly
                variant="outline"
                onPress={handleBatchDelete}
                isDisabled={selectedIds.length === 0}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </Button>
              <Button size="sm" isIconOnly variant="outline" onPress={clearSelection}>
                <Ionicons name="close-outline" size={16} color={mutedColor} />
              </Button>
            </>
          )}
        </View>

        {isSelectionMode && (
          <View className="flex-row items-center justify-between rounded-lg bg-surface-secondary px-3 py-2">
            <Text className="text-xs text-muted">
              {selectedIds.length} {t("common.selected")}
            </Text>
            <View className="flex-row items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onPress={handleBatchExport}
                isDisabled={!selectedIds.length}
              >
                <Ionicons name="share-social-outline" size={14} color={mutedColor} />
                <Button.Label>{t("files.exportSelected")}</Button.Label>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onPress={goToBatchConvert}
                isDisabled={!selectedIds.length}
              >
                <Ionicons name="swap-horizontal-outline" size={14} color={mutedColor} />
                <Button.Label>{t("converter.batchConvert")}</Button.Label>
              </Button>
            </View>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row items-center gap-2">
            {(["name", "date", "size", "quality"] as const).map((key) => (
              <Chip
                key={key}
                size="sm"
                variant={sortBy === key ? "primary" : "secondary"}
                onPress={() => handleSortToggle(key)}
              >
                <Chip.Label className="text-xs">
                  {key === "quality"
                    ? t("gallery.quality")
                    : t(
                        `files.sortBy${key.charAt(0).toUpperCase() + key.slice(1)}` as
                          | "files.sortByName"
                          | "files.sortByDate"
                          | "files.sortBySize",
                      )}
                  {sortBy === key && (sortOrder === "asc" ? " ↑" : " ↓")}
                </Chip.Label>
              </Chip>
            ))}

            <View className="h-4 w-px bg-separator" />

            {(["grid", "list", "compact"] as const).map((style) => (
              <Chip
                key={style}
                size="sm"
                variant={fileListStyle === style ? "primary" : "secondary"}
                onPress={() => setFileListStyle(style)}
              >
                <Chip.Label className="text-xs">
                  {style === "grid"
                    ? t("settings.fileListGrid")
                    : style === "list"
                      ? t("settings.fileListList")
                      : t("settings.fileListCompact")}
                </Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row items-center gap-2">
            <Chip
              size="sm"
              variant={favoriteOnly ? "primary" : "secondary"}
              onPress={() => setFavoriteOnly((prev) => !prev)}
            >
              <Ionicons name="heart-outline" size={12} color={favoriteOnly ? "#fff" : mutedColor} />
              <Chip.Label className="text-xs">{t("gallery.favoritesOnly")}</Chip.Label>
            </Chip>
            {metadataIndex.objects.map((objectValue) => (
              <Chip
                key={`obj-${objectValue}`}
                size="sm"
                variant={filterObject === objectValue ? "primary" : "secondary"}
                onPress={() => setFilterObject((prev) => (prev === objectValue ? "" : objectValue))}
              >
                <Chip.Label className="text-xs">{objectValue}</Chip.Label>
              </Chip>
            ))}
            {metadataIndex.sourceFormats.map((fmt) => (
              <Chip
                key={`fmt-${fmt}`}
                size="sm"
                variant={filterSourceFormat === fmt ? "primary" : "secondary"}
                onPress={() => setFilterSourceFormat((prev) => (prev === fmt ? "" : fmt))}
              >
                <Chip.Label className="text-xs">{fmt.toUpperCase()}</Chip.Label>
              </Chip>
            ))}
            {fileGroups.map((group) => (
              <Chip
                key={`group-${group.id}`}
                size="sm"
                variant={filterGroupId === group.id ? "primary" : "secondary"}
                onPress={() => setFilterGroupId((prev) => (prev === group.id ? "" : group.id))}
              >
                <Chip.Label className="text-xs">{group.name}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row items-center gap-2">
            {metadataIndex.filters.map((filterValue) => (
              <Chip
                key={`filter-${filterValue}`}
                size="sm"
                variant={filterFilter === filterValue ? "primary" : "secondary"}
                onPress={() => setFilterFilter((prev) => (prev === filterValue ? "" : filterValue))}
              >
                <Chip.Label className="text-xs">{filterValue}</Chip.Label>
              </Chip>
            ))}
            {FRAME_FILTERS.map((frameType) => (
              <Chip
                key={`frame-${frameType}`}
                size="sm"
                variant={filterFrameType === frameType ? "primary" : "secondary"}
                onPress={() => setFilterFrameType((prev) => (prev === frameType ? "" : frameType))}
              >
                <Chip.Label className="text-xs">{t(`gallery.frameTypes.${frameType}`)}</Chip.Label>
              </Chip>
            ))}
            {metadataIndex.tags.map((tagValue) => (
              <Chip
                key={`tag-${tagValue}`}
                size="sm"
                variant={filterTag === tagValue ? "primary" : "secondary"}
                onPress={() => setFilterTag((prev) => (prev === tagValue ? "" : tagValue))}
              >
                <Chip.Label className="text-xs">#{tagValue}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>

        {activeFilterCount > 0 && (
          <View className="flex-row items-center justify-between rounded-lg bg-surface-secondary px-3 py-2">
            <Text className="text-xs text-muted">
              {activeFilterCount} {t("common.selected")}
            </Text>
            <Button size="sm" variant="ghost" onPress={clearLocalFilters}>
              <Button.Label>{t("targets.clearFilters")}</Button.Label>
            </Button>
          </View>
        )}

        <Separator />
      </View>
    ),
    [
      t,
      displayFiles.length,
      allFiles.length,
      storageStats,
      mutedColor,
      searchQuery,
      setSearchQuery,
      openImportSheet,
      shouldStackTopActions,
      isSelectionMode,
      setSelectionMode,
      router,
      setShowTrashSheet,
      handleSelectAllVisible,
      handleInvertSelection,
      handleBatchFavorite,
      setShowGroupSheet,
      handleBatchExport,
      goToBatchConvert,
      handleBatchDelete,
      clearSelection,
      selectedIds.length,
      trashItems.length,
      sortBy,
      sortOrder,
      handleSortToggle,
      fileListStyle,
      setFileListStyle,
      favoriteOnly,
      fileGroups,
      metadataIndex,
      filterObject,
      filterFilter,
      filterSourceFormat,
      filterFrameType,
      filterTag,
      filterGroupId,
      setFilterGroupId,
      activeFilterCount,
      clearLocalFilters,
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

      {displayFiles.length === 0 && !searchQuery && activeFilterCount === 0 ? (
        <View
          className="flex-1"
          style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
        >
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
          data={displayFiles}
          renderItem={renderFileItem}
          key={isGridStyle ? `grid-${listColumns}` : fileListStyle}
          keyExtractor={keyExtractor}
          numColumns={listColumns}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <EmptyState icon="search-outline" title={t("files.noSupportedFound")} />
          }
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: isLandscape ? 8 : contentPaddingTop,
            paddingBottom: 24,
          }}
          ItemSeparatorComponent={isGridStyle ? undefined : ListItemSeparator}
          showsVerticalScrollIndicator={false}
        />
      )}

      {pendingDeleteToken && (
        <View className="absolute bottom-6 left-4 right-4 rounded-xl bg-surface-secondary px-3 py-2 border border-separator">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-xs text-muted flex-1">
              {t("files.undoDeleteHint").replace("{count}", String(pendingDeleteCount))}
            </Text>
            <Button size="sm" variant="ghost" onPress={handleUndoDelete}>
              <Button.Label>{t("common.undo")}</Button.Label>
            </Button>
          </View>
        </View>
      )}

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
                <Text className="text-xs text-muted">{t("files.supportedFormatsShort")}</Text>
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
                <Text className="text-xs text-muted">{t("files.supportedFormatsHint")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </PressableFeedback>

            <PressableFeedback
              onPress={handleImportZip}
              className={`flex-row items-center gap-3 rounded-xl p-4 ${
                isZipImportAvailable ? "bg-surface-secondary" : "bg-surface-secondary/60"
              }`}
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <Ionicons name="archive-outline" size={20} color={successColor} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {t("files.importZip")}
                </Text>
                <Text className="text-xs text-muted">
                  {isZipImportAvailable ? "ZIP" : t("files.importZipUnavailable")}
                </Text>
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
                <Text className="text-xs text-muted">
                  HTTP / HTTPS · {t("files.supportedFormatsShort")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </PressableFeedback>

            <PressableFeedback
              onPress={handleImportClipboard}
              className="flex-row items-center gap-3 rounded-xl bg-surface-secondary p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <Ionicons name="clipboard-outline" size={20} color={successColor} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {t("files.importFromClipboard")}
                </Text>
                <Text className="text-xs text-muted">{t("files.supportedFormatsShort")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={mutedColor} />
            </PressableFeedback>
          </View>
        </BottomSheetView>
      </BottomSheet>

      <Dialog isOpen={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Close />
            <Dialog.Title>{t("files.enterUrl")}</Dialog.Title>
            <Dialog.Description>{t("files.enterUrlHint")}</Dialog.Description>
            <TextField className="mt-4">
              <Input
                placeholder="https://example.com/image.png"
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

      <AlbumPickerSheet
        visible={showAlbumPicker}
        albums={albums}
        onClose={() => setShowAlbumPicker(false)}
        onSelect={handleAddToAlbum}
      />
      <BatchTagSheet
        visible={showBatchTag}
        selectedIds={selectedIds}
        onClose={() => setShowBatchTag(false)}
      />
      <BatchRenameSheet
        visible={showBatchRename}
        files={selectedFiles}
        selectedIds={selectedIds}
        onApplyRenames={handleBatchRenameApply}
        onClose={() => setShowBatchRename(false)}
      />
      <TrashSheet
        visible={showTrashSheet}
        items={trashItems}
        onClose={() => setShowTrashSheet(false)}
        onRestore={handleRestoreTrash}
        onDeleteForever={handleEmptyTrash}
      />
      <FileGroupSheet
        visible={showGroupSheet}
        selectedCount={selectedIds.length}
        onClose={() => setShowGroupSheet(false)}
        onApplyGroup={handleGroupApply}
      />

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
