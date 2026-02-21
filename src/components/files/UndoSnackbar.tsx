import { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { Button } from "heroui-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";

const UNDO_DURATION_MS = 6000;

interface UndoSnackbarProps {
  visible: boolean;
  count: number;
  onUndo: () => void;
}

export function UndoSnackbar({ visible, count, onUndo }: UndoSnackbarProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      progress.setValue(1);
      return;
    }
    progress.setValue(1);
    Animated.timing(progress, {
      toValue: 0,
      duration: UNDO_DURATION_MS,
      useNativeDriver: false,
    }).start();
  }, [visible, progress]);

  if (!visible) return null;

  const bottomOffset = Math.max(insets.bottom, 8) + 48;

  return (
    <View
      className="absolute left-4 right-4 rounded-xl bg-surface-secondary border border-separator overflow-hidden"
      style={{ bottom: bottomOffset }}
    >
      <View className="flex-row items-center justify-between gap-2 px-3 py-2">
        <Text className="text-xs text-muted flex-1">
          {t("files.undoDeleteHint").replace("{count}", String(count))}
        </Text>
        <Button size="sm" variant="ghost" onPress={onUndo}>
          <Button.Label>{t("common.undo")}</Button.Label>
        </Button>
      </View>
      <Animated.View
        className="h-0.5 bg-success"
        style={{
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}
