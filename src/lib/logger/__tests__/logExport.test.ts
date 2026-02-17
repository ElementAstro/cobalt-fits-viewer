import { Logger } from "../logger";
import { exportLogsToFile, shareLogFile } from "../logExport";

const mockCollectSystemInfo = jest.fn();
const mockFormatSystemInfo = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();

jest.mock("../../version", () => ({
  getAppVersionInfo: () => ({
    nativeVersion: "9.9.9",
    buildVersion: "1",
    runtimeVersion: "runtime-1",
    sdkVersion: "54.0.0",
  }),
}));

jest.mock("../systemInfo", () => ({
  collectSystemInfo: (...args: unknown[]) => mockCollectSystemInfo(...args),
  formatSystemInfo: (...args: unknown[]) => mockFormatSystemInfo(...args),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock("expo-file-system", () => {
  const writes = new Map<string, string | Uint8Array>();
  const dirs = new Set<string>(["file:///cache"]);

  class Directory {
    uri: string;

    constructor(parent: string, name: string) {
      const base = parent.endsWith("/") ? parent.slice(0, -1) : parent;
      this.uri = `${base}/${name}`;
    }

    get exists() {
      return dirs.has(this.uri);
    }

    create() {
      dirs.add(this.uri);
    }

    delete() {
      dirs.delete(this.uri);
      for (const key of [...writes.keys()]) {
        if (key.startsWith(`${this.uri}/`)) {
          writes.delete(key);
        }
      }
    }
  }

  class File {
    uri: string;

    constructor(dir: Directory, name: string) {
      this.uri = `${dir.uri}/${name}`;
    }

    write(content: string | Uint8Array) {
      writes.set(this.uri, content);
    }
  }

  return {
    Paths: {
      cache: "file:///cache",
    },
    Directory,
    File,
    __mock: {
      reset: () => {
        writes.clear();
        dirs.clear();
        dirs.add("file:///cache");
      },
      getWrite: (uri: string) => writes.get(uri),
    },
  };
});

describe("logExport", () => {
  beforeEach(() => {
    const fsMock = require("expo-file-system") as {
      __mock: { reset: () => void };
    };
    fsMock.__mock.reset();

    Logger.clear();
    Logger.configure({
      minLevel: "debug",
      maxEntries: 500,
      consoleOutput: false,
    });

    mockCollectSystemInfo.mockReset();
    mockFormatSystemInfo.mockReset();
    mockIsAvailableAsync.mockReset();
    mockShareAsync.mockReset();

    mockCollectSystemInfo.mockResolvedValue({
      app: { isDebugMode: true },
      device: {},
      battery: {},
      network: {},
      runtime: {},
      collectedAt: Date.now(),
    });
    mockFormatSystemInfo.mockReturnValue("SYSTEM_INFO_TEXT");
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
  });

  it("exports JSON with appVersion from version utility and optional systemInfo", async () => {
    Logger.info("LogExportTest", "export me", { apiKey: "secret" });

    const uri = await exportLogsToFile({
      format: "json",
      includeSystemInfo: true,
    });

    expect(uri).toBeTruthy();
    expect(mockCollectSystemInfo).toHaveBeenCalledTimes(1);

    const fsMock = require("expo-file-system") as {
      __mock: { getWrite: (path: string) => string | Uint8Array | undefined };
    };
    const fileText = fsMock.__mock.getWrite(uri as string) as string;
    const parsed = JSON.parse(fileText) as {
      appVersion: string;
      systemInfo?: unknown;
      entries: Array<{ data: { apiKey: string } }>;
    };

    expect(parsed.appVersion).toBe("9.9.9");
    expect(parsed.systemInfo).toBeTruthy();
    expect(parsed.entries[0].data.apiKey).toBe("[REDACTED]");
  });

  it("exports text without collecting system info when disabled", async () => {
    Logger.info("LogExportTest", "text export");

    const uri = await exportLogsToFile({
      format: "text",
      includeSystemInfo: false,
    });

    expect(uri).toBeTruthy();
    expect(mockCollectSystemInfo).not.toHaveBeenCalled();

    const fsMock = require("expo-file-system") as {
      __mock: { getWrite: (path: string) => string | Uint8Array | undefined };
    };
    const fileText = fsMock.__mock.getWrite(uri as string);
    expect(typeof fileText).toBe("string");
    expect(fileText as string).toContain("=== COBALT FITS Viewer - Log Export ===");
  });

  it("returns false and warns when sharing is unavailable", async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    const warnSpy = jest.spyOn(Logger, "warn");

    const success = await shareLogFile({ format: "text" });
    expect(success).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith("LogExport", "Sharing is not available on this device");

    warnSpy.mockRestore();
  });
});
