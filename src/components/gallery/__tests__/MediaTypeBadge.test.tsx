import { render, screen } from "@testing-library/react-native";
import { MediaTypeBadge } from "../MediaTypeBadge";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, size }: { name: string; size: number }) =>
      React.createElement(Text, { testID: `icon-${name}` }, `${name}:${size}`),
  };
});

describe("MediaTypeBadge", () => {
  it("renders play icon for video", () => {
    render(<MediaTypeBadge mediaKind="video" duration="5s" />);

    expect(screen.getByTestId("icon-play")).toBeTruthy();
    expect(screen.getByText("5s")).toBeTruthy();
  });

  it("renders musical-note icon for audio", () => {
    render(<MediaTypeBadge mediaKind="audio" duration="3s" />);

    expect(screen.getByTestId("icon-musical-note")).toBeTruthy();
    expect(screen.getByText("3s")).toBeTruthy();
  });

  it("hides duration when showDuration is false", () => {
    render(<MediaTypeBadge mediaKind="video" duration="5s" showDuration={false} />);

    expect(screen.getByTestId("icon-play")).toBeTruthy();
    expect(screen.queryByText("5s")).toBeNull();
  });

  it("hides duration badge when duration is empty", () => {
    render(<MediaTypeBadge mediaKind="video" duration="" />);

    expect(screen.getByTestId("icon-play")).toBeTruthy();
    expect(screen.queryByText(/\ds/)).toBeNull();
  });

  it("hides duration badge when duration is undefined", () => {
    render(<MediaTypeBadge mediaKind="audio" />);

    expect(screen.getByTestId("icon-musical-note")).toBeTruthy();
  });

  it("defaults iconPosition to bottom-right", () => {
    const { toJSON } = render(<MediaTypeBadge mediaKind="video" duration="2s" />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain("bottom-1 right-1");
    expect(json).not.toContain("top-1");
  });

  it("supports iconPosition top-right", () => {
    const { toJSON } = render(
      <MediaTypeBadge mediaKind="video" duration="2s" iconPosition="top-right" />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain("right-1 top-1");
  });
});
