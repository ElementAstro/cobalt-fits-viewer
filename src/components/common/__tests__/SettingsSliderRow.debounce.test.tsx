import { act, render } from "@testing-library/react-native";
import { SettingsSliderRow } from "../SettingsSliderRow";

let latestSliderProps: Record<string, unknown> | null = null;

jest.mock("../SimpleSlider", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    SimpleSlider: (props: Record<string, unknown>) => {
      latestSliderProps = props;
      return <Text testID="mock-simple-slider">mock-slider</Text>;
    },
  };
});

describe("SettingsSliderRow debounce", () => {
  const baseProps = {
    icon: "pulse-outline" as const,
    label: "Sigma Threshold",
    value: 3.5,
    min: 1,
    max: 10,
    step: 0.1,
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    latestSliderProps = null;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("debounces updates while sliding", () => {
    const onValueChange = jest.fn();
    render(<SettingsSliderRow {...baseProps} onValueChange={onValueChange} debounceMs={120} />);

    act(() => {
      (latestSliderProps?.["onValueChange"] as (v: number) => void)(4.2);
    });

    expect(onValueChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(119);
    });
    expect(onValueChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(4.2);
  });

  it("commits latest value immediately on sliding complete", () => {
    const onValueChange = jest.fn();
    render(<SettingsSliderRow {...baseProps} onValueChange={onValueChange} debounceMs={120} />);

    act(() => {
      (latestSliderProps?.["onValueChange"] as (v: number) => void)(4.1);
    });
    act(() => {
      (latestSliderProps?.["onSlidingComplete"] as (v: number) => void)(4.8);
    });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(4.8);

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("updates immediately when debounce is disabled", () => {
    const onValueChange = jest.fn();
    render(<SettingsSliderRow {...baseProps} onValueChange={onValueChange} debounceMs={0} />);

    act(() => {
      (latestSliderProps?.["onValueChange"] as (v: number) => void)(4.6);
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(4.6);

    act(() => {
      (latestSliderProps?.["onSlidingComplete"] as (v: number) => void)(4.6);
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });
});
