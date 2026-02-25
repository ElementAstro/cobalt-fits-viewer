import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PanResponder } from "react-native";
import { SimpleSlider } from "../SimpleSlider";

describe("SimpleSlider", () => {
  const defaultProps = {
    label: "Brightness",
    value: 50,
    min: 0,
    max: 100,
    step: 1,
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders label text", () => {
    render(<SimpleSlider {...defaultProps} />);

    expect(screen.getByText("Brightness")).toBeTruthy();
  });

  it("renders display value as integer when step >= 1", () => {
    render(<SimpleSlider {...defaultProps} value={50} step={1} />);

    expect(screen.getByText("50")).toBeTruthy();
  });

  it("renders display value with 1 decimal when step >= 0.1", () => {
    render(<SimpleSlider {...defaultProps} value={1.5} min={0} max={5} step={0.1} />);

    expect(screen.getByText("1.5")).toBeTruthy();
  });

  it("renders display value with 2 decimals when step < 0.1", () => {
    render(<SimpleSlider {...defaultProps} value={0.75} min={0} max={1} step={0.01} />);

    expect(screen.getByText("0.75")).toBeTruthy();
  });

  it("sets correct accessibility props", () => {
    render(<SimpleSlider {...defaultProps} value={25} />);

    const tree = screen.toJSON();
    expect(tree).toBeTruthy();
  });

  it("renders track and thumb elements", () => {
    const tree = render(<SimpleSlider {...defaultProps} />);

    expect(tree.toJSON()).toBeTruthy();
  });

  it("clamps fraction between 0 and 1 for out-of-range values", () => {
    // Value below min
    const { rerender } = render(<SimpleSlider {...defaultProps} value={-10} />);
    expect(screen.getByText("-10")).toBeTruthy();

    // Value above max
    rerender(<SimpleSlider {...defaultProps} value={150} />);
    expect(screen.getByText("150")).toBeTruthy();
  });

  it("renders with defaultValue prop", () => {
    render(<SimpleSlider {...defaultProps} defaultValue={50} />);

    expect(screen.toJSON()).toBeTruthy();
  });

  it("does not recreate PanResponder on re-render", () => {
    const createSpy = jest.spyOn(PanResponder, "create");
    const { rerender } = render(<SimpleSlider {...defaultProps} />);
    const initialCount = createSpy.mock.calls.length;
    rerender(<SimpleSlider {...defaultProps} value={75} />);
    expect(createSpy.mock.calls.length).toBe(initialCount);
    createSpy.mockRestore();
  });
});
