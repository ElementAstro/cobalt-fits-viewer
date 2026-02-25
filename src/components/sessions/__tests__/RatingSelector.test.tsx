import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { RatingSelector } from "../RatingSelector";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("RatingSelector", () => {
  const onChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders 5 star buttons", () => {
    render(<RatingSelector value={undefined} onChange={onChange} />);
    expect(screen.getByText("sessions.rating")).toBeTruthy();
  });

  it("calls onChange with value when star is pressed", () => {
    const { UNSAFE_getAllByType } = render(
      <RatingSelector value={undefined} onChange={onChange} />,
    );
    const buttons = UNSAFE_getAllByType(require("heroui-native").Button as React.ComponentType);
    fireEvent.press(buttons[0]);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("calls onChange with undefined to deselect current value", () => {
    const { UNSAFE_getAllByType } = render(<RatingSelector value={3} onChange={onChange} />);
    const buttons = UNSAFE_getAllByType(require("heroui-native").Button as React.ComponentType);
    fireEvent.press(buttons[2]);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
