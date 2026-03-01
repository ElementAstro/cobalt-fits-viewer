import { View, Text } from "react-native";
import { Alert, Button, Card, Chip, Dialog, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

export interface SummaryItem {
  label: string;
  value: number;
  color?: "success" | "warning" | "danger" | "default" | "accent";
  icon?: string;
}

interface OperationSummaryDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  status?: "success" | "warning" | "danger" | "default";
  items: SummaryItem[];
  footnote?: string;
}

function SummaryRow({ item }: { item: SummaryItem }) {
  const color = item.color ?? "default";
  const iconColor = useThemeColor(color);

  return (
    <View className="flex-row items-center justify-between py-1.5">
      <View className="flex-1 flex-row items-center gap-2">
        {item.icon && (
          <Ionicons
            name={item.icon as keyof typeof Ionicons.glyphMap}
            size={14}
            color={iconColor}
          />
        )}
        <Text className="text-xs text-muted">{item.label}</Text>
      </View>
      <Chip size="sm" variant="soft" color={color}>
        <Chip.Label className="text-[10px] font-semibold">{item.value}</Chip.Label>
      </Chip>
    </View>
  );
}

export function OperationSummaryDialog({
  visible,
  onClose,
  title,
  icon,
  status = "default",
  items,
  footnote,
}: OperationSummaryDialogProps) {
  const { t } = useI18n();
  const iconColor = useThemeColor(status);

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-6 w-full max-w-sm rounded-2xl bg-background p-5">
          <View className="mb-4 flex-row items-start justify-between">
            <View className="flex-row items-center gap-3">
              {icon && (
                <View
                  className="size-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${iconColor}15` }}
                >
                  <Ionicons
                    name={icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={iconColor}
                  />
                </View>
              )}
              <Dialog.Title>{title}</Dialog.Title>
            </View>
            <Dialog.Close />
          </View>

          <Separator className="mb-3" />

          <Card variant="secondary">
            <Card.Body className="px-3 py-2">
              {items.map((item, index) => (
                <SummaryRow key={`${item.label}-${index}`} item={item} />
              ))}
            </Card.Body>
          </Card>

          {footnote && (
            <>
              <Separator className="my-3" />
              <Alert status={status} className="items-center">
                <Alert.Indicator className="pt-0" />
                <Alert.Content>
                  <Alert.Title>{footnote}</Alert.Title>
                </Alert.Content>
              </Alert>
            </>
          )}

          <Button variant="primary" className="mt-4" onPress={onClose}>
            <Button.Label>{t("common.confirm")}</Button.Label>
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
