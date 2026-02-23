jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  Directory: class {
    constructor(_path: string, _name?: string) {}
    get exists() {
      return true;
    }
    create() {}
  },
  File: class {
    uri: string;
    name: string;
    constructor(path: string, name?: string) {
      this.uri = name ? `${path}/${name}` : path;
      this.name = name ?? "output.mp4";
    }
    write() {}
  },
}));

import {
  buildFfmpegCommandForRequest,
  parseFfmpegTimestampToMs,
  parseProgressFromFfmpegLog,
} from "../engine/ffmpegAdapter";
import type { VideoProcessingRequest } from "../engine";

const baseRequest: VideoProcessingRequest = {
  sourceId: "src_1",
  sourceFilename: "m42_sequence.mp4",
  inputUri: "file:///videos/m42_sequence.mp4",
  operation: "trim",
  profile: "compatibility",
  sourceDurationMs: 10_000,
};

describe("ffmpeg command builder", () => {
  it("builds trim command with seek range", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "trim",
        trim: {
          startMs: 1200,
          endMs: 6400,
          reencode: true,
        },
      },
      "file:///out/trim.mp4",
    );

    expect(command).toContain('"file:///videos/m42_sequence.mp4"');
    expect(command).toContain('"-ss" "1.200"');
    expect(command).toContain('"-to" "6.400"');
    expect(command).toContain('"file:///out/trim.mp4"');
  });

  it("builds split/trim-like command for compression", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "compress",
        profile: "balanced",
        compress: {
          targetPreset: "1080p",
          targetBitrateKbps: 3200,
          crf: 24,
        },
      },
      "file:///out/compress.mp4",
    );

    expect(command).toContain(
      "\"scale='min(iw,1920)':'min(ih,1080)':force_original_aspect_ratio=decrease\"",
    );
    expect(command).toContain('"-c:v" "h264_videotoolbox"');
    expect(command).toContain('"-b:v" "3200k"');
    expect(command).toContain('"file:///out/compress.mp4"');
  });

  it("builds transcode command with codec selection", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "transcode",
        profile: "quality",
        transcode: {
          videoCodec: "hevc",
          targetPreset: "720p",
          targetBitrateKbps: 1800,
        },
      },
      "file:///out/transcode.mp4",
    );

    expect(command).toContain('"-c:v" "hevc_videotoolbox"');
    expect(command).toContain('"-b:v" "1800k"');
    expect(command).toContain('"file:///out/transcode.mp4"');
  });

  it("falls back from hevc to h264 encoder when requested", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "transcode",
        profile: "quality",
        transcode: {
          videoCodec: "hevc",
        },
      },
      "file:///out/transcode_fallback.mp4",
      undefined,
      {
        encoderSelection: {
          requestedCodec: "hevc",
          videoEncoder: "h264_mediacodec",
          effectiveCodec: "h264",
        },
      },
    );

    expect(command).toContain('"-c:v" "h264_mediacodec"');
    expect(command).toContain('"file:///out/transcode_fallback.mp4"');
  });

  it("supports mpeg4 fallback command in LGPL mode", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "compress",
        profile: "compatibility",
        compress: {},
      },
      "file:///out/mpeg4_fallback.mp4",
      undefined,
      {
        encoderSelection: {
          requestedCodec: "h264",
          videoEncoder: "mpeg4",
          effectiveCodec: "mpeg4",
        },
      },
    );

    expect(command).toContain('"-c:v" "mpeg4"');
    expect(command).toContain('"-q:v"');
    expect(command).toContain('"-movflags" "+faststart"');
  });

  it("builds merge command with concat list", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "merge",
        merge: {
          inputUris: ["file:///a.mp4", "file:///b.mp4"],
        },
      },
      "file:///out/merge.mp4",
      "file:///cache/concat_1.txt",
    );

    expect(command).toContain('"-f" "concat"');
    expect(command).toContain('"-safe" "0"');
    expect(command).toContain('"file:///cache/concat_1.txt"');
    expect(command).toContain('"file:///out/merge.mp4"');
  });

  it("builds extract-audio command", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "extract-audio",
        extractAudio: {
          audioCodec: "aac",
          bitrateKbps: 192,
        },
      },
      "file:///out/audio.m4a",
    );

    expect(command).toContain('"-vn"');
    expect(command).toContain('"-c:a" "aac"');
    expect(command).toContain('"-b:a" "192k"');
    expect(command).toContain('"file:///out/audio.m4a"');
  });

  it("builds mute command", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "mute",
      },
      "file:///out/mute.mp4",
    );
    expect(command).toContain('"-an"');
    expect(command).toContain('"file:///out/mute.mp4"');
  });

  it("builds cover frame command", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "cover",
        cover: { timeMs: 3450 },
      },
      "file:///out/cover.jpg",
    );
    expect(command).toContain('"-ss" "3.450"');
    expect(command).toContain('"-frames:v" "1"');
    expect(command).toContain('"file:///out/cover.jpg"');
  });

  it("builds rotate 90° command", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "rotate",
        rotateNormalize: { rotationDeg: 90 },
      },
      "file:///out/rotate.mp4",
    );
    expect(command).toContain('"transpose=1"');
    expect(command).toContain('"file:///out/rotate.mp4"');
  });

  it("builds rotate 180° command", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "rotate",
        rotateNormalize: { rotationDeg: 180 },
      },
      "file:///out/rotate180.mp4",
    );
    expect(command).toContain('"transpose=1,transpose=1"');
  });

  it("builds rotate 270° command", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "rotate",
        rotateNormalize: { rotationDeg: 270 },
      },
      "file:///out/rotate270.mp4",
    );
    expect(command).toContain('"transpose=2"');
  });

  it("builds speed 2x command with video and audio filters", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "speed",
        speed: { factor: 2 },
      },
      "file:///out/speed.mp4",
    );
    expect(command).toContain('"setpts=PTS/2"');
    expect(command).toContain('"atempo=2.0000"');
    expect(command).toContain('"file:///out/speed.mp4"');
  });

  it("builds speed 0.5x command", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "speed",
        speed: { factor: 0.5 },
      },
      "file:///out/slow.mp4",
    );
    expect(command).toContain('"setpts=PTS/0.5"');
    expect(command).toContain('"atempo=0.5000"');
  });

  it("builds speed command with removeAudio", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "speed",
        speed: { factor: 1.5 },
        removeAudio: true,
      },
      "file:///out/speed_noaudio.mp4",
    );
    expect(command).toContain('"-an"');
    expect(command).not.toContain("atempo");
  });

  it("builds watermark command with text and position", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "watermark",
        watermark: {
          text: "Cobalt",
          position: "bottom-right",
          fontSize: 32,
          fontColor: "yellow",
          opacity: 0.8,
        },
      },
      "file:///out/watermark.mp4",
    );
    expect(command).toContain("drawtext=");
    expect(command).toContain("Cobalt");
    expect(command).toContain("fontsize=32");
    expect(command).toContain("fontcolor=yellow@0.8");
    expect(command).toContain("x=w-tw-10:y=h-th-10");
    expect(command).toContain('"file:///out/watermark.mp4"');
  });

  it("throws when watermark text is missing", () => {
    expect(() =>
      buildFfmpegCommandForRequest(
        {
          ...baseRequest,
          operation: "watermark",
          watermark: { text: "", position: "center" },
        },
        "file:///out/wm.mp4",
      ),
    ).toThrow("watermark_text_required");
  });

  it("builds gif command with palette pipeline", () => {
    const command = buildFfmpegCommandForRequest(
      {
        ...baseRequest,
        operation: "gif",
        gif: {
          startMs: 2000,
          durationMs: 3000,
          width: 320,
          fps: 15,
        },
      },
      "file:///out/output.gif",
    );
    expect(command).toContain('"-ss" "2.000"');
    expect(command).toContain('"-t" "3.000"');
    expect(command).toContain('"-lavfi"');
    expect(command).toContain("palettegen");
    expect(command).toContain("paletteuse");
    expect(command).toContain("fps=15");
    expect(command).toContain("scale=320");
    expect(command).toContain('"file:///out/output.gif"');
  });

  it("throws when gif options are missing", () => {
    expect(() =>
      buildFfmpegCommandForRequest(
        {
          ...baseRequest,
          operation: "gif",
        },
        "file:///out/output.gif",
      ),
    ).toThrow("gif_options_required");
  });

  it("throws when timelapse images are missing", () => {
    expect(() =>
      buildFfmpegCommandForRequest(
        {
          ...baseRequest,
          operation: "timelapse",
        },
        "file:///out/timelapse.mp4",
      ),
    ).toThrow("timelapse_images_required");
  });

  it("throws when timelapse has empty imageUris", () => {
    expect(() =>
      buildFfmpegCommandForRequest(
        {
          ...baseRequest,
          operation: "timelapse",
          timelapse: { imageUris: [], fps: 24 },
        },
        "file:///out/timelapse.mp4",
      ),
    ).toThrow("timelapse_images_required");
  });

  it("parses ffmpeg timestamp and progress", () => {
    expect(parseFfmpegTimestampToMs("00:00:03.250")).toBe(3250);
    const progress = parseProgressFromFfmpegLog(
      "frame=120 fps=26 q=29.0 size=1200kB time=00:00:05.000 bitrate=1964.0kbits/s",
      20_000,
    );
    expect(progress).toEqual({
      processedMs: 5000,
      ratio: 0.25,
    });
  });
});
