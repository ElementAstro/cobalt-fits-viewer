import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAdvancedCompose } from "../useAdvancedCompose";

const mockLoadScientificImageFromPath = jest.fn();
const mockRenderComposite = jest.fn();

const mockFitsStoreState = {
  addFile: jest.fn(),
  getFileById: jest.fn(),
  updateFile: jest.fn(),
};

const mockSettingsState = {
  thumbnailSize: 256,
  thumbnailQuality: 80,
  frameClassificationConfig: { frameTypes: [], rules: [] },
  advancedComposeRegistrationMode: "none",
  advancedComposeFramingMode: "first",
  advancedComposeAutoLinearMatch: true,
  advancedComposeAutoBrightnessBalance: true,
  advancedComposePreviewScale: 0.5,
  advancedComposePixelMathR: "r",
  advancedComposePixelMathG: "g",
  advancedComposePixelMathB: "b",
};

jest.mock("../../stores/useFitsStore", () => ({
  useFitsStore: (selector: (state: typeof mockFitsStoreState) => unknown) =>
    selector(mockFitsStoreState),
}));

jest.mock("../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: typeof mockSettingsState) => unknown) =>
    selector(mockSettingsState),
}));

jest.mock("../useExport", () => ({
  useExport: () => ({
    exportImage: jest.fn(async () => "file:///tmp/composite.fits"),
    shareImage: jest.fn(async () => undefined),
  }),
}));

jest.mock("../../lib/image/scientificImageLoader", () => ({
  loadScientificImageFromPath: (...args: any[]) => mockLoadScientificImageFromPath(...args),
}));

jest.mock("../../lib/composite/registrationAdapter", () => ({
  registerCompositeLayers: jest.fn(async () => ({
    width: 2,
    height: 2,
    layers: [new Float32Array([0, 1, 2, 3])],
  })),
}));

jest.mock("../../lib/composite/renderer", () => ({
  renderComposite: (...args: any[]) => mockRenderComposite(...args),
}));

jest.mock("../../lib/gallery/thumbnailWorkflow", () => ({
  saveThumbnailFromRGBA: jest.fn(() => "file:///thumb.png"),
}));

jest.mock("../../lib/import/imageParsePipeline", () => ({
  parseImageBuffer: jest.fn(),
}));

describe("useAdvancedCompose", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRenderComposite.mockResolvedValue({
      rgbaData: new Uint8ClampedArray(16),
      width: 2,
      height: 2,
      channels: {
        r: new Float32Array([0, 1, 2, 3]),
        g: new Float32Array([0, 1, 2, 3]),
        b: new Float32Array([0, 1, 2, 3]),
      },
    });
    mockLoadScientificImageFromPath.mockResolvedValue({
      pixels: new Float32Array([0, 1, 2, 3]),
      width: 2,
      height: 2,
      exposure: null,
      sourceType: "raster",
      sourceFormat: "png",
    });
  });

  it("loads raster layer files through shared scientific loader", async () => {
    const { result } = renderHook(() => useAdvancedCompose());
    const layerId = result.current.project.layers[0]?.id;
    expect(layerId).toBeTruthy();

    await act(async () => {
      await result.current.loadLayerFile(layerId!, "f-1", "/tmp/layer.png", "layer.png");
    });

    await waitFor(() => {
      const target = result.current.project.layers.find((layer) => layer.id === layerId);
      expect(target?.fileId).toBe("f-1");
      expect(target?.pixels).toBeInstanceOf(Float32Array);
      expect(result.current.baseDimensions).toEqual({ width: 2, height: 2 });
    });
    expect(mockLoadScientificImageFromPath).toHaveBeenCalledWith("/tmp/layer.png", {
      filename: "layer.png",
    });
  });

  it("rejects layer with mismatched dimensions", async () => {
    mockLoadScientificImageFromPath
      .mockResolvedValueOnce({
        pixels: new Float32Array([0, 1, 2, 3]),
        width: 2,
        height: 2,
        exposure: null,
        sourceType: "fits",
        sourceFormat: "fits",
      })
      .mockResolvedValueOnce({
        pixels: new Float32Array([0, 1, 2, 3]),
        width: 4,
        height: 4,
        exposure: null,
        sourceType: "raster",
        sourceFormat: "png",
      });

    const { result } = renderHook(() => useAdvancedCompose());
    const firstLayer = result.current.project.layers[0]?.id;
    const secondLayer = result.current.project.layers[1]?.id;

    await act(async () => {
      await result.current.loadLayerFile(firstLayer!, "f-1", "/tmp/a.fits", "a.fits");
    });

    await act(async () => {
      await result.current.loadLayerFile(secondLayer!, "f-2", "/tmp/b.png", "b.png");
    });

    expect(result.current.error).toContain("dimensions mismatch");
  });
});
