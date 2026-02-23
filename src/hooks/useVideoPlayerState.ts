import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoPlayer, AudioTrack, SubtitleTrack } from "expo-video";

const RATE_OPTIONS = [0.5, 1, 1.5, 2] as const;

interface UseVideoPlayerStateOptions {
  abLoopA: number | null;
  abLoopB: number | null;
  errorFallbackMessage: string;
}

export interface VideoPlayerState {
  isPlayerReady: boolean;
  playerStatus: string;
  playerError: string | null;
  durationSec: number;
  currentTimeSec: number;
  isPlaying: boolean;
  playbackRate: number;
  isMuted: boolean;
  volume: number;
  availableAudioTracks: AudioTrack[];
  availableSubtitleTracks: SubtitleTrack[];
  activeAudioTrackId: string | null;
  activeSubtitleTrackId: string | null;
}

export interface VideoPlayerHandlers {
  handlePlayPause: () => void;
  handleSeekBy: (deltaSeconds: number) => void;
  handleSeekTo: (nextSeconds: number) => void;
  handleCycleRate: () => void;
  handleToggleMute: () => void;
  handleToggleLoop: () => void;
  handleVolumeChange: (next: number) => void;
  handleSelectAudioTrack: (trackId: string | null) => void;
  handleSelectSubtitleTrack: (trackId: string | null) => void;
  handleRetryPlayback: () => void;
}

export function useVideoPlayerState(
  player: VideoPlayer,
  haptics: { selection: () => void },
  options: UseVideoPlayerStateOptions,
): VideoPlayerState & VideoPlayerHandlers {
  const { abLoopA, abLoopB, errorFallbackMessage } = options;

  const abLoopARef = useRef(abLoopA);
  const abLoopBRef = useRef(abLoopB);
  const errorFallbackRef = useRef(errorFallbackMessage);
  useEffect(() => {
    abLoopARef.current = abLoopA;
  }, [abLoopA]);
  useEffect(() => {
    abLoopBRef.current = abLoopB;
  }, [abLoopB]);
  useEffect(() => {
    errorFallbackRef.current = errorFallbackMessage;
  }, [errorFallbackMessage]);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerStatus, setPlayerStatus] = useState("loading");
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
      const a = abLoopARef.current;
      const b = abLoopBRef.current;
      if (a !== null && b !== null && currentTime >= b) {
        player.currentTime = a;
      }
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
        setPlayerError(error?.message ?? errorFallbackRef.current);
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

  const handlePlayPause = useCallback(() => {
    haptics.selection();
    if (player.playing) {
      player.pause();
      return;
    }
    player.play();
  }, [player, haptics]);

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
    haptics.selection();
    const current = RATE_OPTIONS.findIndex((value) => value === playbackRate);
    const next = RATE_OPTIONS[(current + 1) % RATE_OPTIONS.length];
    player.playbackRate = next;
  }, [playbackRate, player, haptics]);

  const handleToggleMute = useCallback(() => {
    haptics.selection();
    player.muted = !player.muted;
  }, [player, haptics]);

  const handleToggleLoop = useCallback(() => {
    haptics.selection();
    player.loop = !player.loop;
  }, [player, haptics]);

  const handleVolumeChange = useCallback(
    (next: number) => {
      player.volume = Math.max(0, Math.min(1, next));
    },
    [player],
  );

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

  return {
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
  };
}
