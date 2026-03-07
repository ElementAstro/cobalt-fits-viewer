import { render, screen } from "@testing-library/react-native";
import { RecentFilesSection } from "../RecentFilesSection";
import { useFitsStore } from "../../../stores/files/useFitsStore";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "files.recentFiles": "Recent Files",
        "files.today": "Today",
        "files.yesterday": "Yesterday",
        "files.thisWeek": "This Week",
        "files.earlier": "Earlier",
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

jest.mock("../../../lib/gallery/thumbnailCache", () => ({
  resolveThumbnailUri: () => null,
}));

jest.mock("heroui-native", () => {
  const { Pressable, View } = require("react-native");
  const Accordion = ({ children }: any) => <View>{children}</View>;
  Accordion.Item = ({ children }: any) => <View>{children}</View>;
  Accordion.Trigger = ({ children }: any) => <Pressable>{children}</Pressable>;
  Accordion.Indicator = () => null;
  Accordion.Content = ({ children }: any) => <View>{children}</View>;
  const Card = ({ children }: any) => <View>{children}</View>;
  Card.Body = ({ children }: any) => <View>{children}</View>;
  return {
    Accordion,
    Card,
    useThemeColor: () => "#888",
  };
});

jest.mock("expo-image", () => ({
  Image: () => null,
}));

describe("RecentFilesSection", () => {
  const onFilePress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useFitsStore.setState({ files: [] });
  });

  it("returns null when no recent files", () => {
    const { toJSON } = render(<RecentFilesSection onFilePress={onFilePress} />);
    expect(toJSON()).toBeNull();
  });

  it("renders section title when files exist", () => {
    const now = Date.now();
    useFitsStore.setState({
      files: [
        {
          id: "f1",
          filename: "test.fits",
          filepath: "/tmp/test.fits",
          fileSize: 1024,
          importDate: now - 1000,
          lastViewed: now,
          frameType: "light",
          isFavorite: false,
          tags: [],
          albumIds: [],
        } as any,
      ],
    });
    render(<RecentFilesSection onFilePress={onFilePress} />);
    expect(screen.getByText("Recent Files")).toBeTruthy();
  });

  it("renders file names", () => {
    const now = Date.now();
    useFitsStore.setState({
      files: [
        {
          id: "f1",
          filename: "m42_ha.fits",
          filepath: "/tmp/m42_ha.fits",
          fileSize: 1024,
          importDate: now - 1000,
          lastViewed: now,
          frameType: "light",
          isFavorite: false,
          tags: [],
          albumIds: [],
        } as any,
      ],
    });
    render(<RecentFilesSection onFilePress={onFilePress} />);
    expect(screen.getByText("m42_ha.fits")).toBeTruthy();
  });
});
