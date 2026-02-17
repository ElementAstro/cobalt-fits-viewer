/**
 * Astrometry.net UI Hook
 * 封装 store + service 交互，提供给页面组件使用
 */

import { useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import * as Crypto from "expo-crypto";
import { useAstrometryStore } from "../stores/useAstrometryStore";
import { useFitsStore } from "../stores/useFitsStore";
import * as service from "../lib/astrometry/astrometryService";
import * as clientApi from "../lib/astrometry/astrometryClient";
import * as Haptics from "expo-haptics";
import { useHapticFeedback } from "./useHapticFeedback";
import type { AstrometryJob } from "../lib/astrometry/types";
import { LOG_TAGS, Logger } from "../lib/logger";

function generateId(): string {
  return Crypto.randomUUID();
}

export function useAstrometry() {
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const haptics = useHapticFeedback();

  const { config, jobs } = useAstrometryStore(
    useShallow((s) => ({ config: s.config, jobs: s.jobs })),
  );

  const addJob = useAstrometryStore((s) => s.addJob);
  const updateJob = useAstrometryStore((s) => s.updateJob);
  const removeJob = useAstrometryStore((s) => s.removeJob);
  const clearCompletedJobs = useAstrometryStore((s) => s.clearCompletedJobs);
  const getActiveJobs = useAstrometryStore((s) => s.getActiveJobs);
  const getCompletedJobs = useAstrometryStore((s) => s.getCompletedJobs);
  const getFailedJobs = useAstrometryStore((s) => s.getFailedJobs);
  const setConfig = useAstrometryStore((s) => s.setConfig);

  const getFile = useFitsStore((s) => s.getFileById);

  // 任务更新回调
  const onJobUpdate = useCallback(
    (jobId: string, updates: Partial<AstrometryJob>) => {
      updateJob(jobId, updates);
    },
    [updateJob],
  );

  // 处理队列中的任务
  const processQueue = useCallback(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const activeCount = service.getActiveJobCount();
    const maxConcurrent = config.maxConcurrent;

    while (queueRef.current.length > 0 && activeCount + queueRef.current.length > 0) {
      if (service.getActiveJobCount() >= maxConcurrent) break;

      const jobId = queueRef.current.shift();
      if (!jobId) break;

      const job = useAstrometryStore.getState().getJobById(jobId);
      if (!job || job.status !== "pending") continue;

      // 启动解析
      const currentConfig = useAstrometryStore.getState().config;
      if (job.fileId) {
        const file = useFitsStore.getState().getFileById(job.fileId);
        if (file) {
          service.solveFile(jobId, file.filepath, currentConfig, onJobUpdate);
        } else {
          updateJob(jobId, { status: "failure", error: "File not found" });
        }
      }
    }

    processingRef.current = false;
  }, [config.maxConcurrent, onJobUpdate, updateJob]);

  // 提交 FITS 文件
  const submitFile = useCallback(
    (fileId: string) => {
      const file = getFile(fileId);
      if (!file) return null;

      const job: AstrometryJob = {
        id: generateId(),
        fileId,
        fileName: file.filename,
        thumbnailUri: file.thumbnailUri,
        status: "pending",
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addJob(job);
      queueRef.current.push(job.id);

      // 直接启动（如果并行数允许）
      const currentConfig = useAstrometryStore.getState().config;
      if (service.getActiveJobCount() < currentConfig.maxConcurrent) {
        service.solveFile(job.id, file.filepath, currentConfig, onJobUpdate);
      }

      return job.id;
    },
    [getFile, addJob, onJobUpdate],
  );

  // 提交图片 URI
  const submitImage = useCallback(
    (uri: string, fileName: string) => {
      const job: AstrometryJob = {
        id: generateId(),
        fileName,
        status: "pending",
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addJob(job);

      const currentConfig = useAstrometryStore.getState().config;
      if (service.getActiveJobCount() < currentConfig.maxConcurrent) {
        service.solveFile(job.id, uri, currentConfig, onJobUpdate);
      } else {
        queueRef.current.push(job.id);
      }

      return job.id;
    },
    [addJob, onJobUpdate],
  );

  // 通过 URL 提交
  const submitUrl = useCallback(
    (imageUrl: string, fileName: string) => {
      const job: AstrometryJob = {
        id: generateId(),
        fileName,
        status: "pending",
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addJob(job);

      const currentConfig = useAstrometryStore.getState().config;
      if (service.getActiveJobCount() < currentConfig.maxConcurrent) {
        service.solveUrl(job.id, imageUrl, currentConfig, onJobUpdate);
      } else {
        queueRef.current.push(job.id);
      }

      return job.id;
    },
    [addJob, onJobUpdate],
  );

  // 取消任务
  const cancelJob = useCallback(
    (jobId: string) => {
      service.cancelJob(jobId);
      updateJob(jobId, { status: "cancelled", progress: 0 });
    },
    [updateJob],
  );

  // 重试失败任务
  const retryJob = useCallback(
    (jobId: string) => {
      const job = useAstrometryStore.getState().getJobById(jobId);
      if (!job) return;

      updateJob(jobId, {
        status: "pending",
        progress: 0,
        error: undefined,
        submissionId: undefined,
        jobId: undefined,
        result: undefined,
      });

      const currentConfig = useAstrometryStore.getState().config;
      if (job.fileId) {
        const file = useFitsStore.getState().getFileById(job.fileId);
        if (file) {
          service.solveFile(jobId, file.filepath, currentConfig, onJobUpdate);
        }
      }
    },
    [updateJob, onJobUpdate],
  );

  // 测试连接
  const testConnection = useCallback(async (): Promise<boolean> => {
    const apiKey = await clientApi.getApiKey();
    if (!apiKey) return false;

    const currentConfig = useAstrometryStore.getState().config;
    const serverUrl = service.getServerUrl(currentConfig);
    return clientApi.testConnection(apiKey, serverUrl);
  }, []);

  // 保存 API Key
  const saveApiKey = useCallback(
    async (key: string) => {
      await clientApi.saveApiKey(key);
      setConfig({ apiKey: key ? "configured" : "" });
      service.clearSession();
    },
    [setConfig],
  );

  // 自动恢复：应用重启后将中断的 uploading/submitted/solving 任务标记为 pending 并重新入队
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;

    const staleJobs = useAstrometryStore
      .getState()
      .jobs.filter(
        (j) => j.status === "uploading" || j.status === "submitted" || j.status === "solving",
      );

    if (staleJobs.length === 0) return;

    Logger.info(LOG_TAGS.useAstrometry, `Resuming ${staleJobs.length} interrupted jobs`);
    for (const j of staleJobs) {
      updateJob(j.id, { status: "pending", progress: 0 });
      queueRef.current.push(j.id);
    }

    // 延迟触发队列处理
    setTimeout(() => processQueue(), 500);
  }, [updateJob, processQueue]);

  // 批量提交多个 FITS 文件
  const submitBatch = useCallback(
    (fileIds: string[]) => {
      const jobIds: string[] = [];
      for (const fileId of fileIds) {
        const file = useFitsStore.getState().getFileById(fileId);
        if (!file) continue;

        const job: AstrometryJob = {
          id: generateId(),
          fileId,
          fileName: file.filename,
          thumbnailUri: file.thumbnailUri,
          status: "pending",
          progress: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        addJob(job);
        queueRef.current.push(job.id);
        jobIds.push(job.id);
      }

      // 启动队列处理
      processQueue();
      if (jobIds.length > 0) {
        haptics.notify(Haptics.NotificationFeedbackType.Success);
      }

      return jobIds;
    },
    [addJob, processQueue, haptics],
  );

  // 取消所有活跃任务
  const cancelAllJobs = useCallback(() => {
    service.cancelAllJobs();
    const active = useAstrometryStore.getState().getActiveJobs();
    for (const j of active) {
      updateJob(j.id, { status: "cancelled", progress: 0 });
    }
    queueRef.current = [];
  }, [updateJob]);

  // 派生状态
  const activeJobs = getActiveJobs();
  const completedJobs = getCompletedJobs();
  const failedJobs = getFailedJobs();
  const isProcessing = activeJobs.length > 0;

  return {
    // 状态
    config,
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    isProcessing,

    // 操作
    submitFile,
    submitImage,
    submitUrl,
    submitBatch,
    cancelJob,
    cancelAllJobs,
    retryJob,
    removeJob,
    clearCompletedJobs,
    testConnection,
    saveApiKey,
    setConfig,
    processQueue,
  };
}
