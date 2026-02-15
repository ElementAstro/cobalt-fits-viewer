import { useAstrometryStore } from "../useAstrometryStore";
import type { AstrometryJob } from "../../lib/astrometry/types";
import { DEFAULT_ASTROMETRY_CONFIG } from "../../lib/astrometry/types";

// Mock storage
jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const makeJob = (overrides: Partial<AstrometryJob> = {}): AstrometryJob => ({
  id: `job-${Math.random().toString(36).slice(2, 8)}`,
  fileName: "test.fits",
  status: "pending",
  progress: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe("useAstrometryStore", () => {
  beforeEach(() => {
    // Reset store between tests
    useAstrometryStore.setState({
      config: { ...DEFAULT_ASTROMETRY_CONFIG },
      jobs: [],
      sessionKey: null,
      isLoggedIn: false,
    });
  });

  // ===== Config =====

  describe("config management", () => {
    it("starts with default config", () => {
      const { config } = useAstrometryStore.getState();
      expect(config.apiKey).toBe("");
      expect(config.serverUrl).toBe("https://nova.astrometry.net");
      expect(config.useCustomServer).toBe(false);
      expect(config.autoSolve).toBe(false);
      expect(config.maxConcurrent).toBe(3);
    });

    it("updates config partially", () => {
      useAstrometryStore.getState().setConfig({ apiKey: "my-key", autoSolve: true });
      const { config } = useAstrometryStore.getState();
      expect(config.apiKey).toBe("my-key");
      expect(config.autoSolve).toBe(true);
      // Other fields unchanged
      expect(config.serverUrl).toBe("https://nova.astrometry.net");
    });

    it("resets config to defaults", () => {
      useAstrometryStore.getState().setConfig({ apiKey: "key", autoSolve: true });
      useAstrometryStore.getState().resetConfig();
      const { config } = useAstrometryStore.getState();
      expect(config.apiKey).toBe("");
      expect(config.autoSolve).toBe(false);
    });
  });

  // ===== Session =====

  describe("session management", () => {
    it("sets session key and marks logged in", () => {
      useAstrometryStore.getState().setSessionKey("abc123");
      const state = useAstrometryStore.getState();
      expect(state.sessionKey).toBe("abc123");
      expect(state.isLoggedIn).toBe(true);
    });

    it("clears session key and marks logged out", () => {
      useAstrometryStore.getState().setSessionKey("abc");
      useAstrometryStore.getState().setSessionKey(null);
      const state = useAstrometryStore.getState();
      expect(state.sessionKey).toBeNull();
      expect(state.isLoggedIn).toBe(false);
    });

    it("setLoggedIn works independently", () => {
      useAstrometryStore.getState().setLoggedIn(true);
      expect(useAstrometryStore.getState().isLoggedIn).toBe(true);
      useAstrometryStore.getState().setLoggedIn(false);
      expect(useAstrometryStore.getState().isLoggedIn).toBe(false);
    });
  });

  // ===== Job CRUD =====

  describe("job CRUD", () => {
    it("adds a job (prepended)", () => {
      const j1 = makeJob({ id: "j1" });
      const j2 = makeJob({ id: "j2" });
      useAstrometryStore.getState().addJob(j1);
      useAstrometryStore.getState().addJob(j2);

      const { jobs } = useAstrometryStore.getState();
      expect(jobs).toHaveLength(2);
      expect(jobs[0].id).toBe("j2"); // Most recent first
      expect(jobs[1].id).toBe("j1");
    });

    it("updates a job by id", () => {
      const job = makeJob({ id: "j1", progress: 0 });
      useAstrometryStore.getState().addJob(job);

      useAstrometryStore.getState().updateJob("j1", { progress: 50, status: "solving" });

      const updated = useAstrometryStore.getState().jobs[0];
      expect(updated.progress).toBe(50);
      expect(updated.status).toBe("solving");
      expect(updated.updatedAt).toBeGreaterThanOrEqual(job.updatedAt);
    });

    it("update on non-existent job is no-op", () => {
      useAstrometryStore.getState().addJob(makeJob({ id: "j1" }));
      useAstrometryStore.getState().updateJob("not-exist", { progress: 99 });
      expect(useAstrometryStore.getState().jobs).toHaveLength(1);
      expect(useAstrometryStore.getState().jobs[0].progress).toBe(0);
    });

    it("removes a job by id", () => {
      useAstrometryStore.getState().addJob(makeJob({ id: "j1" }));
      useAstrometryStore.getState().addJob(makeJob({ id: "j2" }));

      useAstrometryStore.getState().removeJob("j1");
      const { jobs } = useAstrometryStore.getState();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe("j2");
    });

    it("clearCompletedJobs removes success/failure/cancelled", () => {
      useAstrometryStore.getState().addJob(makeJob({ id: "j1", status: "success" }));
      useAstrometryStore.getState().addJob(makeJob({ id: "j2", status: "failure" }));
      useAstrometryStore.getState().addJob(makeJob({ id: "j3", status: "cancelled" }));
      useAstrometryStore.getState().addJob(makeJob({ id: "j4", status: "solving" }));
      useAstrometryStore.getState().addJob(makeJob({ id: "j5", status: "pending" }));

      useAstrometryStore.getState().clearCompletedJobs();
      const { jobs } = useAstrometryStore.getState();
      expect(jobs).toHaveLength(2);
      expect(jobs.map((j) => j.id).sort()).toEqual(["j4", "j5"]);
    });

    it("clearAllJobs empties the list", () => {
      useAstrometryStore.getState().addJob(makeJob());
      useAstrometryStore.getState().addJob(makeJob());
      useAstrometryStore.getState().clearAllJobs();
      expect(useAstrometryStore.getState().jobs).toHaveLength(0);
    });
  });

  // ===== Queries =====

  describe("query methods", () => {
    beforeEach(() => {
      useAstrometryStore.getState().addJob(makeJob({ id: "a1", fileId: "f1", status: "pending" }));
      useAstrometryStore.getState().addJob(makeJob({ id: "a2", fileId: "f1", status: "success" }));
      useAstrometryStore.getState().addJob(makeJob({ id: "a3", fileId: "f2", status: "failure" }));
      useAstrometryStore.getState().addJob(makeJob({ id: "a4", fileId: "f2", status: "solving" }));
      useAstrometryStore
        .getState()
        .addJob(makeJob({ id: "a5", fileId: "f3", status: "uploading" }));
      useAstrometryStore
        .getState()
        .addJob(makeJob({ id: "a6", fileId: "f3", status: "submitted" }));
    });

    it("getJobById returns the job or undefined", () => {
      expect(useAstrometryStore.getState().getJobById("a1")?.id).toBe("a1");
      expect(useAstrometryStore.getState().getJobById("nope")).toBeUndefined();
    });

    it("getJobsByFileId returns jobs for a given file", () => {
      const f1Jobs = useAstrometryStore.getState().getJobsByFileId("f1");
      expect(f1Jobs).toHaveLength(2);
      expect(f1Jobs.map((j) => j.id).sort()).toEqual(["a1", "a2"]);
    });

    it("getActiveJobs returns pending/uploading/submitted/solving", () => {
      const active = useAstrometryStore.getState().getActiveJobs();
      expect(active).toHaveLength(4);
      const ids = active.map((j) => j.id).sort();
      expect(ids).toEqual(["a1", "a4", "a5", "a6"]);
    });

    it("getCompletedJobs returns only success", () => {
      const completed = useAstrometryStore.getState().getCompletedJobs();
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe("a2");
    });

    it("getFailedJobs returns only failure", () => {
      const failed = useAstrometryStore.getState().getFailedJobs();
      expect(failed).toHaveLength(1);
      expect(failed[0].id).toBe("a3");
    });
  });
});
