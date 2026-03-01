import { getMarkerColor } from "./styles";
import type { MapClusterNode } from "./types";

export function buildGoogleMarkers(nodes: MapClusterNode[]) {
  return nodes.map((node) => ({
    id: node.id,
    coordinates: {
      latitude: node.location.latitude,
      longitude: node.location.longitude,
    },
    title: node.label,
    color: getMarkerColor(node.count, node.isCluster),
  }));
}

export function buildAppleAnnotations(nodes: MapClusterNode[]) {
  return nodes.map((node) => ({
    id: node.id,
    coordinates: {
      latitude: node.location.latitude,
      longitude: node.location.longitude,
    },
    title: node.label,
    text: String(node.count),
    backgroundColor: getMarkerColor(node.count, node.isCluster),
    textColor: "#FFFFFF",
  }));
}
