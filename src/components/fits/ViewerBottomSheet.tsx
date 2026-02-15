import { useCallback, useMemo, useRef } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { Button, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ViewerControlPanel } from "./ViewerControlPanel";
import type { ComponentProps } from "react";

type ControlPanelProps = ComponentProps<typeof ViewerControlPanel>;

interface ViewerBottomSheetProps extends ControlPanelProps {
  visible: boolean;
}

export function ViewerBottomSheet({ visible, ...controlPanelProps }: ViewerBottomSheetProps) {
  const mutedColor = useThemeColor("muted");
  const { height: screenHeight } = useWindowDimensions();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(
    () => [56, Math.round(screenHeight * 0.45), Math.round(screenHeight * 0.85)],
    [screenHeight],
  );

  const handleExpand = useCallback(() => {
    bottomSheetRef.current?.snapToIndex(1);
  }, []);

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: "rgba(20, 20, 20, 0.97)" }}
      handleIndicatorStyle={{ backgroundColor: mutedColor, width: 36 }}
      enableDynamicSizing={false}
    >
      {/* Collapsed mini toolbar (visible at snap index 0) */}
      <View className="flex-row items-center justify-between px-3" style={{ height: 32 }}>
        <View className="flex-row items-center gap-2">
          <Text className="text-[10px] font-semibold text-muted uppercase">
            {controlPanelProps.stretch}
          </Text>
          <Text className="text-[10px] text-muted">·</Text>
          <Text className="text-[10px] text-muted">{controlPanelProps.colormap}</Text>
        </View>
        <View className="flex-row items-center gap-1">
          {controlPanelProps.file.object && (
            <Chip size="sm" variant="primary">
              <Chip.Label className="text-[8px]">{controlPanelProps.file.object}</Chip.Label>
            </Chip>
          )}
          <Button size="sm" variant="ghost" isIconOnly onPress={handleExpand} className="h-6 w-6">
            <Ionicons name="chevron-up" size={14} color={mutedColor} />
          </Button>
        </View>
      </View>

      {/* Full control panel content */}
      <BottomSheetScrollView showsVerticalScrollIndicator={false}>
        <ViewerControlPanel {...controlPanelProps} />
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
