import * as FileSystem from "expo-file-system";

jest.mock("expo-file-system", () => ({
  getFreeDiskStorageAsync: jest.fn(),
}));

const mockGetFree = FileSystem.getFreeDiskStorageAsync as jest.Mock;

import { getFreeDiskBytes } from "../diskSpace";

describe("getFreeDiskBytes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns numeric value from expo-file-system", async () => {
    mockGetFree.mockResolvedValue(1024 * 1024 * 500);

    const result = await getFreeDiskBytes();
    expect(result).toBe(524288000);
  });

  it("returns null when getFreeDiskStorageAsync returns non-number", async () => {
    mockGetFree.mockResolvedValue("not a number");

    const result = await getFreeDiskBytes();
    expect(result).toBeNull();
  });

  it("returns null when getFreeDiskStorageAsync returns undefined", async () => {
    mockGetFree.mockResolvedValue(undefined);

    const result = await getFreeDiskBytes();
    expect(result).toBeNull();
  });

  it("returns null when getFreeDiskStorageAsync throws", async () => {
    mockGetFree.mockRejectedValue(new Error("Permission denied"));

    const result = await getFreeDiskBytes();
    expect(result).toBeNull();
  });

  it("returns 0 when disk reports 0 free bytes", async () => {
    mockGetFree.mockResolvedValue(0);

    const result = await getFreeDiskBytes();
    expect(result).toBe(0);
  });
});
