/**
 * 设备推荐显示卡片
 */

import { View, Text } from "react-native";
import { Button, Card, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { RecommendedEquipment } from "../../lib/fits/types";

interface EquipmentCardProps {
  equipment?: RecommendedEquipment;
  onEdit: () => void;
}

export function EquipmentCard({ equipment, onEdit }: EquipmentCardProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  if (!equipment) {
    return (
      <Card variant="secondary" className="mb-4">
        <Card.Body className="p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="construct-outline" size={16} color={mutedColor} />
              <Text className="text-sm text-muted">{t("targets.equipment.noEquipment")}</Text>
            </View>
            <Button size="sm" variant="ghost" onPress={onEdit}>
              <Ionicons name="add" size={16} color={mutedColor} />
            </Button>
          </View>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card variant="secondary" className="mb-4">
      <Card.Header>
        <View className="flex-row items-center justify-between flex-1">
          <Card.Title className="text-xs">{t("targets.equipment.title")}</Card.Title>
          <Button size="sm" variant="ghost" onPress={onEdit}>
            <Ionicons name="create-outline" size={14} color={mutedColor} />
          </Button>
        </View>
      </Card.Header>
      <Card.Body className="p-3 pt-0">
        {equipment.telescope && (
          <View className="mb-1.5 flex-row items-center gap-2">
            <Ionicons name="telescope-outline" size={12} color={mutedColor} />
            <Text className="text-xs text-foreground">{equipment.telescope}</Text>
          </View>
        )}
        {equipment.camera && (
          <View className="mb-1.5 flex-row items-center gap-2">
            <Ionicons name="camera-outline" size={12} color={mutedColor} />
            <Text className="text-xs text-foreground">{equipment.camera}</Text>
          </View>
        )}
        {equipment.filters && equipment.filters.length > 0 && (
          <View className="mb-1.5 flex-row items-center gap-2">
            <Ionicons name="filter-outline" size={12} color={mutedColor} />
            <Text className="text-xs text-foreground">{equipment.filters.join(", ")}</Text>
          </View>
        )}
        {equipment.notes && <Text className="text-xs text-muted mt-2">{equipment.notes}</Text>}
      </Card.Body>
    </Card>
  );
}
