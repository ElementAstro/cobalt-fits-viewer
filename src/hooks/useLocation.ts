/**
 * 定位 Hook - 获取 GPS 位置与反向地理编码
 */

import { useState, useCallback, useRef } from "react";
import * as Location from "expo-location";
import type { GeoLocation } from "../lib/fits/types";
import { Logger } from "../lib/logger";

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 分钟缓存

interface LocationState {
  location: GeoLocation | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean | null;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    location: null,
    loading: false,
    error: null,
    permissionGranted: null,
  });

  const cacheRef = useRef<{ location: GeoLocation; timestamp: number } | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      setState((prev) => ({ ...prev, permissionGranted: granted }));
      Logger.info("Location", `Permission request: ${status}`);
      return granted;
    } catch (e) {
      Logger.error("Location", "Failed to request location permission", e);
      setState((prev) => ({
        ...prev,
        permissionGranted: false,
        error: "Failed to request location permission",
      }));
      return false;
    }
  }, []);

  const checkPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === "granted";
      setState((prev) => ({ ...prev, permissionGranted: granted }));
      return granted;
    } catch {
      return false;
    }
  }, []);

  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number): Promise<Partial<GeoLocation>> => {
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (results.length > 0) {
          const place = results[0];
          return {
            placeName: place.name ?? undefined,
            city: place.city ?? undefined,
            region: place.region ?? undefined,
            country: place.country ?? undefined,
          };
        }
      } catch {
        // 反向地理编码失败不影响位置获取
      }
      return {};
    },
    [],
  );

  const getCurrentLocation = useCallback(async (): Promise<GeoLocation | null> => {
    // 检查缓存
    if (cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_DURATION_MS) {
      setState((prev) => ({
        ...prev,
        location: cacheRef.current!.location,
        error: null,
      }));
      return cacheRef.current.location;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const hasPermission = await checkPermission();
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Location permission denied",
          }));
          return null;
        }
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude, altitude } = position.coords;

      const placeInfo = await reverseGeocode(latitude, longitude);

      const geoLocation: GeoLocation = {
        latitude,
        longitude,
        altitude: altitude ?? undefined,
        ...placeInfo,
      };

      cacheRef.current = { location: geoLocation, timestamp: Date.now() };

      setState({
        location: geoLocation,
        loading: false,
        error: null,
        permissionGranted: true,
      });

      Logger.info("Location", "Location acquired", {
        lat: latitude.toFixed(4),
        lon: longitude.toFixed(4),
        place: placeInfo.placeName ?? placeInfo.city,
      });

      return geoLocation;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get location";
      Logger.warn("Location", "Failed to get location", err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
      return null;
    }
  }, [checkPermission, requestPermission, reverseGeocode]);

  const getLastKnownLocation = useCallback(async (): Promise<GeoLocation | null> => {
    try {
      const hasPermission = await checkPermission();
      if (!hasPermission) return null;

      const position = await Location.getLastKnownPositionAsync();
      if (!position) return null;

      const { latitude, longitude, altitude } = position.coords;
      const placeInfo = await reverseGeocode(latitude, longitude);

      return {
        latitude,
        longitude,
        altitude: altitude ?? undefined,
        ...placeInfo,
      };
    } catch {
      return null;
    }
  }, [checkPermission, reverseGeocode]);

  const clearCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  const formatLocation = useCallback((loc: GeoLocation | undefined | null): string => {
    if (!loc) return "";
    if (loc.placeName) return loc.placeName;
    if (loc.city) return loc.city;
    if (loc.region) return loc.region;
    return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
  }, []);

  return {
    ...state,
    requestPermission,
    checkPermission,
    getCurrentLocation,
    getLastKnownLocation,
    reverseGeocode,
    clearCache,
    formatLocation,
  };
}
