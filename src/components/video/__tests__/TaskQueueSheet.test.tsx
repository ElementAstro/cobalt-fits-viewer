import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TaskQueueSheet } from "../TaskQueueSheet";
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
  trim: {
    startMs: 0,
    endMs: 1000,
    reencode: true,
  },
};

function makeTask(overrides: Partial<VideoTaskRecord>): VideoTaskRecord {
  return {
    id: "task-1",
    request: baseRequest,
    status: "pending",
    progress: 0,
    processedMs: 0,
    durationMs: 1000,
    createdAt: Date.now(),
    outputUris: [],
    retries: 0,
    logLines: [],
    ...overrides,
  };
}

describe("TaskQueueSheet", () => {
  it("renders tasks and dispatches task actions", () => {
    const onCancelTask = jest.fn();
    const onRetryTask = jest.fn();
    const onRemoveTask = jest.fn();
    const onClearFinished = jest.fn();
    const onClose = jest.fn();

    const tasks: VideoTaskRecord[] = [
      makeTask({ id: "task-running", status: "running", progress: 0.42 }),
      makeTask({ id: "task-failed", status: "failed", error: "ffmpeg_failed" }),
      makeTask({ id: "task-completed", status: "completed", progress: 1 }),
    ];

    render(
      <TaskQueueSheet
        visible
        tasks={tasks}
        onClose={onClose}
        onCancelTask={onCancelTask}
        onRetryTask={onRetryTask}
        onRemoveTask={onRemoveTask}
        onClearFinished={onClearFinished}
      />,
    );

    expect(screen.getByText("Video Task Queue")).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();

    fireEvent.press(screen.getByText("Cancel"));
    expect(onCancelTask).toHaveBeenCalledWith("task-running");

    fireEvent.press(screen.getByText("Retry"));
    expect(onRetryTask).toHaveBeenCalledWith("task-failed");

    const removeButtons = screen.getAllByText("Remove");
    fireEvent.press(removeButtons[0]);
    fireEvent.press(removeButtons[1]);
    expect(onRemoveTask).toHaveBeenCalledWith("task-failed");
    expect(onRemoveTask).toHaveBeenCalledWith("task-completed");

    fireEvent.press(screen.getByText("Clear Finished"));
    expect(onClearFinished).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows empty-state copy when queue is empty", () => {
    render(
      <TaskQueueSheet
        visible
        tasks={[]}
        onClose={jest.fn()}
        onCancelTask={jest.fn()}
        onRetryTask={jest.fn()}
        onRemoveTask={jest.fn()}
        onClearFinished={jest.fn()}
      />,
    );

    expect(screen.getByText("No queued tasks.")).toBeTruthy();
  });

  it("shows translated engine error for failed tasks", () => {
    const tasks: VideoTaskRecord[] = [
      makeTask({
        id: "task-err",
        status: "failed",
        error: "ffmpeg_failed_trim",
      }),
    ];

    render(
      <TaskQueueSheet
        visible
        tasks={tasks}
        onClose={jest.fn()}
        onCancelTask={jest.fn()}
        onRetryTask={jest.fn()}
        onRemoveTask={jest.fn()}
        onClearFinished={jest.fn()}
      />,
    );

    expect(screen.getByText("Video processing failed. Check logs for details.")).toBeTruthy();
  });

  it("renders retry button for failed task with retries < MAX_VIDEO_RETRIES", () => {
    const onRetryTask = jest.fn();
    const tasks: VideoTaskRecord[] = [
      makeTask({
        id: "task-retriable",
        status: "failed",
        error: "err",
        retries: 0,
      }),
    ];

    render(
      <TaskQueueSheet
        visible
        tasks={tasks}
        onClose={jest.fn()}
        onCancelTask={jest.fn()}
        onRetryTask={onRetryTask}
        onRemoveTask={jest.fn()}
        onClearFinished={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText("Retry"));
    expect(onRetryTask).toHaveBeenCalledWith("task-retriable");
  });

  it("passes theme success color to completed task progress bar", () => {
    const tasks: VideoTaskRecord[] = [
      makeTask({ id: "task-done", status: "completed", progress: 1 }),
    ];

    render(
      <TaskQueueSheet
        visible
        tasks={tasks}
        onClose={jest.fn()}
        onCancelTask={jest.fn()}
        onRetryTask={jest.fn()}
        onRemoveTask={jest.fn()}
        onClearFinished={jest.fn()}
      />,
    );

    const progressBar = screen.getByTestId("progress-bar");
    // useThemeColor mock returns "#000000" for all tokens
    expect(progressBar.props.color).toBe("#000000");
  });

  it("passes undefined color for running task progress bar", () => {
    const tasks: VideoTaskRecord[] = [
      makeTask({ id: "task-run", status: "running", progress: 0.5 }),
    ];

    render(
      <TaskQueueSheet
        visible
        tasks={tasks}
        onClose={jest.fn()}
        onCancelTask={jest.fn()}
        onRetryTask={jest.fn()}
        onRemoveTask={jest.fn()}
        onClearFinished={jest.fn()}
      />,
    );

    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar.props.color).toBeUndefined();
  });
});
