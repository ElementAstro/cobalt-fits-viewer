import { useState, useCallback, useEffect, useMemo } from "react";
import { View, FlatList, Alert, useWindowDimensions } from "react-native";
import { Button, Dialog, Input, TextField } from "heroui-native";
import { useRouter } from "expo-router";
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
import { ThumbnailGrid } from "../../components/gallery/ThumbnailGrid";
import { AlbumPickerSheet } from "../../components/gallery/AlbumPickerSheet";
import { BatchTagSheet } from "../../components/gallery/BatchTagSheet";
import { BatchRenameSheet } from "../../components/gallery/BatchRenameSheet";
import { TrashSheet } from "../../components/gallery/TrashSheet";
import { FileGroupSheet } from "../../components/gallery/FileGroupSheet";
import { EmptyState } from "../../components/common/EmptyState";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { QuickLookModal } from "../../components/common/QuickLookModal";
import {
  FilesHeader,
  FilesToolbar,
  FilesSelectionBar,
  FilesSortBar,
  FilesFilterBar,
  ImportOptionsSheet,
  UndoSnackbar,
} from "../../components/files";
import { buildMetadataIndex } from "../../lib/gallery/metadataIndex";
import { getFrameTypeDefinitions } from "../../lib/gallery/frameClassifier";
import { routeForMedia } from "../../lib/media/routing";
import type { FitsMetadata } from "../../lib/fits/types";

const ListItemSeparator = () => <View className="h-2" />;

export default function FilesScreen() {
  const router = useRouter();
  const { t } = useI18n();

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
  const fileListGridColumns = useSettingsStore((s) => s.fileListGridColumns);
  const setFileListGridColumns = useSettingsStore((s) => s.setFileListGridColumns);
  const confirmDestructiveActions = useSettingsStore((s) => s.confirmDestructiveActions);
  const thumbShowFilename = useSettingsStore((s) => s.thumbnailShowFilename);
  const thumbShowObject = useSettingsStore((s) => s.thumbnailShowObject);
  const thumbShowFilter = useSettingsStore((s) => s.thumbnailShowFilter);
  const thumbShowExposure = useSettingsStore((s) => s.thumbnailShowExposure);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);
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
    pickAndImportFromMediaLibrary,
    recordAndImportVideo,
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

  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [showImportSheet, setShowImportSheet] = useState(false);
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
  const [filterFrameType, setFilterFrameType] = useState<string | "">("");
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
  const frameTypeDefinitions = useMemo(
    () => getFrameTypeDefinitions(frameClassificationConfig),
    [frameClassificationConfig],
  );

  const frameTypeLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const definition of frameTypeDefinitions) {
      labels.set(
        definition.key,
        definition.builtin
          ? (t(`gallery.frameTypes.${definition.key}`) ?? definition.label)
          : definition.label || definition.key,
      );
    }
    return labels;
  }, [frameTypeDefinitions, t]);

  const frameFilters = useMemo(() => {
    const orderMap = new Map(
      frameTypeDefinitions.map((definition, index) => [definition.key, index]),
    );
    const keys = new Set<string>(frameTypeDefinitions.map((definition) => definition.key));
    for (const value of metadataIndex.frameTypes) {
      keys.add(value);
    }
    return [...keys].sort((a, b) => {
      const ao = orderMap.get(a);
      const bo = orderMap.get(b);
      if (ao !== undefined && bo !== undefined) return ao - bo;
      if (ao !== undefined) return -1;
      if (bo !== undefined) return 1;
      return a.localeCompare(b);
    });
  }, [frameTypeDefinitions, metadataIndex.frameTypes]);

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
      ? Math.min(fileListGridColumns + 2, 6)
      : isLandscape
        ? Math.min(fileListGridColumns + 1, 5)
        : fileListGridColumns
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
                : errorKey === "mediaLibraryPermissionDenied"
                  ? t("files.mediaLibraryPermissionDenied")
                  : errorKey === "cameraPermissionDenied"
                    ? t("files.cameraPermissionDenied")
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
    setShowImportSheet(true);
  }, []);

  const closeImportSheet = useCallback(() => {
    setShowImportSheet(false);
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

  const handleImportMediaLibrary = useCallback(() => {
    closeImportSheet();
    pickAndImportFromMediaLibrary();
  }, [closeImportSheet, pickAndImportFromMediaLibrary]);

  const handleRecordVideo = useCallback(() => {
    closeImportSheet();
    recordAndImportVideo();
  }, [closeImportSheet, recordAndImportVideo]);

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

  const goToStacking = useCallback(() => {
    const idsParam = selectedIds.join(",");
    if (!idsParam) {
      router.push("/stacking");
      return;
    }
    router.push(`/stacking?ids=${encodeURIComponent(idsParam)}`);
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
      case "mediaLibrary":
        return t("files.mediaLibraryImporting");
      case "recording":
        return t("files.recordingImporting");
      default:
        return `${t("files.importing")}...`;
    }
  };

  const routeForFile = useCallback((file: FitsMetadata) => {
    return routeForMedia(file);
  }, []);

  const handleFilePress = useCallback(
    (file: FitsMetadata) => {
      if (isSelectionMode) {
        toggleSelection(file.id);
      } else {
        router.push(routeForFile(file));
      }
    },
    [isSelectionMode, toggleSelection, router, routeForFile],
  );

  const handleFileLongPress = useCallback(
    (file: FitsMetadata) => {
      if (!isSelectionMode) {
        setQuickLookFile(file);
      } else {
        toggleSelection(file.id);
      }
    },
    [isSelectionMode, toggleSelection],
  );

  const renderFileItem = useCallback(
    ({ item }: { item: FitsMetadata }) => {
      return (
        <FileListItem
          file={item}
          layout={fileListStyle}
          selected={selectedIdSet.has(item.id)}
          showFilename={thumbShowFilename}
          showObject={thumbShowObject}
          showFilter={thumbShowFilter}
          showExposure={thumbShowExposure}
          onPress={() => handleFilePress(item)}
          onLongPress={() => handleFileLongPress(item)}
          onToggleFavorite={() => toggleFavorite(item.id)}
          onDelete={() => handleSingleDelete(item.id)}
        />
      );
    },
    [
      fileListStyle,
      selectedIdSet,
      thumbShowFilename,
      thumbShowObject,
      thumbShowFilter,
      thumbShowExposure,
      handleFilePress,
      handleFileLongPress,
      toggleFavorite,
      handleSingleDelete,
    ],
  );

  const keyExtractor = useCallback((item: FitsMetadata) => item.id, []);

  const ListHeader = useMemo(
    () => (
      <View className={isLandscape ? "gap-1.5" : "gap-3"}>
        <FilesHeader
          displayCount={displayFiles.length}
          totalCount={allFiles.length}
          storageSize={storageStats.fitsSize}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLandscape={isLandscape}
        />

        <FilesToolbar
          isSelectionMode={isSelectionMode}
          selectedCount={selectedIds.length}
          displayCount={displayFiles.length}
          trashCount={trashItems.length}
          shouldStack={shouldStackTopActions}
          onImport={openImportSheet}
          onEnterSelection={() => setSelectionMode(true)}
          onConvert={() => router.push("/convert")}
          onTrash={() => setShowTrashSheet(true)}
          onSelectAllVisible={handleSelectAllVisible}
          onInvertSelection={handleInvertSelection}
          onBatchFavorite={handleBatchFavorite}
          onAlbumPicker={() => setShowAlbumPicker(true)}
          onBatchTag={() => setShowBatchTag(true)}
          onBatchRename={() => setShowBatchRename(true)}
          onGroupSheet={() => setShowGroupSheet(true)}
          onBatchExport={handleBatchExport}
          onBatchDelete={handleBatchDelete}
          onClearSelection={clearSelection}
        />

        {isSelectionMode && (
          <FilesSelectionBar
            selectedCount={selectedIds.length}
            isLandscape={isLandscape}
            onExport={handleBatchExport}
            onBatchConvert={goToBatchConvert}
            onStacking={goToStacking}
          />
        )}

        <FilesSortBar
          sortBy={sortBy}
          sortOrder={sortOrder}
          fileListStyle={fileListStyle}
          fileListGridColumns={fileListGridColumns}
          onSortToggle={handleSortToggle}
          onStyleChange={setFileListStyle}
          onGridColumnsChange={setFileListGridColumns}
        />

        <FilesFilterBar
          favoriteOnly={favoriteOnly}
          filterObject={filterObject}
          filterFilter={filterFilter}
          filterSourceFormat={filterSourceFormat}
          filterFrameType={filterFrameType}
          filterTag={filterTag}
          filterGroupId={filterGroupId}
          activeFilterCount={activeFilterCount}
          objects={metadataIndex.objects}
          filters={metadataIndex.filters}
          sourceFormats={metadataIndex.sourceFormats}
          frameFilters={frameFilters}
          frameTypeLabels={frameTypeLabels}
          tags={metadataIndex.tags}
          fileGroups={fileGroups}
          isLandscape={isLandscape}
          onFavoriteToggle={() => setFavoriteOnly((prev) => !prev)}
          onObjectChange={(v) => setFilterObject((prev) => (prev === v ? "" : v))}
          onFilterChange={(v) => setFilterFilter((prev) => (prev === v ? "" : v))}
          onSourceFormatChange={(v) => setFilterSourceFormat((prev) => (prev === v ? "" : v))}
          onFrameTypeChange={(v) => setFilterFrameType((prev) => (prev === v ? "" : v))}
          onTagChange={(v) => setFilterTag((prev) => (prev === v ? "" : v))}
          onGroupChange={(v) => setFilterGroupId((prev) => (prev === v ? "" : v))}
          onClearFilters={clearLocalFilters}
        />
      </View>
    ),
    [
      isLandscape,
      displayFiles.length,
      allFiles.length,
      storageStats.fitsSize,
      searchQuery,
      setSearchQuery,
      isSelectionMode,
      selectedIds.length,
      trashItems.length,
      shouldStackTopActions,
      openImportSheet,
      setSelectionMode,
      router,
      handleSelectAllVisible,
      handleInvertSelection,
      handleBatchFavorite,
      handleBatchExport,
      goToBatchConvert,
      goToStacking,
      handleBatchDelete,
      clearSelection,
      sortBy,
      sortOrder,
      handleSortToggle,
      fileListStyle,
      setFileListStyle,
      fileListGridColumns,
      setFileListGridColumns,
      favoriteOnly,
      filterObject,
      filterFilter,
      filterSourceFormat,
      filterFrameType,
      filterTag,
      filterGroupId,
      activeFilterCount,
      metadataIndex,
      frameFilters,
      frameTypeLabels,
      fileGroups,
      clearLocalFilters,
    ],
  );

  return (
    <View testID="e2e-screen-tabs__index" className="flex-1 bg-background">
      <LoadingOverlay
        visible={isImporting}
        message={getPhaseLabel()}
        percent={importProgress.percent}
        currentFile={importProgress.currentFile}
        current={importProgress.current}
        total={importProgress.total}
        success={importProgress.success}
        failed={importProgress.failed}
        skippedDuplicate={importProgress.skippedDuplicate}
        skippedUnsupported={importProgress.skippedUnsupported}
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
      ) : isGridStyle ? (
        <View
          className="flex-1"
          style={{
            paddingHorizontal: horizontalPadding,
            paddingTop: isLandscape ? 8 : contentPaddingTop,
          }}
        >
          {displayFiles.length === 0 ? (
            <View className="flex-1">
              {ListHeader}
              <EmptyState
                icon="search-outline"
                title={t("files.noSupportedFound")}
                secondaryLabel={activeFilterCount > 0 ? t("targets.clearFilters") : undefined}
                onSecondaryAction={activeFilterCount > 0 ? clearLocalFilters : undefined}
              />
            </View>
          ) : (
            <ThumbnailGrid
              files={displayFiles}
              columns={listColumns}
              selectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onPress={handleFilePress}
              onLongPress={handleFileLongPress}
              onSelect={toggleSelection}
              ListHeaderComponent={ListHeader}
              showFilename={thumbShowFilename}
              showObject={thumbShowObject}
              showFilter={thumbShowFilter}
              showExposure={thumbShowExposure}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={displayFiles}
          renderItem={renderFileItem}
          key={fileListStyle}
          keyExtractor={keyExtractor}
          numColumns={1}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title={t("files.noSupportedFound")}
              secondaryLabel={activeFilterCount > 0 ? t("targets.clearFilters") : undefined}
              onSecondaryAction={activeFilterCount > 0 ? clearLocalFilters : undefined}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: horizontalPadding,
            paddingTop: isLandscape ? 8 : contentPaddingTop,
            paddingBottom: 24,
          }}
          ItemSeparatorComponent={ListItemSeparator}
          showsVerticalScrollIndicator={false}
        />
      )}

      <UndoSnackbar
        visible={!!pendingDeleteToken}
        count={pendingDeleteCount}
        onUndo={handleUndoDelete}
      />

      <ImportOptionsSheet
        visible={showImportSheet}
        onOpenChange={setShowImportSheet}
        screenHeight={screenHeight}
        isZipImportAvailable={isZipImportAvailable}
        isLandscape={isLandscape}
        onImportFile={handleImportFile}
        onImportFolder={handleImportFolder}
        onImportZip={handleImportZip}
        onImportUrl={handleImportUrl}
        onImportClipboard={handleImportClipboard}
        onImportMediaLibrary={handleImportMediaLibrary}
        onRecordVideo={handleRecordVideo}
      />

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
        onOpenViewer={(id) => {
          const file = useFitsStore.getState().getFileById(id);
          if (!file) return;
          router.push(routeForFile(file));
        }}
        onOpenEditor={(id) => router.push(`/editor/${id}`)}
      />
    </View>
  );
}
