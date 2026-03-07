import { render, screen, waitFor } from "@testing-library/react-native";
import { StorageAnalyticsSheet } from "../StorageAnalyticsSheet";
import { useFileGroupStore } from "../../../stores/files/useFileGroupStore";
import { useFitsStore } from "../../../stores/files/useFitsStore";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "files.storageAnalytics": "Storage Analytics",
        "files.diskUsage": "Disk Usage",
        "files.used": "Used",
        "files.free": "Free",
        "files.byMediaType": "By Media Type",
        "files.byFrameType": "By Frame Type",
        "files.byFolder": "By Folder",
        "files.byMonth": "By Month",
        "files.ungroupedFiles": "Ungrouped",
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
  const { Text, View } = require("react-native");
  const BottomSheet = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;
  const Card = ({ children }: any) => <View>{children}</View>;
  Card.Body = ({ children }: any) => <View>{children}</View>;
  return {
    BottomSheet,
    Card,
    Separator: () => null,
    useThemeColor: () => "#888",
  };
});

jest.mock("../../../lib/utils/fileManager", () => ({
  formatFileSize: (bytes: number) => `${bytes} B`,
}));

jest.mock("../../../lib/gallery/storageAnalytics", () => ({
  analyzeStorage: jest.fn(() => ({
    totalFiles: 3,
    totalSize: 3000,
    byMediaType: [{ type: "fits", count: 2, size: 2000 }],
    byFrameType: [{ type: "light", count: 3, size: 3000 }],
    byMonth: [{ month: "2024-01", count: 3, size: 3000 }],
    byGroup: [],
    ungroupedCount: 3,
    ungroupedSize: 3000,
  })),
  getDiskUsage: jest.fn().mockResolvedValue({ free: 50000 }),
}));

describe("StorageAnalyticsSheet", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useFileGroupStore.setState({ groups: [], fileGroupMap: {} });
    useFitsStore.setState({ files: [] });
  });

  it("renders title when visible", async () => {
    render(<StorageAnalyticsSheet visible onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("Storage Analytics")).toBeTruthy();
    });
  });

  it("does not render when not visible", () => {
    const { toJSON } = render(<StorageAnalyticsSheet visible={false} onClose={onClose} />);
    expect(toJSON()).toBeNull();
  });

  it("renders section titles", async () => {
    render(<StorageAnalyticsSheet visible onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("By Media Type")).toBeTruthy();
      expect(screen.getByText("By Frame Type")).toBeTruthy();
      expect(screen.getByText("By Month")).toBeTruthy();
    });
  });

  it("renders media type breakdown", async () => {
    render(<StorageAnalyticsSheet visible onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText(/FITS/)).toBeTruthy();
    });
  });
});
