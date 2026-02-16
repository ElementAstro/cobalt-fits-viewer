/**
 * 目标变更日志工具
 */

import type { Target, TargetChangeLogEntry } from "../fits/types";

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 创建变更日志条目
 */
export function createLogEntry(
  action: TargetChangeLogEntry["action"],
  field?: string,
  oldValue?: unknown,
  newValue?: unknown,
): TargetChangeLogEntry {
  return {
    id: generateId(),
    timestamp: Date.now(),
    action,
    field,
    oldValue,
    newValue,
  };
}

/**
 * 记录目标创建
 */
export function logTargetCreated(): TargetChangeLogEntry {
  return createLogEntry("created");
}

/**
 * 记录目标更新
 */
export function logTargetUpdated(
  field: string,
  oldValue: unknown,
  newValue: unknown,
): TargetChangeLogEntry {
  return createLogEntry("updated", field, oldValue, newValue);
}

/**
 * 记录状态变更
 */
export function logStatusChanged(oldStatus: string, newStatus: string): TargetChangeLogEntry {
  return createLogEntry("status_changed", "status", oldStatus, newStatus);
}

/**
 * 记录图片添加
 */
export function logImageAdded(imageId: string): TargetChangeLogEntry {
  return createLogEntry("image_added", "imageIds", undefined, imageId);
}

/**
 * 记录图片移除
 */
export function logImageRemoved(imageId: string): TargetChangeLogEntry {
  return createLogEntry("image_removed", "imageIds", imageId, undefined);
}

/**
 * 记录收藏
 */
export function logFavorited(): TargetChangeLogEntry {
  return createLogEntry("favorited", "isFavorite", false, true);
}

/**
 * 记录取消收藏
 */
export function logUnfavorited(): TargetChangeLogEntry {
  return createLogEntry("unfavorited", "isFavorite", true, false);
}

/**
 * 记录置顶
 */
export function logPinned(): TargetChangeLogEntry {
  return createLogEntry("pinned", "isPinned", false, true);
}

/**
 * 记录取消置顶
 */
export function logUnpinned(): TargetChangeLogEntry {
  return createLogEntry("unpinned", "isPinned", true, false);
}

/**
 * 记录标签添加
 */
export function logTagAdded(tag: string): TargetChangeLogEntry {
  return createLogEntry("tagged", "tags", undefined, tag);
}

/**
 * 记录标签移除
 */
export function logTagRemoved(tag: string): TargetChangeLogEntry {
  return createLogEntry("untagged", "tags", tag, undefined);
}

/**
 * 添加变更日志到目标
 */
export function addChangeLog(target: Target, entry: TargetChangeLogEntry): Target {
  return {
    ...target,
    changeLog: [...target.changeLog, entry],
    updatedAt: Date.now(),
  };
}

/**
 * 获取目标变更历史摘要
 */
export function getChangeLogSummary(target: Target): Array<{
  id: string;
  timestamp: number;
  action: TargetChangeLogEntry["action"];
  description: string;
}> {
  return target.changeLog.map((entry) => {
    let description = "";

    switch (entry.action) {
      case "created":
        description = "Target created";
        break;
      case "updated":
        description = `${entry.field} changed from ${JSON.stringify(entry.oldValue)} to ${JSON.stringify(entry.newValue)}`;
        break;
      case "status_changed":
        description = `Status: ${entry.oldValue} → ${entry.newValue}`;
        break;
      case "image_added":
        description = `Image added: ${entry.newValue}`;
        break;
      case "image_removed":
        description = `Image removed: ${entry.oldValue}`;
        break;
      case "favorited":
        description = "Added to favorites";
        break;
      case "unfavorited":
        description = "Removed from favorites";
        break;
      case "pinned":
        description = "Pinned";
        break;
      case "unpinned":
        description = "Unpinned";
        break;
      case "tagged":
        description = `Tag added: ${entry.newValue}`;
        break;
      case "untagged":
        description = `Tag removed: ${entry.oldValue}`;
        break;
    }

    return {
      id: entry.id,
      timestamp: entry.timestamp,
      action: entry.action,
      description,
    };
  });
}

/**
 * 格式化变更日志时间为相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  const months = Math.floor(diff / 2592000000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  return `${months}mo ago`;
}
