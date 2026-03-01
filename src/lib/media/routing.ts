import type { FitsMetadata } from "../fits/types";

export function isVideoFile(file: Pick<FitsMetadata, "mediaKind" | "sourceType">): boolean {
  return file.mediaKind === "video" || file.sourceType === "video";
}

export function isAudioFile(file: Pick<FitsMetadata, "mediaKind" | "sourceType">): boolean {
  return file.mediaKind === "audio" || file.sourceType === "audio";
}

export function isMediaWorkspaceFile(file: FitsMetadata): boolean {
  return isVideoFile(file) || isAudioFile(file);
}

export function routeForMedia(file: FitsMetadata): string {
  return isMediaWorkspaceFile(file) ? `/video/${file.id}` : `/viewer/${file.id}`;
}
