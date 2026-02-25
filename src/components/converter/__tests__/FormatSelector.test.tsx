import { render, screen } from "@testing-library/react-native";
import { FormatSelector } from "../FormatSelector";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

let capturedOnValueChange: ((val: string) => void) | undefined;

jest.mock("heroui-native", () => {
  const React = require("react");
  const { View } = require("react-native");

  const RadioGroup = ({ children, onValueChange, value, ...rest }: any) => {
    capturedOnValueChange = onValueChange;
    return (
      <View {...rest} testID="radio-group" accessibilityValue={{ text: value }}>
        {children}
      </View>
    );
  };
  RadioGroup.Item = ({ children, value }: any) => {
    const rendered = typeof children === "function" ? children({ isSelected: false }) : children;
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
    expect(screen.getByText("converter.fmtPngDesc")).toBeTruthy();
    expect(screen.getByText("converter.fmtJpegDesc")).toBeTruthy();
  });
});
