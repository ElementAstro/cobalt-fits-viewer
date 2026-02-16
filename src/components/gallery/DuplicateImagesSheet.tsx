/**
 * 重复图片面板
 */

import { View, Text, ScrollView } from "react-native";
import { BottomSheet, Button, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { DuplicateImageInfo, FitsMetadata } from "../../lib/fits/types";

interface DuplicateImagesSheetProps {
  visible: boolean;
  duplicates: DuplicateImageInfo[];
  files: FitsMetadata[];
  onClose: () => void;
  onImagePress?: (imageId: string) => void;
}

export function DuplicateImagesSheet({
  visible,
  duplicates,
  files,
  onClose,
  onImagePress,
}: DuplicateImagesSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  const getFileById = (id: string) => files.find((f) => f.id === id);

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["60%"]}>
          <View className="flex-1 bg-background px-4 pt-2">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="copy-outline" size={20} color={successColor} />
                <BottomSheet.Title>{t("album.duplicateImages")}</BottomSheet.Title>
              </View>
              <Button size="sm" variant="ghost" isIconOnly onPress={onClose}>
                <Ionicons name="close" size={20} color={mutedColor} />
              </Button>
            </View>

            {/* Summary */}
            {duplicates.length > 0 && (
              <View className="rounded-xl bg-surface-secondary p-3 mb-4">
                <Text className="text-sm text-muted">
                  {duplicates.length} {t("album.duplicateImages").toLowerCase()}
                </Text>
              </View>
            )}

            {/* Content */}
            {duplicates.length === 0 ? (
              <View className="flex-1 items-center justify-center py-8">
                <Ionicons name="checkmark-circle-outline" size={48} color={successColor} />
                <Text className="mt-2 text-sm text-muted">{t("album.noDuplicates")}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {duplicates.map((dup) => {
                  const file = getFileById(dup.imageId);
                  if (!file) return null;

                  return (
                    <Button
                      key={dup.imageId}
                      variant="ghost"
                      className="w-full justify-start mb-2 p-3 rounded-xl bg-surface-secondary"
                      onPress={() => onImagePress?.(dup.imageId)}
                    >
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                            {file.filename}
                          </Text>
                          <View className="flex-row items-center gap-1">
                            <Ionicons name="albums-outline" size={12} color={mutedColor} />
                            <Text className="text-xs text-muted">{dup.albumIds.length}</Text>
                          </View>
                        </View>

                        {/* Album names */}
                        <View className="flex-row flex-wrap gap-1 mt-2">
                          {dup.albumNames.map((name, i) => (
                            <Chip key={i} size="sm" variant="secondary">
                              <Chip.Label className="text-[9px]">{name}</Chip.Label>
                            </Chip>
                          ))}
                        </View>

                        {/* Object/Filter info */}
                        {(file.object || file.filter) && (
                          <View className="flex-row gap-2 mt-2">
                            {file.object && (
                              <Text className="text-xs text-muted" numberOfLines={1}>
                                {file.object}
                              </Text>
                            )}
                            {file.filter && (
                              <Text className="text-xs text-muted" numberOfLines={1}>
                                {file.filter}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </Button>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
