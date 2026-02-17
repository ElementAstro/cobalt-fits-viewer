import { useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { SettingsCategoryCard } from "./SettingsCategoryCard";

type SettingsRoute =
  | "/settings/viewer"
  | "/settings/gallery"
  | "/settings/processing"
  | "/settings/observation"
  | "/settings/appearance"
  | "/settings/storage"
  | "/settings/about";

interface CategoryInfo {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descKey: string;
  route: SettingsRoute;
  searchKeyHints: string[];
  searchTerms: string[];
}

const CATEGORIES: CategoryInfo[] = [
  {
    key: "viewer",
    icon: "eye-outline",
    titleKey: "settings.categories.viewer",
    descKey: "settings.categories.viewerDesc",
    route: "/settings/viewer",
    searchKeyHints: [
      "viewer.stretch",
      "viewer.colormap",
      "settings.defaultShowGrid",
      "settings.defaultShowCrosshair",
      "settings.defaultShowPixelInfo",
      "settings.defaultShowMinimap",
      "settings.defaultBlackPoint",
      "settings.defaultWhitePoint",
      "settings.defaultGamma",
      "settings.defaultHistogramMode",
      "settings.canvasZoom",
    ],
    searchTerms: ["zscale", "histogram", "pixel", "zoom", "grid", "crosshair"],
  },
  {
    key: "gallery",
    icon: "images-outline",
    titleKey: "settings.categories.gallery",
    descKey: "settings.categories.galleryDesc",
    route: "/settings/gallery",
    searchKeyHints: [
      "settings.gridColumns",
      "settings.thumbnailQuality",
      "settings.thumbnailSize",
      "settings.defaultGallerySortBy",
      "settings.fileListStyle",
      "settings.thumbnailShowFilename",
      "settings.thumbnailShowObject",
      "settings.thumbnailShowFilter",
      "settings.thumbnailShowExposure",
    ],
    searchTerms: ["thumbnail", "sort", "grid", "list", "compact"],
  },
  {
    key: "processing",
    icon: "construct-outline",
    titleKey: "settings.categories.processing",
    descKey: "settings.categories.processingDesc",
    route: "/settings/processing",
    searchKeyHints: [
      "settings.editorDefaults",
      "settings.defaultStackMethod",
      "settings.defaultConverterFormat",
      "settings.defaultConverterQuality",
      "settings.defaultComposePreset",
      "settings.performance",
      "settings.defaultExportFormat",
    ],
    searchTerms: ["sigma", "alignment", "compose", "converter", "debounce"],
  },
  {
    key: "observation",
    icon: "telescope-outline",
    titleKey: "settings.categories.observation",
    descKey: "settings.categories.observationDesc",
    route: "/settings/observation",
    searchKeyHints: [
      "settings.autoGroupByObject",
      "settings.targetSortBy",
      "settings.sessionGap",
      "settings.calendarSync",
      "settings.timelineGrouping",
      "settings.autoDetectDuplicates",
      "location.autoTag",
      "settings.mapPreset",
      "settings.mapShowOverlays",
    ],
    searchTerms: ["target", "session", "timeline", "calendar", "map", "location", "duplicate"],
  },
  {
    key: "appearance",
    icon: "color-palette-outline",
    titleKey: "settings.categories.appearance",
    descKey: "settings.categories.appearanceDesc",
    route: "/settings/appearance",
    searchKeyHints: [
      "settings.language",
      "settings.theme",
      "settings.themeColorMode",
      "settings.fontFamily",
      "settings.monoFont",
      "settings.orientation",
      "settings.accentColor",
      "settings.stylePreset",
    ],
    searchTerms: ["light", "dark", "theme", "font", "accent", "preset"],
  },
  {
    key: "storage",
    icon: "server-outline",
    titleKey: "settings.categories.storage",
    descKey: "settings.categories.storageDesc",
    route: "/settings/storage",
    searchKeyHints: [
      "settings.storageUsage",
      "settings.cacheSize",
      "settings.clearCache",
      "settings.backup",
      "astrometry.plateSolve",
      "settings.clearCompletedAstrometry",
      "settings.clearAllAstrometry",
    ],
    searchTerms: ["cache", "backup", "storage", "astrometry", "plate solve"],
  },
  {
    key: "about",
    icon: "information-circle-outline",
    titleKey: "settings.categories.about",
    descKey: "settings.categories.aboutDesc",
    route: "/settings/about",
    searchKeyHints: [
      "settings.version",
      "settings.general",
      "settings.hapticsEnabled",
      "settings.confirmDestructiveActions",
      "settings.autoCheckUpdates",
      "systemInfo.title",
      "logs.title",
      "settings.resetAll",
      "settings.checkForUpdate",
      "settings.changelog",
    ],
    searchTerms: ["version", "system", "logs", "update", "reset", "haptic", "confirm"],
  },
];

export default function SettingsHubScreen() {
  const { t } = useI18n();
  const { contentPaddingTop, horizontalPadding, isLandscapeTablet } = useResponsiveLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return CATEGORIES;
    const query = searchQuery.toLowerCase();

    return CATEGORIES.filter((cat) => {
      const localizedHints = cat.searchKeyHints.map((key) => t(key).toLowerCase());
      const searchText = [t(cat.titleKey), t(cat.descKey), ...localizedHints, ...cat.searchTerms]
        .join(" ")
        .toLowerCase();
      return searchText.includes(query);
    });
  }, [searchQuery, t]);

  const mutedColor = useThemeColor("muted");
  const backgroundColor = useThemeColor("surface");

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-foreground">{t("settings.title")}</Text>

        <View
          className="mt-3 flex-row items-center rounded-xl px-3 py-2"
          style={{ backgroundColor }}
        >
          <Ionicons name="search-outline" size={18} color={mutedColor} />
          <TextInput
            placeholder={t("common.search")}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="ml-2 flex-1 text-sm text-foreground"
            placeholderTextColor={mutedColor}
          />
        </View>

        {searchQuery.trim() && filteredCategories.length === 0 && (
          <View className="mt-4 items-center">
            <Ionicons name="search-outline" size={40} color={mutedColor} />
            <Text className="mt-2 text-sm text-muted">{t("common.noData")}</Text>
          </View>
        )}

        <Separator className="my-4" />

        <View className={isLandscapeTablet ? "flex-row flex-wrap justify-between" : "gap-3"}>
          {filteredCategories.map((category) => (
            <View
              key={category.key}
              style={isLandscapeTablet ? { width: "48.5%", marginBottom: 12 } : undefined}
            >
              <SettingsCategoryCard
                icon={category.icon}
                title={t(category.titleKey)}
                description={t(category.descKey)}
                onPress={() => router.push(category.route)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
