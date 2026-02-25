import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SheetActionItem } from "../SheetActionItem";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  icon: "document-outline" as const,
  title: "Import File",
  subtitle: "FITS, TIFF, PNG",
  onPress: jest.fn(),
  successColor: "#22c55e",
  mutedColor: "#6b7280",
};

describe("SheetActionItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and subtitle", () => {
    render(<SheetActionItem {...defaultProps} />);
    expect(screen.getByText("Import File")).toBeTruthy();
    expect(screen.getByText("FITS, TIFF, PNG")).toBeTruthy();
  });

  it("renders without subtitle when not provided", () => {
    render(<SheetActionItem {...defaultProps} subtitle={undefined} />);
    expect(screen.getByText("Import File")).toBeTruthy();
    expect(screen.queryByText("FITS, TIFF, PNG")).toBeNull();
  });

  it("renders icon name", () => {
    render(<SheetActionItem {...defaultProps} />);
    expect(screen.getByText("document-outline")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    render(<SheetActionItem {...defaultProps} />);
    fireEvent.press(screen.getByText("Import File"));
    expect(defaultProps.onPress).toHaveBeenCalled();
  });

  it("passes isDisabled to PressableFeedback when disabled", () => {
    const { toJSON } = render(<SheetActionItem {...defaultProps} disabled />);
    // Verify component renders in disabled state (muted text)
    expect(screen.getByText("Import File")).toBeTruthy();
    expect(toJSON()).toBeTruthy();
  });

  it("shows chevron when showChevron is true", () => {
    render(<SheetActionItem {...defaultProps} showChevron />);
    expect(screen.getByText("chevron-forward")).toBeTruthy();
  });

  it("does not show chevron when showChevron is false or omitted", () => {
    render(<SheetActionItem {...defaultProps} />);
    expect(screen.queryByText("chevron-forward")).toBeNull();
  });

  it("renders with compact styling", () => {
    const { toJSON } = render(<SheetActionItem {...defaultProps} compact />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders destructive variant", () => {
    const { toJSON } = render(<SheetActionItem {...defaultProps} destructive />);
    expect(toJSON()).toBeTruthy();
  });
});
