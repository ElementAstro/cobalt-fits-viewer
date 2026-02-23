import React from "react";
import { render, screen } from "@testing-library/react-native";
import { FilesHeader } from "../FilesHeader";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../lib/utils/fileManager", () => ({
  formatFileSize: (bytes: number) => `${bytes}B`,
}));

jest.mock("../../common/SearchBar", () => ({
  SearchBar: (props: { value: string; placeholder: string; compact?: boolean }) => {
    const { View, TextInput } = require("react-native");
    return (
      <View testID="search-bar">
        <TextInput testID="search-input" value={props.value} placeholder={props.placeholder} />
      </View>
    );
  },
}));

const defaultProps = {
  displayCount: 5,
  totalCount: 10,
  storageSize: 2048,
  searchQuery: "",
  onSearchChange: jest.fn(),
  isLandscape: false,
};

describe("FilesHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title text", () => {
    render(<FilesHeader {...defaultProps} />);
    expect(screen.getByText("files.title")).toBeTruthy();
  });

  it("renders display/total count in portrait", () => {
    render(<FilesHeader {...defaultProps} />);
    expect(screen.getByText(/5\/10/)).toBeTruthy();
  });

  it("renders subtitle in portrait mode", () => {
    render(<FilesHeader {...defaultProps} />);
    expect(screen.getByText(/files\.subtitle/)).toBeTruthy();
  });

  it("renders compact count without subtitle in landscape mode", () => {
    render(<FilesHeader {...defaultProps} isLandscape />);
    const countText = screen.getByText("(5/10)");
    expect(countText).toBeTruthy();
    // Landscape doesn't show the subtitle prefix
    expect(screen.queryByText(/files\.subtitle/)).toBeNull();
  });

  it("renders storage info in portrait when totalCount > 0", () => {
    render(<FilesHeader {...defaultProps} />);
    expect(screen.getByText(/2048B/)).toBeTruthy();
  });

  it("does not render storage info when totalCount is 0", () => {
    render(<FilesHeader {...defaultProps} totalCount={0} />);
    expect(screen.queryByText(/files\.storageUsed/)).toBeNull();
  });

  it("does not render storage info in landscape", () => {
    render(<FilesHeader {...defaultProps} isLandscape />);
    expect(screen.queryByText(/files\.storageUsed/)).toBeNull();
  });

  it("renders SearchBar with correct props", () => {
    render(<FilesHeader {...defaultProps} searchQuery="test" />);
    expect(screen.getByTestId("search-bar")).toBeTruthy();
    expect(screen.getByTestId("search-input").props.value).toBe("test");
  });

  it("passes compact to SearchBar in landscape", () => {
    render(<FilesHeader {...defaultProps} isLandscape searchQuery="" />);
    expect(screen.getByTestId("search-bar")).toBeTruthy();
  });

  it("displays files count text with totalCount", () => {
    render(<FilesHeader {...defaultProps} totalCount={42} />);
    expect(screen.getByText(/42/)).toBeTruthy();
  });
});
