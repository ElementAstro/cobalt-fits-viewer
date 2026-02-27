import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BottomSheet, Button, Chip } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { ViewerControlPanel } from "./ViewerControlPanel";
import type { ComponentProps } from "react";

type ControlPanelProps = ComponentProps<typeof ViewerControlPanel>;

interface ViewerBottomSheetProps extends ControlPanelProps {
  visible: boolean;
  onVisibleChange?: (visible: boolean) => void;
}

export function ViewerBottomSheet({
  visible,
  onVisibleChange,
  ...controlPanelProps
}: ViewerBottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [sheetIndex, setSheetIndex] = useState(1);
  // Deferred open state: ensures the BottomSheet always mounts with isOpen=false
  // first, then transitions to true — required by heroui-native's internal
  // BottomSheetContentContainer to detect the false→true change and call snapToIndex.
  const [internalOpen, setInternalOpen] = useState(false);

  const snapPoints = useMemo(
    () => [56, Math.round(screenHeight * 0.45), Math.round(screenHeight * 0.85)],
    [screenHeight],
  );

  const handleExpand = useCallback(() => {
    setSheetIndex(1);
  }, []);

  useEffect(() => {
    if (visible) {
      setSheetIndex(1);
    } else {
      setSheetIndex(0);
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
        <BottomSheet.Overlay />
        <BottomSheet.Content
          index={sheetIndex}
          snapPoints={snapPoints}
          onChange={(index) => setSheetIndex(index)}
          handleIndicatorStyle={{ width: 36 }}
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
          <BottomSheetScrollView showsVerticalScrollIndicator={false}>
            <ViewerControlPanel {...controlPanelProps} />
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
