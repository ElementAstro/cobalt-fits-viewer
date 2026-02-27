# State Management Reference

This document provides a high-level summary of the state management system and pointers to source-of-truth information.

## 1. Core Summary

The application uses 18 Zustand stores: 14 persisted to AsyncStorage (via zustandMMKVStorage adapter) and 4 in-memory. Stores are organized by domain (FITS, viewer, gallery, targets, sessions, albums, backup, converter, logging, astrometry, file groups, target groups, trash, video tasks, onboarding, favorite sites, saved themes). The naming "MMKV" is a misnomer - the actual implementation uses AsyncStorage.

## 2. Source of Truth

- **Storage Adapter:** `src/lib/storage.ts` - Defines `zustandMMKVStorage` using AsyncStorage.
- **All Stores:** `src/stores/` - Directory containing all 18 store files.
- **Store Patterns:** `src/stores/useFitsStore.ts` - Example persisted store with partialize.
- **In-Memory Example:** `src/stores/useViewerStore.ts` - Example in-memory store.
- **Routing Integration:** `src/app/_layout.tsx` - Root layout initializing stores.
- **Backup Integration:** `src/lib/backup/dataSourceFactory.ts` - Serialization for backup/restore.
- **Related Architecture:** `/llmdoc/architecture/infrastructure-architecture.md` - Detailed execution flows.
- **i18n Reference:** `/llmdoc/reference/i18n-keys.md` - Translation key reference.

## 3. Store Quick Reference

| Store             | Persistence | Key State                      |
| ----------------- | ----------- | ------------------------------ |
| useFitsStore      | MMKV        | files, selectedIds             |
| useViewerStore    | Memory      | stretch, colormap, annotations |
| useSettingsStore  | MMKV        | 140+ settings                  |
| useGalleryStore   | Memory      | viewMode, selection            |
| useTargetStore    | MMKV        | targets, aliases               |
| useSessionStore   | MMKV        | sessions, logEntries           |
| useAlbumStore     | MMKV        | albums, smartRules             |
| useBackupStore    | MMKV        | connections, progress          |
| useConverterStore | Memory      | presets, batchTasks            |
| useLogStore       | Memory      | logEntries                     |
