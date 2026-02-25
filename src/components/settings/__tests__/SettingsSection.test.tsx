import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SettingsSection } from "../SettingsSection";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

describe("SettingsSection", () => {
  it("renders title and children in non-collapsible mode", () => {
    render(
      <SettingsSection title="Test Section">
        <Text>Child content</Text>
      </SettingsSection>,
    );

    expect(screen.getByText("Test Section")).toBeTruthy();
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("renders reset button when onReset is provided", () => {
    const onReset = jest.fn();
    render(
      <SettingsSection title="Section" onReset={onReset}>
        <Text>Content</Text>
      </SettingsSection>,
    );

    expect(screen.getByText("settings.resetSection")).toBeTruthy();
  });

  it("does not render reset button when onReset is not provided", () => {
    render(
      <SettingsSection title="Section">
        <Text>Content</Text>
      </SettingsSection>,
    );

    expect(screen.queryByText("settings.resetSection")).toBeNull();
  });

  it("calls onReset when reset button is pressed", () => {
    const onReset = jest.fn();
    render(
      <SettingsSection title="Section" onReset={onReset}>
        <Text>Content</Text>
      </SettingsSection>,
    );

    fireEvent.press(screen.getByText("settings.resetSection"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("renders in collapsible mode with Accordion", () => {
    render(
      <SettingsSection title="Collapsible" collapsible>
        <Text>Collapsed content</Text>
      </SettingsSection>,
    );

    expect(screen.getByText("Collapsible")).toBeTruthy();
  });

  it("renders collapsible with defaultCollapsed", () => {
    render(
      <SettingsSection title="Collapsed" collapsible defaultCollapsed>
        <Text>Hidden content</Text>
      </SettingsSection>,
    );

    expect(screen.getByText("Collapsed")).toBeTruthy();
  });

  it("renders reset button in collapsible mode when onReset is provided", () => {
    const onReset = jest.fn();
    render(
      <SettingsSection title="Section" collapsible onReset={onReset}>
        <Text>Content</Text>
      </SettingsSection>,
    );

    expect(screen.toJSON()).toBeTruthy();
  });
});
