import {
  getServerUrl,
  cancelJob,
  cancelAllJobs,
  getActiveJobCount,
  isJobActive,
  clearSession,
  ensureSession,
  solveFile,
  solveUrl,
} from "../astrometryService";
import * as client from "../astrometryClient";
import type { AstrometryConfig } from "../types";

// Mock logger
jest.mock("../../logger/logger", () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Mock client (needed since service imports it)
jest.mock("../astrometryClient", () => ({
  getApiKey: jest.fn(),
  login: jest.fn(),
  uploadFile: jest.fn(),
  uploadUrl: jest.fn(),
  getSubmissionStatus: jest.fn(),
  getJobStatus: jest.fn(),
  getJobCalibration: jest.fn(),
  getJobAnnotations: jest.fn(),
  getJobInfo: jest.fn(),
  classifyError: jest.fn((e: unknown) => ({
    code: "unknown",
    message: e instanceof Error ? e.message : String(e),
  })),
}));

const DEFAULT_CONFIG: AstrometryConfig = {
  apiKey: "test-key",
  serverUrl: "https://nova.astrometry.net",
  useCustomServer: false,
  defaultScaleUnits: "degwidth",
  maxConcurrent: 2,
  autoSolve: false,
};

const MOCK_CALIBRATION = {
  ra: 180.0,
  dec: 45.0,
  radius: 1.0,
  pixscale: 1.5,
  orientation: 90,
  parity: 0,
  fieldWidth: 2.0,
  fieldHeight: 1.5,
};

// ===== getServerUrl =====

describe("getServerUrl", () => {
  it("returns default server URL when useCustomServer is false", () => {
    expect(getServerUrl(DEFAULT_CONFIG)).toBe("https://nova.astrometry.net");
  });

  it("returns custom server URL when useCustomServer is true", () => {
    const config = { ...DEFAULT_CONFIG, useCustomServer: true, serverUrl: "https://my-server.com" };
    expect(getServerUrl(config)).toBe("https://my-server.com");
  });

  it("returns default even if serverUrl is set but useCustomServer is false", () => {
    const config = {
      ...DEFAULT_CONFIG,
      useCustomServer: false,
      serverUrl: "https://my-server.com",
    };
    expect(getServerUrl(config)).toBe("https://nova.astrometry.net");
  });
});

// ===== clearSession =====

describe("clearSession", () => {
  it("does not throw", () => {
    expect(() => clearSession()).not.toThrow();
  });

  it("clears cached session so next ensureSession re-logins", async () => {
    clearSession();
    (client.getApiKey as jest.Mock).mockResolvedValueOnce("key");
    (client.login as jest.Mock).mockResolvedValueOnce("new-session");

    const session = await ensureSession(DEFAULT_CONFIG);
    expect(session).toBe("new-session");
    expect(client.login).toHaveBeenCalled();

    // Cleanup: clear for other tests
    clearSession();
  });
});

// ===== ensureSession =====

describe("ensureSession", () => {
  beforeEach(() => {
    clearSession();
    jest.clearAllMocks();
  });

  it("throws when API key is not configured", async () => {
    (client.getApiKey as jest.Mock).mockResolvedValueOnce(null);
    await expect(ensureSession(DEFAULT_CONFIG)).rejects.toThrow("API Key not configured");
  });

  it("logs in and caches session key", async () => {
    (client.getApiKey as jest.Mock).mockResolvedValueOnce("api-key");
    (client.login as jest.Mock).mockResolvedValueOnce("session-abc");

    const s1 = await ensureSession(DEFAULT_CONFIG);
    expect(s1).toBe("session-abc");
    expect(client.login).toHaveBeenCalledTimes(1);

    // Second call should reuse cached session, no extra login
    const s2 = await ensureSession(DEFAULT_CONFIG);
    expect(s2).toBe("session-abc");
    expect(client.login).toHaveBeenCalledTimes(1);

    clearSession();
  });
});

// ===== cancelJob / cancelAllJobs / getActiveJobCount / isJobActive =====

describe("cancelJob", () => {
  it("does not throw for non-existent job", () => {
    expect(() => cancelJob("non-existent")).not.toThrow();
  });
});

describe("cancelAllJobs", () => {
  it("does not throw when no active jobs", () => {
    expect(() => cancelAllJobs()).not.toThrow();
  });
});

describe("getActiveJobCount", () => {
  it("returns 0 when no active jobs", () => {
    expect(getActiveJobCount()).toBe(0);
  });
});

describe("isJobActive", () => {
  it("returns false for non-existent job", () => {
    expect(isJobActive("non-existent")).toBe(false);
  });
});

// ===== solveFile full flow =====

describe("solveFile", () => {
  const onUpdate = jest.fn();

  beforeEach(() => {
    clearSession();
    jest.clearAllMocks();
    onUpdate.mockClear();
  });

  it("runs successful solve flow end-to-end", async () => {
    (client.getApiKey as jest.Mock).mockResolvedValue("key");
    (client.login as jest.Mock).mockResolvedValue("session");
    (client.uploadFile as jest.Mock).mockResolvedValue(100);
    (client.getSubmissionStatus as jest.Mock).mockResolvedValue({ jobs: [200] });
    (client.getJobStatus as jest.Mock).mockResolvedValue({ status: "success" });
    (client.getJobCalibration as jest.Mock).mockResolvedValue(MOCK_CALIBRATION);
    (client.getJobAnnotations as jest.Mock).mockResolvedValue([]);
    (client.getJobInfo as jest.Mock).mockResolvedValue({
      tags: ["tag1"],
      objects_in_field: ["M31"],
    });

    await solveFile("job-1", "/path/to/file.fits", DEFAULT_CONFIG, onUpdate);

    // Verify the progression of status updates
    const statusUpdates = onUpdate.mock.calls.map((c) => c[1].status).filter(Boolean);
    expect(statusUpdates).toContain("uploading");
    expect(statusUpdates).toContain("submitted");
    expect(statusUpdates).toContain("solving");
    expect(statusUpdates).toContain("success");

    // Final update should contain result
    const finalCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][1];
    expect(finalCall.status).toBe("success");
    expect(finalCall.progress).toBe(100);
    expect(finalCall.result).toBeDefined();
    expect(finalCall.result.calibration.ra).toBe(180.0);
    expect(finalCall.result.tags).toContain("tag1");
    expect(finalCall.result.tags).toContain("M31");

    clearSession();
  });

  it("reports failure when job status is failure", async () => {
    (client.getApiKey as jest.Mock).mockResolvedValue("key");
    (client.login as jest.Mock).mockResolvedValue("session");
    (client.uploadFile as jest.Mock).mockResolvedValue(100);
    (client.getSubmissionStatus as jest.Mock).mockResolvedValue({ jobs: [200] });
    (client.getJobStatus as jest.Mock).mockResolvedValue({ status: "failure" });

    await solveFile("job-2", "/path/to/file.fits", DEFAULT_CONFIG, onUpdate);

    const finalCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][1];
    expect(finalCall.status).toBe("failure");
    expect(finalCall.error).toBe("Plate solving failed");

    clearSession();
  });

  it("handles auth error and clears session", async () => {
    (client.getApiKey as jest.Mock).mockResolvedValue("key");
    (client.login as jest.Mock).mockRejectedValue(new Error("Login failed"));
    (client.classifyError as jest.Mock).mockReturnValue({ code: "auth", message: "Auth failed" });

    await solveFile("job-3", "/path/to/file.fits", DEFAULT_CONFIG, onUpdate);

    const failCall = onUpdate.mock.calls.find((c) => c[1].status === "failure");
    expect(failCall).toBeDefined();
    expect(failCall![1].error).toBe("Auth failed");
  });

  it("handles network error", async () => {
    (client.getApiKey as jest.Mock).mockResolvedValue("key");
    (client.login as jest.Mock).mockResolvedValue("session");
    (client.uploadFile as jest.Mock).mockRejectedValue(new Error("Network request failed"));
    (client.classifyError as jest.Mock).mockReturnValue({
      code: "network",
      message: "Network error",
    });

    await solveFile("job-4", "/path/to/file.fits", DEFAULT_CONFIG, onUpdate);

    const failCall = onUpdate.mock.calls.find((c) => c[1].status === "failure");
    expect(failCall).toBeDefined();
    expect(failCall![1].error).toBe("Network error");

    clearSession();
  });
});

// ===== solveUrl full flow =====

describe("solveUrl", () => {
  const onUpdate = jest.fn();

  beforeEach(() => {
    clearSession();
    jest.clearAllMocks();
    onUpdate.mockClear();
  });

  it("runs successful URL solve flow", async () => {
    (client.getApiKey as jest.Mock).mockResolvedValue("key");
    (client.login as jest.Mock).mockResolvedValue("session");
    (client.uploadUrl as jest.Mock).mockResolvedValue(101);
    (client.getSubmissionStatus as jest.Mock).mockResolvedValue({ jobs: [201] });
    (client.getJobStatus as jest.Mock).mockResolvedValue({ status: "success" });
    (client.getJobCalibration as jest.Mock).mockResolvedValue(MOCK_CALIBRATION);
    (client.getJobAnnotations as jest.Mock).mockResolvedValue([]);
    (client.getJobInfo as jest.Mock).mockResolvedValue({ tags: [], objects_in_field: [] });

    await solveUrl("job-u1", "https://example.com/img.fits", DEFAULT_CONFIG, onUpdate);

    const statusUpdates = onUpdate.mock.calls.map((c) => c[1].status).filter(Boolean);
    expect(statusUpdates).toContain("uploading");
    expect(statusUpdates).toContain("submitted");
    expect(statusUpdates).toContain("solving");
    expect(statusUpdates).toContain("success");

    clearSession();
  });

  it("handles upload URL error", async () => {
    (client.getApiKey as jest.Mock).mockResolvedValue("key");
    (client.login as jest.Mock).mockResolvedValue("session");
    (client.uploadUrl as jest.Mock).mockRejectedValue(new Error("URL upload failed"));
    (client.classifyError as jest.Mock).mockReturnValue({
      code: "unknown",
      message: "URL upload failed",
    });

    await solveUrl("job-u2", "https://example.com/img.fits", DEFAULT_CONFIG, onUpdate);

    const failCall = onUpdate.mock.calls.find((c) => c[1].status === "failure");
    expect(failCall).toBeDefined();
    expect(failCall![1].error).toBe("URL upload failed");

    clearSession();
  });
});
