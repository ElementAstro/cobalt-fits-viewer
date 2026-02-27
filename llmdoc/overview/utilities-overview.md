# Utilities Module Overview

## 1. Identity

- **What it is:** A combined module for image format conversion and cloud backup operations in the Cobalt FITS Viewer application.
- **Purpose:** Enables users to convert FITS images to various export formats and backup/restore application data to cloud providers.

## 2. High-Level Description

The Utilities module consists of two interconnected subsystems:

**Converter Subsystem** (`src/lib/converter/`): Handles FITS image format conversion with support for 8+ export formats (PNG, JPEG, WebP, TIFF, BMP, FITS, XISF, SER). Provides 8+ stretch algorithms (linear, sqrt, log, asinh, power, zscale, percentile, adaptive, GHS) and 16 colormaps. Supports both scientific export (preserving original pixel data) and rendered export (8-bit output). Includes batch processing with progress tracking and chunked non-blocking operation for large files.

**Backup Subsystem** (`src/lib/backup/`): Provides cloud backup and restore functionality with 5 provider options (Google Drive, OneDrive, Dropbox, WebDAV, SFTP). Implements incremental backup using SHA-256 hash comparison, manifest-based versioning with cross-reference validation, integrity verification, and retry logic with exponential backoff. Supports 14 data domains including files, albums, targets, sessions, and settings.

Both subsystems emphasize progress tracking, abort support, error handling, and type-safe interfaces. The Converter writes exported files to a directory that Backup can include in its scope, enabling complete data lifecycle management.
