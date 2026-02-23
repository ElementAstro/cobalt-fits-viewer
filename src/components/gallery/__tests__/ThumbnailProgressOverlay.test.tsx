import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ThumbnailProgressOverlay } from "../ThumbnailProgressOverlay";
import type { ThumbnailLoadSnapshot } from "../thumbnailLoading";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      (
        ({
          "gallery.thumbnailStageLoading": "Loading...",
          "gallery.thumbnailStageDecoding": "Decoding...",
          "gallery.thumbnailStageError": "Error",
          "gallery.thumbnailStageWaiting": "Waiting...",
          "gallery.thumbnailBytesProgress": `${opts?.loaded ?? ""}/${opts?.total ?? ""}`,
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

describe("ThumbnailProgressOverlay", () => {
  it("returns null when stage is ready", () => {
    const snapshot: ThumbnailLoadSnapshot = {
      fileId: "f1",
      stage: "ready",
      progress: 1,
      loadedBytes: 0,
      totalBytes: 0,
      hasByteProgress: false,
    };

    const { toJSON } = render(<ThumbnailProgressOverlay snapshot={snapshot} />);
    expect(toJSON()).toBeNull();
  });

  it("shows loading stage label", () => {
    const snapshot: ThumbnailLoadSnapshot = {
      fileId: "f1",
      stage: "loading",
      progress: 0.3,
      loadedBytes: 0,
      totalBytes: 0,
      hasByteProgress: false,
    };

    render(<ThumbnailProgressOverlay snapshot={snapshot} />);
    expect(screen.getByText("Loading...")).toBeTruthy();
    expect(screen.getByText("30%")).toBeTruthy();
  });

  it("shows decoding stage label", () => {
    const snapshot: ThumbnailLoadSnapshot = {
      fileId: "f1",
      stage: "decoding",
      progress: 0.8,
      loadedBytes: 0,
      totalBytes: 0,
      hasByteProgress: false,
    };

    render(<ThumbnailProgressOverlay snapshot={snapshot} />);
    expect(screen.getByText("Decoding...")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
  });

  it("shows error stage label", () => {
    const snapshot: ThumbnailLoadSnapshot = {
      fileId: "f1",
      stage: "error",
      progress: 1,
      loadedBytes: 0,
      totalBytes: 0,
      hasByteProgress: false,
    };

    render(<ThumbnailProgressOverlay snapshot={snapshot} />);
    expect(screen.getByText("Error")).toBeTruthy();
  });

  it("shows waiting stage label for idle", () => {
    const snapshot: ThumbnailLoadSnapshot = {
      fileId: "f1",
      stage: "idle",
      progress: 0,
      loadedBytes: 0,
      totalBytes: 0,
      hasByteProgress: false,
    };

    render(<ThumbnailProgressOverlay snapshot={snapshot} />);
    expect(screen.getByText("Waiting...")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("shows byte progress when hasByteProgress is true and totalBytes > 0", () => {
    const snapshot: ThumbnailLoadSnapshot = {
      fileId: "f1",
      stage: "loading",
      progress: 0.5,
      loadedBytes: 512,
      totalBytes: 1024,
      hasByteProgress: true,
    };

    render(<ThumbnailProgressOverlay snapshot={snapshot} />);
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("clamps percent to 0-100 range", () => {
    const snapshot: ThumbnailLoadSnapshot = {
      fileId: "f1",
      stage: "loading",
      progress: -0.5,
      loadedBytes: 0,
      totalBytes: 0,
      hasByteProgress: false,
    };

    render(<ThumbnailProgressOverlay snapshot={snapshot} />);
    expect(screen.getByText("0%")).toBeTruthy();
  });
});
