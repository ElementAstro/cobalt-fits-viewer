import type { FitsMetadata } from "../fits/types";

export function isMediaWorkspaceFile(file: FitsMetadata): boolean {
  return (
    file.mediaKind === "video" ||
    file.mediaKind === "audio" ||
    file.sourceType === "video" ||
    file.sourceType === "audio"
  );
}

export function routeForMedia(file: FitsMetadata): string {
  return isMediaWorkspaceFile(file) ? `/video/${file.id}` : `/viewer/${file.id}`;
}
