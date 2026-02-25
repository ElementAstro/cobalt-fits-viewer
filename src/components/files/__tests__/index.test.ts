import {
  FilesContent,
  FilesHeader,
  FilesToolbar,
  FilesSelectionBar,
  FilesSortBar,
  FilesFilterBar,
  ImportOptionsSheet,
  SelectionActionsSheet,
  SheetActionItem,
  UndoSnackbar,
} from "../index";

describe("files/index barrel exports", () => {
  it("exports FilesContent", () => {
    expect(FilesContent).toBeDefined();
  });

  it("exports FilesHeader", () => {
    expect(FilesHeader).toBeDefined();
  });

  it("exports FilesToolbar", () => {
    expect(FilesToolbar).toBeDefined();
  });

  it("exports FilesSelectionBar", () => {
    expect(FilesSelectionBar).toBeDefined();
  });

  it("exports FilesSortBar", () => {
    expect(FilesSortBar).toBeDefined();
  });

  it("exports FilesFilterBar", () => {
    expect(FilesFilterBar).toBeDefined();
  });

  it("exports ImportOptionsSheet", () => {
    expect(ImportOptionsSheet).toBeDefined();
  });

  it("exports SelectionActionsSheet", () => {
    expect(SelectionActionsSheet).toBeDefined();
  });

  it("exports SheetActionItem", () => {
    expect(SheetActionItem).toBeDefined();
  });

  it("exports UndoSnackbar", () => {
    expect(UndoSnackbar).toBeDefined();
  });
});
