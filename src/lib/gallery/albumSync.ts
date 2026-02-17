import type { Album, FitsMetadata } from "../fits/types";

export interface AlbumReconcileResult {
  albums: Album[];
  prunedRefs: number;
  coverFixes: number;
}

const hasSameIds = (prev: string[], next: string[]) =>
  prev.length === next.length && prev.every((id, index) => id === next[index]);

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function buildImageToAlbumMap(albums: Album[]): Map<string, string[]> {
  const imageToAlbumMap = new Map<string, string[]>();

  for (const album of albums) {
    const albumImageIds = uniqueIds(album.imageIds);
    for (const imageId of albumImageIds) {
      const existing = imageToAlbumMap.get(imageId);
      if (existing) {
        existing.push(album.id);
      } else {
        imageToAlbumMap.set(imageId, [album.id]);
      }
    }
  }

  return imageToAlbumMap;
}

export function computeFileAlbumIdPatches(
  files: FitsMetadata[],
  imageToAlbumMap: Map<string, string[]>,
): Array<{ fileId: string; albumIds: string[] }> {
  const patches: Array<{ fileId: string; albumIds: string[] }> = [];

  for (const file of files) {
    const nextAlbumIds = imageToAlbumMap.get(file.id) ?? [];
    const currentAlbumIds = file.albumIds ?? [];
    if (!hasSameIds(currentAlbumIds, nextAlbumIds)) {
      patches.push({ fileId: file.id, albumIds: nextAlbumIds });
    }
  }

  return patches;
}

export function computeAlbumFileConsistencyPatches(
  files: FitsMetadata[],
  albums: Album[],
): Array<{ fileId: string; albumIds: string[] }> {
  const imageToAlbumMap = buildImageToAlbumMap(albums);
  return computeFileAlbumIdPatches(files, imageToAlbumMap);
}

export function reconcileAlbumsWithValidFiles(
  albums: Album[],
  validFileIds: Set<string>,
): AlbumReconcileResult {
  let prunedRefs = 0;
  let coverFixes = 0;

  const nextAlbums = albums.map((album) => {
    const dedupedIds = uniqueIds(album.imageIds);
    const filteredIds = dedupedIds.filter((id) => validFileIds.has(id));
    prunedRefs += dedupedIds.length - filteredIds.length;

    const hasCover = Boolean(album.coverImageId);
    const coverValid = album.coverImageId ? filteredIds.includes(album.coverImageId) : true;
    const nextCoverImageId = coverValid ? album.coverImageId : undefined;
    if (hasCover && !coverValid) {
      coverFixes += 1;
    }

    const changedIds = !hasSameIds(album.imageIds, filteredIds);
    const changedCover = album.coverImageId !== nextCoverImageId;

    if (!changedIds && !changedCover) {
      return album;
    }

    return {
      ...album,
      imageIds: filteredIds,
      coverImageId: nextCoverImageId,
      updatedAt: Date.now(),
    };
  });

  return {
    albums: nextAlbums,
    prunedRefs,
    coverFixes,
  };
}
