import React from "react";
import { render } from "@testing-library/react-native";
import { ImageInfoMetricsCard } from "../ImageInfoMetricsCard";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("ImageInfoMetricsCard", () => {
  const stats = {
    min: 0.1,
    max: 1.2,
    mean: 0.6,
    median: 0.55,
    stddev: 0.2,
    snr: 3,
  };

  const diagnostics = {
    p1: 0.12,
    p50: 0.56,
    p99: 1.1,
    peakValue: 0.7,
    clipLowPercent: 1.23,
    clipHighPercent: 2.34,
    isApproximate: false,
  };

  it("renders global stats and histogram diagnostics", () => {
    const { getByText } = render(
      <ImageInfoMetricsCard
        stats={stats}
        imageDimensions={{ width: 1200, height: 800, depth: 3, isDataCube: true }}
        histogramDiagnostics={diagnostics}
        bitpix={16}
        currentHDU={1}
        currentFrame={2}
        totalFrames={5}
      />,
    );

    expect(getByText("viewer.globalStats")).toBeTruthy();
    expect(getByText("viewer.histogram")).toBeTruthy();
    expect(getByText("1200×800×3")).toBeTruthy();
    expect(getByText("BITPIX 16")).toBeTruthy();
    expect(getByText("viewer.hdu 2")).toBeTruthy();
    expect(getByText("viewer.frame 3/5")).toBeTruthy();
  });

  it("renders region stats with region size", () => {
    const { getByText } = render(
      <ImageInfoMetricsCard regionStats={stats} regionSelection={{ x: 0, y: 0, w: 64, h: 32 }} />,
    );

    expect(getByText("viewer.regionStats (64×32)")).toBeTruthy();
  });

  it("renders approximate marker", () => {
    const { getAllByText } = render(
      <ImageInfoMetricsCard histogramDiagnostics={{ ...diagnostics, isApproximate: true }} />,
    );

    expect(getAllByText(/~ viewer\.approximate/).length).toBeGreaterThan(0);
  });

  it("renders empty placeholder when no metrics provided", () => {
    const { getByText } = render(<ImageInfoMetricsCard />);
    expect(getByText("—")).toBeTruthy();
  });
});
