import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FileGroupSheet } from "../FileGroupSheet";
import { useFileGroupStore } from "../../../stores/useFileGroupStore";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "files.groupFiles": "Group Files",
          "files.createGroup": "Create Group",
          "files.groupNamePlaceholder": "Group name...",
          "files.groupList": "Groups",
          "files.noGroups": "No groups yet",
          "files.applyGroup": "Apply",
          "files.groupPartial": "Grouped {success} file(s), {failed} failed",
          "common.selected": "selected",
          "common.cancel": "Cancel",
          "common.save": "Save",
          "common.success": "Success",
          "common.error": "Error",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, TextInput, View } = require("react-native");

  const BottomSheet = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;

  const Button = ({ onPress, children, isDisabled }: any) => (
    <Pressable onPress={isDisabled ? undefined : onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const Chip = ({ onPress, children }: any) => <Pressable onPress={onPress}>{children}</Pressable>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  const TextField = ({ children }: any) => <View>{children}</View>;
  const Input = ({ placeholder, value, onChangeText }: any) => (
    <TextInput
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      testID="group-name-input"
    />
  );

  return {
    BottomSheet,
    Button,
    Chip,
    Input,
    Separator: () => null,
    TextField,
  };
});

describe("FileGroupSheet", () => {
  const onClose = jest.fn();
  const onApplyGroup = jest.fn(() => ({ success: 3, failed: 0 }));
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    useFileGroupStore.setState({ groups: [], fileGroupMap: {} });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("renders title and selected count", () => {
    render(
      <FileGroupSheet visible selectedCount={5} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );

    expect(screen.getByText("Group Files")).toBeTruthy();
    expect(screen.getByText("5 selected")).toBeTruthy();
  });

  it("shows no groups message when store is empty", () => {
    render(
      <FileGroupSheet visible selectedCount={3} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );

    expect(screen.getByText("No groups yet")).toBeTruthy();
  });

  it("creates a new group and selects it", () => {
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );

    fireEvent.changeText(screen.getByTestId("group-name-input"), "My Group");
    fireEvent.press(screen.getByText("Save"));

    const groups = useFileGroupStore.getState().groups;
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("My Group");
  });

  it("shows existing groups as chips", () => {
    useFileGroupStore.setState({
      groups: [
        { id: "g1", name: "Stars", createdAt: 1, updatedAt: 1 },
        { id: "g2", name: "Nebulae", createdAt: 2, updatedAt: 2 },
      ],
    });

    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );

    expect(screen.getByText("Stars")).toBeTruthy();
    expect(screen.getByText("Nebulae")).toBeTruthy();
  });

  it("calls onApplyGroup and shows success alert", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Stars", createdAt: 1, updatedAt: 1 }],
    });

    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );

    fireEvent.press(screen.getByText("Stars"));
    fireEvent.press(screen.getByText("Apply"));

    expect(onApplyGroup).toHaveBeenCalledWith("g1");
    expect(Alert.alert).toHaveBeenCalledWith("Success", "Grouped 3 file(s), 0 failed");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error alert when all files fail", () => {
    onApplyGroup.mockReturnValueOnce({ success: 0, failed: 3 });
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Stars", createdAt: 1, updatedAt: 1 }],
    });

    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );

    fireEvent.press(screen.getByText("Stars"));
    fireEvent.press(screen.getByText("Apply"));

    expect(Alert.alert).toHaveBeenCalledWith("Error", "Grouped 0 file(s), 3 failed");
  });

  it("calls onClose and resets state when cancel is pressed", () => {
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );

    fireEvent.press(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
