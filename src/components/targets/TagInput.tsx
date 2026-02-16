/**
 * 标签输入组件
 */

import { useState } from "react";
import { View } from "react-native";
import { Chip, Input, Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface TagInputProps {
  tags: string[];
  suggestions?: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export function TagInput({
  tags,
  suggestions = [],
  onChange,
  placeholder,
  maxTags = 10,
}: TagInputProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const [newTag, setNewTag] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed]);
      setNewTag("");
      setShowSuggestions(false);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const filteredSuggestions = suggestions.filter(
    (s) => !tags.includes(s.toLowerCase()) && s.toLowerCase().includes(newTag.toLowerCase()),
  );

  return (
    <View>
      {/* Existing Tags */}
      <View className="flex-row flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <Chip key={tag} size="sm" variant="secondary" onPress={() => handleRemoveTag(tag)}>
            <Chip.Label className="text-[10px]">{tag} ×</Chip.Label>
          </Chip>
        ))}
      </View>

      {/* Input */}
      <View className="flex-row gap-2">
        <Input
          className="flex-1"
          placeholder={placeholder ?? t("targets.addTag")}
          value={newTag}
          onChangeText={(text) => {
            setNewTag(text);
            setShowSuggestions(text.length > 0);
          }}
          onSubmitEditing={() => handleAddTag(newTag)}
          onFocus={() => setShowSuggestions(newTag.length > 0)}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Button
          variant="outline"
          size="sm"
          onPress={() => handleAddTag(newTag)}
          isDisabled={!newTag.trim() || tags.length >= maxTags}
        >
          <Ionicons name="add" size={16} color={mutedColor} />
        </Button>
      </View>

      {/* Suggestions */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <View className="flex-row flex-wrap gap-1 mt-2">
          {filteredSuggestions.slice(0, 5).map((suggestion) => (
            <Chip
              key={suggestion}
              size="sm"
              variant="secondary"
              onPress={() => handleAddTag(suggestion)}
            >
              <Chip.Label className="text-[10px]">{suggestion}</Chip.Label>
            </Chip>
          ))}
        </View>
      )}
    </View>
  );
}
