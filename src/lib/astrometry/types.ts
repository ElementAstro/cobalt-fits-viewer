/**
 * Astrometry.net 客户端类型定义
 */

// ===== 任务状态 =====
export type AstrometryJobStatus =
  | "pending"
  | "uploading"
  | "submitted"
  | "solving"
  | "success"
  | "failure"
  | "cancelled";

// ===== 解析任务 =====
export interface AstrometryJob {
  /** 本地 UUID */
  id: string;
  /** 关联的 FITS 文件 ID */
  fileId?: string;
  /** 文件名 */
  fileName: string;
  /** 缩略图 URI */
  thumbnailUri?: string;
  /** nova.astrometry.net submission ID */
  submissionId?: number;
  /** nova.astrometry.net job ID */
  jobId?: number;
  /** 任务状态 */
  status: AstrometryJobStatus;
  /** 进度 0-100 */
  progress: number;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 解析结果 */
  result?: AstrometryResult;
}

// ===== 解析结果 =====
export interface AstrometryResult {
  /** WCS 标定数据 */
  calibration: AstrometryCalibration;
  /** 天体标注 */
  annotations: AstrometryAnnotation[];
  /** 标签 */
  tags: string[];
}

// ===== WCS 标定结果 =====
export interface AstrometryCalibration {
  /** 中心 RA (度) */
  ra: number;
  /** 中心 DEC (度) */
  dec: number;
  /** 视场半径 (度) */
  radius: number;
  /** 像素尺度 (角秒/像素) */
  pixscale: number;
  /** 旋转角 (度) */
  orientation: number;
  /** 奇偶性 */
  parity: number;
  /** 视场宽 (度) */
  fieldWidth: number;
  /** 视场高 (度) */
  fieldHeight: number;
}

// ===== 天体标注 =====
export type AstrometryAnnotationType =
  | "star"
  | "hd"
  | "ngc"
  | "ic"
  | "messier"
  | "bright_star"
  | "other";

export interface AstrometryAnnotation {
  /** 标注类型 */
  type: AstrometryAnnotationType;
  /** 天体名称列表 */
  names: string[];
  /** 像素 X 坐标 */
  pixelx: number;
  /** 像素 Y 坐标 */
  pixely: number;
  /** 标注半径 (像素) */
  radius?: number;
}

// ===== 客户端配置 =====
export interface AstrometryConfig {
  /** API Key (实际存储在 SecureStore 中，此处仅为标记) */
  apiKey: string;
  /** 服务器地址 */
  serverUrl: string;
  /** 是否使用自定义服务器 */
  useCustomServer: boolean;
  /** 最大并行任务数 */
  maxConcurrent: number;
  /** 是否自动解析新导入的图片 */
  autoSolve: boolean;
  /** 默认尺度单位 */
  defaultScaleUnits: "degwidth" | "arcminwidth" | "arcsecperpix";
  /** 默认尺度下限 */
  defaultScaleLower?: number;
  /** 默认尺度上限 */
  defaultScaleUpper?: number;
}

// ===== 上传选项 =====
export interface AstrometryUploadOptions {
  /** 会话密钥 */
  session: string;
  /** 尺度单位 */
  scale_units?: "degwidth" | "arcminwidth" | "arcsecperpix";
  /** 尺度下限 */
  scale_lower?: number;
  /** 尺度上限 */
  scale_upper?: number;
  /** 图像中心 RA (度) */
  center_ra?: number;
  /** 图像中心 DEC (度) */
  center_dec?: number;
  /** 搜索半径 (度) */
  radius?: number;
  /** 奇偶性: 0=正, 1=反, 2=两者都试 */
  parity?: 0 | 1 | 2;
  /** 是否允许商业使用 */
  allow_commercial_use?: "d" | "y" | "n";
  /** 是否允许修改 */
  allow_modifications?: "d" | "y" | "n" | "sa";
  /** 公开可见性 */
  publicly_visible?: "y" | "n";
}

// ===== API 响应类型 =====
export interface AstrometryLoginResponse {
  status: "success" | "error";
  message: string;
  session?: string;
}

export interface AstrometrySubmitResponse {
  status: "success" | "error";
  subid?: number;
  hash?: string;
  message?: string;
}

export interface AstrometrySubmissionStatus {
  processing_started?: string;
  processing_finished?: string;
  job_calibrations: Array<[number, number]>;
  jobs: number[];
  user: number;
  user_images: number[];
}

export interface AstrometryJobStatusResponse {
  status: "solving" | "success" | "failure";
}

export interface AstrometryCalibrationResponse {
  ra: number;
  dec: number;
  radius: number;
  pixscale: number;
  orientation: number;
  parity: number;
  widthInDeg?: number;
  heightInDeg?: number;
}

export interface AstrometryAnnotationResponse {
  type: string;
  names?: string[];
  pixelx?: number;
  pixely?: number;
  radius?: number;
  vmag?: number;
}

// ===== 默认配置 =====
export const DEFAULT_ASTROMETRY_CONFIG: AstrometryConfig = {
  apiKey: "",
  serverUrl: "https://nova.astrometry.net",
  useCustomServer: false,
  maxConcurrent: 3,
  autoSolve: false,
  defaultScaleUnits: "degwidth",
  defaultScaleLower: undefined,
  defaultScaleUpper: undefined,
};

// ===== 常量 =====
export const ASTROMETRY_API_PATHS = {
  login: "/api/login",
  upload: "/api/upload",
  urlUpload: "/api/url_upload",
  submissions: "/api/submissions",
  jobs: "/api/jobs",
} as const;

export const ASTROMETRY_POLL_INTERVAL = 5000;
export const ASTROMETRY_MAX_POLL_ATTEMPTS = 120;
export const ASTROMETRY_REQUEST_TIMEOUT = 30000;
export const ASTROMETRY_UPLOAD_TIMEOUT = 120000;
