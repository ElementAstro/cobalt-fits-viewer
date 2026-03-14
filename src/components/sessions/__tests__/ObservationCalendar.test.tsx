import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ObservationCalendar } from "../ObservationCalendar";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("ObservationCalendar", () => {
  const onMonthChange = jest.fn();
  const onDatePress = jest.fn();

  const defaultProps = {
    datesWithData: [5, 12],
    plannedDates: [18],
    year: 2025,
    month: 2, // March (0-indexed)
    onMonthChange,
    onDatePress,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders month name and year", () => {
    render(<ObservationCalendar {...defaultProps} />);
    expect(screen.getByText("sessions.months.mar 2025")).toBeTruthy();
  });

  it("renders 7 weekday labels", () => {
    render(<ObservationCalendar {...defaultProps} />);
    expect(screen.getByText("sessions.weekdays.sun")).toBeTruthy();
    expect(screen.getByText("sessions.weekdays.sat")).toBeTruthy();
  });

  it("renders day numbers for the month", () => {
    render(<ObservationCalendar {...defaultProps} />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("31")).toBeTruthy();
  });

  it("calls onDatePress when a day cell is pressed", () => {
    render(<ObservationCalendar {...defaultProps} />);
    fireEvent.press(screen.getByText("12"));
    expect(onDatePress).toHaveBeenCalledWith(12);
  });

  it("renders legend items", () => {
    render(<ObservationCalendar {...defaultProps} />);
    expect(screen.getByText("sessions.session")).toBeTruthy();
    expect(screen.getByText("sessions.plans")).toBeTruthy();
    expect(screen.getByText("sessions.planOverdue")).toBeTruthy();
  });

  it("renders correct number of day cells for March 2025", () => {
    render(<ObservationCalendar {...defaultProps} />);
    // March 2025 has 31 days
    expect(screen.getByText("31")).toBeTruthy();
    expect(screen.queryByText("32")).toBeNull();
  });

  it("shows session count badge when count > 1", () => {
    const countMap = new Map<number, number>();
    countMap.set(5, 2);
    render(<ObservationCalendar {...defaultProps} sessionCountByDate={countMap} />);
    // Session count badge "2" appears in addition to day "2" — use getAllByText
    const matches = screen.getAllByText("2");
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
