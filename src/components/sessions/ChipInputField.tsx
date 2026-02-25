import { memo } from "react";
import { View } from "react-native";
import { Chip, Input, Label, TextField } from "heroui-native";

interface ChipInputFieldProps {
  label: string;
  items: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (item: string) => void;
  placeholder?: string;
}

export const ChipInputField = memo(function ChipInputField({
  label,
  items,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
}: ChipInputFieldProps) {
  return (
    <View className="mb-3">
      <Label className="mb-1">{label}</Label>
      {items.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mb-1.5">
          {items.map((item) => (
            <Chip key={item} size="sm" variant="secondary" onPress={() => onRemove(item)}>
              <Chip.Label className="text-[9px]">{item} ×</Chip.Label>
            </Chip>
          ))}
        </View>
      )}
      <TextField>
        <Input
          value={inputValue}
          onChangeText={onInputChange}
          placeholder={placeholder}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
      </TextField>
    </View>
  );
});
