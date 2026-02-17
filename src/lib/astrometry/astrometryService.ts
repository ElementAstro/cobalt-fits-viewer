/**
 * Astrometry.net 多任务管理服务
 * 管理并行任务队列、轮询、重试
 */

import { LOG_TAGS, Logger } from "../logger";
import * as client from "./astrometryClient";
import type {
  AstrometryJob,
  AstrometryJobStatus,
  AstrometryResult,
  AstrometryUploadOptions,
  AstrometryConfig,
} from "./types";
import { ASTROMETRY_POLL_INTERVAL, ASTROMETRY_MAX_POLL_ATTEMPTS } from "./types";

const POLL_BACKOFF_MAX = 15000;

const TAG = LOG_TAGS.AstrometryService;

// ===== 回调类型 =====

export type JobUpdateCallback = (jobId: string, updates: Partial<AstrometryJob>) => void;

// ===== 活跃任务追踪 =====

const activeControllers = new Map<string, AbortController>();
let sessionKey: string | null = null;

// ===== Session 管理 =====

export async function ensureSession(config: AstrometryConfig): Promise<string> {
  if (sessionKey) return sessionKey;

  const apiKey = await client.getApiKey();
  if (!apiKey) {
    throw new Error("API Key not configured");
  }

  const serverUrl = config.useCustomServer ? config.serverUrl : "https://nova.astrometry.net";
  sessionKey = await client.login(apiKey, serverUrl);
  return sessionKey;
}

export function clearSession(): void {
  sessionKey = null;
}

export function getServerUrl(config: AstrometryConfig): string {
  return config.useCustomServer ? config.serverUrl : "https://nova.astrometry.net";
}

// ===== 核心解析流程 =====

/**
 * 执行完整的 plate solving 流程:
 * upload → poll submission → get job ID → poll job → fetch results
 */
export async function solveFile(
  jobId: string,
  fileUri: string,
  config: AstrometryConfig,
  onUpdate: JobUpdateCallback,
): Promise<void> {
  const controller = new AbortController();
  activeControllers.set(jobId, controller);

  const serverUrl = getServerUrl(config);

  try {
    // 1. 确保已登录
    const session = await ensureSession(config);

    // 2. 上传文件
    onUpdate(jobId, { status: "uploading", progress: 10 });
    checkAborted(controller);

    const uploadOptions: AstrometryUploadOptions = {
      session,
      publicly_visible: "n",
    };
    if (config.defaultScaleLower != null && config.defaultScaleUpper != null) {
      uploadOptions.scale_units = config.defaultScaleUnits;
      uploadOptions.scale_lower = config.defaultScaleLower;
      uploadOptions.scale_upper = config.defaultScaleUpper;
    }

    const submissionId = await client.uploadFile(serverUrl, fileUri, uploadOptions);
    onUpdate(jobId, { submissionId, status: "submitted", progress: 30 });
    checkAborted(controller);

    // 3. 轮询 submission 获取 job ID
    const remoteJobId = await pollSubmission(serverUrl, submissionId, controller);
    onUpdate(jobId, { jobId: remoteJobId, status: "solving", progress: 50 });
    checkAborted(controller);

    // 4. 轮询 job 等待完成
    const jobStatus = await pollJob(serverUrl, remoteJobId, controller, (progress) => {
      onUpdate(jobId, { progress });
    });

    if (jobStatus !== "success") {
      onUpdate(jobId, { status: "failure", error: "Plate solving failed", progress: 100 });
      return;
    }

    // 5. 获取结果
    onUpdate(jobId, { progress: 90 });
    const result = await fetchResults(serverUrl, remoteJobId);

    onUpdate(jobId, {
      status: "success",
      progress: 100,
      result,
    });

    Logger.info(TAG, `Job ${jobId} solved successfully`, {
      ra: result.calibration.ra,
      dec: result.calibration.dec,
    });
  } catch (e) {
    handleSolveError(jobId, e, controller, onUpdate);
  } finally {
    activeControllers.delete(jobId);
  }
}

/**
 * 通过 URL 执行 plate solving
 */
export async function solveUrl(
  jobId: string,
  imageUrl: string,
  config: AstrometryConfig,
  onUpdate: JobUpdateCallback,
): Promise<void> {
  const controller = new AbortController();
  activeControllers.set(jobId, controller);

  const serverUrl = getServerUrl(config);

  try {
    const session = await ensureSession(config);

    onUpdate(jobId, { status: "uploading", progress: 10 });
    checkAborted(controller);

    const uploadOptions: AstrometryUploadOptions = {
      session,
      publicly_visible: "n",
    };
    if (config.defaultScaleLower != null && config.defaultScaleUpper != null) {
      uploadOptions.scale_units = config.defaultScaleUnits;
      uploadOptions.scale_lower = config.defaultScaleLower;
      uploadOptions.scale_upper = config.defaultScaleUpper;
    }

    const submissionId = await client.uploadUrl(serverUrl, imageUrl, uploadOptions);
    onUpdate(jobId, { submissionId, status: "submitted", progress: 30 });
    checkAborted(controller);

    const remoteJobId = await pollSubmission(serverUrl, submissionId, controller);
    onUpdate(jobId, { jobId: remoteJobId, status: "solving", progress: 50 });
    checkAborted(controller);

    const jobStatus = await pollJob(serverUrl, remoteJobId, controller, (progress) => {
      onUpdate(jobId, { progress });
    });

    if (jobStatus !== "success") {
      onUpdate(jobId, { status: "failure", error: "Plate solving failed", progress: 100 });
      return;
    }

    onUpdate(jobId, { progress: 90 });
    const result = await fetchResults(serverUrl, remoteJobId);
    onUpdate(jobId, { status: "success", progress: 100, result });
  } catch (e) {
    handleSolveError(jobId, e, controller, onUpdate);
  } finally {
    activeControllers.delete(jobId);
  }
}

function handleSolveError(
  jobId: string,
  e: unknown,
  controller: AbortController,
  onUpdate: JobUpdateCallback,
): void {
  if (controller.signal.aborted) {
    onUpdate(jobId, { status: "cancelled", progress: 0 });
    Logger.info(TAG, `Job ${jobId} cancelled`);
    return;
  }

  const classified = client.classifyError(e);
  onUpdate(jobId, { status: "failure", error: classified.message, progress: 100 });
  Logger.error(TAG, `Job ${jobId} failed [${classified.code}]: ${classified.message}`, e);

  if (classified.code === "auth") {
    clearSession();
  }
}

// ===== 任务控制 =====

export function cancelJob(jobId: string): void {
  const controller = activeControllers.get(jobId);
  if (controller) {
    controller.abort();
    Logger.info(TAG, `Cancelling job: ${jobId}`);
  }
}

export function cancelAllJobs(): void {
  for (const [id, controller] of activeControllers) {
    controller.abort();
    Logger.info(TAG, `Cancelling job: ${id}`);
  }
}

export function getActiveJobCount(): number {
  return activeControllers.size;
}

export function isJobActive(jobId: string): boolean {
  return activeControllers.has(jobId);
}

// ===== 内部工具函数 =====

function checkAborted(controller: AbortController): void {
  if (controller.signal.aborted) {
    throw new Error("Cancelled");
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Cancelled"));
    });
  });
}

/**
 * 轮询 submission 直到获得 job ID (exponential backoff)
 */
async function pollSubmission(
  serverUrl: string,
  submissionId: number,
  controller: AbortController,
): Promise<number> {
  let consecutiveErrors = 0;

  for (let i = 0; i < ASTROMETRY_MAX_POLL_ATTEMPTS; i++) {
    checkAborted(controller);

    try {
      const status = await client.getSubmissionStatus(serverUrl, submissionId);
      consecutiveErrors = 0;

      if (status.jobs && status.jobs.length > 0) {
        const jobId = status.jobs[0];
        if (jobId != null && jobId > 0) {
          Logger.debug(TAG, `Submission ${submissionId} → job ${jobId}`);
          return jobId;
        }
      }
    } catch (e) {
      consecutiveErrors++;
      Logger.warn(TAG, `Poll submission ${submissionId} error (${consecutiveErrors})`, e);
      if (consecutiveErrors >= 5) {
        throw new Error("Too many consecutive polling errors for submission");
      }
    }

    // Exponential backoff: start at POLL_INTERVAL, grow up to POLL_BACKOFF_MAX
    const backoffMs = Math.min(
      POLL_BACKOFF_MAX,
      ASTROMETRY_POLL_INTERVAL * Math.pow(1.3, Math.min(i, 20)),
    );
    await delay(backoffMs, controller.signal);
  }

  throw new Error("Timeout: no job ID received from submission");
}

/**
 * 轮询 job 状态直到完成 (exponential backoff + smoother progress)
 */
async function pollJob(
  serverUrl: string,
  jobId: number,
  controller: AbortController,
  onProgress: (progress: number) => void,
): Promise<AstrometryJobStatus> {
  let consecutiveErrors = 0;
  const startTime = Date.now();

  for (let i = 0; i < ASTROMETRY_MAX_POLL_ATTEMPTS; i++) {
    checkAborted(controller);

    try {
      const status = await client.getJobStatus(serverUrl, jobId);
      consecutiveErrors = 0;
      Logger.debug(TAG, `Job ${jobId} status: ${status.status}`);

      if (status.status === "success" || status.status === "failure") {
        return status.status;
      }

      // Smoother progress: time-based logarithmic curve (50→85)
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(85, 50 + Math.floor(35 * (1 - Math.exp(-elapsed / 120))));
      onProgress(progress);
    } catch (e) {
      consecutiveErrors++;
      Logger.warn(TAG, `Poll job ${jobId} error (${consecutiveErrors})`, e);
      if (consecutiveErrors >= 5) {
        throw new Error("Too many consecutive polling errors for job");
      }
    }

    const backoffMs = Math.min(
      POLL_BACKOFF_MAX,
      ASTROMETRY_POLL_INTERVAL * Math.pow(1.3, Math.min(i, 20)),
    );
    await delay(backoffMs, controller.signal);
  }

  throw new Error("Timeout: job did not complete in time");
}

/**
 * 获取解析结果 (标定 + 标注 + 标签)
 */
async function fetchResults(serverUrl: string, jobId: number): Promise<AstrometryResult> {
  const [calibration, annotations, info] = await Promise.all([
    client.getJobCalibration(serverUrl, jobId),
    client.getJobAnnotations(serverUrl, jobId),
    client.getJobInfo(serverUrl, jobId),
  ]);

  return {
    calibration,
    annotations,
    tags: [...info.tags, ...info.objects_in_field],
  };
}
