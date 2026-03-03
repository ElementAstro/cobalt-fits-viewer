import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { BottomSheet, Button, Chip } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ViewerControlPanel } from "./ViewerControlPanel";
import type { ComponentProps } from "react";

type ControlPanelProps = ComponentProps<typeof ViewerControlPanel>;

interface ViewerBottomSheetProps extends ControlPanelProps {
  visible: boolean;
  onVisibleChange?: (visible: boolean) => void;
}

const COLLAPSED_SNAP_INDEX = 0;
const DEFAULT_OPEN_SNAP_INDEX = 2;

export function ViewerBottomSheet({
  visible,
  onVisibleChange,
  ...controlPanelProps
}: ViewerBottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [sheetIndex, setSheetIndex] = useState(DEFAULT_OPEN_SNAP_INDEX);
  // Deferred open state: ensures the BottomSheet always mounts with isOpen=false
  // first, then transitions to true — required by heroui-native's internal
  // BottomSheetContentContainer to detect the false→true change and call snapToIndex.
  const [internalOpen, setInternalOpen] = useState(false);

  const snapPoints = useMemo(
    () => [56, Math.round(screenHeight * 0.45), Math.round(screenHeight * 0.96)],
    [screenHeight],
  );

  const handleExpand = useCallback(() => {
    setSheetIndex(DEFAULT_OPEN_SNAP_INDEX);
  }, []);

  useEffect(() => {
    if (visible) {
      setSheetIndex(DEFAULT_OPEN_SNAP_INDEX);
    } else {
      setSheetIndex(COLLAPSED_SNAP_INDEX);
    }
    setInternalOpen(visible);
  }, [visible]);

  return (
    <BottomSheet
      isOpen={internalOpen}
      onOpenChange={(open) => {
        if (!open) {
          setSheetIndex(0);
          setInternalOpen(false);
        }
        onVisibleChange?.(open);
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay pointerEvents="none" />
        <BottomSheet.Content
          index={sheetIndex}
          snapPoints={snapPoints}
          onChange={(index) => setSheetIndex(index)}
          handleIndicatorStyle={{ width: 36 }}
          enableDynamicSizing={false}
          enableContentPanningGesture={false}
          contentContainerClassName="h-full px-0"
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
              {controlPanelProps.file?.object && (
                <Chip size="sm" variant="primary">
                  <Chip.Label className="text-[8px]">{controlPanelProps.file?.object}</Chip.Label>
                </Chip>
              )}
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={handleExpand}
                className="h-6 w-6"
              >
                <Ionicons name="chevron-up" size={14} className="text-muted" />
              </Button>
            </View>
          </View>

          {/* Full control panel content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            keyboardShouldPersistTaps="handled"
          >
            <ViewerControlPanel {...controlPanelProps} />
          </ScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
