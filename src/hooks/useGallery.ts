/**
 * 相册操作 Hook
 */

import { useCallback, useMemo } from "react";
import { useGalleryStore } from "../stores/useGalleryStore";
import { useFitsStore } from "../stores/useFitsStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import {
  buildMetadataIndex,
  searchFiles,
  groupByDate,
  groupByObject,
  groupByLocation,
} from "../lib/gallery/metadataIndex";

export function useGallery() {
  const files = useFitsStore((s) => s.files);
  const defaultSortBy = useSettingsStore((s) => s.defaultGallerySortBy);
  const defaultSortOrder = useSettingsStore((s) => s.defaultGallerySortOrder);

  const viewMode = useGalleryStore((s) => s.viewMode);
  const gridColumns = useGalleryStore((s) => s.gridColumns);
  const filterObject = useGalleryStore((s) => s.filterObject);
  const filterFilter = useGalleryStore((s) => s.filterFilter);
  const filterDateRange = useGalleryStore((s) => s.filterDateRange);
  const filterFavoriteOnly = useGalleryStore((s) => s.filterFavoriteOnly);
  const filterTag = useGalleryStore((s) => s.filterTag);
  const filterFrameType = useGalleryStore((s) => s.filterFrameType);
  const filterTargetId = useGalleryStore((s) => s.filterTargetId);

  const metadataIndex = useMemo(() => buildMetadataIndex(files), [files]);

  const filteredFiles = useMemo(() => {
    let result = files;

    if (filterObject) {
      result = result.filter((f) => f.object === filterObject);
    }
    if (filterFilter) {
      result = result.filter((f) => f.filter === filterFilter);
    }
    if (filterDateRange) {
      result = result.filter((f) => {
        if (!f.dateObs) return false;
        const date = f.dateObs.split("T")[0];
        return date >= filterDateRange[0] && date <= filterDateRange[1];
      });
    }
    if (filterFavoriteOnly) {
      result = result.filter((f) => f.isFavorite);
    }
    if (filterTag) {
      result = result.filter((f) => f.tags.includes(filterTag));
    }
    if (filterFrameType) {
      result = result.filter((f) => f.frameType === filterFrameType);
    }
    if (filterTargetId) {
      result = result.filter((f) => f.targetId === filterTargetId);
    }

    return result;
  }, [
    files,
    filterObject,
    filterFilter,
    filterDateRange,
    filterFavoriteOnly,
    filterTag,
    filterFrameType,
    filterTargetId,
  ]);

  const sortedFiles = useMemo(() => {
    const sorted = [...filteredFiles];
    const direction = defaultSortOrder === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      if (defaultSortBy === "name") {
        return direction * a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" });
      }

      if (defaultSortBy === "date") {
        const aDate = new Date(a.dateObs ?? a.importDate).getTime();
        const bDate = new Date(b.dateObs ?? b.importDate).getTime();
        if (aDate === bDate) return 0;
        return direction * (aDate < bDate ? -1 : 1);
      }

      if (defaultSortBy === "size") {
        if (a.fileSize === b.fileSize) return 0;
        return direction * (a.fileSize < b.fileSize ? -1 : 1);
      }

      if (defaultSortBy === "object") {
        return (
          direction *
          (a.object ?? "").localeCompare(b.object ?? "", undefined, {
            sensitivity: "base",
          })
        );
      }

      return (
        direction *
        (a.filter ?? "").localeCompare(b.filter ?? "", undefined, {
          sensitivity: "base",
        })
      );
    });

    return sorted;
  }, [filteredFiles, defaultSortBy, defaultSortOrder]);

  const groupedByDate = useMemo(() => groupByDate(sortedFiles), [sortedFiles]);
  const groupedByObject = useMemo(() => groupByObject(sortedFiles), [sortedFiles]);
  const groupedByLocation = useMemo(() => groupByLocation(sortedFiles), [sortedFiles]);

  const search = useCallback((query: string) => searchFiles(sortedFiles, query), [sortedFiles]);

  return {
    files: sortedFiles,
    totalCount: files.length,
    filteredCount: sortedFiles.length,
    viewMode,
    gridColumns,
    metadataIndex,
    groupedByDate,
    groupedByObject,
    groupedByLocation,
    search,
  };
}
