import { act, renderHook } from "@testing-library/react-native";
import * as MediaLibrary from "expo-media-library";
import { useMediaLibrary } from "../useMediaLibrary";

jest.mock("expo-media-library", () => ({
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn(),
  getAlbumsAsync: jest.fn(),
}));

jest.mock("../../lib/logger", () => {
  const actual = jest.requireActual("../../lib/logger") as typeof import("../../lib/logger");
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

const requestPermissionsAsyncMock = MediaLibrary.requestPermissionsAsync as jest.Mock;
const createAssetAsyncMock = MediaLibrary.createAssetAsync as jest.Mock;
const getAlbumsAsyncMock = MediaLibrary.getAlbumsAsync as jest.Mock;

describe("useMediaLibrary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requestPermissionsAsyncMock.mockResolvedValue({ status: "granted" });
    createAssetAsyncMock.mockResolvedValue({ uri: "asset://saved" });
    getAlbumsAsyncMock.mockResolvedValue([{ id: "a1", title: "Camera" }]);
  });

  it("requests permission and updates state", async () => {
    const { result } = renderHook(() => useMediaLibrary());

    await act(async () => {
      const granted = await result.current.requestPermission();
      expect(granted).toBe(true);
    });

    expect(result.current.hasPermission).toBe(true);
  });

  it("saveToDevice requests permission when unknown", async () => {
    const { result } = renderHook(() => useMediaLibrary());

    await act(async () => {
      const uri = await result.current.saveToDevice("file:///tmp/image.png");
      expect(uri).toBe("asset://saved");
    });

    expect(requestPermissionsAsyncMock).toHaveBeenCalledTimes(1);
    expect(createAssetAsyncMock).toHaveBeenCalledWith("file:///tmp/image.png");
    expect(result.current.isSaving).toBe(false);
  });

  it("saveToDevice returns null when permission denied", async () => {
    requestPermissionsAsyncMock.mockResolvedValue({ status: "denied" });
    const { result } = renderHook(() => useMediaLibrary());

    await act(async () => {
      const uri = await result.current.saveToDevice("file:///tmp/image.png");
      expect(uri).toBeNull();
    });

    expect(createAssetAsyncMock).not.toHaveBeenCalled();
  });

  it("getDeviceAlbums gates on permission", async () => {
    requestPermissionsAsyncMock.mockResolvedValue({ status: "denied" });
    const { result } = renderHook(() => useMediaLibrary());

    await act(async () => {
      const albums = await result.current.getDeviceAlbums();
      expect(albums).toEqual([]);
    });

    requestPermissionsAsyncMock.mockResolvedValue({ status: "granted" });
    await act(async () => {
      await result.current.requestPermission();
      const albums = await result.current.getDeviceAlbums();
      expect(albums).toEqual([{ id: "a1", title: "Camera" }]);
    });
  });

  it("returns null when createAssetAsync fails", async () => {
    createAssetAsyncMock.mockRejectedValue(new Error("save failed"));
    const { result } = renderHook(() => useMediaLibrary());

    await act(async () => {
      const uri = await result.current.saveToDevice("file:///tmp/image.png");
      expect(uri).toBeNull();
    });
  });
});
