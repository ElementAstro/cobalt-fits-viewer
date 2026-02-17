import { renderHook } from "@testing-library/react-native";
import { useSkImage } from "../useSkImage";

const mockFromBytes = jest.fn();
const mockMakeImage = jest.fn();

jest.mock("@shopify/react-native-skia", () => ({
  AlphaType: { Unpremul: "Unpremul" },
  ColorType: { RGBA_8888: "RGBA_8888" },
  Skia: {
    Data: { fromBytes: (...args: unknown[]) => mockFromBytes(...args) },
    Image: { MakeImage: (...args: unknown[]) => mockMakeImage(...args) },
  },
}));

describe("useSkImage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromBytes.mockReturnValue("data");
    mockMakeImage.mockReturnValue({ id: "img" });
  });

  it("returns null when input data is invalid", () => {
    const rgba = new Uint8ClampedArray([1, 2, 3, 4]);
    const { result: noData } = renderHook(() => useSkImage(null, 10, 10));
    const { result: badWidth } = renderHook(() => useSkImage(rgba, 0, 10));

    expect(noData.current).toBeNull();
    expect(badWidth.current).toBeNull();
    expect(mockMakeImage).not.toHaveBeenCalled();
  });

  it("creates image when input is valid", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const { result } = renderHook(() => useSkImage(rgba, 1, 1));

    expect(mockFromBytes).toHaveBeenCalled();
    expect(mockMakeImage).toHaveBeenCalled();
    expect(result.current).toEqual({ id: "img" });
  });

  it("returns null when skia throws", () => {
    mockFromBytes.mockImplementation(() => {
      throw new Error("boom");
    });
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const { result } = renderHook(() => useSkImage(rgba, 1, 1));

    expect(result.current).toBeNull();
  });
});
