import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Accordion,
  Button,
  Card,
  Chip,
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
import { formatVideoDuration, formatVideoResolution } from "../../lib/video/format";
import { shareFile, type MediaExportFormat } from "../../lib/utils/imageExport";
import { useMediaLibrary } from "../../hooks/useMediaLibrary";
import { useVideoProcessing } from "../../hooks/useVideoProcessing";
import { VideoProcessingSheet } from "../../components/video/VideoProcessingSheet";
import { TaskQueueSheet } from "../../components/video/TaskQueueSheet";

const RATE_OPTIONS = [0.5, 1, 1.5, 2];

function toMediaExportFormat(format?: string): MediaExportFormat {
  if (!format) return "mp4";
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
  return "mp4";
}

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

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
    enqueueProcessingTask,
    retryTask,
    removeTask,
    clearFinished,
    cancelTask,
  } = useVideoProcessing();

  const [activeTab, setActiveTab] = useState("info");
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showProcessingSheet, setShowProcessingSheet] = useState(false);
  const [showQueueSheet, setShowQueueSheet] = useState(false);

  const videoViewRef = useRef<VideoView | null>(null);
  const isVideo = file?.mediaKind === "video" || file?.sourceType === "video";
  const pipSupported = isPictureInPictureSupported();

  const currentFileIndex = useMemo(
    () => allFiles.findIndex((entry) => entry.id === file?.id),
    [allFiles, file?.id],
  );
  const prevVideoId = useMemo(() => {
    if (currentFileIndex <= 0) return null;
    for (let i = currentFileIndex - 1; i >= 0; i--) {
      const entry = allFiles[i];
      if (entry.mediaKind === "video" || entry.sourceType === "video") return entry.id;
    }
    return null;
  }, [allFiles, currentFileIndex]);
  const nextVideoId = useMemo(() => {
    if (currentFileIndex < 0) return null;
    for (let i = currentFileIndex + 1; i < allFiles.length; i++) {
      const entry = allFiles[i];
      if (entry.mediaKind === "video" || entry.sourceType === "video") return entry.id;
    }
    return null;
  }, [allFiles, currentFileIndex]);

  useEffect(() => {
    if (!id || !file) return;
    if (!isVideo) {
      router.replace(`/viewer/${id}`);
    }
  }, [file, id, isVideo, router]);

  const player = useVideoPlayer(isVideo && file ? { uri: file.filepath } : null, (instance) => {
    instance.loop = videoLoopByDefault;
    instance.muted = videoMutedByDefault;
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

  useEffect(() => {
    const subPlaying = player.addListener("playingChange", ({ isPlaying: next }) => {
      setIsPlaying(next);
    });
    const subRate = player.addListener("playbackRateChange", ({ playbackRate: nextRate }) => {
      setPlaybackRate(nextRate);
    });
    const subTime = player.addListener("timeUpdate", ({ currentTime }) => {
      setCurrentTimeSec(currentTime);
    });
    const subLoad = player.addListener("sourceLoad", ({ duration }) => {
      setDurationSec(duration);
      setIsPlayerReady(true);
    });
    const subStatus = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") {
        setIsPlayerReady(true);
      }
    });

    return () => {
      subPlaying.remove();
      subRate.remove();
      subTime.remove();
      subLoad.remove();
      subStatus.remove();
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
    const uri = await saveToDevice(file.filepath, "video");
    if (uri) {
      Alert.alert("Saved to media library.");
      return;
    }
    Alert.alert("Unable to save to media library.");
  }, [file, saveToDevice]);

  const handleShare = useCallback(async () => {
    if (!file) return;
    try {
      await shareFile(file.filepath, {
        format: toMediaExportFormat(file.sourceFormat),
        filename: file.filename,
      });
    } catch {
      Alert.alert("Unable to share this file.");
    }
  }, [file]);

  if (!file) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Ionicons name="alert-circle-outline" size={52} color={mutedColor} />
        <Text className="mt-4 text-center text-sm text-muted">Video file not found.</Text>
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
    <View className="flex-1 bg-background px-4 pt-4">
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
            {isPlayerReady ? null : (
              <Skeleton className="absolute inset-0">
                <View className="h-full w-full items-center justify-center">
                  <Spinner />
                </View>
              </Skeleton>
            )}
            <VideoView
              ref={videoViewRef}
              player={player}
              className="h-full w-full"
              nativeControls
              contentFit="contain"
              allowsPictureInPicture
            />
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <Button size="sm" variant="outline" isIconOnly onPress={() => handleSeekBy(-10)}>
                <Ionicons name="play-back" size={14} color={mutedColor} />
              </Button>
              <Button size="sm" variant="primary" isIconOnly onPress={handlePlayPause}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={14} color="#fff" />
              </Button>
              <Button size="sm" variant="outline" isIconOnly onPress={() => handleSeekBy(10)}>
                <Ionicons name="play-forward" size={14} color={mutedColor} />
              </Button>
            </View>
            <View className="flex-row items-center gap-1">
              <Button size="sm" variant="outline" onPress={handleCycleRate}>
                <Button.Label>{playbackRate.toFixed(1)}x</Button.Label>
              </Button>
              <Button size="sm" variant="outline" isIconOnly onPress={handleToggleMute}>
                <Ionicons
                  name={player.muted ? "volume-mute" : "volume-high"}
                  size={14}
                  color={mutedColor}
                />
              </Button>
              <Button size="sm" variant="outline" isIconOnly onPress={handleFullscreen}>
                <Ionicons name="expand-outline" size={14} color={mutedColor} />
              </Button>
              <Button size="sm" variant="outline" isIconOnly onPress={handlePip}>
                <Ionicons name="albums-outline" size={14} color={mutedColor} />
              </Button>
            </View>
          </View>

          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xs text-muted">
              {formatVideoDuration(Math.round(currentTimeSec * 1000))}
            </Text>
            <Text className="text-xs text-muted">
              {formatVideoDuration(Math.round(durationSec * 1000))}
            </Text>
          </View>
        </Card.Body>
      </Card>

      <View className="mt-3 flex-row items-center gap-2">
        <Switch isSelected={player.loop} onSelectedChange={handleToggleLoop}>
          <Switch.Thumb />
          <Text className="text-xs text-foreground">Loop</Text>
        </Switch>
        <Switch isSelected={!player.muted} onSelectedChange={handleToggleMute}>
          <Switch.Thumb />
          <Text className="text-xs text-foreground">Audio</Text>
        </Switch>
      </View>

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
          isDisabled={!videoProcessingEnabled}
        >
          <Ionicons name="build-outline" size={14} color="#fff" />
          <Button.Label>Process</Button.Label>
        </Button>
        <Button variant="outline" onPress={() => setShowQueueSheet(true)}>
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
                      <Chip.Label>{(file.sourceFormat ?? "video").toUpperCase()}</Chip.Label>
                    </Chip>
                    <Chip size="sm" variant="secondary">
                      <Chip.Label>{formatVideoDuration(file.durationMs)}</Chip.Label>
                    </Chip>
                    <Chip size="sm" variant="secondary">
                      <Chip.Label>
                        {formatVideoResolution(file.videoWidth, file.videoHeight) || "--"}
                      </Chip.Label>
                    </Chip>
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
                      MP4 + H.264 + AAC + yuv420p + faststart. This preset maximizes playback
                      compatibility.
                    </Text>
                  </Accordion.Content>
                </Accordion.Item>
              </Accordion>
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
                      Local FFmpeg adapter is not currently available in this build.
                    </Text>
                  </Card.Body>
                </Card>
              )}
              {fileTasks.length === 0 && (
                <Card variant="secondary">
                  <Card.Body className="p-3">
                    <Text className="text-xs text-muted">No tasks for this video.</Text>
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
          const taskId = enqueueProcessingTask(request);
          if (!taskId) {
            Alert.alert("Video processing is disabled.");
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
      />
    </View>
  );
}
