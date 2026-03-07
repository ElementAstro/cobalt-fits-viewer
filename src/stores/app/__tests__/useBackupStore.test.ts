/**
 * BackupStore 状态管理测试
 */

import { useBackupStore } from "../useBackupStore";
import type { ProviderConnectionState } from "../../../lib/backup/types";

// Reset store before each test
beforeEach(() => {
  useBackupStore.setState({
    connections: [],
    activeProvider: null,
    backupInProgress: false,
    restoreInProgress: false,
    progress: { phase: "idle", current: 0, total: 0 },
    autoBackupEnabled: false,
    autoBackupIntervalHours: 24,
    autoBackupNetwork: "wifi",
    lastAutoBackupAttempt: 0,
    lastAutoBackupCheck: 0,
    lastAutoBackupResult: null,
    lastAutoBackupError: null,
    history: [],
    lastUsedBackupOptions: null,
    lastSuccessfulBackupAt: 0,
    lastError: null,
  });
});

describe("useBackupStore", () => {
  describe("connections", () => {
    it("should add a new connection", () => {
      const conn: ProviderConnectionState = {
        provider: "webdav",
        connected: true,
        userName: "user",
      };
      useBackupStore.getState().addConnection(conn);

      const state = useBackupStore.getState();
      expect(state.connections).toHaveLength(1);
      expect(state.connections[0].provider).toBe("webdav");
      expect(state.connections[0].connected).toBe(true);
    });

    it("should update an existing connection", () => {
      const conn: ProviderConnectionState = {
        provider: "webdav",
        connected: true,
        userName: "user1",
      };
      useBackupStore.getState().addConnection(conn);

      const updated: ProviderConnectionState = {
        provider: "webdav",
        connected: true,
        userName: "user2",
      };
      useBackupStore.getState().addConnection(updated);

      const state = useBackupStore.getState();
      expect(state.connections).toHaveLength(1);
      expect(state.connections[0].userName).toBe("user2");
    });

    it("should remove a connection", () => {
      useBackupStore.getState().addConnection({
        provider: "webdav",
        connected: true,
      });
      useBackupStore.getState().addConnection({
        provider: "google-drive",
        connected: true,
      });

      useBackupStore.getState().removeConnection("webdav");

      const state = useBackupStore.getState();
      expect(state.connections).toHaveLength(1);
      expect(state.connections[0].provider).toBe("google-drive");
    });

    it("should clear activeProvider when removing active connection", () => {
      useBackupStore.getState().addConnection({ provider: "webdav", connected: true });
      useBackupStore.getState().setActiveProvider("webdav");
      useBackupStore.getState().removeConnection("webdav");

      expect(useBackupStore.getState().activeProvider).toBeNull();
    });

    it("should update connection fields", () => {
      useBackupStore.getState().addConnection({ provider: "webdav", connected: true });
      useBackupStore.getState().updateConnection("webdav", { lastBackupDate: 12345 });

      const conn = useBackupStore.getState().getConnection("webdav");
      expect(conn?.lastBackupDate).toBe(12345);
    });
  });

  describe("progress", () => {
    it("should set and reset progress", () => {
      useBackupStore.getState().setProgress({ phase: "uploading", current: 3, total: 10 });
      expect(useBackupStore.getState().progress.phase).toBe("uploading");
      expect(useBackupStore.getState().progress.current).toBe(3);

      useBackupStore.getState().resetProgress();
      expect(useBackupStore.getState().progress.phase).toBe("idle");
      expect(useBackupStore.getState().progress.current).toBe(0);
    });

    it("toggles backup and restore in-progress flags", () => {
      useBackupStore.getState().setBackupInProgress(true);
      useBackupStore.getState().setRestoreInProgress(true);
      expect(useBackupStore.getState().backupInProgress).toBe(true);
      expect(useBackupStore.getState().restoreInProgress).toBe(true);

      useBackupStore.getState().setBackupInProgress(false);
      useBackupStore.getState().setRestoreInProgress(false);
      expect(useBackupStore.getState().backupInProgress).toBe(false);
      expect(useBackupStore.getState().restoreInProgress).toBe(false);
    });
  });

  describe("auto backup", () => {
    it("should toggle auto backup", () => {
      useBackupStore.getState().setAutoBackupEnabled(true);
      expect(useBackupStore.getState().autoBackupEnabled).toBe(true);

      useBackupStore.getState().setAutoBackupEnabled(false);
      expect(useBackupStore.getState().autoBackupEnabled).toBe(false);
    });

    it("should set interval and last check", () => {
      useBackupStore.getState().setAutoBackupIntervalHours(12);
      expect(useBackupStore.getState().autoBackupIntervalHours).toBe(12);

      useBackupStore.getState().setAutoBackupNetwork("any");
      expect(useBackupStore.getState().autoBackupNetwork).toBe("any");

      useBackupStore.getState().setLastAutoBackupCheck(99999);
      expect(useBackupStore.getState().lastAutoBackupCheck).toBe(99999);
    });
  });

  describe("auto backup result", () => {
    it("should set auto backup result to success", () => {
      useBackupStore.getState().setLastAutoBackupResult("success");
      expect(useBackupStore.getState().lastAutoBackupResult).toBe("success");
      expect(useBackupStore.getState().lastAutoBackupError).toBeNull();
    });

    it("should set auto backup result to failed with error", () => {
      useBackupStore.getState().setLastAutoBackupResult("failed", "network error");
      expect(useBackupStore.getState().lastAutoBackupResult).toBe("failed");
      expect(useBackupStore.getState().lastAutoBackupError).toBe("network error");
    });

    it("should clear auto backup result", () => {
      useBackupStore.getState().setLastAutoBackupResult("failed", "err");
      useBackupStore.getState().setLastAutoBackupResult(null);
      expect(useBackupStore.getState().lastAutoBackupResult).toBeNull();
      expect(useBackupStore.getState().lastAutoBackupError).toBeNull();
    });

    it("should set lastAutoBackupAttempt", () => {
      useBackupStore.getState().setLastAutoBackupAttempt(123456);
      expect(useBackupStore.getState().lastAutoBackupAttempt).toBe(123456);
    });
  });

  describe("history", () => {
    it("should add a history entry", () => {
      useBackupStore.getState().addHistoryEntry({
        type: "backup",
        provider: "webdav",
        result: "success",
        fileCount: 5,
      });

      const { history } = useBackupStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe("backup");
      expect(history[0].provider).toBe("webdav");
      expect(history[0].result).toBe("success");
      expect(history[0].fileCount).toBe(5);
      expect(history[0].id).toBeDefined();
      expect(history[0].timestamp).toBeGreaterThan(0);
    });

    it("should prepend new entries (newest first)", () => {
      useBackupStore.getState().addHistoryEntry({
        type: "backup",
        provider: "webdav",
        result: "success",
      });
      useBackupStore.getState().addHistoryEntry({
        type: "restore",
        provider: "dropbox",
        result: "failed",
        error: "timeout",
      });

      const { history } = useBackupStore.getState();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe("restore");
      expect(history[1].type).toBe("backup");
    });

    it("should cap history at 50 entries", () => {
      for (let i = 0; i < 55; i++) {
        useBackupStore.getState().addHistoryEntry({
          type: "backup",
          provider: "webdav",
          result: "success",
        });
      }
      expect(useBackupStore.getState().history).toHaveLength(50);
    });

    it("should clear history", () => {
      useBackupStore.getState().addHistoryEntry({
        type: "backup",
        provider: "webdav",
        result: "success",
      });
      expect(useBackupStore.getState().history).toHaveLength(1);

      useBackupStore.getState().clearHistory();
      expect(useBackupStore.getState().history).toHaveLength(0);
    });
  });

  describe("lastUsedBackupOptions", () => {
    it("should store last used backup options", () => {
      const options = {
        includeFiles: true,
        includeAlbums: true,
        includeTargets: false,
        includeSessions: true,
        includeSettings: true,
        includeThumbnails: false,
        localPayloadMode: "full" as const,
        localEncryption: { enabled: false },
      };
      useBackupStore.getState().setLastUsedBackupOptions(options);
      expect(useBackupStore.getState().lastUsedBackupOptions).toEqual(options);
    });

    it("should default to null", () => {
      expect(useBackupStore.getState().lastUsedBackupOptions).toBeNull();
    });
  });

  describe("history with new types", () => {
    it("should add lan-send history entry", () => {
      useBackupStore.getState().addHistoryEntry({
        type: "lan-send",
        provider: "local",
        result: "success",
      });
      const { history } = useBackupStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe("lan-send");
    });

    it("should add lan-receive history entry", () => {
      useBackupStore.getState().addHistoryEntry({
        type: "lan-receive",
        provider: "local",
        result: "failed",
        error: "connection lost",
      });
      const { history } = useBackupStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe("lan-receive");
      expect(history[0].error).toBe("connection lost");
    });
  });

  describe("error", () => {
    it("should set and clear error", () => {
      useBackupStore.getState().setLastError("Something went wrong");
      expect(useBackupStore.getState().lastError).toBe("Something went wrong");

      useBackupStore.getState().setLastError(null);
      expect(useBackupStore.getState().lastError).toBeNull();
    });
  });

  describe("history durationMs", () => {
    it("should store durationMs in history entry", () => {
      useBackupStore.getState().addHistoryEntry({
        type: "backup",
        provider: "webdav",
        result: "success",
        durationMs: 3500,
      });
      const { history } = useBackupStore.getState();
      expect(history[0].durationMs).toBe(3500);
    });

    it("should store totalSize in history entry", () => {
      useBackupStore.getState().addHistoryEntry({
        type: "backup",
        provider: "webdav",
        result: "success",
        totalSize: 1024000,
        durationMs: 2000,
      });
      const { history } = useBackupStore.getState();
      expect(history[0].totalSize).toBe(1024000);
      expect(history[0].durationMs).toBe(2000);
    });
  });

  describe("lastSuccessfulBackupAt", () => {
    it("should default to 0", () => {
      expect(useBackupStore.getState().lastSuccessfulBackupAt).toBe(0);
    });

    it("should set lastSuccessfulBackupAt", () => {
      useBackupStore.getState().setLastSuccessfulBackupAt(1700000000000);
      expect(useBackupStore.getState().lastSuccessfulBackupAt).toBe(1700000000000);
    });
  });
});
