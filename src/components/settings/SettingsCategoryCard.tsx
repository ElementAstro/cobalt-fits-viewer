import { View, Text, TouchableOpacity } from "react-native";
import { Card, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";

export interface SettingsCategoryCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  badge?: string;
  testID?: string;
}

export function SettingsCategoryCard({
  icon,
  title,
  description,
  onPress,
  badge,
  testID,
}: SettingsCategoryCardProps) {
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");
  const haptics = useHapticFeedback();

  const handlePress = () => {
    haptics.selection();
    onPress();
  };

  return (
    <Card variant="secondary" className="rounded-xl">
      <TouchableOpacity
        testID={testID}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Card.Body className="px-4 py-3">
          <View className="flex-row items-center gap-3">
            <View
              className="h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${accentColor}20` }}
            >
              <Ionicons name={icon} size={20} color={accentColor} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-medium text-foreground">{title}</Text>
                {badge && (
                  <View
                    className="rounded-full px-2 py-0.5"
                    style={{ backgroundColor: `${accentColor}20` }}
                  >
                    <Text className="text-xs font-medium" style={{ color: accentColor }}>
                      {badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
                {description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={mutedColor} />
          </View>
        </Card.Body>
      </TouchableOpacity>
    </Card>
  );
}
