import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FilesToolbar } from "../FilesToolbar";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  isSelectionMode: false,
  selectedCount: 0,
  trashCount: 0,
  shouldStack: false,
  onImport: jest.fn(),
  onEnterSelection: jest.fn(),
  onConvert: jest.fn(),
  onTrash: jest.fn(),
  onSelectAllVisible: jest.fn(),
  onMoreActions: jest.fn(),
  onBatchDelete: jest.fn(),
  onClearSelection: jest.fn(),
};

describe("FilesToolbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Normal mode tests ---
  it("renders import button", () => {
    render(<FilesToolbar {...defaultProps} />);
    expect(screen.getByText("files.importOptions")).toBeTruthy();
  });

  it("calls onImport when import button is pressed", () => {
    render(<FilesToolbar {...defaultProps} />);
    fireEvent.press(screen.getByText("files.importOptions"));
    expect(defaultProps.onImport).toHaveBeenCalled();
  });

  it("renders enter selection button in normal mode", () => {
    render(<FilesToolbar {...defaultProps} />);
    expect(screen.getByTestId("e2e-action-tabs__index-enter-selection")).toBeTruthy();
  });

  it("calls onEnterSelection when enter selection button is pressed", () => {
    render(<FilesToolbar {...defaultProps} />);
    fireEvent.press(screen.getByTestId("e2e-action-tabs__index-enter-selection"));
    expect(defaultProps.onEnterSelection).toHaveBeenCalled();
  });

  it("calls onConvert when convert button is pressed in normal mode", () => {
    render(<FilesToolbar {...defaultProps} />);
    // The convert button contains an Ionicons mock that renders the icon name as text
    fireEvent.press(screen.getByText("swap-horizontal-outline"));
    expect(defaultProps.onConvert).toHaveBeenCalled();
  });

  it("renders trash button in normal mode", () => {
    render(<FilesToolbar {...defaultProps} />);
    expect(screen.getByTestId("e2e-action-tabs__index-open-trash")).toBeTruthy();
  });

  it("calls onTrash when trash button is pressed", () => {
    render(<FilesToolbar {...defaultProps} />);
    fireEvent.press(screen.getByTestId("e2e-action-tabs__index-open-trash"));
    expect(defaultProps.onTrash).toHaveBeenCalled();
  });

  it("renders trash-bin icon when trashCount > 0", () => {
    render(<FilesToolbar {...defaultProps} trashCount={5} />);
    expect(screen.getByText("trash-bin")).toBeTruthy();
  });

  it("renders trash-bin-outline icon when trashCount is 0", () => {
    render(<FilesToolbar {...defaultProps} trashCount={0} />);
    expect(screen.getByText("trash-bin-outline")).toBeTruthy();
  });

  it("does not render selection mode buttons in normal mode", () => {
    render(<FilesToolbar {...defaultProps} />);
    expect(screen.queryByTestId("e2e-action-tabs__index-select-all")).toBeNull();
    expect(screen.queryByText("files.batchActions")).toBeNull();
    expect(screen.queryByTestId("files-batch-delete-button")).toBeNull();
  });

  // --- Selection mode tests ---
  it("renders select all button in selection mode", () => {
    render(<FilesToolbar {...defaultProps} isSelectionMode />);
    expect(screen.getByTestId("e2e-action-tabs__index-select-all")).toBeTruthy();
  });

  it("calls onSelectAllVisible when select all is pressed", () => {
    render(<FilesToolbar {...defaultProps} isSelectionMode />);
    fireEvent.press(screen.getByTestId("e2e-action-tabs__index-select-all"));
    expect(defaultProps.onSelectAllVisible).toHaveBeenCalled();
  });

  it("renders more actions button in selection mode", () => {
    render(<FilesToolbar {...defaultProps} isSelectionMode />);
    expect(screen.getByText("files.batchActions")).toBeTruthy();
  });

  it("calls onMoreActions when more actions button is pressed", () => {
    render(<FilesToolbar {...defaultProps} isSelectionMode />);
    fireEvent.press(screen.getByText("files.batchActions"));
    expect(defaultProps.onMoreActions).toHaveBeenCalled();
  });

  it("renders batch delete button in selection mode", () => {
    render(<FilesToolbar {...defaultProps} isSelectionMode />);
    expect(screen.getByTestId("files-batch-delete-button")).toBeTruthy();
  });

  it("calls onBatchDelete when batch delete button is pressed", () => {
    render(<FilesToolbar {...defaultProps} isSelectionMode selectedCount={2} />);
    fireEvent.press(screen.getByTestId("files-batch-delete-button"));
    expect(defaultProps.onBatchDelete).toHaveBeenCalled();
  });

  it("calls onClearSelection when close button is pressed in selection mode", () => {
    render(<FilesToolbar {...defaultProps} isSelectionMode />);
    // Close button is the last button; find by icon name
    expect(screen.getByText("close-outline")).toBeTruthy();
  });

  it("does not show normal mode buttons in selection mode", () => {
    render(<FilesToolbar {...defaultProps} isSelectionMode />);
    expect(screen.queryByTestId("e2e-action-tabs__index-enter-selection")).toBeNull();
    expect(screen.queryByTestId("e2e-action-tabs__index-open-trash")).toBeNull();
  });

  it("applies full-width class to import button when shouldStack is true", () => {
    const { toJSON } = render(<FilesToolbar {...defaultProps} shouldStack />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("w-full");
  });

  it("applies flex-1 class to import button when shouldStack is false", () => {
    const { toJSON } = render(<FilesToolbar {...defaultProps} shouldStack={false} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("flex-1");
  });
});
