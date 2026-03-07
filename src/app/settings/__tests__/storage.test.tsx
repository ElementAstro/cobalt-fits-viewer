import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import Screen from "../storage";

const mockPush = jest.fn();
const mockNotify = jest.fn();
const mockUpdateFile = jest.fn();
const mockBatchUpdateFiles = jest.fn();
const mockSetThumbnailCacheMaxSizeMB = jest.fn();
const mockClearCache = jest.fn();
const mockRegenerateThumbnails = jest.fn();
const mockPruneThumbnailCacheWithPolicy = jest.fn();
const mockRefreshStorageStats = jest.fn();
const mockClearExportCache = jest.fn();
const mockClearVideoCache = jest.fn();
const mockClearPixelCache = jest.fn();
const mockClearCompletedAstrometryJobs = jest.fn();
const mockClearAllAstrometryJobs = jest.fn();

let mockFiles = [
  { id: "f1", filename: "a.fits", filepath: "/tmp/a.fits", fileSize: 10 },
  { id: "f2", filename: "b.fits", filepath: "/tmp/b.fits", fileSize: 12 },
] as any[];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: {
    Warning: "warning",
    Success: "success",
  },
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../hooks/common/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({ contentPaddingTop: 0, horizontalPadding: 0 }),
}));

jest.mock("../../../hooks/common/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ notify: mockNotify }),
}));

jest.mock("../../../components/settings", () => ({
  SettingsHeader: ({ title }: { title: string }) => {
    const { Text } = require("react-native");
    return <Text>{title}</Text>;
  },
  SettingsSection: ({ title, children }: { title: string; children: any }) => {
    const { Text, View } = require("react-native");
    return (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));

jest.mock("../../../components/common/SettingsRow", () => ({
  SettingsRow: ({
    label,
    value,
    onPress,
    testID,
  }: {
    label: string;
    value?: string;
    onPress?: () => void;
    testID?: string;
  }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID={testID ?? `settings-row-${label}`} onPress={onPress}>
        <Text>{label}</Text>
        {value != null ? <Text>{value}</Text> : null}
      </Pressable>
    );
  },
}));

jest.mock("../../../components/common/SettingsSliderRow", () => ({
  SettingsSliderRow: ({
    label,
    value,
    onValueChange,
    testID,
  }: {
    label: string;
    value: number;
    onValueChange: (value: number) => void;
    testID?: string;
  }) => {
    const { Pressable, Text, View } = require("react-native");
    return (
      <View>
        <Text>{label}</Text>
        <Text testID={testID}>{value}</Text>
        <Pressable
          testID={`${testID}__change`}
          onPress={() => {
            onValueChange(350);
          }}
        />
      </View>
    );
  },
}));

jest.mock("heroui-native", () => ({
  Separator: () => {
    const { View } = require("react-native");
    return <View />;
  },
}));

jest.mock("../../../stores/files/useFitsStore", () => ({
  useFitsStore: (selector: (state: any) => unknown) =>
    selector({
      files: mockFiles,
      updateFile: mockUpdateFile,
      batchUpdateFiles: mockBatchUpdateFiles,
    }),
}));

jest.mock("../../../stores/app/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: any) => unknown) =>
    selector({
      confirmDestructiveActions: false,
      thumbnailCacheMaxSizeMB: 200,
      setThumbnailCacheMaxSizeMB: mockSetThumbnailCacheMaxSizeMB,
    }),
}));

jest.mock("../../../stores/processing/useAstrometryStore", () => ({
  useAstrometryStore: (selector: (state: any) => unknown) =>
    selector({
      config: { apiKey: "" },
      jobs: [],
      clearCompletedJobs: mockClearCompletedAstrometryJobs,
      clearAllJobs: mockClearAllAstrometryJobs,
    }),
}));

jest.mock("../../../stores/processing/useVideoTaskStore", () => ({
  useVideoTaskStore: (selector: (state: any) => unknown) =>
    selector({
      tasks: [],
    }),
}));

jest.mock("../../../hooks/gallery/useThumbnail", () => ({
  useThumbnail: () => ({
    clearCache: mockClearCache,
    regenerateThumbnails: mockRegenerateThumbnails,
    isGenerating: false,
    regenerateProgress: null,
  }),
}));

jest.mock("../../../lib/gallery/thumbnailWorkflow", () => ({
  pruneThumbnailCacheWithPolicy: (...args: unknown[]) => mockPruneThumbnailCacheWithPolicy(...args),
}));

jest.mock("../../../hooks/common/useStorageStats", () => ({
  useStorageStats: () => ({
    breakdown: {
      filesTotalBytes: 22,
      trashCount: 0,
      trashTotalBytes: 0,
      thumbnailCacheBytes: 128,
      videoCacheBytes: 0,
      exportCacheBytes: 0,
      exportCacheFileCount: 0,
      pixelCacheEntries: 0,
      pixelCacheBytes: 0,
      imageLoadCacheEntries: 0,
      imageLoadCacheBytes: 0,
      runtimeDiskCacheEntries: 0,
      runtimeDiskCacheBytes: 0,
      freeDiskBytes: null,
    },
    refresh: mockRefreshStorageStats,
    clearExportCache: mockClearExportCache,
    clearVideoCache: mockClearVideoCache,
    clearPixelCache: mockClearPixelCache,
  }),
}));

jest.mock("../../../lib/utils/fileSystemIntegrity", () => ({
  checkAndRepairFileSystemIntegrity: () => ({
    repairedGhosts: 0,
    repairedOrphans: 0,
    repairedTrashGhosts: 0,
  }),
}));

describe("settings/storage.tsx route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFiles = [
      { id: "f1", filename: "a.fits", filepath: "/tmp/a.fits", fileSize: 10 },
      { id: "f2", filename: "b.fits", filepath: "/tmp/b.fits", fileSize: 12 },
    ];
    mockRegenerateThumbnails.mockResolvedValue({ success: 0, skipped: 0, results: [] });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders thumbnail cache size slider", () => {
    render(<Screen />);

    expect(
      screen.getByTestId("e2e-action-settings__storage-slider-thumbnail-cache-size"),
    ).toBeTruthy();
  });

  it("applies thumbnail slider changes immediately via set + prune + refresh", () => {
    render(<Screen />);

    fireEvent.press(
      screen.getByTestId("e2e-action-settings__storage-slider-thumbnail-cache-size__change"),
    );

    expect(mockSetThumbnailCacheMaxSizeMB).toHaveBeenCalledWith(350);
    expect(mockPruneThumbnailCacheWithPolicy).toHaveBeenCalledWith(
      { thumbnailCacheMaxSizeMB: 350 },
      { force: true },
    );
    expect(mockRefreshStorageStats).toHaveBeenCalledTimes(1);
  });

  it("uses batchUpdateFiles and clears all cache types via unified clear action", () => {
    render(<Screen />);

    fireEvent.press(screen.getByTestId("settings-row-settings.clearCache"));

    expect(mockClearCache).toHaveBeenCalledTimes(1);
    expect(mockClearExportCache).toHaveBeenCalledTimes(1);
    expect(mockClearVideoCache).toHaveBeenCalledTimes(1);
    expect(mockClearPixelCache).toHaveBeenCalledTimes(1);
    expect(mockBatchUpdateFiles).toHaveBeenCalledWith(["f1", "f2"], { thumbnailUri: undefined });
    expect(mockUpdateFile).not.toHaveBeenCalledWith(expect.anything(), {
      thumbnailUri: undefined,
    });
  });
});
