import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TagInput } from "../TagInput";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("TagInput", () => {
  it("renders existing tags as chips", () => {
    render(<TagInput tags={["nebula", "emission"]} onChange={jest.fn()} />);
    expect(screen.getByText("nebula ×")).toBeTruthy();
    expect(screen.getByText("emission ×")).toBeTruthy();
  });

  it("adds a tag on submit", () => {
    const onChange = jest.fn();
    render(<TagInput tags={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("targets.addTag");
    fireEvent.changeText(input, "deepsky");
    fireEvent(input, "submitEditing");
    expect(onChange).toHaveBeenCalledWith(["deepsky"]);
  });

  it("normalizes tags to lowercase", () => {
    const onChange = jest.fn();
    render(<TagInput tags={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("targets.addTag");
    fireEvent.changeText(input, "DeepSky");
    fireEvent(input, "submitEditing");
    expect(onChange).toHaveBeenCalledWith(["deepsky"]);
  });

  it("rejects duplicate tags", () => {
    const onChange = jest.fn();
    render(<TagInput tags={["nebula"]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("targets.addTag");
    fireEvent.changeText(input, "nebula");
    fireEvent(input, "submitEditing");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("respects maxTags limit", () => {
    const onChange = jest.fn();
    render(<TagInput tags={["a", "b", "c"]} maxTags={3} onChange={onChange} />);
    const input = screen.getByPlaceholderText("targets.addTag");
    fireEvent.changeText(input, "d");
    fireEvent(input, "submitEditing");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag on chip press", () => {
    const onChange = jest.fn();
    render(<TagInput tags={["nebula", "emission"]} onChange={onChange} />);
    fireEvent.press(screen.getByText("nebula ×"));
    expect(onChange).toHaveBeenCalledWith(["emission"]);
  });

  it("shows filtered suggestions when typing", () => {
    render(
      <TagInput tags={[]} suggestions={["nebula", "galaxy", "cluster"]} onChange={jest.fn()} />,
    );
    const input = screen.getByPlaceholderText("targets.addTag");
    fireEvent.changeText(input, "neb");
    fireEvent(input, "focus");
    expect(screen.getByText("nebula")).toBeTruthy();
    expect(screen.queryByText("galaxy")).toBeNull();
  });
});
