import type { MapViewport } from "./types";

export const MAX_LATITUDE = 85.05112878;

export type CameraEvent = {
  coordinates: { latitude?: number; longitude?: number };
  zoom: number;
};

export function longitudeToWorldX(longitude: number, worldSize: number): number {
  return ((longitude + 180) / 360) * worldSize;
}

export function latitudeToWorldY(latitude: number, worldSize: number): number {
  const lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude));
  const sin = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize;
}

export function worldXToLongitude(x: number, worldSize: number): number {
  return (x / worldSize) * 360 - 180;
}

export function worldYToLatitude(y: number, worldSize: number): number {
  const n = Math.PI - (2 * Math.PI * y) / worldSize;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function cameraToViewport(
  camera: CameraEvent,
  size: { width: number; height: number },
): MapViewport {
  if (camera.coordinates.latitude === undefined || camera.coordinates.longitude === undefined) {
    return {
      west: -180,
      south: -85,
      east: 180,
      north: 85,
      zoom: Math.max(0, Math.min(20, camera.zoom)),
    };
  }

  const zoom = Math.max(0, Math.min(20, camera.zoom));
  const worldSize = 256 * 2 ** zoom;
  const centerX = longitudeToWorldX(camera.coordinates.longitude, worldSize);
  const centerY = latitudeToWorldY(camera.coordinates.latitude, worldSize);

  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;

  const west = worldXToLongitude(centerX - halfWidth, worldSize);
  const east = worldXToLongitude(centerX + halfWidth, worldSize);
  const north = worldYToLatitude(centerY - halfHeight, worldSize);
  const south = worldYToLatitude(centerY + halfHeight, worldSize);

  return {
    west,
    east,
    north: Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, north)),
    south: Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, south)),
    zoom,
  };
}
