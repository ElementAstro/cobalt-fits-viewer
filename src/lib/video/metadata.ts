import { createVideoPlayer, type VideoPlayer, type SourceLoadEventPayload } from "expo-video";

export interface VideoMetadataSnapshot {
  durationMs?: number;
  frameRate?: number;
  videoWidth?: number;
  videoHeight?: number;
  videoCodec?: string;
  audioCodec?: string;
  bitrateKbps?: number;
  rotationDeg?: number;
  hasAudioTrack?: boolean;
}

function cleanupPlayer(player: VideoPlayer) {
  try {
    player.pause();
  } catch {
    // noop
  }
  try {
    player.release();
  } catch {
    // noop
  }
}

function waitForSourceLoad(
  player: VideoPlayer,
  timeoutMs: number,
): Promise<SourceLoadEventPayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      subLoad.remove();
      subStatus.remove();
      reject(new Error("video_metadata_timeout"));
    }, timeoutMs);

    const done = (payload: SourceLoadEventPayload) => {
      clearTimeout(timer);
      subLoad.remove();
      subStatus.remove();
      resolve(payload);
    };

    const subLoad = player.addListener("sourceLoad", (payload) => {
      done(payload);
    });
    const subStatus = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error") {
        clearTimeout(timer);
        subLoad.remove();
        subStatus.remove();
        reject(new Error(error?.message || "video_metadata_error"));
      }
    });
  });
}

export async function extractVideoMetadata(
  uri: string,
  timeoutMs: number = 6000,
): Promise<VideoMetadataSnapshot> {
  const player = createVideoPlayer({ uri });
  try {
    let payload: SourceLoadEventPayload | null = null;

    if (
      player.status === "readyToPlay" &&
      Number.isFinite(player.duration) &&
      player.duration > 0
    ) {
      payload = {
        videoSource: { uri },
        duration: player.duration,
        availableVideoTracks: player.availableVideoTracks ?? [],
        availableSubtitleTracks: player.availableSubtitleTracks ?? [],
        availableAudioTracks: player.availableAudioTracks ?? [],
      };
    } else {
      payload = await waitForSourceLoad(player, timeoutMs);
    }

    const tracks = payload.availableVideoTracks ?? [];
    const primaryTrack = tracks.find((track) => track.isSupported) ?? tracks[0];
    const duration = Number.isFinite(payload.duration) ? payload.duration : player.duration;
    const hasAudioTrack = (payload.availableAudioTracks?.length ?? 0) > 0;

    return {
      durationMs: Number.isFinite(duration) ? Math.max(0, Math.round(duration * 1000)) : undefined,
      frameRate: primaryTrack?.frameRate ?? undefined,
      videoWidth: primaryTrack?.size?.width ?? undefined,
      videoHeight: primaryTrack?.size?.height ?? undefined,
      videoCodec: primaryTrack?.mimeType ?? undefined,
      bitrateKbps:
        typeof primaryTrack?.bitrate === "number" && Number.isFinite(primaryTrack.bitrate)
          ? Math.max(1, Math.round(primaryTrack.bitrate / 1000))
          : undefined,
      hasAudioTrack,
    };
  } finally {
    cleanupPlayer(player);
  }
}
