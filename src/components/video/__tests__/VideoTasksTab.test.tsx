import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { VideoTasksTab } from "../VideoTasksTab";
import type { VideoTaskRecord } from "../../../stores/useVideoTaskStore";
jest.mock("../../common/AnimatedProgressBar", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AnimatedProgressBar: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: "progress-bar", ...props }),
  };
});

const baseRequest = {
  sourceId: "video-1",
  sourceFilename: "capture.mp4",
  inputUri: "file:///capture.mp4",
  operation: "trim" as const,
  profile: "compatibility" as const,
  trim: { startMs: 0, endMs: 5000, reencode: true },
};

function makeTask(overrides: Partial<VideoTaskRecord>): VideoTaskRecord {
  return {
    id: "task-1",
    request: baseRequest,
    status: "pending",
    progress: 0,
    processedMs: 0,
    durationMs: 5000,
    createdAt: Date.now(),
    outputUris: [],
    retries: 0,
    logLines: [],
    ...overrides,
  };
}

describe("VideoTasksTab", () => {
  const defaultProps = {
    fileTasks: [] as VideoTaskRecord[],
    isEngineAvailable: true,
    engineCapabilities: null as never,
    onOpenOutput: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows empty state when no tasks", () => {
    render(<VideoTasksTab {...defaultProps} />);
    expect(screen.getByText("No tasks for this media.")).toBeTruthy();
  });

  it("shows engine unavailable message", () => {
    render(
      <VideoTasksTab
        {...defaultProps}
        isEngineAvailable={false}
        engineCapabilities={{ unavailableReason: "ffmpeg_missing" } as never}
      />,
    );
    expect(screen.getByText(/ffmpeg_missing/)).toBeTruthy();
  });

  it("shows default unavailable reason when capabilities is null", () => {
    render(<VideoTasksTab {...defaultProps} isEngineAvailable={false} />);
    expect(screen.getByText(/ffmpeg_executor_unavailable/)).toBeTruthy();
  });

  it("renders task with operation name and status", () => {
    const tasks = [makeTask({ id: "t1", status: "running", progress: 0.5 })];
    render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    expect(screen.getByText("TRIM")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("renders progress bar for running tasks", () => {
    const tasks = [makeTask({ id: "t1", status: "running", progress: 0.3 })];
    render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    expect(screen.getByTestId("progress-bar")).toBeTruthy();
  });

  it("renders progress bar for completed tasks", () => {
    const tasks = [makeTask({ id: "t1", status: "completed", progress: 1 })];
    render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    expect(screen.getByTestId("progress-bar")).toBeTruthy();
  });

  it("does not render progress bar for pending tasks", () => {
    const tasks = [makeTask({ id: "t1", status: "pending", progress: 0 })];
    render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    expect(screen.queryByTestId("progress-bar")).toBeNull();
  });

  it("renders error message for failed tasks", () => {
    const tasks = [makeTask({ id: "t1", status: "failed", error: "ffmpeg_failed_trim" })];
    render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    expect(screen.getByText("Video processing failed. Check logs for details.")).toBeTruthy();
  });

  it("renders engine error code for failed tasks", () => {
    const tasks = [
      makeTask({
        id: "t1",
        status: "failed",
        error: "ffmpeg_failed",
        engineErrorCode: "ERR_CODEC",
      }),
    ];
    render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    expect(screen.getByText(/Code: ERR_CODEC/)).toBeTruthy();
  });

  it("renders output file buttons for completed tasks and calls onOpenOutput", () => {
    const onOpenOutput = jest.fn();
    const tasks = [
      makeTask({
        id: "t1",
        status: "completed",
        progress: 1,
        outputFileIds: ["out-1", "out-2"],
      }),
    ];
    render(<VideoTasksTab {...defaultProps} fileTasks={tasks} onOpenOutput={onOpenOutput} />);

    expect(screen.getByText("Open #1")).toBeTruthy();
    expect(screen.getByText("Open #2")).toBeTruthy();

    fireEvent.press(screen.getByText("Open #1"));
    expect(onOpenOutput).toHaveBeenCalledWith("out-1");

    fireEvent.press(screen.getByText("Open #2"));
    expect(onOpenOutput).toHaveBeenCalledWith("out-2");
  });

  it("does not show output buttons for tasks without outputFileIds", () => {
    const tasks = [makeTask({ id: "t1", status: "completed", progress: 1 })];
    render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    expect(screen.queryByText("Open #1")).toBeNull();
  });

  it("renders multiple tasks", () => {
    const tasks = [
      makeTask({ id: "t1", status: "pending", progress: 0 }),
      makeTask({
        id: "t2",
        status: "running",
        progress: 0.7,
        request: { ...baseRequest, operation: "compress" as const },
      }),
    ];
    render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    expect(screen.getByText("TRIM")).toBeTruthy();
    expect(screen.getByText("COMPRESS")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("passes theme success color to completed task progress bar", () => {
    const tasks = [makeTask({ id: "t1", status: "completed", progress: 1 })];
    const { getByTestId } = render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    const progressBar = getByTestId("progress-bar");
    // useThemeColor mock returns "#000000" for all tokens
    expect(progressBar.props.color).toBe("#000000");
  });

  it("passes undefined color for running task progress bar", () => {
    const tasks = [makeTask({ id: "t1", status: "running", progress: 0.5 })];
    const { getByTestId } = render(<VideoTasksTab {...defaultProps} fileTasks={tasks} />);
    const progressBar = getByTestId("progress-bar");
    expect(progressBar.props.color).toBeUndefined();
  });
});
