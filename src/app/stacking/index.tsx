import { View, Text, ScrollView, Alert } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useState, useCallback, useMemo, useEffect } from "react";
import { File as FSFile } from "expo-file-system";
import {
  Accordion,
  Alert as HAlert,
  Button,
  Card,
  Checkbox,
  Chip,
  Label,
  PressableFeedback,
  Separator,
  useThemeColor,
} from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/common/useResponsiveLayout";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { useSettingsStore } from "../../stores/app/useSettingsStore";
import { calculateStats } from "../../lib/utils/pixelMath";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { EmptyState } from "../../components/common/EmptyState";
import { FitsCanvas } from "../../components/fits/FitsCanvas";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import {
  useStacking,
  type StackMethod,
  type CalibrationFrames,
  type AlignmentMode,
  type StackResult,
  type StackingWarning,
} from "../../hooks/stacking/useStacking";
import { useExport } from "../../hooks/export/useExport";
import type { ExportFormat, FitsMetadata, GeoLocation } from "../../lib/fits/types";
import { isFitsFamilyFilename, splitFilenameExtension } from "../../lib/import/fileFormat";
import { getFitsDir, generateFileId } from "../../lib/utils/fileManager";
import { writeFitsImage } from "../../lib/fits/writer";
import { extractMetadata, loadFitsFromBufferAuto } from "../../lib/fits/parser";
import { saveThumbnailFromRGBA } from "../../lib/gallery/thumbnailWorkflow";
import { pickImageLikeIds } from "../../lib/viewer/compareRouting";

const METHODS: { key: StackMethod; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { key: "average", icon: "calculator-outline", labelKey: "editor.average" },
  { key: "median", icon: "analytics-outline", labelKey: "editor.median" },
  { key: "sigma", icon: "cut-outline", labelKey: "editor.sigmaClip" },
  { key: "min", icon: "arrow-down-outline", labelKey: "editor.min" },
  { key: "max", icon: "arrow-up-outline", labelKey: "editor.max" },
  { key: "winsorized", icon: "shield-outline", labelKey: "editor.winsorized" },
  { key: "weighted", icon: "scale-outline", labelKey: "editor.weighted" },
];

const ALIGNMENT_MODES: {
  key: AlignmentMode;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
}[] = [
  { key: "none", icon: "close-outline", labelKey: "editor.alignNone" },
  { key: "translation", icon: "move-outline", labelKey: "editor.alignTranslation" },
  { key: "full", icon: "sync-outline", labelKey: "editor.alignFull" },
];

type DetectionProfile = "fast" | "balanced" | "accurate";

const DETECTION_PROFILES: {
  key: DetectionProfile;
  labelKey: string;
}[] = [
  { key: "fast", labelKey: "settings.stackingProfileFast" },
  { key: "balanced", labelKey: "settings.stackingProfileBalanced" },
  { key: "accurate", labelKey: "settings.stackingProfileAccurate" },
];

function isStackableFile(file: FitsMetadata): boolean {
  if (file.mediaKind && file.mediaKind !== "image") return false;
  if (file.sourceType === "video" || file.sourceType === "audio") return false;
  if (file.decodeStatus === "failed") return false;
  return (
    file.sourceType === "fits" ||
    file.sourceType === "raster" ||
    isFitsFamilyFilename(file.filename)
  );
}

function parseIdsParam(idsParam: string | string[] | undefined): string[] {
  if (!idsParam) return [];
  const raw = Array.isArray(idsParam) ? idsParam.join(",") : idsParam;
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function filenameFromUri(uri: string): string {
  const normalized = uri.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || uri;
}

function createUniqueFitsFilename(baseName: string): string {
  const fitsDir = getFitsDir();
  const trimmed = baseName.trim();
  const fallback = trimmed.length > 0 ? trimmed : `stacked_${Date.now()}`;
  const { baseName: parsedBaseName } = splitFilenameExtension(fallback);
  const safeBase = (parsedBaseName || fallback).replace(/[<>:"/\\|?*]/g, "_");

  let suffix = 0;
  while (true) {
    const filename = `${safeBase}${suffix > 0 ? `_${suffix}` : ""}.fits`;
    const candidate = new FSFile(fitsDir, filename);
    if (!candidate.exists) return filename;
    suffix++;
  }
}

function isSameLocation(a?: GeoLocation, b?: GeoLocation): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    a.altitude === b.altitude &&
    a.placeName === b.placeName &&
    a.city === b.city &&
    a.region === b.region &&
    a.country === b.country
  );
}

function toPositiveExposure(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export default function StackingScreen() {
  useKeepAwake();
  const router = useRouter();
  const params = useLocalSearchParams<{ ids?: string | string[] }>();
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const files = useFitsStore((s) => s.files);
  const addFile = useFitsStore((s) => s.addFile);
  const updateFile = useFitsStore((s) => s.updateFile);
  const stackableFiles = useMemo(() => files.filter(isStackableFile), [files]);
  const stackableFileIdSet = useMemo(
    () => new Set(stackableFiles.map((file) => file.id)),
    [stackableFiles],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uiWarnings, setUiWarnings] = useState<string[]>([]);
  const [isPersisting, setIsPersisting] = useState(false);
  const [idsPreselectionSummary, setIdsPreselectionSummary] = useState<{
    requested: number;
    selected: number;
    ignored: number;
  } | null>(null);

  const toggleSelection = useCallback(
    (id: string) => {
      if (!stackableFileIdSet.has(id)) return;
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
      );
    },
    [stackableFileIdSet],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(stackableFiles.map((f) => f.id));
  }, [stackableFiles]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => stackableFileIdSet.has(id)));
  }, [stackableFileIdSet]);

  useEffect(() => {
    const requestedIds = parseIdsParam(params.ids);
    if (requestedIds.length === 0) {
      setIdsPreselectionSummary(null);
      return;
    }

    const deduped = Array.from(new Set(requestedIds));
    const valid = deduped.filter((id) => stackableFileIdSet.has(id));
    setSelectedIds(valid);
    setIdsPreselectionSummary({
      requested: deduped.length,
      selected: valid.length,
      ignored: deduped.length - valid.length,
    });
  }, [params.ids, stackableFileIdSet]);

  const settingsStackMethod = useSettingsStore((s) => s.defaultStackMethod) as StackMethod;
  const settingsSigma = useSettingsStore((s) => s.defaultSigmaValue);
  const settingsAlignment = useSettingsStore((s) => s.defaultAlignmentMode) as AlignmentMode;
  const settingsQuality = useSettingsStore((s) => s.defaultEnableQuality);
  const settingsDetectionProfile = useSettingsStore((s) => s.stackingDetectionProfile);
  const settingsDetectSigmaThreshold = useSettingsStore((s) => s.stackingDetectSigmaThreshold);
  const settingsDetectMaxStars = useSettingsStore((s) => s.stackingDetectMaxStars);
  const settingsDetectMinArea = useSettingsStore((s) => s.stackingDetectMinArea);
  const settingsDetectMaxArea = useSettingsStore((s) => s.stackingDetectMaxArea);
  const settingsDetectBorderMargin = useSettingsStore((s) => s.stackingDetectBorderMargin);
  const settingsDetectSigmaClipIters = useSettingsStore((s) => s.stackingDetectSigmaClipIters);
  const settingsDetectApplyMatchedFilter = useSettingsStore(
    (s) => s.stackingDetectApplyMatchedFilter,
  );
  const settingsDetectConnectivity = useSettingsStore((s) => s.stackingDetectConnectivity);
  const settingsBackgroundMeshSize = useSettingsStore((s) => s.stackingBackgroundMeshSize);
  const settingsDeblendNLevels = useSettingsStore((s) => s.stackingDeblendNLevels);
  const settingsDeblendMinContrast = useSettingsStore((s) => s.stackingDeblendMinContrast);
  const settingsFilterFwhm = useSettingsStore((s) => s.stackingFilterFwhm);
  const settingsDetectMinFwhm = useSettingsStore((s) => s.stackingDetectMinFwhm);
  const settingsMaxFwhm = useSettingsStore((s) => s.stackingMaxFwhm);
  const settingsMaxEllipticity = useSettingsStore((s) => s.stackingMaxEllipticity);
  const settingsDetectMinSharpness = useSettingsStore((s) => s.stackingDetectMinSharpness);
  const settingsDetectMaxSharpness = useSettingsStore((s) => s.stackingDetectMaxSharpness);
  const settingsDetectPeakMax = useSettingsStore((s) => s.stackingDetectPeakMax);
  const settingsDetectSnrMin = useSettingsStore((s) => s.stackingDetectSnrMin);
  const settingsUseAnnotatedForAlignment = useSettingsStore(
    (s) => s.stackingUseAnnotatedForAlignment,
  );
  const settingsRansacMaxIterations = useSettingsStore((s) => s.stackingRansacMaxIterations);
  const settingsAlignmentInlierThreshold = useSettingsStore(
    (s) => s.stackingAlignmentInlierThreshold,
  );
  const thumbnailSize = useSettingsStore((s) => s.thumbnailSize);
  const thumbnailQuality = useSettingsStore((s) => s.thumbnailQuality);

  const [method, setMethod] = useState<StackMethod>(settingsStackMethod);
  const [sigmaValue, setSigmaValue] = useState(settingsSigma);
  const [calibration, setCalibration] = useState<CalibrationFrames>({});
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>(settingsAlignment);
  const [enableQuality, setEnableQuality] = useState(settingsQuality);
  const [detectionProfile, setDetectionProfile] =
    useState<DetectionProfile>(settingsDetectionProfile);
  const [detectSigmaThreshold, setDetectSigmaThreshold] = useState(settingsDetectSigmaThreshold);
  const [detectMaxStars, setDetectMaxStars] = useState(settingsDetectMaxStars);
  const [detectMinArea, setDetectMinArea] = useState(settingsDetectMinArea);
  const [detectMaxArea, setDetectMaxArea] = useState(settingsDetectMaxArea);
  const [detectBorderMargin, setDetectBorderMargin] = useState(settingsDetectBorderMargin);
  const [detectSigmaClipIters, setDetectSigmaClipIters] = useState(settingsDetectSigmaClipIters);
  const [detectApplyMatchedFilter, setDetectApplyMatchedFilter] = useState(
    settingsDetectApplyMatchedFilter,
  );
  const [detectConnectivity, setDetectConnectivity] = useState<4 | 8>(settingsDetectConnectivity);
  const [backgroundMeshSize, setBackgroundMeshSize] = useState(settingsBackgroundMeshSize);
  const [deblendNLevels, setDeblendNLevels] = useState(settingsDeblendNLevels);
  const [deblendMinContrast, setDeblendMinContrast] = useState(settingsDeblendMinContrast);
  const [filterFwhm, setFilterFwhm] = useState(settingsFilterFwhm);
  const [detectMinFwhm, setDetectMinFwhm] = useState(settingsDetectMinFwhm);
  const [maxFwhm, setMaxFwhm] = useState(settingsMaxFwhm);
  const [maxEllipticity, setMaxEllipticity] = useState(settingsMaxEllipticity);
  const [detectMinSharpness, setDetectMinSharpness] = useState(settingsDetectMinSharpness);
  const [detectMaxSharpness, setDetectMaxSharpness] = useState(settingsDetectMaxSharpness);
  const [detectPeakMax, setDetectPeakMax] = useState(settingsDetectPeakMax);
  const [detectSnrMin, setDetectSnrMin] = useState(settingsDetectSnrMin);
  const [useAnnotatedForAlignment, setUseAnnotatedForAlignment] = useState(
    settingsUseAnnotatedForAlignment,
  );
  const [ransacMaxIterations, setRansacMaxIterations] = useState(settingsRansacMaxIterations);
  const [alignmentInlierThreshold, setAlignmentInlierThreshold] = useState(
    settingsAlignmentInlierThreshold,
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [filterGroup, setFilterGroup] = useState<string | null>(null);

  const stacking = useStacking();
  const { saveImage, shareImage } = useExport();

  const selectedFiles = stackableFiles.filter((f) => selectedIds.includes(f.id));
  const selectedCompareIds = useMemo(
    () =>
      pickImageLikeIds(
        selectedFiles.map((file) => file.id),
        selectedFiles,
        2,
      ),
    [selectedFiles],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const calibrationCandidates = useMemo(
    () => stackableFiles.filter((file) => !selectedIdSet.has(file.id)),
    [selectedIdSet, stackableFiles],
  );

  const precheck = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (selectedFiles.length < 2) return { errors, warnings };

    const dimsCounts = new Map<string, number>();
    let knownDimsCount = 0;
    for (const file of selectedFiles) {
      const w = file.naxis1;
      const h = file.naxis2;
      if (
        typeof w === "number" &&
        typeof h === "number" &&
        Number.isFinite(w) &&
        Number.isFinite(h) &&
        w > 0 &&
        h > 0
      ) {
        const key = `${w}×${h}`;
        dimsCounts.set(key, (dimsCounts.get(key) ?? 0) + 1);
        knownDimsCount++;
      }
    }

    if (dimsCounts.size > 1) {
      const summary = Array.from(dimsCounts.entries())
        .map(([dims, count]) => `${dims} (${count})`)
        .join(", ");
      errors.push(t("editor.stackPrecheckMixedDimensions", { dims: summary }));
    } else if (dimsCounts.size === 1 && knownDimsCount !== selectedFiles.length) {
      warnings.push(
        t("editor.stackPrecheckMissingDimensions", {
          count: selectedFiles.length - knownDimsCount,
        }),
      );
    }

    const missingExposureCount = selectedFiles.filter(
      (file) => toPositiveExposure(file.exptime) === null,
    ).length;
    if (missingExposureCount > 0) {
      warnings.push(t("editor.stackPrecheckMissingExposure", { count: missingExposureCount }));
    }

    const sessionIds = selectedFiles.map((file) => file.sessionId);
    const targetIds = selectedFiles.map((file) => file.targetId);
    const derivedFromIds = selectedFiles.map((file) => file.derivedFromId);
    const locations = selectedFiles.map((file) => file.location);
    const objects = selectedFiles.map((file) => file.object);
    const filters = selectedFiles.map((file) => file.filter);
    const instruments = selectedFiles.map((file) => file.instrument);
    const telescopes = selectedFiles.map((file) => file.telescope);

    const sessionId = sessionIds[0];
    const targetId = targetIds[0];
    const derivedFromId = derivedFromIds[0];
    const location = locations[0];
    const object = objects[0];
    const filter = filters[0];
    const instrument = instruments[0];
    const telescope = telescopes[0];

    if (!sessionIds.every((value) => value === sessionId)) {
      warnings.push(t("editor.stackMetadataSessionInconsistent"));
    }
    if (!targetIds.every((value) => value === targetId)) {
      warnings.push(t("editor.stackMetadataTargetInconsistent"));
    }
    if (!derivedFromIds.every((value) => value === derivedFromId)) {
      warnings.push(t("editor.stackMetadataDerivedInconsistent"));
    }
    if (!locations.every((value) => isSameLocation(value, location))) {
      warnings.push(t("editor.stackMetadataLocationInconsistent"));
    }
    if (!objects.every((value) => value === object)) {
      warnings.push(t("editor.stackMetadataObjectInconsistent"));
    }
    if (!filters.every((value) => value === filter)) {
      warnings.push(t("editor.stackMetadataFilterInconsistent"));
    }
    if (!instruments.every((value) => value === instrument)) {
      warnings.push(t("editor.stackMetadataInstrumentInconsistent"));
    }
    if (!telescopes.every((value) => value === telescope)) {
      warnings.push(t("editor.stackMetadataTelescopeInconsistent"));
    }

    if (dimsCounts.size === 1) {
      const expectedDims = Array.from(dimsCounts.keys())[0];
      const filesByFilepath = new Map(stackableFiles.map((file) => [file.filepath, file] as const));
      const calibrationPaths = new Set<string>();
      const darkPaths =
        calibration.darkFilepaths ?? (calibration.darkFilepath ? [calibration.darkFilepath] : []);
      const flatPaths =
        calibration.flatFilepaths ?? (calibration.flatFilepath ? [calibration.flatFilepath] : []);
      for (const fp of darkPaths) calibrationPaths.add(fp);
      for (const fp of flatPaths) calibrationPaths.add(fp);
      if (calibration.biasFilepath) calibrationPaths.add(calibration.biasFilepath);

      for (const fp of calibrationPaths) {
        const file = filesByFilepath.get(fp);
        if (!file) continue;
        const w = file.naxis1;
        const h = file.naxis2;
        if (
          typeof w === "number" &&
          typeof h === "number" &&
          Number.isFinite(w) &&
          Number.isFinite(h) &&
          w > 0 &&
          h > 0
        ) {
          const dims = `${w}×${h}`;
          if (dims !== expectedDims) {
            errors.push(
              t("editor.stackPrecheckCalibrationDimensionMismatch", {
                filename: file.filename,
                dims,
                expected: expectedDims,
              }),
            );
          }
        }
      }
    }

    return { errors, warnings };
  }, [calibration, selectedFiles, stackableFiles, t]);

  // Group files by filter for quick selection
  const filterGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const f of stackableFiles) {
      const key = f.filter ?? "Unknown";
      groups[key] = (groups[key] ?? 0) + 1;
    }
    return groups;
  }, [stackableFiles]);

  // Filtered display list
  const displayFiles = useMemo(() => {
    if (!filterGroup) return stackableFiles;
    return stackableFiles.filter((f) => (f.filter ?? "Unknown") === filterGroup);
  }, [stackableFiles, filterGroup]);

  const toggleCalibrationCandidate = useCallback(
    (type: "dark" | "flat" | "bias", file: FitsMetadata) => {
      setCalibration((prev) => {
        const canonicalDark = prev.darkFilepaths ?? (prev.darkFilepath ? [prev.darkFilepath] : []);
        const canonicalFlat = prev.flatFilepaths ?? (prev.flatFilepath ? [prev.flatFilepath] : []);

        if (type === "bias") {
          const nextBias = prev.biasFilepath === file.filepath ? undefined : file.filepath;
          if (!nextBias) {
            return {
              ...prev,
              biasFilepath: undefined,
            };
          }

          const nextDark = canonicalDark.filter((fp) => fp !== nextBias);
          const nextFlat = canonicalFlat.filter((fp) => fp !== nextBias);

          return {
            ...prev,
            biasFilepath: nextBias,
            darkFilepaths: nextDark.length > 0 ? nextDark : undefined,
            darkFilepath: nextDark.length > 0 ? nextDark[0] : undefined,
            flatFilepaths: nextFlat.length > 0 ? nextFlat : undefined,
            flatFilepath: nextFlat.length > 0 ? nextFlat[0] : undefined,
          };
        }

        if (type === "dark") {
          const darkSet = new Set(canonicalDark);
          const isRemoving = darkSet.has(file.filepath);
          if (isRemoving) {
            darkSet.delete(file.filepath);
          } else {
            darkSet.add(file.filepath);
          }
          const nextDark = Array.from(darkSet);
          const nextFlat = isRemoving
            ? canonicalFlat
            : canonicalFlat.filter((fp) => fp !== file.filepath);
          const nextBias =
            !isRemoving && prev.biasFilepath === file.filepath ? undefined : prev.biasFilepath;

          return {
            ...prev,
            biasFilepath: nextBias,
            darkFilepaths: nextDark.length > 0 ? nextDark : undefined,
            darkFilepath: nextDark.length > 0 ? nextDark[0] : undefined,
            flatFilepaths: nextFlat.length > 0 ? nextFlat : undefined,
            flatFilepath: nextFlat.length > 0 ? nextFlat[0] : undefined,
          };
        }

        const flatSet = new Set(canonicalFlat);
        const isRemoving = flatSet.has(file.filepath);
        if (isRemoving) {
          flatSet.delete(file.filepath);
        } else {
          flatSet.add(file.filepath);
        }
        const nextFlat = Array.from(flatSet);
        const nextDark = isRemoving
          ? canonicalDark
          : canonicalDark.filter((fp) => fp !== file.filepath);
        const nextBias =
          !isRemoving && prev.biasFilepath === file.filepath ? undefined : prev.biasFilepath;

        return {
          ...prev,
          biasFilepath: nextBias,
          darkFilepaths: nextDark.length > 0 ? nextDark : undefined,
          darkFilepath: nextDark.length > 0 ? nextDark[0] : undefined,
          flatFilepaths: nextFlat.length > 0 ? nextFlat : undefined,
          flatFilepath: nextFlat.length > 0 ? nextFlat[0] : undefined,
        };
      });
    },
    [],
  );

  const clearCalibrationType = useCallback((type: "dark" | "flat" | "bias") => {
    setCalibration((prev) => {
      if (type === "bias") {
        return { ...prev, biasFilepath: undefined };
      }
      if (type === "dark") {
        return { ...prev, darkFilepath: undefined, darkFilepaths: undefined };
      }
      return { ...prev, flatFilepath: undefined, flatFilepaths: undefined };
    });
  }, []);

  const persistStackResult = useCallback(
    async (
      stackResult: StackResult,
      sourceFiles: FitsMetadata[],
    ): Promise<{ id: string; warnings: string[] } | null> => {
      const source = sourceFiles[0];
      if (!source) return null;

      const persistenceWarnings: string[] = [];
      const sessionIds = sourceFiles.map((file) => file.sessionId);
      const targetIds = sourceFiles.map((file) => file.targetId);
      const derivedFromIds = sourceFiles.map((file) => file.derivedFromId);
      const locations = sourceFiles.map((file) => file.location);
      const objects = sourceFiles.map((file) => file.object);
      const filters = sourceFiles.map((file) => file.filter);
      const instruments = sourceFiles.map((file) => file.instrument);
      const telescopes = sourceFiles.map((file) => file.telescope);

      const sessionId = sessionIds[0];
      const targetId = targetIds[0];
      const derivedFromId = derivedFromIds[0];
      const location = locations[0];
      const object = objects[0];
      const filter = filters[0];
      const instrument = instruments[0];
      const telescope = telescopes[0];

      if (!sessionIds.every((value) => value === sessionId)) {
        persistenceWarnings.push(t("editor.stackMetadataSessionInconsistent"));
      }
      if (!targetIds.every((value) => value === targetId)) {
        persistenceWarnings.push(t("editor.stackMetadataTargetInconsistent"));
      }
      if (!derivedFromIds.every((value) => value === derivedFromId)) {
        persistenceWarnings.push(t("editor.stackMetadataDerivedInconsistent"));
      }
      if (!locations.every((value) => isSameLocation(value, location))) {
        persistenceWarnings.push(t("editor.stackMetadataLocationInconsistent"));
      }
      if (!objects.every((value) => value === object)) {
        persistenceWarnings.push(t("editor.stackMetadataObjectInconsistent"));
      }
      if (!filters.every((value) => value === filter)) {
        persistenceWarnings.push(t("editor.stackMetadataFilterInconsistent"));
      }
      if (!instruments.every((value) => value === instrument)) {
        persistenceWarnings.push(t("editor.stackMetadataInstrumentInconsistent"));
      }
      if (!telescopes.every((value) => value === telescope)) {
        persistenceWarnings.push(t("editor.stackMetadataTelescopeInconsistent"));
      }

      const totalExposure = sourceFiles.reduce((sum, file) => {
        const exposure = toPositiveExposure(file.exptime);
        return sum + (exposure ?? 0);
      }, 0);

      const outputName = createUniqueFitsFilename(
        `stacked_${stackResult.method}_${stackResult.frameCount}f`,
      );
      const outputFile = new FSFile(getFitsDir(), outputName);

      const bytes = writeFitsImage({
        image: {
          kind: "mono2d",
          width: stackResult.width,
          height: stackResult.height,
          pixels: stackResult.pixels,
        },
        bitpix: -32,
        preserveOriginalHeader: false,
        preserveWcs: false,
        metadata: {
          object,
          filter,
          instrument,
          telescope,
          exptime: totalExposure > 0 ? totalExposure : undefined,
        },
        history: [`Stacked ${stackResult.frameCount} frames with ${stackResult.method}`],
        exportMode: "scientific",
        sourceFormat: "fits",
        targetFormat: "fits",
      });

      outputFile.write(bytes);
      const outputBuffer = await outputFile.arrayBuffer();
      const parsed = loadFitsFromBufferAuto(outputBuffer);
      const outputFilename = outputFile.name ?? filenameFromUri(outputFile.uri);
      const partialMeta = extractMetadata(parsed, {
        filename: outputFilename,
        filepath: outputFile.uri,
        fileSize: outputFile.size ?? outputBuffer.byteLength,
      });

      const id = generateFileId();
      addFile({
        ...partialMeta,
        id,
        importDate: Date.now(),
        isFavorite: false,
        tags: [],
        albumIds: [],
        sourceType: "fits",
        sourceFormat: "fits",
        mediaKind: "image",
        frameType: "light",
        processingTag: "stacking",
        exptime: totalExposure > 0 ? totalExposure : undefined,
        sessionId,
        targetId,
        derivedFromId,
        location,
      });

      const thumbUri = saveThumbnailFromRGBA(
        id,
        stackResult.rgbaData,
        stackResult.width,
        stackResult.height,
        {
          thumbnailSize,
          thumbnailQuality,
        },
      );

      if (thumbUri) {
        updateFile(id, { thumbnailUri: thumbUri });
      }

      return { id, warnings: persistenceWarnings };
    },
    [addFile, t, thumbnailQuality, thumbnailSize, updateFile],
  );

  const handleStack = useCallback(async () => {
    setUiWarnings([]);
    if (selectedFiles.length < 2) {
      Alert.alert(t("common.error"), t("editor.selectAtLeast2"));
      return;
    }

    if (precheck.errors.length > 0) {
      Alert.alert(t("common.error"), precheck.errors.join("\n"));
      return;
    }

    const fileInfos = selectedFiles.map((f) => ({
      id: f.id,
      filepath: f.filepath,
      filename: f.filename,
      starAnnotations: f.starAnnotations,
    }));

    const hasCalibration =
      calibration.biasFilepath ||
      (calibration.darkFilepaths && calibration.darkFilepaths.length > 0) ||
      (calibration.flatFilepaths && calibration.flatFilepaths.length > 0) ||
      calibration.darkFilepath ||
      calibration.flatFilepath;

    const stackResult = await stacking.stackFiles({
      files: fileInfos,
      method,
      sigma: sigmaValue,
      calibration: hasCalibration ? calibration : undefined,
      alignmentMode,
      enableQualityEval: enableQuality || method === "weighted",
      advanced: {
        detection: {
          profile: detectionProfile,
          sigmaThreshold: detectSigmaThreshold,
          maxStars: detectMaxStars,
          minArea: detectMinArea,
          maxArea: detectMaxArea,
          borderMargin: detectBorderMargin,
          sigmaClipIters: detectSigmaClipIters,
          applyMatchedFilter: detectApplyMatchedFilter,
          connectivity: detectConnectivity,
          meshSize: backgroundMeshSize,
          deblendNLevels,
          deblendMinContrast,
          filterFwhm,
          minFwhm: detectMinFwhm,
          maxFwhm,
          maxEllipticity,
          minSharpness: detectMinSharpness,
          maxSharpness: detectMaxSharpness,
          peakMax: detectPeakMax > 0 ? detectPeakMax : undefined,
          snrMin: detectSnrMin,
        },
        alignment: {
          maxRansacIterations: ransacMaxIterations,
          inlierThreshold: alignmentInlierThreshold,
          fallbackToTranslation: true,
        },
        annotation: {
          useAnnotatedForAlignment,
          stalePolicy: "auto-fallback-detect",
        },
        quality: {
          detectionOptions: {
            profile: detectionProfile,
            sigmaThreshold: detectSigmaThreshold,
            maxStars: detectMaxStars,
            minArea: detectMinArea,
            maxArea: detectMaxArea,
            borderMargin: detectBorderMargin,
            sigmaClipIters: detectSigmaClipIters,
            applyMatchedFilter: detectApplyMatchedFilter,
            connectivity: detectConnectivity,
            meshSize: backgroundMeshSize,
            deblendNLevels,
            deblendMinContrast,
            filterFwhm,
            minFwhm: detectMinFwhm,
            maxFwhm,
            maxEllipticity,
            minSharpness: detectMinSharpness,
            maxSharpness: detectMaxSharpness,
            peakMax: detectPeakMax > 0 ? detectPeakMax : undefined,
            snrMin: detectSnrMin,
          },
        },
      },
    });

    if (!stackResult) {
      return;
    }

    const calibrationWarnings = stackResult.calibrationWarnings.map((warning: StackingWarning) =>
      t(warning.messageKey, { filename: warning.filename }),
    );

    let didNavigate = false;
    setIsPersisting(true);
    try {
      const persisted = await persistStackResult(stackResult, selectedFiles);
      if (!persisted) {
        Alert.alert(t("common.error"), t("editor.autoSaveFailed"));
        setUiWarnings(Array.from(new Set([...precheck.warnings, ...calibrationWarnings])));
        return;
      }

      const mergedWarnings = Array.from(
        new Set([...precheck.warnings, ...calibrationWarnings, ...persisted.warnings]),
      );
      setUiWarnings(mergedWarnings);
      Alert.alert(t("common.success"), t("editor.autoSaveSuccess"));
      didNavigate = true;
      setIsPersisting(false);
      router.push(`/viewer/${persisted.id}`);
    } catch {
      Alert.alert(t("common.error"), t("editor.autoSaveFailed"));
      setUiWarnings(Array.from(new Set([...precheck.warnings, ...calibrationWarnings])));
    } finally {
      if (!didNavigate) {
        setIsPersisting(false);
      }
    }
  }, [
    alignmentInlierThreshold,
    alignmentMode,
    backgroundMeshSize,
    calibration,
    deblendMinContrast,
    deblendNLevels,
    detectApplyMatchedFilter,
    detectBorderMargin,
    detectConnectivity,
    detectMaxArea,
    detectMaxSharpness,
    detectMaxStars,
    detectMinArea,
    detectMinFwhm,
    detectMinSharpness,
    detectPeakMax,
    detectSigmaClipIters,
    detectSigmaThreshold,
    detectSnrMin,
    detectionProfile,
    enableQuality,
    filterFwhm,
    maxEllipticity,
    maxFwhm,
    method,
    persistStackResult,
    ransacMaxIterations,
    router,
    selectedFiles,
    sigmaValue,
    stacking,
    t,
    useAnnotatedForAlignment,
    precheck,
  ]);

  const handleExport = useCallback(async () => {
    if (!stacking.result) return;
    try {
      const path = await saveImage(
        stacking.result.rgbaData,
        stacking.result.width,
        stacking.result.height,
        `stacked_${stacking.result.method}_${stacking.result.frameCount}f`,
        exportFormat,
      );
      if (path) {
        Alert.alert(t("common.success"), t("viewer.exportSuccess"));
      } else {
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
    } catch {
      Alert.alert(t("common.error"), t("viewer.exportFailed"));
    }
  }, [stacking.result, saveImage, exportFormat, t]);

  const handleShareResult = useCallback(async () => {
    if (!stacking.result) return;
    try {
      await shareImage(
        stacking.result.rgbaData,
        stacking.result.width,
        stacking.result.height,
        `stacked_${stacking.result.method}_${stacking.result.frameCount}f`,
        exportFormat,
      );
    } catch {
      Alert.alert(t("common.error"), t("share.failed"));
    }
  }, [stacking.result, shareImage, exportFormat, t]);

  const handleCompareSelected = useCallback(() => {
    if (selectedCompareIds.length < 2) return;
    router.push(`/compare?ids=${selectedCompareIds.join(",")}`);
  }, [router, selectedCompareIds]);

  const handleSelectByFilter = useCallback(
    (filter: string) => {
      clearSelection();
      for (const f of stackableFiles) {
        if ((f.filter ?? "Unknown") === filter) {
          toggleSelection(f.id);
        }
      }
    },
    [clearSelection, stackableFiles, toggleSelection],
  );

  const resultStats = useMemo(
    () => (stacking.result ? calculateStats(stacking.result.pixels) : null),
    [stacking.result],
  );

  const progressPercent = useMemo(() => {
    if (!stacking.progress || stacking.progress.total === 0) return undefined;
    return Math.round((stacking.progress.current / stacking.progress.total) * 100);
  }, [stacking.progress]);

  const selectedDarkPaths = useMemo(() => {
    if (calibration.darkFilepaths && calibration.darkFilepaths.length > 0) {
      return calibration.darkFilepaths;
    }
    return calibration.darkFilepath ? [calibration.darkFilepath] : [];
  }, [calibration.darkFilepath, calibration.darkFilepaths]);

  const selectedFlatPaths = useMemo(() => {
    if (calibration.flatFilepaths && calibration.flatFilepaths.length > 0) {
      return calibration.flatFilepaths;
    }
    return calibration.flatFilepath ? [calibration.flatFilepath] : [];
  }, [calibration.flatFilepath, calibration.flatFilepaths]);

  return (
    <View testID="e2e-screen-stacking__index" className="flex-1 bg-background">
      <LoadingOverlay
        visible={stacking.isStacking}
        message={stacking.progress?.message ?? `${t("editor.stacking")}...`}
        percent={progressPercent}
        current={stacking.progress?.current}
        total={stacking.progress?.total}
        onCancel={stacking.cancel}
      />
      <LoadingOverlay visible={isPersisting} message={t("editor.autoSaving")} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: 24,
        }}
      >
        <View className="flex-row items-center gap-3 mb-4">
          <Button size="sm" variant="outline" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={mutedColor} />
          </Button>
          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground">{t("editor.stacking")}</Text>
            <Text className="text-[10px] text-muted">
              {t("editor.framesSelected", {
                selected: selectedFiles.length,
                total: stackableFiles.length,
              })}
            </Text>
            {idsPreselectionSummary && (
              <Text className="text-[10px] text-muted">
                {t("editor.idsPreselectionSummary", {
                  selected: idsPreselectionSummary.selected,
                  requested: idsPreselectionSummary.requested,
                })}
                {idsPreselectionSummary.ignored > 0
                  ? ` · ${t("editor.idsPreselectionIgnored", { count: idsPreselectionSummary.ignored })}`
                  : ""}
              </Text>
            )}
          </View>
          {stacking.result && (
            <Button
              testID="e2e-action-stacking__index-reset"
              size="sm"
              variant="outline"
              onPress={() => {
                setUiWarnings([]);
                stacking.reset();
              }}
            >
              <Ionicons name="refresh-outline" size={14} color={mutedColor} />
            </Button>
          )}
        </View>

        <Separator className="mb-4" />

        {stackableFiles.length === 0 && (
          <HAlert status="warning" className="mb-4">
            <HAlert.Indicator />
            <HAlert.Content>
              <HAlert.Description>{t("editor.noStackableFiles")}</HAlert.Description>
            </HAlert.Content>
          </HAlert>
        )}

        {/* Method Selection */}
        <Text className="mb-2 text-xs font-semibold uppercase text-muted">
          {t("editor.algorithm")}
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {METHODS.map((m) => (
            <PressableFeedback key={m.key} onPress={() => setMethod(m.key)}>
              <Card
                variant="secondary"
                className={`min-w-[70px] ${method === m.key ? "border border-success" : ""}`}
              >
                <Card.Body className="items-center p-2.5">
                  <Ionicons
                    name={m.icon}
                    size={18}
                    color={method === m.key ? successColor : mutedColor}
                  />
                  <Text
                    className={`mt-1 text-[9px] ${method === m.key ? "text-success font-semibold" : "text-muted"}`}
                  >
                    {t(m.labelKey)}
                  </Text>
                </Card.Body>
              </Card>
            </PressableFeedback>
          ))}
        </View>

        {/* Sigma parameter (for sigma/winsorized methods) */}
        {(method === "sigma" || method === "winsorized") && (
          <View className="mb-4">
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("editor.sigma")}: {sigmaValue}
            </Text>
            <View className="flex-row gap-2">
              {[1.5, 2.0, 2.5, 3.0, 3.5].map((s) => (
                <Chip
                  key={s}
                  size="sm"
                  variant={sigmaValue === s ? "primary" : "secondary"}
                  onPress={() => setSigmaValue(s)}
                >
                  <Chip.Label className="text-[9px]">{s}σ</Chip.Label>
                </Chip>
              ))}
            </View>
          </View>
        )}

        {/* Alignment Mode */}
        <Text className="mb-2 text-xs font-semibold uppercase text-muted">
          {t("editor.alignment")}
        </Text>
        <View className="flex-row gap-2 mb-4">
          {ALIGNMENT_MODES.map((am) => (
            <PressableFeedback
              key={am.key}
              onPress={() => setAlignmentMode(am.key)}
              className="flex-1"
            >
              <Card
                variant="secondary"
                className={alignmentMode === am.key ? "border border-success" : ""}
              >
                <Card.Body className="items-center p-2.5">
                  <Ionicons
                    name={am.icon}
                    size={18}
                    color={alignmentMode === am.key ? successColor : mutedColor}
                  />
                  <Text
                    className={`mt-1 text-[9px] ${alignmentMode === am.key ? "text-success font-semibold" : "text-muted"}`}
                  >
                    {t(am.labelKey)}
                  </Text>
                </Card.Body>
              </Card>
            </PressableFeedback>
          ))}
        </View>

        {/* Detection Profile */}
        <Text className="mb-2 text-xs font-semibold uppercase text-muted">
          {t("settings.stackingDetectionProfile")}
        </Text>
        <View className="flex-row gap-2 mb-4">
          {DETECTION_PROFILES.map((profile) => (
            <Chip
              key={profile.key}
              size="sm"
              variant={detectionProfile === profile.key ? "primary" : "secondary"}
              onPress={() => setDetectionProfile(profile.key)}
            >
              <Chip.Label className="text-[9px]">{t(profile.labelKey)}</Chip.Label>
            </Chip>
          ))}
        </View>

        {/* Advanced Options */}
        <Accordion variant="surface" className="mb-4">
          <Accordion.Item value="advanced">
            <Accordion.Trigger>
              <Text className="text-xs font-semibold uppercase text-muted">
                {t("editor.advancedOptions")}
              </Text>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <View className="gap-2">
                {/* Quality Evaluation Toggle */}
                <Checkbox isSelected={enableQuality} onSelectedChange={setEnableQuality}>
                  <Checkbox.Indicator />
                  <Label className="text-xs">{t("editor.enableQualityEval")}</Label>
                </Checkbox>
                <Checkbox
                  testID="e2e-action-stacking__index-toggle-use-annotated"
                  isSelected={useAnnotatedForAlignment}
                  onSelectedChange={setUseAnnotatedForAlignment}
                >
                  <Checkbox.Indicator />
                  <Label className="text-xs">{t("editor.useAnnotatedForStacking")}</Label>
                </Checkbox>

                {/* Export Format */}
                <View className="flex-row items-center gap-2">
                  <Text className="text-[10px] text-muted">{t("editor.exportFormat")}:</Text>
                  {(["png", "jpeg", "webp", "tiff", "bmp", "fits"] as ExportFormat[]).map((fmt) => (
                    <Chip
                      key={fmt}
                      size="sm"
                      variant={exportFormat === fmt ? "primary" : "secondary"}
                      onPress={() => setExportFormat(fmt)}
                    >
                      <Chip.Label className="text-[9px]">{fmt.toUpperCase()}</Chip.Label>
                    </Chip>
                  ))}
                </View>

                <Separator className="my-1" />
                <Text className="text-[10px] font-semibold uppercase text-muted">
                  {t("settings.stackingDetectionProfile")} · {t("editor.alignment")}
                </Text>

                <SimpleSlider
                  label={t("settings.stackingDetectSigmaThreshold")}
                  value={detectSigmaThreshold}
                  min={1}
                  max={10}
                  step={0.1}
                  onValueChange={setDetectSigmaThreshold}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectMaxStars")}
                  value={detectMaxStars}
                  min={50}
                  max={800}
                  step={10}
                  onValueChange={setDetectMaxStars}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectMinArea")}
                  value={detectMinArea}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={(v) => {
                    setDetectMinArea(v);
                    if (v > detectMaxArea) setDetectMaxArea(v);
                  }}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectMaxArea")}
                  value={detectMaxArea}
                  min={20}
                  max={3000}
                  step={10}
                  onValueChange={(v) => {
                    setDetectMaxArea(v);
                    if (v < detectMinArea) setDetectMinArea(v);
                  }}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectBorderMargin")}
                  value={detectBorderMargin}
                  min={0}
                  max={64}
                  step={1}
                  onValueChange={setDetectBorderMargin}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectSigmaClipIters")}
                  value={detectSigmaClipIters}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(value) => setDetectSigmaClipIters(Math.round(value))}
                />
                <Checkbox
                  isSelected={detectApplyMatchedFilter}
                  onSelectedChange={setDetectApplyMatchedFilter}
                >
                  <Checkbox.Indicator />
                  <Label className="text-xs">
                    {t("settings.stackingDetectApplyMatchedFilter")}
                  </Label>
                </Checkbox>
                <View className="flex-row items-center gap-2">
                  <Text className="text-[10px] text-muted">
                    {t("settings.stackingDetectConnectivity")}:
                  </Text>
                  <Chip
                    size="sm"
                    variant={detectConnectivity === 4 ? "primary" : "secondary"}
                    onPress={() => setDetectConnectivity(4)}
                  >
                    <Chip.Label className="text-[9px]">4</Chip.Label>
                  </Chip>
                  <Chip
                    size="sm"
                    variant={detectConnectivity === 8 ? "primary" : "secondary"}
                    onPress={() => setDetectConnectivity(8)}
                  >
                    <Chip.Label className="text-[9px]">8</Chip.Label>
                  </Chip>
                </View>
                <SimpleSlider
                  label={t("settings.stackingBackgroundMeshSize")}
                  value={backgroundMeshSize}
                  min={16}
                  max={256}
                  step={8}
                  onValueChange={setBackgroundMeshSize}
                />
                <SimpleSlider
                  label={t("settings.stackingDeblendNLevels")}
                  value={deblendNLevels}
                  min={1}
                  max={32}
                  step={1}
                  onValueChange={setDeblendNLevels}
                />
                <SimpleSlider
                  label={t("settings.stackingDeblendMinContrast")}
                  value={deblendMinContrast}
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  onValueChange={setDeblendMinContrast}
                />
                <SimpleSlider
                  label={t("settings.stackingFilterFwhm")}
                  value={filterFwhm}
                  min={0.5}
                  max={8}
                  step={0.1}
                  onValueChange={setFilterFwhm}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectMinFwhm")}
                  value={detectMinFwhm}
                  min={0.1}
                  max={15}
                  step={0.1}
                  onValueChange={(value) => {
                    setDetectMinFwhm(value);
                    if (value > maxFwhm) setMaxFwhm(value);
                  }}
                />
                <SimpleSlider
                  label={t("settings.stackingMaxFwhm")}
                  value={maxFwhm}
                  min={1}
                  max={20}
                  step={0.1}
                  onValueChange={setMaxFwhm}
                />
                <SimpleSlider
                  label={t("settings.stackingMaxEllipticity")}
                  value={maxEllipticity}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={setMaxEllipticity}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectMinSharpness")}
                  value={detectMinSharpness}
                  min={0}
                  max={100}
                  step={0.05}
                  onValueChange={(value) => {
                    setDetectMinSharpness(value);
                    if (value > detectMaxSharpness) setDetectMaxSharpness(value);
                  }}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectMaxSharpness")}
                  value={detectMaxSharpness}
                  min={0}
                  max={100}
                  step={0.05}
                  onValueChange={(value) => {
                    setDetectMaxSharpness(value);
                    if (value < detectMinSharpness) setDetectMinSharpness(value);
                  }}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectPeakMax")}
                  value={detectPeakMax}
                  min={0}
                  max={10000}
                  step={10}
                  onValueChange={setDetectPeakMax}
                />
                <SimpleSlider
                  label={t("settings.stackingDetectSnrMin")}
                  value={detectSnrMin}
                  min={0}
                  max={50}
                  step={0.1}
                  onValueChange={setDetectSnrMin}
                />
                <SimpleSlider
                  label={t("settings.stackingRansacMaxIterations")}
                  value={ransacMaxIterations}
                  min={20}
                  max={400}
                  step={10}
                  onValueChange={setRansacMaxIterations}
                />
                <SimpleSlider
                  label={t("settings.stackingAlignmentInlierThreshold")}
                  value={alignmentInlierThreshold}
                  min={0.5}
                  max={10}
                  step={0.1}
                  onValueChange={setAlignmentInlierThreshold}
                />
              </View>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Separator className="mb-4" />

        {/* Calibration Frames */}
        <Accordion variant="surface" className="mb-4">
          <Accordion.Item value="calibration">
            <Accordion.Trigger>
              <View className="flex-row items-center gap-1">
                <Text className="text-xs font-semibold uppercase text-muted">
                  {t("editor.calibrationFrames")}
                </Text>
                {(selectedDarkPaths.length > 0 ||
                  selectedFlatPaths.length > 0 ||
                  calibration.biasFilepath) && (
                  <View className="h-1.5 w-1.5 rounded-full bg-success" />
                )}
              </View>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <View className="gap-3">
                {[
                  {
                    type: "dark" as const,
                    label: t("editor.darkFrame"),
                    selectedPaths: selectedDarkPaths,
                    multi: true,
                  },
                  {
                    type: "flat" as const,
                    label: t("editor.flatFrame"),
                    selectedPaths: selectedFlatPaths,
                    multi: true,
                  },
                  {
                    type: "bias" as const,
                    label: t("editor.biasFrame"),
                    selectedPaths: calibration.biasFilepath ? [calibration.biasFilepath] : [],
                    multi: false,
                  },
                ].map((group) => (
                  <View key={group.type} className="gap-1.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[10px] font-semibold text-muted">
                        {group.label} ·{" "}
                        {t("editor.calibrationSelectedCount", {
                          count: group.selectedPaths.length,
                        })}
                      </Text>
                      {group.selectedPaths.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          onPress={() => clearCalibrationType(group.type)}
                        >
                          <Ionicons name="close-circle" size={16} color={mutedColor} />
                        </Button>
                      )}
                    </View>
                    <View className="flex-row flex-wrap gap-1.5">
                      {calibrationCandidates.map((candidate) => {
                        const isSelected = group.selectedPaths.includes(candidate.filepath);
                        return (
                          <Chip
                            key={`${group.type}-${candidate.id}`}
                            size="sm"
                            variant={isSelected ? "primary" : "secondary"}
                            onPress={() => toggleCalibrationCandidate(group.type, candidate)}
                          >
                            <Chip.Label className="text-[9px]">
                              {candidate.filename}
                              {group.multi ? "" : isSelected ? " ✓" : ""}
                            </Chip.Label>
                          </Chip>
                        );
                      })}
                    </View>
                  </View>
                ))}
                {calibrationCandidates.length === 0 && (
                  <Text className="text-[10px] text-muted italic">
                    {t("editor.calibrationNoCandidates")}
                  </Text>
                )}
              </View>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>

        <Separator className="mb-4" />

        {uiWarnings.length > 0 && (
          <HAlert status="warning" className="mb-4">
            <HAlert.Indicator />
            <HAlert.Content>
              {uiWarnings.map((warning, index) => (
                <HAlert.Description key={`stack-warning-${index}`}>{warning}</HAlert.Description>
              ))}
            </HAlert.Content>
          </HAlert>
        )}

        {/* Error */}
        {stacking.error && (
          <HAlert status="danger" className="mb-4">
            <HAlert.Indicator />
            <HAlert.Content>
              <HAlert.Description>{stacking.error}</HAlert.Description>
            </HAlert.Content>
          </HAlert>
        )}

        {/* Result Preview */}
        {stacking.result && (
          <>
            <Text className="mb-2 text-xs font-semibold uppercase text-muted">
              {t("editor.resultPreview")}
            </Text>
            <View className="h-48 mb-3 rounded-lg overflow-hidden bg-black">
              <FitsCanvas
                rgbaData={stacking.result.rgbaData}
                width={stacking.result.width}
                height={stacking.result.height}
                showGrid={false}
                showCrosshair={false}
                cursorX={-1}
                cursorY={-1}
                interactionEnabled={false}
              />
            </View>

            {/* Stats Card */}
            {resultStats && (
              <Card variant="secondary" className="mb-2">
                <Card.Body className="gap-1 p-3">
                  <Text className="text-[10px] font-semibold text-muted mb-1">
                    {stacking.result.frameCount} {t("editor.frames")} ·{" "}
                    {t(`editor.${stacking.result.method}`)} ·{" "}
                    {(stacking.result.duration / 1000).toFixed(1)}s
                    {stacking.result.alignmentMode !== "none" &&
                      ` · ${t(`editor.align${stacking.result.alignmentMode.charAt(0).toUpperCase() + stacking.result.alignmentMode.slice(1)}`)}`}
                  </Text>
                  <Text className="text-xs text-foreground">
                    {t("editor.statMean")}: {resultStats.mean.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-foreground">
                    {t("editor.statMedian")}: {resultStats.median.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-foreground">
                    {t("editor.statStdDev")}: {resultStats.stddev.toFixed(2)}
                  </Text>
                  <Text className="text-xs text-foreground">
                    {t("editor.statSNR")}: {resultStats.snr.toFixed(2)}
                  </Text>
                </Card.Body>
              </Card>
            )}

            {/* Alignment Results */}
            {stacking.result.alignmentResults && stacking.result.alignmentResults.length > 0 && (
              <Card variant="secondary" className="mb-2">
                <Card.Body className="gap-1 p-3">
                  <Text className="text-[10px] font-semibold text-muted mb-1">
                    {t("editor.alignmentResults")}
                  </Text>
                  {stacking.result.alignmentResults.map((ar, idx) => (
                    <View key={idx} className="flex-row items-center gap-2">
                      <Text className="text-[9px] text-foreground flex-1" numberOfLines={1}>
                        {ar.filename}
                      </Text>
                      <Text className="text-[9px] text-muted">
                        {ar.matchedStars === -1
                          ? t("editor.referenceFrame")
                          : `${ar.matchedStars} ${t("editor.stars")} · RMS ${ar.rmsError.toFixed(2)}px · Ref ${ar.detectedRefStars ?? "-"} / Cur ${ar.detectedTargetStars ?? "-"}${ar.fallbackUsed && ar.fallbackUsed !== "none" ? ` · Fallback ${ar.fallbackUsed}` : ""}`}
                      </Text>
                    </View>
                  ))}
                </Card.Body>
              </Card>
            )}

            {stacking.result.annotationDiagnostics &&
              stacking.result.annotationDiagnostics.length > 0 && (
                <Card variant="secondary" className="mb-2">
                  <Card.Body className="gap-1 p-3">
                    <Text className="text-[10px] font-semibold text-muted mb-1">
                      {t("editor.annotationDiagnostics")}
                    </Text>
                    {stacking.result.annotationDiagnostics.map((diag, idx) => (
                      <View key={idx} className="flex-row items-center gap-2">
                        <View
                          className={`h-2 w-2 rounded-full ${diag.usedForAlignment ? "bg-success" : "bg-warning"}`}
                        />
                        <Text className="text-[9px] text-foreground flex-1" numberOfLines={1}>
                          {diag.filename}
                        </Text>
                        <Text className="text-[9px] text-muted">
                          {diag.usedForAlignment
                            ? t("editor.annotationUsed")
                            : `${t("editor.annotationFallback")} (${diag.reason ?? "unknown"})`}
                        </Text>
                      </View>
                    ))}
                  </Card.Body>
                </Card>
              )}

            {/* Quality Metrics */}
            {stacking.result.qualityMetrics && stacking.result.qualityMetrics.length > 0 && (
              <Card variant="secondary" className="mb-2">
                <Card.Body className="gap-1 p-3">
                  <Text className="text-[10px] font-semibold text-muted mb-1">
                    {t("editor.qualityMetrics")}
                  </Text>
                  {stacking.result.qualityMetrics.map((qm, idx) => (
                    <View key={idx} className="flex-row items-center gap-2">
                      <View
                        className={`h-2 w-2 rounded-full ${qm.score >= 70 ? "bg-success" : qm.score >= 40 ? "bg-warning" : "bg-danger"}`}
                      />
                      <Text className="text-[9px] text-foreground flex-1" numberOfLines={1}>
                        {selectedFiles[idx]?.filename ?? `Frame ${idx + 1}`}
                      </Text>
                      <Text className="text-[9px] text-muted">
                        {t("editor.qualityScore")}: {qm.score} · FWHM {qm.medianFwhm.toFixed(1)} ·{" "}
                        {qm.starCount} {t("editor.stars")}
                      </Text>
                    </View>
                  ))}
                </Card.Body>
              </Card>
            )}

            <View className="flex-row gap-2 mb-4">
              <Button variant="outline" size="sm" onPress={handleExport} className="flex-1">
                <Ionicons name="download-outline" size={14} color={successColor} />
                <Button.Label>
                  {t("editor.exportResult")} ({exportFormat.toUpperCase()})
                </Button.Label>
              </Button>
              <Button variant="outline" size="sm" onPress={handleShareResult}>
                <Ionicons name="share-outline" size={14} color={successColor} />
              </Button>
            </View>
            <Separator className="mb-4" />
          </>
        )}

        {/* Frame Selection Header */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-semibold uppercase text-muted">
            {t("editor.frames")} ({selectedFiles.length}/{stackableFiles.length})
          </Text>
          <View className="flex-row gap-2">
            <Button size="sm" variant="ghost" onPress={selectAll}>
              <Button.Label className="text-[10px] text-success">
                {t("editor.selectAll")}
              </Button.Label>
            </Button>
            <Button size="sm" variant="ghost" onPress={clearSelection}>
              <Button.Label className="text-[10px] text-muted">
                {t("editor.deselectAll")}
              </Button.Label>
            </Button>
          </View>
        </View>

        {/* Filter Group Chips */}
        {Object.keys(filterGroups).length > 1 && (
          <View className="flex-row flex-wrap gap-1.5 mb-3">
            <Chip
              size="sm"
              variant={filterGroup === null ? "primary" : "secondary"}
              onPress={() => setFilterGroup(null)}
            >
              <Chip.Label className="text-[9px]">{t("editor.allFilters")}</Chip.Label>
            </Chip>
            {Object.entries(filterGroups).map(([filter, count]) => (
              <Chip
                key={filter}
                size="sm"
                variant={filterGroup === filter ? "primary" : "secondary"}
                onPress={() => {
                  setFilterGroup(filter);
                  handleSelectByFilter(filter);
                }}
              >
                <Chip.Label className="text-[9px]">
                  {filter} ({count})
                </Chip.Label>
              </Chip>
            ))}
          </View>
        )}

        {displayFiles.length === 0 ? (
          <EmptyState
            icon="images-outline"
            title={
              stackableFiles.length === 0
                ? t("editor.noStackableFiles")
                : t("editor.noFitsAvailable")
            }
          />
        ) : (
          <View className="gap-1.5">
            {displayFiles.map((file) => {
              const isSelected = selectedIds.includes(file.id);
              return (
                <PressableFeedback key={file.id} onPress={() => toggleSelection(file.id)}>
                  <Card variant="secondary" className={isSelected ? "border border-success" : ""}>
                    <Card.Body className="flex-row items-center gap-3 p-2.5">
                      <Checkbox
                        isSelected={isSelected}
                        onSelectedChange={() => toggleSelection(file.id)}
                      >
                        <Checkbox.Indicator />
                      </Checkbox>
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                          {file.filename}
                        </Text>
                        <Text className="text-[9px] text-muted">
                          {file.object ?? "-"} · {file.filter ?? "-"} · {file.exptime ?? 0}s
                        </Text>
                      </View>
                      {file.naxis1 && file.naxis2 && (
                        <Text className="text-[9px] text-muted">
                          {file.naxis1}×{file.naxis2}
                        </Text>
                      )}
                    </Card.Body>
                  </Card>
                </PressableFeedback>
              );
            })}
          </View>
        )}

        {(precheck.errors.length > 0 || precheck.warnings.length > 0) &&
          selectedFiles.length >= 2 && (
            <View className="mt-4 gap-2">
              {precheck.errors.length > 0 && (
                <HAlert status="danger">
                  <HAlert.Indicator />
                  <HAlert.Content>
                    {precheck.errors.map((message, index) => (
                      <HAlert.Description key={`stack-precheck-error-${index}`}>
                        {message}
                      </HAlert.Description>
                    ))}
                  </HAlert.Content>
                </HAlert>
              )}

              {precheck.warnings.length > 0 && (
                <HAlert status="warning">
                  <HAlert.Indicator />
                  <HAlert.Content>
                    {precheck.warnings.map((message, index) => (
                      <HAlert.Description key={`stack-precheck-warning-${index}`}>
                        {message}
                      </HAlert.Description>
                    ))}
                  </HAlert.Content>
                </HAlert>
              )}
            </View>
          )}

        {/* Stack Button */}
        <View className="mt-6">
          <Button
            testID="e2e-action-stacking__index-open-compare"
            variant="outline"
            onPress={handleCompareSelected}
            isDisabled={selectedCompareIds.length < 2}
            className="mb-2"
          >
            <Ionicons name="git-compare-outline" size={16} color={successColor} />
            <Button.Label>{t("gallery.compare")}</Button.Label>
          </Button>
          <Button
            testID="e2e-action-stacking__index-start"
            variant="primary"
            onPress={handleStack}
            isDisabled={
              selectedFiles.length < 2 || stacking.isStacking || precheck.errors.length > 0
            }
          >
            <Ionicons name="layers-outline" size={16} color="#fff" />
            <Button.Label>
              {t("editor.stackButton")} ({selectedFiles.length} {t("editor.frames")})
            </Button.Label>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
