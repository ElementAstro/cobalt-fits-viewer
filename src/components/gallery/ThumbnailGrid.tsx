import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Skeleton, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";
import { useThumbnailOnDemand } from "../../hooks/gallery/useThumbnailOnDemand";
import type { ThumbnailRequestPriority } from "../../lib/gallery/thumbnailScheduler";
import { formatVideoDuration, formatVideoResolution } from "../../lib/video/format";
import type { FitsMetadata } from "../../lib/fits/types";
import { isVideoFile, isAudioFile } from "../../lib/media/routing";
import {
  buildInitialSnapshot,
  buildLoadingSummary,
  withByteProgress,
  withStage,
  type ThumbnailLoadSnapshot,
  type ThumbnailLoadingSummary,
} from "./thumbnailLoading";
import { ThumbnailProgressOverlay } from "./ThumbnailProgressOverlay";
import { MediaTypeBadge } from "./MediaTypeBadge";

const NEARBY_PREFETCH_ROWS = 2;

interface ThumbnailGridProps {
  files: FitsMetadata[];
  columns?: number;
  selectionMode?: boolean;
  selectedIds?: string[];
  onPress?: (file: FitsMetadata) => void;
  onLongPress?: (file: FitsMetadata) => void;
  onSelect?: (fileId: string) => void;
  scrollEnabled?: boolean;
  ListHeaderComponent?: React.ReactElement | null;
  showFilename?: boolean;
  showObject?: boolean;
  showFilter?: boolean;
  showExposure?: boolean;
  showLoadProgress?: boolean;
  onLoadingSummaryChange?: (summary: ThumbnailLoadingSummary) => void;
}

interface FlashListViewableItem {
  item: FitsMetadata;
  index?: number | null;
  isViewable?: boolean;
}

const ThumbnailItem = memo(function ThumbnailItem({
  file,
  size,
  isSelected,
  selectionMode,
  onPress,
  onLongPress,
  onSelect,
  successColor,
  mutedColor,
  showFilename = true,
  showObject = false,
  showFilter = true,
  showExposure = false,
  showLoadProgress = true,
  onSnapshotChange,
  onRequestThumbnail,
}: {
  file: FitsMetadata;
  size: number;
  isSelected: boolean;
  selectionMode: boolean;
  onPress?: (file: FitsMetadata) => void;
  onLongPress?: (file: FitsMetadata) => void;
  onSelect?: (fileId: string) => void;
  successColor: string;
  mutedColor: string;
  showFilename?: boolean;
  showObject?: boolean;
  showFilter?: boolean;
  showExposure?: boolean;
  showLoadProgress?: boolean;
  onSnapshotChange: (snapshot: ThumbnailLoadSnapshot) => void;
  onRequestThumbnail?: (file: FitsMetadata, priority?: ThumbnailRequestPriority) => void;
}) {
  const thumbnailUri = useMemo(
    () => resolveThumbnailUri(file.id, file.thumbnailUri),
    [file.id, file.thumbnailUri],
  );
  const isVideo = isVideoFile(file);
  const isAudio = isAudioFile(file);
  const duration = formatVideoDuration(file.durationMs);
  const resolution = formatVideoResolution(file.videoWidth, file.videoHeight);
  const [snapshot, setSnapshot] = useState<ThumbnailLoadSnapshot>(() =>
    buildInitialSnapshot(file.id),
  );

  useEffect(() => {
    setSnapshot(buildInitialSnapshot(file.id));
  }, [file.id, thumbnailUri]);

  useEffect(() => {
    if (!thumbnailUri) {
      setSnapshot((prev) => withStage(prev, "ready"));
      onRequestThumbnail?.(file, "background");
    }
  }, [thumbnailUri, file, onRequestThumbnail]);

  useEffect(() => {
    onSnapshotChange(snapshot);
  }, [onSnapshotChange, snapshot]);

  const handleLoadStart = useCallback(() => {
    setSnapshot((prev) => withStage(buildInitialSnapshot(prev.fileId), "loading"));
  }, []);

  const handleLoadProgress = useCallback(
    (
      event: { loaded: number; total: number } | { nativeEvent: { loaded: number; total: number } },
    ) => {
      const payload = "nativeEvent" in event ? event.nativeEvent : event;
      setSnapshot((prev) =>
        withByteProgress(withStage(prev, "loading"), payload.loaded, payload.total),
      );
    },
    [],
  );

  const handleLoad = useCallback(() => {
    setSnapshot((prev) => withStage(prev, "decoding"));
  }, []);

  const handleDisplay = useCallback(() => {
    setSnapshot((prev) => ({ ...withStage(prev, "ready"), progress: 1 }));
  }, []);

  const handleLoadEnd = useCallback(() => {
    setSnapshot((prev) => {
      if (prev.stage === "error" || prev.stage === "ready") return prev;
      return { ...withStage(prev, "ready"), progress: 1 };
    });
  }, []);

  const handleError = useCallback(() => {
    setSnapshot((prev) => ({ ...withStage(prev, "error"), progress: 1 }));
  }, []);

  return (
    <Pressable
      style={{ width: size, height: size, padding: 3 }}
      onPress={() => {
        if (selectionMode && onSelect) {
          onSelect(file.id);
        } else {
          onPress?.(file);
        }
      }}
      onLongPress={() => onLongPress?.(file)}
      accessibilityLabel={file.filename}
      accessibilityRole="button"
    >
      <View
        className={`h-full w-full items-center justify-center rounded-lg bg-surface-secondary overflow-hidden ${
          isSelected ? "border-2 border-success" : ""
        }`}
      >
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={file.id}
            transition={200}
            onLoadStart={handleLoadStart}
            onProgress={handleLoadProgress}
            onLoad={handleLoad}
            onDisplay={handleDisplay}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
          />
        ) : (
          <Skeleton className="h-full w-full rounded-lg">
            <View className="h-full w-full items-center justify-center">
              <Ionicons
                name={isAudio ? "musical-notes-outline" : "image-outline"}
                size={28}
                color={mutedColor}
              />
            </View>
          </Skeleton>
        )}

        {(isVideo || isAudio) && (
          <MediaTypeBadge
            mediaKind={isVideo ? "video" : "audio"}
            duration={duration}
            iconPosition="top-right"
          />
        )}

        {/* Overlay info */}
        {(showFilename || showObject || showFilter || showExposure) && (
          <View className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1">
            {showFilename && (
              <Text className="text-[8px] text-white" numberOfLines={1}>
                {file.filename}
              </Text>
            )}
            {(showObject || showFilter || showExposure) && (
              <Text className="text-[7px] text-white/70" numberOfLines={1}>
                {[
                  showObject && file.object,
                  showFilter && file.filter,
                  showExposure && file.exptime != null && `${file.exptime}s`,
                  isVideo && "VIDEO",
                  isAudio && "AUDIO",
                  isVideo && resolution,
                  (isVideo || isAudio) && duration,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            )}
          </View>
        )}

        {/* Favorite badge */}
        {file.isFavorite && (
          <View className="absolute top-1 right-1">
            <Ionicons name="heart" size={12} color={successColor} />
          </View>
        )}

        {/* Selection checkbox */}
        {selectionMode && (
          <View className="absolute top-1 left-1">
            <Ionicons
              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
              size={18}
              color={isSelected ? successColor : "white"}
            />
          </View>
        )}

        {showLoadProgress && thumbnailUri && snapshot.stage !== "ready" && (
          <ThumbnailProgressOverlay snapshot={snapshot} />
        )}
      </View>
    </Pressable>
  );
});

export function ThumbnailGrid({
  files,
  columns = 3,
  selectionMode = false,
  selectedIds = [],
  onPress,
  onLongPress,
  onSelect,
  scrollEnabled = true,
  ListHeaderComponent,
  showFilename = true,
  showObject = false,
  showFilter = true,
  showExposure = false,
  showLoadProgress = true,
  onLoadingSummaryChange,
}: ThumbnailGridProps) {
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const { requestThumbnail } = useThumbnailOnDemand();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscapeGrid = screenWidth > screenHeight;
  const gridPadding = isLandscapeGrid ? 16 : 32;
  const itemSize = Math.floor((screenWidth - gridPadding) / columns);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [snapshots, setSnapshots] = useState<Record<string, ThumbnailLoadSnapshot>>({});
  const prevFileIdsRef = useRef<Set<string>>(new Set());
  const lastViewWindowRef = useRef<string>("");

  useEffect(() => {
    const currentIds = new Set(files.map((file) => file.id));
    const prev = prevFileIdsRef.current;
    if (currentIds.size !== prev.size || [...currentIds].some((id) => !prev.has(id))) {
      setSnapshots((prevSnaps) => {
        const next: Record<string, ThumbnailLoadSnapshot> = {};
        for (const [fileId, snapshot] of Object.entries(prevSnaps)) {
          if (currentIds.has(fileId)) {
            next[fileId] = snapshot;
          }
        }
        return next;
      });
      prevFileIdsRef.current = currentIds;
    }
  }, [files]);

  const loadingSummary = useMemo(() => buildLoadingSummary(files, snapshots), [files, snapshots]);

  useEffect(() => {
    onLoadingSummaryChange?.(loadingSummary);
  }, [loadingSummary, onLoadingSummaryChange]);

  const handleSnapshotChange = useCallback((snapshot: ThumbnailLoadSnapshot) => {
    setSnapshots((prev) => {
      const existing = prev[snapshot.fileId];
      if (
        existing &&
        existing.stage === snapshot.stage &&
        existing.progress === snapshot.progress &&
        existing.loadedBytes === snapshot.loadedBytes &&
        existing.totalBytes === snapshot.totalBytes &&
        existing.hasByteProgress === snapshot.hasByteProgress
      ) {
        return prev;
      }
      return {
        ...prev,
        [snapshot.fileId]: snapshot,
      };
    });
  }, []);

  const requestWithPriority = useCallback(
    (file: FitsMetadata, priority: ThumbnailRequestPriority) => {
      if (file.sourceType === "audio") return;
      if (resolveThumbnailUri(file.id, file.thumbnailUri)) return;
      void requestThumbnail(file, priority);
    },
    [requestThumbnail],
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: FlashListViewableItem[] }) => {
      if (!files.length || !viewableItems?.length) return;

      const visibleIndices = viewableItems
        .filter(
          (entry): entry is FlashListViewableItem & { index: number } =>
            (entry.isViewable ?? true) && typeof entry.index === "number",
        )
        .map((entry) => entry.index)
        .sort((a, b) => a - b);

      if (!visibleIndices.length) return;

      const nearbySpan = Math.max(columns * NEARBY_PREFETCH_ROWS, columns);
      const minVisible = visibleIndices[0];
      const maxVisible = visibleIndices[visibleIndices.length - 1];
      const nearbyStart = Math.max(0, minVisible - nearbySpan);
      const nearbyEnd = Math.min(files.length - 1, maxVisible + nearbySpan);

      const signature = `${nearbyStart}:${nearbyEnd}:${visibleIndices.join(",")}`;
      if (signature === lastViewWindowRef.current) return;
      lastViewWindowRef.current = signature;

      const visibleSet = new Set(visibleIndices);

      for (const index of visibleIndices) {
        const file = files[index];
        if (!file) continue;
        requestWithPriority(file, "visible");
      }

      for (let index = nearbyStart; index <= nearbyEnd; index++) {
        if (visibleSet.has(index)) continue;
        const file = files[index];
        if (!file) continue;
        requestWithPriority(file, "nearby");
      }

      for (let index = 0; index < files.length; index++) {
        if (index >= nearbyStart && index <= nearbyEnd) continue;
        const file = files[index];
        if (!file) continue;
        requestWithPriority(file, "background");
      }
    },
    [columns, files, requestWithPriority],
  );

  const renderItem = useCallback(
    ({ item }: { item: FitsMetadata }) => (
      <ThumbnailItem
        file={item}
        size={itemSize}
        isSelected={selectedIdSet.has(item.id)}
        selectionMode={selectionMode}
        onPress={onPress}
        onLongPress={onLongPress}
        onSelect={onSelect}
        successColor={successColor}
        mutedColor={mutedColor}
        showFilename={showFilename}
        showObject={showObject}
        showFilter={showFilter}
        showExposure={showExposure}
        showLoadProgress={showLoadProgress}
        onSnapshotChange={handleSnapshotChange}
        onRequestThumbnail={requestThumbnail}
      />
    ),
    [
      itemSize,
      selectedIdSet,
      selectionMode,
      onPress,
      onLongPress,
      onSelect,
      successColor,
      mutedColor,
      showFilename,
      showObject,
      showFilter,
      showExposure,
      showLoadProgress,
      handleSnapshotChange,
      requestThumbnail,
    ],
  );

  const keyExtractor = useCallback((item: FitsMetadata) => item.id, []);

  return (
    <FlashList
      data={files}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={columns}
      drawDistance={itemSize * 3}
      onViewableItemsChanged={handleViewableItemsChanged}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
      extraData={selectedIdSet}
    />
  );
}
