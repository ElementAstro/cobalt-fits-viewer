/**
 * BackupStore 状态管理测试
 */

import { useBackupStore } from "../useBackupStore";
import type { ProviderConnectionState } from "../../lib/backup/types";

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
    lastAutoBackupCheck: 0,
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

  describe("error", () => {
    it("should set and clear error", () => {
      useBackupStore.getState().setLastError("Something went wrong");
      expect(useBackupStore.getState().lastError).toBe("Something went wrong");

      useBackupStore.getState().setLastError(null);
      expect(useBackupStore.getState().lastError).toBeNull();
    });
  });
});
