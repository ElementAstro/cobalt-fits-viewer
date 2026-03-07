import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { VideoInfoTab } from "../VideoInfoTab";
import { useFitsStore } from "../../../stores/files/useFitsStore";
import type { FitsMetadata } from "../../../lib/fits/types";

const baseFile: FitsMetadata = {
  id: "video-1",
  filename: "capture.mp4",
  filepath: "file:///capture.mp4",
  fileSize: 2048000,
  importDate: Date.now(),
  frameType: "unknown",
  isFavorite: false,
  tags: [],
  albumIds: [],
  mediaKind: "video",
  sourceType: "video",
  sourceFormat: "mp4",
  durationMs: 12000,
  videoWidth: 1920,
  videoHeight: 1080,
  frameRate: 29.97,
  videoCodec: "h264",
  audioCodec: "aac",
  bitrateKbps: 4000,
};

describe("VideoInfoTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFitsStore.setState({ files: [baseFile] });
  });

  it("renders format chip as uppercase", () => {
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText("MP4")).toBeTruthy();
  });

  it("renders duration chip", () => {
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText("00:12")).toBeTruthy();
  });

  it("renders resolution chip for video", () => {
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText("1920×1080")).toBeTruthy();
  });

  it("does not render resolution chip for audio", () => {
    render(<VideoInfoTab file={baseFile} isVideo={false} isAudio={true} />);
    expect(screen.queryByText("1920×1080")).toBeNull();
  });

  it("renders frame rate chip", () => {
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText("29.97 fps")).toBeTruthy();
  });

  it("renders file size label", () => {
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText(/Size:/)).toBeTruthy();
  });

  it("renders video codec label", () => {
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText(/Video codec: h264/)).toBeTruthy();
  });

  it("renders audio codec label", () => {
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText(/Audio codec: aac/)).toBeTruthy();
  });

  it("renders bitrate label", () => {
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText(/Bitrate: 4000 kbps/)).toBeTruthy();
  });

  it("renders compatibility profile accordion for video", () => {
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText("Default Compatibility Profile")).toBeTruthy();
  });

  it("does not render compatibility accordion for audio", () => {
    render(<VideoInfoTab file={baseFile} isVideo={false} isAudio={true} />);
    expect(screen.queryByText("Default Compatibility Profile")).toBeNull();
  });

  it("shows AUDIO format chip for audio files without sourceFormat", () => {
    const audioFile: FitsMetadata = {
      ...baseFile,
      id: "audio-1",
      sourceFormat: undefined,
      mediaKind: "audio",
    };
    render(<VideoInfoTab file={audioFile} isVideo={false} isAudio={true} />);
    expect(screen.getByText("AUDIO")).toBeTruthy();
  });

  it("renders processing tag chip when present", () => {
    const processedFile: FitsMetadata = {
      ...baseFile,
      processingTag: "trim",
    };
    useFitsStore.setState({ files: [processedFile] });

    render(<VideoInfoTab file={processedFile} isVideo={true} isAudio={false} />);
    expect(screen.getByText("TRIM")).toBeTruthy();
    expect(screen.getByText("Processing")).toBeTruthy();
  });

  it("renders source file link when derivedFromId is set", () => {
    const sourceFile: FitsMetadata = {
      ...baseFile,
      id: "source-1",
      filename: "original.mp4",
    };
    const derivedFile: FitsMetadata = {
      ...baseFile,
      id: "derived-1",
      derivedFromId: "source-1",
      processingTag: "compress",
    };
    useFitsStore.setState({ files: [sourceFile, derivedFile] });

    const onNavigate = jest.fn();
    render(
      <VideoInfoTab
        file={derivedFile}
        isVideo={true}
        isAudio={false}
        onNavigateToFile={onNavigate}
      />,
    );

    expect(screen.getByText("Source")).toBeTruthy();
    expect(screen.getByText("original.mp4")).toBeTruthy();

    fireEvent.press(screen.getByText("original.mp4"));
    expect(onNavigate).toHaveBeenCalledWith("source-1");
  });

  it("renders derived files list", () => {
    const derived1: FitsMetadata = {
      ...baseFile,
      id: "d1",
      filename: "trimmed.mp4",
      derivedFromId: "video-1",
      processingTag: "trim",
    };
    const derived2: FitsMetadata = {
      ...baseFile,
      id: "d2",
      filename: "compressed.mp4",
      derivedFromId: "video-1",
      processingTag: "compress",
    };
    useFitsStore.setState({ files: [baseFile, derived1, derived2] });

    const onNavigate = jest.fn();
    render(
      <VideoInfoTab file={baseFile} isVideo={true} isAudio={false} onNavigateToFile={onNavigate} />,
    );

    expect(screen.getByText("Derived Files")).toBeTruthy();
    expect(screen.getByText("trimmed.mp4")).toBeTruthy();
    expect(screen.getByText("compressed.mp4")).toBeTruthy();

    fireEvent.press(screen.getByText("trimmed.mp4"));
    expect(onNavigate).toHaveBeenCalledWith("d1");
  });

  it("does not render derived files section when none exist", () => {
    useFitsStore.setState({ files: [baseFile] });
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.queryByText("Derived Files")).toBeNull();
  });

  it("does not render processing history card when no tag or source", () => {
    useFitsStore.setState({ files: [baseFile] });
    render(<VideoInfoTab file={baseFile} isVideo={true} isAudio={false} />);
    expect(screen.queryByText("Processing")).toBeNull();
    expect(screen.queryByText("Source")).toBeNull();
  });
});
