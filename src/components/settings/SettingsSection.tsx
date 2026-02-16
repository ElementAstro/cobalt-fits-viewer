import { View, Text } from "react-native";
import { Card } from "heroui-native";

export interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">{title}</Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">{children}</Card.Body>
      </Card>
    </View>
  );
}
