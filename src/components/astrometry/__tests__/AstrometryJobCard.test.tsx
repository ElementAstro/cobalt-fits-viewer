/**
 * AstrometryJobCard 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AstrometryJobCard } from "../AstrometryJobCard";
import type { AstrometryJob } from "../../../lib/astrometry/types";

const mockT = jest.fn((key: string) => key);

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: mockT,
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

jest.mock("../../../lib/astrometry/formatUtils", () => ({
  formatDuration: (ms: number) => `${Math.floor(ms / 1000)}s`,
  formatRACompact: (deg: number) => `${(deg / 15).toFixed(2)}h`,
  formatDecCompact: (deg: number) => `${deg >= 0 ? "+" : ""}${deg.toFixed(2)}°`,
  formatFieldSize: (deg: number) => `${deg.toFixed(1)}°`,
}));

jest.mock("../../common/AnimatedProgressBar", () => {
  const ReactLocal = require("react");
  const { View: RNView } = require("react-native");
  return {
    AnimatedProgressBar: (props: { progress: number }) =>
      ReactLocal.createElement(RNView, { testID: "progress-bar", ...props }),
  };
});

jest.mock("expo-image", () => {
  const { createExpoImageMock } = require("./helpers/mockExpoImage");
  return createExpoImageMock();
});

jest.mock("../../../hooks/useElapsedTime", () => ({
  useElapsedTime: (_startTime: number, isActive: boolean) => (isActive ? "30s" : ""),
}));

const now = Date.now();

const pendingJob: AstrometryJob = {
  id: "job-1",
  fileName: "test_image.fits",
  status: "pending",
  progress: 0,
  createdAt: now,
  updatedAt: now,
};

const solvingJob: AstrometryJob = {
  id: "job-2",
  fileName: "solving_image.fits",
  status: "solving",
  progress: 45,
  createdAt: now - 30000,
  updatedAt: now,
  thumbnailUri: "file:///thumb.jpg",
};

const successJob: AstrometryJob = {
  id: "job-3",
  fileName: "success_image.fits",
  status: "success",
  progress: 100,
  createdAt: now - 60000,
  updatedAt: now,
  result: {
    calibration: {
      ra: 83.633,
      dec: -5.375,
      radius: 1.5,
      pixscale: 1.1,
      orientation: 45,
      parity: 0,
      fieldWidth: 2.0,
      fieldHeight: 1.5,
    },
    annotations: [
      { type: "messier", names: ["M42"], pixelx: 100, pixely: 200 },
      { type: "ngc", names: ["NGC 1976"], pixelx: 300, pixely: 400 },
    ],
    tags: ["Orion"],
  },
};

const failureJob: AstrometryJob = {
  id: "job-4",
  fileName: "failure_image.fits",
  status: "failure",
  progress: 0,
  error: "Solving timed out",
  createdAt: now - 120000,
  updatedAt: now,
};

const cancelledJob: AstrometryJob = {
  id: "job-5",
  fileName: "cancelled_image.fits",
  status: "cancelled",
  progress: 0,
  createdAt: now - 10000,
  updatedAt: now,
};

describe("AstrometryJobCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders file name", () => {
    render(<AstrometryJobCard job={pendingJob} />);
    expect(screen.getByText("test_image.fits")).toBeTruthy();
  });

  it("renders pending status chip", () => {
    render(<AstrometryJobCard job={pendingJob} />);
    expect(screen.getByText("astrometry.pending")).toBeTruthy();
  });

  it("renders solving status with spinner and progress bar", () => {
    render(<AstrometryJobCard job={solvingJob} />);
    expect(screen.getByText("astrometry.solving")).toBeTruthy();
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(screen.getByTestId("progress-bar")).toBeTruthy();
  });

  it("renders progress percentage for active jobs", () => {
    render(<AstrometryJobCard job={solvingJob} />);
    expect(screen.getByText("45%")).toBeTruthy();
  });

  it("renders thumbnail when thumbnailUri is provided", () => {
    render(<AstrometryJobCard job={solvingJob} />);
    expect(screen.getByTestId("expo-image")).toBeTruthy();
  });

  it("renders placeholder icon when no thumbnail", () => {
    render(<AstrometryJobCard job={pendingJob} />);
    expect(screen.getByText("image-outline")).toBeTruthy();
  });

  it("renders success result with coordinates and field size", () => {
    render(<AstrometryJobCard job={successJob} />);
    expect(screen.getByText("astrometry.success")).toBeTruthy();
    // formatCoord produces "RA 5.58h  DEC -5.38°"
    expect(screen.getByText(/RA.*DEC/)).toBeTruthy();
  });

  it("renders annotation count for success jobs with correct interpolation", () => {
    render(<AstrometryJobCard job={successJob} />);
    expect(screen.getByText(/astrometry\.objectsFound/)).toBeTruthy();
    // Verify t() was called with count param for i18n interpolation
    expect(mockT).toHaveBeenCalledWith("astrometry.objectsFound", { count: 2 });
  });

  it("renders error message for failure jobs", () => {
    render(<AstrometryJobCard job={failureJob} />);
    expect(screen.getByText("astrometry.failure")).toBeTruthy();
    expect(screen.getByText("Solving timed out")).toBeTruthy();
  });

  it("renders cancel button for active jobs", () => {
    const onCancel = jest.fn();
    render(<AstrometryJobCard job={solvingJob} onCancel={onCancel} />);
    fireEvent.press(screen.getByText(/astrometry.cancel/));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders retry button for failure jobs", () => {
    const onRetry = jest.fn();
    render(<AstrometryJobCard job={failureJob} onRetry={onRetry} />);
    fireEvent.press(screen.getByText(/astrometry.retry/));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders view result button for success jobs", () => {
    const onViewResult = jest.fn();
    render(<AstrometryJobCard job={successJob} onViewResult={onViewResult} />);
    fireEvent.press(screen.getByText(/astrometry.viewResult/));
    expect(onViewResult).toHaveBeenCalledTimes(1);
  });

  it("renders delete button for completed jobs", () => {
    const onDelete = jest.fn();
    render(<AstrometryJobCard job={successJob} onDelete={onDelete} />);
    fireEvent.press(screen.getByText("close"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renders delete button for cancelled jobs", () => {
    const onDelete = jest.fn();
    render(<AstrometryJobCard job={cancelledJob} onDelete={onDelete} />);
    fireEvent.press(screen.getByText("close"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does not render cancel button when onCancel is not provided", () => {
    render(<AstrometryJobCard job={solvingJob} />);
    expect(screen.queryByText(/astrometry.cancel/)).toBeNull();
  });

  it("does not render retry button when onRetry is not provided", () => {
    render(<AstrometryJobCard job={failureJob} />);
    expect(screen.queryByText(/astrometry.retry/)).toBeNull();
  });

  it("does not render view result button when onViewResult is not provided", () => {
    render(<AstrometryJobCard job={successJob} />);
    expect(screen.queryByText(/astrometry.viewResult/)).toBeNull();
  });

  it("shows duration for completed non-pending jobs", () => {
    render(<AstrometryJobCard job={successJob} />);
    // Duration is formatted by formatDuration mock => "60s"
    expect(screen.getByText("60s")).toBeTruthy();
  });
});
