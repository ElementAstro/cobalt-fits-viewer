import { isVideoFile, isAudioFile, isMediaWorkspaceFile, routeForMedia } from "../routing";
import type { FitsMetadata } from "../../fits/types";

function makeFile(overrides: Partial<FitsMetadata>): FitsMetadata {
  return {
    id: "file-1",
    filename: "test.mp4",
    filepath: "file:///test.mp4",
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "unknown",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  };
}

describe("isVideoFile", () => {
  it("returns true for video mediaKind", () => {
    expect(isVideoFile(makeFile({ mediaKind: "video" }))).toBe(true);
  });

  it("returns true for video sourceType", () => {
    expect(isVideoFile(makeFile({ sourceType: "video" }))).toBe(true);
  });

  it("returns false for audio mediaKind", () => {
    expect(isVideoFile(makeFile({ mediaKind: "audio" }))).toBe(false);
  });

  it("returns false for plain file", () => {
    expect(isVideoFile(makeFile({}))).toBe(false);
  });
});

describe("isAudioFile", () => {
  it("returns true for audio mediaKind", () => {
    expect(isAudioFile(makeFile({ mediaKind: "audio" }))).toBe(true);
  });

  it("returns true for audio sourceType", () => {
    expect(isAudioFile(makeFile({ sourceType: "audio" }))).toBe(true);
  });

  it("returns false for video mediaKind", () => {
    expect(isAudioFile(makeFile({ mediaKind: "video" }))).toBe(false);
  });

  it("returns false for plain file", () => {
    expect(isAudioFile(makeFile({}))).toBe(false);
  });
});

describe("isMediaWorkspaceFile", () => {
  it("returns true for video mediaKind", () => {
    expect(isMediaWorkspaceFile(makeFile({ mediaKind: "video" }))).toBe(true);
  });

  it("returns true for audio mediaKind", () => {
    expect(isMediaWorkspaceFile(makeFile({ mediaKind: "audio" }))).toBe(true);
  });

  it("returns true for video sourceType", () => {
    expect(isMediaWorkspaceFile(makeFile({ sourceType: "video" }))).toBe(true);
  });

  it("returns true for audio sourceType", () => {
    expect(isMediaWorkspaceFile(makeFile({ sourceType: "audio" }))).toBe(true);
  });

  it("returns false for image mediaKind", () => {
    expect(isMediaWorkspaceFile(makeFile({ mediaKind: "image" }))).toBe(false);
  });

  it("returns false for fits sourceType", () => {
    expect(isMediaWorkspaceFile(makeFile({ sourceType: "fits" }))).toBe(false);
  });

  it("returns false when neither mediaKind nor sourceType is media", () => {
    expect(isMediaWorkspaceFile(makeFile({}))).toBe(false);
  });
});

describe("routeForMedia", () => {
  it("routes video files to /video/{id}", () => {
    expect(routeForMedia(makeFile({ id: "v1", mediaKind: "video" }))).toBe("/video/v1");
  });

  it("routes audio files to /video/{id}", () => {
    expect(routeForMedia(makeFile({ id: "a1", mediaKind: "audio" }))).toBe("/video/a1");
  });

  it("routes sourceType=video to /video/{id}", () => {
    expect(routeForMedia(makeFile({ id: "v2", sourceType: "video" }))).toBe("/video/v2");
  });

  it("routes image files to /viewer/{id}", () => {
    expect(routeForMedia(makeFile({ id: "img1", mediaKind: "image", sourceType: "fits" }))).toBe(
      "/viewer/img1",
    );
  });

  it("routes plain files to /viewer/{id}", () => {
    expect(routeForMedia(makeFile({ id: "f1" }))).toBe("/viewer/f1");
  });
});
