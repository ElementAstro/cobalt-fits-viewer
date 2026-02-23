/**
 * RestoreTarget 工厂函数
 * 从 useBackup.ts 中提取，可独立于 React 测试
 */

import type { RestoreTarget } from "./backupService";
import type { CloudProvider, RestoreConflictStrategy } from "./types";
import type { useFitsStore } from "../../stores/useFitsStore";
import type { useAlbumStore } from "../../stores/useAlbumStore";
import type { useTargetStore } from "../../stores/useTargetStore";
import type { useTargetGroupStore } from "../../stores/useTargetGroupStore";
import type { useSessionStore } from "../../stores/useSessionStore";
import type { useSettingsStore } from "../../stores/useSettingsStore";
import type { useFileGroupStore } from "../../stores/useFileGroupStore";
import type { useAstrometryStore } from "../../stores/useAstrometryStore";
import type { useTrashStore } from "../../stores/useTrashStore";
import { normalizeSettingsBackupPatch } from "../../stores/useSettingsStore";
import { normalizeTargetMatch } from "../targets/targetRelations";
import { resolveTargetId, resolveTargetName } from "../targets/targetRefs";
import { mergeSessionLike } from "../sessions/sessionNormalization";

interface RestoreTargetStores {
  fitsStore: typeof useFitsStore;
  albumStore: typeof useAlbumStore;
  targetStore: typeof useTargetStore;
  targetGroupStore: typeof useTargetGroupStore;
  sessionStore: typeof useSessionStore;
  settingsStore: typeof useSettingsStore;
  fileGroupStore: typeof useFileGroupStore;
  astrometryStore: typeof useAstrometryStore;
  trashStore: typeof useTrashStore;
}

interface RestoreTargetCallbacks {
  setAutoBackupEnabled: (enabled: boolean) => void;
  setAutoBackupIntervalHours: (hours: number) => void;
  setAutoBackupNetwork: (network: "wifi" | "any") => void;
  setActiveProvider: (provider: CloudProvider | null) => void;
}

function resolveStrategy(strategy: RestoreConflictStrategy | undefined): RestoreConflictStrategy {
  return strategy ?? "skip-existing";
}

export function createRestoreTarget(
  stores: RestoreTargetStores,
  callbacks: RestoreTargetCallbacks,
): RestoreTarget {
  const {
    fitsStore,
    albumStore,
    targetStore,
    targetGroupStore,
    sessionStore,
    settingsStore,
    fileGroupStore,
    astrometryStore,
    trashStore,
  } = stores;

  return {
    setFiles: (files, strategy) => {
      const mode = resolveStrategy(strategy);
      const store = fitsStore.getState();
      for (const file of files) {
        const existing = store.files.find((f) => f.id === file.id);
        if (!existing) {
          store.addFile(file);
          continue;
        }

        if (mode === "skip-existing") continue;
        if (mode === "overwrite-existing") {
          store.updateFile(file.id, file);
          continue;
        }

        const mergedTags = [...new Set([...(existing.tags ?? []), ...(file.tags ?? [])])];
        const mergedAlbumIds = [
          ...new Set([...(existing.albumIds ?? []), ...(file.albumIds ?? [])]),
        ];
        store.updateFile(file.id, { ...file, tags: mergedTags, albumIds: mergedAlbumIds });
      }
    },
    setAlbums: (albums, strategy) => {
      const mode = resolveStrategy(strategy);
      const store = albumStore.getState();
      for (const album of albums) {
        const existing = store.albums.find((a) => a.id === album.id);
        if (!existing) {
          store.addAlbum(album);
          continue;
        }

        if (mode === "skip-existing") continue;
        if (mode === "overwrite-existing") {
          store.updateAlbum(album.id, album);
          continue;
        }

        store.updateAlbum(album.id, {
          ...album,
          imageIds: [...new Set([...(existing.imageIds ?? []), ...(album.imageIds ?? [])])],
          coverImageId: existing.coverImageId ?? album.coverImageId,
        });
      }
    },
    setTargets: (targets, strategy) => {
      const mode = resolveStrategy(strategy);
      const store = targetStore.getState();
      for (const target of targets) {
        const currentTargets = targetStore.getState().targets;
        const existingById = currentTargets.find((t) => t.id === target.id);
        const existingByName =
          existingById ??
          normalizeTargetMatch({
            name: target.name,
            aliases: target.aliases,
            targets: currentTargets,
          });
        const existing = existingById ?? existingByName;

        if (!existing) {
          store.addTarget(target);
          continue;
        }

        if (mode === "skip-existing") continue;
        if (mode === "overwrite-existing") {
          store.updateTarget(existing.id, { ...target, id: existing.id });
          continue;
        }

        const mergedExposure: Record<string, number> = { ...(existing.plannedExposure ?? {}) };
        for (const [filter, seconds] of Object.entries(target.plannedExposure ?? {})) {
          mergedExposure[filter] = Math.max(mergedExposure[filter] ?? 0, seconds);
        }

        store.updateTarget(existing.id, {
          ...target,
          id: existing.id,
          aliases: [...new Set([...(existing.aliases ?? []), ...(target.aliases ?? [])])],
          tags: [...new Set([...(existing.tags ?? []), ...(target.tags ?? [])])],
          imageIds: [...new Set([...(existing.imageIds ?? []), ...(target.imageIds ?? [])])],
          plannedFilters: [
            ...new Set([...(existing.plannedFilters ?? []), ...(target.plannedFilters ?? [])]),
          ],
          plannedExposure: mergedExposure,
          imageRatings: { ...(existing.imageRatings ?? {}), ...(target.imageRatings ?? {}) },
          bestImageId: existing.bestImageId ?? target.bestImageId,
          recommendedEquipment: existing.recommendedEquipment ?? target.recommendedEquipment,
        });
      }
    },
    setTargetGroups: (groups, strategy) => {
      const mode = resolveStrategy(strategy);
      const store = targetGroupStore.getState();
      for (const group of groups) {
        const existing = store.groups.find((g) => g.id === group.id);
        if (!existing) {
          store.upsertGroup({ ...group, targetIds: [...new Set(group.targetIds ?? [])] });
          continue;
        }
        if (mode === "skip-existing") continue;
        if (mode === "overwrite-existing") {
          store.updateGroup(existing.id, group);
          continue;
        }
        store.updateGroup(existing.id, {
          ...group,
          targetIds: [...new Set([...(existing.targetIds ?? []), ...(group.targetIds ?? [])])],
        });
      }
    },
    setSessions: (sessions, strategy) => {
      const mode = resolveStrategy(strategy);
      const store = sessionStore.getState();
      for (const session of sessions) {
        const existing = store.sessions.find((s) => s.id === session.id);
        if (!existing) {
          store.addSession(session);
          continue;
        }
        if (mode === "skip-existing") continue;
        if (mode === "overwrite-existing") {
          store.updateSession(session.id, session);
          continue;
        }
        const merged = mergeSessionLike(existing, session, targetStore.getState().targets);
        store.updateSession(session.id, merged);
      }
    },
    setPlans: (plans, strategy) => {
      const mode = resolveStrategy(strategy);
      const store = sessionStore.getState();
      const targets = targetStore.getState().targets;
      for (const plan of plans) {
        const resolvedTargetId = plan.targetId
          ? resolveTargetId({ targetId: plan.targetId, name: plan.targetName }, targets)
          : resolveTargetId({ name: plan.targetName }, targets);
        const normalizedPlan = {
          ...plan,
          targetId: resolvedTargetId,
          targetName: resolveTargetName(
            { targetId: resolvedTargetId, name: plan.targetName },
            targets,
          ),
        };
        const existing = store.plans.find((p) => p.id === normalizedPlan.id);
        if (!existing) {
          store.addPlan(normalizedPlan);
          continue;
        }
        if (mode === "skip-existing") continue;
        if (mode === "overwrite-existing") {
          store.updatePlan(existing.id, normalizedPlan);
          continue;
        }
        store.updatePlan(existing.id, {
          ...normalizedPlan,
          targetId: existing.targetId ?? normalizedPlan.targetId,
          targetName: normalizedPlan.targetName || existing.targetName,
          notes: [existing.notes, normalizedPlan.notes].filter(Boolean).join("\n") || undefined,
        });
      }
    },
    setLogEntries: (entries, strategy) => {
      const mode = resolveStrategy(strategy);
      const store = sessionStore.getState();
      for (const entry of entries) {
        const existing = store.logEntries.find((log) => log.id === entry.id);
        if (!existing) {
          store.addLogEntry(entry);
          continue;
        }
        if (mode === "skip-existing") continue;
        if (mode === "overwrite-existing") {
          store.updateLogEntry(existing.id, entry);
          continue;
        }
        store.updateLogEntry(existing.id, {
          ...entry,
          notes: [existing.notes, entry.notes].filter(Boolean).join("\n") || undefined,
        });
      }
    },
    setSettings: (settings) => {
      const patch = normalizeSettingsBackupPatch(settings);
      if (Object.keys(patch).length > 0) {
        settingsStore.getState().applySettingsPatch(patch);
      }
    },
    setFileGroups: (data, strategy) => {
      const mode = resolveStrategy(strategy);
      const state = fileGroupStore.getState();
      if (mode === "overwrite-existing") {
        fileGroupStore.setState(
          {
            groups: data.groups,
            fileGroupMap: data.fileGroupMap,
          },
          false,
        );
        return;
      }

      const nextGroups = [...state.groups];
      const seenGroups = new Set(nextGroups.map((group) => group.id));
      for (const group of data.groups) {
        if (!seenGroups.has(group.id)) {
          nextGroups.push(group);
          seenGroups.add(group.id);
        } else if (mode === "merge") {
          const idx = nextGroups.findIndex((g) => g.id === group.id);
          if (idx >= 0) nextGroups[idx] = { ...nextGroups[idx], ...group };
        }
      }

      const nextMap: Record<string, string[]> = { ...state.fileGroupMap };
      for (const [fileId, groupIds] of Object.entries(data.fileGroupMap)) {
        if (!nextMap[fileId]) {
          nextMap[fileId] = [...groupIds];
          continue;
        }
        if (mode === "merge") {
          nextMap[fileId] = [...new Set([...(nextMap[fileId] ?? []), ...groupIds])];
        }
      }

      fileGroupStore.setState({ groups: nextGroups, fileGroupMap: nextMap }, false);
    },
    setAstrometry: (data, strategy) => {
      const mode = resolveStrategy(strategy);
      const state = astrometryStore.getState();
      if (mode === "overwrite-existing") {
        astrometryStore.setState({ config: data.config, jobs: data.jobs }, false);
        return;
      }

      const jobMap = new Map(state.jobs.map((job) => [job.id, job]));
      for (const job of data.jobs) {
        if (!jobMap.has(job.id)) {
          jobMap.set(job.id, job);
        } else if (mode === "merge") {
          jobMap.set(job.id, { ...jobMap.get(job.id)!, ...job });
        }
      }

      astrometryStore.setState(
        {
          config: mode === "merge" ? { ...state.config, ...data.config } : state.config,
          jobs: [...jobMap.values()],
        },
        false,
      );
    },
    setTrash: (items, strategy) => {
      const mode = resolveStrategy(strategy);
      if (mode === "overwrite-existing") {
        trashStore.setState({ items: [...items] }, false);
        return;
      }
      const current = trashStore.getState().items;
      const map = new Map(current.map((item) => [item.trashId, item]));
      for (const item of items) {
        if (!map.has(item.trashId) || mode === "merge") {
          map.set(item.trashId, item);
        }
      }
      trashStore.setState({ items: [...map.values()] }, false);
    },
    setActiveSession: (activeSession, strategy) => {
      const mode = resolveStrategy(strategy);
      const current = sessionStore.getState().activeSession;
      if (mode === "skip-existing" && current) return;
      if (mode === "merge" && current) return;
      sessionStore.setState({ activeSession }, false);
    },
    setBackupPrefs: (prefs) => {
      callbacks.setAutoBackupEnabled(prefs.autoBackupEnabled);
      callbacks.setAutoBackupIntervalHours(prefs.autoBackupIntervalHours);
      callbacks.setAutoBackupNetwork(prefs.autoBackupNetwork);
      if (prefs.activeProvider) {
        callbacks.setActiveProvider(prefs.activeProvider);
      }
    },
  };
}
