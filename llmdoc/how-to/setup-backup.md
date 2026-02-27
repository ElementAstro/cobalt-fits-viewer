# How to Setup Backup

A step-by-step guide for configuring cloud backup in the Cobalt FITS Viewer.

1. **Navigate to Backup Settings:** Open the Settings tab and select Backup section (`src/app/backup/index.tsx`).
2. **Select Cloud Provider:** Choose from supported providers (Google Drive, OneDrive, Dropbox, WebDAV, SFTP). Each provider implements `ICloudProvider` interface defined in `src/lib/backup/cloudProvider.ts`.
3. **Authenticate:** Complete OAuth flow (Google Drive uses `@react-native-google-signin`, others use `oauthHelper.ts`). Tokens are stored via `expo-secure-store`.
4. **Configure Backup Scope:** Select which data domains to include (files, albums, targets, sessions, plans, settings, etc.). See `src/lib/backup/manifest.ts` for all 14 supported domains.
5. **Initial Backup:** Tap "Backup Now" to trigger `backupService.ts:performBackup`. The service creates a manifest version 4 with cross-reference validation and performs incremental sync using SHA-256 comparison.
6. **Monitor Progress:** Track backup progress via bytes transferred callback. Progress UI updates through `BackupProgressSheet.tsx`.
7. **Verify Integrity:** After upload, `verifyBackupIntegrity` confirms file integrity.

**For Restore:**

1. Navigate to Backup settings.
2. Select "Restore from Backup".
3. Choose conflict strategy (skip-existing, overwrite-existing, merge) defined in `src/lib/backup/types.ts`.
4. Execute restore via `performRestore`. The system downloads manifest first, then binary files with integrity verification.

**For Local Backup (Offline):**

1. Use `localBackup.ts` to create a local backup package for offline transfer.
2. Use `lanTransfer.ts` for LAN-based transfers to another device.

**Verify Task Completion:** Check backup history log and confirm files exist in cloud provider's appDataFolder (or custom path).
