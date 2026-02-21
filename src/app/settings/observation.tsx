import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Separator, Switch } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { SettingsSection } from "../../components/settings";
import { SettingsRow } from "../../components/common/SettingsRow";
import { OptionPickerModal } from "../../components/common/OptionPickerModal";
import { useSettingsPicker } from "../../hooks/useSettingsPicker";
import type {
  TargetActionControlMode,
  TargetActionSizePreset,
} from "../../lib/targets/targetInteractionUi";

const SESSION_GAP_VALUES = [30, 60, 120, 240, 480] as const;
const REMINDER_VALUES = [0, 15, 30, 60, 120] as const;
const TIMELINE_GROUPING_VALUES = ["day", "week", "month"] as const;
const TARGET_SORT_BY_VALUES = ["name", "date", "frames", "exposure", "favorite"] as const;
const TARGET_SORT_ORDER_VALUES = ["asc", "desc"] as const;
const TARGET_ACTION_CONTROL_MODE_VALUES = ["icon", "checkbox"] as const;
const TARGET_ACTION_SIZE_PRESET_VALUES = ["compact", "standard", "accessible"] as const;
const MAP_PRESET_VALUES = ["standard", "dark", "satellite", "terrain3d"] as const;

export default function ObservationSettingsScreen() {
  const { t } = useI18n();
  const haptics = useHapticFeedback();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePicker, openPicker, closePicker } = useSettingsPicker();

  // Target settings
  const autoGroupByObject = useSettingsStore((s) => s.autoGroupByObject);
  const setAutoGroupByObject = useSettingsStore((s) => s.setAutoGroupByObject);

  // Location settings
  const autoDetectDuplicates = useSettingsStore((s) => s.autoDetectDuplicates);
  const autoTagLocation = useSettingsStore((s) => s.autoTagLocation);
  const mapPreset = useSettingsStore((s) => s.mapPreset);
  const mapShowOverlays = useSettingsStore((s) => s.mapShowOverlays);
  const setAutoDetectDuplicates = useSettingsStore((s) => s.setAutoDetectDuplicates);
  const setAutoTagLocation = useSettingsStore((s) => s.setAutoTagLocation);
  const setMapPreset = useSettingsStore((s) => s.setMapPreset);
  const setMapShowOverlays = useSettingsStore((s) => s.setMapShowOverlays);

  // Session settings
  const sessionGapMinutes = useSettingsStore((s) => s.sessionGapMinutes);
  const setSessionGapMinutes = useSettingsStore((s) => s.setSessionGapMinutes);

  // Calendar sync
  const calendarSyncEnabled = useSettingsStore((s) => s.calendarSyncEnabled);
  const defaultReminderMinutes = useSettingsStore((s) => s.defaultReminderMinutes);
  const setCalendarSyncEnabled = useSettingsStore((s) => s.setCalendarSyncEnabled);
  const setDefaultReminderMinutes = useSettingsStore((s) => s.setDefaultReminderMinutes);

  // Timeline grouping
  const timelineGrouping = useSettingsStore((s) => s.timelineGrouping);
  const setTimelineGrouping = useSettingsStore((s) => s.setTimelineGrouping);

  // Session display fields
  const sessionShowExposureCount = useSettingsStore((s) => s.sessionShowExposureCount);
  const sessionShowTotalExposure = useSettingsStore((s) => s.sessionShowTotalExposure);
  const sessionShowFilters = useSettingsStore((s) => s.sessionShowFilters);
  const setSessionShowExposureCount = useSettingsStore((s) => s.setSessionShowExposureCount);
  const setSessionShowTotalExposure = useSettingsStore((s) => s.setSessionShowTotalExposure);
  const setSessionShowFilters = useSettingsStore((s) => s.setSessionShowFilters);

  // Target sort
  const targetSortBy = useSettingsStore((s) => s.targetSortBy);
  const targetSortOrder = useSettingsStore((s) => s.targetSortOrder);
  const targetActionControlMode = useSettingsStore((s) => s.targetActionControlMode);
  const targetActionSizePreset = useSettingsStore((s) => s.targetActionSizePreset);
  const targetActionAutoScaleFromFont = useSettingsStore((s) => s.targetActionAutoScaleFromFont);
  const setTargetSortBy = useSettingsStore((s) => s.setTargetSortBy);
  const setTargetSortOrder = useSettingsStore((s) => s.setTargetSortOrder);
  const setTargetActionControlMode = useSettingsStore((s) => s.setTargetActionControlMode);
  const setTargetActionSizePreset = useSettingsStore((s) => s.setTargetActionSizePreset);
  const setTargetActionAutoScaleFromFont = useSettingsStore(
    (s) => s.setTargetActionAutoScaleFromFont,
  );

  const minuteShort = t("settings.minuteShort");
  const formatMinutes = (minutes: number) => `${minutes} ${minuteShort}`;
  const mapPresetLabel = (preset: (typeof MAP_PRESET_VALUES)[number]) =>
    t(
      preset === "dark"
        ? "location.presetDark"
        : preset === "satellite"
          ? "location.presetSatellite"
          : preset === "terrain3d"
            ? "location.preset3D"
            : "location.presetStandard",
    );

  const sessionGapOptions = SESSION_GAP_VALUES.map((value) => ({
    label: formatMinutes(value),
    value,
  }));
  const reminderOptions = REMINDER_VALUES.map((value) => ({
    label: value === 0 ? t("sessions.noReminder") : formatMinutes(value),
    value,
  }));
  const timelineGroupingOptions = TIMELINE_GROUPING_VALUES.map((value) => ({
    label:
      value === "day"
        ? t("settings.groupByDay")
        : value === "week"
          ? t("settings.groupByWeek")
          : t("settings.groupByMonth"),
    value,
  }));
  const targetSortByOptions = TARGET_SORT_BY_VALUES.map((value) => ({
    label:
      value === "name"
        ? t("settings.targetSortName")
        : value === "date"
          ? t("settings.targetSortDate")
          : value === "frames"
            ? t("settings.targetSortFrames")
            : value === "exposure"
              ? t("settings.targetSortExposure")
              : t("settings.targetSortFavorite"),
    value,
  }));
  const targetSortOrderOptions = TARGET_SORT_ORDER_VALUES.map((value) => ({
    label: value === "asc" ? t("settings.sortAsc") : t("settings.sortDesc"),
    value,
  }));
  const targetActionControlModeOptions = TARGET_ACTION_CONTROL_MODE_VALUES.map((value) => ({
    label:
      value === "icon"
        ? t("settings.targetActionControlModeIcon")
        : t("settings.targetActionControlModeCheckbox"),
    value: value as TargetActionControlMode,
  }));
  const targetActionSizePresetOptions = TARGET_ACTION_SIZE_PRESET_VALUES.map((value) => ({
    label:
      value === "compact"
        ? t("settings.targetActionSizeCompact")
        : value === "standard"
          ? t("settings.targetActionSizeStandard")
          : t("settings.targetActionSizeAccessible"),
    value: value as TargetActionSizePreset,
  }));
  const mapPresetOptions = MAP_PRESET_VALUES.map((value) => ({
    label: mapPresetLabel(value),
    value,
  }));

  return (
    <View testID="e2e-screen-settings__observation" className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-4">
          <Ionicons name="arrow-back" size={24} color="#888" onPress={() => router.back()} />
          <Text className="text-xl font-bold text-foreground">
            {t("settings.categories.observation")}
          </Text>
        </View>

        {/* Target Settings */}
        <SettingsSection title={t("settings.targetDefaults")}>
          <SettingsRow
            icon="telescope-outline"
            label={t("settings.autoGroupByObject")}
            rightElement={
              <Switch
                isSelected={autoGroupByObject}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setAutoGroupByObject(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            testID="e2e-action-settings__observation-open-target-sort-by"
            icon="swap-vertical-outline"
            label={t("settings.targetSortBy")}
            value={
              targetSortBy === "name"
                ? t("settings.targetSortName")
                : targetSortBy === "date"
                  ? t("settings.targetSortDate")
                  : targetSortBy === "frames"
                    ? t("settings.targetSortFrames")
                    : targetSortBy === "exposure"
                      ? t("settings.targetSortExposure")
                      : t("settings.targetSortFavorite")
            }
            onPress={() => openPicker("targetSortBy")}
          />
          <Separator />
          <SettingsRow
            icon="arrow-up-outline"
            label={t("settings.targetSortOrder")}
            value={targetSortOrder === "asc" ? t("settings.sortAsc") : t("settings.sortDesc")}
            onPress={() => openPicker("targetSortOrder")}
          />
          <Separator />
          <SettingsRow
            testID="e2e-action-settings__observation-open-target-action-control-mode"
            icon="options-outline"
            label={t("settings.targetActionControlMode")}
            value={
              targetActionControlMode === "icon"
                ? t("settings.targetActionControlModeIcon")
                : t("settings.targetActionControlModeCheckbox")
            }
            onPress={() => openPicker("targetActionControlMode")}
          />
          <Separator />
          <SettingsRow
            testID="e2e-action-settings__observation-open-target-action-size-preset"
            icon="resize-outline"
            label={t("settings.targetActionSizePreset")}
            value={
              targetActionSizePreset === "compact"
                ? t("settings.targetActionSizeCompact")
                : targetActionSizePreset === "standard"
                  ? t("settings.targetActionSizeStandard")
                  : t("settings.targetActionSizeAccessible")
            }
            onPress={() => openPicker("targetActionSizePreset")}
          />
          <Separator />
          <SettingsRow
            icon="text-outline"
            label={t("settings.targetActionAutoScaleFromFont")}
            rightElement={
              <Switch
                isSelected={targetActionAutoScaleFromFont}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setTargetActionAutoScaleFromFont(v);
                }}
              />
            }
          />
        </SettingsSection>

        {/* Location Settings */}
        <SettingsSection title={t("location.permission")}>
          <SettingsRow
            icon="copy-outline"
            label={t("settings.autoDetectDuplicates")}
            rightElement={
              <Switch
                isSelected={autoDetectDuplicates}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setAutoDetectDuplicates(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="location-outline"
            label={t("location.autoTag")}
            rightElement={
              <Switch
                isSelected={autoTagLocation}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setAutoTagLocation(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="map-outline"
            label={t("settings.mapPreset")}
            value={mapPresetLabel(mapPreset)}
            onPress={() => openPicker("mapPreset")}
          />
          <Separator />
          <SettingsRow
            icon="git-network-outline"
            label={t("settings.mapShowOverlays")}
            rightElement={
              <Switch
                isSelected={mapShowOverlays}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setMapShowOverlays(v);
                }}
              />
            }
          />
        </SettingsSection>

        {/* Session Settings */}
        <SettingsSection title={t("settings.sessions")}>
          <SettingsRow
            testID="e2e-action-settings__observation-open-session-gap"
            icon="time-outline"
            label={t("settings.sessionGap")}
            value={formatMinutes(sessionGapMinutes)}
            onPress={() => openPicker("sessionGap")}
          />
          <Separator />
          <SettingsRow
            icon="calendar-outline"
            label={t("settings.calendarSync")}
            rightElement={
              <Switch
                isSelected={calendarSyncEnabled}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setCalendarSyncEnabled(v);
                }}
              />
            }
          />
          {calendarSyncEnabled && (
            <>
              <Separator />
              <SettingsRow
                icon="notifications-outline"
                label={t("settings.defaultReminder")}
                value={
                  defaultReminderMinutes === 0
                    ? t("sessions.noReminder")
                    : formatMinutes(defaultReminderMinutes)
                }
                onPress={() => openPicker("reminder")}
              />
            </>
          )}
        </SettingsSection>

        {/* Timeline Grouping */}
        <SettingsSection title={t("settings.timelineGrouping")}>
          <SettingsRow
            icon="time-outline"
            label={t("settings.timelineGrouping")}
            value={
              timelineGrouping === "day"
                ? t("settings.groupByDay")
                : timelineGrouping === "week"
                  ? t("settings.groupByWeek")
                  : t("settings.groupByMonth")
            }
            onPress={() => openPicker("timelineGrouping")}
          />
        </SettingsSection>

        {/* Session Display Fields */}
        <SettingsSection title={t("settings.sessionDisplayFields")}>
          <SettingsRow
            icon="camera-outline"
            label={t("settings.sessionShowExposureCount")}
            rightElement={
              <Switch
                isSelected={sessionShowExposureCount}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setSessionShowExposureCount(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="timer-outline"
            label={t("settings.sessionShowTotalExposure")}
            rightElement={
              <Switch
                isSelected={sessionShowTotalExposure}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setSessionShowTotalExposure(v);
                }}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="funnel-outline"
            label={t("settings.sessionShowFilters")}
            rightElement={
              <Switch
                isSelected={sessionShowFilters}
                onSelectedChange={(v: boolean) => {
                  haptics.selection();
                  setSessionShowFilters(v);
                }}
              />
            }
          />
        </SettingsSection>

        {/* Picker Modals */}
        <OptionPickerModal
          visible={activePicker === "mapPreset"}
          title={t("settings.mapPreset")}
          options={mapPresetOptions}
          selectedValue={mapPreset}
          onSelect={setMapPreset}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "sessionGap"}
          title={t("settings.sessionGap")}
          options={sessionGapOptions}
          selectedValue={sessionGapMinutes}
          onSelect={setSessionGapMinutes}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "reminder"}
          title={t("settings.defaultReminder")}
          options={reminderOptions}
          selectedValue={defaultReminderMinutes}
          onSelect={setDefaultReminderMinutes}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "timelineGrouping"}
          title={t("settings.timelineGrouping")}
          options={timelineGroupingOptions}
          selectedValue={timelineGrouping}
          onSelect={setTimelineGrouping}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "targetSortBy"}
          title={t("settings.targetSortBy")}
          options={targetSortByOptions}
          selectedValue={targetSortBy}
          onSelect={setTargetSortBy}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "targetSortOrder"}
          title={t("settings.targetSortOrder")}
          options={targetSortOrderOptions}
          selectedValue={targetSortOrder}
          onSelect={setTargetSortOrder}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "targetActionControlMode"}
          title={t("settings.targetActionControlMode")}
          options={targetActionControlModeOptions}
          selectedValue={targetActionControlMode}
          onSelect={setTargetActionControlMode}
          onClose={closePicker}
        />
        <OptionPickerModal
          visible={activePicker === "targetActionSizePreset"}
          title={t("settings.targetActionSizePreset")}
          options={targetActionSizePresetOptions}
          selectedValue={targetActionSizePreset}
          onSelect={setTargetActionSizePreset}
          onClose={closePicker}
        />
      </ScrollView>
    </View>
  );
}
