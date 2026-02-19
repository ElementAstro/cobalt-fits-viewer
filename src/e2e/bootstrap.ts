import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_ASTROMETRY_CONFIG } from "../lib/astrometry/types";
import { useAlbumStore } from "../stores/useAlbumStore";
import { useAstrometryStore } from "../stores/useAstrometryStore";
import { useBackupStore } from "../stores/useBackupStore";
import { useFileGroupStore } from "../stores/useFileGroupStore";
import { useFitsStore } from "../stores/useFitsStore";
import { useOnboardingStore } from "../stores/useOnboardingStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useTargetGroupStore } from "../stores/useTargetGroupStore";
import { useTargetStore } from "../stores/useTargetStore";
import { useTrashStore } from "../stores/useTrashStore";
import {
  E2E_ALBUMS,
  E2E_ASTROMETRY_JOBS,
  E2E_BACKUP_CONNECTIONS,
  E2E_FILE_GROUP_MAP,
  E2E_FILE_GROUPS,
  E2E_FILES,
  E2E_LOG_ENTRIES,
  E2E_SESSIONS,
  E2E_TARGET_GROUPS,
  E2E_TARGETS,
} from "./seed/fullScenario";

const PERSIST_KEYS = [
  "onboarding-store",
  "settings-store",
  "fits-store",
  "album-store",
  "target-store",
  "target-group-store",
  "session-store",
  "astrometry-store",
  "backup-store",
  "trash-store",
  "file-group-store",
] as const;

let bootstrapped = false;

export async function bootstrapE2EFullScenario(): Promise<void> {
  if (bootstrapped) return;

  await AsyncStorage.multiRemove([...PERSIST_KEYS]);

  useOnboardingStore.setState(
    {
      hasCompletedOnboarding: true,
      currentStep: 0,
    },
    false,
  );

  useSettingsStore.setState(
    {
      confirmDestructiveActions: false,
      autoCheckUpdates: false,
      autoTagLocation: true,
      mapPreset: "standard",
      mapShowOverlays: true,
      defaultReminderMinutes: 0,
      calendarSyncEnabled: false,
      language: "en",
      videoCoreEnabled: true,
      videoProcessingEnabled: true,
    },
    false,
  );

  useFitsStore.setState(
    {
      files: [...E2E_FILES],
      selectedIds: [],
      isSelectionMode: false,
      searchQuery: "",
      filterTags: [],
    },
    false,
  );

  useAlbumStore.setState(
    {
      albums: [...E2E_ALBUMS],
      albumSearchQuery: "",
    },
    false,
  );

  useTargetStore.setState(
    {
      targets: [...E2E_TARGETS],
    },
    false,
  );

  useTargetGroupStore.setState(
    {
      groups: [...E2E_TARGET_GROUPS],
    },
    false,
  );

  useSessionStore.setState(
    {
      sessions: [...E2E_SESSIONS],
      logEntries: [...E2E_LOG_ENTRIES],
      plans: [],
      activeSession: null,
    },
    false,
  );

  useAstrometryStore.setState(
    {
      config: {
        ...DEFAULT_ASTROMETRY_CONFIG,
        apiKey: "e2e-api-key",
      },
      jobs: [...E2E_ASTROMETRY_JOBS],
      sessionKey: null,
      isLoggedIn: false,
    },
    false,
  );

  useBackupStore.setState(
    {
      connections: [...E2E_BACKUP_CONNECTIONS],
      activeProvider: "google-drive",
      backupInProgress: false,
      restoreInProgress: false,
      progress: {
        phase: "idle",
        current: 0,
        total: 0,
      },
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      autoBackupNetwork: "wifi",
      lastAutoBackupCheck: Date.now(),
      lastError: null,
    },
    false,
  );

  useTrashStore.setState(
    {
      items: [],
    },
    false,
  );

  useFileGroupStore.setState(
    {
      groups: [...E2E_FILE_GROUPS],
      fileGroupMap: { ...E2E_FILE_GROUP_MAP },
    },
    false,
  );

  bootstrapped = true;
}

export function resetE2EBootstrapFlag() {
  bootstrapped = false;
}
