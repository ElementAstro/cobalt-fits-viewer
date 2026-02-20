import type {
  ProcessingAlgorithmProfile,
  ProcessingNode,
  ProcessingPipelineSnapshot,
} from "../fits/types";

export const PROCESSING_SNAPSHOT_VERSION = 2;

function cloneNode(node: ProcessingNode): ProcessingNode {
  return {
    id: node.id,
    operationId: node.operationId,
    enabled: node.enabled !== false,
    params: { ...node.params },
  };
}

function normalizeNodes(nodes: ProcessingNode[] | undefined): ProcessingNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map(cloneNode);
}

export function normalizeProcessingPipelineSnapshot(
  snapshot: ProcessingPipelineSnapshot | null | undefined,
  fallbackProfile: ProcessingAlgorithmProfile = "standard",
): ProcessingPipelineSnapshot {
  if (!snapshot) {
    return {
      version: PROCESSING_SNAPSHOT_VERSION,
      savedAt: Date.now(),
      profile: fallbackProfile,
      scientificNodes: [],
      colorNodes: [],
    };
  }

  const legacyNodes = normalizeNodes(snapshot.nodes);
  const scientificNodes = normalizeNodes(snapshot.scientificNodes);
  const colorNodes = normalizeNodes(snapshot.colorNodes);
  const profile =
    snapshot.profile ??
    (legacyNodes.length > 0 && scientificNodes.length === 0 ? "legacy" : fallbackProfile);

  return {
    version:
      typeof snapshot.version === "number" && Number.isFinite(snapshot.version)
        ? snapshot.version
        : PROCESSING_SNAPSHOT_VERSION,
    savedAt:
      typeof snapshot.savedAt === "number" && Number.isFinite(snapshot.savedAt)
        ? snapshot.savedAt
        : Date.now(),
    profile,
    scientificNodes: scientificNodes.length > 0 ? scientificNodes : legacyNodes,
    colorNodes,
    ...(legacyNodes.length > 0 && scientificNodes.length === 0 ? { nodes: legacyNodes } : {}),
  };
}

export function createProcessingPipelineSnapshot(params: {
  profile: ProcessingAlgorithmProfile;
  scientificNodes: ProcessingNode[];
  colorNodes: ProcessingNode[];
  savedAt?: number;
  version?: number;
}): ProcessingPipelineSnapshot {
  return {
    version: params.version ?? PROCESSING_SNAPSHOT_VERSION,
    savedAt: params.savedAt ?? Date.now(),
    profile: params.profile,
    scientificNodes: normalizeNodes(params.scientificNodes),
    colorNodes: normalizeNodes(params.colorNodes),
  };
}
