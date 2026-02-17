/**
 * 相簿重复图片检测
 */

import type { FitsMetadata, Album, DuplicateImageInfo } from "../fits/types";

/**
 * 查找存在于多个相簿中的图片
 */
export function findDuplicateImages(files: FitsMetadata[], albums: Album[]): DuplicateImageInfo[] {
  const fileIdSet = new Set(files.map((file) => file.id));
  const albumNameMap = new Map(albums.map((album) => [album.id, album.name] as const));
  const imageToAlbumIds = new Map<string, string[]>();

  for (const album of albums) {
    const uniqueImageIds = [...new Set(album.imageIds)];
    for (const imageId of uniqueImageIds) {
      if (!fileIdSet.has(imageId)) continue;
      const existing = imageToAlbumIds.get(imageId);
      if (existing) {
        existing.push(album.id);
      } else {
        imageToAlbumIds.set(imageId, [album.id]);
      }
    }
  }

  const duplicates: DuplicateImageInfo[] = [];
  for (const [imageId, albumIds] of imageToAlbumIds.entries()) {
    if (albumIds.length < 2) continue;
    duplicates.push({
      imageId,
      albumIds,
      albumNames: albumIds.map((albumId) => albumNameMap.get(albumId) ?? albumId),
    });
  }

  return duplicates.sort((a, b) => b.albumIds.length - a.albumIds.length);
}

/**
 * 获取重复图片的统计信息
 */
export function getDuplicateStats(duplicates: DuplicateImageInfo[]): {
  totalDuplicates: number;
  maxOccurrences: number;
  albumsWithDuplicates: string[];
} {
  const albumIds = new Set<string>();
  let maxOccurrences = 0;

  for (const dup of duplicates) {
    dup.albumIds.forEach((id) => albumIds.add(id));
    if (dup.albumIds.length > maxOccurrences) {
      maxOccurrences = dup.albumIds.length;
    }
  }

  return {
    totalDuplicates: duplicates.length,
    maxOccurrences,
    albumsWithDuplicates: Array.from(albumIds),
  };
}

/**
 * 查找指定图片所在的相簿
 */
export function getAlbumsForImage(imageId: string, albums: Album[]): Album[] {
  return albums.filter((a) => a.imageIds.includes(imageId));
}

/**
 * 从相簿中移除重复图片（保留在指定相簿中）
 */
export function removeDuplicateFromAlbums(
  imageId: string,
  keepAlbumId: string,
  albums: Album[],
): { albumId: string; imageId: string }[] {
  const removals: { albumId: string; imageId: string }[] = [];

  for (const album of albums) {
    if (album.id !== keepAlbumId && album.imageIds.includes(imageId)) {
      removals.push({ albumId: album.id, imageId });
    }
  }

  return removals;
}
