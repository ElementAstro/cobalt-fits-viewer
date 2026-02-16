import type { Album } from "../fits/types";

export function getMergedImageCount(source: Album, target: Album): number {
  return new Set([...target.imageIds, ...source.imageIds]).size;
}

export function getMergeAddedImageCount(source: Album, target: Album): number {
  const targetIds = new Set(target.imageIds);
  return source.imageIds.filter((id) => !targetIds.has(id)).length;
}

export function getMergeTargetAlbums(albums: Album[], sourceAlbum: Album, query: string): Album[] {
  const normalizedQuery = query.trim().toLowerCase();

  return albums
    .filter((album) => {
      if (album.id === sourceAlbum.id || album.isSmart) return false;
      if (!normalizedQuery) return true;

      const name = album.name.toLowerCase();
      const description = album.description?.toLowerCase() ?? "";
      const notes = album.notes?.toLowerCase() ?? "";

      return (
        name.includes(normalizedQuery) ||
        description.includes(normalizedQuery) ||
        notes.includes(normalizedQuery)
      );
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
}
