/**
 * 相簿搜索栏组件
 */

import { View } from "react-native";
import { Button, Input, TextField, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface AlbumSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export function AlbumSearchBar({
  value,
  onChangeText,
  placeholder,
  compact = false,
}: AlbumSearchBarProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const actualPlaceholder = placeholder ?? t("album.searchAlbums") ?? t("common.search");

  if (compact) {
    return (
      <View className="flex-row items-center">
        <TextField>
          <View className="flex-row items-center" style={{ width: 140 }}>
            <Input
              className="flex-1 pl-8 pr-8"
              placeholder={actualPlaceholder}
              value={value}
              onChangeText={onChangeText}
              autoCorrect={false}
            />
            <Ionicons
              name="search-outline"
              size={12}
              color={mutedColor}
              style={{ position: "absolute", left: 10 }}
            />
            {value.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={() => onChangeText("")}
                style={{ position: "absolute", right: 2 }}
              >
                <Ionicons name="close-circle" size={12} color={mutedColor} />
              </Button>
            )}
          </View>
        </TextField>
      </View>
    );
  }

  return (
    <TextField>
      <View className="w-full flex-row items-center">
        <Input
          className="flex-1 pl-9 pr-9"
          placeholder={actualPlaceholder}
          value={value}
          onChangeText={onChangeText}
          autoCorrect={false}
        />
        <Ionicons
          name="search-outline"
          size={16}
          color={mutedColor}
          style={{ position: "absolute", left: 12 }}
        />
        {value.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            onPress={() => onChangeText("")}
            style={{ position: "absolute", right: 12 }}
          >
            <Ionicons name="close-circle" size={16} color={mutedColor} />
          </Button>
        )}
      </View>
    </TextField>
  );
}
