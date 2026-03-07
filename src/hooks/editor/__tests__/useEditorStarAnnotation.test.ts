import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useEditorStarAnnotation } from "../useEditorStarAnnotation";
import type { StarAnnotationBundleV2, StarAnnotationPoint } from "../../../lib/fits/types";
import type { EditorOperationEvent } from "../useImageEditor";

const mockDetectionSettings = {
  stackingDetectionProfile: "balanced" as const,
  stackingDetectSigmaThreshold: 3,
  stackingDetectMaxStars: 500,
  stackingDetectMinArea: 3,
  stackingDetectMaxArea: 150,
  stackingDetectBorderMargin: 4,
  stackingDetectSigmaClipIters: 2,
  stackingDetectApplyMatchedFilter: true,
  stackingDetectConnectivity: 8 as const,
  stackingBackgroundMeshSize: 32,
  stackingDeblendNLevels: 16,
  stackingDeblendMinContrast: 0.05,
  stackingFilterFwhm: 2,
  stackingDetectMinFwhm: 1,
  stackingMaxFwhm: 9,
  stackingMaxEllipticity: 0.5,
  stackingDetectMinSharpness: 0.1,
  stackingDetectMaxSharpness: 0.95,
  stackingDetectPeakMax: 0,
  stackingDetectSnrMin: 5,
};

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../stores/app/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: typeof mockDetectionSettings) => unknown) =>
    selector(mockDetectionSettings),
}));

function createBundle(point: StarAnnotationPoint): StarAnnotationBundleV2 {
  return {
    version: 2,
    updatedAt: Date.now(),
    detectionSnapshot: {
      profile: "balanced",
      sigmaThreshold: 3,
      maxStars: 500,
      minArea: 3,
      maxArea: 150,
      borderMargin: 4,
      meshSize: 32,
      deblendNLevels: 16,
      deblendMinContrast: 0.05,
      filterFwhm: 2,
      maxFwhm: 9,
      maxEllipticity: 0.5,
      sigmaClipIters: 2,
      applyMatchedFilter: true,
      connectivity: 8,
      minFwhm: 1,
      minSharpness: 0.1,
      maxSharpness: 0.95,
      snrMin: 5,
      peakMax: undefined,
    },
    points: [point],
    stale: false,
    imageGeometry: {
      width: 100,
      height: 50,
    },
  };
}

function createApplyEvent(op: EditorOperationEvent["op"]): EditorOperationEvent {
  return {
    type: "apply",
    op,
    before: { width: 100, height: 50 },
    after: { width: 100, height: 50 },
    previousHistoryIndex: 0,
    historyIndex: 1,
    previousHistoryLength: 1,
    historyLength: 2,
  };
}

describe("useEditorStarAnnotation", () => {
  it("keeps annotations fresh for known non-geometry operations", async () => {
    const updateFile = jest.fn();
    const { result } = renderHook(() =>
      useEditorStarAnnotation({
        fileId: "file-1",
        editorCurrent: {
          pixels: new Float32Array(100 * 50),
          width: 100,
          height: 50,
        },
        editorHistoryIndex: 0,
        dimensions: { width: 100, height: 50 },
        updateFile,
        starAnnotations: createBundle({
          id: "p1",
          x: 10,
          y: 20,
          enabled: true,
          source: "detected",
        }),
      }),
    );

    await waitFor(() => expect(result.current.starPoints).toHaveLength(1));

    act(() => {
      result.current.handleEditorOperation(
        createApplyEvent({ type: "ghs", D: 1, b: 0.25, SP: 0, HP: 0, LP: 0 }),
      );
    });
    expect(result.current.starAnnotationsStale).toBe(false);
    expect(result.current.starAnnotationsStaleReason).toBeUndefined();

    act(() => {
      result.current.handleEditorOperation(
        createApplyEvent({
          type: "mlt",
          layers: 4,
          noiseThreshold: 3,
          noiseReduction: 0.5,
          bias: 0,
          useLinearMask: true,
          linearMaskAmplification: 200,
        }),
      );
    });
    expect(result.current.starAnnotationsStale).toBe(false);
    expect(result.current.starAnnotationsStaleReason).toBeUndefined();
    expect(updateFile).toHaveBeenCalled();
  });

  it("marks annotations stale for unknown operations", async () => {
    const { result } = renderHook(() =>
      useEditorStarAnnotation({
        fileId: "file-1",
        editorCurrent: {
          pixels: new Float32Array(100 * 50),
          width: 100,
          height: 50,
        },
        editorHistoryIndex: 0,
        dimensions: { width: 100, height: 50 },
        updateFile: jest.fn(),
        starAnnotations: createBundle({
          id: "p1",
          x: 10,
          y: 20,
          enabled: true,
          source: "detected",
        }),
      }),
    );

    await waitFor(() => expect(result.current.starPoints).toHaveLength(1));

    act(() => {
      result.current.handleEditorOperation(createApplyEvent({ type: "unknown-op" } as any));
    });

    expect(result.current.starAnnotationsStale).toBe(true);
    expect(result.current.starAnnotationsStaleReason).toBe("unsupported-transform");
  });

  it("transforms points for geometry operations", async () => {
    const { result } = renderHook(() =>
      useEditorStarAnnotation({
        fileId: "file-1",
        editorCurrent: {
          pixels: new Float32Array(100 * 50),
          width: 100,
          height: 50,
        },
        editorHistoryIndex: 0,
        dimensions: { width: 100, height: 50 },
        updateFile: jest.fn(),
        starAnnotations: createBundle({
          id: "p1",
          x: 10,
          y: 20,
          enabled: true,
          source: "detected",
        }),
      }),
    );

    await waitFor(() => expect(result.current.starPoints).toHaveLength(1));

    act(() => {
      result.current.handleEditorOperation({
        ...createApplyEvent({ type: "rotate90cw" }),
        after: { width: 50, height: 100 },
      });
    });

    expect(result.current.starAnnotationsStale).toBe(false);
    expect(result.current.starAnnotationsStaleReason).toBeUndefined();
    expect(result.current.starPoints[0]).toMatchObject({ x: 29, y: 10 });
  });
});
