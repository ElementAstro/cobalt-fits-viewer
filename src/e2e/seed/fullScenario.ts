import type { AstrometryJob } from "../../lib/astrometry/types";
import type {
  Album,
  FitsMetadata,
  ObservationLogEntry,
  ObservationSession,
  Target,
  TargetGroup,
  FileGroup,
} from "../../lib/fits/types";
import type { ProviderConnectionState } from "../../lib/backup/types";

const NOW = 1_730_000_000_000;

export const E2E_FILE_IDS = {
  fits1: "fits-001",
  fits2: "fits-002",
  fits3: "fits-003",
  video1: "video-001",
} as const;

export const E2E_IDS = {
  album: "album-001",
  target: "target-001",
  targetGroup: "target-group-001",
  session: "session-001",
  astrometryJob: "astro-001",
  fileGroup: "file-group-001",
} as const;

export const E2E_FILES: FitsMetadata[] = [
  {
    id: E2E_FILE_IDS.fits1,
    filename: "M42_Light_001.fits",
    filepath: "file:///e2e/M42_Light_001.fits",
    fileSize: 1024 * 1024,
    importDate: NOW - 86_400_000,
    frameType: "light",
    isFavorite: true,
    tags: ["e2e", "nebula"],
    albumIds: [E2E_IDS.album],
    sourceType: "fits",
    sourceFormat: "fits",
    mediaKind: "image",
    object: "M42",
    filter: "Ha",
    exptime: 300,
    targetId: E2E_IDS.target,
    sessionId: E2E_IDS.session,
    editorRecipe: {
      version: 2,
      savedAt: NOW - 80_000_000,
      profile: "standard",
      scientificNodes: [
        {
          id: "recipe-node-1",
          operationId: "dbe",
          enabled: true,
          params: { samplesX: 12, samplesY: 8, sigma: 2.5 },
        },
      ],
      colorNodes: [
        {
          id: "recipe-node-2",
          operationId: "scnr",
          enabled: true,
          params: { method: "averageNeutral", amount: 0.8 },
        },
      ],
    },
    location: {
      latitude: 34.0522,
      longitude: -118.2437,
      city: "Los Angeles",
      country: "US",
    },
  },
  {
    id: E2E_FILE_IDS.fits2,
    filename: "M31_Light_002.fits",
    filepath: "file:///e2e/M31_Light_002.fits",
    fileSize: 980_000,
    importDate: NOW - 43_200_000,
    frameType: "light",
    isFavorite: false,
    tags: ["e2e", "galaxy"],
    albumIds: [E2E_IDS.album],
    sourceType: "fits",
    sourceFormat: "fits",
    mediaKind: "image",
    object: "M31",
    filter: "OIII",
    exptime: 240,
    targetId: E2E_IDS.target,
    sessionId: E2E_IDS.session,
    editorRecipe: {
      version: 1,
      savedAt: NOW - 40_000_000,
      profile: "legacy",
      scientificNodes: [],
      colorNodes: [],
      nodes: [
        {
          id: "legacy-node-1",
          operationId: "backgroundExtract",
          enabled: true,
          params: { gridSize: 8 },
        },
      ],
    },
    location: {
      latitude: 35.6762,
      longitude: 139.6503,
      city: "Tokyo",
      country: "JP",
    },
  },
  {
    id: E2E_FILE_IDS.fits3,
    filename: "Flat_003.fits",
    filepath: "file:///e2e/Flat_003.fits",
    fileSize: 420_000,
    importDate: NOW - 20_000_000,
    frameType: "flat",
    isFavorite: false,
    tags: ["e2e"],
    albumIds: [],
    sourceType: "fits",
    sourceFormat: "fits",
    mediaKind: "image",
    object: "Calibration",
    exptime: 1,
  },
  {
    id: E2E_FILE_IDS.video1,
    filename: "Jupiter_001.mp4",
    filepath: "file:///e2e/Jupiter_001.mp4",
    fileSize: 8_200_000,
    importDate: NOW - 10_000_000,
    frameType: "unknown",
    isFavorite: false,
    tags: ["e2e", "planet"],
    albumIds: [],
    sourceType: "video",
    sourceFormat: "mp4",
    mediaKind: "video",
    durationMs: 12_000,
    frameRate: 30,
    videoWidth: 1920,
    videoHeight: 1080,
    videoCodec: "h264",
    audioCodec: "aac",
    bitrateKbps: 2500,
    hasAudioTrack: true,
  },
];

export const E2E_ALBUMS: Album[] = [
  {
    id: E2E_IDS.album,
    name: "E2E Album",
    description: "Album seeded for Maestro routes",
    coverImageId: E2E_FILE_IDS.fits1,
    createdAt: NOW - 90_000_000,
    updatedAt: NOW,
    imageIds: [E2E_FILE_IDS.fits1, E2E_FILE_IDS.fits2],
    isSmart: false,
  },
];

export const E2E_TARGETS: Target[] = [
  {
    id: E2E_IDS.target,
    name: "M42",
    aliases: ["Orion Nebula"],
    type: "nebula",
    tags: ["e2e", "winter"],
    isFavorite: true,
    isPinned: true,
    imageIds: [E2E_FILE_IDS.fits1, E2E_FILE_IDS.fits2],
    status: "acquiring",
    plannedFilters: ["Ha", "OIII"],
    plannedExposure: { Ha: 7200, OIII: 7200 },
    imageRatings: { [E2E_FILE_IDS.fits1]: 5 },
    changeLog: [],
    createdAt: NOW - 100_000_000,
    updatedAt: NOW,
    ra: 83.8221,
    dec: -5.3911,
    bestImageId: E2E_FILE_IDS.fits1,
  },
];

export const E2E_TARGET_GROUPS: TargetGroup[] = [
  {
    id: E2E_IDS.targetGroup,
    name: "E2E Group",
    description: "Seeded target group",
    targetIds: [E2E_IDS.target],
    createdAt: NOW - 50_000_000,
    updatedAt: NOW,
  },
];

export const E2E_SESSIONS: ObservationSession[] = [
  {
    id: E2E_IDS.session,
    date: "2025-11-01",
    startTime: NOW - 80_000_000,
    endTime: NOW - 76_000_000,
    duration: 4000,
    targetRefs: [{ targetId: E2E_IDS.target, name: "M42" }],
    imageIds: [E2E_FILE_IDS.fits1, E2E_FILE_IDS.fits2],
    equipment: {
      telescope: "E2E Telescope",
      camera: "E2E Camera",
      filters: ["Ha", "OIII"],
    },
    notes: "E2E seeded session",
    createdAt: NOW - 80_000_000,
    rating: 4,
    bortle: 5,
  },
];

export const E2E_LOG_ENTRIES: ObservationLogEntry[] = [
  {
    id: "session-log-001",
    sessionId: E2E_IDS.session,
    imageId: E2E_FILE_IDS.fits1,
    dateTime: "2025-11-01T20:00:00.000Z",
    object: "M42",
    filter: "Ha",
    exptime: 300,
    gain: 100,
    notes: "Seed log entry",
  },
];

export const E2E_ASTROMETRY_JOBS: AstrometryJob[] = [
  {
    id: E2E_IDS.astrometryJob,
    fileId: E2E_FILE_IDS.fits1,
    fileName: "M42_Light_001.fits",
    status: "success",
    progress: 100,
    createdAt: NOW - 30_000_000,
    updatedAt: NOW - 29_000_000,
    submissionId: 123456,
    jobId: 654321,
    result: {
      calibration: {
        ra: 83.8221,
        dec: -5.3911,
        radius: 1.2,
        pixscale: 1.5,
        orientation: 0,
        parity: 1,
        fieldWidth: 1.0,
        fieldHeight: 0.8,
      },
      annotations: [
        {
          type: "messier",
          names: ["M42"],
          pixelx: 120,
          pixely: 130,
          radius: 20,
        },
      ],
      tags: ["M42", "nebula"],
    },
  },
];

export const E2E_BACKUP_CONNECTIONS: ProviderConnectionState[] = [
  {
    provider: "google-drive",
    connected: true,
    userName: "E2E User",
    userEmail: "e2e@example.com",
    lastBackupDate: NOW - 3_600_000,
  },
];

export const E2E_FILE_GROUPS: FileGroup[] = [
  {
    id: E2E_IDS.fileGroup,
    name: "E2E File Group",
    color: "#3b82f6",
    createdAt: NOW - 40_000_000,
    updatedAt: NOW,
  },
];

export const E2E_FILE_GROUP_MAP: Record<string, string[]> = {
  [E2E_FILE_IDS.fits1]: [E2E_IDS.fileGroup],
};
