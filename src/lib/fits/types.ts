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
export type FrameType = "light" | "dark" | "flat" | "bias" | "unknown";

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
  targetId?: string;
  sessionId?: string;
  thumbnailUri?: string;
  hash?: string;

  // 质量评分
  qualityScore?: number; // 0-100

  // 用户备注
  notes?: string;

  // 地理位置
  location?: GeoLocation;
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
}

export interface SmartAlbumRule {
  field:
    | "object"
    | "filter"
    | "dateObs"
    | "exptime"
    | "instrument"
    | "telescope"
    | "tag"
    | "location"
    | "frameType";
  operator: "equals" | "contains" | "gt" | "lt" | "between" | "in";
  value: string | number | string[] | [number, number];
}

// ===== 目标管理 =====
export interface Target {
  id: string;
  name: string;
  aliases: string[];
  type: TargetType;
  category?: string;
  ra?: number;
  dec?: number;
  imageIds: string[];
  status: TargetStatus;
  plannedFilters: string[];
  plannedExposure: Record<string, number>; // filter -> seconds
  notes?: string;
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

// ===== 观测会话 =====
export interface ObservationSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: number;
  endTime: number;
  duration: number; // seconds
  targets: string[];
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
export type ExportFormat = "png" | "jpeg" | "webp" | "tiff" | "bmp";

export interface ConvertOptions {
  format: ExportFormat;
  quality: number; // 1-100 for JPEG/WebP
  bitDepth: 8 | 16 | 32; // for TIFF
  dpi: number;
  stretch: StretchType;
  colormap: ColormapType;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  outputBlack: number;
  outputWhite: number;
  includeAnnotations: boolean;
  includeWatermark: boolean;
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
      stretch: "asinh",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
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
      stretch: "asinh",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
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
      stretch: "linear",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
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
  type: "convert" | "export" | "stack";
  status: BatchTaskStatus;
  progress: number; // 0-100
  total: number;
  completed: number;
  failed: number;
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
