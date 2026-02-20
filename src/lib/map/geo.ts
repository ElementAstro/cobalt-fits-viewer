import type { GeoLocation } from "../fits/types";
import type { MapBBox } from "./types";

export function isValidGeoLocation(
  location: GeoLocation | null | undefined,
): location is GeoLocation {
  if (!location) return false;
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

function normalizeLongitude(longitude: number): number {
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  if (wrapped === -180 && longitude > 0) return 180;
  return wrapped;
}

export function normalizeGeoLocation(location: GeoLocation | null | undefined): GeoLocation | null {
  if (!location) return null;
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  if (location.latitude < -90 || location.latitude > 90) return null;

  const normalized: GeoLocation = {
    ...location,
    latitude: location.latitude,
    longitude: normalizeLongitude(location.longitude),
  };
  return isValidGeoLocation(normalized) ? normalized : null;
}

export function buildMapBBoxes(bounds: MapBBox): MapBBox[] {
  if (bounds.west <= bounds.east) {
    return [bounds];
  }

  return [
    {
      west: bounds.west,
      south: bounds.south,
      east: 180,
      north: bounds.north,
    },
    {
      west: -180,
      south: bounds.south,
      east: bounds.east,
      north: bounds.north,
    },
  ];
}

function longitudeSpan(longitudes: number[]): { span: number; center: number } {
  if (longitudes.length === 1) {
    return { span: 0, center: longitudes[0] };
  }

  const normalized = longitudes.map((lng) => normalizeLongitude(lng)).sort((a, b) => a - b);
  let largestGap = -1;
  let gapStart = normalized[0];

  for (let i = 0; i < normalized.length; i++) {
    const current = normalized[i];
    const next = i === normalized.length - 1 ? normalized[0] + 360 : normalized[i + 1];
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      gapStart = current;
    }
  }

  const span = 360 - largestGap;
  const arcStart = normalizeLongitude(gapStart + largestGap);
  const center = normalizeLongitude(arcStart + span / 2);
  return { span, center };
}

export function computeInitialCamera(
  locations: GeoLocation[],
): { coordinates: { latitude: number; longitude: number }; zoom: number } | null {
  if (locations.length === 0) return null;

  if (locations.length === 1) {
    return {
      coordinates: {
        latitude: locations[0].latitude,
        longitude: locations[0].longitude,
      },
      zoom: 10,
    };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  const longitudes: number[] = [];
  for (const location of locations) {
    if (location.latitude < minLat) minLat = location.latitude;
    if (location.latitude > maxLat) maxLat = location.latitude;
    longitudes.push(location.longitude);
  }

  const latSpan = maxLat - minLat;
  const { span: lngSpan, center: lngCenter } = longitudeSpan(longitudes);
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

  return {
    coordinates: {
      latitude: (minLat + maxLat) / 2,
      longitude: lngCenter,
    },
    zoom: Math.max(1, zoom - 1),
  };
}
