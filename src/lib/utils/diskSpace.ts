import * as FileSystem from "expo-file-system";

export async function getFreeDiskBytes(): Promise<number | null> {
  try {
    const info = await FileSystem.getFreeDiskStorageAsync();
    return typeof info === "number" ? info : null;
  } catch {
    return null;
  }
}
