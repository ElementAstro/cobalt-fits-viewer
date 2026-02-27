import { Text, View } from "react-native";
import { Button, Select, Switch, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface AudioTrack {
  id: string;
  label?: string;
  language?: string;
}

interface SubtitleTrack {
  id: string;
  label?: string;
  language?: string;
}

interface VideoControlsProps {
  isLoop: boolean;
  isMuted: boolean;
  isVideo: boolean;
  isSaving: boolean;
  videoProcessingEnabled: boolean;
  isEngineAvailable: boolean;
  availableAudioTracks: AudioTrack[];
  availableSubtitleTracks: SubtitleTrack[];
  activeAudioTrackId: string | null;
  activeSubtitleTrackId: string | null;
  onToggleLoop: () => void;
  onToggleMute: () => void;
  onSelectAudioTrack: (id: string | null) => void;
  onSelectSubtitleTrack: (id: string | null) => void;
  onSaveToLibrary: () => void;
  onShare: () => void;
  onOpenProcessing: () => void;
  onOpenQueue: () => void;
  onSetThumbnail?: () => void;
}

export function VideoControls({
  isLoop,
  isMuted,
  isVideo,
  isSaving,
  videoProcessingEnabled,
  isEngineAvailable,
  availableAudioTracks,
  availableSubtitleTracks,
  activeAudioTrackId,
  activeSubtitleTrackId,
  onToggleLoop,
  onToggleMute,
  onSelectAudioTrack,
  onSelectSubtitleTrack,
  onSaveToLibrary,
  onShare,
  onOpenProcessing,
  onOpenQueue,
  onSetThumbnail,
}: VideoControlsProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  return (
    <>
      <View className="mt-3 flex-row items-center gap-2">
        <Switch isSelected={isLoop} onSelectedChange={onToggleLoop}>
          <Switch.Thumb />
          <Text className="text-xs text-foreground">{t("settings.videoLoop")}</Text>
        </Switch>
        <Switch isSelected={!isMuted} onSelectedChange={onToggleMute}>
          <Switch.Thumb />
          <Text className="text-xs text-foreground">{t("settings.videoAudio")}</Text>
        </Switch>
      </View>

      {(availableAudioTracks.length > 0 || (isVideo && availableSubtitleTracks.length > 0)) && (
        <View className="mt-3 flex-row items-center gap-2">
          {availableAudioTracks.length > 0 && (
            <Select
              className="flex-1"
              value={
                activeAudioTrackId
                  ? { value: activeAudioTrackId, label: activeAudioTrackId }
                  : undefined
              }
              onValueChange={(option) => onSelectAudioTrack(option?.value ?? null)}
            >
              <Select.Trigger>
                <Select.Value placeholder={t("settings.videoAudioTrackPlaceholder")} />
                <Select.TriggerIndicator />
              </Select.Trigger>
              <Select.Portal>
                <Select.Overlay />
                <Select.Content presentation="popover">
                  {availableAudioTracks.map((track) => (
                    <Select.Item
                      key={track.id}
                      value={track.id}
                      label={track.label || track.language || track.id}
                    >
                      <Select.ItemLabel />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>
          )}
          {isVideo && availableSubtitleTracks.length > 0 && (
            <Select
              className="flex-1"
              value={
                activeSubtitleTrackId
                  ? { value: activeSubtitleTrackId, label: activeSubtitleTrackId }
                  : undefined
              }
              onValueChange={(option) => onSelectSubtitleTrack(option?.value ?? null)}
            >
              <Select.Trigger>
                <Select.Value placeholder={t("settings.videoSubtitleTrackPlaceholder")} />
                <Select.TriggerIndicator />
              </Select.Trigger>
              <Select.Portal>
                <Select.Overlay />
                <Select.Content presentation="popover">
                  {availableSubtitleTracks.map((track) => (
                    <Select.Item
                      key={track.id}
                      value={track.id}
                      label={track.label || track.language || track.id}
                    >
                      <Select.ItemLabel />
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select>
          )}
        </View>
      )}

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        <Button variant="outline" onPress={onSaveToLibrary} isDisabled={isSaving}>
          <Ionicons name="download-outline" size={14} color={mutedColor} />
          <Button.Label>{t("settings.videoSave")}</Button.Label>
        </Button>
        <Button variant="outline" onPress={onShare}>
          <Ionicons name="share-social-outline" size={14} color={mutedColor} />
          <Button.Label>{t("settings.videoShare")}</Button.Label>
        </Button>
        <Button
          variant="primary"
          onPress={onOpenProcessing}
          isDisabled={!videoProcessingEnabled || !isEngineAvailable || !isVideo}
        >
          <Ionicons name="build-outline" size={14} color="#fff" />
          <Button.Label>{t("settings.videoProcess")}</Button.Label>
        </Button>
        <Button
          testID="e2e-action-video__param_id-open-queue"
          variant="outline"
          onPress={onOpenQueue}
        >
          <Ionicons name="list-outline" size={14} color={mutedColor} />
          <Button.Label>{t("settings.videoQueue")}</Button.Label>
        </Button>
        {isVideo && onSetThumbnail && (
          <Button variant="outline" onPress={onSetThumbnail}>
            <Ionicons name="camera-outline" size={14} color={mutedColor} />
            <Button.Label>{t("settings.videoSetThumbnail")}</Button.Label>
          </Button>
        )}
      </View>
    </>
  );
}
