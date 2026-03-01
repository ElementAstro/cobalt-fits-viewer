import { ScrollView, View } from "react-native";
import { Chip, ScrollShadow, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n } from "../../i18n/useI18n";
import type { MetadataIndexResult } from "../../lib/gallery/metadataIndex";

export interface FrameTypeEntry {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface GalleryFilterChipsProps {
  filterObject: string;
  filterFrameType: string;
  filterFavoriteOnly: boolean;
  objects: MetadataIndexResult["objects"];
  frameTypes: FrameTypeEntry[];
  compact?: boolean;
  onFilterObjectChange: (value: string) => void;
  onFilterFrameTypeChange: (value: string) => void;
  onFilterFavoriteOnlyChange: (value: boolean) => void;
}

export function GalleryFilterChips({
  filterObject,
  filterFrameType,
  filterFavoriteOnly,
  objects,
  frameTypes,
  compact = false,
  onFilterObjectChange,
  onFilterFrameTypeChange,
  onFilterFavoriteOnlyChange,
}: GalleryFilterChipsProps) {
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const chipTextClass = compact ? "text-[9px]" : "text-[10px]";
  const gapClass = compact ? "gap-1" : "gap-1.5";

  const objectChips = objects.length > 0 && (
    <>
      <Chip
        size="sm"
        variant={!filterObject ? "primary" : "secondary"}
        onPress={() => onFilterObjectChange("")}
      >
        <Chip.Label className={chipTextClass}>{t("gallery.allImages")}</Chip.Label>
      </Chip>
      {objects.map((obj) => (
        <Chip
          key={obj}
          size="sm"
          variant={filterObject === obj ? "primary" : "secondary"}
          onPress={() => onFilterObjectChange(obj)}
        >
          <Chip.Label className={chipTextClass}>{obj}</Chip.Label>
        </Chip>
      ))}
    </>
  );

  const frameTypeChips = (
    <>
      <Chip
        size="sm"
        variant={!filterFrameType ? "primary" : "secondary"}
        onPress={() => onFilterFrameTypeChange("")}
      >
        <Chip.Label className={chipTextClass}>{t("gallery.allTypes")}</Chip.Label>
      </Chip>
      {frameTypes.map((ft) => (
        <Chip
          key={ft.key}
          size="sm"
          variant={filterFrameType === ft.key ? "primary" : "secondary"}
          onPress={() => onFilterFrameTypeChange(ft.key)}
        >
          <Ionicons
            name={ft.icon}
            size={10}
            color={filterFrameType === ft.key ? successColor : mutedColor}
          />
          <Chip.Label className={chipTextClass}>{ft.label}</Chip.Label>
        </Chip>
      ))}
      <Chip
        size="sm"
        variant={filterFavoriteOnly ? "primary" : "secondary"}
        onPress={() => onFilterFavoriteOnlyChange(!filterFavoriteOnly)}
      >
        <Ionicons
          name={filterFavoriteOnly ? "star" : "star-outline"}
          size={10}
          color={filterFavoriteOnly ? successColor : mutedColor}
        />
        <Chip.Label className={chipTextClass}>{t("gallery.favoritesOnly")}</Chip.Label>
      </Chip>
    </>
  );

  if (compact) {
    return (
      <ScrollShadow LinearGradientComponent={LinearGradient} className="flex-1">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
          <View className={`flex-row ${gapClass}`}>
            {objectChips}
            {objectChips && <View className="w-px bg-separator mx-1" />}
            {frameTypeChips}
          </View>
        </ScrollView>
      </ScrollShadow>
    );
  }

  return (
    <>
      {objects.length > 0 && (
        <ScrollShadow LinearGradientComponent={LinearGradient}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className={`flex-row ${gapClass}`}>{objectChips}</View>
          </ScrollView>
        </ScrollShadow>
      )}

      <ScrollShadow LinearGradientComponent={LinearGradient}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className={`flex-row ${gapClass}`}>{frameTypeChips}</View>
        </ScrollView>
      </ScrollShadow>
    </>
  );
}
