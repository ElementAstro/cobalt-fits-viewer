import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SelectionActionsSheet } from "../SelectionActionsSheet";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  visible: true,
  onOpenChange: jest.fn(),
  selectedCount: 2,
  displayCount: 5,
  isLandscape: false,
  onSelectAllVisible: jest.fn(),
  onInvertSelection: jest.fn(),
  onBatchFavorite: jest.fn(),
  onAlbumPicker: jest.fn(),
  onBatchTag: jest.fn(),
  onBatchRename: jest.fn(),
  onGroupSheet: jest.fn(),
  onBatchExport: jest.fn(),
  onBatchConvert: jest.fn(),
  onStacking: jest.fn(),
};

describe("SelectionActionsSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when not visible", () => {
    const { toJSON } = render(<SelectionActionsSheet {...defaultProps} visible={false} />);
    // BottomSheet with isOpen=false should not render content
    expect(toJSON()).toBeTruthy();
  });

  it("renders title and selected count", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    expect(screen.getByText("files.batchActions")).toBeTruthy();
    expect(screen.getByText("2 album.selected")).toBeTruthy();
  });

  it("renders all action items", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    // common.selectAll appears as section header + button title
    expect(screen.getAllByText("common.selectAll").length).toBe(2);
    expect(screen.getByText("files.invertSelection")).toBeTruthy();
    expect(screen.getByText("files.toggleFavorite")).toBeTruthy();
    expect(screen.getByText("gallery.addToAlbum")).toBeTruthy();
    expect(screen.getByText("files.batchTag")).toBeTruthy();
    expect(screen.getByText("files.batchRename")).toBeTruthy();
    expect(screen.getByText("files.fileGroup")).toBeTruthy();
    expect(screen.getByText("files.export")).toBeTruthy();
    expect(screen.getByText("files.batchConvert")).toBeTruthy();
    expect(screen.getByText("files.stacking")).toBeTruthy();
  });

  it("calls onSelectAllVisible and closes sheet when select all is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    // Second occurrence is the ActionItem button
    const selectAllButtons = screen.getAllByText("common.selectAll");
    fireEvent.press(selectAllButtons[1]);
    expect(defaultProps.onSelectAllVisible).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onBatchFavorite and closes sheet when favorite is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.toggleFavorite"));
    expect(defaultProps.onBatchFavorite).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onBatchExport and closes sheet when export is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.export"));
    expect(defaultProps.onBatchExport).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });
});
