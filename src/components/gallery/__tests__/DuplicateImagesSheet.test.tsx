import { fireEvent, render, screen } from "@testing-library/react-native";
import { DuplicateImagesSheet } from "../DuplicateImagesSheet";
import type { DuplicateImageInfo, FitsMetadata } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "album.duplicateImages": "Duplicate Images",
          "album.noDuplicates": "No duplicates found",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const BottomSheet = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;

  const Button = ({ onPress, children }: any) => (
    <Pressable onPress={onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  const Chip = ({ children }: any) => <View>{children}</View>;
  Chip.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    BottomSheet,
    Button,
    Chip,
    useThemeColor: () => ["#999", "#0f0"],
  };
});

const makeFile = (id: string, overrides: Partial<FitsMetadata> = {}): FitsMetadata => ({
  id,
  filename: `${id}.fits`,
  filepath: `file:///tmp/${id}.fits`,
  fileSize: 1024,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
  ...overrides,
});

describe("DuplicateImagesSheet", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows no duplicates message when list is empty", () => {
    render(<DuplicateImagesSheet visible duplicates={[]} files={[]} onClose={onClose} />);

    expect(screen.getByText("No duplicates found")).toBeTruthy();
  });

  it("renders duplicate image filenames", () => {
    const files = [makeFile("f1", { filename: "M42.fits" })];
    const duplicates: DuplicateImageInfo[] = [
      { imageId: "f1", albumIds: ["a1", "a2"], albumNames: ["Orion", "Deep Sky"] },
    ];

    render(
      <DuplicateImagesSheet visible duplicates={duplicates} files={files} onClose={onClose} />,
    );

    expect(screen.getByText("M42.fits")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("renders album name chips for each duplicate", () => {
    const files = [makeFile("f1")];
    const duplicates: DuplicateImageInfo[] = [
      { imageId: "f1", albumIds: ["a1", "a2"], albumNames: ["Orion", "Deep Sky"] },
    ];

    render(
      <DuplicateImagesSheet visible duplicates={duplicates} files={files} onClose={onClose} />,
    );

    expect(screen.getByText("Orion")).toBeTruthy();
    expect(screen.getByText("Deep Sky")).toBeTruthy();
  });

  it("calls onImagePress when a duplicate item is pressed", () => {
    const onImagePress = jest.fn();
    const files = [makeFile("f1")];
    const duplicates: DuplicateImageInfo[] = [
      { imageId: "f1", albumIds: ["a1"], albumNames: ["Orion"] },
    ];

    render(
      <DuplicateImagesSheet
        visible
        duplicates={duplicates}
        files={files}
        onClose={onClose}
        onImagePress={onImagePress}
      />,
    );

    fireEvent.press(screen.getByText("f1.fits"));
    expect(onImagePress).toHaveBeenCalledWith("f1");
  });

  it("shows summary count when duplicates exist", () => {
    const files = [makeFile("f1"), makeFile("f2")];
    const duplicates: DuplicateImageInfo[] = [
      { imageId: "f1", albumIds: ["a1"], albumNames: ["Orion"] },
      { imageId: "f2", albumIds: ["a1", "a2"], albumNames: ["Orion", "Galaxy"] },
    ];

    render(
      <DuplicateImagesSheet visible duplicates={duplicates} files={files} onClose={onClose} />,
    );

    expect(screen.getByText("2 duplicate images")).toBeTruthy();
  });

  it("shows object and filter info when available", () => {
    const files = [makeFile("f1", { object: "M42", filter: "Ha" })];
    const duplicates: DuplicateImageInfo[] = [
      { imageId: "f1", albumIds: ["a1"], albumNames: ["Orion"] },
    ];

    render(
      <DuplicateImagesSheet visible duplicates={duplicates} files={files} onClose={onClose} />,
    );

    expect(screen.getByText("M42")).toBeTruthy();
    expect(screen.getByText("Ha")).toBeTruthy();
  });

  it("does not render when visible is false", () => {
    render(<DuplicateImagesSheet visible={false} duplicates={[]} files={[]} onClose={onClose} />);

    expect(screen.queryByText("Duplicate Images")).toBeNull();
  });
});
