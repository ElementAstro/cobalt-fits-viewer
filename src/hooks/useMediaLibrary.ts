/**
 * 设备相册集成 Hook
 */

import { useState, useCallback } from "react";
import * as MediaLibrary from "expo-media-library";
import { LOG_TAGS, Logger } from "../lib/logger";

export function useMediaLibrary() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const requestPermission = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    const granted = status === "granted";
    setHasPermission(granted);
    return granted;
  }, []);

  const saveToDevice = useCallback(
    async (fileUri: string): Promise<string | null> => {
      setIsSaving(true);
      try {
        if (hasPermission === null) {
          const granted = await requestPermission();
          if (!granted) return null;
        } else if (!hasPermission) {
          return null;
        }

        const asset = await MediaLibrary.createAssetAsync(fileUri);
        return asset.uri;
      } catch (err) {
        Logger.warn(LOG_TAGS.MediaLibrary, "Failed to save to media library", err);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [hasPermission, requestPermission],
  );

  const getDeviceAlbums = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return [];
    }
    const albums = await MediaLibrary.getAlbumsAsync();
    return albums;
  }, [hasPermission, requestPermission]);

  return {
    hasPermission,
    isSaving,
    requestPermission,
    saveToDevice,
    getDeviceAlbums,
  };
}
