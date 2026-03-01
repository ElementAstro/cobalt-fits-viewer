/**
 * 图片评分面板组件
 */

import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { Button, Card, Dialog, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { FitsMetadata } from "../../lib/fits/types";

const RATING_LABEL_KEYS: Record<number, string> = {
  5: "targets.ratings.excellent",
  4: "targets.ratings.good",
  3: "targets.ratings.average",
  2: "targets.ratings.fair",
  1: "targets.ratings.poor",
};

interface ImageRatingSheetProps {
  visible: boolean;
  images: FitsMetadata[];
  imageRatings: Record<string, number>;
  bestImageId?: string;
  onClose: () => void;
  onRate: (imageId: string, rating: number) => void;
  onSetBest?: (imageId: string) => void;
}

export function ImageRatingSheet({
  visible,
  images,
  imageRatings,
  bestImageId,
  onClose,
  onRate,
  onSetBest,
}: ImageRatingSheetProps) {
  const { t } = useI18n();
  const [mutedColor, warningColor, dangerColor] = useThemeColor(["muted", "warning", "danger"]);

  // Group images by rating
  const groupedImages = useMemo(() => {
    const groups: Record<number, FitsMetadata[]> = {
      5: [],
      4: [],
      3: [],
      2: [],
      1: [],
      0: [], // Unrated
    };

    for (const image of images) {
      const rating = imageRatings[image.id] ?? 0;
      groups[rating].push(image);
    }

    return groups;
  }, [images, imageRatings]);

  // Statistics
  const stats = useMemo(() => {
    let totalRated = 0;
    let ratingSum = 0;

    for (const image of images) {
      const rating = imageRatings[image.id] ?? 0;
      if (rating > 0) {
        totalRated++;
        ratingSum += rating;
      }
    }

    return {
      total: images.length,
      totalRated,
      averageRating: totalRated > 0 ? ratingSum / totalRated : 0,
      unrated: images.length - totalRated,
    };
  }, [images, imageRatings]);

  const renderStars = (imageId: string, currentRating: number) => {
    return (
      <View className="flex-row gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Button
            key={star}
            size="sm"
            variant="ghost"
            className="p-0.5"
            onPress={() => onRate(imageId, star === currentRating ? 0 : star)}
          >
            <Ionicons
              name={star <= currentRating ? "star" : "star-outline"}
              size={16}
              color={star <= currentRating ? warningColor : mutedColor}
            />
          </Button>
        ))}
      </View>
    );
  };

  const renderImageItem = (image: FitsMetadata) => {
    const rating = imageRatings[image.id] ?? 0;
    const isBest = bestImageId === image.id;

    return (
      <View
        key={image.id}
        className="flex-row items-center justify-between py-2 border-b border-surface-secondary"
      >
        <View className="flex-1 flex-row items-center gap-2">
          {isBest && <Ionicons name="star" size={12} color={warningColor} />}
          <View className="flex-1">
            <Text className="text-sm text-foreground" numberOfLines={1}>
              {image.filename}
            </Text>
            <View className="flex-row items-center gap-2">
              {image.filter && <Text className="text-[10px] text-muted">{image.filter}</Text>}
              {image.exptime && <Text className="text-[10px] text-muted">{image.exptime}s</Text>}
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {renderStars(image.id, rating)}
          {onSetBest && (
            <Button size="sm" variant="ghost" className="p-1" onPress={() => onSetBest(image.id)}>
              <Ionicons
                name={isBest ? "heart" : "heart-outline"}
                size={16}
                color={isBest ? dangerColor : mutedColor}
              />
            </Button>
          )}
        </View>
      </View>
    );
  };

  const renderRatingGroup = (rating: number, label: string) => {
    const imagesInGroup = groupedImages[rating];
    if (imagesInGroup.length === 0) return null;

    return (
      <View key={rating} className="mb-4">
        <View className="flex-row items-center gap-2 mb-2">
          <View className="flex-row">
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= rating ? "star" : "star-outline"}
                size={12}
                color={star <= rating ? warningColor : mutedColor}
              />
            ))}
          </View>
          <Text className="text-xs text-muted">{label}</Text>
          <Text className="text-xs text-muted">({imagesInGroup.length})</Text>
        </View>
        {imagesInGroup.map(renderImageItem)}
      </View>
    );
  };

  return (
    <Dialog isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="mx-4 w-full max-w-md rounded-2xl bg-background p-6 max-h-[85%]">
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between mb-4">
              <Dialog.Title>{t("targets.ratings.title")}</Dialog.Title>
              <Dialog.Close />
            </View>

            {images.length === 0 ? (
              <View className="items-center py-8">
                <Ionicons name="images-outline" size={48} color={mutedColor} />
                <Text className="mt-4 text-sm text-muted text-center">{t("gallery.noImages")}</Text>
              </View>
            ) : (
              <>
                {/* Statistics */}
                <Card variant="secondary" className="mb-4">
                  <Card.Body className="p-3">
                    <View className="flex-row justify-between">
                      <View className="items-center">
                        <Text className="text-lg font-bold text-foreground">{stats.total}</Text>
                        <Text className="text-[10px] text-muted">
                          {t("targets.ratings.totalImages")}
                        </Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-lg font-bold text-foreground">
                          {stats.totalRated}
                        </Text>
                        <Text className="text-[10px] text-muted">{t("targets.ratings.rated")}</Text>
                      </View>
                      <View className="items-center">
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="star" size={14} color={warningColor} />
                          <Text className="text-lg font-bold text-foreground">
                            {stats.averageRating.toFixed(1)}
                          </Text>
                        </View>
                        <Text className="text-[10px] text-muted">
                          {t("targets.ratings.average")}
                        </Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-lg font-bold text-foreground">{stats.unrated}</Text>
                        <Text className="text-[10px] text-muted">
                          {t("targets.ratings.unrated")}
                        </Text>
                      </View>
                    </View>
                  </Card.Body>
                </Card>

                <Separator className="mb-4" />

                {/* Rating groups */}
                {([5, 4, 3, 2, 1] as const).map((rating) =>
                  renderRatingGroup(rating, t(RATING_LABEL_KEYS[rating])),
                )}

                {/* Unrated */}
                {groupedImages[0].length > 0 && (
                  <View className="mb-4">
                    <View className="flex-row items-center gap-2 mb-2">
                      <Ionicons name="help-circle-outline" size={12} color={mutedColor} />
                      <Text className="text-xs text-muted">
                        {t("targets.ratings.unrated")} ({groupedImages[0].length})
                      </Text>
                    </View>
                    {groupedImages[0].map(renderImageItem)}
                  </View>
                )}

                <Separator className="my-4" />

                <Button variant="outline" className="w-full" onPress={onClose}>
                  <Button.Label>{t("common.done")}</Button.Label>
                </Button>
              </>
            )}
          </ScrollView>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
