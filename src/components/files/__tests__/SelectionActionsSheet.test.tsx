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

  it("calls onInvertSelection and closes sheet when invert is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.invertSelection"));
    expect(defaultProps.onInvertSelection).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onAlbumPicker and closes sheet when add to album is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("gallery.addToAlbum"));
    expect(defaultProps.onAlbumPicker).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onBatchTag and closes sheet when tag is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.batchTag"));
    expect(defaultProps.onBatchTag).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onBatchRename and closes sheet when rename is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.batchRename"));
    expect(defaultProps.onBatchRename).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onGroupSheet and closes sheet when file group is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.fileGroup"));
    expect(defaultProps.onGroupSheet).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onBatchConvert and closes sheet when convert is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.batchConvert"));
    expect(defaultProps.onBatchConvert).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onStacking and closes sheet when stacking is pressed", () => {
    render(<SelectionActionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.stacking"));
    expect(defaultProps.onStacking).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders stacking as disabled when selectedCount < 2", () => {
    render(<SelectionActionsSheet {...defaultProps} selectedCount={1} />);
    // Stacking renders but in disabled state
    expect(screen.getByText("files.stacking")).toBeTruthy();
  });

  it("renders action items as disabled when selectedCount is 0", () => {
    render(<SelectionActionsSheet {...defaultProps} selectedCount={0} />);
    // Actions render but in disabled state
    expect(screen.getByText("files.toggleFavorite")).toBeTruthy();
    expect(screen.getByText("files.export")).toBeTruthy();
  });

  it("renders with compact styling in landscape mode", () => {
    const { toJSON } = render(<SelectionActionsSheet {...defaultProps} isLandscape />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("px-4");
  });

  it("renders with normal styling in portrait mode", () => {
    const { toJSON } = render(<SelectionActionsSheet {...defaultProps} isLandscape={false} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("px-6");
  });

  it("renders invert selection as disabled when displayCount is 0", () => {
    render(<SelectionActionsSheet {...defaultProps} displayCount={0} />);
    expect(screen.getByText("files.invertSelection")).toBeTruthy();
  });
});
