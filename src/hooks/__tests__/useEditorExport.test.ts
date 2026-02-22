import { renderHook, act } from "@testing-library/react-native";
import { useEditorExport } from "../useEditorExport";

// Mock dependencies
jest.mock("heroui-native", () => ({
  useToast: () => ({
    toast: { show: jest.fn() },
  }),
  useThemeColor: () => "#00ff00",
}));

jest.mock("../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const mockExportImageDetailed = jest.fn().mockResolvedValue({
  path: "/test/export.png",
  diagnostics: { fallbackApplied: false },
});
const mockShareImage = jest.fn().mockResolvedValue(undefined);
const mockSaveImage = jest.fn().mockResolvedValue("/test/saved.png");

jest.mock("../useExport", () => ({
  useExport: () => ({
    isExporting: false,
    exportImageDetailed: mockExportImageDetailed,
    shareImage: mockShareImage,
    saveImage: mockSaveImage,
  }),
}));

jest.mock("../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ defaultExportFormat: "png" }),
}));

describe("useEditorExport", () => {
  const mockEditorData = {
    rgbaData: new Uint8ClampedArray(4),
    current: { width: 100, height: 100, pixels: new Float32Array(100 * 100) },
  };

  const mockFileInfo = {
    filename: "test.fits",
    id: "file-1",
    sourceType: "fits" as const,
    sourceFormat: "fits" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initializes with default state", () => {
    const { result } = renderHook(() =>
      useEditorExport({ editorData: null, fileInfo: null, starPoints: [] }),
    );
    expect(result.current.showExport).toBe(false);
    expect(result.current.exportFormat).toBe("png");
    expect(result.current.isExporting).toBe(false);
  });

  it("setShowExport toggles export dialog visibility", () => {
    const { result } = renderHook(() =>
      useEditorExport({ editorData: null, fileInfo: null, starPoints: [] }),
    );
    act(() => result.current.setShowExport(true));
    expect(result.current.showExport).toBe(true);
    act(() => result.current.setShowExport(false));
    expect(result.current.showExport).toBe(false);
  });

  it("setExportFormat changes the format", () => {
    const { result } = renderHook(() =>
      useEditorExport({ editorData: null, fileInfo: null, starPoints: [] }),
    );
    act(() => result.current.setExportFormat("jpeg"));
    expect(result.current.exportFormat).toBe("jpeg");
  });

  it("handleEditorExport calls exportImageDetailed with correct payload", async () => {
    const { result } = renderHook(() =>
      useEditorExport({
        editorData: mockEditorData,
        fileInfo: mockFileInfo,
        starPoints: [],
      }),
    );
    await act(async () => {
      await result.current.handleEditorExport(90);
    });
    expect(mockExportImageDetailed).toHaveBeenCalledTimes(1);
    const payload = mockExportImageDetailed.mock.calls[0][0];
    expect(payload.width).toBe(100);
    expect(payload.height).toBe(100);
    expect(payload.quality).toBe(90);
    expect(payload.filename).toBe("test.fits");
  });

  it("handleEditorExport shows warning when no editor data", async () => {
    const { result } = renderHook(() =>
      useEditorExport({ editorData: null, fileInfo: null, starPoints: [] }),
    );
    await act(async () => {
      await result.current.handleEditorExport(90);
    });
    expect(mockExportImageDetailed).not.toHaveBeenCalled();
  });

  it("handleEditorShare calls shareImage", async () => {
    const { result } = renderHook(() =>
      useEditorExport({
        editorData: mockEditorData,
        fileInfo: mockFileInfo,
        starPoints: [],
      }),
    );
    await act(async () => {
      await result.current.handleEditorShare(80);
    });
    expect(mockShareImage).toHaveBeenCalledTimes(1);
  });

  it("handleEditorSave calls saveImage", async () => {
    const { result } = renderHook(() =>
      useEditorExport({
        editorData: mockEditorData,
        fileInfo: mockFileInfo,
        starPoints: [],
      }),
    );
    await act(async () => {
      await result.current.handleEditorSave(85);
    });
    expect(mockSaveImage).toHaveBeenCalledTimes(1);
  });
});
