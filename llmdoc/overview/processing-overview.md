# Processing Overview

## 1. Identity

- **What it is:** A comprehensive astronomical image processing module that integrates target management, observation sessions, image stacking, and astrometry plate solving.
- **Purpose:** Provides end-to-end workflow for amateur astronomers to organize observation data, process raw FITS images, and achieve accurate celestial coordinates.

## 2. High-Level Description

The Processing module is the core domain of Cobalt FITS Viewer, encompassing four interconnected subsystems:

- **Target Management** (`src/lib/targets/`): Organizes observation targets with RA/Dec coordinates, exposure planning, and automatic detection from FITS headers. Supports 8 target types (galaxy, nebula, cluster, planet, moon, sun, comet, other) and 4 status states.

- **Observation Sessions** (`src/lib/sessions/`): Tracks observation activities with auto-detection from FITS file timestamps, live session recording, equipment logging, and calendar integration. Maintains bidirectional relationships with FITS files and targets.

- **Image Stacking** (`src/lib/stacking/`): Implements a complete stacking pipeline with dark/flat/bias calibration, star-based alignment (translation or full affine), quality evaluation, and 7 stacking methods (average, median, sigma clip, min, max, winsorized, weighted).

- **Astrometry** (`src/lib/astrometry/`): Integrates with Astrometry.net (nova.astrometry.net) for plate solving, provides WCS solution handling with TAN gnomonic projection, and supports writing WCS headers directly to FITS files.

These four subsystems work together: targets are observed in sessions, sessions link to FITS files, stacking processes those files, and astrometry provides precise coordinates that sync back to targets.
