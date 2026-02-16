/**
 * 分类选择器组件
 */

import { View } from "react-native";
import { Chip, Input, useThemeColor, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useI18n } from "../../i18n/useI18n";

// Default categories for astronomical targets
const DEFAULT_CATEGORIES = [
  "Deep Sky",
  "Solar System",
  "Constellation",
  "Comet",
  "Asteroid",
  "Variable Star",
  "Double Star",
];

interface CategorySelectorProps {
  selectedCategory?: string;
  allCategories: string[];
  onSelect: (category: string | undefined) => void;
  showCustomInput?: boolean;
}

export function CategorySelector({
  selectedCategory,
  allCategories,
  onSelect,
  showCustomInput = true,
}: CategorySelectorProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const categories = [...new Set([...DEFAULT_CATEGORIES, ...allCategories])].sort();

  const handleSelect = (category: string) => {
    if (selectedCategory === category) {
      onSelect(undefined);
    } else {
      onSelect(category);
    }
  };

  const handleAddCustom = () => {
    const trimmed = customCategory.trim();
    if (trimmed) {
      onSelect(trimmed);
      setCustomCategory("");
      setShowCustom(false);
    }
  };

  return (
    <View>
      <View className="flex-row flex-wrap gap-1.5">
        {categories.map((category) => (
          <Chip
            key={category}
            size="sm"
            variant={selectedCategory === category ? "primary" : "secondary"}
            onPress={() => handleSelect(category)}
          >
            <Chip.Label className="text-[10px]">{category}</Chip.Label>
          </Chip>
        ))}

        {showCustomInput && !showCustom && (
          <Button size="sm" variant="outline" onPress={() => setShowCustom(true)}>
            <Ionicons name="add" size={12} color={mutedColor} />
          </Button>
        )}
      </View>

      {showCustom && showCustomInput && (
        <View className="flex-row gap-2 mt-2">
          <Input
            className="flex-1"
            placeholder={t("targets.addCategory")}
            value={customCategory}
            onChangeText={setCustomCategory}
            onSubmitEditing={handleAddCustom}
            autoFocus
            autoCorrect={false}
          />
        </View>
      )}
    </View>
  );
}
