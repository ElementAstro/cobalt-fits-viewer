import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";
import StackingScreen from "../index";
import { useFitsStore } from "../../../stores/files/useFitsStore";
import type { FitsMetadata } from "../../../lib/fits/types";

const mockUseLocalSearchParams = jest.fn((): { ids?: string | string[] } => ({}));
const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock("expo-keep-awake", () => ({
  useKeepAwake: jest.fn(),
}));

jest.mock("../../../hooks/common/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    contentPaddingTop: 0,
    horizontalPadding: 0,
  }),
}));

jest.mock("../../../hooks/export/useExport", () => ({
  useExport: () => ({
    saveImage: jest.fn(),
    shareImage: jest.fn(),
  }),
}));

const mockStackingState = {
  isStacking: false,
  progress: null as null,
  result: null as null,
  error: null as string | null,
  stackFiles: jest.fn(),
  cancel: jest.fn(),
  reset: jest.fn(),
};

jest.mock("../../../hooks/stacking/useStacking", () => ({
  useStacking: () => mockStackingState,
}));

const settingsState = {
  defaultStackMethod: "average",
  defaultSigmaValue: 2.5,
  defaultAlignmentMode: "none",
  defaultEnableQuality: false,
  stackingDetectionProfile: "balanced",
  stackingDetectSigmaThreshold: 4,
  stackingDetectMaxStars: 200,
  stackingDetectMinArea: 4,
  stackingDetectMaxArea: 800,
  stackingDetectBorderMargin: 8,
  stackingDetectSigmaClipIters: 2,
  stackingDetectApplyMatchedFilter: true,
  stackingDetectConnectivity: 8,
  stackingBackgroundMeshSize: 64,
  stackingDeblendNLevels: 16,
  stackingDeblendMinContrast: 0.1,
  stackingFilterFwhm: 2,
  stackingDetectMinFwhm: 1.5,
  stackingMaxFwhm: 8,
  stackingMaxEllipticity: 0.5,
  stackingDetectMinSharpness: 0.2,
  stackingDetectMaxSharpness: 10,
  stackingDetectPeakMax: 0,
  stackingDetectSnrMin: 5,
  stackingUseAnnotatedForAlignment: true,
  stackingRansacMaxIterations: 200,
  stackingAlignmentInlierThreshold: 2,
  thumbnailSize: 256,
  thumbnailQuality: 80,
};

jest.mock("../../../stores/app/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number | undefined>) => {
      const interpolate = (template: string) =>
        template.replace(/\{(\w+)\}/g, (_, paramKey: string) => `${params?.[paramKey] ?? ""}`);

      switch (key) {
        case "editor.framesSelected":
          return interpolate("selected:{selected}/{total}");
        case "editor.idsPreselectionSummary":
          return interpolate("pre:{selected}/{requested}");
        case "editor.idsPreselectionIgnored":
          return interpolate("ignored:{count}");
        case "editor.stackPrecheckMixedDimensions":
          return interpolate("mixed-dims:{dims}");
        case "editor.stackPrecheckMissingDimensions":
          return interpolate("missing-dims:{count}");
        case "editor.stackPrecheckMissingExposure":
          return interpolate("missing-exp:{count}");
        case "editor.stackPrecheckCalibrationDimensionMismatch":
          return interpolate("cal-dims:{filename}:{dims}:{expected}");
        case "editor.stackMetadataFilterInconsistent":
          return "filter-inconsistent";
        case "editor.stackButton":
          return "stack";
        case "editor.frames":
          return "frames";
        case "editor.noStackableFiles":
          return "no-stackable";
        default:
          return key;
      }
    },
  }),
}));

function makeFile(overrides: Partial<FitsMetadata> = {}): FitsMetadata {
  return {
    id: "file-1",
    filename: "M42_Light.fits",
    filepath: "file:///document/fits_files/M42_Light.fits",
    fileSize: 1024,
    importDate: 1700000000000,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  };
}

describe("stacking/index route params", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFitsStore.setState({
      files: [],
      selectedIds: [],
      isSelectionMode: false,
      sortBy: "date",
      sortOrder: "desc",
      searchQuery: "",
      filterTags: [],
    });
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it("deduplicates ids, filters invalid ids, and preselects only stackable files", async () => {
    useFitsStore.setState({
      files: [
        makeFile({ id: "file-1", sourceType: "fits", mediaKind: "image" }),
        makeFile({
          id: "file-2",
          filename: "M42_2.fit",
          filepath: "file:///document/fits_files/M42_2.fit",
          sourceType: "raster",
          mediaKind: "image",
          frameType: "unknown",
        }),
        makeFile({
          id: "video-1",
          filename: "capture.mp4",
          filepath: "file:///document/fits_files/capture.mp4",
          sourceType: "video",
          sourceFormat: "mp4",
          mediaKind: "video",
          frameType: "unknown",
        }),
      ],
    });
    mockUseLocalSearchParams.mockReturnValue({
      ids: ["file-1,missing,file-1", "file-2,video-1"],
    });

    render(<StackingScreen />);

    await waitFor(() => {
      expect(screen.getByText("selected:2/2")).toBeTruthy();
      expect(screen.getByText(/pre:2\/4/)).toBeTruthy();
      expect(screen.getByText(/ignored:2/)).toBeTruthy();
      expect(screen.getByText(/stack\s*\(\s*2\s*frames\s*\)/)).toBeTruthy();
    });
  });

  it("shows empty stackable state and keeps preselection at zero when no stackable files exist", async () => {
    useFitsStore.setState({
      files: [
        makeFile({
          id: "video-1",
          filename: "capture.mp4",
          filepath: "file:///document/fits_files/capture.mp4",
          sourceType: "video",
          sourceFormat: "mp4",
          mediaKind: "video",
          frameType: "unknown",
        }),
        makeFile({
          id: "audio-1",
          filename: "recording.m4a",
          filepath: "file:///document/fits_files/recording.m4a",
          sourceType: "audio",
          sourceFormat: "m4a",
          mediaKind: "audio",
          frameType: "unknown",
        }),
      ],
    });
    mockUseLocalSearchParams.mockReturnValue({
      ids: "video-1,audio-1,missing",
    });

    render(<StackingScreen />);

    await waitFor(() => {
      expect(screen.getByText("selected:0/0")).toBeTruthy();
      expect(screen.getByText(/pre:0\/3/)).toBeTruthy();
      expect(screen.getByText(/ignored:3/)).toBeTruthy();
      expect(screen.getAllByText("no-stackable").length).toBeGreaterThan(0);
      expect(screen.getByText(/stack\s*\(\s*0\s*frames\s*\)/)).toBeTruthy();
    });
  });

  it("excludes decode failed image entries from stackable candidates", async () => {
    useFitsStore.setState({
      files: [
        makeFile({
          id: "ok-1",
          filename: "ok-1.dng",
          filepath: "file:///document/fits_files/ok-1.dng",
          sourceType: "raster",
          sourceFormat: "dng",
          mediaKind: "image",
          decodeStatus: "ready",
        }),
        makeFile({
          id: "bad-1",
          filename: "bad-1.dng",
          filepath: "file:///document/fits_files/bad-1.dng",
          sourceType: "raster",
          sourceFormat: "dng",
          mediaKind: "image",
          decodeStatus: "failed",
        }),
      ],
    });
    mockUseLocalSearchParams.mockReturnValue({
      ids: "ok-1,bad-1",
    });

    render(<StackingScreen />);

    await waitFor(() => {
      expect(screen.getByText("selected:1/1")).toBeTruthy();
      expect(screen.getByText(/pre:1\/2/)).toBeTruthy();
      expect(screen.getByText(/ignored:1/)).toBeTruthy();
    });
  });
});

describe("stacking/index precheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFitsStore.setState({
      files: [],
      selectedIds: [],
      isSelectionMode: false,
      sortBy: "date",
      sortOrder: "desc",
      searchQuery: "",
      filterTags: [],
    });
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it("shows a precheck error and prevents stacking when dimensions are mixed", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    useFitsStore.setState({
      files: [
        makeFile({
          id: "file-1",
          sourceType: "fits",
          mediaKind: "image",
          naxis1: 100,
          naxis2: 100,
          exptime: 10,
        }),
        makeFile({
          id: "file-2",
          filename: "M42_Light_2.fits",
          filepath: "file:///document/fits_files/M42_Light_2.fits",
          sourceType: "fits",
          mediaKind: "image",
          naxis1: 200,
          naxis2: 100,
          exptime: 10,
        }),
      ],
    });
    mockUseLocalSearchParams.mockReturnValue({
      ids: "file-1,file-2",
    });

    render(<StackingScreen />);

    await waitFor(() => {
      expect(screen.getByText(/mixed-dims:/)).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("e2e-action-stacking__index-start"));

    expect(mockStackingState.stackFiles).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("shows precheck warnings for inconsistent metadata but still allows stacking", async () => {
    useFitsStore.setState({
      files: [
        makeFile({
          id: "file-1",
          sourceType: "fits",
          mediaKind: "image",
          naxis1: 100,
          naxis2: 100,
          exptime: 10,
          filter: "Ha",
        }),
        makeFile({
          id: "file-2",
          filename: "M42_Light_2.fits",
          filepath: "file:///document/fits_files/M42_Light_2.fits",
          sourceType: "fits",
          mediaKind: "image",
          naxis1: 100,
          naxis2: 100,
          exptime: 10,
          filter: "OIII",
        }),
      ],
    });
    mockUseLocalSearchParams.mockReturnValue({
      ids: "file-1,file-2",
    });

    render(<StackingScreen />);

    await waitFor(() => {
      expect(screen.getByText("filter-inconsistent")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("e2e-action-stacking__index-start"));

    await waitFor(() => {
      expect(mockStackingState.stackFiles).toHaveBeenCalledTimes(1);
    });
  });
});
