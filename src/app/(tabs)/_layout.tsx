import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useUniwind } from "uniwind";

export default function TabLayout() {
  const { t } = useI18n();
  const { isLandscape } = useScreenOrientation();
  const { theme } = useUniwind();
  const isDark = theme === "dark";
  const background = isDark ? "#000000" : "#ffffff";
  const borderColor = isDark ? "#27272a" : "#e4e4e7";
  const activeColor = isDark ? "#17c964" : "#12a150";
  const inactiveColor = isDark ? "#71717a" : "#a1a1aa";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: background },
        tabBarStyle: {
          backgroundColor: background,
          borderTopColor: borderColor,
          ...(isLandscape && { height: 40, paddingBottom: 4 }),
        },
        tabBarShowLabel: !isLandscape,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.files"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: t("tabs.gallery"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="targets"
        options={{
          title: t("tabs.targets"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="telescope-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: t("tabs.sessions"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
