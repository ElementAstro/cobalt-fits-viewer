/**
 * FITS 相关类型定义
 * 基于 fitsjs-ng 库的类型扩展
 */

// ===== 拉伸算法 =====
export type StretchType =
  | "linear"
  | "sqrt"
  | "log"
  | "asinh"
  | "power"
  | "zscale"
  | "minmax"
  | "percentile";

export type ViewerCurvePreset = "linear" | "sCurve" | "brighten" | "darken" | "highContrast";

// ===== 色彩映射 =====
export type ColormapType =
  | "grayscale"
  | "inverted"
  | "heat"
  | "cool"
  | "thermal"
  | "rainbow"
  | "jet"
  | "viridis"
  | "plasma"
  | "magma"
  | "inferno"
  | "cividis"
  | "cubehelix"
  | "red"
  | "green"
  | "blue";

// ===== 帧类型 =====
export type BuiltinFrameType = "light" | "dark" | "flat" | "bias" | "darkflat" | "unknown";
export type FrameType = string;
export type FrameTypeSource = "header" | "filename" | "rule" | "manual" | "fallback";

export interface FrameTypeDefinition {
  key: string;
  label: string;
  builtin?: boolean;
}

export type FrameClassificationRuleTarget = "header" | "filename";
export type FrameClassificationRuleMatchType = "exact" | "contains" | "regex";
export type FrameClassificationRuleHeaderField = "IMAGETYP" | "FRAME" | "ANY";

export interface FrameClassificationRule {
  id: string;
  enabled: boolean;
  priority: number;
  target: FrameClassificationRuleTarget;
  headerField?: FrameClassificationRuleHeaderField;
  matchType: FrameClassificationRuleMatchType;
  pattern: string;
  caseSensitive?: boolean;
  frameType: string;
}

export interface FrameClassificationConfig {
  frameTypes: FrameTypeDefinition[];
  rules: FrameClassificationRule[];
}

// ===== 文件来源类型 =====
export type ImageSourceType = "fits" | "raster" | "video" | "audio";
export type ImageSourceFormat =
  | "fits"
  | "fit"
  | "fts"
  | "fz"
  | "fits.gz"
  | "fit.gz"
  | "xisf"
  | "ser"
  | "hips"
  | "png"
  | "jpeg"
  | "webp"
  | "tiff"
  | "bmp"
  | "gif"
  | "heic"
  | "avif"
  | "mp4"
  | "mov"
  | "m4v"
  | "webm"
  | "mkv"
  | "avi"
  | "3gp"
  | "mp3"
  | "aac"
  | "m4a"
  | "wav"
  | "unknown";

// ===== HDU 数据类型 =====
export type HDUDataType = "Image" | "BinaryTable" | "Table" | "CompressedImage" | null;

// ===== 地理位置 =====
export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  placeName?: string;
  city?: string;
  region?: string;
  country?: string;
}

export type StarAnnotationDetectionConnectivity = 4 | 8;

export interface StarAnnotationDetectionSnapshotV1 {
  profile: "fast" | "balanced" | "accurate";
  sigmaThreshold: number;
  maxStars: number;
  minArea: number;
  maxArea: number;
  borderMargin: number;
  meshSize: number;
  deblendNLevels: number;
  deblendMinContrast: number;
  filterFwhm: number;
  maxFwhm: number;
  maxEllipticity: number;
}

export interface StarAnnotationDetectionSnapshotV2 extends StarAnnotationDetectionSnapshotV1 {
  sigmaClipIters: number;
  applyMatchedFilter: boolean;
  connectivity: StarAnnotationDetectionConnectivity;
  minFwhm: number;
  minSharpness: number;
  maxSharpness: number;
  peakMax?: number;
  snrMin: number;
}

export type StarAnnotationDetectionSnapshot = StarAnnotationDetectionSnapshotV2;

export interface StarAnnotationMetrics {
  flux?: number;
  peak?: number;
  area?: number;
  fwhm?: number;
  snr?: number;
  roundness?: number;
  ellipticity?: number;
  sharpness?: number;
  theta?: number;
  flags?: number;
}

export interface StarAnnotationPoint {
  id: string;
  x: number;
  y: number;
  enabled: boolean;
  source: "detected" | "manual";
  anchorIndex?: 1 | 2 | 3;
  metrics?: StarAnnotationMetrics;
}

export type StarAnnotationStaleReason =
  | "geometry-changed"
  | "unsupported-transform"
  | "dimension-mismatch"
  | "manual";

export interface StarAnnotationBundleV1 {
  version: 1;
  updatedAt: number;
  detectionSnapshot: StarAnnotationDetectionSnapshotV1;
  points: StarAnnotationPoint[];
  stale?: boolean;
}

export interface StarAnnotationBundleV2 {
  version: 2;
  updatedAt: number;
  detectionSnapshot: StarAnnotationDetectionSnapshotV2;
  points: StarAnnotationPoint[];
  stale?: boolean;
  staleReason?: StarAnnotationStaleReason;
  imageGeometry: {
    width: number;
    height: number;
  };
}

export type StarAnnotationBundle = StarAnnotationBundleV1 | StarAnnotationBundleV2;

// ===== FITS 文件元数据 =====
export interface FitsMetadata {
  id: string;
  filename: string;
  filepath: string;
  fileSize: number;
  importDate: number;
  lastViewed?: number;

  // 从 header 提取的关键信息
  bitpix?: number;
  naxis?: number;
  naxis1?: number;
  naxis2?: number;
  naxis3?: number;

  // 帧类型
  frameType: FrameType;
  frameTypeSource?: FrameTypeSource;
  imageTypeRaw?: string;
  frameHeaderRaw?: string;

  // 观测信息
  object?: string;
  dateObs?: string;
  exptime?: number;
  filter?: string;
  instrument?: string;
  telescope?: string;
  ra?: number;
  dec?: number;
  airmass?: number;

  // 设备信息
  detector?: string;
  gain?: number;
  ccdTemp?: number;

  // 管理信息
  isFavorite: boolean;
  tags: string[];
  albumIds: string[];
  sourceType?: ImageSourceType;
  sourceFormat?: ImageSourceFormat;
  targetId?: string;
  sessionId?: string;
  thumbnailUri?: string;
  hash?: string;
  decodeStatus?: "ready" | "failed";
  decodeError?: string;
  mediaKind?: "image" | "video" | "audio";
  durationMs?: number;
  frameRate?: number;
  videoWidth?: number;
  videoHeight?: number;
  videoCodec?: string;
  audioCodec?: string;
  bitrateKbps?: number;
  rotationDeg?: number;
  hasAudioTrack?: boolean;
  thumbnailAtMs?: number;
  derivedFromId?: string;
  processingTag?:
    | "trim"
    | "split"
    | "compress"
    | "transcode"
    | "merge"
    | "extract-audio"
    | "mute"
    | "cover"
    | "compose-advanced";

  // 质量评分
  qualityScore?: number; // 0-100

  // 用户备注
  notes?: string;

  // 地理位置
  location?: GeoLocation;

  // Star annotation linkage
  starAnnotations?: StarAnnotationBundle;

  // Viewer per-file preset
  viewerPreset?: ViewerPreset;

  // Non-destructive editor recipe
  editorRecipe?: ProcessingPipelineSnapshot;
}

export type ProcessingExecutionMode = "preview" | "full";
export type ProcessingAlgorithmProfile = "standard" | "legacy";

export type ProcessingOperationId =
  | "rotate90cw"
  | "rotate90ccw"
  | "rotate180"
  | "flipH"
  | "flipV"
  | "invert"
  | "blur"
  | "sharpen"
  | "denoise"
  | "histogramEq"
  | "crop"
  | "brightness"
  | "contrast"
  | "gamma"
  | "levels"
  | "rotateArbitrary"
  | "backgroundExtract"
  | "mtf"
  | "starMask"
  | "binarize"
  | "rescale"
  | "clahe"
  | "curves"
  | "morphology"
  | "hdr"
  | "rangeMask"
  | "pixelMath"
  | "deconvolution"
  | "dbe"
  | "multiscaleDenoise"
  | "localContrast"
  | "starReduction"
  | "deconvolutionAuto"
  | "scnr"
  | "colorCalibration"
  | "saturation"
  | "colorBalance";

export type ProcessingParamPrimitive = number | string | boolean;

export type ProcessingParamValue =
  | ProcessingParamPrimitive
  | Array<{ x: number; y: number }>
  | number[]
  | string[];

export interface ProcessingNode {
  id: string;
  operationId: ProcessingOperationId;
  enabled: boolean;
  params: Record<string, ProcessingParamValue>;
}

export interface ProcessingPipelineSnapshot {
  version: number;
  savedAt: number;
  profile: ProcessingAlgorithmProfile;
  scientificNodes: ProcessingNode[];
  colorNodes: ProcessingNode[];
  /**
   * @deprecated Legacy snapshot format. Kept for migration compatibility.
   */
  nodes?: ProcessingNode[];
}

export interface TrashedFitsRecord {
  trashId: string;
  file: FitsMetadata;
  originalFilepath: string;
  trashedFilepath: string;
  deletedAt: number;
  expireAt: number;
  groupIds: string[];
  deleteReason?: "single" | "batch" | "cleanup";
}

export interface FileGroup {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ViewerPreset {
  version: number;
  savedAt: number;
  adjustments: {
    stretch: StretchType;
    colormap: ColormapType;
    blackPoint: number;
    whitePoint: number;
    gamma: number;
    midtone: number;
    outputBlack: number;
    outputWhite: number;
    brightness: number;
    contrast: number;
    mtfMidtone: number;
    curvePreset: ViewerCurvePreset;
  };
  overlays: {
    showGrid: boolean;
    showCrosshair: boolean;
    showPixelInfo: boolean;
    showMinimap: boolean;
  };
}

// ===== Header 关键字 =====
export interface HeaderKeyword {
  key: string;
  value: string | number | boolean | null;
  comment?: string;
}

export type HeaderGroup = "observation" | "instrument" | "image" | "wcs" | "processing" | "other";

export const HEADER_GROUP_KEYS: Record<HeaderGroup, string[]> = {
  observation: ["DATE-OBS", "EXPTIME", "OBJECT", "RA", "DEC", "AIRMASS", "EQUINOX", "EPOCH"],
  instrument: [
    "INSTRUME",
    "TELESCOP",
    "FILTER",
    "DETECTOR",
    "GAIN",
    "CCD-TEMP",
    "SET-TEMP",
    "XBINNING",
    "YBINNING",
  ],
  image: ["BITPIX", "NAXIS", "NAXIS1", "NAXIS2", "NAXIS3", "BSCALE", "BZERO"],
  wcs: [
    "CRVAL1",
    "CRVAL2",
    "CRPIX1",
    "CRPIX2",
    "CDELT1",
    "CDELT2",
    "CTYPE1",
    "CTYPE2",
    "CD1_1",
    "CD1_2",
    "CD2_1",
    "CD2_2",
    "CROTA2",
  ],
  processing: ["COMMENT", "HISTORY"],
  other: [],
};

// ===== 查看器状态 =====
export interface ViewerState {
  stretch: StretchType;
  colormap: ColormapType;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  currentHDU: number;
  currentFrame: number;
  showGrid: boolean;
  showCrosshair: boolean;
  showPixelInfo: boolean;
}

// ===== 相簿 =====
export interface Album {
  id: string;
  name: string;
  description?: string;
  coverImageId?: string;
  createdAt: number;
  updatedAt: number;
  imageIds: string[];
  isSmart: boolean;
  smartRules?: SmartAlbumRule[];
  sortOrder?: number;
  isPinned?: boolean;
  notes?: string;
  color?: string;
}

export type SmartAlbumRuleField =
  | "object"
  | "filter"
  | "dateObs"
  | "exptime"
  | "instrument"
  | "telescope"
  | "tag"
  | "location"
  | "frameType";

export type SmartAlbumRuleOperator =
  | "equals"
  | "contains"
  | "gt"
  | "lt"
  | "between"
  | "in"
  | "notEquals"
  | "notContains"
  | "notIn";

export interface SmartAlbumRule {
  field: SmartAlbumRuleField;
  operator: SmartAlbumRuleOperator;
  value: string | number | string[] | [number, number];
}

// ===== 相簿统计 =====
export interface AlbumStatistics {
  albumId: string;
  totalExposure: number;
  frameBreakdown: Record<string, number>;
  dateRange: [string, string] | null;
  filterBreakdown: Record<string, number>;
  totalFileSize: number;
}

// ===== 相簿重复图片 =====
export interface DuplicateImageInfo {
  imageId: string;
  albumIds: string[];
  albumNames: string[];
}

// ===== 目标管理 =====
export interface TargetChangeLogEntry {
  id: string;
  timestamp: number;
  action:
    | "created"
    | "updated"
    | "status_changed"
    | "image_added"
    | "image_removed"
    | "favorited"
    | "unfavorited"
    | "pinned"
    | "unpinned"
    | "tagged"
    | "untagged";
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface RecommendedEquipment {
  telescope?: string;
  camera?: string;
  filters?: string[];
  notes?: string;
}

export interface Target {
  id: string;
  name: string;
  aliases: string[];
  type: TargetType;
  category?: string;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  /**
   * @deprecated Group membership is now sourced from TargetGroup.targetIds only.
   * Kept for migration compatibility reads.
   */
  groupId?: string;
  ra?: number;
  dec?: number;
  imageIds: string[];
  status: TargetStatus;
  plannedFilters: string[];
  plannedExposure: Record<string, number>; // filter -> seconds
  notes?: string;
  recommendedEquipment?: RecommendedEquipment;
  bestImageId?: string;
  imageRatings: Record<string, number>; // imageId -> rating (1-5)
  changeLog: TargetChangeLogEntry[];
  createdAt: number;
  updatedAt: number;
}

// ===== 目标分组 =====
export interface TargetGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  targetIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type TargetType =
  | "galaxy"
  | "nebula"
  | "cluster"
  | "planet"
  | "moon"
  | "sun"
  | "comet"
  | "other";

export type TargetStatus = "planned" | "acquiring" | "completed" | "processed";

export interface TargetRef {
  targetId?: string;
  name: string;
}

// ===== 观测会话 =====
export interface ObservationSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: number;
  endTime: number;
  duration: number; // seconds
  targetRefs: TargetRef[];
  imageIds: string[];
  equipment: SessionEquipment;
  location?: GeoLocation;
  weather?: string;
  seeing?: string;
  notes?: string;
  createdAt: number;
  calendarEventId?: string;
  rating?: number; // 1-5 session quality rating
  bortle?: number; // 1-9 Bortle scale
  tags?: string[]; // e.g. "deep sky", "planetary", "first light"
}

// ===== 观测计划 =====
export interface ObservationPlan {
  id: string;
  title: string;
  targetId?: string;
  targetName: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  location?: GeoLocation;
  equipment?: SessionEquipment;
  notes?: string;
  reminderMinutes: number;
  calendarEventId?: string;
  createdAt: number;
  status?: "planned" | "completed" | "cancelled";
}

export interface SessionEquipment {
  telescope?: string;
  camera?: string;
  mount?: string;
  filters?: string[];
}

// ===== 观测日志条目 =====
export interface ObservationLogEntry {
  id: string;
  sessionId: string;
  imageId: string;
  dateTime: string;
  object: string;
  filter: string;
  exptime: number;
  gain?: number;
  telescope?: string;
  camera?: string;
  ccdTemp?: number;
  notes?: string;
}

// ===== 格式转换 =====
export type ExportFormat = "png" | "jpeg" | "webp" | "tiff" | "bmp" | "fits";

export type TiffCompression = "none" | "lzw" | "deflate";
export type TiffMultipageMode = "preserve" | "firstFrame";

export interface TiffTargetOptions {
  compression: TiffCompression;
  multipage: TiffMultipageMode;
}

export const DEFAULT_TIFF_TARGET_OPTIONS: TiffTargetOptions = {
  compression: "lzw",
  multipage: "preserve",
};

export type FitsCompression = "none" | "gzip";
export type FitsExportMode = "scientific" | "rendered";
export type FitsColorLayout = "mono2d" | "rgbCube3d";

export interface FitsTargetOptions {
  mode: FitsExportMode;
  compression: FitsCompression;
  bitpix: 8 | 16 | 32 | -32 | -64;
  colorLayout: FitsColorLayout;
  preserveOriginalHeader: boolean;
  preserveWcs: boolean;
}

export const DEFAULT_FITS_TARGET_OPTIONS: FitsTargetOptions = {
  mode: "scientific",
  compression: "none",
  bitpix: -32,
  colorLayout: "rgbCube3d",
  preserveOriginalHeader: true,
  preserveWcs: true,
};

export interface ConvertOptions {
  format: ExportFormat;
  quality: number; // 1-100 for JPEG/WebP
  bitDepth: 8 | 16 | 32; // for TIFF
  dpi: number;
  tiff: TiffTargetOptions;
  fits: FitsTargetOptions;
  stretch: StretchType;
  colormap: ColormapType;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  brightness?: number;
  contrast?: number;
  mtfMidtone?: number;
  curvePreset?: ViewerCurvePreset;
  profile?: ProcessingAlgorithmProfile;
  outputBlack: number;
  outputWhite: number;
  includeAnnotations: boolean;
  includeWatermark: boolean;
  watermarkText?: string;
}

export interface ConvertPreset {
  id: string;
  name: string;
  description: string;
  options: ConvertOptions;
}

export const DEFAULT_CONVERT_PRESETS: ConvertPreset[] = [
  {
    id: "web",
    name: "Web 发布",
    description: "适合网页展示的 JPEG 格式",
    options: {
      format: "jpeg",
      quality: 85,
      bitDepth: 8,
      dpi: 72,
      tiff: DEFAULT_TIFF_TARGET_OPTIONS,
      fits: DEFAULT_FITS_TARGET_OPTIONS,
      stretch: "asinh",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
      brightness: 0,
      contrast: 1,
      mtfMidtone: 0.25,
      curvePreset: "linear",
      outputBlack: 0,
      outputWhite: 1,
      includeAnnotations: false,
      includeWatermark: false,
    },
  },
  {
    id: "print",
    name: "高质量打印",
    description: "适合打印的高 DPI PNG 格式",
    options: {
      format: "png",
      quality: 100,
      bitDepth: 8,
      dpi: 300,
      tiff: DEFAULT_TIFF_TARGET_OPTIONS,
      fits: DEFAULT_FITS_TARGET_OPTIONS,
      stretch: "asinh",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
      brightness: 0,
      contrast: 1,
      mtfMidtone: 0.25,
      curvePreset: "linear",
      outputBlack: 0,
      outputWhite: 1,
      includeAnnotations: true,
      includeWatermark: false,
    },
  },
  {
    id: "astro",
    name: "天文后期",
    description: "保留完整动态范围的 16-bit TIFF",
    options: {
      format: "tiff",
      quality: 100,
      bitDepth: 16,
      dpi: 72,
      tiff: DEFAULT_TIFF_TARGET_OPTIONS,
      fits: DEFAULT_FITS_TARGET_OPTIONS,
      stretch: "linear",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
      brightness: 0,
      contrast: 1,
      mtfMidtone: 0.25,
      curvePreset: "linear",
      outputBlack: 0,
      outputWhite: 1,
      includeAnnotations: false,
      includeWatermark: false,
    },
  },
];

// ===== 标注 =====
export type AnnotationType =
  | "circle"
  | "rectangle"
  | "ellipse"
  | "crosshair"
  | "text"
  | "arrow"
  | "line";

export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  color: string;
  strokeWidth: number;
  visible: boolean;
  rotation?: number;
}

// ===== 批量任务 =====
export type BatchTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface BatchTask {
  id: string;
  type: "convert" | "export" | "stack" | "video-process";
  status: BatchTaskStatus;
  progress: number; // 0-100
  total: number;
  completed: number;
  failed: number;
  skipped?: number;
  warnings?: string[];
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

// ===== 相册视图模式 =====
export type GalleryViewMode = "grid" | "list" | "timeline";

// ===== 统计数据 =====
export interface ExposureStats {
  totalExposure: number; // seconds
  byFilter: Record<string, number>; // filter -> seconds
  frameCount: number;
  byFilterCount: Record<string, number>; // filter -> count
  dateRange: [string, string]; // [earliest, latest]
}

export interface ObservationStats {
  totalObservationTime: number;
  totalSessions: number;
  totalImages: number;
  topTargets: Array<{ name: string; count: number; exposure: number }>;
  byMonth: Record<string, number>; // YYYY-MM -> session count
  byEquipment: Record<string, number>; // equipment name -> usage count
  exposureByFilter: Record<string, number>;
}
