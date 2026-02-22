import { View, ScrollView } from "react-native";
import { SettingsHeader } from "../../components/settings";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import {
  ProcessingEditorSection,
  ProcessingStackingSection,
  ProcessingExportSection,
  ProcessingComposeSection,
  ProcessingVideoSection,
  ProcessingPerformanceSection,
  ProcessingFrameClassSection,
} from "../../components/settings/processing";

export default function ProcessingSettingsScreen() {
  const { t } = useI18n();
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  return (
    <View testID="e2e-screen-settings__processing" className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <SettingsHeader title={t("settings.categories.processing")} />

        <ProcessingEditorSection />
        <ProcessingStackingSection />
        <ProcessingExportSection />
        <ProcessingComposeSection />
        <ProcessingVideoSection />
        <ProcessingPerformanceSection />
        <ProcessingFrameClassSection />
      </ScrollView>
    </View>
  );
}
