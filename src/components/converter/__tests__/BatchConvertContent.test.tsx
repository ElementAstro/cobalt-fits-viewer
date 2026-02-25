import { fireEvent, render, screen } from "@testing-library/react-native";
import { BatchConvertContent } from "../BatchConvertContent";
import type { BatchTask } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const mockStartBatchConvert = jest.fn();
const mockCancelTask = jest.fn();
const mockRetryTask = jest.fn();
const mockClearCompletedTasks = jest.fn();
let mockBatchTasks: BatchTask[] = [];

jest.mock("../../../hooks/useConverter", () => ({
  useConverter: () => ({
    batchTasks: mockBatchTasks,
    startBatchConvert: mockStartBatchConvert,
    cancelTask: mockCancelTask,
    retryTask: mockRetryTask,
    clearCompletedTasks: mockClearCompletedTasks,
  }),
}));

let mockFiles: Array<{
  id: string;
  filepath: string;
  filename: string;
  sourceType?: string;
  mediaKind?: string;
}> = [];
let mockSelectedIds: string[] = [];

jest.mock("../../../stores/useFitsStore", () => ({
  useFitsStore: (selector: (state: unknown) => unknown) =>
    selector({
      files: mockFiles,
      selectedIds: mockSelectedIds,
    }),
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");

  const Button = ({ onPress, children, testID, ...rest }: any) => (
    <Pressable onPress={onPress} testID={testID} {...rest}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    Button,
    useThemeColor: () => "#999",
  };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: any) => <Text>{name}</Text>,
  };
});

jest.mock("../BatchTaskItem", () => {
  const { Text, View } = require("react-native");
  return {
    BatchTaskItem: ({ task }: any) => (
      <View testID={`task-item-${task.id}`}>
        <Text>{task.status}</Text>
      </View>
    ),
  };
});

jest.mock("../../common/EmptyState", () => {
  const { Text, View } = require("react-native");
  return {
    EmptyState: ({ title }: any) => (
      <View testID="empty-state">
        <Text>{title}</Text>
      </View>
    ),
  };
});

const makeTask = (overrides: Partial<BatchTask> = {}): BatchTask => ({
  id: `task-${Math.random().toString(36).slice(2, 8)}`,
  type: "convert",
  status: "pending",
  progress: 0,
  total: 10,
  completed: 0,
  failed: 0,
  createdAt: Date.now(),
  ...overrides,
});

describe("BatchConvertContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchTasks = [];
    mockFiles = [];
    mockSelectedIds = [];
  });

  it("renders empty state when batchTasks is empty", () => {
    render(<BatchConvertContent />);
    expect(screen.getByTestId("empty-state")).toBeTruthy();
    expect(screen.getByText("common.noData")).toBeTruthy();
  });

  it("renders task items when batchTasks is non-empty", () => {
    mockBatchTasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    render(<BatchConvertContent />);
    expect(screen.getByTestId("task-item-t1")).toBeTruthy();
    expect(screen.getByTestId("task-item-t2")).toBeTruthy();
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });

  it("convert button shows selected count when selectedIds is non-empty", () => {
    mockFiles = [
      { id: "f1", filepath: "/tmp/a.fits", filename: "a.fits" },
      { id: "f2", filepath: "/tmp/b.fits", filename: "b.fits" },
    ];
    mockSelectedIds = ["f1"];
    render(<BatchConvertContent />);
    expect(screen.getByText("converter.convert (1)")).toBeTruthy();
  });

  it("convert button uses default label when no files selected", () => {
    mockFiles = [{ id: "f1", filepath: "/tmp/a.fits", filename: "a.fits" }];
    mockSelectedIds = [];
    render(<BatchConvertContent />);
    expect(screen.getByText("converter.convert")).toBeTruthy();
  });

  it("calls startBatchConvert on convert button press with all files when none selected", () => {
    mockFiles = [
      { id: "f1", filepath: "/tmp/a.fits", filename: "a.fits" },
      { id: "f2", filepath: "/tmp/b.fits", filename: "b.fits" },
    ];
    mockSelectedIds = [];
    render(<BatchConvertContent />);
    fireEvent.press(screen.getByTestId("e2e-action-convert__batch-start"));
    expect(mockStartBatchConvert).toHaveBeenCalledTimes(1);
    expect(mockStartBatchConvert.mock.calls[0][0]).toHaveLength(2);
  });

  it("calls startBatchConvert with only selected files when selectedIds is set", () => {
    mockFiles = [
      { id: "f1", filepath: "/tmp/a.fits", filename: "a.fits" },
      { id: "f2", filepath: "/tmp/b.fits", filename: "b.fits" },
    ];
    mockSelectedIds = ["f1"];
    render(<BatchConvertContent />);
    fireEvent.press(screen.getByTestId("e2e-action-convert__batch-start"));
    expect(mockStartBatchConvert).toHaveBeenCalledTimes(1);
    expect(mockStartBatchConvert.mock.calls[0][0]).toHaveLength(1);
    expect(mockStartBatchConvert.mock.calls[0][0][0].id).toBe("f1");
  });

  it("does not call startBatchConvert when no files available", () => {
    mockFiles = [];
    mockSelectedIds = [];
    render(<BatchConvertContent />);
    fireEvent.press(screen.getByTestId("e2e-action-convert__batch-start"));
    expect(mockStartBatchConvert).not.toHaveBeenCalled();
  });

  it("shows clear button when completed/failed tasks exist", () => {
    mockBatchTasks = [makeTask({ id: "t1", status: "completed" })];
    render(<BatchConvertContent />);
    // There should be a clear (trash) button visible
    const buttons = screen.getAllByText("trash-outline");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("hides clear button when no completed/failed tasks exist", () => {
    mockBatchTasks = [makeTask({ id: "t1", status: "running" })];
    const { toJSON } = render(<BatchConvertContent />);
    // The trash-outline icon for clear button should not be present outside the stats row
    const tree = JSON.stringify(toJSON());
    // Stats row always has layers-outline, clear button adds a second button with trash-outline
    // With only running tasks, completedCount is 0 so the clear button is hidden
    const trashCount = (tree.match(/trash-outline/g) || []).length;
    expect(trashCount).toBe(0);
  });

  it("stats row shows queue count and files available text", () => {
    mockBatchTasks = [makeTask(), makeTask()];
    mockFiles = [
      { id: "f1", filepath: "/tmp/a.fits", filename: "a.fits" },
      { id: "f2", filepath: "/tmp/b.fits", filename: "b.fits" },
      { id: "f3", filepath: "/tmp/c.fits", filename: "c.fits" },
    ];
    render(<BatchConvertContent />);
    // Queue count label
    expect(screen.getByText("converter.queue (2)")).toBeTruthy();
  });
});
