import { memo } from "react";
import { View } from "react-native";
import { Button, Label, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { RATING_OPTIONS } from "../../lib/sessions/constants";

interface RatingSelectorProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

export const RatingSelector = memo(function RatingSelector({
  value,
  onChange,
}: RatingSelectorProps) {
  const { t } = useI18n();
  const [mutedColor, warningColor] = useThemeColor(["muted", "warning"]);

  return (
    <View className="mb-3">
      <Label className="mb-1">{t("sessions.rating")}</Label>
      <View className="flex-row gap-1">
        {RATING_OPTIONS.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={value === r ? "primary" : "outline"}
            isIconOnly
            onPress={() => onChange(value === r ? undefined : r)}
          >
            <Ionicons
              name={value != null && value >= r ? "star" : "star-outline"}
              size={14}
              color={value != null && value >= r ? warningColor : mutedColor}
            />
          </Button>
        ))}
      </View>
    </View>
  );
});
