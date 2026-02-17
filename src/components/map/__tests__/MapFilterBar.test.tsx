import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MapFilterBar } from "../MapFilterBar";
import type { FitsMetadata } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "location.allDates": "All Dates",
          "location.last7Days": "Last 7 Days",
          "location.last30Days": "Last 30 Days",
          "location.last90Days": "Last 90 Days",
          "location.last1Year": "Last 1 Year",
          "location.allObjects": "All Objects",
          "location.allFilters": "All Filters",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

function makeFile(id: string, overrides: Partial<FitsMetadata> = {}): FitsMetadata {
  return {
    id,
    filename: `${id}.fits`,
    filepath: `file:///tmp/${id}.fits`,
    fileSize: 1024,
    importDate: 1_700_000_000_000,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    location: {
      latitude: 0,
      longitude: 0,
    },
    ...overrides,
  };
}

function pressChip(label: string) {
  const textNode = screen.getByText(label);
  fireEvent.press(textNode.parent);
}

describe("MapFilterBar", () => {
  it("renders object/filter/date chips and triggers callbacks", () => {
    const onFilterObjectChange = jest.fn();
    const onFilterFilterChange = jest.fn();
    const onDateFilterChange = jest.fn();

    render(
      <MapFilterBar
        files={[
          makeFile("f1", { object: "M31", filter: "Ha" }),
          makeFile("f2", { object: "M42", filter: "OIII" }),
        ]}
        filterObject=""
        filterFilter=""
        dateFilterPreset="all"
        onFilterObjectChange={onFilterObjectChange}
        onFilterFilterChange={onFilterFilterChange}
        onDateFilterChange={onDateFilterChange}
      />,
    );

    expect(screen.getByText("All Dates")).toBeTruthy();
    expect(screen.getByText("Last 7 Days")).toBeTruthy();
    expect(screen.getByText("M31")).toBeTruthy();
    expect(screen.getByText("Ha")).toBeTruthy();

    pressChip("Last 7 Days");
    pressChip("M31");
    pressChip("Ha");

    expect(onDateFilterChange).toHaveBeenCalledWith("7d");
    expect(onFilterObjectChange).toHaveBeenCalledWith("M31");
    expect(onFilterFilterChange).toHaveBeenCalledWith("Ha");
  });

  it("returns null when no files are provided", () => {
    const { queryByText } = render(
      <MapFilterBar
        files={[]}
        filterObject=""
        filterFilter=""
        dateFilterPreset="all"
        onFilterObjectChange={jest.fn()}
        onFilterFilterChange={jest.fn()}
        onDateFilterChange={jest.fn()}
      />,
    );

    expect(queryByText("All Dates")).toBeNull();
  });
});
