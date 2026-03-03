import React from "react";
import { Alert } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import ConvertScreen from "../index";
import { useFitsStore } from "../../../stores/useFitsStore";
import { DEFAULT_FITS_TARGET_OPTIONS, DEFAULT_TIFF_TARGET_OPTIONS } from "../../../lib/fits/types";
import type { FitsMetadata } from "../../../lib/fits/types";

const mockUseConverter = jest.fn();
const mockUseFitsFile = jest.fn();
const mockUseImageProcessing = jest.fn();
const mockUseExport = jest.fn();

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({ contentPaddingTop: 0, horizontalPadding: 0 }),
}));

jest.mock("../../../hooks/useConverter", () => ({
  useConverter: () => mockUseConverter(),
}));

jest.mock("../../../hooks/useFitsFile", () => ({
  useFitsFile: () => mockUseFitsFile(),
}));

jest.mock("../../../hooks/useImageProcessing", () => ({
  useImageProcessing: () => mockUseImageProcessing(),
}));

jest.mock("../../../hooks/useExport", () => ({
  useExport: () => mockUseExport(),
}));

jest.mock("../../../stores/useAstrometryStore", () => ({
  useAstrometryStore: (selector: (state: unknown) => unknown) =>
    selector({
      jobs: [],
    }),
}));

jest.mock("../../../components/converter/FormatSelector", () => ({
  FormatSelector: () => null,
}));

jest.mock("../../../components/converter/BatchConvertContent", () => ({
  BatchConvertContent: () => null,
}));

jest.mock("../../../components/common/SimpleSlider", () => ({
  SimpleSlider: () => null,
}));

jest.mock("../../../components/fits/FitsCanvas", () => ({
  FitsCanvas: () => null,
}));

jest.mock("../../../components/common/LoadingOverlay", () => ({
  LoadingOverlay: () => null,
}));

function makeFile(overrides: Record<string, unknown> = {}) {
  return {
    id: "file-1",
    filename: "m42.fits",
    filepath: "/tmp/m42.fits",
    fileSize: 1024,
    importDate: 1700000000000,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    mediaKind: "image",
    sourceType: "fits",
    ...overrides,
  } as FitsMetadata;
}

describe("ConvertScreen behaviour", () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

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

    mockUseConverter.mockReturnValue({
      currentOptions: {
        format: "png",
        quality: 90,
        bitDepth: 8,
        dpi: 72,
        fits: { ...DEFAULT_FITS_TARGET_OPTIONS },
        tiff: { ...DEFAULT_TIFF_TARGET_OPTIONS },
        stretch: "linear",
        colormap: "grayscale",
        blackPoint: 0,
        whitePoint: 1,
        gamma: 1,
        outputBlack: 0,
        outputWhite: 1,
        brightness: 0,
        contrast: 1,
        mtfMidtone: 0.25,
        curvePreset: "linear",
        includeAnnotations: false,
        includeWatermark: false,
      },
      setFormat: jest.fn(),
      setQuality: jest.fn(),
      setBitDepth: jest.fn(),
      setDpi: jest.fn(),
      setOptions: jest.fn(),
      allPresets: [],
      applyPreset: jest.fn(),
      getEstimatedSize: jest.fn(() => null),
      supportsQuality: jest.fn(() => false),
      getSupportedBitDepths: jest.fn(() => [8]),
    });

    mockUseFitsFile.mockReturnValue({
      metadata: { sourceType: "fits", sourceFormat: "fits" },
      headers: [],
      comments: [],
      history: [],
      pixels: null,
      rgbChannels: null,
      sourceBuffer: null,
      dimensions: null,
      isLoading: false,
      error: null,
      loadFromPath: jest.fn(),
      reset: jest.fn(),
    });

    mockUseImageProcessing.mockReturnValue({
      rgbaData: null,
      processImage: jest.fn(),
    });

    mockUseExport.mockReturnValue({
      isExporting: false,
      exportImageDetailed: jest.fn().mockResolvedValue({
        path: null,
        diagnostics: {
          fallbackApplied: false,
          warnings: [],
          annotationsDrawn: 0,
          watermarkApplied: false,
        },
      }),
    });
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it("filters non-image sources and shows no-convertible state", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "v1", filename: "a.mp4", mediaKind: "video", sourceType: "video" })],
    });

    render(<ConvertScreen />);

    expect(screen.queryByTestId("e2e-action-convert__index-select-file-v1")).toBeNull();
    expect(screen.getByText("converter.noConvertibleFiles")).toBeTruthy();
  });

  it("filters decode-failed image files from convert candidates", () => {
    useFitsStore.setState({
      files: [
        makeFile({ id: "failed-1", filename: "bad.fits", decodeStatus: "failed" }),
        makeFile({ id: "ok-1", filename: "good.fits", decodeStatus: "ready" }),
      ],
    });

    render(<ConvertScreen />);

    expect(screen.queryByTestId("e2e-action-convert__index-select-file-failed-1")).toBeNull();
    expect(screen.getByTestId("e2e-action-convert__index-select-file-ok-1")).toBeTruthy();
  });

  it("clears selection on load error to avoid exporting stale preview data", async () => {
    const loadFromPath = jest.fn();
    const reset = jest.fn();
    mockUseFitsFile.mockReturnValue({
      metadata: { sourceType: "fits", sourceFormat: "fits" },
      headers: [],
      comments: [],
      history: [],
      pixels: null,
      rgbChannels: null,
      sourceBuffer: null,
      dimensions: null,
      isLoading: false,
      error: "load failed",
      loadFromPath,
      reset,
    });

    useFitsStore.setState({
      files: [makeFile({ id: "img-1" })],
    });

    render(<ConvertScreen />);

    await act(async () => {
      screen.getByTestId("e2e-action-convert__index-select-file-img-1").props.onPress();
    });

    expect(loadFromPath).toHaveBeenCalledWith("/tmp/m42.fits", "m42.fits", 1024);

    await waitFor(() => {
      expect(reset).toHaveBeenCalled();
    });
  });

  it("passes watermarkText to exportImageDetailed and uses profile for preview processing", async () => {
    const processImage = jest.fn();
    const exportImageDetailed = jest.fn().mockResolvedValue({
      path: "file:///exports/m42.png",
      diagnostics: {
        fallbackApplied: false,
        warnings: [],
        annotationsDrawn: 0,
        watermarkApplied: false,
      },
    });

    mockUseConverter.mockReturnValue({
      ...mockUseConverter(),
      currentOptions: {
        ...mockUseConverter().currentOptions,
        profile: "legacy",
        includeWatermark: true,
        watermarkText: "Hello",
        fits: {
          ...DEFAULT_FITS_TARGET_OPTIONS,
          colorLayout: "mono2d",
          preserveOriginalHeader: false,
          preserveWcs: false,
        },
      },
    });

    mockUseFitsFile.mockReturnValue({
      metadata: { sourceType: "fits", sourceFormat: "fits" },
      headers: [],
      comments: [],
      history: [],
      pixels: new Float32Array([0, 1, 2, 3]),
      rgbChannels: null,
      sourceBuffer: new ArrayBuffer(8),
      dimensions: { width: 2, height: 2, depth: 1, isDataCube: false },
      isLoading: false,
      error: null,
      loadFromPath: jest.fn(),
      reset: jest.fn(),
    });

    mockUseImageProcessing.mockReturnValue({
      rgbaData: new Uint8ClampedArray(2 * 2 * 4),
      processImage,
    });

    mockUseExport.mockReturnValue({
      isExporting: false,
      exportImageDetailed,
    });

    useFitsStore.setState({
      files: [makeFile({ id: "img-2" })],
    });

    render(<ConvertScreen />);

    await waitFor(() => {
      expect(processImage).toHaveBeenCalled();
      const lastCall = processImage.mock.calls[processImage.mock.calls.length - 1];
      expect(lastCall[lastCall.length - 1]).toEqual({ profile: "legacy" });
    });

    await act(async () => {
      screen.getByTestId("e2e-action-convert__index-select-file-img-2").props.onPress();
    });

    await act(async () => {
      await screen.getByTestId("e2e-action-convert__index-convert").props.onPress();
    });

    expect(exportImageDetailed).toHaveBeenCalledWith(
      expect.objectContaining({
        renderOptions: expect.objectContaining({
          includeWatermark: true,
          watermarkText: "Hello",
        }),
        fits: expect.objectContaining({
          colorLayout: "mono2d",
          preserveOriginalHeader: false,
          preserveWcs: false,
        }),
      }),
    );
  });
});
