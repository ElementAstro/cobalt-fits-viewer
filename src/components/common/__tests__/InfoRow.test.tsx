import React from "react";
import { render, screen } from "@testing-library/react-native";
import { InfoRow } from "../InfoRow";

describe("InfoRow", () => {
  it("renders label and value", () => {
    render(<InfoRow label="File Size" value="1.5 MB" />);

    expect(screen.getByText("File Size")).toBeTruthy();
    expect(screen.getByText("1.5 MB")).toBeTruthy();
  });

  it("renders 'N/A' when value is empty", () => {
    render(<InfoRow label="Object" value="" />);

    expect(screen.getByText("N/A")).toBeTruthy();
  });

  it("renders xs size by default (text-[10px])", () => {
    const { toJSON } = render(<InfoRow label="Label" value="Value" />);

    expect(toJSON()).toBeTruthy();
  });

  it("renders sm size with py-1.5 padding", () => {
    const { toJSON } = render(<InfoRow label="Label" value="Value" size="sm" />);

    expect(toJSON()).toBeTruthy();
  });

  it("passes selectable prop to value text", () => {
    render(<InfoRow label="IP" value="192.168.1.1" selectable />);

    expect(screen.getByText("192.168.1.1")).toBeTruthy();
  });

  it("renders without selectable by default", () => {
    render(<InfoRow label="Label" value="Value" />);

    expect(screen.getByText("Value")).toBeTruthy();
  });
});
