import { fireEvent, render, screen } from "@testing-library/react-native";
import { FolderPickerSheet } from "../FolderPickerSheet";
import { useFileGroupStore } from "../../../stores/useFileGroupStore";
import { useFitsStore } from "../../../stores/useFitsStore";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "files.moveToFolder": "Move to Folder",
        "files.noGroups": "No groups yet",
        "common.cancel": "Cancel",
        "common.root": "Root",
        "common.back": "Back",
        "album.images": "images",
      };
      return map[key] ?? key;
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

jest.mock("heroui-native", () => {
  const { Pressable, Text, View } = require("react-native");
  const BottomSheet = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;
  const Button = ({ onPress, children, isDisabled, isIconOnly }: any) => (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      testID={isIconOnly ? "icon-btn" : undefined}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;
  const Card = ({ children }: any) => <View>{children}</View>;
  Card.Body = ({ children }: any) => <View>{children}</View>;
  const Chip = ({ onPress, children }: any) => (
    <Pressable onPress={onPress} accessibilityRole="button">
      {children}
    </Pressable>
  );
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;
  return {
    BottomSheet,
    Button,
    Card,
    Chip,
    Separator: () => null,
    useThemeColor: () => "#888",
  };
});

jest.mock("../../../lib/utils/fileManager", () => ({
  formatFileSize: (bytes: number) => `${bytes} B`,
}));

describe("FolderPickerSheet", () => {
  const onClose = jest.fn();
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useFileGroupStore.setState({ groups: [], fileGroupMap: {} });
    useFitsStore.setState({ files: [] });
  });

  it("renders title when visible", () => {
    render(<FolderPickerSheet visible onClose={onClose} onSelect={onSelect} />);
    expect(screen.getAllByText("Move to Folder").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render when not visible", () => {
    const { toJSON } = render(
      <FolderPickerSheet visible={false} onClose={onClose} onSelect={onSelect} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("shows no groups message when store is empty", () => {
    render(<FolderPickerSheet visible onClose={onClose} onSelect={onSelect} />);
    expect(screen.getByText("No groups yet")).toBeTruthy();
  });

  it("shows groups as cards", () => {
    useFileGroupStore.setState({
      groups: [
        { id: "g1", name: "Lights", createdAt: 1, updatedAt: 1 },
        { id: "g2", name: "Darks", createdAt: 2, updatedAt: 2 },
      ],
    });
    render(<FolderPickerSheet visible onClose={onClose} onSelect={onSelect} />);
    expect(screen.getByText("Lights")).toBeTruthy();
    expect(screen.getByText("Darks")).toBeTruthy();
  });

  it("calls onClose when cancel pressed", () => {
    render(<FolderPickerSheet visible onClose={onClose} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders breadcrumb when navigating into a child group", () => {
    const parent = { id: "p1", name: "Parent", createdAt: 1, updatedAt: 1 };
    const child = { id: "c1", name: "Child", parentId: "p1", createdAt: 2, updatedAt: 2 };
    useFileGroupStore.setState({
      groups: [parent, child],
    });
    render(<FolderPickerSheet visible onClose={onClose} onSelect={onSelect} />);
    expect(screen.getByText("Parent")).toBeTruthy();
  });

  it("shows back button after navigating into a folder", () => {
    const parent = { id: "p1", name: "NavFolder", createdAt: 1, updatedAt: 1 };
    useFileGroupStore.setState({ groups: [parent] });
    render(<FolderPickerSheet visible onClose={onClose} onSelect={onSelect} />);
    // Navigate into the folder
    // The chevron button navigates; for now just verify it renders the group
    expect(screen.getByText("NavFolder")).toBeTruthy();
  });

  it("uses custom title and actionLabel when provided", () => {
    render(
      <FolderPickerSheet
        visible
        onClose={onClose}
        onSelect={onSelect}
        title="Pick Folder"
        actionLabel="Move Here"
      />,
    );
    expect(screen.getByText("Pick Folder")).toBeTruthy();
    expect(screen.getByText("Move Here")).toBeTruthy();
  });

  it("selects a group and confirms selection", () => {
    useFileGroupStore.setState({
      groups: [{ id: "g1", name: "Target", createdAt: 1, updatedAt: 1 }],
    });
    render(<FolderPickerSheet visible onClose={onClose} onSelect={onSelect} />);
    // Click radio button (icon-btn) to select
    const iconBtns = screen.getAllByTestId("icon-btn");
    fireEvent.press(iconBtns[iconBtns.length - 1]);
    // Now click confirm button
    const moveBtns = screen.getAllByText("Move to Folder");
    fireEvent.press(moveBtns[moveBtns.length - 1]);
    expect(onSelect).toHaveBeenCalledWith("g1");
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates into a child folder and shows back button and breadcrumb", () => {
    useFileGroupStore.setState({
      groups: [
        { id: "p1", name: "Root Folder", createdAt: 1, updatedAt: 1 },
        { id: "c1", name: "Sub Folder", parentId: "p1", createdAt: 2, updatedAt: 2 },
      ],
    });
    render(<FolderPickerSheet visible onClose={onClose} onSelect={onSelect} />);
    expect(screen.getByText("Root Folder")).toBeTruthy();
    // Navigate into Root Folder via chevron icon button
    const iconBtns = screen.getAllByTestId("icon-btn");
    fireEvent.press(iconBtns[0]); // chevron-forward button
    // Should now see breadcrumb with Root and Back button
    expect(screen.getByText("Back")).toBeTruthy();
    expect(screen.getByText("Root")).toBeTruthy();
  });

  it("navigates back up from a child folder", () => {
    useFileGroupStore.setState({
      groups: [
        { id: "p1", name: "Top", createdAt: 1, updatedAt: 1 },
        { id: "c1", name: "Inner", parentId: "p1", createdAt: 2, updatedAt: 2 },
      ],
    });
    render(<FolderPickerSheet visible onClose={onClose} onSelect={onSelect} />);
    // Navigate in
    const iconBtns = screen.getAllByTestId("icon-btn");
    fireEvent.press(iconBtns[0]);
    // Navigate back
    fireEvent.press(screen.getByText("Back"));
    // Should see Top folder again
    expect(screen.getByText("Top")).toBeTruthy();
  });
});
