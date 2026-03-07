import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut, runOnJS } from "react-native-reanimated";
import { Button, Card, Popover, Skeleton, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, type VideoPlayer } from "expo-video";
import { formatVideoDuration } from "../../lib/video/format";
import { SimpleSlider } from "../common/SimpleSlider";
import { VideoSeekBar } from "./VideoSeekBar";
import { useI18n } from "../../i18n/useI18n";
import { RATE_OPTIONS } from "../../hooks/video/useVideoPlayerState";

const AUTO_HIDE_MS = 3000;

interface VideoPlayerCardProps {
  player: VideoPlayer;
  isPlayerReady: boolean;
  isBuffering: boolean;
  playerStatus: string;
  playerError: string | null;
  durationSec: number;
  currentTimeSec: number;
  isPlaying: boolean;
  playbackRate: number;
  isMuted: boolean;
  volume: number;
  isVideo: boolean;
  isAudio: boolean;
  isLandscape: boolean;
  videoWidth?: number;
  videoHeight?: number;
  fileDurationMs?: number;
  pipSupported: boolean;
  abLoopA: number | null;
  abLoopB: number | null;
  onPlayPause: () => void;
  onSeekBy: (seconds: number) => void;
  onSeekTo: (seconds: number) => void;
  onCycleRate: () => void;
  onToggleMute: () => void;
  onVolumeChange: (value: number) => void;
  onFullscreen: () => void;
  onPip: () => void;
  onRetryPlayback: () => void;
  onSetAbLoopA: () => void;
  onSetAbLoopB: () => void;
  onClearAbLoop: () => void;
  onSetRate?: (rate: number) => void;
  onEnterFullscreen?: () => void;
  onExitFullscreen?: () => void;
}

export function VideoPlayerCard({
  player,
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
  isVideo,
  isAudio,
  isLandscape,
  videoWidth,
  videoHeight,
  fileDurationMs,
  pipSupported,
  abLoopA,
  abLoopB,
  onPlayPause,
  onSeekBy,
  onSeekTo,
  onCycleRate,
  onToggleMute,
  onVolumeChange,
  onFullscreen,
  onPip,
  onRetryPlayback,
  onSetAbLoopA,
  onSetAbLoopB,
  onClearAbLoop,
  onSetRate,
  onEnterFullscreen,
  onExitFullscreen,
}: VideoPlayerCardProps) {
  const { t } = useI18n();
  const [mutedColor, warningColor] = useThemeColor(["muted", "warning"]);
  const videoViewRef = useRef<VideoView | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const [showOverlayControls, setShowOverlayControls] = useState(true);
  const [seekFeedback, setSeekFeedback] = useState<string | null>(null);
  const [volumeOverlay, setVolumeOverlay] = useState<number | null>(null);
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRateRef = useRef(playbackRate);
  const videoAreaWidthRef = useRef(0);
  const startVolumeRef = useRef(volume);

  const resetAutoHide = useCallback(() => {
    if (autoHideRef.current) clearTimeout(autoHideRef.current);
    if (isPlaying) {
      autoHideRef.current = setTimeout(() => setShowOverlayControls(false), AUTO_HIDE_MS);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      if (autoHideRef.current) clearTimeout(autoHideRef.current);
      setShowOverlayControls(true);
    } else {
      resetAutoHide();
    }
    return () => {
      if (autoHideRef.current) clearTimeout(autoHideRef.current);
    };
  }, [isPlaying, resetAutoHide]);

  const handleSingleTap = useCallback(() => {
    setShowOverlayControls((prev) => !prev);
    resetAutoHide();
  }, [resetAutoHide]);

  const handleDoubleTapLeft = useCallback(() => {
    onSeekBy(-10);
    setSeekFeedback("-10s");
    setTimeout(() => setSeekFeedback(null), 600);
    resetAutoHide();
  }, [onSeekBy, resetAutoHide]);

  const handleDoubleTapRight = useCallback(() => {
    onSeekBy(10);
    setSeekFeedback("+10s");
    setTimeout(() => setSeekFeedback(null), 600);
    resetAutoHide();
  }, [onSeekBy, resetAutoHide]);

  const handleLongPressStart = useCallback(() => {
    prevRateRef.current = playbackRate;
    onSetRate?.(2);
  }, [playbackRate, onSetRate]);

  const handleLongPressEnd = useCallback(() => {
    onSetRate?.(prevRateRef.current);
  }, [onSetRate]);

  const handleVolumePan = useCallback(
    (deltaY: number) => {
      const delta = -deltaY / 300;
      const next = Math.max(0, Math.min(1, startVolumeRef.current + delta));
      onVolumeChange(next);
      setVolumeOverlay(Math.round(next * 100));
    },
    [onVolumeChange],
  );

  const handleVolumePanEnd = useCallback(() => {
    setVolumeOverlay(null);
  }, []);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .maxDistance(40)
    .onStart((e) => {
      const mid = videoAreaWidthRef.current / 2;
      if (e.x < mid) {
        runOnJS(handleDoubleTapLeft)();
      } else {
        runOnJS(handleDoubleTapRight)();
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .maxDistance(20)
    .onEnd(() => {
      runOnJS(handleSingleTap)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .maxDistance(30)
    .onStart(() => {
      runOnJS(handleLongPressStart)();
    })
    .onEnd(() => {
      runOnJS(handleLongPressEnd)();
    });

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onStart(() => {
      startVolumeRef.current = volume;
    })
    .onUpdate((e) => {
      if (Math.abs(e.translationY) > Math.abs(e.translationX) * 2) {
        runOnJS(handleVolumePan)(e.translationY);
      }
    })
    .onEnd(() => {
      runOnJS(handleVolumePanEnd)();
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture, longPressGesture),
  );

  const playerHeight = useMemo(() => {
    const fallback = isLandscape ? 180 : 220;
    if (!videoWidth || !videoHeight || containerWidth <= 0) return fallback;
    const aspectRatio = videoWidth / videoHeight;
    const computed = Math.round(containerWidth / aspectRatio);
    const maxH = isLandscape ? 300 : Math.round(screenHeight * 0.45);
    return Math.max(120, Math.min(maxH, computed));
  }, [videoWidth, videoHeight, containerWidth, isLandscape, screenHeight]);

  return (
    <Card variant="secondary">
      <Card.Body
        className="p-2"
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width - 16)}
      >
        <GestureDetector gesture={composedGesture}>
          <View
            className="overflow-hidden rounded-lg bg-black"
            style={{ height: playerHeight }}
            onLayout={(e) => {
              videoAreaWidthRef.current = e.nativeEvent.layout.width;
            }}
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
              nativeControls={false}
              contentFit="contain"
              allowsPictureInPicture={isVideo}
              onFullscreenEnter={onEnterFullscreen}
              onFullscreenExit={onExitFullscreen}
            />
            {isBuffering && !playerError && (
              <View className="absolute inset-0 items-center justify-center bg-black/40">
                <Spinner />
              </View>
            )}
            {isAudio && (
              <View className="absolute inset-0 items-center justify-center bg-black/35">
                <Ionicons name="musical-notes-outline" size={48} color={mutedColor} />
                <Text className="mt-2 text-xs text-white">
                  {formatVideoDuration(fileDurationMs)}
                </Text>
              </View>
            )}
            {playerStatus === "error" && (
              <View className="absolute inset-0 items-center justify-center bg-black/70 px-4">
                <Ionicons name="alert-circle-outline" size={28} color={warningColor} />
                <Text className="mt-2 text-center text-xs text-white">
                  {playerError ?? t("settings.videoPlaybackError")}
                </Text>
                <Button size="sm" variant="outline" className="mt-3" onPress={onRetryPlayback}>
                  <Button.Label>{t("settings.videoRetry")}</Button.Label>
                </Button>
              </View>
            )}
            {seekFeedback && (
              <Animated.View
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(300)}
                className="absolute inset-0 items-center justify-center"
                pointerEvents="none"
              >
                <View className="rounded-full bg-black/60 px-4 py-2">
                  <Text className="text-lg font-bold text-white">{seekFeedback}</Text>
                </View>
              </Animated.View>
            )}
            {volumeOverlay !== null && (
              <Animated.View
                entering={FadeIn.duration(100)}
                exiting={FadeOut.duration(200)}
                className="absolute inset-0 items-center justify-center"
                pointerEvents="none"
              >
                <View className="flex-row items-center gap-2 rounded-full bg-black/60 px-4 py-2">
                  <Ionicons name="volume-high" size={16} color="#fff" />
                  <Text className="text-sm font-semibold text-white">{volumeOverlay}%</Text>
                </View>
              </Animated.View>
            )}
          </View>
        </GestureDetector>
        {showOverlayControls && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
            <View className="mt-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  isIconOnly
                  onPress={() => onSeekBy(-10)}
                  accessibilityLabel={t("settings.videoRewind")}
                >
                  <Ionicons name="play-back" size={14} color={mutedColor} />
                </Button>
                <Button
                  testID="e2e-action-video__param_id-play-pause"
                  size="sm"
                  variant="primary"
                  isIconOnly
                  onPress={onPlayPause}
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
                  onPress={() => onSeekBy(10)}
                  accessibilityLabel={t("settings.videoForward")}
                >
                  <Ionicons name="play-forward" size={14} color={mutedColor} />
                </Button>
              </View>
              <View className="flex-row items-center gap-1">
                <Popover>
                  <Popover.Trigger>
                    <Button
                      testID="e2e-action-video__param_id-cycle-rate"
                      size="sm"
                      variant="outline"
                      onPress={onCycleRate}
                    >
                      <Button.Label>{playbackRate.toFixed(playbackRate % 1 ? 2 : 0)}x</Button.Label>
                    </Button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Overlay />
                    <Popover.Content presentation="popover" width={120} className="p-1">
                      {RATE_OPTIONS.map((rate) => (
                        <Button
                          key={rate}
                          size="sm"
                          variant={rate === playbackRate ? "primary" : "ghost"}
                          className="justify-start"
                          onPress={() => onSetRate?.(rate)}
                        >
                          <Button.Label>{rate}x</Button.Label>
                        </Button>
                      ))}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover>
                <Button
                  size="sm"
                  variant="outline"
                  isIconOnly
                  onPress={onToggleMute}
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
                    onPress={async () => {
                      try {
                        await videoViewRef.current?.enterFullscreen();
                      } catch {
                        onFullscreen();
                      }
                    }}
                    accessibilityLabel={t("settings.videoFullscreenLabel")}
                  >
                    <Ionicons name="expand-outline" size={14} color={mutedColor} />
                  </Button>
                )}
                {isVideo && pipSupported && (
                  <Button
                    size="sm"
                    variant="outline"
                    isIconOnly
                    onPress={async () => {
                      try {
                        await videoViewRef.current?.startPictureInPicture();
                      } catch {
                        onPip();
                      }
                    }}
                    accessibilityLabel={t("settings.videoPipLabel")}
                  >
                    <Ionicons name="albums-outline" size={14} color={mutedColor} />
                  </Button>
                )}
              </View>
            </View>

            <VideoSeekBar
              currentTimeSec={currentTimeSec}
              durationSec={durationSec}
              abLoopA={abLoopA}
              abLoopB={abLoopB}
              onSeekTo={onSeekTo}
            />
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
                onValueChange={onVolumeChange}
              />
            </View>
            <View className="mt-2 flex-row items-center gap-1">
              <Button
                size="sm"
                variant={abLoopA !== null ? "primary" : "outline"}
                onPress={onSetAbLoopA}
              >
                <Button.Label>A{abLoopA !== null ? ` ${abLoopA.toFixed(1)}s` : ""}</Button.Label>
              </Button>
              <Button
                size="sm"
                variant={abLoopB !== null ? "primary" : "outline"}
                onPress={onSetAbLoopB}
                isDisabled={abLoopA === null}
              >
                <Button.Label>B{abLoopB !== null ? ` ${abLoopB.toFixed(1)}s` : ""}</Button.Label>
              </Button>
              {(abLoopA !== null || abLoopB !== null) && (
                <Button size="sm" variant="outline" onPress={onClearAbLoop}>
                  <Button.Label>{t("settings.videoAbLoopClear")}</Button.Label>
                </Button>
              )}
            </View>
          </Animated.View>
        )}
      </Card.Body>
    </Card>
  );
}
