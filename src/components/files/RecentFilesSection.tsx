import { memo } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { Accordion, Card, useThemeColor } from "heroui-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useRecentFiles } from "../../hooks/files/useRecentFiles";
import { resolveThumbnailUri } from "../../lib/gallery/thumbnailCache";
import type { FitsMetadata } from "../../lib/fits/types";

interface RecentFilesSectionProps {
  onFilePress: (file: FitsMetadata) => void;
}

export const RecentFilesSection = memo(function RecentFilesSection({
  onFilePress,
}: RecentFilesSectionProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { recentByPeriod, hasRecent } = useRecentFiles();

  if (!hasRecent) return null;

  return (
    <Accordion variant="surface" className="mb-2">
      <Accordion.Item value="recent">
        <Accordion.Trigger>
          <View className="flex-row items-center gap-2 flex-1">
            <Ionicons name="time-outline" size={14} color={mutedColor} />
            <Text className="text-xs font-medium text-foreground">{t("files.recentFiles")}</Text>
          </View>
          <Accordion.Indicator />
        </Accordion.Trigger>
        <Accordion.Content>
          {recentByPeriod.map((period) => (
            <View key={period.key} className="mb-2">
              <Text className="text-[10px] font-semibold uppercase text-muted mb-1">
                {t(period.labelKey)}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {period.files.map((file) => (
                    <RecentFileThumbnail
                      key={file.id}
                      file={file}
                      onPress={() => onFilePress(file)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          ))}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
});

const RecentFileThumbnail = memo(function RecentFileThumbnail({
  file,
  onPress,
}: {
  file: FitsMetadata;
  onPress: () => void;
}) {
  const mutedColor = useThemeColor("muted");
  const thumbUri = resolveThumbnailUri(file.id, file.thumbnailUri);

  return (
    <Pressable onPress={onPress}>
      <Card variant="secondary" style={{ width: 72 }}>
        <Card.Body className="p-1">
          <View className="h-14 w-full items-center justify-center overflow-hidden rounded-md bg-success/10">
            {thumbUri ? (
              <Image
                source={{ uri: thumbUri }}
                className="h-full w-full"
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
              />
            ) : (
              <Ionicons name="image-outline" size={16} color={mutedColor} />
            )}
          </View>
          <Text className="text-[8px] text-muted mt-0.5" numberOfLines={1}>
            {file.filename}
          </Text>
        </Card.Body>
      </Card>
    </Pressable>
  );
});
