import React from "react";
import { render, screen } from "@testing-library/react-native";
import HomeScreen from "../index";

describe("HomeScreen", () => {
  it("should render the title", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Quick Starter")).toBeTruthy();
  });

  it("should render the subtitle", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Expo Router + HeroUI Native + Uniwind")).toBeTruthy();
  });

  it("should render feature chips", () => {
    render(<HomeScreen />);
    expect(screen.getByText("expo-router")).toBeTruthy();
    expect(screen.getByText("heroui-native")).toBeTruthy();
    expect(screen.getByText("uniwind")).toBeTruthy();
    expect(screen.getByText("tailwindcss")).toBeTruthy();
  });

  it("should render action buttons", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Explore Features")).toBeTruthy();
  });
});
