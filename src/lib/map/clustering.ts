/**
 * 地图聚类工具 - 基于地理距离的空间聚类
 */

import type { GeoLocation, FitsMetadata } from "../fits/types";

export interface LocationCluster {
  id: string;
  location: GeoLocation;
  files: FitsMetadata[];
  label: string;
}

/**
 * 计算两个坐标之间的 Haversine 距离 (km)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 基于地理距离的空间聚类
 * 将距离小于 radiusKm 的观测点聚合为一个 cluster
 */
export function clusterByDistance(files: FitsMetadata[], radiusKm: number = 50): LocationCluster[] {
  const geoFiles = files.filter((f) => f.location);
  if (geoFiles.length === 0) return [];

  const visited = new Set<number>();
  const clusters: LocationCluster[] = [];

  for (let i = 0; i < geoFiles.length; i++) {
    if (visited.has(i)) continue;

    // Transitive clustering: if A is close to B, and B is close to C, all merge into one cluster.
    const queue: number[] = [i];
    const clusterIndexes: number[] = [];
    visited.add(i);

    while (queue.length > 0) {
      const currentIndex = queue.shift();
      if (currentIndex === undefined) break;

      clusterIndexes.push(currentIndex);
      const currentLoc = geoFiles[currentIndex].location!;

      for (let j = 0; j < geoFiles.length; j++) {
        if (visited.has(j)) continue;
        const candidateLoc = geoFiles[j].location!;
        const dist = haversineDistance(
          currentLoc.latitude,
          currentLoc.longitude,
          candidateLoc.latitude,
          candidateLoc.longitude,
        );
        if (dist <= radiusKm) {
          visited.add(j);
          queue.push(j);
        }
      }
    }

    const clusterFiles = clusterIndexes.map((idx) => geoFiles[idx]);
    const anchor = clusterFiles[0].location!;

    // Use the best available name for the cluster
    const bestLoc =
      clusterFiles.find((f) => f.location?.placeName || f.location?.city)?.location ?? anchor;
    const name =
      bestLoc.placeName ??
      bestLoc.city ??
      `${anchor.latitude.toFixed(2)}, ${anchor.longitude.toFixed(2)}`;

    // Compute centroid
    const centroid = computeCentroid(clusterFiles.map((f) => f.location!));

    clusters.push({
      id: `cluster-${clusters.length}`,
      location: { ...bestLoc, latitude: centroid.latitude, longitude: centroid.longitude },
      files: clusterFiles,
      label: `${name} (${clusterFiles.length})`,
    });
  }

  return clusters;
}

/**
 * 计算坐标集合的质心
 */
function computeCentroid(locations: GeoLocation[]): { latitude: number; longitude: number } {
  const n = locations.length;
  const sumLat = locations.reduce((s, l) => s + l.latitude, 0);
  const sumLng = locations.reduce((s, l) => s + l.longitude, 0);
  return { latitude: sumLat / n, longitude: sumLng / n };
}

/**
 * 计算所有 cluster 的中心点
 */
export function computeCenter(
  clusters: LocationCluster[],
): { latitude: number; longitude: number } | null {
  if (clusters.length === 0) return null;
  return computeCentroid(clusters.map((c) => c.location));
}

/**
 * 根据标记点分布计算最佳 bounding box 和缩放级别
 */
export function computeBounds(clusters: LocationCluster[]): {
  center: { latitude: number; longitude: number };
  zoom: number;
} | null {
  if (clusters.length === 0) return null;

  if (clusters.length === 1) {
    return {
      center: {
        latitude: clusters[0].location.latitude,
        longitude: clusters[0].location.longitude,
      },
      zoom: 12,
    };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const c of clusters) {
    const { latitude, longitude } = c.location;
    if (latitude < minLat) minLat = latitude;
    if (latitude > maxLat) maxLat = latitude;
    if (longitude < minLng) minLng = longitude;
    if (longitude > maxLng) maxLng = longitude;
  }

  const center = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
  };

  // Estimate zoom level from bounding box span
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const maxSpan = Math.max(latSpan, lngSpan);

  let zoom: number;
  if (maxSpan > 180) zoom = 1;
  else if (maxSpan > 90) zoom = 2;
  else if (maxSpan > 45) zoom = 3;
  else if (maxSpan > 22) zoom = 4;
  else if (maxSpan > 11) zoom = 5;
  else if (maxSpan > 5) zoom = 6;
  else if (maxSpan > 2.5) zoom = 7;
  else if (maxSpan > 1) zoom = 8;
  else if (maxSpan > 0.5) zoom = 9;
  else if (maxSpan > 0.25) zoom = 10;
  else if (maxSpan > 0.1) zoom = 11;
  else zoom = 12;

  // Add a little padding
  zoom = Math.max(1, zoom - 1);

  return { center, zoom };
}
