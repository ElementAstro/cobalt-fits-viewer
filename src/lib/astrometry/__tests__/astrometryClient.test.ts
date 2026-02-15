import {
  classifyError,
  mapAnnotationType,
  buildUrl,
  saveApiKey,
  getApiKey,
  deleteApiKey,
  testConnection,
  login,
} from "../astrometryClient";
import * as SecureStore from "expo-secure-store";

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock expo-file-system
jest.mock("expo-file-system", () => ({
  File: jest.fn(),
  Paths: { cache: "/cache" },
}));

// Mock logger
jest.mock("../../logger/logger", () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// ===== classifyError =====

describe("classifyError", () => {
  it("classifies auth errors", () => {
    expect(classifyError(new Error("Invalid API key"))).toEqual({
      code: "auth",
      message: "Authentication failed. Check your API key.",
    });
    expect(classifyError(new Error("Login failed"))).toEqual({
      code: "auth",
      message: "Authentication failed. Check your API key.",
    });
    expect(classifyError(new Error("Session expired"))).toEqual({
      code: "auth",
      message: "Authentication failed. Check your API key.",
    });
  });

  it("classifies network errors", () => {
    expect(classifyError(new Error("Network request failed"))).toEqual({
      code: "network",
      message: "Network error. Check your connection and try again.",
    });
    expect(classifyError(new Error("Failed to fetch"))).toEqual({
      code: "network",
      message: "Network error. Check your connection and try again.",
    });
    expect(classifyError(new Error("Request timeout"))).toEqual({
      code: "network",
      message: "Network error. Check your connection and try again.",
    });
  });

  it("classifies not found errors", () => {
    expect(classifyError(new Error("Resource not found"))).toEqual({
      code: "not_found",
      message: "Resource not found on server.",
    });
    expect(classifyError(new Error("HTTP 404"))).toEqual({
      code: "not_found",
      message: "Resource not found on server.",
    });
  });

  it("classifies rate limit errors", () => {
    expect(classifyError(new Error("HTTP 429 Too Many Requests"))).toEqual({
      code: "rate_limit",
      message: "Rate limited. Please wait before retrying.",
    });
    expect(classifyError(new Error("Rate limit exceeded"))).toEqual({
      code: "rate_limit",
      message: "Rate limited. Please wait before retrying.",
    });
  });

  it("classifies server errors (5xx)", () => {
    expect(classifyError(new Error("HTTP 500 Internal Server Error"))).toEqual({
      code: "server",
      message: "Server error. The service may be temporarily unavailable.",
    });
    expect(classifyError(new Error("HTTP 502 Bad Gateway"))).toEqual({
      code: "server",
      message: "Server error. The service may be temporarily unavailable.",
    });
    expect(classifyError(new Error("HTTP 503 Service Unavailable"))).toEqual({
      code: "server",
      message: "Server error. The service may be temporarily unavailable.",
    });
    expect(classifyError(new Error("http 504 Gateway Timeout"))).toEqual({
      code: "server",
      message: "Server error. The service may be temporarily unavailable.",
    });
  });

  it("does not misclassify non-5xx as server error", () => {
    // "HTTP 415" should NOT match server error
    const r = classifyError(new Error("HTTP 415 Unsupported"));
    expect(r.code).not.toBe("server");
  });

  it("does not classify non-5xx HTTP codes as server errors", () => {
    expect(classifyError(new Error("HTTP 250 OK"))).toEqual({
      code: "unknown",
      message: "HTTP 250 OK",
    });
    expect(classifyError(new Error("http 301 redirect"))).toEqual({
      code: "unknown",
      message: "http 301 redirect",
    });
  });

  it("classifies unknown errors", () => {
    expect(classifyError(new Error("Something weird happened"))).toEqual({
      code: "unknown",
      message: "Something weird happened",
    });
  });

  it("handles non-Error objects", () => {
    const result = classifyError("plain string error");
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("plain string error");
  });

  it("handles numbers", () => {
    const result = classifyError(42);
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("42");
  });

  it("handles null/undefined", () => {
    expect(classifyError(null).code).toBe("unknown");
    expect(classifyError(undefined).code).toBe("unknown");
  });
});

// ===== mapAnnotationType =====

describe("mapAnnotationType", () => {
  it("maps Messier types", () => {
    expect(mapAnnotationType("Messier")).toBe("messier");
    expect(mapAnnotationType("M 31")).toBe("messier");
    expect(mapAnnotationType("messier object")).toBe("messier");
  });

  it("maps NGC types", () => {
    expect(mapAnnotationType("NGC")).toBe("ngc");
    expect(mapAnnotationType("ngc object")).toBe("ngc");
  });

  it("maps IC types", () => {
    expect(mapAnnotationType("IC")).toBe("ic");
    expect(mapAnnotationType("ic catalog")).toBe("ic");
  });

  it("maps HD types", () => {
    expect(mapAnnotationType("HD")).toBe("hd");
    expect(mapAnnotationType("hd star")).toBe("hd");
  });

  it("maps bright star types", () => {
    expect(mapAnnotationType("bright star")).toBe("bright_star");
    expect(mapAnnotationType("Tycho-2")).toBe("bright_star");
  });

  it("maps star types", () => {
    expect(mapAnnotationType("star")).toBe("star");
  });

  it("defaults to other", () => {
    expect(mapAnnotationType("unknown thing")).toBe("other");
    expect(mapAnnotationType("")).toBe("other");
  });
});

// ===== buildUrl =====

describe("buildUrl", () => {
  it("builds base URL with path", () => {
    expect(buildUrl("https://nova.astrometry.net", "/api/login")).toBe(
      "https://nova.astrometry.net/api/login",
    );
  });

  it("strips trailing slash from server URL", () => {
    expect(buildUrl("https://nova.astrometry.net/", "/api/login")).toBe(
      "https://nova.astrometry.net/api/login",
    );
  });

  it("strips multiple trailing slashes", () => {
    expect(buildUrl("https://nova.astrometry.net///", "/api/login")).toBe(
      "https://nova.astrometry.net/api/login",
    );
  });

  it("appends path segments", () => {
    expect(buildUrl("https://nova.astrometry.net", "/api/jobs", 12345)).toBe(
      "https://nova.astrometry.net/api/jobs/12345",
    );
  });

  it("appends multiple segments", () => {
    expect(buildUrl("https://nova.astrometry.net", "/api/jobs", 123, "calibration")).toBe(
      "https://nova.astrometry.net/api/jobs/123/calibration",
    );
  });

  it("handles no segments", () => {
    expect(buildUrl("https://example.com", "/path")).toBe("https://example.com/path");
  });

  it("handles numeric and string segments", () => {
    expect(buildUrl("https://example.com", "/api", 42, "info")).toBe(
      "https://example.com/api/42/info",
    );
  });
});

// ===== API Key storage =====

describe("API Key storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("saves API key to secure store", async () => {
    await saveApiKey("my-key");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("astrometry_api_key", "my-key");
  });

  it("retrieves API key from secure store", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("stored-key");
    const key = await getApiKey();
    expect(key).toBe("stored-key");
  });

  it("returns null when no key stored", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
    const key = await getApiKey();
    expect(key).toBeNull();
  });

  it("deletes API key", async () => {
    await deleteApiKey();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("astrometry_api_key");
  });
});

// ===== login =====

describe("login", () => {
  const serverUrl = "https://nova.astrometry.net";

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    delete (global as Record<string, unknown>).fetch;
  });

  it("returns session key on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", session: "abc123", message: "" }),
      text: async () => "",
    });

    const session = await login("test-key", serverUrl);
    expect(session).toBe("abc123");
  });

  it("throws on failed login response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "error", message: "Invalid API key" }),
      text: async () => "",
    });

    await expect(login("bad-key", serverUrl)).rejects.toThrow("Invalid API key");
  });

  it("throws on HTTP error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(login("key", serverUrl)).rejects.toThrow("HTTP 500");
  });
});

// ===== testConnection =====

describe("testConnection", () => {
  const serverUrl = "https://nova.astrometry.net";

  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    delete (global as Record<string, unknown>).fetch;
  });

  it("returns true on successful login", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "success", session: "s123", message: "" }),
      text: async () => "",
    });

    expect(await testConnection("good-key", serverUrl)).toBe(true);
  });

  it("returns false on failed login", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "error", message: "bad" }),
      text: async () => "",
    });

    expect(await testConnection("bad-key", serverUrl)).toBe(false);
  });

  it("returns false on network error", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network request failed"));
    expect(await testConnection("key", serverUrl)).toBe(false);
  });
});
