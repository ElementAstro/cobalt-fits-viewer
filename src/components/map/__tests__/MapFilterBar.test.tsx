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
          "location.allTargets": "All Targets",
          "location.allSessions": "All Sessions",
          "location.clearAllFilters": "Clear All",
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
  it("renders object/filter/target/session/date chips and triggers callbacks", () => {
    const onFilterObjectChange = jest.fn();
    const onFilterFilterChange = jest.fn();
    const onFilterTargetChange = jest.fn();
    const onFilterSessionChange = jest.fn();
    const onDateFilterChange = jest.fn();
    const onClearAll = jest.fn();

    render(
      <MapFilterBar
        files={[
          makeFile("f1", {
            object: "M31",
            filter: "Ha",
            targetId: "target-1",
            sessionId: "session-1",
          }),
          makeFile("f2", {
            object: "M42",
            filter: "OIII",
            targetId: "target-2",
            sessionId: "session-2",
          }),
        ]}
        objectOptions={["M31", "M42"]}
        filterOptions={["Ha", "OIII"]}
        targetOptions={["target-1", "target-2"]}
        sessionOptions={["session-1", "session-2"]}
        filterObject="M31"
        filterFilter=""
        filterTargetId=""
        filterSessionId=""
        dateFilterPreset="all"
        onFilterObjectChange={onFilterObjectChange}
        onFilterFilterChange={onFilterFilterChange}
        onFilterTargetChange={onFilterTargetChange}
        onFilterSessionChange={onFilterSessionChange}
        onDateFilterChange={onDateFilterChange}
        onClearAll={onClearAll}
      />,
    );

    pressChip("Last 7 Days");
    pressChip("M31");
    pressChip("Ha");
    pressChip("target-1");
    pressChip("session-1");
    pressChip("Clear All");

    expect(onDateFilterChange).toHaveBeenCalledWith("7d");
    expect(onFilterObjectChange).toHaveBeenCalledWith("M31");
    expect(onFilterFilterChange).toHaveBeenCalledWith("Ha");
    expect(onFilterTargetChange).toHaveBeenCalledWith("target-1");
    expect(onFilterSessionChange).toHaveBeenCalledWith("session-1");
    expect(onClearAll).toHaveBeenCalled();
  });

  it("returns null when no files are provided", () => {
    const { queryByText } = render(
      <MapFilterBar
        files={[]}
        objectOptions={[]}
        filterOptions={[]}
        targetOptions={[]}
        sessionOptions={[]}
        filterObject=""
        filterFilter=""
        filterTargetId=""
        filterSessionId=""
        dateFilterPreset="all"
        onFilterObjectChange={jest.fn()}
        onFilterFilterChange={jest.fn()}
        onFilterTargetChange={jest.fn()}
        onFilterSessionChange={jest.fn()}
        onDateFilterChange={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );

    expect(queryByText("All Dates")).toBeNull();
  });
});
