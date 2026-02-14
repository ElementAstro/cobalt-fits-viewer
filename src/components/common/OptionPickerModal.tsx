import { View, Text, TouchableOpacity, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native";
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
  const bgColor = useThemeColor("background");
  const cardColor = useThemeColor("surface");
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: bgColor, borderRadius: 16, width: "80%", maxWidth: 340 }}
        >
          <View className="px-5 pt-5 pb-2">
            <Text className="text-base font-semibold text-foreground">{title}</Text>
          </View>
          <View className="px-2 pb-3">
            {options.map((opt) => {
              const isSelected = opt.value === selectedValue;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  className="flex-row items-center justify-between rounded-xl px-3 py-3"
                  style={isSelected ? { backgroundColor: cardColor } : undefined}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={opt.label}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onSelect(opt.value);
                    onClose();
                  }}
                >
                  <Text className="text-sm text-foreground">{opt.label}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            className="items-center border-t py-3"
            style={{ borderColor: mutedColor + "30" }}
            onPress={onClose}
          >
            <Text className="text-sm font-medium" style={{ color: accentColor }}>
              OK
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
