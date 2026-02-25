import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FilterExposurePlan } from "../FilterExposurePlan";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("FilterExposurePlan", () => {
  it("renders quick-add buttons for common filters", () => {
    render(<FilterExposurePlan entries={[]} onChange={jest.fn()} />);
    expect(screen.getByText("+ L")).toBeTruthy();
    expect(screen.getByText("+ R")).toBeTruthy();
    expect(screen.getByText("+ Ha")).toBeTruthy();
  });

  it("hides quick-add button for already-used filters", () => {
    render(<FilterExposurePlan entries={[{ filter: "L", seconds: 300 }]} onChange={jest.fn()} />);
    expect(screen.queryByText("+ L")).toBeNull();
    expect(screen.getByText("+ R")).toBeTruthy();
  });

  it("adds a filter via quick-add button", () => {
    const onChange = jest.fn();
    render(<FilterExposurePlan entries={[]} onChange={onChange} />);
    fireEvent.press(screen.getByText("+ Ha"));
    expect(onChange).toHaveBeenCalledWith([{ filter: "Ha", seconds: 0 }]);
  });

  it("renders entry rows for existing filters", () => {
    render(
      <FilterExposurePlan
        entries={[
          { filter: "L", seconds: 300 },
          { filter: "Ha", seconds: 600 },
        ]}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText("L")).toBeTruthy();
    expect(screen.getByText("Ha")).toBeTruthy();
  });

  it("removes a filter via close button", () => {
    const onChange = jest.fn();
    render(
      <FilterExposurePlan
        entries={[
          { filter: "L", seconds: 300 },
          { filter: "Ha", seconds: 600 },
        ]}
        onChange={onChange}
      />,
    );
    const closeButtons = screen.getAllByTestId("close-button");
    fireEvent.press(closeButtons[0]);
    expect(onChange).toHaveBeenCalledWith([{ filter: "Ha", seconds: 600 }]);
  });

  it("shows empty state when no entries", () => {
    render(<FilterExposurePlan entries={[]} onChange={jest.fn()} />);
    expect(screen.getByText("targets.plannedFilters")).toBeTruthy();
  });
});
