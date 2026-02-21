import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AddTargetSheet } from "../AddTargetSheet";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../CategorySelector", () => ({
  CategorySelector: () => null,
}));

jest.mock("../TagInput", () => ({
  TagInput: () => null,
}));

describe("AddTargetSheet", () => {
  it("prefers manually edited RA over combined coordinate input", () => {
    const onConfirm = jest.fn();
    render(<AddTargetSheet visible onClose={jest.fn()} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByPlaceholderText("targets.targetName"), "M42");

    const coordinatesInput = screen.getByPlaceholderText("05:34:31 +22:00:52 / 83.633, 22.014");
    fireEvent.changeText(coordinatesInput, "05:34:31 +22:00:52");
    fireEvent(coordinatesInput, "blur");

    fireEvent.changeText(screen.getByPlaceholderText("05h 34m 31s / 83.633"), "84.000");
    fireEvent.press(screen.getByText("common.confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "M42",
      }),
    );
    const payload = onConfirm.mock.calls[0]?.[0];
    expect(payload.ra).toBeCloseTo(84, 6);
    expect(payload.dec).toBeCloseTo(22.014, 3);
  });
});
