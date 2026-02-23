import {
  FilesHeader,
  FilesToolbar,
  FilesSelectionBar,
  FilesSortBar,
  FilesFilterBar,
  ImportOptionsSheet,
  UndoSnackbar,
} from "../index";

describe("files/index barrel exports", () => {
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

  it("exports UndoSnackbar", () => {
    expect(UndoSnackbar).toBeDefined();
  });
});
