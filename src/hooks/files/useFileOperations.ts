/**
 * File operations hook
 * Extracted from useFileManager for better separation of concerns.
 * Handles: export, group, rename, reclassify operations.
 */

import { useCallback } from "react";
import { File, Directory, Paths } from "expo-file-system";
import { shareFile, ShareNotAvailableError } from "../../lib/utils/imageExport";
import { renameFitsFile, readFileAsArrayBuffer } from "../../lib/utils/fileManager";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { useSettingsStore } from "../../stores/app/useSettingsStore";
import { useFileGroupStore } from "../../stores/files/useFileGroupStore";
import { loadScientificFitsFromBuffer, extractMetadata } from "../../lib/fits/parser";
import { classifyWithDetail } from "../../lib/gallery/frameClassifier";

export interface ExportFilesResult {
  success: boolean;
  exported: number;
  failed: number;
  shared: boolean;
  error?: string;
}

export interface GroupResult {
  success: number;
  failed: number;
}

interface RenameOperation {
  fileId: string;
  filename: string;
}

export interface RenameResult {
  success: number;
  failed: number;
}

export interface ReclassifyFramesResult {
  total: number;
  success: number;
  failed: number;
  updated: number;
  failedEntries: Array<{ id: string; filename: string; reason: string }>;
}

function resolveUniqueExportName(filename: string, usedNames: Set<string>): string {
  if (!usedNames.has(filename)) {
    usedNames.add(filename);
    return filename;
  }
  const dotIndex = filename.lastIndexOf(".");
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : "";
  let counter = 1;
  let candidate: string;
  do {
    candidate = `${base}_${counter}${ext}`;
    counter++;
  } while (usedNames.has(candidate));
  usedNames.add(candidate);
  return candidate;
}

export function useFileOperations() {
  const updateFile = useFitsStore((s) => s.updateFile);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);

  const handleRenameFiles = useCallback(
    (operations: RenameOperation[]): RenameResult => {
      if (operations.length === 0) return { success: 0, failed: 0 };

      let success = 0;
      let failed = 0;

      for (const op of operations) {
        const current = useFitsStore.getState().getFileById(op.fileId);
        if (!current) {
          failed++;
          continue;
        }
        const result = renameFitsFile(current.filepath, op.filename);
        if (!result.success) {
          failed++;
          continue;
        }
        updateFile(op.fileId, {
          filename: result.filename,
          filepath: result.filepath,
        });
        success++;
      }

      return { success, failed };
    },
    [updateFile],
  );

  const exportFiles = useCallback(async (fileIds: string[]): Promise<ExportFilesResult> => {
    if (fileIds.length === 0) {
      return { success: false, exported: 0, failed: 0, shared: false, error: "emptySelection" };
    }

    const selectedFiles = useFitsStore.getState().files.filter((file) => fileIds.includes(file.id));
    if (selectedFiles.length === 0) {
      return {
        success: false,
        exported: 0,
        failed: fileIds.length,
        shared: false,
        error: "missingFiles",
      };
    }

    if (selectedFiles.length === 1) {
      try {
        await shareFile(selectedFiles[0].filepath);
        return { success: true, exported: 1, failed: 0, shared: true };
      } catch (error) {
        if (error instanceof ShareNotAvailableError) {
          return {
            success: false,
            exported: 0,
            failed: 1,
            shared: false,
            error: "shareUnavailable",
          };
        }
        return {
          success: false,
          exported: 0,
          failed: 1,
          shared: false,
          error: error instanceof Error ? error.message : "shareFailed",
        };
      }
    }

    let zipFn: ((source: string, target: string) => Promise<string>) | null = null;
    try {
      const zipArchive = require("react-native-zip-archive");
      zipFn = zipArchive.zip;
    } catch {
      return {
        success: false,
        exported: 0,
        failed: selectedFiles.length,
        shared: false,
        error: "zipExportUnavailable",
      };
    }
    if (!zipFn) {
      return {
        success: false,
        exported: 0,
        failed: selectedFiles.length,
        shared: false,
        error: "zipExportUnavailable",
      };
    }

    const exportDir = new Directory(Paths.cache, `file_export_${Date.now()}`);
    if (!exportDir.exists) {
      exportDir.create();
    }

    const usedNames = new Set<string>();
    let copied = 0;
    let failed = 0;

    for (const file of selectedFiles) {
      try {
        const source = new File(file.filepath);
        if (!source.exists) {
          failed++;
          continue;
        }
        const exportName = resolveUniqueExportName(file.filename, usedNames);
        const target = new File(exportDir, exportName);
        source.copy(target);
        copied++;
      } catch {
        failed++;
      }
    }

    if (copied === 0) {
      if (exportDir.exists) exportDir.delete();
      return { success: false, exported: 0, failed, shared: false, error: "noExportedFiles" };
    }

    const zipFile = new File(Paths.cache, `files_export_${Date.now()}.zip`);
    try {
      await zipFn(exportDir.uri, zipFile.uri);
      await shareFile(zipFile.uri, {
        mimeType: "application/zip",
        UTI: "public.zip-archive",
      });
      return { success: true, exported: copied, failed, shared: true };
    } catch (error) {
      return {
        success: false,
        exported: copied,
        failed,
        shared: false,
        error: error instanceof Error ? error.message : "zipShareFailed",
      };
    } finally {
      if (exportDir.exists) exportDir.delete();
      if (zipFile.exists) zipFile.delete();
    }
  }, []);

  const groupFiles = useCallback((fileIds: string[], groupId: string): GroupResult => {
    if (fileIds.length === 0 || !groupId) return { success: 0, failed: fileIds.length };
    const group = useFileGroupStore.getState().getGroupById(groupId);
    if (!group) return { success: 0, failed: fileIds.length };
    const existingIds = new Set(useFitsStore.getState().files.map((file) => file.id));
    const validIds = fileIds.filter((id) => existingIds.has(id));
    useFileGroupStore.getState().assignFilesToGroup(validIds, groupId);
    return {
      success: validIds.length,
      failed: fileIds.length - validIds.length,
    };
  }, []);

  const reclassifyAllFrames = useCallback(async (): Promise<ReclassifyFramesResult> => {
    const files = [...useFitsStore.getState().files];
    const failedEntries: Array<{ id: string; filename: string; reason: string }> = [];
    let updated = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const fileNameLower = file.filename.toLowerCase();
        const isFitsSource =
          file.sourceType === "fits" || /\.(fits?|fts)(?:\.gz)?$/i.test(fileNameLower);

        let nextFrameType = file.frameType;
        let nextFrameTypeSource = file.frameTypeSource;
        let nextImageTypeRaw = file.imageTypeRaw;
        let nextFrameHeaderRaw = file.frameHeaderRaw;

        if (isFitsSource) {
          const buffer = await readFileAsArrayBuffer(file.filepath);
          const fitsObj = await loadScientificFitsFromBuffer(buffer, {
            filename: file.filename,
          });
          const partial = extractMetadata(
            fitsObj,
            {
              filename: file.filename,
              filepath: file.filepath,
              fileSize: file.fileSize,
            },
            frameClassificationConfig,
          );
          nextFrameType = partial.frameType;
          nextFrameTypeSource = partial.frameTypeSource;
          nextImageTypeRaw = partial.imageTypeRaw;
          nextFrameHeaderRaw = partial.frameHeaderRaw;
        } else {
          const classified = classifyWithDetail(
            undefined,
            undefined,
            file.filename,
            frameClassificationConfig,
          );
          nextFrameType = classified.type;
          nextFrameTypeSource = classified.source;
          nextImageTypeRaw = undefined;
          nextFrameHeaderRaw = undefined;
        }

        if (
          file.frameType !== nextFrameType ||
          file.frameTypeSource !== nextFrameTypeSource ||
          file.imageTypeRaw !== nextImageTypeRaw ||
          file.frameHeaderRaw !== nextFrameHeaderRaw
        ) {
          updateFile(file.id, {
            frameType: nextFrameType,
            frameTypeSource: nextFrameTypeSource,
            imageTypeRaw: nextImageTypeRaw,
            frameHeaderRaw: nextFrameHeaderRaw,
          });
          updated++;
        }
      } catch (error) {
        failed++;
        failedEntries.push({
          id: file.id,
          filename: file.filename,
          reason: error instanceof Error ? error.message : "reclassify_failed",
        });
      }
    }

    return {
      total: files.length,
      success: files.length - failed,
      failed,
      updated,
      failedEntries,
    };
  }, [frameClassificationConfig, updateFile]);

  return {
    handleRenameFiles,
    exportFiles,
    groupFiles,
    reclassifyAllFrames,
  };
}
