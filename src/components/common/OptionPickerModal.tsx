import { Button, Dialog, Label, Radio, RadioGroup } from "heroui-native";
import { View } from "react-native";
import { coerceOptionValue } from "./optionPickerValue";
import { useHapticFeedback } from "../../hooks/common/useHapticFeedback";
import { useI18n } from "../../i18n/useI18n";

interface OptionPickerModalProps<T extends string | number> {
  visible: boolean;
  title: string;
  options: { label: string; value: T }[];
  selectedValue: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

export function OptionPickerModal<T extends string | number>({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: OptionPickerModalProps<T>) {
  const haptics = useHapticFeedback();
  const { t } = useI18n();

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Close />
          <View className="mb-4 gap-1.5">
            <Dialog.Title>{title}</Dialog.Title>
          </View>

          <RadioGroup
            value={String(selectedValue)}
            onValueChange={(val) => {
              haptics.selection();
              onSelect(coerceOptionValue(options, val));
              onClose();
            }}
          >
            {options.map((opt) => (
              <RadioGroup.Item key={String(opt.value)} value={String(opt.value)}>
                <Label>{opt.label}</Label>
                <Radio />
              </RadioGroup.Item>
            ))}
          </RadioGroup>

          <Button variant="primary" className="mt-4" onPress={onClose}>
            <Button.Label>{t("common.close")}</Button.Label>
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
