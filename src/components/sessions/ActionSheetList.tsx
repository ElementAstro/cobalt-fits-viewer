import { View, Text, Pressable } from "react-native";
import { BottomSheet, Button, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

export interface ActionItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  highlight?: boolean;
}

export interface ConditionalActionItem extends ActionItem {
  _visible: boolean;
}

interface ActionSheetListProps {
  visible: boolean;
  title: string;
  actions: ActionItem[];
  onClose: () => void;
}

export function ActionSheetList({ visible, title, actions, onClose }: ActionSheetListProps) {
  const { t } = useI18n();
  const [mutedColor, successColor, dangerColor] = useThemeColor(["muted", "success", "danger"]);

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <BottomSheet.Title className="text-center">{title}</BottomSheet.Title>
          <Separator className="my-1" />
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              className="flex-row items-center gap-3 px-4 py-3.5"
            >
              <Ionicons
                name={action.icon}
                size={18}
                color={
                  action.destructive ? dangerColor : action.highlight ? successColor : mutedColor
                }
              />
              <Text
                className={`text-sm ${
                  action.destructive
                    ? "text-red-500"
                    : action.highlight
                      ? "text-success"
                      : "text-foreground"
                }`}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Separator className="my-1" />
          <View className="px-4 py-2">
            <Button variant="outline" onPress={onClose} className="w-full">
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
