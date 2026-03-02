import { useState, useRef, useCallback } from "react";
import { View, Text, PanResponder } from "react-native";
import { useThemeColor } from "heroui-native";
import { formatVideoDurationWithMs } from "../../lib/video/format";

interface VideoSeekBarProps {
  currentTimeSec: number;
  durationSec: number;
  abLoopA: number | null;
  abLoopB: number | null;
  onSeekTo: (seconds: number) => void;
}

const THUMB_SIZE = 16;
const THUMB_HALF = THUMB_SIZE / 2;
const TRACK_HEIGHT = 3;
const HIT_HEIGHT = 32;

export function VideoSeekBar({
  currentTimeSec,
  durationSec,
  abLoopA,
  abLoopB,
  onSeekTo,
}: VideoSeekBarProps) {
  const [accentColor, surfaceColor, successColor] = useThemeColor([
    "accent",
    "surface-secondary",
    "success",
  ]);
  const [trackWidth, setTrackWidth] = useState(200);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreviewSec, setSeekPreviewSec] = useState(0);

  const safeDuration = Math.max(0.1, durationSec || 0);
  const displayTime = isSeeking ? seekPreviewSec : currentTimeSec;
  const fraction = Math.max(0, Math.min(1, displayTime / safeDuration));

  const computeSeconds = useCallback(
    (locationX: number) => {
      const f = Math.max(0, Math.min(1, locationX / trackWidth));
      return Math.max(0, Math.min(safeDuration, f * safeDuration));
    },
    [trackWidth, safeDuration],
  );

  const computeSecondsRef = useRef(computeSeconds);
  computeSecondsRef.current = computeSeconds;
  const onSeekToRef = useRef(onSeekTo);
  onSeekToRef.current = onSeekTo;

  const panResponderRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!panResponderRef.current) {
    panResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const sec = computeSecondsRef.current(evt.nativeEvent.locationX);
        setIsSeeking(true);
        setSeekPreviewSec(sec);
      },
      onPanResponderMove: (evt) => {
        const sec = computeSecondsRef.current(evt.nativeEvent.locationX);
        setSeekPreviewSec(sec);
      },
      onPanResponderRelease: (evt) => {
        const sec = computeSecondsRef.current(evt.nativeEvent.locationX);
        onSeekToRef.current(sec);
        setIsSeeking(false);
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false);
      },
    });
  }

  const abLoopStart = abLoopA !== null ? Math.max(0, Math.min(1, abLoopA / safeDuration)) : null;
  const abLoopEnd = abLoopB !== null ? Math.max(0, Math.min(1, abLoopB / safeDuration)) : null;

  return (
    <View className="mt-2">
      <View
        className="justify-center"
        style={{ height: HIT_HEIGHT }}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponderRef.current.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
        accessibilityValue={{
          min: 0,
          max: Math.round(safeDuration),
          now: Math.round(displayTime),
        }}
      >
        <View
          className="rounded-full overflow-hidden"
          style={{ height: TRACK_HEIGHT, backgroundColor: surfaceColor }}
        >
          {abLoopStart !== null && abLoopEnd !== null && (
            <View
              className="absolute"
              style={{
                height: TRACK_HEIGHT,
                left: `${abLoopStart * 100}%`,
                width: `${(abLoopEnd - abLoopStart) * 100}%`,
                backgroundColor: successColor,
                opacity: 0.3,
              }}
            />
          )}
          <View
            className="rounded-full"
            style={{
              height: TRACK_HEIGHT,
              width: `${fraction * 100}%`,
              backgroundColor: accentColor,
            }}
          />
        </View>
        <View
          className="absolute rounded-full"
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            left: Math.max(0, fraction * trackWidth - THUMB_HALF),
            backgroundColor: accentColor,
            transform: isSeeking ? [{ scale: 1.3 }] : [{ scale: 1 }],
          }}
        />
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted">
          {formatVideoDurationWithMs(Math.round(displayTime * 1000))}
        </Text>
        {isSeeking && (
          <View className="rounded bg-black/60 px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-white">
              {formatVideoDurationWithMs(Math.round(seekPreviewSec * 1000))}
            </Text>
          </View>
        )}
        <Text className="text-xs text-muted">
          {formatVideoDurationWithMs(Math.round(safeDuration * 1000))}
        </Text>
      </View>
    </View>
  );
}
