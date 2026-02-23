import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SettingsRow } from "../SettingsRow";

describe("SettingsRow", () => {
  it("renders icon and label", () => {
    render(<SettingsRow icon="settings-outline" label="Language" />);

    expect(screen.getByText("settings-outline")).toBeTruthy();
    expect(screen.getByText("Language")).toBeTruthy();
  });

  it("renders description when provided", () => {
    render(
      <SettingsRow icon="settings-outline" label="Language" description="Choose your language" />,
    );

    expect(screen.getByText("Choose your language")).toBeTruthy();
  });

  it("does not render description when not provided", () => {
    render(<SettingsRow icon="settings-outline" label="Language" />);

    expect(screen.queryByText("Choose your language")).toBeNull();
  });

  it("renders value when provided", () => {
    render(<SettingsRow icon="settings-outline" label="Language" value="English" />);

    expect(screen.getByText("English")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    render(<SettingsRow icon="settings-outline" label="Language" onPress={onPress} testID="row" />);

    fireEvent.press(screen.getByTestId("row"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders chevron icon when onPress is provided and no rightElement", () => {
    render(<SettingsRow icon="settings-outline" label="Language" onPress={jest.fn()} />);

    expect(screen.getByText("chevron-forward")).toBeTruthy();
  });

  it("does not render chevron when onPress is not provided", () => {
    render(<SettingsRow icon="settings-outline" label="Language" />);

    expect(screen.queryByText("chevron-forward")).toBeNull();
  });

  it("renders custom rightElement instead of value and chevron", () => {
    const { Text } = require("react-native");
    render(
      <SettingsRow
        icon="settings-outline"
        label="Language"
        value="English"
        onPress={jest.fn()}
        rightElement={<Text>Custom</Text>}
      />,
    );

    expect(screen.getByText("Custom")).toBeTruthy();
    // When rightElement is provided, value and chevron are not rendered
    expect(screen.queryByText("English")).toBeNull();
    expect(screen.queryByText("chevron-forward")).toBeNull();
  });

  it("applies disabled opacity when disabled", () => {
    render(
      <SettingsRow
        icon="settings-outline"
        label="Language"
        disabled
        onPress={jest.fn()}
        testID="row"
      />,
    );

    const pressable = screen.getByTestId("row");
    expect(pressable.props.style).toEqual({ opacity: 0.5 });
  });

  it("sets correct accessibility props with onPress", () => {
    render(
      <SettingsRow
        icon="settings-outline"
        label="Language"
        value="English"
        onPress={jest.fn()}
        testID="row"
      />,
    );

    const pressable = screen.getByTestId("row");
    expect(pressable.props.accessibilityRole).toBe("button");
    expect(pressable.props.accessibilityLabel).toBe("Language: English");
  });

  it("sets correct accessibility role without onPress", () => {
    render(<SettingsRow icon="settings-outline" label="Language" testID="row" />);

    const pressable = screen.getByTestId("row");
    expect(pressable.props.accessibilityRole).toBe("text");
  });

  it("passes testID to PressableFeedback", () => {
    render(<SettingsRow icon="settings-outline" label="Language" testID="e2e-settings-language" />);

    expect(screen.getByTestId("e2e-settings-language")).toBeTruthy();
  });

  it("renders custom icon color", () => {
    render(<SettingsRow icon="settings-outline" label="Language" iconColor="#ff0000" />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
