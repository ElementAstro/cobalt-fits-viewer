import { Button, Dialog, Label, Radio, RadioGroup } from "heroui-native";
import * as Haptics from "expo-haptics";

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
  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-6 w-full max-w-sm rounded-2xl bg-background p-5">
          <Dialog.Title className="mb-3">{title}</Dialog.Title>

          <RadioGroup
            value={String(selectedValue)}
            onValueChange={(val) => {
              Haptics.selectionAsync();
              onSelect(val as T);
              onClose();
            }}
          >
            {options.map((opt) => (
              <RadioGroup.Item
                key={String(opt.value)}
                value={String(opt.value)}
                className="flex-row items-center gap-3 rounded-xl px-3 py-3"
              >
                <Radio />
                <Label className="text-sm text-foreground">{opt.label}</Label>
              </RadioGroup.Item>
            ))}
          </RadioGroup>

          <Button variant="primary" className="mt-4" onPress={onClose}>
            <Button.Label>OK</Button.Label>
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
