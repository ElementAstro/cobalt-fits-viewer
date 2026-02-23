import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVideoPlayerState } from "../../hooks/useVideoPlayerState";
import { Alert, ScrollView, StatusBar, Text, View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Accordion,
  Button,
  Card,
  Chip,
  Select,
  Skeleton,
  Spinner,
  Switch,
  Tabs,
  useThemeColor,
} from "heroui-native";
import { VideoView, isPictureInPictureSupported, useVideoPlayer } from "expo-video";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { formatFileSize } from "../../lib/utils/fileManager";
import {
  formatVideoDuration,
  formatVideoDurationWithMs,
  formatVideoResolution,
  translateEngineError,
  taskStatusColor,
  translateTaskStatus,
} from "../../lib/video/format";
import { AnimatedProgressBar } from "../../components/common/AnimatedProgressBar";
import { shareFile, type MediaExportFormat } from "../../lib/utils/imageExport";
import { useMediaLibrary } from "../../hooks/useMediaLibrary";
import { useVideoProcessing } from "../../hooks/useVideoProcessing";
import { VideoProcessingSheet } from "../../components/video/VideoProcessingSheet";
import { TaskQueueSheet } from "../../components/video/TaskQueueSheet";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import { isMediaWorkspaceFile, routeForMedia } from "../../lib/media/routing";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";

function toMediaExportFormat(
  format?: string,
  mediaKind: "video" | "audio" | "image" = "video",
): MediaExportFormat {
  if (!format) return mediaKind === "audio" ? "m4a" : "mp4";
  const normalized = format.toLowerCase();
  if (
    normalized === "mp4" ||
    normalized === "mov" ||
    normalized === "m4v" ||
    normalized === "webm" ||
    normalized === "mkv" ||
    normalized === "avi" ||
    normalized === "3gp"
  ) {
    return normalized;
  }
  if (
    normalized === "mp3" ||
    normalized === "aac" ||
    normalized === "m4a" ||
    normalized === "wav"
  ) {
    return normalized;
  }
  return mediaKind === "audio" ? "m4a" : "mp4";
}

export default function VideoDetailScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [warningColor, mutedColor] = useThemeColor(["warning", "muted"]);
  const { isLandscape, sidePanelWidth } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const haptics = useHapticFeedback();

  const file = useFitsStore((s) => s.getFileById(id ?? ""));
  const allFiles = useFitsStore((s) => s.files);
  const toggleFavorite = useFitsStore((s) => s.toggleFavorite);
  const updateFile = useFitsStore((s) => s.updateFile);
  const videoAutoplay = useSettingsStore((s) => s.videoAutoplay);
  const videoLoopByDefault = useSettingsStore((s) => s.videoLoopByDefault);
  const videoMutedByDefault = useSettingsStore((s) => s.videoMutedByDefault);
  const defaultVideoProfile = useSettingsStore((s) => s.defaultVideoProfile);
  const defaultVideoTargetPreset = useSettingsStore((s) => s.defaultVideoTargetPreset);
  const videoCoreEnabled = useSettingsStore((s) => s.videoCoreEnabled);
  const videoProcessingEnabled = useSettingsStore((s) => s.videoProcessingEnabled);

  const { saveToDevice, isSaving } = useMediaLibrary();
  const {
    tasks,
    isEngineAvailable,
    engineCapabilities,
    enqueueProcessingTask,
    retryTask,
    removeTask,
    clearFinished,
    cancelTask,
  } = useVideoProcessing();

  const [activeTab, setActiveTab] = useState("info");
  const [showProcessingSheet, setShowProcessingSheet] = useState(false);
  const [showQueueSheet, setShowQueueSheet] = useState(false);
  const [abLoopA, setAbLoopA] = useState<number | null>(null);
  const [abLoopB, setAbLoopB] = useState<number | null>(null);

  const videoViewRef = useRef<VideoView | null>(null);
  const isVideo = file?.mediaKind === "video" || file?.sourceType === "video";
  const isAudio = file?.mediaKind === "audio" || file?.sourceType === "audio";
  const isMedia = Boolean(file && isMediaWorkspaceFile(file));
  const pipSupported = isPictureInPictureSupported();

  const currentFileIndex = useMemo(
    () => allFiles.findIndex((entry) => entry.id === file?.id),
    [allFiles, file?.id],
  );
  const prevVideoId = useMemo(() => {
    if (currentFileIndex <= 0) return null;
    for (let i = currentFileIndex - 1; i >= 0; i--) {
      const entry = allFiles[i];
      if (isMediaWorkspaceFile(entry)) return entry.id;
    }
    return null;
  }, [allFiles, currentFileIndex]);
  const nextVideoId = useMemo(() => {
    if (currentFileIndex < 0) return null;
    for (let i = currentFileIndex + 1; i < allFiles.length; i++) {
      const entry = allFiles[i];
      if (isMediaWorkspaceFile(entry)) return entry.id;
    }
    return null;
  }, [allFiles, currentFileIndex]);

  useEffect(() => {
    if (!id || !file) return;
    if (!isMedia) {
      router.replace(`/viewer/${id}`);
      return;
    }
    updateFile(file.id, { lastViewed: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, isMedia]);

  useEffect(() => {
    StatusBar.setHidden(isLandscape, "fade");
    return () => {
      StatusBar.setHidden(false, "fade");
    };
  }, [isLandscape]);

  const player = useVideoPlayer(isMedia && file ? { uri: file.filepath } : null, (instance) => {
    instance.loop = videoLoopByDefault;
    instance.muted = videoMutedByDefault;
    instance.volume = 1;
    instance.playbackRate = 1;
    instance.timeUpdateEventInterval = 0.2;
    if (videoAutoplay) {
      instance.play();
    }
  });

  useEffect(() => {
    player.loop = videoLoopByDefault;
  }, [player, videoLoopByDefault]);

  useEffect(() => {
    player.muted = videoMutedByDefault;
  }, [player, videoMutedByDefault]);

  const {
    isPlayerReady,
    playerStatus,
    playerError,
    durationSec,
    currentTimeSec,
    isPlaying,
    playbackRate,
    isMuted,
    volume,
    availableAudioTracks,
    availableSubtitleTracks,
    activeAudioTrackId,
    activeSubtitleTrackId,
    handlePlayPause,
    handleSeekBy,
    handleSeekTo,
    handleCycleRate,
    handleToggleMute,
    handleToggleLoop,
    handleVolumeChange,
    handleSelectAudioTrack,
    handleSelectSubtitleTrack,
    handleRetryPlayback,
  } = useVideoPlayerState(player, haptics, {
    abLoopA,
    abLoopB,
    errorFallbackMessage: t("settings.videoPlaybackError"),
  });

  const fileTasks = useMemo(
    () => tasks.filter((task) => task.request.sourceId === file?.id),
    [file?.id, tasks],
  );

  const handleSetAbLoopA = useCallback(() => {
    haptics.selection();
    setAbLoopA(currentTimeSec);
  }, [currentTimeSec, haptics]);

  const handleSetAbLoopB = useCallback(() => {
    haptics.selection();
    if (abLoopA !== null && currentTimeSec > abLoopA) {
      setAbLoopB(currentTimeSec);
    }
  }, [abLoopA, currentTimeSec, haptics]);

  const handleClearAbLoop = useCallback(() => {
    haptics.selection();
    setAbLoopA(null);
    setAbLoopB(null);
  }, [haptics]);

  const handleFullscreen = useCallback(async () => {
    haptics.selection();
    try {
      await videoViewRef.current?.enterFullscreen();
    } catch {
      Alert.alert(t("settings.videoFullscreenError"));
    }
  }, [t, haptics]);

  const handlePip = useCallback(async () => {
    if (!pipSupported) {
      Alert.alert(t("settings.videoPipError"));
      return;
    }
    try {
      await videoViewRef.current?.startPictureInPicture();
    } catch {
      Alert.alert(t("settings.videoPipError"));
    }
  }, [pipSupported, t]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!file) return;
    const intent = isVideo ? "video" : "unknown";
    const uri = await saveToDevice(file.filepath, intent);
    if (uri) {
      Alert.alert(t("settings.videoSavedToLibrary"));
      return;
    }
    Alert.alert(t("settings.videoSaveError"));
  }, [file, isVideo, saveToDevice, t]);

  const handleShare = useCallback(async () => {
    if (!file) return;
    try {
      await shareFile(file.filepath, {
        format: toMediaExportFormat(
          file.sourceFormat,
          file.mediaKind ?? (isAudio ? "audio" : isVideo ? "video" : "image"),
        ),
        filename: file.filename,
      });
    } catch {
      Alert.alert(t("settings.videoShareError"));
    }
  }, [file, isAudio, isVideo, t]);

  if (!file) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Ionicons name="alert-circle-outline" size={52} color={mutedColor} />
        <Text className="mt-4 text-center text-sm text-muted">
          {t("settings.videoFileNotFound")}
        </Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>{t("settings.videoBack")}</Button.Label>
        </Button>
      </View>
    );
  }

  if (!videoCoreEnabled) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Ionicons name="videocam-off-outline" size={52} color={mutedColor} />
        <Text className="mt-4 text-center text-sm text-muted">
          {t("settings.videoFeaturesDisabled")}
        </Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>{t("settings.videoBack")}</Button.Label>
        </Button>
      </View>
    );
  }

  const toolbarContent = (
    <View
      className="mb-3 flex-row items-center justify-between gap-2"
      style={{
        paddingTop: isLandscape ? 6 : Math.max(insets.top, 12),
        paddingLeft: isLandscape ? 6 : 0,
        paddingRight: isLandscape ? 6 : 0,
      }}
    >
      <Button
        size="sm"
        variant="outline"
        isIconOnly
        onPress={() => router.back()}
        accessibilityLabel={t("settings.videoBack")}
      >
        <Ionicons name="arrow-back" size={16} color={mutedColor} />
      </Button>
      <View className="flex-row items-center gap-0.5">
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={() => prevVideoId && router.replace(`/video/${prevVideoId}`)}
          isDisabled={!prevVideoId}
          accessibilityLabel={t("settings.videoPrevious")}
        >
          <Ionicons name="chevron-back" size={16} color={prevVideoId ? mutedColor : "#444"} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={() => nextVideoId && router.replace(`/video/${nextVideoId}`)}
          isDisabled={!nextVideoId}
          accessibilityLabel={t("settings.videoNext")}
        >
          <Ionicons name="chevron-forward" size={16} color={nextVideoId ? mutedColor : "#444"} />
        </Button>
      </View>
      <Text
        className="flex-1 min-w-0 text-center text-xs font-semibold text-foreground"
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {file.filename}
      </Text>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        onPress={() => {
          haptics.selection();
          toggleFavorite(file.id);
        }}
        accessibilityLabel={
          file.isFavorite ? t("settings.videoUnfavorite") : t("settings.videoFavorite")
        }
      >
        <Ionicons
          name={file.isFavorite ? "star" : "star-outline"}
          size={16}
          color={file.isFavorite ? warningColor : mutedColor}
        />
      </Button>
    </View>
  );

  const playerCardContent = (
    <Card variant="secondary">
      <Card.Body className="p-2">
        <View
          className="overflow-hidden rounded-lg bg-black"
          style={{ height: isLandscape ? 180 : 220 }}
        >
          {!isPlayerReady || playerStatus === "loading" ? (
            <Skeleton className="absolute inset-0">
              <View className="h-full w-full items-center justify-center">
                <Spinner />
              </View>
            </Skeleton>
          ) : null}
          <VideoView
            ref={videoViewRef}
            player={player}
            className="h-full w-full"
            nativeControls
            contentFit="contain"
            allowsPictureInPicture={isVideo}
          />
          {isAudio && (
            <View className="absolute inset-0 items-center justify-center bg-black/35">
              <Ionicons name="musical-notes-outline" size={48} color="#d2d2d2" />
              <Text className="mt-2 text-xs text-white">
                {formatVideoDuration(file.durationMs)}
              </Text>
            </View>
          )}
          {playerStatus === "error" && (
            <View className="absolute inset-0 items-center justify-center bg-black/70 px-4">
              <Ionicons name="alert-circle-outline" size={28} color="#ffce84" />
              <Text className="mt-2 text-center text-xs text-white">
                {playerError ?? t("settings.videoPlaybackError")}
              </Text>
              <Button size="sm" variant="outline" className="mt-3" onPress={handleRetryPlayback}>
                <Button.Label>{t("settings.videoRetry")}</Button.Label>
              </Button>
            </View>
          )}
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              isIconOnly
              onPress={() => handleSeekBy(-10)}
              accessibilityLabel={t("settings.videoRewind")}
            >
              <Ionicons name="play-back" size={14} color={mutedColor} />
            </Button>
            <Button
              testID="e2e-action-video__param_id-play-pause"
              size="sm"
              variant="primary"
              isIconOnly
              onPress={handlePlayPause}
              accessibilityLabel={
                isPlaying ? t("settings.videoPauseLabel") : t("settings.videoPlayLabel")
              }
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={14} color="#fff" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              isIconOnly
              onPress={() => handleSeekBy(10)}
              accessibilityLabel={t("settings.videoForward")}
            >
              <Ionicons name="play-forward" size={14} color={mutedColor} />
            </Button>
          </View>
          <View className="flex-row items-center gap-1">
            <Button
              testID="e2e-action-video__param_id-cycle-rate"
              size="sm"
              variant="outline"
              onPress={handleCycleRate}
            >
              <Button.Label>{playbackRate.toFixed(1)}x</Button.Label>
            </Button>
            <Button
              size="sm"
              variant="outline"
              isIconOnly
              onPress={handleToggleMute}
              accessibilityLabel={
                isMuted ? t("settings.videoUnmuteLabel") : t("settings.videoMuteLabel")
              }
            >
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={14}
                color={mutedColor}
              />
            </Button>
            {isVideo && (
              <Button
                size="sm"
                variant="outline"
                isIconOnly
                onPress={handleFullscreen}
                accessibilityLabel={t("settings.videoFullscreenLabel")}
              >
                <Ionicons name="expand-outline" size={14} color={mutedColor} />
              </Button>
            )}
            {isVideo && (
              <Button
                size="sm"
                variant="outline"
                isIconOnly
                onPress={handlePip}
                accessibilityLabel={t("settings.videoPipLabel")}
              >
                <Ionicons name="albums-outline" size={14} color={mutedColor} />
              </Button>
            )}
          </View>
        </View>

        <View className="mt-2 px-1">
          <SimpleSlider
            label={t("settings.videoSeek")}
            value={Math.max(0, Math.min(durationSec || 0, currentTimeSec))}
            min={0}
            max={Math.max(0.1, durationSec || 0)}
            step={0.1}
            onValueChange={handleSeekTo}
          />
        </View>

        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs text-muted">
            {formatVideoDurationWithMs(Math.round(currentTimeSec * 1000))}
          </Text>
          <Text className="text-xs text-muted">
            {formatVideoDurationWithMs(Math.round(durationSec * 1000))}
          </Text>
        </View>
        <View className="mt-1 flex-row items-center justify-between">
          <Text className="text-[10px] text-muted">
            {t("settings.videoStatusLabel", { status: playerStatus })}
          </Text>
          <Text className="text-[10px] text-muted">
            {t("settings.videoVolumeLabel", { volume: Math.round(volume * 100) })}
          </Text>
        </View>
        <View className="mt-2 px-1">
          <SimpleSlider
            label={t("settings.videoVolume")}
            value={volume}
            min={0}
            max={1}
            step={0.05}
            onValueChange={handleVolumeChange}
          />
        </View>
        <View className="mt-2 flex-row items-center gap-1">
          <Button
            size="sm"
            variant={abLoopA !== null ? "primary" : "outline"}
            onPress={handleSetAbLoopA}
          >
            <Button.Label>A{abLoopA !== null ? ` ${abLoopA.toFixed(1)}s` : ""}</Button.Label>
          </Button>
          <Button
            size="sm"
            variant={abLoopB !== null ? "primary" : "outline"}
            onPress={handleSetAbLoopB}
            isDisabled={abLoopA === null}
          >
            <Button.Label>B{abLoopB !== null ? ` ${abLoopB.toFixed(1)}s` : ""}</Button.Label>
          </Button>
          {(abLoopA !== null || abLoopB !== null) && (
            <Button size="sm" variant="outline" onPress={handleClearAbLoop}>
              <Button.Label>{t("settings.videoAbLoopClear")}</Button.Label>
            </Button>
          )}
        </View>
      </Card.Body>
    </Card>
  );

  const controlsContent = (
    <>
      <View className="mt-3 flex-row items-center gap-2">
        <Switch isSelected={player.loop} onSelectedChange={handleToggleLoop}>
          <Switch.Thumb />
          <Text className="text-xs text-foreground">{t("settings.videoLoop")}</Text>
        </Switch>
        <Switch isSelected={!isMuted} onSelectedChange={handleToggleMute}>
          <Switch.Thumb />
          <Text className="text-xs text-foreground">{t("settings.videoAudio")}</Text>
        </Switch>
      </View>

      {(availableAudioTracks.length > 0 || (isVideo && availableSubtitleTracks.length > 0)) && (
        <View className="mt-3 flex-row items-center gap-2">
          {availableAudioTracks.length > 0 && (
            <Select
              className="flex-1"
              value={
                activeAudioTrackId
                  ? { value: activeAudioTrackId, label: activeAudioTrackId }
                  : undefined
              }
              onValueChange={(option) => handleSelectAudioTrack(option?.value ?? null)}
            >
              <Select.Trigger>
                <Select.Value placeholder={t("settings.videoAudioTrackPlaceholder")} />
                <Select.TriggerIndicator />
              </Select.Trigger>
              <Select.Portal>
                <Select.Overlay />
                <Select.Content presentation="popover">
                  {availableAudioTracks.map((track) => (
                    <Select.Item
                      key={track.id}
                      value={track.id}
                      label={track.label || track.language || track.id}
                    >
                      <Select.ItemLabel />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>
          )}
          {isVideo && availableSubtitleTracks.length > 0 && (
            <Select
              className="flex-1"
              value={
                activeSubtitleTrackId
                  ? { value: activeSubtitleTrackId, label: activeSubtitleTrackId }
                  : undefined
              }
              onValueChange={(option) => handleSelectSubtitleTrack(option?.value ?? null)}
            >
              <Select.Trigger>
                <Select.Value placeholder={t("settings.videoSubtitleTrackPlaceholder")} />
                <Select.TriggerIndicator />
              </Select.Trigger>
              <Select.Portal>
                <Select.Overlay />
                <Select.Content presentation="popover">
                  {availableSubtitleTracks.map((track) => (
                    <Select.Item
                      key={track.id}
                      value={track.id}
                      label={track.label || track.language || track.id}
                    >
                      <Select.ItemLabel />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>
          )}
        </View>
      )}

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        <Button variant="outline" onPress={handleSaveToLibrary} isDisabled={isSaving}>
          <Ionicons name="download-outline" size={14} color={mutedColor} />
          <Button.Label>{t("settings.videoSave")}</Button.Label>
        </Button>
        <Button variant="outline" onPress={handleShare}>
          <Ionicons name="share-social-outline" size={14} color={mutedColor} />
          <Button.Label>{t("settings.videoShare")}</Button.Label>
        </Button>
        <Button
          variant="primary"
          onPress={() => setShowProcessingSheet(true)}
          isDisabled={!videoProcessingEnabled || !isEngineAvailable || !isVideo}
        >
          <Ionicons name="build-outline" size={14} color="#fff" />
          <Button.Label>{t("settings.videoProcess")}</Button.Label>
        </Button>
        <Button
          testID="e2e-action-video__param_id-open-queue"
          variant="outline"
          onPress={() => setShowQueueSheet(true)}
        >
          <Ionicons name="list-outline" size={14} color={mutedColor} />
          <Button.Label>{t("settings.videoQueue")}</Button.Label>
        </Button>
      </View>
    </>
  );

  const tabsContent = (
    <Tabs value={activeTab} onValueChange={setActiveTab} variant="primary" className="mt-4">
      <Tabs.List>
        <Tabs.Indicator />
        <Tabs.Trigger value="info">
          <Tabs.Label>{t("settings.videoInfoTab")}</Tabs.Label>
        </Tabs.Trigger>
        <Tabs.Trigger value="tasks">
          <Tabs.Label>{t("settings.videoTasksTab")}</Tabs.Label>
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="info">
        <View className="mt-3 gap-2">
          <Card variant="secondary">
            <Card.Body className="gap-2 p-3">
              <View className="flex-row flex-wrap gap-2">
                <Chip size="sm" variant="secondary">
                  <Chip.Label>
                    {(file.sourceFormat ?? (isAudio ? "audio" : "video")).toUpperCase()}
                  </Chip.Label>
                </Chip>
                <Chip size="sm" variant="secondary">
                  <Chip.Label>{formatVideoDuration(file.durationMs)}</Chip.Label>
                </Chip>
                {isVideo && (
                  <Chip size="sm" variant="secondary">
                    <Chip.Label>
                      {formatVideoResolution(file.videoWidth, file.videoHeight) || "--"}
                    </Chip.Label>
                  </Chip>
                )}
                {!!file.frameRate && (
                  <Chip size="sm" variant="secondary">
                    <Chip.Label>{file.frameRate.toFixed(2)} fps</Chip.Label>
                  </Chip>
                )}
              </View>
              <Text className="text-xs text-muted">
                {t("settings.videoSizeLabel", { size: formatFileSize(file.fileSize) })}
              </Text>
              {!!file.videoCodec && (
                <Text className="text-xs text-muted">
                  {t("settings.videoCodecLabel", { codec: file.videoCodec })}
                </Text>
              )}
              {!!file.audioCodec && (
                <Text className="text-xs text-muted">
                  {t("settings.audioCodecLabel", { codec: file.audioCodec })}
                </Text>
              )}
              {!!file.bitrateKbps && (
                <Text className="text-xs text-muted">
                  {t("settings.videoBitrateLabel", { bitrate: file.bitrateKbps })}
                </Text>
              )}
            </Card.Body>
          </Card>

          {isVideo && (
            <Accordion selectionMode="multiple" variant="surface" defaultValue={["compatibility"]}>
              <Accordion.Item value="compatibility">
                <Accordion.Trigger>
                  <Text className="flex-1 text-sm font-semibold text-foreground">
                    {t("settings.videoCompatibilityProfileTitle")}
                  </Text>
                  <Accordion.Indicator />
                </Accordion.Trigger>
                <Accordion.Content>
                  <Text className="text-xs text-muted">
                    {t("settings.videoCompatibilityProfileDesc")}
                  </Text>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          )}
        </View>
      </Tabs.Content>

      <Tabs.Content value="tasks">
        <View className="mt-3 gap-2">
          {!isEngineAvailable && (
            <Card variant="secondary">
              <Card.Body className="p-3">
                <Text className="text-xs text-muted">
                  {t("settings.videoEngineUnavailable")}:{" "}
                  {engineCapabilities?.unavailableReason ?? "ffmpeg_executor_unavailable"}.
                </Text>
              </Card.Body>
            </Card>
          )}
          {fileTasks.length === 0 && (
            <Card variant="secondary">
              <Card.Body className="p-3">
                <Text className="text-xs text-muted">{t("settings.videoNoTasks")}</Text>
              </Card.Body>
            </Card>
          )}
          {fileTasks.map((task) => (
            <Card key={task.id} variant="secondary">
              <Card.Body className="gap-2 p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-foreground">
                    {task.request.operation.toUpperCase()}
                  </Text>
                  <Chip size="sm" variant="soft" color={taskStatusColor(task.status)}>
                    <Chip.Label>{translateTaskStatus(task.status, t)}</Chip.Label>
                  </Chip>
                </View>
                <Text className="text-xs text-muted">{Math.round(task.progress * 100)}%</Text>
                {(task.status === "running" || task.status === "completed") && (
                  <AnimatedProgressBar
                    progress={task.progress * 100}
                    color={task.status === "completed" ? "#22c55e" : undefined}
                  />
                )}
                {!!task.error && (
                  <Text className="text-xs text-danger">{translateEngineError(task.error, t)}</Text>
                )}
                {!!task.engineErrorCode && (
                  <Text className="text-[10px] text-muted">
                    {t("settings.videoErrorCodeLabel", { code: task.engineErrorCode })}
                  </Text>
                )}
                {task.status === "completed" && (task.outputFileIds?.length ?? 0) > 0 && (
                  <View className="flex-row flex-wrap gap-2">
                    {task.outputFileIds?.map((fileId, index) => (
                      <Button
                        key={`${task.id}_${fileId}`}
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          const outputFile = useFitsStore.getState().getFileById(fileId);
                          if (!outputFile) return;
                          router.push(routeForMedia(outputFile));
                        }}
                      >
                        <Button.Label>
                          {t("settings.videoOpenOutput", { index: index + 1 })}
                        </Button.Label>
                      </Button>
                    ))}
                  </View>
                )}
              </Card.Body>
            </Card>
          ))}
        </View>
      </Tabs.Content>
    </Tabs>
  );

  const sheetsContent = (
    <>
      <VideoProcessingSheet
        visible={showProcessingSheet}
        file={file}
        defaultProfile={defaultVideoProfile}
        defaultPreset={defaultVideoTargetPreset}
        onClose={() => setShowProcessingSheet(false)}
        onSubmit={(request) => {
          const result = enqueueProcessingTask(request);
          if (!result.taskId) {
            Alert.alert(result.errorMessage ?? t("settings.videoEngineUnavailable"));
            return;
          }
          setShowQueueSheet(true);
        }}
      />
      <TaskQueueSheet
        visible={showQueueSheet}
        tasks={tasks}
        onClose={() => setShowQueueSheet(false)}
        onCancelTask={cancelTask}
        onRetryTask={retryTask}
        onRemoveTask={removeTask}
        onClearFinished={clearFinished}
        onOpenOutputFile={(fileId) => {
          const outputFile = useFitsStore.getState().getFileById(fileId);
          if (!outputFile) return;
          router.push(routeForMedia(outputFile));
        }}
      />
    </>
  );

  return (
    <View
      testID="e2e-screen-video__param_id"
      className="flex-1 bg-background"
      style={isLandscape ? { paddingLeft: insets.left, paddingRight: insets.right } : undefined}
    >
      {toolbarContent}

      {isLandscape ? (
        <View className="flex-1 flex-row">
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          >
            {playerCardContent}
          </ScrollView>
          <ScrollView
            style={{
              width: sidePanelWidth,
              borderLeftWidth: 1,
              borderLeftColor: "rgba(128,128,128,0.2)",
            }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
          >
            {controlsContent}
            {tabsContent}
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        >
          {playerCardContent}
          {controlsContent}
          {tabsContent}
        </ScrollView>
      )}

      {sheetsContent}
    </View>
  );
}
