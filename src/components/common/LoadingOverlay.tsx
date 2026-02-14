import { View, Text } from "react-native";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface LoadingOverlayProps {
  message?: string;
  visible?: boolean;
  percent?: number;
  currentFile?: string;
  current?: number;
  total?: number;
  onCancel?: () => void;
}

export function LoadingOverlay({
  message,
  visible = true,
  percent,
  currentFile,
  current,
  total,
  onCancel,
}: LoadingOverlayProps) {
  const { t } = useI18n();
  const dangerColor = useThemeColor("danger");
  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/60">
      <View className="w-72 items-center rounded-2xl bg-surface-secondary p-6">
        <Spinner size="lg" color="success" />
        <Text className="mt-3 text-sm font-semibold text-foreground">
          {message ?? t("common.loading")}
        </Text>

        {percent != null && percent > 0 && (
          <View className="mt-3 w-full">
            <View className="h-2 w-full rounded-full bg-muted/20">
              <View
                className="h-2 rounded-full bg-success"
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </View>
            <Text className="mt-1 text-center text-xs text-muted">{percent}%</Text>
          </View>
        )}

        {currentFile && (
          <Text className="mt-2 text-xs text-muted" numberOfLines={1}>
            {currentFile}
          </Text>
        )}

        {current != null && total != null && total > 0 && (
          <Text className="mt-1 text-xs text-muted">
            {current} / {total}
          </Text>
        )}

        {onCancel && (
          <Button size="sm" variant="outline" className="mt-4" onPress={onCancel}>
            <Ionicons name="close-circle-outline" size={16} color={dangerColor} />
            <Button.Label className="text-danger">{t("files.cancelImport")}</Button.Label>
          </Button>
        )}
      </View>
    </View>
  );
}
