import { useRef } from "react";
import { Text, View } from "react-native";
import { Button, Card, Skeleton, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, type VideoPlayer } from "expo-video";
import { formatVideoDuration, formatVideoDurationWithMs } from "../../lib/video/format";
import { SimpleSlider } from "../common/SimpleSlider";
import { useI18n } from "../../i18n/useI18n";

interface VideoPlayerCardProps {
  player: VideoPlayer;
  isPlayerReady: boolean;
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
}

export function VideoPlayerCard({
  player,
  isPlayerReady,
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
}: VideoPlayerCardProps) {
  const { t } = useI18n();
  const [mutedColor, warningColor] = useThemeColor(["muted", "warning"]);
  const videoViewRef = useRef<VideoView | null>(null);

  return (
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
              <Ionicons name="musical-notes-outline" size={48} color={mutedColor} />
              <Text className="mt-2 text-xs text-white">{formatVideoDuration(fileDurationMs)}</Text>
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
        </View>
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
            <Button
              testID="e2e-action-video__param_id-cycle-rate"
              size="sm"
              variant="outline"
              onPress={onCycleRate}
            >
              <Button.Label>{playbackRate.toFixed(1)}x</Button.Label>
            </Button>
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

        <View className="mt-2 px-1">
          <SimpleSlider
            label={t("settings.videoSeek")}
            value={Math.max(0, Math.min(durationSec || 0, currentTimeSec))}
            min={0}
            max={Math.max(0.1, durationSec || 0)}
            step={0.1}
            onValueChange={onSeekTo}
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
      </Card.Body>
    </Card>
  );
}
