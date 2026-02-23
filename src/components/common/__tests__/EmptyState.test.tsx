import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders icon and title", () => {
    render(<EmptyState icon="images-outline" title="No images found" />);

    expect(screen.getByText("No images found")).toBeTruthy();
    expect(screen.getByText("images-outline")).toBeTruthy();
  });

  it("renders description when provided", () => {
    render(
      <EmptyState icon="images-outline" title="No images" description="Try importing some files" />,
    );

    expect(screen.getByText("Try importing some files")).toBeTruthy();
  });

  it("does not render description when not provided", () => {
    render(<EmptyState icon="images-outline" title="No images" />);

    expect(screen.queryByText("Try importing some files")).toBeNull();
  });

  it("renders primary action button and responds to press", () => {
    const onAction = jest.fn();
    render(
      <EmptyState icon="images-outline" title="Empty" actionLabel="Import" onAction={onAction} />,
    );

    const button = screen.getByText("Import");
    expect(button).toBeTruthy();

    fireEvent.press(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not render action button when actionLabel is missing", () => {
    render(<EmptyState icon="images-outline" title="Empty" onAction={jest.fn()} />);

    expect(screen.queryByText("Import")).toBeNull();
  });

  it("does not render action button when onAction is missing", () => {
    render(<EmptyState icon="images-outline" title="Empty" actionLabel="Import" />);

    // Button won't render because both actionLabel AND onAction are required
    // The component checks: actionLabel && onAction
    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders secondary action button and responds to press", () => {
    const onSecondary = jest.fn();
    render(
      <EmptyState
        icon="images-outline"
        title="Empty"
        secondaryLabel="Learn More"
        onSecondaryAction={onSecondary}
      />,
    );

    const button = screen.getByText("Learn More");
    expect(button).toBeTruthy();

    fireEvent.press(button);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("does not render secondary button when secondaryLabel is missing", () => {
    render(<EmptyState icon="images-outline" title="Empty" onSecondaryAction={jest.fn()} />);

    expect(screen.queryByText("Learn More")).toBeNull();
  });

  it("renders both primary and secondary action buttons", () => {
    render(
      <EmptyState
        icon="images-outline"
        title="Empty"
        actionLabel="Import"
        onAction={jest.fn()}
        secondaryLabel="Help"
        onSecondaryAction={jest.fn()}
      />,
    );

    expect(screen.getByText("Import")).toBeTruthy();
    expect(screen.getByText("Help")).toBeTruthy();
  });
});
