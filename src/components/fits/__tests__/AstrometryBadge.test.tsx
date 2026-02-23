import React from "react";
import { render } from "@testing-library/react-native";
import { AstrometryBadge } from "../AstrometryBadge";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("AstrometryBadge", () => {
  it("renders status text and progress percentage", () => {
    const { getByText } = render(<AstrometryBadge status="solving" progress={42} />);
    expect(getByText("astrometry.solving 42%")).toBeTruthy();
  });

  it("renders different status keys", () => {
    const { getByText, rerender } = render(<AstrometryBadge status="uploading" progress={10} />);
    expect(getByText("astrometry.uploading 10%")).toBeTruthy();

    rerender(<AstrometryBadge status="queued" progress={0} />);
    expect(getByText("astrometry.queued 0%")).toBeTruthy();
  });

  it("renders at 100% progress", () => {
    const { getByText } = render(<AstrometryBadge status="solving" progress={100} />);
    expect(getByText("astrometry.solving 100%")).toBeTruthy();
  });

  it("renders hourglass icon", () => {
    const { getByText } = render(<AstrometryBadge status="solving" progress={50} />);
    expect(getByText("hourglass-outline")).toBeTruthy();
  });
});
