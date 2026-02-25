import { fireEvent, render, screen } from "@testing-library/react-native";
import { BatchTaskItem } from "../BatchTaskItem";
import type { BatchTask } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const Button = ({ onPress, children, ...rest }: any) => (
    <Pressable onPress={onPress} {...rest}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children, ...rest }: any) => <Text {...rest}>{children}</Text>;

  const Card = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;
  Card.Body = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;

  const Chip = ({ children }: any) => <View>{children}</View>;
  Chip.Label = ({ children, ...rest }: any) => <Text {...rest}>{children}</Text>;

  return { Button, Card, Chip };
});

const makeTask = (overrides: Partial<BatchTask> = {}): BatchTask => ({
  id: "task-1",
  type: "convert",
  status: "pending",
  progress: 0,
  total: 10,
  completed: 0,
  failed: 0,
  createdAt: Date.now(),
  ...overrides,
});

describe("BatchTaskItem", () => {
  it("renders task type and progress count", () => {
    render(<BatchTaskItem task={makeTask({ completed: 3, total: 10 })} />);
    expect(screen.getByText("3/10")).toBeTruthy();
    expect(screen.getByText("convert")).toBeTruthy();
  });

  it("renders status chip for each status", () => {
    const statuses: BatchTask["status"][] = [
      "pending",
      "running",
      "completed",
      "failed",
      "cancelled",
    ];
    for (const status of statuses) {
      const { unmount } = render(<BatchTaskItem task={makeTask({ status })} />);
      expect(screen.getByText(`common.${status}`)).toBeTruthy();
      unmount();
    }
  });

  it("shows failed count when task has failures", () => {
    render(<BatchTaskItem task={makeTask({ completed: 5, total: 10, failed: 2 })} />);
    expect(screen.getByTestId("e2e-text-batch-task-summary").props.children).toContain(
      " (2 failed)",
    );
  });

  it("shows skipped count when task has skipped items", () => {
    render(<BatchTaskItem task={makeTask({ completed: 5, total: 10, skipped: 3 })} />);
    expect(screen.getByTestId("e2e-text-batch-task-summary").props.children).toContain(
      " (3 skipped)",
    );
  });

  it("shows cancel button only when running with onCancel provided", () => {
    const onCancel = jest.fn();
    render(<BatchTaskItem task={makeTask({ status: "running" })} onCancel={onCancel} />);
    const cancelBtn = screen.getByText("common.cancel");
    expect(cancelBtn).toBeTruthy();
    fireEvent.press(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not show cancel button when status is not running", () => {
    render(<BatchTaskItem task={makeTask({ status: "pending" })} onCancel={jest.fn()} />);
    expect(screen.queryByText("common.cancel")).toBeNull();
  });

  it("shows retry button only when failed with onRetry provided", () => {
    const onRetry = jest.fn();
    render(<BatchTaskItem task={makeTask({ status: "failed" })} onRetry={onRetry} />);
    const retryBtn = screen.getByText("common.retry");
    expect(retryBtn).toBeTruthy();
    fireEvent.press(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not show retry button when status is not failed", () => {
    render(<BatchTaskItem task={makeTask({ status: "completed" })} onRetry={jest.fn()} />);
    expect(screen.queryByText("common.retry")).toBeNull();
  });

  it("hides action buttons for completed, pending, and cancelled statuses", () => {
    for (const status of ["completed", "pending", "cancelled"] as BatchTask["status"][]) {
      const { unmount } = render(
        <BatchTaskItem task={makeTask({ status })} onCancel={jest.fn()} onRetry={jest.fn()} />,
      );
      expect(screen.queryByText("common.cancel")).toBeNull();
      expect(screen.queryByText("common.retry")).toBeNull();
      unmount();
    }
  });

  it("displays error text when task.error is set", () => {
    render(<BatchTaskItem task={makeTask({ error: "Something went wrong" })} />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("does not display error text when task.error is undefined", () => {
    render(<BatchTaskItem task={makeTask()} />);
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("renders progress bar with correct width style", () => {
    const { toJSON } = render(<BatchTaskItem task={makeTask({ progress: 75 })} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"width":"75%"');
  });
});
