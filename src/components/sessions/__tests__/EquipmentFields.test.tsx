import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { EquipmentFields } from "../EquipmentFields";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("EquipmentFields", () => {
  const defaultProps = {
    telescope: "Sky-Watcher 200P",
    camera: "ZWO ASI294MC",
    mount: "EQ6-R Pro",
    onTelescopeChange: jest.fn(),
    onCameraChange: jest.fn(),
    onMountChange: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders three input fields with current values", () => {
    render(<EquipmentFields {...defaultProps} />);
    expect(screen.getByDisplayValue("Sky-Watcher 200P")).toBeTruthy();
    expect(screen.getByDisplayValue("ZWO ASI294MC")).toBeTruthy();
    expect(screen.getByDisplayValue("EQ6-R Pro")).toBeTruthy();
  });

  it("calls onTelescopeChange when telescope input changes", () => {
    render(<EquipmentFields {...defaultProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Sky-Watcher 200P"), "Celestron 8SE");
    expect(defaultProps.onTelescopeChange).toHaveBeenCalledWith("Celestron 8SE");
  });

  it("calls onCameraChange when camera input changes", () => {
    render(<EquipmentFields {...defaultProps} />);
    fireEvent.changeText(screen.getByDisplayValue("ZWO ASI294MC"), "QHY268C");
    expect(defaultProps.onCameraChange).toHaveBeenCalledWith("QHY268C");
  });

  it("calls onMountChange when mount input changes", () => {
    render(<EquipmentFields {...defaultProps} />);
    fireEvent.changeText(screen.getByDisplayValue("EQ6-R Pro"), "AM5");
    expect(defaultProps.onMountChange).toHaveBeenCalledWith("AM5");
  });
});
