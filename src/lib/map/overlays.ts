/**
 * 地图覆盖层工具 - 生成跨平台兼容的 polylines 和 circles
 *
 * Apple Maps polyline: { id, coordinates, color, width, contourStyle }
 * Google Maps polyline: { id, coordinates, color, width, geodesic }
 * 两平台 circle 格式一致: { id, center, radius, color, lineColor, lineWidth }
 */

import { Platform } from "react-native";
import type { MapClusterNode } from "./types";

/**
 * 生成观测点之间的连线（按时间顺序连接）
 * 自动适配 Apple Maps (contourStyle) 和 Google Maps (geodesic) 的大圆线属性
 */
export function buildClusterPolylines(
  clusters: MapClusterNode[],
  color: string = "#4FC3F7",
  width: number = 2,
) {
  if (clusters.length < 2) return [];

  const sorted = [...clusters].sort((a, b) => getEarliestDate(a) - getEarliestDate(b));
  const coordinates = sorted.map((cluster) => ({
    latitude: cluster.location.latitude,
    longitude: cluster.location.longitude,
  }));

  const base = { id: "observation-route", coordinates, color, width };
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
  clusters: MapClusterNode[],
  color: string = "rgba(79,195,247,0.13)",
  lineColor: string = "#4FC3F7",
  lineWidth: number = 1,
) {
  return clusters.map((cluster) => {
    const radius = Math.min(5000 + Math.max(0, cluster.count - 1) * 2000, 50000);
    return {
      id: `circle-${cluster.id}`,
      center: {
        latitude: cluster.location.latitude,
        longitude: cluster.location.longitude,
      },
      radius,
      color,
      lineColor,
      lineWidth,
    };
  });
}

function getEarliestDate(cluster: MapClusterNode): number {
  if (Number.isFinite(cluster.earliestTimestamp)) {
    return cluster.earliestTimestamp ?? 0;
  }

  let earliest = Infinity;
  for (const file of cluster.files) {
    if (file.dateObs) {
      const parsed = new Date(file.dateObs).getTime();
      if (Number.isFinite(parsed) && parsed < earliest) {
        earliest = parsed;
        continue;
      }
    }
    if (file.importDate < earliest) earliest = file.importDate;
  }

  return earliest === Infinity ? 0 : earliest;
}
