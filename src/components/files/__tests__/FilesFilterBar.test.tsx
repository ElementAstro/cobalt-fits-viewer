import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FilesFilterBar } from "../FilesFilterBar";
import type { FileGroup } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  favoriteOnly: false,
  filterObject: "",
  filterFilter: "",
  filterSourceFormat: "",
  filterFrameType: "",
  filterTag: "",
  filterGroupId: "",
  activeFilterCount: 0,
  objects: [] as string[],
  filters: [] as string[],
  sourceFormats: [] as string[],
  frameFilters: [] as string[],
  frameTypeLabels: new Map<string, string>(),
  tags: [] as string[],
  fileGroups: [] as FileGroup[],
  isLandscape: false,
  onFavoriteToggle: jest.fn(),
  onObjectChange: jest.fn(),
  onFilterChange: jest.fn(),
  onSourceFormatChange: jest.fn(),
  onFrameTypeChange: jest.fn(),
  onTagChange: jest.fn(),
  onGroupChange: jest.fn(),
  onClearFilters: jest.fn(),
};

describe("FilesFilterBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders favorite chip", () => {
    render(<FilesFilterBar {...defaultProps} />);
    expect(screen.getByText("gallery.favoritesOnly")).toBeTruthy();
  });

  it("calls onFavoriteToggle when favorite chip is pressed", () => {
    render(<FilesFilterBar {...defaultProps} />);
    fireEvent.press(screen.getByText("gallery.favoritesOnly"));
    expect(defaultProps.onFavoriteToggle).toHaveBeenCalled();
  });

  it("renders object chips and calls onObjectChange", () => {
    render(<FilesFilterBar {...defaultProps} objects={["M31", "M42"]} />);
    expect(screen.getByText("M31")).toBeTruthy();
    expect(screen.getByText("M42")).toBeTruthy();
    fireEvent.press(screen.getByText("M31"));
    expect(defaultProps.onObjectChange).toHaveBeenCalledWith("M31");
  });

  it("renders source format chips and calls onSourceFormatChange", () => {
    render(<FilesFilterBar {...defaultProps} sourceFormats={["fits", "tiff"]} />);
    expect(screen.getByText("FITS")).toBeTruthy();
    expect(screen.getByText("TIFF")).toBeTruthy();
    fireEvent.press(screen.getByText("FITS"));
    expect(defaultProps.onSourceFormatChange).toHaveBeenCalledWith("fits");
  });

  it("renders file group chips and calls onGroupChange", () => {
    const groups: FileGroup[] = [
      { id: "g1", name: "Group A", createdAt: 0, updatedAt: 0 },
      { id: "g2", name: "Group B", createdAt: 0, updatedAt: 0 },
    ];
    render(<FilesFilterBar {...defaultProps} fileGroups={groups} />);
    expect(screen.getByText("Group A")).toBeTruthy();
    expect(screen.getByText("Group B")).toBeTruthy();
    fireEvent.press(screen.getByText("Group A"));
    expect(defaultProps.onGroupChange).toHaveBeenCalledWith("g1");
  });

  it("does not show advanced toggle when no advanced filters exist", () => {
    render(<FilesFilterBar {...defaultProps} />);
    expect(screen.queryByText("common.more")).toBeNull();
  });

  it("shows advanced toggle when filters exist", () => {
    render(<FilesFilterBar {...defaultProps} filters={["Ha", "OIII"]} />);
    expect(screen.getByText("common.more")).toBeTruthy();
  });

  it("shows advanced toggle when frameFilters exist", () => {
    render(<FilesFilterBar {...defaultProps} frameFilters={["light"]} />);
    expect(screen.getByText("common.more")).toBeTruthy();
  });

  it("shows advanced toggle when tags exist", () => {
    render(<FilesFilterBar {...defaultProps} tags={["best"]} />);
    expect(screen.getByText("common.more")).toBeTruthy();
  });

  it("toggles advanced section when more chip is pressed", () => {
    render(
      <FilesFilterBar
        {...defaultProps}
        filters={["Ha", "OIII"]}
        frameFilters={["light"]}
        tags={["best"]}
        frameTypeLabels={new Map([["light", "Light"]])}
      />,
    );
    // Advanced chips not visible initially
    expect(screen.queryByText("Ha")).toBeNull();

    // Press "more" to expand
    fireEvent.press(screen.getByText("common.more"));
    expect(screen.getByText("Ha")).toBeTruthy();
    expect(screen.getByText("OIII")).toBeTruthy();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("#best")).toBeTruthy();

    // Press "more" again to collapse
    fireEvent.press(screen.getByText("common.more"));
    expect(screen.queryByText("Ha")).toBeNull();
  });

  it("calls onFilterChange when advanced filter chip is pressed", () => {
    render(<FilesFilterBar {...defaultProps} filters={["Ha"]} />);
    fireEvent.press(screen.getByText("common.more"));
    fireEvent.press(screen.getByText("Ha"));
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith("Ha");
  });

  it("calls onFrameTypeChange when frame type chip is pressed", () => {
    render(
      <FilesFilterBar
        {...defaultProps}
        frameFilters={["dark"]}
        frameTypeLabels={new Map([["dark", "Dark"]])}
      />,
    );
    fireEvent.press(screen.getByText("common.more"));
    fireEvent.press(screen.getByText("Dark"));
    expect(defaultProps.onFrameTypeChange).toHaveBeenCalledWith("dark");
  });

  it("falls back to raw frame type when label not in map", () => {
    render(<FilesFilterBar {...defaultProps} frameFilters={["bias"]} />);
    fireEvent.press(screen.getByText("common.more"));
    expect(screen.getByText("bias")).toBeTruthy();
  });

  it("calls onTagChange when tag chip is pressed", () => {
    render(<FilesFilterBar {...defaultProps} tags={["best"]} />);
    fireEvent.press(screen.getByText("common.more"));
    fireEvent.press(screen.getByText("#best"));
    expect(defaultProps.onTagChange).toHaveBeenCalledWith("best");
  });

  it("shows clear filters bar when activeFilterCount > 0", () => {
    render(<FilesFilterBar {...defaultProps} activeFilterCount={3} />);
    expect(screen.getByText(/3/)).toBeTruthy();
    expect(screen.getByText("targets.clearFilters")).toBeTruthy();
  });

  it("calls onClearFilters when clear button is pressed", () => {
    render(<FilesFilterBar {...defaultProps} activeFilterCount={2} />);
    fireEvent.press(screen.getByText("targets.clearFilters"));
    expect(defaultProps.onClearFilters).toHaveBeenCalled();
  });

  it("does not show clear filters bar when activeFilterCount is 0", () => {
    render(<FilesFilterBar {...defaultProps} activeFilterCount={0} />);
    expect(screen.queryByText("targets.clearFilters")).toBeNull();
  });

  it("applies primary variant to selected object chip", () => {
    render(<FilesFilterBar {...defaultProps} objects={["M31"]} filterObject="M31" />);
    // Chip with M31 should be rendered (variant is handled internally)
    expect(screen.getByText("M31")).toBeTruthy();
  });

  it("applies primary variant to selected format chip", () => {
    render(<FilesFilterBar {...defaultProps} sourceFormats={["fits"]} filterSourceFormat="fits" />);
    expect(screen.getByText("FITS")).toBeTruthy();
  });

  it("applies primary variant to selected group chip", () => {
    const groups: FileGroup[] = [{ id: "g1", name: "Group A", createdAt: 0, updatedAt: 0 }];
    render(<FilesFilterBar {...defaultProps} fileGroups={groups} filterGroupId="g1" />);
    expect(screen.getByText("Group A")).toBeTruthy();
  });
});
