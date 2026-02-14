/**
 * 相册操作 Hook
 */

import { useCallback, useMemo } from "react";
import { useGalleryStore } from "../stores/useGalleryStore";
import { useFitsStore } from "../stores/useFitsStore";
import {
  buildMetadataIndex,
  searchFiles,
  groupByDate,
  groupByObject,
  groupByLocation,
} from "../lib/gallery/metadataIndex";

export function useGallery() {
  const files = useFitsStore((s) => s.files);

  const viewMode = useGalleryStore((s) => s.viewMode);
  const gridColumns = useGalleryStore((s) => s.gridColumns);
  const filterObject = useGalleryStore((s) => s.filterObject);
  const filterFilter = useGalleryStore((s) => s.filterFilter);
  const filterDateRange = useGalleryStore((s) => s.filterDateRange);
  const filterFavoriteOnly = useGalleryStore((s) => s.filterFavoriteOnly);
  const filterTag = useGalleryStore((s) => s.filterTag);

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

    return result;
  }, [files, filterObject, filterFilter, filterDateRange, filterFavoriteOnly, filterTag]);

  const groupedByDate = useMemo(() => groupByDate(filteredFiles), [filteredFiles]);
  const groupedByObject = useMemo(() => groupByObject(filteredFiles), [filteredFiles]);
  const groupedByLocation = useMemo(() => groupByLocation(filteredFiles), [filteredFiles]);

  const search = useCallback((query: string) => searchFiles(filteredFiles, query), [filteredFiles]);

  return {
    files: filteredFiles,
    totalCount: files.length,
    filteredCount: filteredFiles.length,
    viewMode,
    gridColumns,
    metadataIndex,
    groupedByDate,
    groupedByObject,
    groupedByLocation,
    search,
  };
}
