import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { HeaderTable } from "../HeaderTable";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../common/FontProvider", () => ({
  useFontFamily: () => ({
    getFontFamily: () => undefined,
    getMonoFontFamily: () => undefined,
  }),
}));

describe("HeaderTable", () => {
  const sampleKeywords = [
    { key: "BITPIX", value: 16, comment: "bits per pixel" },
    { key: "NAXIS", value: 2, comment: "number of axes" },
    { key: "NAXIS1", value: 4096, comment: "length of axis 1" },
    { key: "OBJECT", value: "M42", comment: "target object" },
  ];

  it("renders all keyword keys and values", () => {
    const { getByText } = render(<HeaderTable keywords={sampleKeywords} />);
    expect(getByText("BITPIX")).toBeTruthy();
    expect(getByText("16")).toBeTruthy();
    expect(getByText("NAXIS")).toBeTruthy();
    expect(getByText("2")).toBeTruthy();
    expect(getByText("NAXIS1")).toBeTruthy();
    expect(getByText("4096")).toBeTruthy();
    expect(getByText("OBJECT")).toBeTruthy();
    expect(getByText("M42")).toBeTruthy();
  });

  it("renders comments for keywords that have them", () => {
    const { getByText } = render(<HeaderTable keywords={sampleKeywords} />);
    expect(getByText("bits per pixel")).toBeTruthy();
    expect(getByText("target object")).toBeTruthy();
  });

  it("shows no data message when keywords array is empty", () => {
    const { getByText } = render(<HeaderTable keywords={[]} />);
    expect(getByText("common.noData")).toBeTruthy();
  });

  it("filters keywords by key name", () => {
    const { getByTestId, getByText, queryByText } = render(
      <HeaderTable keywords={sampleKeywords} />,
    );
    const input = getByTestId("input");
    fireEvent.changeText(input, "NAXIS");
    expect(getByText("NAXIS")).toBeTruthy();
    expect(getByText("NAXIS1")).toBeTruthy();
    expect(queryByText("BITPIX")).toBeNull();
    expect(queryByText("OBJECT")).toBeNull();
  });

  it("filters keywords by value", () => {
    const { getByTestId, getByText, queryByText } = render(
      <HeaderTable keywords={sampleKeywords} />,
    );
    const input = getByTestId("input");
    fireEvent.changeText(input, "M42");
    expect(getByText("OBJECT")).toBeTruthy();
    expect(queryByText("BITPIX")).toBeNull();
  });

  it("filters keywords by comment", () => {
    const { getByTestId, getByText, queryByText } = render(
      <HeaderTable keywords={sampleKeywords} />,
    );
    const input = getByTestId("input");
    fireEvent.changeText(input, "target");
    expect(getByText("OBJECT")).toBeTruthy();
    expect(queryByText("BITPIX")).toBeNull();
  });

  it("shows no data when filter matches nothing", () => {
    const { getByTestId, getByText } = render(<HeaderTable keywords={sampleKeywords} />);
    const input = getByTestId("input");
    fireEvent.changeText(input, "ZZZZZ");
    expect(getByText("common.noData")).toBeTruthy();
  });

  it("is case-insensitive when filtering", () => {
    const { getByTestId, getByText } = render(<HeaderTable keywords={sampleKeywords} />);
    const input = getByTestId("input");
    fireEvent.changeText(input, "bitpix");
    expect(getByText("BITPIX")).toBeTruthy();
  });

  it("renders keywords without comments", () => {
    const keywords = [{ key: "SIMPLE", value: true }];
    const { getByText } = render(<HeaderTable keywords={keywords} />);
    expect(getByText("SIMPLE")).toBeTruthy();
    expect(getByText("true")).toBeTruthy();
  });

  it("renders search placeholder", () => {
    const { getByTestId } = render(<HeaderTable keywords={sampleKeywords} />);
    const input = getByTestId("input");
    expect(input.props.placeholder).toBe("header.searchKeyword");
  });
});
