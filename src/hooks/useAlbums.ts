/**
 * 相簿管理 Hook
 */

import { useCallback, useEffect, useMemo } from "react";
import { useAlbumStore } from "../stores/useAlbumStore";
import { useFitsStore } from "../stores/useFitsStore";
import { createAlbum, evaluateSmartRules, suggestSmartAlbums } from "../lib/gallery/albumManager";
import { calculateAlbumStatistics } from "../lib/gallery/albumStatistics";
import { findDuplicateImages } from "../lib/gallery/albumDuplicateDetector";
import type { SmartAlbumRule, AlbumStatistics } from "../lib/fits/types";

const hasSameIds = (prev: string[], next: string[]) =>
  prev.length === next.length && prev.every((id, index) => id === next[index]);

export function useAlbums() {
  const albums = useAlbumStore((s) => s.albums);
  const addAlbum = useAlbumStore((s) => s.addAlbum);
  const removeAlbum = useAlbumStore((s) => s.removeAlbum);
  const updateAlbum = useAlbumStore((s) => s.updateAlbum);
  const addImageToAlbum = useAlbumStore((s) => s.addImageToAlbum);
  const removeImageFromAlbum = useAlbumStore((s) => s.removeImageFromAlbum);
  const addImagesToAlbum = useAlbumStore((s) => s.addImagesToAlbum);
  const setCoverImage = useAlbumStore((s) => s.setCoverImage);
  const getAlbumsForImage = useAlbumStore((s) => s.getAlbumsForImage);

  // NEW: Search & Sort
  const albumSearchQuery = useAlbumStore((s) => s.albumSearchQuery);
  const albumSortBy = useAlbumStore((s) => s.albumSortBy);
  const albumSortOrder = useAlbumStore((s) => s.albumSortOrder);
  const setAlbumSearchQuery = useAlbumStore((s) => s.setAlbumSearchQuery);
  const setAlbumSortBy = useAlbumStore((s) => s.setAlbumSortBy);
  const setAlbumSortOrder = useAlbumStore((s) => s.setAlbumSortOrder);
  const getFilteredAlbums = useAlbumStore((s) => s.getFilteredAlbums);

  // NEW: Pinning
  const toggleAlbumPin = useAlbumStore((s) => s.toggleAlbumPin);

  // NEW: Merge
  const mergeAlbums = useAlbumStore((s) => s.mergeAlbums);

  // NEW: Notes
  const updateAlbumNotes = useAlbumStore((s) => s.updateAlbumNotes);

  const files = useFitsStore((s) => s.files);

  const createNewAlbum = useCallback(
    (name: string, description?: string, notes?: string) => {
      const album = createAlbum(name, description);
      if (notes) album.notes = notes;
      addAlbum(album);
      return album;
    },
    [addAlbum],
  );

  const createSmartAlbum = useCallback(
    (name: string, rules: SmartAlbumRule[], description?: string) => {
      const album = createAlbum(name, description, true, rules);
      const matchedIds = evaluateSmartRules(rules, files);
      album.imageIds = matchedIds;
      addAlbum(album);
      return album;
    },
    [addAlbum, files],
  );

  const refreshSmartAlbums = useCallback(() => {
    for (const album of albums) {
      if (!album.isSmart || !album.smartRules) continue;
      const matchedIds = evaluateSmartRules(album.smartRules, files);
      if (!hasSameIds(album.imageIds, matchedIds)) {
        updateAlbum(album.id, { imageIds: matchedIds });
      }
    }
  }, [albums, files, updateAlbum]);

  useEffect(() => {
    refreshSmartAlbums();
  }, [refreshSmartAlbums]);

  const getSuggestions = useCallback(() => {
    return suggestSmartAlbums(files);
  }, [files]);

  // NEW: Get album statistics
  const getAlbumStatistics = useCallback(
    (albumId: string): AlbumStatistics | null => {
      const album = albums.find((a) => a.id === albumId);
      if (!album) return null;
      return calculateAlbumStatistics(album, files);
    },
    [albums, files],
  );

  // NEW: Get filtered albums (with search and sort applied)
  const filteredAlbums = useMemo(() => {
    return getFilteredAlbums();
  }, [getFilteredAlbums]);

  // NEW: Find duplicate images across albums
  const duplicateImages = useMemo(() => {
    return findDuplicateImages(files, albums);
  }, [files, albums]);

  return {
    albums,
    filteredAlbums,
    createAlbum: createNewAlbum,
    createSmartAlbum,
    removeAlbum,
    updateAlbum,
    addImageToAlbum,
    removeImageFromAlbum,
    addImagesToAlbum,
    setCoverImage,
    getAlbumsForImage,
    refreshSmartAlbums,
    getSuggestions,
    // NEW
    albumSearchQuery,
    albumSortBy,
    albumSortOrder,
    setAlbumSearchQuery,
    setAlbumSortBy,
    setAlbumSortOrder,
    toggleAlbumPin,
    mergeAlbums,
    updateAlbumNotes,
    getAlbumStatistics,
    duplicateImages,
  };
}
