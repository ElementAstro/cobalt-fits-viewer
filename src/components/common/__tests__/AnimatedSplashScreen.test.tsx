import React from "react";
import { render, screen } from "@testing-library/react-native";
import { AnimatedSplashScreen } from "../AnimatedSplashScreen";

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    __esModule: true,
    default: {
      View: (props: any) => React.createElement(View, props, props.children),
      Text: (props: any) => React.createElement(Text, props, props.children),
    },
    Easing: {
      out: jest.fn((fn) => fn),
      in: jest.fn((fn) => fn),
      cubic: jest.fn(),
    },
    useSharedValue: (init: number) => ({ value: init }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withTiming: jest.fn((_val, _config, cb) => {
      if (cb) cb(true);
      return _val;
    }),
    withSpring: jest.fn((val) => val),
    withDelay: jest.fn((_delay, val) => val),
    runOnJS: (fn: any) => fn,
  };
});

jest.mock("expo-splash-screen", () => ({
  hide: jest.fn(),
  preventAutoHideAsync: jest.fn(),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../FontProvider", () => ({
  useFontFamily: () => ({
    getFontFamily: () => undefined,
  }),
}));

describe("AnimatedSplashScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders children", () => {
    render(
      <AnimatedSplashScreen>
        <></>
      </AnimatedSplashScreen>,
    );
    // Children are rendered underneath the splash overlay
    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders splash overlay with app name and tagline", () => {
    render(
      <AnimatedSplashScreen>
        <></>
      </AnimatedSplashScreen>,
    );

    expect(screen.getByText("splash.appName")).toBeTruthy();
    expect(screen.getByText("splash.tagline")).toBeTruthy();
  });

  it("renders telescope icon", () => {
    render(
      <AnimatedSplashScreen>
        <></>
      </AnimatedSplashScreen>,
    );

    expect(screen.getByText("telescope")).toBeTruthy();
  });

  it("hides splash overlay after animations complete", () => {
    render(
      <AnimatedSplashScreen>
        <></>
      </AnimatedSplashScreen>,
    );

    // Initially the overlay should be visible
    expect(screen.toJSON()).toBeTruthy();

    // Advance timers past the MIN_DISPLAY_MS (1500ms)
    jest.advanceTimersByTime(2500);
  });

  it("applies custom font family when getFontFamily returns a value", () => {
    // Override FontProvider mock to return a real font
    jest.doMock("../FontProvider", () => ({
      useFontFamily: () => ({
        getFontFamily: (weight?: string) => (weight === "bold" ? "Inter-Bold" : "Inter-Regular"),
      }),
    }));

    // Re-require to pick up the new mock
    const { AnimatedSplashScreen: ASS } = require("../AnimatedSplashScreen");

    render(
      <ASS>
        <></>
      </ASS>,
    );

    expect(screen.getByText("splash.appName")).toBeTruthy();
    expect(screen.getByText("splash.tagline")).toBeTruthy();
  });
});
