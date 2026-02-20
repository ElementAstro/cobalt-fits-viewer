import type { FitsMetadata, GeoLocation } from "../fits/types";

export type MapDateFilterPreset = "all" | "7d" | "30d" | "90d" | "365d";

export interface MapViewport {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

export interface MapBBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapClusterNode {
  id: string;
  isCluster: boolean;
  count: number;
  location: GeoLocation;
  label: string;
  files: FitsMetadata[];
  clusterId?: number;
  expansionZoom?: number;
  earliestTimestamp?: number;
}

export interface MapFilterState {
  dateFilterPreset: MapDateFilterPreset;
  object: string;
  filter: string;
  targetId: string;
  sessionId: string;
}

export type MapClusterActionType = "press-cluster" | "expand-cluster" | "open-cluster";

export interface MapClusterAction {
  type: MapClusterActionType;
  node: MapClusterNode;
  zoom: number;
  expansionZoom?: number;
}
