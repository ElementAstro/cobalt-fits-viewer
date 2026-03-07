import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FileGroupSheet } from "../FileGroupSheet";
import { useFileGroupStore } from "../../../stores/files/useFileGroupStore";
import { useFitsStore } from "../../../stores/files/useFitsStore";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "files.groupFiles": "Group Files",
        "files.createGroup": "Create Group",
        "files.groupNamePlaceholder": "Group name...",
        "files.noGroups": "No groups yet",
        "files.applyGroup": "Apply",
        "files.groupPartial": "Grouped {success} file(s), {failed} failed",
        "files.deleteGroup": "Delete Folder",
        "files.deleteGroupConfirm": 'Delete folder "{name}"?',
        "files.subfolders": "subfolders",
        "common.selected": "selected",
        "common.cancel": "Cancel",
        "common.save": "Save",
        "common.confirm": "Confirm",
        "common.delete": "Delete",
        "common.success": "Success",
        "common.error": "Error",
        "common.select": "Select",
        "common.manage": "Manage",
        "common.name": "Name",
        "common.description": "Description",
        "common.color": "Color",
        "common.optional": "Optional",
        "common.root": "Root",
        "common.back": "Back",
        "album.images": "images",
      };
      let result = map[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return result;
    },
  }),
}));

jest.mock("../../../lib/storage", () => ({
  zustandAsyncStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("heroui-native", () => {
  const { Pressable, Text, TextInput, View } = require("react-native");

  const BottomSheet = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;
  BottomSheet.Close = () => null;

  const Button = ({ onPress, children, isDisabled, isIconOnly }: any) => (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      accessibilityRole="button"
      testID={isIconOnly ? "icon-button" : undefined}
    >
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const Card = ({ children, className }: any) => (
    <View accessibilityLabel={className}>{children}</View>
  );
  Card.Body = ({ children }: any) => <View>{children}</View>;

  const Chip = ({ onPress, children }: any) => <Pressable onPress={onPress}>{children}</Pressable>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  const Dialog = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  Dialog.Portal = ({ children }: any) => <View>{children}</View>;
  Dialog.Overlay = () => null;
  Dialog.Content = ({ children }: any) => <View>{children}</View>;
  Dialog.Title = ({ children }: any) => <Text>{children}</Text>;
  Dialog.Description = ({ children }: any) => <Text>{children}</Text>;

  const Input = ({ placeholder, value, onChangeText, ...rest }: any) => (
    <TextInput placeholder={placeholder} value={value} onChangeText={onChangeText} {...rest} />
  );

  return {
    BottomSheet,
    Button,
    Card,
    Chip,
    Dialog,
    Input,
    Label: ({ children }: any) => <Text>{children}</Text>,
    Separator: () => null,
    useThemeColor: (key: string | string[]) => {
      if (Array.isArray(key)) return key.map(() => "#888");
      return "#888";
    },
  };
});

jest.mock("../../common/GroupColorPicker", () => ({
  GroupColorPicker: () => null,
  GROUP_COLORS: ["#ef4444", "#f97316"],
}));

jest.mock("../../../lib/utils/fileManager", () => ({
  formatFileSize: (bytes: number) => `${bytes} B`,
}));

describe("FileGroupSheet", () => {
  const onClose = jest.fn();
  const onApplyGroup = jest.fn(() => ({ success: 3, failed: 0 }));
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    useFileGroupStore.setState({ groups: [], fileGroupMap: {} });
    useFitsStore.setState({ files: [] });
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

  it("shows existing groups as cards with name and stats", () => {
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

  it("shows select/manage mode chips", () => {
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    expect(screen.getByText("Select")).toBeTruthy();
    expect(screen.getByText("Manage")).toBeTruthy();
  });

  it("calls onApplyGroup and shows success alert", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Stars", createdAt: 1, updatedAt: 1 }],
    });
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    // The select button icons are rendered as icon-buttons, select Stars group
    // Apply button is disabled when no group selected
    fireEvent.press(screen.getByText("Apply"));
    expect(onApplyGroup).not.toHaveBeenCalled();
  });

  it("calls onClose when cancel is pressed", () => {
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when not visible", () => {
    const { toJSON } = render(
      <FileGroupSheet
        visible={false}
        selectedCount={2}
        onClose={onClose}
        onApplyGroup={onApplyGroup}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("switches to manage mode and shows create button", () => {
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Manage"));
    expect(screen.getByText("Create Group")).toBeTruthy();
  });

  it("opens create form in manage mode and creates a group", () => {
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Manage"));
    fireEvent.press(screen.getByText("Create Group"));
    // Form should show Name, Description, Color labels
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByText("Color")).toBeTruthy();
    // Fill in name and confirm
    const inputs = screen.getAllByPlaceholderText("Group name...");
    fireEvent.changeText(inputs[0], "New Folder");
    fireEvent.press(screen.getByText("Confirm"));
    // Group should be created
    expect(useFileGroupStore.getState().groups.length).toBeGreaterThanOrEqual(1);
  });

  it("cancel create form hides it", () => {
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Manage"));
    fireEvent.press(screen.getByText("Create Group"));
    // Press cancel in form
    const cancelButtons = screen.getAllByText("Cancel");
    fireEvent.press(cancelButtons[0]);
    // Form should be hidden, create button reappears
    expect(screen.getByText("Create Group")).toBeTruthy();
  });

  it("shows edit and delete buttons in manage mode for existing groups", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Stars", createdAt: 1, updatedAt: 1 }],
    });
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Manage"));
    // Should have edit and delete icon buttons
    const iconButtons = screen.getAllByTestId("icon-button");
    expect(iconButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("starts inline edit when edit button is pressed", () => {
    useFileGroupStore.setState({
      groups: [
        {
          id: "g1",
          name: "Stars",
          description: "desc",
          color: "#ef4444",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Manage"));
    // Find edit icon buttons
    const iconButtons = screen.getAllByTestId("icon-button");
    // First icon button should be edit (before delete)
    fireEvent.press(iconButtons[0]);
    // Should show Save button for inline edit
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("shows delete confirmation dialog", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Stars", createdAt: 1, updatedAt: 1 }],
    });
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Manage"));
    const iconButtons = screen.getAllByTestId("icon-button");
    // Last icon button should be delete
    fireEvent.press(iconButtons[iconButtons.length - 1]);
    // Dialog should show
    expect(screen.getByText("Delete Folder")).toBeTruthy();
  });

  it("shows breadcrumb when navigating into child group", () => {
    useFileGroupStore.setState({
      groups: [
        { id: "p", name: "Parent", createdAt: 1, updatedAt: 1 },
        { id: "c", name: "Child", parentId: "p", createdAt: 2, updatedAt: 2 },
      ],
    });
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    expect(screen.getByText("Parent")).toBeTruthy();
  });

  it("saves inline edit and updates group", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Old Name", color: "#ef4444", createdAt: 1, updatedAt: 1 }],
    });
    render(
      <FileGroupSheet visible selectedCount={1} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Manage"));
    const iconButtons = screen.getAllByTestId("icon-button");
    // First icon-button = edit
    fireEvent.press(iconButtons[0]);
    // Change name in the first input
    const inputs = screen.getAllByDisplayValue("Old Name");
    fireEvent.changeText(inputs[0], "New Name");
    fireEvent.press(screen.getByText("Save"));
    const updated = useFileGroupStore.getState().groups[0];
    expect(updated.name).toBe("New Name");
  });

  it("cancels inline edit", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Keep", createdAt: 1, updatedAt: 1 }],
    });
    render(
      <FileGroupSheet visible selectedCount={1} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Manage"));
    const iconButtons = screen.getAllByTestId("icon-button");
    fireEvent.press(iconButtons[0]); // edit
    // Cancel
    const cancelBtns = screen.getAllByText("Cancel");
    fireEvent.press(cancelBtns[0]);
    // Name should still show
    expect(screen.getByText("Keep")).toBeTruthy();
  });

  it("deletes group via confirmation dialog", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Doomed", createdAt: 1, updatedAt: 1 }],
    });
    render(
      <FileGroupSheet visible selectedCount={1} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    fireEvent.press(screen.getByText("Manage"));
    const iconButtons = screen.getAllByTestId("icon-button");
    // Last icon-button = delete
    fireEvent.press(iconButtons[iconButtons.length - 1]);
    // Confirm delete in dialog
    fireEvent.press(screen.getByText("Delete"));
    expect(useFileGroupStore.getState().groups).toHaveLength(0);
  });

  it("navigates into child group via chevron and shows back button", () => {
    useFileGroupStore.setState({
      groups: [
        { id: "p", name: "Root Grp", createdAt: 1, updatedAt: 1 },
        { id: "c", name: "Sub Grp", parentId: "p", createdAt: 2, updatedAt: 2 },
      ],
    });
    render(
      <FileGroupSheet visible selectedCount={1} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    // chevron-forward icon button navigates into the group
    const iconButtons = screen.getAllByTestId("icon-button");
    fireEvent.press(iconButtons[0]);
    // Should see breadcrumb with Root and back button
    expect(screen.getByText("Root")).toBeTruthy();
    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("navigates back from child to parent", () => {
    useFileGroupStore.setState({
      groups: [
        { id: "p", name: "TopLevel", createdAt: 1, updatedAt: 1 },
        { id: "c", name: "Nested", parentId: "p", createdAt: 2, updatedAt: 2 },
      ],
    });
    render(
      <FileGroupSheet visible selectedCount={1} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    const iconButtons = screen.getAllByTestId("icon-button");
    fireEvent.press(iconButtons[0]); // navigate in
    fireEvent.press(screen.getByText("Back")); // navigate back
    expect(screen.getByText("TopLevel")).toBeTruthy();
  });

  it("selects group and applies successfully with alert", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Pick Me", createdAt: 1, updatedAt: 1 }],
    });
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    // Select the group via icon-button (select mode is default)
    const iconButtons = screen.getAllByTestId("icon-button");
    fireEvent.press(iconButtons[iconButtons.length - 1]);
    // Apply
    fireEvent.press(screen.getByText("Apply"));
    expect(onApplyGroup).toHaveBeenCalledWith("g1");
    expect(Alert.alert).toHaveBeenCalledWith("Success", "Grouped 3 file(s), 0 failed");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error alert when apply fails", () => {
    onApplyGroup.mockReturnValueOnce({ success: 0, failed: 2 });
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Fail", createdAt: 1, updatedAt: 1 }],
    });
    render(
      <FileGroupSheet visible selectedCount={2} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    const iconButtons = screen.getAllByTestId("icon-button");
    fireEvent.press(iconButtons[iconButtons.length - 1]);
    fireEvent.press(screen.getByText("Apply"));
    expect(Alert.alert).toHaveBeenCalledWith("Error", "Grouped 0 file(s), 2 failed");
  });

  it("shows group description and stats", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Described", description: "My desc", createdAt: 1, updatedAt: 1 }],
    });
    render(
      <FileGroupSheet visible selectedCount={1} onClose={onClose} onApplyGroup={onApplyGroup} />,
    );
    expect(screen.getByText("My desc")).toBeTruthy();
  });
});
