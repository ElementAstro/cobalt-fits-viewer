import React from "react";
import { Alert } from "react-native";
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

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));

jest.mock("../../../lib/fits/headerValidator", () => ({
  isProtectedKeyword: (key: string) =>
    ["SIMPLE", "BITPIX", "NAXIS", "NAXIS1", "NAXIS2", "NAXIS3", "END"].includes(
      key.toUpperCase().trim(),
    ),
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

  describe("editable mode", () => {
    it("renders without crashing in editable mode", () => {
      const { getByText } = render(
        <HeaderTable
          keywords={sampleKeywords}
          editable
          onEditKeyword={jest.fn()}
          onDeleteKeyword={jest.fn()}
        />,
      );
      expect(getByText("BITPIX")).toBeTruthy();
      expect(getByText("OBJECT")).toBeTruthy();
    });

    it("calls onEditKeyword when row is pressed in editable mode", () => {
      const onEdit = jest.fn();
      const { getByText } = render(
        <HeaderTable
          keywords={sampleKeywords}
          editable
          onEditKeyword={onEdit}
          onDeleteKeyword={jest.fn()}
        />,
      );
      // PressableFeedback wraps each row — pressing the text triggers onPress
      fireEvent.press(getByText("OBJECT"));
      expect(onEdit).toHaveBeenCalledWith(3); // OBJECT is at index 3
    });

    it("shows Alert on long press", () => {
      const alertSpy = jest.spyOn(Alert, "alert");
      const { getByText } = render(
        <HeaderTable
          keywords={sampleKeywords}
          editable
          onEditKeyword={jest.fn()}
          onDeleteKeyword={jest.fn()}
        />,
      );
      fireEvent(getByText("OBJECT"), "onLongPress");
      expect(alertSpy).toHaveBeenCalledWith("OBJECT", "M42", expect.any(Array));
      alertSpy.mockRestore();
    });

    it("does not call onEditKeyword when editable is false", () => {
      const onEdit = jest.fn();
      const { getByText } = render(
        <HeaderTable keywords={sampleKeywords} onEditKeyword={onEdit} />,
      );
      fireEvent.press(getByText("OBJECT"));
      expect(onEdit).not.toHaveBeenCalled();
    });

    it("long press on protected keyword does not show delete option", () => {
      const alertSpy = jest.spyOn(Alert, "alert");
      const { getByText } = render(
        <HeaderTable
          keywords={sampleKeywords}
          editable
          onEditKeyword={jest.fn()}
          onDeleteKeyword={jest.fn()}
        />,
      );
      fireEvent(getByText("BITPIX"), "onLongPress");
      expect(alertSpy).toHaveBeenCalled();
      // Check that "header.deleteKeyword" is not in the actions
      const actions = alertSpy.mock.calls[0][2] as Array<{ text: string }>;
      expect(actions.some((a) => a.text === "header.deleteKeyword")).toBe(false);
      alertSpy.mockRestore();
    });

    it("long press on non-protected keyword shows delete option when editable", () => {
      const alertSpy = jest.spyOn(Alert, "alert");
      const { getByText } = render(
        <HeaderTable
          keywords={sampleKeywords}
          editable
          onEditKeyword={jest.fn()}
          onDeleteKeyword={jest.fn()}
        />,
      );
      fireEvent(getByText("OBJECT"), "onLongPress");
      const actions = alertSpy.mock.calls[0][2] as Array<{ text: string }>;
      expect(actions.some((a) => a.text === "header.deleteKeyword")).toBe(true);
      alertSpy.mockRestore();
    });

    it("long press always includes copy options", () => {
      const alertSpy = jest.spyOn(Alert, "alert");
      const { getByText } = render(<HeaderTable keywords={sampleKeywords} />);
      fireEvent(getByText("OBJECT"), "onLongPress");
      const actions = alertSpy.mock.calls[0][2] as Array<{ text: string }>;
      expect(actions.some((a) => a.text === "header.copyValue")).toBe(true);
      expect(actions.some((a) => a.text === "header.copyRow")).toBe(true);
      alertSpy.mockRestore();
    });

    it("copy value action calls Clipboard.setStringAsync", async () => {
      const Clipboard = require("expo-clipboard");
      const alertSpy = jest.spyOn(Alert, "alert");
      const { getByText } = render(<HeaderTable keywords={sampleKeywords} />);
      fireEvent(getByText("OBJECT"), "onLongPress");
      const actions = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress: () => void }>;
      const copyAction = actions.find((a) => a.text === "header.copyValue");
      expect(copyAction).toBeTruthy();
      await copyAction!.onPress();
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith("M42");
      alertSpy.mockRestore();
    });

    it("copy row action includes key and value", async () => {
      const Clipboard = require("expo-clipboard");
      const alertSpy = jest.spyOn(Alert, "alert");
      const { getByText } = render(<HeaderTable keywords={sampleKeywords} />);
      fireEvent(getByText("OBJECT"), "onLongPress");
      const actions = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress: () => void }>;
      const copyRowAction = actions.find((a) => a.text === "header.copyRow");
      await copyRowAction!.onPress();
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith("OBJECT = M42 / target object");
      alertSpy.mockRestore();
    });

    it("edit action in long press calls onEditKeyword", () => {
      const alertSpy = jest.spyOn(Alert, "alert");
      const onEdit = jest.fn();
      const { getByText } = render(
        <HeaderTable
          keywords={sampleKeywords}
          editable
          onEditKeyword={onEdit}
          onDeleteKeyword={jest.fn()}
        />,
      );
      fireEvent(getByText("OBJECT"), "onLongPress");
      const actions = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress: () => void }>;
      const editAction = actions.find((a) => a.text === "header.editKeyword");
      expect(editAction).toBeTruthy();
      editAction!.onPress();
      expect(onEdit).toHaveBeenCalledWith(3);
      alertSpy.mockRestore();
    });

    it("delete action in long press calls onDeleteKeyword", () => {
      const alertSpy = jest.spyOn(Alert, "alert");
      const onDelete = jest.fn();
      const { getByText } = render(
        <HeaderTable
          keywords={sampleKeywords}
          editable
          onEditKeyword={jest.fn()}
          onDeleteKeyword={onDelete}
        />,
      );
      fireEvent(getByText("OBJECT"), "onLongPress");
      const actions = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress: () => void }>;
      const deleteAction = actions.find((a) => a.text === "header.deleteKeyword");
      expect(deleteAction).toBeTruthy();
      deleteAction!.onPress();
      expect(onDelete).toHaveBeenCalledWith(3);
      alertSpy.mockRestore();
    });

    it("long press without editable does not show edit/delete options", () => {
      const alertSpy = jest.spyOn(Alert, "alert");
      const { getByText } = render(<HeaderTable keywords={sampleKeywords} />);
      fireEvent(getByText("OBJECT"), "onLongPress");
      const actions = alertSpy.mock.calls[0][2] as Array<{ text: string }>;
      expect(actions.some((a) => a.text === "header.editKeyword")).toBe(false);
      expect(actions.some((a) => a.text === "header.deleteKeyword")).toBe(false);
      alertSpy.mockRestore();
    });
  });
});
