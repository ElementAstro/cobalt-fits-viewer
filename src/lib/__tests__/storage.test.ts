const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

function loadStorageAdapter() {
  jest.resetModules();
  jest.doMock("@react-native-async-storage/async-storage", () => ({
    __esModule: true,
    default: mockAsyncStorage,
  }));

  return require("../storage").zustandMMKVStorage as {
    getItem: (name: string) => Promise<string | null>;
    setItem: (name: string, value: string) => Promise<void>;
    removeItem: (name: string) => Promise<void>;
  };
}

describe("storage adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when key is missing", async () => {
    const storage = loadStorageAdapter();
    mockAsyncStorage.getItem.mockResolvedValueOnce(undefined);
    await expect(storage.getItem("k1")).resolves.toBeNull();
  });

  it("gets, sets, and removes values", async () => {
    const storage = loadStorageAdapter();
    mockAsyncStorage.getItem.mockResolvedValueOnce('{"a":1}');
    await expect(storage.getItem("k2")).resolves.toBe('{"a":1}');

    await expect(storage.setItem("k2", "v2")).resolves.toBeUndefined();
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith("k2", "v2");

    await expect(storage.removeItem("k2")).resolves.toBeUndefined();
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("k2");
  });
});
