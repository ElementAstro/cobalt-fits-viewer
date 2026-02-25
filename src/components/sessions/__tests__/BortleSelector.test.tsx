import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BortleSelector } from "../BortleSelector";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("BortleSelector", () => {
  const onChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders label and 9 bortle chips", () => {
    render(<BortleSelector value={undefined} onChange={onChange} />);
    expect(screen.getByText("sessions.bortle")).toBeTruthy();
    for (let i = 1; i <= 9; i++) {
      expect(screen.getByText(String(i))).toBeTruthy();
    }
  });

  it("calls onChange with value when chip is pressed", () => {
    render(<BortleSelector value={undefined} onChange={onChange} />);
    fireEvent.press(screen.getByText("5"));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("calls onChange with undefined to deselect current value", () => {
    render(<BortleSelector value={5} onChange={onChange} />);
    fireEvent.press(screen.getByText("5"));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
