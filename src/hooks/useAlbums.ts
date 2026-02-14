/**
 * 相簿管理 Hook
 */

import { useCallback } from "react";
import { useAlbumStore } from "../stores/useAlbumStore";
import { useFitsStore } from "../stores/useFitsStore";
import { createAlbum, evaluateSmartRules, suggestSmartAlbums } from "../lib/gallery/albumManager";
import type { SmartAlbumRule } from "../lib/fits/types";

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

  const files = useFitsStore((s) => s.files);

  const createNewAlbum = useCallback(
    (name: string, description?: string) => {
      const album = createAlbum(name, description);
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
      updateAlbum(album.id, { imageIds: matchedIds });
    }
  }, [albums, files, updateAlbum]);

  const getSuggestions = useCallback(() => {
    return suggestSmartAlbums(files);
  }, [files]);

  return {
    albums,
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
  };
}
