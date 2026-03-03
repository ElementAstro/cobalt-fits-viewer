import { pickImageLikeIds, resolveComparePair } from "../compareRouting";
import type { FitsMetadata } from "../../fits/types";

jest.mock("../../import/imageParsePipeline", () => ({
  isProcessableImageMedia: (file: {
    mediaKind?: string;
    sourceType?: string;
    decodeStatus?: "ready" | "failed";
  }) =>
    (file?.mediaKind === "image" || file?.sourceType === "fits" || file?.sourceType === "raster") &&
    file?.decodeStatus !== "failed",
}));

function makeFile(partial: Partial<FitsMetadata>): FitsMetadata {
  return {
    id: "file-1",
    filename: "file-1.fits",
    filepath: "file:///file-1.fits",
    fileSize: 1,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    sourceType: "fits",
    mediaKind: "image",
    ...partial,
  };
}

describe("compareRouting", () => {
  describe("pickImageLikeIds", () => {
    it("filters non-image IDs, dedupes, and keeps order", () => {
      const files = [
        makeFile({ id: "a" }),
        makeFile({ id: "b", sourceType: "video", mediaKind: "video", frameType: "unknown" }),
        makeFile({ id: "c", sourceType: "raster" }),
        makeFile({ id: "d" }),
      ];

      expect(pickImageLikeIds([" a ", "b", "c", "a", "d"], files, 4)).toEqual(["a", "c", "d"]);
    });

    it("caps selection by limit (default 2)", () => {
      const files = [makeFile({ id: "a" }), makeFile({ id: "b" }), makeFile({ id: "c" })];
      expect(pickImageLikeIds(["a", "b", "c"], files)).toEqual(["a", "b"]);
    });

    it("skips decode-failed images", () => {
      const files = [makeFile({ id: "a", decodeStatus: "failed" }), makeFile({ id: "b" })];
      expect(pickImageLikeIds(["a", "b"], files)).toEqual(["b"]);
    });

    it("returns empty for non-positive limit", () => {
      const files = [makeFile({ id: "a" })];
      expect(pickImageLikeIds(["a"], files, 0)).toEqual([]);
    });
  });

  describe("resolveComparePair", () => {
    const files = [
      makeFile({ id: "img-1" }),
      makeFile({ id: "img-2", derivedFromId: "img-1" }),
      makeFile({ id: "video-1", sourceType: "video", mediaKind: "video", frameType: "unknown" }),
      makeFile({ id: "img-3" }),
    ];

    it("prefers explicit preferredId when valid", () => {
      expect(resolveComparePair("img-2", files, "img-3")).toEqual(["img-2", "img-3"]);
    });

    it("falls back to primary.derivedFromId", () => {
      expect(resolveComparePair("img-2", files)).toEqual(["img-2", "img-1"]);
    });

    it("falls back to next image-like neighbor", () => {
      expect(resolveComparePair("img-1", files)).toEqual(["img-1", "img-2"]);
    });

    it("falls back to previous image-like neighbor when next is unavailable", () => {
      expect(resolveComparePair("img-3", files)).toEqual(["img-3", "img-2"]);
    });

    it("skips decode-failed candidates for pairing", () => {
      const candidates = [
        makeFile({ id: "img-1" }),
        makeFile({ id: "img-2", decodeStatus: "failed" }),
        makeFile({ id: "img-3" }),
      ];
      expect(resolveComparePair("img-1", candidates)).toEqual(["img-1", "img-3"]);
    });

    it("returns only primary when no candidate exists", () => {
      expect(resolveComparePair("img-1", [makeFile({ id: "img-1" })])).toEqual(["img-1"]);
    });

    it("returns empty when primary is not image-like", () => {
      const onlyVideo = [
        makeFile({ id: "video-1", sourceType: "video", mediaKind: "video", frameType: "unknown" }),
      ];
      expect(resolveComparePair("video-1", onlyVideo)).toEqual([]);
    });
  });
});
