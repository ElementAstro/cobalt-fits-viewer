import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
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
import {
  VideoView,
  isPictureInPictureSupported,
  useVideoPlayer,
  type AudioTrack,
  type SubtitleTrack,
} from "expo-video";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { formatFileSize } from "../../lib/utils/fileManager";
import { formatVideoDuration, formatVideoResolution } from "../../lib/video/format";
import { shareFile, type MediaExportFormat } from "../../lib/utils/imageExport";
import { useMediaLibrary } from "../../hooks/useMediaLibrary";
import { useVideoProcessing } from "../../hooks/useVideoProcessing";
import { VideoProcessingSheet } from "../../components/video/VideoProcessingSheet";
import { TaskQueueSheet } from "../../components/video/TaskQueueSheet";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import { isMediaWorkspaceFile, routeForMedia } from "../../lib/media/routing";

const RATE_OPTIONS = [0.5, 1, 1.5, 2];

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [, mutedColor] = useThemeColor(["success", "muted"]);

  const file = useFitsStore((s) => s.getFileById(id ?? ""));
  const allFiles = useFitsStore((s) => s.files);
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
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<"idle" | "loading" | "readyToPlay" | "error">(
    "idle",
  );
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<AudioTrack[]>([]);
  const [availableSubtitleTracks, setAvailableSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [activeAudioTrackId, setActiveAudioTrackId] = useState<string | null>(null);
  const [activeSubtitleTrackId, setActiveSubtitleTrackId] = useState<string | null>(null);
  const [showProcessingSheet, setShowProcessingSheet] = useState(false);
  const [showQueueSheet, setShowQueueSheet] = useState(false);

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
    }
  }, [file, id, isMedia, router]);

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
    setIsMuted(videoMutedByDefault);
  }, [player, videoMutedByDefault]);

  useEffect(() => {
    setIsMuted(player.muted);
    setVolume(player.volume ?? 1);
    setAvailableAudioTracks(player.availableAudioTracks ?? []);
    setAvailableSubtitleTracks(player.availableSubtitleTracks ?? []);
    setActiveAudioTrackId(player.audioTrack?.id ?? null);
    setActiveSubtitleTrackId(player.subtitleTrack?.id ?? null);

    const subPlaying = player.addListener("playingChange", ({ isPlaying: next }) => {
      setIsPlaying(next);
    });
    const subRate = player.addListener("playbackRateChange", ({ playbackRate: nextRate }) => {
      setPlaybackRate(nextRate);
    });
    const subTime = player.addListener("timeUpdate", ({ currentTime }) => {
      setCurrentTimeSec(currentTime);
    });
    const subLoad = player.addListener(
      "sourceLoad",
      ({ duration, availableAudioTracks, availableSubtitleTracks }) => {
        setDurationSec(duration);
        setAvailableAudioTracks(availableAudioTracks);
        setAvailableSubtitleTracks(availableSubtitleTracks);
        setIsPlayerReady(true);
        setPlayerStatus("readyToPlay");
        setPlayerError(null);
      },
    );
    const subStatus = player.addListener("statusChange", ({ status, error }) => {
      setPlayerStatus(status);
      if (status === "readyToPlay") {
        setIsPlayerReady(true);
      }
      if (status === "loading") {
        setIsPlayerReady(false);
      }
      if (status === "error") {
        setPlayerError(error?.message ?? "Unable to play this media.");
      }
    });
    const subMuted = player.addListener("mutedChange", ({ muted }) => {
      setIsMuted(muted);
    });
    const subVolume = player.addListener("volumeChange", ({ volume }) => {
      setVolume(volume);
    });
    const subSource = player.addListener("sourceChange", () => {
      setIsPlayerReady(false);
      setPlayerStatus("loading");
      setPlayerError(null);
      setCurrentTimeSec(0);
      setDurationSec(0);
      setAvailableAudioTracks([]);
      setAvailableSubtitleTracks([]);
      setActiveAudioTrackId(null);
      setActiveSubtitleTrackId(null);
    });
    const subAudioTracks = player.addListener(
      "availableAudioTracksChange",
      ({ availableAudioTracks }) => {
        setAvailableAudioTracks(availableAudioTracks);
      },
    );
    const subSubtitleTracks = player.addListener(
      "availableSubtitleTracksChange",
      ({ availableSubtitleTracks }) => {
        setAvailableSubtitleTracks(availableSubtitleTracks);
      },
    );
    const subAudioTrack = player.addListener("audioTrackChange", ({ audioTrack }) => {
      setActiveAudioTrackId(audioTrack?.id ?? null);
    });
    const subSubtitleTrack = player.addListener("subtitleTrackChange", ({ subtitleTrack }) => {
      setActiveSubtitleTrackId(subtitleTrack?.id ?? null);
    });

    return () => {
      subPlaying.remove();
      subRate.remove();
      subTime.remove();
      subLoad.remove();
      subStatus.remove();
      subMuted.remove();
      subVolume.remove();
      subSource.remove();
      subAudioTracks.remove();
      subSubtitleTracks.remove();
      subAudioTrack.remove();
      subSubtitleTrack.remove();
    };
  }, [player]);

  const fileTasks = useMemo(
    () => tasks.filter((task) => task.request.sourceId === file?.id),
    [file?.id, tasks],
  );

  const handlePlayPause = useCallback(() => {
    if (player.playing) {
      player.pause();
      return;
    }
    player.play();
  }, [player]);

  const handleSeekBy = useCallback(
    (deltaSeconds: number) => {
      player.seekBy(deltaSeconds);
    },
    [player],
  );

  const handleSeekTo = useCallback(
    (nextSeconds: number) => {
      const safeDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
      const clamped = Math.max(0, Math.min(safeDuration, nextSeconds));
      player.currentTime = clamped;
      setCurrentTimeSec(clamped);
    },
    [durationSec, player],
  );

  const handleCycleRate = useCallback(() => {
    const current = RATE_OPTIONS.findIndex((value) => value === playbackRate);
    const next = RATE_OPTIONS[(current + 1) % RATE_OPTIONS.length];
    player.playbackRate = next;
  }, [playbackRate, player]);

  const handleToggleMute = useCallback(() => {
    player.muted = !player.muted;
  }, [player]);

  const handleToggleLoop = useCallback(() => {
    player.loop = !player.loop;
  }, [player]);

  const handleSelectAudioTrack = useCallback(
    (trackId: string | null) => {
      if (!trackId) {
        player.audioTrack = null;
        return;
      }
      const selected = availableAudioTracks.find((track) => track.id === trackId) ?? null;
      player.audioTrack = selected;
    },
    [availableAudioTracks, player],
  );

  const handleSelectSubtitleTrack = useCallback(
    (trackId: string | null) => {
      if (!trackId) {
        player.subtitleTrack = null;
        return;
      }
      const selected = availableSubtitleTracks.find((track) => track.id === trackId) ?? null;
      player.subtitleTrack = selected;
    },
    [availableSubtitleTracks, player],
  );

  const handleRetryPlayback = useCallback(() => {
    setPlayerError(null);
    setPlayerStatus("loading");
    setIsPlayerReady(false);
    player.replay();
  }, [player]);

  const handleFullscreen = useCallback(async () => {
    try {
      await videoViewRef.current?.enterFullscreen();
    } catch {
      Alert.alert("Fullscreen is unavailable on this device.");
    }
  }, []);

  const handlePip = useCallback(async () => {
    if (!pipSupported) {
      Alert.alert("Picture in Picture is not supported.");
      return;
    }
    try {
      await videoViewRef.current?.startPictureInPicture();
    } catch {
      Alert.alert("Unable to start Picture in Picture.");
    }
  }, [pipSupported]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!file) return;
    const intent = isVideo ? "video" : "unknown";
    const uri = await saveToDevice(file.filepath, intent);
    if (uri) {
      Alert.alert("Saved to media library.");
      return;
    }
    Alert.alert("Unable to save to media library.");
  }, [file, isVideo, saveToDevice]);

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
      Alert.alert("Unable to share this file.");
    }
  }, [file, isAudio, isVideo]);

  if (!file) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Ionicons name="alert-circle-outline" size={52} color={mutedColor} />
        <Text className="mt-4 text-center text-sm text-muted">Media file not found.</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>Back</Button.Label>
        </Button>
      </View>
    );
  }

  if (!videoCoreEnabled) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Ionicons name="videocam-off-outline" size={52} color={mutedColor} />
        <Text className="mt-4 text-center text-sm text-muted">
          Video features are disabled by current settings.
        </Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>Back</Button.Label>
        </Button>
      </View>
    );
  }

  return (
    <View testID="e2e-screen-video__param_id" className="flex-1 bg-background px-4 pt-4">
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <Button size="sm" variant="outline" isIconOnly onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <Text
          className="flex-1 text-center text-sm font-semibold text-foreground"
          numberOfLines={1}
        >
          {file.filename}
        </Text>
        <View className="flex-row items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            onPress={() => prevVideoId && router.replace(`/video/${prevVideoId}`)}
            isDisabled={!prevVideoId}
          >
            <Ionicons name="chevron-back" size={16} color={mutedColor} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            onPress={() => nextVideoId && router.replace(`/video/${nextVideoId}`)}
            isDisabled={!nextVideoId}
          >
            <Ionicons name="chevron-forward" size={16} color={mutedColor} />
          </Button>
        </View>
      </View>

      <Card variant="secondary">
        <Card.Body className="p-2">
          <View className="h-[220px] overflow-hidden rounded-lg bg-black">
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
                  {playerError ?? "Unable to play this media."}
                </Text>
                <Button size="sm" variant="outline" className="mt-3" onPress={handleRetryPlayback}>
                  <Button.Label>Retry</Button.Label>
                </Button>
              </View>
            )}
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <Button size="sm" variant="outline" isIconOnly onPress={() => handleSeekBy(-10)}>
                <Ionicons name="play-back" size={14} color={mutedColor} />
              </Button>
              <Button
                testID="e2e-action-video__param_id-play-pause"
                size="sm"
                variant="primary"
                isIconOnly
                onPress={handlePlayPause}
              >
                <Ionicons name={isPlaying ? "pause" : "play"} size={14} color="#fff" />
              </Button>
              <Button size="sm" variant="outline" isIconOnly onPress={() => handleSeekBy(10)}>
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
              <Button size="sm" variant="outline" isIconOnly onPress={handleToggleMute}>
                <Ionicons
                  name={isMuted ? "volume-mute" : "volume-high"}
                  size={14}
                  color={mutedColor}
                />
              </Button>
              {isVideo && (
                <Button size="sm" variant="outline" isIconOnly onPress={handleFullscreen}>
                  <Ionicons name="expand-outline" size={14} color={mutedColor} />
                </Button>
              )}
              {isVideo && (
                <Button size="sm" variant="outline" isIconOnly onPress={handlePip}>
                  <Ionicons name="albums-outline" size={14} color={mutedColor} />
                </Button>
              )}
            </View>
          </View>

          <View className="mt-2 px-1">
            <SimpleSlider
              label="Seek"
              value={Math.max(0, Math.min(durationSec || 0, currentTimeSec))}
              min={0}
              max={Math.max(0.1, durationSec || 0)}
              step={0.1}
              onValueChange={handleSeekTo}
            />
          </View>

          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs text-muted">
              {formatVideoDuration(Math.round(currentTimeSec * 1000))}
            </Text>
            <Text className="text-xs text-muted">
              {formatVideoDuration(Math.round(durationSec * 1000))}
            </Text>
          </View>
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-[10px] text-muted">Status: {playerStatus}</Text>
            <Text className="text-[10px] text-muted">Volume: {Math.round(volume * 100)}%</Text>
          </View>
        </Card.Body>
      </Card>

      <View className="mt-3 flex-row items-center gap-2">
        <Switch isSelected={player.loop} onSelectedChange={handleToggleLoop}>
          <Switch.Thumb />
          <Text className="text-xs text-foreground">Loop</Text>
        </Switch>
        <Switch isSelected={!isMuted} onSelectedChange={handleToggleMute}>
          <Switch.Thumb />
          <Text className="text-xs text-foreground">Audio</Text>
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
                <Select.Value placeholder="Audio track" />
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
                <Select.Value placeholder="Subtitle track" />
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

      <View className="mt-3 flex-row items-center gap-2">
        <Button variant="outline" onPress={handleSaveToLibrary} isDisabled={isSaving}>
          <Ionicons name="download-outline" size={14} color={mutedColor} />
          <Button.Label>Save</Button.Label>
        </Button>
        <Button variant="outline" onPress={handleShare}>
          <Ionicons name="share-social-outline" size={14} color={mutedColor} />
          <Button.Label>Share</Button.Label>
        </Button>
        <Button
          variant="primary"
          onPress={() => setShowProcessingSheet(true)}
          isDisabled={!videoProcessingEnabled || !isEngineAvailable || !isVideo}
        >
          <Ionicons name="build-outline" size={14} color="#fff" />
          <Button.Label>Process</Button.Label>
        </Button>
        <Button
          testID="e2e-action-video__param_id-open-queue"
          variant="outline"
          onPress={() => setShowQueueSheet(true)}
        >
          <Ionicons name="list-outline" size={14} color={mutedColor} />
          <Button.Label>Queue</Button.Label>
        </Button>
      </View>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        variant="primary"
        className="mt-4 flex-1"
      >
        <Tabs.List>
          <Tabs.Indicator />
          <Tabs.Trigger value="info">
            <Tabs.Label>Info</Tabs.Label>
          </Tabs.Trigger>
          <Tabs.Trigger value="tasks">
            <Tabs.Label>Tasks</Tabs.Label>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="info" className="flex-1">
          <ScrollView className="mt-3">
            <View className="gap-2">
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
                  <Text className="text-xs text-muted">Size: {formatFileSize(file.fileSize)}</Text>
                  {!!file.videoCodec && (
                    <Text className="text-xs text-muted">Video codec: {file.videoCodec}</Text>
                  )}
                  {!!file.audioCodec && (
                    <Text className="text-xs text-muted">Audio codec: {file.audioCodec}</Text>
                  )}
                  {!!file.bitrateKbps && (
                    <Text className="text-xs text-muted">Bitrate: {file.bitrateKbps} kbps</Text>
                  )}
                </Card.Body>
              </Card>

              {isVideo && (
                <Accordion
                  selectionMode="multiple"
                  variant="surface"
                  defaultValue={["compatibility"]}
                >
                  <Accordion.Item value="compatibility">
                    <Accordion.Trigger>
                      <Text className="flex-1 text-sm font-semibold text-foreground">
                        Default Compatibility Profile
                      </Text>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                    <Accordion.Content>
                      <Text className="text-xs text-muted">
                        MP4 + H.264/AAC + yuv420p + faststart with hardware codec fallbacks.
                      </Text>
                    </Accordion.Content>
                  </Accordion.Item>
                </Accordion>
              )}
            </View>
          </ScrollView>
        </Tabs.Content>

        <Tabs.Content value="tasks" className="flex-1">
          <ScrollView className="mt-3">
            <View className="gap-2">
              {!isEngineAvailable && (
                <Card variant="secondary">
                  <Card.Body className="p-3">
                    <Text className="text-xs text-muted">
                      Local FFmpeg adapter is unavailable:{" "}
                      {engineCapabilities?.unavailableReason ?? "ffmpeg_executor_unavailable"}.
                    </Text>
                  </Card.Body>
                </Card>
              )}
              {fileTasks.length === 0 && (
                <Card variant="secondary">
                  <Card.Body className="p-3">
                    <Text className="text-xs text-muted">No tasks for this media.</Text>
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
                      <Chip
                        size="sm"
                        variant="soft"
                        color={
                          task.status === "completed"
                            ? "success"
                            : task.status === "failed"
                              ? "danger"
                              : task.status === "running"
                                ? "warning"
                                : "default"
                        }
                      >
                        <Chip.Label>{task.status}</Chip.Label>
                      </Chip>
                    </View>
                    <Text className="text-xs text-muted">{Math.round(task.progress * 100)}%</Text>
                    {!!task.error && <Text className="text-xs text-danger">{task.error}</Text>}
                    {!!task.engineErrorCode && (
                      <Text className="text-[10px] text-muted">Code: {task.engineErrorCode}</Text>
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
                            <Button.Label>{`Open #${index + 1}`}</Button.Label>
                          </Button>
                        ))}
                      </View>
                    )}
                  </Card.Body>
                </Card>
              ))}
            </View>
          </ScrollView>
        </Tabs.Content>
      </Tabs>

      <VideoProcessingSheet
        visible={showProcessingSheet}
        file={file}
        defaultProfile={defaultVideoProfile}
        defaultPreset={defaultVideoTargetPreset}
        onClose={() => setShowProcessingSheet(false)}
        onSubmit={(request) => {
          const result = enqueueProcessingTask(request);
          if (!result.taskId) {
            Alert.alert(result.errorMessage ?? "Unable to enqueue processing task.");
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
    </View>
  );
}
