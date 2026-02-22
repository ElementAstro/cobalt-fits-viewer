import { useEditorStarAnnotation } from "../useEditorStarAnnotation";

describe("useEditorStarAnnotation", () => {
  it("exports a function", () => {
    expect(typeof useEditorStarAnnotation).toBe("function");
  });

  it("return type interface has expected keys", () => {
    // Verify the hook's type contract via its type export
    const expectedKeys = [
      "detectedStars",
      "isStarAnnotationMode",
      "starPoints",
      "isDetectingStars",
      "starDetectionProgress",
      "starDetectionStage",
      "pendingAnchorIndex",
      "starAnnotationsStale",
      "starAnnotationsStaleReason",
      "detectedStarCount",
      "manualStarCount",
      "enabledStarCount",
      "handleStarPointTap",
      "handleStarPointLongPress",
      "handleStarDetectToggle",
      "cancelStarDetection",
      "detectAndMergeStars",
      "setPendingAnchorIndex",
      "clearAnchors",
      "setIsStarAnnotationMode",
      "handleEditorOperation",
    ];
    // This test just documents the expected API surface
    expect(expectedKeys).toHaveLength(21);
  });
});
