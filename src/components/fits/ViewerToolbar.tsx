import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, BottomSheet, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";

interface ViewerToolbarProps {
  filename: string;
  isLandscape: boolean;
  isFavorite: boolean;
  prevId: string | null;
  nextId: string | null;
  showControls: boolean;
  hasAstrometryResult: boolean;
  isAstrometryActive: boolean;
  showAstrometryResult: boolean;
  onToggleFullscreen: () => void;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFavorite: () => void;
  onOpenHeader: () => void;
  onOpenEditor: () => void;
  onCompare: () => void;
  onExport: () => void;
  onAstrometry: () => void;
  onToggleControls: () => void;
}

export function ViewerToolbar({
  filename,
  isLandscape,
  isFavorite,
  prevId,
  nextId,
  showControls,
  hasAstrometryResult,
  isAstrometryActive,
  showAstrometryResult: _showAstrometryResult,
  onToggleFullscreen,
  onBack,
  onPrev,
  onNext,
  onToggleFavorite,
  onOpenHeader,
  onOpenEditor,
  onCompare,
  onExport,
  onAstrometry,
  onToggleControls,
}: ViewerToolbarProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const haptics = useHapticFeedback();
  const insets = useSafeAreaInsets();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const moreActions: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    color?: string;
  }[] = [
    {
      label: isFavorite ? t("common.unfavorite") : t("common.favorite"),
      icon: isFavorite ? "heart" : "heart-outline",
      onPress: onToggleFavorite,
      color: isFavorite ? "#ef4444" : undefined,
    },
    {
      label: t("header.title"),
      icon: "code-outline",
      onPress: onOpenHeader,
    },
    {
      label: t("editor.title"),
      icon: "create-outline",
      onPress: onOpenEditor,
    },
    {
      label: t("gallery.compare"),
      icon: "git-compare-outline",
      onPress: onCompare,
    },
    {
      label: t("common.share"),
      icon: "share-outline",
      onPress: onExport,
    },
  ];

  return (
    <>
      <View
        className="flex-row items-center justify-between pb-1.5"
        style={{
          paddingTop: isLandscape ? 6 : Math.max(insets.top, 12),
          paddingLeft: Math.max(insets.left + 6, 12),
          paddingRight: Math.max(insets.right + 6, 12),
        }}
      >
        {/* Left: Back + Nav */}
        <View className="flex-row items-center gap-0.5 shrink-0">
          <Button
            testID="e2e-action-viewer__param_id-back"
            size="sm"
            variant="ghost"
            isIconOnly
            onPress={onBack}
            className="h-8 w-8"
          >
            <Ionicons name="arrow-back" size={18} color={mutedColor} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            isDisabled={!prevId}
            onPress={onPrev}
            className="h-8 w-8"
          >
            <Ionicons name="chevron-back" size={16} color={prevId ? mutedColor : "#444"} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            isDisabled={!nextId}
            onPress={onNext}
            className="h-8 w-8"
          >
            <Ionicons name="chevron-forward" size={16} color={nextId ? mutedColor : "#444"} />
          </Button>
        </View>

        {/* Center: Filename */}
        <View className="flex-1 min-w-0 mx-2">
          <Text
            className="text-xs font-semibold text-foreground text-center"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {filename}
          </Text>
        </View>

        {/* Right: Key actions + More */}
        <View className="flex-row items-center gap-0.5 shrink-0">
          {/* Astrometry button (always visible due to importance) */}
          <Button
            testID="e2e-action-viewer__param_id-astrometry"
            size="sm"
            variant={isAstrometryActive ? "primary" : "ghost"}
            isIconOnly
            onPress={onAstrometry}
            className="h-8 w-8"
          >
            <Ionicons
              name={
                isAstrometryActive
                  ? "hourglass-outline"
                  : hasAstrometryResult
                    ? "checkmark-circle"
                    : "planet-outline"
              }
              size={16}
              color={isAstrometryActive ? "#fff" : hasAstrometryResult ? "#22c55e" : mutedColor}
            />
          </Button>

          {/* Controls toggle */}
          <Button
            testID="e2e-action-viewer__param_id-toggle-controls"
            size="sm"
            variant="ghost"
            isIconOnly
            onPress={() => {
              haptics.selection();
              onToggleControls();
            }}
            className="h-8 w-8"
          >
            <Ionicons
              name={showControls ? "options" : "options-outline"}
              size={16}
              color={showControls ? "#22c55e" : mutedColor}
            />
          </Button>

          {/* Fullscreen toggle */}
          <Button
            testID="e2e-action-viewer__param_id-open-more"
            size="sm"
            variant="ghost"
            isIconOnly
            onPress={() => {
              haptics.selection();
              onToggleFullscreen();
            }}
            className="h-8 w-8"
          >
            <Ionicons name="expand-outline" size={16} color={mutedColor} />
          </Button>

          {/* More menu */}
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            onPress={() => setShowMoreMenu(true)}
            className="h-8 w-8"
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={mutedColor} />
          </Button>
        </View>
      </View>

      {/* More actions sheet */}
      <BottomSheet
        isOpen={showMoreMenu}
        onOpenChange={(open) => {
          if (!open) setShowMoreMenu(false);
        }}
      >
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            <BottomSheet.Title className="text-center">{filename}</BottomSheet.Title>
            <Separator className="my-1" />
            {moreActions.map((action, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  haptics.selection();
                  setShowMoreMenu(false);
                  action.onPress();
                }}
                className="flex-row items-center gap-3 px-4 py-3.5"
              >
                <Ionicons name={action.icon} size={18} color={action.color ?? mutedColor} />
                <Text className="text-sm text-foreground">{action.label}</Text>
              </Pressable>
            ))}
            <Separator className="my-1" />
            <View className="px-4 py-2">
              <Button variant="outline" onPress={() => setShowMoreMenu(false)} className="w-full">
                <Button.Label>{t("common.cancel")}</Button.Label>
              </Button>
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </>
  );
}
