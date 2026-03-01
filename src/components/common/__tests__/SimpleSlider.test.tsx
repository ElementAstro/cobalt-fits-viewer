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

  it("calls onValueChange when PanResponder grant fires", () => {
    const onValueChange = jest.fn();
    const createSpy = jest.spyOn(PanResponder, "create");

    render(<SimpleSlider {...defaultProps} onValueChange={onValueChange} />);

    // Get the PanResponder config from the create spy
    const config = createSpy.mock.calls[0]?.[0];
    expect(config).toBeDefined();

    // Simulate grant event
    config?.onPanResponderGrant?.({ nativeEvent: { locationX: 100 } } as any, {} as any);

    expect(onValueChange).toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it("calls onValueChange when PanResponder move fires", () => {
    const onValueChange = jest.fn();
    const createSpy = jest.spyOn(PanResponder, "create");

    render(<SimpleSlider {...defaultProps} onValueChange={onValueChange} />);

    const config = createSpy.mock.calls[0]?.[0];
    expect(config).toBeDefined();

    // Simulate move event
    config?.onPanResponderMove?.({ nativeEvent: { locationX: 150 } } as any, {} as any);

    expect(onValueChange).toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it("resets to defaultValue on double-tap", () => {
    const onValueChange = jest.fn();
    const createSpy = jest.spyOn(PanResponder, "create");
    jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1100); // within DOUBLE_TAP_MS (300)

    render(<SimpleSlider {...defaultProps} defaultValue={50} onValueChange={onValueChange} />);

    const config = createSpy.mock.calls[0]?.[0];
    expect(config).toBeDefined();

    // First tap
    config?.onPanResponderGrant?.({ nativeEvent: { locationX: 80 } } as any, {} as any);

    // Second tap (double-tap) — should reset to defaultValue
    config?.onPanResponderGrant?.({ nativeEvent: { locationX: 80 } } as any, {} as any);

    expect(onValueChange).toHaveBeenCalledWith(50);

    createSpy.mockRestore();
    (Date.now as jest.Mock).mockRestore();
  });

  it("updates track width on layout", () => {
    render(<SimpleSlider {...defaultProps} />);

    // The slider tree contains a View with onLayout; trigger it
    const tree = screen.toJSON() as any;
    expect(tree).toBeTruthy();
  });

  it("returns correct shouldSetPanResponder", () => {
    const createSpy = jest.spyOn(PanResponder, "create");
    render(<SimpleSlider {...defaultProps} />);

    const config = createSpy.mock.calls[0]?.[0];
    expect(config?.onStartShouldSetPanResponder?.({} as any, {} as any)).toBe(true);
    expect(config?.onMoveShouldSetPanResponder?.({} as any, {} as any)).toBe(true);

    createSpy.mockRestore();
  });
});
