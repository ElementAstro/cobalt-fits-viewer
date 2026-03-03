import { View } from "react-native";
import { Button } from "heroui-native";
import { GROUP_COLORS } from "../../lib/targets/targetConstants";

export { GROUP_COLORS };

interface GroupColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

export function GroupColorPicker({ selectedColor, onSelect }: GroupColorPickerProps) {
  return (
    <View className="flex-row gap-2 flex-wrap">
      {GROUP_COLORS.map((color) => (
        <Button
          key={color}
          variant={selectedColor === color ? "primary" : "outline"}
          size="sm"
          className="w-8 h-8 p-0"
          onPress={() => onSelect(color)}
        >
          <View className="w-5 h-5 rounded-full" style={{ backgroundColor: color }} />
        </Button>
      ))}
    </View>
  );
}
