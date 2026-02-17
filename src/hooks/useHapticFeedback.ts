import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useSettingsStore } from "../stores/useSettingsStore";

function runSafely(task: Promise<unknown>) {
  void task.catch(() => undefined);
}

export function useHapticFeedback() {
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const selection = useCallback(() => {
    if (!hapticsEnabled) return;
    runSafely(Haptics.selectionAsync());
  }, [hapticsEnabled]);

  const impact = useCallback(
    (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
      if (!hapticsEnabled) return;
      runSafely(Haptics.impactAsync(style));
    },
    [hapticsEnabled],
  );

  const notify = useCallback(
    (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
      if (!hapticsEnabled) return;
      runSafely(Haptics.notificationAsync(type));
    },
    [hapticsEnabled],
  );

  return {
    hapticsEnabled,
    selection,
    impact,
    notify,
  };
}
