import { useState, useCallback, useEffect, useMemo, useReducer } from "react";
import { View, Alert, useWindowDimensions } from "react-native";
import { Button, Dialog, Input, TextField } from "heroui-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/common/useResponsiveLayout";
import { usePageLogger } from "../../hooks/common/useLogger";
import { filterAndSortFiles, useFitsStore } from "../../stores/files/useFitsStore";
import { useSettingsStore } from "../../stores/app/useSettingsStore";
import { useTrashStore } from "../../stores/files/useTrashStore";
import { useFileGroupStore } from "../../stores/files/useFileGroupStore";
import { useFileManager } from "../../hooks/files/useFileManager";
import { useAlbums } from "../../hooks/gallery/useAlbums";
import type { ImportResult } from "../../hooks/files/useFileManager";
import { AlbumPickerSheet } from "../../components/gallery/AlbumPickerSheet";
import { BatchTagSheet } from "../../components/gallery/BatchTagSheet";
import { BatchRenameSheet } from "../../components/gallery/BatchRenameSheet";
import { TrashSheet } from "../../components/gallery/TrashSheet";
import { FileGroupSheet } from "../../components/gallery/FileGroupSheet";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { QuickLookModal } from "../../components/common/QuickLookModal";
import {
  FilesContent,
  FilesHeader,
  FilesToolbar,
  FilesSelectionBar,
  FilesSortBar,
  FilesFilterBar,
  ImportOptionsSheet,
  ImportResultSheet,
  SelectionActionsSheet,
  UndoSnackbar,
  FolderPickerSheet,
  FolderBrowserView,
  StorageAnalyticsSheet,
} from "../../components/files";
import { GuideTarget } from "../../components/common/GuideTarget";
import { buildMetadataIndex } from "../../lib/gallery/metadataIndex";
import { getFrameTypeDefinitions } from "../../lib/gallery/frameClassifier";
import {
  FILES_STACK_ACTIONS_MAX_WIDTH,
  shouldUseCompactActionLayout,
} from "../../lib/layout/landscapeRules";
import { routeForMedia } from "../../lib/media/routing";
import { pickImageLikeIds } from "../../lib/viewer/compareRouting";
import type { FitsMetadata } from "../../lib/fits/types";

interface FilesFilterState {
  object: string;
  filter: string;
  sourceFormat: string;
  frameType: string;
  tag: string;
  groupId: string;
  favoriteOnly: boolean;
}

type FilesFilterAction =
  | { type: "toggle"; key: keyof Omit<FilesFilterState, "favoriteOnly">; value: string }
  | { type: "toggleFavorite" }
  | { type: "reset" };

const initialFilesFilter: FilesFilterState = {
  object: "",
  filter: "",
  sourceFormat: "",
  frameType: "",
  tag: "",
  groupId: "",
  favoriteOnly: false,
};

function filesFilterReducer(state: FilesFilterState, action: FilesFilterAction): FilesFilterState {
  switch (action.type) {
    case "toggle":
      return { ...state, [action.key]: state[action.key] === action.value ? "" : action.value };
    case "toggleFavorite":
      return { ...state, favoriteOnly: !state.favoriteOnly };
    case "reset":
      return initialFilesFilter;
  }
}

export default function FilesScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { logAction, logSuccess, logFailure } = usePageLogger("FilesScreen", { screen: "files" });

  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { layoutMode, isLandscape, contentPaddingTop, horizontalPadding } = useResponsiveLayout();

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
  const [showSelectionActions, setShowSelectionActions] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showStorageAnalytics, setShowStorageAnalytics] = useState(false);
  const [showImportResultSheet, setShowImportResultSheet] = useState(false);
  const [pendingDeleteToken, setPendingDeleteToken] = useState<string | null>(null);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);

  const [filters, dispatchFilter] = useReducer(filesFilterReducer, initialFilesFilter);

  const files = useMemo(
    () => filterAndSortFiles(allFiles, searchQuery, filterTags, sortBy, sortOrder),
    [allFiles, filterTags, searchQuery, sortBy, sortOrder],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedFiles = useMemo(
    () => allFiles.filter((file) => selectedIdSet.has(file.id)),
    [allFiles, selectedIdSet],
  );
  const selectedImageIds = useMemo(
    () => pickImageLikeIds(selectedIds, allFiles, 2),
    [selectedIds, allFiles],
  );
  const selectedImageCount = selectedImageIds.length;

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
      if (filters.object && file.object !== filters.object) return false;
      if (filters.filter && file.filter !== filters.filter) return false;
      if (filters.sourceFormat && file.sourceFormat !== filters.sourceFormat) return false;
      if (filters.frameType && file.frameType !== filters.frameType) return false;
      if (filters.tag && !file.tags.includes(filters.tag)) return false;
      if (filters.groupId && !(fileGroupMap[file.id] ?? []).includes(filters.groupId)) return false;
      if (filters.favoriteOnly && !file.isFavorite) return false;
      return true;
    });
  }, [files, filters, fileGroupMap]);

  const storageStats = useMemo(() => {
    let totalSize = 0;
    for (const f of allFiles) {
      totalSize += f.fileSize;
    }
    return { fitsCount: allFiles.length, fitsSize: totalSize };
  }, [allFiles]);

  const activeFilterCount = useMemo(() => {
    return (
      [filters.object, filters.filter, filters.sourceFormat, filters.frameType, filters.tag].filter(
        Boolean,
      ).length +
      (filters.groupId ? 1 : 0) +
      (filters.favoriteOnly ? 1 : 0)
    );
  }, [filters]);

  const isGridStyle = fileListStyle === "grid";
  const listColumns = isGridStyle
    ? layoutMode === "landscape-tablet"
      ? Math.min(fileListGridColumns + 2, 6)
      : layoutMode === "landscape-phone"
        ? Math.min(fileListGridColumns + 1, 5)
        : fileListGridColumns
    : 1;
  const shouldStackTopActions =
    isSelectionMode ||
    shouldUseCompactActionLayout(layoutMode, screenWidth, FILES_STACK_ACTIONS_MAX_WIDTH);

  const mapImportFailureReason = useCallback(
    (reason: string | undefined): string => {
      const normalized = reason?.trim() ?? "";
      if (!normalized || normalized === "unknown_error") {
        return t("files.importFailureUnknown");
      }
      if (normalized === "unsupported_format") {
        return t("files.importFailureUnsupportedFormat");
      }
      return normalized;
    },
    [t],
  );

  const importFailedEntries = useMemo(() => {
    if (!lastImportResult?.failedEntries?.length) return [];
    return lastImportResult.failedEntries.map((entry) => ({
      name: entry.name,
      reason: mapImportFailureReason(entry.reason),
    }));
  }, [lastImportResult, mapImportFailureReason]);

  const buildImportResultReport = useCallback(
    (result: ImportResult): string => {
      const lines = [
        t("files.importPartialMsg", {
          success: result.success,
          total: result.total,
          failed: result.failed,
        }),
      ];

      if (result.skippedDuplicate > 0) {
        lines.push(
          t("files.importSkippedDuplicates", {
            count: result.skippedDuplicate,
          }),
        );
      }
      if (result.skippedUnsupported > 0) {
        lines.push(
          t("files.importSkippedUnsupported", {
            count: result.skippedUnsupported,
          }),
        );
      }

      if (importFailedEntries.length > 0) {
        lines.push("", t("files.importResultFailedEntries"));
        for (const [index, entry] of importFailedEntries.entries()) {
          lines.push(`${index + 1}. ${entry.name} · ${entry.reason}`);
        }
      } else {
        lines.push("", t("files.importResultNoFailures"));
      }

      return lines.join("\n");
    },
    [importFailedEntries, t],
  );

  const handleCopyImportResult = useCallback(async () => {
    if (!lastImportResult) return;
    try {
      const report = buildImportResultReport(lastImportResult);
      const copied = await Clipboard.setStringAsync(report);
      if (copied) {
        logSuccess("copy_import_result", { copied: true });
        Alert.alert(t("common.success"), t("files.importResultCopySuccess"));
        return;
      }
      logFailure("copy_import_result", new Error("clipboardCopyFailed"), { copied: false });
      Alert.alert(t("common.error"), t("files.importResultCopyFailed"));
    } catch (error) {
      logFailure("copy_import_result", error);
      Alert.alert(t("common.error"), t("files.importResultCopyFailed"));
    }
  }, [buildImportResultReport, lastImportResult, logFailure, logSuccess, t]);

  useEffect(() => {
    if (!lastImportResult || isImporting) return;
    setShowImportResultSheet(true);
  }, [lastImportResult, isImporting]);

  useEffect(() => {
    if (!isImporting) return;
    setShowImportResultSheet(false);
  }, [isImporting]);

  useEffect(() => {
    if (importError && !isImporting) {
      const errorKey = importError as string;
      logFailure("import_failed", new Error(errorKey), { errorKey });
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
  }, [importError, isImporting, logFailure, t]);

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
    logAction("import_file");
    pickAndImportFile();
  }, [closeImportSheet, logAction, pickAndImportFile]);

  const handleImportFolder = useCallback(() => {
    closeImportSheet();
    logAction("import_folder");
    pickAndImportFolder();
  }, [closeImportSheet, logAction, pickAndImportFolder]);

  const handleImportZip = useCallback(() => {
    closeImportSheet();
    if (!isZipImportAvailable) {
      logFailure("import_zip", new Error("zipImportUnavailable"));
      Alert.alert(t("files.importFailed"), t("files.importZipUnavailable"));
      return;
    }
    logAction("import_zip");
    pickAndImportZip();
  }, [closeImportSheet, isZipImportAvailable, logAction, logFailure, pickAndImportZip, t]);

  const handleImportUrl = useCallback(() => {
    closeImportSheet();
    logAction("import_url_open");
    setUrlInput("");
    setShowUrlDialog(true);
  }, [closeImportSheet, logAction]);

  const handleImportClipboard = useCallback(() => {
    closeImportSheet();
    logAction("import_clipboard");
    importFromClipboard();
  }, [closeImportSheet, importFromClipboard, logAction]);

  const handleImportMediaLibrary = useCallback(() => {
    closeImportSheet();
    logAction("import_media_library");
    pickAndImportFromMediaLibrary();
  }, [closeImportSheet, logAction, pickAndImportFromMediaLibrary]);

  const handleRecordVideo = useCallback(() => {
    closeImportSheet();
    logAction("import_record_video");
    recordAndImportVideo();
  }, [closeImportSheet, logAction, recordAndImportVideo]);

  const confirmUrlImport = useCallback(() => {
    const url = urlInput.trim();
    if (!url) return;
    setShowUrlDialog(false);
    logAction("import_url_submit");
    importFromUrl(url);
  }, [importFromUrl, logAction, urlInput]);

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
      const result = applyDeleteFiles(selectedIds, true);
      if (result.failed > 0) {
        logFailure("batch_delete", new Error("deletePartialFailed"), {
          selectedCount: selectedIds.length,
          success: result.success,
          failed: result.failed,
        });
        return;
      }
      logSuccess("batch_delete", {
        selectedCount: selectedIds.length,
        success: result.success,
      });
    };

    logAction("batch_delete_open_confirm", {
      selectedCount: selectedIds.length,
      confirmRequired: confirmDestructiveActions,
    });

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
  }, [
    applyDeleteFiles,
    confirmDestructiveActions,
    logAction,
    logFailure,
    logSuccess,
    selectedIds,
    t,
  ]);

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
      logFailure("undo_delete", new Error(result.error ?? "undoFailed"), {
        restored: result.restored,
        failed: result.failed,
      });
      Alert.alert(t("common.error"), t("files.undoFailed"));
      return;
    }
    logSuccess("undo_delete", {
      restored: result.restored,
      failed: result.failed,
    });
  }, [logFailure, logSuccess, pendingDeleteToken, t, undoLastDelete]);

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
    logAction("batch_export", { selectedCount: selectedIds.length });
    const result = await exportFiles(selectedIds);
    if (result.success) {
      logSuccess("batch_export", { exported: result.exported, failed: result.failed });
      Alert.alert(t("common.success"), t("files.exportSuccess", { count: result.exported }));
      return;
    }
    logFailure("batch_export", new Error(result.error ?? "exportFailed"), {
      exported: result.exported,
      failed: result.failed,
      shared: result.shared,
    });
    Alert.alert(t("common.error"), t("files.exportFailed"));
  }, [exportFiles, logAction, logFailure, logSuccess, selectedIds, t]);

  const handleMoveToFolder = useCallback(
    (groupId: string) => {
      if (selectedIds.length === 0) return;
      const { moveFilesToGroup } = useFileGroupStore.getState();
      moveFilesToGroup(selectedIds, undefined, groupId);
      logSuccess("move_to_folder", { groupId, selectedCount: selectedIds.length });
      clearSelection();
    },
    [clearSelection, logSuccess, selectedIds],
  );

  const handleGroupApply = useCallback(
    (groupId: string) => {
      const result = groupFiles(selectedIds, groupId);
      if (result.success > 0) {
        clearSelection();
      }
      if (result.failed > 0) {
        logFailure("group_files", new Error("groupFilesPartialFailed"), {
          selectedCount: selectedIds.length,
          success: result.success,
          failed: result.failed,
        });
      } else {
        logSuccess("group_files", {
          selectedCount: selectedIds.length,
          success: result.success,
        });
      }
      return result;
    },
    [clearSelection, groupFiles, logFailure, logSuccess, selectedIds],
  );

  const handleRestoreTrash = useCallback(
    (trashIds: string[]) => {
      const result = restoreFromTrash(trashIds);
      if (result.success > 0 && result.failed === 0) {
        logSuccess("restore_trash", { selectedCount: trashIds.length, restored: result.success });
        Alert.alert(t("common.success"), t("files.restoreSuccess", { count: result.success }));
        return;
      }

      if (result.success > 0 && result.failed > 0) {
        logFailure("restore_trash", new Error("restorePartialFailed"), {
          selectedCount: trashIds.length,
          restored: result.success,
          failed: result.failed,
        });
        const successMsg = t("files.restoreSuccess", { count: result.success });
        Alert.alert(t("common.error"), `${successMsg}\n${t("files.restoreFailed")}`);
        return;
      }

      if (result.failed > 0) {
        logFailure("restore_trash", new Error("restoreFailed"), {
          selectedCount: trashIds.length,
          restored: result.success,
          failed: result.failed,
        });
        Alert.alert(t("common.error"), t("files.restoreFailed"));
      }
    },
    [logFailure, logSuccess, restoreFromTrash, t],
  );

  const applyEmptyTrash = useCallback(
    (trashIds?: string[]) => {
      const result = emptyTrash(trashIds);
      if (result.deleted > 0 && result.failed === 0) {
        logSuccess("empty_trash", {
          selectedCount: trashIds?.length,
          deleted: result.deleted,
          failed: result.failed,
        });
        Alert.alert(t("common.success"), t("files.emptyTrashSuccess", { count: result.deleted }));
        return;
      }

      if (result.deleted > 0 && result.failed > 0) {
        logFailure("empty_trash", new Error("emptyTrashPartialFailed"), {
          selectedCount: trashIds?.length,
          deleted: result.deleted,
          failed: result.failed,
        });
        const successMsg = t("files.emptyTrashSuccess", { count: result.deleted });
        Alert.alert(t("common.error"), `${successMsg}\n${t("files.restoreFailed")}`);
        return;
      }

      if (result.failed > 0) {
        logFailure("empty_trash", new Error("emptyTrashFailed"), {
          selectedCount: trashIds?.length,
          deleted: result.deleted,
          failed: result.failed,
        });
        Alert.alert(t("common.error"), t("files.restoreFailed"));
      }
    },
    [emptyTrash, logFailure, logSuccess, t],
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
      logSuccess("add_to_album", { albumId, selectedCount: selectedIds.length });
      setShowAlbumPicker(false);
      clearSelection();
    },
    [addImagesToAlbum, clearSelection, logSuccess, selectedIds],
  );

  const handleBatchRenameApply = useCallback(
    (operations: Array<{ fileId: string; filename: string }>) => {
      const result = handleRenameFiles(operations);
      if (result.success > 0) {
        clearSelection();
      }
      if (result.failed > 0) {
        logFailure("batch_rename", new Error("renamePartialFailed"), {
          operations: operations.length,
          success: result.success,
          failed: result.failed,
        });
      } else {
        logSuccess("batch_rename", {
          operations: operations.length,
          success: result.success,
        });
      }
      return result;
    },
    [clearSelection, handleRenameFiles, logFailure, logSuccess],
  );

  const goToBatchConvert = useCallback(() => {
    logAction("open_batch_convert", { selectedCount: selectedIds.length });
    const idsParam = selectedIds.join(",");
    if (!idsParam) {
      router.push("/convert?tab=batch");
      return;
    }
    router.push(`/convert?tab=batch&ids=${encodeURIComponent(idsParam)}`);
  }, [logAction, router, selectedIds]);

  const goToCompare = useCallback(() => {
    if (selectedImageIds.length < 2) return;
    logAction("open_compare", { selectedImageCount: selectedImageIds.length });
    router.push(`/compare?ids=${selectedImageIds.join(",")}`);
  }, [logAction, router, selectedImageIds]);

  const goToStacking = useCallback(() => {
    logAction("open_stacking", { selectedCount: selectedIds.length });
    const idsParam = selectedIds.join(",");
    if (!idsParam) {
      router.push("/stacking");
      return;
    }
    router.push(`/stacking?ids=${encodeURIComponent(idsParam)}`);
  }, [logAction, router, selectedIds]);

  const clearLocalFilters = useCallback(() => {
    dispatchFilter({ type: "reset" });
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

        <GuideTarget name="files-import" page="files" order={0}>
          <FilesToolbar
            isSelectionMode={isSelectionMode}
            selectedCount={selectedIds.length}
            trashCount={trashItems.length}
            shouldStack={shouldStackTopActions}
            onImport={openImportSheet}
            onEnterSelection={() => setSelectionMode(true)}
            onConvert={() => router.push("/convert")}
            onTrash={() => setShowTrashSheet(true)}
            onSelectAllVisible={handleSelectAllVisible}
            onMoreActions={() => setShowSelectionActions(true)}
            onBatchDelete={handleBatchDelete}
            onClearSelection={clearSelection}
          />
        </GuideTarget>

        {isSelectionMode && (
          <FilesSelectionBar
            selectedCount={selectedIds.length}
            selectedImageCount={selectedImageCount}
            isLandscape={isLandscape}
            onCompare={goToCompare}
            onBatchConvert={goToBatchConvert}
            onStacking={goToStacking}
          />
        )}

        {allFiles.length > 0 && (
          <>
            <GuideTarget name="files-sort" page="files" order={1}>
              <FilesSortBar
                sortBy={sortBy}
                sortOrder={sortOrder}
                fileListStyle={fileListStyle}
                fileListGridColumns={fileListGridColumns}
                onSortToggle={handleSortToggle}
                onStyleChange={setFileListStyle}
                onGridColumnsChange={setFileListGridColumns}
              />
            </GuideTarget>

            <FilesFilterBar
              favoriteOnly={filters.favoriteOnly}
              filterObject={filters.object}
              filterFilter={filters.filter}
              filterSourceFormat={filters.sourceFormat}
              filterFrameType={filters.frameType}
              filterTag={filters.tag}
              filterGroupId={filters.groupId}
              activeFilterCount={activeFilterCount}
              objects={metadataIndex.objects}
              filters={metadataIndex.filters}
              sourceFormats={metadataIndex.sourceFormats}
              frameFilters={frameFilters}
              frameTypeLabels={frameTypeLabels}
              tags={metadataIndex.tags}
              fileGroups={fileGroups}
              isLandscape={isLandscape}
              onFavoriteToggle={() => dispatchFilter({ type: "toggleFavorite" })}
              onObjectChange={(v) => dispatchFilter({ type: "toggle", key: "object", value: v })}
              onFilterChange={(v) => dispatchFilter({ type: "toggle", key: "filter", value: v })}
              onSourceFormatChange={(v) =>
                dispatchFilter({ type: "toggle", key: "sourceFormat", value: v })
              }
              onFrameTypeChange={(v) =>
                dispatchFilter({ type: "toggle", key: "frameType", value: v })
              }
              onTagChange={(v) => dispatchFilter({ type: "toggle", key: "tag", value: v })}
              onGroupChange={(v) => dispatchFilter({ type: "toggle", key: "groupId", value: v })}
              onClearFilters={clearLocalFilters}
            />
          </>
        )}
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
      goToBatchConvert,
      goToCompare,
      goToStacking,
      selectedImageCount,
      handleBatchDelete,
      clearSelection,
      sortBy,
      sortOrder,
      handleSortToggle,
      fileListStyle,
      setFileListStyle,
      fileListGridColumns,
      setFileListGridColumns,
      filters,
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

      {fileListStyle === "folder" ? (
        <FolderBrowserView
          horizontalPadding={horizontalPadding}
          contentPaddingTop={contentPaddingTop}
          isLandscape={isLandscape}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          gridColumns={listColumns}
          onFilePress={handleFilePress}
          onFileLongPress={handleFileLongPress}
          onToggleSelection={toggleSelection}
          onImport={openImportSheet}
          onManageFolders={() => setShowGroupSheet(true)}
        />
      ) : (
        <FilesContent
          displayFiles={displayFiles}
          searchQuery={searchQuery}
          activeFilterCount={activeFilterCount}
          fileListStyle={fileListStyle}
          isGridStyle={isGridStyle}
          listColumns={listColumns}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          selectedIdSet={selectedIdSet}
          horizontalPadding={horizontalPadding}
          contentPaddingTop={contentPaddingTop}
          isLandscape={isLandscape}
          thumbShowFilename={thumbShowFilename}
          thumbShowObject={thumbShowObject}
          thumbShowFilter={thumbShowFilter}
          thumbShowExposure={thumbShowExposure}
          ListHeader={ListHeader}
          onFilePress={handleFilePress}
          onFileLongPress={handleFileLongPress}
          onToggleSelection={toggleSelection}
          onToggleFavorite={toggleFavorite}
          onSingleDelete={handleSingleDelete}
          onImport={openImportSheet}
          onClearFilters={clearLocalFilters}
        />
      )}

      <UndoSnackbar
        visible={!!pendingDeleteToken}
        count={pendingDeleteCount}
        onUndo={handleUndoDelete}
      />

      <ImportResultSheet
        visible={showImportResultSheet}
        result={lastImportResult}
        failedEntries={importFailedEntries}
        isLandscape={isLandscape}
        onOpenChange={setShowImportResultSheet}
        onCopy={handleCopyImportResult}
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

      <FolderPickerSheet
        visible={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={handleMoveToFolder}
      />

      <StorageAnalyticsSheet
        visible={showStorageAnalytics}
        onClose={() => setShowStorageAnalytics(false)}
      />

      <SelectionActionsSheet
        visible={showSelectionActions}
        onOpenChange={setShowSelectionActions}
        selectedCount={selectedIds.length}
        selectedImageCount={selectedImageCount}
        displayCount={displayFiles.length}
        isLandscape={isLandscape}
        onSelectAllVisible={handleSelectAllVisible}
        onInvertSelection={handleInvertSelection}
        onBatchFavorite={handleBatchFavorite}
        onAlbumPicker={() => setShowAlbumPicker(true)}
        onBatchTag={() => setShowBatchTag(true)}
        onBatchRename={() => setShowBatchRename(true)}
        onGroupSheet={() => setShowGroupSheet(true)}
        onMoveToFolder={() => setShowFolderPicker(true)}
        onBatchExport={handleBatchExport}
        onBatchConvert={goToBatchConvert}
        onCompare={goToCompare}
        onStacking={goToStacking}
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
        onToggleFavorite={(id) => toggleFavorite(id)}
        onDelete={(id) => applyDeleteFiles([id], false)}
        onRename={(id) => {
          setSelectionMode(true);
          toggleSelectionBatch([id]);
          setShowBatchRename(true);
        }}
        onAddTag={(id) => {
          setSelectionMode(true);
          toggleSelectionBatch([id]);
          setShowBatchTag(true);
        }}
      />
    </View>
  );
}
