/**
 * 地图覆盖层工具 - 生成跨平台兼容的 polylines 和 circles
 *
 * Apple Maps polyline: { id, coordinates, color, width, contourStyle }
 * Google Maps polyline: { id, coordinates, color, width, geodesic }
 * 两平台 circle 格式一致: { id, center, radius, color, lineColor, lineWidth }
 */

import { Platform } from "react-native";
import type { LocationCluster } from "./clustering";

/**
 * 生成观测点之间的连线（按时间顺序连接）
 * 自动适配 Apple Maps (contourStyle) 和 Google Maps (geodesic) 的大圆线属性
 */
export function buildClusterPolylines(
  clusters: LocationCluster[],
  color: string = "#4FC3F7",
  width: number = 2,
) {
  if (clusters.length < 2) return [];

  // 按最早文件日期排序
  const sorted = [...clusters].sort((a, b) => {
    const dateA = getEarliestDate(a);
    const dateB = getEarliestDate(b);
    return dateA - dateB;
  });

  const coordinates = sorted.map((c) => ({
    latitude: c.location.latitude,
    longitude: c.location.longitude,
  }));

  const base = { id: "observation-route", coordinates, color, width };

  // Apple Maps 使用 contourStyle，Google Maps 使用 geodesic
  if (Platform.OS === "ios") {
    return [{ ...base, contourStyle: "GEODESIC" }];
  }
  return [{ ...base, geodesic: true }];
}

/**
 * 生成观测点范围圈（基于文件数量调整半径）
 * 两平台格式一致，但 color 使用不带 alpha 的纯色 + 透明 lineColor
 */
export function buildClusterCircles(
  clusters: LocationCluster[],
  color: string = "rgba(79,195,247,0.13)",
  lineColor: string = "#4FC3F7",
  lineWidth: number = 1,
) {
  return clusters.map((c) => {
    // 半径基于文件数量：1 文件 = 5km，每增加 1 文件增加 2km，上限 50km
    const radius = Math.min(5000 + Math.max(0, c.files.length - 1) * 2000, 50000);
    return {
      id: `circle-${c.id}`,
      center: {
        latitude: c.location.latitude,
        longitude: c.location.longitude,
      },
      radius,
      color,
      lineColor,
      lineWidth,
    };
  });
}

function getEarliestDate(cluster: LocationCluster): number {
  let earliest = Infinity;
  for (const f of cluster.files) {
    if (f.dateObs) {
      const ts = new Date(f.dateObs).getTime();
      if (Number.isFinite(ts) && ts < earliest) {
        earliest = ts;
        continue;
      }
    }
    if (f.importDate < earliest) {
      earliest = f.importDate;
    }
  }
  return earliest === Infinity ? 0 : earliest;
}
