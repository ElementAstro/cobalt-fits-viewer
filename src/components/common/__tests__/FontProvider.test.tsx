import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { FontProvider, useFontFamily } from "../FontProvider";

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (s: any) => any) =>
    selector({ fontFamily: "system", monoFontFamily: "system-mono" }),
}));

jest.mock("../../../lib/theme/fonts", () => ({
  FONT_FAMILY_PRESETS: {
    system: { regular: undefined, medium: undefined, semibold: undefined, bold: undefined },
    inter: {
      regular: "Inter-Regular",
      medium: "Inter-Medium",
      semibold: "Inter-SemiBold",
      bold: "Inter-Bold",
    },
  },
  MONO_FONT_PRESETS: {
    "system-mono": { regular: undefined, medium: undefined, semibold: undefined, bold: undefined },
    "jetbrains-mono": {
      regular: "JetBrainsMono-Regular",
      medium: "JetBrainsMono-Medium",
      semibold: "JetBrainsMono-SemiBold",
      bold: "JetBrainsMono-Bold",
    },
  },
}));

function TestConsumer() {
  const { fontFamilyKey, monoFontKey, isSystemFont, getFontFamily, getMonoFontFamily } =
    useFontFamily();
  return (
    <>
      <Text testID="fontFamilyKey">{fontFamilyKey}</Text>
      <Text testID="monoFontKey">{monoFontKey}</Text>
      <Text testID="isSystemFont">{String(isSystemFont)}</Text>
      <Text testID="getFontFamily">{String(getFontFamily("bold"))}</Text>
      <Text testID="getMonoFontFamily">{String(getMonoFontFamily("regular"))}</Text>
    </>
  );
}

describe("FontProvider", () => {
  it("provides default system font context", () => {
    render(
      <FontProvider>
        <TestConsumer />
      </FontProvider>,
    );

    expect(screen.getByTestId("fontFamilyKey").props.children).toBe("system");
    expect(screen.getByTestId("monoFontKey").props.children).toBe("system-mono");
    expect(screen.getByTestId("isSystemFont").props.children).toBe("true");
    expect(screen.getByTestId("getFontFamily").props.children).toBe("undefined");
    expect(screen.getByTestId("getMonoFontFamily").props.children).toBe("undefined");
  });
});

describe("useFontFamily", () => {
  it("returns default values when used outside FontProvider", () => {
    render(<TestConsumer />);

    expect(screen.getByTestId("fontFamilyKey").props.children).toBe("system");
    expect(screen.getByTestId("isSystemFont").props.children).toBe("true");
  });
});
