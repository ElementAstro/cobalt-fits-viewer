/**
 * 定位服务 - GPS 位置获取、反向地理编码、权限管理
 *
 * 提供两种使用方式:
 * 1. LocationService 静态方法 — 供非组件代码（如 useFileManager）调用
 * 2. useLocation Hook — 供 React 组件使用，带响应式 state
 */

import { useState, useCallback, useEffect } from "react";
import * as Location from "expo-location";
import type { GeoLocation } from "../lib/fits/types";
import { Logger } from "../lib/logger";

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 分钟缓存

// ===== 模块级单例缓存 — 跨组件/跨调用共享 =====
let globalCache: { location: GeoLocation; timestamp: number } | null = null;

// ===== LocationService: 静态方法，可在任意上下文调用 =====
export const LocationService = {
  /**
   * 检查前台定位权限（不弹窗）
   */
  async checkPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === "granted";
    } catch {
      return false;
    }
  },

  /**
   * 请求前台定位权限（弹窗）
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      Logger.info("Location", `Permission request: ${status}`);
      return status === "granted";
    } catch (e) {
      Logger.error("Location", "Failed to request location permission", e);
      return false;
    }
  },

  /**
   * 确保拥有前台定位权限：先 check，未授权则 request
   */
  async ensurePermission(): Promise<boolean> {
    const has = await LocationService.checkPermission();
    if (has) return true;
    return LocationService.requestPermission();
  },

  /**
   * 反向地理编码
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<Partial<GeoLocation>> {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
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

  /**
   * 获取当前位置（带缓存 + 权限自动申请 + 反向地理编码）
   */
  async getCurrentLocation(): Promise<GeoLocation | null> {
    // 检查缓存
    if (globalCache && Date.now() - globalCache.timestamp < CACHE_DURATION_MS) {
      return globalCache.location;
    }

    try {
      const permitted = await LocationService.ensurePermission();
      if (!permitted) return null;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude, altitude } = position.coords;
      const placeInfo = await LocationService.reverseGeocode(latitude, longitude);

      const geoLocation: GeoLocation = {
        latitude,
        longitude,
        altitude: altitude ?? undefined,
        ...placeInfo,
      };

      globalCache = { location: geoLocation, timestamp: Date.now() };

      Logger.info("Location", "Location acquired", {
        lat: latitude.toFixed(4),
        lon: longitude.toFixed(4),
        place: placeInfo.placeName ?? placeInfo.city,
      });

      return geoLocation;
    } catch (err) {
      Logger.warn("Location", "Failed to get location", err);
      return null;
    }
  },

  /**
   * 获取上次已知位置（不触发 GPS，静默）
   */
  async getLastKnownLocation(): Promise<GeoLocation | null> {
    try {
      const has = await LocationService.checkPermission();
      if (!has) return null;

      const position = await Location.getLastKnownPositionAsync();
      if (!position) return null;

      const { latitude, longitude, altitude } = position.coords;
      const placeInfo = await LocationService.reverseGeocode(latitude, longitude);

      return {
        latitude,
        longitude,
        altitude: altitude ?? undefined,
        ...placeInfo,
      };
    } catch {
      return null;
    }
  },

  clearCache() {
    globalCache = null;
  },

  formatLocation(loc: GeoLocation | undefined | null): string {
    if (!loc) return "";
    if (loc.placeName) return loc.placeName;
    if (loc.city) return loc.city;
    if (loc.region) return loc.region;
    return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
  },
};

// ===== useLocation Hook: 供 React 组件使用 =====
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

  // 组件挂载时自动检查权限状态
  useEffect(() => {
    LocationService.checkPermission().then((granted) => {
      setState((prev) => ({ ...prev, permissionGranted: granted }));
    });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await LocationService.requestPermission();
    setState((prev) => ({ ...prev, permissionGranted: granted }));
    return granted;
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<GeoLocation | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const loc = await LocationService.getCurrentLocation();
      if (!loc) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Location permission denied or unavailable",
        }));
        return null;
      }
      setState({
        location: loc,
        loading: false,
        error: null,
        permissionGranted: true,
      });
      return loc;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get location";
      setState((prev) => ({ ...prev, loading: false, error: message }));
      return null;
    }
  }, []);

  const getLastKnownLocation = useCallback(async (): Promise<GeoLocation | null> => {
    return LocationService.getLastKnownLocation();
  }, []);

  return {
    ...state,
    requestPermission,
    checkPermission: LocationService.checkPermission,
    getCurrentLocation,
    getLastKnownLocation,
    reverseGeocode: LocationService.reverseGeocode,
    clearCache: LocationService.clearCache,
    formatLocation: LocationService.formatLocation,
  };
}
