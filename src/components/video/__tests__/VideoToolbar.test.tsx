import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { VideoToolbar } from "../VideoToolbar";

describe("VideoToolbar", () => {
  const defaultProps = {
    filename: "capture.mp4",
    isFavorite: false,
    isLandscape: false,
    insetTop: 48,
    prevVideoId: "prev-1",
    nextVideoId: "next-1",
    onBack: jest.fn(),
    onNavigate: jest.fn(),
    onToggleFavorite: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders filename", () => {
    render(<VideoToolbar {...defaultProps} />);
    expect(screen.getByText("capture.mp4")).toBeTruthy();
  });

  it("calls onBack when back button is pressed", () => {
    render(<VideoToolbar {...defaultProps} />);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onNavigate with prevVideoId when previous button is pressed", () => {
    render(<VideoToolbar {...defaultProps} />);
    fireEvent.press(screen.getByLabelText("Previous"));
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("prev-1");
  });

  it("calls onNavigate with nextVideoId when next button is pressed", () => {
    render(<VideoToolbar {...defaultProps} />);
    fireEvent.press(screen.getByLabelText("Next"));
    expect(defaultProps.onNavigate).toHaveBeenCalledWith("next-1");
  });

  it("disables previous button when prevVideoId is null", () => {
    render(<VideoToolbar {...defaultProps} prevVideoId={null} />);
    fireEvent.press(screen.getByLabelText("Previous"));
    expect(defaultProps.onNavigate).not.toHaveBeenCalled();
  });

  it("disables next button when nextVideoId is null", () => {
    render(<VideoToolbar {...defaultProps} nextVideoId={null} />);
    fireEvent.press(screen.getByLabelText("Next"));
    expect(defaultProps.onNavigate).not.toHaveBeenCalled();
  });

  it("calls onToggleFavorite and shows Favorite label when not favorited", () => {
    render(<VideoToolbar {...defaultProps} isFavorite={false} />);
    const btn = screen.getByLabelText("Favorite");
    fireEvent.press(btn);
    expect(defaultProps.onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("shows Unfavorite label when favorited", () => {
    render(<VideoToolbar {...defaultProps} isFavorite={true} />);
    expect(screen.getByLabelText("Unfavorite")).toBeTruthy();
  });

  it("renders nav icons even when both prev and next are null", () => {
    render(<VideoToolbar {...defaultProps} prevVideoId={null} nextVideoId={null} />);
    expect(screen.getByText("chevron-back")).toBeTruthy();
    expect(screen.getByText("chevron-forward")).toBeTruthy();
  });
});
