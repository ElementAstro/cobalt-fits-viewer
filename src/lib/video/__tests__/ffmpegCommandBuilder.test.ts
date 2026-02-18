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
    expect(command).toContain('"-b:v" "3200k"');
    expect(command).toContain('"-crf" "24"');
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

    expect(command).toContain('"-c:v" "libx265"');
    expect(command).toContain('"-b:v" "1800k"');
    expect(command).toContain('"file:///out/transcode.mp4"');
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
