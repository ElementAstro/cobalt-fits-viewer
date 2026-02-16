/**
 * 最佳图片选择器组件
 */

import { useState, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Card, Dialog, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { FitsMetadata } from "../../lib/fits/types";

interface BestImageSelectorProps {
  visible: boolean;
  images: FitsMetadata[];
  currentBestId?: string;
  imageRatings: Record<string, number>;
  onClose: () => void;
  onSelect: (imageId: string) => void;
  onRateImage?: (imageId: string, rating: number) => void;
}

export function BestImageSelector({
  visible,
  images,
  currentBestId,
  imageRatings,
  onClose,
  onSelect,
  onRateImage,
}: BestImageSelectorProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ratingForSelected, setRatingForSelected] = useState<number>(0);

  // Sort images by rating (highest first), then by exposure time
  const sortedImages = useMemo(() => {
    return [...images].sort((a, b) => {
      const ratingA = imageRatings[a.id] ?? 0;
      const ratingB = imageRatings[b.id] ?? 0;
      if (ratingA !== ratingB) return ratingB - ratingA;
      return (b.exptime ?? 0) - (a.exptime ?? 0);
    });
  }, [images, imageRatings]);

  const handleSelect = (imageId: string) => {
    setSelectedId(imageId);
    setRatingForSelected(imageRatings[imageId] ?? 0);
  };

  const handleConfirm = () => {
    if (selectedId) {
      // Save rating if changed
      if (onRateImage && ratingForSelected !== (imageRatings[selectedId] ?? 0)) {
        onRateImage(selectedId, ratingForSelected);
      }
      onSelect(selectedId);
      onClose();
    }
  };

  const handleClearBest = () => {
    onSelect("");
    onClose();
  };

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-4 w-full max-w-md rounded-2xl bg-background p-6 max-h-[85%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between mb-4">
              <Dialog.Title>{t("targets.ratings.selectBest")}</Dialog.Title>
              <Dialog.Close />
            </View>

            {images.length === 0 ? (
              <View className="items-center py-8">
                <Ionicons name="images-outline" size={48} color={mutedColor} />
                <Text className="mt-4 text-sm text-muted text-center">{t("gallery.noImages")}</Text>
              </View>
            ) : (
              <>
                {/* Image list */}
                <View className="gap-2 mb-4">
                  {sortedImages.map((image) => {
                    const isSelected = selectedId === image.id;
                    const isCurrentBest = currentBestId === image.id;
                    const rating = imageRatings[image.id] ?? 0;

                    return (
                      <Card
                        key={image.id}
                        variant="secondary"
                        className={isSelected ? "border-2 border-primary bg-primary/10" : ""}
                      >
                        <Card.Body className="p-3">
                          <Button
                            variant="ghost"
                            className="w-full"
                            onPress={() => handleSelect(image.id)}
                          >
                            <View className="flex-1 flex-row items-center gap-3">
                              {/* Thumbnail placeholder */}
                              <View className="w-12 h-12 rounded bg-surface-secondary items-center justify-center">
                                <Ionicons name="image-outline" size={20} color={mutedColor} />
                              </View>

                              <View className="flex-1">
                                <View className="flex-row items-center gap-2">
                                  <Text
                                    className={`text-sm ${isSelected ? "font-semibold" : ""} text-foreground`}
                                  >
                                    {image.filename}
                                  </Text>
                                  {isCurrentBest && (
                                    <Ionicons name="star" size={12} color="#f59e0b" />
                                  )}
                                </View>
                                <View className="flex-row items-center gap-3 mt-1">
                                  {image.filter && (
                                    <Text className="text-[10px] text-muted">{image.filter}</Text>
                                  )}
                                  {image.exptime && (
                                    <Text className="text-[10px] text-muted">{image.exptime}s</Text>
                                  )}
                                  {rating > 0 && (
                                    <View className="flex-row items-center gap-1">
                                      <Ionicons name="star" size={10} color="#f59e0b" />
                                      <Text className="text-[10px] text-warning">{rating}</Text>
                                    </View>
                                  )}
                                </View>
                              </View>

                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                              )}
                            </View>
                          </Button>
                        </Card.Body>
                      </Card>
                    );
                  })}
                </View>

                {/* Rating for selected */}
                {selectedId && (
                  <Card variant="secondary" className="mb-4">
                    <Card.Body className="p-3">
                      <Text className="text-xs text-muted mb-2">
                        {t("targets.ratings.setRating")}
                      </Text>
                      <View className="flex-row gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Button
                            key={star}
                            size="sm"
                            variant="ghost"
                            onPress={() => setRatingForSelected(star)}
                          >
                            <Ionicons
                              name={star <= ratingForSelected ? "star" : "star-outline"}
                              size={24}
                              color={star <= ratingForSelected ? "#f59e0b" : mutedColor}
                            />
                          </Button>
                        ))}
                        {ratingForSelected > 0 && (
                          <Button size="sm" variant="ghost" onPress={() => setRatingForSelected(0)}>
                            <Ionicons name="close-circle-outline" size={20} color={mutedColor} />
                          </Button>
                        )}
                      </View>
                    </Card.Body>
                  </Card>
                )}

                <Separator className="my-4" />

                {/* Actions */}
                <View className="flex-row justify-between">
                  {currentBestId && (
                    <Button variant="ghost" onPress={handleClearBest}>
                      <Ionicons name="trash-outline" size={14} color="#ef4444" />
                      <Button.Label className="text-destructive">
                        {t("targets.ratings.clearBest")}
                      </Button.Label>
                    </Button>
                  )}
                  <View className="flex-row gap-2 ml-auto">
                    <Button variant="outline" onPress={onClose}>
                      <Button.Label>{t("common.cancel")}</Button.Label>
                    </Button>
                    <Button variant="primary" onPress={handleConfirm} isDisabled={!selectedId}>
                      <Button.Label>{t("common.confirm")}</Button.Label>
                    </Button>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
