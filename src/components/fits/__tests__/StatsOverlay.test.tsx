import React from "react";
import { render } from "@testing-library/react-native";
import { StatsOverlay } from "../StatsOverlay";

describe("StatsOverlay", () => {
  it("renders image dimensions", () => {
    const { getByText } = render(
      <StatsOverlay width={4096} height={2048} min={0} max={65535} mean={32000} />,
    );
    expect(getByText(/4096×2048/)).toBeTruthy();
  });

  it("renders min, max, and mean stats", () => {
    const { getByText } = render(
      <StatsOverlay width={100} height={100} min={0} max={255} mean={128} />,
    );
    expect(getByText(/Min:/)).toBeTruthy();
    expect(getByText(/Max:255/)).toBeTruthy();
    expect(getByText(/Mean:128/)).toBeTruthy();
  });

  it("renders stddev when provided", () => {
    const { getByText } = render(
      <StatsOverlay width={100} height={100} min={0} max={255} mean={128} stddev={42.5} />,
    );
    expect(getByText(/Std:42.500/)).toBeTruthy();
  });

  it("does not render stddev when not provided", () => {
    const { queryByText } = render(
      <StatsOverlay width={100} height={100} min={0} max={255} mean={128} />,
    );
    expect(queryByText(/Std:/)).toBeNull();
  });

  it("renders median when provided", () => {
    const { getByText } = render(
      <StatsOverlay width={100} height={100} min={0} max={255} mean={128} median={64} />,
    );
    expect(getByText(/Med:/)).toBeTruthy();
  });

  it("renders BITPIX, HDU, and frame info when provided", () => {
    const { getByText } = render(
      <StatsOverlay
        width={100}
        height={100}
        min={0}
        max={255}
        mean={128}
        bitpix={-32}
        currentHDU={0}
        currentFrame={2}
        totalFrames={10}
      />,
    );
    expect(getByText(/BITPIX:-32/)).toBeTruthy();
    expect(getByText(/HDU:1/)).toBeTruthy();
    expect(getByText(/F:3\/10/)).toBeTruthy();
  });

  it("renders depth for data cubes", () => {
    const { getByText } = render(
      <StatsOverlay width={100} height={100} min={0} max={255} mean={128} isDataCube depth={10} />,
    );
    expect(getByText(/100×100 ×10f/)).toBeTruthy();
  });

  it("does not render depth when not a data cube", () => {
    const { getByText } = render(
      <StatsOverlay width={100} height={100} min={0} max={255} mean={128} depth={10} />,
    );
    const dimText = getByText(/100×100/);
    expect(dimText.props.children).not.toContain("×10f");
  });

  it("formats large values with exponential notation", () => {
    const { getByText } = render(
      <StatsOverlay width={100} height={100} min={0} max={99999} mean={50000} />,
    );
    expect(getByText(/Max:1\.00e\+5/)).toBeTruthy();
    expect(getByText(/Mean:5\.00e\+4/)).toBeTruthy();
  });

  it("formats small values with exponential notation", () => {
    const { getByText } = render(
      <StatsOverlay width={100} height={100} min={0.0001} max={1} mean={0.5} />,
    );
    expect(getByText(/Min:1\.00e-4/)).toBeTruthy();
  });
});
