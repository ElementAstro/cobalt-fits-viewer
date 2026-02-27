import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Button } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";

const UNDO_DURATION_MS = 6000;
const TAB_BAR_OFFSET = 48;

interface UndoSnackbarProps {
  visible: boolean;
  count: number;
  onUndo: () => void;
}

export function UndoSnackbar({ visible, count, onUndo }: UndoSnackbarProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      progress.value = 1;
      return;
    }
    progress.value = 1;
    progress.value = withTiming(0, { duration: UNDO_DURATION_MS });
  }, [visible, progress]);

  const animStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (!visible) return null;

  const bottomOffset = Math.max(insets.bottom, 8) + TAB_BAR_OFFSET;

  return (
    <View
      className="absolute left-4 right-4 rounded-xl bg-surface-secondary border border-separator overflow-hidden"
      style={{ bottom: bottomOffset }}
    >
      <View className="flex-row items-center justify-between gap-2 px-3 py-2">
        <Text className="text-xs text-muted flex-1">{t("files.undoDeleteHint", { count })}</Text>
        <Button size="sm" variant="ghost" onPress={onUndo}>
          <Button.Label>{t("common.undo")}</Button.Label>
        </Button>
      </View>
      <Animated.View className="h-0.5 bg-success" style={animStyle} />
    </View>
  );
}
