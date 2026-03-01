import { render, screen } from "@testing-library/react-native";
import { FormatSelector } from "../FormatSelector";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

let capturedOnValueChange: ((val: string) => void) | undefined;
let mockSelectedValue: string | undefined;

jest.mock("heroui-native", () => {
  const React = require("react");
  const { View } = require("react-native");

  const RadioGroup = ({ children, onValueChange, value, ...rest }: any) => {
    capturedOnValueChange = onValueChange;
    mockSelectedValue = value;
    return (
      <View {...rest} testID="radio-group" accessibilityValue={{ text: value }}>
        {children}
      </View>
    );
  };
  RadioGroup.Item = ({ children, value }: any) => {
    const isSelected = value === mockSelectedValue;
    const rendered = typeof children === "function" ? children({ isSelected }) : children;
    return <View testID={`radio-item-${value}`}>{rendered}</View>;
  };

  const Card = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;
  Card.Body = ({ children, ...rest }: any) => <View {...rest}>{children}</View>;

  return {
    Card,
    RadioGroup,
    useThemeColor: () => ["#0f0", "#999"],
  };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, ...rest }: any) => <Text {...rest}>{name}</Text>,
  };
});

describe("FormatSelector", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnValueChange = undefined;
    mockSelectedValue = undefined;
  });

  it("renders all 8 format options", () => {
    render(<FormatSelector selected="png" onSelect={onSelect} />);
    const formats = ["png", "jpeg", "webp", "tiff", "bmp", "fits", "xisf", "ser"];
    for (const fmt of formats) {
      expect(screen.getByTestId(`radio-item-${fmt}`)).toBeTruthy();
    }
  });

  it("each option has e2e testID", () => {
    render(<FormatSelector selected="png" onSelect={onSelect} />);
    const formats = ["png", "jpeg", "webp", "tiff", "bmp", "fits", "xisf", "ser"];
    for (const fmt of formats) {
      expect(screen.getByTestId(`e2e-action-format-selector-${fmt}`)).toBeTruthy();
    }
  });

  it("calls onSelect with valid format key", () => {
    render(<FormatSelector selected="png" onSelect={onSelect} />);
    expect(capturedOnValueChange).toBeDefined();
    capturedOnValueChange!("jpeg");
    expect(onSelect).toHaveBeenCalledWith("jpeg");
  });

  it("does not call onSelect with invalid format value", () => {
    render(<FormatSelector selected="png" onSelect={onSelect} />);
    expect(capturedOnValueChange).toBeDefined();
    capturedOnValueChange!("invalid-format");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders format labels", () => {
    render(<FormatSelector selected="png" onSelect={onSelect} />);
    expect(screen.getByText("PNG")).toBeTruthy();
    expect(screen.getByText("JPEG")).toBeTruthy();
    expect(screen.getByText("WebP")).toBeTruthy();
    expect(screen.getByText("TIFF")).toBeTruthy();
    expect(screen.getByText("BMP")).toBeTruthy();
    expect(screen.getByText("FITS")).toBeTruthy();
    expect(screen.getByText("XISF")).toBeTruthy();
    expect(screen.getByText("SER")).toBeTruthy();
  });

  it("renders description keys for each option", () => {
    render(<FormatSelector selected="png" onSelect={onSelect} />);
    const descKeys = [
      "converter.fmtPngDesc",
      "converter.fmtJpegDesc",
      "converter.fmtWebpDesc",
      "converter.fmtTiffDesc",
      "converter.fmtBmpDesc",
      "converter.fmtFitsDesc",
      "converter.fmtXisfDesc",
      "converter.fmtSerDesc",
    ];
    for (const key of descKeys) {
      expect(screen.getByText(key)).toBeTruthy();
    }
  });

  it("selected card renders success border class and checkmark icon", () => {
    const { toJSON } = render(<FormatSelector selected="jpeg" onSelect={onSelect} />);
    const tree = JSON.stringify(toJSON());
    // The selected card (jpeg) should have the success border class
    expect(tree).toContain("border border-success");
    // The checkmark icon should render for the selected item
    expect(tree).toContain("checkmark-circle");
  });

  it("selected card renders success background class", () => {
    const { toJSON } = render(<FormatSelector selected="webp" onSelect={onSelect} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("bg-success/20");
  });

  it("non-selected cards do not render checkmark or success border", () => {
    render(<FormatSelector selected="png" onSelect={onSelect} />);
    // Only the selected item (png) should have the checkmark; others should not
    // Check a non-selected item's testID card does not have success border
    const jpegCard = screen.getByTestId("e2e-action-format-selector-jpeg");
    const jpegClassName = jpegCard.props.className || "";
    expect(jpegClassName).not.toContain("border border-success");
  });

  it("non-selected cards have surface-secondary background", () => {
    const { toJSON } = render(<FormatSelector selected="png" onSelect={onSelect} />);
    const tree = JSON.stringify(toJSON());
    // Non-selected items should have bg-surface-secondary
    expect(tree).toContain("bg-surface-secondary");
  });
});
