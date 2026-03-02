import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVideoPlayerState } from "../../hooks/useVideoPlayerState";
import { ScrollView, StatusBar, Text, View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Tabs, useThemeColor, useToast } from "heroui-native";
import { createVideoPlayer, isPictureInPictureSupported, useVideoPlayer } from "expo-video";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { shareFile, type MediaExportFormat } from "../../lib/utils/imageExport";
import { useMediaLibrary } from "../../hooks/useMediaLibrary";
import { useVideoProcessing } from "../../hooks/useVideoProcessing";
import { VideoProcessingSheet } from "../../components/video/VideoProcessingSheet";
import { TaskQueueSheet } from "../../components/video/TaskQueueSheet";
import { VideoToolbar } from "../../components/video/VideoToolbar";
import { VideoPlayerCard } from "../../components/video/VideoPlayerCard";
import { VideoControls } from "../../components/video/VideoControls";
import { VideoInfoTab } from "../../components/video/VideoInfoTab";
import { VideoTasksTab } from "../../components/video/VideoTasksTab";
import {
  isVideoFile,
  isAudioFile,
  isMediaWorkspaceFile,
  routeForMedia,
} from "../../lib/media/routing";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useVideoKeyboard } from "../../hooks/useVideoKeyboard";
import * as VideoThumbnails from "expo-video-thumbnails";
import { saveThumbnailFromExternalUri } from "../../lib/gallery/thumbnailWorkflow";

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
  const [mutedColor, separatorColor] = useThemeColor(["muted", "separator"]);
  const { isLandscape, sidePanelWidth } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const haptics = useHapticFeedback();
  const { lockOrientation, unlockOrientation } = useScreenOrientation();
  const { toast } = useToast();

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
  const videoResumePlayback = useSettingsStore((s) => s.videoResumePlayback);

  const { saveToDevice, isSaving } = useMediaLibrary();
  const {
    tasks,
    isEngineAvailable,
    engineCapabilities,
    enqueueProcessingTask,
    checkDiskSpaceForTask,
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

  const isVideo = file ? isVideoFile(file) : false;
  const isAudio = file ? isAudioFile(file) : false;
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
    const adjacentIds = [prevVideoId, nextVideoId].filter(Boolean) as string[];
    if (adjacentIds.length === 0) return;
    const preloadPlayers = adjacentIds.map((adjId) => {
      const adjFile = allFiles.find((f) => f.id === adjId);
      if (!adjFile?.filepath) return null;
      try {
        return createVideoPlayer({ uri: adjFile.filepath });
      } catch {
        return null;
      }
    });
    return () => {
      for (const p of preloadPlayers) {
        try {
          p?.release();
        } catch {
          // noop
        }
      }
    };
  }, [prevVideoId, nextVideoId, allFiles]);

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
    isBuffering,
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
    handleSetRate,
  } = useVideoPlayerState(player, haptics, {
    abLoopA,
    abLoopB,
    errorFallbackMessage: t("settings.videoPlaybackError"),
  });

  const resumeAppliedRef = useRef(false);
  useEffect(() => {
    if (
      !resumeAppliedRef.current &&
      videoResumePlayback &&
      file?.lastPlaybackPositionMs &&
      file.lastPlaybackPositionMs > 0 &&
      isPlayerReady
    ) {
      resumeAppliedRef.current = true;
      player.currentTime = file.lastPlaybackPositionMs / 1000;
    }
  }, [file?.lastPlaybackPositionMs, isPlayerReady, player, videoResumePlayback]);

  useEffect(() => {
    if (!isPlayerReady || !file) return;
    try {
      player.showNowPlayingNotification = true;
      player.staysActiveInBackground = true;
    } catch {
      // best effort — not supported on all platforms
    }
  }, [isPlayerReady, file, player]);

  const currentTimeSecRef = useRef(0);
  useEffect(() => {
    currentTimeSecRef.current = currentTimeSec;
  }, [currentTimeSec]);

  useEffect(() => {
    if (!videoResumePlayback || !file?.id) return;
    return () => {
      const posMs = Math.round(currentTimeSecRef.current * 1000);
      if (posMs > 0) {
        useFitsStore.getState().updateFile(file.id, { lastPlaybackPositionMs: posMs });
      }
    };
  }, [file?.id, videoResumePlayback]);

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

  const handleFullscreen = useCallback(() => {
    toast.show({ variant: "warning", label: t("settings.videoFullscreenError") });
  }, [t, toast]);

  const handlePip = useCallback(() => {
    toast.show({ variant: "warning", label: t("settings.videoPipError") });
  }, [t, toast]);

  const handleEnterFullscreen = useCallback(async () => {
    try {
      await lockOrientation("landscape");
    } catch {
      // best effort
    }
  }, [lockOrientation]);

  const handleExitFullscreen = useCallback(async () => {
    try {
      await unlockOrientation();
    } catch {
      // best effort
    }
  }, [unlockOrientation]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!file) return;
    const intent = isVideo ? "video" : "unknown";
    const uri = await saveToDevice(file.filepath, intent);
    if (uri) {
      toast.show({ variant: "success", label: t("settings.videoSavedToLibrary") });
      return;
    }
    toast.show({ variant: "danger", label: t("settings.videoSaveError") });
  }, [file, isVideo, saveToDevice, t, toast]);

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
      toast.show({ variant: "danger", label: t("settings.videoShareError") });
    }
  }, [file, isAudio, isVideo, t, toast]);

  const handleOpenOutput = useCallback(
    (fileId: string) => {
      const outputFile = useFitsStore.getState().getFileById(fileId);
      if (!outputFile) return;
      router.push(routeForMedia(outputFile));
    },
    [router],
  );

  const handleSetThumbnail = useCallback(async () => {
    if (!file || !isVideo) return;
    try {
      const timeMs = Math.round(currentTimeSec * 1000);
      const thumb = await VideoThumbnails.getThumbnailAsync(file.filepath, {
        time: timeMs,
        quality: 0.8,
      });
      const newUri = saveThumbnailFromExternalUri(file.id, thumb.uri);
      updateFile(file.id, {
        thumbnailAtMs: timeMs,
        ...(newUri ? { thumbnailUri: newUri } : {}),
      });
      toast.show({ variant: "success", label: t("settings.videoThumbnailUpdated") });
    } catch {
      toast.show({ variant: "danger", label: t("settings.videoThumbnailError") });
    }
  }, [file, isVideo, currentTimeSec, updateFile, t, toast]);

  useVideoKeyboard({
    onPlayPause: handlePlayPause,
    onSeekBy: handleSeekBy,
    onSeekTo: handleSeekTo,
    onToggleMute: handleToggleMute,
    onToggleLoop: handleToggleLoop,
    onCycleRate: handleCycleRate,
    onVolumeChange: handleVolumeChange,
    onFullscreen: handleFullscreen,
    volume,
    durationSec,
  });

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

  return (
    <View
      testID="e2e-screen-video__param_id"
      className="flex-1 bg-background"
      style={isLandscape ? { paddingLeft: insets.left, paddingRight: insets.right } : undefined}
    >
      <VideoToolbar
        filename={file.filename}
        isFavorite={file.isFavorite}
        isLandscape={isLandscape}
        insetTop={insets.top}
        prevVideoId={prevVideoId}
        nextVideoId={nextVideoId}
        onBack={() => router.back()}
        onNavigate={(navId) => router.replace(`/video/${navId}`)}
        onToggleFavorite={() => {
          haptics.selection();
          toggleFavorite(file.id);
        }}
      />

      {isLandscape ? (
        <View className="flex-1 flex-row">
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          >
            <VideoPlayerCard
              player={player}
              isPlayerReady={isPlayerReady}
              isBuffering={isBuffering}
              playerStatus={playerStatus}
              playerError={playerError}
              durationSec={durationSec}
              currentTimeSec={currentTimeSec}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              isMuted={isMuted}
              volume={volume}
              isVideo={!!isVideo}
              isAudio={!!isAudio}
              isLandscape={isLandscape}
              videoWidth={file.videoWidth}
              videoHeight={file.videoHeight}
              fileDurationMs={file.durationMs}
              pipSupported={pipSupported}
              abLoopA={abLoopA}
              abLoopB={abLoopB}
              onPlayPause={handlePlayPause}
              onSeekBy={handleSeekBy}
              onSeekTo={handleSeekTo}
              onCycleRate={handleCycleRate}
              onToggleMute={handleToggleMute}
              onVolumeChange={handleVolumeChange}
              onFullscreen={handleFullscreen}
              onPip={handlePip}
              onRetryPlayback={handleRetryPlayback}
              onSetAbLoopA={handleSetAbLoopA}
              onSetAbLoopB={handleSetAbLoopB}
              onClearAbLoop={handleClearAbLoop}
              onSetRate={handleSetRate}
              onEnterFullscreen={handleEnterFullscreen}
              onExitFullscreen={handleExitFullscreen}
            />
          </ScrollView>
          <ScrollView
            style={{
              width: sidePanelWidth,
              borderLeftWidth: 1,
              borderLeftColor: separatorColor,
            }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
          >
            <VideoControls
              isLoop={player.loop}
              isMuted={isMuted}
              isVideo={!!isVideo}
              isSaving={isSaving}
              videoProcessingEnabled={videoProcessingEnabled}
              isEngineAvailable={isEngineAvailable}
              availableAudioTracks={availableAudioTracks}
              availableSubtitleTracks={availableSubtitleTracks}
              activeAudioTrackId={activeAudioTrackId}
              activeSubtitleTrackId={activeSubtitleTrackId}
              onToggleLoop={handleToggleLoop}
              onToggleMute={handleToggleMute}
              onSelectAudioTrack={handleSelectAudioTrack}
              onSelectSubtitleTrack={handleSelectSubtitleTrack}
              onSaveToLibrary={handleSaveToLibrary}
              onShare={handleShare}
              onOpenProcessing={() => setShowProcessingSheet(true)}
              onOpenQueue={() => setShowQueueSheet(true)}
              onSetThumbnail={handleSetThumbnail}
            />
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
                <VideoInfoTab
                  file={file}
                  isVideo={!!isVideo}
                  isAudio={!!isAudio}
                  onNavigateToFile={handleOpenOutput}
                />
              </Tabs.Content>
              <Tabs.Content value="tasks">
                <VideoTasksTab
                  fileTasks={fileTasks}
                  isEngineAvailable={isEngineAvailable}
                  engineCapabilities={engineCapabilities}
                  onOpenOutput={handleOpenOutput}
                />
              </Tabs.Content>
            </Tabs>
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        >
          <VideoPlayerCard
            player={player}
            isPlayerReady={isPlayerReady}
            isBuffering={isBuffering}
            playerStatus={playerStatus}
            playerError={playerError}
            durationSec={durationSec}
            currentTimeSec={currentTimeSec}
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            isMuted={isMuted}
            volume={volume}
            isVideo={!!isVideo}
            isAudio={!!isAudio}
            isLandscape={isLandscape}
            videoWidth={file.videoWidth}
            videoHeight={file.videoHeight}
            fileDurationMs={file.durationMs}
            pipSupported={pipSupported}
            abLoopA={abLoopA}
            abLoopB={abLoopB}
            onPlayPause={handlePlayPause}
            onSeekBy={handleSeekBy}
            onSeekTo={handleSeekTo}
            onCycleRate={handleCycleRate}
            onToggleMute={handleToggleMute}
            onVolumeChange={handleVolumeChange}
            onFullscreen={handleFullscreen}
            onPip={handlePip}
            onRetryPlayback={handleRetryPlayback}
            onSetAbLoopA={handleSetAbLoopA}
            onSetAbLoopB={handleSetAbLoopB}
            onClearAbLoop={handleClearAbLoop}
            onSetRate={handleSetRate}
            onEnterFullscreen={handleEnterFullscreen}
            onExitFullscreen={handleExitFullscreen}
          />
          <VideoControls
            isLoop={player.loop}
            isMuted={isMuted}
            isVideo={!!isVideo}
            isSaving={isSaving}
            videoProcessingEnabled={videoProcessingEnabled}
            isEngineAvailable={isEngineAvailable}
            availableAudioTracks={availableAudioTracks}
            availableSubtitleTracks={availableSubtitleTracks}
            activeAudioTrackId={activeAudioTrackId}
            activeSubtitleTrackId={activeSubtitleTrackId}
            onToggleLoop={handleToggleLoop}
            onToggleMute={handleToggleMute}
            onSelectAudioTrack={handleSelectAudioTrack}
            onSelectSubtitleTrack={handleSelectSubtitleTrack}
            onSaveToLibrary={handleSaveToLibrary}
            onShare={handleShare}
            onOpenProcessing={() => setShowProcessingSheet(true)}
            onOpenQueue={() => setShowQueueSheet(true)}
            onSetThumbnail={handleSetThumbnail}
          />
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
              <VideoInfoTab
                file={file}
                isVideo={!!isVideo}
                isAudio={!!isAudio}
                onNavigateToFile={handleOpenOutput}
              />
            </Tabs.Content>
            <Tabs.Content value="tasks">
              <VideoTasksTab
                fileTasks={fileTasks}
                isEngineAvailable={isEngineAvailable}
                engineCapabilities={engineCapabilities}
                onOpenOutput={handleOpenOutput}
              />
            </Tabs.Content>
          </Tabs>
        </ScrollView>
      )}

      <VideoProcessingSheet
        visible={showProcessingSheet}
        file={file}
        defaultProfile={defaultVideoProfile}
        defaultPreset={defaultVideoTargetPreset}
        onClose={() => setShowProcessingSheet(false)}
        onSubmit={async (request) => {
          const spaceError = await checkDiskSpaceForTask(request);
          if (spaceError) {
            toast.show({ variant: "danger", label: t("settings.videoInsufficientDiskSpace") });
            return;
          }
          const result = enqueueProcessingTask(request);
          if (!result.taskId) {
            toast.show({
              variant: "danger",
              label: result.errorMessage ?? t("settings.videoEngineUnavailable"),
            });
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
        onOpenOutputFile={handleOpenOutput}
      />
    </View>
  );
}
