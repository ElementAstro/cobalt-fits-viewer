/**
 * 地图样式预设系统
 * - Google Maps: JSON 自定义样式
 * - Apple Maps: 原生属性组合
 */

// ===== Google Maps 天文暗色主题 =====
// 基于 https://mapstyle.withgoogle.com/ 生成，优化天文观测场景：
// - 深色背景减少光污染干扰
// - 弱化道路和商业标签
// - 保留地形和水域轮廓
export const GOOGLE_DARK_ASTRONOMY_STYLE = JSON.stringify([
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  {
    featureType: "administrative.country",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4b6878" }],
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [{ color: "#4b6878" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [{ color: "#334e87" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#023e58" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#283d6a" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6f9ba5" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }],
  },
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry.fill",
    stylers: [{ color: "#023e58" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3C7680" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#304a7d" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#2c6675" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#255763" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#b0d5ce" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#023e58" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#98a5be" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1d2c4d" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry.fill",
    stylers: [{ color: "#283d6a" }],
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#3a4762" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0e1626" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4e6d70" }],
  },
]);

// ===== 地图样式预设 =====

export type MapPreset = "standard" | "dark" | "satellite" | "terrain3d";

export interface MapPresetConfig {
  // 通用
  label: string;
  icon: string;

  // Apple Maps
  appleMapType: string; // STANDARD | HYBRID | IMAGERY
  appleElevation: string; // AUTOMATIC | FLAT | REALISTIC
  appleEmphasis: string; // AUTOMATIC | MUTED

  // Google Maps
  googleMapType: string; // NORMAL | HYBRID | SATELLITE | TERRAIN
  googleColorScheme: string; // LIGHT | DARK | FOLLOW_SYSTEM
  googleStyleJson: string | null;
}

export const MAP_PRESETS: Record<MapPreset, MapPresetConfig> = {
  standard: {
    label: "location.presetStandard",
    icon: "map-outline",
    appleMapType: "STANDARD",
    appleElevation: "FLAT",
    appleEmphasis: "AUTOMATIC",
    googleMapType: "NORMAL",
    googleColorScheme: "FOLLOW_SYSTEM",
    googleStyleJson: null,
  },
  dark: {
    label: "location.presetDark",
    icon: "moon-outline",
    appleMapType: "STANDARD",
    appleElevation: "FLAT",
    appleEmphasis: "MUTED",
    googleMapType: "NORMAL",
    googleColorScheme: "DARK",
    googleStyleJson: GOOGLE_DARK_ASTRONOMY_STYLE,
  },
  satellite: {
    label: "location.presetSatellite",
    icon: "earth-outline",
    appleMapType: "IMAGERY",
    appleElevation: "FLAT",
    appleEmphasis: "AUTOMATIC",
    googleMapType: "SATELLITE",
    googleColorScheme: "FOLLOW_SYSTEM",
    googleStyleJson: null,
  },
  terrain3d: {
    label: "location.preset3D",
    icon: "cube-outline",
    appleMapType: "STANDARD",
    appleElevation: "REALISTIC",
    appleEmphasis: "AUTOMATIC",
    googleMapType: "TERRAIN",
    googleColorScheme: "FOLLOW_SYSTEM",
    googleStyleJson: null,
  },
};

export const MAP_PRESET_ORDER: MapPreset[] = ["standard", "dark", "satellite", "terrain3d"];

// ===== Apple Maps POI 过滤 =====
// 天文相关 POI: PLANETARIUM, NATIONAL_PARK, PARK, CAMPGROUND
export const ASTRONOMY_POI_CATEGORIES = [
  "PLANETARIUM",
  "NATIONAL_PARK",
  "PARK",
  "CAMPGROUND",
  "UNIVERSITY",
  "MUSEUM",
] as const;
