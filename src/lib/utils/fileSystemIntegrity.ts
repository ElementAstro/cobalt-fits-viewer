/**
 * 文件系统 ↔ Store 物理一致性校验
 * 检查 store 记录是否指向真实存在的磁盘文件，以及磁盘上是否有未被 store 引用的孤立文件。
 * 与 targetIntegrity.ts 互补：targetIntegrity 校验 store 间的逻辑引用，
 * 本模块校验 store ↔ 磁盘的物理一致性。
 */

import { File } from "expo-file-system";
import { fileExists, getFitsDir, getTrashDir, listImportedMediaFiles } from "./fileManager";
import { useFitsStore } from "../../stores/useFitsStore";
import { useTrashStore } from "../../stores/useTrashStore";
import { reconcileAllStores } from "../targets/targetIntegrity";
import { deleteThumbnails } from "../gallery/thumbnailCache";
import type { FitsMetadata, TrashedFitsRecord } from "../fits/types";

export interface FileSystemIntegrityReport {
  ghostRecords: string[];
  orphanFiles: string[];
  trashGhosts: string[];
}

/**
 * 检查 store 与文件系统的物理一致性。
 * - ghostRecords: store 有记录但磁盘文件不存在的 file ID 列表
 * - orphanFiles: 磁盘有文件但 store 无记录的 URI 列表
 * - trashGhosts: trash store 有记录但 trash 文件不存在的 trashId 列表
 */
export function checkFileSystemIntegrity(
  files: FitsMetadata[],
  trashItems: TrashedFitsRecord[],
): FileSystemIntegrityReport {
  const ghostRecords: string[] = [];
  const trashGhosts: string[] = [];

  for (const file of files) {
    if (!fileExists(file.filepath)) {
      ghostRecords.push(file.id);
    }
  }

  for (const item of trashItems) {
    if (!fileExists(item.trashedFilepath)) {
      trashGhosts.push(item.trashId);
    }
  }

  const storeFilepathSet = new Set(files.map((f) => f.filepath));
  const trashFilepathSet = new Set(trashItems.map((item) => item.trashedFilepath));

  const orphanFiles: string[] = [];

  const fitsDir = getFitsDir();
  if (fitsDir.exists) {
    const diskFiles = listImportedMediaFiles();
    for (const diskFile of diskFiles) {
      if (!storeFilepathSet.has(diskFile.uri)) {
        orphanFiles.push(diskFile.uri);
      }
    }
  }

  const trashDir = getTrashDir();
  if (trashDir.exists) {
    try {
      const trashDiskItems = trashDir.list();
      for (const item of trashDiskItems) {
        if (item instanceof File && !trashFilepathSet.has(item.uri)) {
          orphanFiles.push(item.uri);
        }
      }
    } catch {
      // best effort
    }
  }

  return { ghostRecords, orphanFiles, trashGhosts };
}

/**
 * 修复幽灵记录：从 store 中移除指向不存在文件的记录，
 * 然后调用 reconcileAllStores() 修复连锁引用。
 */
export function repairGhostRecords(ghostIds: string[]): number {
  if (ghostIds.length === 0) return 0;
  const idSet = new Set(ghostIds);
  const currentFiles = useFitsStore.getState().files;
  const toRemove = currentFiles.filter((f) => idSet.has(f.id)).map((f) => f.id);
  if (toRemove.length === 0) return 0;

  useFitsStore.getState().removeFiles(toRemove);
  deleteThumbnails(toRemove);
  reconcileAllStores();
  return toRemove.length;
}

/**
 * 修复孤立文件：删除磁盘上不被任何 store 引用的文件。
 */
export function repairOrphanFiles(orphanUris: string[]): number {
  if (orphanUris.length === 0) return 0;
  let deleted = 0;
  for (const uri of orphanUris) {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
        deleted++;
      }
    } catch {
      // ignore single deletion failure
    }
  }
  return deleted;
}

/**
 * 修复回收站幽灵记录：移除指向不存在文件的 trash 记录。
 */
export function repairTrashGhosts(trashIds: string[]): number {
  if (trashIds.length === 0) return 0;
  useTrashStore.getState().removeByTrashIds(trashIds);
  return trashIds.length;
}

/**
 * 运行完整的物理一致性检查并自动修复。
 */
export function checkAndRepairFileSystemIntegrity(): {
  report: FileSystemIntegrityReport;
  repairedGhosts: number;
  repairedOrphans: number;
  repairedTrashGhosts: number;
} {
  const files = useFitsStore.getState().files;
  const trashItems = useTrashStore.getState().items;
  const report = checkFileSystemIntegrity(files, trashItems);

  const repairedGhosts = repairGhostRecords(report.ghostRecords);
  const repairedOrphans = repairOrphanFiles(report.orphanFiles);
  const repairedTrashGhosts = repairTrashGhosts(report.trashGhosts);

  return { report, repairedGhosts, repairedOrphans, repairedTrashGhosts };
}
