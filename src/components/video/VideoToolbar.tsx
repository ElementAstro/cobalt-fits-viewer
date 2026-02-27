import { Text, View } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface VideoToolbarProps {
  filename: string;
  isFavorite: boolean;
  isLandscape: boolean;
  insetTop: number;
  prevVideoId: string | null;
  nextVideoId: string | null;
  onBack: () => void;
  onNavigate: (id: string) => void;
  onToggleFavorite: () => void;
}

export function VideoToolbar({
  filename,
  isFavorite,
  isLandscape,
  insetTop,
  prevVideoId,
  nextVideoId,
  onBack,
  onNavigate,
  onToggleFavorite,
}: VideoToolbarProps) {
  const { t } = useI18n();
  const [warningColor, mutedColor] = useThemeColor(["warning", "muted"]);

  return (
    <View
      className="mb-3 flex-row items-center justify-between gap-2"
      style={{
        paddingTop: isLandscape ? 6 : Math.max(insetTop, 12),
        paddingLeft: isLandscape ? 6 : 0,
        paddingRight: isLandscape ? 6 : 0,
      }}
    >
      <Button
        size="sm"
        variant="outline"
        isIconOnly
        onPress={onBack}
        accessibilityLabel={t("settings.videoBack")}
      >
        <Ionicons name="arrow-back" size={16} color={mutedColor} />
      </Button>
      <View className="flex-row items-center gap-0.5">
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={() => prevVideoId && onNavigate(prevVideoId)}
          isDisabled={!prevVideoId}
          accessibilityLabel={t("settings.videoPrevious")}
        >
          <Ionicons name="chevron-back" size={16} color={mutedColor} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={() => nextVideoId && onNavigate(nextVideoId)}
          isDisabled={!nextVideoId}
          accessibilityLabel={t("settings.videoNext")}
        >
          <Ionicons name="chevron-forward" size={16} color={mutedColor} />
        </Button>
      </View>
      <Text
        className="flex-1 min-w-0 text-center text-xs font-semibold text-foreground"
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {filename}
      </Text>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        onPress={onToggleFavorite}
        accessibilityLabel={
          isFavorite ? t("settings.videoUnfavorite") : t("settings.videoFavorite")
        }
      >
        <Ionicons
          name={isFavorite ? "star" : "star-outline"}
          size={16}
          color={isFavorite ? warningColor : mutedColor}
        />
      </Button>
    </View>
  );
}
