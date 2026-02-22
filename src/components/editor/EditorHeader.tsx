import { View, Text } from "react-native";
import { Alert as HAlert, Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface EditorHeaderProps {
  filename: string;
  successColor: string;
  mutedColor: string;
  contentPaddingTop: number;
  horizontalPadding: number;
  canUndo: boolean;
  canRedo: boolean;
  hasData: boolean;
  showOriginal: boolean;
  historyIndex: number;
  historyLength: number;
  editorError: string | null;
  fitsError: string | null;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onToggleOriginal: () => void;
  onClearError: () => void;
}

export function EditorHeader({
  filename,
  successColor,
  mutedColor,
  contentPaddingTop,
  horizontalPadding,
  canUndo,
  canRedo,
  hasData,
  showOriginal,
  historyIndex,
  historyLength,
  editorError,
  fitsError,
  onBack,
  onUndo,
  onRedo,
  onExport,
  onToggleOriginal,
  onClearError,
}: EditorHeaderProps) {
  const { t } = useI18n();

  return (
    <>
      {/* Top Bar */}
      <View
        className="flex-row items-center justify-between pb-2"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
      >
        <Button
          testID="e2e-action-editor__param_id-back"
          size="sm"
          variant="outline"
          onPress={onBack}
        >
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <Text
          className="flex-1 mx-2 text-sm font-semibold text-foreground text-center"
          numberOfLines={1}
        >
          {t("editor.title")} - {filename}
        </Text>
        <View className="flex-row gap-1">
          <Button
            testID="e2e-action-editor__param_id-undo"
            size="sm"
            variant="outline"
            onPress={onUndo}
            isDisabled={!canUndo}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={14}
              color={canUndo ? successColor : mutedColor}
            />
          </Button>
          <Button
            testID="e2e-action-editor__param_id-redo"
            size="sm"
            variant="outline"
            onPress={onRedo}
            isDisabled={!canRedo}
          >
            <Ionicons
              name="arrow-redo-outline"
              size={14}
              color={canRedo ? successColor : mutedColor}
            />
          </Button>
          <Button
            testID="e2e-action-editor__param_id-toggle-original"
            size="sm"
            variant={showOriginal ? "primary" : "outline"}
            onPress={onToggleOriginal}
            isDisabled={!hasData || historyLength <= 1}
          >
            <Ionicons
              name={showOriginal ? "eye-outline" : "eye-off-outline"}
              size={14}
              color={showOriginal ? "#fff" : mutedColor}
            />
          </Button>
          <Button
            testID="e2e-action-editor__param_id-open-export"
            size="sm"
            variant="outline"
            onPress={onExport}
            isDisabled={!hasData}
          >
            <Ionicons name="share-outline" size={14} color={hasData ? successColor : mutedColor} />
          </Button>
        </View>
      </View>

      {/* Error alerts */}
      {(editorError || fitsError) && (
        <View className="gap-2 px-3 pb-2">
          {editorError && (
            <HAlert status="danger">
              <HAlert.Indicator />
              <HAlert.Content>
                <HAlert.Title>{t("common.error")}</HAlert.Title>
                <HAlert.Description>{editorError}</HAlert.Description>
              </HAlert.Content>
              <Button size="sm" variant="outline" onPress={onClearError}>
                <Button.Label>{t("common.close")}</Button.Label>
              </Button>
            </HAlert>
          )}
          {fitsError && (
            <HAlert status="danger">
              <HAlert.Indicator />
              <HAlert.Content>
                <HAlert.Title>{t("common.error")}</HAlert.Title>
                <HAlert.Description>{fitsError}</HAlert.Description>
              </HAlert.Content>
            </HAlert>
          )}
        </View>
      )}

      {/* History indicator */}
      {historyLength > 1 && (
        <View className="flex-row items-center gap-1 px-3 py-1 bg-background">
          <Ionicons name="time-outline" size={10} color={mutedColor} />
          <Text className="text-[9px] text-muted">
            {historyIndex}/{historyLength - 1} {t("editor.edits")}
          </Text>
        </View>
      )}
    </>
  );
}
