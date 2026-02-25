import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FilesSortBar } from "../FilesSortBar";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  sortBy: "name" as const,
  sortOrder: "asc" as const,
  fileListStyle: "list" as const,
  fileListGridColumns: 3 as const,
  onSortToggle: jest.fn(),
  onStyleChange: jest.fn(),
  onGridColumnsChange: jest.fn(),
};

describe("FilesSortBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all sort option chips", () => {
    render(<FilesSortBar {...defaultProps} />);
    expect(screen.getByText(/files\.sortByName/)).toBeTruthy();
    expect(screen.getByText(/files\.sortByDate/)).toBeTruthy();
    expect(screen.getByText(/files\.sortBySize/)).toBeTruthy();
    expect(screen.getByText(/gallery\.quality/)).toBeTruthy();
  });

  it("shows ascending arrow for active sort", () => {
    render(<FilesSortBar {...defaultProps} sortBy="name" sortOrder="asc" />);
    expect(screen.getByText(/↑/)).toBeTruthy();
  });

  it("shows descending arrow for active sort", () => {
    render(<FilesSortBar {...defaultProps} sortBy="name" sortOrder="desc" />);
    expect(screen.getByText(/↓/)).toBeTruthy();
  });

  it("calls onSortToggle with correct key when sort chip is pressed", () => {
    render(<FilesSortBar {...defaultProps} />);
    fireEvent.press(screen.getByText(/files\.sortByDate/));
    expect(defaultProps.onSortToggle).toHaveBeenCalledWith("date");
  });

  it("calls onSortToggle with 'size' when size chip is pressed", () => {
    render(<FilesSortBar {...defaultProps} />);
    fireEvent.press(screen.getByText(/files\.sortBySize/));
    expect(defaultProps.onSortToggle).toHaveBeenCalledWith("size");
  });

  it("calls onSortToggle with 'quality' when quality chip is pressed", () => {
    render(<FilesSortBar {...defaultProps} />);
    fireEvent.press(screen.getByText(/gallery\.quality/));
    expect(defaultProps.onSortToggle).toHaveBeenCalledWith("quality");
  });

  it("renders all style option chips", () => {
    render(<FilesSortBar {...defaultProps} />);
    expect(screen.getByText("settings.fileListGrid")).toBeTruthy();
    expect(screen.getByText("settings.fileListList")).toBeTruthy();
    expect(screen.getByText("settings.fileListCompact")).toBeTruthy();
  });

  it("calls onStyleChange with correct style when style chip is pressed", () => {
    render(<FilesSortBar {...defaultProps} />);
    fireEvent.press(screen.getByText("settings.fileListGrid"));
    expect(defaultProps.onStyleChange).toHaveBeenCalledWith("grid");
  });

  it("calls onStyleChange with 'compact'", () => {
    render(<FilesSortBar {...defaultProps} />);
    fireEvent.press(screen.getByText("settings.fileListCompact"));
    expect(defaultProps.onStyleChange).toHaveBeenCalledWith("compact");
  });

  it("shows grid column chips when fileListStyle is grid", () => {
    render(<FilesSortBar {...defaultProps} fileListStyle="grid" />);
    expect(screen.getByTestId("files-grid-columns-2")).toBeTruthy();
    expect(screen.getByTestId("files-grid-columns-3")).toBeTruthy();
    expect(screen.getByTestId("files-grid-columns-4")).toBeTruthy();
  });

  it("does not show grid column chips when fileListStyle is list", () => {
    render(<FilesSortBar {...defaultProps} fileListStyle="list" />);
    expect(screen.queryByTestId("files-grid-columns-2")).toBeNull();
    expect(screen.queryByTestId("files-grid-columns-3")).toBeNull();
    expect(screen.queryByTestId("files-grid-columns-4")).toBeNull();
  });

  it("does not show grid column chips when fileListStyle is compact", () => {
    render(<FilesSortBar {...defaultProps} fileListStyle="compact" />);
    expect(screen.queryByTestId("files-grid-columns-2")).toBeNull();
  });

  it("calls onGridColumnsChange with correct value when column chip is pressed", () => {
    render(<FilesSortBar {...defaultProps} fileListStyle="grid" />);
    fireEvent.press(screen.getByTestId("files-grid-columns-4"));
    expect(defaultProps.onGridColumnsChange).toHaveBeenCalledWith(4);
  });

  it("calls onGridColumnsChange with 2", () => {
    render(<FilesSortBar {...defaultProps} fileListStyle="grid" />);
    fireEvent.press(screen.getByTestId("files-grid-columns-2"));
    expect(defaultProps.onGridColumnsChange).toHaveBeenCalledWith(2);
  });
});
