import { View, Text } from "react-native";
import { Accordion, Button, Card } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

export interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onReset?: () => void;
}

export function SettingsSection({
  title,
  children,
  collapsible,
  defaultCollapsed,
  onReset,
}: SettingsSectionProps) {
  const { t } = useI18n();

  const resetButton = onReset ? (
    <Button variant="ghost" size="sm" onPress={onReset}>
      <Button.Label>{t("settings.resetSection")}</Button.Label>
    </Button>
  ) : null;

  if (collapsible) {
    return (
      <View className="mb-4">
        <Accordion variant="surface" defaultValue={defaultCollapsed ? [] : [title]}>
          <Accordion.Item value={title}>
            <Accordion.Trigger>
              <Text className="flex-1 text-xs font-semibold uppercase text-muted">{title}</Text>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <View className="px-4 py-1">{children}</View>
              {resetButton ? <View className="px-4 pb-2">{resetButton}</View> : null}
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
      </View>
    );
  }

  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-semibold uppercase text-muted">{title}</Text>
      <Card variant="secondary">
        <Card.Body className="px-4 py-1">
          {children}
          {resetButton ? <View className="pt-1 pb-2">{resetButton}</View> : null}
        </Card.Body>
      </Card>
    </View>
  );
}
