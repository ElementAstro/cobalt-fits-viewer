jest.mock("@expo-google-fonts/inter", () => ({
  Inter_400Regular: "Inter_400Regular_mock",
  Inter_500Medium: "Inter_500Medium_mock",
  Inter_600SemiBold: "Inter_600SemiBold_mock",
  Inter_700Bold: "Inter_700Bold_mock",
}));

jest.mock("@expo-google-fonts/space-grotesk", () => ({
  SpaceGrotesk_400Regular: "SpaceGrotesk_400Regular_mock",
  SpaceGrotesk_500Medium: "SpaceGrotesk_500Medium_mock",
  SpaceGrotesk_600SemiBold: "SpaceGrotesk_600SemiBold_mock",
  SpaceGrotesk_700Bold: "SpaceGrotesk_700Bold_mock",
}));

jest.mock("@expo-google-fonts/jetbrains-mono", () => ({
  JetBrainsMono_400Regular: "JetBrainsMono_400Regular_mock",
  JetBrainsMono_500Medium: "JetBrainsMono_500Medium_mock",
  JetBrainsMono_600SemiBold: "JetBrainsMono_600SemiBold_mock",
  JetBrainsMono_700Bold: "JetBrainsMono_700Bold_mock",
}));

import {
  FONT_FAMILY_KEYS,
  FONT_FAMILY_PRESETS,
  FONT_LOAD_MAP,
  MONO_FONT_KEYS,
  MONO_FONT_PRESETS,
} from "../fonts";

describe("theme fonts", () => {
  it("contains expected family keys and presets", () => {
    expect(FONT_FAMILY_KEYS).toEqual(["system", "inter", "space-grotesk"]);
    expect(MONO_FONT_KEYS).toEqual(["system-mono", "jetbrains-mono"]);
    expect(FONT_FAMILY_PRESETS.inter.bold).toBe("Inter_700Bold");
    expect(MONO_FONT_PRESETS["jetbrains-mono"].regular).toBe("JetBrainsMono_400Regular");
  });

  it("provides localized labels", () => {
    expect(FONT_FAMILY_PRESETS.system.label.zh).toBe("系统默认");
    expect(MONO_FONT_PRESETS["system-mono"].label.en).toBe("System Mono");
  });

  it("contains all font load map entries", () => {
    const keys = Object.keys(FONT_LOAD_MAP);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Inter_400Regular",
        "Inter_500Medium",
        "Inter_600SemiBold",
        "Inter_700Bold",
        "SpaceGrotesk_400Regular",
        "SpaceGrotesk_500Medium",
        "SpaceGrotesk_600SemiBold",
        "SpaceGrotesk_700Bold",
        "JetBrainsMono_400Regular",
        "JetBrainsMono_500Medium",
        "JetBrainsMono_600SemiBold",
        "JetBrainsMono_700Bold",
      ]),
    );
    expect(keys).toHaveLength(12);
  });
});
