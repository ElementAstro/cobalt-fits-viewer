import Supercluster from "supercluster";
import type { FitsMetadata, GeoLocation } from "../fits/types";
import { computeInitialCamera, normalizeGeoLocation, buildMapBBoxes } from "./geo";
import type { MapClusterNode, MapViewport } from "./types";

interface PointProperties extends Supercluster.AnyProps {
  fileIndex: number;
  fileCount: number;
  earliestTimestamp: number;
  placeName?: string;
  city?: string;
  region?: string;
  country?: string;
}

interface ClusterProperties extends Supercluster.AnyProps {
  fileCount: number;
  earliestTimestamp: number;
  placeName?: string;
  city?: string;
  region?: string;
  country?: string;
}

function getFileTimestamp(file: FitsMetadata): number {
  if (file.dateObs) {
    const parsed = new Date(file.dateObs).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return file.importDate;
}

function getNodeLabel(location: GeoLocation, count: number): string {
  const base =
    location.placeName ??
    location.city ??
    `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
  return count > 1 ? `${base} (${count})` : base;
}

export interface SuperclusterMapIndex {
  getClustersByViewport: (viewport: MapViewport) => MapClusterNode[];
  getLeaves: (clusterId: number, limit?: number, offset?: number) => FitsMetadata[];
  getExpansionZoom: (clusterId: number) => number;
  getInitialCamera: () => {
    coordinates: { latitude: number; longitude: number };
    zoom: number;
  } | null;
}

const WORLD_VIEWPORT: MapViewport = {
  west: -180,
  south: -85,
  east: 180,
  north: 85,
  zoom: 2,
};

function featureToNode(
  feature:
    | Supercluster.PointFeature<PointProperties>
    | Supercluster.ClusterFeature<ClusterProperties>,
  files: FitsMetadata[],
  index: Supercluster<PointProperties, ClusterProperties>,
): MapClusterNode | null {
  const [longitude, latitude] = feature.geometry.coordinates;
  const baseLocation = normalizeGeoLocation({
    latitude,
    longitude,
    placeName: feature.properties.placeName,
    city: feature.properties.city,
    region: feature.properties.region,
    country: feature.properties.country,
  });
  if (!baseLocation) return null;

  const isCluster = Boolean((feature.properties as { cluster?: boolean }).cluster);
  if (isCluster) {
    const clusterId = Number((feature.properties as { cluster_id?: number }).cluster_id);
    const pointCount = Number((feature.properties as { point_count?: number }).point_count ?? 0);
    const expansionZoom = index.getClusterExpansionZoom(clusterId);
    const label = getNodeLabel(baseLocation, pointCount);

    return {
      id: `cluster-${clusterId}`,
      isCluster: true,
      count: pointCount,
      location: baseLocation,
      label,
      clusterId,
      expansionZoom,
      files: [],
      earliestTimestamp: feature.properties.earliestTimestamp,
    };
  }

  const fileIndex = feature.properties.fileIndex;
  const file = files[fileIndex];
  if (!file) return null;

  return {
    id: file.id,
    isCluster: false,
    count: 1,
    location: baseLocation,
    label: getNodeLabel(baseLocation, 1),
    files: [file],
    earliestTimestamp: feature.properties.earliestTimestamp,
  };
}

export function buildSuperclusterIndex(files: FitsMetadata[]): SuperclusterMapIndex {
  const indexedFiles: FitsMetadata[] = [];
  const points: Array<Supercluster.PointFeature<PointProperties>> = [];

  for (const file of files) {
    const location = normalizeGeoLocation(file.location);
    if (!location) continue;

    const fileIndex =
      indexedFiles.push(location === file.location ? file : { ...file, location }) - 1;

    points.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [location.longitude, location.latitude],
      },
      properties: {
        fileIndex,
        fileCount: 1,
        earliestTimestamp: getFileTimestamp(file),
        placeName: location.placeName,
        city: location.city,
        region: location.region,
        country: location.country,
      },
    });
  }

  const index = new Supercluster<PointProperties, ClusterProperties>({
    radius: 48,
    maxZoom: 20,
    minZoom: 0,
    map: (props) => ({
      fileCount: props.fileCount,
      earliestTimestamp: props.earliestTimestamp,
      placeName: props.placeName,
      city: props.city,
      region: props.region,
      country: props.country,
    }),
    reduce: (accumulated, props) => {
      accumulated.fileCount += props.fileCount;
      if (props.earliestTimestamp < accumulated.earliestTimestamp) {
        accumulated.earliestTimestamp = props.earliestTimestamp;
      }
      if (!accumulated.placeName && props.placeName) accumulated.placeName = props.placeName;
      if (!accumulated.city && props.city) accumulated.city = props.city;
      if (!accumulated.region && props.region) accumulated.region = props.region;
      if (!accumulated.country && props.country) accumulated.country = props.country;
    },
  });

  index.load(points);

  return {
    getClustersByViewport(viewport) {
      const activeViewport = viewport ?? WORLD_VIEWPORT;
      const zoom = Math.max(0, Math.min(20, Math.floor(activeViewport.zoom)));
      const boxes = buildMapBBoxes({
        west: activeViewport.west,
        south: activeViewport.south,
        east: activeViewport.east,
        north: activeViewport.north,
      });

      const deduped = new Map<string, MapClusterNode>();
      for (const box of boxes) {
        const features = index.getClusters([box.west, box.south, box.east, box.north], zoom);
        for (const feature of features) {
          const node = featureToNode(feature, indexedFiles, index);
          if (!node) continue;
          deduped.set(node.id, node);
        }
      }

      return [...deduped.values()];
    },
    getLeaves(clusterId, limit = Infinity, offset = 0) {
      const leaves = index.getLeaves(clusterId, limit, offset);
      const resolved: FitsMetadata[] = [];
      for (const leaf of leaves) {
        const file = indexedFiles[leaf.properties.fileIndex];
        if (file) resolved.push(file);
      }
      return resolved;
    },
    getExpansionZoom(clusterId) {
      return index.getClusterExpansionZoom(clusterId);
    },
    getInitialCamera() {
      const locations = indexedFiles
        .map((file) => file.location)
        .filter((location): location is GeoLocation => Boolean(location));
      return computeInitialCamera(locations);
    },
  };
}
