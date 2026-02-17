/**
 * Astrometry.net REST API 客户端
 * 封装 nova.astrometry.net 的所有 API 调用
 */

import { File } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { LOG_TAGS, Logger } from "../logger";
import type {
  AstrometryLoginResponse,
  AstrometrySubmitResponse,
  AstrometrySubmissionStatus,
  AstrometryJobStatusResponse,
  AstrometryCalibrationResponse,
  AstrometryAnnotationResponse,
  AstrometryAnnotation,
  AstrometryAnnotationType,
  AstrometryCalibration,
  AstrometryUploadOptions,
} from "./types";
import { ASTROMETRY_API_PATHS, ASTROMETRY_REQUEST_TIMEOUT } from "./types";

const TAG = LOG_TAGS.AstrometryClient;
const SECURE_STORE_KEY = "astrometry_api_key";
const REFERER_HEADER = "https://nova.astrometry.net/api/login";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;

// ===== API Key 安全存储 =====

export async function saveApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEY, apiKey);
}

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEY);
}

export async function deleteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
}

// ===== 内部工具函数 =====

export function buildUrl(
  serverUrl: string,
  path: string,
  ...segments: (string | number)[]
): string {
  const base = serverUrl.replace(/\/+$/, "");
  const parts = segments.map((s) => String(s));
  return parts.length > 0 ? `${base}${path}/${parts.join("/")}` : `${base}${path}`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = ASTROMETRY_REQUEST_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeout: number = ASTROMETRY_REQUEST_TIMEOUT,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeout);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isRetryable =
        lastError.name === "AbortError" ||
        lastError.message.includes("network") ||
        lastError.message.includes("Network") ||
        lastError.message.includes("Failed to fetch") ||
        lastError.message.includes("timeout");

      if (!isRetryable || attempt === retries) break;

      const delayMs = RETRY_BASE_DELAY * Math.pow(2, attempt);
      Logger.warn(TAG, `Retry ${attempt + 1}/${retries} after ${delayMs}ms: ${lastError.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError ?? new Error("Request failed");
}

export function classifyError(error: unknown): { code: string; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes("api key") || lower.includes("login") || lower.includes("session")) {
    return { code: "auth", message: "Authentication failed. Check your API key." };
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return { code: "not_found", message: "Resource not found on server." };
  }
  if (lower.includes("429") || lower.includes("rate")) {
    return { code: "rate_limit", message: "Rate limited. Please wait before retrying." };
  }
  if (
    /http\s*5\d{2}/.test(lower) ||
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503")
  ) {
    return { code: "server", message: "Server error. The service may be temporarily unavailable." };
  }
  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("timeout")) {
    return { code: "network", message: "Network error. Check your connection and try again." };
  }
  return { code: "unknown", message: msg };
}

async function postJson(
  serverUrl: string,
  path: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const url = buildUrl(serverUrl, path);
  const body = `request-json=${encodeURIComponent(JSON.stringify(data))}`;

  Logger.debug(TAG, `POST ${path}`, { url });

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: REFERER_HEADER,
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  return res.json();
}

async function getJson(
  serverUrl: string,
  path: string,
  ...segments: (string | number)[]
): Promise<unknown> {
  const url = buildUrl(serverUrl, path, ...segments);

  Logger.debug(TAG, `GET ${url}`);

  const res = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      Referer: REFERER_HEADER,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  return res.json();
}

// ===== 公开 API =====

/**
 * 登录获取 session key
 */
export async function login(apiKey: string, serverUrl: string): Promise<string> {
  Logger.info(TAG, "Logging in to Astrometry.net");

  const result = (await postJson(serverUrl, ASTROMETRY_API_PATHS.login, {
    apikey: apiKey,
  })) as AstrometryLoginResponse;

  if (result.status !== "success" || !result.session) {
    throw new Error(result.message || "Login failed");
  }

  Logger.info(TAG, "Login successful");
  return result.session;
}

/**
 * 上传文件进行 plate solving
 * 使用 expo-file-system uploadAsync 处理 multipart 上传
 */
export async function uploadFile(
  serverUrl: string,
  fileUri: string,
  options: AstrometryUploadOptions,
): Promise<number> {
  const url = buildUrl(serverUrl, ASTROMETRY_API_PATHS.upload);

  Logger.info(TAG, `Uploading file: ${fileUri}`);

  const requestJson = JSON.stringify(options);

  // 读取文件为 base64
  const file = new File(fileUri);
  if (!file.exists) {
    throw new Error(`File not found: ${fileUri}`);
  }
  const fileBytes = await file.bytes();

  // 手动构建 multipart/form-data
  const boundary = `----AstrometryUpload${Date.now()}`;
  const encoder = new TextEncoder();

  const jsonPart = encoder.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="request-json"\r\n` +
      `Content-Type: application/text\r\n\r\n` +
      `${requestJson}\r\n`,
  );

  const fileName = fileUri.split("/").pop() ?? "upload.fits";
  const filePart = encoder.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
  );

  const endPart = encoder.encode(`\r\n--${boundary}--\r\n`);

  // 拼接 multipart body
  const body = new Uint8Array(
    jsonPart.length + filePart.length + fileBytes.length + endPart.length,
  );
  body.set(jsonPart, 0);
  body.set(filePart, jsonPart.length);
  body.set(fileBytes, jsonPart.length + filePart.length);
  body.set(endPart, jsonPart.length + filePart.length + fileBytes.length);

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Referer: REFERER_HEADER,
      },
      body,
    },
    120000,
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed: HTTP ${res.status} ${errText}`);
  }

  let parsed: AstrometrySubmitResponse;
  try {
    parsed = (await res.json()) as AstrometrySubmitResponse;
  } catch {
    throw new Error("Invalid upload response");
  }

  if (parsed.status !== "success" || parsed.subid == null) {
    throw new Error(parsed.message || "Upload failed: no submission ID");
  }

  Logger.info(TAG, `Upload successful, submission ID: ${parsed.subid}`);
  return parsed.subid;
}

/**
 * 通过 URL 提交图片
 */
export async function uploadUrl(
  serverUrl: string,
  imageUrl: string,
  options: AstrometryUploadOptions,
): Promise<number> {
  Logger.info(TAG, `Submitting URL: ${imageUrl}`);

  const result = (await postJson(serverUrl, ASTROMETRY_API_PATHS.urlUpload, {
    ...options,
    url: imageUrl,
  })) as AstrometrySubmitResponse;

  if (result.status !== "success" || result.subid == null) {
    throw new Error(result.message || "URL upload failed");
  }

  Logger.info(TAG, `URL submission successful, submission ID: ${result.subid}`);
  return result.subid;
}

/**
 * 获取 submission 状态
 */
export async function getSubmissionStatus(
  serverUrl: string,
  submissionId: number,
): Promise<AstrometrySubmissionStatus> {
  const result = (await getJson(
    serverUrl,
    ASTROMETRY_API_PATHS.submissions,
    submissionId,
  )) as AstrometrySubmissionStatus;

  return result;
}

/**
 * 获取 job 状态
 */
export async function getJobStatus(
  serverUrl: string,
  jobId: number,
): Promise<AstrometryJobStatusResponse> {
  const result = (await getJson(
    serverUrl,
    ASTROMETRY_API_PATHS.jobs,
    jobId,
  )) as AstrometryJobStatusResponse;

  return result;
}

/**
 * 获取 job 标定结果
 */
export async function getJobCalibration(
  serverUrl: string,
  jobId: number,
): Promise<AstrometryCalibration> {
  const raw = (await getJson(
    serverUrl,
    ASTROMETRY_API_PATHS.jobs,
    jobId,
    "calibration",
  )) as AstrometryCalibrationResponse;

  return {
    ra: raw.ra,
    dec: raw.dec,
    radius: raw.radius,
    pixscale: raw.pixscale,
    orientation: raw.orientation,
    parity: raw.parity,
    fieldWidth: raw.widthInDeg ?? 0,
    fieldHeight: raw.heightInDeg ?? 0,
  };
}

/**
 * 获取 job 标注信息
 */
export async function getJobAnnotations(
  serverUrl: string,
  jobId: number,
): Promise<AstrometryAnnotation[]> {
  const raw = (await getJson(
    serverUrl,
    ASTROMETRY_API_PATHS.jobs,
    jobId,
    "annotations",
  )) as AstrometryAnnotationResponse[];

  if (!Array.isArray(raw)) return [];

  return raw
    .filter((a) => a.pixelx != null && a.pixely != null)
    .map((a) => ({
      type: mapAnnotationType(a.type),
      names: a.names ?? [],
      pixelx: a.pixelx!,
      pixely: a.pixely!,
      radius: a.radius,
    }));
}

/**
 * 获取 job 详细信息 (包含 tags)
 */
export async function getJobInfo(
  serverUrl: string,
  jobId: number,
): Promise<{ tags: string[]; objects_in_field: string[] }> {
  const result = (await getJson(serverUrl, ASTROMETRY_API_PATHS.jobs, jobId, "info")) as {
    tags?: string[];
    objects_in_field?: string[];
  };

  return {
    tags: result.tags ?? [],
    objects_in_field: result.objects_in_field ?? [],
  };
}

/**
 * 测试连接 (登录 + 登出)
 */
export async function testConnection(apiKey: string, serverUrl: string): Promise<boolean> {
  try {
    await login(apiKey, serverUrl);
    return true;
  } catch (e) {
    Logger.warn(TAG, "Connection test failed", e);
    return false;
  }
}

// ===== 辅助函数 =====

export function mapAnnotationType(raw: string): AstrometryAnnotationType {
  const lower = raw.toLowerCase();
  if (lower.includes("messier") || lower.startsWith("m ")) return "messier";
  if (lower.includes("ngc")) return "ngc";
  if (lower.includes("ic")) return "ic";
  if (lower.includes("hd")) return "hd";
  if (lower.includes("bright") || lower.includes("tycho")) return "bright_star";
  if (lower.includes("star")) return "star";
  return "other";
}
