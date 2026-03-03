import { useVideoTaskStore, MAX_TASK_HISTORY, MAX_VIDEO_RETRIES } from "../useVideoTaskStore";
import type { VideoProcessingRequest } from "../../lib/video/engine";

const baseRequest: VideoProcessingRequest = {
  sourceId: "src_1",
  sourceFilename: "test.mp4",
  inputUri: "file:///test.mp4",
  operation: "trim",
  profile: "compatibility",
  trim: { startMs: 0, endMs: 1000, reencode: true },
};

function resetStore() {
  useVideoTaskStore.setState({ tasks: [] });
}

describe("useVideoTaskStore", () => {
  beforeEach(resetStore);

  it("enqueues a task and assigns unique id", () => {
    const id = useVideoTaskStore.getState().enqueueTask(baseRequest);
    expect(id).toMatch(/^video_task_/);
    const tasks = useVideoTaskStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("pending");
    expect(tasks[0].retries).toBe(0);
  });

  it("marks task running", () => {
    const id = useVideoTaskStore.getState().enqueueTask(baseRequest);
    useVideoTaskStore.getState().markRunning(id);
    const task = useVideoTaskStore.getState().tasks[0];
    expect(task.status).toBe("running");
    expect(task.startedAt).toBeDefined();
  });

  it("marks task completed", () => {
    const id = useVideoTaskStore.getState().enqueueTask(baseRequest);
    useVideoTaskStore.getState().markRunning(id);
    useVideoTaskStore.getState().markCompleted(id, ["file:///out.mp4"], ["f1"], ["log1"]);
    const task = useVideoTaskStore.getState().tasks[0];
    expect(task.status).toBe("completed");
    expect(task.progress).toBe(1);
    expect(task.outputUris).toEqual(["file:///out.mp4"]);
    expect(task.outputFileIds).toEqual(["f1"]);
    expect(task.logLines).toEqual(["log1"]);
  });

  it("marks task failed with error and engineErrorCode", () => {
    const id = useVideoTaskStore.getState().enqueueTask(baseRequest);
    useVideoTaskStore.getState().markRunning(id);
    useVideoTaskStore.getState().markFailed(id, "ffmpeg_failed", ["err_log"], "ffmpeg_failed");
    const task = useVideoTaskStore.getState().tasks[0];
    expect(task.status).toBe("failed");
    expect(task.error).toBe("ffmpeg_failed");
    expect(task.engineErrorCode).toBe("ffmpeg_failed");
    expect(task.logLines).toEqual(["err_log"]);
  });

  it("marks task cancelled", () => {
    const id = useVideoTaskStore.getState().enqueueTask(baseRequest);
    useVideoTaskStore.getState().markRunning(id);
    useVideoTaskStore.getState().markCancelled(id);
    expect(useVideoTaskStore.getState().tasks[0].status).toBe("cancelled");
  });

  it("removes a task", () => {
    const id = useVideoTaskStore.getState().enqueueTask(baseRequest);
    useVideoTaskStore.getState().removeTask(id);
    expect(useVideoTaskStore.getState().tasks).toHaveLength(0);
  });

  it("clears finished tasks (completed/failed/cancelled)", () => {
    const id1 = useVideoTaskStore.getState().enqueueTask(baseRequest);
    const id2 = useVideoTaskStore.getState().enqueueTask(baseRequest);
    const id3 = useVideoTaskStore.getState().enqueueTask(baseRequest);
    useVideoTaskStore.getState().markCompleted(id1, [], []);
    useVideoTaskStore.getState().markFailed(id2, "err");
    // id3 stays pending
    useVideoTaskStore.getState().clearFinished();
    const remaining = useVideoTaskStore.getState().tasks;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id3);
  });

  describe("MAX_VIDEO_RETRIES guard", () => {
    it("retries a failed task up to MAX_VIDEO_RETRIES", () => {
      const id = useVideoTaskStore.getState().enqueueTask(baseRequest);
      for (let i = 0; i < MAX_VIDEO_RETRIES; i++) {
        useVideoTaskStore.getState().markRunning(id);
        useVideoTaskStore.getState().markFailed(id, "err");
        useVideoTaskStore.getState().retryTask(id);
        const task = useVideoTaskStore.getState().tasks.find((t) => t.id === id)!;
        expect(task.status).toBe("pending");
        expect(task.retries).toBe(i + 1);
      }
    });

    it("refuses retry beyond MAX_VIDEO_RETRIES", () => {
      const id = useVideoTaskStore.getState().enqueueTask(baseRequest);
      for (let i = 0; i < MAX_VIDEO_RETRIES; i++) {
        useVideoTaskStore.getState().markRunning(id);
        useVideoTaskStore.getState().markFailed(id, "err");
        useVideoTaskStore.getState().retryTask(id);
      }
      // Now at max retries — fail again and try to retry
      useVideoTaskStore.getState().markRunning(id);
      useVideoTaskStore.getState().markFailed(id, "err");
      useVideoTaskStore.getState().retryTask(id);
      const task = useVideoTaskStore.getState().tasks.find((t) => t.id === id)!;
      expect(task.status).toBe("failed");
      expect(task.retries).toBe(MAX_VIDEO_RETRIES);
    });
  });

  describe("MAX_TASK_HISTORY auto-cleanup", () => {
    it("trims old finished tasks when exceeding MAX_TASK_HISTORY", () => {
      // Fill with completed tasks
      for (let i = 0; i < MAX_TASK_HISTORY; i++) {
        const id = useVideoTaskStore.getState().enqueueTask({
          ...baseRequest,
          sourceFilename: `file_${i}.mp4`,
        });
        useVideoTaskStore.getState().markCompleted(id, [], []);
      }
      expect(useVideoTaskStore.getState().tasks).toHaveLength(MAX_TASK_HISTORY);

      // Adding one more should trigger cleanup
      useVideoTaskStore.getState().enqueueTask(baseRequest);
      expect(useVideoTaskStore.getState().tasks.length).toBeLessThanOrEqual(MAX_TASK_HISTORY);
    });

    it("does not remove running/pending tasks during cleanup", () => {
      // Fill with running tasks (non-removable)
      const runningIds: string[] = [];
      for (let i = 0; i < MAX_TASK_HISTORY; i++) {
        const id = useVideoTaskStore.getState().enqueueTask({
          ...baseRequest,
          sourceFilename: `file_${i}.mp4`,
        });
        useVideoTaskStore.getState().markRunning(id);
        runningIds.push(id);
      }

      // Adding one more — running tasks can't be cleaned
      useVideoTaskStore.getState().enqueueTask(baseRequest);
      const tasks = useVideoTaskStore.getState().tasks;
      // All running tasks should still exist
      for (const rid of runningIds) {
        expect(tasks.find((t) => t.id === rid)).toBeDefined();
      }
    });
  });
});
