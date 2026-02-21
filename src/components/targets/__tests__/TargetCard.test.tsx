import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TargetCard } from "../TargetCard";
import type { Target } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const baseTarget: Target = {
  id: "target-1",
  name: "M42",
  aliases: ["Orion Nebula"],
  type: "nebula",
  category: "DeepSky",
  tags: ["Emission", "Bright"],
  isFavorite: false,
  isPinned: false,
  imageIds: ["img-1", "img-2"],
  status: "planned",
  plannedFilters: [],
  plannedExposure: {},
  imageRatings: {},
  changeLog: [],
  createdAt: 1,
  updatedAt: 1,
};

describe("TargetCard", () => {
  it("renders icon mode toggles as icon-only buttons with mapped size", () => {
    render(
      <TargetCard
        target={baseTarget}
        frameCount={2}
        totalExposureMinutes={30}
        onToggleFavorite={jest.fn()}
        onTogglePinned={jest.fn()}
        actionControlMode="icon"
        interactionUi={{
          effectivePreset: "standard",
          buttonSize: "md",
          chipSize: "md",
          iconSize: 16,
          compactIconSize: 14,
          miniIconSize: 12,
        }}
      />,
    );

    expect(screen.getByTestId("target-card-favorite").props.isIconOnly).toBe(true);
    expect(screen.getByTestId("target-card-favorite").props.size).toBe("md");
    expect(screen.getByTestId("target-card-pin").props.isIconOnly).toBe(true);
    expect(screen.getByTestId("target-card-pin").props.size).toBe("md");
    expect(screen.queryByText("targets.favorites")).toBeNull();
    expect(screen.queryByText("targets.pin")).toBeNull();
  });

  it("renders checkbox mode toggles with labels", () => {
    render(
      <TargetCard
        target={baseTarget}
        frameCount={2}
        totalExposureMinutes={30}
        onToggleFavorite={jest.fn()}
        onTogglePinned={jest.fn()}
        actionControlMode="checkbox"
        interactionUi={{
          effectivePreset: "accessible",
          buttonSize: "lg",
          chipSize: "lg",
          iconSize: 18,
          compactIconSize: 16,
          miniIconSize: 14,
        }}
      />,
    );

    expect(screen.getByTestId("target-card-favorite").props.isIconOnly).toBeUndefined();
    expect(screen.getByTestId("target-card-pin").props.isIconOnly).toBeUndefined();
    expect(screen.getByText("targets.favorites")).toBeTruthy();
    expect(screen.getByText("targets.pin")).toBeTruthy();
  });

  it("calls toggle handler and stops propagation on favorite icon press", () => {
    const onToggleFavorite = jest.fn();
    const onCardPress = jest.fn();
    render(
      <TargetCard
        target={baseTarget}
        frameCount={2}
        totalExposureMinutes={30}
        onPress={onCardPress}
        onToggleFavorite={onToggleFavorite}
        onTogglePinned={jest.fn()}
        actionControlMode="icon"
      />,
    );

    const favoriteControl = screen.getByTestId("target-card-favorite");
    const stopPropagation = jest.fn();
    favoriteControl.props.onPress?.({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onCardPress).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("pressable-feedback"));
    expect(onCardPress).toHaveBeenCalledTimes(1);
  });

  it("uses accessible preset sizing when not passing interactionUi", () => {
    render(
      <TargetCard
        target={baseTarget}
        frameCount={2}
        totalExposureMinutes={30}
        onToggleFavorite={jest.fn()}
        onTogglePinned={jest.fn()}
        actionControlMode="icon"
        actionSizePreset="accessible"
        actionAutoScaleFromFont={false}
      />,
    );

    expect(screen.getByTestId("target-card-favorite").props.size).toBe("lg");
    const chips = screen.getAllByTestId("chip");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]?.props.size).toBe("lg");
  });
});
